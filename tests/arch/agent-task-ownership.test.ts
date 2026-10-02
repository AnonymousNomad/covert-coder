import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createAgentLoop } from '../../node/src/services/agent-loop.mjs';
import { AgentStartRequest } from '../../common/contracts/agent.ts';
import { pairServiceFixture } from './authority-fixture.ts';

const completed = '<attempt_completion><result>controlled task complete</result></attempt_completion>';
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(r => { resolve = r; });
  return { promise, resolve };
}
async function eventually(probe: () => boolean) {
  const end = Date.now() + 5000;
  while (!probe() && Date.now() < end) await new Promise(r => setTimeout(r, 10));
  assert.ok(probe(), 'controlled lifecycle must settle within its observation deadline');
}

test('root AgentLoop serializes callers until the owned runner settles', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'covert-agent-ownership-'));
  const fixture = await pairServiceFixture(workspace);
  const held = deferred<string>();
  let calls = 0;
  const loop = createAgentLoop({ workspace, authority: fixture.authority, chatFn: async () => { calls++; return held.promise; } });
  try {
    const first = await fixture.startAgent(loop, 'first owned task');
    await eventually(() => calls === 1);
    await assert.rejects(fixture.startAgent(loop, 'overlapping task'), { code: 'CONFLICT' });
    assert.equal(calls, 1);
    held.resolve(completed);
    await eventually(() => loop.status(first.session_id).state === 'done');
    const second = await fixture.startAgent(loop, 'subsequent task', 'act', async () => completed);
    await eventually(() => loop.status(second.session_id).state === 'done');
  } finally {
    held.resolve(completed);
    await eventually(() => loop.list().every(s => ['done', 'error', 'aborted'].includes(s.state)));
    fixture.authority.control.close();
  }
});

test('correlated starts recover one session and reject changed request or owner', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'covert-agent-correlation-'));
  const fixture = await pairServiceFixture(workspace);
  const held = deferred<string>();
  let calls = 0;
  const loop = createAgentLoop({ workspace, authority: fixture.authority, chatFn: async () => { calls++; return held.promise; } });
  const body = { task: 'recoverable controlled task', mode: 'act' as const, client_request_id: randomUUID() };
  const start = (request: { task: string; mode: 'act'; client_request_id: string } = body) => fixture.approveAndExecute('agent.start', request, 'correlated-start', execution => loop.start(request.task, request.mode, null, { request, execution }));
  try {
    const first = await start();
    await eventually(() => calls === 1);
    assert.deepEqual(await start(), first);
    assert.deepEqual(await start({ ...body, client_request_id: body.client_request_id.toUpperCase() }), first);
    assert.equal(calls, 1);
    await assert.rejects(start({ ...body, task: 'changed task' }), { code: 'CONFLICT' });
    const origin = 'http://other-fixture.local';
    const paired = await fixture.authority.pair(fixture.authority.control.createPairing(origin), origin);
    const other = fixture.authority.authenticate(paired.token, origin);
    const input = { workspace, kind: 'agent.start', taskId: 'foreign-recovery', args: { body } };
    const op = await fixture.authority.prepare(other, input);
    await fixture.authority.decide(other, op.operation_id, 'approve');
    await assert.rejects(fixture.authority.execute(other, op.operation_id, input, (_, execution) => loop.start(body.task, body.mode, null, { request: body, execution })), { code: 'FORBIDDEN' });
    held.resolve(completed);
    await eventually(() => loop.status(first.session_id).state === 'done');
    assert.deepEqual(await start(), first);
    assert.equal(calls, 1);
  } finally {
    held.resolve(completed);
    await eventually(() => loop.list().every(s => ['done', 'error', 'aborted'].includes(s.state)));
    fixture.authority.control.close();
  }
});

test('a refused correlated key stays refused after the first task completes', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'covert-agent-refused-key-'));
  const fixture = await pairServiceFixture(workspace);
  const held = deferred<string>();
  const loop = createAgentLoop({ workspace, authority: fixture.authority, chatFn: async () => held.promise });
  const body = { task: 'refused overlap', mode: 'act' as const, client_request_id: randomUUID() };
  const start = () => fixture.approveAndExecute('agent.start', body, 'refused-key', execution => loop.start(body.task, body.mode, null, { execution, request: body }));
  try {
    const first = await fixture.startAgent(loop, 'existing owner');
    await assert.rejects(start(), { code: 'CONFLICT' });
    held.resolve(completed);
    await eventually(() => loop.status(first.session_id).state === 'done');
    await assert.rejects(start(), { code: 'CONFLICT' });
    assert.equal(loop.list().length, 1);
  } finally { held.resolve(completed); await eventually(() => loop.list().every(s => ['done', 'error', 'aborted'].includes(s.state))); fixture.authority.control.close(); }
});

test('start correlation is optional, strict and UUID validated', () => {
  assert.equal(AgentStartRequest.safeParse({ task: 'legacy' }).success, true);
  assert.equal(AgentStartRequest.safeParse({ task: 'correlated', client_request_id: randomUUID() }).success, true);
  assert.equal(AgentStartRequest.safeParse({ task: 'bad', client_request_id: 'not-a-uuid' }).success, false);
  assert.equal(AgentStartRequest.safeParse({ task: 'bad', invented_authority: true }).success, false);
});

test('start snapshots the approved request before queued admission', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'covert-agent-request-snapshot-'));
  const fixture = await pairServiceFixture(workspace);
  const unexpected = () => { throw new Error('refused snapshot fixture cannot proceed'); };
  let observedModel: unknown;
  const loop = createAgentLoop({ workspace, authority: fixture.authority, chatFn: async () => completed, attemptJournal: {
    prepare: async input => { observedModel = (input as { worker_model: unknown }).worker_model; throw new Error('controlled snapshot refusal'); },
    seal: unexpected, admit: unexpected, recordEvent: unexpected, assertAdmitted: unexpected,
    executionStarted: unexpected, bindContext: unexpected, effectObserved: unexpected, effectUncertain: unexpected,
    verificationStarted: unexpected, finalize: unexpected, noteMutationDispatch: unexpected, clearMutationDispatch: unexpected,
    uncertainAttempts: new Set<string>(),
  } });
  const body = { task: 'snapshot exact request', mode: 'act' as const, client_request_id: randomUUID(), worker: { worker: 'local:approved-model', provider: 'local', model: 'approved-model', role: 'act' } };
  try {
    await assert.rejects(fixture.approveAndExecute('agent.start', body, 'request-snapshot', execution => {
      const result = loop.start(body.task, body.mode, null, { execution, request: body });
      body.worker.model = 'changed-after-approval';
      return result;
    }), /controlled snapshot refusal/);
    assert.equal(observedModel, 'approved-model');
  } finally { fixture.authority.control.close(); }
});

test('reservation covers asynchronous admission, and failed startup revokes its actor', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'covert-agent-admission-'));
  const fixture = await pairServiceFixture(workspace);
  const held = deferred<void>();
  const entered = deferred<void>();
  const actors: Array<ReturnType<typeof fixture.authority.control.delegate>> = [];
  let prepares = 0;
  const authority = { ...fixture.authority, control: { ...fixture.authority.control, delegate: (...args: Parameters<typeof fixture.authority.control.delegate>) => {
    const actor = fixture.authority.control.delegate(...args); actors.push(actor); return actor;
  } } };
  const unexpected = () => { throw new Error('refused admission must not reach another journal method'); };
  const loop = createAgentLoop({ workspace, authority, chatFn: async () => completed, attemptJournal: {
    prepare: async () => { prepares++; entered.resolve(); await held.promise; throw new Error('controlled durable admission failure'); },
    seal: unexpected, admit: unexpected, recordEvent: unexpected, assertAdmitted: unexpected,
    executionStarted: unexpected, bindContext: unexpected, effectObserved: unexpected, effectUncertain: unexpected,
    verificationStarted: unexpected, finalize: unexpected, noteMutationDispatch: unexpected, clearMutationDispatch: unexpected,
    uncertainAttempts: new Set<string>(),
  } });
  const body = { task: 'held admission', mode: 'act' as const, client_request_id: randomUUID() };
  const start = () => fixture.approveAndExecute('agent.start', body, 'held-start', execution => loop.start(body.task, body.mode, null, { execution, request: body }));
  const first = start();
  const failed = assert.rejects(first, error => (error as { detail?: { start_outcome?: string } }).detail?.start_outcome === 'not_started');
  try {
    await entered.promise;
    const duplicate = start();
    const duplicateFailed = assert.rejects(duplicate, /controlled durable admission failure/);
    await assert.rejects(fixture.startAgent(loop, 'overlap during admission'), { code: 'CONFLICT' });
    held.resolve(); await failed; await duplicateFailed;
    assert.equal(prepares, 1);
    assert.equal(loop.list().length, 0);
    assert.equal(actors.length, 1);
    assert.throws(() => fixture.authority.assertActor(actors[0]!), /revoked/);
    await assert.rejects(start(), /controlled durable admission failure/);
    assert.equal(prepares, 1, 'failed key must not dispatch again');
    await assert.rejects(fixture.startAgent(loop, 'next independent attempt'), /controlled durable admission failure/);
    assert.equal(prepares, 2, 'failed startup released its exact reservation');
  } finally { held.resolve(); await failed; fixture.authority.control.close(); }
});

test('completed task revokes only its delegated actor', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'covert-agent-revoke-'));
  const fixture = await pairServiceFixture(workspace);
  let actor: ReturnType<typeof fixture.authority.control.delegate> | null = null;
  const authority = { ...fixture.authority, control: { ...fixture.authority.control, delegate: (...args: Parameters<typeof fixture.authority.control.delegate>) => {
    actor = fixture.authority.control.delegate(...args); return actor;
  } } };
  const loop = createAgentLoop({ workspace, authority, chatFn: async () => completed });
  try {
    const task = await fixture.startAgent(loop, 'complete and release');
    await eventually(() => loop.status(task.session_id).state === 'done');
    assert.ok(actor);
    assert.throws(() => fixture.authority.assertActor(actor!), /revoked/);
    fixture.authority.assertActor(fixture.owner);
  } finally { fixture.authority.control.close(); }
});

test('failed delegated-actor cleanup keeps root admission closed', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'covert-agent-cleanup-failure-'));
  const fixture = await pairServiceFixture(workspace);
  let cleanupAttempted = false;
  const authority = { ...fixture.authority, control: { ...fixture.authority.control, revoke: () => {
    cleanupAttempted = true; throw new Error('controlled actor cleanup failure');
  } } };
  const loop = createAgentLoop({ workspace, authority, chatFn: async () => completed });
  try {
    const task = await fixture.startAgent(loop, 'terminal presentation but cleanup fails');
    await eventually(() => cleanupAttempted);
    assert.equal(loop.status(task.session_id).state, 'done');
    assert.equal(loop.status(task.session_id).verification?.state, 'errored');
    assert.ok(loop.status(task.session_id).verification?.errors.some(error => error.includes('controlled actor cleanup failure')));
    await assert.rejects(fixture.startAgent(loop, 'cannot overlap failed cleanup'), { code: 'CONFLICT' });
    assert.equal(loop.list().length, 1);
  } finally { fixture.authority.control.close(); }
});

test('cancellation timeout does not release a still executing worker', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'covert-agent-cancel-'));
  const fixture = await pairServiceFixture(workspace);
  const entered = deferred<void>(); const held = deferred<string>();
  const loop = createAgentLoop({ workspace, authority: fixture.authority, chatFn: async () => { entered.resolve(); return held.promise; } });
  const task = await fixture.startAgent(loop, 'worker deliberately ignores signal');
  try {
    await entered.promise;
    const input = { session_id: task.session_id };
    const response = await fixture.approveAndExecute('agent.cancel', input, task.session_id, execution => loop.cancel(task.session_id, execution));
    assert.equal(response.state, 'running', 'acknowledgement must preserve actual nonterminal state');
    await assert.rejects(fixture.startAgent(loop, 'must remain blocked'), { code: 'CONFLICT' });
    held.resolve(completed);
    await eventually(() => loop.status(task.session_id).state === 'aborted');
    const next = await fixture.startAgent(loop, 'next task after actual stop', 'act', async () => completed);
    await eventually(() => loop.status(next.session_id).state === 'done');
  } finally { held.resolve(completed); await eventually(() => loop.list().every(s => ['done', 'error', 'aborted'].includes(s.state))); fixture.authority.control.close(); }
});
