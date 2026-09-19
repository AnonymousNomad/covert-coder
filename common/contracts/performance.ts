import { z } from 'zod';

// Harness Lab — versioned model-performance observation contract.
//
// One PerformanceEvent is ONE objective observation of a model doing ONE
// benchmark task through the real Covert harness. Events store identities,
// hashes, references and safe measurements ONLY — never hidden reasoning,
// prompts, credentials, or private source contents. Every object is strict so
// unknown fields (including leaked secrets or raw prompts) are rejected at the
// contract edge instead of being persisted.
//
// v1.1 adds: context economics per source (EXACT/ESTIMATED), the Veritas
// outcome of the observation, and which methodology was actually loaded.
// v1.0 records remain readable (the ledger validates a union) and are hash
// verified with their own schema.
export const PERFORMANCE_SCHEMA_VERSION = '1.1';
export const PERFORMANCE_SCHEMA_VERSION_LEGACY = '1.0';

export const ContextMeasurement = z.enum(['EXACT', 'ESTIMATED']);

export const ContextSourceName = z.enum([
  'SYSTEM_SCAFFOLD',
  'HARNESS_ADVISORY',
  'LEARNED_PREFERENCES',
  'MEMORY_BLOCKS',
  'MEMORY_RECALL',
  'WORKSPACE_CONTEXT',
  'RESIDENT',
  'SKILL_CONTEXT',
  'WORKFLOW',
  'USER_REQUEST',
  'CONVERSATION_HISTORY',
  'DRIFT_REMINDER',
  'OTHER_INJECTED'
]);

export const ContextSourceCost = z
  .object({
    source: ContextSourceName,
    entries: z.number().int().nonnegative(),
    tokens: z.number().int().nonnegative(),
    measurement: ContextMeasurement
  })
  .strict();

// What consumed this model's finite context window. `input_tokens` is the
// total the engine received; the per-source breakdown is always labeled
// EXACT or ESTIMATED, and reserves that the runtime cannot expose stay null
// (rendered as UNKNOWN) instead of being fabricated.
export const ContextBudget = z
  .object({
    served_context_tokens: z.number().int().positive(),
    input_tokens: z.number().int().nonnegative(),
    input_measurement: ContextMeasurement,
    generation_reserve_tokens: z.number().int().nonnegative(),
    reasoning_reserve_tokens: z.number().int().nonnegative().nullable(),
    structured_output_reserve_tokens: z.number().int().nonnegative().nullable(),
    sources: z.array(ContextSourceCost),
    double_count_ok: z.boolean()
  })
  .strict();

export const VeritasStatus = z.enum(['VERIFIED', 'FAILED', 'ABSTAINED', 'NOT_CONTRACTED']);

export const VeritasOutcome = z
  .object({
    status: VeritasStatus,
    task_class: z.string().min(1).nullable(),
    contract_ref: z.string().min(1).nullable(),
    failed_checks: z.array(z.string().min(1)),
    evidence_refs: z.array(z.string().min(1))
  })
  .strict();

export const LoadedMethodology = z
  .object({
    kind: z.enum(['workflow', 'mode', 'skill', 'sop', 'memory', 'resident']),
    id: z.string().min(1),
    tokens: z.number().int().nonnegative().nullable()
  })
  .strict();

// Model Qualification — orthogonal to runtime state. READY means the runtime
// is serving; QUALIFIED means THIS exact artifact + quantization + runtime +
// configuration passed a bounded functional compatibility probe. A failed
// configuration stays in history and stays inspectable.
export const QualificationState = z.enum(['UNQUALIFIED', 'QUALIFYING', 'QUALIFIED', 'QUALIFICATION_FAILED', 'QUALIFICATION_UNKNOWN']);

export const QualificationFailureClass = z.enum([
  'runtime_error',
  'engine_not_ready',
  'empty_output',
  'degenerate_output',
  'probe_mismatch',
  'probe_timeout',
  'transport_invalid',
  'other'
]);

export const QualificationIdentity = z
  .object({
    model_id: z.string().min(1),
    artifact_hash: z.string().min(1),
    quantization: z.string().min(1),
    runtime: z.string().min(1),
    configured_context: z.number().int().positive(),
    profile_digest: z.string().min(1)
  })
  .strict();

export const QualificationProbeResult = z
  .object({
    name: z.string().min(1),
    passed: z.boolean(),
    detail: z.string().min(1)
  })
  .strict();

export const QUALIFICATION_SCHEMA_VERSION = '1.0';

export const QualificationRecord = z
  .object({
    schema_version: z.literal(QUALIFICATION_SCHEMA_VERSION),
    qualification_identity: z.string().min(1),
    identity: QualificationIdentity,
    state: QualificationState,
    failure_class: QualificationFailureClass.nullable(),
    checked_at: z.string().min(1),
    probe_version: z.string().min(1),
    probes: z.array(QualificationProbeResult),
    evidence_refs: z.array(z.string().min(1)),
    notes: z.array(z.string().min(1))
  })
  .strict();

export const QualificationsResponse = z
  .object({
    records: z.array(QualificationRecord)
  })
  .strict();

export const PerformanceRun = z
  .object({
    run_id: z.string().min(1),
    task_id: z.string().min(1),
    timestamp: z.string().min(1),
    covert_sha: z.string().min(7),
    harness_version: z.string().min(1)
  })
  .strict();

export const PerformanceModel = z
  .object({
    model_id: z.string().min(1),
    provider: z.string().min(1),
    runtime: z.string().min(1),
    model_version: z.string().min(1),
    artifact_hash: z.string().min(1),
    quantization: z.string().min(1),
    configured_context: z.number().int().positive()
  })
  .strict();

export const PerformanceMachine = z
  .object({
    hardware_profile_id: z.string().min(1)
  })
  .strict();

export const PerformanceOperatingMode = z
  .object({
    mode_id: z.string().min(1)
  })
  .strict();

const MethodologyCore = {
  workflow_id: z.string().min(1),
  workflow_version: z.string().min(1),
  skill_ids: z.array(z.string().min(1)),
  sop_ids: z.array(z.string().min(1))
};

export const PerformanceMethodologyV1_0 = z.object(MethodologyCore).strict();

export const PerformanceMethodology = z
  .object({
    ...MethodologyCore,
    loaded: z.array(LoadedMethodology)
  })
  .strict();

export const PerformanceTask = z
  .object({
    benchmark_suite: z.string().min(1),
    benchmark_task_id: z.string().min(1),
    task_class: z.string().min(1)
  })
  .strict();

const ExecutionCore = {
  attempts: z.number().int().nonnegative(),
  tool_calls: z.number().int().nonnegative(),
  tool_failures: z.number().int().nonnegative(),
  retries: z.number().int().nonnegative(),
  escalations: z.number().int().nonnegative(),
  authority_requests: z.number().int().nonnegative(),
  duration_ms: z.number().int().nonnegative(),
  time_to_first_token_ms: z.number().int().nonnegative().nullable(),
  input_tokens: z.number().int().nonnegative().nullable(),
  output_tokens: z.number().int().nonnegative().nullable(),
  peak_ram_mb: z.number().nonnegative().nullable(),
  peak_vram_mb: z.number().nonnegative().nullable()
};

export const PerformanceExecutionV1_0 = z.object(ExecutionCore).strict();

export const PerformanceExecution = z
  .object({
    ...ExecutionCore,
    context_budget: ContextBudget.nullable()
  })
  .strict();

const VerificationCore = {
  deterministic_checks: z
    .object({
      passed: z.number().int().nonnegative(),
      failed: z.number().int().nonnegative()
    })
    .strict(),
  tests_passed: z.number().int().nonnegative(),
  tests_failed: z.number().int().nonnegative(),
  veritas_verdict: z.string().nullable(),
  evidence_refs: z.array(z.string().min(1))
};

export const PerformanceVerificationV1_0 = z.object(VerificationCore).strict();

export const PerformanceVerification = z
  .object({
    ...VerificationCore,
    veritas: VeritasOutcome
  })
  .strict();

export const PerformanceOutcome = z
  .object({
    completed: z.boolean(),
    first_attempt_success: z.boolean(),
    fallback_required: z.boolean(),
    failure_class: z.string().nullable()
  })
  .strict();

export const PerformanceProvenance = z
  .object({
    ghost_ref: z.string().nullable()
  })
  .strict();

export const PerformanceEvent = z
  .object({
    schema_version: z.literal(PERFORMANCE_SCHEMA_VERSION),
    event_id: z.string().min(1),
    run: PerformanceRun,
    model: PerformanceModel,
    machine: PerformanceMachine,
    operating_mode: PerformanceOperatingMode,
    methodology: PerformanceMethodology,
    task: PerformanceTask,
    execution: PerformanceExecution,
    verification: PerformanceVerification,
    outcome: PerformanceOutcome,
    provenance: PerformanceProvenance
  })
  .strict();

// The ledger persists each event with an integrity chain envelope; the chain is
// storage metadata, not part of the performance observation itself.
export const PerformanceChain = z
  .object({
    seq: z.number().int().nonnegative(),
    prev_hash: z.string().min(1),
    hash: z.string().regex(/^[a-f0-9]{64}$/)
  })
  .strict();

export const PerformanceEventV1_0 = z
  .object({
    schema_version: z.literal(PERFORMANCE_SCHEMA_VERSION_LEGACY),
    event_id: z.string().min(1),
    run: PerformanceRun,
    model: PerformanceModel,
    machine: PerformanceMachine,
    operating_mode: PerformanceOperatingMode,
    methodology: PerformanceMethodologyV1_0,
    task: PerformanceTask,
    execution: PerformanceExecutionV1_0,
    verification: PerformanceVerificationV1_0,
    outcome: PerformanceOutcome,
    provenance: PerformanceProvenance
  })
  .strict();

// Reading is version-tolerant (v1.0 history stays verifiable); writing is v1.1.
export const AnyPerformanceEvent = z.union([PerformanceEvent, PerformanceEventV1_0]);

export const PerformanceRecord = z.union([
  PerformanceEvent.extend({ chain: PerformanceChain }).strict(),
  PerformanceEventV1_0.extend({ chain: PerformanceChain }).strict()
]);

export const PerformanceIntegrityIssue = z
  .object({
    line: z.number().int().nonnegative(),
    kind: z.enum(['malformed-json', 'schema-invalid', 'chain-break', 'hash-mismatch']),
    detail: z.string().min(1)
  })
  .strict();

export const PerformanceEventQuery = z
  .object({
    model_id: z.string().min(1).optional(),
    performance_identity: z.string().min(1).optional(),
    task_class: z.string().min(1).optional(),
    benchmark_task_id: z.string().min(1).optional(),
    workflow_id: z.string().min(1).optional(),
    skill_id: z.string().min(1).optional(),
    mode_id: z.string().min(1).optional(),
    since: z.string().min(1).optional(),
    until: z.string().min(1).optional(),
    limit: z.coerce.number().int().positive().max(1000).optional()
  })
  .strict();

export const PerformanceQueryResponse = z
  .object({
    events: z.array(PerformanceRecord),
    integrity: z
      .object({
        ok: z.boolean(),
        issues: z.array(PerformanceIntegrityIssue)
      })
      .strict(),
    total_matched: z.number().int().nonnegative(),
    bounded: z.boolean()
  })
  .strict();

// ---------------------------------------------------------------------------
// Model Passport — a DERIVED projection over PerformanceEvents. It is never
// raw truth: every metric is an observation count or a median over the events
// that produced it, small samples are labeled, and no universal ranking or
// invented quality score exists anywhere in this contract.
// ---------------------------------------------------------------------------
export const PassportEvidenceConfidence = z.enum(['INSUFFICIENT', 'LOW', 'MODERATE', 'HIGH']);

// The passport-level disposition combines qualification with evidence volume:
//   INSUFFICIENT_DATA / UNPROBED               -> no usable basis yet
//   QUALIFICATION_FAILED                       -> this exact config failed its probe
//   QUALIFIED_LOW_SAMPLE / QUALIFIED_EVIDENCE_AVAILABLE -> probed and measured
export const PassportEvidenceClass = z.enum([
  'INSUFFICIENT_DATA',
  'UNPROBED',
  'QUALIFICATION_FAILED',
  'QUALIFIED_LOW_SAMPLE',
  'QUALIFIED_EVIDENCE_AVAILABLE'
]);

export const PassportQualification = z
  .object({
    state: QualificationState,
    checked_at: z.string().nullable(),
    failure_class: QualificationFailureClass.nullable(),
    qualification_identity: z.string().nullable()
  })
  .strict();

export const PassportModelIdentity = z
  .object({
    model_id: z.string().min(1),
    provider: z.string().min(1),
    runtime: z.string().min(1),
    model_version: z.string().min(1),
    artifact_hash: z.string().min(1),
    quantization: z.string().min(1),
    configured_context: z.number().int().positive()
  })
  .strict();

export const PassportTaskClassObservation = z
  .object({
    task_class: z.string().min(1),
    sample_size: z.number().int().nonnegative(),
    completed: z.number().int().nonnegative(),
    completion_rate: z.number().nonnegative().max(1).nullable(),
    median_duration_ms: z.number().nonnegative().nullable()
  })
  .strict();

export const PassportWorkflowObservation = z
  .object({
    workflow_id: z.string().min(1),
    workflow_version: z.string().min(1),
    sample_size: z.number().int().nonnegative(),
    completed: z.number().int().nonnegative(),
    completion_rate: z.number().nonnegative().max(1).nullable(),
    median_duration_ms: z.number().nonnegative().nullable()
  })
  .strict();

export const PassportModeObservation = z
  .object({
    mode_id: z.string().min(1),
    sample_size: z.number().int().nonnegative(),
    completed: z.number().int().nonnegative(),
    completion_rate: z.number().nonnegative().max(1).nullable(),
    median_duration_ms: z.number().nonnegative().nullable()
  })
  .strict();

export const PassportFailureClassCount = z
  .object({
    failure_class: z.string().min(1),
    count: z.number().int().positive()
  })
  .strict();

export const ModelPassport = z
  .object({
    schema_version: z.literal('1.1'),
    performance_identity: z.string().min(1),
    identity: PassportModelIdentity,
    generated_at: z.string().min(1),
    qualification: PassportQualification,
    evidence_class: PassportEvidenceClass,
    evidence: z
      .object({
        sample_size: z.number().int().nonnegative(),
        first_event_at: z.string().nullable(),
        last_event_at: z.string().nullable(),
        evidence_confidence: PassportEvidenceConfidence,
        suites: z.array(z.string().min(1)),
        workflow_ids: z.array(z.string().min(1)),
        mode_ids: z.array(z.string().min(1)),
        skill_ids: z.array(z.string().min(1)),
        sop_ids: z.array(z.string().min(1))
      })
      .strict(),
    outcome: z
      .object({
        completed: z.number().int().nonnegative(),
        failed: z.number().int().nonnegative(),
        unresolved: z.number().int().nonnegative(),
        completion_rate: z.number().nonnegative().max(1).nullable(),
        first_attempt_success_rate: z.number().nonnegative().max(1).nullable(),
        fallback_rate: z.number().nonnegative().max(1).nullable()
      })
      .strict(),
    execution: z
      .object({
        median_duration_ms: z.number().nonnegative().nullable(),
        median_output_tokens: z.number().nonnegative().nullable(),
        total_tool_calls: z.number().int().nonnegative(),
        total_tool_failures: z.number().int().nonnegative(),
        total_authority_requests: z.number().int().nonnegative(),
        total_retries: z.number().int().nonnegative()
      })
      .strict(),
    verification: z
      .object({
        checks_passed: z.number().int().nonnegative(),
        checks_failed: z.number().int().nonnegative(),
        tests_passed: z.number().int().nonnegative(),
        tests_failed: z.number().int().nonnegative(),
        veritas_verdicts: z.array(z.string().min(1))
      })
      .strict(),
    by_task_class: z.array(PassportTaskClassObservation),
    by_workflow: z.array(PassportWorkflowObservation),
    by_mode: z.array(PassportModeObservation),
    failure_classes: z.array(PassportFailureClassCount),
    insufficient_data: z.boolean(),
    notes: z.array(z.string().min(1))
  })
  .strict();

export const PassportsResponse = z
  .object({
    generated_at: z.string().min(1),
    passports: z.array(ModelPassport)
  })
  .strict();

// ---------------------------------------------------------------------------
// Read-only recommendation surface: evidence-qualified candidates only. It
// never silently routes production workloads and never labels a model "best".
// ---------------------------------------------------------------------------
export const RecommendationEvidenceThreshold = z.enum(['none', 'observed', 'moderate']);

export const RecommendationRequest = z
  .object({
    task_class: z.string().min(1),
    mode_id: z.string().min(1).nullable(),
    local_only: z.boolean(),
    min_samples: z.number().int().nonnegative(),
    evidence_threshold: RecommendationEvidenceThreshold
  })
  .strict();

export const RecommendationCandidate = z
  .object({
    model_id: z.string().min(1),
    performance_identity: z.string().min(1),
    qualified: z.boolean(),
    sample_size: z.number().int().nonnegative(),
    completion_rate: z.number().nonnegative().max(1).nullable(),
    median_duration_ms: z.number().nonnegative().nullable(),
    evidence_confidence: PassportEvidenceConfidence,
    reason: z.string().min(1)
  })
  .strict();

export const RecommendationResponse = z
  .object({
    generated_at: z.string().min(1),
    task_class: z.string().min(1),
    mode_id: z.string().min(1).nullable(),
    candidates: z.array(RecommendationCandidate),
    notes: z.array(z.string().min(1))
  })
  .strict();

export type PerformanceEventT = z.infer<typeof PerformanceEvent>;
export type AnyPerformanceEventT = z.infer<typeof AnyPerformanceEvent>;
export type PerformanceRecordT = z.infer<typeof PerformanceRecord>;
export type ContextBudgetT = z.infer<typeof ContextBudget>;
export type ContextSourceCostT = z.infer<typeof ContextSourceCost>;
export type VeritasOutcomeT = z.infer<typeof VeritasOutcome>;
export type QualificationRecordT = z.infer<typeof QualificationRecord>;
export type QualificationStateT = z.infer<typeof QualificationState>;
export type QualificationIdentityT = z.infer<typeof QualificationIdentity>;
export type PerformanceEventQueryT = z.infer<typeof PerformanceEventQuery>;
export type ModelPassportT = z.infer<typeof ModelPassport>;
export type RecommendationRequestT = z.infer<typeof RecommendationRequest>;
export type RecommendationResponseT = z.infer<typeof RecommendationResponse>;
export type RecommendationCandidateT = z.infer<typeof RecommendationCandidate>;
export type PassportEvidenceConfidenceT = z.infer<typeof PassportEvidenceConfidence>;
