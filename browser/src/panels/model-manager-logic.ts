import type { ModelManagerEntryT } from '../../../common/contracts/model-manager.ts';

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
