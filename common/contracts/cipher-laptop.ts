import { z } from 'zod';

// Logical Resident identity is independent of model, personality and scope.
// Installation/device principal identity is supplied separately by Authority.
export const CIPHER_RESIDENT_ID = 'covert.resident.cipher';
const SecretLike = /sk-[A-Za-z0-9_-]{8,}|Bearer\s+\S+|(?:token|password|api[_-]?key|secret)\s*[:=]/i;
const Ref = z.string().min(1).max(240).regex(/^[A-Za-z0-9._:/@-]+$/).refine(value => !SecretLike.test(value));
const Digest = z.string().regex(/^[a-f0-9]{64}$/);
export const CipherLedgerInput = z.object({
  action_id: Ref,
  event_type: z.enum(['PREPARE','AUTHORITY_DECISION','EFFECT_ATTEMPT','OBSERVATION','VERIFICATION','RECONCILIATION','SECURITY_EVENT','TOMBSTONE']),
  principal_id: Ref,
  principal_kind: z.enum(['operator','agent','adapter','service']),
  origin_channel: Ref,
  project_id: Ref.nullable(),
  checkout_id: z.string().uuid().nullable().optional(),
  task_id: Ref.nullable(),
  capability: Ref,
  target_ref: Ref,
  target_digest: Digest.nullable(),
  result_state: z.enum(['PENDING','ALLOWED','DENIED','APPLIED','OBSERVED','VERIFIED','FAILED','UNKNOWN_PENDING_RECONCILIATION','EXTERNAL_OR_UNATTRIBUTED']),
  authority_decision_ref: Ref.nullable().optional(),
  admission_decision_ref: Ref.nullable().optional(),
  effect_generation: Ref.nullable().optional(),
  observation_ref: Ref.nullable().optional(),
  evidence_ref: Ref.nullable().optional()
}).strict();
export const CipherLedgerRecord = CipherLedgerInput.extend({
  schema: z.literal('covert.cipher-ledger-record.v1'),
  ledger_id: z.string().uuid(),
  resident_id: Ref,
  sequence: z.number().int().nonnegative(),
  event_id: z.string().uuid(),
  recorded_at: z.string().datetime(),
  previous_record_hash: Digest,
  record_hash: Digest,
  signature_state: z.literal('SIGNATURE_UNAVAILABLE')
}).strict();
export const CipherLedgerState = z.object({
  schema: z.literal('covert.cipher-ledger.v1'),
  ledger_id: z.string().uuid(),
  resident_id: Ref,
  records: z.array(CipherLedgerRecord).max(10000),
  checkpoint_count: z.number().int().nonnegative(),
  checkpoint_root: Digest
}).strict();
export const CipherIntegrityState = z.enum(['NORMAL','DEGRADED','RECONCILING','LOCKDOWN']);
export const CipherLockdown = z.object({
  schema:z.literal('covert.lockdown-state.v1'),
  state:CipherIntegrityState,
  generation:z.number().int().nonnegative(),
  entered_at:z.string().datetime(),
  reasons:z.array(z.object({
    code:Ref, severity:z.enum(['INFO','OPERATIONAL','SECURITY_CRITICAL']),
    evidence_ref:Ref.nullable()
  }).strict()).max(64),
  operator_ack_required:z.boolean()
}).strict();
export const CipherLedgerStatus = CipherLockdown.extend({
  ledger_id:z.string().uuid().nullable(),
  resident_id:Ref,
  integrity:z.enum(['HASH_CHAIN_VERIFIED','UNAVAILABLE','FAILED']),
  signature_state:z.literal('SIGNATURE_UNAVAILABLE'),
  checkpoint_root:Digest.nullable(),
  record_count:z.number().int().nonnegative(),
  unresolved_actions:z.array(Ref).max(10000),
  limitations:z.array(z.string().max(300)).max(8)
}).strict();
export const CipherLedgerListResponse = z.object({records:z.array(CipherLedgerRecord).max(200),status:CipherLedgerStatus}).strict();
export type CipherLedgerInputT=z.infer<typeof CipherLedgerInput>;
export type CipherLedgerRecordT=z.infer<typeof CipherLedgerRecord>;
export type CipherLedgerStateT=z.infer<typeof CipherLedgerState>;
export type CipherLockdownT=z.infer<typeof CipherLockdown>;
export type CipherLedgerStatusT=z.infer<typeof CipherLedgerStatus>;
export type CipherLedgerListResponseT=z.infer<typeof CipherLedgerListResponse>;
