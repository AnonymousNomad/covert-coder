import { z } from 'zod';
import { WorkflowArtifactRef, WorkflowStage, WorkflowTransitionRequest } from './workflow.ts';

export const ResidentSeverity = z.enum(['info', 'warn', 'error']);

export const ResidentCondition = z
  .object({
    id: z.string().min(1).max(64),
    severity: ResidentSeverity,
    message: z.string().min(1).max(300),
    recommendation: z.string().min(1).max(200),
    workflow: z.string().nullable(),
    evidence: z.string().max(200).optional()
  })
  .strict();

export const ResidentProjectType = z.enum(['typescript', 'javascript', 'rust', 'python', 'csharp', 'go', 'java', 'unknown']);

export const ResidentGitState = z
  .object({
    git_repo: z.boolean(),
    branch: z.string().nullable(),
    upstream: z.string().nullable(),
    ahead: z.number().int().nonnegative(),
    behind: z.number().int().nonnegative(),
    changes: z.number().int().nonnegative(),
    conflicts: z.number().int().nonnegative(),
    clean: z.boolean()
  })
  .strict();

export const ResidentLspEntry = z
  .object({
    languageId: z.string().min(1),
    status: z.string().min(1)
  })
  .strict();

export const ResidentDeps = z
  .object({
    has_manifest: z.boolean(),
    dependencies: z.number().int().nonnegative(),
    dev_dependencies: z.number().int().nonnegative(),
    has_lockfile: z.boolean(),
    action: z.string().nullable()
  })
  .strict();

export const ResidentSummary = z
  .object({
    generated_at: z.number().int(),
    status: z.enum(['ready', 'attention']),
    projectType: ResidentProjectType,
    workspace: z.string().min(1),
    nodeVersion: z.string(),
    git: ResidentGitState,
    lsp: z.object({
      available: z.boolean(),
      servers: z.array(ResidentLspEntry)
    }).strict(),
    model: z.object({
      runtime_available: z.boolean(),
      running: z.boolean(),
      ready_count: z.number().int().nonnegative(),
      artifact_available: z.boolean()
    }).strict(),
    deps: ResidentDeps,
    hasTestScript: z.boolean(),
    conditions: z.array(ResidentCondition).max(40),
    recommendation: z.string().min(1).max(400),
    workflow: z.string().nullable()
  })
  .strict();

// Workflow projection (Slice 8) — canonical workflow facts for the Resident
// context: stage, revision, artifact references and deterministic gate
// blockers. References only (no bodies), computed by evaluateTransition from
// the frozen workflow kernel. requires_authorization is always true: Resident
// NEVER self-approves; approval travels the operator authority as in Slice 7.
export const ResidentWorkflowTransitionOption = z
  .object({
    to_stage: WorkflowStage,
    kind: z.enum(['forward', 'revision']),
    requires_authorization: z.literal(true),
    gate: z
      .object({
        result: z.enum(['satisfied', 'unsatisfied']),
        failed: z.array(z.string().min(1)).max(16)
      })
      .strict()
  })
  .strict();

export const ResidentWorkflowContext = z
  .object({
    workflow_id: z.string().uuid(),
    project_id: z.string().min(1).max(128),
    stage: WorkflowStage,
    previous_stage: WorkflowStage.nullable(),
    revision: z.number().int().gte(0),
    artifacts: z.array(WorkflowArtifactRef).max(64),
    blockers: z.array(z.string().min(1)).max(16),
    transition_options: z.array(ResidentWorkflowTransitionOption).max(2),
    created_at: z.string().datetime(),
    updated_at: z.string().datetime()
  })
  .strict();

export const ResidentTransitionProposal = z
  .object({
    request: WorkflowTransitionRequest,
    gate: z
      .object({
        result: z.enum(['satisfied', 'unsatisfied']),
        failed: z.array(z.string().min(1)).max(16)
      })
      .strict(),
    requires_authorization: z.literal(true),
    ready: z.boolean()
  })
  .strict();

export const ResidentTransitionProposalResult = z.union([
  z.object({ ok: z.literal(true), proposal: ResidentTransitionProposal }).strict(),
  z.object({ ok: z.literal(false), failed: z.array(z.string().min(1)).max(16) }).strict()
]);

export const ResidentContext = z
  .object({
    generated_at: z.number().int(),
    projectType: ResidentProjectType,
    workspace: z.string().min(1),
    git_status: z.string().max(200),
    changed_files: z.array(z.string().min(1)).max(25),
    diagnostics: z.array(z.string().min(1)).max(15),
    conditions: z.array(z.string().min(1)).max(15),
    workflows_available: z.array(z.string().min(1)).max(20),
    model_status: z.string().max(200),
    workflow: ResidentWorkflowContext.nullable(),
    approx_tokens: z.number().int().positive()
  })
  .strict();

export const ResidentPushSummary = z
  .object({
    repo: z.boolean(),
    branch: z.string().nullable(),
    ahead: z.number().int().nonnegative(),
    behind: z.number().int().nonnegative(),
    changed_files: z.array(z.string().min(1)).max(100),
    changed_count: z.number().int().nonnegative(),
    staged_count: z.number().int().nonnegative(),
    diagnostics_errors: z.number().int().nonnegative(),
    test_script_present: z.boolean(),
    risky_changes: z.array(z.string().min(1)).max(25),
    generated_artifacts: z.array(z.string().min(1)).max(25),
    verdict: z.enum(['READY', 'ATTENTION_REQUIRED']),
    reasons: z.array(z.string().min(1)).max(20)
  })
  .strict();

export const ResidentDecision = z
  .object({
    ts: z.number().int(),
    id: z.string().min(1).max(64),
    severity: ResidentSeverity,
    message: z.string().max(300),
    recommendation: z.string().max(200),
    workflow: z.string().nullable()
  })
  .strict();

export const ResidentSummaryResponse = z.object({ summary: ResidentSummary }).strict();

export const ResidentContextResponse = z.object({ context: ResidentContext }).strict();

export const ResidentPushSummaryResponse = z.object({ push: ResidentPushSummary }).strict();

export const ResidentDecisionsResponse = z.object({ decisions: z.array(ResidentDecision).max(100) }).strict();

export type ResidentSeverityT = z.infer<typeof ResidentSeverity>;
export type ResidentConditionT = z.infer<typeof ResidentCondition>;
export type ResidentProjectTypeT = z.infer<typeof ResidentProjectType>;
export type ResidentGitStateT = z.infer<typeof ResidentGitState>;
export type ResidentSummaryT = z.infer<typeof ResidentSummary>;
export type ResidentWorkflowTransitionOptionT = z.infer<typeof ResidentWorkflowTransitionOption>;
export type ResidentWorkflowContextT = z.infer<typeof ResidentWorkflowContext>;
export type ResidentTransitionProposalT = z.infer<typeof ResidentTransitionProposal>;
export type ResidentTransitionProposalResultT = z.infer<typeof ResidentTransitionProposalResult>;
export type ResidentContextT = z.infer<typeof ResidentContext>;
export type ResidentPushSummaryT = z.infer<typeof ResidentPushSummary>;
export type ResidentDecisionT = z.infer<typeof ResidentDecision>;
export type ResidentSummaryResponseT = z.infer<typeof ResidentSummaryResponse>;
export type ResidentContextResponseT = z.infer<typeof ResidentContextResponse>;
export type ResidentPushSummaryResponseT = z.infer<typeof ResidentPushSummaryResponse>;
export type ResidentDecisionsResponseT = z.infer<typeof ResidentDecisionsResponse>;