import { z } from 'zod';
import { ProjectAddress } from './project.ts';

const Ref = z.string().min(1).max(160).regex(/^[a-zA-Z0-9._:/@-]+$/).refine(value => !value.split(/[/:]/).some(part => part === '.' || part === '..') && !/^sk-[A-Za-z0-9_-]{8,}/.test(value));
const Digest = z.string().regex(/^[a-f0-9]{64}$/);
const Capability = z.object({
  id: Ref, owner: Ref, method: z.enum(['GET', 'POST', 'PUT', 'DELETE']),
  route: z.string().regex(/^\/api\/[a-zA-Z0-9/_-]+$/),
  effect: z.enum(['READ', 'WRITE']), audiences: z.array(z.enum(['OPERATOR', 'RESIDENT', 'WORKER'])).min(1).max(3)
}).strict();

// These declarations describe dependency/intent, never entitlement. Artifact
// digests are declarations, not signatures or a verified package installation.
export const PackageDeclaration = z.object({
  schema: z.literal('covert.package-manifest.v1'), package_id: Ref, version: Ref,
  publisher: Ref, source_ref: Ref,
  artifact_digest: Digest.nullable(), artifact_state: z.enum(['UNATTESTED', 'DIGEST_DECLARED']),
  compatibility: z.object({ contract_version: z.literal(1), hosts: z.array(z.enum(['windows', 'linux', 'darwin'])).min(1).max(3) }).strict()
}).strict().refine(value => (value.artifact_state === 'UNATTESTED') === (value.artifact_digest === null), 'artifact state and digest disagree');
export const PackageManifest = PackageDeclaration.safeExtend({ manifest_digest: Digest });
export const AppDeclaration = z.object({
  schema: z.literal('covert.app-manifest.v1'), app_id: Ref, package_id: Ref,
  package_manifest_digest: Digest, version: Ref, display_name: z.string().min(1).max(80),
  presentation_id: Ref, canonical_state_owner: Ref,
  scope: z.enum(['WORKSTATION', 'PROJECT', 'PROJECT_OPTIONAL']), storage_namespace: Ref,
  contributions: z.array(z.enum(['window', 'launcher', 'resident-discovery'])).max(3),
  required_capabilities: z.array(Ref).max(32), optional_capabilities: z.array(Ref).max(32),
  capabilities: z.array(Capability).max(32),
  dependencies: z.object({ network_classes: z.array(Ref).max(16), credential_classes: z.array(Ref).max(16), external_runtimes: z.array(Ref).max(16) }).strict(),
  resources: z.object({ owner: z.literal('ResourceAdmission'), budget_state: z.literal('NOT_EVALUATED'), background: z.literal(false) }).strict(),
  restore: z.object({ presentation: z.literal(true), effects: z.literal(false), background_restart: z.literal(false) }).strict()
}).strict();
export const AppManifest = AppDeclaration.extend({ manifest_digest: Digest });

// Mutable installation records have their own revision. P1 provides the
// contract, not a competing installed-app database or mutation endpoint.
export const InstalledAppRecord = z.object({
  schema: z.literal('covert.installed-app.v1'), installation_id: z.string().uuid(), revision: z.number().int().nonnegative(),
  app_id: Ref, package_manifest_digest: Digest, app_manifest_digest: Digest,
  location_ref: Ref, compatibility: z.enum(['UNKNOWN', 'COMPATIBLE', 'INCOMPATIBLE']),
  readiness: z.enum(['UNKNOWN', 'AVAILABLE', 'DEGRADED', 'UNAVAILABLE']),
  state: z.enum(['REGISTERED', 'ENABLED', 'DISABLED', 'QUARANTINED', 'REVOKED', 'UPDATE_STAGED', 'UNINSTALLING'])
}).strict();
// The Authority remains the only grant owner. A reference is not a grant
// object accepted from a model, manifest, remote message or browser window.
export const AuthorityGrantReference = z.object({
  owner: z.literal('Authority'), grant_ref: Ref, principal_id: Ref,
  project: ProjectAddress, revision: z.number().int().nonnegative()
}).strict();
export const AdmissionReference = z.object({
  owner: z.literal('ResourceAdmission'), decision_ref: Ref,
  principal_id: Ref, project: ProjectAddress, observed_at: z.string().datetime(),
  state: z.enum(['ADMITTED', 'REFUSED', 'STALE'])
}).strict();
export const AppInstance = z.object({
  schema: z.literal('covert.app-instance.v1'), instance_id: z.string().uuid(), principal_id: Ref, generation: z.string().uuid(),
  installation_id: z.string().uuid(), installation_revision: z.number().int().nonnegative(),
  app_id: Ref, package_manifest_digest: Digest, app_manifest_digest: Digest,
  project: ProjectAddress, state: z.enum(['STARTING', 'RUNNING', 'STOPPING', 'STOPPED', 'FAILED'])
}).strict();

export const AppCatalogQuery = ProjectAddress.extend({ app_id: Ref.optional(), capability_id: Ref.optional() }).strict();
export const AppCatalogEntry = z.object({
  manifest: AppManifest,
  capability_bindings: z.array(z.object({ id: Ref, state: z.enum(['ADDRESSABLE', 'UNAVAILABLE', 'UNOBSERVED']), reason: z.enum(['ROUTE_REGISTERED', 'OWNER_ROUTE_UNAVAILABLE', 'ROUTE_OWNER_UNOBSERVED']) }).strict()).max(32),
  installation_state: z.literal('UNOBSERVED'), grant_state: z.literal('NOT_EVALUATED'), admission_state: z.literal('NOT_EVALUATED'),
  execution_state: z.literal('GATED'), execution_reason: z.literal('APP_PRINCIPAL_ENFORCEMENT_UNPROVEN')
}).strict();
export const AppCatalogResponse = z.object({
  schema: z.literal('covert.app-catalog.v1'), generation: z.string().uuid(), catalog_digest: Digest,
  project: ProjectAddress, observed_at: z.string().datetime(), freshness: z.literal('SNAPSHOT'),
  selection: z.object({ app_id: Ref.nullable(), capability_id: Ref.nullable() }).strict(),
  package: PackageManifest, apps: z.array(AppCatalogEntry).max(9),
  effect_replay: z.literal(false)
}).strict();
export type PackageDeclarationT = z.infer<typeof PackageDeclaration>;
export type PackageManifestT = z.infer<typeof PackageManifest>;
export type AppManifestT = z.infer<typeof AppManifest>;
export type InstalledAppRecordT = z.infer<typeof InstalledAppRecord>;
export type AppInstanceT = z.infer<typeof AppInstance>;
export type AppCatalogResponseT = z.infer<typeof AppCatalogResponse>;
