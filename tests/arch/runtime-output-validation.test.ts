import { test } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { validateSingleRuntimeToolCall, validateStructuredOutput } from '../../node/src/services/runtime-output-validation.ts';

const rangeSchema = z.object({
  minimum: z.number().int(),
  maximum: z.number().int(),
  status: z.enum(['ok', 'needs_review'])
}).strict();

const readSchema = z.object({ path: z.string().min(1).max(128) }).strict();

test('structured output rejects empty, malformed, trailing prose, missing, and extra fields', () => {
  for (const raw of ['', 'not-json', '{"minimum":2} trailing prose', '{"minimum":2,"maximum":9,"status":"ok","extra":true}', '{"minimum":2,"maximum":9}']) {
    const result = validateStructuredOutput(raw, rangeSchema);
    assert.equal(result.accepted, false);
    assert.equal('value' in result, false);
  }
});

test('structured output accepts only a complete strict-schema value', () => {
  const result = validateStructuredOutput('{"minimum":2,"maximum":9,"status":"ok"}', rangeSchema);
  assert.deepEqual(result, { accepted: true, value: { minimum: 2, maximum: 9, status: 'ok' } });
});

test('structured output rejects non-string runtime values without coercion', () => {
  assert.deepEqual(validateStructuredOutput({ minimum: 2 }, rangeSchema), { accepted: false, reason: 'INVALID_TEXT' });
});

test('runtime tool call accepts exactly one named call with schema-valid JSON arguments', () => {
  const result = validateSingleRuntimeToolCall([{
    id: 'call-fixture', type: 'function',
    function: { name: 'workspace.read', arguments: '{"path":"runtime-fixture.txt"}' }
  }], 'workspace.read', readSchema);
  assert.deepEqual(result, {
    accepted: true, callId: 'call-fixture', name: 'workspace.read',
    arguments: { path: 'runtime-fixture.txt' }
  });
});

test('runtime tool call rejects malformed JSON before any executor is reachable', () => {
  const result = validateSingleRuntimeToolCall([{
    id: 'call-bad', type: 'function',
    function: { name: 'workspace.read', arguments: '{"path":' }
  }], 'workspace.read', readSchema);
  assert.deepEqual(result, { accepted: false, reason: 'INVALID_ARGUMENT_JSON' });
});

test('runtime tool call rejects wrong names, schema mismatches, and ambiguous multi-call envelopes', () => {
  const valid = { id: 'call-fixture', type: 'function', function: { name: 'workspace.read', arguments: '{"path":"a.txt"}' } };
  assert.deepEqual(validateSingleRuntimeToolCall([valid], 'workspace.write', readSchema), { accepted: false, reason: 'WRONG_NAME' });
  assert.deepEqual(validateSingleRuntimeToolCall([{ ...valid, function: { ...valid.function, arguments: '{"path":"a.txt","extra":1}' } }], 'workspace.read', readSchema), { accepted: false, reason: 'SCHEMA_MISMATCH' });
  assert.deepEqual(validateSingleRuntimeToolCall([valid, valid], 'workspace.read', readSchema), { accepted: false, reason: 'MULTIPLE_CALLS' });
  assert.deepEqual(validateSingleRuntimeToolCall([], 'workspace.read', readSchema), { accepted: false, reason: 'NO_CALL' });
});
