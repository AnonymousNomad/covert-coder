import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { ModelRuntime } from '../../node/src/services/model-runtime.ts';
import { ModelRouter, ChatTargetChangedError } from '../../node/src/services/model-router.ts';
import type { ProviderService } from '../../node/src/services/providers.ts';
import type { ChatMessageT } from '../../common/contracts/chat.ts';
import { createAttemptJournal } from '../../node/src/services/attempt-journal.ts';
import { createAgentLoop } from '../../node/src/services/agent-loop.mjs';
import { ArchServer } from '../../node/src/server.ts';
import { routesForAgent } from '../../node/src/routes/agent.ts';
import { pairFixture } from './authority-fixture.ts';
import { WorkerHandoffEnvelope } from '../../common/contracts/worker-handoff.ts';
import { AgentStartRequest } from '../../common/contracts/agent.ts';
import { ModelDispatchInputObservation } from '../../common/contracts/routing.ts';
import { randomUUID } from 'node:crypto';

const digest = (value: string) => createHash('sha256').update(value, 'utf8').digest('hex');
type Scalar = string | number | boolean | null;
function eventData(observation: unknown): Record<string, Scalar> {
  assert.ok(typeof observation === 'object' && observation !== null);
  const result: Record<string, Scalar> = {};
  for (const [key, value] of Object.entries(observation)) {
    if (value !== null && !['string', 'number', 'boolean'].includes(typeof value)) throw new Error('Non-scalar dispatch observation');
    result[key] = value;
  }
  return result;
}

// Actual Runtime manifest/budget, Router and Journal. Inference is controlled;
// no model process, real endpoint, provider, Authority or qualification here.
async function fixture(t: TestContext, contextTokens = 1024) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'covert-dispatch-observation-'));
  t.after(async () => {
    assert.equal(path.dirname(path.resolve(root)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(root).startsWith('covert-dispatch-observation-'));
    await fs.rm(root, { recursive: true, force: true });
  });
  const manifestPath = path.join(root, 'manifest.json');
  const id = 'controlled-observation';
  await fs.writeFile(manifestPath, JSON.stringify({ models: [{ id, context_tokens: contextTokens,
    endpoint: 'http://127.0.0.1:1/v1', model: 'controlled.gguf', roles: ['chat'],
    artifact_uri: 'local://controlled.gguf', file: path.join(root, 'controlled.gguf') }] }));
  const runtime = new ModelRuntime({ workspace: root, manifestPath, ingestedPath: path.join(root, 'ingested.json'), modelDir: root });
  await runtime.load({ sweepLegacyEngines: false });
  const seen: Array<Array<{ role: string; content: string }>> = [];
  const order: string[] = [];
  runtime.chatStream = async (_id, messages, onDelta, signal) => {
    signal.throwIfAborted();
    order.push('inference');
    seen.push(structuredClone(messages));
    onDelta('controlled response');
  };
  runtime.chat = async (_id, messages) => {
    order.push('inference');
    seen.push(structuredClone(messages));
    return { text: 'controlled response', modelId: id, timingMs: 1 };
  };
  const router = new ModelRouter(runtime, {} as ProviderService, []);
  const resolved = await router.resolveAuthorityTarget(`local:${id}`);
  assert.equal(resolved.status, 'RESOLVED');
  if (resolved.status !== 'RESOLVED') throw new Error('Controlled target unresolved');
  const target = resolved.target;
  const stream = (messages: ChatMessageT[], observer: (value: unknown) => Promise<void>, signal = new AbortController().signal) => {
    const options = { maxTokens: 512, onDispatchInput: observer };
    return router.chatStreamResolvedTarget(target, messages, () => {}, signal, options);
  };
  return { root, runtime, router, target, seen, order, stream };
}

test('Router observation describes exactly the fitted adapter input before inference, without raw content', async t => {
  const f = await fixture(t);
  const task = 'Private fixture task: preserve this exact current instruction.';
  const messages: ChatMessageT[] = [{ role: 'system', content: 'Private fixture governing context.' },
    { role: 'assistant', content: 'old'.repeat(4000) }, { role: 'user', content: task }];
  const observations: unknown[] = [];
  const result = await f.stream(messages, async observation => { f.order.push('observation'); observations.push(observation); });
  assert.deepEqual(f.order, ['observation', 'inference']);
  assert.equal(observations.length, 1);
  assert.deepEqual(observations[0], {
    scope: 'ROUTER_DISPATCH_INPUT', route_id: f.target.binding.route_id, target_revision: f.target.binding.target_revision,
    messages_sha256: digest(JSON.stringify(f.seen[0])), system_sha256: digest(messages[0]!.content),
    input_message_count: 3, dispatched_message_count: 2, estimated_input_tokens: result.usedApprox,
    fit_dropped_count: 1, truncated_system: false, overflow_trimmed: false, completion_reserve_tokens: 512
  });
  assert.equal(f.seen[0]?.at(-1)?.content, task);
  assert.equal(JSON.stringify(observations).includes('Private fixture'), false);
});

test('one-shot exact-bound dispatch also awaits its content-free observation', async t => {
  const f = await fixture(t);
  const observations: unknown[] = [];
  const options = { maxTokens: 512, onDispatchInput: async (observation: unknown) => { f.order.push('observation'); observations.push(observation); } };
  await f.router.chatResolvedTarget(f.target, [{ role: 'user', content: 'one-shot task' }], options);
  assert.deepEqual(f.order, ['observation', 'inference']);
  assert.equal(eventData(observations[0]).messages_sha256, digest(JSON.stringify(f.seen[0])));
});

test('failed observation persistence refuses inference instead of dropping its receipt', async t => {
  const f = await fixture(t);
  await assert.rejects(() => f.stream([{ role: 'user', content: 'Do not dispatch without evidence.' }],
    async () => { throw new Error('controlled journal persistence failure'); }), /controlled journal persistence failure/);
  assert.deepEqual(f.seen, []);
});

test('cancellation at the awaited observation boundary permits zero late inference', async t => {
  const f = await fixture(t);
  const controller = new AbortController();
  await assert.rejects(() => f.stream([{ role: 'user', content: 'cancel during persistence' }], async () => {
    controller.abort(new Error('controlled cancellation at observation'));
  }, controller.signal), /controlled cancellation at observation/);
  assert.deepEqual(f.seen, []);
});

test('already cancelled one-shot exact dispatch writes no observation and calls no model', async t => {
  const f = await fixture(t);
  const controller = new AbortController(); controller.abort(new Error('already cancelled'));
  let observations = 0;
  await assert.rejects(() => f.router.chatResolvedTarget(f.target, [{ role: 'user', content: 'cancelled task' }], {
    signal: controller.signal, onDispatchInput: async () => { observations++; }
  }), /already cancelled/);
  assert.equal(observations, 0); assert.deepEqual(f.seen, []);
});

test('dispatch observation schema rejects raw content and invalid digest instead of widening evidence', async t => {
  const f = await fixture(t);
  let observed: unknown;
  await f.stream([{ role: 'user', content: 'PRIVATE SCHEMA FIXTURE' }], async value => { observed = value; assert.ok(Object.isFrozen(value)); });
  const data = eventData(observed);
  assert.equal(ModelDispatchInputObservation.safeParse({ ...data, prompt: 'PRIVATE SCHEMA FIXTURE' }).success, false);
  assert.equal(ModelDispatchInputObservation.safeParse({ ...data, messages_sha256: 'requested-only' }).success, false);
});

test('changed exact target at the awaited observation boundary refuses inference', async t => {
  const f = await fixture(t);
  await assert.rejects(() => f.stream([{ role: 'user', content: 'retain approved destination' }], async () => {
    f.runtime.list()[0]!.endpoint = 'http://127.0.0.1:2/v1';
  }), error => error instanceof ChatTargetChangedError);
  assert.deepEqual(f.seen, []);
});

test('caller mutation during observation cannot change the already hashed dispatch snapshot', async t => {
  const f = await fixture(t);
  const messages: ChatMessageT[] = [{ role: 'user', content: 'approved original task' }];
  const observations: unknown[] = [];
  await f.stream(messages, async observation => {
    observations.push(observation);
    messages[0]!.content = 'changed task during journal I/O';
  });
  assert.equal(observations.length, 1);
  assert.deepEqual(f.seen[0], [{ role: 'user', content: 'approved original task' }]);
  assert.equal(eventData(observations[0]).messages_sha256, digest(JSON.stringify(f.seen[0])));
});

test('actual Journal persists dispatch digest separately from immutable admission and reads it after recovery', async t => {
  const f = await fixture(t);
  const journal = createAttemptJournal({ workspace: f.root });
  const input = { task: 'bounded observation fixture', mode: 'plan', task_id: 'controlled-task', workspace: f.root,
    worker_role: 'plan', worker_identity: f.target.binding.route_id, worker_provider: 'local', worker_model: f.target.binding.model_id,
    handoff_id: null, authority_owner: 'controlled-owner', authority_operation_kind: 'agent.start',
    max_iterations: 1, effective_context_tokens: 1024, resource_decision: null, mutation_scope: [], capabilities: [] };
  const envelope = await journal.admit(input);
  const before = await fs.readFile(path.join(journal.attemptsDir, envelope.attempt_id + '.json'), 'utf8');
  await f.stream([{ role: 'system', content: 'Private journal fixture context.' }, { role: 'user', content: 'Private journal fixture task.' }], async observation => {
    await journal.recordEvent(envelope.attempt_id, 'MODEL_INPUT_PREPARED', eventData(observation), 'model-router');
  });
  const recovered = createAttemptJournal({ workspace: f.root });
  await recovered.recover();
  const detail = await recovered.get(envelope.attempt_id);
  assert.ok(detail);
  const prepared = detail.events.find(event => event.event === 'MODEL_INPUT_PREPARED');
  assert.ok(prepared);
  assert.equal(prepared.data.messages_sha256, digest(JSON.stringify(f.seen[0])));
  assert.equal(JSON.stringify(prepared).includes('Private journal fixture'), false);
  assert.equal(await fs.readFile(path.join(journal.attemptsDir, envelope.attempt_id + '.json'), 'utf8'), before);
});

test('actual Journal missing envelope cannot be ignored before dispatch', async t => {
  const f = await fixture(t);
  const journal = createAttemptJournal({ workspace: f.root });
  await assert.rejects(() => f.stream([{ role: 'user', content: 'missing admission' }], async observation => {
    await journal.recordEvent('11111111-1111-4111-8111-111111111111', 'MODEL_INPUT_PREPARED', eventData(observation), 'model-router');
  }), /envelope not found/);
  assert.deepEqual(f.seen, []);
});

async function eventually(probe: () => boolean) {
  const deadline = Date.now() + 5000;
  while (!probe() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 10));
  assert.ok(probe(), 'governed dispatch lifecycle did not settle');
}

// Actual HTTP Authority, exact-worker route, AgentLoop, Router, Runtime budget
// and append-only Journal. Only inference/advisory/handoff content is controlled.
async function governedFixture(t: TestContext, boundary: 'pass' | 'write-failure' | 'cancel' | 'revoke' = 'pass') {
  const f = await fixture(t, 16384);
  const server = new ArchServer(f.root, path.join(f.root, 'arch.log'));
  const journal = createAttemptJournal({ workspace: f.root });
  const record = journal.recordEvent.bind(journal);
  let admissionAtDispatch: string | null = null;
  let owner: Awaited<ReturnType<typeof pairFixture>>;
  let dispatchSignal: AbortSignal | undefined;
  let cancellation: Promise<void> | undefined;
  let cancellationError: unknown;
  const dispatch = f.router.chatStreamResolvedTarget.bind(f.router);
  f.router.chatStreamResolvedTarget = async (...args) => {
    dispatchSignal = args[3];
    return dispatch(...args);
  };
  const loop = createAgentLoop({ workspace: f.root, authority: server.authority, attemptJournal: journal,
    chatFn: async () => { throw new Error('legacy fallback forbidden'); } });
  journal.recordEvent = async (attemptId, event, data, source) => {
    if (event !== 'MODEL_INPUT_PREPARED') return record(attemptId, event, data, source);
    if (boundary === 'write-failure') throw new Error('controlled governed observation persistence failure');
    const result = await record(attemptId, event, data, source);
    admissionAtDispatch = await fs.readFile(path.join(journal.attemptsDir, attemptId + '.json'), 'utf8');
    if (boundary === 'cancel') {
      const body = { session_id: String(data?.session_id) };
      const headers = await owner.approve('POST', '/api/agent/cancel', body, 'observation-cancel');
      cancellation = owner.request('/api/agent/cancel', { method: 'POST', headers, body: JSON.stringify(body) })
        .then(response => { assert.equal(response.status, 200); })
        .catch(error => { cancellationError = error; });
      await eventually(() => dispatchSignal?.aborted === true);
    }
    if (boundary === 'revoke') {
      const credential = owner.headers.Authorization.slice('Bearer '.length);
      server.authority.control.revoke(server.authority.authenticate(credential, owner.headers.Origin));
    }
    return result;
  };
  f.runtime.chatStream = async (_id, messages, onDelta, signal) => {
    signal.throwIfAborted();
    const rows = (await fs.readFile(journal.journalPath, 'utf8')).trim().split('\n').map(line => JSON.parse(line) as { event: string });
    assert.ok(rows.some(row => row.event === 'MODEL_INPUT_PREPARED'), 'receipt must already be durable before inference');
    f.order.push('inference'); f.seen.push(structuredClone(messages));
    onDelta('<attempt_completion><result>controlled complete</result></attempt_completion>');
  };
  const worker = { worker: f.target.binding.route_id, provider: 'local', model: f.target.binding.model_id, role: 'plan' as const };
  let consumes = 0;
  const envelope = (id: string) => WorkerHandoffEnvelope.parse({
    handoff_id: id, state: 'ACCEPTED', workspace_id: f.root, project_id: null, task_id: 'observation-handoff', workflow_id: null, stage_id: null,
    from: { worker: 'local:source', provider: 'local', model: 'source', role: 'plan' }, to: worker,
    objective: 'controlled continuity', current_state: '', worker_claims: [], verified_facts: [], decisions: [], assumptions: [], constraints: [], open_questions: [],
    next_action: 'continue', artifacts: [], files_or_components: [], evidence_refs: [], verification_refs: [], memory_refs: [], failure_context: null,
    created_at: new Date().toISOString(), accepted_at: null, consumed_at: null, supersedes: [], related: []
  });
  for (const route of routesForAgent(loop, { exactWorker: { workspace: f.root, router: f.router, effectiveContext: () => 16384 },
    consultExpert: async () => ({ expert: 'controlled-expert', phase: 'plan', confidence: 0.9 }), workerHandoff: {
      get: async id => envelope(id), accept: async id => envelope(id), contextBlock: async () => ({ context_block: 'PRIVATE HANDOFF FIXTURE', approx_tokens: 8 }),
      consume: async id => { consumes++; return envelope(id); }
    } })) server.route(route);
  const http = await server.listen(0);
  const address = http.address(); assert.ok(address && typeof address === 'object');
  owner = await pairFixture(server, `http://127.0.0.1:${address.port}`);
  t.after(async () => {
    try {
      assert.ok(loop.list().every(session => ['done', 'error', 'aborted'].includes(session.state)), 'no live fixture worker');
    } finally {
      server.events.close(); await server.logger.flush(); http.closeAllConnections();
      await new Promise<void>(resolve => http.close(() => resolve()));
      server.authority.control.close();
    }
  });
  const request = AgentStartRequest.parse({ task: 'PRIVATE GOVERNED FIXTURE TASK', mode: 'plan', chat_source: 'local', worker,
    handoff_id: randomUUID(), expertAdvisory: true, client_request_id: randomUUID() });
  const headers = await owner.approve('POST', '/api/agent/start', request, 'governed-observation');
  const response = await owner.request('/api/agent/start', { method: 'POST', headers, body: JSON.stringify(request) });
  assert.equal(response.status, 200);
  const started = await response.json() as { data: { session_id: string } };
  await eventually(() => ['done', 'error', 'aborted'].includes(loop.status(started.data.session_id).state));
  await cancellation;
  if (cancellationError !== undefined) throw cancellationError;
  return { ...f, loop, journal, sessionId: started.data.session_id, consumes, admissionAtDispatch };
}

test('governed exact-worker/handoff/expert path durably records fitted input before inference and recovers it', async t => {
  const f = await governedFixture(t);
  assert.equal(f.loop.status(f.sessionId).state, 'done');
  assert.equal(f.consumes, 1); assert.equal(f.seen.length, 1);
  assert.match(f.seen[0]![0]!.content, /EXPERT ADVISORY/);
  assert.ok(f.seen[0]!.some(message => message.role === 'system' && message.content.includes('PRIVATE HANDOFF FIXTURE')));
  const recovered = createAttemptJournal({ workspace: f.root });
  await recovered.recover();
  const admission = JSON.parse(f.admissionAtDispatch!) as { attempt_id: string };
  const detail = await recovered.get(admission.attempt_id); assert.ok(detail);
  const prepared = detail.events.filter(event => event.event === 'MODEL_INPUT_PREPARED');
  assert.equal(prepared.length, 1);
  assert.equal(prepared[0]!.data.messages_sha256, digest(JSON.stringify(f.seen[0])));
  assert.equal(prepared[0]!.data.session_id, f.sessionId);
  assert.equal(prepared[0]!.data.iteration, 1);
  assert.notEqual(prepared[0]!.data.system_sha256, detail.envelope.context_envelope.sha256,
    'post-advisory dispatch evidence must remain separate from assembled admission');
  assert.equal(JSON.stringify(prepared).includes('PRIVATE'), false);
  assert.equal(await fs.readFile(path.join(f.journal.attemptsDir, admission.attempt_id + '.json'), 'utf8'), f.admissionAtDispatch);
});

for (const boundary of ['write-failure', 'cancel', 'revoke'] as const) {
  test(`governed ${boundary} at dispatch evidence boundary permits no inference`, async t => {
    const f = await governedFixture(t, boundary);
    assert.equal(f.seen.length, 0);
    assert.equal(f.loop.status(f.sessionId).state, boundary === 'cancel' ? 'aborted' : 'error');
  });
}
