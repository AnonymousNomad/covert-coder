import {
  ManagedClientDiscovery,
  CLIENT_MATRIX,
  type ManagedClientIdT,
  type ManagedClientDiscoveryT
} from '../../../common/contracts/managed-client.ts';

// P2 — Managed client registry. Discovery only: probes report executable,
// exact version, and hash; this layer NEVER reads credential files, never
// launches processes, and is not a plugin registry. It refuses unknown and
// duplicate client ids deterministically and orders results canonically.

export interface ClientProbe {
  client_id: ManagedClientIdT;
  detect(): Promise<{ executable_path: string; exact_version: string | null; executable_sha256: string | null } | null>;
}

export function createManagedClientRegistry(options: { probes: ClientProbe[] }) {
  const probes = new Map<ManagedClientIdT, ClientProbe>();
  for (const probe of options.probes) {
    if (!(probe.client_id in CLIENT_MATRIX)) {
      throw new Error(`unknown managed client id: ${String(probe.client_id)}`);
    }
    if (probes.has(probe.client_id)) {
      throw new Error(`duplicate managed client id: ${probe.client_id}`);
    }
    probes.set(probe.client_id, probe);
  }

  async function discover(): Promise<ManagedClientDiscoveryT[]> {
    const ids = [...probes.keys()].sort();
    const results: ManagedClientDiscoveryT[] = [];
    for (const id of ids) {
      const probe = probes.get(id)!;
      let observed: Awaited<ReturnType<ClientProbe['detect']>> = null;
      try {
        observed = await probe.detect();
      } catch {
        observed = null; // detection failure degrades truthfully, never fabricated
      }
      results.push(ManagedClientDiscovery.parse({
        client_id: id,
        detected: observed !== null,
        executable_path: observed?.executable_path ?? null,
        exact_version: observed?.exact_version ?? null,
        executable_sha256: observed?.executable_sha256 ?? null,
        auth_state: observed === null ? 'NOT_DETECTED' : 'DETECTED'
      }));
    }
    return results;
  }

  function tierOf(clientId: ManagedClientIdT) {
    return CLIENT_MATRIX[clientId].tier;
  }

  return Object.freeze({ discover, tierOf });
}
export type ManagedClientRegistry = ReturnType<typeof createManagedClientRegistry>;
