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
assert.equal(passport.runtime.version, '2026.9.11');
assert.equal(passport.runtime.backend, 'VULKAN');
assert.equal(passport.artifact.sha256, expectedArtifact);
assert.equal(passport.artifact.bytes, 1_674_455_040);

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
publicProjectionSafe(modelManager);

const operatorControl = await json('docs/design/local-runtime-lab/evidence/OPERATOR-CONTROL-RUNTIME-FIXTURE-V1.json');
assert.equal(operatorControl.runtime, 'Unsloth');
assert.equal(operatorControl.version, '2026.9.11');
assert.equal(operatorControl.health, 'STOPPED');
assert.equal(operatorControl.qualification, 'QUALIFIED');
assert.equal(operatorControl.passport, 'VALID');
publicProjectionSafe(operatorControl);

const testResults = await json('docs/design/local-runtime-lab/evidence/RT-V1-DETERMINISTIC-RESULTS.json');
assert.equal(testResults.status, 'PASS');
assert.equal(testResults.failed, 0);
assert.equal(testResults.passed, testResults.tests);

const manifest = await json('docs/design/local-runtime-lab/evidence/RT-RUNTIME-EVIDENCE-MANIFEST.json');
assert.ok(Array.isArray(manifest.entries) && manifest.entries.length > 0);
assert.ok(manifest.entries.every(entry => /^[a-f0-9]{64}$/i.test(entry.sha256) && Number.isSafeInteger(entry.bytes) && entry.bytes >= 0));
assert.equal(manifest.passport.sha256, passportHash);
assert.ok(manifest.entries.some(entry => entry.role === 'LIVE_RUNTIME_TRACE'));
assert.ok(manifest.entries.some(entry => entry.role === 'FAILED_RESOURCE_PREFLIGHT'));

const liveTrace = await readFile(path.join(evidence, 'RT-V1-LIVE-TRACE.jsonl'), 'utf8');
const traceEvents = liveTrace.trim().split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
assert.ok(traceEvents.some(event => event.event === 'QUALIFICATION_RUN_COMPLETE'));
assert.ok(traceEvents.some(event => event.event === 'FINAL_CLEANUP' && event.pass === true));
const soakSummary = traceEvents.find(event => event.event === 'SOAK_SUMMARY');
assert.ok(soakSummary?.completed === true && soakSummary.duration_ms >= 30 * 60_000);
publicProjectionSafe(traceEvents);

const repoEntries = manifest.entries.filter(entry => entry.location?.kind === 'repository');
for (const entry of repoEntries) {
  const filePath = path.resolve(root, entry.location.path);
  assert.ok(filePath.startsWith(root + path.sep), 'repository evidence path escaped repository root');
  const details = await stat(filePath);
  assert.equal(details.size, entry.bytes, `evidence size mismatch: ${entry.location.path}`);
  assert.equal(await sha256(filePath), entry.sha256.toLowerCase(), `evidence hash mismatch: ${entry.location.path}`);
}

process.stdout.write(JSON.stringify({
  status: 'PASS', passport_sha256: passportHash,
  runbook_sha256: runbookHash, reconciler_sha256: reconcileHash,
  model_manager_schema: 'PASS', operator_control_sanitization: 'PASS',
  evidence_entries: manifest.entries.length, live_trace_events: traceEvents.length
}) + '\n');
