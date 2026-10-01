import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixtureFailureDescription } from './authority-fixture.ts';

test('fixture failure diagnostics identify audit versus approval conflicts without serializing material', () => {
  const secret = 'fixture-secret-canary-do-not-expose';
  const receipt = fixtureFailureDescription({ ok: false, data: { token: secret }, error: {
    code: 'NOT_READY', message: `authorization audit was not durably recorded ${secret}`, detail: { proof: secret }
  } });
  assert.deepEqual(JSON.parse(receipt), { error_code: 'NOT_READY', reason_family: 'AUDIT_PERSISTENCE' });
  assert.equal(receipt.includes(secret), false);
  assert.deepEqual(JSON.parse(fixtureFailureDescription({ error: { code: 'CONFLICT', message: 'operation changed after approval' } })),
    { error_code: 'CONFLICT', reason_family: 'OPERATION_CHANGED' });
});

test('fixture failure diagnostics keep malformed codes and unbounded arbitrary errors out of logs', () => {
  for (const envelope of [null, {}, { data: { token: 'fixture-secret-canary' } },
    { error: { code: 'fixture-secret-canary', message: 'fixture-secret-canary'.repeat(500) } }]) {
    assert.deepEqual(JSON.parse(fixtureFailureDescription(envelope)), { error_code: 'UNKNOWN', reason_family: 'UNKNOWN' });
  }
});
