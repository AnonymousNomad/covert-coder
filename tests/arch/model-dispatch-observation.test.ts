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
import { ModelProviderRoute, type ModelProviderRouteT } from '../../common/contracts/model-access.ts';
import { randomUUID } from 'node:crypto';
import nodeHttp from 'node:http';
import { fixtureBridge, readLog } from './opencode-bridge-fixture.ts';

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
async function fixture(t: TestContext, contextTokens = 1024, modelAlias = 'controlled.gguf') {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'covert-dispatch-observation-'));
  const beforeRemove: Array<() => Promise<void>> = [];
  t.after(async () => {
    const failures: unknown[] = [];
    for (const cleanup of beforeRemove) {
      try { await cleanup(); }
      catch (error) { failures.push(error); }
    }
    assert.equal(path.dirname(path.resolve(root)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(root).startsWith('covert-dispatch-observation-'));
    await fs.rm(root, { recursive: true, force: true });
    if (failures.length > 0) throw new AggregateError(failures, 'governed fixture cleanup failed');
  });
  const manifestPath = path.join(root, 'manifest.json');
  const id = 'controlled-observation';
  await fs.writeFile(manifestPath, JSON.stringify({ models: [{ id, context_tokens: contextTokens,
    endpoint: 'http://127.0.0.1:1/v1', model: modelAlias, roles: ['chat'],
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
  return { root, runtime, router, target, seen, order, stream, addBeforeRemove: (cleanup: () => Promise<void>) => { beforeRemove.push(cleanup); } };
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
async function governedFixture(t: TestContext, boundary: 'pass' | 'write-failure' | 'cancel' | 'revoke' | 'target-change' | 'egress' = 'pass', stage: 'router' | 'adapter' | 'opencode' = 'router') {
  const f = await fixture(t, 16384, stage === 'adapter' ? 'controlled-observation' : 'controlled.gguf');
  const server = new ArchServer(f.root, path.join(f.root, 'arch.log'));
  const journal = createAttemptJournal({ workspace: f.root });
  const record = journal.recordEvent.bind(journal);
  const openCodeRoutes: ModelProviderRouteT[] = [];
  const promptBodies: string[] = [];
  let managedFixture: Awaited<ReturnType<typeof fixtureBridge>> | undefined;
  let egressAllowed = true;
  let admissionAtDispatch: string | null = null;
  let owner: Awaited<ReturnType<typeof pairFixture>>;
  let dispatchSignal: AbortSignal | undefined;
  let cancellation: Promise<void> | undefined;
  let cancellationError: unknown;
  if (stage === 'opencode') {
    const providerModel = 'opencode-go/deepseek-v4.1-flash';
    managedFixture = await fixtureBridge(f.root, 'agent-completion', {
      assertExternalEgressAllowed: () => {
        if (!egressAllowed) throw Object.assign(new Error('controlled OpenCode egress revoked'), { code: 'FORBIDDEN' });
      },
      fetchFn: async (url, init) => {
        if (String(url).endsWith('/prompt_async')) {
          const rows = (await fs.readFile(journal.journalPath, 'utf8')).trim().split('\n')
            .map(line => JSON.parse(line) as { event: string });
          assert.ok(rows.some(row => row.event === 'MODEL_ADAPTER_INPUT_PREPARED'), 'AttemptJournal receipt must be durable before managed prompt HTTP');
          promptBodies.push(String(init?.body));
        }
        return fetch(url, init);
      }
    });
    const ownedBridge = managedFixture;
    f.addBeforeRemove(async () => {
      await ownedBridge.bridge.stop();
      assert.ok((await readLog(ownedBridge.log)).some(event => event.event === 'server-child-close'), 'owned OpenCode fixture child must close');
    });
    openCodeRoutes.push(ModelProviderRoute.parse({
      id: `route:opencode-managed:${providerModel}:opencode`, model_id: `provider:opencode:${providerModel}`,
      provider_id: 'opencode', connection_id: 'opencode-managed', provider_model_id: providerModel,
      credential_source_id: 'credential-source:opencode-managed', execution_adapter_id: 'opencode',
      model_support_state: 'VERIFIED', configured: true, health: 'HEALTHY', available: true,
      external_egress_required: true, operator_setup_required: false, setup_state: 'READY', selected_roles: ['plan']
    }));
    f.router = new ModelRouter(f.runtime, {} as ProviderService, [], async () => openCodeRoutes, {
      workspace: f.root,
      assertExternalEgressAllowed: () => {
        if (!egressAllowed) throw Object.assign(new Error('controlled OpenCode egress revoked'), { code: 'FORBIDDEN' });
      },
      runTaskStream: options => ownedBridge.bridge.runTaskStream(options)
    });
    const resolved = await f.router.resolveAuthorityTarget(`cloud:opencode:${providerModel}`);
    assert.equal(resolved.status, 'RESOLVED');
    if (resolved.status !== 'RESOLVED') throw new Error('Controlled OpenCode target unresolved');
    f.target = resolved.target;
  }
  const dispatch = f.router.chatStreamResolvedTarget.bind(f.router);
  f.router.chatStreamResolvedTarget = async (...args) => {
    dispatchSignal = args[3];
    return dispatch(...args);
  };
  const loop = createAgentLoop({ workspace: f.root, authority: server.authority, attemptJournal: journal,
    chatFn: async () => { throw new Error('legacy fallback forbidden'); } });
  journal.recordEvent = async (attemptId, event, data, source) => {
    const selectedEvent = stage === 'router' ? 'MODEL_INPUT_PREPARED' : 'MODEL_ADAPTER_INPUT_PREPARED';
    if (event !== selectedEvent) return record(attemptId, event, data, source);
    const admissionPath = path.join(journal.attemptsDir, attemptId + '.json');
    if (boundary === 'write-failure') {
      admissionAtDispatch = await fs.readFile(admissionPath, 'utf8');
      throw new Error('controlled governed observation persistence failure');
    }
    const admissionBefore = await fs.readFile(admissionPath, 'utf8');
    const result = await record(attemptId, event, data, source);
    admissionAtDispatch = await fs.readFile(admissionPath, 'utf8');
    assert.equal(admissionAtDispatch, admissionBefore, 'append-only observations do not mutate immutable admission');
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
    if (boundary === 'target-change') {
      if (stage === 'opencode') openCodeRoutes[0] = ModelProviderRoute.parse({ ...openCodeRoutes[0]!, provider_model_id: 'opencode-go/changed-model' });
      else f.runtime.list()[0]!.endpoint = 'http://127.0.0.1:1/v1';
    }
    if (boundary === 'egress') egressAllowed = false;
    return result;
  };
  const inferenceBodies: string[] = [];
  let engineError: unknown;
  if (stage === 'adapter') {
    // Actual Runtime HTTP serialization/health/warmup with a controlled engine.
    // No model process or canonical Model Manager start qualification here.
    const engine = nodeHttp.createServer((req, res) => {
      let body = ''; req.on('data', chunk => { body += chunk.toString('utf8'); });
      req.on('end', () => { void (async () => {
        res.setHeader('content-type', 'application/json');
        if (req.url === '/v1/models') { res.end(JSON.stringify({ data: [{ id: 'controlled-observation' }] })); return; }
        if (req.url === '/props') { res.end(JSON.stringify({ default_generation_settings: { n_ctx: 16384 } })); return; }
        if (req.url !== '/v1/chat/completions') { res.statusCode = 404; res.end('{}'); return; }
        const payload = JSON.parse(body) as { messages: Array<{ role: string; content: string }>; stream?: boolean };
        const mission = payload.messages.some(message => message.content === 'PRIVATE GOVERNED FIXTURE TASK');
        if (mission) {
          const rows = (await fs.readFile(journal.journalPath, 'utf8')).trim().split('\n').map(line => JSON.parse(line) as { event: string });
          assert.ok(rows.some(row => row.event === 'MODEL_ADAPTER_INPUT_PREPARED'), 'adapter receipt must be durable before mission HTTP arrival');
          inferenceBodies.push(body); f.seen.push(structuredClone(payload.messages));
        }
        const text = '<attempt_completion><result>controlled HTTP complete</result></attempt_completion>';
        if (payload.stream) {
          res.setHeader('content-type', 'text/event-stream');
          res.end('data: ' + JSON.stringify({ choices: [{ delta: { content: text } }] }) + '\n\ndata: [DONE]\n\n');
        } else res.end(JSON.stringify({ choices: [{ message: { content: 'controlled warmup' } }] }));
      })().catch(error => { engineError = error; res.statusCode = 500; res.end('{}'); }); });
    });
    await new Promise<void>(resolve => engine.listen(0, '127.0.0.1', resolve));
    t.after(async () => { engine.closeAllConnections(); await new Promise<void>(resolve => engine.close(() => resolve())); });
    const engineAddress = engine.address(); assert.ok(engineAddress && typeof engineAddress === 'object');
    f.runtime.list()[0]!.endpoint = `http://127.0.0.1:${engineAddress.port}/v1`;
    f.runtime.chatStream = ModelRuntime.prototype.chatStream.bind(f.runtime);
  } else if (stage === 'router') f.runtime.chatStream = async (_id, messages, onDelta, signal) => {
    signal.throwIfAborted();
    const rows = (await fs.readFile(journal.journalPath, 'utf8')).trim().split('\n').map(line => JSON.parse(line) as { event: string });
    assert.ok(rows.some(row => row.event === 'MODEL_INPUT_PREPARED'), 'receipt must already be durable before inference');
    f.order.push('inference'); f.seen.push(structuredClone(messages));
    onDelta('<attempt_completion><result>controlled complete</result></attempt_completion>');
  };
  else f.runtime.chatStream = async () => { throw new Error('OpenCode prepared-input path must not fall through to local runtime'); };
  const worker = { worker: f.target.binding.route_id, provider: stage === 'opencode' ? 'opencode' : 'local',
    model: stage === 'opencode' ? 'opencode-go/deepseek-v4.1-flash' : f.target.binding.model_id, role: 'plan' as const };
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
  f.addBeforeRemove(async () => {
    const hasLiveWorker = loop.list().some(session => !['done', 'error', 'aborted'].includes(session.state));
    server.events.close();
    try {
      if (http.listening) {
        http.closeAllConnections();
        await new Promise<void>((resolve, reject) => http.close(error => error ? reject(error) : resolve()));
      }
    } finally {
      server.authority.control.close();
    }
    await server.logger.flush();
    assert.equal(hasLiveWorker, false, 'no live fixture worker');
  });
  const request = AgentStartRequest.parse({ task: 'PRIVATE GOVERNED FIXTURE TASK', mode: 'plan', chat_source: stage === 'opencode' ? 'provider' : 'local', worker,
    handoff_id: randomUUID(), expertAdvisory: true, client_request_id: randomUUID() });
  const headers = await owner.approve('POST', '/api/agent/start', request, 'governed-observation');
  const response = await owner.request('/api/agent/start', { method: 'POST', headers, body: JSON.stringify(request) });
  assert.equal(response.status, 200);
  const started = await response.json() as { data: { session_id: string } };
  try {
    await eventually(() => ['done', 'error', 'aborted'].includes(loop.status(started.data.session_id).state));
  } catch (error) {
    const journalEvents = (await fs.readFile(journal.journalPath, 'utf8').catch(() => ''))
      .split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line) as { event?: unknown }).map(row => row.event);
    const managedEvents = managedFixture === undefined ? [] : (await readLog(managedFixture.log)).map(row => row.event);
    const current = loop.status(started.data.session_id);
    console.error('GOVERNED_DISPATCH_TIMEOUT ' + JSON.stringify({
      boundary, stage, session_state: current.state, session_error: current.error ?? null,
      iterations: current.iterations, dispatch_aborted: dispatchSignal?.aborted ?? false,
      prepared_event_count: journalEvents.filter(event => event === (stage === 'router' ? 'MODEL_INPUT_PREPARED' : 'MODEL_ADAPTER_INPUT_PREPARED')).length,
      prompt_count: promptBodies.length, managed_events: managedEvents
    }));
    throw error;
  }
  await cancellation;
  if (cancellationError !== undefined) throw cancellationError;
  if (engineError !== undefined) throw engineError;
  return { ...f, loop, journal, sessionId: started.data.session_id, consumes, admissionAtDispatch, inferenceBodies, promptBodies, managedFixture };
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

test('governed real Runtime HTTP input is durably journaled before arrival and recovered under the same attempt', async t => {
  const f = await governedFixture(t, 'pass', 'adapter');
  assert.equal(f.loop.status(f.sessionId).state, 'done');
  assert.equal(f.inferenceBodies.length, 1);
  const recovered = createAttemptJournal({ workspace: f.root }); await recovered.recover();
  const admission = JSON.parse(f.admissionAtDispatch!) as { attempt_id: string };
  const detail = await recovered.get(admission.attempt_id); assert.ok(detail);
  const router = detail.events.find(event => event.event === 'MODEL_INPUT_PREPARED'); assert.ok(router);
  const adapter = detail.events.filter(event => event.event === 'MODEL_ADAPTER_INPUT_PREPARED');
  assert.equal(adapter.length, 1);
  assert.equal(adapter[0]!.source, 'local-model-runtime');
  assert.equal(adapter[0]!.data.body_sha256, digest(f.inferenceBodies[0]!));
  assert.equal(adapter[0]!.data.body_bytes, Buffer.byteLength(f.inferenceBodies[0]!, 'utf8'));
  assert.equal(adapter[0]!.data.route_id, router.data.route_id);
  assert.equal(adapter[0]!.data.target_revision, router.data.target_revision);
  assert.equal(adapter[0]!.data.session_id, f.sessionId);
  assert.equal(adapter[0]!.data.iteration, 1);
  assert.equal(adapter[0]!.data.request_index, 1);
  assert.equal(JSON.stringify(adapter).includes('PRIVATE'), false);
  assert.equal(await fs.readFile(path.join(f.journal.attemptsDir, admission.attempt_id + '.json'), 'utf8'), f.admissionAtDispatch);
});

for (const boundary of ['write-failure', 'cancel', 'revoke', 'target-change'] as const) {
  test(`governed ${boundary} at adapter evidence boundary permits health/warmup and zero mission POST`, async t => {
    const f = await governedFixture(t, boundary, 'adapter');
    assert.equal(f.inferenceBodies.length, 0);
    assert.equal(f.seen.length, 0);
    assert.equal(f.loop.status(f.sessionId).state, boundary === 'cancel' ? 'aborted' : 'error');
  });
}

test('governed exact-worker OpenCode body is journaled before prompt_async and recovers under unchanged admission', async t => {
  const f = await governedFixture(t, 'pass', 'opencode');
  const sessionStatus = f.loop.status(f.sessionId);
  assert.equal(sessionStatus.state, 'done', JSON.stringify(sessionStatus));
  assert.equal(f.promptBodies.length, 1);
  assert.equal(f.seen.length, 0, 'managed OpenCode must not fall through to the local runtime');
  const body = JSON.parse(f.promptBodies[0]!) as { model: { providerID: string; modelID: string }; parts: Array<{ type: string; text: string }> };
  assert.deepEqual(body.model, { providerID: 'opencode-go', modelID: 'deepseek-v4.1-flash' });
  assert.equal(body.parts[0]?.type, 'text');
  assert.match(body.parts[0]?.text ?? '', /PRIVATE GOVERNED FIXTURE TASK/);
  const recovered = createAttemptJournal({ workspace: f.root }); await recovered.recover();
  const admission = JSON.parse(f.admissionAtDispatch!) as { attempt_id: string };
  const detail = await recovered.get(admission.attempt_id); assert.ok(detail);
  const router = detail.events.find(event => event.event === 'MODEL_INPUT_PREPARED'); assert.ok(router);
  const prepared = detail.events.filter(event => event.event === 'MODEL_ADAPTER_INPUT_PREPARED');
  assert.equal(prepared.length, 1);
  assert.equal(prepared[0]!.source, 'opencode-bridge');
  assert.equal(prepared[0]!.data.adapter, 'opencode-bridge');
  assert.equal(prepared[0]!.data.protocol, 'opencode-prompt-async');
  assert.equal(prepared[0]!.data.requested_model, 'opencode-go/deepseek-v4.1-flash');
  assert.equal(prepared[0]!.data.body_sha256, digest(f.promptBodies[0]!));
  assert.equal(prepared[0]!.data.body_bytes, Buffer.byteLength(f.promptBodies[0]!, 'utf8'));
  assert.equal(prepared[0]!.data.route_id, router.data.route_id);
  assert.equal(prepared[0]!.data.target_revision, router.data.target_revision);
  assert.equal(prepared[0]!.data.session_id, f.sessionId);
  assert.equal(prepared[0]!.data.iteration, 1);
  assert.equal(prepared[0]!.data.request_index, 1);
  assert.equal(prepared[0]!.data.stream, true);
  assert.equal(JSON.stringify(prepared).includes('PRIVATE'), false);
  assert.equal(await fs.readFile(path.join(f.journal.attemptsDir, admission.attempt_id + '.json'), 'utf8'), f.admissionAtDispatch);
  const openCodeEvents = await readLog(f.managedFixture!.log);
  assert.equal(openCodeEvents.filter(event => event.event === 'prompt').length, 1);
  assert.equal(openCodeEvents.filter(event => event.event === 'delete').length, 1);
});

for (const boundary of ['write-failure', 'cancel', 'revoke', 'target-change', 'egress'] as const) {
  test(`governed OpenCode ${boundary} at prepared-input boundary permits no managed prompt`, async t => {
    const f = await governedFixture(t, boundary, 'opencode');
    assert.equal(f.promptBodies.length, 0);
    assert.equal(f.loop.status(f.sessionId).state, boundary === 'cancel' ? 'aborted' : 'error');
    const recovered = createAttemptJournal({ workspace: f.root }); await recovered.recover();
    const admission = JSON.parse(f.admissionAtDispatch!) as { attempt_id: string };
    const detail = await recovered.get(admission.attempt_id); assert.ok(detail);
    const prepared = detail.events.filter(event => event.event === 'MODEL_ADAPTER_INPUT_PREPARED');
    assert.equal(prepared.length, boundary === 'write-failure' ? 0 : 1);
    const openCodeEvents = await readLog(f.managedFixture!.log);
    assert.equal(openCodeEvents.some(event => event.event === 'prompt'), false);
    assert.equal(openCodeEvents.filter(event => event.event === 'delete').length, 1);
  });
}
