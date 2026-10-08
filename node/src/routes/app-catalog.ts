import { AppCatalogQuery, AppCatalogResponse } from '../../../common/contracts/platform-app.ts';
import type { AppCatalog } from '../services/app-catalog.ts';
import { AppCatalogError } from '../services/app-catalog.ts';
import { RouteError, type Route } from '../server.ts';

export function routesForAppCatalog(catalog: AppCatalog, workspace: string): Route[] {
  return [{
    method: 'GET', path: '/api/apps/catalog', query: AppCatalogQuery, response: AppCatalogResponse,
    describeOperation: async ({ query }, taskId) => ({ workspace, taskId, kind: 'capability.read', args: { route: '/api/apps/catalog', query } }),
    handler: async ctx => {
      if (!ctx.actor || !ctx.authority) throw new RouteError('FORBIDDEN', 'authenticated catalog principal required');
      ctx.authority.assertActor(ctx.actor);
      const query = AppCatalogQuery.parse(ctx.query);
      let result;
      try {
        result = await catalog.read({ project_id: query.project_id, checkout_id: query.checkout_id }, {
          ...(query.app_id !== undefined ? { app_id: query.app_id } : {}),
          ...(query.capability_id !== undefined ? { capability_id: query.capability_id } : {})
        });
      } catch (error) {
        if (error instanceof AppCatalogError && ['UNKNOWN_APP', 'UNKNOWN_CAPABILITY'].includes(error.reason)) throw new RouteError('NOT_FOUND', error.reason);
        throw new RouteError('NOT_READY', error instanceof Error ? error.message : 'catalog owner unavailable');
      }
      ctx.authority.assertActor(ctx.actor);
      return result;
    }
  }];
}
