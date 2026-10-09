import {
  ManagedClientDiscovery,
  ManagedClientProbeResult,
  CLIENT_MATRIX,
  type ClientEvidenceStateT,
  type ManagedClientIdT,
  type ManagedClientDiscoveryT,
  type ManagedClientProbeResultT
} from '../../../common/contracts/managed-client.ts';

// P2 — Managed client registry. Discovery only: probes report executable,
// exact version, and hash; this layer NEVER reads credential files, never
// launches processes, and is not a plugin registry. It refuses unknown and
// duplicate client ids deterministically and orders results canonically.

export interface ClientProbe {
  client_id: ManagedClientIdT;
  // LIVE must come from a real supported probe; test doubles must say FIXTURE.
  evidence_state?: Exclude<ClientEvidenceStateT, 'NOT_RUN'>;
  detect(): Promise<ManagedClientProbeResultT | null>;
}

export function createManagedClientRegistry(options: { probes: ClientProbe[] }) {
  const probes = new Map<ManagedClientIdT, ClientProbe>();
  for (const probe of options.probes) {
    if (!Object.prototype.hasOwnProperty.call(CLIENT_MATRIX, probe.client_id)) {
      throw new Error('unknown managed client id');
    }
    if (probes.has(probe.client_id)) {
      throw new Error('duplicate managed client id: ' + probe.client_id);
    }
    probes.set(probe.client_id, probe);
  }

  async function discover(): Promise<ManagedClientDiscoveryT[]> {
    const ids = [...probes.keys()].sort();
    const results: ManagedClientDiscoveryT[] = [];
    for (const id of ids) {
      const probe = probes.get(id)!;
      let raw: Awaited<ReturnType<ClientProbe['detect']>> = null;
      let availability: ManagedClientDiscoveryT['availability'] = 'UNAVAILABLE';
      let availabilityReason: ManagedClientDiscoveryT['availability_reason'] = 'NOT_INSTALLED';
      try {
        raw = await probe.detect();
        if (raw !== null) {
          const parsed = ManagedClientProbeResult.safeParse(raw);
          if (parsed.success) {
            availability = 'AVAILABLE';
            availabilityReason = null;
          } else {
            availability = 'UNKNOWN';
            availabilityReason = 'INVALID_PROBE_RESULT';
            raw = null;
          }
        }
      } catch {
        availability = 'UNKNOWN';
        availabilityReason = 'PROBE_FAILED';
        raw = null;
      }
      const observed = raw === null ? null : ManagedClientProbeResult.parse(raw);
      const matrix = CLIENT_MATRIX[id];
      results.push(ManagedClientDiscovery.parse({
        client_id: id,
        detected: availability === 'AVAILABLE',
        availability,
        availability_reason: availabilityReason,
        executable_path: observed?.executable_path ?? null,
        exact_version: observed?.exact_version ?? null,
        executable_sha256: observed?.executable_sha256 ?? null,
        credential_availability: observed?.credential_availability ?? 'UNKNOWN',
        credential_owner: matrix.credential_owner,
        provider_identity: observed?.provider_identity ?? null,
        model_identity: observed?.model_identity ?? null,
        governance_state: matrix.default_truth,
        supported_capabilities: [...matrix.supported_capabilities],
        qualification_state: matrix.qualification_state,
        execution_surface: matrix.execution_surface,
        ownership: matrix.ownership,
        evidence_state: probe.evidence_state ?? 'NOT_RUN'
      }));
    }
    return results;
  }

  function tierOf(clientId: ManagedClientIdT) {
    if (!Object.prototype.hasOwnProperty.call(CLIENT_MATRIX, clientId)) {
      throw new Error('unknown managed client id');
    }
    return CLIENT_MATRIX[clientId].tier;
  }

  return Object.freeze({ discover, tierOf });
}
export type ManagedClientRegistry = ReturnType<typeof createManagedClientRegistry>;
