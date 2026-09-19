// tests/arch/harness-lab-routes.test.ts
// The Harness Lab query surface is read-only and authority-enrolled: anonymous
// callers are rejected, paired reads answer from the local ledger, derived
// projections are computed per request, and malformed input fails at the
// contract edge.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { ArchServer } from '../../node/src/server.ts';
import { routesForAuthority } from '../../node/src/routes/authority.ts';
import { routesForHarnessLab } from '../../node/src/routes/harness-lab.ts';
import { createPerformanceLedger } from '../../node/src/services/performance-ledger.ts';
import { pairFixture } from './authority-fixture.ts';
import { makeEvent } from './performance-fixture.ts';

let dir: string;
let server: ArchServer;
let httpServer: http.Server;
let base: string;
let owner: Awaited<ReturnType<typeof pairFixture>>;

before(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'aide-harness-lab-routes-'));
  const ledger = createPerformanceLedger({ root: path.join(dir, '.aide', 'harness-lab') });
  await ledger.append(makeEvent({ modelId: 'stub-model', taskClass: 'bug-repair', durationMs: 1200, checksPassed: 2 }));
  server = new ArchServer(dir, path.join(dir, 'arch-harness-lab.log'));
  for (const route of routesForAuthority()) server.route(route);
  for (const route of routesForHarnessLab({ workspace: dir })) server.route(route);
  httpServer = await server.listen(0);
  const address = httpServer.address();
  assert.ok(address && typeof address === 'object');
  base = `http://127.0.0.1:${address.port}`;
  owner = await pairFixture(server, base);
});

after(async () => {
  server.events.close();
  httpServer.closeAllConnections();
  await new Promise<void>(resolve => httpServer.close(() => resolve()));
  server.authority.control.close();
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      await fs.rm(dir, { recursive: true, force: true });
      return;
    } catch (error) {
      if (!['EBUSY', 'ENOTEMPTY', 'EPERM'].includes((error as NodeJS.ErrnoException).code ?? '')) throw error;
      await new Promise(resolve => setTimeout(resolve, 250));
    }
  }
});

async function paired(pathname: string, init: RequestInit = {}) {
  const response = await owner.request(pathname, { ...init, signal: AbortSignal.timeout(15000) });
  return { status: response.status, body: await response.json() as { ok: boolean; data?: Record<string, unknown>; error?: { code: string } } };
}

test('anonymous access is rejected; paired reads answer from the ledger', async () => {
  const anonymous = await fetch(`${base}/api/harness-lab/events`, { signal: AbortSignal.timeout(5000) });
  assert.equal(anonymous.status, 403);

  const events = await paired('/api/harness-lab/events');
  assert.equal(events.status, 200);
  assert.equal(events.body.ok, true);
  const data = events.body.data as { events: unknown[]; integrity: { ok: boolean } };
  assert.equal(data.events.length, 1);
  assert.equal(data.integrity.ok, true);
});

test('malformed queries fail at the contract edge', async () => {
  assert.equal((await paired('/api/harness-lab/events?limit=0')).status, 400);
  assert.equal((await paired('/api/harness-lab/events?limit=banana')).status, 400);
});

test('passports and a single passport are derived from evidence', async () => {
  const passports = await paired('/api/harness-lab/passports');
  assert.equal(passports.status, 200);
  const list = (passports.body.data as { passports: Array<{ identity: { model_id: string }; evidence: { sample_size: number } }> }).passports;
  assert.equal(list.length, 1);
  assert.equal(list[0]!.identity.model_id, 'stub-model');
  assert.equal(list[0]!.evidence.sample_size, 1);

  const one = await paired('/api/harness-lab/passport?id=stub-model');
  assert.equal(one.status, 200);
  const missing = await paired('/api/harness-lab/passport?id=does-not-exist');
  assert.equal(missing.status, 404);
});

test('mode listing and deterministic composition over HTTP', async () => {
  const modes = await paired('/api/harness-lab/modes');
  assert.equal(modes.status, 200);
  assert.equal((modes.body.data as { modes: unknown[] }).modes.length, 6);

  const composed = await paired('/api/harness-lab/mode?primary=software-engineering&specializations=cybersecurity');
  assert.equal(composed.status, 200);
  const composedMode = (composed.body.data as { modes: Array<{ status: string; effective: { prohibited_effects: string[] } }> }).modes[0]!;
  assert.equal(composedMode.status, 'EXPERIMENTAL');
  assert.ok(composedMode.effective.prohibited_effects.includes('offensive-automation'));

  assert.equal((await paired('/api/harness-lab/mode?primary=not-a-mode')).status, 404);
});

test('recommendation is read-only evidence and rejects extra fields', async () => {
  const body = { task_class: 'bug-repair', mode_id: null, local_only: true, min_samples: 0, evidence_threshold: 'observed' };
  const recommended = await paired('/api/harness-lab/recommend', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  assert.equal(recommended.status, 200);
  const data = recommended.body.data as { candidates: Array<{ model_id: string; qualified: boolean }>; notes: string[] };
  assert.equal(data.candidates.length, 1);
  assert.equal(data.candidates[0]!.qualified, true);
  assert.ok(data.notes.some(note => note.includes('read-only')));

  const injected = await paired('/api/harness-lab/recommend', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...body, route_now: true })
  });
  assert.equal(injected.status, 400);
});
