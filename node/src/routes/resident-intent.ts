// Resident intent-readiness routes (Wave 5). Read-class capability: the gate
// computes readiness and persists only its own pending records — it never
// executes work, mutates the workspace, or touches authority. Execution
// remains behind the existing governed start path and Execution Authority.
import type { Route } from '../server.ts';
import { RouteError } from '../server.ts';
import {
  ResidentIntentRequest,
  ResidentIntentResponse,
  ResidentIntentListResponse,
  type ResidentIntentRequestT
} from '../../../common/contracts/resident-intent.ts';
import { ResidentIntentError, type createResidentIntentService } from '../services/resident-intent.ts';

type Service = ReturnType<typeof createResidentIntentService>;

function toRouteError(error: unknown): RouteError {
  if (error instanceof ResidentIntentError) {
    return error.code === 'NOT_FOUND' ? new RouteError('NOT_FOUND', error.message) : new RouteError('BAD_REQUEST', error.message);
  }
  return new RouteError('INTERNAL', error instanceof Error ? error.message : 'resident intent failed');
}

export function routesForResidentIntent(service: Service): Route[] {
  return [
    {
      method: 'POST',
      path: '/api/resident/intent',
      body: ResidentIntentRequest,
      response: ResidentIntentResponse,
      handler: async ({ body }) => {
        try {
          return await service.assess(body as ResidentIntentRequestT);
        } catch (error) {
          throw toRouteError(error);
        }
      }
    },
    {
      method: 'GET',
      path: '/api/resident/intents',
      response: ResidentIntentListResponse,
      handler: async () => {
        try {
          const pending = await service.listPending();
          return {
            pending: pending.map(record => ({
              readiness_id: record.readiness_id,
              task: record.task,
              status: record.status,
              created_at: record.created_at
            }))
          };
        } catch (error) {
          throw toRouteError(error);
        }
      }
    }
  ];
}
