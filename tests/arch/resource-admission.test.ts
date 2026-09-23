// Canonical Resource Admission battery.
// Controls:
// - Resident priority: the same requirement admits as resident and queues as
//   disposable worker (the worker must leave the Resident reserve).
// - Disposable shortfall QUEUEs; non-disposable shortfall REFUSEs (hard).
// - Safety floor always refuses, even for residents.
// - VRAM truth used only when available; unknown probes never fabricate.
// - Unknown platform load never blocks.
// - Route serves the canonical decision over real machine memory.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createResourceAdmission } from '../../node/src/services/resource-admission.ts';
import { ArchServer } from '../../node/src/server.ts';
import { pairFixture } from './authority-fixture.ts';
const { buildRoutes } = await import('../../node/src/openapi.ts');

const noVram = async () => null;
const noLoad = () => 0;

test('resident priority: same requirement STARTs as resident, QUEUEs as disposable worker', async () => {
  const service = createResourceAdmission({ memoryProbeMB: () => 3000, vramProbeMB: noVram, loadProbe: noLoad, cores: 12 });
  const resident = await service.admit({ kind: 'resident', requirement: { memory_mb: 1500 } });
  const worker = await service.admit({ kind: 'worker', requirement: { memory_mb: 1500 }, disposable: true });
  assert.equal(resident.decision, 'START');
  assert.equal(worker.decision, 'QUEUE');
  assert.match(worker.reason, /resident reserve 1024MB/);
});

test('non-disposable shortfall is REFUSE_RESOURCE (hard)', async () => {
  const service = createResourceAdmission({ memoryProbeMB: () => 3000, vramProbeMB: noVram, loadProbe: noLoad });
  const decision = await service.admit({ kind: 'model_start', requirement: { memory_mb: 1500 } });
  assert.equal(decision.decision, 'REFUSE_RESOURCE');
});

test('safety floor refuses even residents below 512MB free', async () => {
  const service = createResourceAdmission({ memoryProbeMB: () => 400, vramProbeMB: noVram, loadProbe: noLoad });
  const decision = await service.admit({ kind: 'resident', requirement: { memory_mb: 1 } });
  assert.equal(decision.decision, 'REFUSE_RESOURCE');
  assert.match(decision.reason, /safety floor/);
});

test('VRAM truth used when available: shortfall REFUSEs, fit STARTs', async () => {
  const tight = createResourceAdmission({ memoryProbeMB: () => 8000, vramProbeMB: async () => 4000, loadProbe: noLoad });
  const tooBig = await tight.admit({ kind: 'model_start', requirement: { memory_mb: 100, vram_mb: 3900 } });
  assert.equal(tooBig.decision, 'REFUSE_RESOURCE');
  assert.match(tooBig.reason, /VRAM/);
  const fits = await tight.admit({ kind: 'model_start', requirement: { memory_mb: 100, vram_mb: 3000 } });
  assert.equal(fits.decision, 'START');
});

test('unknown VRAM and unknown load never block admission', async () => {
  const service = createResourceAdmission({ memoryProbeMB: () => 8000, vramProbeMB: noVram, loadProbe: noLoad });
  const decision = await service.admit({ kind: 'worker', requirement: { memory_mb: 100, vram_mb: 6000 }, disposable: true });
  assert.equal(decision.decision, 'START');
  assert.equal(decision.evidence.vram_free_mb, null);
  assert.equal(decision.evidence.load_probe, 'unknown (platform reports no load average)');
});

test('high known load QUEUEs disposable workers', async () => {
  const service = createResourceAdmission({ memoryProbeMB: () => 8000, vramProbeMB: noVram, loadProbe: () => 40, cores: 12 });
  const decision = await service.admit({ kind: 'worker', requirement: { memory_mb: 100 }, disposable: true });
  assert.equal(decision.decision, 'QUEUE');
  assert.match(decision.reason, /host load/);
});

test('no requirement fields -> START with honest evidence', async () => {
  const service = createResourceAdmission({ memoryProbeMB: () => 8000, vramProbeMB: noVram, loadProbe: noLoad });
  const decision = await service.admit({ kind: 'worker', requirement: {} });
  assert.equal(decision.decision, 'START');
  assert.equal(decision.evidence.required_memory_mb, null);
});

test('route serves the canonical decision over real machine memory', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'admission-route-'));
  const server = new ArchServer(workspace, path.join(workspace, 'arch.log'));
  const routes = await buildRoutes(workspace, 'test', { authority: server.authority, events: server.events });
  for (const route of routes) server.route(route);
  const http = await server.listen(0);
  const address = http.address() as { port: number };
  const owner = await pairFixture(server, `http://127.0.0.1:${address.port}`);
  try {
    const body = { kind: 'worker', requirement: { memory_mb: 100 }, disposable: true };
    const response = await owner.request('/api/resource/admission', { method: 'POST', body: JSON.stringify(body), signal: AbortSignal.timeout(60000) });
    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.ok(['START', 'QUEUE', 'REFUSE_RESOURCE'].includes(payload.data.decision));
    assert.equal(payload.data.kind, 'worker');
  } finally {
    http.closeAllConnections?.();
    await new Promise<void>(resolve => http.close(() => resolve()));
    server.events.close();
    await server.logger.flush();
  }
});
