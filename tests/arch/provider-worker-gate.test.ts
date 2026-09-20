// tests/arch/provider-worker-gate.test.ts
// Release gate: cross-worker execution inside ONE governed Covert workspace.
//
// A local OpenAI-compatible stub endpoint is the provider transport: real HTTP,
// real BYOK provider config + key vault + role routing + egress consent + egress
// journaling + authority-enrolled writes, no vendor credentials involved. The
// test proves the governed worker path (consent gate, remote stage, worker
// switch, local continuation, operator local-only pin, secret exclusion), not
// any vendor-specific behavior.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ArchServer } from '../../node/src/server.ts';
import { pairFixture } from './authority-fixture.ts';

const SYNTHETIC_KEY = 'sk-stub-' + 'provider-gate-0123456789';
const completion = (summary: string): string => JSON.stringify({
  choices: [{ message: { content: `<attempt_completion><result>${summary}</result></attempt_completion>` } }],
  usage: { completion_tokens: 7 }
});

const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'aide-provider-gate-'));
let server: ArchServer;
let httpServer: http.Server;
let base: string;
let owner: Awaited<ReturnType<typeof pairFixture>>;

let stub: http.Server;
let stubPort = 0;
const stubRequests: Array<{ authorization?: string | undefined; model?: string | undefined; system?: string | undefined }> = [];
let stubScript: string[] = [];
let localScript = '';

before(async () => {
  stub = http.createServer((request, response) => {
    let raw = '';
    request.on('data', chunk => { raw += chunk; });
    request.on('end', () => {
      try {
        const body = JSON.parse(raw) as { model?: string; messages?: Array<{ role: string; content: string }> };
        stubRequests.push({ authorization: request.headers.authorization, model: body.model, system: body.messages?.[0]?.content ?? '' });
      } catch {
        stubRequests.push({});
      }
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(stubScript.shift() ?? completion('STUB-DEFAULT-DONE'));
    });
  });
  stubPort = await new Promise(resolve => {
    stub.listen(0, '127.0.0.1', () => {
      const address = stub.address();
      resolve(typeof address === 'object' && address !== null ? address.port : 0);
    });
  });

  server = new ArchServer(workspace, path.join(workspace, 'arch-provider-gate.log'));
  const { buildRoutes } = await import('../../node/src/openapi.ts');
  const store = new Map<string, string>();
  const routes = await buildRoutes(workspace, 'test', {
    authority: server.authority,
    events: server.events,
    byokSecretStore: {
      setKey: (id, key) => { store.set(id, ['enc:', key].join('')); },
      getKey: id => (store.has(id) ? String(store.get(id)).slice(4) : null),
      deleteKey: id => store.delete(id),
      listProviderIds: () => [...store.keys()]
    },
    agentChatFn: async () => localScript
  });
  for (const route of routes) server.route(route);
  httpServer = await server.listen(0);
  const address = httpServer.address();
  assert.ok(address && typeof address === 'object');
  base = `http://127.0.0.1:${address.port}`;
  owner = await pairFixture(server, base);
  // Warm the local model-runtime probe before the agent starts: the start
  // handler resolves effective context through the local route ladder, and a
  // cold engine probe is the documented long pole on this box.
  await owner.request('/api/models/status', { signal: AbortSignal.timeout(180000) }).catch(() => {});
});

after(async () => {
  server.events.close();
  await server.logger.flush();
  httpServer.closeAllConnections?.();
  await new Promise<void>(resolve => httpServer.close(() => resolve()));
  await new Promise<void>(resolve => stub.close(() => resolve()));
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

type Envelope<T> = { ok: boolean; data?: T; error?: { code: string; message: string; detail?: unknown } };

async function call<T>(method: string, pathName: string, payload?: unknown): Promise<{ status: number; body: Envelope<T> }> {
  const response = await owner.request(pathName, {
    method,
    headers: { 'content-type': 'application/json' },
    ...(payload !== undefined ? { body: JSON.stringify(payload) } : {}),
    signal: AbortSignal.timeout(180000)
  });
  return { status: response.status, body: (await response.json()) as Envelope<T> };
}

async function approved<T>(method: string, pathName: string, payload: unknown, taskId: string): Promise<{ status: number; body: Envelope<T> }> {
  const headers = await owner.approve(method, pathName, payload, taskId);
  const response = await owner.request(pathName, {
    method, headers, body: JSON.stringify(payload), signal: AbortSignal.timeout(180000)
  });
  return { status: response.status, body: (await response.json()) as Envelope<T> };
}

async function waitForDone(sessionId: string, timeoutMs = 120000): Promise<{ state: string; error?: string | null }> {
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

const startBody = { task: 'provider gate stage', mode: 'act' as const, chat_source: 'provider' as const };

test('provider worker is refused before consent, with zero provider egress', async () => {
  const denied = await approved<{ session_id: string }>('POST', '/api/agent/start', { task: 'no consent yet', mode: 'act', chat_source: 'provider' }, 'task:pg-no-consent');
  assert.equal(denied.status, 403);
  assert.equal(denied.body.error?.code, 'FORBIDDEN');
  assert.equal(stubRequests.length, 0, 'no provider transport may run before consent');
});

let sessionA = '';
test('provider worker executes a governed stage over the real transport once consented', async () => {
  const provider = { id: 'stub-gate', name: 'Stub Gate Provider', base_url: `http://127.0.0.1:${stubPort}/v1`, api_type: 'chat-completions', model_id: 'stub-model-1', tool_calling: false };
  assert.equal((await approved('PUT', '/api/byok/providers/set', { provider }, 'task:pg-set')).status, 200);
  assert.equal((await approved('PUT', '/api/byok/key', { provider_id: 'stub-gate', api_key: SYNTHETIC_KEY }, 'task:pg-key')).status, 200);
  assert.equal((await approved('PUT', '/api/byok/consent', { enabled: true }, 'task:pg-consent')).status, 200);
  assert.equal((await approved('PUT', '/api/byok/routing', { routing: { plan: 'local', act: { provider_id: 'stub-gate', model_id: 'stub-model-1' }, utility: 'local' } }, 'task:pg-routing-1')).status, 200);

  stubScript = [completion('PROVIDER-STAGE-1-DONE')];
  const started = await approved<{ session_id: string }>('POST', '/api/agent/start', startBody, 'task:pg-start-a');
  assert.equal(started.status, 200, JSON.stringify(started.body).slice(0, 300));
  sessionA = started.body.data!.session_id;
  const final = await waitForDone(sessionA);
  assert.equal(final.state, 'done', JSON.stringify(final).slice(0, 300));
  const trajectoryA = await readTrajectory(sessionA);
  assert.match(trajectoryA, /PROVIDER-STAGE-1-DONE/, 'the remote stage result is durably attributable');
  assert.match(trajectoryA, /provider gate stage/, 'the task identity is preserved in the trajectory');

  const last = stubRequests[stubRequests.length - 1]!;
  assert.equal(last.model, 'stub-model-1', 'the routed provider model carried the request');
  assert.equal(last.authorization, `Bearer ${SYNTHETIC_KEY}`, 'the vaulted credential was attached by the transport');
  assert.match(String(last.system ?? ''), /You are AIDE/, 'the governed agent scaffold is composed for remote workers too');
});

test('worker switch keeps the same workspace and governance (remote model A -> remote model B)', async () => {
  assert.equal((await approved('PUT', '/api/byok/routing', { routing: { plan: 'local', act: { provider_id: 'stub-gate', model_id: 'stub-model-2' }, utility: 'local' } }, 'task:pg-routing-2')).status, 200);
  stubScript = [completion('PROVIDER-STAGE-2-DONE')];
  const started = await approved<{ session_id: string }>('POST', '/api/agent/start', { task: 'provider gate stage two', mode: 'act', chat_source: 'provider' }, 'task:pg-start-b');
  assert.equal(started.status, 200);
  const final = await waitForDone(started.body.data!.session_id);
  assert.equal(final.state, 'done');
  const trajectoryB = await readTrajectory(started.body.data!.session_id);
  assert.match(trajectoryB, /PROVIDER-STAGE-2-DONE/, 'the second worker result is attributable');
  assert.match(trajectoryB, /provider gate stage two/, 'task identity preserved across the worker switch');
  const last = stubRequests[stubRequests.length - 1]!;
  assert.equal(last.model, 'stub-model-2', 'the second worker carried the second model');

  const trajectories = await fs.readdir(path.join(workspace, '.aide', 'trajectories')).catch(() => [] as string[]);
  assert.ok(trajectories.length >= 2, 'both worker sessions persist in the ONE workspace state');
  const audit = await fs.readFile(path.join(workspace, '.aide', 'cipher-state.jsonl'), 'utf8');
  assert.ok(audit.includes(sessionA), 'session A is attributable in the durable audit');
});

test('local worker continues after the remote stages (remote -> local)', async () => {
  localScript = `<attempt_completion><result>LOCAL-STAGE-3-DONE</result></attempt_completion>`;
  const started = await approved<{ session_id: string }>('POST', '/api/agent/start', { task: 'local continuation stage', mode: 'act', chat_source: 'local' }, 'task:pg-start-c');
  assert.equal(started.status, 200);
  const final = await waitForDone(started.body.data!.session_id);
  assert.equal(final.state, 'done');
  const trajectoryC = await readTrajectory(started.body.data!.session_id);
  assert.match(trajectoryC, /LOCAL-STAGE-3-DONE/);
  assert.match(trajectoryC, /local continuation stage/);

  const trajectories = await fs.readdir(path.join(workspace, '.aide', 'trajectories')).catch(() => [] as string[]);
  assert.ok(trajectories.length >= 3, 'local continuation joins the same durable session store');
});

test('operator local-only pin refuses further provider stages and stops egress truthfully', async () => {
  assert.equal((await approved('PUT', '/api/connections/preference', { preference: 'local-only' }, 'task:pg-pin')).status, 200);
  const before = stubRequests.length;
  const denied = await approved<{ session_id: string }>('POST', '/api/agent/start', { task: 'must stay local', mode: 'act', chat_source: 'provider' }, 'task:pg-pin-deny');
  assert.equal(denied.status, 409, 'local-only pin makes provider workers unavailable (NOT_READY)');
  assert.equal(denied.body.error?.code, 'NOT_READY');
  assert.equal(stubRequests.length, before, 'no egress under the local-only pin');
});

test('synthetic provider key never lands in audit, egress journal, sessions, status, or workspace state', async () => {
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
    assert.ok(!content.includes(SYNTHETIC_KEY), `synthetic key must not persist in ${path.relative(workspace, file)}`);
  }
  const status = await call<{ providers: unknown[] }>('GET', '/api/byok/status');
  assert.ok(!JSON.stringify(status.body).includes(SYNTHETIC_KEY), 'status never echoes the stored secret');
  const connections = await call<unknown>('GET', '/api/connections');
  assert.ok(!JSON.stringify(connections.body).includes(SYNTHETIC_KEY), 'connections view never echoes the stored secret');
});
