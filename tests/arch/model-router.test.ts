import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ChatTargetChangedError, ModelRouter, RouterError } from '../../node/src/services/model-router.ts';
import type { ModelRuntime } from '../../node/src/services/model-runtime.ts';
import type { ProviderDefinition, ProviderService } from '../../node/src/services/providers.ts';
import type { ModelProviderRouteT } from '../../common/contracts/model-access.ts';

interface FakeEntry {
  id: string;
  name: string;
  status: string;
  roles: string[];
  endpoint: string;
  model: string;
  artifact_uri: string;
  file: string;
  context_tokens: number;
}

class FakeRuntime {
  entries: FakeEntry[] = [];
  ready = new Set<string>();
  statusCalls = 0;
  verifyCalls = 0;
  chatCalls = 0;
  chatStreamCalls = 0;

  status(): { runtime: boolean; models: Array<Record<string, unknown>> } {
    this.statusCalls += 1;
    return {
      runtime: true,
      models: this.entries.map(entry => ({
        id: entry.id,
        name: entry.name,
        status: this.ready.has(entry.id) ? 'running' : entry.status,
        endpoint: entry.endpoint
      }))
    };
  }

  list(): FakeEntry[] {
    return this.entries;
  }

  async verifyEndpointModel(id: string): Promise<{ ready: boolean }> {
    this.verifyCalls += 1;
    return { ready: this.ready.has(id) };
  }

  servedWindow: number | null = null;

  // Mirrors ModelRuntime.getEffectiveBudget: null until a served window has
  // been probed, otherwise effective window minus the completion reserve.
  getEffectiveBudget(id: string, reserveTokens: number): number | null {
    const entry = this.entries.find(candidate => candidate.id === id);
    if (entry === undefined || !this.ready.has(id)) return null;
    const window = this.servedWindow ?? entry.context_tokens;
    const budget = Math.floor(window - reserveTokens);
    return budget > 0 ? budget : null;
  }

  async chat(id: string, messages: Array<{ role: string; content: string }>): Promise<{ text: string; modelId: string; timingMs: number }> {
    this.chatCalls += 1;
    return { text: `local:${id}:${messages.length}`, modelId: id, timingMs: 1 };
  }

  async chatStream(id: string, messages: Array<{ role: string; content: string }>, onDelta: (delta: string) => void): Promise<void> {
    this.chatStreamCalls += 1;
    onDelta(`stream:${id}:${messages.length}`);
  }
}

class FakeProviders {
  connected = new Set<string>();
  listCalls = 0;
  calls: Array<{ providerId: string; model: string }> = [];
  streamCalls: Array<{ providerId: string; model: string; signal?: AbortSignal }> = [];

  async list(): Promise<Array<{ id: string; status: string }>> {
    this.listCalls += 1;
    return [...this.connected].map(id => ({ id, status: 'connected' }));
  }

  async chat(providerId: string, model: string, messages: Array<{ role: string; content: string }>): Promise<{ text: string; modelId: string; timingMs: number }> {
    this.calls.push({ providerId, model });
    return { text: `cloud:${providerId}:${model}:${messages.length}`, modelId: `${providerId}:${model}`, timingMs: 2 };
  }

  async chatStream(
    providerId: string,
    model: string,
    messages: Array<{ role: string; content: string }>,
    onDelta: (delta: string) => void,
    options: { signal?: AbortSignal } = {}
  ): Promise<{ text: string; modelId: string; timingMs: number }> {
    const call: { providerId: string; model: string; signal?: AbortSignal } = { providerId, model };
    if (options.signal !== undefined) call.signal = options.signal;
    this.streamCalls.push(call);
    const first = `cloud:${providerId}:`;
    const second = `${model}:${messages.length}`;
    onDelta(first);
    onDelta(second);
    return { text: first + second, modelId: `${providerId}:${model}`, timingMs: 3 };
  }
}

function providerModelRoute(providerId = 'openai', providerModelId = 'gpt-4o-mini', overrides: Partial<ModelProviderRouteT> = {}): ModelProviderRouteT {
  return {
    id: `route:builtin:${providerId}:${providerModelId}:direct-http`,
    model_id: `provider:${providerId}:${providerModelId}`,
    provider_id: providerId,
    connection_id: `builtin:${providerId}`,
    provider_model_id: providerModelId,
    credential_source_id: `credential-source:provider:${providerId}`,
    execution_adapter_id: 'direct-http',
    model_support_state: 'VERIFIED',
    configured: true,
    health: 'HEALTHY',
    available: true,
    external_egress_required: true,
    operator_setup_required: false,
    setup_state: 'READY',
    selected_roles: ['chat'],
    ...overrides
  };
}

function makeRouter(
  runtime: FakeRuntime,
  providers: FakeProviders,
  catalog?: readonly ProviderDefinition[],
  providerRoutes: readonly ModelProviderRouteT[] = []
): ModelRouter {
  return new ModelRouter(runtime as unknown as ModelRuntime, providers as unknown as ProviderService, catalog, async () => providerRoutes);
}

function entry(id: string, status: string, roles: string[], contextTokens = 2048): FakeEntry {
  return { id, name: `Model ${id}`, status, roles, endpoint: `http://127.0.0.1:8080/v1`, model: `${id}.gguf`, artifact_uri: `local://${id}.gguf`, file: `E:\\models\\${id}.gguf`, context_tokens: contextTokens };
}

test('routes() lists local entries and only connected cloud providers', async () => {
  const runtime = new FakeRuntime();
  runtime.entries = [entry('a', 'ready', ['chat']), entry('b', 'pending', ['chat'])];
  const providers = new FakeProviders();
  providers.connected.add('openai');
  const router = makeRouter(runtime, providers);
  const routes = await router.routes();
  const local = routes.filter(route => route.providerType === 'local');
  assert.equal(local.length, 2);
  assert.equal(local[0]!.id, 'local:a');
  assert.equal(local[0]!.chatTemplate, 'gguf-metadata');
  assert.equal(local[0]!.contextLength, 2048);
  const cloud = routes.filter(route => route.providerType === 'cloud');
  assert.ok(cloud.some(route => route.id === 'cloud:openai:gpt-4o-mini'), 'connected provider exposes its model routes');
  assert.ok(cloud.some(route => route.id.startsWith('cloud:anthropic:')), 'full catalog is listed for the picker');
  assert.ok(cloud.filter(route => route.id.startsWith('cloud:anthropic:')).every(route => route.status === 'down'), 'disconnected providers are marked down, not ready');
});

test('unstarted local models are unverified, not down', async () => {
  const runtime = new FakeRuntime();
  runtime.entries = [entry('a', 'ready', ['chat'])];
  const router = makeRouter(runtime, new FakeProviders());
  const routes = await router.routes();
  const local = routes.find(route => route.id === 'local:a')!;
  assert.equal(local.status, 'unverified', 'declared ready but not running');
});

test('routeForRole returns the first ready model and reports a fallback when the first is down', async () => {
  const runtime = new FakeRuntime();
  runtime.entries = [entry('a', 'ready', ['chat']), entry('b', 'ready', ['chat'])];
  runtime.ready.add('b');
  const router = makeRouter(runtime, new FakeProviders());
  const selection = await router.routeForRole('chat');
  assert.equal(selection.modelId, 'local:b', 'a is down so b answers');
  assert.equal(selection.fellBack?.from, 'local:a');
  assert.equal(selection.fellBack?.to, 'local:b');
  assert.equal(selection.fellBack?.reason, 'down');
});

test('routeForRole throws with guidance when nothing is ready', async () => {
  const runtime = new FakeRuntime();
  runtime.entries = [entry('a', 'ready', ['chat'])];
  const router = makeRouter(runtime, new FakeProviders());
  await assert.rejects(
    () => router.routeForRole('chat'),
    (error: unknown) => error instanceof RouterError && error.reason === 'down' && error.message.includes('start this model')
  );
});

test('routeForId falls back to the role chain with an explicit from/to', async () => {
  const runtime = new FakeRuntime();
  runtime.entries = [entry('a', 'ready', ['chat']), entry('b', 'ready', ['chat'])];
  runtime.ready.add('b');
  const router = makeRouter(runtime, new FakeProviders());
  const selection = await router.routeForId('local:a');
  assert.equal(selection.modelId, 'local:b');
  assert.equal(selection.fellBack?.from, 'local:a');
  assert.equal(selection.fellBack?.reason, 'down');
});

test('routeForId resolves a ready explicit binding without fallback', async () => {
  const runtime = new FakeRuntime();
  runtime.entries = [entry('a', 'ready', ['chat'])];
  runtime.ready.add('a');
  const router = makeRouter(runtime, new FakeProviders());
  const selection = await router.routeForId('local:a');
  assert.equal(selection.modelId, 'local:a');
  assert.equal(selection.fellBack, undefined);
});

test('chat fits history to the route context and reports the estimate', async () => {
  const runtime = new FakeRuntime();
  runtime.entries = [entry('a', 'ready', ['chat'], 1024)];
  runtime.ready.add('a');
  const router = makeRouter(runtime, new FakeProviders());
  const long = 'x'.repeat(200);
  const result = await router.chat('local:a', [
    { role: 'user', content: 'q1' },
    { role: 'assistant', content: 'a1' },
    { role: 'user', content: long }
  ]);
  assert.ok(result.text.startsWith('local:a:'), 'executed against the local runtime');
  assert.equal(result.modelId, 'local:a');
  assert.ok(result.usedApprox > 0, 'context estimate is reported');
});

test('unbound cloud chat cannot bypass the Authority-resolved provider route', async () => {
  const runtime = new FakeRuntime();
  runtime.entries = [entry('a', 'ready', ['chat'])];
  const providers = new FakeProviders();
  providers.connected.add('openai');
  const router = makeRouter(runtime, providers, undefined, [providerModelRoute()]);
  await assert.rejects(
    () => router.chat('cloud:openai:gpt-4o-mini', [{ role: 'user', content: 'hi' }]),
    (error: unknown) => error instanceof RouterError && error.reason === 'unsupported' && error.message.includes('Authority-resolved')
  );
  assert.deepEqual(providers.calls, [], 'generic chat cannot dispatch an external route outside the Authority-bound surface');
});

test('chatStream emits deltas and reports the answering model on fallback', async () => {
  const runtime = new FakeRuntime();
  runtime.entries = [entry('a', 'ready', ['chat']), entry('b', 'ready', ['chat'])];
  runtime.ready.add('b');
  const router = makeRouter(runtime, new FakeProviders());
  const deltas: string[] = [];
  const result = await router.chatStream('local:a', [{ role: 'user', content: 'hi' }], delta => deltas.push(delta), new AbortController().signal);
  assert.deepEqual(deltas, ['stream:b:1'], 'streamed from the fallback model');
  assert.equal(result.modelId, 'local:b');
test('chat fits history against the effective served window, not the declared context', async () => {
  // Declared 8192, engine serves 1024 (clamped n_ctx). Without effective
  // fitting the router would send the full history and the engine would
  // reject it with HTTP 400 (audit failures C1/D1, 2026-08-28).
  const runtime = new FakeRuntime();
  runtime.entries = [entry('a', 'ready', ['chat'], 8192)];
  runtime.ready.add('a');
  runtime.servedWindow = 1024;
  const router = makeRouter(runtime, new FakeProviders());
  const result = await router.chat('local:a', [
    { role: 'user', content: 'q1' },
    { role: 'assistant', content: 'y'.repeat(30000) },
    { role: 'user', content: 'keep this question' }
  ]);
  assert.equal(result.modelId, 'local:a');
  assert.ok(result.usedApprox <= (1024 - 512) + 8, 'history fit inside the effective window budget');
});

test('overflowTrimmed is set when the newest turn alone exceeds the budget', async () => {
  const runtime = new FakeRuntime();
  runtime.entries = [entry('a', 'ready', ['chat'], 8192)];
  runtime.ready.add('a');
  runtime.servedWindow = 1024;
  const router = makeRouter(runtime, new FakeProviders());
  const result = await router.chat('local:a', [
    { role: 'user', content: 'z'.repeat(12000) }
  ]);
  assert.equal(result.overflowTrimmed, true, 'oversized newest turn is head-trimmed, not hard-failed');
  assert.ok(result.usedApprox <= 512 + 8);
});

test('declared context is used when no served window has been probed', async () => {
  const runtime = new FakeRuntime();
  runtime.entries = [entry('a', 'ready', ['chat'], 2048)];
  runtime.ready.add('a');
  const router = makeRouter(runtime, new FakeProviders());
  const result = await router.chat('local:a', [{ role: 'user', content: 'hi' }]);
  assert.equal(result.overflowTrimmed, undefined);
  assert.ok(result.text.startsWith('local:a:'));
});
});

test('unbound cloud streaming cannot bypass the Authority-resolved provider route', async () => {
  const runtime = new FakeRuntime();
  const providers = new FakeProviders();
  providers.connected.add('openai');
  const router = makeRouter(runtime, providers, undefined, [providerModelRoute()]);
  const controller = new AbortController();
  await assert.rejects(
    () => router.chatStream('cloud:openai:gpt-4o-mini', [{ role: 'user', content: 'hello' }], () => {}, controller.signal),
    (error: unknown) => error instanceof RouterError && error.reason === 'unsupported' && error.message.includes('Authority-resolved')
  );
  assert.deepEqual(providers.streamCalls, [], 'generic streaming cannot dispatch an external route outside Authority');
  assert.deepEqual(providers.calls, [], 'streaming does not fall back to one-shot provider chat');
});

test('Authority-resolved cloud streaming uses the bound provider adapter and caller signal', async () => {
  const runtime = new FakeRuntime();
  const providers = new FakeProviders();
  const router = makeRouter(runtime, providers, undefined, [providerModelRoute()]);
  const resolution = await router.resolveAuthorityTarget('cloud:openai:gpt-4o-mini');
  assert.equal(resolution.status, 'RESOLVED');
  if (resolution.status !== 'RESOLVED') return;

  const controller = new AbortController();
  const deltas: string[] = [];
  const result = await router.chatStreamResolvedTarget(
    resolution.target,
    [{ role: 'user', content: 'governed request' }],
    delta => deltas.push(delta),
    controller.signal
  );
  assert.deepEqual(deltas, ['cloud:openai:', 'gpt-4o-mini:1']);
  assert.equal(result.modelId, 'cloud:openai:gpt-4o-mini');
  assert.equal(providers.streamCalls[0]?.signal, controller.signal);
  assert.equal(runtime.chatStreamCalls, 0, 'external Authority binding never enters the local runtime');
});

test('chat throws RouterError down when the route is unknown', async () => {
  const runtime = new FakeRuntime();
  const router = makeRouter(runtime, new FakeProviders());
  await assert.rejects(
    () => router.chat('local:nope', [{ role: 'user', content: 'hi' }]),
    (error: unknown) => error instanceof RouterError && error.reason === 'down'
  );
});

test('Authority target resolution is read-only and classifies only registered local artifacts', async () => {
  const runtime = new FakeRuntime();
  runtime.entries = [entry('fixture', 'ready', ['chat'])];
  const providers = new FakeProviders();
  const router = makeRouter(runtime, providers);

  const resolution = await router.resolveAuthorityTarget('local:fixture');
  assert.equal(resolution.status, 'RESOLVED');
  if (resolution.status !== 'RESOLVED') return;
  assert.equal(resolution.target.binding.execution_class, 'LOCAL');
  assert.equal(resolution.target.binding.source, 'model-runtime');
  assert.equal(resolution.target.binding.route_id, 'local:fixture');
  assert.equal(runtime.statusCalls, 0, 'classification does not check runtime health');
  assert.equal(runtime.verifyCalls, 0, 'classification does not probe a local endpoint');
  assert.equal(providers.listCalls, 0, 'classification does not inspect provider connectivity');
  assert.ok(!JSON.stringify(resolution.target.binding).includes('E:\\models'), 'private artifact path is not exposed');

  runtime.entries[0]!.endpoint = 'https://api.openai.com/v1';
  const disguised = await router.resolveAuthorityTarget('local:fixture');
  assert.deepEqual(disguised, { status: 'UNKNOWN', reason: 'local-source-not-contained' },
    'a local registry label cannot authorize a non-loopback endpoint');

  runtime.entries[0]!.endpoint = 'http://127.0.0.1:8080/v1';
  runtime.entries[0]!.artifact_uri = 'https://models.example/fixture.gguf';
  const loopbackOnly = await router.resolveAuthorityTarget('local:fixture');
  assert.deepEqual(loopbackOnly, { status: 'UNKNOWN', reason: 'local-source-not-contained' },
    'a localhost runtime alone does not establish local artifact provenance');
});

test('provider identity wins over a local-looking model label', async () => {
  const runtime = new FakeRuntime();
  const providers = new FakeProviders();
  const catalog: readonly ProviderDefinition[] = [{
    id: 'openai',
    name: 'Local GGUF Mirror',
    kind: 'openai-compatible',
    baseUrl: 'https://api.openai.com/v1',
    models: ['local-gguf-q4'],
    contextLength: 4096,
    egressHost: 'api.openai.com'
  }];
  const router = makeRouter(runtime, providers, catalog, [providerModelRoute('openai', 'local-gguf-q4')]);
  const resolution = await router.resolveAuthorityTarget('cloud:openai:local-gguf-q4');
  assert.equal(resolution.status, 'RESOLVED');
  if (resolution.status !== 'RESOLVED') return;
  assert.equal(resolution.target.binding.execution_class, 'EXTERNAL');
  assert.equal(resolution.target.binding.source, 'provider-service');
  assert.equal(resolution.target.binding.provider_id, 'openai');
  assert.equal(resolution.target.binding.provider_model, 'local-gguf-q4');
  assert.equal(resolution.target.binding.model_access_route_id, 'route:builtin:openai:local-gguf-q4:direct-http');
  assert.equal(resolution.target.binding.connection_id, 'builtin:openai');
  assert.equal(resolution.target.binding.execution_adapter_id, 'direct-http');

  await router.chatResolvedTarget(resolution.target, [{ role: 'user', content: 'fixture' }]);
  assert.equal(runtime.chatCalls, 0);
  assert.deepEqual(providers.calls, [{ providerId: 'openai', model: 'local-gguf-q4' }]);
});

test('external Authority resolution requires the exact verified, available, consent-ready model route', async () => {
  const runtime = new FakeRuntime();
  const providers = new FakeProviders();
  const routeId = 'cloud:openai:gpt-4o-mini';
  const ineligibleStates: Array<Partial<ModelProviderRouteT>> = [
    { model_support_state: 'UNKNOWN' },
    { model_support_state: 'UNSUPPORTED' },
    { available: false },
    { configured: false },
    { health: 'UNKNOWN' },
    { external_egress_required: false },
    { operator_setup_required: true },
    { setup_state: 'CONSENT_REQUIRED' },
    { credential_source_id: null },
    { execution_adapter_id: 'opencode' }
  ];
  for (const state of ineligibleStates) {
    const router = makeRouter(runtime, providers, undefined, [providerModelRoute('openai', 'gpt-4o-mini', state)]);
    assert.deepEqual(await router.resolveAuthorityTarget(routeId), {
      status: 'UNKNOWN', reason: 'provider-model-route-ineligible'
    });
  }
  const duplicated = makeRouter(runtime, providers, undefined, [providerModelRoute(), providerModelRoute()]);
  assert.deepEqual(await duplicated.resolveAuthorityTarget(routeId), {
    status: 'UNKNOWN', reason: 'provider-model-route-ineligible'
  }, 'ambiguous duplicate provider/model/adapter identities fail closed');
  assert.deepEqual(providers.calls, []);
  assert.deepEqual(providers.streamCalls, []);
});

test('Authority-bound external stream rechecks exact route availability immediately before dispatch', async () => {
  const runtime = new FakeRuntime();
  const providers = new FakeProviders();
  const eligible = providerModelRoute();
  const router = makeRouter(runtime, providers, undefined, [eligible]);
  const resolution = await router.resolveAuthorityTarget('cloud:openai:gpt-4o-mini');
  assert.equal(resolution.status, 'RESOLVED');
  if (resolution.status !== 'RESOLVED') return;

  eligible.available = false;
  await assert.rejects(
    () => router.chatStreamResolvedTarget(resolution.target, [{ role: 'user', content: 'revoked' }], () => {}, new AbortController().signal),
    ChatTargetChangedError
  );
  assert.deepEqual(providers.streamCalls, [], 'revoked exact route never reaches provider transport');
});

test('Authority-bound external stream preserves caller cancellation and never reports a cancelled completion', async () => {
  const runtime = new FakeRuntime();
  const providers = new FakeProviders();
  let started!: () => void;
  const dispatchStarted = new Promise<void>(resolve => { started = resolve; });
  providers.chatStream = async (providerId, model, _messages, _onDelta, options = {}) => {
    const call: { providerId: string; model: string; signal?: AbortSignal } = { providerId, model };
    if (options.signal !== undefined) call.signal = options.signal;
    providers.streamCalls.push(call);
    started();
    return await new Promise<{ text: string; modelId: string; timingMs: number }>((_resolve, reject) => {
      if (options.signal?.aborted) reject(options.signal.reason);
      else options.signal?.addEventListener('abort', () => reject(options.signal?.reason), { once: true });
    });
  };
  const router = makeRouter(runtime, providers, undefined, [providerModelRoute()]);
  const resolution = await router.resolveAuthorityTarget('cloud:openai:gpt-4o-mini');
  assert.equal(resolution.status, 'RESOLVED');
  if (resolution.status !== 'RESOLVED') return;
  const controller = new AbortController();
  const pending = router.chatStreamResolvedTarget(
    resolution.target,
    [{ role: 'user', content: 'cancel this request' }],
    () => {},
    controller.signal
  );
  await dispatchStarted;
  controller.abort(new DOMException('caller cancelled', 'AbortError'));
  await assert.rejects(pending, error => error instanceof Error && error.name === 'AbortError');
  assert.equal(providers.streamCalls[0]?.signal, controller.signal);
});

test('dispatch refuses a local target whose registered destination changed after resolution', async () => {
  const runtime = new FakeRuntime();
  runtime.entries = [entry('fixture', 'ready', ['chat'])];
  const providers = new FakeProviders();
  const router = makeRouter(runtime, providers);
  const resolution = await router.resolveAuthorityTarget('local:fixture');
  assert.equal(resolution.status, 'RESOLVED');
  if (resolution.status !== 'RESOLVED') return;

  runtime.entries[0]!.endpoint = 'http://127.0.0.1:8181/v1';
  await assert.rejects(
    () => router.chatResolvedTarget(resolution.target, [{ role: 'user', content: 'fixture' }]),
    ChatTargetChangedError
  );
  assert.equal(runtime.chatCalls, 0, 'changed target is rejected before runtime dispatch');
});
