// First-run readiness route. Single canonical GET read (declared centrally as
// capability.read); no mutation, no frontend inference.
import type { Route } from '../server.ts';
import { ReadinessResponse } from '../../../common/contracts/readiness.ts';
import type { createReadinessService } from '../services/readiness.ts';

type Service = ReturnType<typeof createReadinessService>;

export function routesForReadiness(service: Service): Route[] {
  return [
    {
      method: 'GET',
      path: '/api/readiness',
      response: ReadinessResponse,
      handler: async () => await service.snapshot()
    }
  ];
}
