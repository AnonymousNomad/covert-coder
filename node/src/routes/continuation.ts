// Failure-continuation routes (Wave 6). Planning is a governed write (it
// persists canonical failure/chain records and may CREATE a continuation
// handoff); the existing /api/agent/start then executes the replacement.
// Nothing here starts sessions, grants authority, or performs egress.
import type { Route } from '../server.ts';
import { RouteError } from '../server.ts';
import type { OperationInput } from '../../../common/security/operation-policy.mjs';
import {
  ContinuationPlanRequest,
  ContinuationPlanResponse,
  ContinuationGetQuery,
  ContinuationListQuery,
  ContinuationListResponse,
  type ContinuationPlanRequestT
} from '../../../common/contracts/continuation.ts';
import { ContinuationError, type createContinuationManager } from '../services/continuation-manager.ts';

type Manager = ReturnType<typeof createContinuationManager>;

function toRouteError(error: unknown): RouteError {
  if (error instanceof ContinuationError) {
    if (error.code === 'NOT_FOUND') return new RouteError('NOT_FOUND', error.message);
    if (error.code === 'CONFLICT') return new RouteError('CONFLICT', error.message);
    return new RouteError('BAD_REQUEST', error.message);
  }
  return new RouteError('INTERNAL', error instanceof Error ? error.message : 'continuation planning failed');
}

export function routesForContinuation(manager: Manager, workspace: string): Route[] {
  return [
    {
      method: 'POST',
      path: '/api/agent/continuation',
      body: ContinuationPlanRequest,
      response: ContinuationPlanResponse,
      describeOperation: async ({ body }, taskId): Promise<OperationInput> => ({
        workspace,
        taskId,
        kind: 'capability.write',
        args: { body }
      }),
      handler: async ({ body }) => {
        try {
          return await manager.plan(body as ContinuationPlanRequestT);
        } catch (error) {
          throw toRouteError(error);
        }
      }
    },
    {
      method: 'GET',
      path: '/api/agent/continuations',
      query: ContinuationListQuery,
      response: ContinuationListResponse,
      handler: async ({ query }) => {
        try {
          const taskId = (query as { task_id?: string }).task_id;
          return { chains: await manager.listChains(taskId) };
        } catch (error) {
          throw toRouteError(error);
        }
      }
    },
    {
      method: 'GET',
      path: '/api/agent/continuation',
      query: ContinuationGetQuery,
      response: ContinuationListResponse,
      handler: async ({ query }) => {
        try {
          return { chains: [await manager.getChain((query as { chain_id: string }).chain_id)] };
        } catch (error) {
          throw toRouteError(error);
        }
      }
    }
  ];
}
