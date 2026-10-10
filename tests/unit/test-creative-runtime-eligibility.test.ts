import test from 'node:test';
import assert from 'node:assert/strict';
import { CreationStudioShot } from '../../common/contracts/creation-studio.ts';
import { CreativeRuntimeEvidence } from '../../common/contracts/creative-runtime.ts';
import {
  buildCreativeRuntimeRequirement,
  evaluateCreativeRuntimeEligibility
} from '../../common/creative-runtime-eligibility.ts';

function shot(overrides: Record<string, unknown> = {}) {
  return CreationStudioShot.parse({
    shot_id: 'shot-001',
    order: 0,
    prompt: 'Slow push through ruins at dawn.',
    duration_seconds: 6,
    aspect_ratio: '2.39:1',
    state: 'PLANNED',
    assignments: [{
      capability: 'VIDEO',
      provider_id: 'cloud-looking-provider',
      model_id: 'framepack-local-candidate',
      state: 'ASSIGNED'
    }],
    ...overrides
  });
}

function evidence(overrides: Partial<{
  installed: boolean;
  runtimeReady: boolean;
  modelId: string | null;
  modelAvailable: boolean;
  hardwareEligible: boolean | null;
  connected: boolean;
  admission: 'START' | 'QUEUE' | 'REFUSE_RESOURCE' | null;
}> = {}) {
  return CreativeRuntimeEvidence.parse({
    runtime: {
      adapter: 'COMFYUI',
      installed: overrides.installed ?? true,
      ready: overrides.runtimeReady ?? true
    },
    model: {
      model_id: overrides.modelId === undefined ? 'framepack-local-candidate' : overrides.modelId,
      available: overrides.modelAvailable ?? true
    },
    hardware: {
      eligible: overrides.hardwareEligible === undefined ? true : overrides.hardwareEligible
    },
    execution: {
      connected: overrides.connected ?? false,
      admission_decision: overrides.admission === undefined ? null : overrides.admission
    }
  });
}

test('shot requirement is deterministic, local-only, and does not treat provider metadata as execution authority', () => {
  const input = shot();
  const before = structuredClone(input);
  const first = buildCreativeRuntimeRequirement(input);
  const second = buildCreativeRuntimeRequirement(structuredClone(input));

  assert.deepEqual(second, first);
  assert.deepEqual(input, before);
  assert.equal(first.required_capability, 'VIDEO_I2V');
  assert.equal(first.execution_class, 'LOCAL');
  assert.equal(first.adapter, 'COMFYUI');
  assert.equal(first.requested_model_id, 'framepack-local-candidate');
  assert.equal(first.assignment_state, 'ASSIGNED');
  assert.equal('provider_id' in first, false);
});

test('runtime absent remains RUNTIME_NOT_INSTALLED even when other prerequisites are also absent', () => {
  const requirement = buildCreativeRuntimeRequirement(shot({
    assignments: [{ capability: 'VIDEO', provider_id: null, model_id: null, state: 'UNASSIGNED' }]
  }));
  const result = evaluateCreativeRuntimeEligibility(requirement, evidence({
    installed: false,
    runtimeReady: false,
    modelAvailable: false,
    hardwareEligible: null,
    connected: false,
    admission: null
  }));

  assert.equal(result.state, 'RUNTIME_NOT_INSTALLED');
  assert.deepEqual(result.blockers, [
    'RUNTIME_NOT_INSTALLED',
    'MODEL_NOT_SELECTED',
    'HARDWARE_ELIGIBILITY_UNKNOWN',
    'EXECUTION_NOT_CONNECTED',
    'ADMISSION_NOT_EVALUATED'
  ]);
  assert.equal(result.execution_attempted, false);
  assert.equal(result.cloud_fallback, false);
});

test('runtime ready with an absent requested model reports MODEL_NOT_AVAILABLE and never substitutes', () => {
  const requirement = buildCreativeRuntimeRequirement(shot());
  const result = evaluateCreativeRuntimeEligibility(requirement, evidence({
    modelAvailable: false,
    hardwareEligible: true,
    connected: true,
    admission: 'START'
  }));

  assert.equal(result.requirement.requested_model_id, 'framepack-local-candidate');
  assert.equal(result.state, 'MODEL_NOT_AVAILABLE');
  assert.deepEqual(result.blockers, ['MODEL_NOT_AVAILABLE']);
  assert.equal(result.cloud_fallback, false);
});

test('a different ready model cannot substitute for the requested model', () => {
  const requirement = buildCreativeRuntimeRequirement(shot());
  const result = evaluateCreativeRuntimeEligibility(requirement, evidence({
    modelId: 'different-ready-model',
    modelAvailable: true,
    hardwareEligible: true,
    connected: true,
    admission: 'START'
  }));

  assert.equal(result.requirement.requested_model_id, 'framepack-local-candidate');
  assert.equal(result.state, 'MODEL_NOT_AVAILABLE');
  assert.deepEqual(result.blockers, ['MODEL_IDENTITY_MISMATCH']);
  assert.equal(result.cloud_fallback, false);
});

test('model presence is separate from hardware eligibility', () => {
  const requirement = buildCreativeRuntimeRequirement(shot());
  const result = evaluateCreativeRuntimeEligibility(requirement, evidence({
    modelAvailable: true,
    hardwareEligible: false,
    connected: true,
    admission: 'START'
  }));

  assert.equal(result.state, 'HARDWARE_BLOCKED');
  assert.deepEqual(result.blockers, ['HARDWARE_BLOCKED']);
});

test('an installed runtime that is not ready is LOCAL_RENDER_UNAVAILABLE', () => {
  const requirement = buildCreativeRuntimeRequirement(shot());
  const result = evaluateCreativeRuntimeEligibility(requirement, evidence({
    installed: true,
    runtimeReady: false,
    modelAvailable: true,
    hardwareEligible: true,
    connected: true,
    admission: 'START'
  }));

  assert.equal(result.state, 'LOCAL_RENDER_UNAVAILABLE');
  assert.deepEqual(result.blockers, ['RUNTIME_NOT_READY']);
});

test('ready runtime/model/hardware remains GATED while execution is not connected and Admission is not evaluated', () => {
  const requirement = buildCreativeRuntimeRequirement(shot());
  const result = evaluateCreativeRuntimeEligibility(requirement, evidence({
    modelAvailable: true,
    hardwareEligible: true,
    connected: false,
    admission: null
  }));

  assert.equal(result.state, 'GATED');
  assert.deepEqual(result.blockers, ['EXECUTION_NOT_CONNECTED', 'ADMISSION_NOT_EVALUATED']);
  assert.equal(result.execution_attempted, false);
});

test('canonical Resource Admission refusal is a hardware/resource block, not readiness', () => {
  const requirement = buildCreativeRuntimeRequirement(shot());
  const result = evaluateCreativeRuntimeEligibility(requirement, evidence({
    modelAvailable: true,
    hardwareEligible: true,
    connected: true,
    admission: 'REFUSE_RESOURCE'
  }));

  assert.equal(result.state, 'HARDWARE_BLOCKED');
  assert.deepEqual(result.blockers, ['RESOURCE_ADMISSION_REFUSED']);
  assert.equal(result.execution_attempted, false);
});

test('QUEUE remains gated and does not claim a render', () => {
  const requirement = buildCreativeRuntimeRequirement(shot());
  const result = evaluateCreativeRuntimeEligibility(requirement, evidence({
    modelAvailable: true,
    hardwareEligible: true,
    connected: true,
    admission: 'QUEUE'
  }));

  assert.equal(result.state, 'GATED');
  assert.deepEqual(result.blockers, ['ADMISSION_QUEUED']);
  assert.equal(result.execution_attempted, false);
});

test('READY requires runtime, exact model availability, hardware eligibility, connection, and canonical START evidence', () => {
  const requirement = buildCreativeRuntimeRequirement(shot());
  const result = evaluateCreativeRuntimeEligibility(requirement, evidence({
    modelAvailable: true,
    hardwareEligible: true,
    connected: true,
    admission: 'START'
  }));

  assert.equal(result.state, 'READY');
  assert.deepEqual(result.blockers, []);
  assert.equal(result.execution_attempted, false);
  assert.equal(result.cloud_fallback, false);
});

test('assignment unavailable remains model unavailable even if a same-named model is otherwise visible', () => {
  const requirement = buildCreativeRuntimeRequirement(shot({
    assignments: [{
      capability: 'VIDEO',
      provider_id: 'anything',
      model_id: 'framepack-local-candidate',
      state: 'UNAVAILABLE'
    }]
  }));
  const result = evaluateCreativeRuntimeEligibility(requirement, evidence({
    modelAvailable: true,
    hardwareEligible: true,
    connected: true,
    admission: 'START'
  }));

  assert.equal(result.state, 'MODEL_NOT_AVAILABLE');
  assert.deepEqual(result.blockers, ['MODEL_ASSIGNMENT_UNAVAILABLE']);
});

test('evaluator is deterministic and does not mutate requirement or evidence', () => {
  const requirement = buildCreativeRuntimeRequirement(shot());
  const environment = evidence({
    modelAvailable: true,
    hardwareEligible: true,
    connected: false,
    admission: null
  });
  const requirementBefore = structuredClone(requirement);
  const evidenceBefore = structuredClone(environment);

  const first = evaluateCreativeRuntimeEligibility(requirement, environment);
  const second = evaluateCreativeRuntimeEligibility(structuredClone(requirement), structuredClone(environment));

  assert.deepEqual(second, first);
  assert.deepEqual(requirement, requirementBefore);
  assert.deepEqual(environment, evidenceBefore);
});

test('evidence contract rejects impossible runtime ready-without-install state', () => {
  assert.throws(() => CreativeRuntimeEvidence.parse({
    runtime: { adapter: 'COMFYUI', installed: false, ready: true },
    model: { model_id: 'framepack-local-candidate', available: true },
    hardware: { eligible: true },
    execution: { connected: true, admission_decision: 'START' }
  }));
});
