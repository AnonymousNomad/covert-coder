import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createModelAtlas, AtlasRefusalError } from '../../node/src/services/model-atlas.ts';

const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);
const HASH_C = 'c'.repeat(64);
const HASH_D = 'd'.repeat(64);

function condition(conditionName, passed, total) {
  return {
    condition: conditionName,
    outcome: 'COMPLETED',
    score: { passed, total, ratio: total === 0 ? 0 : passed / total },
    latency: { total_ms: 1000, mean_ms: 100 },
    tokens: { total: 500, mean: 50 },
    failures: [],
    categories: [{ id: 'format', passed, total }],
    evidence_refs: []
  };
}

function record(overrides = {}) {
  const base = {
    schema: 'covert.model-atlas.evaluation.v1',
    evaluation_id: randomUUID(),
    model_id: 'local:test-model',
    display_name: 'Test Model',
    fingerprint: {
      model_id: 'local:test-model',
      source_revision: 'rev1',
      artifact_sha256: HASH_A,
      quantization: 'Q8_0',
      runtime_id: 'unsloth',
      runtime_version: '1.0.0',
      harness_version: '2.1.0',
      benchmark_id: 'covert-scaffold-context-ablation',
      benchmark_version: '1.0.0',
      grader_version: '1.0.0',
      inference_config_digest: HASH_C,
      machine_profile_digest: HASH_D,
      execution_node: 'local-windows',
      chat_template: 'present'
    },
    hardware_profile: { cpu: 'test-cpu', ram_bytes: 1024, gpu: 'test-gpu', vram_bytes: 512, backend: 'cpu', digest: HASH_D, execution_node: 'local-windows', execution_domain: 'WORKSPACE' },
    native: condition('NATIVE', 5, 10),
    harnessed: condition('HARNESSED', 8, 10),
    comparison: {
      basis: 'scaffold-ablation',
      delta_score: 0.3,
      delta_latency_ms: -100,
      delta_tokens: 20,
      categories: [{ id: 'format', native_passed: 5, harnessed_passed: 8, total: 10 }]
    },
    qualification: {
      state: 'TESTED',
      basis: { source_revision: 'rev1', artifact_sha256: HASH_A, runtime_id: 'unsloth', runtime_version: '1.0.0' },
      stale_reasons: []
    },
    recommended_roles: [{ role: 'CODER', reason: 'measured scaffold improvement in coding tasks', evidence_refs: ['eval-native'] }],
    known_failures: [{ code: 'timeout', detail: 'one task timed out in the native condition' }],
    known_limitations: ['single hardware profile'],
    evidence_refs: ['eval-native', 'eval-harnessed'],
    evaluated_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
    receipt: { native_attempted: true, harnessed_attempted: true, executed: true, notes: ['paired ablation'] }
  };
  return { ...base, ...overrides, fingerprint: { ...base.fingerprint, ...(overrides.fingerprint ?? {}) } };
}

function currentBasis(overrides = {}) {
  return {
    source_revision: 'rev1',
    artifact_sha256: HASH_A,
    quantization: 'Q8_0',
    runtime_id: 'unsloth',
    runtime_version: '1.0.0',
    harness_version: '2.1.0',
    benchmark_id: 'covert-scaffold-context-ablation',
    benchmark_version: '1.0.0',
    grader_version: '1.0.0',
    inference_config_digest: HASH_C,
    machine_profile_digest: HASH_D,
    execution_node: 'local-windows',
    ...overrides
  };
}

async function freshAtlas() {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'covert-atlas-'));
  return { workspace, atlas: createModelAtlas({ workspace }) };
}

test('evaluation records are immutable and duplicates are refused', async () => {
  const { atlas } = await freshAtlas();
  const item = record();
  const stored = await atlas.recordEvaluation(item);
  assert.equal(stored.evaluation_id, item.evaluation_id);
  assert.equal(stored.freshness.state, 'FRESH');
  await assert.rejects(
    atlas.recordEvaluation(item),
    error => error instanceof AtlasRefusalError && error.code === 'ATLAS_IMMUTABILITY_VIOLATION'
  );
});

test('invalid records are refused with typed reasons', async () => {
  const { atlas } = await freshAtlas();
  await assert.rejects(
    atlas.recordEvaluation({ ...record(), schema: 'wrong.schema' }),
    error => error.code === 'ATLAS_RECORD_INVALID'
  );
  await assert.rejects(
    atlas.recordEvaluation(record({ recommended_roles: [{ role: 'CODER', reason: 'unbound', evidence_refs: ['missing-ref'] }] })),
    error => error.code === 'ATLAS_EVIDENCE_REF_UNBOUND'
  );
  await assert.rejects(
    atlas.recordEvaluation(record({ native: null })),
    error => error.code === 'ATLAS_RECORD_INVALID'
  );
  await assert.rejects(
    atlas.recordEvaluation(record({ native: condition('NATIVE', 11, 10) })),
    error => error.code === 'ATLAS_RECORD_INVALID'
  );
});

test('native and harnessed results are preserved separately and never overwritten', async () => {
  const { atlas } = await freshAtlas();
  await atlas.recordEvaluation(record());
  const latest = await atlas.latestFor('local:test-model');
  assert.equal(latest.native.score.passed, 5);
  assert.equal(latest.harnessed.score.passed, 8);
  assert.equal(latest.comparison.delta_score, 0.3);
  const history = await atlas.historyFor('local:test-model');
  assert.equal(history.length, 1);
  assert.equal(history[0].native_ratio, 0.5);
  assert.equal(history[0].harnessed_ratio, 0.8);
  assert.equal(history[0].delta_score, 0.3);
});

test('repeated evaluations append history and move the latest pointer', async () => {
  const { atlas } = await freshAtlas();
  await atlas.recordEvaluation(record());
  await atlas.recordEvaluation(record({ evaluated_at: new Date(Date.now() + 1000).toISOString() }));
  const history = await atlas.historyFor('local:test-model');
  assert.equal(history.length, 2);
  const latest = await atlas.latestFor('local:test-model');
  assert.ok(Date.parse(latest.evaluated_at) > Date.parse(history[0].evaluated_at));
});

test('evaluation state transitions: never evaluated, incomplete, current, stale', async () => {
  const { atlas } = await freshAtlas();
  assert.equal((await atlas.stateFor('local:test-model', currentBasis())).state, 'NEVER_EVALUATED');

  await atlas.recordEvaluation(record({ harnessed: null, comparison: null }));
  assert.equal((await atlas.stateFor('local:test-model', currentBasis())).state, 'INCOMPLETE');

  const { atlas: second } = await freshAtlas();
  await second.recordEvaluation(record());
  assert.equal((await second.stateFor('local:test-model', currentBasis())).state, 'CURRENT');

  for (const [changed, expected] of [
    [{ artifact_sha256: HASH_B }, 'artifact_sha256_changed'],
    [{ source_revision: 'rev2' }, 'source_revision_changed'],
    [{ quantization: 'Q4_K_M' }, 'quantization_changed'],
    [{ runtime_id: 'llama.cpp' }, 'runtime_changed'],
    [{ runtime_version: '1.1.0' }, 'runtime_version_changed'],
    [{ harness_version: '2.2.0' }, 'harness_version_changed'],
    [{ benchmark_version: '1.1.0' }, 'benchmark_definition_changed'],
    [{ inference_config_digest: HASH_B }, 'inference_config_changed'],
    [{ execution_node: 'wsl:ubuntu' }, 'execution_node_changed']
  ]) {
    const verdict = await second.stateFor('local:test-model', currentBasis(changed));
    assert.equal(verdict.state, 'STALE', `expected STALE for ${JSON.stringify(changed)}`);
    assert.ok(verdict.stale_reasons.includes(expected), `expected reason ${expected} in ${verdict.stale_reasons}`);
    assert.equal(verdict.scope, 'FULL');
  }
});

test('machine profile change is resource-scoped staleness only', async () => {
  const { atlas } = await freshAtlas();
  await atlas.recordEvaluation(record());
  const verdict = await atlas.stateFor('local:test-model', currentBasis({ machine_profile_digest: HASH_B }));
  assert.equal(verdict.state, 'STALE');
  assert.equal(verdict.scope, 'RESOURCE');
  assert.deepEqual(verdict.stale_reasons, ['machine_profile_changed']);
});

test('unknown current basis never fabricates staleness', async () => {
  const { atlas } = await freshAtlas();
  await atlas.recordEvaluation(record());
  const unknown = Object.fromEntries(Object.keys(currentBasis()).map(key => [key, null]));
  const verdict = await atlas.stateFor('local:test-model', unknown);
  assert.equal(verdict.state, 'CURRENT');
  assert.deepEqual(verdict.stale_reasons, []);
});

test('corrupt evidence is surfaced as incomplete, never silently trusted', async () => {
  const { workspace, atlas } = await freshAtlas();
  const dir = path.join(workspace, '.aide', 'atlas', 'evaluations');
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, 'broken.json'), '{not valid json', 'utf8');
  const verdict = await atlas.stateFor('local:test-model', currentBasis());
  assert.equal(verdict.state, 'INCOMPLETE');
  assert.ok(verdict.stale_reasons.includes('corrupt_evidence'));
  assert.equal(verdict.corrupt_count, 1);
});

test('candidates persist, are execution-free, and refuse a forged executed flag', async () => {
  const { atlas } = await freshAtlas();
  const fingerprint = record().fingerprint;
  const candidate = {
    schema: 'covert.model-atlas.candidate.v1',
    candidate_id: randomUUID(),
    model_id: 'local:test-model',
    display_name: 'Test Model',
    fingerprint,
    reason: 'NO_EVIDENCE',
    stale_reasons: [],
    created_at: new Date().toISOString(),
    execution: { mode: 'AUTHORITY_REQUIRED', executed: false }
  };
  const stored = await atlas.createCandidate(candidate);
  assert.equal(stored.execution.executed, false);
  const readBack = await atlas.readCandidate('local:test-model');
  assert.equal(readBack.candidate_id, candidate.candidate_id);
  await assert.rejects(
    atlas.createCandidate({ ...candidate, execution: { mode: 'AUTHORITY_REQUIRED', executed: true } }),
    error => error.code === 'ATLAS_RECORD_INVALID'
  );
});

test('qualification derivation is conservative and evidence-based', async () => {
  const { atlas } = await freshAtlas();
  assert.deepEqual(atlas.deriveQualification(record({ native: null, harnessed: null, comparison: null })).state, 'UNTESTED');
  assert.deepEqual(atlas.deriveQualification(record({ native: { ...condition('NATIVE', 5, 10), outcome: 'CANCELLED' } })).state, 'UNTESTED');
  assert.deepEqual(atlas.deriveQualification(record({ native: { ...condition('NATIVE', 5, 10), outcome: 'FAILED' } })).state, 'INVALID_EVIDENCE');
  assert.deepEqual(atlas.deriveQualification(record({ harnessed: { ...condition('HARNESSED', 8, 10), outcome: 'PARTIAL' } })).state, 'INVALID_EVIDENCE');
  assert.deepEqual(atlas.deriveQualification(record()).state, 'TESTED');
});
