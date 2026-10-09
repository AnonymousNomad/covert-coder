// First-run readiness battery. Controls:
// - deterministic items with code/explanation/repair/blocking;
// - UNKNOWN probes never block; BLOCKED blocking items do;
// - non-git workspace is READY (truthful), not an error;
// - golden mission readiness requires a running model + admissible resources.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createReadinessService } from '../../node/src/services/readiness.ts';
import type { ModelManagerResponseT } from '../../common/contracts/model-access.ts';

function localModelAccess(): ModelManagerResponseT {
  const sha256 = 'a'.repeat(64);
  return {
    generated_at: '2026-10-08T00:00:00.000Z',
    public_safe: true,
    local_discovery: { status: 'AVAILABLE', scanned_dirs: 1, discovered_count: 0, error_count: 0 },
    runtime: { canonical_runtime_id: 'unsloth', default_runtime_id: 'unsloth', reported_backend: 'UNSLOTH', discovered_state: 'DISCOVERED', configured_runtime_id: 'unsloth', configured: true, available: true, health: 'HEALTHY', selected_model_id: 'local-model-a' },
    models: [{
      identity: { canonical_id: 'local-model-a', display_name: 'Local A', family: null, capabilities: ['chat'], context_window_tokens: 2048, qualification: { state: 'QUALIFIED', basis: { source_revision: 'revision-a', artifact_sha256: sha256, runtime_id: 'unsloth', runtime_version: '1.0' }, stale_reasons: [] } },
      artifact_ids: ['artifact-a'], availability: 'INSTALLED', compatibility: 'COMPATIBLE', readiness: 'READY', recommended_roles: ['CODER'], execution_selected_roles: ['IMPLEMENTATION']
    }],
    artifacts: [{ id: 'artifact-a', model_id: 'local-model-a', source_kind: 'LOCAL_IMPORT', source_ref: 'fixture-source', revision: 'revision-a', filename: 'local-a.gguf', format: 'GGUF', quantization: 'Q4_K_M', expected_sha256: sha256, observed_sha256: sha256, hash_status: 'VERIFIED', license: 'Apache-2.0', availability: 'INSTALLED', compatibility: 'COMPATIBLE' }],
    routes: [{ id: 'route:local-model-a', model_id: 'local-model-a', provider_id: 'local', connection_id: 'local-runtime', provider_model_id: 'local-model-a', credential_source_id: 'credential-source:local', execution_adapter_id: 'local-runtime', model_support_state: 'VERIFIED', configured: true, health: 'HEALTHY', available: true, external_egress_required: false, operator_setup_required: false, setup_state: 'READY', selected_roles: [] }],
    credential_sources: [],
    execution_adapters: [{ id: 'local-runtime', kind: 'LOCAL_RUNTIME', implementation: 'IMPLEMENTED', discovered: true, configured: true, available: true, canonical_default: true }],
    connections: { consensus: 'local-first', routed_roles: { planner: 'local', coder: 'local', reviewer: 'local', utility: 'local' }, preference: 'local-first', connections: [] },
    selection_policy: { persistence_state: 'NOT_PERSISTED', mutation_enabled: false, execution_routing_effect: false, scopes: ['PROJECT', 'ROLE'], roles: ['IMPLEMENTATION'], precedence: ['PROJECT_ROLE', 'PROJECT_DEFAULT', 'GLOBAL_ROLE', 'GLOBAL_DEFAULT'] }
  };
}

function sources(overrides: Record<string, unknown> = {}) {
  return {
    healthSnapshot: async () => ({ state: 'HEALTHY', components: [{ component: 'backend', state: 'HEALTHY' }] }),
    modelAccess: async () => localModelAccess(),
    rgAvailable: () => true,
    workspaceWritable: async () => true,
    gitRepo: async () => ({ git_repo: true }),
    memoryAdmit: async () => ({ decision: 'START', reason: 'admitted' }),
    ...overrides
  } as Parameters<typeof createReadinessService>[0];
}

test('healthy environment: ready and golden ready', async () => {
  const snapshot = await createReadinessService(sources()).snapshot();
  assert.equal(snapshot.ready, true);
  assert.equal(snapshot.ready_for_golden_mission, true);
  const models = snapshot.items.find(item => item.id === 'models');
  assert.equal(models?.code, 'EXACT_LOCAL_MODEL_READY');
  assert.match(models?.explanation ?? '', /local-model-a/);
  assert.ok(snapshot.items.every(item => item.code.length > 0));
});

test('a running model cannot make the golden mission ready without an exact Model Access binding', async () => {
  const access = localModelAccess();
  access.connections.routed_roles.coder = { provider_id: 'provider-a', model_id: 'selected-model' };
  const snapshot = await createReadinessService(sources({ modelAccess: async () => access })).snapshot();
  assert.equal(snapshot.ready_for_golden_mission, false);
  assert.equal(snapshot.items.find(item => item.id === 'models')?.state, 'DEGRADED');
});

test('artifact digest mismatch prevents exact local model readiness', async () => {
  const access = localModelAccess();
  access.artifacts[0]!.observed_sha256 = 'b'.repeat(64);
  const snapshot = await createReadinessService(sources({ modelAccess: async () => access })).snapshot();
  assert.equal(snapshot.ready_for_golden_mission, false);
  assert.equal(snapshot.items.find(item => item.id === 'models')?.state, 'DEGRADED');
});

test('runtime identity mismatch prevents exact local model readiness', async () => {
  const access = localModelAccess();
  access.runtime.configured_runtime_id = 'different-runtime';
  const snapshot = await createReadinessService(sources({ modelAccess: async () => access })).snapshot();
  assert.equal(snapshot.ready_for_golden_mission, false);
  assert.equal(snapshot.items.find(item => item.id === 'models')?.state, 'DEGRADED');
});

test('non-git workspace is READY with an honest code (not an error)', async () => {
  const snapshot = await createReadinessService(sources({ gitRepo: async () => ({ git_repo: false }) })).snapshot();
  const git = snapshot.items.find(item => item.id === 'git');
  assert.equal(git?.state, 'READY');
  assert.equal(git?.code, 'NON_GIT_WORKSPACE');
  assert.equal(snapshot.ready, true);
});

test('no exact loaded local model: DEGRADED, non-blocking, golden NOT ready', async () => {
  const access = localModelAccess();
  access.runtime.health = 'STOPPED';
  access.runtime.available = false;
  access.runtime.selected_model_id = null;
  const snapshot = await createReadinessService(sources({ modelAccess: async () => access })).snapshot();
  const models = snapshot.items.find(item => item.id === 'models');
  assert.equal(models?.state, 'DEGRADED');
  assert.equal(models?.blocking, false);
  assert.equal(snapshot.ready, true);
  assert.equal(snapshot.ready_for_golden_mission, false);
});

test('memory refusal: BLOCKED blocking item and ready false', async () => {
  const snapshot = await createReadinessService(sources({ memoryAdmit: async () => ({ decision: 'REFUSE_RESOURCE', reason: 'below safety floor' }) })).snapshot();
  const resources = snapshot.items.find(item => item.id === 'resources');
  assert.equal(resources?.state, 'BLOCKED');
  assert.equal(resources?.blocking, true);
  assert.equal(resources?.code, 'INSUFFICIENT_MEMORY');
  assert.equal(snapshot.ready, false);
});

test('queued resources: DEGRADED but golden ready not required to block', async () => {
  const snapshot = await createReadinessService(sources({ memoryAdmit: async () => ({ decision: 'QUEUE', reason: 'tight' }) })).snapshot();
  const resources = snapshot.items.find(item => item.id === 'resources');
  assert.equal(resources?.state, 'DEGRADED');
  assert.equal(snapshot.ready, true);
});

test('failing probes are UNKNOWN and never block', async () => {
  const broken = sources({
    healthSnapshot: async () => { throw new Error('down'); },
    modelAccess: async () => { throw new Error('down'); },
    workspaceWritable: async () => { throw new Error('down'); },
    gitRepo: async () => { throw new Error('down'); },
    memoryAdmit: async () => { throw new Error('down'); }
  });
  const snapshot = await createReadinessService(broken).snapshot();
  for (const id of ['git', 'models', 'resources']) {
    assert.equal(snapshot.items.find(item => item.id === id)?.state, 'UNKNOWN');
  }
  // core and workspace map probe failure to BLOCKED (fail closed), everything else stays unknown.
  assert.equal(snapshot.ready, false);
  assert.equal(snapshot.items.find(item => item.id === 'core')?.state, 'BLOCKED');
  assert.equal(snapshot.items.find(item => item.id === 'workspace')?.state, 'BLOCKED');
});

test('unhealthy core: BLOCKED with repair guidance', async () => {
  const snapshot = await createReadinessService(sources({ healthSnapshot: async () => ({ state: 'UNHEALTHY', components: [] }) })).snapshot();
  const core = snapshot.items.find(item => item.id === 'core');
  assert.equal(core?.state, 'BLOCKED');
  assert.equal(core?.code, 'CORE_UNHEALTHY');
  assert.ok((core?.repair ?? '').length > 0);
  assert.equal(snapshot.ready, false);
});
