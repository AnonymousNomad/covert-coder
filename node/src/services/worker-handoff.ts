// Governed worker-handoff service. One durable object per handoff under
// `.aide/worker-handoffs/<id>.json`. The builder derives continuity from
// CANONICAL stores (agent trajectory, verification evidence, workflow state,
// memory journal reference); worker-authored fields are limited to explicit
// claims and are labeled as such. Authority travels with nothing here.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  WorkerHandoffEnvelope,
  type WorkerHandoffEnvelopeT,
  type WorkerHandoffCreateRequestT,
  type WorkerDescriptorT
} from '../../../common/contracts/worker-handoff.ts';

export type WorkerHandoffErrorCode = 'INVALID' | 'NOT_FOUND' | 'CONFLICT';

export class WorkerHandoffError extends Error {
  readonly code: WorkerHandoffErrorCode;
  constructor(code: WorkerHandoffErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

type WorkflowProjection = {
  load(): Promise<{ workflow_id?: string; project_id?: string; stage?: string; artifacts?: Array<{ artifact_id?: string; type?: string; path?: string; sha256?: string; stage?: string }> } | null>;
};

export interface WorkerHandoffServiceOptions {
  workspace: string;
  workflowService?: WorkflowProjection | null;
  now?: () => string;
}

const CONTEXT_MAX_CHARS = 6000;

export function createWorkerHandoffService(options: WorkerHandoffServiceOptions) {
  const workspace = options.workspace;
  const workflowService = options.workflowService ?? null;
  const now = options.now ?? (() => new Date().toISOString());
  const dir = path.join(workspace, '.aide', 'worker-handoffs');

  function handoffPath(id: string): string {
    return path.join(dir, `${id}.json`);
  }

  async function readEnvelope(id: string): Promise<WorkerHandoffEnvelopeT> {
    let raw: string;
    try {
      raw = await fs.readFile(handoffPath(id), 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw new WorkerHandoffError('NOT_FOUND', `handoff ${id} not found`);
      throw new WorkerHandoffError('INVALID', 'handoff storage read failed');
    }
    const parsed = WorkerHandoffEnvelope.safeParse(JSON.parse(raw));
    if (!parsed.success) throw new WorkerHandoffError('INVALID', `corrupt handoff ${id}`);
    return parsed.data;
  }

  async function writeEnvelope(envelope: WorkerHandoffEnvelopeT): Promise<void> {
    await fs.mkdir(dir, { recursive: true });
    const validated = WorkerHandoffEnvelope.parse(envelope);
    const target = handoffPath(validated.handoff_id);
    const temp = `${target}.tmp`;
    const handle = await fs.open(temp, 'w');
    try {
      await handle.writeFile(JSON.stringify(validated, null, 2), 'utf8');
      await handle.sync();
    } finally {
      await handle.close();
    }
    await fs.rename(temp, target);
  }

  type Trajectory = {
    session_id?: string;
    task?: string;
    mode?: string;
    outcome?: string;
    iterations?: number;
    mistake_count?: number;
    error?: string | null;
    started_at?: string;
    ended_at?: string;
  };
  type Verification = {
    outcome?: string;
    execution?: { results?: Array<{ name?: string; passed?: boolean; skipped?: boolean }> };
    verification?: { state?: string; checks?: Record<string, string> };
  };

  async function readJsonFile<T>(filePath: string): Promise<T | null> {
    try {
      return JSON.parse(await fs.readFile(filePath, 'utf8')) as T;
    } catch {
      return null;
    }
  }

  function bounded(value: string, max: number): string {
    return value.length > max ? `${value.slice(0, max - 1)}…` : value;
  }

  async function deriveCanonical(taskId: string): Promise<{
    trajectory: Trajectory;
    verification: Verification | null;
    trajectoryRef: string;
    verificationRef: string | null;
    workflow: Awaited<ReturnType<WorkflowProjection['load']>>;
  }> {
    const trajectoryRef = `trajectories/${taskId}.traj.json`;
    const trajectory = await readJsonFile<Trajectory>(path.join(workspace, '.aide', trajectoryRef));
    if (trajectory === null) {
      throw new WorkerHandoffError('NOT_FOUND', `task ${taskId} has no canonical trajectory; a handoff cannot be fabricated`);
    }
    const verificationRef = `verifications/${taskId}.verification.json`;
    const verification = await readJsonFile<Verification>(path.join(workspace, '.aide', verificationRef));
    let workflow: Awaited<ReturnType<WorkflowProjection['load']>> = null;
    if (workflowService !== null) {
      try {
        workflow = await workflowService.load();
      } catch {
        workflow = null;
      }
    }
    return { trajectory, verification, trajectoryRef, verificationRef: verification === null ? null : verificationRef, workflow };
  }

  async function create(request: WorkerHandoffCreateRequestT): Promise<WorkerHandoffEnvelopeT> {
    const derived = await deriveCanonical(request.task_id);
    const { trajectory, verification, workflow } = derived;

    const workerClaims: string[] = [
      `outcome: ${String(trajectory.outcome ?? 'unknown')}`,
      `iterations: ${String(trajectory.iterations ?? 0)}`,
      ...(trajectory.error ? [`error: ${bounded(String(trajectory.error), 500)}`] : [])
    ].slice(0, 16);

    const verifiedFacts: string[] = [];
    const execution = verification?.execution?.results ?? [];
    for (const result of execution) {
      if (result.passed === true) verifiedFacts.push(`step ${String(result.name ?? '?')}: passed`);
      if (verifiedFacts.length >= 32) break;
    }
    if (workflow && typeof workflow.stage === 'string') {
      const validated = (workflow.artifacts ?? []).filter(artifact => typeof artifact.path === 'string').length;
      verifiedFacts.push(`workflow stage: ${workflow.stage}; artifact references: ${validated}`);
    }

    const artifacts = (workflow?.artifacts ?? []).slice(0, 64).map(artifact => ({
      artifact_id: String(artifact.artifact_id ?? ''),
      type: String(artifact.type ?? ''),
      path: String(artifact.path ?? ''),
      sha256: String(artifact.sha256 ?? ''),
      stage: String(artifact.stage ?? '')
    })).filter(artifact => artifact.artifact_id.length > 0);

    const evidenceRefs = [derived.trajectoryRef, ...(derived.verificationRef !== null ? [derived.verificationRef] : [])];
    const currentState = request.current_state !== undefined && request.current_state.trim().length > 0
      ? bounded(request.current_state, 2000)
      : bounded(`task "${String(trajectory.task ?? request.task_id)}" — canonical outcome ${String(trajectory.outcome ?? 'unknown')}`, 2000);

    const envelope: WorkerHandoffEnvelopeT = {
      handoff_id: randomUUID(),
      state: 'CREATED',
      workspace_id: workspace,
      project_id: workflow && typeof workflow.project_id === 'string' ? workflow.project_id : null,
      task_id: request.task_id,
      workflow_id: workflow && typeof workflow.workflow_id === 'string' ? workflow.workflow_id : null,
      stage_id: workflow && typeof workflow.stage === 'string' ? workflow.stage : null,
      from: request.from,
      to: request.to,
      objective: request.objective,
      current_state: currentState,
      worker_claims: workerClaims,
      verified_facts: verifiedFacts.slice(0, 32),
      decisions: (request.decisions ?? []).slice(0, 16),
      assumptions: (request.assumptions ?? []).slice(0, 16),
      constraints: (request.constraints ?? []).slice(0, 16),
      open_questions: (request.open_questions ?? []).slice(0, 16),
      next_action: request.next_action,
      artifacts,
      files_or_components: artifacts.map(artifact => artifact.path).filter(file => file.length > 0).slice(0, 64),
      evidence_refs: evidenceRefs,
      verification_refs: derived.verificationRef !== null ? [derived.verificationRef] : [],
      memory_refs: ['.aide/memory/sessions.jsonl'],
      failure_context: request.failure_context ?? null,
      created_at: now(),
      accepted_at: null,
      consumed_at: null,
      supersedes: request.supersedes ?? [],
      related: request.related ?? []
    };
    await writeEnvelope(envelope);
    return envelope;
  }

  function sameDescriptor(a: WorkerDescriptorT, b: WorkerDescriptorT): boolean {
    return a.worker === b.worker && a.provider === b.provider && a.model === b.model && a.role === b.role;
  }

  async function accept(id: string, to: WorkerDescriptorT): Promise<WorkerHandoffEnvelopeT> {
    const envelope = await readEnvelope(id);
    if (!sameDescriptor(envelope.to, to)) {
      throw new WorkerHandoffError('CONFLICT', 'handoff destination does not match the accepting worker');
    }
    // Deterministic state rules: accept is idempotent for the intended
    // destination; consumed/cancelled/failed handoffs are terminal.
    if (envelope.state === 'ACCEPTED') return envelope;
    if (envelope.state !== 'CREATED') {
      throw new WorkerHandoffError('CONFLICT', `handoff ${id} is ${envelope.state} and cannot be accepted`);
    }
    // Referenced canonical state must exist at accept time; a handoff whose
    // task evidence vanished fails deterministically instead of half-working.
    try {
      await fs.access(path.join(workspace, '.aide', `trajectories/${envelope.task_id}.traj.json`));
    } catch {
      const failed: WorkerHandoffEnvelopeT = { ...envelope, state: 'FAILED' };
      await writeEnvelope(failed);
      throw new WorkerHandoffError('CONFLICT', `handoff ${id} references missing task state (${envelope.task_id})`);
    }
    const accepted: WorkerHandoffEnvelopeT = { ...envelope, state: 'ACCEPTED', accepted_at: now() };
    await writeEnvelope(accepted);
    return accepted;
  }

  async function consume(id: string): Promise<WorkerHandoffEnvelopeT> {
    const envelope = await readEnvelope(id);
    if (envelope.state === 'CONSUMED') {
      throw new WorkerHandoffError('CONFLICT', `handoff ${id} is already consumed`);
    }
    if (envelope.state !== 'ACCEPTED') {
      throw new WorkerHandoffError('CONFLICT', `handoff ${id} is ${envelope.state}; accept it before consuming`);
    }
    const consumed: WorkerHandoffEnvelopeT = { ...envelope, state: 'CONSUMED', consumed_at: now() };
    await writeEnvelope(consumed);
    return consumed;
  }

  async function cancel(id: string): Promise<WorkerHandoffEnvelopeT> {
    const envelope = await readEnvelope(id);
    if (envelope.state === 'CANCELLED') return envelope;
    if (envelope.state !== 'CREATED' && envelope.state !== 'ACCEPTED') {
      throw new WorkerHandoffError('CONFLICT', `handoff ${id} is ${envelope.state} and cannot be cancelled`);
    }
    const cancelled: WorkerHandoffEnvelopeT = { ...envelope, state: 'CANCELLED' };
    await writeEnvelope(cancelled);
    return cancelled;
  }

  async function list(taskId?: string): Promise<WorkerHandoffEnvelopeT[]> {
    const entries = await fs.readdir(dir).catch(() => [] as string[]);
    const handoffs: WorkerHandoffEnvelopeT[] = [];
    for (const entry of entries) {
      if (!entry.endsWith('.json')) continue;
      const id = entry.slice(0, -'.json'.length);
      try {
        const envelope = await readEnvelope(id);
        if (taskId === undefined || envelope.task_id === taskId) handoffs.push(envelope);
      } catch {
        // A corrupt file is reported through get(); list stays usable.
      }
    }
    handoffs.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    return handoffs;
  }

  // Bounded reconstruction for the receiving worker. Priority order per the
  // release contract: live task truth -> verified canonical facts -> handoff ->
  // workflow state -> selected memory refs -> artifacts/evidence refs. Never
  // concatenates a raw transcript.
  async function contextBlock(id: string): Promise<{ handoff: WorkerHandoffEnvelopeT; context_block: string; approx_tokens: number }> {
    const handoff = await readEnvelope(id);
    const lines: string[] = [];
    const push = (line: string): void => {
      if (lines.join('\n').length + line.length + 1 > CONTEXT_MAX_CHARS) return;
      lines.push(line);
    };
    push(`[WORKER HANDOFF ${handoff.handoff_id} · ${handoff.state} · ${handoff.from.role}(${handoff.from.worker}) -> ${handoff.to.role}(${handoff.to.worker})]`);
    push(`objective: ${handoff.objective}`);
    push(`next action: ${handoff.next_action}`);
    push(`current state: ${handoff.current_state}`);
    if (handoff.stage_id !== null) push(`workflow stage: ${handoff.stage_id}${handoff.project_id !== null ? ` · project ${handoff.project_id}` : ''}`);
    if (handoff.verified_facts.length > 0) {
      push('verified facts:');
      for (const fact of handoff.verified_facts) push(`- ${fact}`);
    }
    if (handoff.decisions.length > 0) {
      push('decisions:');
      for (const decision of handoff.decisions) push(`- ${decision}`);
    }
    if (handoff.assumptions.length > 0) {
      push('assumptions:');
      for (const assumption of handoff.assumptions) push(`- ${assumption}`);
    }
    if (handoff.constraints.length > 0) {
      push('constraints:');
      for (const constraint of handoff.constraints) push(`- ${constraint}`);
    }
    if (handoff.open_questions.length > 0) {
      push('open questions:');
      for (const question of handoff.open_questions) push(`- ${question}`);
    }
    if (handoff.worker_claims.length > 0) push(`worker claims (unverified): ${handoff.worker_claims.join(' | ')}`);
    if (handoff.artifacts.length > 0) {
      push('artifact references:');
      for (const artifact of handoff.artifacts) push(`- ${artifact.type} ${artifact.path} (${artifact.stage}) sha256:${artifact.sha256.slice(0, 12)}`);
    }
    if (handoff.evidence_refs.length > 0) push(`evidence refs: ${handoff.evidence_refs.join(', ')}`);
    if (handoff.memory_refs.length > 0) push(`memory refs: ${handoff.memory_refs.join(', ')}`);
    if (handoff.failure_context !== null) {
      push(`failure context: ${handoff.failure_context.classification} · side effects ${handoff.failure_context.side_effects} · retryable ${handoff.failure_context.retryable ? 'yes' : 'no'}`);
    }
    push('[END HANDOFF]');
    const context_block = lines.join('\n');
    return { handoff, context_block, approx_tokens: Math.round(context_block.length / 4) };
  }

  return Object.freeze({ create, accept, consume, cancel, list, get: readEnvelope, contextBlock });
}
