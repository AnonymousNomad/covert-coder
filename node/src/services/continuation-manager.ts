// Governed failure-continuation manager (Wave 6). Persists canonical failure
// records and per-task continuation chains, applies the deterministic policy,
// and creates the continuation handoff through the ACCEPTED Wave-3/4 contract.
// It never starts sessions itself (the existing /api/agent/start + handoff path
// does), never grants authority, and never promotes failed claims to facts.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  CONTINUATION_BUDGET,
  type ContinuationChainT,
  type ContinuationPlanRequestT,
  type ContinuationPlanResponseT
} from '../../../common/contracts/continuation.ts';
import { classifyFailure, decideContinuation, isRetryEligible, type FailureEvidence } from './continuation-policy.ts';
import type { WorkerHandoffEnvelopeT, WorkerDescriptorT } from '../../../common/contracts/worker-handoff.ts';

export type ContinuationErrorCode = 'INVALID' | 'NOT_FOUND' | 'CONFLICT';

export class ContinuationError extends Error {
  readonly code: ContinuationErrorCode;
  constructor(code: ContinuationErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

type HandoffService = {
  create(request: {
    task_id: string;
    from: WorkerDescriptorT;
    to: WorkerDescriptorT;
    objective: string;
    next_action: string;
    failure_context: {
      classification: string;
      last_successful_stage: string | null;
      side_effects: 'none' | 'partial' | 'unknown' | 'complete';
      retryable: boolean;
      recommended_continuation: string | null;
    };
  }): Promise<WorkerHandoffEnvelopeT>;
};

export interface ContinuationManagerOptions {
  workspace: string;
  handoffService: HandoffService;
  policy: {
    providerConsent(): boolean;
    localOnly(): boolean;
  };
  now?: () => string;
}

type FailureRecord = {
  session_id: string;
  chain_id: string;
  failure_class: string;
  error_summary: string;
  failed_at: string;
  decision: string;
  replacement: WorkerDescriptorT | null;
};

export function createContinuationManager(options: ContinuationManagerOptions) {
  const workspace = options.workspace;
  const handoffService = options.handoffService;
  const policy = options.policy;
  const now = options.now ?? (() => new Date().toISOString());
  const root = path.join(workspace, '.aide', 'continuations');
  const chainsDir = path.join(root, 'chains');
  const failuresDir = path.join(root, 'failures');

  async function writeJson(target: string, value: unknown): Promise<void> {
    await fs.mkdir(path.dirname(target), { recursive: true });
    const temp = `${target}.tmp`;
    const handle = await fs.open(temp, 'w');
    try {
      await handle.writeFile(JSON.stringify(value, null, 2), 'utf8');
      await handle.sync();
    } finally {
      await handle.close();
    }
    await fs.rename(temp, target);
  }

  async function readJson<T>(target: string): Promise<T | null> {
    try {
      return JSON.parse(await fs.readFile(target, 'utf8')) as T;
    } catch {
      return null;
    }
  }

  function chainPath(chainId: string): string {
    return path.join(chainsDir, `${chainId}.json`);
  }

  function failurePath(sessionId: string): string {
    return path.join(failuresDir, `${sessionId}.json`);
  }

  type Evidence = {
    evidence: FailureEvidence;
    task: string;
    lastSuccessfulStage: string | null;
    safeError: string;
  };

  async function readFailureEvidence(sessionId: string): Promise<Evidence> {
    const trajectory = await readJson<{ task?: string; outcome?: string; error?: string | null; tool_log?: Array<{ tool?: string; ok?: boolean }> }>(
      path.join(workspace, '.aide', 'trajectories', `${sessionId}.traj.json`)
    );
    if (trajectory === null) {
      throw new ContinuationError('NOT_FOUND', `session ${sessionId} has no canonical trajectory; failure cannot be classified`);
    }
    const verification = await readJson<{ verification?: { passed?: boolean; state?: string } }>(
      path.join(workspace, '.aide', 'verifications', `${sessionId}.verification.json`)
    );
    const outcome = typeof trajectory.outcome === 'string' ? trajectory.outcome : null;
    const error = typeof trajectory.error === 'string' && trajectory.error.length > 0 ? trajectory.error : null;
    const verificationPassed = verification?.verification?.passed === true;
    const verificationState = typeof verification?.verification?.state === 'string' ? verification.verification.state : null;
    const safeError = (error ?? (outcome === 'aborted' ? 'session aborted by operator' : 'session ended without verification')).slice(0, 400);
    const okTools = (trajectory.tool_log ?? []).filter(entry => entry.ok === true);
    const lastSuccessfulStage = okTools.length > 0 ? String(okTools[okTools.length - 1]!.tool ?? 'tool') : null;
    return {
      evidence: { outcome, error, verificationPassed, verificationState },
      task: typeof trajectory.task === 'string' ? trajectory.task : sessionId,
      lastSuccessfulStage,
      safeError
    };
  }

  function sameWorker(a: WorkerDescriptorT, b: WorkerDescriptorT): boolean {
    return a.provider === b.provider && a.model === b.model && a.role === b.role;
  }

  async function plan(request: ContinuationPlanRequestT): Promise<ContinuationPlanResponseT> {
    const priorFailure = await readJson<FailureRecord>(failurePath(request.failed_session_id));
    if (priorFailure !== null) {
      throw new ContinuationError('CONFLICT', `failure for session ${request.failed_session_id} was already continued (chain ${priorFailure.chain_id})`);
    }
    const { evidence, lastSuccessfulStage, safeError } = await readFailureEvidence(request.failed_session_id);
    const failureClass = classifyFailure(evidence);

    let chain: ContinuationChainT;
    let failedWorker: WorkerDescriptorT;
    if (request.chain_id !== undefined) {
      const loaded = await readJson<ContinuationChainT>(chainPath(request.chain_id));
      if (loaded === null) throw new ContinuationError('NOT_FOUND', `continuation chain ${request.chain_id} not found`);
      chain = loaded;
      if (chain.state === 'terminal') throw new ContinuationError('CONFLICT', 'continuation chain is terminal');
      if (chain.last_replacement === null) throw new ContinuationError('CONFLICT', 'chain has no recorded replacement to fail from');
      failedWorker = chain.last_replacement;
      if (request.failed_worker !== undefined && !sameWorker(request.failed_worker, failedWorker)) {
        throw new ContinuationError('CONFLICT', 'failed worker does not match the chain replacement');
      }
    } else {
      if (request.failed_worker === undefined) {
        throw new ContinuationError('INVALID', 'first continuation requires the failed worker descriptor');
      }
      failedWorker = request.failed_worker;
      chain = {
        chain_id: randomUUID(),
        root_task_id: request.failed_session_id,
        state: 'open',
        attempts: [],
        retry_count: 0,
        replacement_count: 0,
        last_replacement: null,
        pending_handoff_id: null,
        last_decision: null,
        terminal_reason: null,
        created_at: now(),
        updated_at: now()
      };
    }

    const verdict = decideContinuation({
      failureClass,
      replacementsUsed: chain.replacement_count,
      sameWorkerRetriesUsed: chain.retry_count,
      replacement: request.replacement,
      failedWorker,
      providerConsent: policy.providerConsent(),
      localOnly: policy.localOnly()
    });

    const attempts = [...chain.attempts, {
      attempt: chain.attempts.length + 1,
      session_id: request.failed_session_id,
      worker: failedWorker,
      failure_class: failureClass,
      error_summary: safeError,
      failed_at: now()
    }];

    let handoffId: string | null = null;
    if (verdict.decision === 'switch') {
      const handoff = await handoffService.create({
        task_id: request.failed_session_id,
        from: failedWorker,
        to: request.replacement,
        objective: `continue ${chain.root_task_id} after ${failureClass}`,
        next_action: 'resume the task from canonical state; do not replay effects already present',
        failure_context: {
          classification: failureClass,
          last_successful_stage: lastSuccessfulStage,
          side_effects: 'unknown',
          retryable: isRetryEligible(failureClass),
          recommended_continuation: verdict.reason
        }
      });
      handoffId = handoff.handoff_id;
    }

    const updated: ContinuationChainT = {
      ...chain,
      state: verdict.decision === 'terminal' ? 'terminal' : verdict.decision === 'switch' ? 'continued' : 'open',
      attempts,
      retry_count: chain.retry_count + (verdict.decision === 'retry' ? 1 : 0),
      replacement_count: chain.replacement_count + (verdict.decision === 'switch' ? 1 : 0),
      last_replacement: verdict.decision === 'switch' ? request.replacement : chain.last_replacement,
      pending_handoff_id: handoffId,
      last_decision: verdict.decision,
      terminal_reason: verdict.decision === 'terminal' ? verdict.reason : null,
      updated_at: now()
    };
    await writeJson(chainPath(updated.chain_id), updated);

    const record: FailureRecord = {
      session_id: request.failed_session_id,
      chain_id: updated.chain_id,
      failure_class: failureClass,
      error_summary: safeError,
      failed_at: now(),
      decision: verdict.decision,
      replacement: verdict.decision === 'switch' ? request.replacement : null
    };
    await writeJson(failurePath(request.failed_session_id), record);

    return {
      chain_id: updated.chain_id,
      decision: verdict.decision,
      failure_class: failureClass,
      attempt: attempts.length,
      replacements_remaining: Math.max(0, CONTINUATION_BUDGET.maxReplacements - updated.replacement_count),
      retry_eligible: isRetryEligible(failureClass) && updated.retry_count < CONTINUATION_BUDGET.sameWorkerRetries,
      handoff_id: handoffId,
      replacement: verdict.decision === 'switch' ? request.replacement : null,
      reason: verdict.reason
    };
  }

  async function getChain(chainId: string): Promise<ContinuationChainT> {
    const chain = await readJson<ContinuationChainT>(chainPath(chainId));
    if (chain === null) throw new ContinuationError('NOT_FOUND', `continuation chain ${chainId} not found`);
    return chain;
  }

  async function listChains(taskId?: string): Promise<ContinuationChainT[]> {
    const entries = await fs.readdir(chainsDir).catch(() => [] as string[]);
    const chains: ContinuationChainT[] = [];
    for (const entry of entries) {
      if (!entry.endsWith('.json')) continue;
      const chain = await readJson<ContinuationChainT>(chainPath(entry.slice(0, -'.json'.length)));
      if (chain === null) continue;
      if (taskId === undefined || chain.root_task_id === taskId || chain.attempts.some(attempt => attempt.session_id === taskId)) chains.push(chain);
    }
    return chains;
  }

  return Object.freeze({ plan, getChain, listChains });
}
