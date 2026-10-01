import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import fsSync from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { ArchServer } from '../../node/src/server.ts';
import { buildRoutes, createModelRuntime, type BuildRoutesOptions } from '../../node/src/openapi.ts';
import { CredentialStore, type CryptService } from '../../node/src/services/credentials.ts';
import { createSecretStore } from '../../node/src/services/secret-store.mjs';
import { ProviderService } from '../../node/src/services/providers.ts';
import type { ModelProviderRouteT } from '../../common/contracts/model-access.ts';
import { pairFixture, fixtureFailureDescription } from './authority-fixture.ts';
import { fixtureBridge, readLog } from './opencode-bridge-fixture.ts';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PROVIDER_KEY = 'fixture-provider-key-never-used-on-the-network';
const PROVIDER_MODEL = 'gpt-4o-mini';
const CHAT_MODEL_ID = `cloud:openai:${PROVIDER_MODEL}`;
const OPENCODE_PROVIDER_MODEL = 'opencode-go/deepseek-v4.1-flash';
const OPENCODE_CHAT_MODEL_ID = `cloud:opencode:${OPENCODE_PROVIDER_MODEL}`;
const encoder = new TextEncoder();

class FixtureCrypt implements CryptService {
  readonly kind = 'fixture';
  async available(): Promise<boolean> { return true; }
  async protect(value: string): Promise<string> { return `fixture:${Buffer.from(value, 'utf8').toString('base64')}`; }
  async unprotect(value: string): Promise<string> {
    if (!value.startsWith('fixture:')) throw new Error('invalid fixture credential');
    return Buffer.from(value.slice('fixture:'.length), 'base64').toString('utf8');
  }
}

type TransportState = {
  prompt: string;
  model: string;
  streaming: boolean;
  upstreamAborted: boolean;
  transportClosed: boolean;
  bodyCancelled: boolean;
};

function lastUserMessage(body: Record<string, unknown>): string {
  const messages = Array.isArray(body.messages) ? body.messages as Array<{ role?: unknown; content?: unknown }> : [];
  const user = [...messages].reverse().find(message => message.role === 'user');
  return typeof user?.content === 'string' ? user.content : '';
}

function receiptTarget(value: unknown): Record<string, unknown> {
  assert.ok(value !== null && typeof value === 'object');
  const target = (value as { args?: { chat_target?: unknown } }).args?.chat_target;
  assert.ok(target !== null && typeof target === 'object');
  return target as Record<string, unknown>;
}

function assertExactTarget(target: Record<string, unknown>): void {
  assert.equal(target.execution_class, 'EXTERNAL');
  assert.equal(target.provider_id, 'openai');
  assert.equal(target.provider_model, PROVIDER_MODEL);
  assert.equal(target.model_access_route_id, `route:builtin:openai:${PROVIDER_MODEL}:direct-http`);
  assert.equal(target.canonical_model_id, `provider:openai:${PROVIDER_MODEL}`);
  assert.equal(target.connection_id, 'builtin:openai');
  assert.equal(target.credential_source_id, 'credential-source:provider:openai');
  assert.equal(target.execution_adapter_id, 'direct-http');
  assert.equal(target.egress_host, 'api.openai.com');
  assert.ok(typeof target.target_revision === 'string' && target.target_revision.length > 0);
  assert.ok(!JSON.stringify(target).includes(PROVIDER_KEY));
}

function assertExactOpenCodeTarget(target: Record<string, unknown>): void {
  assert.equal(target.execution_class, 'EXTERNAL');
  assert.equal(target.provider_id, 'opencode');
  assert.equal(target.provider_model, OPENCODE_PROVIDER_MODEL);
  assert.equal(target.model_access_route_id, `route:opencode-managed:${OPENCODE_PROVIDER_MODEL}:opencode`);
  assert.equal(target.canonical_model_id, 'provider:opencode:opencode-go/deepseek-v4.1-flash');
  assert.equal(target.connection_id, 'opencode-managed');
  assert.equal(target.credential_source_id, 'credential-source:opencode-managed');
  assert.equal(target.execution_adapter_id, 'opencode');
  assert.equal(target.egress_host, 'opencode.ai');
  assert.ok(typeof target.target_revision === 'string' && target.target_revision.length > 0);
}

function fixtureFetch(states: TransportState[]): typeof fetch {
  return (async (_url: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    if (headers.get('authorization') !== `Bearer ${PROVIDER_KEY}`) return new Response(null, { status: 401 });
    const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
    const prompt = lastUserMessage(body);
    const model = String(body.model ?? '');
    const streaming = body.stream === true;
    if (!streaming) {
      const content = prompt === 'ping' ? 'probe verified' : `returned:${prompt}`;
      return Response.json({ choices: [{ message: { content }, finish_reason: 'stop' }] });
    }

    const state: TransportState = {
      prompt,
      model,
      streaming,
      upstreamAborted: false,
      transportClosed: false,
      bodyCancelled: false
    };
    states.push(state);
    const signal = init?.signal;
    const partial = `data: ${JSON.stringify({ choices: [{ delta: { content: `partial:${prompt}` } }] })}\n\n`;
    const finish = `data: ${JSON.stringify({ choices: [{ delta: { content: `streamed:${prompt}` } }] })}\n\ndata: [DONE]\n\n`;
    const error = `data: ${JSON.stringify({ error: { message: 'fixture provider internal detail' } })}\n\n`;
    const held = prompt === 'cancel path' || prompt === 'timeout path';
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(held || prompt === 'error path' ? partial : finish));
        if (prompt === 'error path') {
          controller.enqueue(encoder.encode(error));
        } else if (!held) {
          controller.close();
        }
        if (held && signal != null) {
          signal.addEventListener('abort', () => {
            state.upstreamAborted = true;
            state.transportClosed = true;
            try { controller.error(signal.reason); } catch { /* the consumer already closed */ }
          }, { once: true });
        }
      },
      cancel() { state.bodyCancelled = true; }
    });
    return new Response(stream, { headers: { 'content-type': 'text/event-stream' } });
  }) as typeof fetch;
}

async function waitFor(predicate: () => boolean, description: string, timeoutMs = 3000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  assert.fail(`timed out waiting for ${description}`);
}

async function waitForAsync(predicate: () => Promise<boolean>, description: string, timeoutMs = 3000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  assert.fail('timed out waiting for ' + description);
}
async function removeFixtureWorkspace(workspace: string): Promise<void> {
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      await fs.rm(workspace, { recursive: true, force: true });
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code ?? '';
      if (!['EBUSY', 'ENOTEMPTY', 'EPERM'].includes(code) || attempt === 9) throw error;
      await new Promise(resolve => setTimeout(resolve, 250));
    }
  }
}

async function startStack(
  workspace: string,
  states: TransportState[],
  openCodeBridge?: BuildRoutesOptions['openCodeBridge']
) {
  const arch = new ArchServer(workspace, path.join(workspace, '.aide', `provider-lifecycle-${Date.now()}.log`));
  const modelRuntime = await createModelRuntime(REPO_ROOT, workspace, { events: arch.events, logger: arch.logger });
  const providerService = new ProviderService(workspace, {
    credentials: new CredentialStore(workspace, new FixtureCrypt()),
    assertExternalEgressAllowed: () => arch.authority.assertExternalEgressAllowed(),
    fetchFn: fixtureFetch(states),
    requestTimeoutMs: 500,
    logger: arch.logger
  });
  const routes = await buildRoutes(workspace, 'test', {
    authority: arch.authority,
    events: arch.events,
    logger: arch.logger,
    modelRuntime,
    providerService,
    byokSecretStore: createSecretStore({
      secretsPath: path.join(workspace, '.aide', 'fixture-byok-secrets.json'),
      protect: value => `fixture:${Buffer.from(value, 'utf8').toString('base64')}`,
      unprotect: value => {
        if (!value.startsWith('fixture:')) throw new Error('invalid fixture BYOK credential');
        return Buffer.from(value.slice('fixture:'.length), 'base64').toString('utf8');
      }
    }),
    ...(openCodeBridge === undefined ? {} : { openCodeBridge })
  });
  for (const route of routes) arch.route(route);
  const httpServer = await arch.listen(0);
  const address = httpServer.address();
  assert.ok(address && typeof address === 'object');
  const base = `http://127.0.0.1:${address.port}`;
  const owner = await pairFixture(arch, base);
  return {
    arch,
    httpServer,
    base,
    owner,
    async close() {
      httpServer.closeAllConnections();
      await new Promise<void>(resolve => httpServer.close(() => resolve()));
      arch.events.close();
      arch.authority.control.close();
      await arch.logger.flush();
    }
  };
}

async function operationReceipt(owner: Awaited<ReturnType<typeof pairFixture>>, operationId: string) {
  const response = await owner.request(`/api/authority/operation?id=${encodeURIComponent(operationId)}`);
  assert.equal(response.status, 200);
  const envelope = await response.json() as { data: Record<string, unknown> };
  return envelope.data;
}

async function prepareAndApprove(
  owner: Awaited<ReturnType<typeof pairFixture>>,
  method: string,
  route: string,
  body: unknown,
  taskId: string
) {
  const operation = await owner.propose(method, route, body, taskId);
  const before = await operationReceipt(owner, operation.operation_id);
  const decision = await owner.decide(operation.operation_id, 'approve');
  const envelope = await decision.json() as { ok: boolean };
  assert.equal(decision.status, 200, `decision ${fixtureFailureDescription(envelope)}`);
  assert.equal(envelope.ok, true);
  return { operationId: operation.operation_id, before };
}

test('provider lifecycle fixture excludes the operator global BYOK store', async t => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'aide-provider-global-store-'));
  const globalPath = path.resolve(os.homedir(), '.aide', 'secrets.json');
  const canary = 'fixture-global-store-key-never-used-on-network';
  let hostReads = 0;
  const readFile = fsSync.readFileSync;
  t.mock.method(fsSync, 'readFileSync', ((...args: Parameters<typeof readFile>) => {
    if (typeof args[0] === 'string' && path.resolve(args[0]) === globalPath) {
      hostReads += 1;
      return JSON.stringify({ huggingface: `plain:${canary}` });
    }
    return Reflect.apply(readFile, fsSync, args) as ReturnType<typeof readFile>;
  }) as typeof readFile);
  syncBuiltinESMExports();
  let stack: Awaited<ReturnType<typeof startStack>> | undefined;
  try {
    stack = await startStack(workspace, []);
    const manager = await stack.owner.request('/api/models/manager');
    assert.equal(manager.status, 200);
    const text = await manager.text();
    assert.equal(text.includes(canary), false, 'Model Access never serializes credential material');
    assert.equal(hostReads, 0, 'a synthetic provider fixture must not inherit the operator secret store');
  } finally {
    try { if (stack !== undefined) await stack.close(); }
    finally { t.mock.restoreAll(); syncBuiltinESMExports(); await removeFixtureWorkspace(workspace); }
  }
});

test('production provider route is governed end to end and recovers only after exact re-verification on restart', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'aide-provider-route-lifecycle-'));
  const transportStates: TransportState[] = [];
  let stack: Awaited<ReturnType<typeof startStack>> | undefined;
  try {
    await fs.mkdir(path.join(workspace, '.aide'), { recursive: true });
    stack = await startStack(workspace, transportStates);
    const owner = stack.owner;

    const consentBody = { enabled: true };
    const consentHeaders = await owner.approve('PUT', '/api/byok/consent', consentBody, 'provider-lifecycle-consent');
    const consentResponse = await owner.request('/api/byok/consent', {
      method: 'PUT', headers: consentHeaders, body: JSON.stringify(consentBody)
    });
    assert.equal(consentResponse.status, 200);

    const connectBody = { providerId: 'openai', key: PROVIDER_KEY, model: PROVIDER_MODEL };
    const connectHeaders = await owner.approve('POST', '/api/providers/connect', connectBody, 'provider-lifecycle-connect');
    const connected = await owner.request('/api/providers/connect', {
      method: 'POST', headers: connectHeaders, body: JSON.stringify(connectBody)
    });
    assert.equal(connected.status, 200);
    const connectedEnvelope = await connected.json() as { data: { status: string } };
    assert.equal(connectedEnvelope.data.status, 'connected');

    const modelManagerResponse = await owner.request('/api/models/manager');
    assert.equal(modelManagerResponse.status, 200);
    const modelManager = await modelManagerResponse.json() as { data: { routes: ModelProviderRouteT[] } };
    const exactRoute = modelManager.data.routes.find(route =>
      route.provider_id === 'openai' && route.provider_model_id === PROVIDER_MODEL && route.execution_adapter_id === 'direct-http'
    );
    assert.ok(exactRoute);
    assert.equal(exactRoute.model_support_state, 'VERIFIED');
    assert.equal(exactRoute.available, true);
    assert.equal(exactRoute.health, 'HEALTHY');

    const oneShotBody = {
      modelId: CHAT_MODEL_ID,
      messages: [{ role: 'user' as const, content: 'one shot path' }],
      harness: false
    };
    const oneShot = await prepareAndApprove(owner, 'POST', '/api/chat', oneShotBody, 'provider-lifecycle-one-shot');
    assertExactTarget(receiptTarget(oneShot.before));
    const oneShotResponse = await owner.request('/api/chat', {
      method: 'POST',
      headers: { 'X-AIDE-Operation': oneShot.operationId, 'X-AIDE-Task': 'provider-lifecycle-one-shot' },
      body: JSON.stringify(oneShotBody)
    });
    assert.equal(oneShotResponse.status, 200);
    const oneShotEnvelope = await oneShotResponse.json() as { data: { text: string; modelId: string } };
    assert.equal(oneShotEnvelope.data.text, 'returned:one shot path');
    assert.equal(oneShotEnvelope.data.modelId, CHAT_MODEL_ID);
    const oneShotAfter = await operationReceipt(owner, oneShot.operationId);
    assert.equal(oneShotAfter.state, 'succeeded');
    assertExactTarget(receiptTarget(oneShotAfter));

    const streamBody = { modelId: CHAT_MODEL_ID, messages: [{ role: 'user' as const, content: 'stream path' }] };
    const streamed = await prepareAndApprove(owner, 'POST', '/api/chat/stream', streamBody, 'provider-lifecycle-stream');
    assertExactTarget(receiptTarget(streamed.before));
    const auditFile = path.join(workspace, '.aide', 'cipher-state.jsonl');
    const streamResponse = await owner.request('/api/chat/stream', {
      method: 'POST',
      headers: { 'X-AIDE-Operation': streamed.operationId, 'X-AIDE-Task': 'provider-lifecycle-stream' },
      body: JSON.stringify(streamBody)
    });
    assert.equal(streamResponse.status, 200);
    const streamText = await streamResponse.text();
    assert.match(streamText, /streamed:stream path/);
    assert.match(streamText, /"done":true/);
    const streamAuditEvents = (await fs.readFile(auditFile, 'utf8')).trim().split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line) as Record<string, unknown>);
    assert.ok(streamAuditEvents.some(event => event.type === 'authority' && event.operation_id === streamed.operationId && event.decision === 'execution-succeeded'), 'the terminal success frame is not returned before durable Authority evidence');
    const streamAfter = await operationReceipt(owner, streamed.operationId);
    assert.equal(streamAfter.state, 'succeeded');
    assertExactTarget(receiptTarget(streamAfter));

    const errorBody = { modelId: CHAT_MODEL_ID, messages: [{ role: 'user' as const, content: 'error path' }] };
    const failed = await prepareAndApprove(owner, 'POST', '/api/chat/stream', errorBody, 'provider-lifecycle-error');
    const failedResponse = await owner.request('/api/chat/stream', {
      method: 'POST',
      headers: { 'X-AIDE-Operation': failed.operationId, 'X-AIDE-Task': 'provider-lifecycle-error' },
      body: JSON.stringify(errorBody)
    });
    assert.equal(failedResponse.status, 200);
    const failureText = await failedResponse.text();
    assert.doesNotMatch(failureText, /fixture provider internal detail/);
    assert.match(failureText, /provider openai reported a stream error/);
    const failedAfter = await operationReceipt(owner, failed.operationId);
    assert.equal(failedAfter.state, 'failed');
    assertExactTarget(receiptTarget(failedAfter));
    const errorTransport = [...transportStates].reverse().find(state => state.prompt === 'error path');
    assert.ok(errorTransport?.bodyCancelled, 'provider error cancels the upstream stream body');

    const timeoutBody = { modelId: CHAT_MODEL_ID, messages: [{ role: 'user' as const, content: 'timeout path' }] };
    const timeoutOperation = await prepareAndApprove(owner, 'POST', '/api/chat/stream', timeoutBody, 'provider-lifecycle-timeout');
    const timeoutResponse = await owner.request('/api/chat/stream', {
      method: 'POST',
      headers: { 'X-AIDE-Operation': timeoutOperation.operationId, 'X-AIDE-Task': 'provider-lifecycle-timeout' },
      body: JSON.stringify(timeoutBody)
    });
    assert.equal(timeoutResponse.status, 200);
    const timeoutText = await timeoutResponse.text();
    assert.match(timeoutText, /timed out after 500ms/);
    const timeoutAfter = await operationReceipt(owner, timeoutOperation.operationId);
    assert.equal(timeoutAfter.state, 'failed');
    assertExactTarget(receiptTarget(timeoutAfter));
    const timeoutTransport = [...transportStates].reverse().find(state => state.prompt === 'timeout path');
    assert.ok(timeoutTransport?.upstreamAborted && timeoutTransport.transportClosed, 'timeout abort closes the provider transport');

    const cancelBody = { modelId: CHAT_MODEL_ID, messages: [{ role: 'user' as const, content: 'cancel path' }] };
    const cancelled = await prepareAndApprove(owner, 'POST', '/api/chat/stream', cancelBody, 'provider-lifecycle-cancel');
    const clientAbort = new AbortController();
    const pendingResponse = owner.request('/api/chat/stream', {
      method: 'POST',
      headers: { 'X-AIDE-Operation': cancelled.operationId, 'X-AIDE-Task': 'provider-lifecycle-cancel' },
      body: JSON.stringify(cancelBody),
      signal: clientAbort.signal
    });
    const cancelResponse = await pendingResponse;
    assert.equal(cancelResponse.status, 200);
    const cancelReader = cancelResponse.body?.getReader();
    assert.ok(cancelReader);
    const firstDelta = await cancelReader.read();
    assert.equal(firstDelta.done, false);
    assert.match(new TextDecoder().decode(firstDelta.value), /partial:cancel path/);
    clientAbort.abort();
    void cancelReader.cancel().catch(() => {});
    const cancelTransport = [...transportStates].reverse().find(state => state.prompt === 'cancel path');
    await waitFor(() => cancelTransport?.upstreamAborted === true && cancelTransport.transportClosed === true, 'caller cancellation to abort provider transport');
    const cancelledAfter = await operationReceipt(owner, cancelled.operationId);
    assert.equal(cancelledAfter.state, 'failed', 'caller cancellation is never reported as success');
    assertExactTarget(receiptTarget(cancelledAfter));

    const auditEvents = (await fs.readFile(auditFile, 'utf8')).trim().split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line) as Record<string, unknown>);
    const durableSuccess = auditEvents.find(event => event.type === 'authority' && event.operation_id === streamed.operationId && event.decision === 'execution-succeeded');
    assert.ok(durableSuccess, 'stream completion has a durable Authority evidence row');
    assert.equal(durableSuccess.digest, (streamAfter as { digest: unknown }).digest);
    assert.ok(!JSON.stringify(auditEvents).includes(PROVIDER_KEY), 'durable Authority evidence contains no provider credential');

    await stack.close();
    stack = undefined;
    const beforeRestartTransportCount = transportStates.length;
    stack = await startStack(workspace, transportStates);

    const providersAfterRestart = await stack.owner.request('/api/providers');
    const providersAfterRestartEnvelope = await providersAfterRestart.json() as { data: { providers: Array<{ id: string; configured: boolean; status: string }> } };
    const openAiAfterRestart = providersAfterRestartEnvelope.data.providers.find(provider => provider.id === 'openai');
    assert.equal(openAiAfterRestart?.configured, true, 'encrypted credential survives a new provider service instance');
    assert.equal(openAiAfterRestart?.status, 'checking', 'restart does not restore stale provider health');

    const managerAfterRestart = await stack.owner.request('/api/models/manager');
    const managerAfterRestartEnvelope = await managerAfterRestart.json() as { data: { routes: ModelProviderRouteT[] } };
    const routeAfterRestart = managerAfterRestartEnvelope.data.routes.find(route => route.id === exactRoute.id);
    assert.ok(routeAfterRestart);
    assert.equal(routeAfterRestart.model_support_state, 'UNKNOWN');
    assert.equal(routeAfterRestart.available, false, 'persisted credentials do not restore stale model verification');

    const blockedPrepare = await stack.owner.request('/api/authority/prepare', {
      method: 'POST',
      body: JSON.stringify({ method: 'POST', path: '/api/chat/stream', body: streamBody, task_id: 'provider-lifecycle-stale-restart-route' })
    });
    assert.equal(blockedPrepare.status, 403, 'external chat stays blocked until the exact model is re-verified');
    assert.equal(transportStates.length, beforeRestartTransportCount, 'stale route rejection performs no provider request');

    const reconnectHeaders = await stack.owner.approve('POST', '/api/providers/connect', connectBody, 'provider-lifecycle-reverify-after-restart');
    const reconnected = await stack.owner.request('/api/providers/connect', {
      method: 'POST', headers: reconnectHeaders, body: JSON.stringify(connectBody)
    });
    assert.equal(reconnected.status, 200);
    const reconnectedEnvelope = await reconnected.json() as { data: { status: string } };
    assert.equal(reconnectedEnvelope.data.status, 'connected');

    const recoveredBody = { modelId: CHAT_MODEL_ID, messages: [{ role: 'user' as const, content: 'recovered after restart' }] };
    const recovered = await prepareAndApprove(stack.owner, 'POST', '/api/chat/stream', recoveredBody, 'provider-lifecycle-recovered-stream');
    assertExactTarget(receiptTarget(recovered.before));
    const recoveredResponse = await stack.owner.request('/api/chat/stream', {
      method: 'POST',
      headers: { 'X-AIDE-Operation': recovered.operationId, 'X-AIDE-Task': 'provider-lifecycle-recovered-stream' },
      body: JSON.stringify(recoveredBody)
    });
    assert.equal(recoveredResponse.status, 200);
    assert.match(await recoveredResponse.text(), /streamed:recovered after restart/);
    const recoveredAfter = await operationReceipt(stack.owner, recovered.operationId);
    assert.equal(recoveredAfter.state, 'succeeded');
    assertExactTarget(receiptTarget(recoveredAfter));
    assert.ok(transportStates.some(state => state.prompt === 'recovered after restart' && state.model === PROVIDER_MODEL));
  } finally {
    if (stack !== undefined) await stack.close();
    await removeFixtureWorkspace(workspace);
  }
});

test('production OpenCode Model Access route is governed and requires exact re-verification after restart', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'aide-opencode-model-access-lifecycle-'));
  const transportStates: TransportState[] = [];
  let stack: Awaited<ReturnType<typeof startStack>> | undefined;
  let openCodeFixture: Awaited<ReturnType<typeof fixtureBridge>> | undefined;

  const routeId = `route:opencode-managed:${OPENCODE_PROVIDER_MODEL}:opencode`;
  const routingBody = {
    routing: {
      plan: 'local',
      act: { provider_id: 'opencode', model_id: OPENCODE_PROVIDER_MODEL },
      utility: 'local'
    }
  };
  const consentBody = { enabled: true };
  const verificationBody = { connection_id: 'opencode-managed', provider_model_id: OPENCODE_PROVIDER_MODEL };
  const streamBody = { modelId: OPENCODE_CHAT_MODEL_ID, messages: [{ role: 'user' as const, content: 'bounded governed task' }] };

  try {
    await fs.mkdir(path.join(workspace, '.aide'), { recursive: true });
    openCodeFixture = await fixtureBridge(workspace, 'terminal-lifecycle');
    const fixtureBridgeInstance = openCodeFixture.bridge;
    const boundedTimeoutBridge = {
      ...fixtureBridgeInstance,
      runTaskStream: (options: Parameters<typeof fixtureBridgeInstance.runTaskStream>[0]) =>
        fixtureBridgeInstance.runTaskStream({ ...options, timeoutMs: 5000 })
    };
    stack = await startStack(workspace, transportStates, boundedTimeoutBridge);

    const routingHeaders = await stack.owner.approve('PUT', '/api/byok/routing', routingBody, 'opencode-lifecycle-routing');
    const routingResponse = await stack.owner.request('/api/byok/routing', {
      method: 'PUT', headers: routingHeaders, body: JSON.stringify(routingBody)
    });
    assert.equal(routingResponse.status, 200);
    const consentHeaders = await stack.owner.approve('PUT', '/api/byok/consent', consentBody, 'opencode-lifecycle-consent');
    const consentResponse = await stack.owner.request('/api/byok/consent', {
      method: 'PUT', headers: consentHeaders, body: JSON.stringify(consentBody)
    });
    assert.equal(consentResponse.status, 200);

    const initialManagerResponse = await stack.owner.request('/api/models/manager');
    const initialManager = await initialManagerResponse.json() as { data: { routes: ModelProviderRouteT[] } };
    const initialRoute = initialManager.data.routes.find(route => route.id === routeId);
    assert.ok(initialRoute);
    assert.equal(initialRoute.model_support_state, 'UNKNOWN');
    assert.equal(initialRoute.available, false, 'connected bridge metadata alone cannot authorize the exact model');

    const verifyHeaders = await stack.owner.approve('POST', '/api/connections/test', verificationBody, 'opencode-lifecycle-verify');
    const verifyResponse = await stack.owner.request('/api/connections/test', {
      method: 'POST', headers: verifyHeaders, body: JSON.stringify(verificationBody)
    });
    assert.equal(verifyResponse.status, 200);
    const verifyEnvelope = await verifyResponse.json() as { data: { ok: boolean } };
    assert.equal(verifyEnvelope.data.ok, true);
    const verificationEvents = await readLog(openCodeFixture!.log);
    const verificationPrompt = verificationEvents.find(event => event.event === 'prompt');
    assert.ok(verificationPrompt?.body);
    assert.deepEqual(verificationPrompt.body.model, { providerID: 'opencode-go', modelID: 'deepseek-v4.1-flash' });
    assert.equal(verificationEvents.filter(event => event.event === 'prompt').length, 1);

    const readyManagerResponse = await stack.owner.request('/api/models/manager');
    const readyManager = await readyManagerResponse.json() as { data: { routes: ModelProviderRouteT[] } };
    const readyRoute = readyManager.data.routes.find(route => route.id === routeId);
    assert.equal(readyRoute?.model_support_state, 'VERIFIED');
    assert.equal(readyRoute?.available, true);

    const firstMission = await prepareAndApprove(stack.owner, 'POST', '/api/chat/stream', streamBody, 'opencode-lifecycle-first-mission');
    assertExactOpenCodeTarget(receiptTarget(firstMission.before));
    const firstResponse = await stack.owner.request('/api/chat/stream', {
      method: 'POST',
      headers: { 'X-AIDE-Operation': firstMission.operationId, 'X-AIDE-Task': 'opencode-lifecycle-first-mission' },
      body: JSON.stringify(streamBody)
    });
    assert.equal(firstResponse.status, 200);
    const firstStreamText = await firstResponse.text();
    assert.match(firstStreamText, /"delta":"streamed "/);
    assert.match(firstStreamText, /"delta":"answer"/);
    const firstAfter = await operationReceipt(stack.owner, firstMission.operationId);
    assert.equal(firstAfter.state, 'succeeded');
    assertExactOpenCodeTarget(receiptTarget(firstAfter));
    assert.equal((await readLog(openCodeFixture!.log)).filter(event => event.event === 'prompt').length, 2, 'the governed mission dispatches through the OpenCode adapter exactly once after verification');

    await stack.close();
    stack = undefined;
    stack = await startStack(workspace, transportStates, boundedTimeoutBridge);

    const oldOperationResponse = await stack.owner.request(`/api/authority/operation?id=${encodeURIComponent(firstMission.operationId)}`);
    assert.equal(oldOperationResponse.status, 404, 'transient approval/operation state is not restored into a new Authority instance');
    const auditFile = path.join(workspace, '.aide', 'cipher-state.jsonl');
    const auditEvents = (await fs.readFile(auditFile, 'utf8')).trim().split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line) as Record<string, unknown>);
    const durableFirstSuccess = auditEvents.find(event => event.type === 'authority' && event.operation_id === firstMission.operationId && event.decision === 'execution-succeeded');
    assert.ok(durableFirstSuccess, 'the terminal Authority outcome remains durable after restart');
    assert.equal(durableFirstSuccess.digest, (firstAfter as { digest: unknown }).digest, 'durable outcome remains bound to the pre-restart exact-target digest');

    const restartedManagerResponse = await stack.owner.request('/api/models/manager');
    const restartedManager = await restartedManagerResponse.json() as { data: { routes: ModelProviderRouteT[] } };
    const restartedRoute = restartedManager.data.routes.find(route => route.id === routeId);
    assert.ok(restartedRoute);
    assert.equal(restartedRoute.model_support_state, 'UNKNOWN');
    assert.equal(restartedRoute.available, false, 'managed connection presence does not restore stale exact-model verification');

    const beforeBlockedPrepare = (await readLog(openCodeFixture!.log)).filter(event => event.event === 'prompt').length;
    const blockedPrepare = await stack.owner.request('/api/authority/prepare', {
      method: 'POST',
      body: JSON.stringify({ method: 'POST', path: '/api/chat/stream', body: streamBody, task_id: 'opencode-lifecycle-stale-restart-route' })
    });
    assert.equal(blockedPrepare.status, 403, 'external chat stays blocked until the exact model is re-verified');
    assert.equal((await readLog(openCodeFixture!.log)).filter(event => event.event === 'prompt').length, beforeBlockedPrepare, 'stale route rejection performs no managed-adapter task');

    const reverifyHeaders = await stack.owner.approve('POST', '/api/connections/test', verificationBody, 'opencode-lifecycle-reverify-after-restart');
    const reverifyResponse = await stack.owner.request('/api/connections/test', {
      method: 'POST', headers: reverifyHeaders, body: JSON.stringify(verificationBody)
    });
    assert.equal(reverifyResponse.status, 200);
    const reverifyEnvelope = await reverifyResponse.json() as { data: { ok: boolean } };
    assert.equal(reverifyEnvelope.data.ok, true);

    const recoveredBody = { modelId: OPENCODE_CHAT_MODEL_ID, messages: [{ role: 'user' as const, content: 'bounded governed task after restart' }] };
    const recoveredMission = await prepareAndApprove(stack.owner, 'POST', '/api/chat/stream', recoveredBody, 'opencode-lifecycle-recovered-mission');
    assertExactOpenCodeTarget(receiptTarget(recoveredMission.before));
    const recoveredResponse = await stack.owner.request('/api/chat/stream', {
      method: 'POST',
      headers: { 'X-AIDE-Operation': recoveredMission.operationId, 'X-AIDE-Task': 'opencode-lifecycle-recovered-mission' },
      body: JSON.stringify(recoveredBody)
    });
    assert.equal(recoveredResponse.status, 200);
    const recoveredStreamText = await recoveredResponse.text();
    assert.match(recoveredStreamText, /"delta":"streamed "/);
    assert.match(recoveredStreamText, /"delta":"answer"/);
    const recoveredAfter = await operationReceipt(stack.owner, recoveredMission.operationId);
    assert.equal(recoveredAfter.state, 'succeeded');
    assertExactOpenCodeTarget(receiptTarget(recoveredAfter));

    const timeoutBody = { modelId: OPENCODE_CHAT_MODEL_ID, messages: [{ role: 'user' as const, content: 'timeout this route' }] };
    const timedOut = await prepareAndApprove(stack.owner, 'POST', '/api/chat/stream', timeoutBody, 'opencode-lifecycle-timeout');
    assertExactOpenCodeTarget(receiptTarget(timedOut.before));
    const timeoutResponse = await stack.owner.request('/api/chat/stream', {
      method: 'POST',
      headers: { 'X-AIDE-Operation': timedOut.operationId, 'X-AIDE-Task': 'opencode-lifecycle-timeout' },
      body: JSON.stringify(timeoutBody),
      signal: AbortSignal.timeout(20000)
    });
    assert.equal(timeoutResponse.status, 200);
    const timeoutText = await timeoutResponse.text();
    assert.match(timeoutText, /"delta":"first"/);
    assert.match(timeoutText, /OpenCode task timed out/);
    assert.doesNotMatch(timeoutText, /"done":true/, 'OpenCode timeout cannot become a successful stream');
    const timeoutAfter = await operationReceipt(stack.owner, timedOut.operationId);
    assert.equal(timeoutAfter.state, 'failed');
    assertExactOpenCodeTarget(receiptTarget(timeoutAfter));

    const cancelBody = { modelId: OPENCODE_CHAT_MODEL_ID, messages: [{ role: 'user' as const, content: 'cancel this route' }] };
    const cancelled = await prepareAndApprove(stack.owner, 'POST', '/api/chat/stream', cancelBody, 'opencode-lifecycle-cancel');
    assertExactOpenCodeTarget(receiptTarget(cancelled.before));
    const clientAbort = new AbortController();
    const pendingResponse = stack.owner.request('/api/chat/stream', {
      method: 'POST',
      headers: { 'X-AIDE-Operation': cancelled.operationId, 'X-AIDE-Task': 'opencode-lifecycle-cancel' },
      body: JSON.stringify(cancelBody),
      signal: clientAbort.signal
    });
    const cancelResponse = await pendingResponse;
    assert.equal(cancelResponse.status, 200);
    const cancelReader = cancelResponse.body?.getReader();
    assert.ok(cancelReader);
    const firstDelta = await cancelReader.read();
    assert.equal(firstDelta.done, false);
    assert.match(new TextDecoder().decode(firstDelta.value), /first/);
    clientAbort.abort();
    void cancelReader.cancel().catch(() => {});
    await waitForAsync(async () => {
      const events = await readLog(openCodeFixture!.log);
      return events.some(event => event.event === 'abort') && events.filter(event => event.event === 'delete').length >= 5;
    }, 'OpenCode caller cancellation to abort and delete the exact-target session');
    await waitForAsync(async () => (await operationReceipt(stack!.owner, cancelled.operationId)).state === 'failed', 'Authority to record OpenCode caller cancellation');
    const cancelledAfter = await operationReceipt(stack.owner, cancelled.operationId);
    assert.equal(cancelledAfter.state, 'failed', 'caller cancellation is never reported as success');
    assertExactOpenCodeTarget(receiptTarget(cancelledAfter));

    const errorBody = { modelId: OPENCODE_CHAT_MODEL_ID, messages: [{ role: 'user' as const, content: 'provider-error path' }] };
    const failed = await prepareAndApprove(stack.owner, 'POST', '/api/chat/stream', errorBody, 'opencode-lifecycle-provider-error');
    assertExactOpenCodeTarget(receiptTarget(failed.before));
    const failedResponse = await stack.owner.request('/api/chat/stream', {
      method: 'POST',
      headers: { 'X-AIDE-Operation': failed.operationId, 'X-AIDE-Task': 'opencode-lifecycle-provider-error' },
      body: JSON.stringify(errorBody)
    });
    assert.equal(failedResponse.status, 200);
    const failureText = await failedResponse.text();
    assert.doesNotMatch(failureText, /credential sentinel must not escape/);
    assert.match(failureText, /opencode delegated provider task failed/);
    const failedAfter = await operationReceipt(stack.owner, failed.operationId);
    assert.equal(failedAfter.state, 'failed');
    assertExactOpenCodeTarget(receiptTarget(failedAfter));

    const cleanupBody = { modelId: OPENCODE_CHAT_MODEL_ID, messages: [{ role: 'user' as const, content: 'cleanup failure path' }] };
    const cleanupMission = await prepareAndApprove(stack.owner, 'POST', '/api/chat/stream', cleanupBody, 'opencode-lifecycle-cleanup-failure');
    assertExactOpenCodeTarget(receiptTarget(cleanupMission.before));
    const cleanupResponse = await stack.owner.request('/api/chat/stream', {
      method: 'POST',
      headers: { 'X-AIDE-Operation': cleanupMission.operationId, 'X-AIDE-Task': 'opencode-lifecycle-cleanup-failure' },
      body: JSON.stringify(cleanupBody)
    });
    assert.equal(cleanupResponse.status, 200);
    const cleanupText = await cleanupResponse.text();
    assert.match(cleanupText, /cleanup could not be confirmed/);
    assert.doesNotMatch(cleanupText, /"done":true/, 'cleanup failure cannot be converted into a successful stream');
    const cleanupAuditEvents = (await fs.readFile(auditFile, 'utf8')).trim().split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line) as Record<string, unknown>);
    const durableCleanupFailure = cleanupAuditEvents.find(event => event.type === 'authority' && event.operation_id === cleanupMission.operationId && event.decision === 'execution-failed');
    assert.ok(durableCleanupFailure, 'the terminal failure response is not returned before durable failed Authority evidence');
    const cleanupAfter = await operationReceipt(stack.owner, cleanupMission.operationId);
    assert.equal(cleanupAfter.state, 'failed');
    assertExactOpenCodeTarget(receiptTarget(cleanupAfter));
    assert.equal(durableCleanupFailure.digest, (cleanupAfter as { digest: unknown }).digest);

    const terminalAuditEvents = (await fs.readFile(auditFile, 'utf8')).trim().split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line) as Record<string, unknown>);
    const durableCancellation = terminalAuditEvents.find(event => event.type === 'authority' && event.operation_id === cancelled.operationId && event.decision === 'execution-failed');
    assert.ok(durableCancellation, 'caller cancellation has a durable failed Authority outcome');
    assert.equal(durableCancellation.digest, (cancelledAfter as { digest: unknown }).digest);
    const durableTimeout = terminalAuditEvents.find(event => event.type === 'authority' && event.operation_id === timedOut.operationId && event.decision === 'execution-failed');
    assert.ok(durableTimeout, 'OpenCode timeout has a durable failed Authority outcome');
    assert.equal(durableTimeout.digest, (timeoutAfter as { digest: unknown }).digest);
    const durableProviderError = terminalAuditEvents.find(event => event.type === 'authority' && event.operation_id === failed.operationId && event.decision === 'execution-failed');
    assert.ok(durableProviderError, 'provider error has a durable failed Authority outcome');
    assert.equal(durableProviderError.digest, (failedAfter as { digest: unknown }).digest);
    const opencodeEvents = await readLog(openCodeFixture!.log);
    const lifecyclePrompts = opencodeEvents.filter(event => event.event === 'prompt');
    assert.equal(lifecyclePrompts.length, 8, 'verification, governed runs, restart re-verification, timeout, and other terminal-path cases dispatch once each');
    assert.ok(lifecyclePrompts.every(event => JSON.stringify(event.body?.model) === JSON.stringify({ providerID: 'opencode-go', modelID: 'deepseek-v4.1-flash' })));
    assert.equal(opencodeEvents.filter(event => event.event === 'abort').length, 4, 'timeout, caller cancellation, provider error, and cleanup failure each abort the session');
    assert.equal(opencodeEvents.filter(event => event.event === 'delete').length, 9, 'every created session is deleted, including both cleanup-failure attempts');
    assert.equal(transportStates.length, 0, 'OpenCode route never falls through to the direct HTTP provider service');
  } finally {
    if (stack !== undefined) await stack.close();
    if (openCodeFixture !== undefined) await openCodeFixture.bridge.stop();
    await removeFixtureWorkspace(workspace);
  }
});
