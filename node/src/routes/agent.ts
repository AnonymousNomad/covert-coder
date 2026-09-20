import { type Route, type RouteContext, RouteError } from '../server.ts';
import {
  AgentStartRequest,
  AgentStartResponse,
  AgentDecisionRequest,
  AgentDecisionResponse,
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
  type AgentSubagentStatusT
} from '../../../common/contracts/agent.ts';
import { RouterError } from '../services/model-router.ts';
import { AuthorityError } from '../services/execution-authority.mjs';
import type { AgentLoopService as CanonicalAgentLoop } from '../services/agent-loop.mjs';
import type { ErrorCode } from '../../../common/errors.ts';
import type { WorkerHandoffEnvelopeT, WorkerDescriptorT } from '../../../common/contracts/worker-handoff.ts';

type AgentLoopService = {
  start: CanonicalAgentLoop['start'];
  decide: CanonicalAgentLoop['decide'];
  status(sessionId: string): unknown;
  list(): unknown[];
};

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
  resolveProviderChatFn?: (role: 'plan' | 'act') => ((messages: Array<{ role: string; content: string }>) => Promise<string>) | null;
  // Live worker-switch wiring (Wave 4): governed handoff reception + the
  // exact destination chat functions used for binding and one-shot consume.
  workerHandoff?: {
    get(id: string): Promise<WorkerHandoffEnvelopeT>;
    accept(id: string, to: WorkerDescriptorT): Promise<WorkerHandoffEnvelopeT>;
    contextBlock(id: string): Promise<{ context_block: string; approx_tokens: number }>;
    consume(id: string): Promise<WorkerHandoffEnvelopeT>;
  };
  resolveLocalChatFn?: () => Promise<(messages: Array<{ role: string; content: string }>) => Promise<string>>;
  providerTargetFor?: (role: 'plan' | 'act') => { provider: string; model: string } | null;
  // Wave 5A: authoritative server-side readiness admission. Production stacks
  // require a READY record bound to the exact request text before any session,
  // model call, provider egress, or filesystem effect. Handoff continuations
  // are exempt (they continue an already-admitted task with its own binding).
  intentReadiness?: {
    assertReadyForTask(readinessId: string, task: string): Promise<{ ok: true } | { ok: false; code: string; reason: string }>;
  };
  requireIntentReadiness?: boolean;
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
  return [
    { method: 'POST', path: '/api/agent/start', body: AgentStartRequest, response: AgentStartResponse, handler: wrap(async ({ body, execution }) => {
      const request = body as { task: string; mode?: 'plan' | 'act'; chat_source?: 'local' | 'provider'; handoff_id?: string; readiness_id?: string; architectEditor?: boolean; expertAdvisory?: boolean };
      // Authoritative readiness admission (Wave 5A). Runs BEFORE any side
      // effect: no session, no model, no egress, no filesystem, no authority
      // consumption. Fail-closed on every validation error.
      if (options.requireIntentReadiness === true && request.handoff_id === undefined) {
        if (request.readiness_id === undefined) {
          throw new RouteError('NOT_READY', 'READINESS_REQUIRED: material intent confirmation is required before starting a task');
        }
        const gate = options.intentReadiness;
        if (gate === undefined) {
          throw new RouteError('NOT_READY', 'READINESS_UNAVAILABLE: readiness validation is not wired on this stack');
        }
        let verdict: { ok: true } | { ok: false; code: string; reason: string };
        try {
          verdict = await gate.assertReadyForTask(request.readiness_id, request.task);
        } catch {
          throw new RouteError('NOT_READY', 'READINESS_UNAVAILABLE: readiness validation failed');
        }
        if (!verdict.ok) {
          throw new RouteError('CONFLICT', `INTENT_MISMATCH: ${verdict.reason}`);
        }
      }
      let chatFnOverride: ((messages: Array<{ role: string; content: string }>) => Promise<string>) | undefined;
      if (request.chat_source === 'provider') {
        if (!options.resolveProviderChatFn) throw new RouteError('NOT_READY', 'no provider resolver wired');
        const role = request.mode === 'plan' ? 'plan' as const : 'act' as const;
        let resolved: ((messages: Array<{ role: string; content: string }>) => Promise<string>) | null;
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
      // Governed worker-handoff reception (live worker switch). Binding is
      // verified against the session's ACTUAL destination worker before any
      // state changes; consumption happens exactly at the first destination
      // model invocation (wrapped below), never merely because a session
      // object exists.
      let handoffContext: string | undefined;
      const handoffId = (request as { handoff_id?: string }).handoff_id;
      if (handoffId !== undefined) {
        const wh = options.workerHandoff;
        if (!wh) throw new RouteError('NOT_READY', 'no worker handoff resolver wired');
        const role: 'plan' | 'act' = request.mode === 'plan' ? 'plan' : 'act';
        let envelope: WorkerHandoffEnvelopeT;
        try {
          envelope = await wh.get(handoffId);
        } catch (error) {
          const code = String((error as { code?: string }).code ?? '');
          throw new RouteError(code === 'NOT_FOUND' ? 'NOT_FOUND' : 'CONFLICT', String((error as Error).message).slice(0, 300));
        }
        let actual: WorkerDescriptorT;
        if (request.chat_source === 'provider') {
          const target = options.providerTargetFor ? options.providerTargetFor(role) : null;
          if (target === null) throw new RouteError('NOT_READY', 'no provider route is configured for this role');
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
        const roleMatches = envelope.to.role === actual.role
          || ((envelope.to.role === 'coder' || envelope.to.role === 'reviewer') && actual.role === 'act')
          || (envelope.to.role === 'planner' && actual.role === 'plan');
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
        if (request.chat_source !== 'provider') {
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
          chatFnOverride = async messages => {
            if (!consumed) {
              consumed = true;
              await wh.consume(handoffId).catch(() => undefined);
            }
            return inner(messages);
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
        chatFnOverride = async (messages) => {
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
                ]);
              }
            }
            return inner([{ role: 'system', content: block }, ...messages]);
          }
          return inner(messages);
        };
      }
      return service.start(request.task, request.mode ?? 'act', chatFnOverride, {
        execution, request: body,
        architectEditor: request.architectEditor === true,
        ...(handoffContext !== undefined ? { handoffContext } : {}),
        ...(options.resolveEffectiveContext ? { effectiveContextTokens: (await options.resolveEffectiveContext()) ?? null } : {})
      });
    }) },
    { method: 'POST', path: '/api/agent/decision', body: AgentDecisionRequest, response: AgentDecisionResponse, handler: wrap(async ({ body, execution }) => {
      const request = body as { session_id: string; approval_id: string; decision: 'approve' | 'reject' | 'abort' };
      return service.decide(request.session_id, request.approval_id, request.decision, execution);
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
