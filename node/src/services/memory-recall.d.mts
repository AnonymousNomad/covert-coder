// Type shim for memory-recall.mjs (the runtime module is pure ESM JS).
export interface MemoryEntry {
  session_id: string;
  ts: string;
  intent?: string;
  summary?: string;
  skills_invoked?: string[];
  files_touched?: string[];
  outcome?: string;
  scope?: 'workspace';
  fact_key?: string;
  supersedes?: string[];
  validated?: boolean;
  [key: string]: unknown;
}
export interface MemoryHit {
  session_id: string;
  ts: string;
  intent?: string;
  summary?: string;
  skills_invoked: string[];
  files_touched: string[];
  outcome?: string;
  fact_key?: string;
  validity?: string;
  evidence_ref?: string;
  score: number;
}
export interface RecallResult {
  hits: MemoryHit[];
  degraded: boolean;
  reason?: string;
  approxTokens: number;
}
export interface MemoryStatus {
  count: number;
  file: string;
  lastTs: string | null;
  degraded: boolean;
  reason?: string;
}
export interface MemoryRecallApi {
  recall(query: string, opts?: { topN?: number; budgetTokens?: number }): Promise<RecallResult>;
  remember(entry: { session_id?: string; ts?: string; validity?: string; evidence_ref?: string; [key: string]: unknown }): Promise<void>;
  status(): Promise<MemoryStatus>;
}
export function createMemoryRecall(opts: { workspace: string }): MemoryRecallApi;

