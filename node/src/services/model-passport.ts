import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  ModelPassport,
  type ModelPassportT,
  type PassportEvidenceConfidenceT,
  type PerformanceEventT
} from '../../../common/contracts/performance.ts';
import { performanceIdentity } from './performance-ledger.ts';

// Model Passport — a DERIVED projection over PerformanceEvents.
//
// It is never raw truth: every number is an observation count or a median over
// the exact events that produced it, the sample size and a mechanical
// confidence label are always shown, and insufficient evidence is reported as
// INSUFFICIENT DATA instead of a fabricated score. Distinct configurations
// (model revision, artifact hash, quantization, runtime, configured context)
// are distinct performance identities and are never blended.
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

function observationGroup(records: PerformanceEventT[], keyOf: (record: PerformanceEventT) => string) {
  const groups = new Map<string, PerformanceEventT[]>();
  for (const record of records) {
    const key = keyOf(record);
    const list = groups.get(key) ?? [];
    list.push(record);
    groups.set(key, list);
  }
  return groups;
}

export function derivePassport(records: PerformanceEventT[], generatedAt = new Date().toISOString()): ModelPassportT | null {
  if (records.length === 0) return null;
  const first = records[0]!;
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

  const notes: string[] = [
    `derived from ${sampleSize} performance event(s); confidence ${evidenceConfidence(sampleSize)}`,
    'no composite quality score exists: only counts, rates, and medians over observed events'
  ];
  if (sampleSize < 3) notes.push('insufficient sample for stable comparisons (n < 3)');
  if (unresolved > 0) notes.push(`${unresolved} event(s) finished UNRESOLVED (objective verification could not decide)`);
  if (records.some(record => record.execution.time_to_first_token_ms === null)) notes.push('some events did not measure time-to-first-token');

  const passport: ModelPassportT = {
    schema_version: '1.0',
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
      veritas_verdicts: [...new Set(records.map(record => record.verification.veritas_verdict).filter((verdict): verdict is string => verdict !== null))].sort()
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

export function derivePassports(records: PerformanceEventT[], generatedAt = new Date().toISOString()): ModelPassportT[] {
  const groups = new Map<string, PerformanceEventT[]>();
  for (const record of records) {
    const identity = performanceIdentity(record.model);
    const list = groups.get(identity) ?? [];
    list.push(record);
    groups.set(identity, list);
  }
  const passports: ModelPassportT[] = [];
  for (const identity of [...groups.keys()].sort()) {
    const passport = derivePassport(groups.get(identity)!, generatedAt);
    if (passport !== null) passports.push(passport);
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
