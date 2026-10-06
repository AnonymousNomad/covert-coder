import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type http from 'node:http';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ArchServer } from '../../node/src/server.ts';
import { pairFixture } from './authority-fixture.ts';

const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'aide-workspace-routes-'));
let server: ArchServer;
let httpServer: http.Server;
let base: string;
let owner: Awaited<ReturnType<typeof pairFixture>>;

interface TreeNode {
  name: string;
  path: string;
  kind: string;
  children?: TreeNode[];
}

interface WorkspaceListData {
  workspace: string;
  entries: Array<{ name: string; kind: string }>;
}

interface WorkspaceTreeData {
  workspace: string;
  tree: TreeNode[];
}

before(async () => {
  await fs.mkdir(path.join(workspace, 'src'), { recursive: true });
  await fs.mkdir(path.join(workspace, '.hidden'), { recursive: true });
  await fs.mkdir(path.join(workspace, 'node_modules', 'pkg'), { recursive: true });
  await fs.mkdir(path.join(workspace, 'lib', 'nested'), { recursive: true });
  await fs.writeFile(path.join(workspace, 'a.txt'), 'alpha\n');
  await fs.writeFile(path.join(workspace, 'zed.txt'), 'omega\n');
  await fs.writeFile(path.join(workspace, 'lib', 'nested', 'deep.ts'), 'export const x = 1;\n');
  await fs.writeFile(path.join(workspace, '.hidden', 'secret.md'), '# nope\n');
  await fs.writeFile(path.join(workspace, 'node_modules', 'pkg', 'index.js'), '// nope\n');
  server = new ArchServer(workspace, path.join(workspace, '.aide', 'workspace-routes.log'));
  const { buildRoutes } = await import('../../node/src/openapi.ts');
  const routes = await buildRoutes(workspace, 'test', { authority: server.authority, events: server.events, logger: server.logger });
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

async function dataOf<T>(response: Response): Promise<T> {
  const body: { ok: boolean; data: T } = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  return body.data;
}

test('GET /api/workspace lists dot-filtered entries with name+kind (parity: build dirs stay listed)', async () => {
  const data = await dataOf<WorkspaceListData>(await owner.request('/api/workspace'));
  assert.equal(data.workspace, workspace);
  const names = data.entries.map(entry => entry.name).sort();
  // plugins/ is created by the Bucket C PluginManager load (legacy parity:
  // the legacy runtime also mkdirs <workspace>/plugins at boot).
  assert.deepEqual(names, ['a.txt', 'lib', 'node_modules', 'plugins', 'src', 'zed.txt']);
  assert.ok(!names.includes('.hidden'), 'dot entries are filtered by the list route');
  assert.ok(data.entries.every(entry => entry.kind === 'file' || entry.kind === 'directory'));
});

test('browser same-origin workspace read remains authenticated when GET omits Origin', async () => {
  const response = await fetch(`${base}/api/workspace`, {
    headers: {
      Authorization: owner.headers.Authorization,
      Referer: 'http://fixture.local/',
      'X-AIDE-API-Format': 'envelope-v1'
    }
  });
  const envelope = await response.json() as { ok: boolean; data?: WorkspaceListData; error?: { code?: string } };
  assert.equal(response.status, 200, envelope.error?.code ?? 'browser workspace read denied');
  assert.equal(envelope.ok, true);
  assert.equal(envelope.data?.workspace, workspace);
});

test('same-origin Referer cannot supply the missing Origin for an Authority mutation', async () => {
  const response = await fetch(`${base}/api/authority/prepare`, {
    method: 'POST',
    headers: {
      Authorization: owner.headers.Authorization,
      Referer: 'http://fixture.local/',
      'Content-Type': 'application/json',
      'X-AIDE-API-Format': 'envelope-v1'
    },
    body: JSON.stringify({
      method: 'PUT',
      path: '/api/session',
      task_id: '00000000-0000-4000-8000-000000000000',
      body: { version: 1, tabs: [] }
    })
  });
  const envelope = await response.json() as { ok: boolean; error?: { code?: string } };
  assert.equal(response.status, 403);
  assert.equal(envelope.ok, false);
  assert.equal(envelope.error?.code, 'FORBIDDEN');
});

test('workspace bearer cannot be replayed through a cross-origin Referer when Origin is absent', async () => {
  const response = await fetch(`${base}/api/workspace`, {
    headers: {
      Authorization: owner.headers.Authorization,
      Referer: 'https://attacker.example/',
      'X-AIDE-API-Format': 'envelope-v1'
    }
  });
  const envelope = await response.json() as { ok: boolean; error?: { code?: string } };
  assert.equal(response.status, 403);
  assert.equal(envelope.ok, false);
  assert.equal(envelope.error?.code, 'FORBIDDEN');
});

test('workspace bearer remains denied for malformed or credential-bearing Referer', async () => {
  for (const referer of ['not a URL', 'http://user:pass@fixture.local/']) {
    const response = await fetch(`${base}/api/workspace`, {
      headers: {
        Authorization: owner.headers.Authorization,
        Referer: referer,
        'X-AIDE-API-Format': 'envelope-v1'
      }
    });
    const envelope = await response.json() as { ok: boolean; error?: { code?: string } };
    assert.equal(response.status, 403, `referer form must stay denied: ${referer === 'not a URL' ? 'malformed' : 'credentials'}`);
    assert.equal(envelope.ok, false);
    assert.equal(envelope.error?.code, 'FORBIDDEN');
  }
});

test('explicit mismatched Origin is never replaced by a matching Referer', async () => {
  const response = await fetch(`${base}/api/workspace`, {
    headers: {
      Authorization: owner.headers.Authorization,
      Origin: 'https://attacker.example',
      Referer: 'http://fixture.local/',
      'X-AIDE-API-Format': 'envelope-v1'
    }
  });
  const envelope = await response.json() as { ok: boolean; error?: { code?: string } };
  assert.equal(response.status, 403);
  assert.equal(envelope.ok, false);
  assert.equal(envelope.error?.code, 'FORBIDDEN');
});

test('workspace bearer remains denied when both Origin and Referer are absent', async () => {
  const response = await fetch(`${base}/api/workspace`, {
    headers: {
      Authorization: owner.headers.Authorization,
      'X-AIDE-API-Format': 'envelope-v1'
    }
  });
  const envelope = await response.json() as { ok: boolean; error?: { code?: string } };
  assert.equal(response.status, 403);
  assert.equal(envelope.ok, false);
  assert.equal(envelope.error?.code, 'FORBIDDEN');
});

test('GET /api/workspace/tree is parity with legacy - nested posix nodes, dot/build dirs excluded', async () => {
  const data = await dataOf<WorkspaceTreeData>(await owner.request('/api/workspace/tree'));
  assert.equal(data.workspace, workspace);
  const names = data.tree.map(node => node.name);
  assert.deepEqual(names, ['a.txt', 'lib', 'plugins', 'src', 'zed.txt']);

  const lib = data.tree.find(node => node.name === 'lib');
  assert.ok(lib);
  assert.equal(lib.path, 'lib');
  assert.equal(lib.kind, 'directory');
  assert.ok(Array.isArray(lib.children));

  const nested = lib.children!.find(node => node.name === 'nested');
  assert.ok(nested);
  assert.ok(Array.isArray(nested.children));
  const deep = nested.children!.find(node => node.name === 'deep.ts');
  assert.ok(deep);
  assert.equal(deep.kind, 'file');
  assert.equal(deep.path, 'lib/nested/deep.ts');
});
