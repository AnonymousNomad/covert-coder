// Worker handoff routes. Reads are declared centrally as capability.read;
// every mutation carries a route-owned capability.write descriptor and stays
// fail-closed without an approved exact operation.
import type { Route } from '../server.ts';
import { RouteError } from '../server.ts';
import type { OperationInput } from '../../../common/security/operation-policy.mjs';
import {
  WorkerHandoffCreateRequest,
  WorkerHandoffCreateResponse,
  WorkerHandoffAcceptRequest,
  WorkerHandoffActionRequest,
  WorkerHandoffGetQuery,
  WorkerHandoffGetResponse,
  WorkerHandoffListQuery,
  WorkerHandoffListResponse,
  WorkerHandoffContextQuery,
  WorkerHandoffContextResponse,
  type WorkerHandoffCreateRequestT,
  type WorkerDescriptorT
} from '../../../common/contracts/worker-handoff.ts';
import { WorkerHandoffError, type createWorkerHandoffService } from '../services/worker-handoff.ts';

type Service = ReturnType<typeof createWorkerHandoffService>;

function toRouteError(error: unknown): RouteError {
  if (error instanceof WorkerHandoffError) {
    if (error.code === 'NOT_FOUND') return new RouteError('NOT_FOUND', error.message);
    if (error.code === 'CONFLICT') return new RouteError('CONFLICT', error.message);
    return new RouteError('BAD_REQUEST', error.message);
  }
  return new RouteError('INTERNAL', error instanceof Error ? error.message : 'worker handoff failed');
}

export function routesForWorkerHandoff(service: Service, workspace: string): Route[] {
  return [
    {
      method: 'POST',
      path: '/api/worker-handoff/create',
      body: WorkerHandoffCreateRequest,
      response: WorkerHandoffCreateResponse,
      describeOperation: async ({ body }, taskId): Promise<OperationInput> => ({
        workspace,
        taskId,
        kind: 'capability.write',
        args: { body }
      }),
      handler: async ({ body }) => {
        try {
          return { handoff: await service.create(body as WorkerHandoffCreateRequestT) };
        } catch (error) {
          throw toRouteError(error);
        }
      }
    },
    {
      method: 'POST',
      path: '/api/worker-handoff/accept',
      body: WorkerHandoffAcceptRequest,
      response: WorkerHandoffCreateResponse,
      describeOperation: async ({ body }, taskId): Promise<OperationInput> => ({
        workspace,
        taskId,
        kind: 'capability.write',
        args: { body }
      }),
      handler: async ({ body }) => {
        try {
          const request = body as { handoff_id: string; to: WorkerDescriptorT };
          return { handoff: await service.accept(request.handoff_id, request.to) };
        } catch (error) {
          throw toRouteError(error);
        }
      }
    },
    {
      method: 'POST',
      path: '/api/worker-handoff/consume',
      body: WorkerHandoffActionRequest,
      response: WorkerHandoffCreateResponse,
      describeOperation: async ({ body }, taskId): Promise<OperationInput> => ({
        workspace,
        taskId,
        kind: 'capability.write',
        args: { body }
      }),
      handler: async ({ body }) => {
        try {
          return { handoff: await service.consume((body as { handoff_id: string }).handoff_id) };
        } catch (error) {
          throw toRouteError(error);
        }
      }
    },
    {
      method: 'POST',
      path: '/api/worker-handoff/cancel',
      body: WorkerHandoffActionRequest,
      response: WorkerHandoffCreateResponse,
      describeOperation: async ({ body }, taskId): Promise<OperationInput> => ({
        workspace,
        taskId,
        kind: 'capability.write',
        args: { body }
      }),
      handler: async ({ body }) => {
        try {
          return { handoff: await service.cancel((body as { handoff_id: string }).handoff_id) };
        } catch (error) {
          throw toRouteError(error);
        }
      }
    },
    {
      method: 'GET',
      path: '/api/worker-handoff/list',
      query: WorkerHandoffListQuery,
      response: WorkerHandoffListResponse,
      handler: async ({ query }) => {
        try {
          const taskId = (query as { task_id?: string }).task_id;
          return { handoffs: await service.list(taskId) };
        } catch (error) {
          throw toRouteError(error);
        }
      }
    },
    {
      method: 'GET',
      path: '/api/worker-handoff/get',
      query: WorkerHandoffGetQuery,
      response: WorkerHandoffGetResponse,
      handler: async ({ query }) => {
        try {
          return { handoff: await service.get((query as { id: string }).id) };
        } catch (error) {
          throw toRouteError(error);
        }
      }
    },
    {
      method: 'GET',
      path: '/api/worker-handoff/context',
      query: WorkerHandoffContextQuery,
      response: WorkerHandoffContextResponse,
      handler: async ({ query }) => {
        try {
          const result = await service.contextBlock((query as { id: string }).id);
          return { handoff_id: result.handoff.handoff_id, context_block: result.context_block, approx_tokens: result.approx_tokens };
        } catch (error) {
          throw toRouteError(error);
        }
      }
    }
  ];
}
