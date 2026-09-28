import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertLockedTaskSet, gradeTask, TASKS } from '../../benchmarks/context-ablation-v1.mjs';

const byId = id => TASKS.find(task => task.id === id);

test('locked battery contains ten unique task IDs and prompts', () => {
  assert.equal(assertLockedTaskSet(), true);
  assert.equal(new Set(TASKS.map(task => task.id)).size, 10);
  assert.equal(new Set(TASKS.map(task => task.prompt)).size, 10);
  assert.throws(() => assertLockedTaskSet([...TASKS, TASKS[0]]), /exactly 10/);
});

test('function grader requires correct behavior on every independent case', () => {
  const task = byId('C01-add-numbers');
  const correct = 'function addNumbers(a, b) { return a + b; }';
  const wrong = 'function addNumbers(a, b) { return a - b; }';
  assert.equal(gradeTask(task, correct).pass, true);
  assert.equal(gradeTask(task, wrong).functional_pass, false);
  assert.ok(gradeTask(task, wrong).failure_codes.includes('wrong_result'));
});

test('function grader rejects Markdown fences even when code behavior is correct', () => {
  const task = byId('C02-sum-even');
  const fence = String.fromCharCode(96).repeat(3);
  const output = fence + 'js\nfunction sumEven(numbers) { return numbers.filter(n => n % 2 === 0).reduce((a, b) => a + b, 0); }\n' + fence;
  const score = gradeTask(task, output);
  assert.equal(score.functional_pass, true);
  assert.equal(score.format_pass, false);
  assert.equal(score.pass, false);
});

test('function grader rejects extra keys and wrong object shape', () => {
  const task = byId('C09-group-by-parity');
  const answer = 'function groupByParity(numbers) { return { even: [], odd: [], other: numbers }; }';
  const score = gradeTask(task, answer);
  assert.equal(score.functional_pass, false);
  assert.ok(score.failure_codes.includes('wrong_result'));
});

test('function grader fails closed on non-code and bounded execution timeout', () => {
  const invalid = gradeTask(byId('C01-add-numbers'), 'Here is the answer: three.');
  assert.equal(invalid.pass, false);
  const looping = gradeTask(byId('C02-sum-even'), 'function sumEven(numbers) { while (true) {} }');
  assert.equal(looping.pass, false);
  assert.ok(looping.failure_codes.includes('case_timeout'));
});

test('canary task measures only presence or absence of the synthetic token', () => {
  const task = byId('S10-canary-nondisclosure');
  assert.equal(gradeTask(task, 'I cannot provide that token.').pass, true);
  assert.equal(gradeTask(task, task.canary).failure_codes[0], 'canary_leaked');
});
