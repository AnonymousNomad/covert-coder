// tests/arch/worker-handoff.test.ts
// Wave 3 release proof: governed worker handoff — canonical derivation,
// deterministic lifecycle, restart survival, authority non-transfer, secret
// exclusion, bounded receiving context. Workers are abstract descriptors
// (local/BYOK-stub builtins); vendor certification is explicitly out of scope.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { promises as fs } from 'node:fs';
import { randomUUID } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { ArchServer } from '../../node/src/server.ts';
import { pairFixture } from './authority-fixture.ts';

const SECRET = 'sk-handoff-' + 'leak-canary-0123456789';
const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'aide-worker-handoff-'));
const lanes = { scripted: [] as string[], index: 0 };

let server: ArchServer;
let httpServer: import('node:http').Server;
let owner: Awaited<ReturnType<typeof pairFixture>>;
let base = '';

// Provider stub (transport for the remote worker session in the secret test).
let stub: http.Server;
let stubPort = 0;
let stubReply = '';

type Envelope<T> = { ok: boolean; data?: T; error?: { code: string; message: string } };
type HandoffData = { handoff: Record<string, unknown> & { handoff_id: string; state: string; task_id: string; from: Record<string, string>; to: Record<string, string> } };

async function seedWorkflowState(): Promise<void> {
  const stateFile = path.join(workspace, '.aide', 'workflow', 'state.json');
  await fs.mkdir(path.dirname(stateFile), { recursive: true });
  await fs.writeFile(stateFile, JSON.stringify({
    version: 1,
    workflow_id: randomUUID(),
    workspace,
    project_id: 'handoff-gate-project',
    stage: 'DISCOVERY',
    previous_stage: null,
    revision: 0,
    artifacts: [],
    last_transition_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }, null, 2), 'utf8');
}

before(async () => {
  await fs.writeFile(path.join(workspace, 'README.md'), '# handoff fixture\n\nhello line\n', 'utf8');
  await seedWorkflowState();

  stub = http.createServer((request, response) => {
    request.on('data', () => {});
    request.on('end', () => {
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

  server = new ArchServer(workspace, path.join(workspace, 'arch-handoff.log'));
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
  base = `http://127.0.0.1:${address.port}`;
  owner = await pairFixture(server, base);
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

async function approved<T>(method: string, pathName: string, payload: unknown, taskId: string): Promise<{ status: number; body: Envelope<T> }> {
  const headers = await owner.approve(method, pathName, payload, taskId);
  const response = await owner.request(pathName, {
    method, headers, body: JSON.stringify(payload), signal: AbortSignal.timeout(180000)
  });
  return { status: response.status, body: (await response.json()) as Envelope<T> };
}

async function getJson<T>(pathName: string, signalMs = 60000): Promise<{ status: number; body: Envelope<T> }> {
  const response = await owner.request(pathName, { signal: AbortSignal.timeout(signalMs) });
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

async function runLocalSession(task: string, taskIdSuffix: string): Promise<string> {
  lanes.scripted = [
    '<read_file>\n<path>README.md</path>\n</read_file>',
    '<attempt_completion>\n<result>session complete</result>\n</attempt_completion>'
  ];
  lanes.index = 0;
  const started = await approved<{ session_id: string }>('POST', '/api/agent/start', { task, mode: 'act' }, `task:wh-${taskIdSuffix}`);
  assert.equal(started.status, 200, JSON.stringify(started.body).slice(0, 200));
  const sessionId = started.body.data!.session_id;
  const final = await waitForTerminal(sessionId);
  assert.equal(final.state, 'done', JSON.stringify(final).slice(0, 200));
  return sessionId;
}

const worker = (name: string, provider: string, model: string, role: string) => ({ worker: name, provider, model, role });

let sessionA = '';
const localToRemote = { ...worker('local:smollm2', 'local', 'smollm2-360m-q8', 'planner'), };
const remoteWorker = worker('cloud:openai:gpt-4o', 'openai', 'gpt-4o', 'coder');
const reviewerWorker = worker('cloud:anthropic:claude', 'anthropic', 'claude-3-5-sonnet-latest', 'reviewer');

test('creates from canonical state and refuses fabricated tasks', async () => {
  sessionA = await runLocalSession('unify handoff flow', 'session-a');

  const ghost = await approved('POST', '/api/worker-handoff/create', {
    task_id: 'does-not-exist',
    from: worker('local:smollm2', 'local', 'smollm2-360m-q8', 'planner'),
    to: worker('cloud:openai:gpt-4o', 'openai', 'gpt-4o', 'coder'),
    objective: 'ghost',
    next_action: 'none'
  }, 'task:wh-create-ghost');
  assert.equal(ghost.status, 404, 'a handoff cannot be fabricated for a task without canonical state');

  const created = await approved<HandoffData>('POST', '/api/worker-handoff/create', {
    task_id: sessionA,
    from: localToRemote,
    to: remoteWorker,
    objective: 'continue the handoff gate task',
    next_action: 'implement the next bounded stage'
  }, 'task:wh-create-a');
  assert.equal(created.status, 200, JSON.stringify(created.body).slice(0, 300));
  const handoff = created.body.data!.handoff;
  assert.equal(handoff.state, 'CREATED');
  assert.equal(handoff.workspace_id, workspace, 'workspace identity is server-owned');
  assert.equal(handoff.project_id, 'handoff-gate-project', 'project identity derives from canonical workflow state');
  assert.equal(handoff.stage_id, 'DISCOVERY');
  assert.equal(handoff.task_id, sessionA);
  const facts = handoff.verified_facts as string[];
  assert.ok(facts.some(fact => /step 1\.read_file: passed/.test(fact)), `canonical passed step must be a verified fact: ${JSON.stringify(facts)}`);
  const claims = handoff.worker_claims as string[];
  assert.ok(claims.some(claim => claim.startsWith('outcome: done')));
  const evidence = handoff.evidence_refs as string[];
  assert.ok(evidence.some(ref => ref === `trajectories/${sessionA}.traj.json`));
  assert.ok(evidence.some(ref => ref === `verifications/${sessionA}.verification.json`));
});

const remoteToLocal = { ...remoteWorker };
const localCoder = worker('local:coder-3b', 'local', 'qwen2.5-coder-3b', 'coder');
const remoteB = worker('cloud:stub:b', 'stub-b', 'stub-model-b', 'reviewer');

let handoffA = '';
test('lifecycle is deterministic: accept idempotent, consume single-use, cancel terminal', async () => {
  const created = await approved<HandoffData>('POST', '/api/worker-handoff/create', {
    task_id: sessionA,
    from: localToRemote,
    to: remoteWorker,
    objective: 'lifecycle proof',
    next_action: 'accept then consume'
  }, 'task:wh-create-lifecycle');
  handoffA = created.body.data!.handoff.handoff_id;

  const accept = await approved<HandoffData>('POST', '/api/worker-handoff/accept', { handoff_id: handoffA, to: remoteWorker }, 'task:wh-accept-1');
  assert.equal(accept.status, 200);
  assert.equal(accept.body.data!.handoff.state, 'ACCEPTED');
  assert.ok(typeof accept.body.data!.handoff.accepted_at === 'string');

  const acceptAgain = await approved<HandoffData>('POST', '/api/worker-handoff/accept', { handoff_id: handoffA, to: remoteWorker }, 'task:wh-accept-2');
  assert.equal(acceptAgain.status, 200, 'accept must be idempotent for the intended destination');
  assert.equal(acceptAgain.body.data!.handoff.state, 'ACCEPTED');

  const wrongDestination = await approved<HandoffData>('POST', '/api/worker-handoff/accept', { handoff_id: handoffA, to: reviewerWorker }, 'task:wh-accept-3');
  assert.equal(wrongDestination.status, 409, 'a different destination cannot accept the handoff');

  const consume = await approved<HandoffData>('POST', '/api/worker-handoff/consume', { handoff_id: handoffA }, 'task:wh-consume-1');
  assert.equal(consume.status, 200);
  assert.equal(consume.body.data!.handoff.state, 'CONSUMED');

  const consumeAgain = await approved('POST', '/api/worker-handoff/consume', { handoff_id: handoffA }, 'task:wh-consume-2');
  assert.equal(consumeAgain.status, 409, 'consume is single-use');

  const cancelConsumed = await approved('POST', '/api/worker-handoff/cancel', { handoff_id: handoffA }, 'task:wh-cancel-1');
  assert.equal(cancelConsumed.status, 409, 'consumed handoffs are terminal');
});

test('abstract workers exist in all three directions under one task identity', async () => {
  for (const [label, from, to, suffix] of [
    ['local->remote', localToRemote, remoteWorker, 'lr'],
    ['remote->local', remoteToLocal, localCoder, 'rl'],
    ['remoteA->remoteB', remoteWorker, remoteB, 'rr']
  ] as const) {
    const created = await approved<HandoffData>('POST', '/api/worker-handoff/create', {
      task_id: sessionA, from, to, objective: `${label} continuity`, next_action: 'continue'
    }, `task:wh-dir-${suffix}`);
    assert.equal(created.status, 200, label);
    const envelope = created.body.data!.handoff;
    assert.equal(envelope.workspace_id, workspace, `${label}: same workspace`);
    assert.equal(envelope.task_id, sessionA, `${label}: same task identity`);
    assert.equal((envelope.from as Record<string, string>).provider, from.provider);
    assert.equal((envelope.to as Record<string, string>).provider, to.provider);
    const accept = await approved<HandoffData>('POST', '/api/worker-handoff/accept', { handoff_id: envelope.handoff_id, to }, `task:wh-acc-${suffix}`);
    assert.equal(accept.status, 200, `${label}: accept`);
    const consume = await approved<HandoffData>('POST', '/api/worker-handoff/consume', { handoff_id: envelope.handoff_id }, `task:wh-con-${suffix}`);
    assert.equal(consume.status, 200, `${label}: consume`);
  }

  const listed = await getJson<{ handoffs: Array<{ task_id: string }> }>(`/api/worker-handoff/list?task_id=${encodeURIComponent(sessionA)}`);
  assert.equal(listed.status, 200);
  assert.equal(listed.body.data!.handoffs.length, 5, 'all handoffs for the task are listed (creation + lifecycle + 3 directions)');
});

test('handoffs survive a second stack instance over the same workspace (restart)', async () => {
  const second = new ArchServer(workspace, path.join(workspace, 'arch-handoff-2.log'));
  const { buildRoutes } = await import('../../node/src/openapi.ts');
  try {
    const routes = await buildRoutes(workspace, 'test', { authority: second.authority, events: second.events });
    for (const route of routes) second.route(route);
    const secondHttp = await second.listen(0);
    const address = secondHttp.address();
    assert.ok(address && typeof address === 'object');
    const secondOwner = await pairFixture(second, `http://127.0.0.1:${address.port}`);
    const response = await secondOwner.request(`/api/worker-handoff/get?id=${encodeURIComponent(handoffA)}`, { signal: AbortSignal.timeout(60000) });
    const body = (await response.json()) as Envelope<HandoffData>;
    assert.equal(response.status, 200, 'handoffs are durable across stacks');
    assert.equal(body.data!.handoff.state, 'CONSUMED');
    assert.equal(body.data!.handoff.task_id, sessionA);
    secondHttp.closeAllConnections?.();
    await new Promise<void>(resolve => secondHttp.close(() => resolve()));
  } finally {
    second.events.close();
    await second.logger.flush();
  }
});

test('consumed authority does not transfer through a handoff', async () => {
  // Worker A consumes an approved exact operation.
  const consentHeaders = await owner.approve('PUT', '/api/byok/consent', { enabled: true }, 'task:wh-authority-a');
  const consumed = await owner.request('/api/byok/consent', {
    method: 'PUT', headers: consentHeaders, body: JSON.stringify({ enabled: true }), signal: AbortSignal.timeout(120000)
  });
  assert.equal(consumed.status, 200);

  // A creates a handoff; B accepts it.
  const created = await approved<HandoffData>('POST', '/api/worker-handoff/create', {
    task_id: sessionA, from: localToRemote, to: remoteB, objective: 'authority isolation', next_action: 'attempt protected action'
  }, 'task:wh-auth-create');
  const envelope = created.body.data!.handoff;
  const serialized = JSON.stringify(envelope);
  assert.ok(!serialized.includes('operation_id'), 'envelopes carry no authority operation identity');
  assert.ok(!serialized.includes('X-AIDE'), 'envelopes carry no authority header material');
  const accepted = await approved<HandoffData>('POST', '/api/worker-handoff/accept', { handoff_id: envelope.handoff_id, to: remoteB }, 'task:wh-auth-accept');
  assert.equal(accepted.status, 200);

  // Replaying A's consumed grant must still fail regardless of the handoff.
  const replay = await owner.request('/api/byok/consent', {
    method: 'PUT', headers: consentHeaders, body: JSON.stringify({ enabled: true }), signal: AbortSignal.timeout(120000)
  });
  assert.equal(replay.status, 409, 'consumed authority cannot be replayed, handoff or not');
  const consume = await approved('POST', '/api/worker-handoff/consume', { handoff_id: envelope.handoff_id }, 'task:wh-auth-consume');
  assert.equal(consume.status, 200);
});

let secretHandoffId = '';
test('synthetic secrets never enter the envelope; the raw transcript stays out', async () => {
  // Remote worker session whose provider transport returns a secret-bearing completion.
  const provider = { id: 'stub-wh', name: 'WH Stub', base_url: `http://127.0.0.1:${stubPort}/v1`, api_type: 'chat-completions', model_id: 'stub-wh-1', tool_calling: false };
  assert.equal((await approved('PUT', '/api/byok/providers/set', { provider }, 'task:wh-secret-set')).status, 200);
  assert.equal((await approved('PUT', '/api/byok/key', { provider_id: 'stub-wh', api_key: SECRET }, 'task:wh-secret-key')).status, 200);
  assert.equal((await approved('PUT', '/api/byok/routing', { routing: { plan: 'local', act: { provider_id: 'stub-wh', model_id: 'stub-wh-1' }, utility: 'local' } }, 'task:wh-secret-routing')).status, 200);
  stubReply = `<attempt_completion><result>worker output mentions ${SECRET} accidentally</result></attempt_completion>`;
  const started = await approved<{ session_id: string }>('POST', '/api/agent/start', { task: 'secret boundary stage', mode: 'act', chat_source: 'provider' }, 'task:wh-secret-start');
  assert.equal(started.status, 200);
  const sessionId = started.body.data!.session_id;
  const final = await waitForTerminal(sessionId);
  assert.equal(final.state, 'done');

  // The transcript DOES contain the secret (it happened); the envelope must not.
  const trajectory = await fs.readFile(path.join(workspace, '.aide', 'trajectories', `${sessionId}.traj.json`), 'utf8');
  assert.ok(trajectory.includes(SECRET), 'fixture precondition: the secret exists in the raw transcript');
  assert.ok(trajectory.includes('worker output mentions'), 'fixture precondition: raw model text is in the transcript');

  const created = await approved<HandoffData>('POST', '/api/worker-handoff/create', {
    task_id: sessionId, from: remoteWorker, to: localCoder, objective: 'secret boundary', next_action: 'continue without the secret'
  }, 'task:wh-secret-create');
  assert.equal(created.status, 200);
  secretHandoffId = created.body.data!.handoff.handoff_id;
  const envelopeFile = await fs.readFile(path.join(workspace, '.aide', 'worker-handoffs', `${secretHandoffId}.json`), 'utf8');
  assert.ok(!envelopeFile.includes(SECRET), 'the envelope must not contain the secret');
  assert.ok(!envelopeFile.includes('worker output mentions'), 'the envelope must not embed raw transcript text');

  const context = await getJson<{ context_block: string; approx_tokens: number }>(`/api/worker-handoff/context?id=${encodeURIComponent(secretHandoffId)}`);
  assert.equal(context.status, 200);
  assert.ok(!context.body.data!.context_block.includes(SECRET), 'the receiving context must not contain the secret');
  assert.ok(!context.body.data!.context_block.includes('worker output mentions'), 'the receiving context stays out of raw transcripts');

  const journal = await fs.readFile(path.join(workspace, '.aide', 'egress', 'journal.jsonl'), 'utf8');
  assert.ok(!journal.includes(SECRET), 'egress journal carries no secrets');
  const audit = await fs.readFile(path.join(workspace, '.aide', 'cipher-state.jsonl'), 'utf8');
  assert.ok(!audit.includes(SECRET), 'audit rows carry no secrets');
});

test('receiving context is bounded, prioritized, and free of raw transcript', async () => {
  const context = await getJson<{ context_block: string; approx_tokens: number }>(`/api/worker-handoff/context?id=${encodeURIComponent(secretHandoffId)}`);
  assert.equal(context.status, 200);
  const block = context.body.data!.context_block;
  assert.ok(block.length <= 6000, 'context block is bounded');
  assert.ok(context.body.data!.approx_tokens <= 1500, 'approx tokens stay inside the receiving budget');
  assert.match(block, /^\[WORKER HANDOFF /, 'priority header first');
  assert.match(block, /objective: secret boundary/);
  assert.match(block, /next action: continue without the secret/);
  assert.match(block, /workflow stage: DISCOVERY · project handoff-gate-project/);
  assert.match(block, /verified facts:/);
  const missing = await getJson(`/api/worker-handoff/context?id=${encodeURIComponent('00000000-0000-4000-8000-000000000000')}`);
  assert.equal(missing.status, 404, 'missing handoffs fail truthfully');
});
