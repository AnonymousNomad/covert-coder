// node/src/routes/setup.ts
//
// Resident Adaptive Setup (Gate #2) routes.
//
// Contract surface (all /api/setup/*):
//   GET    /api/setup/profile     -> persisted setup profile or null (read-only)
//   PUT    /api/setup/profile     -> apply the exact approved profile body
//   DELETE /api/setup/profile     -> reset to unconfigured (governed)
//   GET    /api/setup/plan        -> compose a configuration plan from answers
//                                    + live probes (read-only)
//   GET    /api/setup/readiness   -> recompute WORKSPACE READY evidence
//
// Governance: every mutation is a governed capability.write bound to the exact
// approved body (profile + optimistic expectedUpdatedAt anchor). The handler
// resolves the approved body from the authority's own operation record and lets
// the service enforce the durable compare-vs-write critical section.

import { RouteError, type Route, type RouteContext } from '../server.ts';
import type { OperationInput } from '../../../common/security/operation-policy.mjs';
import {
  SetupAnswers,
  SetupPlanQuery,
  SetupPlanResponse,
  SetupProfilePutRequest,
  SetupProfileResetRequest,
  SetupProfileResponse,
  SetupReadinessResponse,
  type SetupPlanResponseT,
  type SetupProfilePutRequestT,
  type SetupProfileResetRequestT,
  type SetupProfileResponseT,
  type SetupReadinessResponseT
} from '../../../common/contracts/setup.ts';
import { SetupConflictError, createSetupService } from '../services/setup-service.ts';

export type SetupService = ReturnType<typeof createSetupService>;

function writeOperation(workspace: string, taskId: string, argsBody: Record<string, unknown>): OperationInput {
  return { workspace, taskId, kind: 'capability.write', args: { body: argsBody } };
}

// The exact normalized body of the operation ExecutionAuthority approved. Read
// from the authority's immutable operation record via the execution handle the
// server placed on the route context; never re-derived from a fresh read.
function approvedSetupBody(context: RouteContext): SetupProfilePutRequestT | SetupProfileResetRequestT {
  const { authority, actor, execution } = context;
  if (!authority || !actor || !execution) throw new RouteError('FORBIDDEN', 'trusted execution context required');
  const operation = authority.inspect(actor, execution.operation_id);
  const body = (operation.args as { body?: unknown } | undefined)?.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new RouteError('CONFLICT', 'approved setup binding unavailable');
  }
  return body as SetupProfilePutRequestT | SetupProfileResetRequestT;
}

function rethrowSetupError(error: unknown, operation: string): never {
  if (error instanceof SetupConflictError) throw new RouteError('CONFLICT', error.message);
  throw new RouteError('CHILD_FAILED', `${operation} failed: ${error instanceof Error ? error.message : String(error)}`);
}

export function routesForSetup(service: SetupService, workspace: string): Route[] {
  return [
    {
      method: 'GET',
      path: '/api/setup/profile',
      response: SetupProfileResponse,
      handler: async (): Promise<SetupProfileResponseT> => ({ profile: await service.getProfile() })
    },
    {
      method: 'PUT',
      path: '/api/setup/profile',
      body: SetupProfilePutRequest,
      response: SetupProfileResponse,
      describeOperation: async ({ body }, taskId): Promise<OperationInput> => {
        const input = body as SetupProfilePutRequestT;
        return writeOperation(workspace, taskId, { profile: input.profile, expectedUpdatedAt: input.expectedUpdatedAt });
      },
      handler: async (context): Promise<SetupProfileResponseT> => {
        const approved = approvedSetupBody(context) as SetupProfilePutRequestT;
        const parsed = SetupProfilePutRequest.safeParse(approved);
        if (!parsed.success) throw new RouteError('CONFLICT', 'approved setup body does not match the contract');
        try {
          const profile = await service.applyProfile(parsed.data.profile, parsed.data.expectedUpdatedAt);
          return { profile };
        } catch (error) {
          rethrowSetupError(error, 'setup profile apply');
        }
      }
    },
    {
      method: 'DELETE',
      path: '/api/setup/profile',
      body: SetupProfileResetRequest,
      response: SetupProfileResponse,
      describeOperation: async (_ctx, taskId): Promise<OperationInput> => writeOperation(workspace, taskId, {}),
      handler: async (): Promise<SetupProfileResponseT> => {
        try {
          await service.resetProfile();
          return { profile: null };
        } catch (error) {
          rethrowSetupError(error, 'setup profile reset');
        }
      }
    },
    {
      method: 'GET',
      path: '/api/setup/plan',
      query: SetupPlanQuery,
      response: SetupPlanResponse,
      handler: async ({ query }: RouteContext): Promise<SetupPlanResponseT> => {
        let answers;
        try {
          answers = SetupAnswers.parse(JSON.parse((query as { answers: string }).answers));
        } catch {
          throw new RouteError('BAD_REQUEST', 'answers must be valid setup answers JSON');
        }
        return { plan: await service.plan(answers) };
      }
    },
    {
      method: 'GET',
      path: '/api/setup/readiness',
      response: SetupReadinessResponse,
      handler: async (): Promise<SetupReadinessResponseT> => ({ readiness: await service.readiness() })
    }
  ];
}
