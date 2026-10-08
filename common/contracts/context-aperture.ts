import { z } from 'zod';
import { ProjectAddress } from './project.ts';
import { WorkerDescriptor } from './worker-handoff.ts';

export const ContextApertureSource = z.strictObject({
  revision: z.string().max(64).nullable(),
  branch: z.string().max(240).nullable(),
  working_tree: z.enum(['CLEAN', 'DIRTY', 'UNKNOWN']),
  observed_at: z.string().datetime()
});

export const ContextAperture = z.strictObject({
  schema: z.literal('covert.context-aperture.v1'),
  aperture_id: z.string().uuid(),
  project: ProjectAddress,
  source: ContextApertureSource,
  task_id: z.string().min(1).max(200),
  objective: z.string().min(1).max(2000),
  acceptance_criteria: z.array(z.string().min(1).max(300)).max(8),
  included_files: z.array(z.string().min(1).max(300)).max(32),
  decision_refs: z.array(z.string().min(1).max(300)).max(16),
  evidence_refs: z.array(z.string().min(1).max(300)).max(32),
  sop_refs: z.array(z.string().min(1).max(300)).max(16),
  handoff_id: z.string().uuid().nullable(),
  handoff_context: z.string().max(12000).nullable(),
  destination_session_id: z.string().uuid(),
  destination: WorkerDescriptor,
  allowed_capabilities: z.array(z.string().max(120)).max(16),
  protocol_tools: z.array(z.never()).max(4),
  exclusions: z.array(z.string().min(1).max(180)).max(16),
  content: z.string().max(20000),
  approx_tokens: z.number().int().gte(0),
  created_at: z.string().datetime(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/)
});

export type ContextApertureT = z.infer<typeof ContextAperture>;
