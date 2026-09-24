import { z } from 'zod';

// IMMUTABLE EXECUTION ENVELOPE (Harness vNext H3, schema v1).
//
// One admitted attempt = one immutable envelope. Once sealed (ATTEMPT_ADMITTED
// durable), any material change (model, context, Skill, budget, Authority
// scope, tool set, objective, acceptance criteria) is a DIFFERENT attempt with
// a NEW identity. Historical admission truth is never mutated.
//
// Absent truth is explicit: UNKNOWN | NOT_RECORDED | NOT_APPLICABLE.
export const ATTEMPT_MARKER = {
  UNKNOWN: 'UNKNOWN',
  NOT_RECORDED: 'NOT_RECORDED',
  NOT_APPLICABLE: 'NOT_APPLICABLE'
} as const;

const markerOrString = z.union([z.string().max(500), z.literal(ATTEMPT_MARKER.UNKNOWN), z.literal(ATTEMPT_MARKER.NOT_RECORDED), z.literal(ATTEMPT_MARKER.NOT_APPLICABLE)]);

export const AttemptFailureClass = z.enum([
  'ADMISSION_FAILURE',
  'RESOURCE_FAILURE',
  'AUTHORITY_FAILURE',
  'EXECUTION_FAILURE',
  'TOOL_FAILURE',
  'VERIFICATION_FAILURE',
  'RUNTIME_FAILURE',
  'UNKNOWN'
]);
export type AttemptFailureClassT = z.infer<typeof AttemptFailureClass>;

export const AttemptState = z.enum([
  'ADMITTED',
  'RUNNING',
  'COMPLETED',
  'ACCEPTED',
  'REJECTED',
  'FAILED',
  'ABORTED',
  'RECOVERED_NOT_STARTED',
  'RECOVERED_UNCERTAIN',
  'RECOVERED_MUTATED_UNVERIFIED',
  'RECOVERED_INCOMPLETE_ADMISSION'
]);
export type AttemptStateT = z.infer<typeof AttemptState>;

export const RetrySafety = z.enum(['SAFE_TO_RETRY', 'UNCERTAIN_BLOCKED', 'NEW_ATTEMPT_REQUIRED', 'NOT_APPLICABLE']);
export type RetrySafetyT = z.infer<typeof RetrySafety>;

export const ExecutionEnvelope = z.strictObject({
  schema: z.literal('covert.attempt.v1'),
  attempt_id: z.string().uuid(),
  sealed: z.boolean(),
  created_at: z.string(),
  sealed_at: z.string().nullable(),

  mission_id: z.string().max(200),
  project_id: z.string().max(1000),
  task_id: z.string().max(200),
  workflow_id: markerOrString,
  stage_id: markerOrString,
  parent_attempt_id: z.string().max(200).nullable(),
  handoff_id: z.string().max(200).nullable(),
  continuation_chain_id: z.string().max(200).nullable(),

  worker_role: z.string().max(40),
  worker_identity: z.string().max(200),
  worker_provider: z.string().max(120),
  worker_model: z.string().max(200),
  observed_model: markerOrString,

  runtime_profile: markerOrString,
  adapter_identity: markerOrString,

  context_envelope: z.strictObject({
    identity: markerOrString,
    sha256: z.string().max(64).nullable(),
    blocks: z.array(z.string().max(80)).max(32),
    bound_at: z.string().nullable()
  }),

  skills: z.strictObject({
    identities: z.array(z.string().max(200)).max(32),
    status: markerOrString
  }),

  capabilities: z.array(z.string().max(120)).max(64),

  objective: z.string().max(2000),
  acceptance_criteria: markerOrString,
  verification_requirements: markerOrString,

  resource_admission: z.strictObject({
    decision: z.enum(['START', 'QUEUE', 'REFUSE_RESOURCE', 'NOT_RECORDED']),
    reason: z.string().max(600),
    checked_at: z.string().nullable()
  }),

  authority_scope: z.strictObject({
    owner: markerOrString,
    operation_kind: markerOrString,
    workspace: z.string().max(1000),
    permit_identity: markerOrString
  }),

  mutation_scope: z.array(z.string().max(120)).max(64),
  budget: z.strictObject({
    max_iterations: z.number().int().gte(0).nullable(),
    effective_context_tokens: z.number().int().gte(0).nullable(),
    timeout_ms: z.number().int().gte(0).nullable(),
    retry_bounds: markerOrString
  }),

  mode: z.string().max(20),
  started_by: markerOrString
});
export type ExecutionEnvelopeT = z.infer<typeof ExecutionEnvelope>;

// Event names describe observed execution facts.  They are deliberately not
// model-claim events: a worker saying "done" cannot create a terminal event.
// Keep the string-valued event field forward-compatible for recovery of older
// journals, while new writers use this vocabulary.
export const AttemptEventName = z.enum([
  'ATTEMPT_CREATED',
  'VALIDATION_COMPLETED',
  'RESOURCE_ADMITTED',
  'RESOURCE_QUEUED',
  'RESOURCE_REFUSED',
  'AUTHORITY_GRANTED',
  'AUTHORITY_DENIED',
  'ATTEMPT_SEALED',
  'ATTEMPT_ADMITTED',
  'CONTEXT_BOUND',
  'CONTEXT_DRIFT',
  'SKILL_SELECTED',
  'WORKFLOW_BOUND',
  'MODEL_REQUEST_STARTED',
  'MODEL_RESPONSE_RECEIVED',
  'EXECUTION_STARTED',
  'ACTION_REQUESTED',
  'ACTION_PERMITTED',
  'ACTION_DENIED',
  'TOOL_REQUESTED',
  'TOOL_PERMITTED',
  'TOOL_STARTED',
  'TOOL_OBSERVED',
  'FILE_READ',
  'FILE_MUTATION_OBSERVED',
  'EFFECT_OBSERVED',
  'EFFECT_UNCERTAIN',
  'COMMAND_STARTED',
  'COMMAND_OBSERVED',
  'VERIFICATION_STARTED',
  'VERIFICATION_RESULT',
  'PROVENANCE_RECORDED',
  'REPAIR_REQUESTED',
  'CONTINUATION_CREATED',
  'HANDOFF_CREATED',
  'HANDOFF_CONSUMED',
  'ATTEMPT_COMPLETED',
  'ATTEMPT_ACCEPTED',
  'ATTEMPT_REJECTED',
  'ATTEMPT_FAILED',
  'ATTEMPT_ABORTED',
  'RECOVERY_CLASSIFIED'
]);
export type AttemptEventNameT = z.infer<typeof AttemptEventName>;

export const AttemptEventIntegrity = z.enum(['OK', 'CORRUPT', 'OUT_OF_ORDER']);
export type AttemptEventIntegrityT = z.infer<typeof AttemptEventIntegrity>;

export const AttemptJournalEvent = z.strictObject({
  event_id: z.string().min(1).max(300),
  seq: z.number().int().gte(0),
  ts: z.string(),
  attempt_id: z.string().uuid(),
  mission_id: z.string().max(200),
  project_id: z.string().max(1000),
  source: z.string().max(80),
  event: z.string().max(60),
  data: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
  redacted: z.boolean()
});
export type AttemptJournalEventT = z.infer<typeof AttemptJournalEvent>;

export const AttemptDetail = z.strictObject({
  envelope: ExecutionEnvelope,
  state: AttemptState,
  retry_safety: RetrySafety,
  failure_class: AttemptFailureClass.nullable(),
  recovery_note: z.string().max(600).nullable(),
  integrity: AttemptEventIntegrity,
  corrupt_records: z.number().int().gte(0),
  events: z.array(AttemptJournalEvent).max(1000)
});
export type AttemptDetailT = z.infer<typeof AttemptDetail>;

export const AttemptEventsQuery = z.strictObject({
  id: z.string().uuid(),
  after: z.string().regex(/^\d+$/).optional(),
  limit: z.string().regex(/^\d+$/).optional()
});

export const AttemptEventStreamResponse = z.strictObject({
  attempt_id: z.string().uuid(),
  mission_id: z.string().max(200),
  project_id: z.string().max(1000),
  after: z.number().int().gte(-1),
  next_after: z.number().int().gte(-1),
  has_more: z.boolean(),
  terminal: z.boolean(),
  integrity: AttemptEventIntegrity,
  corrupt_records: z.number().int().gte(0),
  events: z.array(AttemptJournalEvent).max(200)
});
export type AttemptEventStreamResponseT = z.infer<typeof AttemptEventStreamResponse>;

export const AttemptListResponse = z.strictObject({
  attempts: z.array(z.strictObject({
    attempt_id: z.string().uuid(),
    task_id: z.string().max(200),
    state: AttemptState,
    retry_safety: RetrySafety,
    sealed: z.boolean(),
    created_at: z.string()
  })).max(500),
  total: z.number().int().gte(0)
});
export type AttemptListResponseT = z.infer<typeof AttemptListResponse>;

export const AttemptGetQuery = z.strictObject({ id: z.string().uuid() });
export const AttemptListQuery = z.strictObject({ task_id: z.string().max(200).optional() });
