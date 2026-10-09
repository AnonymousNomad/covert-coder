import { z } from 'zod';
import {
  CanonicalCapabilityRecord,
  ProjectionRequest,
  ProjectionResult,
  type CanonicalCatalogSnapshotT,
  type ProjectionRequestT,
  type ProjectionResultT,
  type ProjectedToolDescriptorT,
  type ProjectionReasonT
} from '../../../common/contracts/capability-projection.ts';

// P1 — Capability Projection service (covert.capability-projection.v1).
//
// Read-only projection over canonical App Catalog truth supplied by a reader
// interface (the real App Catalog adapter is WAITING_ON_ACCEPTED_OWNER_
// CHECKPOINT). It never becomes a registry, never mutates the snapshot,
// spawns no processes, grants nothing, and returns a single deterministic
// result type: stale or owner-unavailable inputs are represented as
// exclusions inside ProjectionResult rather than thrown branching behavior.
//
// Filter order per record (first failure wins; scan order preserved):
// unknown-shape fields containing credential-shaped keys/values are refused
// before schema parsing (CREDENTIAL_REJECTED, fail-closed) -> MALFORMED_RECORD
// -> DUPLICATE_ID (first wins) -> WRONG_AUDIENCE -> WRONG_ROLE -> availability
// (UNOBSERVED => OWNER_UNAVAILABLE, UNAVAILABLE => UNAVAILABLE).

export interface CanonicalCatalogReader {
  read(): Promise<CanonicalCatalogSnapshotT | null>;
}

// Lenient top-level shape: capability entries stay unknown until the
// credential screen and then the strict record schema run per entry, so
// credential-shaped metadata is classified as CREDENTIAL_REJECTED rather
// than being collapsed into a generic MALFORMED_RECORD by strict parsing.
const LenientSnapshot = z.object({
  generation: z.string().uuid(),
  digest: z.string().regex(/^[a-f0-9]{64}$/),
  collected_at: z.string().datetime(),
  capabilities: z.array(z.unknown())
});

const CREDENTIAL_KEY_RE = /(secret|token|api[_-]?key|apikey|credential|password|cookie|authorization|bearer|private[_-]?key)/i;
const CREDENTIAL_VALUE_RE = /(sk-[A-Za-z0-9_-]{8,}|hf_[A-Za-z0-9]{8,}|ghp_[A-Za-z0-9]{8,}|AKIA[A-Z0-9]{8,}|Bearer\s+\S+)/;

function containsCredentialShapedMetadata(value: unknown, depth = 0): boolean {
  if (depth > 12 || value === null) return false;
  if (typeof value === 'string') return CREDENTIAL_VALUE_RE.test(value);
  if (Array.isArray(value)) return value.some(entry => containsCredentialShapedMetadata(entry, depth + 1));
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).some(([key, child]) =>
      CREDENTIAL_KEY_RE.test(key) || containsCredentialShapedMetadata(child, depth + 1));
  }
  return false;
}

export function createCapabilityProjection(options: { reader: CanonicalCatalogReader }) {
  async function project(request: ProjectionRequestT): Promise<ProjectionResultT> {
    const parsedRequest = ProjectionRequest.parse(request);
    const raw = await options.reader.read();
    if (raw === null) {
      // Truthful owner-unavailable: no fabricated catalog, no cached fallback.
      return ProjectionResult.parse({
        schema: 'covert.capability-projection.v1',
        generation: parsedRequest.expected_generation,
        catalog_digest: '0'.repeat(64),
        projected: [],
        excluded: [{ capability_id: null, reason: 'OWNER_UNAVAILABLE' }],
        execution_state: 'GATED',
        effect_replay: false
      });
    }
    const snapshot = LenientSnapshot.safeParse(raw);
    if (!snapshot.success) {
      return ProjectionResult.parse({
        schema: 'covert.capability-projection.v1',
        generation: parsedRequest.expected_generation,
        catalog_digest: '0'.repeat(64),
        projected: [],
        excluded: [{ capability_id: null, reason: 'MALFORMED_RECORD' }],
        execution_state: 'GATED',
        effect_replay: false
      });
    }
    const data = snapshot.data;
    if (data.generation !== parsedRequest.expected_generation) {
      return ProjectionResult.parse({
        schema: 'covert.capability-projection.v1',
        generation: data.generation,
        catalog_digest: data.digest,
        projected: [],
        excluded: data.capabilities.map(entry => ({
          capability_id: typeof (entry as { capability_id?: unknown }).capability_id === 'string' ? (entry as { capability_id: string }).capability_id : null,
          reason: 'STALE_GENERATION'
        })),
        execution_state: 'GATED',
        effect_replay: false
      });
    }

    const projected: ProjectedToolDescriptorT[] = [];
    const excluded: Array<{ capability_id: string | null; reason: ProjectionReasonT }> = [];
    const seen = new Set<string>();
    for (const entry of data.capabilities) {
      const rawId = typeof (entry as { capability_id?: unknown }).capability_id === 'string' ? (entry as { capability_id: string }).capability_id : null;
      if (containsCredentialShapedMetadata(entry)) { excluded.push({ capability_id: rawId, reason: 'CREDENTIAL_REJECTED' }); continue; }
      const record = CanonicalCapabilityRecord.safeParse(entry);
      if (!record.success) { excluded.push({ capability_id: rawId, reason: 'MALFORMED_RECORD' }); continue; }
      const capability = record.data;
      if (seen.has(capability.capability_id)) { excluded.push({ capability_id: capability.capability_id, reason: 'DUPLICATE_ID' }); continue; }
      seen.add(capability.capability_id);
      if (!capability.audiences.includes(parsedRequest.requested_by.audience)) { excluded.push({ capability_id: capability.capability_id, reason: 'WRONG_AUDIENCE' }); continue; }
      if (parsedRequest.requested_by.role !== null && capability.selected_roles.length > 0 && !capability.selected_roles.includes(parsedRequest.requested_by.role)) {
        excluded.push({ capability_id: capability.capability_id, reason: 'WRONG_ROLE' }); continue;
      }
      if (capability.availability === 'UNOBSERVED') { excluded.push({ capability_id: capability.capability_id, reason: 'OWNER_UNAVAILABLE' }); continue; }
      if (capability.availability !== 'ADDRESSABLE') { excluded.push({ capability_id: capability.capability_id, reason: 'UNAVAILABLE' }); continue; }
      projected.push({
        schema: 'covert.capability-projection.v1',
        capability_id: capability.capability_id,
        owner: capability.owner,
        method: capability.method,
        route: capability.route,
        effect: capability.effect,
        audiences: capability.audiences,
        selected_roles: capability.selected_roles,
        external_egress_required: capability.external_egress_required,
        availability: capability.availability,
        description: capability.description ?? null,
        generation: data.generation,
        source: 'AppCatalog'
      });
    }
    return ProjectionResult.parse({
      schema: 'covert.capability-projection.v1',
      generation: data.generation,
      catalog_digest: data.digest,
      projected,
      excluded,
      execution_state: 'GATED',
      effect_replay: false
    });
  }
  return Object.freeze({ project });
}
export type CapabilityProjection = ReturnType<typeof createCapabilityProjection>;
