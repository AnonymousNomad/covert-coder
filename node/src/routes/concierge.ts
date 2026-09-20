import { type Route } from '../server.ts';
import { ConciergeManifestResponse, ConciergeResolveRequest, ConciergeResolveResponse } from '../../../common/contracts/mobile.ts';

export interface ConciergeService {
  manifest(): Promise<unknown>;
  resolve(input: unknown): Promise<unknown>;
}

function descriptor(workspace: string, body: unknown, taskId: string) {
  return { workspace, taskId, kind: 'capability.read' as const, args: { body } };
}

export function routesForConcierge(service: ConciergeService, workspace: string): Route[] {
  return [
    {
      method: 'GET',
      path: '/api/concierge/manifest',
      response: ConciergeManifestResponse,
      describeOperation: async (_ctx, taskId) => descriptor(workspace, {}, taskId),
      handler: async () => ({ manifest: await service.manifest() })
    },
    {
      method: 'POST',
      path: '/api/concierge/resolve',
      body: ConciergeResolveRequest,
      response: ConciergeResolveResponse,
      describeOperation: async ({ body }, taskId) => descriptor(workspace, body, taskId),
      handler: async ({ body }) => service.resolve(body)
    }
  ];
}
