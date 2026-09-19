export interface VeritasOutcome {
  status: 'VERIFIED' | 'FAILED' | 'ABSTAINED' | 'NOT_CONTRACTED';
  task_class: string | null;
  contract_ref: string | null;
  failed_checks: string[];
  evidence_refs: string[];
}

export function veritasOutcomeFor(input: {
  contract?: { task_class?: string; label?: string; require_tests?: boolean } | null;
  evaluation?: {
    passed?: boolean;
    checks?: Array<{ type: string; passed: boolean }>;
    executed_commands?: number;
    tests_passed?: number;
    tests_failed?: number;
  } | null;
  evidenceRefs?: string[];
}): VeritasOutcome;
