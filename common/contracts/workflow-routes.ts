import { z } from 'zod';
import { WorkflowArtifactRef, WorkflowStage, WorkflowState } from './workflow.ts';

// Route-facing contracts for the workflow surface (Slice 7). The HTTP shape is
// deliberately separated from the internal kernel contracts: state is returned
// as a wrapped projection, transition submissions are validated at the route
// edge before they reach the workflow service's transition builder (transition
// logic is never re-implemented here), and responses carry the gate outcome,
// failure reasons, resulting state and the authority operation reference.
// Nothing else crosses this boundary: no authority receipts, no filesystem
// secrets, no artifact contents, no raw audit payloads.

export const WorkflowStateResponse = z.strictObject({
  state: WorkflowState.nullable()
});
export type WorkflowStateResponseT = z.infer<typeof WorkflowStateResponse>;

// Production creation boundary (wiring audit Wave 1): an actionable operator
// objective establishes the canonical workflow through the EXISTING workflow
// service + workflow.create authority kind. Ordinary conversation never calls
// this route. project_id binds the workflow to the existing project identity;
// no redundant identifiers are introduced (workflow_id/workspace are minted by
// the canonical owner).
export const WorkflowCreateRequest = z.strictObject({
  project_id: z.string().min(1).max(128)
});
export type WorkflowCreateRequestT = z.infer<typeof WorkflowCreateRequest>;

export const WorkflowCreateResponse = z.strictObject({
  status: z.literal('created'),
  state: WorkflowState,
  operation_id: z.string().min(1)
});
export type WorkflowCreateResponseT = z.infer<typeof WorkflowCreateResponse>;

// HTTP wrapper for a transition submission. `requested_by` is route-internal
// display metadata that defaults to 'operator' (only operator-paired actors
// can hold workflow.transition operations); the parsed body is byte-identical
// to the kernel transition request so the authority digest prepared over this
// body matches the request the workflow service asserts at execution time.
export const WorkflowTransitionRequest = z.strictObject({
  workflow_id: z.string().uuid(),
  from_stage: WorkflowStage,
  to_stage: WorkflowStage,
  kind: z.enum(['forward', 'revision']),
  reason: z.string().min(8).max(2000).optional(),
  requested_by: z.string().min(1).max(128).default('operator'),
  evidence: z.array(WorkflowArtifactRef).max(16)
});
export type WorkflowTransitionRequestT = z.infer<typeof WorkflowTransitionRequest>;

// `status` is 'applied' only when the gate was satisfied inside the approved
// execution and the new state was committed; 'rejected' carries the
// deterministic gate failures and the unchanged current state.
export const WorkflowTransitionResponse = z.strictObject({
  status: z.enum(['applied', 'rejected']),
  gate: z.strictObject({
    result: z.enum(['satisfied', 'unsatisfied']),
    failed: z.array(z.string())
  }),
  state: WorkflowState.nullable(),
  operation_id: z.string().uuid().nullable()
});
export type WorkflowTransitionResponseT = z.infer<typeof WorkflowTransitionResponse>;
