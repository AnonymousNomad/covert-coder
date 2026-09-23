// Sovereignty / egress manifest route (central capability.read). Read-only.
import type { Route } from '../server.ts';
import { EgressManifestResponse } from '../../../common/contracts/egress.ts';
import type { createEgressManifest } from '../services/egress-manifest.ts';

type Service = ReturnType<typeof createEgressManifest>;

export function routesForEgressManifest(service: Service): Route[] {
  return [
    {
      method: 'GET',
      path: '/api/egress/manifest',
      response: EgressManifestResponse,
      handler: async () => await service.snapshot()
    }
  ];
}