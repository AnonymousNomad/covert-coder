import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ModelAtlasCandidateResponse,
  ModelAtlasModelsResponse,
  type ModelAtlasCandidateResponseT,
  type ModelAtlasModelsResponseT
} from '../../common/contracts/model-atlas.ts';
import type { ModelManagerResponseT } from '../../common/contracts/model-access.ts';
import { routesForModelAtlas } from '../../node/src/routes/model-atlas.ts';

const now = '2026-10-09T12:00:00.000Z';
const observedSha = 'a'.repeat(64);
const expectedSha = 'b'.repeat(64);
type AtlasModelInput = Parameters<Parameters<typeof routesForModelAtlas>[0]['atlas']['modelsResponse']>[0][number];

function managerSnapshot(): ModelManagerResponseT {
  return {
    generated_at: now,
    public_safe: true,
    local_discovery: { status: 'AVAILABLE', scanned_dirs: 1, discovered_count: 0, error_count: 0 },
    runtime: {
      canonical_runtime_id: 'unsloth', default_runtime_id: 'unsloth', reported_backend: null,
      discovered_state: 'NOT_DISCOVERED', configured_runtime_id: null, configured: false,
      available: false, health: 'NOT_INSTALLED', selected_model_id: null
    },
    models: [{
      identity: {
        canonical_id: 'local:liquid-2.6b', display_name: 'Liquid 2.6B', family: 'liquid',
        capabilities: [], context_window_tokens: null,
        qualification: {
          state: 'UNTESTED',
          basis: { source_revision: 'historical-revision', artifact_sha256: expectedSha, runtime_id: 'historical-runtime', runtime_version: 'old-version' },
          stale_reasons: []
        }
      },
      artifact_ids: ['artifact:liquid-2.6b'], availability: 'INSTALLED', compatibility: 'UNKNOWN',
      readiness: 'NOT_READY', recommended_roles: ['RESIDENT'], execution_selected_roles: []
    }],
    artifacts: [{
      id: 'artifact:liquid-2.6b', model_id: 'local:liquid-2.6b', source_kind: 'LOCAL_IMPORT',
      source_ref: null, revision: null, filename: 'LFM2.5-2.6B-Q4_K_M.gguf', format: 'GGUF',
      quantization: 'Q4_K_M', expected_sha256: expectedSha, observed_sha256: observedSha,
      hash_status: 'VERIFIED', license: null, availability: 'INSTALLED', compatibility: 'UNKNOWN'
    }],
    routes: [], credential_sources: [], execution_adapters: [],
    connections: { consensus: 'local-only', routed_roles: { planner: 'local', coder: 'local', reviewer: 'local', utility: 'local' }, preference: 'local-only', connections: [] },
    selection_policy: {
      persistence_state: 'PERSISTED', mutation_enabled: false, execution_routing_effect: true,
      mutation_owner: 'SETTINGS_BYOK_ROUTING', scope: 'WORKSPACE_ROLE', roles: ['PLANNING', 'IMPLEMENTATION', 'REVIEW', 'UTILITY']
    }
  };
}

test('Model Atlas route projects canonical identity and observed hash, never the expected catalog hash', async () => {
  const received: { models: AtlasModelInput[] } = { models: [] };
  const atlas = {
    modelsResponse: async (models: AtlasModelInput[]) => {
      received.models = models;
      return ModelAtlasModelsResponse.parse({
        generated_at: now,
        models: [{
          model_id: models[0]!.model_id,
          display_name: models[0]!.display_name,
          artifact_sha256: models[0]!.artifact_sha256,
          evaluation_state: 'NEVER_EVALUATED', qualification_state: null,
          latest_evaluation_id: null, latest_evaluated_at: null, stale_reasons: [], scope: 'NONE',
          recommended_roles: models[0]!.recommended_roles, candidate_id: null
        }]
      });
    },
    recordResponse: async () => null,
    candidateResponse: async () => ModelAtlasCandidateResponse.parse({ generated_at: now, candidate: null }) as ModelAtlasCandidateResponseT
  };
  const routes = routesForModelAtlas({
    atlas: atlas as unknown as Parameters<typeof routesForModelAtlas>[0]['atlas'],
    manager: { snapshot: async () => managerSnapshot() }
  });
  const route = routes.find(candidate => candidate.path === '/api/models/atlas');
  assert.ok(route?.handler);
  assert.deepEqual(route.capabilityPolicy, { owner: 'ModelAtlas', operation: 'capability.read' });

  const response = ModelAtlasModelsResponse.parse(await route.handler({} as never));
  assert.equal(response.models[0]?.model_id, 'local:liquid-2.6b');
  assert.equal(response.models[0]?.artifact_sha256, observedSha);
  const input = received.models[0];
  assert.ok(input, 'Atlas route must pass the live canonical manager model');
  assert.equal(input.artifact_sha256, observedSha);
  assert.equal(input.basis.artifact_sha256, observedSha);
  assert.notEqual(input.basis.artifact_sha256, expectedSha);
  assert.equal(input.basis.source_revision, null);
  assert.equal(input.basis.runtime_id, null);
  assert.equal(input.basis.runtime_version, null);
  assert.equal(response.models[0]?.evaluation_state, 'NEVER_EVALUATED');
});

test('Model Atlas candidate route is a scoped read and accepts only canonical inventory identities', async () => {
  const candidateResponse = ModelAtlasCandidateResponse.parse({ generated_at: now, candidate: null });
  const atlas = {
    modelsResponse: async () => ModelAtlasModelsResponse.parse({ generated_at: now, models: [] }) as ModelAtlasModelsResponseT,
    recordResponse: async () => null,
    candidateResponse: async () => candidateResponse
  };
  const routes = routesForModelAtlas({
    atlas: atlas as unknown as Parameters<typeof routesForModelAtlas>[0]['atlas'],
    manager: { snapshot: async () => managerSnapshot() }
  });
  const route = routes.find(candidate => candidate.path === '/api/models/atlas/candidate');
  assert.ok(route?.handler);

  const valid = await route.handler({ query: { model_id: 'local:liquid-2.6b' } } as never);
  assert.deepEqual(valid, candidateResponse);
  await assert.rejects(
    async () => await route.handler!({ query: { model_id: 'provider:model-not-in-manager' } } as never),
    { code: 'NOT_FOUND' }
  );
  await assert.rejects(
    async () => await route.handler!({ query: { model_id: 'local:liquid-2.6b', credential: 'must-not-be-accepted' } } as never),
    /Unrecognized key/
  );
});

test('Model Atlas record route does not claim a dossier when no evaluation exists', async () => {
  const atlas = {
    modelsResponse: async () => ModelAtlasModelsResponse.parse({ generated_at: now, models: [] }) as ModelAtlasModelsResponseT,
    recordResponse: async () => null,
    candidateResponse: async () => ModelAtlasCandidateResponse.parse({ generated_at: now, candidate: null })
  };
  const routes = routesForModelAtlas({
    atlas: atlas as unknown as Parameters<typeof routesForModelAtlas>[0]['atlas'],
    manager: { snapshot: async () => managerSnapshot() }
  });
  const route = routes.find(candidate => candidate.path === '/api/models/atlas/record');
  assert.ok(route?.handler);
  await assert.rejects(
    async () => await route.handler!({ query: { model_id: 'local:liquid-2.6b' } } as never),
    { code: 'NOT_FOUND' }
  );
});
