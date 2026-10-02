import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSetupValidation, setupValidationReady, REQUIRED_SETUP_CHECKS, type SetupCheck } from '../../browser/src/cockpit/setup-validation.ts';

const passed = (): SetupCheck[] => REQUIRED_SETUP_CHECKS.map(label => ({ label, status: 'PASSED', detail: 'observed' }));

test('not run and pending validation never establish readiness', () => {
  const validation = createSetupValidation();
  assert.equal(validation.snapshot().status, 'NOT_RUN');
  assert.equal(setupValidationReady(validation.snapshot()), false);
  validation.begin();
  assert.equal(validation.snapshot().status, 'RUNNING');
  assert.equal(setupValidationReady(validation.snapshot()), false);
});
test('all required completed checks pass; optional provider absence does not assert cloud availability', () => {
  const validation = createSetupValidation();
  validation.complete(validation.begin(), [...passed(), { label: 'providers', status: 'UNAVAILABLE', detail: 'optional status unavailable' }]);
  assert.equal(setupValidationReady(validation.snapshot()), true);
});
for (const status of ['FAILED', 'UNAVAILABLE'] as const) {
  test(`required ${status} result prevents readiness`, () => {
    const validation = createSetupValidation();
    const checks = passed(); checks[0] = { label: 'daemon', status, detail: 'not healthy' };
    validation.complete(validation.begin(), checks);
    assert.equal(validation.snapshot().status, status);
    assert.equal(setupValidationReady(validation.snapshot()), false);
  });
}
test('empty, incomplete and ambiguous duplicate results cannot pass', () => {
  for (const checks of [[], passed().slice(1), [...passed(), passed()[0]!]]) {
    const validation = createSetupValidation();
    validation.complete(validation.begin(), checks);
    assert.equal(validation.snapshot().status, 'UNAVAILABLE');
    assert.equal(setupValidationReady(validation.snapshot()), false);
  }
});
test('previous success is revoked at rerun start and cannot survive a new failure', () => {
  const validation = createSetupValidation();
  validation.complete(validation.begin(), passed());
  assert.equal(setupValidationReady(validation.snapshot()), true);
  const rerun = validation.begin();
  assert.equal(setupValidationReady(validation.snapshot()), false);
  validation.complete(rerun, [{ label: 'daemon', status: 'FAILED', detail: 'stopped' }]);
  assert.equal(setupValidationReady(validation.snapshot()), false);
});
test('navigation/close invalidation rejects abandoned or out of order completions', () => {
  const validation = createSetupValidation();
  const abandoned = validation.begin(); validation.invalidate();
  assert.equal(validation.complete(abandoned, passed()), false);
  const old = validation.begin(); const current = validation.begin();
  assert.equal(validation.complete(old, passed()), false);
  validation.complete(current, [{ label: 'daemon', status: 'UNAVAILABLE', detail: 'offline' }]);
  assert.equal(validation.complete(old, passed()), false);
  assert.equal(setupValidationReady(validation.snapshot()), false);
});
test('mutating an observed snapshot cannot manufacture readiness', () => {
  const validation = createSetupValidation();
  validation.complete(validation.begin(), passed());
  validation.snapshot().checks[0]!.status = 'FAILED';
  assert.equal(setupValidationReady(validation.snapshot()), true);
  validation.invalidate();
  assert.equal(setupValidationReady(validation.snapshot()), false);
});
