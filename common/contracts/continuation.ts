// Governed failure-continuation contract (Wave 6). A failure is a canonical,
// classified record; continuation is a deterministic policy decision, not a
// retry loop. Failure never grants authority, never erases provenance, never
// authorizes provider egress, and never promotes a failed worker's claims to
// verified facts.
import { z } from 'zod';
import { WorkerDescriptor } from './worker-handoff.ts';

export const FailureClass = z.enum([
  'TRANSPORT_FAILURE',
  'PROVIDER_UNAVAILABLE',
  'LOCAL_RUNTIME_UNAVAILABLE',
  'TIMEOUT',
  'WORKER_REFUSAL',
  'INVALID_OUTPUT',
  'CONTEXT_FAILURE',
  'HANDOFF_FAILURE',
  'VERIFICATION_FAILURE',
  'AUTHORITY_DENIED',
  'CANCELLED',
  'OPERATOR_STOP',
  'INTERNAL_ERROR'
]);
export type FailureClassT = z.infer<typeof FailureClass>;

export const ContinuationDecision = z.enum(['retry', 'switch', 'terminal']);
export type ContinuationDecisionT = z.infer<typeof ContinuationDecision>;

export const ContinuationPlanRequest = z.strictObject({
  // The session that failed (its canonical trajectory is the failure source).
  failed_session_id: z.string().min(1).max(200),
  // The worker that failed (caller-attested provenance for the first attempt;
  // later attempts must match the chain's recorded replacement).
  failed_worker: WorkerDescriptor.optional(),
  // The candidate replacement. Policy validates eligibility; nothing is
  // executed by this route.
  replacement: WorkerDescriptor,
  // Chain identity for cascades; omit on the first continuation.
  chain_id: z.string().uuid().optional()
});
export type ContinuationPlanRequestT = z.infer<typeof ContinuationPlanRequest>;

export const ContinuationAttempt = z.strictObject({
  attempt: z.number().int().gte(1),
  session_id: z.string().min(1).max(200),
  worker: WorkerDescriptor,
  failure_class: FailureClass,
  error_summary: z.string().max(400),
  failed_at: z.string()
});

export const ContinuationChain = z.strictObject({
  chain_id: z.string().uuid(),
  root_task_id: z.string().min(1).max(200),
  state: z.enum(['open', 'continued', 'terminal']),
  attempts: z.array(ContinuationAttempt).max(8),
  retry_count: z.number().int().gte(0),
  replacement_count: z.number().int().gte(0),
  last_replacement: WorkerDescriptor.nullable(),
  pending_handoff_id: z.string().uuid().nullable(),
  last_decision: ContinuationDecision.nullable(),
  terminal_reason: z.string().max(400).nullable(),
  created_at: z.string(),
  updated_at: z.string()
});
export type ContinuationChainT = z.infer<typeof ContinuationChain>;

export const ContinuationPlanResponse = z.strictObject({
  chain_id: z.string().uuid(),
  decision: ContinuationDecision,
  failure_class: FailureClass,
  attempt: z.number().int().gte(0),
  replacements_remaining: z.number().int().gte(0),
  retry_eligible: z.boolean(),
  handoff_id: z.string().uuid().nullable(),
  replacement: WorkerDescriptor.nullable(),
  reason: z.string().max(400)
});
export type ContinuationPlanResponseT = z.infer<typeof ContinuationPlanResponse>;

export const ContinuationGetQuery = z.strictObject({ chain_id: z.string().uuid() });
export const ContinuationListQuery = z.strictObject({ task_id: z.string().min(1).max(200).optional() });
export const ContinuationListResponse = z.strictObject({ chains: z.array(ContinuationChain) });

// Deterministic budgets: one bounded same-worker retry per chain slot, and at
// most two replacements (three attempts total) before a truthful terminal.
export const CONTINUATION_BUDGET = Object.freeze({
  sameWorkerRetries: 1,
  maxReplacements: 2
});
