import { z } from 'zod';
import { ProjectAddress } from './project.ts';
import { CIPHER_RESIDENT_ID, CipherIntegrityState } from './cipher-laptop.ts';
import { AuthorityGrantReference, PlatformIdentifier, CapabilityEffect, CapabilityBindingReason } from './platform-app.ts';
import { ModelProviderRoute, ModelExecutionAdapter, ModelManagerSelectionPolicy } from './model-access.ts';

const Ref = z.string().min(1).max(240).regex(/^[A-Za-z0-9._:/@-]+$/);
const Digest = z.string().regex(/^[a-f0-9]{64}$/);
const ModelOwnerRef = (kind: string) => z.string().regex(new RegExp('^' + kind + ':[a-f0-9]{64}$'));
export const ResidentCapabilityQuery = ProjectAddress.extend({ catalog_generation: z.string().uuid().optional() }).strict().refine(value => value.project_id === value.project_id.toLowerCase() && value.checkout_id === value.checkout_id.toLowerCase(), 'canonical project address must be lowercase');
// Trusted composition-root port only. Never accepted as an HTTP request.
export const ResidentWorkerSnapshot = z.object({ generated_at: z.string().datetime(), routes: z.array(ModelProviderRoute).max(256), execution_adapters: z.array(ModelExecutionAdapter).max(32) }).strict();
const Capability = z.object({
  id: PlatformIdentifier, app_id: PlatformIdentifier, owner: Ref, operation_kind: PlatformIdentifier, effect: CapabilityEffect, audiences: z.array(z.enum(['OPERATOR', 'RESIDENT', 'WORKER'])).min(1).max(3), method: z.enum(['GET', 'POST', 'PUT', 'DELETE']), route: z.string().regex(/^\/api\/[A-Za-z0-9/_-]+$/),
  route_state: z.enum(['ADDRESSABLE', 'UNAVAILABLE', 'UNOBSERVED']), reason: CapabilityBindingReason,
  execution_state: z.literal('GATED'), execution_reason: z.literal('RESIDENT_ENROLLMENT_GATED'),
  grant_state: z.literal('NOT_EVALUATED'), admission_state: z.literal('NOT_EVALUATED')
}).strict();
const Worker = z.object({
  // Opaque server-generated references over canonical owner IDs. Arbitrary
  // provider labels, credentials and credential handles never cross this port.
  identity_encoding: z.literal('OWNER_REFERENCE_DIGEST'),
  route_id: ModelOwnerRef('route'), model_id: ModelOwnerRef('model'), adapter_id: ModelOwnerRef('adapter'), provider_id: ModelOwnerRef('provider'),
  availability: z.enum(['AVAILABLE', 'UNAVAILABLE']), external_egress_required: z.boolean(),
  selected_roles: z.array(ModelManagerSelectionPolicy.shape.roles.element).max(16),
  qualification_state: z.literal('NOT_PROJECTED'), execution_state: z.literal('GATED')
}).strict();
export const ResidentCapabilityManifest = z.object({
  schema: z.literal('covert.resident-capabilities.v1'), resident_id: z.literal(CIPHER_RESIDENT_ID),
  identity_state: z.enum(['OBSERVED', 'UNAVAILABLE']), identity_source: z.enum(['CipherLedger', 'LOGICAL_PRODUCT_ID_UNOBSERVED']), ledger_id: z.string().uuid().nullable(),
  identity_provenance: z.object({ owner: z.literal('CipherLedger'), ledger_id: z.string().uuid(), checkpoint_root: Digest, record_count: z.number().int().nonnegative(), integrity_generation: z.number().int().nonnegative(), attestation: z.literal('UNSIGNED_HASH_CHAIN') }).strict().nullable(),
  integrity_state: CipherIntegrityState.or(z.literal('UNAVAILABLE')),
  enrollment_state: z.literal('GATED'), principal_id: z.null(), binding_generation: z.null(), context_lease_ref: z.null(),
  project: ProjectAddress, discovery_generation: z.string().uuid(), catalog_generation: z.string().uuid(), catalog_digest: Digest,
  observed_at: z.string().datetime(), valid_until: z.string().datetime(), freshness: z.literal('SNAPSHOT'),
  apps: z.array(z.object({ app_id: PlatformIdentifier, manifest_digest: Digest, execution_state: z.literal('GATED') }).strict()).max(9),
  capabilities: z.array(Capability).max(64),
  workers: z.object({ state: z.enum(['OBSERVED', 'UNAVAILABLE', 'STALE']), reason: z.enum(['CANONICAL_OWNER_SNAPSHOT', 'MODEL_OWNER_UNAVAILABLE', 'MODEL_SNAPSHOT_INVALID', 'MODEL_SNAPSHOT_STALE']), source: z.literal('ModelManagerView'), observed_at: z.string().datetime().nullable(), references: z.array(Worker).max(128) }).strict(),
  grants: z.object({ owner: z.literal('Authority'), state: z.literal('UNAVAILABLE'), reason: z.literal('LIVE_RESIDENT_PRINCIPAL_UNAVAILABLE'), references: z.array(AuthorityGrantReference).max(0) }).strict(),
  pending_operator_decisions: z.object({ owner: z.literal('Authority'), state: z.literal('UNAVAILABLE'), reason: z.literal('SCOPED_AUTHORITY_DISCOVERY_UNAVAILABLE'), references: z.array(Ref).max(0) }).strict(),
  refresh: z.object({ mode: z.literal('BOUNDED_PULL'), refresh_after_ms: z.literal(30000), change_events: z.literal('GATED_NOT_IMPLEMENTED') }).strict(),
  effect_replay: z.literal(false)
}).strict();
export type ResidentCapabilityManifestT = z.infer<typeof ResidentCapabilityManifest>;
export type ResidentCapabilityQueryT = z.infer<typeof ResidentCapabilityQuery>;
export type ResidentWorkerSnapshotT = z.infer<typeof ResidentWorkerSnapshot>;
