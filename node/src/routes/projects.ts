import { z } from 'zod';
import { CurrentProjectResponse } from '../../../common/contracts/project.ts';
import type { ProjectSeat } from '../services/project-seat.ts';
import { RouteError, type Route } from '../server.ts';

export function routesForProjects(seat: ProjectSeat | undefined, workspace: string): Route[] {
  return [{
    capabilityPolicy: { owner: 'ProjectSeat', operation: 'capability.read', available: seat !== undefined },
    method: 'GET', path: '/api/projects/current', query: z.object({}).strict(), response: CurrentProjectResponse,
    // Pure projection. It never enrolls, selects, grants or starts another root.
    describeOperation: async (_ctx, taskId) => ({ workspace, taskId, kind: 'capability.read', args: { route: '/api/projects/current' } }),
    handler: async ctx => {
      if (!ctx.actor || !ctx.authority) throw new RouteError('FORBIDDEN', 'authenticated project principal required');
      ctx.authority.assertActor(ctx.actor);
      if (!seat) throw new RouteError('NOT_READY', 'canonical project owner unavailable');
      try {
        const checkout = await seat.current(), catalog = await seat.registry.list();
        const project = catalog.projects.find(project => project.project_id === checkout.project_id);
        if (!project) throw new RouteError('NOT_READY', 'PROJECT_CATALOG_INVALID');
        return { project, checkout, foreground_state: 'BOUND_CONFIGURED_CHECKOUT', switching: 'GATED_OWNER_REBIND_REQUIRED', resident_seat: 'LIVE_ENROLLMENT_GATED', continuity_scope: 'CONFIGURED_STORAGE_ROOT' };
      } catch (error) {
        if (error instanceof RouteError) throw error;
        throw new RouteError('NOT_READY', error instanceof Error ? error.message : 'canonical project unavailable');
      }
    }
  }];
}
