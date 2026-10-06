import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createModelAtlas } from '../../node/src/services/model-atlas.ts';
import { createModelAtlasRead } from '../../node/src/services/model-atlas-read.ts';

const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);
const HASH_D = 'd'.repeat(64);

function condition(conditionName, passed, total) {
  return {
    condition: conditionName,
    outcome: 'COMPLETED',
    score: { passed, total, ratio: passed / total },
    latency: { total_ms: 100, mean_ms: 10 },
    tokens: { total: 50, mean: 5 },
    failures: [],
    categories: [],
    evidence_refs: []
  };
}

function evaluation(overrides = {}) {
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
    hardware_profile: { cpu: 'test', ram_bytes: 1024, gpu: 'test', vram_bytes: 512, backend: 'cpu', digest: HASH_D, execution_node: 'local-windows', execution_domain: 'WORKSPACE' },
    native: condition('NATIVE', 0, 10),
    harnessed: condition('HARNESSED', 2, 10),
    comparison: { basis: 'scaffold-ablation', delta_score: 0.2, delta_latency_ms: null, delta_tokens: null, categories: [] },
    qualification: {
      state: 'TESTED',
      basis: { source_revision: 'rev1', artifact_sha256: HASH_A, runtime_id: 'llama.cpp', runtime_version: '9940' },
      stale_reasons: []
    },
    recommended_roles: [{ role: 'FAST_LOCAL', reason: 'measured response latency at small size', evidence_refs: ['run-1'] }],
    known_failures: [{ code: 'task_failures', detail: '8 of 10 tasks failed in both conditions' }],
    known_limitations: ['single small model; descriptive pilot only'],
    evidence_refs: ['run-1'],
    evaluated_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
    receipt: { native_attempted: true, harnessed_attempted: true, executed: true, notes: [] }
  };
  return { ...base, ...overrides, fingerprint: { ...base.fingerprint, ...(overrides.fingerprint ?? {}) } };
}

function basis(overrides = {}) {
  return {
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
    ...overrides
  };
}

async function setup() {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'covert-atlas-read-'));
  const atlas = createModelAtlas({ workspace });
  const read = createModelAtlasRead({ atlas });
  return { workspace, atlas, read };
}

test('models read contract reports never-evaluated models with candidate identity', async () => {
  const { atlas, read } = await setup();
  await atlas.createCandidate({
    schema: 'covert.model-atlas.candidate.v1',
    candidate_id: randomUUID(),
    model_id: 'local:test-model',
    display_name: 'Test Model',
    fingerprint: evaluation().fingerprint,
    reason: 'NO_EVIDENCE',
    stale_reasons: [],
    created_at: new Date().toISOString(),
    execution: { mode: 'AUTHORITY_REQUIRED', executed: false }
  });
  const response = await read.modelsResponse([
    { model_id: 'local:test-model', display_name: 'Test Model', artifact_sha256: HASH_A, basis: basis() },
    { model_id: 'local:no-evidence', display_name: 'No Evidence', artifact_sha256: HASH_A, basis: basis() }
  ]);
  assert.equal(response.models.length, 2);
  const first = response.models[0];
  assert.equal(first.evaluation_state, 'NEVER_EVALUATED');
  assert.equal(first.qualification_state, null);
  assert.ok(first.candidate_id !== null);
  assert.equal(response.models[1].candidate_id, null);
});

test('models read contract reports current evidence, qualification, and roles', async () => {
  const { atlas, read } = await setup();
  await atlas.recordEvaluation(evaluation());
  const response = await read.modelsResponse([
    { model_id: 'local:test-model', display_name: 'Test Model', artifact_sha256: HASH_A, basis: basis() }
  ]);
  const entry = response.models[0];
  assert.equal(entry.evaluation_state, 'CURRENT');
  assert.equal(entry.qualification_state, 'TESTED');
  assert.deepEqual(entry.recommended_roles, ['FAST_LOCAL']);
  assert.ok(entry.latest_evaluation_id !== null);
});

test('models read contract reports stale evidence with reasons', async () => {
  const { atlas, read } = await setup();
  await atlas.recordEvaluation(evaluation());
  const response = await read.modelsResponse([
    { model_id: 'local:test-model', display_name: 'Test Model', artifact_sha256: HASH_B, basis: basis({ artifact_sha256: HASH_B, execution_node: 'wsl:ubuntu' }) }
  ]);
  const entry = response.models[0];
  assert.equal(entry.evaluation_state, 'STALE');
  assert.equal(entry.scope, 'FULL');
  assert.ok(entry.stale_reasons.includes('artifact_sha256_changed'));
  assert.ok(entry.stale_reasons.includes('execution_node_changed'));
  assert.equal(entry.qualification_state, 'TESTED');
});

test('record and candidate read contracts are null without evidence', async () => {
  const { read } = await setup();
  assert.equal(await read.recordResponse('local:ghost', basis()), null);
  const candidate = await read.candidateResponse('local:ghost');
  assert.equal(candidate.candidate, null);
});

test('record read contract returns immutable history', async () => {
  const { atlas, read } = await setup();
  await atlas.recordEvaluation(evaluation());
  await atlas.recordEvaluation(evaluation({ evaluated_at: new Date(Date.now() + 1000).toISOString() }));
  const response = await read.recordResponse('local:test-model', basis());
  assert.ok(response !== null);
  assert.equal(response.history.length, 2);
  assert.equal(response.record.freshness.state, 'FRESH');
});
