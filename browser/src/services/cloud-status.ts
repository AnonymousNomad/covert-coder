import type { ByokStatusResponseT } from '../../../common/contracts/byok.ts';
import type { ConnectionsViewResponseT } from '../../../common/contracts/connections.ts';

export type NetworkState = 'CHECKING' | 'STATUS_UNAVAILABLE' | 'LOCAL_ONLY' | 'CONSENT_DISABLED' | 'CREDENTIAL_MISSING' | 'REMOTE_CONFIGURED' | 'REMOTE_AVAILABLE' | 'REMOTE_UNAVAILABLE';

export function deriveCloudStatus(byok: ByokStatusResponseT, view: ConnectionsViewResponseT): NetworkState {
  // This is an explicit routing policy, not a conclusion about provider existence.
  if (view.preference === 'local-only') return 'LOCAL_ONLY';
  if (!byok.consent_enabled) return 'CONSENT_DISABLED';
  const remote = view.connections.filter(connection => connection.access.external_egress_required && connection.kind !== 'catalog-token');
  if (remote.some(connection => connection.routing_available && connection.status === 'connected' &&
    connection.access.authentication_configured && connection.access.health === 'healthy' &&
    connection.access.setup_state === 'ready' && connection.access.model_refs.some(model => model.model_support_state === 'verified'))) return 'REMOTE_AVAILABLE';
  if (remote.some(connection => connection.access.credential_source.configuration_state === 'unknown')) return 'STATUS_UNAVAILABLE';
  const configured = remote.filter(connection => connection.access.authentication_configured);
  if (configured.length > 0) {
    if (configured.every(connection => connection.access.health === 'unhealthy' || connection.access.health === 'unavailable')) return 'REMOTE_UNAVAILABLE';
    return 'REMOTE_CONFIGURED';
  }
  // Empty discovery is not evidence that no remote providers exist.
  return remote.length === 0 ? 'STATUS_UNAVAILABLE' : 'CREDENTIAL_MISSING';
}

export function createCloudStatusReader(
  read: () => Promise<{ byok: ByokStatusResponseT; connections: ConnectionsViewResponseT }>,
  publish: (state: NetworkState) => void,
) {
  let generation = 0;
  let disposed = false;
  return {
    async refresh(): Promise<void> {
      if (disposed) return;
      const current = ++generation;
      publish('CHECKING');
      let state: NetworkState;
      try { const result = await read(); state = deriveCloudStatus(result.byok, result.connections); }
      catch { state = 'STATUS_UNAVAILABLE'; }
      if (!disposed && generation === current) publish(state);
    },
    dispose(): void { disposed = true; generation++; },
  };
}
