import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { z } from 'zod';
import { ArchServer } from '../../node/src/server.ts';
import { routesForAuthority } from '../../node/src/routes/authority.ts';
import { routeForChat, routeForChatStream } from '../../node/src/routes/chat.ts';
import { ModelRouter } from '../../node/src/services/model-router.ts';
import type { ModelEntry, ModelRuntime } from '../../node/src/services/model-runtime.ts';
import type { ProviderDefinition, ProviderService } from '../../node/src/services/providers.ts';
import { pairFixture } from './authority-fixture.ts';

const providerCatalog: readonly ProviderDefinition[] = [{
  id: 'openai',
  name: 'Local GGUF Mirror',
  kind: 'openai-compatible',
  baseUrl: 'https://api.openai.com/v1',
  models: ['local-gguf-q4'],
  contextLength: 4096,
  egressHost: 'api.openai.com'
}];

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

class FixtureRuntime {
  readonly entries: ModelEntry[];
  chatCalls = 0;
  streamCalls = 0;
  statusCalls = 0;
  verifyCalls = 0;

  constructor(workspace: string) {
    this.entries = [{
      id: 'fixture-model',
      name: 'Local-looking fixture',
      status: 'ready',
      roles: ['chat'],
      endpoint: 'http://127.0.0.1:8180/v1',
      model: 'fixture.gguf',
      artifact_uri: 'local://fixture.gguf',
      context_tokens: 2048,
      file: path.join(workspace, 'models', 'fixture.gguf')
    }];
  }

  list(): ModelEntry[] { return this.entries; }
  status() { this.statusCalls += 1; return { runtime: true, models: [] }; }
  async verifyEndpointModel() { this.verifyCalls += 1; return { ready: true }; }
  getEffectiveBudget() { return null; }
  async refreshServedContext() { return null; }
  getEffectiveContext() { return null; }

  async chat(id: string) {
    this.chatCalls += 1;
    return { text: 'local-result', modelId: id, timingMs: 1 };
  }

  async chatStream(_id: string, _messages: unknown, onDelta: (delta: string) => void) {
    this.streamCalls += 1;
    onDelta('local-stream-result');
  }
}

class FixtureProviders {
  listCalls = 0;
  calls: Array<{ providerId: string; model: string }> = [];
  async list() { this.listCalls += 1; return []; }
  async chat(providerId: string, model: string) {
    this.calls.push({ providerId, model });
    return { text: 'external-result', modelId: `${providerId}:${model}`, timingMs: 1 };
  }
}

test('HTTP chat Authority binds local/external identity, enforces stream parity, and rejects target substitution', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'chat-authority-contract-'));
  await fs.mkdir(path.join(workspace, '.aide'), { recursive: true });
  const runtime = new FixtureRuntime(workspace);
  const providers = new FixtureProviders();
  const router = new ModelRouter(runtime as unknown as ModelRuntime, providers as unknown as ProviderService, providerCatalog);
  const arch = new ArchServer(workspace, path.join(workspace, '.aide', 'authority.log'));
  for (const route of routesForAuthority()) arch.route(route);
  arch.route(routeForChat(router, runtime as unknown as ModelRuntime, workspace));
  arch.route(routeForChatStream(router, runtime as unknown as ModelRuntime, workspace));
  arch.route({ method: 'GET', path: '/api/providers', response: z.object({ ok: z.boolean() }), handler: () => ({ ok: true }) });
  const server = await arch.listen(0);
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const owner = await pairFixture(arch, `http://127.0.0.1:${address.port}`);

  const inspect = async (id: string) => {
    const response = await owner.request(`/api/authority/operation?id=${encodeURIComponent(id)}`);
    assert.equal(response.status, 200);
    return (await response.json() as { data: { kind: string; risk: string; state: string; args: unknown } }).data;
  };
  const request = (url: string, body: unknown, operation?: { operation_id: string; task_id: string }) =>
    owner.request(url, {
      method: 'POST',
      body: JSON.stringify(body),
      ...(operation ? { headers: { 'X-AIDE-Operation': operation.operation_id, 'X-AIDE-Task': operation.task_id } } : {})
    });

  try {
    const localBody = { modelId: 'local:fixture-model', messages: [{ role: 'user' as const, content: 'local fixture' }], harness: false };
    const cloudBody = { modelId: 'cloud:openai:local-gguf-q4', messages: [{ role: 'user' as const, content: 'external fixture' }], harness: false };
    const localStreamBody = { modelId: localBody.modelId, messages: localBody.messages };
    const cloudStreamBody = { modelId: cloudBody.modelId, messages: cloudBody.messages };
    const routingPreferenceFile = path.join(workspace, '.aide', 'routing-preference.json');

    for (const [url, body] of [
      ['/api/chat', { ...localBody, modelId: 'unknown:model' }],
      ['/api/chat/stream', { ...localStreamBody, modelId: 'unknown:model' }],
      ['/api/chat', { ...cloudBody, modelId: 'cloud:missing:local-looking-model' }],
      ['/api/chat/stream', { ...cloudStreamBody, modelId: 'cloud:missing:local-looking-model' }]
    ] as const) {
      const denied = await request(url, body);
      assert.equal(denied.status, 403, `${url} denies an unresolved target`);
    }
    assert.equal(runtime.chatCalls + runtime.streamCalls + providers.calls.length, 0, 'unknown requests never reach an executor');

    await fs.writeFile(routingPreferenceFile, JSON.stringify({ preference: 'local-only' }), 'utf8');
    const localTask = 'contract-local';
    const localOperation = await owner.propose('POST', '/api/chat', localBody, localTask);
    const localReceipt = await inspect(localOperation.operation_id);
    assert.equal(localReceipt.kind, 'capability.execute');
    assert.equal(localReceipt.risk, 'execute');
    const localArgs = localReceipt.args as { body: unknown; chat_target: Record<string, unknown> };
    assert.equal((localArgs.body as { modelId: string }).modelId, localBody.modelId);
    assert.equal(localArgs.chat_target.execution_class, 'LOCAL');
    assert.equal(localArgs.chat_target.runtime_class, 'local-model-runtime');
    assert.equal(JSON.stringify(localArgs).includes('Bearer '), false, 'Authority receipt contains no credentials');
    await owner.decide(localOperation.operation_id, 'approve');
    const localResponse = await request('/api/chat', localBody, { operation_id: localOperation.operation_id, task_id: localTask });
    assert.equal(localResponse.status, 200);
    assert.equal(runtime.chatCalls, 1);
    assert.equal(providers.calls.length, 0);
    assert.equal((await inspect(localOperation.operation_id)).state, 'succeeded');

    const streamTask = 'contract-local-stream';
    const streamOperation = await owner.propose('POST', '/api/chat/stream', localStreamBody, streamTask);
    const streamReceipt = await inspect(streamOperation.operation_id);
    assert.equal(streamReceipt.kind, localReceipt.kind, 'streaming preserves local permission semantics');
    await owner.decide(streamOperation.operation_id, 'approve');
    const streamResponse = await request('/api/chat/stream', localStreamBody, { operation_id: streamOperation.operation_id, task_id: streamTask });
    assert.equal(streamResponse.status, 200);
    assert.match(await streamResponse.text(), /local-stream-result/);
    assert.equal(runtime.streamCalls, 1);

    const localOnlyExternalPrepare = await owner.request('/api/authority/prepare', { method: 'POST', body: JSON.stringify({
      method: 'POST', path: '/api/chat', body: cloudBody, task_id: 'contract-local-only-cloud'
    }) });
    assert.equal(localOnlyExternalPrepare.status, 403, 'Local-Only blocks external chat before approval/dispatch');
    assert.equal(providers.calls.length, 0, 'Local-Only never dispatches the provider');
    const localOnlyExternalStreamPrepare = await owner.request('/api/authority/prepare', { method: 'POST', body: JSON.stringify({
      method: 'POST', path: '/api/chat/stream', body: cloudStreamBody, task_id: 'contract-local-only-cloud-stream'
    }) });
    assert.equal(localOnlyExternalStreamPrepare.status, 403, 'streaming cannot bypass Local-Only external-chat policy');
    assert.equal(providers.calls.length, 0, 'blocked streaming request never dispatches the provider');
    await fs.writeFile(routingPreferenceFile, JSON.stringify({ preference: 'local-first' }), 'utf8');

    const crossRouteTask = 'contract-cross-route-replay';
    const nonStreamApproval = await owner.propose('POST', '/api/chat', localStreamBody, crossRouteTask);
    await owner.decide(nonStreamApproval.operation_id, 'approve');
    const crossRouteReplay = await request('/api/chat/stream', localStreamBody, {
      operation_id: nonStreamApproval.operation_id,
      task_id: crossRouteTask
    });
    assert.equal(crossRouteReplay.status, 409, 'an approved non-stream request cannot be replayed on the stream route');
    assert.equal(runtime.streamCalls, 1, 'cross-route replay does not dispatch');

    const externalTask = 'contract-external';
    const externalOperation = await owner.propose('POST', '/api/chat', cloudBody, externalTask);
    const externalReceipt = await inspect(externalOperation.operation_id);
    assert.equal(externalReceipt.kind, 'capability.external');
    assert.equal(externalReceipt.risk, 'external');
    const externalArgs = externalReceipt.args as { chat_target: Record<string, unknown> };
    assert.equal(externalArgs.chat_target.execution_class, 'EXTERNAL');
    assert.equal(externalArgs.chat_target.provider_id, 'openai');
    assert.equal(externalArgs.chat_target.provider_model, 'local-gguf-q4');
    assert.equal(externalArgs.chat_target.egress_host, 'api.openai.com');
    await owner.decide(externalOperation.operation_id, 'approve');
    const externalResponse = await request('/api/chat', cloudBody, { operation_id: externalOperation.operation_id, task_id: externalTask });
    assert.equal(externalResponse.status, 200);
    assert.deepEqual(providers.calls, [{ providerId: 'openai', model: 'local-gguf-q4' }]);

    const deniedStreamTask = 'contract-external-stream-denied';
    const deniedStreamOperation = await owner.propose('POST', '/api/chat/stream', cloudStreamBody, deniedStreamTask);
    const deniedStreamReceipt = await inspect(deniedStreamOperation.operation_id);
    assert.equal(deniedStreamReceipt.kind, externalReceipt.kind, 'streaming preserves external permission semantics');
    await owner.decide(deniedStreamOperation.operation_id, 'reject');
    const beforeDeniedStreamCalls = providers.calls.length;
    const deniedStream = await request('/api/chat/stream', cloudStreamBody, { operation_id: deniedStreamOperation.operation_id, task_id: deniedStreamTask });
    assert.equal(deniedStream.status, 409);
    assert.equal(providers.calls.length, beforeDeniedStreamCalls, 'rejected external stream does not dispatch');

    const approvedExternalStreamTask = 'contract-external-stream-approved';
    const approvedExternalStreamOperation = await owner.propose('POST', '/api/chat/stream', cloudStreamBody, approvedExternalStreamTask);
    assert.equal((await inspect(approvedExternalStreamOperation.operation_id)).kind, 'capability.external');
    await owner.decide(approvedExternalStreamOperation.operation_id, 'approve');
    const approvedExternalStream = await request('/api/chat/stream', cloudStreamBody, {
      operation_id: approvedExternalStreamOperation.operation_id,
      task_id: approvedExternalStreamTask
    });
    assert.equal(approvedExternalStream.status, 200);
    assert.match(await approvedExternalStream.text(), /external-result/);
    assert.deepEqual(providers.calls.at(-1), { providerId: 'openai', model: 'local-gguf-q4' });

    const substitutionTask = 'contract-local-to-cloud';
    const localApproved = await owner.propose('POST', '/api/chat', localBody, substitutionTask);
    await owner.decide(localApproved.operation_id, 'approve');
    const beforeSubstitutionCalls = providers.calls.length;
    const substitution = await request('/api/chat', cloudBody, { operation_id: localApproved.operation_id, task_id: substitutionTask });
    assert.equal(substitution.status, 409, 'local approval cannot be reused for external inference');
    assert.equal(providers.calls.length, beforeSubstitutionCalls);

    const mutationTask = 'contract-local-target-change';
    const beforeMutation = await owner.propose('POST', '/api/chat', localBody, mutationTask);
    await owner.decide(beforeMutation.operation_id, 'approve');
    runtime.entries[0]!.endpoint = 'http://127.0.0.1:8181/v1';
    const changedTarget = await request('/api/chat', localBody, { operation_id: beforeMutation.operation_id, task_id: mutationTask });
    assert.equal(changedTarget.status, 409, 'target revision change requires a fresh Authority operation');
    assert.equal(runtime.chatCalls, 1, 'changed target was not dispatched');

    const unrelatedRead = await owner.request('/api/providers');
    assert.equal(unrelatedRead.status, 200, 'existing central read behavior remains available');
    assert.equal(runtime.statusCalls, 0, 'pre-authorization resolution performs no runtime health probe');
    assert.equal(runtime.verifyCalls, 0, 'pre-authorization resolution does not contact runtime endpoints');
    assert.equal(providers.listCalls, 0, 'pre-authorization resolution does not inspect provider connectivity');
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
    arch.authority.control.close();
    arch.events.close();
    await arch.logger.flush();
    assert.equal(server.listening, false, 'fixture listener is closed');
    await removeFixtureWorkspace(workspace);
  }
});
