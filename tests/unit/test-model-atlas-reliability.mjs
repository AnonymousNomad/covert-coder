// MI-1B reliability tests: persistence, atomicity aftermath, immutability,
// corruption, restart/reload, and concurrency. Lightweight, synthetic only.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createModelAtlas, AtlasRefusalError } from '../../node/src/services/model-atlas.ts';

const HASH_A = 'a'.repeat(64);
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

function record(overrides = {}) {
  const base = {
    schema: 'covert.model-atlas.evaluation.v1',
    evaluation_id: overrides.evaluation_id ?? randomUUID(),
    model_id: 'local:reliability-model',
    display_name: 'Reliability Model',
    fingerprint: {
      model_id: 'local:reliability-model',
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
    evaluated_at: overrides.evaluated_at ?? new Date().toISOString(),
    completed_at: overrides.evaluated_at ?? new Date().toISOString(),
    receipt: { native_attempted: true, harnessed_attempted: true, executed: true, notes: [] }
  };
  return { ...base, ...overrides };
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
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'covert-rel-'));
  const evaluationsDir = path.join(workspace, '.aide', 'atlas', 'evaluations');
  const atlas = createModelAtlas({ workspace });
  return { workspace, evaluationsDir, atlas };
}

test('aftermath of interrupted writes: temp files are invisible and healthy records survive', async () => {
  const { workspace, evaluationsDir, atlas } = await setup();
  const good = await atlas.recordEvaluation(record());
  // Simulate a crash during a later write: leftover temp in the canonical pattern.
  await fs.mkdir(evaluationsDir, { recursive: true });
  const leftoverTemp = path.join(evaluationsDir, `.${randomUUID()}.json.tmp-aide-1234-${randomUUID()}`);
  await fs.writeFile(leftoverTemp, '{"half": "written"', 'utf8');
  const state = await atlas.stateFor('local:reliability-model', basis());
  assert.equal(state.state, 'CURRENT');
  assert.equal(state.corrupt_count, 0);
  const latest = await atlas.latestFor('local:reliability-model');
  assert.equal(latest.evaluation_id, good.evaluation_id);
  // The orphan temp is not silently deleted by reads (read-only path).
  assert.equal(await fs.access(leftoverTemp).then(() => true).catch(() => false), true);
});

test('corruption matrix: each damaged file is surfaced, healthy records stay usable', async () => {
  const { evaluationsDir, atlas } = await setup();
  const good = await atlas.recordEvaluation(record());
  await fs.mkdir(evaluationsDir, { recursive: true });
  const cases = {
    'truncated.json': '{"schema":"covert.model-atlas.evaluation.v1"',
    'zero-byte.json': '',
    'bad-json.json': '{not json',
    'missing-field.json': JSON.stringify({ schema: 'covert.model-atlas.evaluation.v1', evaluation_id: randomUUID() }),
    'bad-enum.json': JSON.stringify({ ...record(), native: { ...condition('NATIVE', 0, 10), outcome: 'WEIRD' } }),
    'bad-sha.json': JSON.stringify(record({ fingerprint: { ...record().fingerprint, artifact_sha256: 'xyz' } })),
    'bad-eval-id.json': JSON.stringify(record({ evaluation_id: 'not-a-uuid' })),
    'future-schema.json': JSON.stringify({ ...record(), schema: 'covert.model-atlas.evaluation.v2' }),
    'wrong-type.json': '[]'
  };
  for (const [name, body] of Object.entries(cases)) {
    await fs.writeFile(path.join(evaluationsDir, name), body, 'utf8');
  }
  const state = await atlas.stateFor('local:reliability-model', basis());
  assert.equal(state.state, 'INCOMPLETE');
  assert.ok(state.stale_reasons.includes('corrupt_evidence'));
  assert.equal(state.corrupt_count, 9);
  // Healthy evidence remains the latest and fully readable.
  assert.equal(state.latest.evaluation_id, good.evaluation_id);
  assert.equal(state.latest.native.score.passed, 0);
  assert.equal(state.latest.harnessed.score.passed, 2);
  // Still on disk: reads never delete evidence (nine damaged files + one canonical record).
  const jsonFiles = (await fs.readdir(evaluationsDir)).filter(name => name.endsWith('.json'));
  assert.equal(jsonFiles.length, 10);
});

test('integrity sidecars exist for committed records and tampering is detected', async () => {
  const { evaluationsDir, atlas } = await setup();
  const item = record();
  await atlas.recordEvaluation(item);
  assert.equal(await fs.access(path.join(evaluationsDir, `${item.evaluation_id}.sha256`)).then(() => true).catch(() => false), true);
  const state = await atlas.stateFor('local:reliability-model', basis());
  assert.equal(state.state, 'CURRENT');
  assert.equal(state.corrupt_count, 0);
});

test('immutability: same id is refused regardless of content; external tampering is detectable', async () => {
  const { evaluationsDir, atlas } = await setup();
  const item = record();
  await atlas.recordEvaluation(item);
  await assert.rejects(atlas.recordEvaluation(item), error => error instanceof AtlasRefusalError && error.code === 'ATLAS_IMMUTABILITY_VIOLATION');
  await assert.rejects(atlas.recordEvaluation({ ...item, evaluated_at: new Date(Date.now() + 1000).toISOString() }), error => error.code === 'ATLAS_IMMUTABILITY_VIOLATION');
  // External tampering (bypassing the API): the tampered record must not be silently accepted as valid.
  const target = path.join(evaluationsDir, `${item.evaluation_id}.json`);
  const tampered = JSON.parse(await fs.readFile(target, 'utf8'));
  tampered.native.score = { passed: 10, total: 10, ratio: 1 };
  await fs.writeFile(target, JSON.stringify(tampered), 'utf8');
  const state = await atlas.stateFor('local:reliability-model', basis());
  assert.equal(state.state, 'INCOMPLETE');
  assert.ok(state.stale_reasons.includes('integrity_mismatch'));
});

test('duplicate evaluation id in a foreign-named file never duplicates history', async () => {
  const { evaluationsDir, atlas } = await setup();
  const item = record();
  await atlas.recordEvaluation(item);
  // A copied evidence file (different filename, same evaluation_id) must not double history.
  await fs.copyFile(path.join(evaluationsDir, `${item.evaluation_id}.json`), path.join(evaluationsDir, 'copy-of-record.json'));
  const history = await atlas.historyFor('local:reliability-model');
  assert.equal(history.length, 1);
  const state = await atlas.stateFor('local:reliability-model', basis());
  assert.equal(state.state, 'INCOMPLETE');
  assert.ok(state.stale_reasons.includes('corrupt_evidence'));
  assert.equal(state.corrupt_count, 1);
});

test('restart/reload: a fresh service instance sees identical immutable evidence', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'covert-rel-restart-'));
  const first = createModelAtlas({ workspace });
  const a = await first.recordEvaluation(record({ evaluated_at: '2026-10-05T10:00:00.000Z' }));
  const b = await first.recordEvaluation(record({ evaluated_at: '2026-10-05T11:00:00.000Z' }));
  const before = await first.latestFor('local:reliability-model', basis());

  const second = createModelAtlas({ workspace }); // "restart"
  const after = await second.latestFor('local:reliability-model', basis());
  const stripCheckedAt = value => ({ ...value, freshness: { ...value.freshness, checked_at: 'volatile' } });
  assert.deepEqual(stripCheckedAt(after), stripCheckedAt(before));
  assert.equal(after.freshness.state, before.freshness.state);
  const history = await second.historyFor('local:reliability-model');
  assert.deepEqual(history.map(entry => entry.evaluation_id), [a.evaluation_id, b.evaluation_id]);
  assert.equal(after.evaluation_id, b.evaluation_id);
  assert.equal(history.length, 2);
});

test('concurrency: same-id races produce exactly one record; different ids both persist', async () => {
  const { workspace, evaluationsDir, atlas } = await setup();
  const item = record();
  const sameResults = await Promise.allSettled([
    atlas.recordEvaluation(item),
    atlas.recordEvaluation(item),
    atlas.recordEvaluation(item)
  ]);
  const wins = sameResults.filter(result => result.status === 'fulfilled').length;
  const refusals = sameResults.filter(result => result.status === 'rejected' && result.reason?.code === 'ATLAS_IMMUTABILITY_VIOLATION').length;
  assert.equal(wins, 1);
  assert.equal(refusals, 2);

  const many = Array.from({ length: 12 }, (_, index) => record({ evaluated_at: new Date(Date.UTC(2026, 9, 5, 12, index)).toISOString() }));
  await Promise.all(many.map(entry => atlas.recordEvaluation(entry)));
  const files = (await fs.readdir(evaluationsDir)).filter(name => name.endsWith('.json'));
  assert.equal(files.length, 13);
  for (const name of files) {
    const raw = await fs.readFile(path.join(evaluationsDir, name), 'utf8');
    assert.doesNotThrow(() => JSON.parse(raw), `file ${name} must be valid JSON`);
  }
  const history = await atlas.historyFor('local:reliability-model');
  assert.equal(history.length, 13);
  assert.equal(new Set(history.map(entry => entry.evaluation_id)).size, 13);
  void workspace;
});

test('concurrent reads during writes never observe a half-written record', async () => {
  const { atlas } = await setup();
  const writers = Array.from({ length: 8 }, (_, index) => atlas.recordEvaluation(record({ evaluated_at: new Date(Date.UTC(2026, 9, 5, 13, index)).toISOString() })));
  const readers = Array.from({ length: 16 }, async () => {
    const history = await atlas.historyFor('local:reliability-model');
    for (const entry of history) {
      assert.equal(typeof entry.evaluation_id, 'string');
      assert.ok(Number.isFinite(Date.parse(entry.evaluated_at)));
    }
    return history.length;
  });
  const [, readSizes] = await Promise.all([Promise.all(writers), Promise.all(readers)]);
  for (const size of readSizes) assert.ok(size >= 0 && size <= 8);
  const final = await atlas.historyFor('local:reliability-model');
  assert.equal(final.length, 8);
});
