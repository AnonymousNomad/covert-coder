// tests/arch/worker-role-routing.test.ts
// Role routing must target BUILTIN catalog providers through the SAME governed
// worker path as BYOK: consent gate, local-only preference pin, egress
// journaling, vaulted credential attached by the transport, and truthful
// failure when the vault has no key. The builtin HTTP transport is injected
// (fake fetch + fake credential store) so no vendor egress occurs; execution
// through ProviderService.chat is real.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ArchServer } from '../../node/src/server.ts';
import { ProviderService } from '../../node/src/services/providers.ts';
import { pairFixture } from './authority-fixture.ts';

const BUILTIN_KEY = 'sk-builtin-' + 'role-routing-9876543210';
const completion = (summary: string): string => JSON.stringify({
  choices: [{ message: { content: `<attempt_completion><result>${summary}</result></attempt_completion>` } }],
  usage: { completion_tokens: 5 }
});

const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'aide-worker-routing-'));
const builtinKeys = new Map<string, string>([['openai', BUILTIN_KEY]]);
const builtinCalls: Array<{ url: string; authorization?: string | undefined; model?: string | undefined; system?: string | undefined }> = [];

let server: ArchServer;
let httpServer: import('node:http').Server;
let owner: Awaited<ReturnType<typeof pairFixture>>;

before(async () => {
  const fakeFetch = (async (input: unknown, init?: { headers?: Record<string, string>; body?: unknown }) => {
    let body: { model?: string; messages?: Array<{ role: string; content: string }> } = {};
    try { body = JSON.parse(String(init?.body ?? '{}')) as typeof body; } catch { /* recorded as empty */ }
    builtinCalls.push({
      url: String(input),
      authorization: init?.headers?.authorization,
      model: body.model,
      system: body.messages?.[0]?.content
    });
    return new Response(completion('BUILTIN-STAGE-DONE'), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as unknown as typeof fetch;

  const providerService = new ProviderService(workspace, {
    credentials: {
      ids: async () => [...builtinKeys.keys()],
      get: async (id: string) => builtinKeys.get(id),
      set: async () => {},
      delete: async () => {},
      available: async () => true
    } as never,
    fetchFn: fakeFetch
  });

  server = new ArchServer(workspace, path.join(workspace, 'arch-worker-routing.log'));
  const { buildRoutes } = await import('../../node/src/openapi.ts');
  const store = new Map<string, string>();
  const routes = await buildRoutes(workspace, 'test', {
    authority: server.authority,
    events: server.events,
    providerService,
    byokSecretStore: {
      setKey: (id, key) => { store.set(id, ['enc:', key].join('')); },
      getKey: id => (store.has(id) ? String(store.get(id)).slice(4) : null),
      deleteKey: id => store.delete(id),
      listProviderIds: () => [...store.keys()]
    }
  });
  for (const route of routes) server.route(route);
  httpServer = await server.listen(0);
  const address = httpServer.address();
  assert.ok(address && typeof address === 'object');
  owner = await pairFixture(server, `http://127.0.0.1:${address.port}`);
  await owner.request('/api/models/status', { signal: AbortSignal.timeout(180000) }).catch(() => {});
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

type Envelope<T> = { ok: boolean; data?: T; error?: { code: string; message: string } };

async function approved<T>(method: string, pathName: string, payload: unknown, taskId: string): Promise<{ status: number; body: Envelope<T> }> {
  const headers = await owner.approve(method, pathName, payload, taskId);
  const response = await owner.request(pathName, {
    method, headers, body: JSON.stringify(payload), signal: AbortSignal.timeout(180000)
  });
  return { status: response.status, body: (await response.json()) as Envelope<T> };
}

async function waitForTerminal(sessionId: string, timeoutMs = 120000): Promise<{ state: string; error?: string | null }> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const response = await owner.request(`/api/agent/status?id=${encodeURIComponent(sessionId)}`, { signal: AbortSignal.timeout(60000) });
    const body = (await response.json()) as Envelope<{ state: string; error?: string | null }>;
    if (body.ok && body.data) {
      const data = body.data as { state: string; error?: string | null };
      if (data.state === 'done' || data.state === 'error' || data.state === 'aborted') return data;
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error(`session ${sessionId} did not finish within ${timeoutMs}ms`);
}

async function readTrajectory(sessionId: string): Promise<string> {
  return fs.readFile(path.join(workspace, '.aide', 'trajectories', `${sessionId}.traj.json`), 'utf8');
}

async function enableBuiltinRouting(taskId: string): Promise<void> {
  assert.equal((await approved('PUT', '/api/byok/consent', { enabled: true }, `${taskId}-consent`)).status, 200);
  assert.equal((await approved('PUT', '/api/byok/routing', {
    routing: { plan: 'local', act: { provider_id: 'openai', model_id: 'gpt-4o' }, utility: 'local' }
  }, `${taskId}-routing`)).status, 200);
}

test('builtin role routing executes a governed stage through the provider transport', async () => {
  await enableBuiltinRouting('task:wr-t1');
  const started = await approved<{ session_id: string }>('POST', '/api/agent/start', {
    task: 'builtin routed stage', mode: 'act', chat_source: 'provider'
  }, 'task:wr-start-1');
  assert.equal(started.status, 200, JSON.stringify(started.body).slice(0, 300));
  const final = await waitForTerminal(started.body.data!.session_id);
  assert.equal(final.state, 'done', JSON.stringify(final).slice(0, 300));

  const call = builtinCalls[builtinCalls.length - 1]!;
  assert.equal(call.url, 'https://api.openai.com/v1/chat/completions', 'the builtin transport carried the request');
  assert.equal(call.authorization, `Bearer ${BUILTIN_KEY}`, 'the vaulted builtin credential was attached');
  assert.equal(call.model, 'gpt-4o', 'the routed builtin model was honored');
  assert.match(String(call.system ?? ''), /You are AIDE/, 'the governed scaffold is composed for builtin workers');

  const trajectory = await readTrajectory(started.body.data!.session_id);
  assert.match(trajectory, /BUILTIN-STAGE-DONE/);
  const journal = await fs.readFile(path.join(workspace, '.aide', 'egress', 'journal.jsonl'), 'utf8');
  assert.match(journal, /"action":"builtin-chat"/, 'builtin worker egress is journaled');
  assert.match(journal, /"provider_id":"openai"/);
  assert.match(journal, /"role":"act"/);
});

test('moonshot (Kimi) rides the same governed builtin path with a distinct identity', async () => {
  builtinKeys.set('moonshot', 'ms-routing-test-key');
  assert.equal((await approved('PUT', '/api/byok/consent', { enabled: true }, 'task:wr-ms-consent')).status, 200);
  assert.equal((await approved('PUT', '/api/byok/routing', {
    routing: { plan: 'local', act: { provider_id: 'moonshot', model_id: 'kimi-k2.6' }, utility: 'local' }
  }, 'task:wr-ms-routing')).status, 200);
  const started = await approved<{ session_id: string }>('POST', '/api/agent/start', {
    task: 'moonshot routed stage', mode: 'act', chat_source: 'provider'
  }, 'task:wr-ms-start');
  assert.equal(started.status, 200, JSON.stringify(started.body).slice(0, 300));
  const final = await waitForTerminal(started.body.data!.session_id);
  assert.equal(final.state, 'done', JSON.stringify(final).slice(0, 300));
  const call = builtinCalls[builtinCalls.length - 1]!;
  assert.equal(call.url, 'https://api.moonshot.ai/v1/chat/completions', 'the moonshot transport carried the request');
  assert.equal(call.authorization, 'Bearer ms-routing-test-key', 'the vaulted moonshot credential was attached');
  assert.equal(call.model, 'kimi-k2.6', 'the routed Kimi model was honored');
  const journal = await fs.readFile(path.join(workspace, '.aide', 'egress', 'journal.jsonl'), 'utf8');
  assert.match(journal, /"provider_id":"moonshot"/, 'moonshot egress is journaled under its own identity');
  await approved('PUT', '/api/byok/routing', {
    routing: { plan: 'local', act: { provider_id: 'openai', model_id: 'gpt-4o' }, utility: 'local' }
  }, 'task:wr-ms-restore');
});

test('local-only preference pin refuses builtin targets with zero transport calls', async () => {
  assert.equal((await approved('PUT', '/api/connections/preference', { preference: 'local-only' }, 'task:wr-pin')).status, 200);
  const before = builtinCalls.length;
  const denied = await approved<{ session_id: string }>('POST', '/api/agent/start', {
    task: 'must stay local', mode: 'act', chat_source: 'provider'
  }, 'task:wr-start-2');
  assert.equal(denied.status, 409);
  assert.equal(denied.body.error?.code, 'NOT_READY');
  assert.equal(builtinCalls.length, before, 'no builtin egress under the local-only pin');
});

test('a missing builtin key fails truthfully with zero transport calls', async () => {
  assert.equal((await approved('PUT', '/api/connections/preference', { preference: 'local-first' }, 'task:wr-unpin')).status, 200);
  builtinKeys.delete('openai');
  const before = builtinCalls.length;
  const started = await approved<{ session_id: string }>('POST', '/api/agent/start', {
    task: 'unconnected builtin stage', mode: 'act', chat_source: 'provider'
  }, 'task:wr-start-3');
  if (started.status === 200) {
    const final = await waitForTerminal(started.body.data!.session_id);
    assert.equal(final.state, 'error', 'an unconnected builtin worker must fail truthfully');
    assert.match(String(final.error ?? ''), /not connected/i);
  } else {
    assert.equal(started.status, 409);
  }
  assert.equal(builtinCalls.length, before, 'a missing key must never reach the transport');
  builtinKeys.set('openai', BUILTIN_KEY);
});

test('builtin worker key never persists in audit, journal, trajectories, or views', async () => {
  const files: string[] = [];
  const walk = async (dir: string): Promise<void> => {
    const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      const target = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(target);
      else if (entry.isFile() && !entry.name.endsWith('.dpapi') && !entry.name.endsWith('.gguf')) files.push(target);
    }
  };
  await walk(path.join(workspace, '.aide'));
  for (const file of files) {
    const content = await fs.readFile(file, 'utf8').catch(() => '');
    assert.ok(!content.includes(BUILTIN_KEY), `builtin key must not persist in ${path.relative(workspace, file)}`);
  }
  const connections = await owner.request('/api/connections', { signal: AbortSignal.timeout(60000) });
  assert.ok(!(await connections.text()).includes(BUILTIN_KEY), 'connections view never echoes the stored key');
});
