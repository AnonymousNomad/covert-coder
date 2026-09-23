import type { Route } from '../server.ts';
import { AdmissionRequest, AdmissionResponse, type AdmissionRequestT } from '../../../common/contracts/admission.ts';
import type { createResourceAdmission } from '../services/resource-admission.ts';
import { RouteError } from '../server.ts';

type Service = ReturnType<typeof createResourceAdmission>;

export function routesForResourceAdmission(service: Service): Route[] {
  return [
    {
      method: 'POST',
      path: '/api/resource/admission',
      body: AdmissionRequest,
      response: AdmissionResponse,
      handler: async ({ body }) => {
        try {
          return await service.admit(body as AdmissionRequestT);
        } catch (error) {
          throw new RouteError('INTERNAL', error instanceof Error ? error.message : 'admission failed');
        }
      }
    }
  ];
}
