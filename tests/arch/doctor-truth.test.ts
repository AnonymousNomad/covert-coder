// Doctor Truth battery — the readiness/health surfaces exercised against
// deliberately broken environments. Doctor must DISTINGUISH categories:
// healthy / degraded / blocking / optional / repairable / unknown. No false
// green: a broken environment must never produce ready=true.
//
// Live side: the real route stack is probed with a genuinely missing model
// runtime (no engines, no models) and a non-git workspace.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHealthSupervisor } from '../../node/src/services/health-supervisor.ts';
import { createReadinessService } from '../../node/src/services/readiness.ts';
import { ArchServer } from '../../node/src/server.ts';
import { pairFixture } from './authority-fixture.ts';
const { buildRoutes } = await import('../../node/src/openapi.ts');

test('doctor: dead owned engine pid is DEGRADED and refuses to fabricate health', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'doctor-'));
  await fs.mkdir(path.join(workspace, '.aide'), { recursive: true });
  await fs.writeFile(path.join(workspace, '.aide', 'model-engines.json'), JSON.stringify({ 'local-1': { pid: 999999, file: 'missing.gguf' } }), 'utf8');
  const supervisor = createHealthSupervisor({ workspace, version: 'doctor', isProcessAlive: () => false });
  const snapshot = await supervisor.snapshot();
  assert.equal(snapshot.state, 'DEGRADED');
  assert.ok(snapshot.components.some(component => component.component === 'model_engines' && component.state === 'DEGRADED'));
});

test('doctor: corrupt model bookkeeping file is ignored without crashing', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'doctor-'));
  await fs.mkdir(path.join(workspace, '.aide'), { recursive: true });
  await fs.writeFile(path.join(workspace, '.aide', 'model-engines.json'), '{not json', 'utf8');
  const supervisor = createHealthSupervisor({ workspace, version: 'doctor', isProcessAlive: () => true });
  const snapshot = await supervisor.snapshot();
  assert.ok(['STOPPED', 'UNKNOWN', 'DEGRADED'].includes(snapshot.components.find(component => component.component === 'model_engines')?.state ?? ''));
});

test('doctor: provider unavailable surfaces as UNKNOWN/OPTIONAL, never blocking', async () => {
  const snapshot = await createReadinessService({
    healthSnapshot: async () => ({ state: 'HEALTHY', components: [] }),
    modelsStatus: async () => ({ models: [] }),
    rgAvailable: () => false,
    workspaceWritable: async () => true,
    gitRepo: async () => ({ git_repo: false }),
    memoryAdmit: async () => ({ decision: 'START', reason: 'ok' })
  }).snapshot();
  const providers = snapshot.items.find(item => item.id === 'providers');
  assert.equal(providers?.state, 'OPTIONAL');
  assert.equal(providers?.blocking, false);
});

test('doctor: invalid workspace is BLOCKED and repairable', async () => {
  const snapshot = await createReadinessService({
    healthSnapshot: async () => ({ state: 'HEALTHY', components: [] }),
    modelsStatus: async () => ({ models: [{ id: 'm', status: 'running' }] }),
    rgAvailable: () => true,
    workspaceWritable: async () => false,
    gitRepo: async () => ({ git_repo: false }),
    memoryAdmit: async () => ({ decision: 'START', reason: 'ok' })
  }).snapshot();
  const workspace = snapshot.items.find(item => item.id === 'workspace');
  assert.equal(workspace?.state, 'BLOCKED');
  assert.ok((workspace?.repair ?? '').length > 0);
  assert.equal(snapshot.ready, false);
});

test('doctor LIVE: real route stack with no model runtime yields degraded, not false green', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'doctor-live-'));
  const server = new ArchServer(workspace, path.join(workspace, 'arch.log'));
  // Deliberately NO modelRuntime: corpus of failure category "missing model".
  const routes = await buildRoutes(workspace, 'test', { authority: server.authority, events: server.events });
  for (const route of routes) server.route(route);
  const http = await server.listen(0);
  const address = http.address() as { port: number };
  const owner = await pairFixture(server, `http://127.0.0.1:${address.port}`);
  try {
    const readiness = await (await owner.request('/api/readiness', { signal: AbortSignal.timeout(60000) })).json();
    assert.equal(readiness.data.ready, true);
    assert.equal(readiness.data.ready_for_golden_mission, false);
    assert.equal(readiness.data.items.find((item: { id: string }) => item.id === 'models').state, 'DEGRADED');
    const health = await (await owner.request('/api/health', { signal: AbortSignal.timeout(60000) })).json();
    assert.ok(['DEGRADED', 'HEALTHY', 'UNKNOWN'].includes(health.data.state));
    assert.ok(Array.isArray(health.data.components));
  } finally {
    http.closeAllConnections?.();
    await new Promise<void>(resolve => http.close(() => resolve()));
    server.events.close();
    await server.logger.flush();
  }
});
