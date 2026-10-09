// Resident binding contract tests. Cipher is the Resident; Liquid is the
// canonical Resident model; worker models never masquerade as the Resident.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createResidentBinding } from '../../node/src/services/resident-binding.ts';
import { ResidentBinding, RESIDENT_BINDING_SCHEMA } from '../../common/contracts/resident-binding.ts';

function candidate(overrides = {}) {
  return {
    canonical_id: 'local:liquid-2.6b',
    display_name: 'Liquid 2.6B',
    family: 'liquid',
    availability: 'INSTALLED',
    artifact_available: true,
    runtime_ready: true,
    ...overrides
  };
}

function binding(overrides = {}) {
  return createResidentBinding({
    listCandidates: async () => overrides.candidates ?? [candidate()],
    observeRuntime: overrides.observeRuntime ?? (async () => ({ runtime_state: 'LOADABLE', verified_at: '2026-10-06T08:00:00.000Z' })),
    ...(overrides.observeRoleQualification ? { observeRoleQualification: overrides.observeRoleQualification } : {}),
    executionNode: 'local-windows'
  });
}

test('a loadable Liquid Resident stays degraded until role qualification is observed', async () => {
  const view = await binding().read();
  assert.equal(view.schema, RESIDENT_BINDING_SCHEMA);
  assert.equal(view.resident_id, 'cipher');
  assert.equal(view.resident_model_id, 'local:liquid-2.6b');
  assert.equal(view.resident_model_family, 'liquid');
  assert.equal(view.binding_state, 'DEGRADED');
  assert.equal(view.availability_state, 'AVAILABLE');
  assert.equal(view.runtime_state, 'LOADABLE');
  assert.equal(view.degraded_reason, 'resident_role_qualification_unverified');
  assert.equal(view.last_verified_at, '2026-10-06T08:00:00.000Z');
});

test('only explicit Resident-role qualification allows binding once the model is loadable', async () => {
  const view = await binding({ observeRoleQualification: async () => 'QUALIFIED' }).read();
  assert.equal(view.binding_state, 'BOUND');
  assert.equal(view.degraded_reason, null);
});

test('negative Resident-role qualification remains degraded', async () => {
  const view = await binding({ observeRoleQualification: async () => 'NOT_QUALIFIED' }).read();
  assert.equal(view.binding_state, 'DEGRADED');
  assert.equal(view.degraded_reason, 'resident_model_not_qualified');
});

test('running runtime is reported truthfully', async () => {
  const view = await binding({ observeRuntime: async () => ({ runtime_state: 'RUNNING', verified_at: '2026-10-06T08:05:00.000Z' }) }).read();
  assert.equal(view.runtime_state, 'RUNNING');
  assert.equal(view.binding_state, 'DEGRADED');
  assert.equal(view.degraded_reason, 'resident_role_qualification_unverified');
});

test('missing Liquid registration degrades with a stable reason', async () => {
  const view = await binding({ candidates: [candidate({ canonical_id: 'local:qwen-coder', family: 'qwen2' })] }).read();
  assert.equal(view.binding_state, 'UNBOUND');
  assert.equal(view.availability_state, 'UNAVAILABLE');
  assert.equal(view.resident_model_id, null);
  assert.equal(view.degraded_reason, 'resident_model_not_registered');
});

test('multiple Liquid candidates degrade instead of guessing', async () => {
  const view = await binding({ candidates: [candidate(), candidate({ canonical_id: 'local:liquid-v2', display_name: 'Liquid v2' })] }).read();
  assert.equal(view.binding_state, 'DEGRADED');
  assert.equal(view.resident_model_id, null);
  assert.equal(view.degraded_reason, 'multiple_resident_candidates');
});

test('artifact or runtime unavailability degrades truthfully', async () => {
  const noArtifact = await binding({ candidates: [candidate({ artifact_available: false, availability: 'UNAVAILABLE' })] }).read();
  assert.equal(noArtifact.binding_state, 'DEGRADED');
  assert.equal(noArtifact.availability_state, 'UNAVAILABLE');
  assert.equal(noArtifact.degraded_reason, 'resident_model_artifact_unavailable');

  const notLoadable = await binding({ observeRuntime: async () => ({ runtime_state: 'NOT_LOADABLE', verified_at: '2026-10-06T08:10:00.000Z' }) }).read();
  assert.equal(notLoadable.binding_state, 'DEGRADED');
  assert.equal(notLoadable.degraded_reason, 'resident_runtime_unavailable');

  const unverified = await binding({ observeRuntime: async () => ({ runtime_state: 'UNKNOWN', verified_at: null }) }).read();
  assert.equal(unverified.binding_state, 'DEGRADED');
  assert.equal(unverified.degraded_reason, 'resident_runtime_unverified');
  assert.equal(unverified.last_verified_at !== null, true);
});

test('runtime observation failure never crashes the binding read', async () => {
  const view = await binding({ observeRuntime: async () => { throw new Error('probe down'); } }).read();
  assert.equal(view.binding_state, 'DEGRADED');
  assert.equal(view.degraded_reason, 'resident_runtime_unverified');
});

test('worker models and pinned defaults never become the Resident', async () => {
  const view = await binding({
    candidates: [
      candidate({ canonical_id: 'local:qwen2.5-coder-3b', family: 'qwen2', availability: 'INSTALLED' }),
      candidate({ canonical_id: 'local:liquid-2.6b', family: 'liquid', availability: 'INSTALLED' })
    ]
  }).read();
  assert.equal(view.resident_model_id, 'local:liquid-2.6b');
  assert.notEqual(view.resident_model_id, 'local:qwen2.5-coder-3b');
});

test('binding reads are derived-only: two reads over unchanged inputs agree', async () => {
  const service = binding();
  const first = await service.read();
  const second = await service.read();
  const strip = value => ({ ...value, last_verified_at: 'volatile' });
  assert.deepEqual(strip(first), strip(second));
  assert.equal(ResidentBinding.safeParse(first).success, true);
});
