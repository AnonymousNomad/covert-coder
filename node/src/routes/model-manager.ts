import { ModelManagerQuery, ModelManagerSnapshotResponse } from '../../../common/contracts/model-manager.ts';
import type { RuntimeAdapterRegistry } from '../services/runtime-adapter.ts';
import type { CloudProviderProbe } from '../services/intelligence-discovery.ts';
import { buildModelManagerSnapshot } from '../services/model-manager-view.ts';
import type { Route } from '../server.ts';

export interface ModelManagerRouteOptions {
  workspace: string;
  modelPacksPath: string;
  runtimeAdapters?: RuntimeAdapterRegistry;
  providerProbe?: (workspace: string) => Promise<CloudProviderProbe[]>;
}

// Read-only operator projection. It composes the existing Registry, bounded
// discovery, provider-state probe, and recommendation engine. It never writes
// Registry state, downloads artifacts, probes cloud models, or starts a runtime.
export function routeForModelManager(options: ModelManagerRouteOptions): Route {
  return {
    method: 'GET',
    path: '/api/models/manager',
    query: ModelManagerQuery,
    response: ModelManagerSnapshotResponse,
    handler: async ({ query }) => {
      const params = query as { role?: string; offline?: 'true' | 'false' };
      return buildModelManagerSnapshot({
        workspace: options.workspace,
        modelPacksPath: options.modelPacksPath,
        ...(options.runtimeAdapters ? { runtimeAdapters: options.runtimeAdapters } : {}),
        ...(options.providerProbe ? { providerProbe: options.providerProbe } : {}),
        ...(params.role ? { role: params.role } : {}),
        offline: params.offline === 'true'
      });
    }
  };
}
