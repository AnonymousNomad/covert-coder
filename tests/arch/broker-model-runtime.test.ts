import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { BrokerModelRuntime } from '../../node/src/services/broker-model-runtime.ts';
import { RuntimeBroker, unknownCapabilities, unknownMetrics, type RuntimeAdapter } from '../../node/src/services/runtime-adapter.ts';
import type { RuntimeModelIdentityT, RuntimeStatusResponseT } from '../../common/contracts/runtime.ts';

test('product inventory starts, chats, streams and stops only through canonical Unsloth', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'covert-broker-product-'));
  const modelDir = path.join(dir, 'models');
  const artifact = path.join(modelDir, 'fixture.gguf');
  await mkdir(modelDir);
  await writeFile(artifact, 'model fixture');
  const legacyLedger = path.join(dir, '.aide', 'model-engines.json');
  await mkdir(path.dirname(legacyLedger));
  const legacyEngine = JSON.stringify({ stale: { pid: 999999, file: artifact } });
  await writeFile(legacyLedger, legacyEngine);
  await writeFile(path.join(modelDir, 'manifest.json'), JSON.stringify({ models: [{
    id: 'fixture', name: 'Fixture', status: 'ready', roles: ['chat'], file: artifact,
    endpoint: 'http://127.0.0.1:8083/v1', model: 'fixture.gguf',
    artifact_uri: 'local://fixture.gguf', context_tokens: 2048
  }] }));
  const calls: string[] = [];
  const digest = createHash('sha256').update('model fixture').digest('hex');
  let loaded: RuntimeModelIdentityT | null = null;
  let health: RuntimeStatusResponseT['health'] = 'STOPPED';
  let ownership: RuntimeStatusResponseT['ownership'] = 'UNKNOWN';
  let statusReads = 0;
  const status = (): RuntimeStatusResponseT => ({
    contract_version: 1, canonical_backend: 'UNSLOTH', backend: 'UNSLOTH', version: '2026.9.11', engine: 'vulkan',
    endpoint: 'http://127.0.0.1:18888', port: 18888, pid: health === 'HEALTHY' ? 12 : null,
    started_at: null, health, ownership,
    loaded_model: loaded, capabilities: unknownCapabilities(), metrics: unknownMetrics(),
    last_error: null, fallback_event_id: null, updated_at: new Date().toISOString()
  });
  const adapter = {
    backendId: 'UNSLOTH', discover: async () => {}, health: async () => health,
    status: async () => { statusReads += 1; return status(); }, capabilities: unknownCapabilities,
    models: async () => loaded === null ? [] : [loaded],
    load: async (request: { modelId: string; modelPath: string; contextTokens: number }) => {
      calls.push(`load:${request.modelId}:${request.contextTokens}`);
      assert.equal(request.modelPath, artifact);
      health = 'HEALTHY';
      ownership = 'COVERT_OWNED';
      loaded = { model_id: request.modelId, display_name: 'Fixture', artifact_name: 'fixture.gguf', artifact_sha256: digest, identity_evidence: 'REQUESTED_ARTIFACT' };
      return loaded;
    },
    unload: async (id: string) => { calls.push(`unload:${id}`); loaded = null; },
    infer: async (request: { modelId: string }) => { calls.push(`infer:${request.modelId}`); return {
      text: 'answer', model: loaded!, completionTokens: 2, promptTokens: 3, timingMs: 4, toolCalls: [],
      toolEvidence: { raw_model_output: null, runtime_adjusted_output: null, executed_tool_call: null, attribution: 'UNKNOWN' }, finishReason: 'stop'
    }; },
    stream: async (_request: unknown, onDelta: (delta: string) => void) => {
      calls.push('stream'); onDelta('streamed'); return {
        text: 'streamed', model: loaded!, completionTokens: 1, promptTokens: 2, timingMs: 3, toolCalls: [],
        toolEvidence: { raw_model_output: null, runtime_adjusted_output: null, executed_tool_call: null, attribution: 'UNKNOWN' }, finishReason: 'stop'
      };
    },
    cancel: async () => true, metrics: async () => unknownMetrics(),
    shutdown: async () => { calls.push('shutdown'); health = 'STOPPED'; loaded = null; }
  } as unknown as RuntimeAdapter;
  const runtime = new BrokerModelRuntime({
    workspace: dir, modelDir, manifestPath: path.join(modelDir, 'manifest.json'),
    ingestedPath: path.join(dir, '.aide', 'ingested-models.json'),
    spawnChild: (() => { throw new Error('legacy llama process spawned'); }) as never
  }, new RuntimeBroker(adapter, null, dir), {
    artifactName: 'fixture.gguf', artifactBytes: 'model fixture'.length,
    artifactSha256: digest, backendVersion: '2026.9.11'
  });
  try {
    await runtime.load();
    const readsBeforeProbe = statusReads;
    await runtime.verifyEndpointModel('fixture');
    await runtime.verifyEndpointModel('fixture');
    assert.equal(statusReads - readsBeforeProbe, 1, 'read-only model probes share one brief runtime snapshot');
    assert.equal(runtime.get('fixture')?.endpoint, 'http://127.0.0.1:18888/v1', 'authority target must bind the canonical Unsloth endpoint');
    assert.equal(await readFile(legacyLedger, 'utf8'), legacyEngine, 'Unsloth inventory load must not sweep legacy engine ownership');
    assert.equal((await runtime.status()).models[0]?.status, 'ready');
    assert.equal((await runtime.verifyEndpointModel('fixture')).ready, false);
    await assert.rejects(runtime.chat('fixture', [{ role: 'user', content: 'hello' }]), /not loaded/);
    ownership = 'FOREIGN';
    await assert.rejects(runtime.start('fixture'), /ownership is not verified/);
    assert.equal(calls.length, 0);
    ownership = 'UNKNOWN';
    const started = await runtime.start('fixture');
    assert.equal(started.endpoint, 'http://127.0.0.1:18888/v1');
    assert.equal((await runtime.start('fixture')).endpoint, started.endpoint);
    assert.equal(calls.filter(call => call.startsWith('load:')).length, 1);
    assert.equal((await runtime.status()).models[0]?.status, 'running');
    assert.equal((await runtime.verifyEndpointModel('fixture')).ready, true);
    assert.equal((await runtime.chat('fixture', [{ role: 'user', content: 'hello' }])).text, 'answer');
    let streamed = '';
    await runtime.chatStream('fixture', [{ role: 'user', content: 'hello' }], delta => { streamed += delta; }, new AbortController().signal);
    assert.equal(streamed, 'streamed');
    await runtime.stop('fixture');
    assert.deepEqual(calls, ['load:fixture:2048', 'infer:fixture', 'stream', 'unload:fixture', 'shutdown']);
    assert.equal((await runtime.status()).models[0]?.status, 'ready');
    await writeFile(artifact, 'model changed');
    await assert.rejects(runtime.start('fixture'), /hash differs/);
    assert.equal(calls.filter(call => call.startsWith('load:')).length, 1);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('unavailable Unsloth CLI gives scoped setup guidance in model status', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'covert-broker-setup-'));
  const modelDir = path.join(dir, 'models');
  const artifact = path.join(modelDir, 'fixture.gguf');
  await mkdir(modelDir);
  await writeFile(artifact, 'model fixture');
  const manifestPath = path.join(modelDir, 'manifest.json');
  await writeFile(manifestPath, JSON.stringify({ models: [{
    id: 'fixture', name: 'Fixture', status: 'ready', roles: ['chat'], file: artifact,
    endpoint: 'http://127.0.0.1:18888/v1', model: 'fixture.gguf',
    artifact_uri: 'local://fixture.gguf', context_tokens: 2048
  }] }));
  const unavailable: RuntimeStatusResponseT = {
    contract_version: 1, canonical_backend: 'UNSLOTH', backend: 'UNSLOTH', version: null, engine: null,
    endpoint: 'http://127.0.0.1:18888', port: 18888, pid: null, started_at: null,
    health: 'NOT_INSTALLED', ownership: 'UNKNOWN', loaded_model: null,
    capabilities: unknownCapabilities(), metrics: unknownMetrics(),
    last_error: null, fallback_event_id: null, updated_at: new Date().toISOString()
  };
  const adapter = { backendId: 'UNSLOTH', status: async () => unavailable } as unknown as RuntimeAdapter;
  const runtime = new BrokerModelRuntime({
    workspace: dir, modelDir, manifestPath,
    ingestedPath: path.join(dir, '.aide', 'ingested-models.json')
  }, new RuntimeBroker(adapter, null, dir), {
    artifactName: 'fixture.gguf', artifactBytes: 'model fixture'.length,
    artifactSha256: createHash('sha256').update('model fixture').digest('hex'), backendVersion: '2026.9.11'
  });
  try {
    await runtime.load();
    const state = await runtime.status();
    assert.equal(state.runtime, false);
    assert.equal(state.models[0]?.setup_required, true);
    assert.match(String(state.models[0]?.setup_message), /AIDE_UNSLOTH_CLI/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
