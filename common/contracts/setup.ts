import { z } from 'zod';

// Resident Adaptive Setup (Gate #2)
//
// The Setup subsystem turns the resident wizard into a real configuration +
// validation session: interview -> configuration plan -> operator approval ->
// providers/secrets -> hardware scan -> model recommendations/selection ->
// workflow profile + skills -> integrations -> validation -> WORKSPACE READY.
//
// Truth rules encoded in the contract surface:
//   - a stored profile never claims a model is running; model state comes from
//     ModelStatusEntry (common/contracts/models.ts), never from artifact bytes;
//   - provider entries reuse the Gate #1 unified connections view (routing_available
//     and status come straight from /api/connections), never an unrelated store;
//   - WORKSPACE READY is evidence-based: the server recomputes readiness from
//     durable + probe state; the wizard renders the verdict untouched.
//
// The setup profile is the single persisted artifact. The RESIDENT proposes the
// plan; every mutation (apply profile, reset profile, adjust routing preference)
// flows through the existing governed route layer (409 -> approval).

export const SetupWorkType = z.enum([
  'Software Engineering',
  'Web Development',
  'Model Training',
  'Research',
  'Security & Audit',
  'Documentation',
  'Creative & Interface',
  'Game Development'
]);
export type SetupWorkTypeT = z.infer<typeof SetupWorkType>;

export const SetupSecondary = z.enum([
  'None',
  'Web Development',
  'Documentation',
  'Research',
  'Security & Audit',
  'Creative & Interface'
]);
export type SetupSecondaryT = z.infer<typeof SetupSecondary>;

export const SetupMode = z.enum(['LOCAL_FIRST', 'HYBRID', 'CLOUD']);
export type SetupModeT = z.infer<typeof SetupMode>;

export const SetupStrictness = z.enum(['STRICT', 'BALANCED', 'RELAXED']);
export type SetupStrictnessT = z.infer<typeof SetupStrictness>;

export const SetupModelUse = z.enum([
  'Primary driver',
  'Assistant / copilot',
  'Offline fallback',
  'Evaluate only'
]);
export type SetupModelUseT = z.infer<typeof SetupModelUse>;

export const SetupIntegrationId = z.enum(['Telegram', 'GitHub', 'Discord']);
export type SetupIntegrationIdT = z.infer<typeof SetupIntegrationId>;

export const SetupAnswers = z.strictObject({
  workType: SetupWorkType,
  secondaryWork: SetupSecondary,
  mode: SetupMode,
  providers: z.array(z.string()).max(8),
  projectLocations: z.string().max(500),
  localModelUse: SetupModelUse,
  approvalStrictness: SetupStrictness,
  integrations: z.array(SetupIntegrationId).max(4),
  importantWorkflows: z.string().max(2000)
});
export type SetupAnswersT = z.infer<typeof SetupAnswers>;

export const SetupRole = z.enum(['planner', 'coder', 'reviewer']);
export type SetupRoleT = z.infer<typeof SetupRole>;

export const SetupHardwareSnapshot = z.strictObject({
  totalRamGb: z.number().nonnegative(),
  logicalCpus: z.number().int().nonnegative(),
  vramMb: z.number().nonnegative(),
  tier: z.string().min(1).max(24),
  backend: z.string().min(1).max(24),
  scannedAt: z.number().positive()
});
export type SetupHardwareSnapshotT = z.infer<typeof SetupHardwareSnapshot>;

export const SetupSkillFamily = z.strictObject({
  id: z.string().min(1).max(64),
  label: z.string().min(1).max(120),
  available: z.boolean()
});
export type SetupSkillFamilyT = z.infer<typeof SetupSkillFamily>;

export const SetupModelRecommendation = z.strictObject({
  role: SetupRole,
  modelId: z.string().min(1),
  name: z.string().min(1),
  quant: z.string().min(1),
  fileBytes: z.number().nonnegative(),
  contextTokens: z.number().int().positive(),
  fit: z.enum(['COMFORTABLE', 'TIGHT', 'OVER']),
  onDisk: z.boolean(),
  // Model runtime truth: never synthesized from artifact bytes. These are the
  // setup projection of common/model-state.ts; READY is reserved for a
  // verified serving route, while raw runtime `ready` means STARTABLE.
  state: z.enum(['available', 'startable', 'starting', 'running', 'ready', 'degraded', 'stopped', 'failed']),
  reason: z.string().min(1)
});
export type SetupModelRecommendationT = z.infer<typeof SetupModelRecommendation>;

export const SetupIntegrationState = z.strictObject({
  id: SetupIntegrationId,
  // AVAILABLE  -> capability exists and can be used now
  // CONFIGURABLE -> capability exists; operator must connect/authorize first
  // PARTIAL     -> bound but not yet validated end-to-end
  // DEFERRED    -> capability is on the roadmap, no adapter wired yet
  // UNAVAILABLE -> not available on this build/hardware
  state: z.enum(['AVAILABLE', 'CONFIGURABLE', 'PARTIAL', 'DEFERRED', 'UNAVAILABLE']),
  detail: z.string().max(240),
  connected: z.boolean()
});
export type SetupIntegrationStateT = z.infer<typeof SetupIntegrationState>;

export const SetupPlanProvider = z.strictObject({
  id: z.string().min(1),
  name: z.string().min(1),
  kind: z.string().min(1),
  // Connection status verbatim from the unified connections view
  // (not_configured / sign_in_required / connected / invalid_key / unreachable /
  // unavailable).
  status: z.string().min(1),
  detail: z.string().max(160),
  routing_available: z.boolean(),
  selected: z.boolean()
});
export type SetupPlanProviderT = z.infer<typeof SetupPlanProvider>;

export const SetupLocalRuntime = z.strictObject({
  recommendation: z.string().min(1).max(240),
  runtime: z.boolean(),
  state: z.string().min(1).max(120)
});
export type SetupLocalRuntimeT = z.infer<typeof SetupLocalRuntime>;

export const SetupPlan = z.strictObject({
  workflowProfile: z.string().min(1).max(120),
  mode: SetupMode,
  modelUse: SetupModelUse,
  executionPolicy: SetupStrictness,
  providers: z.array(SetupPlanProvider).max(12),
  localRuntime: SetupLocalRuntime,
  models: z.array(SetupModelRecommendation).max(3),
  skillFamilies: z.array(SetupSkillFamily).max(8),
  integrations: z.array(SetupIntegrationState).max(4),
  workspace: z.string().min(1),
  projectLocations: z.string().max(500),
  importantWorkflows: z.string().max(2000),
  hardware: SetupHardwareSnapshot,
  generatedAt: z.number().positive()
});
export type SetupPlanT = z.infer<typeof SetupPlan>;

export const SetupRoles = z.strictObject({
  planner: z.string().nullable(),
  coder: z.string().nullable(),
  reviewer: z.string().nullable()
});
export type SetupRolesT = z.infer<typeof SetupRoles>;

export const SetupProfile = z.strictObject({
  version: z.literal(1),
  answers: SetupAnswers,
  skillFamilies: z.array(z.string().min(1).max(64)).max(8),
  selectedModelId: z.string().nullable(),
  roles: SetupRoles,
  hardware: SetupHardwareSnapshot,
  appliedAt: z.number().positive(),
  updatedAt: z.number().positive()
});
export type SetupProfileT = z.infer<typeof SetupProfile>;

export const SetupProfileResponse = z.strictObject({ profile: SetupProfile.nullable() });
export type SetupProfileResponseT = z.infer<typeof SetupProfileResponse>;

export const SetupProfilePutRequest = z.strictObject({
  profile: SetupProfile,
  // Optimistic-concurrency anchor: expectedUpdatedAt must match the persisted
  // profile's updatedAt (or be null when none is persisted yet), otherwise the
  // route responds CONFLICT and no mutation happens.
  expectedUpdatedAt: z.number().nullable()
});
export type SetupProfilePutRequestT = z.infer<typeof SetupProfilePutRequest>;

export const SetupProfileResetRequest = z.strictObject({}).passthrough();
export type SetupProfileResetRequestT = z.infer<typeof SetupProfileResetRequest>;

export const SetupPlanQuery = z.strictObject({
  answers: z.string().min(1).max(4000)
});
export type SetupPlanQueryT = z.infer<typeof SetupPlanQuery>;

export const SetupPlanResponse = z.strictObject({ plan: SetupPlan });
export type SetupPlanResponseT = z.infer<typeof SetupPlanResponse>;

export const SetupReadinessCheck = z.strictObject({
  id: z.string().min(1).max(64),
  label: z.string().min(1).max(120),
  required: z.boolean(),
  ok: z.boolean(),
  detail: z.string().max(240)
});
export type SetupReadinessCheckT = z.infer<typeof SetupReadinessCheck>;

export const SetupReadiness = z.strictObject({
  status: z.enum(['READY', 'DEGRADED', 'ACTION_REQUIRED']),
  checks: z.array(SetupReadinessCheck).max(24),
  profile_applied_at: z.number().nullable(),
  evaluated_at: z.number().positive()
});
export type SetupReadinessT = z.infer<typeof SetupReadiness>;

export const SetupReadinessResponse = z.strictObject({ readiness: SetupReadiness });
export type SetupReadinessResponseT = z.infer<typeof SetupReadinessResponse>;
