// MI-1A consumer conformance test.
//
// A Model Lab / Model Catalog consumer must be able to complete the full read
// journey through the PUBLIC read surface only:
//   list -> select model -> select evaluation -> native -> harnessed ->
//   comparison -> qualification -> recommendations -> freshness -> evidence refs
//
// Part A validates the deterministic fixture against the public contracts.
// Part B exercises the live read surface (createModelAtlasRead) over a store
// arranged with the canonical record/candidate APIs; every assertion depends
// only on read-contract responses. No test here reads store files directly.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  AtlasEvaluationRecord,
  AtlasEvaluationCandidate,
  ModelAtlasModelsResponse,
  ModelAtlasRecordResponse,
  ModelAtlasCandidateResponse
} from '../../common/contracts/model-atlas.ts';
import { createModelAtlas } from '../../node/src/services/model-atlas.ts';
import { createModelAtlasRead } from '../../node/src/services/model-atlas-read.ts';

const fixturePath = path.join(import.meta.dirname, '..', '..', 'fixtures', 'model-atlas', 'mi1-consumer-fixture.json');
const fixture = JSON.parse(await fs.readFile(fixturePath, 'utf8'));

test('fixture: models list conforms and exposes current, missing, and corrupt states', () => {
  const parsed = ModelAtlasModelsResponse.parse(fixture.views.models_current);
  assert.equal(parsed.models.length, 3);
  const current = parsed.models.find(entry => entry.evaluation_state === 'CURRENT');
  assert.ok(current);
  assert.equal(current.qualification_state, 'TESTED');
  assert.equal(current.latest_evaluation_id, 'fbaa2556-915a-495d-8ed3-7d86d8bba7e9');
  const missing = parsed.models.find(entry => entry.evaluation_state === 'NEVER_EVALUATED');
  assert.ok(missing);
  assert.equal(missing.qualification_state, null);
  assert.ok(missing.candidate_id !== null);
  const corrupt = parsed.models.find(entry => entry.evaluation_state === 'INCOMPLETE');
  assert.ok(corrupt);
  assert.deepEqual(corrupt.stale_reasons, ['corrupt_evidence']);
  assert.equal(corrupt.qualification_state, null);
});

test('fixture: evaluation detail keeps native and harnessed separate and preserves negative evidence', () => {
  const parsed = ModelAtlasRecordResponse.parse(fixture.views.record);
  const record = parsed.record;
  assert.equal(record.native.condition, 'NATIVE');
  assert.equal(record.harnessed.condition, 'HARNESSED');
  assert.deepEqual(record.native.score, { passed: 0, total: 10, ratio: 0 });
  assert.deepEqual(record.harnessed.score, { passed: 2, total: 10, ratio: 0.2 });
  assert.equal(record.comparison.delta_score, 0.2);
  assert.equal(record.qualification.state, 'TESTED');
  assert.equal(record.recommended_roles.length, 0);
  assert.equal(record.freshness.state, 'FRESH');
  assert.equal(record.fingerprint.artifact_sha256, '48ab3034d0dd401fbc721eb1df3217902fee7dab9078992d66431f09b7750201');
  assert.ok(record.evidence_refs.length > 0);
  assert.equal(parsed.history.length, 1);
  assert.equal(parsed.history[0].native_ratio, 0);
  assert.equal(parsed.history[0].harnessed_ratio, 0.2);
});

test('fixture: stale view carries the exact node-change reason and keeps qualification visible', () => {
  const parsed = ModelAtlasModelsResponse.parse(fixture.views.models_stale);
  const entry = parsed.models[0];
  assert.equal(entry.evaluation_state, 'STALE');
  assert.deepEqual(entry.stale_reasons, ['execution_node_changed']);
  assert.equal(entry.scope, 'FULL');
  assert.equal(entry.qualification_state, 'TESTED');
});

test('fixture: candidate is execution-free and belongs to the unevaluated model', () => {
  const parsed = ModelAtlasCandidateResponse.parse(fixture.views.candidate);
  assert.ok(parsed.candidate !== null);
  assert.equal(parsed.candidate.execution.mode, 'AUTHORITY_REQUIRED');
  assert.equal(parsed.candidate.execution.executed, false);
  assert.equal(parsed.candidate.reason, 'NO_EVIDENCE');
  const models = ModelAtlasModelsResponse.parse(fixture.views.models_current);
  const missing = models.models.find(entry => entry.evaluation_state === 'NEVER_EVALUATED');
  assert.equal(parsed.candidate.candidate_id, missing.candidate_id);
});

test('live: consumer journey completes through the read surface only', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'covert-mi1a-'));
  const atlas = createModelAtlas({ workspace }); // arrange (canonical record/candidate APIs)
  const recordInput = structuredClone(fixture.views.record.record);
  delete recordInput.freshness;
  assert.equal(AtlasEvaluationRecord.safeParse(recordInput).success, true);
  await atlas.recordEvaluation(recordInput);
  const candidateInput = { ...fixture.views.candidate.candidate };
  assert.equal(AtlasEvaluationCandidate.safeParse(candidateInput).success, true);
  await atlas.createCandidate(candidateInput);

  const read = createModelAtlasRead({ atlas }); // the public read surface
  const basis = fixture.read_input_example.basis;

  const models = await read.modelsResponse([{
    model_id: fixture.read_input_example.model.model_id,
    display_name: fixture.read_input_example.model.display_name,
    artifact_sha256: fixture.read_input_example.model.artifact_sha256,
    basis
  }]);
  const entry = models.models[0];
  assert.equal(entry.evaluation_state, 'CURRENT');
  assert.equal(entry.qualification_state, 'TESTED');

  const detail = await read.recordResponse(entry.model_id, basis);
  assert.ok(detail !== null);
  assert.equal(detail.record.evaluation_id, entry.latest_evaluation_id);
  assert.equal(detail.record.native.score.passed, 0);
  assert.equal(detail.record.harnessed.score.passed, 2);
  assert.equal(detail.record.comparison.delta_score, 0.2);
  assert.equal(detail.record.recommended_roles.length, 0);
  assert.equal(detail.record.freshness.state, 'FRESH');
  for (const ref of detail.record.evidence_refs) assert.equal(typeof ref, 'string');

  const stale = await read.modelsResponse([{
    model_id: entry.model_id,
    display_name: entry.display_name,
    artifact_sha256: entry.artifact_sha256,
    basis: { ...basis, execution_node: 'wsl:ubuntu' }
  }]);
  assert.equal(stale.models[0].evaluation_state, 'STALE');
  assert.deepEqual(stale.models[0].stale_reasons, ['execution_node_changed']);

  const candidate = await read.candidateResponse(fixture.views.candidate.candidate.model_id);
  assert.ok(candidate.candidate !== null);
  assert.equal(candidate.candidate.execution.executed, false);
});

test('live: read surface stays truthful when no evidence exists', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'covert-mi1a-empty-'));
  const atlas = createModelAtlas({ workspace });
  const read = createModelAtlasRead({ atlas });
  const models = await read.modelsResponse([{
    model_id: 'local:never-evaluated',
    display_name: 'Never Evaluated',
    artifact_sha256: 'a'.repeat(64),
    basis: fixture.read_input_example.basis
  }]);
  assert.equal(models.models[0].evaluation_state, 'NEVER_EVALUATED');
  assert.equal(await read.recordResponse('local:never-evaluated', fixture.read_input_example.basis), null);
});
