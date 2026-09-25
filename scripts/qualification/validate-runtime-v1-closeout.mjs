import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { RuntimeStatusResponse } from '../../common/contracts/runtime.ts';

const root = process.cwd();
const docs = path.join(root, 'docs', 'design', 'local-runtime-lab');
const evidence = path.join(docs, 'evidence');
const expectedArtifact = '02a8b7e17487d326e46d68ce0ba24211e1b80a14c4cd0597fa73c1cd697f52ed';

async function json(relativePath) {
  return JSON.parse((await readFile(path.join(root, relativePath), 'utf8')).replace(/^\uFEFF/, ''));
}

async function sha256(filePath) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest('hex');
}

function publicProjectionSafe(value) {
  const encoded = JSON.stringify(value);
  assert.doesNotMatch(encoded, /[A-Z]:\\(?:Users|Unsloth-Studio|aide-sovereign-workbench-runtime-lab)\\/i, 'public handoff contains a machine-private path');
  assert.doesNotMatch(encoded, /Bearer\s+[A-Za-z0-9._~+/-]{16,}|eyJ[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{8,}/i, 'public handoff contains credential-shaped material');
}

const passport = await json('docs/design/local-runtime-lab/evidence/UNSLOTH-RUNTIME-PASSPORT-V1.json');
assert.equal(passport.qualification_state, 'QUALIFIED');
assert.equal(passport.runtime.name, 'Unsloth');
assert.equal(passport.runtime.version, '2026.9.11');
assert.equal(passport.runtime.serving_backend, 'VULKAN');
assert.equal(passport.artifact.sha256, expectedArtifact);
assert.equal(passport.artifact.bytes, 1_674_455_040);
assert.equal(passport.capabilities.tool_calling.classification, 'PARTIAL');
assert.equal(passport.capabilities.tool_calling.raw_pre_repair_output, 'UNAVAILABLE');
assert.equal(passport.capabilities.tool_calling.repair_attribution, 'UNKNOWN');
assert.equal(passport.capabilities.structured_output.native_strict_schema, 'NOT SUPPORTED — COVERT VALIDATION REQUIRED');
assert.equal(passport.capabilities.structured_output.covert_validator, 'PASS_DETERMINISTIC_FAIL_CLOSED');
assert.equal(passport.performance.soak.completed, true);
assert.equal(passport.performance.soak.failures, 0);
assert.ok(passport.performance.soak.duration_ms >= 30 * 60_000);

const passportHash = await sha256(path.join(evidence, 'UNSLOTH-RUNTIME-PASSPORT-V1.json'));
const expectedPassportHash = (await readFile(path.join(evidence, 'UNSLOTH-RUNTIME-PASSPORT-V1.sha256'), 'utf8')).trim().split(/\s+/)[0]?.toLowerCase();
assert.equal(passportHash, expectedPassportHash, 'Passport sidecar SHA-256 mismatch');

const runbookHash = await sha256(path.join(docs, 'UNSLOTH-V1-INSTALL-RUNBOOK.md'));
assert.equal(passport.installation.runbook_sha256, runbookHash, 'canonical runbook hash mismatch');
const reconcileHash = await sha256(path.join(root, 'scripts', 'qualification', 'unsloth-install-reconcile.ps1'));
assert.equal(passport.installation.reconciler_sha256, reconcileHash, 'reconciler hash mismatch');

const install = await json('docs/design/local-runtime-lab/evidence/RT-V1-INSTALL-RECONCILIATION.json');
assert.equal(install.state, 'CURRENT_INSTALL_RECOGNIZED_VERSION_MATCHED');
assert.equal(install.detected_version, '2026.9.11');
assert.equal(install.action, 'NO_DESTRUCTIVE_REINSTALL_REQUIRED');
assert.equal(install.credentials_read, false);

const modelManager = await json('docs/design/local-runtime-lab/evidence/LUNA-RUNTIME-STATUS-FIXTURE-V1.json');
RuntimeStatusResponse.parse(modelManager.status);
assert.equal(modelManager.status.canonical_backend, 'UNSLOTH');
assert.equal(modelManager.status.version, '2026.9.11');
assert.equal(modelManager.status.health, 'STOPPED');
assert.equal(modelManager.status.ownership, 'UNKNOWN');
assert.equal(modelManager.status.loaded_model, null);
assert.equal(modelManager.runtime_state.runtime_qualified, true);
assert.equal(modelManager.runtime_state.artifact_qualified, true);
assert.equal(modelManager.runtime_state.qualification_state, 'QUALIFIED');
assert.equal(modelManager.runtime_state.passport_sha256, passportHash);
assert.equal(modelManager.v1_capability_classification.tool_calling, 'PARTIAL');
assert.equal(modelManager.v1_capability_classification.tool_repair_attribution, 'UNKNOWN');
publicProjectionSafe(modelManager);

const operatorControl = await json('docs/design/local-runtime-lab/evidence/OPERATOR-CONTROL-RUNTIME-FIXTURE-V1.json');
assert.equal(operatorControl.runtime, 'Unsloth');
assert.equal(operatorControl.version, '2026.9.11');
assert.equal(operatorControl.health, 'STOPPED');
assert.equal(operatorControl.qualification, 'QUALIFIED');
assert.equal(operatorControl.passport, 'VALID');
assert.equal(operatorControl.passport_sha256, passportHash);
assert.equal(operatorControl.last_qualification.native_strict_structured_output, 'NOT SUPPORTED — COVERT VALIDATION REQUIRED');
assert.equal(operatorControl.last_qualification.tool_calling, 'PARTIAL');
assert.equal(operatorControl.last_qualification.tool_repair_attribution, 'UNKNOWN');
publicProjectionSafe(operatorControl);

const testResults = await json('docs/design/local-runtime-lab/evidence/RT-V1-DETERMINISTIC-RESULTS.json');
assert.equal(testResults.status, 'PASS');
assert.equal(testResults.checks.focused_runtime_authority_output_suite.failed, 0);
assert.equal(testResults.checks.focused_runtime_authority_output_suite.passed, 46);
assert.equal(testResults.checks.expanded_runtime_architecture_suite.failed, 0);
assert.equal(testResults.checks.expanded_runtime_architecture_suite.passed, 59);
assert.equal(testResults.checks.expanded_runtime_architecture_suite.skipped, 6);
assert.equal(testResults.checks.node_typescript.status, 'PASS');

const manifest = await json('docs/design/local-runtime-lab/evidence/RT-RUNTIME-EVIDENCE-MANIFEST.json');
assert.ok(Array.isArray(manifest.entries) && manifest.entries.length > 0);
assert.ok(manifest.entries.every(entry => /^[a-f0-9]{64}$/i.test(entry.sha256) && Number.isSafeInteger(entry.bytes) && entry.bytes >= 0));
assert.equal(manifest.passport.sha256, passportHash);
assert.ok(manifest.entries.some(entry => entry.role === 'LIVE_RUNTIME_TRACE'));
assert.ok(manifest.entries.some(entry => entry.role === 'FAILED_RESOURCE_PREFLIGHT'));
assert.ok(manifest.entries.some(entry => entry.role === 'HOST_RESOURCE_CLOSEOUT'));
assert.ok(manifest.entries.some(entry => entry.role === 'HOST_IDLE_BASELINE'));

const liveTrace = await readFile(path.join(evidence, 'RT-V1-LIVE-TRACE.jsonl'), 'utf8');
const traceEvents = liveTrace.trim().split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
assert.ok(traceEvents.some(event => event.event === 'QUALIFICATION_RUN_COMPLETE'));
assert.ok(traceEvents.some(event => event.event === 'FINAL_CLEANUP' && event.pass === true));
const soakSummary = traceEvents.find(event => event.event === 'SOAK_SUMMARY');
assert.ok(soakSummary?.completed === true && soakSummary.duration_ms >= 30 * 60_000);
const soakTicks = traceEvents.filter(event => event.event === 'SOAK_TICK');
assert.equal(soakTicks.length, soakSummary.ticks);
assert.ok(soakTicks.every(event => event.pass === true && event.runtime?.health === 'HEALTHY' && event.runtime?.ownership === 'COVERT_OWNED'));
assert.ok(soakTicks.every(event => event.runtime?.artifact_sha256 === expectedArtifact));
assert.ok(soakSummary.min_free_ram_bytes >= 5.25 * 1024 ** 3);
assert.ok(soakSummary.min_free_commit_bytes >= 2.75 * 1024 ** 3);
assert.ok(traceEvents.some(event => event.event === 'AUTHENTICATION' && event.pass === true && event.unauthenticated_status === 401 && event.authenticated_status === 200 && event.credential_value_logged === false));
assert.ok(traceEvents.some(event => event.event === 'TOOL_AUTHORITY' && event.operation_kind === 'workspace.read' && event.accepted === true && event.executed === true));
assert.ok(traceEvents.some(event => event.event === 'TOOL_FAILURE_PATH' && event.malformed_argument_rejected === true && event.malformed_json_rejected === true && event.authority_not_called_for_invalid_envelope === true && event.session_recovered === true));
assert.ok(traceEvents.some(event => event.event === 'STRUCTURED_COVERT_VALIDATION' && event.pass === true && event.no_false_acceptance === true && event.accepted_value_present === false && event.retry_count === 0));
assert.ok(traceEvents.some(event => event.event === 'QUALIFICATION_RUN_COMPLETE' && event.backend === 'VULKAN' && event.artifact_sha256 === expectedArtifact && event.hard_crash_injected === false));
publicProjectionSafe(traceEvents);

let repositoryEntries = 0;
let externalEntries = 0;
for (const entry of manifest.entries) {
  const filePath = entry.location?.kind === 'repository'
    ? path.resolve(root, entry.location.path)
    : entry.location?.path;
  assert.ok(typeof filePath === 'string' && path.isAbsolute(filePath), 'evidence path must be absolute after resolution');
  if (entry.location.kind === 'repository') {
    assert.ok(filePath.startsWith(root + path.sep), 'repository evidence path escaped repository root');
    repositoryEntries += 1;
  } else {
    externalEntries += 1;
  }
  const details = await stat(filePath);
  assert.equal(details.size, entry.bytes, `evidence size mismatch: ${entry.location.path}`);
  assert.equal(await sha256(filePath), entry.sha256.toLowerCase(), `evidence hash mismatch: ${entry.location.path}`);
}
const rawTraceEntry = manifest.entries.find(entry => entry.role === 'LIVE_RUNTIME_TRACE');
assert.equal(rawTraceEntry.sha256, passport.evidence.raw_trace.sha256);
assert.equal(rawTraceEntry.bytes, passport.evidence.raw_trace.bytes);

process.stdout.write(JSON.stringify({
  status: 'PASS', passport_sha256: passportHash,
  runbook_sha256: runbookHash, reconciler_sha256: reconcileHash,
  model_manager_schema: 'PASS', operator_control_sanitization: 'PASS',
  evidence_entries: manifest.entries.length, repository_evidence_entries: repositoryEntries,
  external_evidence_entries: externalEntries, live_trace_events: traceEvents.length,
  tool_execution_and_rejection: 'PASS', structured_output_fail_closed: 'PASS', soak: 'PASS', owned_cleanup: 'PASS'
}) + '\n');
