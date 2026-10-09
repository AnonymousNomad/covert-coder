import type { RoleTargetT } from '../../../common/contracts/byok.ts';
import type { RouteEntryT } from '../../../common/contracts/routing.ts';

type RouteIdentity = Pick<RouteEntryT, 'id' | 'providerType' | 'status'>;

export function initialConversationRouteId(actTarget: RoleTargetT): string {
  if (actTarget === 'local') return '';
  if (actTarget.provider_id === 'local') return `local:${actTarget.model_id}`;
  return `cloud:${actTarget.provider_id}:${actTarget.model_id}`;
}

export function restoreConversationRouteId(storedModelId: string, routes: readonly RouteIdentity[]): string {
  if (routes.some(route => route.id === storedModelId)) return storedModelId;
  const legacyLocalId = `local:${storedModelId}`;
  if (routes.some(route => route.id === legacyLocalId)) return legacyLocalId;
  return storedModelId;
}
