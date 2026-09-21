// Deterministic failure classification + continuation policy (Wave 6).
// Pure functions only: the manager persists and executes; this module decides.
import {
  CONTINUATION_BUDGET,
  type FailureClassT
} from '../../../common/contracts/continuation.ts';
import type { WorkerDescriptorT } from '../../../common/contracts/worker-handoff.ts';

export type FailureEvidence = {
  outcome: string | null;
  error: string | null;
  verificationPassed: boolean;
  verificationState: string | null;
};

export function classifyFailure(evidence: FailureEvidence): FailureClassT {
  const outcome = String(evidence.outcome ?? '');
  const error = String(evidence.error ?? '');
  if (outcome === 'aborted') return 'OPERATOR_STOP';
  if (outcome === 'done' && evidence.verificationPassed !== true) return 'VERIFICATION_FAILURE';
  // Order matters: specific signals before generic ones.
  if (/timed?\s*out|timeout|aborted due to timeout/i.test(error)) return 'TIMEOUT';
  if (/\[FORBIDDEN\]|not authorized|authority (denied|required)/i.test(error)) return 'AUTHORITY_DENIED';
  if (/cancell?ed|operator stop/i.test(error)) return 'CANCELLED';
  if (/handoff/i.test(error)) return 'HANDOFF_FAILURE';
  if (/context/i.test(error) && /fail|unavailable|error/i.test(error)) return 'CONTEXT_FAILURE';
  if (/refus(e|al|ed)|cannot comply|won'?t comply|will not comply/i.test(error)) return 'WORKER_REFUSAL';
  if (/not connected|provider .*HTTP\s*(4|5)|unreachable|ECONN|fetch failed|network|exited with code|process (failure|died)/i.test(error)) return 'PROVIDER_UNAVAILABLE';
  if (/no tool call|malformed steps|invalid response|empty response|unparseable/i.test(error)) return 'INVALID_OUTPUT';
  if (/engine|llama|runtime|no model is ready|route .*(is )?(down|unavailable)/i.test(error)) return 'LOCAL_RUNTIME_UNAVAILABLE';
  if (/transport|socket|stream/i.test(error)) return 'TRANSPORT_FAILURE';
  return 'INTERNAL_ERROR';
}

const RETRYABLE: ReadonlySet<FailureClassT> = new Set(['TIMEOUT', 'TRANSPORT_FAILURE']);
const SWITCHABLE: ReadonlySet<FailureClassT> = new Set([
  'TRANSPORT_FAILURE', 'PROVIDER_UNAVAILABLE', 'LOCAL_RUNTIME_UNAVAILABLE', 'TIMEOUT',
  'WORKER_REFUSAL', 'INVALID_OUTPUT', 'CONTEXT_FAILURE', 'HANDOFF_FAILURE', 'INTERNAL_ERROR'
]);
const TERMINAL: ReadonlySet<FailureClassT> = new Set([
  'AUTHORITY_DENIED', 'CANCELLED', 'OPERATOR_STOP', 'VERIFICATION_FAILURE'
]);

export function isRetryEligible(failureClass: FailureClassT): boolean {
  return RETRYABLE.has(failureClass);
}

export function isSwitchEligible(failureClass: FailureClassT): boolean {
  return SWITCHABLE.has(failureClass);
}

export function isTerminal(failureClass: FailureClassT): boolean {
  return TERMINAL.has(failureClass);
}

export type PolicyInputs = {
  failureClass: FailureClassT;
  replacementsUsed: number;
  sameWorkerRetriesUsed: number;
  replacement: WorkerDescriptorT;
  failedWorker: WorkerDescriptorT;
  providerConsent: boolean;
  localOnly: boolean;
};

export type PolicyVerdict =
  | { decision: 'retry'; reason: string }
  | { decision: 'switch'; reason: string }
  | { decision: 'terminal'; reason: string };

export function decideContinuation(input: PolicyInputs): PolicyVerdict {
  if (isTerminal(input.failureClass)) {
    const reason = input.failureClass === 'AUTHORITY_DENIED'
      ? 'authority denial is terminal; fallback never bypasses permission'
      : input.failureClass === 'VERIFICATION_FAILURE'
        ? 'verification failure requires the repair/review path, not an outage fallback'
        : 'operator stop/cancel is terminal; nothing continues automatically';
    return { decision: 'terminal', reason };
  }
  // Role preservation: a failure replacement keeps the required role.
  if (input.replacement.role !== input.failedWorker.role) {
    return { decision: 'terminal', reason: `replacement role ${input.replacement.role} does not preserve required role ${input.failedWorker.role}` };
  }
  // Network policy: failure never silently escapes local-only or consent.
  if (input.localOnly && input.replacement.provider !== 'local') {
    return { decision: 'terminal', reason: 'task is local-only; no eligible local replacement was selected (no provider egress attempted)' };
  }
  if (!input.providerConsent && input.replacement.provider !== 'local') {
    return { decision: 'terminal', reason: 'provider egress consent is disabled; refusing remote replacement' };
  }
  if (isRetryEligible(input.failureClass)
    && input.sameWorkerRetriesUsed < CONTINUATION_BUDGET.sameWorkerRetries
    && input.replacement.provider === input.failedWorker.provider
    && input.replacement.model === input.failedWorker.model
    && input.replacement.role === input.failedWorker.role) {
    return { decision: 'retry', reason: `bounded same-worker retry ${input.sameWorkerRetriesUsed + 1}/${CONTINUATION_BUDGET.sameWorkerRetries} for ${input.failureClass}` };
  }
  if (!isSwitchEligible(input.failureClass)) {
    return { decision: 'terminal', reason: `${input.failureClass} is not eligible for worker-switch continuation` };
  }
  if (input.replacementsUsed >= CONTINUATION_BUDGET.maxReplacements) {
    return { decision: 'terminal', reason: `replacement budget exhausted (${CONTINUATION_BUDGET.maxReplacements}); surfacing terminal failure` };
  }
  return { decision: 'switch', reason: `governed continuation to ${input.replacement.provider}:${input.replacement.model} (replacement ${input.replacementsUsed + 1}/${CONTINUATION_BUDGET.maxReplacements})` };
}
