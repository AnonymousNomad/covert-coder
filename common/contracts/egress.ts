import { z } from 'zod';

// Sovereignty / egress manifest contract. Proves "Local by default. Connected
// by choice." with classified capabilities and whitelisted egress-journal
// projection (ts/action/provider only — never secret material).
export const EgressClassification = z.enum(['PACKAGED_LOCAL', 'OS_PROVIDED', 'OPTIONAL_EXTERNAL', 'CLOUD_ONLY', 'MISSING_LOCAL_EQUIVALENT']);
export type EgressClassificationT = z.infer<typeof EgressClassification>;

export const EgressConsent = z.enum(['local_only', 'opted_in', 'not_configured']);
export type EgressConsentT = z.infer<typeof EgressConsent>;

export const EgressCapability = z.strictObject({
  id: z.string().min(1).max(80),
  classification: EgressClassification,
  detail: z.string().max(300),
  egress_host: z.string().max(200).nullable(),
  consent: EgressConsent
});
export type EgressCapabilityT = z.infer<typeof EgressCapability>;

export const EgressRecentActivity = z.strictObject({
  events: z.number().int().gte(0),
  last_at: z.string().max(40).nullable(),
  providers: z.array(z.string().max(120)).max(16)
});

export const EgressManifestResponse = z.strictObject({
  doctrine: z.string().max(200),
  capabilities: z.array(EgressCapability).max(32),
  recent_external_activity: EgressRecentActivity,
  generated_at: z.string()
});
export type EgressManifestResponseT = z.infer<typeof EgressManifestResponse>;
