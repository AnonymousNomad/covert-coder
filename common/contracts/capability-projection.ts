import { z } from 'zod';

// P1 — Capability Projection contract (covert.capability-projection.v1).
// Consumes canonical App Catalog truth through a reader interface; never
// becomes a registry. Projection preserves canonical fields EXACTLY:
// id, owner, effect, audiences, selected roles, external_egress_required and
// the catalog generation. Nothing may be re-derived, widened, or invented.
// Discovery is not authorization: this contract carries no grant, admission,
// or execution state; GATED remains GATED.

const Ref = z.string().min(1).max(160).regex(/^[a-zA-Z0-9._:/@-]+$/)
  .refine(value => !value.split(/[/:]/).some(part => part === '.' || part === '..'), 'unsafe reference segment');
const RoutePath = z.string().regex(/^\/api\/[a-zA-Z0-9/_-]+$/);
const Generation = z.string().uuid();

export const ProjectionAudience = z.enum(['OPERATOR', 'RESIDENT', 'WORKER']);
export const ProjectionEffect = z.enum(['READ', 'WRITE']);
export const ProjectionAvailability = z.enum(['ADDRESSABLE', 'UNAVAILABLE', 'UNOBSERVED']);

// Canonical capability record as exposed by the upstream reader. Structural
// mirror of the App Catalog capability semantics; provided by the adapter at
// integration time (hot App Catalog owner remains upstream truth).
export const CanonicalCapabilityRecord = z.strictObject({
  capability_id: Ref,
  owner: Ref,
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE']),
  route: RoutePath,
  effect: ProjectionEffect,
  audiences: z.array(ProjectionAudience).min(1).max(3),
  selected_roles: z.array(z.string().max(64)).max(32),
  external_egress_required: z.boolean(),
  availability: ProjectionAvailability,
  description: z.string().max(400).optional()
});
export const CanonicalCatalogSnapshot = z.strictObject({
  generation: Generation,
  digest: z.string().regex(/^[a-f0-9]{64}$/),
  collected_at: z.string().datetime(),
  capabilities: z.array(CanonicalCapabilityRecord).max(4096)
});

export const ProjectionRequest = z.strictObject({
  requested_by: z.strictObject({ principal_id: Ref, audience: ProjectionAudience, role: z.string().max(64).nullable() }),
  project: z.strictObject({ project_id: z.string().uuid(), checkout_id: z.string().uuid() }),
  expected_generation: Generation
});

export const ProjectionReason = z.enum([
  'STALE_GENERATION',      // upstream catalog advanced past expectation
  'WRONG_AUDIENCE',        // capability not addressed to this principal class (never widened)
  'WRONG_ROLE',            // canonical selected_roles excludes the requested role
  'UNAVAILABLE',           // canonical availability is UNAVAILABLE/UNOBSERVED (preserved, not inferred)
  'OWNER_UNAVAILABLE',     // upstream owner route not observable (kept truthful, not collapsed)
  'MALFORMED_RECORD',      // untrusted metadata failed schema; excluded, never repaired silently
  'DUPLICATE_ID',          // duplicate capability_id; deterministic first-wins + exclusion record
  'CREDENTIAL_REJECTED'    // credential-shaped metadata detected and stripped/refused
]);

export const ProjectedToolDescriptor = z.strictObject({
  schema: z.literal('covert.capability-projection.v1'),
  capability_id: Ref,
  owner: Ref,
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE']),
  route: RoutePath,
  effect: ProjectionEffect,
  audiences: z.array(ProjectionAudience).min(1).max(3),
  selected_roles: z.array(z.string().max(64)).max(32),
  external_egress_required: z.boolean(),
  availability: ProjectionAvailability,
  description: z.string().max(400).nullable(),
  generation: Generation,
  source: z.literal('AppCatalog')
});
export const ProjectionExclusion = z.strictObject({
  capability_id: z.string().max(160).nullable(),
  reason: ProjectionReason
});
export const ProjectionResult = z.strictObject({
  schema: z.literal('covert.capability-projection.v1'),
  generation: Generation,
  catalog_digest: z.string().regex(/^[a-f0-9]{64}$/),
  projected: z.array(ProjectedToolDescriptor).max(4096),
  excluded: z.array(ProjectionExclusion).max(4096),
  execution_state: z.literal('GATED'),
  effect_replay: z.literal(false)
});

export type CanonicalCapabilityRecordT = z.infer<typeof CanonicalCapabilityRecord>;
export type CanonicalCatalogSnapshotT = z.infer<typeof CanonicalCatalogSnapshot>;
export type ProjectionRequestT = z.infer<typeof ProjectionRequest>;
export type ProjectedToolDescriptorT = z.infer<typeof ProjectedToolDescriptor>;
export type ProjectionResultT = z.infer<typeof ProjectionResult>;
export type ProjectionReasonT = z.infer<typeof ProjectionReason>;
