// MI-1B invariant matrix: fingerprint stability, exhaustive staleness table,
// qualification attack cases, and recommendation evidence binding.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createModelAtlas, compareFingerprints } from '../../node/src/services/model-atlas.ts';

const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);
const HASH_C = 'c'.repeat(64);
const HASH_D = 'd'.repeat(64);

function condition(conditionName, passed, total, outcome = 'COMPLETED') {
  return {
    condition: conditionName,
    outcome,
    score: { passed, total, ratio: total === 0 ? 0 : passed / total },
    latency: null,
    tokens: null,
    failures: [],
    categories: [],
    evidence_refs: []
  };
}

function fingerprint(overrides = {}) {
  return {
    model_id: 'local:invariant-model',
    source_revision: 'rev1',
    artifact_sha256: HASH_A,
    quantization: 'Q8_0',
    runtime_id: 'llama.cpp',
    runtime_version: '9940',
    harness_version: '2.1.0',
    benchmark_id: 'covert-scaffold-context-ablation',
    benchmark_version: '1.0.0',
    grader_version: '1.0.0',
    inference_config_digest: HASH_C,
    machine_profile_digest: HASH_D,
    execution_node: 'local-windows',
    chat_template: 'present',
    ...overrides
  };
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
    inference_config_digest: HASH_C,
    machine_profile_digest: HASH_D,
    execution_node: 'local-windows',
    ...overrides
  };
}

function record(overrides = {}) {
  const base = {
    schema: 'covert.model-atlas.evaluation.v1',
    evaluation_id: randomUUID(),
    model_id: 'local:invariant-model',
    display_name: 'Invariant Model',
    fingerprint: fingerprint(),
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
    evidence_refs: ['eval-run-1'],
    evaluated_at: '2026-10-05T10:00:00.000Z',
    completed_at: '2026-10-05T10:00:00.000Z',
    receipt: { native_attempted: true, harnessed_attempted: true, executed: true, notes: [] }
  };
  return { ...base, ...overrides };
}

test('fingerprint identity is stable for identical inputs and only known-vs-known changes can be stale', () => {
  const baseline = compareFingerprints(fingerprint(), basis());
  assert.deepEqual(baseline, { state: 'FRESH', scope: 'NONE', stale_reasons: [] });
  const unknown = Object.fromEntries(Object.keys(basis()).map(key => [key, null]));
  assert.deepEqual(compareFingerprints(fingerprint(), unknown), { state: 'FRESH', scope: 'NONE', stale_reasons: [] });
  const recordedUnknown = compareFingerprints(fingerprint({ artifact_sha256: null }), basis());
  assert.deepEqual(recordedUnknown, { state: 'FRESH', scope: 'NONE', stale_reasons: [] });
});

test('exhaustive staleness table: every dimension produces its exact reason and scope', () => {
  const table = [
    ['source revision', 'source_revision', 'rev2', 'source_revision_changed', 'FULL'],
    ['artifact hash', 'artifact_sha256', HASH_B, 'artifact_sha256_changed', 'FULL'],
    ['quantization', 'quantization', 'Q4_K_M', 'quantization_changed', 'FULL'],
    ['runtime id', 'runtime_id', 'unsloth', 'runtime_changed', 'FULL'],
    ['runtime version', 'runtime_version', '9941', 'runtime_version_changed', 'FULL'],
    ['harness version', 'harness_version', '2.2.0', 'harness_version_changed', 'FULL'],
    ['benchmark id', 'benchmark_id', 'other-suite', 'benchmark_definition_changed', 'FULL'],
    ['benchmark version', 'benchmark_version', '1.1.0', 'benchmark_definition_changed', 'FULL'],
    ['grader version', 'grader_version', '1.1.0', 'benchmark_definition_changed', 'FULL'],
    ['sampling config', 'inference_config_digest', HASH_B, 'inference_config_changed', 'FULL'],
    ['execution node', 'execution_node', 'wsl:ubuntu', 'execution_node_changed', 'FULL'],
    ['machine profile', 'machine_profile_digest', HASH_B, 'machine_profile_changed', 'RESOURCE']
  ];
  for (const [label, key, value, reason, scope] of table) {
    const verdict = compareFingerprints(fingerprint(), basis({ [key]: value }));
    assert.equal(verdict.state, 'STALE', label);
    assert.deepEqual(verdict.stale_reasons, [reason], label);
    assert.equal(verdict.scope, scope, label);
  }
});

test('simultaneous changes preserve the full deterministic reason set and FULL scope wins', () => {
  const verdict = compareFingerprints(fingerprint(), basis({
    artifact_sha256: HASH_B,
    execution_node: 'container:abc123',
    machine_profile_digest: HASH_B
  }));
  assert.equal(verdict.state, 'STALE');
  assert.equal(verdict.scope, 'FULL');
  assert.deepEqual(verdict.stale_reasons, ['artifact_sha256_changed', 'execution_node_changed', 'machine_profile_changed']);
});

test('qualification attack matrix: no outcome combination smuggles TESTED', async () => {
  const atlas = createModelAtlas({ workspace: await fs.mkdtemp(path.join(os.tmpdir(), 'covert-inv-')) });
  const derive = recordValue => atlas.deriveQualification(recordValue);

  assert.deepEqual(derive(record()).state, 'TESTED');
  assert.deepEqual(derive(record({ native: condition('NATIVE', 0, 10), harnessed: condition('HARNESSED', 0, 10) })).state, 'TESTED');
  assert.deepEqual(derive(record({ native: condition('NATIVE', 0, 10), harnessed: condition('HARNESSED', 0, 10) })).state, 'TESTED');
  assert.deepEqual(derive(record({ native: condition('NATIVE', 10, 10), harnessed: condition('HARNESSED', 0, 10) })).state, 'TESTED');

  assert.deepEqual(derive(record({ native: { ...condition('NATIVE', 0, 10), outcome: 'FAILED' } })), { state: 'INVALID_EVIDENCE', stale_reasons: ['evaluation_failed'] });
  assert.deepEqual(derive(record({ native: { ...condition('NATIVE', 0, 10), outcome: 'PARTIAL' } })), { state: 'INVALID_EVIDENCE', stale_reasons: ['evaluation_incomplete'] });
  assert.deepEqual(derive(record({ native: { ...condition('NATIVE', 0, 10), outcome: 'CANCELLED' } })), { state: 'UNTESTED', stale_reasons: ['evaluation_cancelled'] });

  assert.deepEqual(derive(record({ native: null, comparison: null })).state, 'INVALID_EVIDENCE');
  assert.deepEqual(derive(record({ native: null, comparison: null })).stale_reasons, ['condition_missing']);
  assert.deepEqual(derive(record({ harnessed: null, comparison: null })).state, 'INVALID_EVIDENCE');
  assert.deepEqual(derive(record({ harnessed: null, comparison: null })).stale_reasons, ['condition_missing']);
  assert.deepEqual(derive(record({ native: null, harnessed: null, comparison: null })).state, 'UNTESTED');

  const singleFailed = derive(record({ native: { ...condition('NATIVE', 0, 10), outcome: 'FAILED' }, harnessed: null, comparison: null }));
  assert.equal(singleFailed.state, 'INVALID_EVIDENCE');
  assert.deepEqual(singleFailed.stale_reasons, ['condition_missing', 'evaluation_failed']);
});

test('recommendation evidence binding: refs must resolve to this evaluation', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'covert-inv-rec-'));
  const atlas = createModelAtlas({ workspace });
  await assert.rejects(
    atlas.recordEvaluation(record({ recommended_roles: [{ role: 'CODER', reason: 'no refs', evidence_refs: [] }] })),
    error => error.code === 'ATLAS_EVIDENCE_REF_UNBOUND'
  );
  await assert.rejects(
    atlas.recordEvaluation(record({ recommended_roles: [{ role: 'CODER', reason: 'foreign ref', evidence_refs: ['eval-run-2'] }] })),
    error => error.code === 'ATLAS_EVIDENCE_REF_UNBOUND'
  );
  const accepted = await atlas.recordEvaluation(record({ recommended_roles: [{ role: 'FAST_LOCAL', reason: 'measured latency in this evaluation', evidence_refs: ['eval-run-1'] }] }));
  assert.equal(accepted.recommended_roles.length, 1);
  assert.deepEqual(accepted.recommended_roles[0].evidence_refs, ['eval-run-1']);
});

test('empty recommendation arrays remain a valid, stable state', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'covert-inv-empty-'));
  const atlas = createModelAtlas({ workspace });
  const stored = await atlas.recordEvaluation(record());
  assert.deepEqual(stored.recommended_roles, []);
  const latest = await atlas.latestFor('local:invariant-model');
  assert.deepEqual(latest.recommended_roles, []);
});
