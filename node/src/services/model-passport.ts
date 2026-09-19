import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  ModelPassport,
  type ModelPassportT,
  type PassportEvidenceConfidenceT,
  type QualificationRecordT,
  type AnyPerformanceEventT
} from '../../../common/contracts/performance.ts';
import { performanceIdentity } from './performance-ledger.ts';

// Model Passport — a DERIVED projection over PerformanceEvents and the
// qualification record for the same configuration.
//
// It is never raw truth: every number is an observation count or a median over
// the exact events that produced it, the sample size and a mechanical
// confidence label are always shown, and insufficient evidence is reported as
// INSUFFICIENT DATA instead of a fabricated score. Distinct configurations
// (model revision, artifact hash, quantization, runtime, configured context)
// are distinct performance identities and are never blended. A configuration
// whose functional qualification FAILED stays inspectable here and is excluded
// from evidence-qualified routing candidates by the recommendation layer.
export const PASSPORTS_FILE_NAME = 'passports.json';

export function evidenceConfidence(sampleSize: number): PassportEvidenceConfidenceT {
  if (sampleSize <= 0) return 'INSUFFICIENT';
  if (sampleSize < 3) return 'LOW';
  if (sampleSize < 8) return 'MODERATE';
  return 'HIGH';
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle]! : Math.round((sorted[middle - 1]! + sorted[middle]!) / 2);
}

function rate(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null;
  return Math.round((numerator / denominator) * 10000) / 10000;
}

function observationGroup(records: AnyPerformanceEventT[], keyOf: (record: AnyPerformanceEventT) => string) {
  const groups = new Map<string, AnyPerformanceEventT[]>();
  for (const record of records) {
    const key = keyOf(record);
    const list = groups.get(key) ?? [];
    list.push(record);
    groups.set(key, list);
  }
  return groups;
}

export interface PassportDerivationOptions {
  qualifications?: QualificationRecordT[];
  generatedAt?: string;
}

function matchQualification(record: AnyPerformanceEventT, qualifications: QualificationRecordT[]): QualificationRecordT | null {
  const identity = performanceIdentity(record.model);
  const matches = qualifications
    .filter(candidate =>
      `${candidate.identity.model_id}@${candidate.identity.artifact_hash}:${candidate.identity.configured_context}:${candidate.identity.runtime}` === identity)
    .sort((a, b) => a.checked_at.localeCompare(b.checked_at));
  return matches.length > 0 ? matches[matches.length - 1]! : null;
}

function evidenceClassFor(qualification: QualificationRecordT | null, sampleSize: number): ModelPassportT['evidence_class'] {
  if (qualification !== null && qualification.state === 'QUALIFICATION_FAILED') return 'QUALIFICATION_FAILED';
  if (qualification === null) return sampleSize === 0 ? 'INSUFFICIENT_DATA' : 'UNPROBED';
  if (qualification.state !== 'QUALIFIED') return 'INSUFFICIENT_DATA';
  return sampleSize >= 3 ? 'QUALIFIED_EVIDENCE_AVAILABLE' : 'QUALIFIED_LOW_SAMPLE';
}

function qualificationBlock(qualification: QualificationRecordT | null): ModelPassportT['qualification'] {
  if (qualification === null) {
    return { state: 'UNQUALIFIED', checked_at: null, failure_class: null, qualification_identity: null };
  }
  return {
    state: qualification.state,
    checked_at: qualification.checked_at,
    failure_class: qualification.failure_class,
    qualification_identity: qualification.qualification_identity
  };
}

export function derivePassport(records: AnyPerformanceEventT[], options: PassportDerivationOptions = {}): ModelPassportT | null {
  if (records.length === 0) return null;
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const first = records[0]!;
  const qualification = matchQualification(first, options.qualifications ?? []);
  const timestamps = records.map(record => record.run.timestamp).sort();
  const completed = records.filter(record => record.outcome.completed).length;
  const failed = records.length - completed;
  const unresolved = records.filter(record => record.outcome.failure_class === 'unresolved').length;
  const sampleSize = records.length;

  const taskClassGroups = observationGroup(records, record => record.task.task_class);
  const workflowGroups = observationGroup(records, record => `${record.methodology.workflow_id}@${record.methodology.workflow_version}`);
  const modeGroups = observationGroup(records, record => record.operating_mode.mode_id);

  const failureCounts = new Map<string, number>();
  for (const record of records) {
    if (record.outcome.failure_class !== null) failureCounts.set(record.outcome.failure_class, (failureCounts.get(record.outcome.failure_class) ?? 0) + 1);
  }

  const evidenceClass = evidenceClassFor(qualification, sampleSize);
  const notes: string[] = [
    `derived from ${sampleSize} performance event(s); confidence ${evidenceConfidence(sampleSize)}`,
    'no composite quality score exists: only counts, rates, and medians over observed events'
  ];
  if (sampleSize < 3) notes.push('insufficient sample for stable comparisons (n < 3)');
  if (unresolved > 0) notes.push(`${unresolved} event(s) finished UNRESOLVED (objective verification could not decide)`);
  if (records.some(record => record.execution.time_to_first_token_ms === null)) notes.push('some events did not measure time-to-first-token');
  if (evidenceClass === 'QUALIFICATION_FAILED') notes.push(`qualification failed (${qualification?.failure_class ?? 'unknown'}) — configuration excluded from qualified routing candidates`);
  if (evidenceClass === 'UNPROBED') notes.push('no qualification probe recorded for this configuration');

  const passport: ModelPassportT = {
    schema_version: '1.1',
    performance_identity: performanceIdentity(first.model),
    identity: {
      model_id: first.model.model_id,
      provider: first.model.provider,
      runtime: first.model.runtime,
      model_version: first.model.model_version,
      artifact_hash: first.model.artifact_hash,
      quantization: first.model.quantization,
      configured_context: first.model.configured_context
    },
    generated_at: generatedAt,
    qualification: qualificationBlock(qualification),
    evidence_class: evidenceClass,
    evidence: {
      sample_size: sampleSize,
      first_event_at: timestamps[0] ?? null,
      last_event_at: timestamps[timestamps.length - 1] ?? null,
      evidence_confidence: evidenceConfidence(sampleSize),
      suites: [...new Set(records.map(record => record.task.benchmark_suite))].sort(),
      workflow_ids: [...new Set(records.map(record => record.methodology.workflow_id))].sort(),
      mode_ids: [...new Set(records.map(record => record.operating_mode.mode_id))].sort(),
      skill_ids: [...new Set(records.flatMap(record => record.methodology.skill_ids))].sort(),
      sop_ids: [...new Set(records.flatMap(record => record.methodology.sop_ids))].sort()
    },
    outcome: {
      completed,
      failed,
      unresolved,
      completion_rate: rate(completed, sampleSize),
      first_attempt_success_rate: rate(records.filter(record => record.outcome.first_attempt_success).length, sampleSize),
      fallback_rate: rate(records.filter(record => record.outcome.fallback_required).length, sampleSize)
    },
    execution: {
      median_duration_ms: median(records.map(record => record.execution.duration_ms)),
      median_output_tokens: median(records.filter(record => record.execution.output_tokens !== null).map(record => record.execution.output_tokens!)),
      total_tool_calls: records.reduce((sum, record) => sum + record.execution.tool_calls, 0),
      total_tool_failures: records.reduce((sum, record) => sum + record.execution.tool_failures, 0),
      total_authority_requests: records.reduce((sum, record) => sum + record.execution.authority_requests, 0),
      total_retries: records.reduce((sum, record) => sum + record.execution.retries, 0)
    },
    verification: {
      checks_passed: records.reduce((sum, record) => sum + record.verification.deterministic_checks.passed, 0),
      checks_failed: records.reduce((sum, record) => sum + record.verification.deterministic_checks.failed, 0),
      tests_passed: records.reduce((sum, record) => sum + record.verification.tests_passed, 0),
      tests_failed: records.reduce((sum, record) => sum + record.verification.tests_failed, 0),
      veritas_verdicts: [...new Set(records
        .map(record => 'veritas' in record.verification ? record.verification.veritas.status : record.verification.veritas_verdict)
        .filter((verdict): verdict is string => verdict !== null && verdict !== undefined))].sort()
    },
    by_task_class: [...taskClassGroups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([taskClass, group]) => ({
      task_class: taskClass,
      sample_size: group.length,
      completed: group.filter(record => record.outcome.completed).length,
      completion_rate: rate(group.filter(record => record.outcome.completed).length, group.length),
      median_duration_ms: median(group.map(record => record.execution.duration_ms))
    })),
    by_workflow: [...workflowGroups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, group]) => {
      const separator = key.lastIndexOf('@');
      return {
        workflow_id: key.slice(0, separator),
        workflow_version: key.slice(separator + 1),
        sample_size: group.length,
        completed: group.filter(record => record.outcome.completed).length,
        completion_rate: rate(group.filter(record => record.outcome.completed).length, group.length),
        median_duration_ms: median(group.map(record => record.execution.duration_ms))
      };
    }),
    by_mode: [...modeGroups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([modeId, group]) => ({
      mode_id: modeId,
      sample_size: group.length,
      completed: group.filter(record => record.outcome.completed).length,
      completion_rate: rate(group.filter(record => record.outcome.completed).length, group.length),
      median_duration_ms: median(group.map(record => record.execution.duration_ms))
    })),
    failure_classes: [...failureCounts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([failureClass, count]) => ({ failure_class: failureClass, count })),
    insufficient_data: sampleSize === 0,
    notes
  };
  const parsed = ModelPassport.safeParse(passport);
  if (!parsed.success) throw new TypeError(`derived passport failed schema: ${parsed.error.issues[0]?.message ?? 'schema'}`);
  return parsed.data;
}

// Qualification-only passport: a failed or probed configuration with no
// benchmark events yet must still be inspectable (history is evidence).
function qualificationOnlyPassport(qualification: QualificationRecordT, generatedAt: string): ModelPassportT {
  const identity = qualification.identity;
  const passport: ModelPassportT = {
    schema_version: '1.1',
    performance_identity: `${identity.model_id}@${identity.artifact_hash}:${identity.configured_context}:${identity.runtime}`,
    identity: {
      model_id: identity.model_id,
      provider: 'local',
      runtime: identity.runtime,
      model_version: 'unknown',
      artifact_hash: identity.artifact_hash,
      quantization: identity.quantization,
      configured_context: identity.configured_context
    },
    generated_at: generatedAt,
    qualification: {
      state: qualification.state,
      checked_at: qualification.checked_at,
      failure_class: qualification.failure_class,
      qualification_identity: qualification.qualification_identity
    },
    evidence_class: qualification.state === 'QUALIFICATION_FAILED' ? 'QUALIFICATION_FAILED' : 'QUALIFIED_LOW_SAMPLE',
    evidence: {
      sample_size: 0,
      first_event_at: null,
      last_event_at: null,
      evidence_confidence: 'INSUFFICIENT',
      suites: [],
      workflow_ids: [],
      mode_ids: [],
      skill_ids: [],
      sop_ids: []
    },
    outcome: { completed: 0, failed: 0, unresolved: 0, completion_rate: null, first_attempt_success_rate: null, fallback_rate: null },
    execution: { median_duration_ms: null, median_output_tokens: null, total_tool_calls: 0, total_tool_failures: 0, total_authority_requests: 0, total_retries: 0 },
    verification: { checks_passed: 0, checks_failed: 0, tests_passed: 0, tests_failed: 0, veritas_verdicts: [] },
    by_task_class: [],
    by_workflow: [],
    by_mode: [],
    failure_classes: [],
    insufficient_data: true,
    notes: [
      'no benchmark events recorded for this configuration yet',
      qualification.state === 'QUALIFICATION_FAILED' ? `qualification failed (${qualification.failure_class ?? 'unknown'}) — configuration excluded from qualified routing candidates` : 'qualification probe recorded'
    ]
  };
  const parsed = ModelPassport.safeParse(passport);
  if (!parsed.success) throw new TypeError(`qualification-only passport failed schema: ${parsed.error.issues[0]?.message ?? 'schema'}`);
  return parsed.data;
}

export function derivePassports(records: AnyPerformanceEventT[], options: PassportDerivationOptions = {}): ModelPassportT[] {
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const groups = new Map<string, AnyPerformanceEventT[]>();
  for (const record of records) {
    const identity = performanceIdentity(record.model);
    const list = groups.get(identity) ?? [];
    list.push(record);
    groups.set(identity, list);
  }
  const passports: ModelPassportT[] = [];
  for (const identity of [...groups.keys()].sort()) {
    const passport = derivePassport(groups.get(identity)!, { ...options, generatedAt });
    if (passport !== null) passports.push(passport);
  }
  const seen = new Set(passports.map(passport => passport.performance_identity));
  for (const qualification of options.qualifications ?? []) {
    const identity = `${qualification.identity.model_id}@${qualification.identity.artifact_hash}:${qualification.identity.configured_context}:${qualification.identity.runtime}`;
    if (!seen.has(identity)) {
      passports.push(qualificationOnlyPassport(qualification, generatedAt));
      seen.add(identity);
    }
  }
  return passports;
}

export async function writePassports(root: string, passports: ModelPassportT[]): Promise<string> {
  const file = path.join(root, PASSPORTS_FILE_NAME);
  await fs.mkdir(root, { recursive: true });
  const temporary = `${file}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(temporary, JSON.stringify({ generated_at: new Date().toISOString(), passports }, null, 2), 'utf8');
  await fs.rename(temporary, file);
  return file;
}

export async function readPassports(root: string): Promise<{ generated_at: string; passports: ModelPassportT[] }> {
  const file = path.join(root, PASSPORTS_FILE_NAME);
  try {
    const raw = JSON.parse(await fs.readFile(file, 'utf8')) as { generated_at?: unknown; passports?: unknown };
    const passports: ModelPassportT[] = [];
    for (const candidate of Array.isArray(raw.passports) ? raw.passports : []) {
      const parsed = ModelPassport.safeParse(candidate);
      if (parsed.success) passports.push(parsed.data);
    }
    return { generated_at: typeof raw.generated_at === 'string' ? raw.generated_at : new Date(0).toISOString(), passports };
  } catch {
    return { generated_at: new Date(0).toISOString(), passports: [] };
  }
}
