import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import {
  AtlasEvaluationCandidate,
  AtlasEvaluationRecord,
  MODEL_ATLAS_SCHEMA,
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
  const hasNative = record.native !== null;
  const hasHarnessed = record.harnessed !== null;
  if (!hasNative && !hasHarnessed) return { state: 'UNTESTED', stale_reasons: ['no_condition_recorded'] };
  // The Atlas evaluation definition is a paired native+harnessed run: a single
  // completed condition is honest evidence but cannot certify the pair as
  // TESTED. Missing-condition records stay INVALID_EVIDENCE until both sides
  // exist (stateStore additionally reports native_missing/harnessed_missing).
  if (!hasNative || !hasHarnessed) {
    const present = [record.native, record.harnessed].filter(value => value !== null);
    const reasons = ['condition_missing'];
    if (present.some(condition => condition.outcome === 'CANCELLED')) return { state: 'UNTESTED', stale_reasons: ['evaluation_cancelled', ...reasons].sort() };
    if (present.some(condition => condition.outcome === 'FAILED')) return { state: 'INVALID_EVIDENCE', stale_reasons: ['evaluation_failed', ...reasons].sort() };
    if (present.some(condition => condition.outcome === 'PARTIAL')) return { state: 'INVALID_EVIDENCE', stale_reasons: ['evaluation_incomplete', ...reasons].sort() };
    return { state: 'INVALID_EVIDENCE', stale_reasons: reasons };
  }
  const conditions = [record.native, record.harnessed].filter(value => value !== null);
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

export interface AtlasAuditIssue {
  file: string;
  kind: 'CORRUPT' | 'INTEGRITY_MISMATCH' | 'UNVERIFIED';
}

export interface AtlasAuditReport {
  schema: 'covert.model-atlas.audit.v1';
  checked_at: string;
  healthy: boolean;
  totals: { records: number; corrupt: number; integrity_mismatch: number; unverified: number; models: number };
  issues: AtlasAuditIssue[];
  duplicate_evaluation_ids: string[];
  dangling_recommendation_refs: Array<{ evaluation_id: string; role: string; missing_ref: string }>;
  unsupported_schema_files: string[];
  evidence_refs: { checked: boolean; total: number; dangling: number };
}

export interface AtlasAuditOptions {
  evidenceResolver?: (ref: string) => Promise<boolean> | boolean;
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

  function composeState(
    latest: AtlasEvaluationRecordT | undefined,
    corruptCount: number,
    integrityFailures: number,
    current: AtlasFreshnessBasis
  ): {
    state: 'NEVER_EVALUATED' | 'CURRENT' | 'STALE' | 'INCOMPLETE';
    stale_reasons: string[];
    scope: 'NONE' | 'RESOURCE' | 'FULL';
    latest: AtlasRecordedEvaluationT | null;
    corrupt_count: number;
  } {
    const anomalyReasons: string[] = [];
    if (corruptCount > 0) anomalyReasons.push('corrupt_evidence');
    if (integrityFailures > 0) anomalyReasons.push('integrity_mismatch');
    const anomalyCount = corruptCount + integrityFailures;
    if (latest === undefined) {
      if (anomalyReasons.length > 0) {
        return { state: 'INCOMPLETE', stale_reasons: anomalyReasons.sort(), scope: 'FULL', latest: null, corrupt_count: anomalyCount };
      }
      return { state: 'NEVER_EVALUATED', stale_reasons: [], scope: 'NONE', latest: null, corrupt_count: 0 };
    }
    const reasons = [...anomalyReasons];
    if (latest.native === null) reasons.push('native_missing');
    if (latest.harnessed === null) reasons.push('harnessed_missing');
    if (reasons.length > 0) {
      return { state: 'INCOMPLETE', stale_reasons: reasons.sort(), scope: 'FULL', latest: withFreshness(latest, current), corrupt_count: anomalyCount };
    }
    const verdict = compareFingerprints(latest.fingerprint, current);
    return {
      state: verdict.state === 'FRESH' ? 'CURRENT' : 'STALE',
      stale_reasons: verdict.stale_reasons,
      scope: verdict.scope,
      latest: withFreshness(latest, current),
      corrupt_count: anomalyCount
    };
  }

  async function stateFor(modelId: string, current: AtlasFreshnessBasis) {
    const { records, corrupt, integrity_failures: integrityFailures } = await readAll(modelId);
    return composeState(records.at(-1), corrupt.length, integrityFailures.length, current);
  }

  // Batch state resolution scans the store exactly once for many models instead
  // of rescanning per model. It shares composeState with the single-model path,
  // so semantics are identical; only filesystem access is reduced.
  async function statesFor(modelIds: string[], currentFor: (modelId: string) => AtlasFreshnessBasis) {
    const inspection = await inspectStore(null);
    const byModel = new Map<string, AtlasEvaluationRecordT[]>();
    for (const record of inspection.records) {
      const list = byModel.get(record.model_id) ?? [];
      list.push(record);
      byModel.set(record.model_id, list);
    }
    const results = new Map<string, ReturnType<typeof composeState>>();
    for (const modelId of modelIds) {
      results.set(modelId, composeState(byModel.get(modelId)?.at(-1), inspection.corrupt.length, inspection.integrity_failures.length, currentFor(modelId)));
    }
    return results;
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

  // Read-only integrity audit. It reports; it never repairs, rewrites, or
  // deletes evidence. A missing integrity sidecar counts as unverified (not
  // corruption); a contradicting sidecar or an unbound recommendation reference
  // makes the store unhealthy.
  async function audit(options: AtlasAuditOptions = {}): Promise<AtlasAuditReport> {
    const inspection = await inspectStore(null);
    const issues: AtlasAuditIssue[] = [
      ...inspection.corrupt.map(file => ({ file, kind: 'CORRUPT' as const })),
      ...inspection.integrity_failures.map(file => ({ file, kind: 'INTEGRITY_MISMATCH' as const })),
      ...inspection.unverified.map(file => ({ file, kind: 'UNVERIFIED' as const }))
    ];
    const idCounts = new Map<string, number>();
    for (const record of inspection.records) idCounts.set(record.evaluation_id, (idCounts.get(record.evaluation_id) ?? 0) + 1);
    const duplicateIds = [...idCounts.entries()].filter(([, count]) => count > 1).map(([id]) => id);
    const dangling: AtlasAuditReport['dangling_recommendation_refs'] = [];
    for (const record of inspection.records) {
      const refs = new Set(record.evidence_refs);
      for (const recommendation of record.recommended_roles) {
        for (const ref of recommendation.evidence_refs) {
          if (!refs.has(ref)) dangling.push({ evaluation_id: record.evaluation_id, role: recommendation.role, missing_ref: ref });
        }
      }
    }
    const unsupported: string[] = [];
    for (const file of inspection.corrupt.slice(0, 20)) {
      try {
        const raw = JSON.parse(await fs.readFile(path.join(evaluationsDir, file), 'utf8'));
        if (raw !== null && typeof raw === 'object' && typeof raw.schema === 'string' && raw.schema !== MODEL_ATLAS_SCHEMA) unsupported.push(file);
      } catch {
        // not JSON at all - already counted as corrupt
      }
    }
    let refsChecked = false;
    let refsTotal = 0;
    let refsDangling = 0;
    if (options.evidenceResolver !== undefined) {
      refsChecked = true;
      const allRefs = new Set<string>();
      for (const record of inspection.records) for (const ref of record.evidence_refs) allRefs.add(ref);
      refsTotal = allRefs.size;
      for (const ref of allRefs) {
        try {
          if (!(await options.evidenceResolver(ref))) refsDangling += 1;
        } catch {
          refsDangling += 1;
        }
      }
    }
    return {
      schema: 'covert.model-atlas.audit.v1',
      checked_at: now().toISOString(),
      healthy: inspection.corrupt.length === 0 && inspection.integrity_failures.length === 0 &&
        duplicateIds.length === 0 && dangling.length === 0 && refsDangling === 0 && unsupported.length === 0,
      totals: {
        records: inspection.records.length,
        corrupt: inspection.corrupt.length,
        integrity_mismatch: inspection.integrity_failures.length,
        unverified: inspection.unverified.length,
        models: new Set(inspection.records.map(record => record.model_id)).size
      },
      issues,
      duplicate_evaluation_ids: duplicateIds,
      dangling_recommendation_refs: dangling,
      unsupported_schema_files: unsupported,
      evidence_refs: { checked: refsChecked, total: refsTotal, dangling: refsDangling }
    };
  }

  return {
    root,
    recordEvaluation,
    latestFor,
    stateFor,
    statesFor,
    historyFor,
    createCandidate,
    readCandidate,
    audit,
    compareFingerprints,
    deriveQualification,
    validateRecord
  };
}

export type ModelAtlas = ReturnType<typeof createModelAtlas>;
