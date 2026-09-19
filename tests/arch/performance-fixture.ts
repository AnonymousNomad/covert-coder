import { randomUUID } from 'node:crypto';
import type { PerformanceEventT, ContextBudgetT, VeritasOutcomeT, QualificationRecordT } from '../../common/contracts/performance.ts';

export function makeQualification(options: {
  modelId?: string;
  artifactHash?: string;
  quantization?: string;
  runtime?: string;
  configuredContext?: number;
  profileDigest?: string;
  state?: QualificationRecordT['state'];
  failureClass?: QualificationRecordT['failure_class'];
  checkedAt?: string;
} = {}): QualificationRecordT {
  const identity = {
    model_id: options.modelId ?? 'stub-model',
    artifact_hash: options.artifactHash ?? 'a'.repeat(64),
    quantization: options.quantization ?? 'Q8_0',
    runtime: options.runtime ?? 'llama-server',
    configured_context: options.configuredContext ?? 2048,
    profile_digest: options.profileDigest ?? 'none'
  };
  const state = options.state ?? 'QUALIFIED';
  const failureClass = options.failureClass === undefined ? (state === 'QUALIFICATION_FAILED' ? 'degenerate_output' : null) : options.failureClass;
  return {
    schema_version: '1.0',
    qualification_identity: `${identity.model_id}@${identity.artifact_hash}:${identity.configured_context}:${identity.runtime}|${identity.quantization}|${identity.profile_digest}`,
    identity,
    state,
    failure_class: failureClass,
    checked_at: options.checkedAt ?? '2026-09-19T12:00:00.000Z',
    probe_version: '1.0',
    probes: [{ name: 'echo-instruction', passed: state === 'QUALIFIED', detail: state === 'QUALIFIED' ? 'QUALIFY-OK' : 'degenerate output' }],
    evidence_refs: ['qualification-runs/stub/echo-instruction.txt'],
    notes: []
  };
}

export interface EventOptions {
  eventId?: string;
  runId?: string;
  taskId?: string;
  timestamp?: string;
  modelId?: string;
  artifactHash?: string;
  quantization?: string;
  configuredContext?: number;
  provider?: string;
  runtime?: string;
  modelVersion?: string;
  taskClass?: string;
  suite?: string;
  modeId?: string;
  workflowId?: string;
  workflowVersion?: string;
  skillIds?: string[];
  sopIds?: string[];
  loaded?: PerformanceEventT['methodology']['loaded'];
  completed?: boolean;
  firstAttemptSuccess?: boolean;
  fallbackRequired?: boolean;
  failureClass?: string | null;
  durationMs?: number;
  outputTokens?: number | null;
  checksPassed?: number;
  checksFailed?: number;
  testsPassed?: number;
  testsFailed?: number;
  authorityRequests?: number;
  toolCalls?: number;
  toolFailures?: number;
  evidenceRefs?: string[];
  veritasVerdict?: string | null;
  veritas?: VeritasOutcomeT;
  contextBudget?: ContextBudgetT | null;
}

export function makeEvent(options: EventOptions = {}): PerformanceEventT {
  return {
    schema_version: '1.1',
    event_id: options.eventId ?? randomUUID(),
    run: {
      run_id: options.runId ?? 'test-run-1',
      task_id: options.taskId ?? 'task-1',
      timestamp: options.timestamp ?? '2026-09-19T12:00:00.000Z',
      covert_sha: '600b91c',
      harness_version: '2.1.0'
    },
    model: {
      model_id: options.modelId ?? 'stub-model',
      provider: options.provider ?? 'local',
      runtime: options.runtime ?? 'llama-server',
      model_version: options.modelVersion ?? 'org/stub@stub.gguf',
      artifact_hash: options.artifactHash ?? 'a'.repeat(64),
      quantization: options.quantization ?? 'Q8_0',
      configured_context: options.configuredContext ?? 2048
    },
    machine: { hardware_profile_id: 'test-machine' },
    operating_mode: { mode_id: options.modeId ?? 'software-engineering' },
    methodology: {
      workflow_id: options.workflowId ?? 'harness-baseline-v1',
      workflow_version: options.workflowVersion ?? '1.0',
      skill_ids: options.skillIds ?? [],
      sop_ids: options.sopIds ?? [],
      loaded: options.loaded ?? []
    },
    task: {
      benchmark_suite: options.suite ?? 'harness-baseline-v1',
      benchmark_task_id: options.taskId ?? 'task-1',
      task_class: options.taskClass ?? 'bug-repair'
    },
    execution: {
      attempts: 1,
      tool_calls: options.toolCalls ?? 0,
      tool_failures: options.toolFailures ?? 0,
      retries: 0,
      escalations: 0,
      authority_requests: options.authorityRequests ?? 1,
      duration_ms: options.durationMs ?? 1000,
      time_to_first_token_ms: null,
      input_tokens: null,
      output_tokens: options.outputTokens === undefined ? 32 : options.outputTokens,
      peak_ram_mb: null,
      peak_vram_mb: null,
      context_budget: options.contextBudget ?? null
    },
    verification: {
      deterministic_checks: { passed: options.checksPassed ?? 1, failed: options.checksFailed ?? 0 },
      tests_passed: options.testsPassed ?? 0,
      tests_failed: options.testsFailed ?? 0,
      veritas_verdict: options.veritasVerdict ?? null,
      veritas: options.veritas ?? { status: 'NOT_CONTRACTED', task_class: null, contract_ref: null, failed_checks: [], evidence_refs: [] },
      evidence_refs: options.evidenceRefs ?? ['evidence/meta.json']
    },
    outcome: {
      completed: options.completed ?? true,
      first_attempt_success: options.firstAttemptSuccess ?? options.completed ?? true,
      fallback_required: options.fallbackRequired ?? false,
      failure_class: options.failureClass ?? null
    },
    provenance: { ghost_ref: null }
  };
}
