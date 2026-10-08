import { createHash, randomUUID } from 'node:crypto';
import { ResidentCapabilityQuery, ResidentCapabilityManifest, ResidentWorkerSnapshot, type ResidentCapabilityManifestT, type ResidentCapabilityQueryT } from '../../../common/contracts/resident-capability.ts';
import { CIPHER_RESIDENT_ID, CipherLedgerStatus } from '../../../common/contracts/cipher-laptop.ts';
import type { CipherLedger } from './cipher-ledger.ts';
import type { AppCatalog } from './app-catalog.ts';

function freeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') { for (const child of Object.values(value)) freeze(child); Object.freeze(value); }
  return value;
}
// A read-only owner projection. No enrollment, prompt injection, model loading,
// credential access, Authority mutation, task execution or autonomous timer.
export function createResidentCapabilityDiscovery(options: { catalog: AppCatalog; ledger?: Pick<CipherLedger, 'status'> | undefined; workerSnapshot?: (() => Promise<unknown>) | undefined; clock?: (() => number) | undefined }) {
  const generation = randomUUID();
  const clock = options.clock ?? Date.now;
  // These are digest references, not signatures, credentials or invocations.
  const ownerRef = (kind: string, id: string) => kind + ':' + createHash('sha256').update(JSON.stringify(['ModelManagerView', kind, id])).digest('hex');
  async function workers(): Promise<ResidentCapabilityManifestT['workers']> {
    const unavailable = { state: 'UNAVAILABLE' as const, reason: 'MODEL_OWNER_UNAVAILABLE' as const, source: 'ModelManagerView' as const, observed_at: null, references: [] };
    if (!options.workerSnapshot) return unavailable;
    let raw: unknown;
    try { raw = await options.workerSnapshot(); } catch { return unavailable; }
    const snapshot = ResidentWorkerSnapshot.safeParse(raw);
    if (!snapshot.success) return { ...unavailable, reason: 'MODEL_SNAPSHOT_INVALID' };
    const source = snapshot.data, age = clock() - Date.parse(source.generated_at);
    if (age < -1000 || age > 30000) return { ...unavailable, state: 'STALE', reason: 'MODEL_SNAPSHOT_STALE', observed_at: source.generated_at };
    if (new Set(source.execution_adapters.map(adapter => adapter.id)).size !== source.execution_adapters.length) return { ...unavailable, reason: 'MODEL_SNAPSHOT_INVALID' };
    const adapterIds = new Set(source.execution_adapters.filter(adapter => adapter.implementation === 'IMPLEMENTED').map(adapter => adapter.id));
    const candidates = source.routes.filter(route => route.model_support_state === 'VERIFIED' && adapterIds.has(route.execution_adapter_id));
    if (candidates.length > 128 || new Set(candidates.map(route => route.id)).size !== candidates.length) return { ...unavailable, reason: 'MODEL_SNAPSHOT_INVALID' };
    const references = candidates.map(route => ({ identity_encoding: 'OWNER_REFERENCE_DIGEST', route_id: ownerRef('route', route.id), model_id: ownerRef('model', route.model_id), adapter_id: ownerRef('adapter', route.execution_adapter_id), provider_id: ownerRef('provider', route.provider_id),
      availability: route.available && route.configured && route.health === 'HEALTHY' && source.execution_adapters.some(adapter => adapter.id === route.execution_adapter_id && adapter.available) ? 'AVAILABLE' : 'UNAVAILABLE',
      external_egress_required: route.external_egress_required, selected_roles: route.selected_roles, qualification_state: 'NOT_PROJECTED', execution_state: 'GATED'
    }));
    const result = ResidentCapabilityManifest.shape.workers.safeParse({ state: 'OBSERVED', reason: 'CANONICAL_OWNER_SNAPSHOT', source: 'ModelManagerView', observed_at: source.generated_at, references });
    return result.success ? result.data : { ...unavailable, reason: 'MODEL_SNAPSHOT_INVALID' };
  }
  async function read(value: ResidentCapabilityQueryT): Promise<ResidentCapabilityManifestT> {
    const request = ResidentCapabilityQuery.parse(value), project = { project_id: request.project_id, checkout_id: request.checkout_id };
    const catalog = await options.catalog.read(project);
    if (request.catalog_generation !== undefined && request.catalog_generation !== catalog.generation) throw new Error('CATALOG_GENERATION_CHANGED');
    const rawLedger = await options.ledger?.status().catch(() => null);
    const ledger = CipherLedgerStatus.safeParse(rawLedger);
    if (ledger.success && ledger.data.resident_id !== CIPHER_RESIDENT_ID) throw new Error('RESIDENT_IDENTITY_MISMATCH');
    const workerView = await workers();
    // Recheck the canonical ledger after asynchronous owner reads.
    const latestLedger = CipherLedgerStatus.safeParse(await options.ledger?.status().catch(() => null));
    const identityRevision = (status: typeof ledger) => status.success ? JSON.stringify([status.data.resident_id, status.data.ledger_id, status.data.checkpoint_root, status.data.record_count, status.data.generation, status.data.integrity, status.data.state]) : null;
    if (identityRevision(ledger) !== identityRevision(latestLedger)) throw new Error('RESIDENT_IDENTITY_CHANGED');
    await options.catalog.assertFresh(catalog);
    const now = clock(), identityObserved = ledger.success && ledger.data.integrity === 'HASH_CHAIN_VERIFIED' && ledger.data.ledger_id !== null && ledger.data.checkpoint_root !== null;
    if (workerView.state === 'OBSERVED' && (workerView.observed_at === null || now - Date.parse(workerView.observed_at) > 30000 || now - Date.parse(workerView.observed_at) < -1000)) {
      workerView.state = 'STALE'; workerView.reason = 'MODEL_SNAPSHOT_STALE'; workerView.references = [];
    }
    const result = ResidentCapabilityManifest.parse({
      schema: 'covert.resident-capabilities.v1', resident_id: CIPHER_RESIDENT_ID,
      identity_state: identityObserved ? 'OBSERVED' : 'UNAVAILABLE', identity_source: identityObserved ? 'CipherLedger' : 'LOGICAL_PRODUCT_ID_UNOBSERVED',
      identity_provenance: identityObserved && ledger.success ? { owner: 'CipherLedger', ledger_id: ledger.data.ledger_id, checkpoint_root: ledger.data.checkpoint_root, record_count: ledger.data.record_count, integrity_generation: ledger.data.generation, attestation: 'UNSIGNED_HASH_CHAIN' } : null,
      ledger_id: ledger.success ? ledger.data.ledger_id : null, integrity_state: ledger.success ? ledger.data.state : 'UNAVAILABLE',
      enrollment_state: 'GATED', principal_id: null, binding_generation: null, context_lease_ref: null,
      project, discovery_generation: generation, catalog_generation: catalog.generation, catalog_digest: catalog.catalog_digest,
      observed_at: new Date(now).toISOString(), valid_until: new Date(now + 30000).toISOString(), freshness: 'SNAPSHOT',
      apps: catalog.apps.map(app => ({ app_id: app.manifest.app_id, manifest_digest: app.manifest.manifest_digest, execution_state: 'GATED' })),
      capabilities: catalog.apps.flatMap(app => app.manifest.capabilities.map(capability => {
        const binding = app.capability_bindings.find(binding => binding.id === capability.id)!;
        const cipherOwnerUnavailable = !ledger.success && (capability.owner === 'CipherLedger' || capability.owner === 'CipherNotebook');
        return { id: capability.id, app_id: app.manifest.app_id, owner: capability.owner, operation_kind: capability.operation_kind, effect: capability.effect, audiences: capability.audiences, method: capability.method, route: capability.route, route_state: cipherOwnerUnavailable ? 'UNAVAILABLE' : binding.state, reason: cipherOwnerUnavailable ? 'OWNER_UNAVAILABLE' : binding.reason,
          execution_state: 'GATED', execution_reason: 'RESIDENT_ENROLLMENT_GATED', grant_state: 'NOT_EVALUATED', admission_state: 'NOT_EVALUATED' };
      })),
      workers: workerView,
      grants: { owner: 'Authority', state: 'UNAVAILABLE', reason: 'LIVE_RESIDENT_PRINCIPAL_UNAVAILABLE', references: [] },
      pending_operator_decisions: { owner: 'Authority', state: 'UNAVAILABLE', reason: 'SCOPED_AUTHORITY_DISCOVERY_UNAVAILABLE', references: [] },
      refresh: { mode: 'BOUNDED_PULL', refresh_after_ms: 30000, change_events: 'GATED_NOT_IMPLEMENTED' }, effect_replay: false
    });
    return freeze(result);
  }
  return Object.freeze({ read, assertFresh: async (value: unknown): Promise<void> => {
    const view = ResidentCapabilityManifest.parse(value);
    if (view.discovery_generation !== generation) throw new Error('DISCOVERY_GENERATION_CHANGED');
    const now = clock();
    if (Date.parse(view.valid_until) <= now || Date.parse(view.observed_at) > now + 1000 || Date.parse(view.valid_until) - Date.parse(view.observed_at) !== 30000) throw new Error('DISCOVERY_EXPIRED');
    const current = await read({ ...view.project, catalog_generation: view.catalog_generation });
    if (Date.parse(view.valid_until) <= clock()) throw new Error('DISCOVERY_EXPIRED');
    const workerSemantic = (workers: ResidentCapabilityManifestT['workers']) => JSON.stringify({ state: workers.state, reason: workers.reason, source: workers.source, references: workers.references });
    const sourceAge = view.workers.observed_at === null ? null : clock() - Date.parse(view.workers.observed_at);
    if ((view.workers.state === 'OBSERVED' && (sourceAge === null || sourceAge > 30000 || sourceAge < -1000)) || current.catalog_digest !== view.catalog_digest || JSON.stringify(current.apps) !== JSON.stringify(view.apps) || JSON.stringify(current.capabilities) !== JSON.stringify(view.capabilities) || workerSemantic(current.workers) !== workerSemantic(view.workers) || current.identity_state !== view.identity_state || current.identity_source !== view.identity_source || JSON.stringify(current.identity_provenance) !== JSON.stringify(view.identity_provenance) || current.integrity_state !== view.integrity_state || current.ledger_id !== view.ledger_id) throw new Error('DISCOVERY_CHANGED');
  } });
}
export type ResidentCapabilityDiscovery = ReturnType<typeof createResidentCapabilityDiscovery>;
