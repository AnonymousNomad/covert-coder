// Type declarations for node/src/services/resident-sops.mjs
// (Resident Awareness Layer, Slice 2 — Resident SOP namespace + bounded discovery.)

export declare const RESIDENT_NAMESPACE: string;
export declare const RESIDENT_SOPS_DIR: string;
export declare const DEFAULT_CANDIDATE_LIMIT: number;
export declare const MAX_SELECTED_BODIES: number;
export declare const DEFAULT_FALLBACK_IDS: readonly string[];
export declare const MIN_SCORE: number;
export declare const MIN_IDF: number;

export interface ResidentSopMetadata {
  id: string;
  role: string;
  purpose: string;
  use_when: string[];
  requires: string[];
  produces: string;
  authority_effect: string;
  body_ref: string;
}

export interface ResidentSopCandidate extends ResidentSopMetadata {
  score?: number;
}

export interface ResidentSopCatalog {
  schema_version: string;
  namespace: string;
  note?: string;
  sops: ResidentSopMetadata[];
}

export interface ResidentDiscoveryResult {
  request: string;
  candidates: ResidentSopCandidate[];
  count: number;
  fallback: boolean;
  reason: string | null;
  capped: true;
}

export interface ResidentSopBody {
  id: string;
  body: string;
  characters: number;
  tokens: number;
  body_ref: string;
}

export declare class ResidentSopError extends Error {
  code: string;
  constructor(code: string, message: string);
}

export declare function loadResidentCatalog(options?: { root?: string }): Promise<ResidentSopCatalog>;
export declare function loadResidentConstitution(options?: { root?: string }): Promise<{ text: string; tokens: number; ref: string }>;
export declare function discoverResidentSops(request: string, options?: { root?: string; limit?: number; catalog?: ResidentSopCatalog }): Promise<ResidentDiscoveryResult>;
export declare function loadResidentSopBody(id: string, options?: { root?: string; catalog?: ResidentSopCatalog }): Promise<ResidentSopBody>;
export declare function loadResidentSopBodies(ids: string[], options?: { root?: string; catalog?: ResidentSopCatalog; max?: number }): Promise<ResidentSopBody[]>;
