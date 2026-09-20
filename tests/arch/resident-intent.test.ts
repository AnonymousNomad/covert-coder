// tests/arch/resident-intent.test.ts
// Wave 5 release proof: deterministic Resident intent-readiness gate. READY
// requires no unnecessary questions; underspecified requests get the minimum
// clarification; clarification persists, binds replies safely, and NEVER
// executes work or grants authority.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { randomUUID } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { ArchServer } from '../../node/src/server.ts';
import { pairFixture } from './authority-fixture.ts';

const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'aide-resident-intent-'));
let server: ArchServer;
let httpServer: import('node:http').Server;
let owner: Awaited<ReturnType<typeof pairFixture>>;

type Envelope<T> = { ok: boolean; data?: T; error?: { code: string; message: string } };
type Readiness = {
  readiness_id: string;
  status: 'READY' | 'NEEDS_CLARIFICATION' | 'BLOCKED';
  task: string;
  task_class: string;
  known_requirements: string[];
  missing_requirements: string[];
  safe_assumptions: string[];
  unsafe_assumptions: string[];
  clarification_questions: Array<{ id: string; question: string; options: string[] }>;
  risk_class: string;
  authority_relevance: string;
  autonomy: string;
  resolution: string;
};

async function buildStack(target: string): Promise<{ server: ArchServer; http: import('node:http').Server }> {
  const arch = new ArchServer(target, path.join(target, `arch-intent-${randomUUID().slice(0, 8)}.log`));
  const { buildRoutes } = await import('../../node/src/openapi.ts');
  const routes = await buildRoutes(target, 'test', { authority: arch.authority, events: arch.events });
  for (const route of routes) arch.route(route);
  const http = await arch.listen(0);
  return { server: arch, http };
}

before(async () => {
  await fs.writeFile(path.join(workspace, 'package.json'), JSON.stringify({ name: 'resident-intent-fixture', scripts: { test: 'node --test' } }, null, 2), 'utf8');
  await fs.mkdir(path.join(workspace, '.git'), { recursive: true });
  await fs.mkdir(path.join(workspace, '.aide', 'workflow'), { recursive: true });
  await fs.writeFile(path.join(workspace, '.aide', 'workflow', 'state.json'), JSON.stringify({
    version: 1, workflow_id: randomUUID(), workspace, project_id: 'intent-project', stage: 'DISCOVERY',
    previous_stage: null, revision: 0, artifacts: [], last_transition_id: null,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString()
  }, null, 2), 'utf8');

  server = new ArchServer(workspace, path.join(workspace, 'arch-intent.log'));
  const { buildRoutes } = await import('../../node/src/openapi.ts');
  const routes = await buildRoutes(workspace, 'test', { authority: server.authority, events: server.events });
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

async function assess(payload: Record<string, unknown>): Promise<{ status: number; body: Envelope<Readiness> }> {
  const response = await owner.request('/api/resident/intent', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(60000)
  });
  return { status: response.status, body: (await response.json()) as Envelope<Readiness> };
}

async function setPolicy(autonomy: 'supervised' | 'bounded'): Promise<void> {
  await fs.writeFile(path.join(workspace, '.aide', 'resident-policy.json'), JSON.stringify({ autonomy }), 'utf8');
}

async function noExecutionEvidence(): Promise<void> {
  const egress = await fs.access(path.join(workspace, '.aide', 'egress', 'journal.jsonl')).then(() => true).catch(() => false);
  assert.equal(egress, false, 'no provider egress may exist while clarification is pending');
  const trajectories = await fs.readdir(path.join(workspace, '.aide', 'trajectories')).catch(() => [] as string[]);
  assert.equal(trajectories.length, 0, 'no worker session may exist while clarification is pending');
  const audit = await fs.readFile(path.join(workspace, '.aide', 'cipher-state.jsonl'), 'utf8').catch(() => '');
  assert.ok(!audit.includes('"type":"agent"'), 'no agent execution rows may be written by the gate');
}

test('A/N: a fully specified task is READY with zero unnecessary questions', async () => {
  const res = await assess({ task: 'Run the tests and fix whatever broke.' });
  assert.equal(res.status, 200, JSON.stringify(res.body).slice(0, 200));
  const data = res.body.data!;
  assert.equal(data.status, 'READY');
  assert.equal(data.clarification_questions.length, 0);
  assert.ok(data.safe_assumptions.some(line => /test runner/i.test(line)), 'canonical test runner is assumed, not asked');
  assert.ok(data.known_requirements.some(line => /project: intent-project/.test(line)));
  assert.ok(!data.clarification_questions.some(q => /project|repository/i.test(q.question)), 'no redundant project question');
});

test('B/K/L: "Fix it." requires clarification and produces no execution or egress', async () => {
  const res = await assess({ task: 'Fix it.' });
  assert.equal(res.status, 200);
  const data = res.body.data!;
  assert.equal(data.status, 'NEEDS_CLARIFICATION');
  assert.ok(data.clarification_questions.some(q => q.id === 'target'));
  assert.ok(data.clarification_questions.length <= 3, 'minimum useful questions only');
  await noExecutionEvidence();
});

test('D: an ambiguous destructive target requires clarification with the authority notice', async () => {
  const res = await assess({ task: 'Delete the old deployment.' });
  const data = res.body.data!;
  assert.equal(data.status, 'NEEDS_CLARIFICATION');
  assert.ok(data.clarification_questions.some(q => q.id === 'target'));
  assert.equal(data.risk_class, 'high');
  assert.match(data.authority_relevance, /Execution Authority still requires an approved exact operation/i);
  await noExecutionEvidence();
});

test('E: bounded autonomy records a reversible implementation choice and proceeds', async () => {
  await setPolicy('bounded');
  const res = await assess({ task: 'Create a landing page.' });
  const data = res.body.data!;
  assert.equal(data.status, 'READY', JSON.stringify(data).slice(0, 300));
  assert.ok(data.unsafe_assumptions.some(line => /implementation/i.test(line)), 'the reversible default is recorded');
  assert.equal(data.clarification_questions.length, 0);
});

test('F: the same ambiguity under supervised mode asks the user', async () => {
  await setPolicy('supervised');
  const res = await assess({ task: 'Create a landing page.' });
  const data = res.body.data!;
  assert.equal(data.status, 'NEEDS_CLARIFICATION');
  assert.ok(data.clarification_questions.some(q => q.id === 'implementation'));
});

test('journey 1: "Build me an app." asks only the critical platform question, then proceeds on reply', async () => {
  const first = await assess({ task: 'Build me an app.' });
  const data = first.body.data!;
  assert.equal(data.status, 'NEEDS_CLARIFICATION');
  assert.deepEqual(data.clarification_questions.map(q => q.id), ['platform']);
  assert.ok(data.clarification_questions[0]!.options.length >= 3, 'bounded choices, not an open interview');

  const reply = await assess({ pending_id: data.readiness_id, answers: { platform: 'web' } });
  const answered = reply.body.data!;
  assert.equal(answered.status, 'READY');
  assert.equal(answered.readiness_id, data.readiness_id, 'same task identity continues');
  assert.equal(answered.task, 'Build me an app.', 'the original request text is preserved');
  assert.equal(answered.resolution, 'answered');
});

test('G: clarification replies reevaluate the SAME pending task to READY', async () => {
  const pending = await assess({ task: 'Fix it.' });
  const id = pending.body.data!.readiness_id;
  const reply = await assess({ pending_id: id, answers: { target: 'the login flow regression' } });
  assert.equal(reply.body.data!.status, 'READY');
  assert.equal(reply.body.data!.readiness_id, id);
  assert.equal(reply.body.data!.resolution, 'answered');
});

test('I: ambiguous replies never bind silently across multiple pending tasks', async () => {
  const first = await assess({ task: 'Fix it again.' });
  const second = await assess({ task: 'Delete the old deployment.' });
  const idA = first.body.data!.readiness_id;
  const idB = second.body.data!.readiness_id;
  assert.notEqual(idA, idB);

  const ambiguous = await assess({ answers: { target: 'something' } });
  const data = ambiguous.body.data!;
  assert.equal(data.resolution, 'ambiguous-pending');
  assert.equal(data.status, 'NEEDS_CLARIFICATION');
  const options = data.clarification_questions[0]!.options;
  assert.ok(options.includes(idA) && options.includes(idB), 'pending task ids are the bounded choices');

  const bound = await assess({ pending_id: idB, answers: { target: 'staging environment files' } });
  assert.equal(bound.body.data!.status, 'READY');
  assert.equal(bound.body.data!.readiness_id, idB, 'the reply bound to the chosen task only');
});

test('H: clarification state survives a fresh stack (restart)', async () => {
  const pending = await assess({ task: 'Fix it after restart.' });
  const id = pending.body.data!.readiness_id;

  const second = await buildStack(workspace);
  try {
    const address = second.http.address();
    assert.ok(address && typeof address === 'object');
    const secondOwner = await pairFixture(second.server, `http://127.0.0.1:${address.port}`);
    const list = await secondOwner.request('/api/resident/intents', { signal: AbortSignal.timeout(60000) });
    const listed = (await list.json()) as Envelope<{ pending: Array<{ readiness_id: string; task: string }> }>;
    assert.ok(listed.data!.pending.some(entry => entry.readiness_id === id), 'the pending clarification survives restart');
    const reply = await secondOwner.request('/api/resident/intent', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pending_id: id, answers: { target: 'the failing integration test' } }),
      signal: AbortSignal.timeout(60000)
    });
    const replied = (await reply.json()) as Envelope<Readiness>;
    assert.equal(replied.data!.status, 'READY');
    assert.equal(replied.data!.readiness_id, id);
  } finally {
    second.http.closeAllConnections?.();
    await new Promise<void>(resolve => second.http.close(() => resolve()));
    second.server.events.close();
    await second.server.logger.flush();
  }
});

test('J: readiness grants no authority — protected writes still require approval', async () => {
  const ready = await assess({ task: 'Enable provider egress for the project.' });
  assert.ok(['READY', 'NEEDS_CLARIFICATION'].includes(ready.body.data!.status));
  const unapproved = await owner.request('/api/byok/consent', {
    method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ enabled: true }), signal: AbortSignal.timeout(30000)
  });
  assert.equal(unapproved.status, 409, 'no approval was minted by readiness');
});

test('M: unsupported workflows are reported truthfully, not improvised', async () => {
  const res = await assess({ task: 'Publish this to the App Store.' });
  const data = res.body.data!;
  assert.equal(data.status, 'BLOCKED');
  assert.equal(data.resolution, 'unsupported');
  assert.ok(data.missing_requirements.some(line => /workflow/i.test(line)));
  await noExecutionEvidence();
});
