// Type declarations for node/src/services/resident-awareness-provider.mjs
// (Resident Awareness Layer, Slice 4 — live dogfood awareness provider.)

import type { ResidentSopCandidate, ResidentDiscoveryResult } from './resident-sops.mjs';
import type { ArsenalFilter } from './resident-arsenal-query.mjs';

export declare const AWARENESS_ENV_FLAG: string;
export declare const STRONG_SOP_SCORE: number;
export declare const SUMMARY_POLICIES: readonly string[];
export declare const STATUS_SOP_ID: string;
export declare const AUTHORITY_OPERATION_RISKS: readonly string[];
export declare const AUTHORITY_CLASS_BY_EFFECT: Readonly<Record<string, string>>;
export declare function canonicalAuthorityOperationKinds(): string[];
export declare function operationClassFor(sop: { authority_effect?: string } | null | undefined): string | null;
export declare function isOperationDirective(task: string): boolean;

export interface AwarenessJournalEntry {
  at: string;
  enabled: boolean;
  task_class: string;
  task: string;
  candidates: Array<{ id: string; score: number | null }>;
  selected: string[];
  selection_mode: string | null;
  operation_class: string | null;
  sop_body_tokens: number;
  summary_included: boolean;
  capability: { selected: number; omitted: number; tokens: number } | null;
  discovery_ms: number;
  selection_ms: number;
  body_ms: number;
  arsenal_ms: number;
  injected_tokens: number;
  envelope_tokens: number;
  compile_ms: number;
  degraded: boolean;
  reason: string | null;
}

export declare function awarenessEnabled(env?: Record<string, string | undefined>): boolean;
export declare function needsCapabilityDetails(task: string): boolean;
export declare function capabilityFilterFor(task: string): ArsenalFilter | null;
export declare function classifyTask(task: string): string;
export declare function selectSopsDeterministically(
  discovery: Pick<ResidentDiscoveryResult, 'candidates' | 'fallback'> & { request?: string },
  options?: { strongScore?: number; limit?: number }
): { ids: string[]; mode: 'strong' | 'strong+class' | 'class' | 'status-default' | 'none'; operation_class: string | null };

export declare function createResidentAwarenessProvider(options: {
  workspace: string;
  repoRoot?: string;
  enabled?: boolean | null;
  projection?: unknown;
  projectionLoader?: (() => Promise<unknown>) | null;
  continuity?: string | (() => Promise<string>) | null;
  taskAuthority?: string | null;
  taskEvidence?: string | null;
  summaryPolicy?: 'always' | 'conditional';
  journalLimit?: number;
}): {
  enabled: boolean;
  provider: (task: string) => Promise<string>;
  getJournal: () => AwarenessJournalEntry[];
  getProjection: () => Promise<unknown>;
  _internal: { loadProjectionOnce: () => Promise<unknown> };
};

export type { ResidentSopCandidate };
