import type { ByokStatusResponseT, RoleTargetT } from '../../../common/contracts/byok.ts';
import type { ConnectionsViewResponseT } from '../../../common/contracts/connections.ts';

export type RoleTargetOption = {
  key: string;
  target: RoleTargetT;
  label: string;
  unavailable: boolean;
};

export function roleTargetKey(target: RoleTargetT): string {
  if (target === 'local') return 'local';
  return `route:${encodeURIComponent(target.provider_id)}:${encodeURIComponent(target.model_id)}`;
}

export function projectRoleTargetOptions(
  providers: readonly Pick<ByokStatusResponseT['providers'][number], 'id' | 'name' | 'model_id'>[],
  connections: readonly ConnectionsViewResponseT['connections'][number][],
  current: RoleTargetT
): RoleTargetOption[] {
  const options: RoleTargetOption[] = [];
  const byKey = new Map<string, RoleTargetOption>();
  const add = (target: RoleTargetT, label: string, unavailable = false): void => {
    const key = roleTargetKey(target);
    const existing = byKey.get(key);
    if (existing !== undefined) {
      if (existing.target !== 'local' && target !== 'local' &&
          existing.target.provider_id === 'opencode' && target.provider_id === 'opencode' &&
          existing.target.model_id === target.model_id) {
        existing.label = `Ambiguous provider/model identity · ${target.model_id}`;
        existing.unavailable = true;
      }
      return;
    }
    const option = { key, target, label, unavailable };
    byKey.set(key, option);
    options.push(option);
  };

  add('local', 'Local runtime');
  const local = connections.find(connection => connection.kind === 'local-runtime');
  if (local !== undefined) {
    for (const reference of local.access.model_refs) {
      const target = { provider_id: local.provider_id, model_id: reference.provider_model_id };
      const state = reference.model_support_state === 'verified' && local.routing_available
        ? 'VERIFIED and routeable'
        : reference.model_support_state === 'unsupported' ? 'UNSUPPORTED'
          : 'UNVERIFIED or unavailable; execution remains closed';
      add(target, `Local · ${reference.provider_model_id} (${state})`, reference.model_support_state === 'unsupported');
    }
  }
  for (const provider of providers) {
    add(
      { provider_id: provider.id, model_id: provider.model_id },
      `${provider.name} · ${provider.model_id}`
    );
  }

  const openCode = connections.find(connection => connection.id === 'opencode-managed');
  if (openCode?.status === 'connected') {
    for (const reference of openCode.access.model_refs) {
      if (reference.model_support_state === 'unsupported' || !/^opencode-go\/[A-Za-z0-9._:-]{1,200}$/.test(reference.provider_model_id)) continue;
      const target = { provider_id: openCode.provider_id, model_id: reference.provider_model_id };
      add(target, `OpenCode Go · ${reference.provider_model_id} (${reference.model_support_state.toUpperCase()})`);
    }
  }

  if (current !== 'local' && !byKey.has(roleTargetKey(current))) {
    add(current, `${current.provider_id} · ${current.model_id} (not in the current catalog; preserved)`, true);
  }
  return options;
}
