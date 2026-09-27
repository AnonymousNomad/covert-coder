import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseVersion } from '../src/version.mjs';

test('parses a three-part version', () => {
  assert.deepEqual(parseVersion('1.2.3'), { major: 1, minor: 2, patch: 3 });
});

test('parses multi-digit segments', () => {
  assert.deepEqual(parseVersion('10.200.3'), { major: 10, minor: 200, patch: 3 });
});

test('rejects non-semver strings', () => {
  assert.equal(parseVersion('1.2'), null);
  assert.equal(parseVersion('v1.2.3'), null);
  assert.equal(parseVersion('1.2.x'), null);
});
