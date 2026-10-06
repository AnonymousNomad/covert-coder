import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import {
  AtlasEvaluationCandidate,
  AtlasEvaluationRecord,
  type AtlasEvaluationCandidateT,
  type AtlasEvaluationRecordT,
  type AtlasFingerprintT,
  type AtlasRecordedEvaluationT,
  type ModelAtlasHistoryEntryT
} from '../../../common/contracts/model-atlas.ts';
import { atomicWriteJson, withFileMutationLock } from './atomic-json.ts';

// Canonical durable evaluation store for the Model Atlas. Records are immutable
// and append-only: a repeated evaluation creates a new record and never
// replaces history. Native and harnessed results live side by side inside one
// record; neither side is ever overwritten by the other.

export type AtlasRefusalCode =
  | 'ATLAS_RECORD_INVALID'
  | 'ATLAS_IMMUTABILITY_VIOLATION'
  | 'ATLAS_EVIDENCE_REF_UNBOUND';

export class AtlasRefusalError extends Error {
  readonly code: AtlasRefusalCode;
  constructor(code: AtlasRefusalCode, message: string) {
    super(message);
    this.name = 'AtlasRefusalError';
    this.code = code;
  }
}

export interface AtlasFreshnessBasis {
  source_revision: string | null;
  artifact_sha256: string | null;
  quantization: string | null;
  runtime_id: string | null;
  runtime_version: string | null;
  harness_version: string | null;
  benchmark_id: string | null;
  benchmark_version: string | null;
  grader_version: string | null;
  inference_config_digest: string | null;
  machine_profile_digest: string | null;
  execution_node: string | null;
}

export interface AtlasFreshnessVerdict {
  state: 'FRESH' | 'STALE';
  scope: 'NONE' | 'RESOURCE' | 'FULL';
  stale_reasons: string[];
}

const FULL_STALENESS_DIMENSIONS: Array<[keyof AtlasFreshnessBasis, keyof AtlasFingerprintT, string]> = [
  ['source_revision', 'source_revision', 'source_revision_changed'],
  ['artifact_sha256', 'artifact_sha256', 'artifact_sha256_changed'],
  ['quantization', 'quantization', 'quantization_changed'],
  ['runtime_id', 'runtime_id', 'runtime_changed'],
  ['runtime_version', 'runtime_version', 'runtime_version_changed'],
  ['harness_version', 'harness_version', 'harness_version_changed'],
  ['benchmark_id', 'benchmark_id', 'benchmark_definition_changed'],
  ['benchmark_version', 'benchmark_version', 'benchmark_definition_changed'],
  ['grader_version', 'grader_version', 'benchmark_definition_changed'],
  ['inference_config_digest', 'inference_config_digest', 'inference_config_changed'],
  ['execution_node', 'execution_node', 'execution_node_changed']
];

// A known current value that differs from fresh evidence makes the record
// stale. An absent current value (unknown basis) never fabricates staleness:
// unknown basis is reported by callers, not guessed here.
export function compareFingerprints(recorded: AtlasFingerprintT, current: AtlasFreshnessBasis): AtlasFreshnessVerdict {
  const stale_reasons = new Set<string>();
  for (const [currentKey, recordedKey, reason] of FULL_STALENESS_DIMENSIONS) {
    const currentValue = current[currentKey];
    const recordedValue = recorded[recordedKey];
    if (currentValue !== null && recordedValue !== null && currentValue !== recordedValue) stale_reasons.add(reason);
  }
  const resourceChanged = current.machine_profile_digest !== null &&
    recorded.machine_profile_digest !== null &&
    current.machine_profile_digest !== recorded.machine_profile_digest;
  if (resourceChanged) stale_reasons.add('machine_profile_changed');
  const reasons = [...stale_reasons].sort();
  if (reasons.length === 0) return { state: 'FRESH', scope: 'NONE', stale_reasons: [] };
  const full = reasons.some(reason => reason !== 'machine_profile_changed');
  return { state: 'STALE', scope: full ? 'FULL' : 'RESOURCE', stale_reasons: reasons };
}

export function deriveQualification(record: AtlasEvaluationRecordT): {
  state: 'UNTESTED' | 'TESTED' | 'INVALID_EVIDENCE';
  stale_reasons: string[];
} {
  const conditions = [record.native, record.harnessed].filter(value => value !== null);
  if (conditions.length === 0) return { state: 'UNTESTED', stale_reasons: ['no_condition_recorded'] };
  if (conditions.some(condition => condition.outcome === 'CANCELLED')) return { state: 'UNTESTED', stale_reasons: ['evaluation_cancelled'] };
  if (conditions.some(condition => condition.outcome === 'FAILED')) return { state: 'INVALID_EVIDENCE', stale_reasons: ['evaluation_failed'] };
  if (conditions.some(condition => condition.outcome === 'PARTIAL')) return { state: 'INVALID_EVIDENCE', stale_reasons: ['evaluation_incomplete'] };
  return { state: 'TESTED', stale_reasons: [] };
}

function safeSegment(modelId: string): string {
  return createHash('sha256').update(modelId).digest('hex').slice(0, 32);
}

export interface ModelAtlasOptions {
  workspace: string;
  now?: () => Date;
}

export function createModelAtlas(options: ModelAtlasOptions) {
  const workspace = path.resolve(options.workspace);
  const now = options.now ?? (() => new Date());
  const root = path.join(workspace, '.aide', 'atlas');
  const evaluationsDir = path.join(root, 'evaluations');
  const candidatesDir = path.join(root, 'candidates');
  const candidateFile = (modelId: string) => path.join(candidatesDir, `${safeSegment(modelId)}.json`);
  // Integrity sidecars live beside their evidence record and deliberately do
  // not end in `.json`, so record enumeration never parses them. A missing
  // sidecar means "unverified"; a contradicting sidecar means "tampered" and
  // surfaces as an integrity anomaly - evidence is never silently trusted.
  const integrityFile = (evaluationId: string) => path.join(evaluationsDir, `${evaluationId}.sha256`);

  async function ensureDirs(): Promise<void> {
    await fs.mkdir(evaluationsDir, { recursive: true });
    await fs.mkdir(candidatesDir, { recursive: true });
  }

  function validateRecord(input: unknown): AtlasEvaluationRecordT {
    const parsed = AtlasEvaluationRecord.safeParse(input);
    if (!parsed.success) {
      throw new AtlasRefusalError('ATLAS_RECORD_INVALID', 'evaluation record failed contract validation: ' +
        parsed.error.issues.slice(0, 4).map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; '));
    }
    const record = parsed.data;
    const boundRefs = new Set(record.evidence_refs);
    for (const recommendation of record.recommended_roles) {
      if (recommendation.evidence_refs.length === 0 || recommendation.evidence_refs.some(ref => !boundRefs.has(ref))) {
        throw new AtlasRefusalError('ATLAS_EVIDENCE_REF_UNBOUND',
          `recommendation ${recommendation.role} must cite evidence refs recorded on the evaluation`);
      }
    }
    for (const condition of [record.native, record.harnessed]) {
      if (condition === null) continue;
      if (condition.score.passed > condition.score.total) {
        throw new AtlasRefusalError('ATLAS_RECORD_INVALID', `${condition.condition} score exceeds the task total`);
      }
    }
    if (record.comparison !== null && (record.native === null || record.harnessed === null)) {
      throw new AtlasRefusalError('ATLAS_RECORD_INVALID', 'comparison requires both native and harnessed results');
    }
    return record;
  }

  async function recordEvaluation(input: unknown): Promise<AtlasRecordedEvaluationT> {
    const record = validateRecord(input);
    await ensureDirs();
    const target = path.join(evaluationsDir, `${record.evaluation_id}.json`);
    await withFileMutationLock(target, async () => {
      const exists = await fs.access(target).then(() => true).catch(() => false);
      if (exists) {
        throw new AtlasRefusalError('ATLAS_IMMUTABILITY_VIOLATION', `evaluation ${record.evaluation_id} is already recorded and immutable`);
      }
      await atomicWriteJson(target, record);
      const bytes = await fs.readFile(target);
      await atomicWriteJson(integrityFile(record.evaluation_id), {
        schema: 'covert.model-atlas.integrity.v1',
        evaluation_id: record.evaluation_id,
        sha256: createHash('sha256').update(bytes).digest('hex'),
        bytes: bytes.length
      });
    });
    return withFreshness(record);
  }

  function withFreshness(record: AtlasEvaluationRecordT, current?: AtlasFreshnessBasis): AtlasRecordedEvaluationT {
    const verdict = current === undefined
      ? { state: 'FRESH' as const, scope: 'NONE' as const, stale_reasons: [] as string[] }
      : compareFingerprints(record.fingerprint, current);
    return {
      ...record,
      freshness: {
        checked_at: now().toISOString(),
        state: verdict.state,
        scope: verdict.scope,
        stale_reasons: verdict.stale_reasons
      }
    };
  }

  interface Inspection {
    records: AtlasEvaluationRecordT[];
    corrupt: string[];
    integrity_failures: string[];
    unverified: string[];
  }

  async function inspectStore(modelId: string | null): Promise<Inspection> {
    const records: AtlasEvaluationRecordT[] = [];
    const corrupt: string[] = [];
    const integrityFailures: string[] = [];
    const unverified: string[] = [];
    let names: string[];
    try {
      names = await fs.readdir(evaluationsDir);
    } catch {
      return { records, corrupt, integrity_failures: integrityFailures, unverified };
    }
    for (const name of names.filter(entry => entry.endsWith('.json'))) {
      const full = path.join(evaluationsDir, name);
      let raw: string;
      try {
        raw = await fs.readFile(full, 'utf8');
      } catch {
        corrupt.push(name);
        continue;
      }
      let parsed;
      try {
        parsed = AtlasEvaluationRecord.safeParse(JSON.parse(raw));
      } catch {
        corrupt.push(name);
        continue;
      }
      if (!parsed.success) { corrupt.push(name); continue; }
      if (name !== `${parsed.data.evaluation_id}.json`) { corrupt.push(name); continue; }
      const sidecar = `${parsed.data.evaluation_id}.sha256`;
      try {
        const digest = JSON.parse(await fs.readFile(path.join(evaluationsDir, sidecar), 'utf8'));
        if (digest?.sha256 !== createHash('sha256').update(raw).digest('hex')) integrityFailures.push(name);
      } catch {
        unverified.push(name);
      }
      if (modelId === null || parsed.data.model_id === modelId) records.push(parsed.data);
    }
    records.sort((a, b) => Date.parse(a.evaluated_at) - Date.parse(b.evaluated_at) || a.evaluation_id.localeCompare(b.evaluation_id));
    return { records, corrupt, integrity_failures: integrityFailures, unverified };
  }

  async function readAll(modelId: string): Promise<{ records: AtlasEvaluationRecordT[]; corrupt: string[]; integrity_failures: string[] }> {
    const inspection = await inspectStore(modelId);
    return { records: inspection.records, corrupt: inspection.corrupt, integrity_failures: inspection.integrity_failures };
  }

  async function latestFor(modelId: string, current?: AtlasFreshnessBasis): Promise<AtlasRecordedEvaluationT | null> {
    const { records } = await readAll(modelId);
    const latest = records.at(-1);
    return latest === undefined ? null : withFreshness(latest, current);
  }

  async function stateFor(modelId: string, current: AtlasFreshnessBasis): Promise<{
    state: 'NEVER_EVALUATED' | 'CURRENT' | 'STALE' | 'INCOMPLETE';
    stale_reasons: string[];
    scope: 'NONE' | 'RESOURCE' | 'FULL';
    latest: AtlasRecordedEvaluationT | null;
    corrupt_count: number;
  }> {
    const { records, corrupt, integrity_failures: integrityFailures } = await readAll(modelId);
    const latest = records.at(-1);
    if (latest === undefined) {
      const reasons: string[] = [];
      if (corrupt.length > 0) reasons.push('corrupt_evidence');
      if (integrityFailures.length > 0) reasons.push('integrity_mismatch');
      if (reasons.length > 0) {
        return { state: 'INCOMPLETE', stale_reasons: reasons.sort(), scope: 'FULL', latest: null, corrupt_count: corrupt.length + integrityFailures.length };
      }
      return { state: 'NEVER_EVALUATED', stale_reasons: [], scope: 'NONE', latest: null, corrupt_count: 0 };
    }
    const incompleteReasons: string[] = [];
    if (latest.native === null) incompleteReasons.push('native_missing');
    if (latest.harnessed === null) incompleteReasons.push('harnessed_missing');
    if (corrupt.length > 0) incompleteReasons.push('corrupt_evidence');
    if (integrityFailures.length > 0) incompleteReasons.push('integrity_mismatch');
    if (incompleteReasons.length > 0) {
      return { state: 'INCOMPLETE', stale_reasons: incompleteReasons.sort(), scope: 'FULL', latest: withFreshness(latest, current), corrupt_count: corrupt.length + integrityFailures.length };
    }
    const verdict = compareFingerprints(latest.fingerprint, current);
    return {
      state: verdict.state === 'FRESH' ? 'CURRENT' : 'STALE',
      stale_reasons: verdict.stale_reasons,
      scope: verdict.scope,
      latest: withFreshness(latest, current),
      corrupt_count: corrupt.length
    };
  }

  async function historyFor(modelId: string): Promise<ModelAtlasHistoryEntryT[]> {
    const { records } = await readAll(modelId);
    return records.map(record => ({
      evaluation_id: record.evaluation_id,
      evaluated_at: record.evaluated_at,
      native_ratio: record.native?.score.ratio ?? null,
      harnessed_ratio: record.harnessed?.score.ratio ?? null,
      delta_score: record.comparison?.delta_score ?? null,
      qualification_state: record.qualification.state
    }));
  }

  function validateCandidate(input: unknown): AtlasEvaluationCandidateT {
    const parsed = AtlasEvaluationCandidate.safeParse(input);
    if (!parsed.success) {
      throw new AtlasRefusalError('ATLAS_RECORD_INVALID', 'evaluation candidate failed contract validation');
    }
    if (parsed.data.execution.executed !== false) {
      throw new AtlasRefusalError('ATLAS_RECORD_INVALID', 'candidates are created without execution');
    }
    return parsed.data;
  }

  async function createCandidate(input: unknown): Promise<AtlasEvaluationCandidateT> {
    const candidate = validateCandidate(input);
    await ensureDirs();
    const target = candidateFile(candidate.model_id);
    await withFileMutationLock(target, async () => {
      await atomicWriteJson(target, candidate);
    });
    return candidate;
  }

  async function readCandidate(modelId: string): Promise<AtlasEvaluationCandidateT | null> {
    try {
      const raw = JSON.parse(await fs.readFile(candidateFile(modelId), 'utf8'));
      const parsed = AtlasEvaluationCandidate.safeParse(raw);
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  }

  return {
    root,
    recordEvaluation,
    latestFor,
    stateFor,
    historyFor,
    createCandidate,
    readCandidate,
    compareFingerprints,
    deriveQualification,
    validateRecord
  };
}

export type ModelAtlas = ReturnType<typeof createModelAtlas>;
