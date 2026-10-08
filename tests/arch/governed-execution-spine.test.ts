import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ModelManagerResponse, type ModelManagerResponseT } from '../../common/contracts/model-access.ts';
import type { ProjectAddressT } from '../../common/contracts/project.ts';
import type { WorkerDescriptorT } from '../../common/contracts/worker-handoff.ts';
import { createContextAperture } from '../../node/src/services/context-aperture.ts';
import { createResourceAdmission } from '../../node/src/services/resource-admission.ts';
import { routesForAgent } from '../../node/src/routes/agent.ts';
import { createAgentLoop } from '../../node/src/services/agent-loop.mjs';
import { createAttemptJournal } from '../../node/src/services/attempt-journal.ts';
import { createWorkerHandoffService } from '../../node/src/services/worker-handoff.ts';
import type { ModelRouter, ResolvedChatAuthorityTarget } from '../../node/src/services/model-router.ts';
import { pairServiceFixture } from './authority-fixture.ts';

const artifactSha = 'a'.repeat(64);
const sourceSha = 'b'.repeat(40);
const worker: WorkerDescriptorT = { worker: 'local:exact-model', provider: 'local', model: 'exact-model', role: 'planner' };

function withoutCreatedAt<T extends { created_at: string }>(value: T): Omit<T, 'created_at'> {
  return Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'created_at')) as Omit<T, 'created_at'>;
}

function aperture(sessionId: string, project: ProjectAddressT, input: { included?: string[]; handoff?: string; handoffContext?: string; taskId?: string; objective?: string; criteria?: string[] } = {}) {
  return createContextAperture({
    aperture_id: randomUUID(),
    project,
    source: { revision: sourceSha, branch: 'main', working_tree: 'CLEAN', observed_at: new Date().toISOString() },
    task_id: input.taskId ?? 'task-1',
    objective: input.objective ?? 'Return a bounded summary of the supplied project context.',
    acceptance_criteria: input.criteria ?? ['Do not claim project reads or changes that are not represented.'],
    included_files: input.included ?? ['README.md'],
    destination_session_id: sessionId,
    destination: worker,
    handoff_id: input.handoff ?? null,
    handoff_context: input.handoffContext ?? null
  });
}

function managerSnapshot(qualified = true): ModelManagerResponseT {
  return ModelManagerResponse.parse({
    generated_at: new Date().toISOString(), public_safe: true,
    local_discovery: { status: 'AVAILABLE', scanned_dirs: 1, discovered_count: 1, error_count: 0 },
    runtime: {
      canonical_runtime_id: 'unsloth', default_runtime_id: 'unsloth', reported_backend: 'LLAMA_CPP',
      discovered_state: 'DISCOVERED', configured_runtime_id: 'unsloth', configured: true,
      available: true, health: 'HEALTHY', selected_model_id: 'exact-model'
    },
    models: [{
      identity: {
        canonical_id: 'exact-model', display_name: 'Exact Local Model', family: null,
        capabilities: ['TEXT'], context_window_tokens: 8192,
        qualification: {
          state: qualified ? 'QUALIFIED' : 'UNTESTED',
          basis: qualified ? { source_revision: 'runtime-rev', artifact_sha256: artifactSha, runtime_id: 'llama.cpp', runtime_version: 'build-1' } : null,
          stale_reasons: []
        }
      },
      artifact_ids: ['artifact-1'], availability: 'INSTALLED', compatibility: 'COMPATIBLE',
      readiness: qualified ? 'READY' : 'NOT_READY', recommended_roles: ['PLANNING'], execution_selected_roles: ['PLANNING']
    }],
    artifacts: [{
      id: 'artifact-1', model_id: 'exact-model', source_kind: 'LOCAL_MANIFEST', source_ref: 'local-manifest', revision: null,
      filename: 'exact-model.gguf', format: 'GGUF', quantization: 'Q4_K_M', expected_sha256: artifactSha,
      observed_sha256: artifactSha, hash_status: 'VERIFIED', license: 'unknown', availability: 'INSTALLED', compatibility: 'COMPATIBLE'
    }],
    routes: [], credential_sources: [],
    execution_adapters: [{ id: 'local-runtime', kind: 'LOCAL_RUNTIME', implementation: 'IMPLEMENTED', discovered: true, configured: true, available: true, canonical_default: true }],
    connections: {
      consensus: 'none', routed_roles: { planner: 'local', coder: 'local', reviewer: 'local', utility: 'local' },
      preference: 'local-first', connections: []
    },
    selection_policy: {
      persistence_state: 'NOT_PERSISTED', mutation_enabled: false, execution_routing_effect: false, scopes: ['GLOBAL'],
      roles: ['PLANNING'], precedence: ['PROJECT_ROLE', 'PROJECT_DEFAULT', 'GLOBAL_ROLE', 'GLOBAL_DEFAULT']
    }
  });
}

function target(revision = 'target-revision'): ResolvedChatAuthorityTarget {
  const routeId = worker.worker;
  return {
    binding: {
      execution_class: 'LOCAL', route_id: routeId, model_id: worker.model,
      source: 'model-runtime', runtime_class: 'local-model-runtime', endpoint_origin: 'http://127.0.0.1:8111',
      target_revision: revision, execution_adapter_id: 'local-runtime'
    },
    route: {
      id: routeId, displayName: 'Exact Local Model', providerType: 'local', baseUrl: 'http://127.0.0.1:8111/v1',
      modelString: worker.model, contextLength: 8192, chatTemplate: 'chatml', status: 'ready', probeMs: null,
      roles: ['planner'], capabilities: []
    }
  } as ResolvedChatAuthorityTarget;
}

test('Context Aperture redacts secrets, rejects path escape, and binds fresh worker sessions and handoffs', () => {
  const project = { project_id: randomUUID(), checkout_id: randomUUID() };
  const session1 = randomUUID();
  const first = createContextAperture({
    aperture_id: randomUUID(), project,
    source: { revision: sourceSha, branch: 'main', working_tree: 'DIRTY', observed_at: new Date().toISOString() },
    task_id: 'task-1', objective: 'Inspect sk-12345678 and report no secret.', acceptance_criteria: ['Return a summary.'],
    included_files: ['README.md'], destination_session_id: session1, destination: worker
  });
  const second = createContextAperture({
    aperture_id: randomUUID(), project,
    source: { revision: sourceSha, branch: 'main', working_tree: 'DIRTY', observed_at: new Date().toISOString() },
    task_id: 'task-1', objective: 'Continue from verified handoff.', acceptance_criteria: ['Separate claims from evidence.'],
    included_files: [], destination_session_id: randomUUID(), destination: worker,
    handoff_id: randomUUID(), handoff_context: 'prior worker result: completed a bounded summary'
  });
  assert.equal(first.content.includes('sk-12345678'), false);
  assert.equal(first.allowed_capabilities.length, 0);
  assert.deepEqual(first.protocol_tools, []);
  assert.notEqual(first.destination_session_id, second.destination_session_id);
  assert.notEqual(first.sha256, second.sha256);
  assert.match(first.content, /cookies, browser credentials/);
  assert.throws(() => createContextAperture({
    aperture_id: randomUUID(), project, source: { revision: sourceSha, branch: null, working_tree: 'CLEAN', observed_at: new Date().toISOString() },
    task_id: 'task-1', objective: 'bad path', acceptance_criteria: ['reject'], included_files: ['..\\outside.txt'],
    destination_session_id: randomUUID(), destination: worker
  }), /checkout-relative/);
});

test('Resource Admission enforces physical memory >=3072 MiB and free commit >5120 MiB', async () => {
  let freeMemory = 3072;
  let freeCommit = 5121;
  const admission = createResourceAdmission({
    memoryProbeMB: () => freeMemory, commitProbeMB: async () => freeCommit,
    vramProbeMB: async () => null, loadProbe: () => 1, cores: 8
  });
  const request = {
    kind: 'worker' as const,
    requirement: { minimum_free_memory_mb: 3072, free_commit_strictly_above_mb: 5120 },
    disposable: true,
    workload: {
      worker_session_id: randomUUID(), project_id: randomUUID(), checkout_id: randomUUID(), route_id: worker.worker,
      model_id: worker.model, artifact_sha256: artifactSha, runtime_id: 'llama.cpp', runtime_version: 'build-1', context_tokens: 100
    }
  };
  assert.equal((await admission.admit(request)).decision, 'START');
  freeMemory = 3071;
  assert.equal((await admission.admit(request)).decision, 'REFUSE_RESOURCE');
  freeMemory = 3072;
  freeCommit = 5120;
  assert.equal((await admission.admit(request)).decision, 'REFUSE_RESOURCE');
});

test('agent route binds exact local route, ProjectSeat checkout, and one-shot Authority approval', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'covert-governed-route-'));
  const fixture = await pairServiceFixture(root);
  try {
    const address = { project_id: randomUUID(), checkout_id: randomUUID() };
    let currentAddress = address;
    let currentRevision = sourceSha;
    let selectedTarget = target();
    let modelSnapshot = managerSnapshot();
    const router: Pick<ModelRouter, 'resolveAuthorityTarget' | 'chatStreamResolvedTarget'> = {
      resolveAuthorityTarget: async routeId => routeId === worker.worker ? { status: 'RESOLVED', target: selectedTarget } : { status: 'UNKNOWN', reason: 'route-not-registered' },
      chatStreamResolvedTarget: async () => { throw new Error('description must never dispatch'); }
    };
    const service = { rootAbs: root, start: async () => ({ session_id: randomUUID() }), decide: async () => ({ ok: true }), cancel: async () => ({ ok: true, state: 'aborted' as const }), status: () => ({}), list: () => [] };
    const route = routesForAgent(service, {
      exactWorker: { workspace: root, router },
      projectSeat: { current: async () => currentAddress, assertAddress: async (candidate: ProjectAddressT) => {
        if (candidate.project_id !== currentAddress.project_id || candidate.checkout_id !== currentAddress.checkout_id) throw new Error('checkout mismatch');
        return currentAddress;
      } } as never,
      captureSource: async () => ({ revision: currentRevision, branch: 'main', working_tree: 'CLEAN' }),
      modelManagerSnapshot: async () => modelSnapshot,
      runtimeSnapshot: async () => ({ health: 'HEALTHY', pid: 4321, loaded_model: { model_id: worker.model, artifact_sha256: artifactSha }, version: 'build-1', started_at: '2026-10-08T00:00:00.000Z' } as never)
    }).find(candidate => candidate.path === '/api/agent/start')!;
    const sessionId = randomUUID();
    const request = {
      task: 'Return a short context summary.', mode: 'plan' as const, chat_source: 'local' as const, worker,
      governed_execution: {
        capability_id: 'project.worker.execute.local' as const, worker_session_id: sessionId, task_id: sessionId,
        project: address, aperture_id: randomUUID(), acceptance_criteria: ['Do not claim unobserved work.']
      }
    };
    const describe = (body: unknown, actor: { kind: string; id: string } | null = fixture.owner) =>
      route.describeOperation!({ actor, body, query: {} } as never, 'governed-route-fixture');
    const operationInput = await describe(request);
    assert.equal(operationInput.kind, 'agent.start');
    const args = operationInput.args as { body: typeof request; worker_binding: Record<string, unknown>; context_aperture: Record<string, unknown> };
    assert.equal(args.body.governed_execution.project.checkout_id, address.checkout_id);
    assert.equal(args.worker_binding['principal_id'], fixture.owner.id);
    assert.equal(args.context_aperture['destination_session_id'], sessionId);
    await assert.rejects(() => describe(request, null), /authenticated operator/);
    await assert.rejects(() => describe(request, { kind: 'agent', id: 'cipher' }), /authenticated operator/);
    const unavailableRequest = { ...request, worker: { ...worker, worker: 'local:unavailable-route' } };
    await assert.rejects(() => describe(unavailableRequest), /exact agent worker is unresolved/);
    await assert.rejects(() => describe({ ...request, governed_execution: { ...request.governed_execution, project: { ...address, checkout_id: randomUUID() } } }), /stale or mismatched/);
    currentAddress = { ...address, checkout_id: randomUUID() };
    await assert.rejects(() => describe(request), /stale or mismatched/);
    currentAddress = address;
    modelSnapshot = managerSnapshot(false);
    await assert.rejects(() => describe(request), /not exactly qualified/);
    modelSnapshot = managerSnapshot();
    selectedTarget = { ...target('new-route-revision'), binding: { ...target('new-route-revision').binding, model_id: 'different-model' } } as ResolvedChatAuthorityTarget;
    await assert.rejects(() => describe(request), /does not match the exact resolved agent target/);
    selectedTarget = target();

    const mutations: Array<[string, (args: Record<string, unknown>) => void]> = [
      ['project', args => {
        const body = args['body'] as Record<string, unknown>;
        const governed = body['governed_execution'] as Record<string, unknown>;
        body['governed_execution'] = { ...governed, project: { project_id: randomUUID(), checkout_id: address.checkout_id } };
      }],
      ['checkout', args => { const body = args['body'] as Record<string, unknown>; const governed = body['governed_execution'] as Record<string, unknown>; governed['project'] = { project_id: address.project_id, checkout_id: randomUUID() }; }],
      ['route', args => { const routeBinding = args['agent_target'] as Record<string, unknown>; routeBinding['route_id'] = 'local:other-route'; }],
      ['capability', args => { const body = args['body'] as Record<string, unknown>; const governed = body['governed_execution'] as Record<string, unknown>; governed['capability_id'] = 'project.worker.execute.other'; }],
      ['worker', args => { const body = args['body'] as Record<string, unknown>; body['worker'] = { ...(body['worker'] as object), worker: 'local:other-worker' }; }],
      ['session', args => { const body = args['body'] as Record<string, unknown>; const governed = body['governed_execution'] as Record<string, unknown>; governed['worker_session_id'] = randomUUID(); }]
    ];
    for (const [name, mutate] of mutations) {
      const approved = await fixture.authority.prepare(fixture.owner, operationInput);
      await fixture.authority.decide(fixture.owner, approved.operation_id, 'approve');
      const changed = structuredClone(operationInput);
      mutate(changed.args as Record<string, unknown>);
      let invoked = false;
      await assert.rejects(() => fixture.authority.execute(fixture.owner, approved.operation_id, changed, () => {
        invoked = true;
        return Promise.resolve(null);
      }));
      assert.equal(invoked, false, `${name} changed after approval must not dispatch`);
    }

    const staleApproval = await fixture.authority.prepare(fixture.owner, operationInput);
    await fixture.authority.decide(fixture.owner, staleApproval.operation_id, 'approve');
    currentRevision = 'c'.repeat(40);
    const refreshedInput = await describe(request);
    let staleDispatched = false;
    await assert.rejects(() => fixture.authority.execute(fixture.owner, staleApproval.operation_id, refreshedInput, () => {
      staleDispatched = true;
      return Promise.resolve(null);
    }));
    assert.equal(staleDispatched, false);
  } finally {
    fixture.authority.control.close();
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('exact local dispatch records startup failure without RUNNING and preserves failure after first output', async () => {
  const runFailureCase = async (mode: 'before-output' | 'after-output') => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), `covert-governed-${mode}-`));
    const fixture = await pairServiceFixture(root);
    const project = { project_id: randomUUID(), checkout_id: randomUUID() };
    const sessionId = randomUUID();
    const apertureId = randomUUID();
    const task = `Observe ${mode} adapter failure.`;
    const criteria = ['Report only observed adapter state.'];
    const request = {
      task, mode: 'plan' as const, chat_source: 'local' as const, worker,
      governed_execution: {
        capability_id: 'project.worker.execute.local' as const, worker_session_id: sessionId, task_id: sessionId,
        project, aperture_id: apertureId, acceptance_criteria: criteria, included_files: []
      }
    };
    const resourceAdmission = createResourceAdmission({
      memoryProbeMB: () => 8192, commitProbeMB: async () => 8192, vramProbeMB: async () => null, loadProbe: () => 1, cores: 8
    });
    const attemptJournal = createAttemptJournal({ workspace: root });
    const events: Array<Record<string, unknown>> = [];
    let resolveTerminal!: (event: Record<string, unknown>) => void;
    const terminalEvent = new Promise<Record<string, unknown>>(resolve => { resolveTerminal = resolve; });
    const loop = createAgentLoop({ workspace: root, authority: fixture.authority, chatFn: async () => { throw new Error('governed request must use the exact local route'); }, attemptJournal, resourceAdmission, onEvent: event => {
      events.push(event);
      if (['done', 'error', 'aborted'].includes(String(event['event']))) resolveTerminal(event);
      return { accepted: true };
    } });
    const resolved = target();
    const router: Pick<ModelRouter, 'resolveAuthorityTarget' | 'chatStreamResolvedTarget'> = {
      resolveAuthorityTarget: async () => ({ status: 'RESOLVED', target: resolved }),
      chatStreamResolvedTarget: async (_target, _messages, onDelta) => {
        if (mode === 'after-output') onDelta('first observed token');
        throw new Error(`fixture runtime ${mode} failure`);
      }
    };
    const routes = routesForAgent(loop as never, {
      exactWorker: { workspace: root, router },
      projectSeat: { current: async () => project, assertAddress: async (candidate: ProjectAddressT) => {
        if (candidate.project_id !== project.project_id || candidate.checkout_id !== project.checkout_id) throw new Error('checkout mismatch');
        return project;
      } } as never,
      captureSource: async () => ({ revision: sourceSha, branch: 'main', working_tree: 'CLEAN' }),
      modelManagerSnapshot: async () => managerSnapshot(),
      runtimeSnapshot: async () => ({ health: 'HEALTHY', pid: 4321, loaded_model: { model_id: worker.model, artifact_sha256: artifactSha }, version: 'build-1', started_at: '2026-10-08T00:00:00.000Z' } as never)
    });
    const route = routes.find(candidate => candidate.path === '/api/agent/start')!;
    const context = { actor: fixture.owner, body: request, query: {}, authority: fixture.authority } as Record<string, unknown>;
    try {
      const input = await route.describeOperation! (context as never, sessionId);
      const operation = await fixture.authority.prepare(fixture.owner, input);
      await fixture.authority.decide(fixture.owner, operation.operation_id, 'approve');
      const response = await fixture.authority.execute(fixture.owner, operation.operation_id, input, (_, execution) => {
        context['execution'] = execution;
        return route.handler!(context as never);
      }) as { session_id: string; attempt_id?: string };
      const terminal = await terminalEvent;
      const status = loop.status(response.session_id);
      const attempt = response.attempt_id === undefined ? null : await attemptJournal.get(response.attempt_id);
      return { terminal, status, attempt, lifecycleEvents: events.filter(event => event['event'] === 'worker_lifecycle').map(event => event['state']) };
    } finally {
      fixture.authority.control.close();
      await fs.rm(root, { recursive: true, force: true });
    }
  };

  const startup = await runFailureCase('before-output');
  assert.equal(startup.terminal['event'], 'error');
  assert.equal(startup.status.worker_lifecycle, 'FAILED');
  assert.deepEqual(startup.lifecycleEvents, ['REQUESTED', 'ADMITTED', 'STARTING', 'FAILED']);
  assert.equal(startup.attempt?.events.some(item => item.event === 'WORKER_PROCESS_OBSERVED'), false);
  assert.equal(startup.attempt?.events.some(item => item.event === 'WORKER_RUNNING'), false);

  const afterOutput = await runFailureCase('after-output');
  assert.equal(afterOutput.terminal['event'], 'error');
  assert.equal(afterOutput.status.worker_lifecycle, 'FAILED');
  assert.deepEqual(afterOutput.lifecycleEvents, ['REQUESTED', 'ADMITTED', 'STARTING', 'RUNNING', 'FAILED']);
  assert.equal(afterOutput.attempt?.events.some(item => item.event === 'WORKER_PROCESS_OBSERVED'), true);
});

test('restart recovery classifies an interrupted worker and does not replay model dispatch', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'covert-governed-recovery-'));
  try {
    const sessionId = randomUUID();
    const project = { project_id: randomUUID(), checkout_id: randomUUID() };
    const context = aperture(sessionId, project, { taskId: sessionId });
    const binding = {
      worker_session_id: sessionId, principal_id: 'operator-recovery-test', parent_request_id: sessionId, task_id: sessionId,
      project, source_sha: sourceSha, working_tree: 'CLEAN' as const, capability_id: 'project.worker.execute.local' as const,
      route: {
        route_id: worker.worker, model_id: worker.model, provider_id: null, provider_model: null, adapter_id: 'local-runtime',
        artifact_sha256: artifactSha, runtime_id: 'llama.cpp', runtime_version: 'build-1', target_revision: 'target-revision'
      },
      aperture_id: context.aperture_id, aperture_sha256: context.sha256, authority_operation_id: 'approved-operation-fixture',
      resource_admission_ref: null, runtime_process_id: 4321, runtime_started_at: '2026-10-08T00:00:00.000Z', created_at: new Date().toISOString()
    };
    const initial = createAttemptJournal({ workspace: root });
    const envelope = await initial.prepare({
      task: context.objective, mode: 'plan', task_id: sessionId, workspace: root,
      worker_role: worker.role, worker_identity: worker.worker, worker_provider: worker.provider, worker_model: worker.model,
      handoff_id: null, authority_owner: binding.principal_id, authority_operation_kind: 'agent.start',
      authority_permit_identity: binding.authority_operation_id, max_iterations: 1, effective_context_tokens: context.approx_tokens,
      resource_decision: null, mutation_scope: [], capabilities: [], context_aperture: context, worker_binding: binding
    });
    const resourceAdmissionRef = 'd'.repeat(64);
    await initial.bindResourceAdmission(envelope.attempt_id, {
      decision: 'START', reason: 'fixture observed resource floors', checked_at: new Date().toISOString(),
      reference: resourceAdmissionRef, evidence: { free_physical_memory_mb: 8192, free_commit_mb: 8192 }
    });
    await initial.bindContext(envelope.attempt_id, context.sha256, ['COVERT LINK APERTURE']);
    await initial.seal(envelope.attempt_id);
    await initial.executionStarted(envelope.attempt_id);
    await initial.recordEvent(envelope.attempt_id, 'WORKER_PROCESS_OBSERVED', {
      worker_session_id: sessionId, runtime_process_id: 4321, runtime_id: 'llama.cpp',
      runtime_version: 'build-1', artifact_sha256: artifactSha
    }, 'runtime-broker');

    let modelDispatches = 0;
    const recoveredJournal = createAttemptJournal({ workspace: root });
    const recovered = await recoveredJournal.recover();
    const detail = await recoveredJournal.get(envelope.attempt_id);
    assert.equal(recovered.length, 1);
    assert.equal(recovered[0]?.classification, 'RECOVERED_UNCERTAIN');
    assert.equal(detail?.state, 'RECOVERED_UNCERTAIN');
    assert.equal(detail?.retry_safety, 'UNCERTAIN_BLOCKED');
    assert.equal(detail?.envelope.worker_binding?.resource_admission_ref, resourceAdmissionRef);
    assert.equal(detail?.events.some(item => item.event === 'MODEL_REQUEST_STARTED'), false);
    assert.deepEqual(detail?.events.filter(item => item.event === 'RECOVERY_CLASSIFIED').map(item => item.data['classification']), ['RECOVERED_UNCERTAIN']);
    assert.equal(modelDispatches, 0);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('AgentLoop binds Authority, admission, lifecycle receipt, and fresh handoff continuity', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'covert-governed-loop-'));
  const fixture = await pairServiceFixture(root);
  let freeMemory = 8192;
  const resourceAdmission = createResourceAdmission({
    memoryProbeMB: () => freeMemory, commitProbeMB: async () => 8192, vramProbeMB: async () => null, loadProbe: () => 1, cores: 8
  });
  const attemptJournal = createAttemptJournal({ workspace: root });
  const events: Array<Record<string, unknown>> = [];
  const workerResultText = 'The aperture contains one project, one checkout-relative reference, and no execution tools.';
  let consumeNextHandoff: (() => Promise<void>) | null = null;
  let pauseNextWorker = false;
  let notifyPausedWorkerStarted: (() => void) | null = null;
  let resolveTerminal!: (event: Record<string, unknown>) => void;
  const terminalEvent = new Promise<Record<string, unknown>>(resolve => { resolveTerminal = resolve; });
  const loop = createAgentLoop({
    workspace: root, authority: fixture.authority, attemptJournal, resourceAdmission, onEvent: event => {
      events.push(event);
      if (['done', 'error', 'aborted'].includes(String(event['event']))) resolveTerminal(event);
      return { accepted: true };
    },
    chatFn: async (_messages, signal, observation) => {
      if (consumeNextHandoff !== null) {
        const consume = consumeNextHandoff;
        consumeNextHandoff = null;
        await consume();
      }
      await observation?.onWorkerRunning?.();
      if (pauseNextWorker) {
        pauseNextWorker = false;
        notifyPausedWorkerStarted?.();
        await new Promise<never>((_resolve, reject) => {
          const abort = () => {
            const error = new Error('governed worker request cancelled');
            error.name = 'AbortError';
            reject(error);
          };
          if (signal?.aborted) abort();
          else signal?.addEventListener('abort', abort, { once: true });
        });
      }
      return workerResultText;
    }
  });
  const project = { project_id: randomUUID(), checkout_id: randomUUID() };
  const workerSessionId = randomUUID();
  const context = aperture(workerSessionId, project, {
    taskId: workerSessionId, objective: 'Return a short context summary.', criteria: ['Do not claim unobserved work.'], included: ['README.md']
  });
  const targetBinding = target().binding;
  const workerBinding = {
    worker_session_id: workerSessionId, principal_id: fixture.owner.id, parent_request_id: workerSessionId, task_id: workerSessionId,
    project, source_sha: sourceSha, working_tree: 'CLEAN' as const, capability_id: 'project.worker.execute.local' as const,
    route: {
      route_id: worker.worker, model_id: worker.model, provider_id: null, provider_model: null, adapter_id: 'local-runtime',
      artifact_sha256: artifactSha, runtime_id: 'llama.cpp', runtime_version: 'build-1', target_revision: 'target-revision'
    },
    aperture_id: context.aperture_id, aperture_sha256: context.sha256, authority_operation_id: null,
    resource_admission_ref: null, runtime_process_id: 4321, runtime_started_at: new Date().toISOString(), created_at: new Date().toISOString()
  };
  const request = {
    task: 'Return a short context summary.', mode: 'plan' as const, chat_source: 'local' as const, worker,
    client_request_id: randomUUID(),
    governed_execution: {
      capability_id: 'project.worker.execute.local' as const, worker_session_id: workerSessionId, task_id: workerSessionId,
      project, aperture_id: context.aperture_id, acceptance_criteria: ['Do not claim unobserved work.'], included_files: ['README.md']
    }
  };
  const stableBinding = withoutCreatedAt(workerBinding);
  const { source, ...apertureRemainder } = withoutCreatedAt(context);
  const operationInput = {
    workspace: root, taskId: 'governed-worker', kind: 'agent.start',
    args: {
      route: 'POST /api/agent/start', body: request, agent_target: targetBinding, worker_binding: stableBinding,
      context_aperture: { ...apertureRemainder, source: { ...source, observed_at: null } }
    }
  };
  try {
    const operation = await fixture.authority.prepare(fixture.owner, operationInput);
    await fixture.authority.decide(fixture.owner, operation.operation_id, 'approve');
    const result = await fixture.authority.execute(fixture.owner, operation.operation_id, operationInput, (_, execution) => {
      const authorityContext = fixture.authority.assertExecution(execution, 'agent.start', request);
      const bindingChecks = {
        mode: request.mode === 'plan',
        chat_source: request.chat_source === 'local',
        capability: request.governed_execution.capability_id === 'project.worker.execute.local',
        governed_session: request.governed_execution.worker_session_id === workerSessionId,
        binding_session: workerBinding.worker_session_id === workerSessionId,
        aperture_session: context.destination_session_id === workerSessionId,
        binding_aperture_id: workerBinding.aperture_id === context.aperture_id,
        binding_aperture_sha: workerBinding.aperture_sha256 === context.sha256,
        owner_kind: authorityContext.owner.kind === 'operator',
        owner_id: authorityContext.owner.id === workerBinding.principal_id,
        request_task: context.objective === request.task,
        request_task_id: context.task_id === request.governed_execution.task_id,
        session_id: context.destination_session_id === workerSessionId,
        target_route: workerBinding.route.route_id === targetBinding.route_id,
        target_model: workerBinding.route.model_id === targetBinding.model_id,
        target_revision: workerBinding.route.target_revision === targetBinding.target_revision,
        adapter: workerBinding.route.adapter_id === targetBinding.execution_adapter_id,
        worker_descriptor: JSON.stringify(context.destination) === JSON.stringify(request.worker),
        worker_route: workerBinding.route.route_id === request.worker.worker,
        worker_model: workerBinding.route.model_id === request.worker.model,
        project: context.project.project_id === request.governed_execution.project.project_id && context.project.checkout_id === request.governed_execution.project.checkout_id,
        source: workerBinding.source_sha === context.source.revision && workerBinding.working_tree === context.source.working_tree,
        criteria: JSON.stringify(context.acceptance_criteria) === JSON.stringify(request.governed_execution.acceptance_criteria),
        files: JSON.stringify(context.included_files) === JSON.stringify(request.governed_execution.included_files),
        handoff: context.handoff_id === null,
        operation_id: typeof execution.operation_id === 'string' && execution.operation_id.length > 0
      };
      assert.deepEqual(Object.entries(bindingChecks).filter(([, ok]) => !ok).map(([name]) => name), []);
      return loop.start(request.task, 'plan', null, {
        execution, executionTarget: targetBinding, request, governedExecution: true, workerSessionId,
        contextAperture: context, workerBinding
      });
    });
    const terminal = await terminalEvent;
    assert.equal(terminal['event'], 'done', `governed worker terminal event: ${JSON.stringify({ terminal, worker_events: events.filter(event => event['event'] === 'worker_lifecycle') })}`);
    const status = loop.status(result.session_id);
    assert.equal(status.state, 'done');
    assert.equal(status.worker_lifecycle, 'COMPLETED');
    assert.equal(status.context_aperture_id, context.aperture_id);
    const detail = await attemptJournal.get(result.attempt_id!);
    assert.ok(detail);
    assert.equal(detail.envelope.worker_binding?.authority_operation_id, operation.operation_id);
    assert.equal(detail.envelope.worker_binding?.resource_admission_ref, detail.envelope.resource_admission.reference);
    assert.deepEqual(detail.events.filter(item => item.event.startsWith('WORKER_')).map(item => item.event), [
      'WORKER_REQUESTED', 'WORKER_ADMITTED', 'WORKER_STARTING', 'WORKER_PROCESS_OBSERVED', 'WORKER_RUNNING', 'WORKER_RESULT_OBSERVED', 'WORKER_COMPLETED'
    ]);
    assert.equal(events.some(event => event['event'] === 'worker_lifecycle' && event['state'] === 'RUNNING'), true);
    assert.equal(detail.envelope.worker_binding?.principal_id, fixture.owner.id);
    assert.equal(detail.envelope.worker_binding?.worker_session_id, workerSessionId);
    assert.equal(detail.envelope.worker_binding?.task_id, workerSessionId);
    assert.deepEqual(detail.envelope.worker_binding?.project, project);
    assert.equal(detail.envelope.worker_binding?.source_sha, sourceSha);
    assert.equal(detail.envelope.worker_binding?.route.model_id, worker.model);
    assert.equal(detail.envelope.context_aperture?.sha256, context.sha256);
    const resultReceipt = detail.events.find(item => item.event === 'WORKER_RESULT_OBSERVED');
    assert.equal(resultReceipt?.data['result_sha256'], createHash('sha256').update(workerResultText, 'utf8').digest('hex'));
    assert.equal(resultReceipt?.data['output_chars'], workerResultText.length);

    const secondWorkerSessionId = randomUUID();
    const secondWorker = { ...worker };
    const handoffs = createWorkerHandoffService({
      workspace: root,
      projectSeat: { current: async () => project } as never
    });
    const handoff = await handoffs.create({
      task_id: workerSessionId,
      from: worker,
      to: secondWorker,
      objective: 'Continue with an independent review of the first worker receipt.',
      next_action: 'Review the bounded handoff and return any unsupported claims.'
    });
    assert.equal(handoff.project?.project_id, project.project_id);
    assert.equal(handoff.project?.checkout_id, project.checkout_id);
    assert.equal(handoff.task_id, workerSessionId);
    const acceptedHandoff = await handoffs.accept(handoff.handoff_id, secondWorker);
    assert.equal(acceptedHandoff.state, 'ACCEPTED');
    const handoffContext = await handoffs.contextBlock(handoff.handoff_id);
    const secondAperture = createContextAperture({
      aperture_id: randomUUID(), project,
      source: { revision: sourceSha, branch: 'main', working_tree: 'CLEAN', observed_at: new Date().toISOString() },
      task_id: workerSessionId,
      objective: 'Independently inspect the prior result and its evidence references.',
      acceptance_criteria: ['Separate recorded facts from worker claims.'],
      included_files: [],
      destination_session_id: secondWorkerSessionId,
      destination: secondWorker,
      handoff_id: handoff.handoff_id,
      handoff_context: handoffContext.context_block
    });
    assert.equal(secondAperture.project.project_id, project.project_id);
    assert.equal(secondAperture.project.checkout_id, project.checkout_id);
    assert.equal(secondAperture.task_id, context.task_id);
    assert.notEqual(secondAperture.destination_session_id, context.destination_session_id);
    assert.notEqual(secondAperture.aperture_id, context.aperture_id);
    assert.notEqual(secondAperture.sha256, context.sha256);
    assert.equal(secondAperture.handoff_id, handoff.handoff_id);
    assert.match(secondAperture.content, /evidence refs/);
    assert.equal(secondAperture.content.includes(workerResultText), false);
    assert.deepEqual(secondAperture.allowed_capabilities, []);

    const secondRequestId = randomUUID();
    const secondCriteria = ['Separate recorded facts from worker claims.'];
    const secondRequest = {
      task: secondAperture.objective, mode: 'plan' as const, chat_source: 'local' as const, worker: secondWorker,
      client_request_id: secondRequestId, handoff_id: handoff.handoff_id,
      governed_execution: {
        capability_id: 'project.worker.execute.local' as const,
        worker_session_id: secondWorkerSessionId, task_id: workerSessionId,
        project, aperture_id: secondAperture.aperture_id, acceptance_criteria: secondCriteria, included_files: []
      }
    };
    const secondBinding = {
      worker_session_id: secondWorkerSessionId, principal_id: fixture.owner.id, parent_request_id: secondRequestId,
      task_id: workerSessionId, project, source_sha: sourceSha, working_tree: 'CLEAN' as const,
      capability_id: 'project.worker.execute.local' as const,
      route: { ...workerBinding.route }, aperture_id: secondAperture.aperture_id, aperture_sha256: secondAperture.sha256,
      authority_operation_id: null, resource_admission_ref: null, runtime_process_id: 4321,
      runtime_started_at: workerBinding.runtime_started_at, created_at: new Date().toISOString()
    };
    const secondStableBinding = withoutCreatedAt(secondBinding);
    const { source: secondSource, ...secondApertureRest } = withoutCreatedAt(secondAperture);
    const secondOperationInput = {
      workspace: root, taskId: workerSessionId, kind: 'agent.start',
      args: {
        route: 'POST /api/agent/start', body: secondRequest, agent_target: targetBinding,
        worker_binding: secondStableBinding,
        context_aperture: { ...secondApertureRest, source: { ...secondSource, observed_at: null } }
      }
    };
    const secondOperation = await fixture.authority.prepare(fixture.owner, secondOperationInput);
    await fixture.authority.decide(fixture.owner, secondOperation.operation_id, 'approve');
    pauseNextWorker = true;
    consumeNextHandoff = async () => { await handoffs.consume(handoff.handoff_id); };
    let signalSecondStarted!: () => void;
    const secondStarted = new Promise<void>(resolve => { signalSecondStarted = resolve; });
    notifyPausedWorkerStarted = signalSecondStarted;
    const secondStart = await fixture.authority.execute(fixture.owner, secondOperation.operation_id, secondOperationInput, (_, execution) => loop.start(
      secondRequest.task, 'plan', null, {
        execution, executionTarget: targetBinding, request: secondRequest, governedExecution: true,
        workerSessionId: secondWorkerSessionId, contextAperture: secondAperture, workerBinding: secondBinding,
        handoffContext: handoffContext.context_block
      }
    ));
    await secondStarted;
    assert.equal(loop.status(secondStart.session_id).worker_lifecycle, 'RUNNING');

    const cancelBody = { session_id: secondWorkerSessionId };
    const cancelInput = { workspace: root, taskId: secondWorkerSessionId, kind: 'agent.cancel', args: { body: cancelBody } };
    const cancelOperation = await fixture.authority.prepare(fixture.owner, cancelInput);
    await fixture.authority.decide(fixture.owner, cancelOperation.operation_id, 'approve');
    const cancelResult = await fixture.authority.execute(fixture.owner, cancelOperation.operation_id, cancelInput, (_, execution) =>
      loop.cancel(secondWorkerSessionId, execution)
    );
    assert.deepEqual(cancelResult, { ok: true, state: 'aborted' });
    assert.equal(loop.status(secondWorkerSessionId).worker_lifecycle, 'CANCELLED');
    const cancelledAttempt = await attemptJournal.get(secondStart.attempt_id!);
    assert.equal(cancelledAttempt?.state, 'ABORTED');
    assert.equal(cancelledAttempt?.events.some(item => item.event === 'WORKER_STOP_REQUESTED'), true);
    assert.equal(cancelledAttempt?.events.some(item => item.event === 'WORKER_CANCELLED'), true);
    assert.equal(cancelledAttempt?.events.some(item => item.event === 'WORKER_COMPLETED'), false);
    assert.equal((await handoffs.get(handoff.handoff_id)).state, 'CONSUMED');

    await assert.rejects(() => fixture.authority.execute(fixture.owner, operation.operation_id, operationInput, () => loop.start(request.task, 'plan', null, {})));

    const deniedSessionId = randomUUID();
    freeMemory = 3071;
    const deniedContext = aperture(deniedSessionId, project, {
      taskId: deniedSessionId, objective: 'Return a short context summary.', criteria: ['Do not claim unobserved work.'], included: ['README.md']
    });
    const deniedRequest = {
      ...request, client_request_id: randomUUID(), governed_execution: {
        ...request.governed_execution, worker_session_id: deniedSessionId, task_id: deniedSessionId, aperture_id: deniedContext.aperture_id
      }
    };
    const deniedBinding = { ...workerBinding, worker_session_id: deniedSessionId, parent_request_id: deniedSessionId, task_id: deniedSessionId,
      aperture_id: deniedContext.aperture_id, aperture_sha256: deniedContext.sha256 };
    const deniedStableBinding = withoutCreatedAt(deniedBinding);
    const { source: deniedSource, ...deniedApertureRest } = withoutCreatedAt(deniedContext);
    const deniedInput = {
      ...operationInput, taskId: 'governed-worker-denied', args: {
        ...operationInput.args, body: deniedRequest, worker_binding: deniedStableBinding,
        context_aperture: { ...deniedApertureRest, source: { ...deniedSource, observed_at: null } }
      }
    };
    const deniedOperation = await fixture.authority.prepare(fixture.owner, deniedInput);
    await fixture.authority.decide(fixture.owner, deniedOperation.operation_id, 'approve');
    await assert.rejects(() => fixture.authority.execute(fixture.owner, deniedOperation.operation_id, deniedInput, (_, execution) => loop.start(
      deniedRequest.task, 'plan', null, { execution, executionTarget: targetBinding, request: deniedRequest, governedExecution: true,
        workerSessionId: deniedSessionId, contextAperture: deniedContext, workerBinding: deniedBinding }
    )), /resource admission REFUSE_RESOURCE/);
    assert.equal(loop.list().some(item => item.session_id === deniedSessionId), false);
    const deniedAttempts = await attemptJournal.list(deniedSessionId);
    assert.equal(deniedAttempts.attempts[0]?.state, 'FAILED');
    assert.equal((await attemptJournal.get(deniedAttempts.attempts[0]!.attempt_id))?.envelope.resource_admission.decision, 'REFUSE_RESOURCE');
  } finally {
    fixture.authority.control.close();
    await fs.rm(root, { recursive: true, force: true });
  }
});
