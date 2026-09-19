import { test } from 'node:test';
import assert from 'node:assert/strict';
import { translateError } from '../../browser/src/ui/toast.ts';

test('translateError maps envelope codes to user messages', () => {
  assert.equal(translateError('NOT_READY', 'still warming up'), 'Still warming up: still warming up');
  assert.equal(translateError('PAYLOAD_TOO_LARGE', 'too big'), 'File too large to open: too big');
  assert.equal(translateError('FORBIDDEN', 'denied'), 'Access denied: denied');
});

test('translateError falls back to the daemon message for unknown codes', () => {
  assert.equal(translateError('MYSTERY', 'weird daemon thing'), 'weird daemon thing');
});

test('translateError appends the daemon detail for INTERNAL and CHILD_FAILED', () => {
  assert.equal(translateError('INTERNAL', 'model: start this model before chatting'), 'Daemon error: model: start this model before chatting');
  assert.equal(translateError('CHILD_FAILED', 'language server crashed'), 'Background process failed: language server crashed');
  assert.equal(translateError('NOT_READY', 'runtime unavailable'), 'Still warming up: runtime unavailable', 'known codes retain actionable detail');
});

test('informational walkthrough and setup messages are not errors', () => {
  assert.equal(translateError('INFO', 'Walkthrough skipped.'), 'Walkthrough skipped.');
  assert.equal(translateError('OK', 'Profile applied.'), 'Profile applied.');
  assert.equal(translateError('BAD_REQUEST', 'Setup answers are invalid.'), 'Invalid request: Setup answers are invalid.');
});
