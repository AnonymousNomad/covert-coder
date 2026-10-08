import { type Route, type RouteContext, RouteError } from '../server.ts';
import {
  AgentStartRequest,
  AgentStartResponse,
  AgentDecisionRequest,
  AgentDecisionResponse,
  AgentCancelRequest,
  AgentCancelResponse,
  AgentStatusQuery,
  AgentStatusResponse,
  AgentSessionsListResponse,
  AgentToolInvokeRequest,
  AgentToolObservation,
  AgentSubagentSpawnRequest,
  AgentSubagentSpawnResponse,
  AgentSubagentListResponse,
  AgentSubagentStatus,
  AgentSubagentStatusQuery,
  type AgentSubagentSpawnRequestT,
  type AgentSubagentStatusT,
  type AgentStartRequestT
} from '../../../common/contracts/agent.ts';
import { RouterError, ChatTargetChangedError, type ModelRouter, type ResolvedChatAuthorityTarget } from '../services/model-router.ts';
import { AuthorityError } from '../services/execution-authority.mjs';
import type { AgentLoopService as CanonicalAgentLoop, AgentChatFn } from '../services/agent-loop.mjs';
import type { ErrorCode } from '../../../common/errors.ts';
import type { WorkerHandoffEnvelopeT, WorkerDescriptorT } from '../../../common/contracts/worker-handoff.ts';
import type { ProjectSeat } from '../services/project-seat.ts';
import type { ModelManagerResponseT } from '../../../common/contracts/model-access.ts';
import type { RuntimeStatusResponseT } from '../../../common/contracts/runtime.ts';
import type { ContextApertureT } from '../../../common/contracts/context-aperture.ts';
import type { ExecutionEnvelopeT } from '../../../common/contracts/attempt.ts';
import { createContextAperture } from '../services/context-aperture.ts';
import { redactSecrets } from '../services/attempt-journal.ts';

type AgentLoopService = {
  start: CanonicalAgentLoop['start'];
  decide: CanonicalAgentLoop['decide'];
  cancel: CanonicalAgentLoop['cancel'];
  status(sessionId: string): unknown;
  list(): unknown[];
  readonly rootAbs: string;
};

function withoutCreatedAt<T extends { created_at: string }>(value: T): Omit<T, 'created_at'> {
  return Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'created_at')) as Omit<T, 'created_at'>;
}

// Subagent dispatch service (aide-subagent-dispatch skill, PR A wiring).
// PR A defines the route surface; PR B fills in the runtime that calls
// agent-loop.mjs. Until then, spawn() returns NOT_READY so the route
// contract is live and discoverable.
type AgentSubagentService = {
  spawn(request: AgentSubagentSpawnRequestT): Promise<{ child_session_id: string; status: 'spawned' | 'running' }>;
  list(parentSessionId?: string): AgentSubagentStatusT[];
  status(childSessionId: string): AgentSubagentStatusT | null;
};

function toRouteError(error: unknown): RouteError {
  if (error instanceof AuthorityError) return new RouteError(error.code as ErrorCode, error.message, error.detail);
  if (error instanceof RouteError) return error;
  if (error instanceof ChatTargetChangedError) return new RouteError('CONFLICT', error.message);
  if (error instanceof RouterError) return new RouteError('NOT_READY', error.message);
  const code = (error as { code?: string })?.code;
  const message = String((error as Error)?.message ?? error).slice(0, 500);
  if (code === 'SESSION_NOT_FOUND') return new RouteError('NOT_FOUND', message);
  if (code === 'FORBIDDEN') return new RouteError('FORBIDDEN', message);
  if (code === 'VALIDATION' || code === 'NOT_AWAITING') return new RouteError('BAD_REQUEST', message);
  if (error instanceof Error && error.name === 'NOT_READY') return new RouteError('NOT_READY', message);
  return new RouteError('CHILD_FAILED', message);
}

function wrap(handler: (ctx: RouteContext) => Promise<unknown> | unknown): (ctx: RouteContext) => Promise<unknown> {
  return async (ctx: RouteContext) => {
    try {
      return await handler(ctx);
    } catch (error) {
      throw toRouteError(error);
    }
  };
}

export function routesForAgent(service: AgentLoopService, options: {
  // Production supplies the canonical router. Controlled injected loops may
  // retain the legacy callback seam; that seam is not model qualification.
  exactWorker?: {
    workspace: string;
    router: Pick<ModelRouter, 'resolveAuthorityTarget' | 'chatStreamResolvedTarget'>;
    effectiveContext?: (target: ResolvedChatAuthorityTarget) => number | null;
  };
  projectSeat?: ProjectSeat;
  captureSource?: () => Promise<{ revision: string | null; branch: string | null; working_tree: 'CLEAN' | 'DIRTY' | 'UNKNOWN'; included_files?: string[] }>;
  modelManagerSnapshot?: () => Promise<ModelManagerResponseT>;
  runtimeSnapshot?: () => Promise<RuntimeStatusResponseT | null>;
  resolveProviderChatFn?: (role: 'planner' | 'coder' | 'reviewer') => ((messages: Array<{ role: string; content: string }>, signal?: AbortSignal) => Promise<string>) | null;
  // Live worker-switch wiring (Wave 3/4 reconciliation): governed handoff
  // reception + the exact destination chat functions used for binding and
  // one-shot consume.
  workerHandoff?: {
    get(id: string): Promise<WorkerHandoffEnvelopeT>;
    accept(id: string, to: WorkerDescriptorT): Promise<WorkerHandoffEnvelopeT>;
    contextBlock(id: string): Promise<{ context_block: string; approx_tokens: number }>;
    consume(id: string): Promise<WorkerHandoffEnvelopeT>;
  };
  resolveLocalChatFn?: () => Promise<(messages: Array<{ role: string; content: string }>, signal?: AbortSignal) => Promise<string>>;
  providerTargetFor?: (role: 'planner' | 'coder' | 'reviewer') => { provider: string; model: string } | null;
  dispatchTool?: (name: string, args: Record<string, string>, opts: { sandbox?: string }) => Promise<{ ok: boolean; output: string; terminal?: boolean }>;
  // Expert advisory: when set, the route layer consults this micro-expert
  // (e.g. task-router) BEFORE the main model call and prepends the result
  // to the system prompt. Per aide-micro-expert-collective + the
  // Veritas hierarchy unchanged rule: ADVISORY only, never blocks.
  // (aide-subagent-dispatch PR A wires this for the expert inference; PR B
  // is the agent-loop runtime.)
  consultExpert?: (task: string) => Promise<{ expert: string; phase: string; confidence: number } | null>;
  // Effective-context tier resolver (harness/scaffold.mjs micro/compact/full).
  // Returns the served context tokens of the model that will handle this
  // session, or null (unknown -> legacy full prompt). Contributes to THE QUAD
  // Law #1 (single discipline source threaded per served context) and the
  // collaborator finding that the micro tier never reached the live loop.
  resolveEffectiveContext?: () => Promise<number | null>;
} = {}): Route[] {
  const targets = new WeakMap<RouteContext, ResolvedChatAuthorityTarget>();
  const governed = new WeakMap<RouteContext, {
    request: AgentStartRequestT;
    aperture: ContextApertureT;
    binding: NonNullable<ExecutionEnvelopeT['worker_binding']>;
  }>();
  const prepareGoverned = async (context: RouteContext, request: AgentStartRequestT, target: ResolvedChatAuthorityTarget) => {
    const input = request.governed_execution;
    if (!input) return null;
    if (!context.actor || context.actor.kind !== 'operator' || !context.actor.id) {
      throw new RouteError('FORBIDDEN', 'governed local worker execution requires an authenticated operator principal');
    }
    if (!options.projectSeat || !options.captureSource || !options.modelManagerSnapshot || !options.runtimeSnapshot) {
      throw new RouteError('NOT_READY', 'canonical project, source, model qualification, or runtime observation is unavailable');
    }
    if (target.binding.execution_class !== 'LOCAL' || target.route.providerType !== 'local') {
      throw new RouteError('FORBIDDEN', 'governed worker execution is local-only; no external fallback is permitted');
    }
    if ((request.mode ?? 'act') !== 'plan' || request.worker?.role !== 'planner' || request.chat_source !== 'local' ||
        request.expertAdvisory === true || request.architectEditor === true) {
      throw new RouteError('FORBIDDEN', 'Wave 1 requires a local plan worker with no expert or editor context');
    }
    if (request.worker?.worker !== target.binding.route_id || request.worker.provider !== 'local' || request.worker.model !== target.binding.model_id) {
      throw new RouteError('FORBIDDEN', 'local worker descriptor does not match the exact resolved route');
    }

    let currentProject;
    try {
      currentProject = await options.projectSeat.current();
      await options.projectSeat.assertAddress(input.project);
    } catch (error) {
      throw new RouteError('CONFLICT', `project/checkout binding is stale or mismatched: ${String((error as Error)?.message ?? error).slice(0, 240)}`);
    }
    if (input.project.project_id !== currentProject.project_id || input.project.checkout_id !== currentProject.checkout_id) {
      throw new RouteError('FORBIDDEN', 'worker request project and checkout must match the current ProjectSeat');
    }
    if (request.handoff_id === undefined && input.task_id !== input.worker_session_id) {
      throw new RouteError('BAD_REQUEST', 'the first governed worker session uses its session UUID as the durable handoff task identity');
    }
    const source = await options.captureSource();
    if (source.revision === null || !/^[a-f0-9]{40,64}$/i.test(source.revision) || source.working_tree === 'UNKNOWN') {
      throw new RouteError('NOT_READY', 'a current Git source revision and working-tree observation are required');
    }

    const manager = await options.modelManagerSnapshot();
    const modelId = target.binding.canonical_model_id ?? target.binding.model_id;
    const model = manager.models.find(item => item.identity.canonical_id === modelId);
    const basis = model?.identity.qualification.basis;
    if (!model || model.readiness !== 'READY' || model.identity.qualification.state !== 'QUALIFIED' || !basis ||
        basis.artifact_sha256 === null || basis.runtime_id === null || basis.runtime_version === null) {
      throw new RouteError('NOT_READY', 'selected local route is not exactly qualified in Model Manager');
    }
    const artifact = manager.artifacts.find(item => model.artifact_ids.includes(item.id) &&
      item.hash_status === 'VERIFIED' && item.observed_sha256 === basis.artifact_sha256);
    const adapter = target.binding.execution_adapter_id
      ? manager.execution_adapters.find(item => item.id === target.binding.execution_adapter_id)
      : manager.execution_adapters.find(item => item.kind === 'LOCAL_RUNTIME' && item.implementation === 'IMPLEMENTED' && item.configured && item.available);
    const runtime = await options.runtimeSnapshot();
    if (!artifact || !adapter || !runtime || runtime.health !== 'HEALTHY' || runtime.pid === null ||
        runtime.loaded_model === null || runtime.loaded_model.model_id !== target.binding.model_id ||
        runtime.loaded_model.artifact_sha256 !== basis.artifact_sha256 || runtime.version !== basis.runtime_version ||
        !adapter.available || adapter.implementation !== 'IMPLEMENTED') {
      throw new RouteError('NOT_READY', 'selected local route, verified artifact, qualified runtime, or live process identity no longer matches');
    }
    if (target.binding.model_access_route_id !== undefined) {
      const route = manager.routes.find(item => item.id === target.binding.model_access_route_id);
      if (!route || !route.available || route.model_support_state !== 'VERIFIED' || route.execution_adapter_id !== adapter.id) {
        throw new RouteError('NOT_READY', 'selected Model Access route is unavailable or does not match its qualified adapter');
      }
    }

    const normalizedRequest: AgentStartRequestT = {
      ...request,
      task: redactSecrets(request.task),
      governed_execution: {
        ...input,
        acceptance_criteria: input.acceptance_criteria.map(item => redactSecrets(item)),
        ...(input.included_files === undefined ? {} : { included_files: input.included_files.map(item => redactSecrets(item)) })
      }
    };
    let handoffContext: string | null = null;
    if (request.handoff_id !== undefined) {
      if (!options.workerHandoff) throw new RouteError('NOT_READY', 'canonical worker handoff service is unavailable');
      let handoff: WorkerHandoffEnvelopeT;
      let contextBlock: Awaited<ReturnType<NonNullable<typeof options.workerHandoff>['contextBlock']>>;
      try {
        handoff = await options.workerHandoff.get(request.handoff_id);
        if (handoff.state !== 'CREATED' && handoff.state !== 'ACCEPTED') throw new Error(`handoff is ${handoff.state}`);
        if (handoff.task_id !== input.task_id || handoff.project_id !== input.project.project_id ||
            !handoff.project || handoff.project.project_id !== input.project.project_id || handoff.project.checkout_id !== input.project.checkout_id ||
            handoff.to.worker !== request.worker!.worker || handoff.to.provider !== request.worker!.provider || handoff.to.model !== request.worker!.model ||
            handoff.to.role !== request.worker!.role) {
          throw new Error('handoff project, task, or destination does not match the requested aperture');
        }
        contextBlock = await options.workerHandoff.contextBlock(request.handoff_id);
      } catch (error) {
        throw new RouteError('CONFLICT', `handoff continuity is unavailable or mismatched: ${String((error as Error)?.message ?? error).slice(0, 240)}`);
      }
      handoffContext = contextBlock.context_block;
    }
    const aperture = createContextAperture({
      aperture_id: input.aperture_id,
      project: input.project,
      source: { ...source, observed_at: new Date().toISOString() },
      task_id: input.task_id,
      objective: normalizedRequest.task,
      acceptance_criteria: normalizedRequest.governed_execution!.acceptance_criteria,
      included_files: normalizedRequest.governed_execution!.included_files ?? [],
      destination: request.worker!,
      destination_session_id: input.worker_session_id,
      handoff_id: request.handoff_id ?? null,
      handoff_context: handoffContext,
      created_at: new Date().toISOString()
    });
    const binding: NonNullable<ExecutionEnvelopeT['worker_binding']> = {
      worker_session_id: input.worker_session_id,
      principal_id: context.actor.id,
      parent_request_id: request.client_request_id ?? input.worker_session_id,
      task_id: input.task_id,
      project: input.project,
      source_sha: source.revision,
      working_tree: source.working_tree as 'CLEAN' | 'DIRTY',
      capability_id: input.capability_id,
      route: {
        route_id: target.binding.route_id,
        model_id: target.binding.model_id,
        provider_id: target.binding.provider_id ?? null,
        provider_model: target.binding.provider_model ?? null,
        adapter_id: adapter.id,
        artifact_sha256: basis.artifact_sha256,
        runtime_id: basis.runtime_id,
        runtime_version: basis.runtime_version,
        target_revision: target.binding.target_revision
      },
      aperture_id: aperture.aperture_id,
      aperture_sha256: aperture.sha256,
      authority_operation_id: null,
      resource_admission_ref: null,
      runtime_process_id: runtime.pid,
      runtime_started_at: runtime.started_at,
      created_at: new Date().toISOString()
    };
    return { request: normalizedRequest, aperture, binding };
  };
  const describeOperation: NonNullable<Route['describeOperation']> = async (context, taskId) => {
    const request = context.body as AgentStartRequestT;
    if (!options.exactWorker) {
      if (request.governed_execution) throw new RouteError('NOT_READY', 'governed local execution requires the canonical ModelRouter');
      return { workspace: service.rootAbs, taskId, kind: 'agent.start', args: { route: 'POST /api/agent/start', body: request } };
    }
    const worker = request.worker;
    if (!worker) throw new RouteError('NOT_READY', 'an exact worker is required; select a configured model in Model Access');
    const resolution = await options.exactWorker.router.resolveAuthorityTarget(worker.worker);
    if (resolution.status !== 'RESOLVED') throw new RouteError('NOT_READY', `exact agent worker is unresolved (${resolution.reason})`);
    const target = resolution.target;
    const binding = target.binding;
    const external = binding.execution_class === 'EXTERNAL';
    if (!external && binding.execution_class !== 'LOCAL') throw new RouteError('FORBIDDEN', 'agent target has no registered execution class');
    const mode = request.mode ?? 'act';
    const roleMatches = worker.role === mode || (mode === 'plan' ? worker.role === 'planner' : worker.role === 'coder' || worker.role === 'reviewer');
    if (worker.worker !== binding.route_id || worker.provider !== (external ? binding.provider_id : 'local') ||
        worker.model !== (external ? binding.provider_model : binding.model_id) || !roleMatches ||
        (request.role !== undefined && request.role !== worker.role) ||
        (request.chat_source !== undefined && request.chat_source !== (external ? 'provider' : 'local'))) {
      throw new RouteError('FORBIDDEN', 'requested worker does not match the exact resolved agent target');
    }
    targets.set(context, target);
    const prepared = await prepareGoverned(context, request, target);
    if (prepared) {
      governed.set(context, prepared);
      const stableBinding = withoutCreatedAt(prepared.binding);
      const { source: apertureSource, ...apertureRest } = withoutCreatedAt(prepared.aperture);
      return {
        workspace: options.exactWorker.workspace,
        taskId,
        kind: 'agent.start',
        args: {
          route: 'POST /api/agent/start',
          body: prepared.request,
          agent_target: binding,
          worker_binding: stableBinding,
          context_aperture: { ...apertureRest, source: { ...apertureSource, observed_at: null } }
        }
      };
    }
    return { workspace: options.exactWorker.workspace, taskId, kind: external ? 'agent.start.external' : 'agent.start',
      args: { route: 'POST /api/agent/start', body: request, agent_target: binding } };
  };
  return [
    { method: 'POST', path: '/api/agent/start', body: AgentStartRequest, response: AgentStartResponse,
      capabilityPolicy: { owner: 'AgentLoop', operation: 'agent.start' }, describeOperation, handler: wrap(async context => {
      const { body, execution } = context;
      const rawRequest = body as AgentStartRequestT;
      const prepared = governed.get(context);
      const request = prepared?.request ?? rawRequest;
      const target = targets.get(context);
      let chatFnOverride: AgentChatFn | undefined;
      if (options.exactWorker) {
        if (execution === undefined || target === undefined) throw new RouteError('FORBIDDEN', 'Authority-resolved agent target is required');
        const router = options.exactWorker.router;
        chatFnOverride = async (messages, signal, observations) => {
          let observedOutput = false;
          let runningObservation: Promise<void> | null = null;
          const { onWorkerRunning, ...dispatchObservers } = observations ?? {};
          let result: Awaited<ReturnType<typeof router.chatStreamResolvedTarget>> | null = null;
          let streamFailed = false;
          let streamError: unknown;
          try {
            result = await router.chatStreamResolvedTarget(target,
              messages.map(message => ({ role: message.role as 'system' | 'user' | 'assistant', content: message.content })),
              delta => {
                if (prepared && delta.length > 0 && !observedOutput) {
                  observedOutput = true;
                  runningObservation = onWorkerRunning?.() ?? Promise.resolve();
                }
              }, signal ?? new AbortController().signal, dispatchObservers);
          } catch (error) {
            streamFailed = true;
            streamError = error;
          }
          let observationError: unknown;
          if (runningObservation !== null) {
            try { await runningObservation; }
            catch (error) { observationError = error; }
          }
          if (streamFailed) throw streamError;
          if (observationError !== undefined) throw observationError;
          if (result === null) throw new RouteError('CHILD_FAILED', 'local runtime returned no stream result');
          if (prepared && !observedOutput) throw new RouteError('CHILD_FAILED', 'local runtime returned without observable generated output');
          if (result.modelId !== target.binding.route_id) throw new RouteError('CONFLICT', 'agent dispatch returned a different model identity');
          return result.text;
        };
      } else if (request.chat_source === 'provider') {
        if (!options.resolveProviderChatFn) throw new RouteError('NOT_READY', 'no provider resolver wired');
        const requestedRole = request.worker?.role;
        const role = requestedRole === 'planner' || requestedRole === 'coder' || requestedRole === 'reviewer'
          ? requestedRole
          : request.mode === 'plan' ? 'planner' as const : 'coder' as const;
        let resolved: ((messages: Array<{ role: string; content: string }>, signal?: AbortSignal) => Promise<string>) | null;
        try {
          resolved = options.resolveProviderChatFn(role);
        } catch (error) {
          const code = (error as { code?: string })?.code;
          if (code === 'FORBIDDEN') throw new RouteError('FORBIDDEN', String((error as Error).message).slice(0, 200));
          throw new RouteError('CHILD_FAILED', String((error as Error)?.message ?? error).slice(0, 200));
        }
        if (!resolved) throw new RouteError('NOT_READY', `no provider chat available for role ${role}`);
        chatFnOverride = resolved;
      }
      // Governed worker-handoff reception (reconciled Wave 3/4): binding is
      // verified against the session's ACTUAL destination worker before any
      // state changes; consumption happens exactly at the first destination
      // model invocation (wrapped below), never merely because a session
      // object exists.
      let handoffContext: string | undefined;
      const handoffId = (request as { handoff_id?: string }).handoff_id;
      if (handoffId !== undefined) {
        const wh = options.workerHandoff;
        if (!wh) throw new RouteError('NOT_READY', 'no worker handoff resolver wired');
        const requestedRole = request.worker?.role;
        const role: 'planner' | 'coder' | 'reviewer' = requestedRole === 'planner' || requestedRole === 'coder' || requestedRole === 'reviewer'
          ? requestedRole
          : request.mode === 'plan' ? 'planner' : 'coder';
        let envelope: WorkerHandoffEnvelopeT;
        try {
          envelope = await wh.get(handoffId);
        } catch (error) {
          const code = String((error as { code?: string }).code ?? '');
          throw new RouteError(code === 'NOT_FOUND' ? 'NOT_FOUND' : 'CONFLICT', String((error as Error).message).slice(0, 300));
        }
        let actual: WorkerDescriptorT;
        const canonicalWorkerRole = (workerRole: WorkerDescriptorT['role']) => workerRole === 'plan' ? 'planner' : workerRole === 'act' ? 'coder' : workerRole;
        if (target !== undefined) {
          actual = request.worker!;
        } else if (request.chat_source === 'provider') {
          const target = options.providerTargetFor ? options.providerTargetFor(role) : null;
          if (target === null) throw new RouteError('NOT_READY', 'no provider route is configured for this role');
          const requested = request.worker;
          if (requested !== undefined && (
            requested.worker !== `cloud:${target.provider}:${target.model}` ||
            requested.provider !== target.provider || requested.model !== target.model ||
            canonicalWorkerRole(requested.role) !== role
          )) {
            throw new RouteError('CONFLICT', 'requested worker does not match the configured exact role target');
          }
          actual = { worker: `cloud:${target.provider}:${target.model}`, provider: target.provider, model: target.model, role };
        } else {
          const requested = (request as { worker?: WorkerDescriptorT }).worker;
          const model = requested?.model ?? 'auto';
          actual = { worker: `local:${model}`, provider: 'local', model, role };
        }
        // Role-family binding: the handoff's role vocabulary (planner/coder/
        // reviewer) maps deterministically onto the session's execution mode
        // (plan/act); exact matches always bind. Role change never grants
        // authority — the session's own approvals still gate every action.
        const roleMatches = canonicalWorkerRole(envelope.to.role) === canonicalWorkerRole(actual.role);
        const bindingOk = envelope.to.provider === actual.provider
          && roleMatches
          && (envelope.to.model === actual.model || (actual.provider === 'local' && envelope.to.model === 'auto'));
        if (!bindingOk) {
          throw new RouteError('CONFLICT', 'handoff destination does not match this worker');
        }
        try {
          await wh.accept(handoffId, envelope.to);
          const reconstructed = await wh.contextBlock(handoffId);
          handoffContext = reconstructed.context_block;
        } catch (error) {
          throw new RouteError('CONFLICT', String((error as Error).message).slice(0, 300));
        }
        if (target === undefined && request.chat_source !== 'provider') {
          if (!options.resolveLocalChatFn) throw new RouteError('NOT_READY', 'no local chat resolver wired');
          try {
            chatFnOverride = await options.resolveLocalChatFn();
          } catch (error) {
            throw new RouteError('NOT_READY', String((error as Error)?.message ?? error).slice(0, 300));
          }
        }
        const inner = chatFnOverride ?? null;
        if (inner !== null) {
          let consumed = false;
          chatFnOverride = async (messages, signal, observations) => {
            signal?.throwIfAborted();
            if (!consumed) {
              await wh.consume(handoffId);
              consumed = true;
            }
            signal?.throwIfAborted();
            return inner(messages, signal, observations);
          };
        }
      }
      // Expert advisory (aide-micro-expert-collective skill, audit Week 1
      // item #7): when expertAdvisory:true AND the chat_source is 'local'
      // (we have a local chat to wrap), consult the task-router micro-expert
      // BEFORE the main call and prepend the result to the system prompt.
      // Non-blocking: 200ms timeout; failures are silent. The main model
      // sees the advisory as a system-prompt block; if the expert is
      // missing/slow, the main call proceeds unchanged.
      if (request.expertAdvisory && options.consultExpert && chatFnOverride) {
        const inner = chatFnOverride;
        chatFnOverride = async (messages, signal, observations) => {
          let advisory: { expert: string; phase: string; confidence: number } | null = null;
          try {
            const ac = new AbortController();
            const timer = setTimeout(() => ac.abort(), 200);
            // extract user task: take the last user message content as the input
            const lastUser = [...messages].reverse().find(m => m.role === 'user');
            const taskForExpert = lastUser?.content ?? '';
            advisory = await Promise.race([
              options.consultExpert!(taskForExpert),
              new Promise<null>((resolve) => { ac.signal.addEventListener('abort', () => resolve(null)); })
            ]);
            clearTimeout(timer);
          } catch { /* silent: never block on the expert */ }
          if (advisory && advisory.expert) {
            const block = `[EXPERT ADVISORY]\nroute: ${advisory.phase}\nexpert: ${advisory.expert}\nconfidence: ${advisory.confidence.toFixed(3)}\n[END ADVISORY]\n\n`;
            // prepend the advisory to the existing system message in place
            // (preserves the original message order). The findIndex + guard
            // handles the noUncheckedIndexedAccess narrowing cleanly.
            const sysIdx = messages.findIndex(m => m.role === 'system');
            if (sysIdx >= 0) {
              const sysMsg = messages[sysIdx];
              if (sysMsg) {
                return inner([
                  ...messages.slice(0, sysIdx),
                  { ...sysMsg, content: block + sysMsg.content },
                  ...messages.slice(sysIdx + 1)
                ], signal, observations);
              }
            }
            return inner([{ role: 'system', content: block }, ...messages], signal, observations);
          }
          return inner(messages, signal, observations);
        };
      }
      return service.start(request.task, request.mode ?? 'act', chatFnOverride, {
        execution, request: prepared?.request ?? body,
        ...(target !== undefined ? { executionTarget: target.binding } : {}),
        ...(prepared === undefined ? {} : {
          governedExecution: true,
          workerSessionId: prepared.binding.worker_session_id,
          contextAperture: prepared.aperture,
          workerBinding: prepared.binding
        }),
        architectEditor: request.architectEditor === true,
        // Role projection: an explicit role drives role-aware context
        // retrieval; otherwise the mode default applies (plan->planner,
        // act->coder) inside the loop.
        ...((body as { role?: string }).role !== undefined ? { role: String((body as { role?: string }).role) } : {}),
        ...(handoffContext !== undefined ? { handoffContext } : {}),
        ...(target !== undefined ? { effectiveContextTokens: options.exactWorker?.effectiveContext?.(target) ?? target.route.contextLength }
          : options.resolveEffectiveContext ? { effectiveContextTokens: (await options.resolveEffectiveContext()) ?? null } : {})
      });
    }) },
    { method: 'POST', path: '/api/agent/decision', body: AgentDecisionRequest, response: AgentDecisionResponse, handler: wrap(async ({ body, execution }) => {
      const request = body as { session_id: string; approval_id: string; decision: 'approve' | 'reject' | 'abort' };
      return service.decide(request.session_id, request.approval_id, request.decision, execution);
    }) },
    { method: 'POST', path: '/api/agent/cancel', body: AgentCancelRequest, response: AgentCancelResponse, handler: wrap(async ({ body, execution }) => {
      const request = body as { session_id: string };
      return service.cancel(request.session_id, execution);
    }) },
    { method: 'GET', path: '/api/agent/sessions', response: AgentSessionsListResponse, handler: wrap(async () => {
      return { sessions: service.list() };
    }) },
    { method: 'GET', path: '/api/agent/status', query: AgentStatusQuery, response: AgentStatusResponse, handler: wrap(async ({ query }: RouteContext) => {
      return service.status((query as { id: string }).id);
    }) },
    { method: 'POST', path: '/api/agent/tool', body: AgentToolInvokeRequest, response: AgentToolObservation, handler: wrap(async ({ body }) => {
      if (!options.dispatchTool) throw new RouteError('NOT_READY', 'tool dispatch is not wired on this instance');
      // approved is a legacy input, not trusted session authority. The
      // dispatcher denies direct mutation regardless of that field's value.
      const request = body as { name: string; arguments?: Record<string, string>; sandbox?: string };
      const opts = request.sandbox !== undefined ? { sandbox: request.sandbox } : {};
      return options.dispatchTool(request.name, request.arguments ?? {}, opts);
    }) }
  ];
}

// Subagent dispatch routes (aide-subagent-dispatch skill, PR A wiring).
// The contract surface is live: spawn / list / status. The runtime that
// fulfills spawn() lands in PR B (modifies agent-loop.mjs to dispatch
// subagent_spawn via the new tool type). Until PR B is wired, all three
// routes return NOT_READY with a clear "subagent dispatch not wired on
// this instance" message. The contracts ARE the wire-in (per the skill's
// design): the route surface is discoverable, type-checked, and tested
// before the runtime exists.
//
// Threat matrix covered by the tests/arch/agent-subagent.test.ts:
//  1. spawn() with valid body returns NOT_READY (PR A); PR B swaps to child_id
//  2. spawn() with invalid body returns 400 BAD_REQUEST
//  3. list() with no parent_session_id returns []
//  4. list() with parent_session_id returns parent's children (PR B)
//  5. status() with unknown child_session_id returns 404 NOT_FOUND
//  6. status() with known child returns the AgentSubagentStatus (PR B)
export function routesForAgentSubagent(subagentService: AgentSubagentService | null): Route[] {
  return [
    { method: 'POST', path: '/api/agent/subagent', body: AgentSubagentSpawnRequest, response: AgentSubagentSpawnResponse, handler: wrap(async ({ body }) => {
      if (!subagentService) {
        throw new RouteError('NOT_READY', 'subagent dispatch not wired on this instance (PR A: contracts live, runtime in PR B of aide-subagent-dispatch)');
      }
      const request = body as AgentSubagentSpawnRequestT;
      return subagentService.spawn(request);
    }) },
    { method: 'GET', path: '/api/agent/subagent', response: AgentSubagentListResponse, handler: wrap(async ({ query }: RouteContext) => {
      if (!subagentService) {
        return { subagents: [] };
      }
      const parentSessionId = (query as { parent_session_id?: string }).parent_session_id;
      return { subagents: subagentService.list(parentSessionId) };
    }) },
    { method: 'GET', path: '/api/agent/subagent/status', query: AgentSubagentStatusQuery, response: AgentSubagentStatus, handler: wrap(async ({ query }: RouteContext) => {
      const childId = (query as { child_session_id: string }).child_session_id;
      if (!subagentService) {
        throw new RouteError('NOT_READY', 'subagent dispatch not wired on this instance');
      }
      const status = subagentService.status(childId);
      if (!status) throw new RouteError('NOT_FOUND', `unknown child session: ${childId}`);
      return status;
    }) }
  ];
}
