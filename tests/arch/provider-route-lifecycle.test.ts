import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { ArchServer } from '../../node/src/server.ts';
import { buildRoutes, createModelRuntime } from '../../node/src/openapi.ts';
import { CredentialStore, type CryptService } from '../../node/src/services/credentials.ts';
import { ProviderService } from '../../node/src/services/providers.ts';
import type { ModelProviderRouteT } from '../../common/contracts/model-access.ts';
import { pairFixture } from './authority-fixture.ts';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PROVIDER_KEY = 'fixture-provider-key-never-used-on-the-network';
const PROVIDER_MODEL = 'gpt-4o-mini';
const CHAT_MODEL_ID = `cloud:openai:${PROVIDER_MODEL}`;
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

async function startStack(workspace: string, states: TransportState[]) {
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
    providerService
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
  await owner.decide(operation.operation_id, 'approve');
  return { operationId: operation.operation_id, before };
}

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
    const streamResponse = await owner.request('/api/chat/stream', {
      method: 'POST',
      headers: { 'X-AIDE-Operation': streamed.operationId, 'X-AIDE-Task': 'provider-lifecycle-stream' },
      body: JSON.stringify(streamBody)
    });
    assert.equal(streamResponse.status, 200);
    const streamText = await streamResponse.text();
    assert.match(streamText, /streamed:stream path/);
    assert.match(streamText, /"done":true/);
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

    const auditFile = path.join(workspace, '.aide', 'cipher-state.jsonl');
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
