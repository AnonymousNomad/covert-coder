// tests/arch/resident-intent-admission.test.ts
// Wave 5A release proof: intent readiness is AUTHORITATIVE at the real
// execution-admission boundary. Production stacks (version != 'test') refuse
// any new task start without a READY record bound to the exact request text.
// Fail-closed on every validation error; handoff continuations stay exempt.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { randomUUID } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { ArchServer } from '../../node/src/server.ts';
import { pairFixture } from './authority-fixture.ts';

const workspaceA = await fs.mkdtemp(path.join(os.tmpdir(), 'aide-admission-a-'));
const workspaceB = await fs.mkdtemp(path.join(os.tmpdir(), 'aide-admission-b-'));
const lanes = { scripted: [] as string[], index: 0 };
let localCalls = 0;

type Envelope<T> = { ok: boolean; data?: T; error?: { code: string; message: string; detail?: unknown } };
type IntentData = { readiness_id: string; status: string; task: string; resolution: string };
type SessionData = { session_id: string; state?: string };

function stubRuntime(): never {
  return {
    list: () => [{ id: 'scripted-local', name: 'Scripted Local', endpoint: 'http://127.0.0.1:9/v1', model: 'scripted', context_tokens: 8192, roles: ['chat', 'act'] }],
    status: async () => ({ models: [{ id: 'scripted-local', status: 'running' }] }),
    verifyEndpointModel: async () => ({ ready: true }),
    getEffectiveContext: () => 8192,
    getEffectiveBudget: () => 8192 - 512,
    refreshServedContext: async () => undefined,
    chat: async () => { localCalls += 1; return { text: lanes.scripted[Math.min(lanes.index++, lanes.scripted.length - 1)] ?? '', modelId: 'local:scripted-local', timingMs: 1 }; },
    chatStream: async (_id: string, _messages: unknown, onDelta: (d: string) => void) => { localCalls += 1; onDelta(lanes.scripted[Math.min(lanes.index++, lanes.scripted.length - 1)] ?? ''); return { modelId: 'local:scripted-local', usedApprox: 1, dropped: 0, truncatedSystem: false, timingMs: 1 }; }
  } as unknown as never;
}

async function seedWorkspace(target: string, projectId: string): Promise<void> {
  await fs.writeFile(path.join(target, 'package.json'), JSON.stringify({ name: projectId, scripts: { test: 'node --test' } }, null, 2), 'utf8');
  await fs.mkdir(path.join(target, '.aide', 'workflow'), { recursive: true });
  await fs.writeFile(path.join(target, '.aide', 'workflow', 'state.json'), JSON.stringify({
    version: 1, workflow_id: randomUUID(), workspace: target, project_id: projectId, stage: 'DISCOVERY',
    previous_stage: null, revision: 0, artifacts: [], last_transition_id: null,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString()
  }, null, 2), 'utf8');
}

type Stack = { server: ArchServer; http: import('node:http').Server; owner: Awaited<ReturnType<typeof pairFixture>> };

async function buildProductionStack(target: string, options: Record<string, unknown> = {}): Promise<Stack> {
  const arch = new ArchServer(target, path.join(target, `arch-admission-${randomUUID().slice(0, 8)}.log`));
  const { buildRoutes } = await import('../../node/src/openapi.ts');
  // version !== 'test' => production readiness enforcement is ON by default.
  const routes = await buildRoutes(target, 'production-test', {
    authority: arch.authority,
    events: arch.events,
    modelRuntime: stubRuntime(),
    agentChatFn: async () => lanes.scripted[Math.min(lanes.index++, lanes.scripted.length - 1)] ?? '',
    ...options
  });
  for (const route of routes) arch.route(route);
  const http = await arch.listen(0);
  const address = http.address();
  assert.ok(address && typeof address === 'object');
  const owner = await pairFixture(arch, `http://127.0.0.1:${address.port}`);
  await owner.request('/api/models/status', { signal: AbortSignal.timeout(180000) }).catch(() => {});
  return { server: arch, http, owner };
}

async function disposeStack(stack: Stack): Promise<void> {
  stack.http.closeAllConnections?.();
  await new Promise<void>(resolve => stack.http.close(() => resolve()));
  stack.server.events.close();
  await stack.server.logger.flush();
}

let stackA: Stack;
before(async () => {
  await seedWorkspace(workspaceA, 'admission-a');
  await seedWorkspace(workspaceB, 'admission-b');
  stackA = await buildProductionStack(workspaceA);
});

after(async () => {
  await disposeStack(stackA);
  for (const target of [workspaceA, workspaceB]) {
    for (let attempt = 0; attempt < 10; attempt++) {
      try {
        await fs.rm(target, { recursive: true, force: true });
        break;
      } catch (error) {
        if (!['EBUSY', 'ENOTEMPTY', 'EPERM'].includes((error as NodeJS.ErrnoException).code ?? '')) throw error;
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  }
});

async function approved<T>(stack: Stack, method: string, pathName: string, payload: unknown, taskId: string): Promise<{ status: number; body: Envelope<T> }> {
  const headers = await stack.owner.approve(method, pathName, payload, taskId);
  const response = await stack.owner.request(pathName, { method, headers, body: JSON.stringify(payload), signal: AbortSignal.timeout(180000) });
  return { status: response.status, body: (await response.json()) as Envelope<T> };
}

async function assess(stack: Stack, payload: Record<string, unknown>): Promise<Envelope<IntentData>> {
  const response = await stack.owner.request('/api/resident/intent', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(60000)
  });
  return (await response.json()) as Envelope<IntentData>;
}

async function waitForTerminal(stack: Stack, sessionId: string, timeoutMs = 120000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const response = await stack.owner.request(`/api/agent/status?id=${encodeURIComponent(sessionId)}`, { signal: AbortSignal.timeout(60000) });
    const body = (await response.json()) as Envelope<{ state: string }>;
    if (body.ok && body.data && ['done', 'error', 'aborted'].includes(body.data.state)) return body.data.state;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error(`session ${sessionId} did not finish within ${timeoutMs}ms`);
}

async function zeroEffects(target: string, callsBefore: number, scriptIndexBefore: number): Promise<void> {
  const trajectories = await fs.readdir(path.join(target, '.aide', 'trajectories')).catch(() => [] as string[]);
  assert.equal(trajectories.length, 0, 'no worker session may exist');
  const egress = await fs.access(path.join(target, '.aide', 'egress', 'journal.jsonl')).then(() => true).catch(() => false);
  assert.equal(egress, false, 'no provider egress may exist');
  const audit = await fs.readFile(path.join(target, '.aide', 'cipher-state.jsonl'), 'utf8').catch(() => '');
  assert.ok(!audit.includes('"type":"agent"'), 'no agent execution rows may exist');
  assert.equal(localCalls, callsBefore, 'no local runtime invocation may occur');
  assert.equal(lanes.index, scriptIndexBefore, 'no harness worker invocation may occur');
}

let readyTaskA = '';
let readyIdA = '';
let sessionA = '';

test('direct bypass refused: a new underspecified task cannot start without readiness', async () => {
  const calls0 = localCalls;
  const script0 = lanes.index;
  const refused = await approved<SessionData>(stackA, 'POST', '/api/agent/start', { task: 'Build me an app.', mode: 'act' }, 'task:adm-bypass');
  assert.equal(refused.status, 409, JSON.stringify(refused.body).slice(0, 200));
  assert.equal(refused.body.error?.code, 'NOT_READY');
  assert.match(String(refused.body.error?.message ?? ''), /READINESS_REQUIRED/);
  await zeroEffects(workspaceA, calls0, script0);
});

test('fabricated readiness ids are denied', async () => {
  const calls0 = localCalls;
  const script0 = lanes.index;
  const refused = await approved<SessionData>(stackA, 'POST', '/api/agent/start', {
    task: 'Build me an app.', mode: 'act', readiness_id: randomUUID()
  }, 'task:adm-fabricated');
  assert.equal(refused.status, 409);
  assert.match(String(refused.body.error?.message ?? ''), /INTENT_MISMATCH/);
  await zeroEffects(workspaceA, calls0, script0);
});

test('readiness-unavailable fails closed with zero effects', async () => {
  const sabotaged = await buildProductionStack(workspaceA, {
    residentIntentService: {
      assess: async () => { throw new Error('sabotaged'); },
      listPending: async () => [],
      assertReadyForTask: async () => { throw new Error('readiness store down'); }
    }
  });
  try {
    const calls0 = localCalls;
    const refused = await approved<SessionData>(sabotaged, 'POST', '/api/agent/start', {
      task: 'Build me an app.', mode: 'act', readiness_id: randomUUID()
    }, 'task:adm-unavailable');
    assert.equal(refused.status, 409);
    assert.match(String(refused.body.error?.message ?? ''), /READINESS_UNAVAILABLE/);
    assert.equal(localCalls, calls0);
  } finally {
    await disposeStack(sabotaged);
  }
});

test('READY happy path: bound readiness admits the task and the worker executes', async () => {
  readyTaskA = 'Run the tests and fix whatever broke.';
  const readiness = await assess(stackA, { task: readyTaskA });
  assert.equal(readiness.data!.status, 'READY', JSON.stringify(readiness).slice(0, 300));
  readyIdA = readiness.data!.readiness_id;

  lanes.scripted = ['<attempt_completion><result>ADMITTED-DONE</result></attempt_completion>'];
  lanes.index = 0;
  const started = await approved<SessionData>(stackA, 'POST', '/api/agent/start', { task: readyTaskA, mode: 'act', readiness_id: readyIdA }, 'task:adm-ready');
  assert.equal(started.status, 200, JSON.stringify(started.body).slice(0, 250));
  sessionA = started.body.data!.session_id;
  assert.equal(await waitForTerminal(stackA, sessionA), 'done');
  const trajectory = await fs.readFile(path.join(workspaceA, '.aide', 'trajectories', `${sessionA}.traj.json`), 'utf8');
  assert.match(trajectory, /ADMITTED-DONE/, 'the admitted worker executed exactly what was scripted');
});

test('clarification happy path: same identity survives to READY admission', async () => {
  const pending = await assess(stackA, { task: 'Fix it.' });
  assert.equal(pending.data!.status, 'NEEDS_CLARIFICATION');
  const answered = await assess(stackA, { pending_id: pending.data!.readiness_id, answers: { target: 'the login flow regression' } });
  assert.equal(answered.data!.status, 'READY');
  assert.equal(answered.data!.readiness_id, pending.data!.readiness_id);

  lanes.scripted = ['<attempt_completion><result>CLARIFIED-DONE</result></attempt_completion>'];
  lanes.index = 0;
  const started = await approved<SessionData>(stackA, 'POST', '/api/agent/start', { task: 'Fix it.', mode: 'act', readiness_id: answered.data!.readiness_id }, 'task:adm-clarified');
  assert.equal(started.status, 200, JSON.stringify(started.body).slice(0, 250));
  assert.equal(await waitForTerminal(stackA, started.body.data!.session_id), 'done');
});

test('wrong task text is denied for a READY id', async () => {
  const calls0 = localCalls;
  const refused = await approved<SessionData>(stackA, 'POST', '/api/agent/start', {
    task: 'Do something else entirely.', mode: 'act', readiness_id: readyIdA
  }, 'task:adm-wrongtask');
  assert.equal(refused.status, 409);
  assert.match(String(refused.body.error?.message ?? ''), /INTENT_MISMATCH/);
  assert.equal(localCalls, calls0);
});

test('wrong workspace is denied for a READY id from another workspace', async () => {
  const stackB = await buildProductionStack(workspaceB);
  try {
    const calls0 = localCalls;
    const refused = await approved<SessionData>(stackB, 'POST', '/api/agent/start', {
      task: readyTaskA, mode: 'act', readiness_id: readyIdA
    }, 'task:adm-wrongws');
    assert.equal(refused.status, 409);
    assert.match(String(refused.body.error?.message ?? ''), /INTENT_MISMATCH/);
    assert.equal(localCalls, calls0);
  } finally {
    await disposeStack(stackB);
  }
});

test('superseded READY records are denied', async () => {
  const first = await assess(stackA, { task: readyTaskA });
  const second = await assess(stackA, { task: readyTaskA });
  assert.notEqual(first.data!.readiness_id, second.data!.readiness_id);
  const calls0 = localCalls;
  const refused = await approved<SessionData>(stackA, 'POST', '/api/agent/start', {
    task: readyTaskA, mode: 'act', readiness_id: first.data!.readiness_id
  }, 'task:adm-superseded');
  assert.equal(refused.status, 409);
  assert.match(String(refused.body.error?.message ?? ''), /superseded/);
  assert.equal(localCalls, calls0);
  readyIdA = second.data!.readiness_id;
});

test('restart: a persisted READY record still admits after a fresh stack', async () => {
  const fresh = await buildProductionStack(workspaceA);
  try {
    lanes.scripted = ['<attempt_completion><result>RESTART-DONE</result></attempt_completion>'];
    lanes.index = 0;
    const started = await approved<SessionData>(fresh, 'POST', '/api/agent/start', { task: readyTaskA, mode: 'act', readiness_id: readyIdA }, 'task:adm-restart');
    assert.equal(started.status, 200, JSON.stringify(started.body).slice(0, 250));
    assert.equal(await waitForTerminal(fresh, started.body.data!.session_id), 'done');
  } finally {
    await disposeStack(fresh);
  }
});

test('restart: a pending clarification still refuses direct starts', async () => {
  const pending = await assess(stackA, { task: 'Fix it after restart.' });
  assert.equal(pending.data!.status, 'NEEDS_CLARIFICATION');
  const fresh = await buildProductionStack(workspaceA);
  try {
    const direct = await approved<SessionData>(fresh, 'POST', '/api/agent/start', { task: 'Fix it after restart.', mode: 'act' }, 'task:adm-pending-direct');
    assert.equal(direct.status, 409);
    assert.match(String(direct.body.error?.message ?? ''), /READINESS_REQUIRED/);
    const withPending = await approved<SessionData>(fresh, 'POST', '/api/agent/start', {
      task: 'Fix it after restart.', mode: 'act', readiness_id: pending.data!.readiness_id
    }, 'task:adm-pending-bound');
    assert.equal(withPending.status, 409, 'a NEEDS_CLARIFICATION record never admits');
  } finally {
    await disposeStack(fresh);
  }
});

test('handoff continuations remain exempt from re-interview and work normally', async () => {
  const localTo = { worker: 'local:auto', provider: 'local', model: 'auto', role: 'act' };
  const created = await approved<{ handoff: { handoff_id: string; state: string } }>(stackA, 'POST', '/api/worker-handoff/create', {
    task_id: sessionA, from: localTo, to: localTo, objective: 'continue after readiness', next_action: 'second stage'
  }, 'task:adm-handoff-create');
  assert.equal(created.status, 200);
  const handoffId = created.body.data!.handoff.handoff_id;

  lanes.scripted = ['<attempt_completion><result>CONTINUATION-DONE</result></attempt_completion>'];
  lanes.index = 0;
  const calls0 = localCalls;
  const started = await approved<SessionData>(stackA, 'POST', '/api/agent/start', {
    task: 'continuation stage', mode: 'act', handoff_id: handoffId, worker: localTo
  }, 'task:adm-handoff-start');
  assert.equal(started.status, 200, JSON.stringify(started.body).slice(0, 250));
  assert.equal(await waitForTerminal(stackA, started.body.data!.session_id), 'done');
  assert.equal(localCalls, calls0 + 1);
});

test('readiness mints no authority: protected writes still require approval', async () => {
  const unapproved = await stackA.owner.request('/api/byok/consent', {
    method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ enabled: true }), signal: AbortSignal.timeout(30000)
  });
  assert.equal(unapproved.status, 409);
});
