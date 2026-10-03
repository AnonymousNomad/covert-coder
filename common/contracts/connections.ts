// Unified Provider Connections contract — one canonical view over every
// provider/connection family (subscription runtimes, API-key providers, local
// runtimes, catalog access) plus the routing preference that governs how the
// existing role router resolves planner/coder/reviewer/utility. No second registry, routing
// engine, credential store, or authority system: this view composes the
// existing services and stores.
import { z } from 'zod';
import { RoleRouting } from './byok.ts';

export const ConnectionKind = z.enum(['subscription', 'api-key', 'local-runtime', 'catalog-token']);
export type ConnectionKindT = z.infer<typeof ConnectionKind>;

export const ConnectionStatus = z.enum(['not_configured', 'sign_in_required', 'configured_not_verified', 'connected', 'invalid_key', 'unreachable', 'unavailable']);
export type ConnectionStatusT = z.infer<typeof ConnectionStatus>;

export const ConnectionCapability = z.enum(['chat', 'act', 'utility', 'catalog']);
export const ConnectionAuthenticationMode = z.enum(['api_key', 'subscription_login', 'official_cli', 'opencode_managed', 'oauth_account', 'none', 'unknown']);
export const ConnectionHealth = z.enum(['healthy', 'unhealthy', 'unknown', 'unavailable']);
export const ConnectionExecutionAdapter = z.enum(['direct-http', 'opencode', 'codex-cli', 'claude-cli', 'local-runtime']);
export const ConnectionSetupState = z.enum(['ready', 'setup_required', 'verification_required', 'consent_required', 'remediation_required', 'unavailable', 'not_applicable']);

export const ConnectionCredentialSource = z.strictObject({
  id: z.string().min(1).max(120).nullable(),
  kind: z.enum(['api_key_vault', 'subscription_account', 'official_cli_auth', 'opencode_managed_auth', 'oauth_session', 'local_none', 'unknown']),
  configuration_state: z.enum(['not_required', 'missing', 'configured', 'invalid', 'unknown'])
});

export const ConnectionModelReference = z.strictObject({
  model_id: z.string().min(1).max(240),
  provider_model_id: z.string().min(1).max(240),
  model_support_state: z.enum(['verified', 'unknown', 'unsupported'])
});

export const ConnectionAccessMetadata = z.strictObject({
  authentication_mode: ConnectionAuthenticationMode,
  authentication_configured: z.boolean(),
  credential_source: ConnectionCredentialSource,
  health: ConnectionHealth,
  execution_adapters: z.array(ConnectionExecutionAdapter),
  model_refs: z.array(ConnectionModelReference),
  external_egress_required: z.boolean(),
  operator_setup_required: z.boolean(),
  setup_state: ConnectionSetupState
});
export type ConnectionAccessMetadataT = z.infer<typeof ConnectionAccessMetadata>;

export const ProviderConnection = z.strictObject({
  id: z.string().min(1).max(72),
  provider_id: z.string().min(1).max(64),
  name: z.string().min(1).max(120),
  kind: ConnectionKind,
  status: ConnectionStatus,
  detail: z.string().max(300),
  capabilities: z.array(ConnectionCapability),
  routing_available: z.boolean(),
  account_label: z.string().max(120),
  access: ConnectionAccessMetadata,
});
export type ProviderConnectionT = z.infer<typeof ProviderConnection>;

export const RoutingPreference = z.enum(['local-first', 'local-only', 'api-keys-with-approval']);
export type RoutingPreferenceT = z.infer<typeof RoutingPreference>;

export const ConnectionsViewResponse = z.strictObject({
  consensus: z.string().max(160),
  routed_roles: RoleRouting,
  preference: RoutingPreference,
  connections: z.array(ProviderConnection),
});
export type ConnectionsViewResponseT = z.infer<typeof ConnectionsViewResponse>;

export const ConnectionsPreferencePutRequest = z.strictObject({ preference: RoutingPreference });

export const ConnectionsTestRequest = z.strictObject({
  connection_id: z.string().min(1).max(72),
  provider_model_id: z.string().min(1).max(240).optional()
});
export const ConnectionsTestResponse = z.strictObject({ ok: z.boolean(), detail: z.string().max(300) });

export const ConnectionsDiscoverRequest = z.strictObject({ connection_id: z.literal('opencode-managed') });
export const ConnectionsDiscoverResponse = z.strictObject({
  ok: z.boolean(),
  detail: z.string().max(300),
  model_count: z.number().int().nonnegative().max(256)
});

export const HfTokenPutRequest = z.strictObject({ api_key: z.string().min(1).max(4096) });
export const HfTokenPutResponse = z.strictObject({ stored: z.literal(true) });

export const HfTokenDeleteRequest = z.strictObject({});
export const HfTokenDeleteResponse = z.strictObject({ ok: z.literal(true) });

export const ConnectionsAuthRequest = z.strictObject({ subscription_id: z.string().min(1).max(64) });
export const ConnectionsAuthResponse = z.strictObject({
  ok: z.boolean(),
  command: z.string().max(300),
  status: ConnectionStatus,
  detail: z.string().max(300),
});
