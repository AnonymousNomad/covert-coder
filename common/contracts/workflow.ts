import { z } from 'zod';

// Workflow contracts — the Experience Engineering production spine
// (workflow-router design report, Slice 1: contracts only).
// FROZEN SCOPE: schemas and graph constants only. No routes, no service, no
// authority enrollment, no model calls. The router these contracts serve
// stores artifact REFERENCES only — it never authors artifact content and
// never self-certifies success. History lives in the audit trail;
// WorkflowState is a rebuildable snapshot (revision + last_transition_id
// point into the workflow.transition rows).

export const WORKFLOW_STATE_VERSION = 1;

export const WorkflowStage = z.enum([
  'DISCOVERY',
  'ARCHITECTURE',
  'DESIGN',
  'IMPLEMENTATION',
  'VALIDATION',
  'DEPLOYMENT'
]);
export type WorkflowStageT = z.infer<typeof WorkflowStage>;

// Transition graph — single source of truth for the schema AND the future
// deterministic service. Forward edges are adjacent-only (skipped stages are
// forbidden); revisions move exactly one stage back (multi-step rework is
// sequential revisions); null means the edge does not exist.
export const WORKFLOW_SUCCESSOR: Readonly<Record<WorkflowStageT, WorkflowStageT | null>> = Object.freeze({
  DISCOVERY: 'ARCHITECTURE',
  ARCHITECTURE: 'DESIGN',
  DESIGN: 'IMPLEMENTATION',
  IMPLEMENTATION: 'VALIDATION',
  VALIDATION: 'DEPLOYMENT',
  DEPLOYMENT: null
});

export const WORKFLOW_PREDECESSOR: Readonly<Record<WorkflowStageT, WorkflowStageT | null>> = Object.freeze({
  DISCOVERY: null,
  ARCHITECTURE: 'DISCOVERY',
  DESIGN: 'ARCHITECTURE',
  IMPLEMENTATION: 'DESIGN',
  VALIDATION: 'IMPLEMENTATION',
  DEPLOYMENT: 'VALIDATION'
});

export const WorkflowArtifactType = z.enum([
  'EXPERIENCE_BRIEF',
  'EXPERIENCE_BLUEPRINT',
  'VISUAL_SYSTEM',
  'INTERACTION_PLAN',
  'IMPLEMENTATION_BLUEPRINT',
  'RELEASE_EVIDENCE',
  'DEPLOYMENT_RECORD'
]);
export type WorkflowArtifactTypeT = z.infer<typeof WorkflowArtifactType>;

// References only: the artifact body lives in the workspace; the router keeps
// identity, location, integrity digest and validation status. The router sets
// verification_status from its deterministic structural validation; execution
// evidence verdicts remain Veritas-owned and are referenced via the audit trail.
export const WorkflowArtifactRef = z.strictObject({
  artifact_id: z.string().uuid(),
  artifact_type: WorkflowArtifactType,
  stage: WorkflowStage,
  path: z.string().min(1).max(512),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  created_at: z.string().datetime(),
  verification_status: z.enum(['unvalidated', 'validated', 'invalid', 'stale'])
});
export type WorkflowArtifactRefT = z.infer<typeof WorkflowArtifactRef>;

// Snapshot of the professional process state for one workflow. No embedded
// history: audit rows are the record; this object must be rebuildable by
// replaying workflow.transition events.
export const WorkflowState = z.strictObject({
  version: z.literal(WORKFLOW_STATE_VERSION),
  workflow_id: z.string().uuid(),
  workspace: z.string().min(1),
  project_id: z.string().min(1).max(128),
  stage: WorkflowStage,
  previous_stage: WorkflowStage.nullable(),
  revision: z.number().int().gte(0),
  artifacts: z.array(WorkflowArtifactRef).max(64),
  last_transition_id: z.string().uuid().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
});
export type WorkflowStateT = z.infer<typeof WorkflowState>;

// A transition request carries DATA only. Authority never travels in the body
// (Execution Authority doctrine: risk is selected by the executor adapter,
// never supplied by a caller); requested_by is display metadata only, and the
// validation result is computed by the router — never asserted by the caller.
export const WorkflowTransitionRequest = z
  .strictObject({
    workflow_id: z.string().uuid(),
    from_stage: WorkflowStage,
    to_stage: WorkflowStage,
    kind: z.enum(['forward', 'revision']),
    reason: z.string().min(8).max(2000).optional(),
    requested_by: z.string().min(1).max(128),
    evidence: z.array(WorkflowArtifactRef).max(16)
  })
  .superRefine((value, ctx) => {
    if (value.kind === 'forward' && WORKFLOW_SUCCESSOR[value.from_stage] !== value.to_stage) {
      ctx.addIssue({ code: 'custom', path: ['to_stage'], message: 'forward transitions are adjacent-only; skipped stages are forbidden' });
    }
    if (value.kind === 'revision' && value.reason === undefined) {
      ctx.addIssue({ code: 'custom', path: ['reason'], message: 'revision transitions require a reason' });
    }
    if (value.kind === 'revision' && WORKFLOW_PREDECESSOR[value.from_stage] !== value.to_stage) {
      ctx.addIssue({ code: 'custom', path: ['to_stage'], message: 'revisions move exactly one stage back; multi-step rework is sequential revisions' });
    }
  });
export type WorkflowTransitionRequestT = z.infer<typeof WorkflowTransitionRequest>;

// Audit row shape for the existing cipher-state.jsonl spine. Identifiers,
// digests and stage names only — never artifact bodies. operation_id is null
// when the router denied the request before any authority operation existed;
// actor_id is the requester for requested/applied rows and the operator for
// rejected rows.
export const WorkflowTransitionEvent = z.strictObject({
  type: z.literal('workflow.transition'),
  ts: z.string().datetime(),
  workflow_id: z.string().uuid(),
  workspace: z.string().min(1),
  sequence: z.number().int().gte(1),
  from_stage: WorkflowStage,
  to_stage: WorkflowStage,
  kind: z.enum(['forward', 'revision']),
  status: z.enum(['requested', 'applied', 'rejected']),
  reason: z.string().max(2000).nullable(),
  operation_id: z.string().uuid().nullable(),
  actor_id: z.string().min(1).nullable(),
  gate: z.strictObject({
    result: z.enum(['satisfied', 'unsatisfied']),
    failed: z.array(z.string().max(120)).max(16)
  }),
  evidence: z.array(z.strictObject({
    artifact_id: z.string().uuid(),
    artifact_type: WorkflowArtifactType,
    sha256: z.string().regex(/^[0-9a-f]{64}$/)
  })).max(16),
  error: z.string().max(500).nullable()
});
export type WorkflowTransitionEventT = z.infer<typeof WorkflowTransitionEvent>;
