// Harness vNext H3 — attempt/admission journal reads. Central capability.read
// (no route-owned descriptors); the journal itself is append-only and written
// only by the agent loop lifecycle, never by route traffic.
import type { Route } from '../server.ts';
import { RouteError } from '../server.ts';
import { AttemptGetQuery, AttemptListQuery, AttemptListResponse, AttemptDetail } from '../../../common/contracts/attempt.ts';
import type { createAttemptJournal } from '../services/attempt-journal.ts';

type Service = ReturnType<typeof createAttemptJournal>;

export function routesForAttempts(service: Service): Route[] {
  return [
    {
      method: 'GET',
      path: '/api/harness/attempts',
      query: AttemptListQuery,
      response: AttemptListResponse,
      handler: async ({ query }) => await service.list(typeof query.task_id === 'string' ? query.task_id : undefined)
    },
    {
      method: 'GET',
      path: '/api/harness/attempt',
      query: AttemptGetQuery,
      response: AttemptDetail,
      handler: async ({ query }) => {
        const detail = await service.get(String(query.id));
        if (detail === null) throw new RouteError('NOT_FOUND', `attempt ${String(query.id)} not found`);
        return detail;
      }
    }
  ];
}
