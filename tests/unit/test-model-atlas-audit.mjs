// MI-1B audit tests: the read-only Atlas doctor must detect every integrity
// class without repairing, rewriting, or deleting evidence.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { createModelAtlas } from '../../node/src/services/model-atlas.ts';

const HASH_A = 'a'.repeat(64);
const HASH_D = 'd'.repeat(64);

function condition(conditionName, passed, total) {
  return {
    condition: conditionName,
    outcome: 'COMPLETED',
    score: { passed, total, ratio: passed / total },
    latency: null,
    tokens: null,
    failures: [],
    categories: [],
    evidence_refs: []
  };
}

function record(overrides = {}) {
  const base = {
    schema: 'covert.model-atlas.evaluation.v1',
    evaluation_id: overrides.evaluation_id ?? randomUUID(),
    model_id: 'local:audit-model',
    display_name: 'Audit Model',
    fingerprint: {
      model_id: 'local:audit-model',
      source_revision: 'rev1',
      artifact_sha256: HASH_A,
      quantization: 'Q8_0',
      runtime_id: 'llama.cpp',
      runtime_version: '9940',
      harness_version: '2.1.0',
      benchmark_id: 'covert-scaffold-context-ablation',
      benchmark_version: '1.0.0',
      grader_version: '1.0.0',
      inference_config_digest: null,
      machine_profile_digest: HASH_D,
      execution_node: 'local-windows',
      chat_template: 'present'
    },
    hardware_profile: { cpu: 'test', ram_bytes: 1024, gpu: null, vram_bytes: null, backend: 'cpu', digest: HASH_D, execution_node: 'local-windows', execution_domain: 'WORKSPACE' },
    native: condition('NATIVE', 0, 10),
    harnessed: condition('HARNESSED', 2, 10),
    comparison: { basis: 'scaffold-ablation', delta_score: 0.2, delta_latency_ms: null, delta_tokens: null, categories: [] },
    qualification: {
      state: 'TESTED',
      basis: { source_revision: 'rev1', artifact_sha256: HASH_A, runtime_id: 'llama.cpp', runtime_version: '9940' },
      stale_reasons: []
    },
    recommended_roles: [],
    known_failures: [],
    known_limitations: [],
    evidence_refs: ['docs/evidence/example.json'],
    evaluated_at: '2026-10-05T10:00:00.000Z',
    completed_at: '2026-10-05T10:00:00.000Z',
    receipt: { native_attempted: true, harnessed_attempted: true, executed: true, notes: [] }
  };
  return { ...base, ...overrides };
}

async function setup() {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'covert-audit-'));
  const evaluationsDir = path.join(workspace, '.aide', 'atlas', 'evaluations');
  const atlas = createModelAtlas({ workspace });
  return { workspace, evaluationsDir, atlas };
}

async function writeForeignCanonicalFile(evaluationsDir, value) {
  // Simulates a schema-valid write that bypassed the service (foreign/tampered),
  // including a correct integrity sidecar, so only content-level checks can see it.
  const file = path.join(evaluationsDir, `${value.evaluation_id}.json`);
  const bytes = JSON.stringify(value, null, 2) + '\n';
  await fs.writeFile(file, bytes, 'utf8');
  await fs.writeFile(path.join(evaluationsDir, `${value.evaluation_id}.sha256`), JSON.stringify({
    schema: 'covert.model-atlas.integrity.v1',
    evaluation_id: value.evaluation_id,
    sha256: createHash('sha256').update(Buffer.from(bytes, 'utf8')).digest('hex'),
    bytes: Buffer.byteLength(bytes)
  }), 'utf8');
}

test('healthy store audits clean', async () => {
  const { atlas } = await setup();
  await atlas.recordEvaluation(record());
  const report = await atlas.audit();
  assert.equal(report.healthy, true);
  assert.deepEqual(report.totals, { records: 1, corrupt: 0, integrity_mismatch: 0, unverified: 0, models: 1 });
  assert.deepEqual(report.issues, []);
});

test('corrupt files and tampered records make the store unhealthy without deletion', async () => {
  const { evaluationsDir, atlas } = await setup();
  const item = await atlas.recordEvaluation(record());
  await fs.writeFile(path.join(evaluationsDir, 'broken.json'), '{oops', 'utf8');
  const target = path.join(evaluationsDir, `${item.evaluation_id}.json`);
  const tampered = JSON.parse(await fs.readFile(target, 'utf8'));
  tampered.harnessed.score = { passed: 10, total: 10, ratio: 1 };
  await fs.writeFile(target, JSON.stringify(tampered), 'utf8');

  const report = await atlas.audit();
  assert.equal(report.healthy, false);
  assert.equal(report.totals.corrupt, 1);
  assert.equal(report.totals.integrity_mismatch, 1);
  assert.ok(report.issues.some(issue => issue.kind === 'CORRUPT' && issue.file === 'broken.json'));
  assert.ok(report.issues.some(issue => issue.kind === 'INTEGRITY_MISMATCH'));
  assert.equal((await fs.readdir(evaluationsDir)).filter(name => name.endsWith('.json')).length, 2);
});

test('missing integrity sidecar reports unverified but does not flag corruption', async () => {
  const { evaluationsDir, atlas } = await setup();
  const item = await atlas.recordEvaluation(record());
  await fs.rm(path.join(evaluationsDir, `${item.evaluation_id}.sha256`));
  const report = await atlas.audit();
  assert.equal(report.totals.unverified, 1);
  assert.equal(report.healthy, true);
  assert.ok(report.issues.some(issue => issue.kind === 'UNVERIFIED'));
});

test('a schema-valid foreign record with unbound recommendation refs is caught by the audit', async () => {
  const { evaluationsDir, atlas } = await setup();
  const foreign = record({
    recommended_roles: [{ role: 'CODER', reason: 'foreign write', evidence_refs: ['missing-ref'] }]
  });
  await fs.mkdir(evaluationsDir, { recursive: true });
  await writeForeignCanonicalFile(evaluationsDir, foreign);
  const report = await atlas.audit();
  assert.equal(report.healthy, false);
  assert.deepEqual(report.dangling_recommendation_refs, [{ evaluation_id: foreign.evaluation_id, role: 'CODER', missing_ref: 'missing-ref' }]);
});

test('unsupported schema files are reported separately from generic corruption', async () => {
  const { evaluationsDir, atlas } = await setup();
  await fs.mkdir(evaluationsDir, { recursive: true });
  await fs.writeFile(path.join(evaluationsDir, 'future.json'), JSON.stringify({ ...record(), schema: 'covert.model-atlas.evaluation.v9' }), 'utf8');
  const report = await atlas.audit();
  assert.equal(report.healthy, false);
  assert.deepEqual(report.unsupported_schema_files, ['future.json']);
  assert.equal(report.totals.corrupt, 1);
});

test('evidence resolver classifies dangling references without touching the filesystem', async () => {
  const { atlas } = await setup();
  await atlas.recordEvaluation(record());
  const exists = await atlas.audit({ evidenceResolver: () => true });
  assert.deepEqual(exists.evidence_refs, { checked: true, total: 1, dangling: 0 });
  assert.equal(exists.healthy, true);

  const missing = await atlas.audit({ evidenceResolver: () => false });
  assert.deepEqual(missing.evidence_refs, { checked: true, total: 1, dangling: 1 });
  assert.equal(missing.healthy, false);

  const throwing = await atlas.audit({ evidenceResolver: () => { throw new Error('denied'); } });
  assert.deepEqual(throwing.evidence_refs, { checked: true, total: 1, dangling: 1 });
});
