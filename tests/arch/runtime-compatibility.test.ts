import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { configuredLocalRuntimeBackend, createModelRuntime } from '../../node/src/openapi.ts';
import { BrokerModelRuntime } from '../../node/src/services/broker-model-runtime.ts';
import { normalizeLlamaAccelerator, resolveLlamaBinary } from '../../node/src/services/model-runtime.ts';

test('local runtime backend defaults to Unsloth and accepts explicit llama.cpp compatibility mode', () => {
  assert.equal(configuredLocalRuntimeBackend({} as NodeJS.ProcessEnv), 'UNSLOTH');
  assert.equal(configuredLocalRuntimeBackend({ AIDE_LOCAL_RUNTIME_BACKEND: 'unsloth' } as NodeJS.ProcessEnv), 'UNSLOTH');
  assert.equal(configuredLocalRuntimeBackend({ AIDE_LOCAL_RUNTIME_BACKEND: 'llama-cpp' } as NodeJS.ProcessEnv), 'LLAMA_CPP');
  assert.equal(configuredLocalRuntimeBackend({ AIDE_LOCAL_RUNTIME_BACKEND: 'llama_cpp' } as NodeJS.ProcessEnv), 'LLAMA_CPP');
  assert.throws(
    () => configuredLocalRuntimeBackend({ AIDE_LOCAL_RUNTIME_BACKEND: 'auto' } as NodeJS.ProcessEnv),
    /must be "unsloth" or "llama-cpp"/
  );
});

test('llama accelerator normalization is explicit and fail-closed', () => {
  assert.equal(normalizeLlamaAccelerator('ROCM'), 'rocm');
  assert.equal(normalizeLlamaAccelerator('vulkan'), 'vulkan');
  assert.equal(normalizeLlamaAccelerator('cpu'), 'cpu');
  assert.equal(normalizeLlamaAccelerator('cuda'), 'unknown');
  assert.equal(normalizeLlamaAccelerator(undefined), 'unknown');
});

test('explicit external llama.cpp ROCm binary is selected without changing the default runtime', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'covert-gfx900-'));
  const binary = path.join(dir, process.platform === 'win32' ? 'llama-server.exe' : 'llama-server');
  const previousServer = process.env.AIDE_LLAMA_SERVER;
  const previousAccelerator = process.env.AIDE_LLAMA_ACCELERATOR;
  try {
    await writeFile(binary, 'fixture', 'utf8');
    process.env.AIDE_LLAMA_SERVER = binary;
    process.env.AIDE_LLAMA_ACCELERATOR = 'rocm';
    assert.deepEqual(resolveLlamaBinary(dir), { path: binary, vulkan: false, accelerator: 'rocm' });
  } finally {
    if (previousServer === undefined) delete process.env.AIDE_LLAMA_SERVER;
    else process.env.AIDE_LLAMA_SERVER = previousServer;
    if (previousAccelerator === undefined) delete process.env.AIDE_LLAMA_ACCELERATOR;
    else process.env.AIDE_LLAMA_ACCELERATOR = previousAccelerator;
    await rm(dir, { recursive: true, force: true });
  }
});

test('explicit llama.cpp construction remains broker-managed and does not fall back from a missing external binary', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'covert-llama-broker-root-'));
  const workspace = await mkdtemp(path.join(os.tmpdir(), 'covert-llama-broker-workspace-'));
  const modelDir = path.join(root, 'models');
  const artifact = path.join(modelDir, 'candidate.gguf');
  const manifestPath = path.join(modelDir, 'manifest.json');
  const previousBackend = process.env.AIDE_LOCAL_RUNTIME_BACKEND;
  const previousServer = process.env.AIDE_LLAMA_SERVER;
  try {
    await mkdir(modelDir, { recursive: true });
    await writeFile(artifact, 'candidate model');
    await writeFile(manifestPath, JSON.stringify({ models: [{
      id: 'candidate', name: 'Candidate', status: 'ready', roles: ['chat'], file: artifact,
      endpoint: 'http://127.0.0.1:19002/v1', model: 'candidate.gguf', artifact_uri: 'local://candidate.gguf', context_tokens: 1024
    }] }));
    process.env.AIDE_LOCAL_RUNTIME_BACKEND = 'llama-cpp';
    process.env.AIDE_LLAMA_SERVER = path.join(root, 'missing-operator-llama-server');

    const runtime = await createModelRuntime(root, workspace, { resourceAdmission: {
      admitLocalRuntimeStart: async () => ({ decision: 'START' })
    } as never });

    assert.ok(runtime instanceof BrokerModelRuntime, 'explicit compatibility selection still uses the canonical BrokerModelRuntime facade');
    const runtimeStatus = await runtime.runtimeStatusSnapshot();
    assert.equal(runtimeStatus.backend, 'LLAMA_CPP');
    assert.equal(runtimeStatus.health, 'NOT_INSTALLED', 'missing explicit binary remains unavailable');
    const modelStatus = await runtime.status();
    assert.equal(modelStatus.runtime, false);
    assert.equal(modelStatus.models[0]?.status, 'pending', 'legacy manifest READY is not inherited by an unqualified backend');
    assert.equal(modelStatus.models[0]?.qualification, 'unqualified');
  } finally {
    if (previousBackend === undefined) delete process.env.AIDE_LOCAL_RUNTIME_BACKEND;
    else process.env.AIDE_LOCAL_RUNTIME_BACKEND = previousBackend;
    if (previousServer === undefined) delete process.env.AIDE_LLAMA_SERVER;
    else process.env.AIDE_LLAMA_SERVER = previousServer;
    await rm(root, { recursive: true, force: true });
    await rm(workspace, { recursive: true, force: true });
  }
});

test('external llama.cpp can infer ROCm from a sibling HIP backend library', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'covert-hip-detect-'));
  const binary = path.join(dir, process.platform === 'win32' ? 'llama-server.exe' : 'llama-server');
  const hipLibrary = path.join(dir, process.platform === 'win32' ? 'ggml-hip.dll' : 'libggml-hip.so');
  const previousServer = process.env.AIDE_LLAMA_SERVER;
  const previousAccelerator = process.env.AIDE_LLAMA_ACCELERATOR;
  try {
    await mkdir(dir, { recursive: true });
    await writeFile(binary, 'fixture', 'utf8');
    await writeFile(hipLibrary, 'fixture', 'utf8');
    process.env.AIDE_LLAMA_SERVER = binary;
    delete process.env.AIDE_LLAMA_ACCELERATOR;
    assert.deepEqual(resolveLlamaBinary(dir), { path: binary, vulkan: false, accelerator: 'rocm' });
  } finally {
    if (previousServer === undefined) delete process.env.AIDE_LLAMA_SERVER;
    else process.env.AIDE_LLAMA_SERVER = previousServer;
    if (previousAccelerator === undefined) delete process.env.AIDE_LLAMA_ACCELERATOR;
    else process.env.AIDE_LLAMA_ACCELERATOR = previousAccelerator;
    await rm(dir, { recursive: true, force: true });
  }
});
