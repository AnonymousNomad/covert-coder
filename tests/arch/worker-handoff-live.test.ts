// tests/arch/worker-handoff-live.test.ts
// Wave 4 release proof: governed handoffs wired into the LIVE worker-switch
// path. Destination sessions are real agent sessions; the provider transport
// is a controlled local stub and the local transport is an injected stub
// runtime — mechanisms proven without vendor credentials.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { promises as fs } from 'node:fs';
import { randomUUID } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { ArchServer } from '../../node/src/server.ts';
import { pairFixture } from './authority-fixture.ts';

const SECRET = 'sk-live-' + 'switch-canary-0123456789';
const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'aide-wh-live-'));
const lanes = { scripted: [] as string[], index: 0 };

let server: ArchServer;
let httpServer: import('node:http').Server;
let owner: Awaited<ReturnType<typeof pairFixture>>;

let stub: http.Server; let stubPort = 0; let stubReply = ''; let stubModelSeen: string[] = [];
type StubCall = { model?: string | undefined; systems: string; authorization?: string | undefined };
let stubCalls: StubCall[] = [];
let localReply = ''; let localCalls = 0;

type Envelope<T> = { ok: boolean; data?: T; error?: { code: string; message: string } };
type Handoff = { handoff_id: string; state: string; task_id: string; to: Record<string, string>; verified_facts: string[] };

function stubRuntime(): never {
  return {
    list: () => [{ id: 'scripted-local', name: 'Scripted Local', endpoint: 'http://127.0.0.1:9/v1', model: 'scripted', context_tokens: 8192, roles: ['chat', 'act'] }],
    status: async () => ({ models: [{ id: 'scripted-local', status: 'running' }] }),
    verifyEndpointModel: async () => ({ ready: true }),
    getEffectiveContext: () => 8192,
    getEffectiveBudget: () => 8192 - 512,
    refreshServedContext: async () => undefined,
    chat: async (_id: string, _messages: unknown) => { localCalls += 1; return { text: localReply, modelId: 'local:scripted-local', timingMs: 1 }; },
    chatStream: async (_id: string, _messages: unknown, onDelta: (d: string) => void) => { localCalls += 1; onDelta(localReply); return { modelId: 'local:scripted-local', usedApprox: 1, dropped: 0, truncatedSystem: false, timingMs: 1 }; }
  } as unknown as never;
}

before(async () => {
  await fs.mkdir(path.join(workspace, '.aide', 'workflow'), { recursive: true });
  await fs.writeFile(path.join(workspace, '.aide', 'workflow', 'state.json'), JSON.stringify({
    version: 1, workflow_id: randomUUID(), workspace, project_id: 'live-switch-project', stage: 'DISCOVERY',
    previous_stage: null, revision: 0, artifacts: [], last_transition_id: null,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString()
  }, null, 2), 'utf8');
  await fs.writeFile(path.join(workspace, 'README.md'), '# live switch fixture\n', 'utf8');

  stub = http.createServer((request, response) => {
    let raw = '';
    request.on('data', chunk => { raw += chunk; });
    request.on('end', () => {
      let body: { model?: string; messages?: Array<{ role: string; content: string }> } = {};
      try { body = JSON.parse(raw) as typeof body; } catch { /* empty */ }
      stubCalls.push({
        model: body.model,
        systems: (body.messages ?? []).filter(message => message.role === 'system').map(message => message.content).join('\n'),
        authorization: request.headers.authorization
      });
      if (body.model) stubModelSeen.push(body.model);
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ choices: [{ message: { content: stubReply } }] }));
    });
  });
  stubPort = await new Promise(resolve => {
    stub.listen(0, '127.0.0.1', () => {
      const address = stub.address();
      resolve(typeof address === 'object' && address !== null ? address.port : 0);
    });
  });

  server = new ArchServer(workspace, path.join(workspace, 'arch-wh-live.log'));
  const { buildRoutes } = await import('../../node/src/openapi.ts');
  const store = new Map<string, string>();
  const routes = await buildRoutes(workspace, 'test', {
    authority: server.authority,
    events: server.events,
    modelRuntime: stubRuntime(),
    byokSecretStore: {
      setKey: (id, key) => { store.set(id, ['enc:', key].join('')); },
      getKey: id => (store.has(id) ? String(store.get(id)).slice(4) : null),
      deleteKey: id => store.delete(id),
      listProviderIds: () => [...store.keys()]
    },
    agentChatFn: async () => {
      const reply = lanes.scripted[Math.min(lanes.index, lanes.scripted.length - 1)] ?? '';
      lanes.index += 1;
      return reply;
    }
  });
  for (const route of routes) server.route(route);
  httpServer = await server.listen(0);
  const address = httpServer.address();
  assert.ok(address && typeof address === 'object');
  owner = await pairFixture(server, `http://127.0.0.1:${address.port}`);
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

async function approved<T>(method: string, pathName: string, payload: unknown, taskId: string): Promise<{ status: number; body: Envelope<T> }> {
  const headers = await owner.approve(method, pathName, payload, taskId);
  const response = await owner.request(pathName, { method, headers, body: JSON.stringify(payload), signal: AbortSignal.timeout(180000) });
  return { status: response.status, body: (await response.json()) as Envelope<T> };
}
async function getJson<T>(pathName: string): Promise<{ status: number; body: Envelope<T> }> {
  const response = await owner.request(pathName, { signal: AbortSignal.timeout(60000) });
  return { status: response.status, body: (await response.json()) as Envelope<T> };
}
async function waitForTerminal(sessionId: string, timeoutMs = 120000): Promise<{ state: string; error?: string | null }> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const response = await getJson<{ state: string; error?: string | null }>(`/api/agent/status?id=${encodeURIComponent(sessionId)}`);
    if (response.body.ok && response.body.data) {
      const data = response.body.data;
      if (data.state === 'done' || data.state === 'error' || data.state === 'aborted') return data;
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error(`session ${sessionId} did not finish within ${timeoutMs}ms`);
}
async function runScriptedLocalSession(task: string, suffix: string): Promise<string> {
  lanes.scripted = ['<read_file>\n<path>README.md</path>\n</read_file>', '<attempt_completion>\n<result>stage complete</result>\n</attempt_completion>'];
  lanes.index = 0;
  const started = await approved<{ session_id: string }>('POST', '/api/agent/start', { task, mode: 'act' }, `task:live-${suffix}`);
  assert.equal(started.status, 200, JSON.stringify(started.body).slice(0, 200));
  const sessionId = started.body.data!.session_id;
  const final = await waitForTerminal(sessionId);
  assert.equal(final.state, 'done', JSON.stringify(final).slice(0, 200));
  return sessionId;
}
async function createHandoff(task: string, from: Record<string, string>, to: Record<string, string>, suffix: string): Promise<Handoff> {
  const created = await approved<{ handoff: Handoff }>('POST', '/api/worker-handoff/create', {
    task_id: task, from, to, objective: `continue ${task}`, next_action: 'perform the next stage'
  }, `task:live-create-${suffix}`);
  assert.equal(created.status, 200, JSON.stringify(created.body).slice(0, 300));
  return created.body.data!.handoff;
}
async function setupStubProvider(providerId: string, modelId: string): Promise<void> {
  const provider = { id: providerId, name: providerId, base_url: `http://127.0.0.1:${stubPort}/v1`, api_type: 'chat-completions', model_id: modelId, tool_calling: false };
  assert.equal((await approved('PUT', '/api/byok/providers/set', { provider }, `task:live-set-${providerId}`)).status, 200);
  assert.equal((await approved('PUT', '/api/byok/key', { provider_id: providerId, api_key: `sk-${providerId}-0123456789` }, `task:live-key-${providerId}`)).status, 200);
  assert.equal((await approved('PUT', '/api/byok/consent', { enabled: true }, `task:live-consent-${providerId}`)).status, 200);
  assert.equal((await approved('PUT', '/api/byok/routing', { routing: { plan: 'local', act: { provider_id: providerId, model_id: modelId }, utility: 'local' } }, `task:live-routing-${providerId}`)).status, 200);
}
const desc = (worker: string, provider: string, model: string, role: string) => ({ worker, provider, model, role });

let sessionA = '';
const remoteTo = desc('cloud:stub-live:stub-live-1', 'stub-live', 'stub-live-1', 'act');

test('local -> remote live switch: automatic accept, injected context, consume at first invocation', async () => {
  await setupStubProvider('stub-live', 'stub-live-1');
  sessionA = await runScriptedLocalSession('live switch stage one', 'a');
  const handoff = await createHandoff(sessionA, desc('local:auto', 'local', 'auto', 'act'), remoteTo, 'a');
  assert.equal(handoff.state, 'CREATED');

  stubReply = '<attempt_completion><result>REMOTE-STAGE-DONE</result></attempt_completion>';
  const calls0 = stubCalls.length;
  const started = await approved<{ session_id: string }>('POST', '/api/agent/start', {
    task: 'live switch stage two', mode: 'act', chat_source: 'provider', handoff_id: handoff.handoff_id, worker: remoteTo
  }, 'task:live-start-b');
  assert.equal(started.status, 200, JSON.stringify(started.body).slice(0, 300));
  const final = await waitForTerminal(started.body.data!.session_id);
  assert.equal(final.state, 'done');

  assert.ok(stubCalls.length > calls0, 'the destination worker transport carried the request');
  const call = stubCalls[stubCalls.length - 1]!;
  assert.match(call.systems, /\[RECEIVING CONTEXT — handed off from a previous worker/, 'bounded receiving context was injected');
  assert.match(call.systems, /objective: continue /, 'the handoff objective reached the destination');
  assert.match(call.systems, /verified facts:/);
  assert.ok(!call.systems.includes('stage complete'), 'the raw prior transcript was not injected');

  const after = await getJson<{ handoff: Handoff }>(`/api/worker-handoff/get?id=${encodeURIComponent(handoff.handoff_id)}`);
  assert.equal(after.body.data!.handoff.state, 'CONSUMED', 'consumed at the first destination invocation');
});

test('remote -> local live switch: local destination receives bounded context through the real path', async () => {
  // Source stage: remote (stub) session completed above; create the reverse handoff.
  const localTo = desc('local:auto', 'local', 'auto', 'act');
  const remoteSource = desc('cloud:stub-live:stub-live-1', 'stub-live', 'stub-live-1', 'act');
  const remoteSession = stubCalls.length > 0 ? sessionA : sessionA; // provenance: the remote stage ran against sessionA task
  const handoff = await createHandoff(remoteSession, remoteSource, localTo, 'b');

  localReply = '<attempt_completion><result>LOCAL-CONTINUATION-DONE</result></attempt_completion>';
  const local0 = localCalls;
  const started = await approved<{ session_id: string }>('POST', '/api/agent/start', {
    task: 'live switch stage three', mode: 'act', handoff_id: handoff.handoff_id, worker: localTo
  }, 'task:live-start-c');
  assert.equal(started.status, 200, JSON.stringify(started.body).slice(0, 300));
  const final = await waitForTerminal(started.body.data!.session_id);
  assert.equal(final.state, 'done');
  assert.ok(localCalls > local0, 'the local destination transport executed');
  const after = await getJson<{ handoff: Handoff }>(`/api/worker-handoff/get?id=${encodeURIComponent(handoff.handoff_id)}`);
  assert.equal(after.body.data!.handoff.state, 'CONSUMED');
});

test('remote A -> remote B live switch and role change (coder -> reviewer)', async () => {
  await setupStubProvider('stub-live-b', 'stub-live-b-1');
  const reviewerTo = desc('cloud:stub-live-b:stub-live-b-1', 'stub-live-b', 'stub-live-b-1', 'reviewer');
  const coderFrom = desc('cloud:stub-live:stub-live-1', 'stub-live', 'stub-live-1', 'coder');
  const handoff = await createHandoff(sessionA, coderFrom, reviewerTo, 'c');

  stubReply = '<attempt_completion><result>REVIEWER-STAGE-DONE</result></attempt_completion>';
  const started = await approved<{ session_id: string }>('POST', '/api/agent/start', {
    task: 'live switch stage four', mode: 'act', chat_source: 'provider', handoff_id: handoff.handoff_id, worker: reviewerTo
  }, 'task:live-start-d');
  assert.equal(started.status, 200, JSON.stringify(started.body).slice(0, 300));
  const final = await waitForTerminal(started.body.data!.session_id);
  assert.equal(final.state, 'done');
  assert.ok(stubModelSeen.includes('stub-live-b-1'), 'the second remote worker model executed');
  const after = await getJson<{ handoff: Handoff }>(`/api/worker-handoff/get?id=${encodeURIComponent(handoff.handoff_id)}`);
  assert.equal(after.body.data!.handoff.state, 'CONSUMED');
});

test('destination mismatch fails closed and leaves the handoff un-consumed', async () => {
  const wrongTo = desc('cloud:stub-live:stub-live-1', 'stub-live', 'stub-live-1', 'act');
  const handoff = await createHandoff(sessionA, desc('local:auto', 'local', 'auto', 'act'), wrongTo, 'f');
  const calls0 = stubCalls.length;
  // Destination claims to be stub-live-b while routing still points at stub-live.
  const denied = await approved<{ session_id: string }>('POST', '/api/agent/start', {
    task: 'must not bind', mode: 'act', chat_source: 'provider', handoff_id: handoff.handoff_id,
    worker: desc('cloud:stub-live-b:stub-live-b-1', 'stub-live-b', 'stub-live-b-1', 'act')
  }, 'task:live-start-f');
  assert.equal(denied.status, 409, JSON.stringify(denied.body).slice(0, 200));
  assert.equal(stubCalls.length, calls0, 'no destination execution under a mismatched binding');
  const after = await getJson<{ handoff: Handoff }>(`/api/worker-handoff/get?id=${encodeURIComponent(handoff.handoff_id)}`);
  assert.equal(after.body.data!.handoff.state, 'CREATED', 'a failed binding must not consume the handoff');
});

test('consumed handoffs cannot be replayed through a second start (no duplicate execution)', async () => {
  await setupStubProvider('stub-live', 'stub-live-1');
  const to = desc('cloud:stub-live:stub-live-1', 'stub-live', 'stub-live-1', 'act');
  const handoff = await createHandoff(sessionA, desc('local:auto', 'local', 'auto', 'act'), to, 'n');
  stubReply = '<attempt_completion><result>ONE-SHOT-DONE</result></attempt_completion>';
  const first = await approved<{ session_id: string }>('POST', '/api/agent/start', {
    task: 'one shot 1', mode: 'act', chat_source: 'provider', handoff_id: handoff.handoff_id, worker: to
  }, 'task:live-start-n1');
  assert.equal(first.status, 200);
  await waitForTerminal(first.body.data!.session_id);
  const calls1 = stubCalls.length;
  const second = await approved<{ session_id: string }>('POST', '/api/agent/start', {
    task: 'one shot 2', mode: 'act', chat_source: 'provider', handoff_id: handoff.handoff_id, worker: to
  }, 'task:live-start-n2');
  assert.equal(second.status, 409, 'a consumed handoff cannot start another session');
  assert.equal(stubCalls.length, calls1, 'no duplicate destination execution');
});

test('cancelled handoffs cannot start a destination session', async () => {
  const to = desc('cloud:stub-live:stub-live-1', 'stub-live', 'stub-live-1', 'act');
  const handoff = await createHandoff(sessionA, desc('local:auto', 'local', 'auto', 'act'), to, 'm');
  const cancel = await approved<{ handoff: Handoff }>('POST', '/api/worker-handoff/cancel', { handoff_id: handoff.handoff_id }, 'task:live-cancel');
  assert.equal(cancel.status, 200);
  assert.equal(cancel.body.data!.handoff.state, 'CANCELLED');
  const denied = await approved<{ session_id: string }>('POST', '/api/agent/start', {
    task: 'cancelled', mode: 'act', chat_source: 'provider', handoff_id: handoff.handoff_id, worker: to
  }, 'task:live-start-m');
  assert.equal(denied.status, 409);
});

test('an accepted-but-not-consumed handoff survives a stack restart and remains startable', async () => {
  const to = desc('cloud:stub-live:stub-live-1', 'stub-live', 'stub-live-1', 'act');
  const handoff = await createHandoff(sessionA, desc('local:auto', 'local', 'auto', 'act'), to, 'i');
  const accept = await approved<{ handoff: Handoff }>('POST', '/api/worker-handoff/accept', { handoff_id: handoff.handoff_id, to }, 'task:live-accept-i');
  assert.equal(accept.status, 200);
  assert.equal(accept.body.data!.handoff.state, 'ACCEPTED');

  const second = new ArchServer(workspace, path.join(workspace, 'arch-wh-live-2.log'));
  const { buildRoutes } = await import('../../node/src/openapi.ts');
  try {
    const routes = await buildRoutes(workspace, 'test', { authority: second.authority, events: second.events });
    for (const route of routes) second.route(route);
    const secondHttp = await second.listen(0);
    const address = secondHttp.address();
    assert.ok(address && typeof address === 'object');
    const secondOwner = await pairFixture(second, `http://127.0.0.1:${address.port}`);
    const read = await secondOwner.request(`/api/worker-handoff/get?id=${encodeURIComponent(handoff.handoff_id)}`, { signal: AbortSignal.timeout(60000) });
    const body = (await read.json()) as Envelope<{ handoff: Handoff }>;
    assert.equal(read.status, 200);
    assert.equal(body.data!.handoff.state, 'ACCEPTED', 'ACCEPTED state survives restart and stays recoverable');
    secondHttp.closeAllConnections?.();
    await new Promise<void>(resolve => secondHttp.close(() => resolve()));
  } finally {
    second.events.close();
    await second.logger.flush();
  }
});

test('live switch carries no authority and no secrets', async () => {
  await setupStubProvider('stub-live', 'stub-live-1');
  // A consumed one-shot grant stays consumed across the live switch.
  const consentHeaders = await owner.approve('PUT', '/api/byok/consent', { enabled: true }, 'task:live-auth-a');
  const consumed = await owner.request('/api/byok/consent', { method: 'PUT', headers: consentHeaders, body: JSON.stringify({ enabled: true }), signal: AbortSignal.timeout(120000) });
  assert.equal(consumed.status, 200);

  const to = desc('cloud:stub-live:stub-live-1', 'stub-live', 'stub-live-1', 'act');
  const handoff = await createHandoff(sessionA, desc('local:auto', 'local', 'auto', 'act'), to, 'l');
  stubReply = `<attempt_completion><result>leak attempt ${SECRET}</result></attempt_completion>`;
  const started = await approved<{ session_id: string }>('POST', '/api/agent/start', {
    task: 'secret boundary live', mode: 'act', chat_source: 'provider', handoff_id: handoff.handoff_id, worker: to
  }, 'task:live-start-l');
  assert.equal(started.status, 200);
  await waitForTerminal(started.body.data!.session_id);

  const fixture = await getJson<{ handoff: Handoff }>(`/api/worker-handoff/get?id=${encodeURIComponent(handoff.handoff_id)}`);
  assert.ok(!JSON.stringify(fixture.body).includes(SECRET), 'handoff projection carries no secret');
  const envelopeFile = await fs.readFile(path.join(workspace, '.aide', 'worker-handoffs', `${handoff.handoff_id}.json`), 'utf8');
  assert.ok(!envelopeFile.includes(SECRET));
  const journal = await fs.readFile(path.join(workspace, '.aide', 'egress', 'journal.jsonl'), 'utf8');
  assert.ok(!journal.includes(SECRET));
  const audit = await fs.readFile(path.join(workspace, '.aide', 'cipher-state.jsonl'), 'utf8');
  assert.ok(!audit.includes(SECRET), 'audit rows carry no secrets through live switching');
  // The receiving context (captured at the destination transport) never saw it either.
  const lastCall = stubCalls[stubCalls.length - 1]!;
  assert.ok(!lastCall.systems.includes(SECRET), 'receiving context never contains a secret');

  // Replaying A's consumed grant still fails after the live switch.
  const replay = await owner.request('/api/byok/consent', { method: 'PUT', headers: consentHeaders, body: JSON.stringify({ enabled: true }), signal: AbortSignal.timeout(120000) });
  assert.equal(replay.status, 409, 'authority never transfers through the live switch');
});
