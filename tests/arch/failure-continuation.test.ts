// tests/arch/failure-continuation.test.ts
// Wave 6 release proof: governed failure → continuation. Deterministic
// classification, bounded retry/switch budgets, local-only + consent
// preservation, claims-vs-facts separation, duplicate protection, cascade
// limits, restart persistence, and three live journeys over the real session
// path (scripted transports; no vendor credentials).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { randomUUID } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { ArchServer } from '../../node/src/server.ts';
import { pairFixture } from './authority-fixture.ts';

const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'aide-continuation-'));
const lanes = { scripted: [] as string[], index: 0, failWith: null as string | null, failAfter: 0, calls: 0 };

let server: ArchServer;
let httpServer: import('node:http').Server;
let owner: Awaited<ReturnType<typeof pairFixture>>;

type Envelope<T> = { ok: boolean; data?: T; error?: { code: string; message: string } };
type PlanData = { chain_id: string; decision: string; failure_class: string; attempt: number; replacements_remaining: number; retry_eligible: boolean; handoff_id: string | null; reason: string };
type ChainData = { chains: Array<{ chain_id: string; state: string; attempts: Array<{ session_id: string; failure_class: string }>; replacement_count: number; terminal_reason: string | null }> };
type HandoffData = { handoff: { handoff_id: string; failure_context: Record<string, unknown> | null; worker_claims: string[]; verified_facts: string[]; current_state: string } };

function stubRuntime(): never {
  return {
    list: () => [{ id: 'scripted-local', name: 'Scripted Local', endpoint: 'http://127.0.0.1:9/v1', model: 'scripted', context_tokens: 8192, roles: ['chat', 'act'] }],
    status: async () => ({ models: [{ id: 'scripted-local', status: 'running' }] }),
    verifyEndpointModel: async () => ({ ready: true }),
    getEffectiveContext: () => 8192,
    getEffectiveBudget: () => 8192 - 512,
    refreshServedContext: async () => undefined,
    chat: async () => { return { text: lanes.scripted[Math.min(lanes.index++, lanes.scripted.length - 1)] ?? '', modelId: 'local:scripted-local', timingMs: 1 }; },
    chatStream: async (_id: string, _messages: unknown, onDelta: (d: string) => void) => { onDelta(lanes.scripted[Math.min(lanes.index++, lanes.scripted.length - 1)] ?? ''); return { modelId: 'local:scripted-local', usedApprox: 1, dropped: 0, truncatedSystem: false, timingMs: 1 }; }
  } as unknown as never;
}

async function seedTrajectory(sessionId: string, opts: { outcome: string; error?: string; toolLog?: Array<{ tool: string; ok: boolean }> }): Promise<void> {
  const dir = path.join(workspace, '.aide', 'trajectories');
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, `${sessionId}.traj.json`), JSON.stringify({
    trajectory_format: 'aide-1', session_id: sessionId, task: `seeded ${sessionId}`, mode: 'act',
    outcome: opts.outcome, iterations: 1, mistake_count: 1, error: opts.error ?? null,
    started_at: new Date().toISOString(), ended_at: new Date().toISOString(),
    transcript: [{ role: 'user', content: 'UNTRUSTED SEEDED TRANSCRIPT MARKER' }],
    tool_log: opts.toolLog ?? []
  }, null, 2), 'utf8');
}

before(async () => {
  await fs.writeFile(path.join(workspace, 'package.json'), JSON.stringify({ name: 'continuation-fixture', scripts: { test: 'node --test' } }, null, 2), 'utf8');
  await fs.mkdir(path.join(workspace, '.aide', 'workflow'), { recursive: true });
  await fs.writeFile(path.join(workspace, '.aide', 'workflow', 'state.json'), JSON.stringify({
    version: 1, workflow_id: randomUUID(), workspace, project_id: 'continuation-project', stage: 'DISCOVERY',
    previous_stage: null, revision: 0, artifacts: [], last_transition_id: null,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString()
  }, null, 2), 'utf8');

  server = new ArchServer(workspace, path.join(workspace, 'arch-continuation.log'));
  const { buildRoutes } = await import('../../node/src/openapi.ts');
  const routes = await buildRoutes(workspace, 'test', {
    authority: server.authority,
    events: server.events,
    modelRuntime: stubRuntime(),
    agentChatFn: async () => {
      lanes.calls += 1;
      if (lanes.failWith !== null && lanes.calls > lanes.failAfter) {
        const message = lanes.failWith;
        lanes.failWith = null;
        throw new Error(message);
      }
      return lanes.scripted[Math.min(lanes.index++, lanes.scripted.length - 1)] ?? '';
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
    const response = await getJson<{ state: string; error?: string | null; pending_approval?: { approval_id: string } | null }>(`/api/agent/status?id=${encodeURIComponent(sessionId)}`);
    const data = response.body.data;
    if (data && data.pending_approval) {
      const decisionBody = { session_id: sessionId, approval_id: data.pending_approval.approval_id, decision: 'approve' };
      await approved('POST', '/api/agent/decision', decisionBody, `task:cont-decide-${data.pending_approval.approval_id.slice(0, 8)}`);
      continue;
    }
    if (data && ['done', 'error', 'aborted'].includes(data.state)) return data;
    await new Promise(resolve => setTimeout(resolve, 400));
  }
  throw new Error(`session ${sessionId} did not finish within ${timeoutMs}ms`);
}

const desc = (worker: string, provider: string, model: string, role: string) => ({ worker, provider, model, role });
const localAuto = desc('local:auto', 'local', 'auto', 'act');
const localB = desc('local:coder-2', 'local', 'coder-2', 'act');

const matrix: Array<{ id: string; error: string; outcome?: string; expected: string }> = [
  { id: 'm-timeout', error: 'provider timed out after 60s', expected: 'retry' },
  { id: 'm-transport', error: 'transport stream closed unexpectedly', expected: 'retry' },
  { id: 'm-provider', error: 'provider openai returned HTTP 503', expected: 'switch' },
  { id: 'm-local', error: 'no model is ready for role "chat"', expected: 'switch' },
  { id: 'm-refusal', error: 'the model refuses to continue with this task', expected: 'switch' },
  { id: 'm-invalid', error: 'aborted after 3 consecutive malformed steps: no tool call found', expected: 'switch' },
  { id: 'm-context', error: 'context assembly failed: resident context failed', expected: 'switch' },
  { id: 'm-authority', error: '[FORBIDDEN] not authorized for this operation', expected: 'terminal' },
  { id: 'm-stop', error: '', outcome: 'aborted', expected: 'terminal' },
  { id: 'm-internal', error: 'unexpected internal failure', expected: 'switch' }
];

test('classification matrix drives deterministic decisions (A/B/G/H/I/J partial)', async () => {
  for (const row of matrix) {
    await seedTrajectory(row.id, { outcome: row.outcome ?? 'error', error: row.error });
    const replacement = row.expected === 'retry' ? localAuto : localB;
    const plan = await approved<PlanData>('POST', '/api/agent/continuation', {
      failed_session_id: row.id, failed_worker: localAuto, replacement
    }, `task:cont-${row.id}`);
    assert.equal(plan.status, 200, `${row.id}: ${JSON.stringify(plan.body).slice(0, 200)}`);
    assert.equal(plan.body.data!.decision, row.expected, `${row.id} → ${plan.body.data!.decision} (${plan.body.data!.failure_class})`);
    if (row.expected !== 'switch') assert.equal(plan.body.data!.handoff_id, null);
    if (row.expected === 'switch') assert.ok(plan.body.data!.handoff_id !== null);
  }
});

test('role preservation and policy gates are terminal, with zero egress', async () => {
  await seedTrajectory('m-role', { outcome: 'error', error: 'provider xyz unavailable' });
  const wrongRole = await approved<PlanData>('POST', '/api/agent/continuation', {
    failed_session_id: 'm-role', failed_worker: localAuto, replacement: desc('local:reviewer', 'local', 'reviewer-1', 'reviewer')
  }, 'task:cont-role');
  assert.equal(wrongRole.body.data!.decision, 'terminal');
  assert.match(wrongRole.body.data!.reason, /role/);

  assert.equal((await approved('PUT', '/api/connections/preference', { preference: 'local-only' }, 'task:cont-pin')).status, 200);
  await seedTrajectory('m-localonly', { outcome: 'error', error: 'provider xyz unavailable' });
  const remoteReplacement = await approved<PlanData>('POST', '/api/agent/continuation', {
    failed_session_id: 'm-localonly', failed_worker: localAuto, replacement: desc('cloud:stub:c1', 'stub-provider', 'c1', 'act')
  }, 'task:cont-localonly');
  assert.equal(remoteReplacement.body.data!.decision, 'terminal');
  assert.match(remoteReplacement.body.data!.reason, /local-only/);
  const egress = await fs.access(path.join(workspace, '.aide', 'egress', 'journal.jsonl')).then(() => true).catch(() => false);
  assert.equal(egress, false, 'no egress under a blocked local-only continuation');
  assert.equal((await approved('PUT', '/api/connections/preference', { preference: 'local-first' }, 'task:cont-unpin')).status, 200);

  await seedTrajectory('m-consent', { outcome: 'error', error: 'provider xyz unavailable' });
  const noConsent = await approved<PlanData>('POST', '/api/agent/continuation', {
    failed_session_id: 'm-consent', failed_worker: localAuto, replacement: desc('cloud:stub:c2', 'stub-provider', 'c2', 'act')
  }, 'task:cont-consent');
  assert.equal(noConsent.body.data!.decision, 'terminal');
  assert.match(noConsent.body.data!.reason, /consent/);
});

test('consent + eligible remote replacement allows a governed switch (F at policy level)', async () => {
  assert.equal((await approved('PUT', '/api/byok/consent', { enabled: true }, 'task:cont-consent-on')).status, 200);
  await seedTrajectory('m-remote', { outcome: 'error', error: 'provider aaa returned HTTP 500' });
  const plan = await approved<PlanData>('POST', '/api/agent/continuation', {
    failed_session_id: 'm-remote', failed_worker: desc('cloud:aaa:m1', 'aaa', 'm1', 'act'), replacement: desc('cloud:bbb:m2', 'bbb', 'm2', 'act')
  }, 'task:cont-remote');
  assert.equal(plan.body.data!.decision, 'switch');
  assert.ok(plan.body.data!.handoff_id !== null);
});

test('cascade honors the bounded budget and ends truthfully (R)', async () => {
  const planA = await approved<PlanData>('POST', '/api/agent/continuation', {
    failed_session_id: 'm-timeout', failed_worker: localAuto, replacement: localB
  }, 'task:cont-cascade-a');
  assert.equal(planA.status, 409, 'already continued earlier in the matrix run');
  // Build a fresh chain for cascade control.
  await seedTrajectory('c-1', { outcome: 'error', error: 'provider down: HTTP 500 unreachable' });
  const s1 = await approved<PlanData>('POST', '/api/agent/continuation', { failed_session_id: 'c-1', failed_worker: localAuto, replacement: localB }, 'task:cont-c1');
  assert.equal(s1.body.data!.decision, 'switch');
  assert.equal(s1.body.data!.replacements_remaining, 1);
  const chainId = s1.body.data!.chain_id;

  await seedTrajectory('c-2', { outcome: 'error', error: 'provider down: HTTP 500 unreachable' });
  const s2 = await approved<PlanData>('POST', '/api/agent/continuation', { chain_id: chainId, failed_session_id: 'c-2', replacement: localB }, 'task:cont-c2');
  assert.equal(s2.body.data!.decision, 'switch');
  assert.equal(s2.body.data!.replacements_remaining, 0);

  await seedTrajectory('c-3', { outcome: 'error', error: 'provider down: HTTP 500 unreachable' });
  const s3 = await approved<PlanData>('POST', '/api/agent/continuation', { chain_id: chainId, failed_session_id: 'c-3', replacement: localB }, 'task:cont-c3');
  assert.equal(s3.body.data!.decision, 'terminal');
  assert.match(s3.body.data!.reason, /budget exhausted/);
  assert.equal(s3.body.data!.handoff_id, null);

  const chain = await getJson<ChainData>(`/api/agent/continuation?chain_id=${encodeURIComponent(chainId)}`);
  assert.equal(chain.body.data!.chains[0]!.state, 'terminal');
  assert.equal(chain.body.data!.chains[0]!.attempts.length, 3);
});

test('duplicate continuation requests are rejected (M) and chains are queryable for provenance', async () => {
  const again = await approved<PlanData>('POST', '/api/agent/continuation', { failed_session_id: 'c-1', failed_worker: localAuto, replacement: localB }, 'task:cont-dup');
  assert.equal(again.status, 409);
  assert.match(String(again.body.error?.message ?? ''), /already continued/);
  const list = await getJson<ChainData>('/api/agent/continuations');
  assert.equal(list.status, 200);
  assert.ok(list.body.data!.chains.length >= 4, 'chains persist for provenance');
});

test('failure handoff carries bounded failure_context and never promotes claims to facts (S)', async () => {
  await seedTrajectory('s-1', {
    outcome: 'error', error: 'provider sss returned HTTP 500',
    toolLog: [{ tool: 'read_file', ok: true }]
  });
  await fs.mkdir(path.join(workspace, '.aide', 'verifications'), { recursive: true });
  await fs.writeFile(path.join(workspace, '.aide', 'verifications', 's-1.verification.json'), JSON.stringify({
    trajectory_format: 'aide-1', session_id: 's-1', task: 'seeded s-1', mode: 'act', outcome: 'error',
    generated_at: new Date().toISOString(), verifier: 'harness/veritas.mjs; agent required-evidence policy',
    verdict: { passed: false }, execution: { results: [{ name: '1.read_file', passed: true, skipped: false, reason: 'ok' }] },
    trajectory_file: 's-1.traj.json',
    verification: { execution: 'failed', state: 'failed', passed: false, checks: [] }
  }, null, 2), 'utf8');
  const plan = await approved<PlanData>('POST', '/api/agent/continuation', {
    failed_session_id: 's-1', failed_worker: localAuto, replacement: localB
  }, 'task:cont-s1');
  assert.equal(plan.status, 200);
  assert.equal(plan.body.data!.decision, 'switch');
  const handoffId = plan.body.data!.handoff_id!;
  const handoff = await getJson<HandoffData>(`/api/worker-handoff/get?id=${encodeURIComponent(handoffId)}`);
  const envelope = handoff.body.data!.handoff;
  assert.ok(envelope.failure_context !== null, 'failure context present');
  assert.equal((envelope.failure_context as { classification?: string }).classification, 'PROVIDER_UNAVAILABLE');
  assert.equal((envelope.failure_context as { last_successful_stage?: string }).last_successful_stage, 'read_file');
  assert.ok(envelope.verified_facts.some(fact => /step 1\.read_file: passed/.test(fact)), 'only canonical passed steps are facts');
  assert.ok(envelope.worker_claims.some(claim => /error/.test(claim)), 'failure stays a worker claim');
  const serialized = JSON.stringify(envelope);
  assert.ok(!serialized.includes('UNTRUSTED SEEDED TRANSCRIPT MARKER'), 'raw transcript never enters the failure handoff');
});

test('restart: chains and failure records persist on a fresh stack (N/O/P)', async () => {
  const fresh = new ArchServer(workspace, path.join(workspace, 'arch-continuation-2.log'));
  const { buildRoutes } = await import('../../node/src/openapi.ts');
  try {
    const routes = await buildRoutes(workspace, 'test', { authority: fresh.authority, events: fresh.events, modelRuntime: stubRuntime() });
    for (const route of routes) fresh.route(route);
    const freshHttp = await fresh.listen(0);
    const address = freshHttp.address();
    assert.ok(address && typeof address === 'object');
    const freshOwner = await pairFixture(fresh, `http://127.0.0.1:${address.port}`);
    const chains = await freshOwner.request('/api/agent/continuations', { signal: AbortSignal.timeout(60000) });
    const body = (await chains.json()) as Envelope<ChainData>;
    assert.equal(chains.status, 200);
    assert.ok(body.data!.chains.length >= 4, 'continuation chains survive restart');
    assert.ok(body.data!.chains.some(chain => chain.state === 'terminal'));
    freshHttp.closeAllConnections?.();
    await new Promise<void>(resolve => freshHttp.close(() => resolve()));
  } finally {
    fresh.events.close();
    await fresh.logger.flush();
  }
});

// --- Live journeys over the real session path ---

test('Journey 1: live local failure → governed switch → replacement completes the same task', async () => {
  // A: fails after its first reply with a timeout-class error.
  lanes.scripted = ['<read_file>\n<path>package.json</path>\n</read_file>', 'never used'];
  lanes.index = 0;
  lanes.calls = 0;
  lanes.failWith = 'provider timed out after 60s';
  lanes.failAfter = 1;
  const startedA = await approved<{ session_id: string }>('POST', '/api/agent/start', { task: 'journey one task', mode: 'act' }, 'task:j1-a');
  assert.equal(startedA.status, 200);
  const sessionA = startedA.body.data!.session_id;
  const finalA = await waitForTerminal(sessionA);
  assert.equal(finalA.state, 'error');
  assert.match(String(finalA.error ?? ''), /timed out/);

  // Governed continuation: replacement differs by model → switch.
  const plan = await approved<PlanData>('POST', '/api/agent/continuation', {
    failed_session_id: sessionA, failed_worker: localAuto, replacement: localB
  }, 'task:j1-plan');
  assert.equal(plan.body.data!.decision, 'switch', JSON.stringify(plan.body).slice(0, 300));
  assert.equal(plan.body.data!.failure_class, 'TIMEOUT');
  const handoffId = plan.body.data!.handoff_id!;

  // B: runs through the accepted Wave-4 live path with the continuation handoff.
  lanes.scripted = ['<attempt_completion><result>JOURNEY1-REPLACEMENT-DONE</result></attempt_completion>'];
  lanes.index = 0;
  const startedB = await approved<{ session_id: string }>('POST', '/api/agent/start', {
    task: 'journey one continuation', mode: 'act', handoff_id: handoffId, worker: localB
  }, 'task:j1-b');
  assert.equal(startedB.status, 200, JSON.stringify(startedB.body).slice(0, 250));
  const sessionB = startedB.body.data!.session_id;
  assert.equal((await waitForTerminal(sessionB)).state, 'done');

  const trajectoryB = await fs.readFile(path.join(workspace, '.aide', 'trajectories', `${sessionB}.traj.json`), 'utf8');
  assert.match(trajectoryB, /RECEIVING CONTEXT — handed off from a previous worker/);
  assert.match(trajectoryB, /JOURNEY1-REPLACEMENT-DONE/);
  const handoff = await getJson<HandoffData & { handoff: { task_id: string } }>(`/api/worker-handoff/get?id=${encodeURIComponent(handoffId)}`);
  assert.equal((handoff.body.data!.handoff as { task_id: string }).task_id, sessionA, 'the continuation handoff carries the failed session task identity');
});

test('Journey 2: local-only failure with no eligible local replacement blocks with zero egress', async () => {
  assert.equal((await approved('PUT', '/api/connections/preference', { preference: 'local-only' }, 'task:j2-pin')).status, 200);
  lanes.scripted = ['x'];
  lanes.index = 0;
  lanes.calls = 0;
  lanes.failWith = 'engine process died unexpectedly';
  lanes.failAfter = 0;
  const started = await approved<{ session_id: string }>('POST', '/api/agent/start', { task: 'journey two local only', mode: 'act' }, 'task:j2-a');
  assert.equal(started.status, 200);
  const session = started.body.data!.session_id;
  assert.equal((await waitForTerminal(session)).state, 'error');

  const plan = await approved<PlanData>('POST', '/api/agent/continuation', {
    failed_session_id: session, failed_worker: localAuto, replacement: desc('cloud:stub:c3', 'stub-provider', 'c3', 'act')
  }, 'task:j2-plan');
  assert.equal(plan.body.data!.decision, 'terminal');
  assert.match(plan.body.data!.reason, /local-only/);
  assert.equal(plan.body.data!.handoff_id, null);
  const egress = await fs.access(path.join(workspace, '.aide', 'egress', 'journal.jsonl')).then(() => true).catch(() => false);
  assert.equal(egress, false, 'zero remote egress while blocked');
  assert.equal((await approved('PUT', '/api/connections/preference', { preference: 'local-first' }, 'task:j2-unpin')).status, 200);
});

test('Journey 3: partial effect is not replayed; replacement continues from canonical state', async () => {
  const target = path.join(workspace, 'journey3-output.txt');
  lanes.scripted = [`<write_file>\n<path>journey3-output.txt</path>\n<content>written by A\n</content>\n</write_file>`];
  lanes.index = 0;
  lanes.calls = 0;
  lanes.failWith = 'provider timed out after 60s';
  lanes.failAfter = 1;
  const startedA = await approved<{ session_id: string }>('POST', '/api/agent/start', { task: 'journey three partial effect', mode: 'act' }, 'task:j3-a');
  assert.equal(startedA.status, 200);
  const sessionA = startedA.body.data!.session_id;
  const finalA = await waitForTerminal(sessionA);
  assert.equal(finalA.state, 'error');
  const written = await fs.readFile(target, 'utf8');
  assert.equal(written, 'written by A\n', 'the partial effect exists on disk');

  const plan = await approved<PlanData>('POST', '/api/agent/continuation', {
    failed_session_id: sessionA, failed_worker: localAuto, replacement: localB
  }, 'task:j3-plan');
  assert.equal(plan.body.data!.decision, 'switch');
  const handoffId = plan.body.data!.handoff_id!;
  const handoff = await getJson<HandoffData>(`/api/worker-handoff/get?id=${encodeURIComponent(handoffId)}`);
  const failureContext = handoff.body.data!.handoff.failure_context as { last_successful_stage?: string } | null;
  assert.equal(failureContext?.last_successful_stage, 'write_file', 'canonical last successful stage is carried');

  lanes.scripted = ['<attempt_completion><result>JOURNEY3-CONTINUED-DONE</result></attempt_completion>'];
  lanes.index = 0;
  const startedB = await approved<{ session_id: string }>('POST', '/api/agent/start', {
    task: 'journey three continuation', mode: 'act', handoff_id: handoffId, worker: localB
  }, 'task:j3-b');
  assert.equal(startedB.status, 200);
  assert.equal((await waitForTerminal(startedB.body.data!.session_id)).state, 'done');
  const after = await fs.readFile(target, 'utf8');
  assert.equal(after, 'written by A\n', 'the continuation does not replay or duplicate the effect');
  const follows = await fs.readdir(path.join(workspace, '.aide', 'trajectories')).then(entries => entries.filter(entry => entry.startsWith(startedB.body.data!.session_id)));
  assert.equal(follows.length, 1, 'B executed exactly once');
});
