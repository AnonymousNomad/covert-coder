// Harness Lab — Veritas-backed performance classification.
//
// Deterministic fixture checks remain the base layer. When a task declares a
// valid Veritas verification contract, the observation additionally carries a
// Veritas outcome: a worker's claim of completion is NEVER converted into
// verified success — that status requires deterministic execution evidence that
// passes the existing Veritas gates.
import { evaluateExecution } from '../veritas.mjs';

export function veritasOutcomeFor({ contract, evaluation, evidenceRefs = [] } = {}) {
  if (contract === null || contract === undefined) {
    return { status: 'NOT_CONTRACTED', task_class: null, contract_ref: null, failed_checks: [], evidence_refs: [] };
  }
  const taskClass = contract.task_class ?? 'code-change';
  const contractRef = contract.label ?? `${taskClass}:${contract.require_tests === true ? 'tests' : 'checks'}`;
  const checks = { 'fixture-checks': evaluation?.passed === true };
  if (contract.require_tests === true) {
    checks.tests = (evaluation?.executed_commands ?? 0) > 0 && (evaluation?.tests_failed ?? 1) === 0 && (evaluation?.tests_passed ?? 0) > 0;
  }
  let veritas;
  try {
    veritas = evaluateExecution({ taskClass, execution: { passed: evaluation?.passed === true, checks } });
  } catch {
    return { status: 'ABSTAINED', task_class: taskClass, contract_ref: contractRef, failed_checks: ['veritas-evaluation-error'], evidence_refs: evidenceRefs };
  }
  if (evaluation?.passed !== true) {
    const failedChecks = evaluation?.checks?.filter(check => !check.passed).map(check => check.type) ?? [];
    return {
      status: 'FAILED',
      task_class: taskClass,
      contract_ref: contractRef,
      failed_checks: failedChecks.length > 0 ? failedChecks : veritas.failed_checks,
      evidence_refs: evidenceRefs
    };
  }
  if (veritas.passed === true) {
    return { status: 'VERIFIED', task_class: taskClass, contract_ref: contractRef, failed_checks: [], evidence_refs: evidenceRefs };
  }
  return {
    status: 'ABSTAINED',
    task_class: taskClass,
    contract_ref: contractRef,
    failed_checks: veritas.failed_checks,
    evidence_refs: evidenceRefs
  };
}
