import { z } from 'zod';

export const ProjectIdentity = z.object({
  project_id: z.string().uuid(), created_at: z.string().datetime()
}).strict();
export const ProjectCheckout = z.object({
  checkout_id: z.string().uuid(), project_id: z.string().uuid(),
  root: z.string().min(1).max(4096),
  root_device: z.string().regex(/^\d+$/), root_inode: z.string().regex(/^[1-9]\d*$/),
  created_at: z.string().datetime()
}).strict();
export const ProjectCatalog = z.object({
  schema: z.literal('covert.project-catalog.v1'), catalog_id: z.string().uuid(),
  revision: z.number().int().nonnegative(),
  projects: z.array(ProjectIdentity).max(2000), checkouts: z.array(ProjectCheckout).max(4000)
}).strict();
export const ProjectAddress = z.object({ project_id: z.string().uuid(), checkout_id: z.string().uuid() }).strict();
export const CurrentProjectResponse = z.object({
  project: ProjectIdentity, checkout: ProjectCheckout,
  foreground_state: z.literal('BOUND_CONFIGURED_CHECKOUT'),
  switching: z.literal('GATED_OWNER_REBIND_REQUIRED'),
  resident_seat: z.literal('LIVE_ENROLLMENT_GATED'),
  continuity_scope: z.literal('CONFIGURED_STORAGE_ROOT')
}).strict();
export type ProjectCheckoutT = z.infer<typeof ProjectCheckout>;
export type ProjectCatalogT = z.infer<typeof ProjectCatalog>;
export type ProjectAddressT = z.infer<typeof ProjectAddress>;
