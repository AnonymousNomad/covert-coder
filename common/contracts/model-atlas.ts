import { z } from 'zod';
import { ModelAccessQualificationState, ModelQualificationBasis } from './model-access.ts';

// Canonical durable evaluation record for the Model Atlas. Harness Sync creates
// candidates; an authorized evaluation run produces one immutable record.
// Native (no scaffold) and harnessed (scaffold ON) results are always preserved
// separately; nothing here replaces one side with the other.

export const MODEL_ATLAS_SCHEMA = 'covert.model-atlas.evaluation.v1';
export const MODEL_ATLAS_CANDIDATE_SCHEMA = 'covert.model-atlas.candidate.v1';

const SafeRef = z.string().min(1).max(240);
const Sha256 = z.string().regex(/^[a-f0-9]{64}$/i);
const BoundedText = z.string().min(1).max(240);
const IsoTime = z.string().refine(value => Number.isFinite(Date.parse(value)), 'timestamp required');
const Ratio = z.number().min(0).max(1);

export const AtlasEvaluationCondition = z.enum(['NATIVE', 'HARNESSED']);
export const AtlasConditionOutcome = z.enum(['COMPLETED', 'PARTIAL', 'FAILED', 'CANCELLED']);

export const AtlasFingerprint = z.strictObject({
  model_id: SafeRef,
  source_revision: BoundedText.nullable(),
  artifact_sha256: Sha256.nullable(),
  quantization: z.string().max(40).nullable(),
  runtime_id: SafeRef.nullable(),
  runtime_version: z.string().max(120).nullable(),
  harness_version: z.string().max(40).nullable(),
  benchmark_id: SafeRef.nullable(),
  benchmark_version: z.string().max(40).nullable(),
  grader_version: z.string().max(40).nullable(),
  inference_config_digest: Sha256.nullable(),
  machine_profile_digest: Sha256.nullable(),
  execution_node: z.string().max(80).nullable(),
  chat_template: z.enum(['present', 'absent', 'unknown'])
});

export const AtlasConditionResult = z.strictObject({
  condition: AtlasEvaluationCondition,
  outcome: AtlasConditionOutcome,
  score: z.strictObject({
    passed: z.number().int().min(0),
    total: z.number().int().min(0),
    ratio: Ratio
  }),
  latency: z.strictObject({
    total_ms: z.number().min(0),
    mean_ms: z.number().min(0)
  }).nullable(),
  tokens: z.strictObject({
    total: z.number().int().min(0),
    mean: z.number().min(0)
  }).nullable(),
  failures: z.array(z.strictObject({
    code: BoundedText,
    count: z.number().int().min(1)
  })),
  categories: z.array(z.strictObject({
    id: BoundedText,
    passed: z.number().int().min(0),
    total: z.number().int().min(0)
  })),
  evidence_refs: z.array(SafeRef)
});

export const AtlasComparison = z.strictObject({
  basis: z.literal('scaffold-ablation'),
  delta_score: z.number(),
  delta_latency_ms: z.number().nullable(),
  delta_tokens: z.number().nullable(),
  categories: z.array(z.strictObject({
    id: BoundedText,
    native_passed: z.number().int().min(0),
    harnessed_passed: z.number().int().min(0),
    total: z.number().int().min(0)
  }))
});

export const AtlasRecommendation = z.strictObject({
  role: z.enum([
    'CODER', 'PLANNER', 'REVIEWER', 'RESIDENT', 'VERIFIER', 'TOOL_USE', 'LOW_MEMORY',
    'FAST_LOCAL', 'CLAIM_ADHERENCE', 'LONG_CONTEXT', 'COMPOUND_TASKS'
  ]),
  reason: BoundedText,
  evidence_refs: z.array(SafeRef)
});

export const AtlasEvidenceFreshness = z.strictObject({
  checked_at: IsoTime,
  state: z.enum(['FRESH', 'STALE']),
  scope: z.enum(['NONE', 'RESOURCE', 'FULL']),
  stale_reasons: z.array(z.string().max(80))
});

export const AtlasEvaluationRecord = z.strictObject({
  schema: z.literal(MODEL_ATLAS_SCHEMA),
  evaluation_id: z.string().uuid(),
  model_id: SafeRef,
  display_name: z.string().min(1).max(240),
  fingerprint: AtlasFingerprint,
  hardware_profile: z.strictObject({
    cpu: z.string().max(120).nullable(),
    ram_bytes: z.number().int().min(0).nullable(),
    gpu: z.string().max(120).nullable(),
    vram_bytes: z.number().int().min(0).nullable(),
    backend: z.string().max(40).nullable(),
    digest: Sha256.nullable(),
    execution_node: z.string().max(80).nullable(),
    execution_domain: z.enum(['INTERNAL', 'WORKSPACE', 'WSL', 'ISOLATED', 'EXTERNAL_HOST', 'REMOTE']).nullable()
  }),
  native: AtlasConditionResult.nullable(),
  harnessed: AtlasConditionResult.nullable(),
  comparison: AtlasComparison.nullable(),
  qualification: z.strictObject({
    state: ModelAccessQualificationState,
    basis: ModelQualificationBasis.nullable(),
    stale_reasons: z.array(z.string().max(80))
  }),
  recommended_roles: z.array(AtlasRecommendation),
  known_failures: z.array(z.strictObject({ code: BoundedText, detail: BoundedText })),
  known_limitations: z.array(BoundedText),
  evidence_refs: z.array(SafeRef),
  evaluated_at: IsoTime,
  completed_at: IsoTime.nullable(),
  receipt: z.strictObject({
    native_attempted: z.boolean(),
    harnessed_attempted: z.boolean(),
    executed: z.boolean(),
    notes: z.array(BoundedText)
  })
});

export const AtlasRecordedEvaluation = AtlasEvaluationRecord.extend({
  freshness: AtlasEvidenceFreshness
});

export const AtlasCandidateReason = z.enum(['NO_EVIDENCE', 'STALE_EVIDENCE', 'INCOMPLETE_EVIDENCE']);

export const AtlasEvaluationCandidate = z.strictObject({
  schema: z.literal(MODEL_ATLAS_CANDIDATE_SCHEMA),
  candidate_id: z.string().uuid(),
  model_id: SafeRef,
  display_name: z.string().min(1).max(240),
  fingerprint: AtlasFingerprint,
  reason: AtlasCandidateReason,
  stale_reasons: z.array(z.string().max(80)),
  created_at: IsoTime,
  execution: z.strictObject({
    mode: z.literal('AUTHORITY_REQUIRED'),
    executed: z.literal(false)
  })
});

export const AtlasEvaluationState = z.enum(['NEVER_EVALUATED', 'CURRENT', 'STALE', 'INCOMPLETE']);

export const ModelAtlasModelEntry = z.strictObject({
  model_id: SafeRef,
  display_name: z.string().min(1).max(240),
  artifact_sha256: Sha256.nullable(),
  evaluation_state: AtlasEvaluationState,
  qualification_state: ModelAccessQualificationState.nullable(),
  latest_evaluation_id: z.string().uuid().nullable(),
  latest_evaluated_at: IsoTime.nullable(),
  stale_reasons: z.array(z.string().max(80)),
  scope: z.enum(['NONE', 'RESOURCE', 'FULL']),
  recommended_roles: z.array(z.string().max(64)),
  candidate_id: z.string().uuid().nullable()
});

export const ModelAtlasModelsResponse = z.strictObject({
  generated_at: IsoTime,
  models: z.array(ModelAtlasModelEntry)
});

export const ModelAtlasHistoryEntry = z.strictObject({
  evaluation_id: z.string().uuid(),
  evaluated_at: IsoTime,
  native_ratio: Ratio.nullable(),
  harnessed_ratio: Ratio.nullable(),
  delta_score: z.number().nullable(),
  qualification_state: ModelAccessQualificationState
});

export const ModelAtlasRecordResponse = z.strictObject({
  generated_at: IsoTime,
  record: AtlasRecordedEvaluation,
  history: z.array(ModelAtlasHistoryEntry)
});

export const ModelAtlasCandidateResponse = z.strictObject({
  generated_at: IsoTime,
  candidate: AtlasEvaluationCandidate.nullable()
});

export type AtlasFingerprintT = z.infer<typeof AtlasFingerprint>;
export type AtlasConditionResultT = z.infer<typeof AtlasConditionResult>;
export type AtlasEvaluationRecordT = z.infer<typeof AtlasEvaluationRecord>;
export type AtlasRecordedEvaluationT = z.infer<typeof AtlasRecordedEvaluation>;
export type AtlasEvaluationCandidateT = z.infer<typeof AtlasEvaluationCandidate>;
export type ModelAtlasModelEntryT = z.infer<typeof ModelAtlasModelEntry>;
export type ModelAtlasHistoryEntryT = z.infer<typeof ModelAtlasHistoryEntry>;
export type ModelAtlasModelsResponseT = z.infer<typeof ModelAtlasModelsResponse>;
export type ModelAtlasRecordResponseT = z.infer<typeof ModelAtlasRecordResponse>;
export type ModelAtlasCandidateResponseT = z.infer<typeof ModelAtlasCandidateResponse>;
export type AtlasEvaluationStateT = z.infer<typeof AtlasEvaluationState>;
export type AtlasCandidateReasonT = z.infer<typeof AtlasCandidateReason>;
