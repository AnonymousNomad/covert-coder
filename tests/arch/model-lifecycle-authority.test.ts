// tests/arch/model-lifecycle-authority.test.ts
// Wave 3E: POST /api/models/start and /api/models/stop are exact
// capability.execute operations. The approved model identity is the only
// caller-controlled input; executable, model file, arguments, backend, port
// and environment are derived server-side from the allowlisted registry. The
// runtime owns its children by retained ChildProcess handle (never by caller
// PID) and stop fails closed when no handle is owned.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { spawn } from 'node:child_process';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import type http from 'node:http';
import { ArchServer } from '../../node/src/server.ts';
import { buildRoutes } from '../../node/src/openapi.ts';
import { ModelRuntime } from '../../node/src/services/model-runtime.ts';
import type { HardwareInfo } from '../../node/src/services/hardware.ts';
import { createResourceAdmission } from '../../node/src/services/resource-admission.ts';
import { pairFixture } from './authority-fixture.ts';

async function freePort(): Promise<number> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const info = server.address() as net.AddressInfo;
      server.close(() => resolve(info.port));
    });
  });
}

async function waitForPidGone(pid: number, timeoutMs = 8000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try { process.kill(pid, 0); } catch { return true; }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  return false;
}

test('model start/stop require approved exact operations over retained child handles', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'aide-model-lifecycle-'));
  await fs.mkdir(path.join(dir, 'models'), { recursive: true });
  await fs.mkdir(path.join(dir, 'runtime'), { recursive: true });
  await fs.mkdir(path.join(dir, '.aide'), { recursive: true });
  await fs.writeFile(path.join(dir, 'runtime', process.platform === 'win32' ? 'llama-server.exe' : 'llama-server'), 'fixture binary placeholder\n');
  const goodFile = path.join(dir, 'models', 'fixture-1b.gguf');
  const failFile = path.join(dir, 'models', 'fixture-fail.gguf');
  await fs.writeFile(goodFile, 'GGUF fixture\n');
  await fs.writeFile(failFile, 'GGUF fixture\n');
  const manifestPath = path.join(dir, 'models', 'manifest.json');
  await fs.writeFile(manifestPath, JSON.stringify({
    models: [
      { id: 'fixture-1b', name: 'Fixture 1B', file: goodFile, endpoint: `http://127.0.0.1:${await freePort()}/v1`, context_tokens: 512, status: 'ready' },
      { id: 'fixture-fail', name: 'Fixture Fail', file: failFile, endpoint: `http://127.0.0.1:${await freePort()}/v1`, context_tokens: 512, status: 'ready' }
    ]
  }));

  // The spawned "engine" is a controlled fixture process: healthy models keep a
  // long-lived child, the failure model exits immediately, and no other process
  // is ever spawned or killed by the runtime.
  let spawnCount = 0;
  let spawnFails = false;
  const fixturePids: number[] = [];
  const fakeSpawn = ((_program: string, _args?: readonly string[], _options?: Record<string, unknown>) => {
    spawnCount += 1;
    const child = spawn(process.execPath, ['-e', spawnFails ? 'process.exit(1)' : 'setInterval(() => {}, 1000)'], {
      stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true
    });
    if (typeof child.pid === 'number') fixturePids.push(child.pid);
    return child;
  }) as unknown as typeof spawn;

  const runtime = new ModelRuntime({
    workspace: dir,
    manifestPath,
    ingestedPath: path.join(dir, '.aide', 'ingested-models.json'),
    modelDir: path.join(dir, 'models'),
    spawnChild: fakeSpawn,
    hardwareProbe: async (): Promise<HardwareInfo> => ({
      totalRamBytes: 8 * 1024 ** 3,
      freeRamBytes: 7 * 1024 ** 3,
      logicalCpus: 4,
      devices: [],
      vendor: 'UNKNOWN',
      deviceName: null,
      driverVersion: null,
      architecture: null,
      vramBytes: null,
      freeVramBytes: null,
      vramSource: 'unknown'
    })
  });
  await runtime.load();

  const canary = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore', windowsHide: true });
  const server = new ArchServer(dir, path.join(dir, 'model-lifecycle.log'));
  let admittedFreeMemoryMB = 6655;
  let admissionCalls = 0;
  const resourceAdmission = createResourceAdmission({
    memoryProbeMB: () => admittedFreeMemoryMB,
    vramProbeMB: async () => 5000,
    commitProbeMB: async () => 6000,
    gpuUtilizationProbePercent: async () => 10,
    loadProbe: () => 0
  });
  const admitLocalRuntimeStart = resourceAdmission.admitLocalRuntimeStart;
  resourceAdmission.admitLocalRuntimeStart = async () => {
    admissionCalls += 1;
    return admitLocalRuntimeStart();
  };
  let httpServer: http.Server | undefined;
  try {
    const routes = await buildRoutes(dir, 'test', { authority: server.authority, events: server.events, modelRuntime: runtime, resourceAdmission });
    for (const route of routes) server.route(route);
    httpServer = await server.listen(0);
    const address = httpServer.address();
    assert.ok(address && typeof address === 'object');
    const base = `http://127.0.0.1:${address.port}`;
    const owner = await pairFixture(server, base);
    // Engine start legitimately takes seconds (early-exit guard) and the
    // failure path performs one bounded retry. Use a request bound above that
    // window so the fixture's 5s default cannot abort a request that is still
    // executing server-side (an aborted request would leave the start in
    // flight and its retry child would outlive test teardown).
    const post = (routePath: string, body: unknown, headers?: Record<string, string>) =>
      owner.request(routePath, { method: 'POST', ...(headers ? { headers } : {}), body: JSON.stringify(body), signal: AbortSignal.timeout(30000) });
    const anonymous = (routePath: string, body: unknown) => fetch(`${base}${routePath}`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(5000)
    });

    const startBody = { id: 'fixture-1b' };
    assert.equal((await anonymous('/api/models/start', startBody)).status, 403, 'anonymous start rejected');
    assert.equal((await post('/api/models/start', startBody)).status, 409, 'unapproved start denied');
    assert.equal((await post('/api/models/start', { id: 'fixture-1b', port: 9 })).status, 400, 'callers cannot inject runtime options');
    assert.equal(spawnCount, 0, 'no process exists before approval');
    assert.equal(admissionCalls, 0, 'unapproved starts never reach Resource Admission');

    const startHeaders = await owner.approve('POST', '/api/models/start', startBody, 'task:model-start');
    const changedStart = await post('/api/models/start', { id: 'fixture-fail' }, startHeaders);
    assert.equal(changedStart.status, 409, 'changed model identity cannot reuse approval');
    assert.equal(spawnCount, 0);
    assert.equal(admissionCalls, 0, 'a mismatched model identity is rejected before admission');

    const blocked = await post('/api/models/start', startBody, startHeaders);
    const blockedText = await blocked.text();
    assert.equal(blocked.status, 409, blockedText);
    assert.match(blockedText, /6655MB.*6656MB local runtime start floor/);
    const blockedPayload = JSON.parse(blockedText) as { error?: { detail?: { decision?: string; evidence?: Record<string, unknown> } } };
    assert.equal(blockedPayload.error?.detail?.decision, 'REFUSE_RESOURCE', 'the route returns the measured admission decision');
    assert.equal(blockedPayload.error?.detail?.evidence?.free_memory_mb, 6655);
    assert.equal(blockedPayload.error?.detail?.evidence?.minimum_free_physical_memory_mb, 6656);
    assert.equal(spawnCount, 0, 'below-floor admission does not start a process');
    assert.equal(admissionCalls, 1);

    admittedFreeMemoryMB = 7000;
    const retryHeaders = await owner.approve('POST', '/api/models/start', startBody, 'task:model-start-after-admission');
    const started = await post('/api/models/start', startBody, retryHeaders);
    const startedText = await started.text();
    assert.equal(started.status, 200, startedText);
    assert.equal(spawnCount, 1, 'exactly one canonical child spawned');
    assert.equal(admissionCalls, 2, 'approved model start rechecks the shared Resource Admission service');
    const ownedPid = fixturePids[0]!;
    process.kill(ownedPid, 0);

    assert.equal((await post('/api/models/start', startBody, startHeaders)).status, 409, 'resource-refused start approval cannot replay');
    assert.equal((await post('/api/models/start', startBody, retryHeaders)).status, 409, 'successful start approval cannot replay');
    assert.equal(spawnCount, 1);

    const duplicateHeaders = await owner.approve('POST', '/api/models/start', startBody, 'task:model-start-dup');
    const duplicate = await post('/api/models/start', startBody, duplicateHeaders);
    assert.equal(duplicate.status, 200, await duplicate.text());
    assert.equal(spawnCount, 1, 'duplicate start does not spawn a second process');

    const unknownBody = { id: 'not-allowlisted' };
    const unknownHeaders = await owner.approve('POST', '/api/models/start', unknownBody, 'task:model-start-unknown');
    const unknown = await post('/api/models/start', unknownBody, unknownHeaders);
    assert.equal(unknown.status, 504, 'authorized unknown model fails without spawning');
    assert.equal(spawnCount, 1);

    spawnFails = true;
    const failBody = { id: 'fixture-fail' };
    const failHeaders = await owner.approve('POST', '/api/models/start', failBody, 'task:model-start-fail');
    const failed = await post('/api/models/start', failBody, failHeaders);
    assert.equal(failed.status, 504, await failed.text());
    spawnFails = false;
    assert.equal(spawnCount, 3, 'two bounded attempt spawns for the failing engine');
    assert.equal(canary.exitCode, null, 'startup failure touched no unrelated process');

    const stopBody = { id: 'fixture-1b' };
    assert.equal((await anonymous('/api/models/stop', stopBody)).status, 403, 'anonymous stop rejected');
    assert.equal((await post('/api/models/stop', stopBody)).status, 409, 'unapproved stop denied');
    const stopHeaders = await owner.approve('POST', '/api/models/stop', stopBody, 'task:model-stop');
    const changedStop = await post('/api/models/stop', { id: 'fixture-fail' }, stopHeaders);
    assert.equal(changedStop.status, 409, 'changed identity cannot reuse stop approval');
    process.kill(ownedPid, 0);

    const stopped = await post('/api/models/stop', stopBody, stopHeaders);
    const stoppedText = await stopped.text();
    assert.equal(stopped.status, 200, stoppedText);
    assert.equal(await waitForPidGone(ownedPid), true, 'approved stop terminates exactly the owned child');
    assert.equal((await post('/api/models/stop', stopBody, stopHeaders)).status, 409, 'consumed stop approval cannot replay');
    assert.equal(canary.exitCode, null, 'stop touched no unrelated process');

    const repeatHeaders = await owner.approve('POST', '/api/models/stop', stopBody, 'task:model-stop-again');
    const repeat = await post('/api/models/stop', stopBody, repeatHeaders);
    assert.equal(repeat.status, 200, await repeat.text());
    const staleBody = { id: 'fixture-fail' };
    const staleHeaders = await owner.approve('POST', '/api/models/stop', staleBody, 'task:model-stop-stale');
    const stale = await post('/api/models/stop', staleBody, staleHeaders);
    assert.equal(stale.status, 200, await stale.text());
    assert.equal(canary.exitCode, null, 'stale records and repeats touched no unrelated process');
  } finally {
    // Always stop runtime-owned children first: a surviving fixture child would
    // hold its piped stderr handle and keep the test runner alive.
    await runtime.stopAll().catch(() => {});
    if (httpServer) {
      httpServer.closeAllConnections();
      await new Promise<void>(resolve => httpServer!.close(() => resolve()));
    }
    server.authority.control.close();
    server.events.close();
    canary.kill();
    for (let attempt = 0; attempt < 10; attempt++) {
      try { await fs.rm(dir, { recursive: true, force: true }); break; }
      catch (error) {
        if (!['EBUSY', 'ENOTEMPTY', 'EPERM'].includes((error as NodeJS.ErrnoException).code ?? '')) throw error;
        await new Promise(resolve => setTimeout(resolve, 250));
      }
    }
  }
});
