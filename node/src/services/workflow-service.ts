// Workflow Service — deterministic Experience Engineering state management.
// Slices 4-6: state ownership, validator-backed gates, and rejection records.
// No model calls, no routes, no artifact content generation, no authority
// minting. The service owns exactly one durable object:
// <workspace>/.aide/workflow/state.json (single active workflow per workspace,
// v1). It may verify execution handles and apply mutations only inside an
// operator-approved execution callback; it never prepares, decides, delegates,
// or executes anything else.
//
// Gate pipeline (Slice 6): transition evaluation is validator-backed —
// state validation -> artifact validation (file existence, sha256, per-type
// content contract, dependency presence) -> Veritas evidence lookup ->
// authority execution -> audit emission -> state commit. The service owns the
// transition decision; the read-only validator owns artifact structural truth;
// Veritas owns execution evidence; the Execution Authority owns permission. An
// operator-approved execution can never bypass the deterministic gates: the
// gate is re-evaluated inside the approved callback, and a failed gate emits a
// 'rejected' workflow.transition row carrying the rejection reasons before the
// operation fails.
//
// Ordering (explicit decision): an applied transition is journaled to the
// audit spine BEFORE the new state is committed (write-ahead). If the audit
// row cannot be persisted, the state file is not written and the mutation is
// discarded — the spine can never fall behind durable state.
//
// Rebuild fidelity (explicit decision): the frozen workflow.transition event
// carries only artifact ids/types/digests, so a state rebuilt purely from
// audit rows reconstructs the progression skeleton (workflow_id, workspace,
// stage, previous_stage, revision, last_transition_id) — not full artifact ref
// bodies (paths/timestamps remain in state.json).
import { promises as fs } from 'node:fs';
import { randomBytes, randomUUID } from 'node:crypto';
import path from 'node:path';
import {
  WORKFLOW_PREDECESSOR,
  WORKFLOW_STATE_VERSION,
  WORKFLOW_SUCCESSOR,
  WorkflowStage,
  WorkflowState,
  WorkflowTransitionEvent,
  WorkflowTransitionRequest
} from '../../../common/contracts/workflow.ts';
import type {
  WorkflowArtifactRefT,
  WorkflowArtifactTypeT,
  WorkflowStageT,
  WorkflowStateT,
  WorkflowTransitionEventT,
  WorkflowTransitionRequestT
} from '../../../common/contracts/workflow.ts';
import type { AuditTrailService } from './audit-trail.mjs';
import type { ExecutionAuthority, ExecutionHandle } from './execution-authority.mjs';
import { inspectVeritasEvidence, validateArtifactRef } from './workflow-validators.ts';

export type WorkflowErrorCode = 'INVALID' | 'NOT_FOUND' | 'EXISTS' | 'CONFLICT' | 'GATE_UNSATISFIED' | 'CORRUPT' | 'AUDIT_FAILED';

export class WorkflowError extends Error {
  readonly code: WorkflowErrorCode;
  readonly detail: unknown;
  constructor(code: WorkflowErrorCode, message: string, detail: unknown = null) {
    super(message);
    this.name = 'WorkflowError';
    this.code = code;
    this.detail = detail;
  }
}

export interface WorkflowSkeleton {
  workflow_id: string;
  workspace: string;
  stage: WorkflowStageT;
  previous_stage: WorkflowStageT | null;
  revision: number;
  last_transition_id: string | null;
}

export interface BuildTransitionInput {
  to_stage: WorkflowStageT;
  kind: 'forward' | 'revision';
  reason?: string;
  requested_by: string;
  evidence: WorkflowArtifactRefT[];
}

export type BuildTransitionResult =
  | { ok: true; request: WorkflowTransitionRequestT }
  | { ok: false; failed: string[] };

export interface GateEvaluation {
  result: 'satisfied' | 'unsatisfied';
  failed: string[];
}

export interface WorkflowService {
  load(): Promise<WorkflowStateT | null>;
  create(execution: ExecutionHandle, payload: { project_id: string }): Promise<WorkflowStateT>;
  buildTransitionRequest(state: WorkflowStateT, input: BuildTransitionInput): BuildTransitionResult;
  evaluateTransition(state: WorkflowStateT, request: WorkflowTransitionRequestT): Promise<GateEvaluation>;
  applyTransition(execution: ExecutionHandle, request: WorkflowTransitionRequestT, options?: { actorId?: string }): Promise<WorkflowStateT>;
  rebuildFromAudit(workflowId?: string): Promise<WorkflowSkeleton | null>;
}

const STATE_RELATIVE = ['.aide', 'workflow', 'state.json'] as const;
const STAGE_ORDER: readonly WorkflowStageT[] = WorkflowStage.options;

// Outputs a stage must produce (and have validated) before the workflow can
// leave it — equivalently, the artifacts required to ENTER its successor.
const STAGE_OUTPUTS: Readonly<Record<WorkflowStageT, readonly WorkflowArtifactTypeT[]>> = Object.freeze({
  DISCOVERY: Object.freeze(['EXPERIENCE_BRIEF'] as const),
  ARCHITECTURE: Object.freeze(['EXPERIENCE_BLUEPRINT'] as const),
  DESIGN: Object.freeze(['VISUAL_SYSTEM', 'INTERACTION_PLAN'] as const),
  IMPLEMENTATION: Object.freeze(['IMPLEMENTATION_BLUEPRINT'] as const),
  VALIDATION: Object.freeze(['RELEASE_EVIDENCE'] as const),
  DEPLOYMENT: Object.freeze(['DEPLOYMENT_RECORD'] as const)
});

export function stageIndexOf(stage: WorkflowStageT): number {
  const index = STAGE_ORDER.indexOf(stage);
  if (index < 0) throw new WorkflowError('INVALID', `unknown stage: ${String(stage)}`);
  return index;
}

// Entry requirements: entering stage T requires the OUTPUTS of predecessor(T),
// present, validated and not stale. This is the single gating rule for both
// forward transitions (predecessor(T) is the stage being left) and revisions
// (the stage being re-entered). DISCOVERY has no predecessor: revising to
// DISCOVERY requires nothing to enter; its outputs must be re-produced (the
// revision staled them) before leaving again.
function entryRequiredOutputs(toStage: WorkflowStageT): readonly WorkflowArtifactTypeT[] {
  const index = stageIndexOf(toStage);
  const predecessor = index > 0 ? STAGE_ORDER[index - 1] : null;
  return predecessor === null || predecessor === undefined ? [] : STAGE_OUTPUTS[predecessor];
}

function candidateRank(candidate: WorkflowArtifactRefT, requiredStage: WorkflowStageT): number {
  if (candidate.verification_status === 'validated' && candidate.stage === requiredStage) return 0;
  if (candidate.verification_status === 'validated') return 1;
  return 2;
}

// Validator failure codes are normalized into the gate's rejection vocabulary:
// missing artifact, invalid artifact, stale artifact, checksum mismatch,
// failed dependency, missing/failed Veritas evidence.
function normalizeValidatorFailure(entry: string, type: WorkflowArtifactTypeT): string {
  if (entry === 'checksum_mismatch') return `checksum:${type}`;
  if (entry === 'file_missing') return `missing_file:${type}`;
  if (entry === 'file_unreadable') return `unreadable:${type}`;
  if (entry === 'path_escape') return `escape:${type}`;
  if (entry === 'content_not_json' || entry.startsWith('content_invalid:')) return `content:${type}`;
  if (entry === 'veritas_evidence_missing') return `veritas_missing:${type}`;
  if (entry === 'veritas_evidence_invalid') return `veritas_invalid:${type}`;
  const dependency = entry.match(/^(missing|stale|invalid|unvalidated|wrong_stage)_dependency:(.+)$/);
  if (dependency) return `dependency:${type}:${dependency[1] === 'unvalidated' ? 'invalid' : dependency[1]}:${dependency[2]}`;
  return entry;
}

// Pure state advancement: adopts evidence refs (dedupe by artifact_id, later
// wins), and on a revision marks every artifact produced at or after the
// re-entered stage as stale — those outputs must be re-produced/validated
// before the workflow can move forward again.
export function advanceState(state: WorkflowStateT, request: WorkflowTransitionRequestT, operationId: string, now: string): WorkflowStateT {
  const merged = new Map(state.artifacts.map(artifact => [artifact.artifact_id, artifact]));
  for (const ref of request.evidence) merged.set(ref.artifact_id, ref);
  let artifacts = [...merged.values()];
  if (request.kind === 'revision') {
    const boundary = stageIndexOf(request.to_stage);
    artifacts = artifacts.map(artifact => stageIndexOf(artifact.stage) >= boundary ? { ...artifact, verification_status: 'stale' as const } : artifact);
  }
  return {
    ...state,
    stage: request.to_stage,
    previous_stage: request.from_stage,
    revision: state.revision + 1,
    artifacts,
    last_transition_id: operationId,
    updated_at: now
  };
}

export function createWorkflowService(options: { workspace: string; authority: ExecutionAuthority; audit: AuditTrailService }): WorkflowService {
  if (!options || typeof options.workspace !== 'string' || !options.workspace) throw new TypeError('workspace is required');
  if (!options.authority || typeof options.authority.assertExecution !== 'function' || typeof options.authority.claimExecution !== 'function') {
    throw new TypeError('execution authority with assertExecution/claimExecution is required');
  }
  if (!options.audit || typeof options.audit.emitWorkflowTransition !== 'function' || typeof options.audit.readEvents !== 'function') {
    throw new TypeError('audit trail with emitWorkflowTransition/readEvents is required');
  }
  const workspace = options.workspace;
  const authority = options.authority;
  const audit = options.audit;
  const stateFile = path.join(workspace, ...STATE_RELATIVE);

  async function load(): Promise<WorkflowStateT | null> {
    let raw: string;
    try {
      raw = await fs.readFile(stateFile, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      throw new WorkflowError('CORRUPT', 'workflow state is not valid JSON');
    }
    const parsed = WorkflowState.safeParse(json);
    if (!parsed.success) {
      throw new WorkflowError('CORRUPT', 'workflow state failed contract validation', parsed.error.issues.map(issue => `${issue.path.join('.') || '$'}: ${issue.message}`));
    }
    if (parsed.data.workspace !== workspace) {
      throw new WorkflowError('CORRUPT', 'workflow state belongs to another workspace');
    }
    return parsed.data;
  }

  async function writeState(next: WorkflowStateT): Promise<void> {
    const directory = path.dirname(stateFile);
    await fs.mkdir(directory, { recursive: true });
    const temp = path.join(directory, `.state-${process.pid}-${randomBytes(6).toString('hex')}.tmp`);
    let handle;
    try {
      handle = await fs.open(temp, 'wx');
      await handle.writeFile(JSON.stringify(next, null, 2), 'utf8');
      await handle.sync();
      await handle.close();
      handle = null;
      await fs.rename(temp, stateFile);
    } catch (error) {
      if (handle) await handle.close().catch(() => {});
      await fs.rm(temp, { force: true }).catch(() => {});
      throw error;
    }
  }

  async function currentOrThrow(): Promise<WorkflowStateT> {
    const state = await load();
    if (state === null) throw new WorkflowError('NOT_FOUND', 'no workflow exists in this workspace');
    return state;
  }

  // Validator-backed gate evaluation. State checks first; then, for every
  // artifact required to enter the target stage, the best candidate from state
  // plus request evidence must pass the read-only validator (existence, sha256,
  // content contract, dependencies) and — for RELEASE_EVIDENCE — the Veritas
  // evidence record must resolve and must not indicate execution failure.
  async function evaluateTransition(state: WorkflowStateT, request: WorkflowTransitionRequestT): Promise<GateEvaluation> {
    const failed: string[] = [];
    if (request.workflow_id !== state.workflow_id) failed.push('workflow_mismatch');
    if (request.from_stage !== state.stage) failed.push('stage_conflict');
    if (request.kind === 'forward' && WORKFLOW_SUCCESSOR[request.from_stage] !== request.to_stage) failed.push('invalid_forward');
    if (request.kind === 'revision' && WORKFLOW_PREDECESSOR[request.from_stage] !== request.to_stage) failed.push('invalid_revision');
    const pool: WorkflowArtifactRefT[] = [...state.artifacts, ...request.evidence];
    const index = stageIndexOf(request.to_stage);
    const requiredStage = index > 0 ? STAGE_ORDER[index - 1]! : request.to_stage;
    for (const type of entryRequiredOutputs(request.to_stage)) {
      const candidates = pool
        .filter(candidate => candidate.artifact_type === type)
        .sort((a, b) => candidateRank(a, requiredStage) - candidateRank(b, requiredStage));
      if (candidates.length === 0) {
        failed.push(`missing:${type}`);
        continue;
      }
      let satisfied = false;
      let reason: string | null = null;
      for (const candidate of candidates) {
        if (candidate.stage !== requiredStage) { reason ??= `wrong_stage:${type}`; continue; }
        if (candidate.verification_status === 'stale') { reason ??= `stale:${type}`; continue; }
        if (candidate.verification_status === 'invalid') { reason ??= `invalid:${type}`; continue; }
        const outcome = await validateArtifactRef(candidate, { workspace, refs: pool });
        if (outcome.result !== 'satisfied') {
          reason ??= normalizeValidatorFailure(outcome.failed[0] ?? `invalid:${type}`, type);
          continue;
        }
        if (type === 'RELEASE_EVIDENCE') {
          const inspection = await inspectVeritasEvidence(workspace, candidate);
          if (!inspection.found) { reason ??= `veritas_missing:${type}`; continue; }
          if (inspection.failed) { reason ??= `veritas_failed:${type}`; continue; }
        }
        satisfied = true;
        break;
      }
      if (!satisfied) failed.push(reason ?? `invalid:${type}`);
    }
    return { result: failed.length === 0 ? 'satisfied' : 'unsatisfied', failed };
  }

  function eventRow(state: WorkflowStateT, request: WorkflowTransitionRequestT, operationId: string, now: string, actorId: string | null) {
    return {
      type: 'workflow.transition' as const,
      ts: now,
      workspace,
      workflow_id: state.workflow_id,
      sequence: state.revision,
      from_stage: request.from_stage,
      to_stage: request.to_stage,
      kind: request.kind,
      status: 'applied' as const,
      reason: request.reason ?? null,
      operation_id: operationId,
      actor_id: actorId,
      gate: { result: 'satisfied' as const, failed: [] as string[] },
      evidence: request.evidence.map(ref => ({ artifact_id: ref.artifact_id, artifact_type: ref.artifact_type, sha256: ref.sha256 })),
      error: null
    };
  }

  // Rejection row: the deterministic gate blocked an otherwise-approved
  // transition. sequence is the attempted transition ordinal (revision + 1);
  // operation_id cross-references the approved authority operation that was
  // refused by the gate, so the audit shows both the permission and the block.
  function rejectionRow(state: WorkflowStateT, request: WorkflowTransitionRequestT, operationId: string, now: string, actorId: string | null, failed: string[]) {
    return {
      type: 'workflow.transition' as const,
      ts: now,
      workspace,
      workflow_id: state.workflow_id,
      sequence: state.revision + 1,
      from_stage: request.from_stage,
      to_stage: request.to_stage,
      kind: request.kind,
      status: 'rejected' as const,
      reason: request.reason ?? null,
      operation_id: operationId,
      actor_id: actorId,
      gate: { result: 'unsatisfied' as const, failed },
      evidence: request.evidence.map(ref => ({ artifact_id: ref.artifact_id, artifact_type: ref.artifact_type, sha256: ref.sha256 })),
      error: `deterministic gate rejected: ${failed.join(', ')}`.slice(0, 500)
    };
  }

  return {
    load,
    buildTransitionRequest(state, input) {
      const candidate: Record<string, unknown> = {
        workflow_id: state.workflow_id,
        from_stage: state.stage,
        to_stage: input.to_stage,
        kind: input.kind,
        requested_by: input.requested_by,
        evidence: input.evidence
      };
      if (input.reason !== undefined) candidate.reason = input.reason;
      const parsed = WorkflowTransitionRequest.safeParse(candidate);
      if (!parsed.success) {
        return { ok: false, failed: parsed.error.issues.map(issue => `${issue.path.join('.') || '$'}: ${issue.message}`) };
      }
      return { ok: true, request: parsed.data };
    },
    evaluateTransition,
    async create(execution, payload) {
      authority.assertExecution(execution, 'workflow.create', payload);
      authority.claimExecution(execution, 'workflow.create', payload);
      if (typeof payload?.project_id !== 'string' || payload.project_id.length < 1 || payload.project_id.length > 128) {
        throw new WorkflowError('INVALID', 'project_id must be a non-empty string of at most 128 characters');
      }
      const existing = await load();
      if (existing !== null) throw new WorkflowError('EXISTS', 'a workflow already exists in this workspace');
      const now = new Date().toISOString();
      const state = WorkflowState.parse({
        version: WORKFLOW_STATE_VERSION,
        workflow_id: randomUUID(),
        workspace,
        project_id: payload.project_id,
        stage: 'DISCOVERY' as const,
        previous_stage: null,
        revision: 0,
        artifacts: [],
        last_transition_id: null,
        created_at: now,
        updated_at: now
      }) as WorkflowStateT;
      await writeState(state);
      return state;
    },
    async applyTransition(execution, request, options = {}) {
      authority.assertExecution(execution, 'workflow.transition', request);
      authority.claimExecution(execution, 'workflow.transition', request);
      const state = await currentOrThrow();
      if (request.workflow_id !== state.workflow_id) throw new WorkflowError('CONFLICT', 'transition belongs to another workflow');
      if (request.from_stage !== state.stage) throw new WorkflowError('CONFLICT', 'workflow moved since this transition was requested');
      const now = new Date().toISOString();
      const gate = await evaluateTransition(state, request);
      if (gate.result !== 'satisfied') {
        const emitted = await audit.emitWorkflowTransition(rejectionRow(state, request, execution.operation_id, now, options.actorId ?? null, gate.failed));
        if (emitted.persisted !== true) {
          throw new WorkflowError('AUDIT_FAILED', `rejection row was not persisted: ${emitted.error ?? 'unknown error'}`, { failed: gate.failed });
        }
        throw new WorkflowError('GATE_UNSATISFIED', 'transition gate is not satisfied', gate.failed);
      }
      const next = advanceState(state, request, execution.operation_id, now);
      const emitted = await audit.emitWorkflowTransition(eventRow(next, request, execution.operation_id, now, options.actorId ?? null));
      if (emitted.persisted !== true) {
        throw new WorkflowError('AUDIT_FAILED', `workflow.transition row was not persisted: ${emitted.error ?? 'unknown error'}`);
      }
      await writeState(next);
      return next;
    },
    async rebuildFromAudit(workflowId) {
      const rows = await audit.readEvents({ type: 'workflow.transition', limit: 2000 });
      const applied: WorkflowTransitionEventT[] = [];
      for (const row of rows) {
        const event = { ...row };
        delete event.at;
        const parsed = WorkflowTransitionEvent.safeParse(event);
        if (!parsed.success) throw new WorkflowError('CORRUPT', 'audit row failed workflow.transition validation', parsed.error.issues.map(issue => `${issue.path.join('.') || '$'}: ${issue.message}`));
        if (parsed.data.status !== 'applied') continue;
        if (parsed.data.workspace !== workspace) continue;
        if (workflowId !== undefined && parsed.data.workflow_id !== workflowId) continue;
        applied.push(parsed.data);
      }
      if (applied.length === 0) return null;
      applied.sort((a, b) => a.sequence - b.sequence);
      const last = applied[applied.length - 1]!;
      return {
        workflow_id: last.workflow_id,
        workspace: last.workspace,
        stage: last.to_stage,
        previous_stage: last.from_stage,
        revision: last.sequence,
        last_transition_id: last.operation_id
      };
    }
  };
}
