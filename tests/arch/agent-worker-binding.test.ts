import { test } from 'node:test';
import assert from 'node:assert/strict';
import { routesForAgent } from '../../node/src/routes/agent.ts';
import { ArchServer, RouteError } from '../../node/src/server.ts';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createAgentLoop } from '../../node/src/services/agent-loop.mjs';
import { ChatTargetChangedError } from '../../node/src/services/model-router.ts';
import { pairFixture, pairServiceFixture } from './authority-fixture.ts';
import type { AgentLoopService } from '../../node/src/services/agent-loop.mjs';
import type { ModelRouter, ResolvedChatAuthorityTarget } from '../../node/src/services/model-router.ts';
import { httpOperationKind } from '../../common/security/operation-policy.mjs';
import { residentWorkerForSelection } from '../../browser/src/cockpit/resident-worker-selection.ts';
import { WorkerHandoffEnvelope } from '../../common/contracts/worker-handoff.ts';

const workspace = 'C:\\covert-exact-worker-fixture';
const service: AgentLoopService = {
  start: async () => { throw new Error('unexpected start'); },
  decide: async () => ({ ok: true }), cancel: async () => ({ ok: true, state: 'aborted' }),
  status: () => { throw new Error('unexpected status'); }, list: () => [], transcriptOf: () => [], rootAbs: workspace
};
function target(external = true): ResolvedChatAuthorityTarget {
  const id = external ? 'cloud:fixture:exact-model' : 'local:exact-model';
  return {
    binding: { execution_class: external ? 'EXTERNAL' : 'LOCAL', route_id: id, model_id: 'exact-model',
      source: external ? 'provider-service' : 'model-runtime', runtime_class: external ? 'provider-service' : 'local-model-runtime',
      endpoint_origin: external ? 'https://fixture.invalid' : 'http://127.0.0.1:1', target_revision: 'controlled-revision',
      ...(external ? { provider_id: 'fixture', provider_model: 'exact-model' } : {}) },
    route: { id, displayName: 'Controlled exact worker', providerType: external ? 'cloud' : 'local', baseUrl: external ? 'https://fixture.invalid/v1' : 'http://127.0.0.1:1/v1',
      modelString: 'exact-model', contextLength: 8192, chatTemplate: 'controlled', status: 'unverified', probeMs: null, roles: ['act'], capabilities: [] }
  };
}
function startRoute(resolved = target()) {
  const router: Pick<ModelRouter, 'resolveAuthorityTarget' | 'chatStreamResolvedTarget'> = {
    resolveAuthorityTarget: async () => ({ status: 'RESOLVED', target: resolved }),
    chatStreamResolvedTarget: async () => { throw new Error('description must not dispatch'); }
  };
  const options = { exactWorker: { workspace, router } };
  const route = routesForAgent(service, options).find(candidate => candidate.path === '/api/agent/start');
  assert.ok(route);
  return route;
}
const body = { task: 'controlled task', mode: 'act' as const, chat_source: 'provider' as const,
  worker: { worker: 'cloud:fixture:exact-model', provider: 'fixture', model: 'exact-model', role: 'act' as const } };

test('agent start has one request-aware policy owner and binds the exact external target before dispatch', async () => {
  const route = startRoute();
  assert.equal(httpOperationKind('POST', route.path), null);
  assert.equal(typeof route.describeOperation, 'function');
  const operation = await route.describeOperation!({ query: {}, body }, 'exact-worker-task');
  assert.equal(operation.kind, 'agent.start.external');
  assert.deepEqual(operation.args, { route: 'POST /api/agent/start', body, agent_target: target().binding });
});

test('a claimed worker identity cannot differ from resolved provider/model or role', async () => {
  const route = startRoute();
  for (const worker of [{ ...body.worker, model: 'different-model' }, { ...body.worker, provider: 'local' }, { ...body.worker, role: 'planner' as const }]) {
    await assert.rejects(() => route.describeOperation!({ query: {}, body: { ...body, worker } }, 'mismatch'),
      (error: unknown) => error instanceof RouteError && error.code === 'FORBIDDEN');
  }
});

test('explicit source labels cannot reclassify an external target as local', async () => {
  const route = startRoute();
  await assert.rejects(() => route.describeOperation!({ query: {}, body: { ...body, chat_source: 'local' } }, 'forged-local'),
    (error: unknown) => error instanceof RouteError && error.code === 'FORBIDDEN');
});

test('local target uses execute risk, while missing or unresolved exact workers have no fallback', async () => {
  const route = startRoute(target(false));
  const local = { ...body, chat_source: 'local', worker: { worker: 'local:exact-model', provider: 'local', model: 'exact-model', role: 'act' } };
  assert.equal((await route.describeOperation!({ query: {}, body: local }, 'local')).kind, 'agent.start');
  await assert.rejects(() => route.describeOperation!({ query: {}, body: { task: 'no worker' } }, 'missing'),
    (error: unknown) => error instanceof RouteError && error.code === 'NOT_READY');
  const router: Pick<ModelRouter, 'resolveAuthorityTarget' | 'chatStreamResolvedTarget'> = {
    resolveAuthorityTarget: async () => ({ status: 'UNKNOWN', reason: 'route-not-registered' }),
    chatStreamResolvedTarget: async () => { throw new Error('unresolved model must not dispatch'); }
  };
  const unresolved = routesForAgent(service, { exactWorker: { workspace, router } })[0]!;
  await assert.rejects(() => unresolved.describeOperation!({ query: {}, body }, 'unresolved'),
    (error: unknown) => error instanceof RouteError && error.code === 'NOT_READY');
});

async function eventually(probe: () => boolean) {
  const deadline = Date.now() + 5000;
  while (!probe() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 10));
  assert.ok(probe(), 'controlled worker lifecycle did not settle');
}

async function withRouteFixture(run: (fixture: {
  owner: Awaited<ReturnType<typeof pairFixture>>;
  loop: AgentLoopService;
  state: { revision: string; calls: ResolvedChatAuthorityTarget[]; signals: AbortSignal[]; block: boolean; legacyCalls: number; resultModel: string | null; changeAfterFirst: boolean; handoffFailure: boolean; consumes: number };
  workspace: string;
}) => Promise<void>) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'covert-agent-exact-'));
  const server = new ArchServer(root, path.join(root, 'arch.log'));
  await fs.writeFile(path.join(root, 'README.md'), '# controlled exact-worker fixture\n');
  const state = { revision: 'controlled-revision', calls: [] as ResolvedChatAuthorityTarget[], signals: [] as AbortSignal[], block: false, legacyCalls: 0, resultModel: null as string | null, changeAfterFirst: false, handoffFailure: false, consumes: 0 };
  const loop = createAgentLoop({ workspace: root, authority: server.authority,
    chatFn: async () => { state.legacyCalls++; throw new Error('legacy fallback is forbidden'); } });
  const router: Pick<ModelRouter, 'resolveAuthorityTarget' | 'chatStreamResolvedTarget'> = {
    resolveAuthorityTarget: async () => ({ status: 'RESOLVED', target: { ...target(), binding: { ...target().binding, target_revision: state.revision } } }),
    chatStreamResolvedTarget: async (resolved, _messages, _onDelta, signal) => {
      if (resolved.binding.target_revision !== state.revision) throw new ChatTargetChangedError();
      state.calls.push(resolved); state.signals.push(signal);
      if (state.block) await new Promise<void>((_resolve, reject) => {
        const abort = () => { const error = new Error('controlled cancellation'); error.name = 'AbortError'; reject(error); };
        if (signal.aborted) abort(); else signal.addEventListener('abort', abort, { once: true });
      });
      if (state.changeAfterFirst) state.revision = 'changed-between-turns';
      return { text: state.changeAfterFirst ? '<read_file><path>README.md</path></read_file>' : '<attempt_completion><result>controlled exact task complete</result></attempt_completion>',
        modelId: state.resultModel ?? resolved.binding.route_id, timingMs: 1, usedApprox: 1, dropped: 0, truncatedSystem: false };
    }
  };
  const envelope = (id: string) => WorkerHandoffEnvelope.parse({
    handoff_id: id, state: 'ACCEPTED', workspace_id: root, project_id: null, task_id: 'controlled-handoff', workflow_id: null, stage_id: null,
    from: { worker: 'local:controlled-source', provider: 'local', model: 'controlled-source', role: 'act' }, to: body.worker,
    objective: 'controlled continuity', current_state: '', worker_claims: [], verified_facts: [], decisions: [], assumptions: [], constraints: [], open_questions: [],
    next_action: 'continue controlled task', artifacts: [], files_or_components: [], evidence_refs: [], verification_refs: [], memory_refs: [], failure_context: null,
    created_at: new Date().toISOString(), accepted_at: null, consumed_at: null, supersedes: [], related: []
  });
  for (const route of routesForAgent(loop, { exactWorker: { workspace: root, router }, workerHandoff: {
    get: async id => envelope(id), accept: async id => envelope(id), contextBlock: async () => ({ context_block: 'CONTROLLED CONTINUITY', approx_tokens: 8 }),
    consume: async id => { state.consumes++; if (state.handoffFailure) throw new Error('controlled handoff consume persistence failure'); return envelope(id); }
  } })) server.route(route);
  const http = await server.listen(0);
  const address = http.address(); assert.ok(address && typeof address === 'object');
  const owner = await pairFixture(server, `http://127.0.0.1:${address.port}`);
  try { await run({ owner, loop, state, workspace: root }); }
  finally {
    for (const session of loop.list().filter(item => item.state === 'running' || item.state === 'awaiting_approval')) {
      const input = { session_id: session.session_id };
      const headers = await owner.approve('POST', '/api/agent/cancel', input, 'fixture-cleanup');
      await owner.request('/api/agent/cancel', { method: 'POST', headers, body: JSON.stringify(input) });
    }
    await eventually(() => loop.list().every(item => ['done', 'error', 'aborted'].includes(item.state)));
    server.events.close(); await server.logger.flush(); http.closeAllConnections();
    await new Promise<void>(resolve => http.close(() => resolve()));
    server.authority.control.close();
    await fs.rm(root, { recursive: true, force: true });
  }
}
type StartEnvelope = { ok: boolean; data?: { session_id: string }; error?: { code: string } };

test('actual HTTP Authority and AgentLoop bind external dispatch, preserve same-key recovery and stop/restart', async () => {
  await withRouteFixture(async ({ owner, loop, state }) => {
    const request = { ...body, client_request_id: randomUUID() };
    const denied = await owner.request('/api/agent/start', { method: 'POST', body: JSON.stringify(request) });
    assert.equal(denied.status, 409);
    assert.equal((await denied.json() as StartEnvelope).error?.code, 'NOT_READY'); assert.equal(state.calls.length, 0);
    const headers = await owner.approve('POST', '/api/agent/start', request, 'exact-approved');
    const started = await owner.request('/api/agent/start', { method: 'POST', headers, body: JSON.stringify(request) });
    const first = await started.json() as StartEnvelope;
    assert.equal(started.status, 200); assert.ok(first.data);
    await eventually(() => loop.status(first.data!.session_id).state === 'done');
    assert.equal(state.calls.length, 1); assert.equal(state.calls[0]!.binding.route_id, body.worker.worker);
    assert.equal(state.legacyCalls, 0);
    const recoveredHeaders = await owner.approve('POST', '/api/agent/start', request, 'exact-recovery');
    const recovered = await owner.request('/api/agent/start', { method: 'POST', headers: recoveredHeaders, body: JSON.stringify(request) });
    assert.deepEqual((await recovered.json() as StartEnvelope).data, first.data); assert.equal(state.calls.length, 1);

    state.block = true;
    const next = { ...request, client_request_id: randomUUID(), task: 'cancel exact worker' };
    const nextHeaders = await owner.approve('POST', '/api/agent/start', next, 'exact-cancel-start');
    const second = await (await owner.request('/api/agent/start', { method: 'POST', headers: nextHeaders, body: JSON.stringify(next) })).json() as StartEnvelope;
    assert.ok(second.data); await eventually(() => state.calls.length === 2);
    const cancel = { session_id: second.data.session_id };
    const cancelHeaders = await owner.approve('POST', '/api/agent/cancel', cancel, 'exact-cancel');
    assert.equal((await owner.request('/api/agent/cancel', { method: 'POST', headers: cancelHeaders, body: JSON.stringify(cancel) })).status, 200);
    await eventually(() => loop.status(second.data!.session_id).state === 'aborted');
    assert.equal(state.signals[1]!.aborted, true);
    state.block = false;
    const third = { ...request, client_request_id: randomUUID(), task: 'subsequent exact worker' };
    const thirdHeaders = await owner.approve('POST', '/api/agent/start', third, 'exact-restart');
    const result = await (await owner.request('/api/agent/start', { method: 'POST', headers: thirdHeaders, body: JSON.stringify(third) })).json() as StartEnvelope;
    assert.ok(result.data); await eventually(() => loop.status(result.data!.session_id).state === 'done');
    assert.equal(state.calls.length, 3); assert.equal(state.legacyCalls, 0);
  });
});

test('changed target revision after approval and Local-Only preference deny before any worker dispatch', async () => {
  await withRouteFixture(async ({ owner, state, workspace: root }) => {
    const headers = await owner.approve('POST', '/api/agent/start', body, 'revision-bound');
    state.revision = 'changed-revision';
    const changed = await owner.request('/api/agent/start', { method: 'POST', headers, body: JSON.stringify(body) });
    assert.equal(changed.status, 409);
    assert.equal((await changed.json() as StartEnvelope).error?.code, 'CONFLICT'); assert.equal(state.calls.length, 0);
    await fs.mkdir(path.join(root, '.aide'), { recursive: true });
    await fs.writeFile(path.join(root, '.aide', 'routing-preference.json'), JSON.stringify({ preference: 'local-only' }));
    const localOnly = await owner.request('/api/authority/prepare', { method: 'POST', body: JSON.stringify({ method: 'POST', path: '/api/agent/start', body, task_id: 'local-only-external' }) });
    assert.equal(localOnly.status, 403); assert.equal(state.calls.length, 0); assert.equal(state.legacyCalls, 0);
  });
});

test('service rejects stripped or changed approved target and forged worker metadata', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'covert-agent-bound-service-'));
  const fixture = await pairServiceFixture(root);
  const loop = createAgentLoop({ workspace: root, authority: fixture.authority, chatFn: async () => { throw new Error('must not dispatch'); } });
  const binding = target().binding;
  try {
    const input = { workspace: root, taskId: 'bound-service', kind: 'agent.start.external', args: { body, agent_target: binding } };
    const op = await fixture.authority.prepare(fixture.owner, input);
    await fixture.authority.decide(fixture.owner, op.operation_id, 'approve');
    await assert.rejects(fixture.authority.execute(fixture.owner, op.operation_id, input, (_, execution) =>
      loop.start(body.task, 'act', null, { execution, request: body, executionTarget: { ...binding, target_revision: 'forged' } })), { code: 'FORBIDDEN' });
    const strippedOp = await fixture.authority.prepare(fixture.owner, input);
    await fixture.authority.decide(fixture.owner, strippedOp.operation_id, 'approve');
    await assert.rejects(fixture.authority.execute(fixture.owner, strippedOp.operation_id, input, (_, execution) =>
      loop.start(body.task, 'act', null, { execution, request: body })), { code: 'FORBIDDEN' });
    const forged = { ...body, worker: { ...body.worker, model: 'forged-model' } };
    const forgedInput = { ...input, args: { body: forged, agent_target: binding } };
    const forgedOp = await fixture.authority.prepare(fixture.owner, forgedInput);
    await fixture.authority.decide(fixture.owner, forgedOp.operation_id, 'approve');
    await assert.rejects(fixture.authority.execute(fixture.owner, forgedOp.operation_id, forgedInput, (_, execution) =>
      loop.start(forged.task, 'act', null, { execution, request: forged, executionTarget: binding })), { code: 'FORBIDDEN' });
    assert.equal(loop.list().length, 0);
  } finally { fixture.authority.control.close(); await fs.rm(root, { recursive: true, force: true }); }
});

test('Resident projects the project role default exactly, without a local/cloud fallback', () => {
  const localView = { connections: { routed_roles: { planner: 'local' as const, coder: 'local' as const, reviewer: 'local' as const, utility: 'local' as const }, preference: 'local-first' as const },
    runtime: { selected_model_id: 'observed-loaded-model', health: 'HEALTHY' as const } };
  assert.throws(() => residentWorkerForSelection(localView), /No exact coder model is selected.*not an implicit role selection/);
  const cloudView = { ...localView, connections: { ...localView.connections, routed_roles: { ...localView.connections.routed_roles, coder: { provider_id: 'opencode', model_id: 'opencode-go/exact-model' } } } };
  assert.deepEqual(residentWorkerForSelection(cloudView), { worker: 'cloud:opencode:opencode-go/exact-model', provider: 'opencode', model: 'opencode-go/exact-model', role: 'coder' });
  const reviewView = { ...localView, connections: { ...localView.connections, routed_roles: { ...localView.connections.routed_roles, reviewer: { provider_id: 'opencode', model_id: 'opencode-go/review-model' } } } };
  assert.deepEqual(residentWorkerForSelection(reviewView, 'reviewer'), { worker: 'cloud:opencode:opencode-go/review-model', provider: 'opencode', model: 'opencode-go/review-model', role: 'reviewer' });
  const exactLocalCoder = { ...localView, connections: { ...localView.connections, routed_roles: { ...localView.connections.routed_roles, coder: { provider_id: 'local', model_id: 'observed-loaded-model' } } } };
  assert.deepEqual(residentWorkerForSelection(exactLocalCoder), { worker: 'local:observed-loaded-model', provider: 'local', model: 'observed-loaded-model', role: 'coder' });
  const exactLocalReviewer = { ...localView, connections: { ...localView.connections, routed_roles: { ...localView.connections.routed_roles, reviewer: { provider_id: 'local', model_id: 'other-local-model' } } } };
  assert.throws(() => residentWorkerForSelection(exactLocalReviewer, 'reviewer'), /exact local reviewer model is not the healthy loaded model/);
  assert.throws(() => residentWorkerForSelection({ ...cloudView, connections: { ...cloudView.connections, preference: 'local-only' } }), /Local-Only/);
  const clearedWhileLoaded = { ...localView, connections: { ...localView.connections, routed_roles: { ...localView.connections.routed_roles, coder: 'local' as const } } };
  assert.throws(() => residentWorkerForSelection(clearedWhileLoaded), /No exact coder model is selected/);
  assert.throws(() => residentWorkerForSelection({ ...localView, runtime: { ...localView.runtime, selected_model_id: null } }), /No exact coder model is selected/);
});

test('a changed target between turns and a different returned model fail without any legacy fallback', async () => {
  for (const cause of ['revision', 'returned-identity'] as const) await withRouteFixture(async ({ owner, loop, state }) => {
    state.changeAfterFirst = cause === 'revision';
    if (cause === 'returned-identity') state.resultModel = 'cloud:fixture:other-model';
    const headers = await owner.approve('POST', '/api/agent/start', body, 'dispatch-identity-' + cause);
    const response = await owner.request('/api/agent/start', { method: 'POST', headers, body: JSON.stringify(body) });
    const started = await response.json() as StartEnvelope;
    assert.equal(response.status, 200); assert.ok(started.data);
    await eventually(() => loop.status(started.data!.session_id).state === 'error');
    assert.equal(state.calls.length, 1); assert.equal(state.legacyCalls, 0);
    assert.match(loop.status(started.data.session_id).error ?? '', cause === 'revision' ? /target changed/ : /different model identity/);
  });
});

test('handoff consumption failure must stop exact worker dispatch', async () => {
  await withRouteFixture(async ({ owner, loop, state }) => {
    state.handoffFailure = true;
    const request = { ...body, handoff_id: randomUUID() };
    const headers = await owner.approve('POST', '/api/agent/start', request, 'handoff-failure');
    const response = await owner.request('/api/agent/start', { method: 'POST', headers, body: JSON.stringify(request) });
    const started = await response.json() as StartEnvelope;
    assert.equal(response.status, 200); assert.ok(started.data);
    await eventually(() => ['done', 'error', 'aborted'].includes(loop.status(started.data!.session_id).state));
    console.log(JSON.stringify({ controlledHandoffConsumption: { state: loop.status(started.data.session_id).state, consumes: state.consumes, modelCalls: state.calls.length } }));
    assert.equal(loop.status(started.data.session_id).state, 'error');
    assert.equal(state.consumes, 1); assert.equal(state.calls.length, 0); assert.equal(state.legacyCalls, 0);
    assert.match(loop.status(started.data.session_id).error ?? '', /handoff consume persistence failure/);
  });
});

test('handoff wrapper preserves the exact worker cancellation signal', async () => {
  await withRouteFixture(async ({ owner, loop, state }) => {
    state.block = true;
    const request = { ...body, handoff_id: randomUUID() };
    const headers = await owner.approve('POST', '/api/agent/start', request, 'handoff-cancellation');
    const response = await owner.request('/api/agent/start', { method: 'POST', headers, body: JSON.stringify(request) });
    const started = await response.json() as StartEnvelope;
    assert.equal(response.status, 200); assert.ok(started.data); await eventually(() => state.calls.length === 1);
    const input = { session_id: started.data.session_id };
    const cancelHeaders = await owner.approve('POST', '/api/agent/cancel', input, 'cancel-handoff');
    assert.equal((await owner.request('/api/agent/cancel', { method: 'POST', headers: cancelHeaders, body: JSON.stringify(input) })).status, 200);
    await eventually(() => loop.status(started.data!.session_id).state === 'aborted');
    assert.equal(state.consumes, 1); assert.equal(state.signals[0]!.aborted, true); assert.equal(state.legacyCalls, 0);
  });
});
