import { z } from 'zod';
import { ConnectionsViewResponse } from './connections.ts';

const SafeRef = z.string().min(1).max(240);
const Sha256 = z.string().regex(/^[a-f0-9]{64}$/i);

export const ModelAccessQualificationState = z.enum([
  'UNTESTED', 'TESTED', 'QUALIFIED', 'NOT_QUALIFIED', 'INVALID_EVIDENCE', 'STALE', 'REQUIRES_PREFLIGHT'
]);
export const ModelAccessAvailability = z.enum([
  'UNAVAILABLE', 'DISCOVERED', 'AVAILABLE', 'INSTALLED', 'CONNECTED', 'LOADABLE'
]);
export const ModelArtifactCompatibility = z.enum(['COMPATIBLE', 'INCOMPATIBLE', 'UNKNOWN']);
export const ModelArtifactHashState = z.enum(['VERIFIED', 'EXPECTED', 'NOT_COMPUTED', 'MISMATCH']);
export const ModelArtifactSourceKind = z.enum(['LOCAL_MANIFEST', 'LOCAL_IMPORT', 'LOCAL_DISCOVERY', 'MODEL_CATALOG']);
export const ModelAccessHealth = z.enum(['HEALTHY', 'UNHEALTHY', 'UNKNOWN', 'UNAVAILABLE']);
export const ModelAccessSetupState = z.enum([
  'READY', 'SETUP_REQUIRED', 'VERIFICATION_REQUIRED', 'CONSENT_REQUIRED', 'REMEDIATION_REQUIRED', 'UNAVAILABLE', 'NOT_APPLICABLE'
]);
export const ModelExecutionAdapterKind = z.enum([
  'DIRECT_HTTP', 'OPENCODE', 'CODEX_CLI', 'CLAUDE_CLI', 'LOCAL_RUNTIME'
]);
export const ModelExecutionAdapterImplementation = z.enum(['IMPLEMENTED', 'CONTRACT_ONLY']);

export const ModelQualificationBasis = z.strictObject({
  source_revision: z.string().max(240).nullable(),
  artifact_sha256: Sha256.nullable(),
  runtime_id: SafeRef.nullable(),
  runtime_version: z.string().max(120).nullable()
});

export const ModelAccessIdentity = z.strictObject({
  canonical_id: SafeRef,
  display_name: z.string().min(1).max(240),
  family: z.string().max(120).nullable(),
  capabilities: z.array(z.string().max(64)),
  context_window_tokens: z.number().int().positive().nullable(),
  qualification: z.strictObject({
    state: ModelAccessQualificationState,
    basis: ModelQualificationBasis.nullable(),
    stale_reasons: z.array(z.string().max(80))
  })
});

export const ModelArtifactSource = z.strictObject({
  id: SafeRef,
  model_id: SafeRef,
  source_kind: ModelArtifactSourceKind,
  source_ref: z.string().max(240).nullable(),
  revision: z.string().max(240).nullable(),
  filename: z.string().max(240).nullable(),
  format: z.string().max(40).nullable(),
  quantization: z.string().max(40).nullable(),
  expected_sha256: Sha256.nullable(),
  observed_sha256: Sha256.nullable(),
  hash_status: ModelArtifactHashState,
  license: z.string().max(120).nullable(),
  availability: ModelAccessAvailability,
  compatibility: ModelArtifactCompatibility
});

export const ModelCredentialSource = z.strictObject({
  id: SafeRef,
  kind: z.enum([
    'API_KEY_VAULT', 'SUBSCRIPTION_ACCOUNT', 'OFFICIAL_CLI_AUTH',
    'OPENCODE_MANAGED_AUTH', 'OAUTH_SESSION', 'LOCAL_NONE', 'UNKNOWN'
  ]),
  authentication_mode: z.enum([
    'API_KEY', 'SUBSCRIPTION_LOGIN', 'OFFICIAL_CLI', 'OPENCODE_MANAGED',
    'OAUTH_ACCOUNT', 'NONE', 'UNKNOWN'
  ]),
  configuration_state: z.enum(['NOT_REQUIRED', 'MISSING', 'CONFIGURED', 'INVALID', 'UNKNOWN']),
  setup_required: z.boolean()
});

export const ModelExecutionAdapter = z.strictObject({
  id: SafeRef,
  kind: ModelExecutionAdapterKind,
  implementation: ModelExecutionAdapterImplementation,
  discovered: z.boolean().nullable(),
  configured: z.boolean(),
  available: z.boolean(),
  canonical_default: z.boolean()
});

export const ModelProviderRoute = z.strictObject({
  id: SafeRef,
  model_id: SafeRef,
  provider_id: SafeRef,
  connection_id: SafeRef,
  provider_model_id: SafeRef,
  credential_source_id: SafeRef.nullable(),
  execution_adapter_id: SafeRef,
  model_support_state: z.enum(['VERIFIED', 'UNKNOWN', 'UNSUPPORTED']),
  configured: z.boolean(),
  health: ModelAccessHealth,
  available: z.boolean(),
  external_egress_required: z.boolean(),
  operator_setup_required: z.boolean(),
  setup_state: ModelAccessSetupState,
  selected_roles: z.array(z.string().max(64))
});

export const ModelManagerReadiness = z.enum(['READY', 'NOT_READY', 'SETUP_REQUIRED', 'UNAVAILABLE', 'UNKNOWN']);
export const ModelManagerModel = z.strictObject({
  identity: ModelAccessIdentity,
  artifact_ids: z.array(SafeRef),
  availability: ModelAccessAvailability,
  compatibility: ModelArtifactCompatibility,
  readiness: ModelManagerReadiness,
  recommended_roles: z.array(z.string().max(64)),
  execution_selected_roles: z.array(z.string().max(64))
});

export const ModelManagerRuntime = z.strictObject({
  canonical_runtime_id: z.literal('unsloth'),
  default_runtime_id: z.literal('unsloth'),
  reported_backend: z.enum(['UNSLOTH', 'LLAMA_CPP']).nullable(),
  discovered_state: z.enum(['DISCOVERED', 'NOT_DISCOVERED', 'UNKNOWN']),
  configured_runtime_id: SafeRef.nullable(),
  configured: z.boolean(),
  available: z.boolean(),
  health: z.enum(['HEALTHY', 'UNHEALTHY', 'STOPPED', 'NOT_INSTALLED', 'UNKNOWN']),
  selected_model_id: SafeRef.nullable()
});

export const ModelManagerLocalDiscovery = z.strictObject({
  status: z.enum(['AVAILABLE', 'PARTIAL', 'FAILED']),
  scanned_dirs: z.number().int().nonnegative(),
  discovered_count: z.number().int().nonnegative(),
  error_count: z.number().int().nonnegative()
});

export const ModelManagerSelectionPolicy = z.strictObject({
  persistence_state: z.literal('NOT_PERSISTED'),
  mutation_enabled: z.literal(false),
  execution_routing_effect: z.literal(false),
  scopes: z.array(z.enum(['GLOBAL', 'PROJECT', 'ROLE'])),
  roles: z.array(z.enum(['PLANNING', 'IMPLEMENTATION', 'REVIEW', 'UTILITY', 'BACKGROUND'])),
  precedence: z.tuple([
    z.literal('PROJECT_ROLE'),
    z.literal('PROJECT_DEFAULT'),
    z.literal('GLOBAL_ROLE'),
    z.literal('GLOBAL_DEFAULT')
  ])
});

export const ModelManagerResponse = z.strictObject({
  generated_at: z.string().datetime(),
  public_safe: z.literal(true),
  local_discovery: ModelManagerLocalDiscovery,
  runtime: ModelManagerRuntime,
  models: z.array(ModelManagerModel),
  artifacts: z.array(ModelArtifactSource),
  routes: z.array(ModelProviderRoute),
  credential_sources: z.array(ModelCredentialSource),
  execution_adapters: z.array(ModelExecutionAdapter),
  connections: ConnectionsViewResponse,
  selection_policy: ModelManagerSelectionPolicy
});

export type ModelAccessIdentityT = z.infer<typeof ModelAccessIdentity>;
export type ModelArtifactSourceT = z.infer<typeof ModelArtifactSource>;
export type ModelProviderRouteT = z.infer<typeof ModelProviderRoute>;
export type ModelCredentialSourceT = z.infer<typeof ModelCredentialSource>;
export type ModelExecutionAdapterT = z.infer<typeof ModelExecutionAdapter>;
export type ModelManagerResponseT = z.infer<typeof ModelManagerResponse>;
