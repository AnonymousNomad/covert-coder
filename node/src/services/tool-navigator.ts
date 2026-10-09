import {
  ToolSearchRequest,
  ToolSearchResult,
  ToolDescribeRequest,
  ToolDescriptor,
  ToolNavigationError,
  type ToolSearchRequestT,
  type ToolSearchResultT,
  type ToolDescribeRequestT,
  type ToolDescriptorT,
  type ToolNavigationErrorT
} from '../../../common/contracts/tool-navigation.ts';
import type { CanonicalCatalogReader, CapabilityProjection } from './capability-projection.ts';

type ToolSearchHit = ToolSearchResultT['hits'][number];

// P1 — Tool Navigator (covert.tool-navigation.v1).
//
// Bounded, deterministic on-demand discovery for small models (Cipher/Liquid).
// Search returns a small candidate set; describe loads one full descriptor.
// The navigator consumes the canonical projection (never the raw catalog),
// invents nothing, converts unknown into nothing, and carries GATED state.
// Ranking is deterministic: score = 3*(ID hits) + 2*(owner hits) + 1*(keyword
// hits), tie-break by canonical projection order. No randomness, no model.

const TOKEN_RE = /[^a-z0-9_.:-]+/g;

function tokenize(objective: string): string[] {
  const tokens = objective.toLowerCase().split(TOKEN_RE).map(token => token.trim()).filter(token => token.length >= 2 && token !== '-');
  return [...new Set(tokens)];
}

export function createToolNavigator(options: { projection: CapabilityProjection; reader: CanonicalCatalogReader }) {
  async function snapshotFor(request: ToolSearchRequestT | ToolDescribeRequestT) {
    const raw = await options.reader.read();
    if (raw === null) return { kind: 'owner_unavailable' as const };
    if (raw.generation !== request.expected_generation) {
      return { kind: 'stale' as const, generation: raw.generation };
    }
    return { kind: 'ok' as const, generation: raw.generation };
  }

  function error(reason: ToolNavigationErrorT['reason'], capabilityId: string | null, generation: string | null): ToolNavigationErrorT {
    return ToolNavigationError.parse({ schema: 'covert.tool-navigation.v1', reason, capability_id: capabilityId, generation });
  }

  async function search(request: ToolSearchRequestT): Promise<ToolSearchResultT | ToolNavigationErrorT> {
    const parsed = ToolSearchRequest.parse(request);
    if (parsed.objective.trim().length === 0) return error('EMPTY_OBJECTIVE', null, null);
    const state = await snapshotFor(parsed);
    if (state.kind === 'owner_unavailable') return error('UNAVAILABLE', null, null);
    if (state.kind === 'stale') return error('STALE_GENERATION', null, state.generation);
    const projection = await options.projection.project({
      requested_by: { principal_id: 'navigator', audience: parsed.audience, role: parsed.role },
      project: { project_id: '00000000-0000-4000-8000-000000000000', checkout_id: '00000000-0000-4000-8000-000000000000' },
      expected_generation: parsed.expected_generation
    });
    const tokens = tokenize(parsed.objective);
    const scored: Array<{ hit: ToolSearchHit; score: number }> = [];
    for (const tool of projection.projected) {
      const idLower = tool.capability_id.toLowerCase();
      const ownerLower = tool.owner.toLowerCase();
      const keywordHaystack = `${tool.route} ${tool.description ?? ''}`.toLowerCase();
      let score = 0;
      let matchedOn: ToolSearchHit['matched_on'] = 'KEYWORDS';
      for (const token of tokens) {
        if (idLower.includes(token)) { score += 3; matchedOn = 'ID'; }
        else if (ownerLower.includes(token)) { score += 2; if (matchedOn !== 'ID') matchedOn = 'OWNER'; }
        else if (keywordHaystack.includes(token)) { score += 1; }
      }
      if (score > 0) scored.push({ score, hit: {
        capability_id: tool.capability_id, owner: tool.owner, effect: tool.effect,
        external_egress_required: tool.external_egress_required, availability: tool.availability, matched_on: matchedOn
      } });
    }
    const ordered = scored.map((entry, index) => ({ entry, index }))
      .sort((a, b) => (b.entry.score - a.entry.score) || (a.index - b.index))
      .map(item => item.entry.hit);
    const hits = ordered.slice(0, parsed.limit);
    return ToolSearchResult.parse({
      schema: 'covert.tool-navigation.v1',
      generation: projection.generation,
      hits,
      total_considered: projection.projected.length,
      truncated: ordered.length > parsed.limit,
      execution_state: 'GATED'
    });
  }

  async function describe(request: ToolDescribeRequestT): Promise<ToolDescriptorT | ToolNavigationErrorT> {
    const parsed = ToolDescribeRequest.parse(request);
    const state = await snapshotFor(parsed);
    if (state.kind === 'owner_unavailable') return error('UNAVAILABLE', parsed.capability_id, null);
    if (state.kind === 'stale') return error('STALE_GENERATION', parsed.capability_id, state.generation);
    const projection = await options.projection.project({
      requested_by: { principal_id: 'navigator', audience: parsed.audience, role: parsed.role },
      project: { project_id: '00000000-0000-4000-8000-000000000000', checkout_id: '00000000-0000-4000-8000-000000000000' },
      expected_generation: parsed.expected_generation
    });
    const tool = projection.projected.find(entry => entry.capability_id === parsed.capability_id);
    if (!tool) {
      const exclusion = projection.excluded.find(entry => entry.capability_id === parsed.capability_id);
      const reason = exclusion?.reason ?? 'UNKNOWN_CAPABILITY';
      const mapped = reason === 'MALFORMED_RECORD' ? 'MALFORMED_RECORD'
        : reason === 'WRONG_AUDIENCE' ? 'WRONG_AUDIENCE'
        : reason === 'WRONG_ROLE' ? 'WRONG_ROLE'
        : reason === 'UNAVAILABLE' || reason === 'OWNER_UNAVAILABLE' ? 'UNAVAILABLE'
        : 'UNKNOWN_CAPABILITY';
      return error(mapped, parsed.capability_id, projection.generation);
    }
    return ToolDescriptor.parse({
      schema: 'covert.tool-navigation.v1',
      capability_id: tool.capability_id,
      owner: tool.owner,
      method: tool.method,
      route: tool.route,
      effect: tool.effect,
      audiences: tool.audiences,
      selected_roles: tool.selected_roles,
      external_egress_required: tool.external_egress_required,
      availability: tool.availability,
      description: tool.description,
      generation: tool.generation,
      execution_state: 'GATED'
    });
  }

  return Object.freeze({ search, describe });
}
export type ToolNavigator = ReturnType<typeof createToolNavigator>;
