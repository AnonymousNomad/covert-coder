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
export const ClientAuthState = z.enum(['DETECTED', 'NOT_DETECTED', 'UNKNOWN']);
export const ManagedSessionLifecycle = z.enum(['STARTING', 'RUNNING', 'CANCELLED', 'EXITED', 'FAILED', 'CLEANUP_UNCERTAIN']);

const Ref = z.string().min(1).max(160);
const Sha256 = z.string().regex(/^[a-f0-9]{64}$/);

export const ManagedClientDiscovery = z.strictObject({
  client_id: ManagedClientId,
  detected: z.boolean(),
  executable_path: z.string().max(500).nullable(),
  exact_version: z.string().max(120).nullable(),
  executable_sha256: Sha256.nullable(),
  auth_state: ClientAuthState
});

export const ManagedLaunchDescriptor = z.strictObject({
  client_id: ManagedClientId,
  // Declarations only — launching happens through TerminalSessionService and
  // the owned-process lifecycle, never through this contract.
  executable_path: z.string().max(500),
  arguments: z.array(z.string().max(300)).max(32),
  tool_restrictions: z.array(z.string().max(200)).max(32),
  tui_visible: z.literal(true),
  notes: z.array(z.string().max(300)).max(8)
});

export const ManagedClientSession = z.strictObject({
  schema: z.literal('covert.managed-client.v1'),
  client_id: ManagedClientId,
  exact_version: z.string().max(120).nullable(),
  executable_sha256: Sha256.nullable(),
  project: z.strictObject({ project_id: z.string().uuid(), checkout_id: z.string().uuid() }),
  principal_id: Ref,
  mission_ref: Ref.nullable(),
  model_identity: z.string().max(200).nullable(),
  provider_identity: z.string().max(200).nullable(),
  truth_class: GovernanceTruthClass,
  truth_evidence_refs: z.array(Ref).max(32),
  lifecycle: ManagedSessionLifecycle,
  cleanup_confirmed: z.boolean()
});

export const ConformanceVerdict = z.strictObject({
  client_id: ManagedClientId,
  verdict: GovernanceTruthClass,
  reasons: z.array(z.enum([
    'NOT_DETECTED',
    'VERSION_MISMATCH',
    'NEGATIVE_BYPASS_TESTS_MISSING',
    'NEGATIVE_BYPASS_TESTS_FAILED',
    'MEDIATION_CHECKS_FAILED',
    'EXACT_VERSION_EVIDENCE_MISSING',
    'RESEARCH_ONLY_CLIENT',
    'NOT_YET_EVALUATED'
  ])).max(8),
  evidence_refs: z.array(Ref).max(32)
});

export type ManagedClientIdT = z.infer<typeof ManagedClientId>;
export type GovernanceTruthClassT = z.infer<typeof GovernanceTruthClass>;
export type ManagedClientDiscoveryT = z.infer<typeof ManagedClientDiscovery>;
export type ManagedLaunchDescriptorT = z.infer<typeof ManagedLaunchDescriptor>;
export type ManagedClientSessionT = z.infer<typeof ManagedClientSession>;
export type ConformanceVerdictT = z.infer<typeof ConformanceVerdict>;

// Per the captured CLIENT_ADAPTER_MATRIX: TARGET_1 clients may reach
// FULLY_GOVERNED after exact-version negative tests; OpenCode reuses the
// existing bridge (MANAGED_OBSERVED today); Gemini/Qwen remain research-only.
export const CLIENT_MATRIX: Record<ManagedClientIdT, { tier: 'TARGET_1' | 'BRIDGE' | 'RESEARCH'; default_truth: GovernanceTruthClassT }> = {
  'claude-code': { tier: 'TARGET_1', default_truth: 'MANAGED_OBSERVED' },
  'codex-cli': { tier: 'TARGET_1', default_truth: 'MANAGED_OBSERVED' },
  'kimi-code': { tier: 'TARGET_1', default_truth: 'MANAGED_OBSERVED' },
  opencode: { tier: 'BRIDGE', default_truth: 'MANAGED_OBSERVED' },
  'gemini-cli': { tier: 'RESEARCH', default_truth: 'UNQUALIFIED' },
  'qwen-code': { tier: 'RESEARCH', default_truth: 'UNQUALIFIED' }
};
