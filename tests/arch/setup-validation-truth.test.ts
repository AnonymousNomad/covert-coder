import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSetupValidation, setupOperationalIdentityFingerprint, setupValidationReady, REQUIRED_SETUP_CHECKS, type SetupCheck } from '../../browser/src/cockpit/setup-validation.ts';
import type { ByokStatusResponseT } from '../../common/contracts/byok.ts';
import type { ModelManagerResponseT } from '../../common/contracts/model-access.ts';

const passed = (): SetupCheck[] => REQUIRED_SETUP_CHECKS.map(label => ({ label, status: 'PASSED', detail: 'observed' }));

test('not run and pending validation never establish readiness', () => {
  const validation = createSetupValidation();
  assert.equal(validation.snapshot().status, 'NOT_RUN');
  assert.equal(setupValidationReady(validation.snapshot()), false);
  validation.begin();
  assert.equal(validation.snapshot().status, 'RUNNING');
  assert.equal(setupValidationReady(validation.snapshot()), false);
});
test('all required completed checks pass; optional provider absence does not assert cloud availability', () => {
  const validation = createSetupValidation();
  validation.complete(validation.begin(), [...passed(), { label: 'providers', status: 'UNAVAILABLE', detail: 'optional status unavailable' }]);
  assert.equal(setupValidationReady(validation.snapshot()), true);
});
for (const status of ['FAILED', 'UNAVAILABLE'] as const) {
  test(`required ${status} result prevents readiness`, () => {
    const validation = createSetupValidation();
    const checks = passed(); checks[0] = { label: 'daemon', status, detail: 'not healthy' };
    validation.complete(validation.begin(), checks);
    assert.equal(validation.snapshot().status, status);
    assert.equal(setupValidationReady(validation.snapshot()), false);
  });
}
test('empty, incomplete and ambiguous duplicate results cannot pass', () => {
  for (const checks of [[], passed().slice(1), [...passed(), passed()[0]!]]) {
    const validation = createSetupValidation();
    validation.complete(validation.begin(), checks);
    assert.equal(validation.snapshot().status, 'UNAVAILABLE');
    assert.equal(setupValidationReady(validation.snapshot()), false);
  }
});
test('previous success is revoked at rerun start and cannot survive a new failure', () => {
  const validation = createSetupValidation();
  validation.complete(validation.begin(), passed());
  assert.equal(setupValidationReady(validation.snapshot()), true);
  const rerun = validation.begin();
  assert.equal(setupValidationReady(validation.snapshot()), false);
  validation.complete(rerun, [{ label: 'daemon', status: 'FAILED', detail: 'stopped' }]);
  assert.equal(setupValidationReady(validation.snapshot()), false);
});
test('navigation/close invalidation rejects abandoned or out of order completions', () => {
  const validation = createSetupValidation();
  const abandoned = validation.begin(); validation.invalidate();
  assert.equal(validation.complete(abandoned, passed()), false);
  const old = validation.begin(); const current = validation.begin();
  assert.equal(validation.complete(old, passed()), false);
  validation.complete(current, [{ label: 'daemon', status: 'UNAVAILABLE', detail: 'offline' }]);
  assert.equal(validation.complete(old, passed()), false);
  assert.equal(setupValidationReady(validation.snapshot()), false);
});
test('mutating an observed snapshot cannot manufacture readiness', () => {
  const validation = createSetupValidation();
  validation.complete(validation.begin(), passed());
  validation.snapshot().checks[0]!.status = 'FAILED';
  assert.equal(setupValidationReady(validation.snapshot()), true);
  validation.invalidate();
  assert.equal(setupValidationReady(validation.snapshot()), false);
});

function modelAccessIdentity(): ModelManagerResponseT {
  const digest = 'a'.repeat(64);
  return {
    generated_at: '2026-10-04T00:00:00.000Z',
    public_safe: true,
    local_discovery: { status: 'AVAILABLE', scanned_dirs: 1, discovered_count: 1, error_count: 0 },
    runtime: { canonical_runtime_id: 'unsloth', default_runtime_id: 'unsloth', reported_backend: 'UNSLOTH', discovered_state: 'DISCOVERED', configured_runtime_id: 'unsloth', configured: true, available: true, health: 'HEALTHY', selected_model_id: 'local-model-a' },
    models: [{ identity: { canonical_id: 'local-model-a', display_name: 'Local A', family: null, capabilities: ['chat'], context_window_tokens: 2048, qualification: { state: 'QUALIFIED', basis: { source_revision: 'revision-a', artifact_sha256: digest, runtime_id: 'unsloth', runtime_version: '1.0' }, stale_reasons: [] } }, artifact_ids: ['artifact-a'], availability: 'AVAILABLE', compatibility: 'COMPATIBLE', readiness: 'READY', recommended_roles: ['CODER'], execution_selected_roles: ['CODER'] }],
    artifacts: [{ id: 'artifact-a', model_id: 'local-model-a', source_kind: 'LOCAL_MANIFEST', source_ref: 'fixture-manifest', revision: 'revision-a', filename: 'local-a.gguf', format: 'GGUF', quantization: 'Q4_K_M', expected_sha256: digest, observed_sha256: digest, hash_status: 'VERIFIED', license: 'Apache-2.0', availability: 'AVAILABLE', compatibility: 'COMPATIBLE' }],
    routes: [], credential_sources: [], execution_adapters: [],
    connections: { consensus: 'local-first', routed_roles: { planner: 'local', coder: 'local', reviewer: 'local', utility: 'local' }, preference: 'local-first', connections: [] },
    selection_policy: { persistence_state: 'NOT_PERSISTED', mutation_enabled: false, execution_routing_effect: false, scopes: [], roles: [], precedence: ['PROJECT_ROLE', 'PROJECT_DEFAULT', 'GLOBAL_ROLE', 'GLOBAL_DEFAULT'] }
  };
}

function providerIdentity(): ByokStatusResponseT {
  return {
    providers: [{ id: 'provider-a', name: 'Provider A', base_url: 'https://example.invalid/v1?access_token=private-marker', api_type: 'chat-completions', model_id: 'remote-model-a', tool_calling: false, key_stored: true }],
    routing: { planner: 'local', coder: 'local', reviewer: 'local', utility: 'local' },
    consent_enabled: false
  };
}

test('setup identity fingerprint binds model artifacts, runtime, provider routing and endpoint without exposing endpoint text', async () => {
  const access = modelAccessIdentity();
  const provider = providerIdentity();
  const original = await setupOperationalIdentityFingerprint(access, provider);
  assert.equal(await setupOperationalIdentityFingerprint(modelAccessIdentity(), providerIdentity()), original);
  assert.equal(original.includes('private-marker'), false);

  const changedArtifact = modelAccessIdentity();
  changedArtifact.artifacts[0]!.observed_sha256 = 'b'.repeat(64);
  assert.notEqual(await setupOperationalIdentityFingerprint(changedArtifact, provider), original);

  const changedRuntime = modelAccessIdentity();
  changedRuntime.runtime.reported_backend = 'LLAMA_CPP';
  changedRuntime.runtime.configured_runtime_id = 'llama-cpp';
  assert.notEqual(await setupOperationalIdentityFingerprint(changedRuntime, provider), original);

  const changedProvider = providerIdentity();
  changedProvider.providers[0]!.id = 'provider-b';
  assert.notEqual(await setupOperationalIdentityFingerprint(access, changedProvider), original);

  const changedEndpoint = providerIdentity();
  changedEndpoint.providers[0]!.base_url = 'https://example.invalid/v2?access_token=private-marker';
  assert.notEqual(await setupOperationalIdentityFingerprint(access, changedEndpoint), original);
});
