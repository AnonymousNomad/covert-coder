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

export const CreationStudioBibleEntry = z.object({
  entry_id: z.string().min(1).max(120),
  category: z.enum(['CHARACTER', 'LOCATION', 'VISUAL_RULE', 'PROP', 'VEHICLE', 'VOICE', 'MUSIC', 'TERMINOLOGY']),
  title: z.string().min(1).max(240),
  content: z.string().min(1).max(8000),
  status: z.enum(['DRAFT', 'APPROVED'])
}).strict();
export type CreationStudioBibleEntryT = z.infer<typeof CreationStudioBibleEntry>;

export const CreationStudioContinuityEntry = z.object({
  entry_id: z.string().min(1).max(120),
  scope_kind: z.enum(['PRODUCTION', 'SCENE', 'SHOT']),
  scope_id: z.string().min(1).max(120).nullable(),
  title: z.string().min(1).max(240),
  content: z.string().min(1).max(8000),
  status: z.enum(['ACTIVE', 'RESOLVED'])
}).strict();
export type CreationStudioContinuityEntryT = z.infer<typeof CreationStudioContinuityEntry>;

export const CreationStudioRecord = z.object({
  production: CreationStudioProduction,
  bible_entries: z.array(CreationStudioBibleEntry).max(2000),
  continuity_entries: z.array(CreationStudioContinuityEntry).max(4000),
  revision: z.number().int().positive(),
  updated_at: z.string().datetime()
}).strict();
export type CreationStudioRecordT = z.infer<typeof CreationStudioRecord>;

export const CreationStudioListResponse = z.object({
  records: z.array(CreationStudioRecord).max(100)
}).strict();
export type CreationStudioListResponseT = z.infer<typeof CreationStudioListResponse>;

export const CreationStudioPutRequest = z.object({
  expected_revision: z.number().int().nonnegative(),
  production: CreationStudioProduction,
  bible_entries: z.array(CreationStudioBibleEntry).max(2000),
  continuity_entries: z.array(CreationStudioContinuityEntry).max(4000)
}).strict();
export type CreationStudioPutRequestT = z.infer<typeof CreationStudioPutRequest>;
