// tests/arch/onboarding-runtime.test.ts (cline/T4, 2026-09-02)
// PR A of aide-onboarding-walkthrough. End-to-end test: bring up a real
// server with the 4 onboarding routes, exercise the state machine, verify
// the state file is persisted atomically. Onboarding mutations are authority-
// bound state transitions (capability.write descriptors).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type http from 'node:http';
import * as fsModule from 'node:fs';
const fsp = fsModule.promises;
import os from 'node:os';
import path from 'node:path';
import { ArchServer } from '../../node/src/server.ts';
import { routesForOnboarding } from '../../node/src/routes/onboarding.ts';
import { routesForAuthority } from '../../node/src/routes/authority.ts';
import { pairFixture } from './authority-fixture.ts';
import { OnboardingState } from '../../common/contracts/onboarding.ts';
import { createOnboardingService, OnboardingConflictError } from '../../node/src/services/onboarding.mjs';

type Envelope<T> = { ok: boolean; data?: T; error?: { code: string; message: string } };
type Owner = Awaited<ReturnType<typeof pairFixture>>;

async function read(owner: Owner, pathName: string): Promise<{ status: number; body: Envelope<unknown> }> {
  const response = await owner.request(pathName);
  return { status: response.status, body: (await response.json()) as Envelope<unknown> };
}

async function mutate(owner: Owner, method: string, pathName: string, payload: unknown, taskId: string): Promise<{ status: number; body: Envelope<unknown> }> {
  const headers = await owner.approve(method, pathName, payload, taskId);
  const response = await owner.request(pathName, { method, headers, body: JSON.stringify(payload) });
  return { status: response.status, body: (await response.json()) as Envelope<unknown> };
}

async function unapproved(owner: Owner, method: string, pathName: string, payload: unknown): Promise<{ status: number; body: Envelope<unknown> }> {
  const response = await owner.request(pathName, { method, body: JSON.stringify(payload) });
  return { status: response.status, body: (await response.json()) as Envelope<unknown> };
}

async function setup(): Promise<{ workspace: string; server: ArchServer; httpServer: http.Server; owner: Owner; base: string }> {
  const workspace = await fsp.mkdtemp(path.join(os.tmpdir(), 'aide-onboarding-'));
  const server = new ArchServer(workspace, path.join(workspace, 'arch-onboarding.log'));
  for (const route of routesForAuthority()) server.route(route);
  for (const route of routesForOnboarding(workspace)) server.route(route);
  const httpServer = await server.listen(0);
  const address = httpServer.address();
  assert.ok(address && typeof address === 'object');
  const base = 'http://127.0.0.1:' + (address as { port: number }).port;
  const owner = await pairFixture(server, base);
  return { workspace, server, httpServer, owner, base };
}

async function teardown(workspace: string, server: ArchServer, httpServer: http.Server): Promise<void> {
  server.authority.control.close();
  httpServer.closeAllConnections();
  await new Promise<void>(resolve => { httpServer.close(() => resolve()); });
  for (let attempt = 0; attempt < 10; attempt++) {
    try { await fsp.rm(workspace, { recursive: true, force: true }); break; }
    catch (error) {
      const code = (error as NodeJS.ErrnoException).code ?? '';
      if (!['EBUSY', 'ENOTEMPTY', 'EPERM'].includes(code)) throw error;
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
}

test('onboarding setup: eight-step progress, skip, and atomic persistence', async () => {
  const { workspace, server, httpServer, owner } = await setup();
  try {
    const initial = await read(owner, '/api/onboarding/state');
    assert.equal(initial.status, 200);
    assert.equal(initial.body.ok, true);
    const initialState = OnboardingState.parse((initial.body.data as { state: unknown }).state);
    assert.equal(initialState.current_step, 'welcome');
    assert.equal(initialState.walkthrough_complete, false);
    assert.equal(initialState.deferred, false);

    const transitions: Array<{ route: '/api/onboarding/next' | '/api/onboarding/skip'; task: string; expected: string; payload?: unknown }> = [
      { route: '/api/onboarding/next', task: 'task:onboarding-welcome', expected: 'local_intelligence', payload: { name: 'Operator', role: 'developer', workbench: 'sovereign-coder' } },
      { route: '/api/onboarding/next', task: 'task:onboarding-local', expected: 'providers' },
      { route: '/api/onboarding/skip', task: 'task:onboarding-skip-providers', expected: 'workflow' },
      { route: '/api/onboarding/next', task: 'task:onboarding-workflow', expected: 'security' },
      { route: '/api/onboarding/next', task: 'task:onboarding-security', expected: 'workspace' },
      { route: '/api/onboarding/next', task: 'task:onboarding-workspace', expected: 'verify' },
      { route: '/api/onboarding/next', task: 'task:onboarding-verify', expected: 'finish' }
    ];
    let lastState = initialState;
    for (const transition of transitions) {
      const result = await mutate(owner, 'POST', transition.route, transition.payload ?? {}, transition.task);
      assert.equal(result.status, 200);
      const data = result.body.data as { advanced_to: string; state: unknown };
      assert.equal(data.advanced_to, transition.expected);
      lastState = OnboardingState.parse(data.state);
    }
    assert.equal(lastState.user_choices.name, 'Operator');
    assert.equal(lastState.user_choices.workbench, 'sovereign-coder');
    assert.equal(lastState.completed.providers?.skipped, true);
    assert.equal(lastState.current_step, 'finish');

    const complete = await mutate(owner, 'POST', '/api/onboarding/complete', {}, 'task:onboarding-complete');
    assert.equal(complete.status, 200);
    assert.equal((complete.body.data as { complete: boolean }).complete, true);
    const finalState = OnboardingState.parse((complete.body.data as { state: unknown }).state);
    assert.equal(finalState.walkthrough_complete, true);
    assert.equal(finalState.current_step, 'finish');
    assert.equal(finalState.deferred, false);

    const stateFile = path.join(workspace, '.aide', 'onboarding-state.json');
    const raw = await fsp.readFile(stateFile, 'utf8');
    const persisted = OnboardingState.parse(JSON.parse(raw));
    assert.equal(persisted.walkthrough_complete, true);
    await assert.rejects(() => fsp.access(stateFile + '.partial'), /ENOENT/);
    const badPut = await unapproved(owner, 'PUT', '/api/onboarding/state', {});
    assert.equal(badPut.status, 400);
  } finally {
    await teardown(workspace, server, httpServer);
  }
});

test('onboarding defer, resume, and restart preserve canonical configuration boundaries', async () => {
  const { workspace, server, httpServer, owner } = await setup();
  try {
    const first = await mutate(owner, 'POST', '/api/onboarding/next', { name: 'Operator', role: 'developer', workbench: 'sovereign-coder' }, 'task:resume-first-step');
    assert.equal(first.status, 200);
    const atLocal = OnboardingState.parse((first.body.data as { state: unknown }).state);
    assert.equal(atLocal.current_step, 'local_intelligence');

    const unauthorizedDefer = await unapproved(owner, 'POST', '/api/onboarding/defer', {});
    assert.equal(unauthorizedDefer.status, 409, 'deferring setup requires the normal approved write');

    const deferred = await mutate(owner, 'POST', '/api/onboarding/defer', {}, 'task:defer-setup');
    assert.equal(deferred.status, 200);
    const deferredState = OnboardingState.parse((deferred.body.data as { state: unknown }).state);
    assert.equal(deferredState.deferred, true);
    assert.equal(deferredState.current_step, 'local_intelligence');
    assert.equal(deferredState.user_choices.name, 'Operator');

    const resumed = await mutate(owner, 'POST', '/api/onboarding/resume', {}, 'task:resume-setup');
    assert.equal(resumed.status, 200);
    const resumedState = OnboardingState.parse((resumed.body.data as { state: unknown }).state);
    assert.equal(resumedState.deferred, false);
    assert.equal(resumedState.current_step, 'local_intelligence');
    assert.equal(resumedState.user_choices.name, 'Operator');

    const deferredAgain = await mutate(owner, 'POST', '/api/onboarding/defer', {}, 'task:defer-again');
    assert.equal(deferredAgain.status, 200);
    const restarted = await mutate(owner, 'POST', '/api/onboarding/restart', {}, 'task:restart-progress');
    assert.equal(restarted.status, 200);
    const restartedState = OnboardingState.parse((restarted.body.data as { state: unknown }).state);
    assert.equal(restartedState.current_step, 'welcome');
    assert.equal(restartedState.deferred, false);
    assert.equal(restartedState.user_choices.name, 'Operator');

    const stateDirectory = path.join(workspace, '.aide');
    await assert.rejects(() => fsp.access(path.join(stateDirectory, 'setup-session.json')), /ENOENT/);
    const persisted = OnboardingState.parse(JSON.parse(await fsp.readFile(path.join(stateDirectory, 'onboarding-state.json'), 'utf8')));
    assert.deepEqual(persisted, restartedState);
  } finally {
    await teardown(workspace, server, httpServer);
  }
});

test('onboarding migrates legacy progress without confusing it with current configuration', async () => {
  const workspace = await fsp.mkdtemp(path.join(os.tmpdir(), 'aide-onboarding-legacy-'));
  try {
    const stateFile = path.join(workspace, '.aide', 'onboarding-state.json');
    await fsp.mkdir(path.dirname(stateFile), { recursive: true });
    await fsp.writeFile(stateFile, JSON.stringify({
      current_step: 'byok_optin',
      completed: {
        welcome: { skipped: false, completed_at: 100 },
        privacy: { skipped: true, completed_at: 200 },
        byok_optin: { skipped: false, completed_at: null },
        desktop_optin: { skipped: false, completed_at: null },
        system_map: { skipped: false, completed_at: null }
      },
      user_choices: { name: 'Operator', role: 'developer', workbench: 'sovereign-coder' },
      walkthrough_complete: false,
      started_at: 50,
      updated_at: 250
    }), 'utf8');

    const service = createOnboardingService({ workspace });
    const migrated = await service.getState();
    assert.equal(migrated.current_step, 'providers');
    assert.equal(migrated.completed.local_intelligence?.skipped, true);
    assert.equal(migrated.user_choices.name, 'Operator');
    assert.equal(migrated.deferred, false);

    const advanced = await service.nextStep({}, { from_step: 'providers' });
    assert.equal(advanced.advanced_to, 'workflow');
    const persisted = OnboardingState.parse(JSON.parse(await fsp.readFile(stateFile, 'utf8')));
    assert.equal(persisted.current_step, 'workflow');
  } finally {
    await fsp.rm(workspace, { recursive: true, force: true });
  }
});

test('onboarding authority: transitions bind origin state and fail closed on drift', async () => {
  const { workspace, server, httpServer, owner, base } = await setup();
  try {
    const stateFile = path.join(workspace, '.aide', 'onboarding-state.json');
    const stateRaw = async (): Promise<string> => fsp.readFile(stateFile, 'utf8').catch(() => '');

    const anonymous = await fetch(base + '/api/onboarding/next', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    assert.equal(anonymous.status, 403, 'anonymous actor rejected');

    const before = await stateRaw();
    const blocked = await unapproved(owner, 'POST', '/api/onboarding/next', {});
    assert.equal(blocked.status, 409, 'paired actor without approval fails');
    assert.equal(await stateRaw(), before, 'no mutation without approval');

    // Approval for `next` at welcome cannot execute after the state moved on.
    const initialRead = await read(owner, '/api/onboarding/state');
    const initialState = OnboardingState.parse((initialRead.body.data as { state: unknown }).state);
    const staleNext = await owner.approve('POST', '/api/onboarding/next', { name: 'Drifted' }, 'task:onboarding-stale');
    const moved = await mutate(owner, 'PUT', '/api/onboarding/state', {
      ...initialState,
      current_step: 'local_intelligence'
    }, 'task:onboarding-move');
    assert.equal(moved.status, 200);
    const staleRun = await owner.request('/api/onboarding/next', { method: 'POST', headers: staleNext, body: JSON.stringify({ name: 'Drifted' }) });
    assert.equal(staleRun.status, 409, 'next approval cannot authorize a different transition after drift');
    const afterDrift = OnboardingState.parse(JSON.parse(await stateRaw()));
    assert.equal(afterDrift.current_step, 'local_intelligence', 'drifted state is untouched by the stale approval instance');

    // A next approval cannot be used for complete, and vice versa.
    const nextApproval = await owner.approve('POST', '/api/onboarding/next', {}, 'task:onboarding-cross');
    const crossRoute = await owner.request('/api/onboarding/complete', { method: 'POST', headers: nextApproval, body: '{}' });
    assert.equal(crossRoute.status, 409, 'next approval cannot become complete');

    // PUT approval binds the exact normalized state written.
    const currentState = OnboardingState.parse(JSON.parse(await stateRaw()));
    const original = { ...currentState, user_choices: { ...currentState.user_choices, role: 'developer' as const } };
    const changed = { ...currentState, user_choices: { ...currentState.user_choices, role: 'researcher' as const } };
    const putHeaders = await owner.approve('PUT', '/api/onboarding/state', original, 'task:onboarding-put-bound');
    const changedPut = await owner.request('/api/onboarding/state', { method: 'PUT', headers: putHeaders, body: JSON.stringify(changed) });
    assert.equal(changedPut.status, 409, 'changed state cannot reuse approval');
    const appliedPut = await owner.request('/api/onboarding/state', { method: 'PUT', headers: putHeaders, body: JSON.stringify(original) });
    assert.equal(appliedPut.status, 200, 'exact approved state executes');

    // Complete: approval binds walkthrough_complete; replay fails; a second
    // complete approval after the state changed cannot replay the old one.
    const earlyComplete = await mutate(owner, 'POST', '/api/onboarding/complete', undefined, 'task:onboarding-early-complete');
    assert.equal(earlyComplete.status, 409, 'setup cannot be completed before the finish step');
    const earlyState = OnboardingState.parse(JSON.parse(await stateRaw()));
    assert.equal(earlyState.walkthrough_complete, false, 'early completion leaves setup incomplete');
    for (const expected of ['providers', 'workflow', 'security', 'workspace', 'verify', 'finish']) {
      const advanced = await mutate(owner, 'POST', '/api/onboarding/next', {}, `task:onboarding-finish-${expected}`);
      assert.equal((advanced.body.data as { advanced_to: string }).advanced_to, expected);
    }
    const completeHeaders = await owner.approve('POST', '/api/onboarding/complete', undefined, 'task:onboarding-complete-bound');
    const completed = await owner.request('/api/onboarding/complete', { method: 'POST', headers: completeHeaders });
    assert.equal(completed.status, 200);
    const completeReplay = await owner.request('/api/onboarding/complete', { method: 'POST', headers: completeHeaders });
    assert.equal(completeReplay.status, 409, 'complete cannot be reused after state changed');

    const serialized = await stateRaw();
    const token = owner.headers.Authorization.slice(7);
    assert.ok(!serialized.includes(token), 'onboarding artifacts must not serialize bearer material');
    assert.ok(!serialized.includes(owner.actorId), 'onboarding artifacts must not serialize actor identity');
    assert.ok(!serialized.includes(completeHeaders['X-AIDE-Operation']), 'onboarding artifacts must not serialize operation ids');
  } finally {
    await teardown(workspace, server, httpServer);
  }
});

test('onboarding TOCTOU repair: serialization prevents approval for N executing against M', async () => {
  const { workspace, server, httpServer, owner } = await setup();
  const originalReadFile = fsModule.promises.readFile as unknown as (file: unknown, ...rest: unknown[]) => Promise<unknown>;
  const mutableFsp = fsModule.promises as unknown as { readFile: (file: unknown, ...rest: unknown[]) => Promise<unknown> };
  try {
    // Materialize the default state at N = welcome and capture it for B.
    const initialRead = await read(owner, '/api/onboarding/state');
    const initialState = OnboardingState.parse((initialRead.body.data as { state: unknown }).state);

    // Approve A: `next` bound to from_step = welcome.
    const aHeaders = await owner.approve('POST', '/api/onboarding/next', { name: 'A' }, 'task:toctou-a');

    // Interpose on state reads. A's execute-time descriptor read is read #1;
    // the handler's read inside the serialized critical section is read #2.
    // Hold read #2 so A keeps the critical section while B attempts a PUT.
    let stateReads = 0;
    let reachedCriticalRead!: () => void;
    const criticalReadReached = new Promise<void>(resolve => { reachedCriticalRead = resolve; });
    let releaseCriticalRead!: () => void;
    const criticalReadGate = new Promise<void>(resolve => { releaseCriticalRead = resolve; });
    mutableFsp.readFile = async (file: unknown, ...rest: unknown[]) => {
      if (String(file).endsWith('onboarding-state.json')) {
        stateReads += 1;
        if (stateReads === 2) { reachedCriticalRead(); await criticalReadGate; }
      }
      return originalReadFile(file, ...rest);
    };

    const aPromise = owner.request('/api/onboarding/next', { method: 'POST', headers: aHeaders, body: JSON.stringify({ name: 'A' }) });
    await criticalReadReached;

    // B tries to replace state N while A holds the transition critical section.
    const bPromise = mutate(owner, 'PUT', '/api/onboarding/state', { ...initialState, current_step: 'local_intelligence' }, 'task:toctou-b');
    const bOutcome = await Promise.race([
      bPromise.then(() => 'settled', () => 'settled'),
      new Promise<string>(resolve => setTimeout(() => resolve('pending'), 250))
    ]);
    assert.equal(bOutcome, 'pending', 'PUT must not complete while a transition holds the critical section');

    // Release A: it must commit exactly its approved welcome -> local-intelligence step.
    releaseCriticalRead();
    const aResponse = await aPromise;
    const aBody = (await aResponse.json()) as Envelope<{ advanced_to?: string }>;
    assert.equal(aResponse.status, 200);
    assert.equal(aBody.data?.advanced_to, 'local_intelligence', 'A executed exactly its approved transition');

    // B's replacement applies afterwards (last-write-wins for PUT).
    const bResponse = await bPromise;
    assert.equal(bResponse.status, 200);
    mutableFsp.readFile = originalReadFile;
    const finalRead = await read(owner, '/api/onboarding/state');
    const finalState = OnboardingState.parse((finalRead.body.data as { state: unknown }).state);
    console.log(JSON.stringify({ approved: 'welcome->local_intelligence', aAdvancedTo: aBody.data?.advanced_to ?? null, finalStep: finalState.current_step }));
    assert.equal(finalState.current_step, 'local_intelligence');
    assert.notEqual(finalState.current_step, 'providers', 'no transition may derive from the unexpected state');
  } finally {
    mutableFsp.readFile = originalReadFile;
    await teardown(workspace, server, httpServer);
  }
});

test('onboarding concurrency: stale approvals fail CONFLICT with zero mutation and the queue recovers', async () => {
  const { workspace, server, httpServer, owner } = await setup();
  try {
    const stateRaw = async (): Promise<string> => fsp.readFile(path.join(workspace, '.aide', 'onboarding-state.json'), 'utf8').catch(() => '');

    // Two independent approvals from the same N=welcome. A commits N->local_intelligence.
    const aHeaders = await owner.approve('POST', '/api/onboarding/next', {}, 'task:same-n-a');
    const bHeaders = await owner.approve('POST', '/api/onboarding/next', {}, 'task:same-n-b');
    const aRun = await owner.request('/api/onboarding/next', { method: 'POST', headers: aHeaders, body: '{}' });
    assert.equal(aRun.status, 200);
    assert.equal(((await aRun.json()) as Envelope<{ advanced_to?: string }>).data?.advanced_to, 'local_intelligence');

    const beforeStale = await stateRaw();
    const bRun = await owner.request('/api/onboarding/next', { method: 'POST', headers: bHeaders, body: '{}' });
    assert.equal(bRun.status, 409, 'same-N stale approval must fail');
    assert.equal(((await bRun.json()) as Envelope<unknown>).error?.code, 'CONFLICT');
    assert.equal(await stateRaw(), beforeStale, 'stale approval must not mutate state');

    // Failed transition must not poison the queue: a fresh approval still works.
    const fresh = await mutate(owner, 'POST', '/api/onboarding/next', {}, 'task:fresh-next');
    assert.equal(fresh.status, 200);
    assert.equal((fresh.body.data as { advanced_to: string }).advanced_to, 'providers');

    // Stale complete: approved at (providers,false); state advances first.
    const completeHeaders = await owner.approve('POST', '/api/onboarding/complete', undefined, 'task:stale-complete');
    const advance = await mutate(owner, 'POST', '/api/onboarding/next', {}, 'task:advance');
    assert.equal(advance.status, 200);
    assert.equal((advance.body.data as { advanced_to: string }).advanced_to, 'workflow');
    const beforeComplete = await stateRaw();
    const staleComplete = await owner.request('/api/onboarding/complete', { method: 'POST', headers: completeHeaders });
    assert.equal(staleComplete.status, 409, 'stale complete must fail');
    assert.equal(await stateRaw(), beforeComplete, 'stale complete must not mutate state');
  } finally {
    await teardown(workspace, server, httpServer);
  }
});

test('onboarding service serialization: CAS, write-failure recovery, cross-service independence', async () => {
  const dirA = await fsp.mkdtemp(path.join(os.tmpdir(), 'aide-onboarding-svc-a-'));
  const dirB = await fsp.mkdtemp(path.join(os.tmpdir(), 'aide-onboarding-svc-b-'));
  const originalReadFile = fsModule.promises.readFile as unknown as (file: unknown, ...rest: unknown[]) => Promise<unknown>;
  const originalWriteFile = fsModule.promises.writeFile as unknown as (file: unknown, ...rest: unknown[]) => Promise<unknown>;
  const mutableFsp = fsModule.promises as unknown as {
    readFile: (file: unknown, ...rest: unknown[]) => Promise<unknown>;
    writeFile: (file: unknown, ...rest: unknown[]) => Promise<unknown>;
  };
  try {
    const serviceA = createOnboardingService({ workspace: dirA });
    const serviceB = createOnboardingService({ workspace: dirB });

    // Compare-and-commit is enforced by the service itself.
    const first = await serviceA.nextStep(undefined, { from_step: 'welcome' });
    assert.equal(first.advanced_to, 'local_intelligence');
    await assert.rejects(() => serviceA.nextStep(undefined, { from_step: 'welcome' }), OnboardingConflictError);
    await assert.rejects(() => serviceA.complete({ from_step: 'welcome', walkthrough_complete: false }), OnboardingConflictError);
    const afterCas = await serviceA.getState();
    assert.equal(afterCas.current_step, 'local_intelligence', 'conflicts leave durable state unchanged');

    // A write failure releases the queue and propagates.
    let failed = false;
    mutableFsp.writeFile = async (file: unknown, ...rest: unknown[]) => {
      if (!failed && String(file).endsWith('onboarding-state.json.partial')) { failed = true; throw new Error('simulated disk failure'); }
      return originalWriteFile(file, ...rest);
    };
    await assert.rejects(() => serviceA.nextStep(undefined, { from_step: 'local_intelligence' }), /simulated disk failure/);
    mutableFsp.writeFile = originalWriteFile;
    const recovered = await serviceA.nextStep(undefined, { from_step: 'local_intelligence' });
    assert.equal(recovered.advanced_to, 'providers', 'queue recovers after a failed write');

    // Cross-service independence: B resolves while A is held inside its read.
    let reachedRead!: () => void;
    const readReached = new Promise<void>(resolve => { reachedRead = resolve; });
    let releaseRead!: () => void;
    const readGate = new Promise<void>(resolve => { releaseRead = resolve; });
    mutableFsp.readFile = async (file: unknown, ...rest: unknown[]) => {
      if (String(file).startsWith(dirA) && String(file).endsWith('onboarding-state.json')) { reachedRead(); await readGate; }
      return originalReadFile(file, ...rest);
    };
    const heldA = serviceA.nextStep(undefined, { from_step: 'providers' });
    await readReached;
    const bResult = await serviceB.nextStep(undefined, { from_step: 'welcome' });
    assert.equal(bResult.advanced_to, 'local_intelligence', 'a separate service instance is not blocked');
    releaseRead();
    const releasedA = await heldA;
    assert.equal(releasedA.advanced_to, 'workflow');
    mutableFsp.readFile = originalReadFile;
  } finally {
    mutableFsp.readFile = originalReadFile;
    mutableFsp.writeFile = originalWriteFile;
    await fsp.rm(dirA, { recursive: true, force: true });
    await fsp.rm(dirB, { recursive: true, force: true });
  }
});
