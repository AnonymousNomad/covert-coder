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
import { projectRoleTargetOptions } from '../../browser/src/byok/role-target-options.ts';

const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);

test('role assignment options expose only exact verified local models and preserve an unavailable selection', () => {
  const localConnection = {
    id: 'local-runtime', provider_id: 'local', name: 'Local', kind: 'local-runtime',
    status: 'connected', routing_available: true,
    access: { model_refs: [
      { model_id: 'qualified-local', provider_model_id: 'qualified-local', model_support_state: 'verified' },
      { model_id: 'unknown-local', provider_model_id: 'unknown-local', model_support_state: 'unknown' }
    ] }
  } as any;
  const options = projectRoleTargetOptions([], [localConnection], 'local');
  assert.deepEqual(options.map(option => option.target), [
    'local',
    { provider_id: 'local', model_id: 'qualified-local' }
  ]);
  const stale = projectRoleTargetOptions([], [localConnection], { provider_id: 'local', model_id: 'missing-local' });
  assert.equal(stale.length, 3);
  assert.equal(stale[2]?.unavailable, true);
  assert.match(stale[2]?.label ?? '', /not in the current catalog; preserved/);
});

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
        routing: { planner: 'local', coder: 'local', reviewer: 'local', utility: 'local' },
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
        routing: { planner: 'local', coder: { provider_id: secret, model_id: secret }, reviewer: 'local', utility: 'local' },
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
  assert.deepEqual(view.routed_roles.coder, { provider_id: 'redacted', model_id: 'redacted' });
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
      status: () => ({ providers: [], routing: { planner: 'local', coder: 'local', reviewer: 'local', utility: 'local' }, consent_enabled: true }),
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

test('only the exact provider model confirmed by its probe becomes an eligible Model Manager route', async t => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'model-access-exact-provider-model-'));
  t.after(() => fs.rm(workspace, { recursive: true, force: true }));
  const connections = createProviderConnectionsService({
    workspace,
    providerService: {
      list: async () => [{ id: 'openai', name: 'OpenAI', models: ['gpt-4o-mini', 'gpt-4o'], status: 'connected', configured: true }],
      modelSupportState: (_providerId: string, modelId: string) => modelId === 'gpt-4o-mini' ? 'verified' : 'unknown'
    },
    byokService: {
      status: () => ({ providers: [], routing: { planner: 'local', coder: 'local', reviewer: 'local', utility: 'local' }, consent_enabled: true }),
      testProvider: async () => ({ ok: false, detail: 'not configured' })
    },
    modelRuntimeStatus: async () => ({ runtime: false, models: [] }),
    secretStore: { setKey: () => undefined, getKey: () => null, deleteKey: () => true, listProviderIds: () => [] },
    findExecutable: async () => null
  });
  const manager = createModelManagerView({
    workspace,
    manifestPath: path.join(workspace, 'manifest.json'),
    modelRuntime: { list: () => [], status: async () => ({ runtime: false, models: [] }) } as any,
    connectionsService: connections as any,
    runtimeStatus: async () => ({ backend: null, health: 'NOT_INSTALLED' }) as any
  });
  const routes = (await manager.snapshot()).routes.filter(route => route.provider_id === 'openai');
  const verified = routes.find(route => route.provider_model_id === 'gpt-4o-mini');
  const unverified = routes.find(route => route.provider_model_id === 'gpt-4o');
  assert.ok(verified);
  assert.equal(verified.model_support_state, 'VERIFIED');
  assert.equal(verified.available, true);
  assert.ok(unverified);
  assert.equal(unverified.model_support_state, 'UNKNOWN');
  assert.equal(unverified.available, false, 'a sibling model inherits neither support nor availability');
});

test('OpenCode exact target remains UNKNOWN until its Authority-authorized provider/model test succeeds', async t => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'model-access-opencode-exact-'));
  t.after(() => fs.rm(workspace, { recursive: true, force: true }));
  const exactRef = 'opencode-go/deepseek-v4.1-flash';
  const calls: Array<{ providerID: string; modelID: string; prompt: string }> = [];
  const egress: Array<Record<string, unknown>> = [];
  let guardCalls = 0;
  const service = createProviderConnectionsService({
    workspace,
    providerService: { list: async () => [] },
    byokService: {
      status: () => ({
        providers: [],
        routing: { planner: { provider_id: 'opencode', model_id: exactRef }, coder: 'local', reviewer: 'local', utility: 'local' },
        consent_enabled: true
      }),
      testProvider: async () => ({ ok: false, detail: 'not configured' })
    },
    opencodeBridge: {
      runTaskStream: async (options: { providerID: string; modelID: string; prompt: string }) => {
        calls.push({ providerID: options.providerID, modelID: options.modelID, prompt: options.prompt });
        return {
          text: 'OK',
          delegated_provider: options.providerID,
          delegated_model: options.modelID,
          session_id: 'fixture-session',
          server_url: 'http://127.0.0.1:12345',
          duration_ms: 4,
          version: 'fixture'
        };
      }
    },
    assertExternalEgressAllowed: () => { guardCalls++; },
    onEgress: async (entry: Record<string, unknown>) => { egress.push(entry); },
    modelRuntimeStatus: async () => ({ runtime: false, models: [] }),
    secretStore: { setKey: () => undefined, getKey: () => null, deleteKey: () => true, listProviderIds: () => [] },
    findExecutable: async () => null
  });

  const before = await ConnectionsViewResponse.parseAsync(await service.list());
  const pendingConnection = before.connections.find(connection => connection.id === 'opencode-managed');
  assert.ok(pendingConnection);
  assert.equal(pendingConnection.access.model_refs[0]?.provider_model_id, exactRef);
  assert.equal(pendingConnection.access.model_refs[0]?.model_support_state, 'unknown');
  assert.equal(pendingConnection.access.health, 'unknown');
  assert.equal(pendingConnection.routing_available, false);
  assert.deepEqual(calls, [], 'reading Model Access never starts a provider task');

  const manager = createModelManagerView({
    workspace,
    manifestPath: path.join(workspace, 'manifest.json'),
    modelRuntime: { list: () => [], status: async () => ({ runtime: false, models: [] }) } as any,
    connectionsService: service as any,
    runtimeStatus: async () => ({ backend: null, health: 'NOT_INSTALLED' }) as any
  });
  const routeId = 'cloud:opencode:opencode-go/deepseek-v4.1-flash';
  const blocked = (await manager.snapshot()).routes.find(route => route.provider_model_id === exactRef);
  assert.ok(blocked);
  assert.equal(blocked.model_support_state, 'UNKNOWN');
  assert.equal(blocked.available, false);

  const wrongTarget = await service.test('opencode-managed', 'opencode-go/deepseek-v4-flash');
  assert.equal(wrongTarget.ok, false);
  assert.equal(calls.length, 0, 'a model not selected in the role route cannot be probed');
  assert.equal(guardCalls, 0);

  const verified = await service.test('opencode-managed', exactRef);
  assert.deepEqual(verified, { ok: true, detail: 'exact OpenCode Go provider/model identity verified' });
  assert.equal(guardCalls, 1);
  assert.deepEqual(calls, [{ providerID: 'opencode-go', modelID: 'deepseek-v4.1-flash', prompt: 'Reply with exactly: OK' }]);
  assert.equal(egress[0]?.url, 'https://opencode.ai/zen/go/v1/');

  const after = await ConnectionsViewResponse.parseAsync(await service.list());
  const readyConnection = after.connections.find(connection => connection.id === 'opencode-managed');
  assert.ok(readyConnection);
  assert.equal(readyConnection.access.model_refs[0]?.model_support_state, 'verified');
  assert.equal(readyConnection.access.health, 'healthy');
  assert.equal(readyConnection.routing_available, true);
  const verifiedRoute = (await manager.snapshot()).routes.find(route => route.provider_model_id === exactRef);
  assert.ok(verifiedRoute);
  assert.equal(verifiedRoute.execution_adapter_id, 'opencode');
  assert.equal(verifiedRoute.model_support_state, 'VERIFIED');
  assert.equal(verifiedRoute.available, true);
  assert.equal(routeId, `cloud:${verifiedRoute.provider_id}:${verifiedRoute.provider_model_id}`);

  service.setPreference('local-only');
  const localOnly = await service.list();
  const gatedConnection = localOnly.connections.find(connection => connection.id === 'opencode-managed');
  assert.ok(gatedConnection);
  assert.equal(gatedConnection.access.model_refs[0]?.model_support_state, 'verified');
  assert.equal(gatedConnection.routing_available, false, 'Local-Only revokes connection routing despite recent exact model proof');
  const gatedRoute = (await manager.snapshot()).routes.find(route => route.provider_model_id === exactRef);
  assert.equal(gatedRoute?.available, false);
  assert.deepEqual((await manager.externalRoutes()).find(route => route.provider_model_id === exactRef), gatedRoute);

  service.setPreference('local-first');
  assert.equal((await manager.externalRoutes()).find(route => route.provider_model_id === exactRef)?.available, true);
  const expiredAt = Date.now() + 60_001;
  t.mock.method(Date, 'now', () => expiredAt);
  const expiredRoute = (await manager.externalRoutes()).find(route => route.provider_model_id === exactRef);
  assert.equal(expiredRoute?.model_support_state, 'UNKNOWN');
  assert.equal(expiredRoute?.available, false, 'external reads do not retain expired OpenCode exact-model proof');
});

test('external route projection is passive and fresh without unrelated runtime, CLI, catalog or artifact inspection', async t => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'model-access-external-projection-'));
  t.after(() => fs.rm(workspace, { recursive: true, force: true }));
  const manifestPath = path.join(workspace, 'manifest.json');
  await fs.writeFile(manifestPath, '{}');
  let runtimeReads = 0;
  let cliReads = 0;
  let catalogReads = 0;
  let configured = true;
  let consent = true;
  let verified = true;
  let selectedModel = 'gpt-4o-mini';
  const connections = createProviderConnectionsService({
    workspace,
    providerService: {
      list: async () => [{ id: 'openai', name: 'OpenAI', models: ['gpt-4o-mini', 'gpt-4o'], status: configured ? 'connected' : 'not_connected', configured }],
      modelSupportState: (_provider: string, model: string) => verified && model === 'gpt-4o-mini' ? 'verified' : 'unknown'
    },
    byokService: {
      status: () => ({ providers: [], routing: { planner: { provider_id: 'openai', model_id: selectedModel }, coder: 'local', reviewer: 'local', utility: 'local' }, consent_enabled: consent }),
      testProvider: async () => { throw new Error('passive reads cannot probe'); }
    },
    modelRuntimeStatus: async () => { runtimeReads++; return { runtime: false, models: [] }; },
    secretStore: {
      setKey: () => undefined, deleteKey: () => true,
      getKey: () => { throw new Error('passive reads cannot access secrets'); },
      listProviderIds: () => { catalogReads++; return []; }
    },
    findExecutable: async () => { cliReads++; return null; }
  });
  const manager = createModelManagerView({
    workspace, manifestPath, connectionsService: connections,
    modelRuntime: {
      list: () => { runtimeReads++; return []; },
      status: async () => { runtimeReads++; return { runtime: false, models: [] }; }
    },
    runtimeStatus: async () => { runtimeReads++; return { health: 'NOT_INSTALLED' }; }
  });
  const routes = await manager.externalRoutes();
  assert.deepEqual([runtimeReads, cliReads, catalogReads], [0, 0, 0]);
  assert.ok(routes.every(route => route.execution_adapter_id === 'direct-http'));
  const exact = routes.find(route => route.provider_model_id === 'gpt-4o-mini');
  assert.equal(exact?.available, true);
  assert.deepEqual(exact?.selected_roles, ['PLANNING']);
  assert.equal(routes.find(route => route.provider_model_id === 'gpt-4o')?.available, false);
  assert.deepEqual(routes, (await manager.snapshot()).routes.filter(route => route.execution_adapter_id === 'direct-http'));
  assert.ok(runtimeReads > 0 && cliReads > 0 && catalogReads > 0, 'operator snapshot retains complete observation');
  runtimeReads = cliReads = catalogReads = 0;

  verified = false;
  assert.equal((await manager.externalRoutes()).find(route => route.id === exact?.id)?.model_support_state, 'UNKNOWN');
  verified = true;
  configured = false;
  assert.equal((await manager.externalRoutes()).find(route => route.id === exact?.id)?.configured, false);
  assert.equal((await manager.externalRoutes()).find(route => route.id === exact?.id)?.available, false);
  configured = true;
  consent = false;
  assert.equal((await manager.externalRoutes()).find(route => route.id === exact?.id)?.available, false);
  consent = true;
  connections.setPreference('local-only');
  assert.equal((await manager.externalRoutes()).find(route => route.id === exact?.id)?.available, false);
  connections.setPreference('local-first');
  selectedModel = 'gpt-4o';
  assert.deepEqual((await manager.externalRoutes()).find(route => route.id === exact?.id)?.selected_roles, []);
  await fs.writeFile(manifestPath, '{invalid-local-manifest');
  assert.equal((await manager.externalRoutes()).find(route => route.id === exact?.id)?.available, true);
  assert.deepEqual([runtimeReads, cliReads, catalogReads], [0, 0, 0], 'each external resolution stays fresh without unrelated inspection');
  await assert.rejects(manager.snapshot(), SyntaxError, 'full local artifact validation is preserved');
});

test('external route projection fails closed on unavailable or malformed connection truth', async () => {
  const manager = createModelManagerView({
    workspace: '.', manifestPath: 'not-read',
    modelRuntime: { list: () => { throw new Error('not needed'); }, status: async () => { throw new Error('not needed'); } },
    connectionsService: { list: async () => { throw new Error('unavailable'); } }
  });
  assert.deepEqual(await manager.externalRoutes(), []);
  const malformed = createModelManagerView({
    workspace: '.', manifestPath: 'not-read',
    modelRuntime: { list: () => [], status: async () => ({ runtime: false, models: [] }) },
    connectionsService: { list: async () => ({ connections: [{}] }) as any }
  });
  await assert.rejects(malformed.externalRoutes());
});

test('one OpenCode Go catalog exposes multiple models without granting exact route support', async t => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'model-access-opencode-catalog-'));
  t.after(() => fs.rm(workspace, { recursive: true, force: true }));
  let discoveries = 0;
  let prompts = 0;
  const service = createProviderConnectionsService({
    workspace,
    providerService: { list: async () => [] },
    byokService: {
      status: () => ({ providers: [], routing: { planner: 'local', coder: 'local', reviewer: 'local', utility: 'local' }, consent_enabled: true }),
      testProvider: async () => ({ ok: false, detail: 'not configured' })
    },
    opencodeBridge: {
      discoverGoModels: async () => {
        discoveries++;
        return { connected: true, model_ids: ['deepseek-v4.1-flash', 'minimax-m2.5', '../unsafe', 'sk-1234567890123456'] };
      },
      runTaskStream: async () => { prompts++; throw new Error('discovery must not prompt'); }
    },
    modelRuntimeStatus: async () => ({ runtime: false, models: [] }),
    secretStore: { setKey: () => undefined, getKey: () => null, deleteKey: () => true, listProviderIds: () => [] },
    findExecutable: async () => null
  });
  const initial = ConnectionsViewResponse.parse(await service.list());
  assert.equal(initial.connections.find(item => item.id === 'opencode-managed')?.access.model_refs.length, 0);
  assert.equal(discoveries, 0, 'passive reads do not start the local OpenCode server');

  const discovered = await service.discoverOpenCodeModels();
  assert.deepEqual(discovered, {
    ok: true,
    detail: 'OpenCode Go catalog observed; exact model verification is still required',
    model_count: 2
  });
  const connection = ConnectionsViewResponse.parse(await service.list()).connections.find(item => item.id === 'opencode-managed');
  assert.ok(connection);
  assert.equal(connection.status, 'connected', 'OpenCode reports the managed account connected');
  assert.equal(connection.routing_available, false, 'catalog authentication is not exact model support');
  assert.deepEqual(connection.access.model_refs.map(item => item.provider_model_id).sort(), [
    'opencode-go/deepseek-v4.1-flash', 'opencode-go/minimax-m2.5'
  ]);
  assert.ok(connection.access.model_refs.every(item => item.model_support_state === 'unknown'));
  const manager = createModelManagerView({
    workspace,
    manifestPath: path.join(workspace, 'manifest.json'),
    modelRuntime: { list: () => [], status: async () => ({ runtime: false, models: [] }) } as any,
    connectionsService: service as any,
    runtimeStatus: async () => ({ backend: null, health: 'NOT_INSTALLED' }) as any
  });
  const routes = (await manager.snapshot()).routes.filter(route => route.connection_id === 'opencode-managed');
  assert.equal(routes.length, 2);
  assert.ok(routes.every(route => route.model_support_state === 'UNKNOWN' && route.available === false));
  assert.equal(discoveries, 1);
  assert.equal(prompts, 0);
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
        routed_roles: { planner: 'local', coder: 'local', reviewer: 'local', utility: 'local' },
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
        routed_roles: { planner: 'local', coder: 'local', reviewer: 'local', utility: 'local' },
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

test('registered local GGUF imports appear in Model Access without implying qualification or readiness', async t => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'model-access-imported-'));
  t.after(() => fs.rm(workspace, { recursive: true, force: true }));
  const id = 'lfm2.5-2.6b-q4_k_m-fixture';
  const filename = 'LFM2.5-2.6B-Q4_K_M.gguf';
  const missingId = 'lfm-missing-fixture';
  const sourceRevision = 'e7caca5d835a3901a8e0d63e94009429bafafdfc';
  const sourceRepo = 'LiquidAI/LFM2.5-2.6B-GGUF';
  const registered = [
    { id, name: 'registered-display-id', model: filename, file: path.join(workspace, 'private-model-directory', filename), artifact_uri: 'local://' + filename, context_tokens: 32768, sha256: HASH_A, source_repo: sourceRepo, revision: sourceRevision, license: 'other', repository_license: 'lfm1.0', ingested: true },
    { id: missingId, name: 'missing-display-id', model: 'missing.gguf', file: path.join(workspace, 'private-model-directory', 'missing.gguf'), artifact_uri: 'local://missing.gguf', ingested: true }
  ];
  const view = createModelManagerView({
    workspace,
    manifestPath: path.join(workspace, 'manifest.json'),
    modelRuntime: {
      list: () => registered,
      status: async () => ({ runtime: true, models: [
        { id, status: 'ready', artifact_available: true, runtime_available: true, qualification: 'requires_start_preflight' },
        { id: missingId, status: 'pending', artifact_available: false, runtime_available: true, qualification: 'requires_start_preflight' }
      ] })
    } as any,
    connectionsService: {
      list: async () => ({ consensus: 'none', routed_roles: { planner: 'local', coder: 'local', reviewer: 'local', utility: 'local' }, preference: 'local-first', connections: [] })
    } as any,
    runtimeStatus: async () => ({ backend: 'LLAMA_CPP', health: 'UNKNOWN' }) as any
  });
  const snapshot = await view.snapshot();
  const model = snapshot.models.find(item => item.identity.canonical_id === id);
  const artifact = snapshot.artifacts.find(item => item.model_id === id);
  assert.ok(model);
  assert.ok(artifact);
  assert.equal(model.identity.display_name, filename);
  assert.equal(model.availability, 'INSTALLED');
  assert.equal(model.readiness, 'SETUP_REQUIRED');
  assert.equal(model.identity.qualification.state, 'REQUIRES_PREFLIGHT');
  assert.equal(artifact.source_kind, 'LOCAL_IMPORT');
  assert.equal(artifact.filename, filename);
  assert.equal(artifact.format, 'GGUF');
  assert.equal(artifact.availability, 'INSTALLED');
  assert.equal(artifact.expected_sha256, HASH_A);
  assert.equal(artifact.source_ref, sourceRepo);
  assert.equal(artifact.revision, sourceRevision);
  assert.equal(artifact.license, 'other');
  assert.equal(artifact.repository_license, 'lfm1.0');
  assert.equal(artifact.hash_status, 'EXPECTED');
  assert.equal(artifact.observed_sha256, null);
  const missing = snapshot.models.find(item => item.identity.canonical_id === missingId);
  const missingArtifact = snapshot.artifacts.find(item => item.model_id === missingId);
  assert.ok(missing);
  assert.ok(missingArtifact);
  assert.equal(missing.availability, 'UNAVAILABLE');
  assert.equal(missingArtifact.availability, 'UNAVAILABLE');
  assert.equal(missing.identity.qualification.state, 'REQUIRES_PREFLIGHT');
  assert.equal(JSON.stringify(snapshot).includes(workspace), false, 'private local artifact paths must not be projected');
});
