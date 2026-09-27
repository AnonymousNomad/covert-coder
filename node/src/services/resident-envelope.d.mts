// Type declarations for node/src/services/resident-envelope.mjs
// (Resident Awareness Layer, Slice 3 — awareness envelope compiler + shadow selection protocol.)

import type { ResidentSopCandidate, ResidentSopCatalog, ResidentSopBody, ResidentDiscoveryResult } from './resident-sops.mjs';
import type { ArsenalDescriptor } from './resident-arsenal.mjs';
import type { ArsenalFilter } from './resident-arsenal-query.mjs';

export declare const ENVELOPE_SECTION_ORDER: readonly string[];
export declare const ENVELOPE_TYPICAL_MAX_TOKENS: number;
export declare const ENVELOPE_HARD_MAX_TOKENS: number;
export declare const CAPABILITY_DETAIL_BUDGET_TOKENS: number;
export declare const MAX_DETAIL_DESCRIPTORS: number;
export declare const MAX_REQUEST_CHARACTERS: number;
export declare const MAX_CAPABILITY_INPUT_DESCRIPTORS: number;
export declare const FALLBACK_TOP1_MIN_SCORE: number;

export declare class ResidentEnvelopeError extends Error {
  code: string;
  detail?: unknown;
  constructor(code: string, message: string, detail?: unknown);
}

export interface EnvelopeSection {
  id: string;
  title: string | null;
  text: string;
  tokens: number;
  characters: number;
}

export interface EnvelopeMeasurements {
  total_tokens: number;
  system_tokens: number;
  characters: number;
  sections: Array<{ id: string; tokens: number; characters: number }>;
}

export interface CapabilityDetailSelection {
  selected: ArsenalDescriptor[];
  omitted: number;
  tokens: number;
  characters: number;
  budget: number;
  considered: number;
}

export interface CapabilitySectionResult extends CapabilityDetailSelection {
  matched: number;
  filtered: number;
  truncated: boolean;
  text: string;
}

export interface AwarenessEnvelope {
  text: string;
  systemText: string;
  sections: EnvelopeSection[];
  measurements: EnvelopeMeasurements;
  capability: CapabilitySectionResult | null;
  candidate_metadata_included: boolean;
  note: string;
}

export interface SopSelectionValidation {
  selected: string[];
  rejected: Array<{ id: string; reason: string }>;
  status: 'OK' | 'PARTIAL' | 'ALL_REJECTED' | 'NO_SELECTION';
  raw: string[];
}

export interface SopFallbackDecision {
  mode: 'TOP1' | 'ESCALATE';
  ids: string[];
  reason: string;
}

export declare function selectCapabilityDetails(
  descriptors: ArsenalDescriptor[],
  options?: { budgetTokens?: number; maxDescriptors?: number }
): Promise<CapabilityDetailSelection>;

export declare function buildSopSelectionPrompt(options: {
  request: string;
  candidates: ResidentSopCandidate[];
  continuity?: string | null;
}): string | null;

export declare function parseAndValidateSopSelection(
  text: string,
  candidates: ResidentSopCandidate[],
  options?: { catalog?: ResidentSopCatalog; root?: string; maxSelected?: number }
): Promise<SopSelectionValidation>;

export declare function resolveSopFallback(options?: {
  candidates?: ResidentSopCandidate[];
  discovery?: ResidentDiscoveryResult | null;
  minScore?: number;
}): SopFallbackDecision;

export declare function compileAwarenessEnvelope(options: {
  operatorRequest: string;
  constitution: { text: string };
  continuityProjection?: string | null;
  taskAuthority?: string | null;
  taskEvidence?: string | null;
  arsenalSummary?: { total: number; by_kind: Record<string, number>; by_availability: Record<string, number> } | null;
  sopCandidates?: ResidentSopCandidate[];
  sopBodies?: ResidentSopBody[];
  includeCandidateMetadata?: boolean;
  capability?: { descriptors: ArsenalDescriptor[]; filter?: ArsenalFilter; budgetTokens?: number } | null;
}, context?: { root?: string }): Promise<AwarenessEnvelope>;

export declare function analyzeEnvelopeDuplication(sections: Array<{ id: string; text: string }>): {
  duplicate_lines: Array<{ line: string; sections: string[] }>;
  shared_bigrams: Array<{ a: string; b: string; shared_bigrams: number }>;
};
