// Resident Binding transport tests: the canonical read route returns the
// frozen covert.resident-binding.v1 projection, derives on every read, and
// carries stable codes with no prose parsing.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { routeForResidentBinding } from '../../node/src/routes/resident-binding.ts';
import { ResidentBinding, RESIDENT_BINDING_SCHEMA } from '../../common/contracts/resident-binding.ts';
import { createResidentBinding, residentCandidatesFromModelManager } from '../../node/src/services/resident-binding.ts';
import { createModelManagerView } from '../../node/src/services/model-manager-view.ts';

test('route is a canonical GET read over the projection', () => {
  const route = routeForResidentBinding({ read: async () => { throw new Error('unused'); } });
  assert.equal(route.method, 'GET');
  assert.equal(route.path, '/api/resident/binding');
  assert.equal(route.describeOperation, undefined, 'read routes are central capability.read rows, not descriptors');
});

test('bound payload travels contract-exact through the route', async () => {
  const view = await createResidentBinding({
    listCandidates: async () => [{ canonical_id: 'local:liquid-2.6b', display_name: 'Liquid 2.6B', family: 'liquid', availability: 'INSTALLED', artifact_available: true, runtime_ready: true }],
    observeRuntime: async () => ({ runtime_state: 'RUNNING', verified_at: '2026-10-06T09:00:00.000Z' })
  }).read();
  const route = routeForResidentBinding({ read: async () => view });
  const response = await route.handler({});
  assert.equal(ResidentBinding.safeParse(response).success, true);
  assert.equal(response.schema, RESIDENT_BINDING_SCHEMA);
  assert.equal(response.binding_state, 'BOUND');
  assert.equal(response.resident_model_id, 'local:liquid-2.6b');
});

test('unbound and degraded payloads keep stable codes', async () => {
  const unbound = await createResidentBinding({ listCandidates: async () => [] }).read();
  assert.equal(unbound.binding_state, 'UNBOUND');
  assert.equal(unbound.degraded_reason, 'resident_model_not_registered');

  const degraded = await createResidentBinding({
    listCandidates: async () => [
      { canonical_id: 'a:liquid-one', display_name: 'one', family: 'liquid', availability: 'INSTALLED', artifact_available: true, runtime_ready: true },
      { canonical_id: 'b:liquid-two', display_name: 'two', family: 'liquid', availability: 'INSTALLED', artifact_available: true, runtime_ready: true }
    ]
  }).read();
  assert.equal(degraded.binding_state, 'DEGRADED');
  assert.equal(degraded.degraded_reason, 'multiple_resident_candidates');
});

test('an unavailable Resident artifact is not inferred from catalog availability', async () => {
  const candidates = residentCandidatesFromModelManager({
    models: [{
      identity: { canonical_id: 'local:liquid-2.6b', display_name: 'Liquid 2.6B', family: 'liquid' },
      availability: 'AVAILABLE', artifact_ids: ['artifact:liquid-2.6b']
    }],
    artifacts: [{ id: 'artifact:liquid-2.6b', availability: 'AVAILABLE' }]
  });
  const service = createResidentBinding({
    listCandidates: async () => candidates
  });
  const response = await routeForResidentBinding(service).handler({});
  assert.equal(response.binding_state, 'DEGRADED');
  assert.equal(response.availability_state, 'UNAVAILABLE');
  assert.equal(response.runtime_state, 'UNKNOWN');
  assert.equal(response.degraded_reason, 'resident_model_artifact_unavailable');

  const installed = residentCandidatesFromModelManager({
    models: [{
      identity: { canonical_id: 'local:liquid-2.6b', display_name: 'Liquid 2.6B', family: 'liquid' },
      availability: 'INSTALLED', artifact_ids: ['artifact:liquid-2.6b']
    }],
    artifacts: [{ id: 'artifact:liquid-2.6b', availability: 'INSTALLED' }]
  });
  assert.equal(installed[0].artifact_available, true);
});

test('runtime-unverified and runtime-unavailable reasons remain stable on the route', async () => {
  const candidate = { canonical_id: 'local:liquid-2.6b', display_name: 'Liquid 2.6B', family: 'liquid', availability: 'INSTALLED', artifact_available: true, runtime_ready: false };
  const unverified = createResidentBinding({ listCandidates: async () => [candidate] });
  const unverifiedResponse = await routeForResidentBinding(unverified).handler({});
  assert.equal(unverifiedResponse.binding_state, 'DEGRADED');
  assert.equal(unverifiedResponse.runtime_state, 'UNKNOWN');
  assert.equal(unverifiedResponse.degraded_reason, 'resident_runtime_unverified');

  const unavailable = createResidentBinding({
    listCandidates: async () => [candidate],
    observeRuntime: async () => ({ runtime_state: 'NOT_LOADABLE', verified_at: '2026-10-06T09:10:00.000Z' })
  });
  const unavailableResponse = await routeForResidentBinding(unavailable).handler({});
  assert.equal(unavailableResponse.binding_state, 'DEGRADED');
  assert.equal(unavailableResponse.runtime_state, 'NOT_LOADABLE');
  assert.equal(unavailableResponse.degraded_reason, 'resident_runtime_unavailable');
});

test('the route derives on every read: canonical state changes are reflected without caches', async () => {
  let candidates = [{ canonical_id: 'local:liquid-2.6b', display_name: 'Liquid 2.6B', family: 'liquid', availability: 'INSTALLED', artifact_available: true, runtime_ready: true }];
  const service = createResidentBinding({ listCandidates: async () => candidates, observeRuntime: async () => ({ runtime_state: 'LOADABLE', verified_at: '2026-10-06T09:05:00.000Z' }) });
  const route = routeForResidentBinding(service);
  const first = await route.handler({});
  assert.equal(first.binding_state, 'BOUND');
  candidates = [];
  const second = await route.handler({});
  assert.equal(second.binding_state, 'UNBOUND');
  assert.equal(second.degraded_reason, 'resident_model_not_registered');
});

test('worker-only inventory can never surface as the Resident through the route', async () => {
  const view = await createResidentBinding({
    listCandidates: async () => [{ canonical_id: 'local:qwen2.5-coder-3b', display_name: 'Qwen Coder', family: 'qwen2', availability: 'INSTALLED', artifact_available: true, runtime_ready: true }]
  }).read();
  const route = routeForResidentBinding({ read: async () => view });
  const response = await route.handler({});
  assert.equal(response.binding_state, 'UNBOUND');
  assert.equal(response.resident_model_id, null);
  assert.notEqual(response.resident_model_id, 'local:qwen2.5-coder-3b');
});

test('a reconstructed route derives the same projection from the canonical persisted model manifest', async () => {
  const workspace = await mkdtemp(path.join(os.tmpdir(), 'resident-binding-reload-'));
  const modelDir = path.join(workspace, 'models');
  const artifactName = 'LFM2.5-2.6B-Q4_K_M.gguf';
  const artifactPath = path.join(modelDir, artifactName);
  const modelId = 'local:liquid-2.6b';
  const manifestPath = path.join(workspace, 'manifest.json');
  await mkdir(modelDir);
  await writeFile(artifactPath, 'fixture artifact');
  await writeFile(manifestPath, JSON.stringify({ models: [{
    id: modelId,
    name: 'Liquid 2.6B',
    family: 'liquid',
    file: artifactName,
    artifact_uri: `local://${artifactName}`,
    format: 'GGUF',
    context_tokens: 4096
  }] }));

  const modelRuntime = {
    list: () => [{ id: modelId, file: artifactPath }],
    status: async () => ({ runtime: false, models: [{ id: modelId, artifact_available: true, qualification: 'requires_start_preflight' }] })
  };
  const connectionsService = {
    list: async () => ({
      consensus: 'none',
      routed_roles: { planner: 'local', coder: 'local', reviewer: 'local', utility: 'local' },
      preference: 'local-first',
      connections: []
    })
  };
  const makeRoute = () => {
    const modelManagerView = createModelManagerView({ workspace, manifestPath, modelRuntime, connectionsService });
    return routeForResidentBinding(createResidentBinding({
      listCandidates: async () => residentCandidatesFromModelManager(await modelManagerView.snapshot()),
      observeRuntime: async () => ({ runtime_state: 'LOADABLE', verified_at: '2026-10-06T09:15:00.000Z' })
    }));
  };

  try {
    const first = await makeRoute().handler({});
    const afterReconstruction = await makeRoute().handler({});
    assert.equal(first.binding_state, 'BOUND');
    assert.equal(afterReconstruction.binding_state, 'BOUND');
    assert.equal(afterReconstruction.resident_model_id, modelId);
    assert.deepEqual(afterReconstruction, first);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});
