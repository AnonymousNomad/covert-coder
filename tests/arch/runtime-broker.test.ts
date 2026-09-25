import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createServer } from 'node:net';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type {
  RuntimeCapabilityDescriptorT,
  RuntimeHealthT,
  RuntimeMetricsT,
  RuntimeModelIdentityT,
  RuntimeStatusResponseT
} from '../../common/contracts/runtime.ts';
import { RuntimeFallbackEvent, RuntimeStatusResponse, RuntimeToolEvidence } from '../../common/contracts/runtime.ts';
import {
  RuntimeAdapterError,
  RuntimeBroker,
  isRuntimeQualificationCurrent,
  unknownCapabilities,
  unknownMetrics,
  unknownModelIdentity,
  type RuntimeAdapter,
  type RuntimeInferenceRequest,
  type RuntimeInferenceResult,
  type RuntimeLoadRequest
} from '../../node/src/services/runtime-adapter.ts';
import { processIsInTree, UNSLOTH_API_KEY_CREDENTIAL_ID, UnslothRuntimeAdapter, type UnslothRuntimeAdapterOptions } from '../../node/src/services/unsloth-runtime-adapter.ts';
import { LlamaCppRuntimeAdapter } from '../../node/src/services/llama-cpp-runtime-adapter.ts';

const FIXED_TIME = new Date('2026-09-24T16:00:00.000Z');

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
}

function baseStatus(backend: 'UNSLOTH' | 'LLAMA_CPP', health: RuntimeHealthT, loaded: RuntimeModelIdentityT | null = null): RuntimeStatusResponseT {
  return {
    contract_version: 1,
    canonical_backend: 'UNSLOTH',
    backend,
    version: null,
    engine: backend === 'LLAMA_CPP' ? 'llama-server' : null,
    endpoint: null,
    port: null,
    pid: null,
    started_at: null,
    health,
    ownership: backend === 'UNSLOTH' ? 'USER_OWNED' : 'UNKNOWN',
    loaded_model: loaded,
    capabilities: unknownCapabilities(),
    metrics: unknownMetrics(),
    last_error: null,
    fallback_event_id: null,
    updated_at: FIXED_TIME.toISOString()
  };
}

test('Runtime Broker payload schemas preserve UNKNOWN and reject malformed or private fields', () => {
  const status = baseStatus('UNSLOTH', 'UNKNOWN');
  const parsedStatus = RuntimeStatusResponse.parse(status);
  assert.equal(parsedStatus.capabilities.tool_repair, 'UNKNOWN');
  assert.equal(RuntimeStatusResponse.safeParse({ ...status, ownership: 'UNVERIFIED' }).success, false);
  assert.equal(RuntimeStatusResponse.safeParse({ ...status, model_path: 'C:\\private\\fixture.gguf' }).success, false);

  const fallback = {
    event_id: 'runtime-event-1',
    from_backend: 'UNSLOTH' as const,
    to_backend: 'LLAMA_CPP' as const,
    reason: 'operator-authorized recovery',
    explicit_operator_action: true as const,
    model_id: null,
    artifact_sha256: null,
    at: FIXED_TIME.toISOString()
  };
  assert.deepEqual(RuntimeFallbackEvent.parse(fallback), fallback);
  assert.equal(RuntimeFallbackEvent.safeParse({ ...fallback, explicit_operator_action: false }).success, false);

  const toolEvidence = {
    raw_model_output: null,
    runtime_adjusted_output: null,
    executed_tool_call: null,
    attribution: 'UNKNOWN' as const,
    limitation: 'raw output unavailable'
  };
  assert.deepEqual(RuntimeToolEvidence.parse(toolEvidence), toolEvidence);
  assert.equal(RuntimeToolEvidence.safeParse({ ...toolEvidence, attribution: 'REPAIRED' }).success, false);
});

function makeUserServer(fetcher: typeof fetch, overrides: Partial<UnslothRuntimeAdapterOptions> = {}): UnslothRuntimeAdapter {
  return new UnslothRuntimeAdapter({
    workspace: os.tmpdir(),
    endpoint: 'http://127.0.0.1:18888',
    fetcher,
    ...(overrides.authTokenProvider === undefined && overrides.credentialStore === undefined ? { authTokenProvider: async () => null } : {}),
    inspectPort: async () => ({ state: 'UNKNOWN' }),
    findExecutable: async () => null,
    now: () => FIXED_TIME,
    ...overrides
  });
}

async function listenLoopback(): Promise<{ server: ReturnType<typeof createServer>; port: number }> {
  const server = createServer();
  const port = await new Promise<number>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (address === null || typeof address === 'string') {
        reject(new Error('loopback listener did not receive a TCP address'));
        return;
      }
      resolve(address.port);
    });
  });
  return { server, port };
}

async function closeLoopback(server: ReturnType<typeof createServer>): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
  });
}

test('Windows port inspection treats a no-listener result as FREE', { skip: process.platform !== 'win32' }, async () => {
  const { server, port } = await listenLoopback();
  await closeLoopback(server);
  const adapter = new UnslothRuntimeAdapter({
    workspace: os.tmpdir(),
    port,
    findExecutable: async () => null
  });
  await adapter.discover();
  const status = await adapter.status();
  assert.equal(status.health, 'NOT_INSTALLED');
  assert.equal(status.ownership, 'UNKNOWN');
});

test('Windows port inspection identifies and refuses an occupied foreign listener', { skip: process.platform !== 'win32' }, async () => {
  const { server, port } = await listenLoopback();
  const dir = await mkdtemp(path.join(os.tmpdir(), 'covert-unsloth-port-ownership-'));
  const artifact = path.join(dir, 'fixture.gguf');
  let fetchCount = 0;
  let spawnCount = 0;
  try {
    await writeFile(artifact, 'fixture');
    const adapter = new UnslothRuntimeAdapter({
      workspace: dir,
      cliPath: 'unsloth-fixture.exe',
      port,
      findExecutable: async () => null,
      discoverVersion: async () => '2026.9.11',
      fetcher: async () => { fetchCount++; return jsonResponse({}); },
      spawnProcess: (() => { spawnCount++; throw new Error('unexpected spawn'); }) as never
    });
    await adapter.discover();
    const status = await adapter.status();
    assert.equal(status.health, 'UNKNOWN');
    assert.equal(status.ownership, 'FOREIGN');
    assert.equal(status.pid, process.pid);
    await assert.rejects(
      () => adapter.load({ modelId: 'fixture', modelPath: artifact }),
      (error: unknown) => error instanceof RuntimeAdapterError && error.code === 'PORT_CONFLICT'
    );
    await assert.rejects(
      () => adapter.shutdown(true),
      (error: unknown) => error instanceof RuntimeAdapterError && error.code === 'OWNERSHIP_UNVERIFIED'
    );
    assert.equal(fetchCount, 0);
    assert.equal(spawnCount, 0);
    assert.equal(server.listening, true);
  } finally {
    if (server.listening) await closeLoopback(server);
    await rm(dir, { recursive: true, force: true });
  }
});

test('Unsloth absence and a stopped installed CLI are detected without contacting a runtime', async () => {
  let fetchCount = 0;
  let spawnCount = 0;
  const absent = new UnslothRuntimeAdapter({
    workspace: os.tmpdir(),
    findExecutable: async () => null,
    fetcher: async () => { fetchCount++; return jsonResponse({}); },
    inspectPort: async () => ({ state: 'FREE' }),
    spawnProcess: (() => { spawnCount++; throw new Error('unexpected spawn'); }) as never,
    now: () => FIXED_TIME
  });
  await absent.discover();
  assert.equal(await absent.health(), 'NOT_INSTALLED');
  const absentStatus = await absent.status();
  assert.equal(absentStatus.version, null);
  assert.equal(absentStatus.ownership, 'UNKNOWN');

  const stopped = new UnslothRuntimeAdapter({
    workspace: os.tmpdir(),
    cliPath: path.join(os.tmpdir(), 'unsloth-fixture.exe'),
    findExecutable: async () => path.join(os.tmpdir(), 'unsloth-fixture.exe'),
    discoverVersion: async () => '2026.09.24',
    inspectPort: async () => ({ state: 'FREE' }),
    fetcher: async () => { fetchCount++; return jsonResponse({}); },
    spawnProcess: (() => { spawnCount++; throw new Error('unexpected spawn'); }) as never,
    now: () => FIXED_TIME
  });
  await stopped.discover();
  assert.equal(await stopped.health(), 'STOPPED');
  assert.equal((await stopped.status()).version, '2026.09.24');
  assert.equal(fetchCount, 0);
  assert.equal(spawnCount, 0);
});

test('process-tree ownership distinguishes descendant, foreign, and unverifiable ancestry', async () => {
  const parents = new Map<number, number | null>([[11, 10], [12, 11], [21, 20], [20, 1], [1, 0], [31, null], [41, 42], [42, 41]]);
  const parentPidOf = async (pid: number): Promise<number | null> => parents.get(pid) ?? null;
  assert.equal(await processIsInTree(10, 12, parentPidOf), true);
  assert.equal(await processIsInTree(10, 21, parentPidOf), false);
  assert.equal(await processIsInTree(10, 31, parentPidOf), null);
  assert.equal(await processIsInTree(40, 41, parentPidOf), null);
});

test('an installed but unhealthy Unsloth server is not queried for model enumeration', async () => {
  let modelRequests = 0;
  const adapter = makeUserServer(async input => {
    const pathname = new URL(String(input)).pathname;
    if (pathname === '/api/health') return jsonResponse({ service: 'not Unsloth' });
    modelRequests++;
    return jsonResponse({ data: [] });
  });
  await adapter.discover();
  assert.equal(await adapter.health(), 'UNHEALTHY');
  assert.deepEqual(await adapter.models(), []);
  assert.equal(modelRequests, 0);
});

test('Unsloth bearer auth reads the dedicated credential slot without exposing the key', async () => {
  const secret = 'sk-unsloth-test-secret';
  let requestedSlot = '';
  let authorization = '';
  const adapter = makeUserServer(async (input, init) => {
    const pathname = new URL(String(input)).pathname;
    if (pathname === '/api/health') return jsonResponse({ service: 'Unsloth UI Backend' });
    authorization = new Headers(init?.headers).get('Authorization') ?? '';
    return jsonResponse({ data: [{ id: 'default' }] });
  }, {
    credentialStore: {
      get: async slot => {
        requestedSlot = slot;
        return secret;
      }
    }
  });
  await adapter.discover();
  assert.equal((await adapter.models())[0]?.model_id, 'default');
  assert.equal(requestedSlot, UNSLOTH_API_KEY_CREDENTIAL_ID);
  assert.equal(authorization, `Bearer ${secret}`);
  assert.equal(JSON.stringify(await adapter.status()).includes(secret), false);
});

test('Unsloth reports authentication failures explicitly for discovery, load, and inference', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'covert-unsloth-auth-'));
  const artifact = path.join(dir, 'fixture.gguf');
  await writeFile(artifact, 'fixture');
  let rejectLoad = true;
  const adapter = makeUserServer(async input => {
    const pathname = new URL(String(input)).pathname;
    if (pathname === '/api/health') return jsonResponse({ service: 'Unsloth UI Backend' });
    if (pathname === '/api/inference/load' && !rejectLoad) return jsonResponse({ completed: true });
    if (pathname === '/api/inference/unload') return jsonResponse({ detail: 'denied' }, 401);
    return jsonResponse({ detail: 'denied' }, 401);
  }, { authTokenProvider: async () => null });
  try {
    await adapter.discover();
    await assert.rejects(() => adapter.models(), (error: unknown) => error instanceof RuntimeAdapterError && error.code === 'AUTH_REQUIRED');
    await assert.rejects(() => adapter.load({ modelId: 'm', modelPath: artifact }, true), (error: unknown) => error instanceof RuntimeAdapterError && error.code === 'AUTH_REQUIRED');
    rejectLoad = false;
    await adapter.load({ modelId: 'm', modelPath: artifact }, true);
    await assert.rejects(() => adapter.unload('m', true), (error: unknown) => error instanceof RuntimeAdapterError && error.code === 'AUTH_REQUIRED');
    await assert.rejects(() => adapter.infer({ modelId: 'm', messages: [] }), (error: unknown) => error instanceof RuntimeAdapterError && error.code === 'AUTH_REQUIRED');
    assert.equal(JSON.stringify(await adapter.status()).includes('denied'), false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('Unsloth loopback API health, model list, local artifact identity, inference, streaming, and tool evidence', async () => {
  const calls: Array<{ url: string; method: string; body: string | null }> = [];
  const fetcher: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    const method = init?.method ?? 'GET';
    calls.push({ url: `${url.origin}${url.pathname}`, method, body: typeof init?.body === 'string' ? init.body : null });
    if (url.pathname === '/api/health') return jsonResponse({ service: 'Unsloth UI Backend' });
    if (url.pathname === '/v1/models') return jsonResponse({ data: [{ id: 'default' }] });
    if (url.pathname === '/api/inference/load' || url.pathname === '/api/inference/unload') return jsonResponse({ completed: true });
    if (url.pathname === '/v1/chat/completions' && init?.headers instanceof Headers && init.headers.get('Accept') === 'text/event-stream') {
      const body = 'data: {"choices":[{"delta":{"content":"streamed"}}]}\n\ndata: [DONE]\n\n';
      return new Response(new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode(body)); controller.close(); } }), { headers: { 'Content-Type': 'text/event-stream' } });
    }
    if (url.pathname === '/v1/chat/completions') {
      return jsonResponse({ choices: [{ message: { content: 'answer', tool_calls: [{ id: 'call-1', function: { name: 'read_file', arguments: '{"path":"x"}' } }] }, finish_reason: 'tool_calls' }], usage: { prompt_tokens: 9, completion_tokens: 4 } });
    }
    return jsonResponse({ error: 'unexpected path' }, 404);
  };
  const dir = await mkdtemp(path.join(os.tmpdir(), 'covert-unsloth-adapter-'));
  const artifact = path.join(dir, 'fixture.gguf');
  try {
    await writeFile(artifact, 'fixed artifact bytes');
    const adapter = makeUserServer(fetcher);
    await adapter.discover();
    assert.equal(await adapter.health(), 'HEALTHY');
    const capability = adapter.capabilities();
    assert.equal(capability.api_chat_completions, 'PARTIAL');
    assert.equal(capability.streaming, 'PARTIAL');
    assert.equal(capability.tool_repair, 'UNKNOWN');
    assert.equal(capability.structured_output, 'UNKNOWN');
    const models = await adapter.models();
    assert.equal(models[0]?.model_id, 'default');
    assert.equal(models[0]?.artifact_sha256, null);

    const loaded = await adapter.load({ modelId: 'fixture-model', modelPath: artifact, contextTokens: 2048 }, true);
    assert.equal(loaded.identity_evidence, 'REQUESTED_ARTIFACT');
    assert.match(loaded.artifact_sha256 ?? '', /^[a-f0-9]{64}$/);
    const result = await adapter.infer({ modelId: 'fixture-model', messages: [{ role: 'user', content: 'call a tool' }], tools: [{ type: 'function' }] });
    assert.equal(result.text, 'answer');
    assert.equal(result.toolCalls.length, 1);
    assert.equal(result.toolEvidence.attribution, 'UNKNOWN');
    assert.equal(result.toolEvidence.raw_model_output, null);
    assert.deepEqual(await adapter.metrics(), { ram_bytes: null, vram_bytes: null, windows_commit_bytes: null, loaded_model_bytes: null, context_tokens: null, source: 'UNKNOWN' });

    let streamed = '';
    await adapter.stream({ modelId: 'fixture-model', messages: [{ role: 'user', content: 'stream' }] }, delta => { streamed += delta; }, new AbortController().signal);
    assert.equal(streamed, 'streamed');
    const beforeUnknown = calls.length;
    await assert.rejects(
      () => adapter.infer({ modelId: 'fixture-model', messages: [], responseFormat: { type: 'json_schema' } }),
      (error: unknown) => error instanceof RuntimeAdapterError && error.code === 'CAPABILITY_UNKNOWN'
    );
    assert.equal(calls.length, beforeUnknown, 'unknown structured output is rejected before any API request');

    const secondArtifact = path.join(dir, 'fixture-switched.gguf');
    await writeFile(secondArtifact, 'second fixed artifact bytes');
    const switched = await adapter.load({ modelId: 'fixture-model-switched', modelPath: secondArtifact, contextTokens: 1024 }, true);
    const switchedStatus = await adapter.status();
    assert.equal(switchedStatus.loaded_model?.model_id, 'fixture-model-switched');
    assert.equal(switchedStatus.loaded_model?.artifact_sha256, switched.artifact_sha256);
    assert.notEqual(switched.artifact_sha256, loaded.artifact_sha256);

    const beforeUnload = calls.length;
    await assert.rejects(() => adapter.unload('fixture-model-switched'), (error: unknown) => error instanceof RuntimeAdapterError && error.code === 'OPERATOR_ACTION_REQUIRED');
    await adapter.unload('fixture-model-switched', true);
    await assert.rejects(() => adapter.shutdown(), (error: unknown) => error instanceof RuntimeAdapterError && error.code === 'OPERATOR_ACTION_REQUIRED');
    await assert.rejects(() => adapter.shutdown(true), (error: unknown) => error instanceof RuntimeAdapterError && error.code === 'USER_RUNTIME_STOP_UNAVAILABLE');
    assert.ok(calls.slice(beforeUnload).some(call => call.url.endsWith('/api/inference/unload')));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('port conflict and unknown ownership fail closed without endpoint requests or process control', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'covert-unsloth-port-'));
  const artifact = path.join(dir, 'fixture.gguf');
  await writeFile(artifact, 'fixture');
  let requests = 0;
  let spawns = 0;
  try {
    const conflict = new UnslothRuntimeAdapter({
      workspace: dir,
      cliPath: path.join(dir, 'unsloth.exe'),
      findExecutable: async () => path.join(dir, 'unsloth.exe'),
      discoverVersion: async () => '1.2.0',
      inspectPort: async () => ({ state: 'LISTENING', pid: 43991 }),
      fetcher: async () => { requests++; return jsonResponse({ service: 'Unsloth UI Backend' }); },
      spawnProcess: (() => { spawns++; throw new Error('must not spawn'); }) as never,
      now: () => FIXED_TIME
    });
    await assert.rejects(() => conflict.load({ modelId: 'm', modelPath: artifact }), (error: unknown) => error instanceof RuntimeAdapterError && error.code === 'PORT_CONFLICT');
    assert.equal(requests, 0);
    assert.equal(spawns, 0);
    const status = await conflict.status();
    assert.equal(status.ownership, 'FOREIGN');
    assert.equal(status.pid, 43991);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('Covert-owned Unsloth child listener is recognized and shutdown is ownership-gated', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'covert-unsloth-owned-tree-'));
  const artifact = path.join(dir, 'fixture.gguf');
  await writeFile(artifact, 'owned fixture');
  let portState: 'FREE' | 'LISTENING' = 'FREE';
  let requests = 0;
  let terminateCalls = 0;
  let launchArgs: string[] = [];
  const fakeChild = Object.assign(new EventEmitter(), { pid: 50001, exitCode: null as number | null, kill: () => true });
  try {
    const adapter = new UnslothRuntimeAdapter({
      workspace: dir,
      cliPath: path.join(dir, 'unsloth.exe'),
      findExecutable: async () => path.join(dir, 'unsloth.exe'),
      discoverVersion: async () => '2026.09.24',
      inspectPort: async () => portState === 'FREE' ? { state: 'FREE' } : { state: 'LISTENING', pid: 50002 },
      processTreeContains: async (rootPid, targetPid) => rootPid === 50001 && targetPid === 50002,
      fetcher: async input => {
        requests++;
        if (new URL(String(input)).pathname === '/api/health') return jsonResponse({ service: 'Unsloth UI Backend' });
        if (new URL(String(input)).pathname === '/api/inference/load' || new URL(String(input)).pathname === '/api/inference/unload') return jsonResponse({ completed: true });
        return jsonResponse({});
      },
      spawnProcess: ((command: string, args: string[], options: { env?: NodeJS.ProcessEnv }) => {
        assert.equal(command, path.join(dir, 'unsloth.exe'));
        launchArgs = args;
        assert.equal(options.env?.UNSLOTH_API_ONLY, '1');
        assert.equal(options.env?._UNSLOTH_CLOUDFLARE_INTENT, 'disabled');
        portState = 'LISTENING';
        return fakeChild;
      }) as never,
      terminateProcessTree: async (child, pid) => {
        assert.equal(child, fakeChild);
        assert.equal(pid, 50001);
        terminateCalls++;
        portState = 'FREE';
        fakeChild.exitCode = 0;
        fakeChild.emit('exit', 0, null);
      },
      startupTimeoutMs: 1000,
      now: () => FIXED_TIME
    });
    const loaded = await adapter.load({ modelId: 'owned-model', modelPath: artifact });
    assert.match(loaded.artifact_sha256 ?? '', /^[a-f0-9]{64}$/);
    assert.ok(launchArgs.includes('--api-only'));
    assert.ok(!launchArgs.includes('--disable-tools'));
    assert.equal((await adapter.status()).ownership, 'COVERT_OWNED');
    assert.equal((await adapter.status()).pid, 50002, 'status reports the listener PID, not only the CLI parent PID');
    await adapter.shutdown();
    assert.equal(terminateCalls, 1);
    assert.equal((await adapter.status()).health, 'STOPPED');
    assert.ok(requests > 0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

class AdapterStub implements RuntimeAdapter {
  private loaded: RuntimeModelIdentityT | null = null;
  private readonly state: RuntimeHealthT;
  readonly backendId: 'UNSLOTH' | 'LLAMA_CPP';
  constructor(backend: 'UNSLOTH' | 'LLAMA_CPP', state: RuntimeHealthT) {
    this.backendId = backend;
    this.state = state;
  }
  async discover(): Promise<void> {}
  async health(): Promise<RuntimeHealthT> { return this.state; }
  capabilities(): RuntimeCapabilityDescriptorT { return unknownCapabilities(); }
  async models(): Promise<RuntimeModelIdentityT[]> { return this.loaded ? [this.loaded] : []; }
  async load(request: RuntimeLoadRequest): Promise<RuntimeModelIdentityT> { this.loaded = { ...unknownModelIdentity(request.modelId), identity_evidence: 'REQUESTED_ARTIFACT' }; return this.loaded; }
  async unload(): Promise<void> { this.loaded = null; }
  async infer(request: RuntimeInferenceRequest): Promise<RuntimeInferenceResult> {
    if (this.state !== 'HEALTHY') throw new RuntimeAdapterError('UNHEALTHY', 'stub backend unhealthy');
    return { text: 'ok', model: this.loaded ?? unknownModelIdentity(request.modelId), promptTokens: null, completionTokens: null, timingMs: 0, toolCalls: [], toolEvidence: { raw_model_output: null, runtime_adjusted_output: null, executed_tool_call: null, attribution: 'UNKNOWN', limitation: null }, finishReason: null };
  }
  async stream(): Promise<RuntimeInferenceResult> { return this.infer({ modelId: 'm', messages: [] }); }
  async cancel(): Promise<boolean> { return false; }
  async metrics(): Promise<RuntimeMetricsT> { return unknownMetrics(); }
  async shutdown(): Promise<void> {}
  async status(): Promise<RuntimeStatusResponseT> { return { ...baseStatus(this.backendId, this.state, this.loaded), ownership: 'UNKNOWN' }; }
}

test('Runtime Broker does not fall back silently and journals only an explicit recovery selection', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'covert-runtime-broker-'));
  const canonical = new AdapterStub('UNSLOTH', 'UNHEALTHY');
  const recovery = new AdapterStub('LLAMA_CPP', 'STOPPED');
  const broker = new RuntimeBroker(canonical, recovery, dir);
  try {
    await assert.rejects(() => broker.infer({ modelId: 'm', messages: [] }));
    assert.equal(broker.selectedBackend, 'UNSLOTH');
    await assert.rejects(() => broker.activateLlamaRecovery('diagnostic recovery', false), (error: unknown) => error instanceof RuntimeAdapterError && error.code === 'OPERATOR_ACTION_REQUIRED');
    assert.equal(broker.selectedBackend, 'UNSLOTH');
    const eventId = await broker.activateLlamaRecovery('diagnostic recovery', true);
    assert.equal(broker.selectedBackend, 'LLAMA_CPP');
    const entries = (await readFile(path.join(dir, '.aide', 'runtime-events.jsonl'), 'utf8')).trim().split('\n').map(line => JSON.parse(line) as { event_id: string; to_backend: string; explicit_operator_action: boolean });
    assert.equal(entries.length, 1);
    assert.equal(entries[0]?.event_id, eventId);
    assert.equal(entries[0]?.to_backend, 'LLAMA_CPP');
    assert.equal(entries[0]?.explicit_operator_action, true);
    assert.equal((await broker.status()).fallback_event_id, eventId);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('artifact hash changes invalidate the previous runtime identity', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'covert-runtime-hash-'));
  const artifact = path.join(dir, 'model.gguf');
  const secondArtifact = path.join(dir, 'second-model.gguf');
  try {
    await writeFile(artifact, 'artifact version one');
    await writeFile(secondArtifact, 'second model artifact');
    const adapter = makeUserServer(async input => {
      const pathname = new URL(String(input)).pathname;
      if (pathname === '/api/health') return jsonResponse({ service: 'Unsloth UI Backend' });
      if (pathname === '/api/inference/load') return jsonResponse({ completed: true });
      return jsonResponse({});
    });
    const first = await adapter.load({ modelId: 'model', modelPath: artifact }, true);
    await writeFile(artifact, 'artifact version two');
    const second = await adapter.load({ modelId: 'model', modelPath: artifact }, true);
    assert.notEqual(first.artifact_sha256, second.artifact_sha256);
    assert.equal((await adapter.status()).loaded_model?.artifact_sha256, second.artifact_sha256);
    const switched = await adapter.load({ modelId: 'second-model', modelPath: secondArtifact }, true);
    assert.equal(switched.model_id, 'second-model');
    assert.equal((await adapter.status()).loaded_model?.model_id, 'second-model');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('runtime qualification fails closed after backend revision, artifact change, or unknown identity', () => {
  const identity: RuntimeModelIdentityT = { model_id: 'm', display_name: null, artifact_name: 'm.gguf', artifact_sha256: 'a'.repeat(64), identity_evidence: 'REQUESTED_ARTIFACT' };
  const current = { ...baseStatus('UNSLOTH', 'HEALTHY', identity), version: '2026.09.24' };
  const qualification = { backend: 'UNSLOTH' as const, backendVersion: '2026.09.24', artifactSha256: 'a'.repeat(64) };
  assert.equal(isRuntimeQualificationCurrent(qualification, current), true);
  assert.equal(isRuntimeQualificationCurrent(qualification, { ...current, version: '2026.09.25' }), false);
  assert.equal(isRuntimeQualificationCurrent(qualification, { ...current, loaded_model: { ...identity, artifact_sha256: 'b'.repeat(64) } }), false);
  assert.equal(isRuntimeQualificationCurrent(qualification, { ...current, loaded_model: { ...identity, artifact_sha256: null } }), false);
  assert.equal(isRuntimeQualificationCurrent({ ...qualification, backendVersion: '' }, current), false);
});

test('direct llama.cpp recovery lifecycle controls only its retained owned process', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'covert-llama-adapter-'));
  const artifact = path.join(dir, 'reference.gguf');
  await writeFile(artifact, 'reference artifact');
  const model = {
    id: 'reference-model', name: 'Reference Model', status: 'ready', roles: ['chat'],
    endpoint: 'http://127.0.0.1:19001/v1', model: 'reference.gguf', artifact_uri: `local://${artifact}`,
    context_tokens: 1024, file: artifact
  };
  let owned = false;
  let stopCalls = 0;
  const adapter = new LlamaCppRuntimeAdapter({
    workspace: dir,
    listModels: () => [model],
    getModel: id => id === model.id ? model : undefined,
    isOwned: () => owned,
    pidForModel: () => owned ? 12345 : null,
    engineName: () => 'llama-server',
    start: async id => { owned = true; return { id, status: 'running', endpoint: model.endpoint }; },
    waitReady: async () => true,
    stop: async id => { assert.equal(owned, true); stopCalls++; owned = false; return { id, status: 'stopped' }; },
    chat: async id => ({ text: 'reference', modelId: id, timingMs: 1 }),
    chatStream: async (_id, _messages, onDelta) => { onDelta('reference'); },
    available: async () => true,
    now: () => FIXED_TIME
  });
  try {
    await assert.rejects(() => adapter.unload(model.id), (error: unknown) => error instanceof RuntimeAdapterError && error.code === 'OWNERSHIP_UNVERIFIED');
    await adapter.load({ modelId: model.id, modelPath: artifact });
    const active = await adapter.status();
    assert.equal(active.ownership, 'COVERT_OWNED');
    assert.equal(active.pid, 12345);
    await adapter.unload(model.id);
    assert.equal(stopCalls, 1);
    assert.equal(owned, false);

    await adapter.shutdown();
    assert.equal(stopCalls, 1, 'shutdown with no owned process does not stop a foreign process');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
