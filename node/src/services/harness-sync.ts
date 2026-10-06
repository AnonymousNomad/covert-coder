import {
  MODEL_ATLAS_CANDIDATE_SCHEMA,
  type AtlasCandidateReasonT,
  type AtlasEvaluationCandidateT,
  type AtlasFingerprintT,
  type AtlasRecordedEvaluationT
} from '../../../common/contracts/model-atlas.ts';
import type { AtlasFreshnessBasis, ModelAtlas } from './model-atlas.ts';

// Harness Sync bridges canonical model inventory and the Model Atlas.
//
// Automatic behavior (inspect): discover, compare, detect missing/stale
// evidence, build an evaluation candidate. Nothing heavy ever executes here:
// candidates carry `execution: { mode: 'AUTHORITY_REQUIRED', executed: false }`
// and evaluation runs remain an authorized operation outside this service.

export interface SyncModelDescriptor {
  model_id: string;
  display_name: string;
  artifact_sha256: string | null;
  source_revision: string | null;
  quantization: string | null;
  chat_template: 'present' | 'absent' | 'unknown';
}

export interface HarnessSyncBenchmark {
  id: string;
  version: string;
  grader_version: string;
}

export type HarnessSyncRefusalCode = 'MODEL_UNKNOWN' | 'IDENTITY_INSUFFICIENT';

export type HarnessSyncResult =
  | { status: 'REFUSED'; code: HarnessSyncRefusalCode; model_id: string; detail: string }
  | { status: 'CURRENT'; model_id: string; evaluation_state: 'CURRENT'; latest: AtlasRecordedEvaluationT }
  | {
      status: 'CANDIDATE_READY';
      model_id: string;
      evaluation_state: 'NEVER_EVALUATED' | 'STALE' | 'INCOMPLETE';
      reason: AtlasCandidateReasonT;
      stale_reasons: string[];
      scope: 'NONE' | 'RESOURCE' | 'FULL';
      fingerprint: AtlasFingerprintT;
      candidate: AtlasEvaluationCandidateT;
      latest: AtlasRecordedEvaluationT | null;
    };

export interface HarnessSyncOptions {
  atlas: ModelAtlas;
  getModel: (modelId: string) => Promise<SyncModelDescriptor | null>;
  currentBasis: (model: SyncModelDescriptor) => AtlasFreshnessBasis;
  harnessVersion: string;
  benchmark: HarnessSyncBenchmark;
  now?: () => Date;
  newId?: () => string;
}

export function buildFingerprint(
  model: SyncModelDescriptor,
  basis: AtlasFreshnessBasis,
  benchmark: HarnessSyncBenchmark,
  harnessVersion: string
): AtlasFingerprintT {
  return {
    model_id: model.model_id,
    source_revision: basis.source_revision ?? model.source_revision,
    artifact_sha256: basis.artifact_sha256 ?? model.artifact_sha256,
    quantization: basis.quantization ?? model.quantization,
    runtime_id: basis.runtime_id,
    runtime_version: basis.runtime_version,
    harness_version: harnessVersion,
    benchmark_id: benchmark.id,
    benchmark_version: benchmark.version,
    grader_version: benchmark.grader_version,
    inference_config_digest: basis.inference_config_digest,
    machine_profile_digest: basis.machine_profile_digest,
    execution_node: basis.execution_node,
    chat_template: model.chat_template
  };
}

export function createHarnessSync(options: HarnessSyncOptions) {
  const now = options.now ?? (() => new Date());
  const newId = options.newId ?? (() => globalThis.crypto.randomUUID());

  function refusal(modelId: string, code: HarnessSyncRefusalCode, detail: string): HarnessSyncResult {
    return { status: 'REFUSED', code, model_id: modelId, detail };
  }

  // Read-only inspection: never writes a candidate, never executes anything.
  async function inspect(modelId: string): Promise<HarnessSyncResult> {
    const model = await options.getModel(modelId);
    if (model === null) return refusal(modelId, 'MODEL_UNKNOWN', 'model id does not resolve to canonical inventory');
    const basis = options.currentBasis(model);
    if (basis.artifact_sha256 === null || model.artifact_sha256 === null) {
      return refusal(modelId, 'IDENTITY_INSUFFICIENT', 'a stable artifact sha256 is required before evaluation evidence can be bound');
    }
    const fingerprint = buildFingerprint(model, basis, options.benchmark, options.harnessVersion);
    const state = await options.atlas.stateFor(modelId, basis);
    if (state.state === 'CURRENT' && state.latest !== null) {
      return { status: 'CURRENT', model_id: modelId, evaluation_state: 'CURRENT', latest: state.latest };
    }
    const evaluationState: 'NEVER_EVALUATED' | 'STALE' | 'INCOMPLETE' = state.state === 'CURRENT' ? 'NEVER_EVALUATED' : state.state;
    return {
      status: 'CANDIDATE_READY',
      model_id: modelId,
      evaluation_state: evaluationState,
      reason: evaluationState === 'STALE' ? 'STALE_EVIDENCE' : evaluationState === 'INCOMPLETE' ? 'INCOMPLETE_EVIDENCE' : 'NO_EVIDENCE',
      stale_reasons: state.stale_reasons,
      scope: state.scope,
      fingerprint,
      candidate: buildCandidate(model, fingerprint, evaluationState, state.stale_reasons),
      latest: state.latest
    };
  }

  function buildCandidate(
    model: SyncModelDescriptor,
    fingerprint: AtlasFingerprintT,
    state: 'NEVER_EVALUATED' | 'STALE' | 'INCOMPLETE',
    staleReasons: string[]
  ): AtlasEvaluationCandidateT {
    return {
      schema: MODEL_ATLAS_CANDIDATE_SCHEMA,
      candidate_id: newId(),
      model_id: model.model_id,
      display_name: model.display_name,
      fingerprint,
      reason: state === 'STALE' ? 'STALE_EVIDENCE' : state === 'INCOMPLETE' ? 'INCOMPLETE_EVIDENCE' : 'NO_EVIDENCE',
      stale_reasons: staleReasons,
      created_at: now().toISOString(),
      execution: { mode: 'AUTHORITY_REQUIRED', executed: false }
    };
  }

  // Candidate creation persists the candidate and remains execution-free.
  async function sync(modelId: string): Promise<HarnessSyncResult> {
    const result = await inspect(modelId);
    if (result.status !== 'CANDIDATE_READY') return result;
    const candidate = await options.atlas.createCandidate(result.candidate);
    return { ...result, candidate };
  }

  return { inspect, sync, buildFingerprint: (model: SyncModelDescriptor) => buildFingerprint(model, options.currentBasis(model), options.benchmark, options.harnessVersion) };
}

export type HarnessSync = ReturnType<typeof createHarnessSync>;
