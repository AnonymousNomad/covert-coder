import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { BrokerModelRuntime, UNSLOTH_V1_QUALIFICATION } from '../../node/src/services/broker-model-runtime.ts';
import { RuntimeBroker, unknownCapabilities, unknownMetrics, type RuntimeAdapter } from '../../node/src/services/runtime-adapter.ts';
import { createResourceAdmission } from '../../node/src/services/resource-admission.ts';
import type { RuntimeStatusResponseT } from '../../common/contracts/runtime.ts';

// Controlled observations only: no artifact, OS child, live backend or local
// runtime qualification. Real start/admission/lifecycle tests stay separate.
async function fixture(
  first?: (captured: RuntimeStatusResponseT) => Promise<RuntimeStatusResponseT>,
  third?: (captured: RuntimeStatusResponseT) => Promise<RuntimeStatusResponseT>
) {
  const workspace = await mkdtemp(path.join(os.tmpdir(), 'covert-broker-observation-'));
  let reads = 0;
  let health: RuntimeStatusResponseT['health'] = 'HEALTHY';
  const snapshot = (): RuntimeStatusResponseT => ({
    contract_version: 1, canonical_backend: 'UNSLOTH', backend: 'UNSLOTH', version: '2026.9.11', engine: 'vulkan',
    endpoint: 'http://127.0.0.1:18888', port: 18888, pid: null, started_at: null, health, ownership: 'COVERT_OWNED',
    loaded_model: null, capabilities: unknownCapabilities(), metrics: unknownMetrics(), last_error: null,
    fallback_event_id: null, updated_at: new Date().toISOString()
  });
  const adapter = {
    backendId: 'UNSLOTH',
    status: async () => {
      reads += 1;
      const captured = snapshot();
      if (reads === 1 && first) return first(captured);
      if (reads === 3 && third) return third(captured);
      return captured;
    },
    shutdown: async () => { health = 'STOPPED'; }
  } as unknown as RuntimeAdapter;
  const runtime = new BrokerModelRuntime({
    workspace, modelDir: path.join(workspace, 'models'), manifestPath: path.join(workspace, 'manifest.json'),
    ingestedPath: path.join(workspace, 'ingested.json'),
    spawnChild: (() => { throw new Error('observation unit must not spawn a legacy runtime'); }) as never
  }, new RuntimeBroker(adapter, null, workspace), UNSLOTH_V1_QUALIFICATION, createResourceAdmission({
    memoryProbeMB: () => 1024, commitProbeMB: async () => 512, vramProbeMB: async () => null,
    gpuUtilizationProbePercent: async () => null, loadProbe: () => 0
  }));
  return { runtime, reads: () => reads, close: () => rm(workspace, { recursive: true, force: true }) };
}

test('concurrent broker read-only observations share one pending probe', async () => {
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  const f = await fixture(async captured => { await pending; return captured; });
  try {
    const observations = [f.runtime.status(), f.runtime.runtimeStatusSnapshot(), f.runtime.status()];
    release();
    await Promise.all(observations);
    assert.equal(f.reads(), 1, 'one shared read must not spawn three OS probes');
  } finally { release(); await f.close(); }
});

test('rejected shared broker observation drains and permits a fresh probe', async () => {
  const f = await fixture(async () => { throw new Error('controlled observation failure'); });
  try {
    const outcomes = await Promise.allSettled([f.runtime.runtimeStatusSnapshot(), f.runtime.runtimeStatusSnapshot()]);
    assert.deepEqual(outcomes.map(outcome => outcome.status), ['rejected', 'rejected']);
    assert.equal((await f.runtime.runtimeStatusSnapshot()).health, 'HEALTHY');
    assert.equal(f.reads(), 2, 'a failed shared probe is not cached or left pending');
  } finally { await f.close(); }
});

test('late pre-shutdown observation cannot republish stale health after invalidation', async () => {
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  const f = await fixture(async captured => { await pending; return captured; });
  try {
    const before = f.runtime.runtimeStatusSnapshot();
    await f.runtime.stopAll();
    assert.equal((await f.runtime.runtimeStatusSnapshot()).health, 'STOPPED');
    release();
    assert.equal((await before).health, 'STOPPED', 'an older pending read must resolve current observed health');
    assert.equal((await f.runtime.runtimeStatusSnapshot()).health, 'STOPPED', 'late result cannot refill the cache with stale health');
    assert.equal(f.reads(), 3);
  } finally { release(); await f.close(); }
});

test('broker stop uses a fresh observation and invalidates a primed read cache', async () => {
  const f = await fixture();
  try {
    assert.equal((await f.runtime.runtimeStatusSnapshot()).health, 'HEALTHY');
    await f.runtime.stopAll();
    assert.equal((await f.runtime.runtimeStatusSnapshot()).health, 'STOPPED');
    assert.equal(f.reads(), 3, 'the mutating path never uses the observation cache');
  } finally { await f.close(); }
});

test('repeated mutation during a refreshed observation fails closed after one retry', async () => {
  let releaseFirst!: () => void;
  let releaseRetry!: () => void;
  let retryStarted!: () => void;
  const firstPending = new Promise<void>(resolve => { releaseFirst = resolve; });
  const retryPending = new Promise<void>(resolve => { releaseRetry = resolve; });
  const retryReached = new Promise<void>(resolve => { retryStarted = resolve; });
  const f = await fixture(
    async captured => { await firstPending; return captured; },
    async captured => { retryStarted(); await retryPending; return captured; }
  );
  try {
    const observation = f.runtime.runtimeStatusSnapshot();
    const rejected = assert.rejects(observation, { code: 'NOT_READY' });
    await f.runtime.stopAll();
    releaseFirst();
    await retryReached;
    await f.runtime.stopAll();
    releaseRetry();
    await rejected;
    assert.equal(f.reads(), 4, 'one refreshed observation must not become an unbounded retry loop');
    assert.equal((await f.runtime.runtimeStatusSnapshot()).health, 'STOPPED');
    assert.equal(f.reads(), 5, 'a fenced rejection leaves the next observation able to refresh');
  } finally { releaseFirst(); releaseRetry(); await f.close(); }
});

test('shared broker observations retain the existing two-second cache expiry', async t => {
  let now = 1000;
  t.mock.method(Date, 'now', () => now);
  const f = await fixture();
  try {
    await f.runtime.runtimeStatusSnapshot();
    now = 2999;
    await f.runtime.runtimeStatusSnapshot();
    assert.equal(f.reads(), 1);
    now = 3000;
    await f.runtime.runtimeStatusSnapshot();
    assert.equal(f.reads(), 2, 'cache lifetime must not grow to avoid OS probes');
  } finally { await f.close(); }
});
