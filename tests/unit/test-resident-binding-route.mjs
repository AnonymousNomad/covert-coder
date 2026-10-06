// Resident Binding transport tests: the canonical read route returns the
// frozen covert.resident-binding.v1 projection, derives on every read, and
// carries stable codes with no prose parsing.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { routeForResidentBinding } from '../../node/src/routes/resident-binding.ts';
import { ResidentBinding, RESIDENT_BINDING_SCHEMA } from '../../common/contracts/resident-binding.ts';
import { createResidentBinding } from '../../node/src/services/resident-binding.ts';

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
