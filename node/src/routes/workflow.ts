// Workflow routes (Slice 7) — adapters only. They parse input, hand the
// request to the workflow service, and return the outcome. They never decide
// stage changes, never bypass the validator-backed gate, never call the
// execution authority directly, and never write state. The requested-
// transition audit row is journaled here — at the earliest route-visible point
// inside the approved execution, immediately before the mutation — and stays
// informational: status 'requested', never treated as applied (rebuild folds
// only 'applied' rows).
import { type Route, type RouteContext, RouteError } from '../server.ts';
import {
  WorkflowStateResponse,
  WorkflowCreateRequest,
  WorkflowCreateResponse,
  WorkflowTransitionRequest as TransitionRequestBody,
  WorkflowTransitionResponse
} from '../../../common/contracts/workflow-routes.ts';
import type { WorkflowTransitionRequestT as TransitionBodyT, WorkflowCreateRequestT } from '../../../common/contracts/workflow-routes.ts';
import type { WorkflowStateT, WorkflowTransitionRequestT } from '../../../common/contracts/workflow.ts';
import { WorkflowError, type GateEvaluation, type WorkflowService } from '../services/workflow-service.ts';
import type { AuditTrailService } from '../services/audit-trail.mjs';
import type { OperationInput } from '../../../common/security/operation-policy.mjs';

function toRouteError(error: unknown): RouteError {
  if (error instanceof RouteError) return error;
  if (error instanceof WorkflowError) {
    switch (error.code) {
      case 'NOT_FOUND': return new RouteError('NOT_FOUND', error.message);
      case 'CONFLICT': return new RouteError('CONFLICT', error.message);
      case 'INVALID': return new RouteError('BAD_REQUEST', error.message, error.detail ?? undefined);
      case 'AUDIT_FAILED': return new RouteError('CHILD_FAILED', error.message, error.detail ?? undefined);
      case 'GATE_UNSATISFIED': return new RouteError('CONFLICT', error.message, error.detail ?? undefined);
      default: return new RouteError('INTERNAL', error.message, error.detail ?? undefined);
    }
  }
  return error instanceof Error
    ? new RouteError('INTERNAL', error.message.slice(0, 500))
    : new RouteError('INTERNAL', 'workflow route failed');
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

function requestedRow(state: WorkflowStateT, request: WorkflowTransitionRequestT, operationId: string, gate: GateEvaluation, now: string) {
  return {
    type: 'workflow.transition' as const,
    ts: now,
    workspace: state.workspace,
    workflow_id: state.workflow_id,
    sequence: state.revision + 1,
    from_stage: request.from_stage,
    to_stage: request.to_stage,
    kind: request.kind,
    status: 'requested' as const,
    reason: request.reason ?? null,
    operation_id: operationId,
    actor_id: null,
    gate: { result: gate.result, failed: gate.failed },
    evidence: request.evidence.map(ref => ({ artifact_id: ref.artifact_id, artifact_type: ref.artifact_type, sha256: ref.sha256 })),
    error: null
  };
}

export function routesForWorkflow(options: { service: WorkflowService | null; audit: AuditTrailService; workspace: string }): Route[] {
  const requireService = (): WorkflowService => {
    if (!options.service) throw new RouteError('NOT_READY', 'workflow service requires execution authority');
    return options.service;
  };
  return [
    {
      method: 'GET',
      path: '/api/workflow/state',
      response: WorkflowStateResponse,
      handler: wrap(async () => {
        const service = requireService();
        return { state: await service.load() };
      })
    },
    {
      // Production creation boundary (wiring audit Wave 1): the smallest
      // legitimate caller of the canonical workflow service. Governed by the
      // existing workflow.create authority kind via a route-owned descriptor
      // (the approved operation binds the exact project_id). Refuses to
      // overwrite an existing workflow in this workspace.
      method: 'POST',
      path: '/api/workflow/create',
      body: WorkflowCreateRequest,
      response: WorkflowCreateResponse,
      describeOperation: async ({ body }, taskId): Promise<OperationInput> => {
        const parsed = WorkflowCreateRequest.parse(body);
        return { workspace: options.workspace, taskId, kind: 'workflow.create', args: { body: { project_id: parsed.project_id } } };
      },
      handler: wrap(async (ctx: RouteContext) => {
        const service = requireService();
        const execution = ctx.execution;
        if (!execution) throw new RouteError('NOT_READY', 'exact operation approval required', { reason: 'APPROVAL_REQUIRED' });
        const body = ctx.body as WorkflowCreateRequestT;
        const existing = await service.load();
        if (existing !== null) throw new RouteError('CONFLICT', 'a workflow already exists in this workspace');
        const created = await service.create(execution, { project_id: body.project_id });
        return { status: 'created' as const, state: created, operation_id: execution.operation_id };
      })
    },
    {
      method: 'POST',
      path: '/api/workflow/transition',
      body: TransitionRequestBody,
      response: WorkflowTransitionResponse,
      handler: wrap(async (ctx: RouteContext) => {
        const service = requireService();
        const execution = ctx.execution;
        if (!execution) throw new RouteError('NOT_READY', 'exact operation approval required', { reason: 'APPROVAL_REQUIRED' });
        const body = ctx.body as TransitionBodyT;
        const state = await service.load();
        if (state === null) throw new RouteError('NOT_FOUND', 'no workflow exists in this workspace');
        if (state.workflow_id !== body.workflow_id) throw new RouteError('CONFLICT', 'transition belongs to another workflow');
        if (state.stage !== body.from_stage) throw new RouteError('CONFLICT', 'workflow moved since this transition was requested');
        const built = service.buildTransitionRequest(state, {
          to_stage: body.to_stage,
          kind: body.kind,
          ...(body.reason !== undefined ? { reason: body.reason } : {}),
          requested_by: body.requested_by,
          evidence: body.evidence
        });
        if (!built.ok) throw new RouteError('BAD_REQUEST', 'transition is invalid', built.failed);
        const now = new Date().toISOString();
        const gate = await service.evaluateTransition(state, built.request);
        const requested = await options.audit.emitWorkflowTransition(requestedRow(state, built.request, execution.operation_id, gate, now));
        if (requested.persisted !== true) {
          throw new RouteError('CHILD_FAILED', `requested row was not persisted: ${requested.error ?? 'unknown error'}`);
        }
        try {
          const next = await service.applyTransition(execution, built.request);
          return { status: 'applied' as const, gate: { result: 'satisfied' as const, failed: [] as string[] }, state: next, operation_id: execution.operation_id };
        } catch (error) {
          if (error instanceof WorkflowError && error.code === 'GATE_UNSATISFIED') {
            const failed = Array.isArray(error.detail) ? (error.detail as string[]) : gate.failed;
            return { status: 'rejected' as const, gate: { result: 'unsatisfied' as const, failed }, state, operation_id: execution.operation_id };
          }
          throw error;
        }
      })
    }
  ];
}
