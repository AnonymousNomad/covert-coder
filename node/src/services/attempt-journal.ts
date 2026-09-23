// DURABLE ATTEMPT / ADMISSION JOURNAL (Harness vNext H3).
//
// Purpose: execution boundary truth for the live AgentLoop mutation path.
// It does NOT grant permission (Authority does), does NOT judge acceptance
// (Veritas does), and does NOT duplicate Provenance (it feeds it via
// attempt_id). It answers durably: WHAT WAS ADMITTED, BY WHOM, WITH WHICH
// CONTEXT/SKILLS/BUDGET/RESOURCE DECISION, WHAT RAN, WHAT CHANGED, AND WHAT
// MAY SAFELY BE RETRIED.
//
// Atomicity (precise): "durable admission" means BOTH
//   (1) .aide/admission/attempts/<attempt_id>.json exists with sealed:true,
//       written via temp-file + rename on the same volume, and
//   (2) the append-only journal (.aide/admission/journal.jsonl) contains
//       ATTEMPT_ADMITTED for that attempt.
// A crash between the two leaves RECOVERED_INCOMPLETE_ADMISSION, which is NOT
// admitted: mutation dispatch fails closed. This closes the historical H2
// partial-commit class (admission state persisted but execution identity
// ambiguous, or mutation before durable admission).
//
// Retry law: NO BLIND RETRY AFTER UNCERTAIN MUTATION. Any EFFECT_UNCERTAIN or
// dangling RUNNING attempt classifies as UNCERTAIN_BLOCKED; retry/repair is a
// NEW attempt with fresh Authority.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  ExecutionEnvelope,
  type AttemptDetailT,
  type AttemptFailureClassT,
  type AttemptListResponseT,
  type AttemptStateT,
  type ExecutionEnvelopeT,
  type RetrySafetyT
} from '../../../common/contracts/attempt.ts';

const SECRET_PATTERNS: Array<[RegExp, string]> = [
  [/sk-[A-Za-z0-9_-]{8,}/g, '[REDACTED_KEY]'],
  [/Bearer\s+[A-Za-z0-9._-]{8,}/gi, 'Bearer [REDACTED]'],
  [/(api[_-]?key|token|password|secret)\s*[:=]\s*\S+/gi, '$1=[REDACTED]']
];

export function redactSecrets(text: string): string {
  let result = text;
  for (const [pattern, replacement] of SECRET_PATTERNS) result = result.replace(pattern, replacement);
  return result;
}

interface JournalEvent {
  seq: number;
  ts: string;
  attempt_id: string;
  event: string;
  data: Record<string, string | number | boolean | null>;
}

export interface AttemptAdmissionInput {
  task: string;
  mode: string;
  task_id: string;
  workspace: string;
  worker_role: string;
  worker_identity: string;
  worker_provider: string;
  worker_model: string;
  handoff_id: string | null;
  authority_owner: string;
  authority_operation_kind: string;
  max_iterations: number | null;
  effective_context_tokens: number | null;
  resource_decision: { decision: 'START' | 'QUEUE' | 'REFUSE_RESOURCE'; reason: string } | null;
  mutation_scope: string[];
  capabilities: string[];
}

export interface AttemptJournalOptions {
  workspace: string;
  now?: () => Date;
  idFactory?: () => string;
}

const MUTATION_TOOLS = ['write_file', 'replace_in_file', 'run_command', 'switch_mode', 'desktop_action'];

export function createAttemptJournal(options: AttemptJournalOptions) {
  const admissionDir = path.join(options.workspace, '.aide', 'admission');
  const journalPath = path.join(admissionDir, 'journal.jsonl');
  const attemptsDir = path.join(admissionDir, 'attempts');
  const now = options.now ?? (() => new Date());
  const idFactory = options.idFactory ?? (() => randomUUID());
  const mutationsInFlight = new Map<string, Set<string>>();
  const uncertainAttempts = new Set<string>();

  const readJournal = async (): Promise<JournalEvent[]> => {
    let raw: string;
    try {
      raw = await fs.readFile(journalPath, 'utf8');
    } catch {
      return [];
    }
    const events: JournalEvent[] = [];
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (trimmed.length === 0) continue;
      try {
        events.push(JSON.parse(trimmed) as JournalEvent);
      } catch {
        // Corrupt lines are skipped; reads never fabricate.
      }
    }
    return events;
  };

  const append = async (attemptId: string, event: string, data: Record<string, string | number | boolean | null> = {}): Promise<void> => {
    const events = await readJournal();
    const seq = events.filter(entry => entry.attempt_id === attemptId).length;
    await fs.mkdir(admissionDir, { recursive: true });
    await fs.appendFile(journalPath, `${JSON.stringify({ seq, ts: now().toISOString(), attempt_id: attemptId, event, data })}\n`, 'utf8');
  };

  const envelopePath = (attemptId: string): string => path.join(attemptsDir, `${attemptId}.json`);

  const readEnvelope = async (attemptId: string): Promise<ExecutionEnvelopeT | null> => {
    try {
      const raw = await fs.readFile(envelopePath(attemptId), 'utf8');
      return ExecutionEnvelope.parse(JSON.parse(raw)) as ExecutionEnvelopeT;
    } catch {
      return null;
    }
  };

  const writeEnvelopeSealed = async (envelope: ExecutionEnvelopeT): Promise<void> => {
    await fs.mkdir(attemptsDir, { recursive: true });
    const temp = path.join(attemptsDir, `.${envelope.attempt_id}.tmp`);
    await fs.writeFile(temp, JSON.stringify(envelope, null, 2), 'utf8');
    await fs.rename(temp, envelopePath(envelope.attempt_id));
  };

  // Durable admission check: BOTH artifacts must exist. Fail closed.
  const assertAdmitted = async (attemptId: string): Promise<{ admitted: boolean; reason: string }> => {
    const envelope = await readEnvelope(attemptId);
    if (envelope === null || envelope.sealed !== true) return { admitted: false, reason: 'execution envelope is absent or unsealed' };
    const events = await readJournal();
    const admitted = events.some(entry => entry.attempt_id === attemptId && entry.event === 'ATTEMPT_ADMITTED');
    if (!admitted) return { admitted: false, reason: 'journal has no durable ATTEMPT_ADMITTED record' };
    return { admitted: true, reason: 'durable admission established' };
  };

  // Two-phase admission. Returns the sealed envelope. Any failure between the
  // phases leaves RECOVERED_INCOMPLETE_ADMISSION (not admitted) after restart.
  const admit = async (input: AttemptAdmissionInput): Promise<ExecutionEnvelopeT> => {
    const attemptId = idFactory();
    const createdAt = now().toISOString();
    const objective = redactSecrets(input.task).slice(0, 2000);
    const envelope: ExecutionEnvelopeT = {
      schema: 'covert.attempt.v1',
      attempt_id: attemptId,
      sealed: false,
      created_at: createdAt,
      sealed_at: null,
      mission_id: input.task_id,
      project_id: input.workspace,
      task_id: input.task_id,
      workflow_id: 'NOT_RECORDED',
      stage_id: 'NOT_RECORDED',
      parent_attempt_id: null,
      handoff_id: input.handoff_id,
      continuation_chain_id: null,
      worker_role: input.worker_role,
      worker_identity: input.worker_identity,
      worker_provider: input.worker_provider,
      worker_model: input.worker_model,
      observed_model: 'NOT_RECORDED',
      runtime_profile: 'NOT_RECORDED',
      adapter_identity: 'NOT_RECORDED',
      context_envelope: { identity: 'NOT_RECORDED', sha256: null, blocks: [], bound_at: null },
      skills: { identities: [], status: 'NOT_RECORDED' },
      capabilities: input.capabilities,
      objective,
      acceptance_criteria: 'NOT_RECORDED',
      verification_requirements: 'harness required-evidence policy (negative verification when requirement-bound evidence is absent)',
      resource_admission: input.resource_decision === null
        ? { decision: 'NOT_RECORDED', reason: 'resource admission not consulted', checked_at: null }
        : { decision: input.resource_decision.decision, reason: redactSecrets(input.resource_decision.reason).slice(0, 600), checked_at: createdAt },
      authority_scope: {
        owner: input.authority_owner,
        operation_kind: input.authority_operation_kind,
        workspace: input.workspace,
        permit_identity: 'one-use execution context (agent.start)'
      },
      mutation_scope: input.mutation_scope,
      budget: {
        max_iterations: input.max_iterations,
        effective_context_tokens: input.effective_context_tokens,
        timeout_ms: null,
        retry_bounds: 'no blind retry after uncertain mutation'
      },
      mode: input.mode,
      started_by: 'agent-loop'
    };
    await append(attemptId, 'ATTEMPT_CREATED', { task_id: input.task_id, mode: input.mode });
    await append(attemptId, 'VALIDATION_COMPLETED', { binding: 'start-binding-ok' });
    await append(attemptId, 'RESOURCE_ADMITTED', {
      decision: envelope.resource_admission.decision,
      reason: envelope.resource_admission.reason
    });
    await append(attemptId, 'AUTHORITY_GRANTED', { owner: input.authority_owner, operation_kind: input.authority_operation_kind });
    const sealed: ExecutionEnvelopeT = { ...envelope, sealed: true, sealed_at: now().toISOString() };
    await writeEnvelopeSealed(sealed);
    await append(attemptId, 'ATTEMPT_ADMITTED', { sealed_at: sealed.sealed_at });
    return sealed;
  };

  const rejectAdmission = async (attemptId: string, failureClass: AttemptFailureClassT, reason: string): Promise<void> => {
    await append(attemptId, 'ATTEMPT_FAILED', { failure_class: failureClass, reason: redactSecrets(reason).slice(0, 500) });
  };

  const executionStarted = async (attemptId: string): Promise<void> => {
    await append(attemptId, 'EXECUTION_STARTED', {});
  };

  const bindContext = async (attemptId: string, contextSha256: string, blocks: string[]): Promise<{ drift: boolean }> => {
    const envelope = await readEnvelope(attemptId);
    if (envelope === null) return { drift: false };
    const previous = envelope.context_envelope.sha256;
    if (previous === null) {
      const bound: ExecutionEnvelopeT = {
        ...envelope,
        context_envelope: { identity: `sha256:${contextSha256.slice(0, 16)}`, sha256: contextSha256, blocks: blocks.slice(0, 32), bound_at: now().toISOString() }
      };
      await writeEnvelopeSealed(bound);
      await append(attemptId, 'CONTEXT_BOUND', { sha256: contextSha256, blocks: blocks.join(',').slice(0, 400) });
      return { drift: false };
    }
    if (previous !== contextSha256) {
      await append(attemptId, 'CONTEXT_DRIFT', { previous: previous.slice(0, 16), observed: contextSha256.slice(0, 16), blocks: blocks.join(',').slice(0, 400) });
      return { drift: true };
    }
    return { drift: false };
  };

  const effectObserved = async (attemptId: string, data: { tool: string; path: string | null; sha256: string | null; bytes: number | null }): Promise<void> => {
    await append(attemptId, 'EFFECT_OBSERVED', { tool: data.tool, path: data.path, sha256: data.sha256, bytes: data.bytes });
  };

  const effectUncertain = async (attemptId: string, data: { tool: string; path: string | null; error: string }): Promise<void> => {
    uncertainAttempts.add(attemptId);
    await append(attemptId, 'EFFECT_UNCERTAIN', { tool: data.tool, path: data.path, error: redactSecrets(data.error).slice(0, 300) });
  };

  const verificationStarted = async (attemptId: string): Promise<void> => {
    await append(attemptId, 'VERIFICATION_STARTED', {});
  };

  const finalize = async (attemptId: string, data: {
    result: 'done' | 'error' | 'aborted';
    verification_state: string;
    accepted: boolean;
    failure_class: AttemptFailureClassT | null;
    error: string | null;
  }): Promise<void> => {
    if (data.result === 'aborted') {
      await append(attemptId, 'ATTEMPT_ABORTED', { verification_state: data.verification_state });
      return;
    }
    if (data.result === 'error') {
      await append(attemptId, 'ATTEMPT_FAILED', {
        failure_class: data.failure_class ?? 'EXECUTION_FAILURE',
        error: data.error === null ? null : redactSecrets(data.error).slice(0, 300)
      });
      return;
    }
    await append(attemptId, 'ATTEMPT_COMPLETED', { verification_state: data.verification_state, accepted: data.accepted });
    if (data.accepted) await append(attemptId, 'ATTEMPT_ACCEPTED', { verification_state: data.verification_state });
  };

  const stateOf = (events: JournalEvent[], attemptId: string): { state: AttemptStateT; failure_class: AttemptFailureClassT | null; recovery_note: string | null } => {
    const own = events.filter(entry => entry.attempt_id === attemptId);
    const has = (name: string) => own.some(entry => entry.event === name);
    const recoveryEvent = own.find(entry => entry.event === 'RECOVERY_CLASSIFIED');
    const recoveryNote = recoveryEvent === undefined ? null : String(recoveryEvent.data.note ?? '');
    if (has('RECOVERY_CLASSIFIED')) {
      const classification = String(recoveryEvent?.data.classification ?? 'RECOVERED_UNCERTAIN');
      return { state: classification as AttemptStateT, failure_class: null, recovery_note: recoveryNote };
    }
    if (has('ATTEMPT_ACCEPTED')) return { state: 'ACCEPTED', failure_class: null, recovery_note: null };
    if (has('ATTEMPT_COMPLETED')) return { state: 'COMPLETED', failure_class: null, recovery_note: null };
    if (has('ATTEMPT_ABORTED')) return { state: 'ABORTED', failure_class: null, recovery_note: null };
    if (has('ATTEMPT_FAILED')) {
      const failed = own.filter(entry => entry.event === 'ATTEMPT_FAILED').pop();
      return { state: 'FAILED', failure_class: (failed?.data.failure_class ?? 'UNKNOWN') as AttemptFailureClassT, recovery_note: null };
    }
    if (has('EXECUTION_STARTED')) return { state: 'RUNNING', failure_class: null, recovery_note: null };
    if (has('ATTEMPT_ADMITTED')) return { state: 'ADMITTED', failure_class: null, recovery_note: null };
    return { state: 'RECOVERED_INCOMPLETE_ADMISSION', failure_class: 'ADMISSION_FAILURE', recovery_note: 'admission sequence incomplete' };
  };

  const retrySafetyOf = (events: JournalEvent[], attemptId: string, state: AttemptStateT): RetrySafetyT => {
    const own = events.filter(entry => entry.attempt_id === attemptId);
    const has = (name: string) => own.some(entry => entry.event === name);
    if (has('EFFECT_UNCERTAIN')) return 'UNCERTAIN_BLOCKED';
    if (state === 'RECOVERED_UNCERTAIN') return 'UNCERTAIN_BLOCKED';
    if (state === 'RECOVERED_MUTATED_UNVERIFIED') return 'UNCERTAIN_BLOCKED';
    if (state === 'RECOVERED_INCOMPLETE_ADMISSION') return 'NOT_APPLICABLE';
    if (has('EFFECT_OBSERVED')) return 'NEW_ATTEMPT_REQUIRED';
    if (state === 'FAILED' || state === 'ABORTED' || state === 'RECOVERED_NOT_STARTED') return 'SAFE_TO_RETRY';
    return 'NOT_APPLICABLE';
  };

  const recover = async (): Promise<Array<{ attempt_id: string; classification: AttemptStateT; note: string }>> => {
    const events = await readJournal();
    const ids = [...new Set(events.map(entry => entry.attempt_id))];
    const results: Array<{ attempt_id: string; classification: AttemptStateT; note: string }> = [];
    for (const attemptId of ids) {
      const own = events.filter(entry => entry.attempt_id === attemptId);
      if (own.some(entry => ['ATTEMPT_COMPLETED', 'ATTEMPT_FAILED', 'ATTEMPT_ABORTED', 'RECOVERY_CLASSIFIED'].includes(entry.event))) continue;
      const has = (name: string) => own.some(entry => entry.event === name);
      let classification: AttemptStateT;
      let note: string;
      if (!has('ATTEMPT_ADMITTED')) {
        const envelope = await readEnvelope(attemptId);
        classification = 'RECOVERED_INCOMPLETE_ADMISSION';
        note = envelope === null ? 'crash before durable admission: no sealed envelope' : 'crash between envelope seal and journal admission';
      } else if (!has('EXECUTION_STARTED')) {
        classification = 'RECOVERED_NOT_STARTED';
        note = 'admitted but execution never began';
      } else if (has('EFFECT_OBSERVED')) {
        classification = 'RECOVERED_MUTATED_UNVERIFIED';
        note = 'mutation observed without terminal verification';
      } else {
        classification = 'RECOVERED_UNCERTAIN';
        note = 'execution began without terminal state; effect state cannot be proven';
      }
      await append(attemptId, 'RECOVERY_CLASSIFIED', { classification, note });
      results.push({ attempt_id: attemptId, classification, note });
    }
    return results;
  };

  const get = async (attemptId: string): Promise<AttemptDetailT | null> => {
    const envelope = await readEnvelope(attemptId);
    if (envelope === null) return null;
    const events = await readJournal();
    const { state, failure_class, recovery_note } = stateOf(events, attemptId);
    return {
      envelope,
      state,
      retry_safety: retrySafetyOf(events, attemptId, state),
      failure_class,
      recovery_note,
      events: events.filter(entry => entry.attempt_id === attemptId).slice(-500)
    };
  };

  const list = async (taskId?: string): Promise<AttemptListResponseT> => {
    const events = await readJournal();
    const ids = [...new Set(events.map(entry => entry.attempt_id))];
    const attempts: AttemptListResponseT['attempts'] = [];
    for (const attemptId of ids) {
      const envelope = await readEnvelope(attemptId);
      if (envelope === null) continue;
      if (taskId !== undefined && envelope.task_id !== taskId) continue;
      const { state } = stateOf(events, attemptId);
      attempts.push({
        attempt_id: attemptId,
        task_id: envelope.task_id,
        state,
        retry_safety: retrySafetyOf(events, attemptId, state),
        sealed: envelope.sealed,
        created_at: envelope.created_at
      });
    }
    return { attempts: attempts.slice(-500), total: attempts.length };
  };

  // Live-path hooks used by the agent loop.
  const noteMutationDispatch = (attemptId: string, tool: string): void => {
    const set = mutationsInFlight.get(attemptId) ?? new Set<string>();
    set.add(tool);
    mutationsInFlight.set(attemptId, set);
  };

  const clearMutationDispatch = (attemptId: string, tool: string): void => {
    mutationsInFlight.get(attemptId)?.delete(tool);
  };

  return {
    journalPath,
    attemptsDir,
    admit,
    rejectAdmission,
    assertAdmitted,
    executionStarted,
    bindContext,
    effectObserved,
    effectUncertain,
    verificationStarted,
    finalize,
    recover,
    get,
    list,
    noteMutationDispatch,
    clearMutationDispatch,
    uncertainAttempts,
    MUTATION_TOOLS
  };
}
