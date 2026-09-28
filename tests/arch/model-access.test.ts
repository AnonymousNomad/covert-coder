import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { ConnectionsTestRequest, ConnectionsViewResponse } from '../../common/contracts/connections.ts';
import {
  ModelAccessIdentity,
  ModelArtifactSource,
  ModelProviderRoute,
  ModelCredentialSource
} from '../../common/contracts/model-access.ts';
import { createProviderConnectionsService } from '../../node/src/services/provider-connections.mjs';
import { createModelManagerView, evaluateQualificationFreshness } from '../../node/src/services/model-manager-view.ts';
import { routeForModelManager } from '../../node/src/routes/models.ts';

const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);

test('logical model identity is independent of routes, credentials, and adapters', () => {
  const model = ModelAccessIdentity.parse({
    canonical_id: 'logical-model-a',
    display_name: 'Model A',
    family: 'example-family',
    capabilities: ['chat'],
    context_window_tokens: 8192,
    qualification: {
      state: 'UNTESTED',
      basis: null,
      stale_reasons: []
    }
  });
  assert.equal(model.canonical_id, 'logical-model-a');
  assert.equal('provider_id' in model, false);
  assert.equal('credential_source_id' in model, false);
  assert.equal('execution_adapter_id' in model, false);

  const first = ModelProviderRoute.parse({
    id: 'route:provider-a:model-a',
    model_id: model.canonical_id,
    provider_id: 'provider-a',
    connection_id: 'connection-a',
    provider_model_id: 'model-a',
    credential_source_id: 'credential-a',
    execution_adapter_id: 'direct-http',
    model_support_state: 'UNKNOWN',
    configured: true,
    health: 'UNKNOWN',
    available: false,
    external_egress_required: true,
    operator_setup_required: false,
    setup_state: 'VERIFICATION_REQUIRED',
    selected_roles: []
  });
  const second = ModelProviderRoute.parse({
    ...first,
    id: 'route:provider-b:model-a',
    provider_id: 'provider-b',
    connection_id: 'connection-b',
    credential_source_id: 'credential-b',
    execution_adapter_id: 'opencode'
  });
  assert.equal(first.model_id, second.model_id);
  assert.notEqual(first.id, second.id);
});

test('artifact availability does not imply qualification, and qualification is bound to identity', () => {
  const artifact = ModelArtifactSource.parse({
    id: 'artifact:logical-model-a',
    model_id: 'logical-model-a',
    source_kind: 'LOCAL_MANIFEST',
    source_ref: 'example/model-a',
    revision: 'revision-1',
    filename: 'model-a.Q4_K_M.gguf',
    format: 'GGUF',
    quantization: 'Q4_K_M',
    expected_sha256: HASH_A,
    observed_sha256: null,
    hash_status: 'EXPECTED',
    license: 'Apache-2.0',
    availability: 'INSTALLED',
    compatibility: 'UNKNOWN'
  });
  const model = ModelAccessIdentity.parse({
    canonical_id: artifact.model_id,
    display_name: 'Model A',
    family: null,
    capabilities: [],
    context_window_tokens: null,
    qualification: { state: 'UNTESTED', basis: null, stale_reasons: [] }
  });
  assert.equal(artifact.availability, 'INSTALLED');
  assert.equal(model.qualification.state, 'UNTESTED');

  const current = { source_revision: 'revision-1', artifact_sha256: HASH_A, runtime_id: 'unsloth', runtime_version: null };
  assert.deepEqual(
    evaluateQualificationFreshness({ state: 'QUALIFIED', basis: current }, current),
    { state: 'QUALIFIED', stale_reasons: [] }
  );
  assert.deepEqual(
    evaluateQualificationFreshness(
      { state: 'QUALIFIED', basis: current },
      { ...current, source_revision: 'revision-2' }
    ),
    { state: 'STALE', stale_reasons: ['source_revision_changed'] }
  );
  assert.deepEqual(
    evaluateQualificationFreshness(
      { state: 'QUALIFIED', basis: current },
      { ...current, artifact_sha256: HASH_B }
    ),
    { state: 'STALE', stale_reasons: ['artifact_sha256_changed'] }
  );
});

test('credential source identity is metadata only and rejects secret material', () => {
  const source = ModelCredentialSource.parse({
    id: 'credential-source:api-key:provider-a',
    kind: 'API_KEY_VAULT',
    authentication_mode: 'API_KEY',
    configuration_state: 'CONFIGURED',
    setup_required: false
  });
  assert.notEqual(source.id, 'provider-a');
  assert.equal(ModelCredentialSource.safeParse({ ...source, secret_value: 'sentinel-secret' }).success, false);
});

test('maximum BYOK provider ID fits the prefixed connection and governed test request contracts', async t => {
  const providerId = 'p'.repeat(64);
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'model-access-long-provider-id-'));
  t.after(() => fs.rm(workspace, { recursive: true, force: true }));
  const service = createProviderConnectionsService({
    workspace,
    providerService: { list: async () => [] },
    byokService: {
      status: () => ({
        providers: [{ id: providerId, name: 'Long ID', base_url: 'https://provider.example/v1', model_id: 'model-a', key_stored: true }],
        routing: { plan: 'local', act: 'local', utility: 'local' },
        consent_enabled: false
      }),
      testProvider: async () => ({ ok: false, detail: 'not configured' })
    },
    modelRuntimeStatus: async () => ({ runtime: false, models: [] }),
    secretStore: { setKey: () => undefined, getKey: () => null, deleteKey: () => true, listProviderIds: () => [] },
    findExecutable: async () => null
  });
  const view = ConnectionsViewResponse.parse(await service.list());
  const connection = view.connections.find(item => item.provider_id === providerId);
  assert.ok(connection);
  assert.equal(connection.id, `api:${providerId}`);
  assert.equal(connection.id.length, 68);
  assert.equal(ConnectionsTestRequest.parse({ connection_id: connection.id }).connection_id, connection.id);
});

test('connection read projection is passive, secret-free, and never invents readiness', async t => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'model-access-passive-'));
  t.after(() => fs.rm(workspace, { recursive: true, force: true }));
  const secret = 'sk-test-credential-sentinel';
  let secretReads = 0;
  let providerExecutions = 0;
  const service = createProviderConnectionsService({
    workspace,
    providerService: ({
      list: async () => [{ id: 'openai', name: 'OpenAI', models: ['gpt-4o'], status: 'checking', configured: true }],
      chat: async () => { providerExecutions++; throw new Error('execution must not run'); }
    } as any),
    byokService: {
      status: () => ({
        providers: [{ id: 'custom-a', name: secret, model_id: 'model-a', key_stored: true }],
        routing: { plan: 'local', act: { provider_id: secret, model_id: secret }, utility: 'local' },
        consent_enabled: false
      }),
      testProvider: async () => { providerExecutions++; return { ok: true, detail: 'unexpected' }; }
    },
    modelRuntimeStatus: async () => ({
      runtime: true,
      models: [{
        id: 'local-model-a',
        name: 'Local A',
        status: 'ready',
        runtime_available: true,
        artifact_available: true,
        qualification: 'requires_start_preflight'
      }]
    }),
    secretStore: {
      setKey: () => undefined,
      getKey: () => { secretReads++; return secret; },
      deleteKey: () => true,
      listProviderIds: () => []
    },
    findExecutable: async () => null
  });

  const view: any = await service.list();
  const serialized = JSON.stringify(view);
  assert.equal(serialized.includes(secret), false);
  assert.equal(secretReads, 0, 'read projection must use credential-presence metadata');
  assert.equal(providerExecutions, 0, 'read projection must not execute or probe providers');

  const custom = view.connections.find((item: any) => item.id === 'api:custom-a');
  assert.ok(custom);
  assert.equal(custom.status, 'configured_not_verified');
  assert.equal(custom.access.authentication_configured, true);
  assert.equal(custom.access.health, 'unknown');
  assert.equal(custom.access.setup_state, 'consent_required');
  assert.equal(custom.routing_available, false);

  const builtin = view.connections.find((item: any) => item.id === 'builtin:openai');
  assert.ok(builtin);
  assert.equal(builtin.status, 'configured_not_verified');
  assert.equal(builtin.routing_available, false);

  const local = view.connections.find((item: any) => item.id === 'local-runtime');
  assert.ok(local);
  assert.equal(local.status, 'configured_not_verified');
  assert.equal(local.routing_available, false);
  assert.equal(local.access.setup_state, 'verification_required');
  assert.deepEqual(view.routed_roles.act, { provider_id: 'redacted', model_id: 'redacted' });
});

test('provider health does not imply exact model route support and local-only gates egress', async t => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'model-access-support-'));
  t.after(() => fs.rm(workspace, { recursive: true, force: true }));
  const preferencePath = path.join(workspace, 'routing-preference.json');
  const service = createProviderConnectionsService({
    workspace,
    preferencePath,
    providerService: { list: async () => [{ id: 'openai', name: 'OpenAI', models: ['gpt-4o'], status: 'connected', configured: true }] },
    byokService: {
      status: () => ({ providers: [], routing: { plan: 'local', act: 'local', utility: 'local' }, consent_enabled: true }),
      testProvider: async () => ({ ok: false, detail: 'not configured' })
    },
    modelRuntimeStatus: async () => ({ runtime: false, models: [] }),
    secretStore: { setKey: () => undefined, getKey: () => null, deleteKey: () => true, listProviderIds: () => [] },
    findExecutable: async () => null
  });
  const initial = await service.list();
  const builtin = initial.connections.find((item: any) => item.id === 'builtin:openai');
  assert.ok(builtin);
  assert.equal(builtin.access.health, 'healthy');
  assert.equal(builtin.routing_available, true);
  const reference = builtin.access.model_refs[0];
  assert.ok(reference);
  assert.equal(reference.model_support_state, 'unknown');
  const manager = createModelManagerView({
    workspace,
    manifestPath: path.join(workspace, 'manifest.json'),
    modelRuntime: { list: () => [], status: async () => ({ runtime: false, models: [] }) } as any,
    connectionsService: service as any,
    runtimeStatus: async () => ({ backend: null, health: 'NOT_INSTALLED' }) as any
  });
  const route = (await manager.snapshot()).routes.find((item: any) => item.connection_id === 'builtin:openai');
  assert.ok(route);
  assert.equal(route.health, 'HEALTHY');
  assert.equal(route.model_support_state, 'UNKNOWN');
  assert.equal(route.available, false, 'provider health cannot certify model support');

  service.setPreference('local-only');
  const localOnly = await service.list();
  const gated = localOnly.connections.find((item: any) => item.id === 'builtin:openai');
  assert.ok(gated);
  assert.equal(gated.access.health, 'healthy');
  assert.equal(gated.routing_available, false, 'local-only disables a healthy external connection');
});

test('Model Manager GET is passive and selection policy cannot change execution routing', async () => {
  const workspace = path.join(os.tmpdir(), 'model-manager-read-only-missing-workspace');
  let preferenceWrites = 0;
  const view = createModelManagerView({
    workspace,
    manifestPath: path.join(workspace, 'models', 'manifest.json'),
    modelRuntime: { list: () => [], status: async () => ({ runtime: false, models: [] }) } as any,
    connectionsService: {
      list: async () => ({
        consensus: 'none',
        routed_roles: { plan: 'local', act: 'local', utility: 'local' },
        preference: 'local-first',
        connections: []
      }),
      setPreference: () => { preferenceWrites++; }
    } as any,
    runtimeStatus: async () => ({ backend: 'UNSLOTH', health: 'NOT_INSTALLED' }) as any
  });
  const route = routeForModelManager(view);
  assert.equal(route.method, 'GET');
  assert.equal(route.path, '/api/models/manager');
  assert.equal(route.describeOperation, undefined);
  assert.equal(typeof route.handler, 'function');
  const snapshot = await view.snapshot();
  assert.equal(snapshot.runtime.canonical_runtime_id, 'unsloth');
  assert.equal(snapshot.runtime.default_runtime_id, 'unsloth');
  assert.equal(snapshot.runtime.configured, true);
  assert.equal(snapshot.runtime.discovered_state, 'NOT_DISCOVERED');
  assert.equal(snapshot.runtime.available, false);
  assert.equal(snapshot.selection_policy.persistence_state, 'NOT_PERSISTED');
  assert.equal(snapshot.selection_policy.mutation_enabled, false);
  assert.equal(snapshot.selection_policy.execution_routing_effect, false);
  assert.equal(preferenceWrites, 0);
});

test('local artifact discovery is bounded and never means model readiness', async t => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'model-access-discovery-'));
  const previousModelDirs = process.env.AIDE_MODEL_DIRS;
  process.env.AIDE_MODEL_DIRS = '';
  t.after(() => fs.rm(workspace, { recursive: true, force: true }));
  t.after(() => {
    if (previousModelDirs === undefined) delete process.env.AIDE_MODEL_DIRS;
    else process.env.AIDE_MODEL_DIRS = previousModelDirs;
  });
  await fs.mkdir(path.join(workspace, 'models'), { recursive: true });
  await fs.writeFile(path.join(workspace, 'models', 'unqualified-Q4_K_M.gguf'), 'fixture');
  const view = createModelManagerView({
    workspace,
    manifestPath: path.join(workspace, 'manifest.json'),
    modelRuntime: { list: () => [], status: async () => ({ runtime: false, models: [] }) } as any,
    connectionsService: {
      list: async () => ({
        consensus: 'none',
        routed_roles: { plan: 'local', act: 'local', utility: 'local' },
        preference: 'local-first',
        connections: []
      })
    } as any,
    runtimeStatus: async () => ({ backend: null, health: 'NOT_INSTALLED' }) as any
  });
  const snapshot = await view.snapshot();
  assert.equal(snapshot.local_discovery.discovered_count, 1);
  assert.deepEqual(Object.keys(snapshot.local_discovery).sort(), ['discovered_count', 'error_count', 'scanned_dirs', 'status']);
  const found = snapshot.models[0];
  assert.ok(found);
  assert.equal(found.availability, 'INSTALLED');
  assert.equal(found.readiness, 'SETUP_REQUIRED');
  assert.equal(found.identity.qualification.state, 'UNTESTED');
  assert.equal('entries' in (snapshot.local_discovery as any), false);
});
