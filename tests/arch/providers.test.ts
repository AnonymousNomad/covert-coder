import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import { promises as fs } from 'node:fs';
import { BUILTIN_PROVIDERS, ProviderService, ProviderError, type ProviderServiceOptions } from '../../node/src/services/providers.ts';
import { CredentialStore, type CryptService } from '../../node/src/services/credentials.ts';

class FakeCrypt implements CryptService {
  readonly kind = 'fake';
  async available(): Promise<boolean> {
    return true;
  }
  async protect(plaintext: string): Promise<string> {
    return `enc:${Buffer.from(plaintext, 'utf8').toString('base64')}`;
  }
  async unprotect(blobB64: string): Promise<string> {
    if (!blobB64.startsWith('enc:')) throw new Error('bad blob');
    return Buffer.from(blobB64.slice(4), 'base64').toString('utf8');
  }
}

function makeService(dir: string, fetchFn: typeof fetch, assertExternalEgressAllowed?: () => void, requestTimeoutMs?: number): { service: ProviderService; logs: string[] } {
  const logs: string[] = [];
  const options: ProviderServiceOptions = {
    credentials: new CredentialStore(dir, new FakeCrypt()),
    fetchFn,
    assertExternalEgressAllowed: assertExternalEgressAllowed ?? (() => {}),
    logger: { info: (message: string) => logs.push(message) }
  };
  if (requestTimeoutMs !== undefined) options.requestTimeoutMs = requestTimeoutMs;
  return { service: new ProviderService(dir, options), logs };
}

function streamResponse(chunks: string[]): Response {
  return new Response(new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    }
  }), { status: 200, headers: { 'content-type': 'text/event-stream' } });
}

function openAiProbeResponse(): Response {
  return Response.json({ choices: [{ message: { content: 'ok' } }] }, { status: 200 });
}

function anthropicProbeResponse(): Response {
  return Response.json({ content: [{ type: 'text', text: 'ok' }] }, { status: 200 });
}

test('built-in provider registry is well-formed', () => {
  assert.equal(BUILTIN_PROVIDERS.length, 6);
  const ids = new Set<string>();
  for (const provider of BUILTIN_PROVIDERS) {
    assert.ok(!ids.has(provider.id), `duplicate provider id ${provider.id}`);
    ids.add(provider.id);
    assert.ok(provider.egressHost.length > 0, `${provider.id} needs an egress host`);
    assert.ok(provider.models.length > 0, `${provider.id} needs model ids`);
    try {
      const host = new URL(provider.baseUrl).hostname;
      assert.equal(host, provider.egressHost, `${provider.id} baseUrl host must match egressHost`);
    } catch {
      assert.fail(`${provider.id} baseUrl must be a valid URL`);
    }
  }
});

test('list reports not_connected before any credential exists', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'aide-prov-'));
  try {
    const { service } = makeService(dir, (() => Promise.resolve(new Response(null, { status: 200 }))) as typeof fetch);
    const providers = await service.list();
    assert.equal(providers.length, 6);
    assert.ok(providers.every(provider => provider.status === 'not_connected'));
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('connect fails closed when no Authority egress guard is wired', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'aide-prov-no-authority-'));
  try {
    let calls = 0;
    const service = new ProviderService(dir, {
      credentials: new CredentialStore(dir, new FakeCrypt()),
      fetchFn: (async () => { calls += 1; return new Response(null, { status: 200 }); }) as typeof fetch
    });
    await assert.rejects(() => service.connect({ providerId: 'openai', key: 'fixture-key' }), { code: 'NOT_READY' });
    assert.equal(calls, 0);
    assert.equal(await new CredentialStore(dir, new FakeCrypt()).has('openai'), false);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('connect probes with a successful response -> connected and persists the key', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'aide-prov-'));
  try {
    const calls: string[] = [];
    const fetchFn = (async (url: RequestInfo | URL, init?: RequestInit) => {
      calls.push(String(url));
      const headers = new Headers(init?.headers);
      assert.equal(headers.get('authorization'), 'Bearer sk-test');
      return openAiProbeResponse();
    }) as typeof fetch;
    const { service } = makeService(dir, fetchFn);
    const result = await service.connect({ providerId: 'openai', key: 'sk-test' });
    assert.equal(result.status, 'connected');
    assert.ok(calls[0]!.includes('/chat/completions'), `probe must hit the chat completions endpoint: ${calls[0]}`);
    const providers = await service.list();
    assert.equal(providers.find(provider => provider.id === 'openai')?.status, 'connected');
    assert.equal(service.modelSupportState('openai', 'gpt-4o-mini'), 'verified');
    assert.equal(service.modelSupportState('openai', 'gpt-4o'), 'unknown', 'provider health cannot certify a different model');
    assert.ok(await new CredentialStore(dir, new FakeCrypt()).has('openai'));
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('replacing a provider credential withdraws old model verification until the new key is probed', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'aide-prov-replacement-'));
  let releaseReplacementProbe: ((response: Response) => void) | undefined;
  let replacementProbeStartedResolve: (() => void) | undefined;
  const replacementProbeStarted = new Promise<void>(resolve => { replacementProbeStartedResolve = resolve; });
  const replacementProbe = new Promise<Response>(resolve => { releaseReplacementProbe = resolve; });
  try {
    let calls = 0;
    const fetchFn = (async () => {
      calls += 1;
      if (calls === 1) return openAiProbeResponse();
      replacementProbeStartedResolve?.();
      return replacementProbe;
    }) as typeof fetch;
    const { service } = makeService(dir, fetchFn);
    const initial = await service.connect({ providerId: 'openai', key: 'fixture-valid-key' });
    assert.equal(initial.status, 'connected');
    assert.equal(service.modelSupportState('openai', 'gpt-4o-mini'), 'verified');

    const replacement = service.connect({ providerId: 'openai', key: 'fixture-replacement-key' });
    await replacementProbeStarted;
    try {
      const current = (await service.list()).find(provider => provider.id === 'openai');
      assert.equal(current?.status, 'checking', 'the prior credential probe cannot remain connected during replacement verification');
      assert.equal(service.modelSupportState('openai', 'gpt-4o-mini'), 'unknown', 'old model verification is withdrawn while the new credential is unresolved');
    } finally {
      releaseReplacementProbe?.(new Response(null, { status: 401 }));
      await replacement;
    }
    const afterRejectedReplacement = (await service.list()).find(provider => provider.id === 'openai');
    assert.equal(afterRejectedReplacement?.status, 'invalid_key');
    assert.equal(service.modelSupportState('openai', 'gpt-4o-mini'), 'unknown');
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('a success status without a valid completion does not verify model support', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'aide-prov-empty-probe-'));
  try {
    const { service } = makeService(dir, (async () => Response.json({}, { status: 200 })) as typeof fetch);
    const result = await service.connect({ providerId: 'openai', key: 'sk-test' });
    assert.equal(result.status, 'unreachable');
    assert.equal(service.modelSupportState('openai', 'gpt-4o-mini'), 'unknown');
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('connect maps 401 to invalid_key and 403 to invalid_key', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'aide-prov-'));
  try {
    const service = makeService(dir, (() => Promise.resolve(new Response(null, { status: 401 }))) as typeof fetch).service;
    const result = await service.connect({ providerId: 'groq', key: 'bad' });
    assert.equal(result.status, 'invalid_key');
    const provider = (await service.list()).find(entry => entry.id === 'groq');
    assert.equal(provider?.status, 'invalid_key', 'list must show the cached probe result');
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('connect maps timeouts and network errors to unreachable', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'aide-prov-'));
  try {
    const service = makeService(dir, (() => Promise.reject(new DOMException('aborted', 'AbortError'))) as typeof fetch).service;
    const result = await service.connect({ providerId: 'anthropic', key: 'key' });
    assert.equal(result.status, 'unreachable');
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('anthropic probes the /v1/messages shape with x-api-key', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'aide-prov-'));
  try {
    let url = '';
    let headers: Headers | undefined;
    let body = '';
    const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
      url = String(input);
      headers = new Headers(init?.headers);
      body = String(init?.body);
      return anthropicProbeResponse();
    }) as typeof fetch;
    const { service } = makeService(dir, fetchFn);
    await service.connect({ providerId: 'anthropic', key: 'x-ant-1' });
    assert.equal(service.modelSupportState('anthropic', 'claude-3-5-haiku-latest'), 'verified');
    assert.ok(url.endsWith('/messages'), `anthropic probe must hit /messages: ${url}`);
    assert.equal(headers?.get('x-api-key'), 'x-ant-1');
    assert.equal(headers?.get('anthropic-version'), '2023-06-01');
    assert.ok(body.includes('"max_tokens":1'));
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('a user-added baseUrl requires explicit host approval', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'aide-prov-'));
  try {
    const { service } = makeService(dir, (() => Promise.resolve(openAiProbeResponse())) as typeof fetch);
    await assert.rejects(
      () => service.connect({ providerId: 'openai', key: 'k', baseUrl: 'https://my-relay.example/v1' }),
      error => error instanceof ProviderError && error.code === 'FORBIDDEN' && error.message.includes('approve')
    );
    const result = await service.connect({ providerId: 'openai', key: 'k', baseUrl: 'https://my-relay.example/v1', approveHost: true });
    assert.equal(result.status, 'connected');
    assert.equal(service.modelSupportState('openai', 'gpt-4o-mini'), 'unknown', 'a custom endpoint cannot certify the built-in route');
    const allowlist = JSON.parse(await fs.readFile(path.join(dir, '.aide', 'provider-hosts.json'), 'utf8')) as { hosts: string[] };
    assert.ok(allowlist.hosts.includes('my-relay.example'), 'approved host must persist');
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('disconnect removes the credential and resets status', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'aide-prov-'));
  try {
    const { service } = makeService(dir, (() => Promise.resolve(openAiProbeResponse())) as typeof fetch);
    await service.connect({ providerId: 'mistral', key: 'k' });
    assert.equal(service.modelSupportState('mistral', 'mistral-small-latest'), 'verified');
    await service.disconnect('mistral');
    const provider = (await service.list()).find(entry => entry.id === 'mistral');
    assert.equal(provider?.status, 'not_connected');
    assert.equal(service.modelSupportState('mistral', 'mistral-small-latest'), 'unknown', 'credential revocation also clears exact model support');
    assert.equal(await new CredentialStore(dir, new FakeCrypt()).has('mistral'), false);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('a provider 401 after a successful probe revokes cached model support for chat and stream', async () => {
  const provider = BUILTIN_PROVIDERS.find(entry => entry.id === 'openai');
  assert.ok(provider);
  const model = provider.models[0]!;

  for (const requestKind of ['chat', 'stream'] as const) {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'aide-prov-revoked-'));
    try {
      let fetchCalls = 0;
      const fetchFn = (async () => {
        fetchCalls++;
        return fetchCalls === 1
          ? openAiProbeResponse()
          : new Response(null, { status: 401 });
      }) as typeof fetch;
      const { service } = makeService(dir, fetchFn);

      const connected = await service.connect({ providerId: provider.id, key: 'fixture-key', model });
      assert.equal(connected.status, 'connected');
      assert.equal(service.modelSupportState(provider.id, model), 'verified');

      const request = requestKind === 'chat'
        ? () => service.chat(provider.id, model, [{ role: 'user', content: 'test' }])
        : () => service.chatStream(provider.id, model, [{ role: 'user', content: 'test' }], () => {});
      await assert.rejects(request, error => error instanceof ProviderError && error.code === 'NOT_READY');

      const providerList = await service.list();
      assert.equal(providerList.find(entry => entry.id === provider.id)?.status, 'invalid_key', `${requestKind} 401 must invalidate cached provider health`);
      assert.equal(service.modelSupportState(provider.id, model), 'unknown', `${requestKind} 401 must revoke exact-model support`);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  }
});

test('chat propagates caller cancellation instead of misreporting a provider timeout', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'aide-prov-'));
  try {
    let calls = 0;
    const fetchFn = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      calls += 1;
      if (calls === 1) return openAiProbeResponse();
      return await new Promise<Response>((_resolve, reject) => {
        const rejectAbort = (): void => reject(new DOMException('caller cancelled', 'AbortError'));
        if (init?.signal?.aborted) rejectAbort();
        else init?.signal?.addEventListener('abort', rejectAbort, { once: true });
      });
    }) as typeof fetch;
    const { service } = makeService(dir, fetchFn);
    const connected = await service.connect({ providerId: 'openai', key: 'sk-test' });
    assert.equal(connected.status, 'connected');

    const controller = new AbortController();
    const pending = service.chat('openai', 'gpt-4o-mini', [{ role: 'user', content: 'wait' }], { signal: controller.signal });
    controller.abort();
    await assert.rejects(pending, error => error instanceof Error && error.name === 'AbortError');
    assert.equal(calls, 2, 'connect probe plus one chat request');
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('chatStream emits OpenAI-compatible SSE deltas and completion usage', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'aide-prov-stream-'));
  try {
    let streamBody: Record<string, unknown> | undefined;
    const fetchFn = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (typeof init?.body === 'string' && init.body.includes('"stream":true')) {
        streamBody = JSON.parse(init.body) as Record<string, unknown>;
        return streamResponse([
          ': provider keepalive\r\n\r\ndata: {"choices":[{"delta":{"content":"first "}}]}\r\n\r\n',
          'data: {"choices":[{"delta":{"content":"second"}}]}\r\n\r\n',
          'data: {"choices":[],"usage":{"completion_tokens":2}}\r\n\r\n',
          'data: [DONE]\r\n\r\n'
        ]);
      }
      return openAiProbeResponse();
    }) as typeof fetch;
    const { service } = makeService(dir, fetchFn);
    await service.connect({ providerId: 'openai', key: 'sk-stream-test' });

    const deltas: string[] = [];
    const result = await service.chatStream('openai', 'gpt-4o-mini', [{ role: 'user', content: 'hello' }], delta => deltas.push(delta));
    assert.deepEqual(deltas, ['first ', 'second']);
    assert.equal(result.text, 'first second');
    assert.equal(result.modelId, 'openai:gpt-4o-mini');
    assert.equal(result.tokens, 2);
    assert.equal(streamBody?.stream, true, 'provider request opts into SSE');
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('chatStream parses Anthropic text events and keeps system messages provider-shaped', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'aide-prov-anthropic-stream-'));
  try {
    let streamBody: Record<string, unknown> | undefined;
    const fetchFn = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (typeof init?.body === 'string' && init.body.includes('"stream":true')) {
        streamBody = JSON.parse(init.body) as Record<string, unknown>;
        return streamResponse([
          'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"hello"}}\n\n',
          'event: message_delta\ndata: {"type":"message_delta","usage":{"output_tokens":1}}\n\n',
          'event: message_stop\ndata: {"type":"message_stop"}\n\n'
        ]);
      }
      return anthropicProbeResponse();
    }) as typeof fetch;
    const { service } = makeService(dir, fetchFn);
    await service.connect({ providerId: 'anthropic', key: 'anthropic-stream-test' });

    const deltas: string[] = [];
    const result = await service.chatStream('anthropic', 'claude-3-5-haiku-latest', [
      { role: 'system', content: 'system instruction' },
      { role: 'user', content: 'hello' }
    ], delta => deltas.push(delta));
    assert.deepEqual(deltas, ['hello']);
    assert.equal(result.text, 'hello');
    assert.equal(result.tokens, 1);
    assert.equal(streamBody?.stream, true);
    assert.equal(streamBody?.system, 'system instruction');
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('chatStream rejects malformed and provider-error SSE frames without exposing payloads', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'aide-prov-stream-error-'));
  try {
    let nextStream = streamResponse(['data: {not-json}\n\n']);
    const fetchFn = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (typeof init?.body === 'string' && init.body.includes('"stream":true')) return nextStream;
      return openAiProbeResponse();
    }) as typeof fetch;
    const { service } = makeService(dir, fetchFn);
    await service.connect({ providerId: 'openai', key: 'sensitive-stream-fixture' });
    await assert.rejects(
      () => service.chatStream('openai', 'gpt-4o-mini', [{ role: 'user', content: 'hello' }], () => {}),
      error => error instanceof ProviderError && error.code === 'CHILD_FAILED' && !error.message.includes('sensitive-stream-fixture')
    );

    nextStream = streamResponse(['data: {"error":{"message":"sensitive-stream-fixture rejected"}}\n\n']);
    await assert.rejects(
      () => service.chatStream('openai', 'gpt-4o-mini', [{ role: 'user', content: 'hello' }], () => {}),
      error => error instanceof ProviderError && error.code === 'CHILD_FAILED' && !error.message.includes('sensitive-stream-fixture')
    );

    nextStream = streamResponse(['data: {"choices":[{"delta":{"content":"partial"}}]}\n\n']);
    await assert.rejects(
      () => service.chatStream('openai', 'gpt-4o-mini', [{ role: 'user', content: 'hello' }], () => {}),
      error => error instanceof ProviderError && error.code === 'CHILD_FAILED' && error.message.includes('before completion')
    );
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('chatStream cancels an HTTP error response body before returning the provider error', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'aide-prov-stream-http-error-'));
  try {
    let cancelCalls = 0;
    const fetchFn = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (typeof init?.body === 'string' && init.body.includes('"stream":true')) {
        return new Response(new ReadableStream<Uint8Array>({
          start(controller) { controller.enqueue(new TextEncoder().encode('provider error body')); },
          cancel() { cancelCalls += 1; }
        }), { status: 503 });
      }
      return openAiProbeResponse();
    }) as typeof fetch;
    const { service } = makeService(dir, fetchFn);
    await service.connect({ providerId: 'openai', key: 'sk-http-error-test' });

    await assert.rejects(
      () => service.chatStream('openai', 'gpt-4o-mini', [{ role: 'user', content: 'hello' }], () => {}),
      error => error instanceof ProviderError && error.code === 'CHILD_FAILED' && error.message.includes('busy')
    );
    assert.equal(cancelCalls, 1, 'non-OK provider response body is cancelled');
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('chatStream propagates caller abort and cancels the response reader', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'aide-prov-stream-abort-'));
  try {
    let cancelCalls = 0;
    const fetchFn = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (typeof init?.body === 'string' && init.body.includes('"stream":true')) {
        return new Response(new ReadableStream<Uint8Array>({
          pull() {},
          cancel() { cancelCalls += 1; }
        }), { status: 200 });
      }
      return openAiProbeResponse();
    }) as typeof fetch;
    const { service } = makeService(dir, fetchFn);
    await service.connect({ providerId: 'openai', key: 'sk-abort-test' });
    const controller = new AbortController();
    const pending = service.chatStream('openai', 'gpt-4o-mini', [{ role: 'user', content: 'hello' }], () => {}, { signal: controller.signal });
    setTimeout(() => controller.abort(), 10);
    await assert.rejects(pending, error => error instanceof Error && error.name === 'AbortError');
    assert.equal(cancelCalls, 1, 'aborted response reader is cancelled');
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('chatStream enforces its bounded request timeout and cancels the response reader', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'aide-prov-stream-timeout-'));
  try {
    let cancelCalls = 0;
    const fetchFn = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (typeof init?.body === 'string' && init.body.includes('"stream":true')) {
        return new Response(new ReadableStream<Uint8Array>({
          pull() {},
          cancel() { cancelCalls += 1; }
        }), { status: 200 });
      }
      return openAiProbeResponse();
    }) as typeof fetch;
    const { service } = makeService(dir, fetchFn, undefined, 25);
    await service.connect({ providerId: 'openai', key: 'sk-timeout-test' });
    await assert.rejects(
      () => service.chatStream('openai', 'gpt-4o-mini', [{ role: 'user', content: 'hello' }], () => {}),
      error => error instanceof ProviderError && error.code === 'CHILD_FAILED' && error.message.includes('timed out')
    );
    assert.equal(cancelCalls, 1, 'timed out response reader is cancelled');
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('unknown provider id is rejected', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'aide-prov-'));
  try {
    const { service } = makeService(dir, (() => Promise.resolve(new Response(null, { status: 200 }))) as typeof fetch);
    await assert.rejects(() => service.connect({ providerId: 'nope', key: 'k' }), error => error instanceof ProviderError && error.code === 'NOT_READY');
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('Local-Only guard blocks provider credential probe and chat before fake fetch', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'aide-prov-local-only-'));
  try {
    let localOnly = true;
    let calls = 0;
    const fetchFn = (async () => { calls += 1; return new Response(null, { status: 200 }); }) as typeof fetch;
    const { service } = makeService(dir, fetchFn, () => {
      if (localOnly) throw Object.assign(new Error('external egress blocked by Local-Only'), { code: 'FORBIDDEN' });
    });
    await assert.rejects(() => service.connect({ providerId: 'openai', key: 'fixture-key' }), { code: 'FORBIDDEN' });
    assert.equal(calls, 0, 'blocked provider connection performs no probe');
    assert.equal(await new CredentialStore(dir, new FakeCrypt()).has('openai'), false, 'blocked connect stores no provider credential');

    localOnly = false;
    await service.connect({ providerId: 'openai', key: 'fixture-key' });
    assert.equal(calls, 1);
    localOnly = true;
    await assert.rejects(() => service.chat('openai', 'gpt-fixture', [{ role: 'user', content: 'hello' }]), { code: 'FORBIDDEN' });
    assert.equal(calls, 1, 'blocked chat performs no provider request');
    await assert.rejects(() => service.chatStream('openai', 'gpt-fixture', [{ role: 'user', content: 'hello' }], () => {}), { code: 'FORBIDDEN' });
    assert.equal(calls, 1, 'blocked streaming chat performs no provider request');
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
