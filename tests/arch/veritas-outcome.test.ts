// tests/arch/veritas-outcome.test.ts
// Veritas-backed performance: a worker's claim of completion is never
// converted into verified success. NOT_CONTRACTED / FAILED / ABSTAINED /
// VERIFIED are derived from deterministic execution evidence through the
// existing Veritas gates.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { veritasOutcomeFor } from '../../harness/lab/veritas-outcome.mjs';

const passingEvaluation = {
  passed: true,
  checks: [
    { type: 'regex', passed: true },
    { type: 'exec_fenced_file', passed: true }
  ],
  executed_commands: 1,
  tests_passed: 1,
  tests_failed: 0
};

const failingEvaluation = {
  passed: false,
  checks: [
    { type: 'regex', passed: false },
    { type: 'exec_fenced_file', passed: false }
  ],
  executed_commands: 1,
  tests_passed: 0,
  tests_failed: 1
};

test('tasks without a contract are NOT_CONTRACTED', () => {
  const outcome = veritasOutcomeFor({ contract: null, evaluation: passingEvaluation });
  assert.equal(outcome.status, 'NOT_CONTRACTED');
  assert.equal(outcome.contract_ref, null);
});

test('passing deterministic evidence with executed tests is VERIFIED', () => {
  const outcome = veritasOutcomeFor({
    contract: { task_class: 'code-change', label: 'fixture', require_tests: true },
    evaluation: passingEvaluation
  });
  assert.equal(outcome.status, 'VERIFIED');
  assert.equal(outcome.contract_ref, 'fixture');
  assert.deepEqual(outcome.failed_checks, []);
});

test('failing deterministic evidence is FAILED, never a claim of success', () => {
  const outcome = veritasOutcomeFor({
    contract: { task_class: 'code-change', label: 'fixture', require_tests: true },
    evaluation: failingEvaluation
  });
  assert.equal(outcome.status, 'FAILED');
  assert.ok(outcome.failed_checks.includes('exec_fenced_file'));
});

test('passing checks without executed test evidence ABSTAINS (needs evidence)', () => {
  const outcome = veritasOutcomeFor({
    contract: { task_class: 'code-change', label: 'fixture', require_tests: true },
    evaluation: { ...passingEvaluation, executed_commands: 0, tests_passed: 0 }
  });
  assert.equal(outcome.status, 'ABSTAINED');
});

test('evidence references are carried through, not raw blobs', () => {
  const outcome = veritasOutcomeFor({
    contract: { task_class: 'code-change', label: 'fixture', require_tests: true },
    evaluation: passingEvaluation,
    evidenceRefs: ['runs/x/checks.json']
  });
  assert.deepEqual(outcome.evidence_refs, ['runs/x/checks.json']);
});
