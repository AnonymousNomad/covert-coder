import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createModelAtlas } from '../../node/src/services/model-atlas.ts';
import { createHarnessSync, buildFingerprint } from '../../node/src/services/harness-sync.ts';

const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);
const HASH_D = 'd'.repeat(64);
const BENCHMARK = { id: 'covert-scaffold-context-ablation', version: '1.0.0', grader_version: '1.0.0' };

function condition(conditionName, passed, total) {
  return {
    condition: conditionName,
    outcome: 'COMPLETED',
    score: { passed, total, ratio: total === 0 ? 0 : passed / total },
    latency: { total_ms: 1000, mean_ms: 100 },
    tokens: { total: 500, mean: 50 },
    failures: [],
    categories: [],
    evidence_refs: []
  };
}

function evaluation(overrides = {}) {
  const base = {
    schema: 'covert.model-atlas.evaluation.v1',
    evaluation_id: overrides.evaluation_id ?? globalThis.crypto.randomUUID(),
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
      benchmark_id: BENCHMARK.id,
      benchmark_version: BENCHMARK.version,
      grader_version: BENCHMARK.grader_version,
      inference_config_digest: null,
      machine_profile_digest: HASH_D,
      execution_node: 'local-windows',
      chat_template: 'present'
    },
    hardware_profile: { cpu: 'test', ram_bytes: 1024, gpu: 'test', vram_bytes: 512, backend: 'cpu', digest: HASH_D, execution_node: 'local-windows', execution_domain: 'WORKSPACE' },
    native: condition('NATIVE', 5, 10),
    harnessed: condition('HARNESSED', 8, 10),
    comparison: { basis: 'scaffold-ablation', delta_score: 0.3, delta_latency_ms: null, delta_tokens: null, categories: [] },
    qualification: {
      state: 'TESTED',
      basis: { source_revision: 'rev1', artifact_sha256: HASH_A, runtime_id: 'unsloth', runtime_version: '1.0.0' },
      stale_reasons: []
    },
    recommended_roles: [],
    known_failures: [],
    known_limitations: [],
    evidence_refs: ['eval-native'],
    evaluated_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
    receipt: { native_attempted: true, harnessed_attempted: true, executed: true, notes: [] }
  };
  return { ...base, ...overrides, fingerprint: { ...base.fingerprint, ...(overrides.fingerprint ?? {}) } };
}

function modelDescriptor(overrides = {}) {
  return {
    model_id: 'local:test-model',
    display_name: 'Test Model',
    artifact_sha256: HASH_A,
    source_revision: 'rev1',
    quantization: 'Q8_0',
    chat_template: 'present',
    ...overrides
  };
}

function basisFor(model, overrides = {}) {
  return {
    source_revision: model.source_revision,
    artifact_sha256: model.artifact_sha256,
    quantization: model.quantization,
    runtime_id: 'unsloth',
    runtime_version: '1.0.0',
    harness_version: '2.1.0',
    benchmark_id: BENCHMARK.id,
    benchmark_version: BENCHMARK.version,
    grader_version: BENCHMARK.grader_version,
    inference_config_digest: null,
    machine_profile_digest: HASH_D,
    execution_node: 'local-windows',
    ...overrides
  };
}

async function setup({ model } = {}) {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'covert-sync-'));
  const atlas = createModelAtlas({ workspace });
  let counter = 0;
  const sync = createHarnessSync({
    atlas,
    getModel: async modelId => (model === undefined ? modelDescriptor({ model_id: modelId }) : model),
    currentBasis: current => basisFor(current),
    harnessVersion: '2.1.0',
    benchmark: BENCHMARK,
    newId: () => `${String(++counter).padStart(8, '0')}-0000-4000-8000-000000000000`
  });
  return { workspace, atlas, sync };
}

test('unknown model is refused without touching the atlas', async () => {
  const { workspace, sync } = await setup({ model: null });
  const result = await sync.sync('local:ghost');
  assert.equal(result.status, 'REFUSED');
  assert.equal(result.code, 'MODEL_UNKNOWN');
  await assert.rejects(fs.readdir(path.join(workspace, '.aide', 'atlas', 'candidates')));
});

test('model without a stable artifact hash is refused as identity-insufficient', async () => {
  const { sync } = await setup({ model: modelDescriptor({ artifact_sha256: null }) });
  const result = await sync.sync('local:test-model');
  assert.equal(result.status, 'REFUSED');
  assert.equal(result.code, 'IDENTITY_INSUFFICIENT');
});

test('missing evidence produces a persisted, execution-free candidate', async () => {
  const { workspace, sync } = await setup();
  const inspection = await sync.inspect('local:test-model');
  assert.equal(inspection.status, 'CANDIDATE_READY');
  assert.equal(inspection.reason, 'NO_EVIDENCE');
  assert.equal(inspection.candidate.execution.executed, false);
  assert.equal(inspection.candidate.execution.mode, 'AUTHORITY_REQUIRED');
  await assert.rejects(fs.readdir(path.join(workspace, '.aide', 'atlas', 'candidates')));

  const synced = await sync.sync('local:test-model');
  assert.equal(synced.status, 'CANDIDATE_READY');
  const files = await fs.readdir(path.join(workspace, '.aide', 'atlas', 'candidates'));
  assert.equal(files.length, 1);
  assert.equal(synced.candidate.fingerprint.harness_version, '2.1.0');
  assert.equal(synced.candidate.fingerprint.benchmark_id, BENCHMARK.id);
});

test('current evidence short-circuits sync with no candidate and no execution', async () => {
  const { workspace, atlas, sync } = await setup();
  await atlas.recordEvaluation(evaluation());
  const filesBefore = await fs.readdir(workspace).catch(() => []);
  const inspection = await sync.inspect('local:test-model');
  assert.equal(inspection.status, 'CURRENT');
  assert.equal(inspection.latest.freshness.state, 'FRESH');
  const synced = await sync.sync('local:test-model');
  assert.equal(synced.status, 'CURRENT');
  const candidates = await fs.readdir(path.join(workspace, '.aide', 'atlas', 'candidates')).catch(() => []);
  assert.equal(candidates.length, 0);
  const filesAfter = await fs.readdir(workspace).catch(() => []);
  assert.deepEqual(filesAfter, filesBefore);
});

test('stale evidence produces a stale-evidence candidate with exact reasons', async () => {
  const { atlas } = await setup();
  await atlas.recordEvaluation(evaluation());
  const staleModel = modelDescriptor({ artifact_sha256: HASH_B });
  const staleSync = createHarnessSync({
    atlas,
    getModel: async () => staleModel,
    currentBasis: current => basisFor(current),
    harnessVersion: '2.1.0',
    benchmark: BENCHMARK
  });
  const result = await staleSync.sync('local:test-model');
  assert.equal(result.status, 'CANDIDATE_READY');
  assert.equal(result.reason, 'STALE_EVIDENCE');
  assert.ok(result.stale_reasons.includes('artifact_sha256_changed'));
  assert.equal(result.latest.fingerprint.artifact_sha256, HASH_A);
});

test('incomplete evidence (harnessed side missing) produces an incomplete candidate', async () => {
  const { atlas, sync } = await setup();
  await atlas.recordEvaluation(evaluation({ harnessed: null, comparison: null }));
  const result = await sync.sync('local:test-model');
  assert.equal(result.status, 'CANDIDATE_READY');
  assert.equal(result.reason, 'INCOMPLETE_EVIDENCE');
  assert.ok(result.stale_reasons.includes('harnessed_missing'));
});

test('harness or benchmark version change invalidates evidence', async () => {
  const { atlas } = await setup();
  await atlas.recordEvaluation(evaluation());
  const newerHarness = createHarnessSync({
    atlas,
    getModel: async () => modelDescriptor(),
    currentBasis: current => basisFor(current, { harness_version: '2.2.0' }),
    harnessVersion: '2.2.0',
    benchmark: BENCHMARK
  });
  const harnessResult = await newerHarness.inspect('local:test-model');
  assert.equal(harnessResult.reason, 'STALE_EVIDENCE');
  assert.ok(harnessResult.stale_reasons.includes('harness_version_changed'));

  const newerBenchmark = createHarnessSync({
    atlas,
    getModel: async () => modelDescriptor(),
    currentBasis: current => basisFor(current, { benchmark_version: '1.1.0' }),
    harnessVersion: '2.1.0',
    benchmark: { ...BENCHMARK, version: '1.1.0' }
  });
  const benchmarkResult = await newerBenchmark.inspect('local:test-model');
  assert.equal(benchmarkResult.reason, 'STALE_EVIDENCE');
  assert.ok(benchmarkResult.stale_reasons.includes('benchmark_definition_changed'));
});

test('fingerprint construction binds model, runtime, harness, and benchmark identity', async () => {
  const model = modelDescriptor();
  const fingerprint = buildFingerprint(model, basisFor(model), BENCHMARK, '2.1.0');
  assert.equal(fingerprint.model_id, model.model_id);
  assert.equal(fingerprint.artifact_sha256, HASH_A);
  assert.equal(fingerprint.runtime_id, 'unsloth');
  assert.equal(fingerprint.harness_version, '2.1.0');
  assert.equal(fingerprint.benchmark_version, '1.0.0');
});
