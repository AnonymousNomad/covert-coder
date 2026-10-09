import { z } from 'zod';

// P2 — Managed terminal client contract (covert.managed-client.v1).
// Real coding-agent CLIs (Claude Code, Codex, Kimi, OpenCode) run inside
// Covert-owned terminal sessions without replacing the clients or their auth.
// This layer is execution-of-clients management ONLY: it is not Authority,
// not Resource Admission, not a grant, not a capability owner. Governance
// truth classes are honest labels backed by evidence; FULLY_GOVERNED requires
// exact-version negative bypass tests that prove native effect paths are
// mediated. Credentials are never read, copied, or logged by this layer.

export const ManagedClientId = z.enum(['claude-code', 'codex-cli', 'kimi-code', 'opencode', 'gemini-cli', 'qwen-code']);
export const GovernanceTruthClass = z.enum(['FULLY_GOVERNED', 'MANAGED_OBSERVED', 'UNQUALIFIED']);
export const ClientAvailability = z.enum(['AVAILABLE', 'UNAVAILABLE', 'UNKNOWN']);
export const CredentialAvailability = z.enum(['AVAILABLE', 'UNAVAILABLE', 'UNKNOWN']);
export const ClientEvidenceState = z.enum(['LIVE', 'FIXTURE', 'NOT_RUN']);
export const ClientQualificationState = z.enum(['QUALIFIED', 'UNQUALIFIED', 'NOT_EVALUATED']);
export const ClientExecutionSurface = z.enum(['TERMINAL_PTY_DESCRIPTOR', 'OPENCODE_BRIDGE', 'RESEARCH_ONLY']);
export const ClientOwnership = z.enum(['TERMINAL_SESSION_SERVICE', 'OPENCODE_BRIDGE', 'NONE']);
export const ManagedClientCapability = z.enum([
  'INTERACTIVE_PTY_DESCRIPTOR',
  'BRIDGE_RUN_TASK',
  'BRIDGE_RUN_TASK_STREAM',
  'BRIDGE_DISCOVER_MODELS'
]);
export const ManagedSessionLifecycle = z.enum(['STARTING', 'RUNNING', 'CANCELLED', 'EXITED', 'FAILED', 'CLEANUP_UNCERTAIN']);

const SensitiveCredentialMarker = /(?:sk-|hf_|gh[pousr]_|bearer|token=|secret=|password=)/i;
const Ref = z.string().min(1).max(160)
  .refine(value => !SensitiveCredentialMarker.test(value), 'credential material is not allowed in references');
const Sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const ClientVersion = z.string().max(120)
  .refine(value => !SensitiveCredentialMarker.test(value), 'credential material is not allowed in versions');
const ClientExecutablePath = z.string().max(500)
  .refine(value => !SensitiveCredentialMarker.test(value), 'credential material is not allowed in executable paths');
const ProviderModelIdentity = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$/)
  .refine(value => !SensitiveCredentialMarker.test(value), 'credential material is not allowed in provider/model identities');
const EvidenceRef = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/)
  .refine(value => !SensitiveCredentialMarker.test(value));
export const ManagedClientTarget = z.strictObject({
  provider_identity: ProviderModelIdentity,
  model_identity: ProviderModelIdentity
});
export const ClientConformanceCheckName = z.enum([
  'EXECUTION_BOUNDARY',
  'CALLER_BOUNDARY',
  'CREDENTIAL_BOUNDARY',
  'PROCESS_OWNERSHIP',
  'CANCELLATION_TERMINATION',
  'ROUTE_IDENTITY'
]);

export const ClientConformanceEvidence = z.strictObject({
  client_id: ManagedClientId,
  evidence_state: z.enum(['LIVE', 'FIXTURE']),
  version_evaluated: ClientVersion.nullable(),
  executable_sha256_evaluated: Sha256.nullable(),
  provider_identity: ProviderModelIdentity.nullable(),
  model_identity: ProviderModelIdentity.nullable(),
  checks: z.array(z.strictObject({
    name: ClientConformanceCheckName,
    passed: z.boolean(),
    evidence_ref: EvidenceRef
  })).max(12),
  negative_bypass_tests: z.array(z.strictObject({
    name: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/),
    passed: z.boolean(),
    evidence_ref: EvidenceRef
  })).max(32)
}).superRefine((value, context) => {
  const checkNames = value.checks.map(check => check.name);
  if (new Set(checkNames).size !== checkNames.length) {
    context.addIssue({ code: 'custom', message: 'duplicate conformance check', path: ['checks'] });
  }
});

export const ManagedClientDiscovery = z.strictObject({
  client_id: ManagedClientId,
  detected: z.boolean(),
  availability: ClientAvailability,
  availability_reason: z.enum(['NOT_INSTALLED', 'PROBE_NOT_REGISTERED', 'PROBE_FAILED', 'INVALID_PROBE_RESULT']).nullable(),
  executable_path: ClientExecutablePath.nullable(),
  exact_version: ClientVersion.nullable(),
  executable_sha256: Sha256.nullable(),
  credential_availability: CredentialAvailability,
  credential_owner: z.enum(['CLIENT', 'OPENCODE', 'NONE']),
  provider_identity: ProviderModelIdentity.nullable(),
  model_identity: ProviderModelIdentity.nullable(),
  governance_state: GovernanceTruthClass,
  supported_capabilities: z.array(ManagedClientCapability).max(4),
  provider_qualification_state: ClientQualificationState,
  execution_surface: ClientExecutionSurface,
  ownership: ClientOwnership,
  evidence_state: ClientEvidenceState
}).superRefine((value, context) => {
  if (value.detected !== (value.availability === 'AVAILABLE')) {
    context.addIssue({ code: 'custom', message: 'detected must match AVAILABLE state', path: ['detected'] });
  }
  if (value.availability === 'AVAILABLE' && value.executable_path === null) {
    context.addIssue({ code: 'custom', message: 'available clients require an executable path', path: ['executable_path'] });
  }
  if (value.availability !== 'AVAILABLE' &&
      (value.executable_path !== null || value.exact_version !== null || value.executable_sha256 !== null)) {
    context.addIssue({ code: 'custom', message: 'unavailable clients cannot carry executable identity', path: ['availability'] });
  }
  if ((value.availability === 'AVAILABLE') !== (value.availability_reason === null)) {
    context.addIssue({ code: 'custom', message: 'availability reason must match availability state', path: ['availability_reason'] });
  }
  if (value.availability === 'UNAVAILABLE' && value.availability_reason !== 'NOT_INSTALLED') {
    context.addIssue({ code: 'custom', message: 'unavailable clients require NOT_INSTALLED reason', path: ['availability_reason'] });
  }
  if (value.availability === 'UNKNOWN' &&
      value.availability_reason !== 'PROBE_NOT_REGISTERED' &&
      value.availability_reason !== 'PROBE_FAILED' && value.availability_reason !== 'INVALID_PROBE_RESULT') {
    context.addIssue({ code: 'custom', message: 'unknown clients require a probe failure reason', path: ['availability_reason'] });
  }
  if (value.availability_reason === 'PROBE_NOT_REGISTERED' && value.evidence_state !== 'NOT_RUN') {
    context.addIssue({ code: 'custom', message: 'unregistered probes cannot carry evidence', path: ['evidence_state'] });
  }
});

// Probe output is deliberately value-free with respect to credentials. A
// probe may report a supported auth-status result, but never secret material.
export const ManagedClientProbeResult = z.strictObject({
  executable_path: ClientExecutablePath.refine(value => value.length > 0),
  exact_version: ClientVersion.nullable(),
  executable_sha256: Sha256.nullable(),
  credential_availability: CredentialAvailability.optional(),
  provider_identity: ProviderModelIdentity.nullable().optional(),
  model_identity: ProviderModelIdentity.nullable().optional()
});

export const ManagedLaunchDescriptor = z.strictObject({
  client_id: ManagedClientId,
  executable_path: ClientExecutablePath,
  arguments: z.array(z.string().max(300)).max(32),
  tool_restrictions: z.array(z.string().max(200)).max(32),
  tui_visible: z.literal(true),
  declaration_only: z.literal(true),
  supported_capabilities: z.array(ManagedClientCapability).max(4),
  execution_surface: z.literal('TERMINAL_PTY_DESCRIPTOR'),
  ownership: z.literal('TERMINAL_SESSION_SERVICE'),
  credential_availability: CredentialAvailability,
  credential_owner: z.enum(['CLIENT', 'OPENCODE', 'NONE']),
  provider_identity: ProviderModelIdentity.nullable(),
  model_identity: ProviderModelIdentity.nullable(),
  provider_qualification_state: ClientQualificationState,
  lifecycle_owner: z.literal('TERMINAL_SESSION_SERVICE'),
  cancellation_semantics: z.literal('OWNER_STOP'),
  timeout_semantics: z.literal('NOT_ENFORCED_BY_DESCRIPTOR'),
  governance_state: GovernanceTruthClass,
  evidence_state: ClientEvidenceState,
  notes: z.array(z.string().max(300)).max(8)
});

export const ManagedClientSession = z.strictObject({
  schema: z.literal('covert.managed-client.v1'),
  client_id: ManagedClientId,
  exact_version: ClientVersion.nullable(),
  executable_sha256: Sha256.nullable(),
  project: z.strictObject({ project_id: z.string().uuid(), checkout_id: z.string().uuid() }),
  principal_id: Ref,
  mission_ref: Ref.nullable(),
  model_identity: ProviderModelIdentity.nullable(),
  provider_identity: ProviderModelIdentity.nullable(),
  truth_class: GovernanceTruthClass,
  provider_qualification_state: ClientQualificationState,
  execution_surface: ClientExecutionSurface,
  ownership: ClientOwnership,
  evidence_state: ClientEvidenceState,
  truth_evidence_refs: z.array(EvidenceRef).max(32),
  lifecycle: ManagedSessionLifecycle,
  cleanup_confirmed: z.boolean()
});

export const ConformanceVerdict = z.strictObject({
  client_id: ManagedClientId,
  verdict: GovernanceTruthClass,
  provider_qualification_state: ClientQualificationState,
  provider_identity: ProviderModelIdentity.nullable(),
  model_identity: ProviderModelIdentity.nullable(),
  evidence_state: ClientEvidenceState,
  reasons: z.array(z.enum([
    'NOT_DETECTED',
    'VERSION_MISMATCH',
    'NEGATIVE_BYPASS_TESTS_MISSING',
    'NEGATIVE_BYPASS_TESTS_FAILED',
    'MEDIATION_CHECKS_FAILED',
    'EXACT_VERSION_EVIDENCE_MISSING',
    'RESEARCH_ONLY_CLIENT',
    'NOT_YET_EVALUATED',
    'CLIENT_AVAILABILITY_UNKNOWN',
    'CLIENT_PROBE_NOT_REGISTERED',
    'CLIENT_PROBE_FAILED',
    'CLIENT_PROBE_INVALID',
    'INVALID_EVIDENCE',
    'CLIENT_ID_MISMATCH',
    'EXECUTABLE_MISMATCH',
    'PROVIDER_MODEL_MISMATCH',
    'IDENTITY_UNOBSERVED',
    'FIXTURE_EVIDENCE_ONLY',
    'REQUIRED_CHECKS_MISSING',
    'CREDENTIAL_UNAVAILABLE',
    'CREDENTIAL_STATE_UNKNOWN',
    'LIVE_EVIDENCE_NOT_VERIFIED'
  ])).max(8),
  evidence_refs: z.array(EvidenceRef).max(32)
});

export type ManagedClientIdT = z.infer<typeof ManagedClientId>;
export type GovernanceTruthClassT = z.infer<typeof GovernanceTruthClass>;
export type ClientAvailabilityT = z.infer<typeof ClientAvailability>;
export type CredentialAvailabilityT = z.infer<typeof CredentialAvailability>;
export type ClientEvidenceStateT = z.infer<typeof ClientEvidenceState>;
export type ClientQualificationStateT = z.infer<typeof ClientQualificationState>;
export type ClientExecutionSurfaceT = z.infer<typeof ClientExecutionSurface>;
export type ClientOwnershipT = z.infer<typeof ClientOwnership>;
export type ManagedClientCapabilityT = z.infer<typeof ManagedClientCapability>;
export type ManagedClientDiscoveryT = z.infer<typeof ManagedClientDiscovery>;
export type ManagedClientProbeResultT = z.infer<typeof ManagedClientProbeResult>;
export type ManagedClientTargetT = z.infer<typeof ManagedClientTarget>;
export type ManagedLaunchDescriptorT = z.infer<typeof ManagedLaunchDescriptor>;
export type ManagedClientSessionT = z.infer<typeof ManagedClientSession>;
export type ClientConformanceEvidenceT = z.infer<typeof ClientConformanceEvidence>;
export type ConformanceVerdictT = z.infer<typeof ConformanceVerdict>;

const target1 = Object.freeze({
  tier: 'TARGET_1' as const,
  default_truth: 'MANAGED_OBSERVED' as const,
  provider_qualification_state: 'NOT_EVALUATED' as const,
  supported_capabilities: Object.freeze(['INTERACTIVE_PTY_DESCRIPTOR'] as const),
  execution_surface: 'TERMINAL_PTY_DESCRIPTOR' as const,
  ownership: 'TERMINAL_SESSION_SERVICE' as const,
  credential_owner: 'CLIENT' as const
});
const bridge = Object.freeze({
  tier: 'BRIDGE' as const,
  default_truth: 'MANAGED_OBSERVED' as const,
  provider_qualification_state: 'NOT_EVALUATED' as const,
  supported_capabilities: Object.freeze(['BRIDGE_RUN_TASK', 'BRIDGE_RUN_TASK_STREAM', 'BRIDGE_DISCOVER_MODELS'] as const),
  execution_surface: 'OPENCODE_BRIDGE' as const,
  ownership: 'OPENCODE_BRIDGE' as const,
  credential_owner: 'OPENCODE' as const
});
const research = Object.freeze({
  tier: 'RESEARCH' as const,
  default_truth: 'UNQUALIFIED' as const,
  provider_qualification_state: 'UNQUALIFIED' as const,
  supported_capabilities: Object.freeze([] as const),
  execution_surface: 'RESEARCH_ONLY' as const,
  ownership: 'NONE' as const,
  credential_owner: 'CLIENT' as const
});

// Availability, installation, and model/provider declarations never promote
// qualification or governance. OpenCode reuses its existing bridge; Gemini and
// Qwen remain research-only and unqualified.
export const CLIENT_MATRIX = Object.freeze({
  'claude-code': target1,
  'codex-cli': target1,
  'kimi-code': target1,
  opencode: bridge,
  'gemini-cli': research,
  'qwen-code': research
}) satisfies Record<ManagedClientIdT, {
  tier: 'TARGET_1' | 'BRIDGE' | 'RESEARCH';
  default_truth: GovernanceTruthClassT;
  provider_qualification_state: ClientQualificationStateT;
  supported_capabilities: readonly ManagedClientCapabilityT[];
  execution_surface: ClientExecutionSurfaceT;
  ownership: ClientOwnershipT;
  credential_owner: 'CLIENT' | 'OPENCODE' | 'NONE';
}>;
