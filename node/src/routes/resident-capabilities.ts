import { ResidentCapabilityQuery, ResidentCapabilityManifest } from '../../../common/contracts/resident-capability.ts';
import type { ResidentCapabilityDiscovery } from '../services/resident-capability-discovery.ts';
import { RouteError, type Route } from '../server.ts';

export function routesForResidentCapabilities(discovery: ResidentCapabilityDiscovery, workspace: string): Route[] {
  return [{ method: 'GET', path: '/api/resident/capabilities', query: ResidentCapabilityQuery, response: ResidentCapabilityManifest,
    describeOperation: async ({ query }, taskId) => ({ workspace, taskId, kind: 'capability.read', args: { route: '/api/resident/capabilities', query } }),
    handler: async ctx => {
      if (!ctx.actor || !ctx.authority) throw new RouteError('FORBIDDEN', 'authenticated capability-discovery principal required');
      ctx.authority.assertActor(ctx.actor);
      let result;
      try { result = await discovery.read(ResidentCapabilityQuery.parse(ctx.query)); }
      catch { throw new RouteError('NOT_READY', 'Resident capability discovery unavailable or binding changed'); }
      ctx.authority.assertActor(ctx.actor);
      return result;
    }
  }];
}
