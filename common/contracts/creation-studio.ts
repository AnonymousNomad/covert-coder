import { z } from 'zod';

export const CreationStudioShotState = z.enum([
  'PLANNED', 'QUEUED', 'RENDERING', 'REVIEW', 'ACCEPTED', 'REJECTED', 'BLOCKED'
]);
export type CreationStudioShotStateT = z.infer<typeof CreationStudioShotState>;

export const CreationStudioAssignment = z.object({
  capability: z.enum(['SCRIPT', 'CONCEPT_ART', 'VIDEO', 'VOICE', 'MUSIC', 'UPSCALE']),
  provider_id: z.string().min(1).max(120).nullable(),
  model_id: z.string().min(1).max(160).nullable(),
  state: z.enum(['UNASSIGNED', 'ASSIGNED', 'UNAVAILABLE'])
}).strict();
export type CreationStudioAssignmentT = z.infer<typeof CreationStudioAssignment>;

export const CreationStudioShot = z.object({
  shot_id: z.string().min(1).max(120),
  order: z.number().int().nonnegative(),
  prompt: z.string().min(1).max(8000),
  duration_seconds: z.number().positive().max(60),
  aspect_ratio: z.enum(['16:9', '9:16', '1:1', '2.39:1']),
  state: CreationStudioShotState,
  assignments: z.array(CreationStudioAssignment).max(12)
}).strict();
export type CreationStudioShotT = z.infer<typeof CreationStudioShot>;

export const CreationStudioScene = z.object({
  scene_id: z.string().min(1).max(120),
  order: z.number().int().nonnegative(),
  title: z.string().min(1).max(240),
  summary: z.string().max(4000),
  shots: z.array(CreationStudioShot).max(500)
}).strict();
export type CreationStudioSceneT = z.infer<typeof CreationStudioScene>;

export const CreationStudioProduction = z.object({
  production_id: z.string().min(1).max(120),
  title: z.string().min(1).max(240),
  premise: z.string().max(8000),
  target_duration_seconds: z.number().positive().max(21600),
  status: z.enum(['DRAFT', 'READY_FOR_RENDER', 'RENDERING', 'REVIEW', 'COMPLETE']),
  execution_connection: z.literal('NOT_CONNECTED'),
  scenes: z.array(CreationStudioScene).max(500)
}).strict();
export type CreationStudioProductionT = z.infer<typeof CreationStudioProduction>;
