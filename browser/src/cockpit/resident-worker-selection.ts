import type { ModelManagerResponseT } from '../../../common/contracts/model-access.ts';
import type { RoutesResponseT } from '../../../common/contracts/routing.ts';
import { CANONICAL_RESIDENT_FAMILY, CANONICAL_RESIDENT_ID, type ResidentBindingT } from '../../../common/contracts/resident-binding.ts';
import type { WorkerDescriptorT } from '../../../common/contracts/worker-handoff.ts';

type WorkerRole = 'planner' | 'coder' | 'reviewer';

// Cipher's task route is the canonical Resident binding, not a replaceable
// project worker slot. The binding, Model Access qualification, loaded model,
// and exact local route must agree before a session can be prepared.
export function residentWorkerForBinding(
  binding: ResidentBindingT,
  manager: ModelManagerResponseT,
  routes: RoutesResponseT,
  role: WorkerRole = 'coder'
): WorkerDescriptorT {
  if (binding.resident_id !== CANONICAL_RESIDENT_ID || binding.resident_model_family?.toLowerCase() !== CANONICAL_RESIDENT_FAMILY) {
    throw new Error('Cipher Resident binding does not identify the canonical Liquid model family.');
  }
  if (binding.binding_state !== 'BOUND' || binding.availability_state !== 'AVAILABLE' ||
      binding.runtime_state !== 'RUNNING' || binding.resident_model_id === null) {
    throw new Error(`Cipher Resident is not currently bound and running (${binding.degraded_reason ?? binding.binding_state}).`);
  }

  const model = manager.models.find(candidate => candidate.identity.canonical_id === binding.resident_model_id);
  if (model === undefined) throw new Error('The bound Cipher model is absent from current Model Manager inventory.');
  if (model.readiness !== 'READY' || model.identity.qualification.state !== 'QUALIFIED' || model.identity.qualification.stale_reasons.length > 0) {
    throw new Error('The bound Cipher model is not currently qualified and ready; no worker model may replace it.');
  }
  const artifact = manager.artifacts.find(candidate => model.artifact_ids.includes(candidate.id));
  const qualifiedHash = model.identity.qualification.basis?.artifact_sha256;
  if (artifact === undefined || artifact.hash_status !== 'VERIFIED' || artifact.observed_sha256 === null ||
      qualifiedHash === null || qualifiedHash === undefined || artifact.observed_sha256.toLowerCase() !== qualifiedHash.toLowerCase()) {
    throw new Error('The bound Cipher artifact does not match its current qualified SHA-256 identity.');
  }
  const selectedModelId = manager.runtime.selected_model_id?.replace(/^local:/, '') ?? null;
  const canonicalModelId = binding.resident_model_id.replace(/^local:/, '');
  if (manager.runtime.health !== 'HEALTHY' || selectedModelId !== canonicalModelId) {
    throw new Error('The exact Cipher model is not the healthy loaded runtime model.');
  }

  const expectedRouteIds = new Set([`local:${binding.resident_model_id}`, binding.resident_model_id]);
  const route = routes.routes.find(candidate => expectedRouteIds.has(candidate.id) && candidate.providerType === 'local');
  if (route === undefined || route.status !== 'ready') {
    throw new Error('The exact Cipher model route is not ready; no other local or provider route may replace it.');
  }
  const routedModelId = route.id.startsWith('local:') ? route.id.slice('local:'.length) : route.id;
  if (routedModelId !== binding.resident_model_id && routedModelId !== canonicalModelId) {
    throw new Error('The loaded route does not match the exact Cipher Resident model identity.');
  }
  return { worker: route.id, provider: 'local', model: routedModelId, role };
}
