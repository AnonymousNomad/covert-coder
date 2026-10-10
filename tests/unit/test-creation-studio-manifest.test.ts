import test from 'node:test';
import assert from 'node:assert/strict';
import { CreationStudioProduction } from '../../common/contracts/creation-studio.ts';
import { buildCreationStudioRenderManifest } from '../../common/creation-studio-manifest.ts';

const production = CreationStudioProduction.parse({
  production_id: 'episode-001',
  title: 'Old Republic Fan Film Test',
  premise: 'A non-commercial fan-film production planning test.',
  target_duration_seconds: 2700,
  status: 'DRAFT',
  execution_connection: 'NOT_CONNECTED',
  scenes: [
    {
      scene_id: 'scene-002',
      order: 1,
      title: 'Hangar',
      summary: 'Departure.',
      shots: [{
        shot_id: 'shot-002',
        order: 0,
        prompt: 'Wide hangar departure shot.',
        duration_seconds: 7,
        aspect_ratio: '2.39:1',
        state: 'PLANNED',
        assignments: [{
          capability: 'VIDEO',
          provider_id: null,
          model_id: null,
          state: 'UNASSIGNED'
        }]
      }]
    },
    {
      scene_id: 'scene-001',
      order: 0,
      title: 'Ruins',
      summary: 'Opening.',
      shots: [{
        shot_id: 'shot-001',
        order: 0,
        prompt: 'Slow push through ancient ruins at dawn.',
        duration_seconds: 5,
        aspect_ratio: '2.39:1',
        state: 'PLANNED',
        assignments: [{
          capability: 'VIDEO',
          provider_id: 'video-provider',
          model_id: 'cinematic-model',
          state: 'ASSIGNED'
        }]
      }]
    }
  ]
});

test('render manifest is deterministic, ordered, and remains execution-gated', () => {
  const first = buildCreationStudioRenderManifest(production);
  const second = buildCreationStudioRenderManifest(structuredClone(production));
  assert.deepEqual(second, first);
  assert.equal(first.schema, 'covert.creation-studio.render-manifest.v1');
  assert.equal(first.execution_state, 'GATED_NOT_CONNECTED');
  assert.equal(first.total_duration_seconds, 12);
  assert.deepEqual(first.shots.map(shot => shot.shot_id), ['shot-001', 'shot-002']);
  assert.equal(first.shots[0]?.video_provider_id, 'video-provider');
  assert.equal(first.shots[0]?.video_model_id, 'cinematic-model');
  assert.equal(first.shots[1]?.video_provider_id, null);
});

test('contract rejects a production that pretends rendering is connected', () => {
  assert.throws(() => CreationStudioProduction.parse({
    ...production,
    execution_connection: 'CONNECTED'
  }));
});

test('manifest construction does not mutate the production draft', () => {
  const before = structuredClone(production);
  buildCreationStudioRenderManifest(production);
  assert.deepEqual(production, before);
});
