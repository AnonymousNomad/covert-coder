import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { RuntimeStatusResponse } from '../../common/contracts/runtime.ts';

const root = process.cwd();
const docs = path.join(root, 'docs', 'design', 'local-runtime-lab');
const evidenceRoot = path.join(docs, 'evidence');

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(root, relativePath), 'utf8'));
}

async function sha256(filePath) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest('hex');
}

function sanitized(value) {
  const encoded = JSON.stringify(value);
  assert.doesNotMatch(encoded, /[A-Z]:\\(?:Users|Unsloth-Studio|aide-sovereign-workbench-runtime-lab)\\/i);
  assert.doesNotMatch(encoded, /Bearer\s+[A-Za-z0-9._~+/-]{16,}|eyJ[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{8,}/i);
}

const gate = await readJson('docs/design/local-runtime-lab/evidence/RT-V1-CURRENT-RESOURCE-GATE.json');
assert.equal(gate.execution_context.administrator, true);
assert.equal(gate.start_guardrail.pass, false);
assert.ok(gate.resources.free_ram_node_bytes < gate.start_guardrail.free_ram_node_bytes_minimum);
assert.ok(gate.resources.free_commit_bytes < gate.start_guardrail.free_commit_bytes_minimum);
assert.deepEqual(gate.start_guardrail.blocked_reasons, [
  'FREE_RAM_BELOW_START_GUARDRAIL',
  'FREE_WINDOWS_COMMIT_BELOW_START_GUARDRAIL'
]);
assert.equal(gate.side_effects.runtime_started, false);
assert.equal(gate.side_effects.model_loaded, false);
assert.equal(gate.side_effects.credentials_read, false);

const install = await readJson('docs/design/local-runtime-lab/evidence/RT-V1-INSTALL-RECONCILIATION.json');
assert.equal(install.state, 'CURRENT_INSTALL_RECOGNIZED_VERSION_MATCHED');
assert.equal(install.detected_version, '2026.9.11');
assert.equal(install.runtime_started, false);
assert.equal(install.credentials_read, false);

const statusFixture = await readJson('docs/design/local-runtime-lab/evidence/LUNA-RUNTIME-STATUS-FIXTURE-V1.json');
RuntimeStatusResponse.parse(statusFixture.status);
assert.equal(statusFixture.status.health, 'STOPPED');
assert.equal(statusFixture.status.ownership, 'UNKNOWN');
assert.equal(statusFixture.status.pid, null);
assert.equal(statusFixture.status.loaded_model, null);
assert.equal(statusFixture.runtime_state.v1_closeout_state, 'BLOCKED_RESOURCE_START_GATE');
assert.equal(statusFixture.v1_capability_classification.native_strict_structured_output, 'NOT_SUPPORTED — COVERT VALIDATION REQUIRED');
sanitized(statusFixture);

const operatorFixture = await readJson('docs/design/local-runtime-lab/evidence/OPERATOR-CONTROL-RUNTIME-FIXTURE-V1.json');
assert.equal(operatorFixture.health, 'STOPPED');
assert.equal(operatorFixture.qualification, 'QUALIFIED_WITH_LIMITATIONS_FOR_PRIOR_EXACT_PROFILE');
assert.equal(operatorFixture.v1_closeout, 'BLOCKED_RESOURCE_START_GATE');
sanitized(operatorFixture);

const manifest = await readJson('docs/design/local-runtime-lab/evidence/RT-V1-PREQUALIFICATION-EVIDENCE-MANIFEST.json');
assert.equal(manifest.status, 'OPEN_RESOURCE_BLOCKED');
assert.equal(manifest.passport.final_v1_closeout_passport_frozen, false);
assert.ok(manifest.entries.some(entry => entry.role === 'FAILED_RESOURCE_PREFLIGHT'));
assert.ok(manifest.entries.some(entry => entry.role === 'HISTORICAL_LIVE_RUNTIME_TRACE'));
for (const entry of manifest.entries) {
  assert.match(entry.sha256, /^[a-f0-9]{64}$/i);
  assert.ok(Number.isSafeInteger(entry.bytes) && entry.bytes >= 0);
  const filePath = entry.location.kind === 'repository'
    ? path.resolve(root, entry.location.path)
    : entry.location.path;
  const details = await stat(filePath);
  assert.equal(details.size, entry.bytes, `evidence size mismatch: ${entry.role}`);
  assert.equal(await sha256(filePath), entry.sha256.toLowerCase(), `evidence hash mismatch: ${entry.role}`);
}
const oldPassportHash = await sha256(path.join(evidenceRoot, 'UNSLOTH-RUNTIME-PASSPORT.json'));
assert.equal(oldPassportHash, manifest.passport.sha256.toLowerCase());

const jsonFiles = (await readdir(evidenceRoot)).filter(name => name.endsWith('.json'));
for (const name of jsonFiles) JSON.parse(await readFile(path.join(evidenceRoot, name), 'utf8'));

process.stdout.write(JSON.stringify({
  status: 'PASS_BLOCKED_CHECKPOINT',
  reason: 'free RAM and free commit are below the configured start gate',
  runtime_status_schema: 'PASS',
  public_handoffs_sanitized: true,
  evidence_entries_hashed_and_verified: manifest.entries.length,
  evidence_json_files_validated: jsonFiles.length,
  historical_passport_sha256: oldPassportHash
}) + '\n');
