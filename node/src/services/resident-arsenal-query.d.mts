// Type declarations for node/src/services/resident-arsenal-query.mjs
// (Resident Awareness Layer, Slice 2 — bounded filtered Arsenal discovery.)

import type { ArsenalDescriptor, ArsenalProjection } from './resident-arsenal.mjs';

export declare const DEFAULT_FILTER_LIMIT: number;
export declare const MAX_FILTER_LIMIT: number;

export interface ArsenalFilter {
  kind?: string | string[];
  availability?: string | string[];
  capability?: string;
  location?: string | string[];
  role?: string;
}

export interface ArsenalFilterResult {
  filter: ArsenalFilter;
  matched: number;
  returned: ArsenalDescriptor[];
  truncated: boolean;
  limit: number;
}

export declare class ArsenalQueryError extends Error {
  code: string;
  constructor(code: string, message: string);
}

export declare function filterArsenalDescriptors(
  descriptors: ArsenalDescriptor[],
  filter?: ArsenalFilter,
  options?: { limit?: number }
): ArsenalFilterResult;

export declare function compactArsenalSummary(
  projection: ArsenalProjection
): { total: number; by_kind: Record<string, number>; by_availability: Record<string, number> };
