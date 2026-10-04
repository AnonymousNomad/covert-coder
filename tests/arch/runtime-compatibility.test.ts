import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { configuredLocalRuntimeBackend } from '../../node/src/openapi.ts';
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
