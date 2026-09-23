// Program 22: an unborn repository (no commits yet) is a normal project state.
// The push route must report it as a first-class state, not a generic 500.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type http from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ArchServer } from '../../node/src/server.ts';
import { pairFixture } from './authority-fixture.ts';

const run = promisify(execFile);

const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'aide-unborn-git-'));
let server: ArchServer;
let httpServer: http.Server;
let base: string;
let owner: Awaited<ReturnType<typeof pairFixture>>;

before(async () => {
  // git init with no commit: HEAD is unborn, the branch exists only as a ref name.
  await run('git', ['init', '-b', 'main'], { cwd: workspace });
  await run('git', ['config', 'user.email', 'aide@test.local'], { cwd: workspace });
  await run('git', ['config', 'user.name', 'AIDE Test'], { cwd: workspace });
  await fs.writeFile(path.join(workspace, 'first.txt'), 'first\n');

  server = new ArchServer(workspace, path.join(workspace, 'arch-test.log'));
  const { buildRoutes } = await import('../../node/src/openapi.ts');
  const routes = await buildRoutes(workspace, 'test', { authority: server.authority, events: server.events });
  for (const route of routes) server.route(route);
  httpServer = await server.listen(0);
  const address = httpServer.address();
  assert.ok(address && typeof address === 'object');
  base = `http://127.0.0.1:${address.port}`;
  owner = await pairFixture(server, base);
});

after(async () => {
  server.events.close();
  await server.logger.flush();
  httpServer.closeAllConnections?.();
  await new Promise<void>(resolve => httpServer.close(() => resolve()));
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      await fs.rm(workspace, { recursive: true, force: true });
      return;
    } catch (error) {
      if (!['EBUSY', 'ENOTEMPTY', 'EPERM'].includes((error as NodeJS.ErrnoException).code ?? '')) throw error;
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
});

type Envelope<T> = { ok: boolean; data?: T; error?: { code: string; message: string; detail?: { reason?: string } } };

async function post<T>(pathName: string, payload: unknown, taskId?: string): Promise<{ status: number; body: Envelope<T> }> {
  const headers = taskId ? await owner.approve('POST', pathName, payload, taskId) : {};
  const response = await owner.request(pathName, {
    method: 'POST',
    headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30000)
  });
  return { status: response.status, body: (await response.json()) as Envelope<T> };
}

async function get<T>(pathName: string): Promise<{ status: number; body: Envelope<T> }> {
  const response = await owner.request(pathName, { signal: AbortSignal.timeout(30000) });
  return { status: response.status, body: (await response.json()) as Envelope<T> };
}

test('unborn status is truthful: branch known, oid initial, untracked listed', async () => {
  const { status, body } = await get<{ branch: string | null; oid: string | null; changes: Array<{ path: string; untracked: boolean }> }>('/api/git/status');
  assert.equal(status, 200);
  assert.equal(body.data!.branch, 'main');
  assert.equal(body.data!.oid, '(initial)');
  const first = body.data!.changes.find(change => change.path === 'first.txt');
  assert.ok(first, 'untracked first.txt is listed in an unborn repository');
  assert.equal(first.untracked, true);
});

test('push on an unborn repository is a first-class state, not a 500', async () => {
  const pushed = await post<{ pushed: boolean }>('/api/git/push', { remote: 'origin' }, 'task:unborn-push');
  assert.equal(pushed.status, 409, `expected 409, got ${pushed.status}: ${JSON.stringify(pushed.body).slice(0, 200)}`);
  assert.equal(pushed.body.error?.detail?.reason, 'UNBORN_REPOSITORY');
  assert.match(String(pushed.body.error?.message), /no commits yet/i);
});

test('commit then push leaves the unborn state (branch resolution stays truthful)', async () => {
  const staged = await post<{ oid?: string }>('/api/git/stage', { paths: ['first.txt'] }, 'task:unborn-stage');
  assert.equal(staged.status, 200);
  const committed = await post<{ oid: string }>('/api/git/commit', { message: 'first commit' }, 'task:unborn-commit');
  assert.equal(committed.status, 200);
  assert.match(committed.body.data!.oid, /^[0-9a-f]{7,40}$/);
  const after = await get<{ oid: string | null }>('/api/git/status');
  assert.notEqual(after.body.data!.oid, '(initial)');
});
