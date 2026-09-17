// Unified Provider Connections contract — one canonical view over every
// provider/connection family (subscription runtimes, API-key providers, local
// runtimes, catalog access) plus the routing preference that governs how the
// existing role router resolves plan/act/utility. No second registry, routing
// engine, credential store, or authority system: this view composes the
// existing services and stores.
import { z } from 'zod';
import { RoleRouting } from './byok.ts';

export const ConnectionKind = z.enum(['subscription', 'api-key', 'local-runtime', 'catalog-token']);
export type ConnectionKindT = z.infer<typeof ConnectionKind>;

export const ConnectionStatus = z.enum(['not_configured', 'sign_in_required', 'connected', 'invalid_key', 'unreachable', 'unavailable']);
export type ConnectionStatusT = z.infer<typeof ConnectionStatus>;

export const ConnectionCapability = z.enum(['chat', 'act', 'utility', 'catalog']);

export const ProviderConnection = z.strictObject({
  id: z.string().min(1).max(64),
  provider_id: z.string().min(1).max(64),
  name: z.string().min(1).max(120),
  kind: ConnectionKind,
  status: ConnectionStatus,
  detail: z.string().max(300),
  capabilities: z.array(ConnectionCapability),
  routing_available: z.boolean(),
  account_label: z.string().max(120),
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

export const ConnectionsTestRequest = z.strictObject({ connection_id: z.string().min(1).max(64) });
export const ConnectionsTestResponse = z.strictObject({ ok: z.boolean(), detail: z.string().max(300) });

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