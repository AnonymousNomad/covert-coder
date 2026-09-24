import { z } from 'zod';

const SafeRef = z.string().min(1).max(240);

export const ModelManagerQuery = z.strictObject({
  role: z.string().min(1).max(64).optional(),
  offline: z.enum(['true', 'false']).optional()
});

export const ModelManagerResourceFit = z.enum(['FIT', 'INCOMPATIBLE', 'UNKNOWN']);

export const ModelManagerEntry = z.strictObject({
  id: z.string().min(1).max(128),
  display_name: z.string().min(1).max(240),
  family: z.string().max(120).nullable(),
  provider: z.string().min(1).max(120),
  locality: z.enum(['LOCAL', 'CLOUD']),
  availability: z.enum(['UNAVAILABLE', 'DISCOVERED', 'AVAILABLE', 'INSTALLED', 'CONNECTED', 'LOADABLE']),
  provider_state: z.enum(['CONFIGURED_NOT_VERIFIED', 'AUTHENTICATED', 'AUTH_FAILURE', 'UNAVAILABLE']).nullable(),
  offline_capable: z.boolean(),
  qualification: z.strictObject({
    state: z.enum(['UNTESTED', 'TESTED', 'QUALIFIED', 'NOT_QUALIFIED', 'INVALID_EVIDENCE', 'STALE']),
    qualified_roles: z.array(z.string().max(64)),
    unqualified_roles: z.array(z.string().max(64)),
    evidence_refs: z.array(SafeRef),
    stale: z.boolean(),
    stale_reasons: z.array(z.string().max(80))
  }),
  artifact: z.strictObject({
    label: z.string().max(240).nullable(),
    revision: z.string().max(240).nullable(),
    hash: z.string().max(128).nullable(),
    hash_status: z.enum(['verified', 'not_computed', 'mismatch']).nullable(),
    format: z.string().max(40).nullable(),
    quantization: z.string().max(40).nullable()
  }),
  runtime_backend: z.string().max(80).nullable(),
  resource_requirements: z.strictObject({
    ram_mb: z.number().nonnegative().nullable(),
    vram_mb: z.number().nonnegative().nullable(),
    disk_mb: z.number().nonnegative().nullable()
  }).nullable(),
  resource_fit: ModelManagerResourceFit,
  passport_ref: SafeRef.nullable(),
  evidence_refs: z.array(SafeRef),
  known_strengths: z.array(z.string().max(240)),
  known_failures: z.array(z.string().max(240))
});

export const ModelManagerRecommendationReason = z.enum([
  'ROLE_QUALIFIED', 'ROLE_NOT_QUALIFIED', 'LOCAL_AVAILABLE', 'OFFLINE_CAPABLE',
  'LOW_RESOURCE_FIT', 'RESOURCE_INCOMPATIBLE', 'LOWER_COST', 'PAST_PROJECT_SUCCESS',
  'LOW_OPERATOR_INTERVENTION', 'KNOWN_TOOL_RELIABILITY', 'KNOWN_REVIEW_STRENGTH',
  'INSUFFICIENT_EVIDENCE', 'PROVIDER_NOT_AUTHENTICATED'
]);

const RecommendationCandidate = z.strictObject({
  id: z.string().min(1).max(128),
  display_name: z.string().min(1).max(240),
  reasons: z.array(ModelManagerRecommendationReason),
  evidence_refs: z.array(SafeRef),
  confidence: z.enum(['QUALIFIED', 'SUPPORTED_BY_LIMITED_EVIDENCE', 'EXPERIMENTAL', 'NO_QUALIFICATION_DATA'])
});

export const ModelManagerRecommendation = z.strictObject({
  role: z.string().min(1).max(64),
  offline_only: z.boolean(),
  recommended: z.array(RecommendationCandidate),
  alternatives: z.array(RecommendationCandidate),
  excluded: z.array(z.strictObject({ id: z.string().min(1).max(128), reasons: z.array(ModelManagerRecommendationReason) }))
});

export const ModelManagerProvider = z.strictObject({
  id: z.string().min(1).max(80),
  state: z.enum(['CONFIGURED_NOT_VERIFIED', 'AUTHENTICATED', 'AUTH_FAILURE', 'UNAVAILABLE']),
  model_ids: z.array(z.string().max(128))
});

export const ModelPackInstallationState = z.enum([
  'INSTALLED', 'AVAILABLE_LOCALLY', 'MISSING', 'MISSING_ARTIFACT', 'PROVIDER_CONNECTION_REQUIRED', 'SOURCE_ONLY'
]);

export const ModelPackMemberReference = z.strictObject({
  model_id: z.string().min(1).max(128),
  roles: z.array(z.string().min(1).max(64))
});

export const ModelPackRuntimeRequirement = z.strictObject({
  runtime_id: z.string().min(1).max(80),
  health_required: z.boolean(),
  capabilities: z.array(z.enum(['tools', 'metrics', 'unload']))
});

export const ModelPackResourceExpectations = z.strictObject({
  ram_mb: z.number().nonnegative().nullable(),
  vram_mb: z.number().nonnegative().nullable(),
  disk_mb: z.number().nonnegative().nullable()
});

// Bundle composition references artifact candidates in the existing
// models/manifest.json catalog. Artifact, source, and license facts remain in
// that catalog; model identity, availability, and qualification remain in the
// Intelligence Registry.
export const ModelPackDefinition = z.strictObject({
  id: z.string().min(1).max(128),
  version: z.string().min(1).max(80),
  display_name: z.string().min(1).max(240),
  summary: z.string().max(500),
  required_models: z.array(ModelPackMemberReference).min(1),
  optional_models: z.array(ModelPackMemberReference),
  provider_dependencies: z.array(z.string().min(1).max(80)),
  runtime_requirements: z.array(ModelPackRuntimeRequirement),
  qualification_requirements: z.array(ModelPackMemberReference),
  resource_expectations: ModelPackResourceExpectations
});

export const ModelPackLifecycleState = z.enum([
  'AVAILABLE', 'PARTIALLY_INSTALLED', 'INSTALLED', 'MISSING_ARTIFACT',
  'MISSING_PROVIDER', 'RESOURCE_INCOMPATIBLE', 'QUALIFICATION_REQUIRED',
  'RUNTIME_UNAVAILABLE', 'READY'
]);

export const ModelPackBundleMember = z.strictObject({
  model_id: z.string().min(1).max(128),
  required: z.boolean(),
  roles: z.array(z.string().min(1).max(64)),
  display_name: z.string().max(240).nullable(),
  source_repo: z.string().max(240).nullable(),
  artifact_filename: z.string().max(240).nullable(),
  artifact_revision: z.string().max(240).nullable(),
  expected_sha256: z.string().regex(/^[a-f0-9]{64}$/i).nullable(),
  declared_license: z.string().max(120).nullable(),
  installation_state: ModelPackInstallationState,
  qualification_state: z.enum(['UNTESTED', 'TESTED', 'QUALIFIED', 'NOT_QUALIFIED', 'INVALID_EVIDENCE', 'STALE']).nullable(),
  qualified_roles: z.array(z.string().max(64)),
  resource_fit: ModelManagerResourceFit,
  evidence_refs: z.array(SafeRef)
});

export const ModelPackBundleView = ModelPackDefinition.extend({
  state: ModelPackLifecycleState,
  installation_state: z.enum(['AVAILABLE', 'PARTIALLY_INSTALLED', 'INSTALLED']),
  qualification_state: z.enum(['QUALIFIED', 'QUALIFICATION_REQUIRED', 'NOT_QUALIFIED', 'UNKNOWN']),
  members: z.array(ModelPackBundleMember),
  block_reasons: z.array(z.string().max(80))
});

export const ModelPackItem = z.strictObject({
  id: z.string().min(1).max(128),
  display_name: z.string().min(1).max(240),
  intended_role: z.string().max(80),
  source_repo: z.string().max(240),
  declared_license: z.string().max(120),
  artifact_label: z.string().max(240).nullable(),
  expected_sha256: z.string().regex(/^[a-f0-9]{64}$/i).nullable(),
  expected_size_bytes: z.number().nonnegative().nullable(),
  installation_state: ModelPackInstallationState,
  qualification_state: z.enum(['UNTESTED', 'TESTED', 'QUALIFIED', 'NOT_QUALIFIED', 'INVALID_EVIDENCE', 'STALE']).nullable(),
  qualified_roles: z.array(z.string().max(64)),
  resource_fit: ModelManagerResourceFit,
  matched_model_id: z.string().max(128).nullable(),
  evidence_refs: z.array(SafeRef)
});

export const ModelPackBundle = z.strictObject({
  id: z.string().min(1).max(128),
  display_name: z.string().min(1).max(240),
  state: z.enum(['INSTALLED', 'AVAILABLE_LOCALLY', 'MISSING_DEPENDENCY', 'PROVIDER_CONNECTION_REQUIRED', 'RESOURCE_INCOMPATIBLE']),
  qualification_state: z.enum(['QUALIFIED', 'QUALIFICATION_MISSING', 'UNKNOWN']),
  dependency_ids: z.array(z.string().max(128)),
  installation_available: z.literal(false)
});

export const ModelPackInstallRequest = z.strictObject({
  model_id: z.string().min(1).max(128),
  source_path: z.string().min(1).max(2048)
});

export const ModelPackInstallResponse = z.strictObject({
  model_id: z.string().min(1).max(128),
  installed: z.literal(true),
  idempotent: z.boolean(),
  destination_filename: z.string().min(1).max(240),
  artifact_sha256: z.string().regex(/^[a-f0-9]{64}$/i),
  identity_verification: z.enum(['EXPECTED_HASH_MATCH', 'SOURCE_COPY_HASH_MATCH']),
  availability: z.literal('INSTALLED'),
  qualification_state: z.enum(['UNTESTED', 'TESTED', 'QUALIFIED', 'NOT_QUALIFIED', 'INVALID_EVIDENCE', 'STALE']),
  qualification_changed: z.boolean(),
  runtime: z.literal('UNSLOTH')
});

export const ModelSelectionRequestInput = z.strictObject({
  requested_role: z.string().min(1).max(64),
  selected_model_id: z.string().min(1).max(128),
  operator_override: z.boolean()
});

export const ModelSelectionBlockReason = z.enum([
  'MODEL_UNAVAILABLE', 'MISSING_ARTIFACT', 'MISSING_PROVIDER',
  'RESOURCE_INCOMPATIBLE', 'RUNTIME_UNAVAILABLE',
  'QUALIFICATION_INVALID_OR_STALE'
]);

export const ModelSelectionRequest = z.strictObject({
  requested_role: z.string().min(1).max(64),
  selected_intelligence_id: z.string().min(1).max(128),
  artifact_identity: z.strictObject({
    locality: z.enum(['LOCAL', 'CLOUD']),
    artifact_id: z.string().min(1).max(240),
    revision: z.string().max(240).nullable(),
    sha256: z.string().max(128).nullable(),
    hash_status: z.enum(['verified', 'not_computed', 'mismatch']).nullable()
  }),
  qualification_state: z.enum(['UNTESTED', 'TESTED', 'QUALIFIED', 'NOT_QUALIFIED', 'INVALID_EVIDENCE', 'STALE']),
  operator_override: z.boolean(),
  recommendation_evidence: z.array(SafeRef),
  reason_codes: z.array(ModelManagerRecommendationReason),
  scope: z.strictObject({ project_id: z.string().regex(/^sha256:[a-f0-9]{64}$/), mission_id: z.null() }),
  created_at: z.string().datetime()
});

export const ModelSelectionRequestResponse = z.strictObject({
  decision: z.enum(['RECOMMENDED', 'OPERATOR_SELECTED', 'SYSTEM_BLOCKED']),
  selection_request: ModelSelectionRequest.nullable(),
  block_reasons: z.array(ModelSelectionBlockReason),
  routing_applied: z.literal(false),
  authority_evaluated: z.literal(false),
  resource_admission_evaluated: z.literal(false)
});

export const ModelPackHybridSetup = z.strictObject({
  state: z.enum(['READY', 'LOCAL_MODEL_REQUIRED', 'PROVIDER_CONNECTION_REQUIRED', 'QUALIFICATION_MISSING', 'RESOURCE_INCOMPATIBLE']),
  qualified_local_implementers: z.number().int().nonnegative(),
  qualified_connected_cloud_reviewers: z.number().int().nonnegative(),
  configuration_only: z.literal(true)
});

export const ModelManagerRuntime = z.strictObject({
  canonical_name: z.literal('UNSLOTH'),
  registered: z.boolean(),
  health: z.enum(['HEALTHY', 'UNHEALTHY', 'UNKNOWN', 'UNAVAILABLE']),
  health_detail: z.string().max(240).nullable(),
  version: z.string().max(120).nullable(),
  ownership: z.string().max(120).nullable(),
  loaded_models: z.array(z.strictObject({ id: z.string().min(1).max(128), loaded: z.boolean(), context_tokens: z.number().int().positive().nullable() })),
  metrics: z.record(z.string().max(80), z.number()),
  capabilities: z.strictObject({ tools: z.boolean().nullable(), metrics: z.boolean().nullable(), unload: z.boolean().nullable() }).nullable()
});

export const ModelManagerDeveloperNote = z.strictObject({
  kind: z.literal('developer-note'),
  source: z.literal('DEVELOPER_NOTES — James Ferrell'),
  note_id: z.string().min(1).max(120),
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(1200),
  category: z.enum(['CONTEXT', 'MODELS', 'COST', 'LOCAL_AI', 'WORKFLOW', 'VERIFICATION', 'DEBUGGING']),
  trigger: z.string().max(100).nullable(),
  priority: z.number().int(),
  dismissible: z.literal(true),
  active: z.literal(true)
});

export const ModelManagerSystemAdvisory = z.strictObject({
  kind: z.literal('system-advisory'),
  id: z.string().min(1).max(160),
  severity: z.enum(['INFO', 'CAUTION', 'BLOCKING']),
  title: z.string().min(1).max(200),
  detail: z.string().min(1).max(600),
  evidence_refs: z.array(SafeRef)
});

// Curated developer workflow guidance is kept distinct from evidence-driven
// recommendations and system-state advisories.
export const ModelManagerDeveloperSpecial = z.strictObject({
  kind: z.literal('developer-special'),
  source: z.literal('DEVELOPER_SPECIALS — James Ferrell'),
  id: z.string().min(1).max(120),
  name: z.string().min(1).max(200),
  category: z.enum(['HIGH_VOLUME_ENGINEERING', 'LOW_COST_DEVELOPMENT', 'LOCAL_FIRST', 'PLANNING', 'INDEPENDENT_REVIEW', 'OFFLINE_WORK']),
  purpose: z.string().min(1).max(600),
  roles: z.array(z.string().min(1).max(64)),
  model_ids: z.array(SafeRef),
  providers: z.array(SafeRef),
  placement: z.enum(['LOCAL', 'CLOUD', 'MIXED', 'UNSPECIFIED']),
  artifact: SafeRef.nullable(),
  summary: z.string().min(1).max(600),
  why_used: z.string().min(1).max(600),
  cost_notes: z.string().min(1).max(600),
  context_notes: z.string().min(1).max(600),
  known_limitations: z.array(z.string().min(1).max(300)),
  last_reviewed: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
});

export const ModelManagerSnapshotResponse = z.strictObject({
  generated_at: z.string().datetime(),
  public_safe: z.literal(true),
  available_ram_mb: z.number().nonnegative().nullable(),
  local_discovery: z.strictObject({ status: z.enum(['AVAILABLE', 'PARTIAL', 'FAILED']), scanned_dirs: z.number().int().nonnegative(), discovered_count: z.number().int().nonnegative(), error_count: z.number().int().nonnegative() }),
  provider_probe: z.enum(['AVAILABLE', 'FAILED']),
  models: z.array(ModelManagerEntry),
  providers: z.array(ModelManagerProvider),
  recommendation: ModelManagerRecommendation,
  model_packs: z.strictObject({
    catalog_status: z.enum(['AVAILABLE', 'UNAVAILABLE']),
    items: z.array(ModelPackItem),
    bundles: z.array(ModelPackBundleView),
    offline_bundle: ModelPackBundle,
    hybrid_setup: ModelPackHybridSetup
  }),
  runtime: ModelManagerRuntime,
  developer_notes: z.array(ModelManagerDeveloperNote),
  system_advisories: z.array(ModelManagerSystemAdvisory)
});

export type ModelManagerEntryT = z.infer<typeof ModelManagerEntry>;
export type ModelManagerSnapshotResponseT = z.infer<typeof ModelManagerSnapshotResponse>;
export type ModelManagerProviderT = z.infer<typeof ModelManagerProvider>;
export type ModelManagerRuntimeT = z.infer<typeof ModelManagerRuntime>;
export type ModelPackDefinitionT = z.infer<typeof ModelPackDefinition>;
export type ModelPackBundleViewT = z.infer<typeof ModelPackBundleView>;
export type ModelPackInstallRequestT = z.infer<typeof ModelPackInstallRequest>;
export type ModelPackInstallResponseT = z.infer<typeof ModelPackInstallResponse>;
export type ModelSelectionRequestInputT = z.infer<typeof ModelSelectionRequestInput>;
export type ModelSelectionRequestResponseT = z.infer<typeof ModelSelectionRequestResponse>;
export type ModelManagerDeveloperSpecialT = z.infer<typeof ModelManagerDeveloperSpecial>;
