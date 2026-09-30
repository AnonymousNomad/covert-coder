import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { BrokerModelRuntime } from '../../node/src/services/broker-model-runtime.ts';
import { createResourceAdmission } from '../../node/src/services/resource-admission.ts';
import { RuntimeAdapterError, RuntimeBroker, unknownCapabilities, unknownMetrics, type RuntimeAdapter } from '../../node/src/services/runtime-adapter.ts';
import type { RuntimeModelIdentityT, RuntimeStatusResponseT } from '../../common/contracts/runtime.ts';

function admittedLocalStart() {
  return createResourceAdmission({
    memoryProbeMB: () => 7000,
    vramProbeMB: async () => 5000,
    commitProbeMB: async () => 6000,
    gpuUtilizationProbePercent: async () => 10,
    loadProbe: () => 0
  });
}

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
  const loadedOptions: Array<{ contextTokens?: number; generationDefaults?: { maxTokens?: number; temperature?: number } }> = [];
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
    load: async (request: { modelId: string; modelPath: string; contextTokens: number; generationDefaults?: { maxTokens?: number; temperature?: number } }) => {
      calls.push(`load:${request.modelId}:${request.contextTokens}:${request.generationDefaults?.maxTokens}:${request.generationDefaults?.temperature}`);
      loadedOptions.push({
        contextTokens: request.contextTokens,
        ...(request.generationDefaults === undefined ? {} : { generationDefaults: request.generationDefaults })
      });
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
  }, admittedLocalStart());
  try {
    await runtime.load();
    await assert.rejects(() => runtime.saveProfile('fixture', { preset: 'balanced' }), /unsupported sampler/);
    await assert.rejects(() => runtime.start('fixture'), /Authority-saved runtime profile is required/);
    assert.equal(calls.length, 0, 'missing model-specific profile refuses before the broker load');
    const beforeProfile = (await runtime.status()).models[0];
    assert.equal(beforeProfile?.status, 'pending', 'an artifact without its required runtime profile is not reported ready');
    assert.equal(beforeProfile?.setup_required, true);
    assert.match(String(beforeProfile?.setup_message), /Authority-saved exact-artifact Unsloth profile required/);
    await writeFile(`${artifact}.profile.json`, JSON.stringify({
      preset: 'legacy-balanced', samplers: { temperature: 0.6, top_p: 0.9 }, runtime: { backend: 'llama.cpp', ngl: 24 }
    }));
    const saved = await runtime.saveProfile('fixture', {
      preset: 'custom', samplers: { temperature: 0 }, runtime: { context_tokens: 1536, max_tokens: 64 }
    });
    assert.equal(saved.saved, true);
    const savedProfile = JSON.parse(await readFile(`${artifact}.profile.json`, 'utf8')) as {
      binding?: { artifact_sha256?: string; runtime_id?: string; runtime_version?: string };
      runtime?: Record<string, number>;
      samplers?: Record<string, number>;
      legacy_unbound?: { previous_profile?: { preset?: string; samplers?: Record<string, number>; runtime?: Record<string, number | string> } };
    };
    assert.deepEqual(savedProfile.binding, { artifact_sha256: digest, runtime_id: 'UNSLOTH', runtime_version: '2026.9.11' });
    assert.equal(savedProfile.runtime?.context_tokens, 1536);
    assert.equal(savedProfile.runtime?.max_tokens, 64);
    assert.equal(savedProfile.samplers?.temperature, 0);
    assert.deepEqual(savedProfile.legacy_unbound?.previous_profile, {
      schema_version: null,
      binding: null,
      preset: 'legacy-balanced',
      samplers: { temperature: 0.6, top_p: 0.9 },
      runtime: { backend: 'llama.cpp', ngl: 24 }
    }, 'prior unbound settings are preserved as inert history, not reinterpreted as Unsloth configuration');
    const configuredStatus = (await runtime.status()).models[0];
    assert.equal(configuredStatus?.status, 'ready');
    assert.equal(configuredStatus?.setup_required, false);
    assert.equal(runtime.get('fixture')?.context_tokens, 2048, 'passive status must not apply or mutate the saved runtime context');
    const readsBeforeProbe = statusReads;
    await runtime.verifyEndpointModel('fixture');
    await runtime.verifyEndpointModel('fixture');
    assert.ok(statusReads - readsBeforeProbe <= 1, 'read-only model probes reuse or share one brief runtime snapshot');
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
    assert.equal(runtime.get('fixture')?.context_tokens, 1536, 'start applies the validated runtime profile context');
    assert.equal((await runtime.start('fixture')).endpoint, started.endpoint);
    assert.equal(calls.filter(call => call.startsWith('load:')).length, 1);
    assert.deepEqual(loadedOptions[0], { contextTokens: 1536, generationDefaults: { temperature: 0, maxTokens: 64 } });
    assert.equal((await runtime.status()).models[0]?.status, 'running');
    assert.equal((await runtime.verifyEndpointModel('fixture')).ready, true);
    assert.equal((await runtime.chat('fixture', [{ role: 'user', content: 'hello' }])).text, 'answer');
    let streamed = '';
    await runtime.chatStream('fixture', [{ role: 'user', content: 'hello' }], delta => { streamed += delta; }, new AbortController().signal);
    assert.equal(streamed, 'streamed');
    await runtime.stop('fixture');
    assert.equal((await runtime.status()).models[0]?.status, 'ready');
    await runtime.start('fixture');
    assert.deepEqual(loadedOptions[1], { contextTokens: 1536, generationDefaults: { temperature: 0, maxTokens: 64 } }, 'restart reapplies the exact saved model profile');
    assert.equal((await runtime.chat('fixture', [{ role: 'user', content: 'second generation after restart' }])).text, 'answer');
    await runtime.stop('fixture');
    assert.deepEqual(calls, [
      'load:fixture:1536:64:0', 'infer:fixture', 'stream', 'unload:fixture', 'shutdown',
      'load:fixture:1536:64:0', 'infer:fixture', 'unload:fixture', 'shutdown'
    ]);
    const loadsBeforeArtifactMutation = calls.filter(call => call.startsWith('load:')).length;
    assert.equal(loadsBeforeArtifactMutation, 2, 'the same exact profile was loaded once before and once after restart');
    await writeFile(artifact, 'model changed');
    await assert.rejects(runtime.start('fixture'), /hash differs/);
    assert.equal(calls.filter(call => call.startsWith('load:')).length, loadsBeforeArtifactMutation, 'changed artifact is rejected before another load');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('failed or unverifiable model starts stop only a freshly confirmed Covert-owned runtime', async () => {
  const digest = createHash('sha256').update('model fixture').digest('hex');
  const scenarios = [
    { name: 'model-load failure', owner: 'COVERT_OWNED' as const, identityMismatch: false, shutdownFails: false, expected: /fixture model load failed/, shutdowns: 1 },
    { name: 'user-owned model-load failure', owner: 'USER_OWNED' as const, identityMismatch: false, shutdownFails: false, expected: /fixture model load failed/, shutdowns: 0 },
    { name: 'post-load identity mismatch', owner: 'COVERT_OWNED' as const, identityMismatch: true, shutdownFails: false, expected: /did not confirm the loaded model/, shutdowns: 1 },
    { name: 'owned cleanup failure', owner: 'COVERT_OWNED' as const, identityMismatch: false, shutdownFails: true, expected: /cleanup of the Covert-owned runtime could not be confirmed/, shutdowns: 1 }
  ];

  for (const scenario of scenarios) {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'covert-broker-failed-start-'));
    const modelDir = path.join(dir, 'models');
    const artifact = path.join(modelDir, 'fixture.gguf');
    await mkdir(modelDir);
    await writeFile(artifact, 'model fixture');
    const manifestPath = path.join(modelDir, 'manifest.json');
    await writeFile(manifestPath, JSON.stringify({ models: [{
      id: 'fixture', name: 'Fixture', status: 'ready', roles: ['chat'], file: artifact,
      endpoint: 'http://127.0.0.1:8083/v1', model: 'fixture.gguf',
      artifact_uri: 'local://fixture.gguf', context_tokens: 2048
    }] }));

    let health: RuntimeStatusResponseT['health'] = 'STOPPED';
    let ownership: RuntimeStatusResponseT['ownership'] = 'UNKNOWN';
    let loaded: RuntimeModelIdentityT | null = null;
    let shutdowns = 0;
    const adapter = {
      backendId: 'UNSLOTH', discover: async () => {}, health: async () => health,
      status: async (): Promise<RuntimeStatusResponseT> => ({
        contract_version: 1, canonical_backend: 'UNSLOTH', backend: 'UNSLOTH', version: '2026.9.11', engine: 'vulkan',
        endpoint: 'http://127.0.0.1:18888', port: 18888, pid: health === 'HEALTHY' ? 12 : null,
        started_at: null, health, ownership, loaded_model: loaded,
        capabilities: unknownCapabilities(), metrics: unknownMetrics(), last_error: null,
        fallback_event_id: null, updated_at: new Date().toISOString()
      }),
      capabilities: unknownCapabilities, models: async () => loaded === null ? [] : [loaded],
      load: async () => {
        health = 'HEALTHY';
        ownership = scenario.owner;
        if (scenario.identityMismatch) {
          loaded = { model_id: 'fixture', display_name: 'Fixture', artifact_name: 'fixture.gguf', artifact_sha256: 'f'.repeat(64), identity_evidence: 'REQUESTED_ARTIFACT' };
          return loaded;
        }
        throw new RuntimeAdapterError('MODEL_LOAD_FAILED', 'fixture model load failed');
      },
      unload: async () => { loaded = null; },
      infer: async () => { throw new Error('unexpected inference'); },
      stream: async () => { throw new Error('unexpected stream'); },
      cancel: async () => false, metrics: async () => unknownMetrics(),
      shutdown: async () => {
        shutdowns += 1;
        if (scenario.shutdownFails) throw new RuntimeAdapterError('SHUTDOWN_UNCONFIRMED', 'fixture shutdown failure');
        health = 'STOPPED'; ownership = 'UNKNOWN'; loaded = null;
      }
    } as unknown as RuntimeAdapter;
    const runtime = new BrokerModelRuntime({
      workspace: dir, modelDir, manifestPath, ingestedPath: path.join(dir, '.aide', 'ingested-models.json')
    }, new RuntimeBroker(adapter, null, dir), {
      artifactName: 'fixture.gguf', artifactBytes: 'model fixture'.length, artifactSha256: digest, backendVersion: '2026.9.11'
    }, admittedLocalStart());

    try {
      await runtime.load();
      await runtime.saveProfile('fixture', {
        preset: 'custom', samplers: { temperature: 0 }, runtime: { context_tokens: 2048, max_tokens: 64 }
      });
      let startFailure: unknown;
      try {
        await runtime.start('fixture');
      } catch (error) {
        startFailure = error;
      }
      assert.ok(startFailure instanceof Error, `${scenario.name}: start failure is propagated`);
      assert.match(startFailure.message, scenario.expected, scenario.name);
      assert.equal(shutdowns, scenario.shutdowns, `${scenario.name}: shutdown count`);
      if (scenario.shutdownFails) {
        assert.deepEqual((startFailure as { detail?: unknown }).detail, {
          startErrorCode: 'MODEL_LOAD_FAILED',
          cleanupErrorCode: 'SHUTDOWN_UNCONFIRMED'
        }, 'the start and cleanup failure codes remain independently diagnosable');
        assert.equal((await runtime.runtimeStatusSnapshot()).ownership, 'COVERT_OWNED', 'failed cleanup remains visible for recovery');
      } else if (scenario.owner === 'COVERT_OWNED') {
        assert.equal((await runtime.runtimeStatusSnapshot()).health, 'STOPPED', 'owned runtime is released after start failure');
      } else {
        assert.equal((await runtime.runtimeStatusSnapshot()).ownership, 'USER_OWNED', 'user-owned runtime is preserved');
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }
});

test('canonical broker repeats local admission after artifact verification and before load', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'covert-broker-final-admission-'));
  const modelDir = path.join(dir, 'models');
  const artifact = path.join(modelDir, 'fixture.gguf');
  await mkdir(modelDir);
  await writeFile(artifact, 'model fixture');
  const manifestPath = path.join(modelDir, 'manifest.json');
  await writeFile(manifestPath, JSON.stringify({ models: [{
    id: 'fixture', name: 'Fixture', status: 'ready', roles: ['chat'], file: artifact,
    endpoint: 'http://127.0.0.1:8083/v1', model: 'fixture.gguf',
    artifact_uri: 'local://fixture.gguf', context_tokens: 2048
  }] }));
  let loadCalls = 0;
  const digest = createHash('sha256').update('model fixture').digest('hex');
  const adapter = {
    backendId: 'UNSLOTH', discover: async () => {}, health: async () => 'STOPPED',
    status: async (): Promise<RuntimeStatusResponseT> => ({
      contract_version: 1, canonical_backend: 'UNSLOTH', backend: 'UNSLOTH', version: '2026.9.11', engine: 'vulkan',
      endpoint: 'http://127.0.0.1:18888', port: 18888, pid: null, started_at: null,
      health: 'STOPPED', ownership: 'UNKNOWN', loaded_model: null,
      capabilities: unknownCapabilities(), metrics: unknownMetrics(), last_error: null,
      fallback_event_id: null, updated_at: new Date().toISOString()
    }),
    capabilities: unknownCapabilities, models: async () => [],
    load: async () => { loadCalls += 1; throw new Error('must not load below the final floor'); },
    unload: async () => {}, infer: async () => { throw new Error('unexpected inference'); },
    stream: async () => { throw new Error('unexpected stream'); }, cancel: async () => false,
    metrics: async () => unknownMetrics(), shutdown: async () => {}
  } as unknown as RuntimeAdapter;
  const finalAdmission = createResourceAdmission({
    memoryProbeMB: () => 6655, vramProbeMB: async () => 5000, commitProbeMB: async () => 6000,
    gpuUtilizationProbePercent: async () => 10, loadProbe: () => 0
  });
  const runtime = new BrokerModelRuntime({
    workspace: dir, modelDir, manifestPath, ingestedPath: path.join(dir, '.aide', 'ingested-models.json')
  }, new RuntimeBroker(adapter, null, dir), {
    artifactName: 'fixture.gguf', artifactBytes: 'model fixture'.length, artifactSha256: digest, backendVersion: '2026.9.11'
  }, finalAdmission);

  try {
    await runtime.load();
    await runtime.saveProfile('fixture', {
      preset: 'custom', samplers: { temperature: 0 }, runtime: { context_tokens: 2048, max_tokens: 64 }
    });
    await assert.rejects(() => runtime.start('fixture'), error => {
      const detail = (error as { detail?: { decision?: string; evidence?: Record<string, unknown> } }).detail;
      assert.equal(detail?.decision, 'REFUSE_RESOURCE');
      assert.equal(detail?.evidence?.free_memory_mb, 6655);
      assert.equal(detail?.evidence?.minimum_free_physical_memory_mb, 6656);
      return true;
    });
    assert.equal(loadCalls, 0, 'no runtime load occurs after the final admission refusal');
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
  }, admittedLocalStart());
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
