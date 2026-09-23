// Canonical Health Supervisor battery.
// Controls that matter:
// - PID existence alone is not health (alive pid without status probe -> UNKNOWN;
//   dead recorded pid -> DEGRADED; stopped model -> STOPPED, never HEALTHY).
// - Aggregate is deterministic and honest (UNKNOWN components do not fabricate
//   HEALTHY failures, but a STOPPED subsystem degrades the aggregate).
// - The route serves the canonical snapshot (backend component HEALTHY by
//   evidence: the handler answering).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHealthSupervisor } from '../../node/src/services/health-supervisor.ts';

async function workspaceWithEngines(engines: Record<string, unknown> | null): Promise<string> {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'health-sup-'));
  if (engines !== null) {
    await fs.mkdir(path.join(workspace, '.aide'), { recursive: true });
    await fs.writeFile(path.join(workspace, '.aide', 'model-engines.json'), JSON.stringify(engines), 'utf8');
  }
  return workspace;
}

test('no engines and no models -> model_engines STOPPED and aggregate DEGRADED', async () => {
  const workspace = await workspaceWithEngines(null);
  const supervisor = createHealthSupervisor({ workspace, version: 'test', isProcessAlive: () => false });
  const snapshot = await supervisor.snapshot();
  const engines = snapshot.components.find((component: { component: string; state: string }) => component.component === 'model_engines');
  assert.equal(engines?.state, 'STOPPED');
  assert.equal(snapshot.state, 'DEGRADED');
  assert.equal(snapshot.components.find((component: { component: string; state: string }) => component.component === 'backend')?.state, 'HEALTHY');
});

test('dead recorded pid is not healthy: stale bookkeeping -> DEGRADED', async () => {
  const workspace = await workspaceWithEngines({ 'local-1': { pid: 999999, file: 'model.gguf' } });
  const supervisor = createHealthSupervisor({ workspace, version: 'test', isProcessAlive: () => false });
  const snapshot = await supervisor.snapshot();
  assert.equal(snapshot.components.find((component: { component: string; state: string }) => component.component === 'model_engines')?.state, 'DEGRADED');
  assert.equal(snapshot.state, 'DEGRADED');
});

test('alive pid WITHOUT a status probe is UNKNOWN, never HEALTHY', async () => {
  const workspace = await workspaceWithEngines({ 'local-1': { pid: 4242, file: 'model.gguf' } });
  const supervisor = createHealthSupervisor({ workspace, version: 'test', isProcessAlive: pid => pid === 4242 });
  const snapshot = await supervisor.snapshot();
  const engines = snapshot.components.find((component: { component: string; state: string }) => component.component === 'model_engines');
  assert.equal(engines?.state, 'UNKNOWN');
  assert.notEqual(engines?.state, 'HEALTHY');
});

test('engine pid alive but model status stopped -> STOPPED, not HEALTHY', async () => {
  const workspace = await workspaceWithEngines({ 'local-1': { pid: 4242, file: 'model.gguf' } });
  const supervisor = createHealthSupervisor({
    workspace, version: 'test', isProcessAlive: pid => pid === 4242,
    modelStatus: async () => ({ models: [{ id: 'local-1', status: 'stopped' }] })
  });
  const snapshot = await supervisor.snapshot();
  assert.equal(snapshot.components.find((component: { component: string; state: string }) => component.component === 'model_engines')?.state, 'STOPPED');
});

test('running model with alive engine -> HEALTHY aggregate', async () => {
  const workspace = await workspaceWithEngines({ 'local-1': { pid: 4242, file: 'model.gguf' } });
  const supervisor = createHealthSupervisor({
    workspace, version: 'test', isProcessAlive: pid => pid === 4242,
    modelStatus: async () => ({ models: [{ id: 'local-1', status: 'running' }] })
  });
  const snapshot = await supervisor.snapshot();
  assert.equal(snapshot.components.find((component: { component: string; state: string }) => component.component === 'model_engines')?.state, 'HEALTHY');
  assert.equal(snapshot.state, 'HEALTHY');
});

test('failed model status -> UNHEALTHY aggregate', async () => {
  const workspace = await workspaceWithEngines({ 'local-1': { pid: 4242, file: 'model.gguf' } });
  const supervisor = createHealthSupervisor({
    workspace, version: 'test', isProcessAlive: pid => pid === 4242,
    modelStatus: async () => ({ models: [{ id: 'local-1', status: 'error' }] })
  });
  const snapshot = await supervisor.snapshot();
  assert.equal(snapshot.components.find((component: { component: string; state: string }) => component.component === 'model_engines')?.state, 'UNHEALTHY');
  assert.equal(snapshot.state, 'UNHEALTHY');
});

test('status probe throwing does not fabricate health', async () => {
  const workspace = await workspaceWithEngines({ 'local-1': { pid: 4242, file: 'model.gguf' } });
  const supervisor = createHealthSupervisor({
    workspace, version: 'test', isProcessAlive: pid => pid === 4242,
    modelStatus: async () => { throw new Error('probe down'); }
  });
  const snapshot = await supervisor.snapshot();
  const engines = snapshot.components.find((component: { component: string; state: string }) => component.component === 'model_engines');
  assert.equal(engines?.state, 'UNKNOWN');
});

test('unwired probes stay UNKNOWN with honest detail', async () => {
  const workspace = await workspaceWithEngines(null);
  const supervisor = createHealthSupervisor({
    workspace, version: 'test', isProcessAlive: () => false,
    modelStatus: async () => ({ models: [{ id: 'local-1', status: 'running' }] })
  });
  const snapshot = await supervisor.snapshot();
  for (const name of ['facade', 'resident', 'workers', 'remote_bridge']) {
    assert.equal(snapshot.components.find((component: { component: string; state: string }) => component.component === name)?.state, 'UNKNOWN');
  }
});
