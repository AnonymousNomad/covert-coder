// node/src/services/resident-arsenal-query.mjs
//
// RESIDENT AWARENESS LAYER — SLICE 2: bounded filtered discovery over the accepted
// Slice-1 Arsenal projection. READ-ONLY consumer: it never rebuilds, mutates or
// re-reads canonical sources; it only filters descriptors that were already produced
// by node/src/services/resident-arsenal.mjs. Result sets are always bounded — the
// full 348-descriptor Arsenal is never returned in one call.

export const DEFAULT_FILTER_LIMIT = 20;
export const MAX_FILTER_LIMIT = 50;

export class ArsenalQueryError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ArsenalQueryError';
    this.code = code;
  }
}

function matchesValue(value, expected) {
  if (expected === undefined) return true;
  const list = Array.isArray(expected) ? expected : [expected];
  return list.includes(value);
}

export function filterArsenalDescriptors(descriptors, filter = {}, { limit = DEFAULT_FILTER_LIMIT } = {}) {
  if (!Array.isArray(descriptors)) throw new ArsenalQueryError('INVALID_INPUT', 'descriptors must be an array');
  const cap = Math.max(1, Math.min(Number.isInteger(limit) ? limit : DEFAULT_FILTER_LIMIT, MAX_FILTER_LIMIT));
  const { kind, availability, capability, location, role } = filter;
  const matched = descriptors.filter(descriptor => {
    if (!descriptor || typeof descriptor !== 'object') return false;
    if (!matchesValue(descriptor.kind, kind)) return false;
    if (!matchesValue(descriptor.availability, availability)) return false;
    if (location !== undefined && !matchesValue(descriptor.location, location)) return false;
    if (role !== undefined) {
      const roles = Array.isArray(descriptor.roles) ? descriptor.roles : [];
      if (!roles.includes(role)) return false;
    }
    if (capability !== undefined) {
      const caps = Array.isArray(descriptor.capabilities) ? descriptor.capabilities : [];
      const needle = String(capability).toLowerCase();
      if (!caps.some(entry => String(entry).toLowerCase().includes(needle))) return false;
    }
    return true;
  });
  return {
    filter: { ...filter },
    matched: matched.length,
    returned: matched.slice(0, cap),
    truncated: matched.length > cap,
    limit: cap
  };
}

export function compactArsenalSummary(projection) {
  if (!projection || !projection.summary || typeof projection.summary.total !== 'number') {
    throw new ArsenalQueryError('INVALID_PROJECTION', 'a Slice-1 arsenal projection is required');
  }
  return {
    total: projection.summary.total,
    by_kind: { ...projection.summary.by_kind },
    by_availability: { ...projection.summary.by_availability }
  };
}
