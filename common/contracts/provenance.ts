import { z } from 'zod';

// Canonical provenance ledger contract. Every model-backed run records ONE
// structured observation: what ran, which worker/model/provider hints, the
// outcome, verification state, and evidence pointers. Strict objects: private
// chain-of-thought and unknown fields are REJECTED, never stored.
//
// Ledger law: a run record is an OBSERVATION of what happened. It is not a
// verification claim. Supported conclusions live in the Mission Receipt and
// must say "not recorded" when truth is absent.
export const ProvenanceRunResult = z.enum(['done', 'error', 'aborted']);
export type ProvenanceRunResultT = z.infer<typeof ProvenanceRunResult>;

export const ProvenanceRun = z.strictObject({
  run_id: z.string().min(1).max(200),
  task_id: z.string().min(1).max(200),
  task: z.string().max(500),
  mode: z.string().max(20),
  worker: z.string().max(200).nullable(),
  handoff_id: z.string().max(200).nullable(),
  chat_source: z.string().max(40).nullable(),
  result: ProvenanceRunResult,
  error: z.string().max(300).nullable(),
  verification_state: z.string().max(40),
  evidence_file: z.string().max(500).nullable(),
  trajectory_file: z.string().max(500).nullable(),
  iterations: z.number().int().gte(0),
  attempt_id: z.string().max(200).nullable().optional(),
  started_at: z.string(),
  finished_at: z.string()
});
export type ProvenanceRunT = z.infer<typeof ProvenanceRun>;

export const ProvenanceListResponse = z.strictObject({
  runs: z.array(ProvenanceRun).max(500),
  total: z.number().int().gte(0),
  corrupt_lines: z.number().int().gte(0)
});
export type ProvenanceListResponseT = z.infer<typeof ProvenanceListResponse>;

export const ProvenanceGetQuery = z.strictObject({ id: z.string().min(1).max(200) });
export const ProvenanceGetResponse = z.strictObject({ run: ProvenanceRun });
export type ProvenanceGetResponseT = z.infer<typeof ProvenanceGetResponse>;

export const MissionReceiptQuery = z.strictObject({ id: z.string().min(1).max(200) });

export const MissionReceiptHandoff = z.strictObject({
  handoff_id: z.string().max(200),
  from: z.string().max(200),
  to: z.string().max(200),
  state: z.string().max(40),
  objective: z.string().max(2000)
});

export const MissionReceiptResponse = z.strictObject({
  mission_id: z.string().max(200),
  workspace: z.string().max(1000),
  recorded_at: z.string(),
  runs: z.array(ProvenanceRun).max(200),
  handoffs: z.array(MissionReceiptHandoff).max(50),
  verification: z.string().max(40),
  supported_conclusion: z.string().max(600).nullable(),
  limitations: z.array(z.string().max(300)).max(20),
  evidence_refs: z.array(z.string().max(500)).max(50)
});
export type MissionReceiptResponseT = z.infer<typeof MissionReceiptResponse>;
