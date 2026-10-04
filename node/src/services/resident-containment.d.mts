// Type declarations for node/src/services/resident-containment.mjs
// (Canonical live containment — governed answer gate for the Resident chat path.)

export declare const CONTAINMENT_ENV_FLAG: string;
export declare function containmentEnabled(env?: Record<string, string | undefined>): boolean;
export declare const UNUSABLE_TEXT: string;
export declare const CANONICAL_SUPPORT_OWNERS: Readonly<Record<string, string>>;
export declare const NOTES: Readonly<{ structural: string; fact: string; capability: string; tool_call: string }>;

export declare function normalizeText(value: unknown): string;

export interface StructuralFlags {
  degenerate: boolean;
  degenerate_flags: string[];
  echo: boolean;
  echo_reason: string | null;
  malformed: boolean;
  contradiction: boolean;
  contradiction_trailing: string[];
}
export declare function structuralFlags(question: string, text: string): StructuralFlags;
export declare function structuralHit(flags: StructuralFlags): boolean;

export interface FactClaim {
  claim: string;
  type: string;
  owner: string;
  status: 'SUPPORTED' | 'UNVERIFIED' | 'CONTRADICTED';
}
export declare function factCheck(text: string, canonical?: Record<string, unknown>): { claims: FactClaim[]; fail_closed: boolean };

export interface CapabilityClaim {
  claim: string;
  kind: string;
  sentence: string;
}
export declare function capabilityClaims(text: string, projection: unknown): {
  unsupported: CapabilityClaim[];
  contradicted: CapabilityClaim[];
  supported: CapabilityClaim[];
  checked: boolean;
};

export interface GateDecision {
  normalized: string;
  structural: StructuralFlags;
  fact: { claims: FactClaim[]; fail_closed: boolean };
  fabrication: boolean;
  false_allow: boolean;
  tool_call: boolean;
  capability: { unsupported: CapabilityClaim[]; contradicted: CapabilityClaim[]; supported: CapabilityClaim[]; checked: boolean };
  triggers: string[];
  support: { owners: Record<string, string>; claims: FactClaim[] };
  regenerate: boolean;
  reason: string | null;
}
export declare function gateDecision(options?: {
  requestText?: string;
  text?: string;
  projection?: unknown;
  canonical?: Record<string, unknown>;
}): GateDecision;

export interface GovernedAnswer {
  at: string;
  request: string;
  raw: string;
  normalized: string;
  triggers: string[];
  support: { owners: Record<string, string>; claims: FactClaim[] };
  capability: { unsupported: CapabilityClaim[]; contradicted: CapabilityClaim[] };
  retry: { note: string | null; raw: string; normalized: string; triggers: string[] } | null;
  disposition: 'OK' | 'REGENERATED' | 'RESIDENT_OUTPUT_UNUSABLE';
  final: string;
}
export declare function governAnswer(options?: {
  requestText?: string;
  rawText?: string;
  generate?: ((note: string | null) => Promise<string>) | null;
  projection?: unknown;
  canonical?: Record<string, unknown>;
}): Promise<GovernedAnswer>;

export declare function logContainment(workspace: string, record: GovernedAnswer | null): void;
