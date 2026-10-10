import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { ApiError, api } from '../../browser/src/services/api.ts';
import { projectCipherCreativeOperations } from '../../browser/src/services/cipher-creative-operations.ts';
import { CreationStudioRecord } from '../../common/contracts/creation-studio.ts';
import { ok } from '../../common/errors.ts';

const assignment = (
  capability: 'SCRIPT'|'CONCEPT_ART'|'VIDEO'|'VOICE'|'MUSIC'|'UPSCALE',
  state: 'UNASSIGNED'|'ASSIGNED'|'UNAVAILABLE'
) => ({
  capability,
  provider_id: state === 'ASSIGNED' ? `${capability.toLowerCase()}-provider` : null,
  model_id: state === 'ASSIGNED' ? `${capability.toLowerCase()}-model` : null,
  state
});

const shot = (
  shot_id: string,
  order: number,
  state: 'PLANNED'|'QUEUED'|'RENDERING'|'REVIEW'|'ACCEPTED'|'REJECTED'|'BLOCKED',
  assignments: ReturnType<typeof assignment>[] = []
) => ({
  shot_id,
  order,
  prompt: `Canonical prompt for ${shot_id}`,
  duration_seconds: 5,
  aspect_ratio: '16:9' as const,
  state,
  assignments
});

function canonicalRecord() {
  return CreationStudioRecord.parse({
    production: {
      production_id: 'production-creative-ops-test',
      title: 'Canonical Test Production',
      premise: 'A test production from the canonical owner.',
      target_duration_seconds: 300,
      status: 'REVIEW',
      execution_connection: 'NOT_CONNECTED',
      scenes: [
        {
          scene_id: 'scene-z',
          order: 0,
          title: 'Scene Z',
          summary: 'Later by identity tie-break.',
          shots: [
            shot('shot-z', 0, 'REVIEW', [assignment('VIDEO', 'UNAVAILABLE'), assignment('VOICE', 'UNAVAILABLE')]),
            shot('shot-b', 0, 'BLOCKED', [assignment('SCRIPT', 'ASSIGNED')]),
            shot('shot-a', 0, 'PLANNED', [assignment('VIDEO', 'UNASSIGNED')]),
            shot('shot-last', 1, 'BLOCKED', [assignment('MUSIC', 'UNAVAILABLE')])
          ]
        },
        {
          scene_id: 'scene-a',
          order: 0,
          title: 'Scene A',
          summary: 'First by identity tie-break.',
          shots: [shot('shot-c', 0, 'ACCEPTED')]
        },
        {
          scene_id: 'scene-next',
          order: 1,
          title: 'Next Scene',
          summary: 'Later scene order.',
          shots: [shot('shot-d', 0, 'QUEUED')]
        }
      ]
    },
    bible_entries: [{
      entry_id: 'bible-character-1',
      category: 'CHARACTER',
      title: 'Mara',
      content: 'Canonical free-form appearance and wardrobe notes.',
      status: 'APPROVED'
    }],
    continuity_entries: [{
      entry_id: 'continuity-shot-1',
      scope_kind: 'SHOT',
      scope_id: 'shot-z',
      title: 'Coat remains torn',
      content: 'Preserve the existing canonical continuity statement.',
      status: 'ACTIVE'
    }],
    revision: 4,
    updated_at: '2026-10-10T01:23:45.000Z'
  });
}

test('Cipher projection derives counts and queue ordering without mutating canonical state', () => {
  const record = canonicalRecord();
  const before = structuredClone(record);
  const projection = projectCipherCreativeOperations(record);

  assert.deepEqual(record, before);
  assert.deepEqual(projection.shot_queue.map(item => `${item.scene_id}/${item.shot_id}`), [
    'scene-a/shot-c',
    'scene-z/shot-a',
    'scene-z/shot-b',
    'scene-z/shot-z',
    'scene-z/shot-last',
    'scene-next/shot-d'
  ]);
  assert.equal(projection.production.scene_count, 3);
  assert.equal(projection.production.shot_count, 6);
  assert.equal(projection.production.blocked_shot_count, 2);
  assert.equal(projection.production.unavailable_assignment_count, 3);
  assert.equal(projection.production.production_id, record.production.production_id);
  assert.equal(projection.production.revision, record.revision);
  assert.equal(projection.production.updated_at, record.updated_at);
  assert.equal(projection.production.execution_connection, 'NOT_CONNECTED');
  assert.equal(projection.production.render_manifest_state, 'GATED_NOT_CONNECTED');
  assert.equal('progress_percent' in projection.production, false);
  assert.equal('requirements' in projection.shot_queue[0]!, false);
  assert.equal('dependencies' in projection.shot_queue[0]!, false);
});

test('Cipher preserves Bible, continuity, and assignment states as canonical values', () => {
  const record = canonicalRecord();
  const projection = projectCipherCreativeOperations(record);

  assert.deepEqual(projection.bible_entries, record.bible_entries);
  assert.equal(projection.bible_entries[0]?.entry_id, 'bible-character-1');
  assert.equal(projection.bible_entries[0]?.category, 'CHARACTER');
  assert.equal(projection.bible_entries[0]?.status, 'APPROVED');
  assert.deepEqual(projection.continuity_entries, record.continuity_entries);
  assert.equal(projection.continuity_entries[0]?.scope_kind, 'SHOT');
  assert.equal(projection.continuity_entries[0]?.scope_id, 'shot-z');
  assert.equal(projection.continuity_entries[0]?.status, 'ACTIVE');
  assert.equal(projection.shot_queue.find(item => item.shot_id === 'shot-a')?.assignments[0]?.state, 'UNASSIGNED');
  assert.equal(projection.shot_queue.find(item => item.shot_id === 'shot-z')?.assignments[0]?.state, 'UNAVAILABLE');
});

test('Creation Studio list client performs only schema-validated GET reads', async t => {
  const record = canonicalRecord();
  const seen: Array<{ path: string; method: string; body: unknown; signal: AbortSignal | undefined }> = [];
  mock.method(globalThis, 'fetch', async (input: string | URL | Request, init?: RequestInit) => {
    seen.push({
      path: new URL(String(input), 'http://127.0.0.1').pathname,
      method: init?.method ?? 'GET',
      body: init?.body,
      signal: init?.signal ?? undefined
    });
    return new Response(JSON.stringify(ok({ records: [record] })), { status: 200 });
  });
  t.after(() => mock.restoreAll());

  const controller = new AbortController();
  const response = await api.creationStudioList(controller.signal);
  assert.equal(response.records[0]?.production.production_id, record.production.production_id);
  assert.deepEqual(seen, [{
    path: '/api/creation-studio/productions',
    method: 'GET',
    body: undefined,
    signal: controller.signal
  }]);
});

test('Creation Studio list client rejects a malformed canonical response', async t => {
  mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify(ok({ records: [{ invalid: true }] })), { status: 200 }));
  t.after(() => mock.restoreAll());

  await assert.rejects(api.creationStudioList(), (error: unknown) => error instanceof ApiError && error.code === 'BAD_RESPONSE');
});
