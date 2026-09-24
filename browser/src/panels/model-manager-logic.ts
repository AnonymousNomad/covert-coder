import type { ModelManagerEntryT, ModelManagerSnapshotResponseT } from '../../../common/contracts/model-manager.ts';

export type OverrideBlockReason = 'UNAVAILABLE' | 'RESOURCE_INCOMPATIBLE' | 'PROVIDER_NOT_AUTHENTICATED';

export function overrideBlockReason(model: ModelManagerEntryT | undefined): OverrideBlockReason | null {
  if (!model) return 'UNAVAILABLE';
  if (model.availability === 'UNAVAILABLE') return 'UNAVAILABLE';
  if (model.resource_fit === 'INCOMPATIBLE') return 'RESOURCE_INCOMPATIBLE';
  if (model.locality === 'CLOUD' && model.provider_state !== 'AUTHENTICATED') return 'PROVIDER_NOT_AUTHENTICATED';
  return null;
}

export function modelQualificationForRole(model: ModelManagerEntryT, role: string): string {
  if (model.qualification.state === 'STALE') return 'STALE — REQUALIFICATION REQUIRED';
  if (model.qualification.state === 'QUALIFIED' && model.qualification.qualified_roles.includes(role)) return `QUALIFIED — ${role}`;
  if (model.qualification.state === 'QUALIFIED') return `NOT QUALIFIED — ${role}; qualified roles: ${model.qualification.qualified_roles.join(', ') || 'none recorded'}`;
  return `${model.qualification.state} — ${role} NOT QUALIFIED`;
}

// This is a preflight explanation, not Resource Admission. The backend route
// repeats the hard-block check against a fresh Registry/runtime projection.
export function selectionRequestBlockReasons(model: ModelManagerEntryT | undefined, snapshot: ModelManagerSnapshotResponseT): string[] {
  if (!model) return ['MODEL_UNAVAILABLE'];
  const reasons: string[] = [];
  if (model.availability === 'UNAVAILABLE') reasons.push('MODEL_UNAVAILABLE');
  if (model.locality === 'LOCAL') {
    if (!model.artifact.label || model.artifact.hash_status === 'mismatch') reasons.push('MISSING_ARTIFACT');
    if (!['INSTALLED', 'DISCOVERED', 'AVAILABLE', 'LOADABLE'].includes(model.availability)) reasons.push('MODEL_UNAVAILABLE');
    const runtimeIdentityMatches = model.runtime_backend?.toLocaleLowerCase() === 'unsloth';
    const runtimeHasModel = snapshot.runtime.loaded_models.some(runtimeModel =>
      runtimeModel.id.toLocaleLowerCase() === model.id.toLocaleLowerCase() ||
      runtimeModel.id.toLocaleLowerCase() === (model.artifact.label ?? '').toLocaleLowerCase()
    );
    if (!snapshot.runtime.registered || snapshot.runtime.health !== 'HEALTHY' || snapshot.runtime.canonical_name !== 'UNSLOTH' || !runtimeIdentityMatches || !runtimeHasModel) {
      reasons.push('RUNTIME_UNAVAILABLE');
    }
  } else {
    const provider = snapshot.providers.find(item => item.id.toLocaleLowerCase() === model.provider.toLocaleLowerCase());
    if (model.provider_state !== 'AUTHENTICATED' || provider?.state !== 'AUTHENTICATED') reasons.push('MISSING_PROVIDER');
  }
  if (model.resource_fit === 'INCOMPATIBLE') reasons.push('RESOURCE_INCOMPATIBLE');
  if (model.qualification.state === 'STALE' || model.qualification.state === 'INVALID_EVIDENCE') reasons.push('QUALIFICATION_INVALID_OR_STALE');
  return [...new Set(reasons)];
}
