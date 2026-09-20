// Covert-owned worker handoff contract (distinct from the SESSION handoff
// bundles in handoff.ts). A worker handoff carries bounded CONTINUITY between
// abstract workers. It carries context, never permission: no authority
// material, no credentials, no hidden reasoning, no raw transcript.
import { z } from 'zod';

export const WorkerHandoffState = z.enum(['CREATED', 'ACCEPTED', 'CONSUMED', 'FAILED', 'CANCELLED']);
export type WorkerHandoffStateT = z.infer<typeof WorkerHandoffState>;

export const WorkerRole = z.enum(['plan', 'act', 'utility', 'planner', 'coder', 'reviewer']);
export type WorkerRoleT = z.infer<typeof WorkerRole>;

export const WorkerDescriptor = z.strictObject({
  worker: z.string().min(1).max(200),
  provider: z.string().min(1).max(120),
  model: z.string().min(1).max(200),
  role: WorkerRole
});
export type WorkerDescriptorT = z.infer<typeof WorkerDescriptor>;

export const HandoffFailureContext = z.strictObject({
  classification: z.string().min(1).max(120),
  last_successful_stage: z.string().max(200).nullable(),
  side_effects: z.enum(['none', 'partial', 'unknown', 'complete']),
  retryable: z.boolean(),
  recommended_continuation: z.string().max(500).nullable()
});
export type HandoffFailureContextT = z.infer<typeof HandoffFailureContext>;

export const HandoffArtifactRef = z.strictObject({
  artifact_id: z.string().min(1).max(200),
  type: z.string().max(80),
  path: z.string().max(500),
  sha256: z.string().max(128),
  stage: z.string().max(80)
});
export type HandoffArtifactRefT = z.infer<typeof HandoffArtifactRef>;

export const WorkerHandoffEnvelope = z.strictObject({
  handoff_id: z.string().uuid(),
  state: WorkerHandoffState,
  workspace_id: z.string().min(1).max(1000),
  project_id: z.string().max(200).nullable(),
  task_id: z.string().min(1).max(200),
  workflow_id: z.string().max(200).nullable(),
  stage_id: z.string().max(200).nullable(),
  from: WorkerDescriptor,
  to: WorkerDescriptor,
  objective: z.string().min(1).max(2000),
  current_state: z.string().max(2000),
  worker_claims: z.array(z.string().max(600)).max(16),
  verified_facts: z.array(z.string().max(600)).max(32),
  decisions: z.array(z.string().max(600)).max(16),
  assumptions: z.array(z.string().max(600)).max(16),
  constraints: z.array(z.string().max(600)).max(16),
  open_questions: z.array(z.string().max(600)).max(16),
  next_action: z.string().max(1000),
  artifacts: z.array(HandoffArtifactRef).max(64),
  files_or_components: z.array(z.string().max(300)).max(64),
  evidence_refs: z.array(z.string().max(300)).max(32),
  verification_refs: z.array(z.string().max(300)).max(16),
  memory_refs: z.array(z.string().max(300)).max(16),
  failure_context: HandoffFailureContext.nullable(),
  created_at: z.string(),
  accepted_at: z.string().nullable(),
  consumed_at: z.string().nullable(),
  supersedes: z.array(z.string().uuid()).max(8),
  related: z.array(z.string().uuid()).max(8)
});
export type WorkerHandoffEnvelopeT = z.infer<typeof WorkerHandoffEnvelope>;

const textList = z.array(z.string().min(1).max(600)).max(16).optional();

export const WorkerHandoffCreateRequest = z.strictObject({
  task_id: z.string().min(1).max(200),
  from: WorkerDescriptor,
  to: WorkerDescriptor,
  objective: z.string().min(1).max(2000),
  next_action: z.string().max(1000),
  current_state: z.string().max(2000).optional(),
  decisions: textList,
  assumptions: textList,
  constraints: textList,
  open_questions: textList,
  failure_context: HandoffFailureContext.optional(),
  supersedes: z.array(z.string().uuid()).max(8).optional(),
  related: z.array(z.string().uuid()).max(8).optional()
});
export type WorkerHandoffCreateRequestT = z.infer<typeof WorkerHandoffCreateRequest>;

export const WorkerHandoffCreateResponse = z.strictObject({ handoff: WorkerHandoffEnvelope });
export const WorkerHandoffGetResponse = z.strictObject({ handoff: WorkerHandoffEnvelope });
export const WorkerHandoffActionRequest = z.strictObject({ handoff_id: z.string().uuid() });
export const WorkerHandoffAcceptRequest = z.strictObject({ handoff_id: z.string().uuid(), to: WorkerDescriptor });
export const WorkerHandoffListQuery = z.strictObject({ task_id: z.string().min(1).max(200).optional() });
export const WorkerHandoffListResponse = z.strictObject({ handoffs: z.array(WorkerHandoffEnvelope) });
export const WorkerHandoffGetQuery = z.strictObject({ id: z.string().uuid() });
export const WorkerHandoffContextQuery = z.strictObject({ id: z.string().uuid() });
export const WorkerHandoffContextResponse = z.strictObject({
  handoff_id: z.string().uuid(),
  context_block: z.string().max(12000),
  approx_tokens: z.number().int().gte(0)
});
