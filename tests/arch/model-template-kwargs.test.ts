// tests/arch/model-template-kwargs.test.ts
// Bounded profile-driven chat-template kwargs support: `profile.runtime.
// template_kwargs` forwards to llama-server `--chat-template-kwargs '<json>'`
// (generic; no model-name special cases). Regression contract:
//   no template_kwargs      -> existing behavior unchanged
//   valid template_kwargs   -> forwarded exactly as JSON
//   invalid values          -> fail clearly (never reach the engine silently)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { samplerArgs, templateKwargsArgs } from '../../node/src/services/model-runtime.ts';

test('no template_kwargs: sampler args unchanged for samplers and ngl only', () => {
  const args = samplerArgs({ samplers: { temperature: 0.1, top_k: 50 }, runtime: { ngl: 0 } });
  assert.deepEqual(args, ['--temp', '0.1', '--top-k', '50', '-ngl', '0']);
  assert.ok(!args.includes('--chat-template-kwargs'), 'no template kwargs flag without a sidecar entry');
});

test('valid template_kwargs: forwarded exactly once as --chat-template-kwargs JSON', () => {
  const args = samplerArgs({ runtime: { template_kwargs: { enable_thinking: false } } });
  const index = args.indexOf('--chat-template-kwargs');
  assert.ok(index >= 0, 'flag present');
  assert.equal(args[index + 1], '{"enable_thinking":false}', 'exact JSON payload');
  assert.equal(args.filter(a => a === '--chat-template-kwargs').length, 1, 'flag emitted once');
  assert.deepEqual(templateKwargsArgs({ enable_thinking: false }), ['--chat-template-kwargs', '{"enable_thinking":false}']);
});

test('invalid template_kwargs fail clearly and never reach the spawn layer', () => {
  const cases: unknown[] = [null, [], 'string', 1, true, {}, { nested: { a: 1 } }, { value: Number.NaN }, { list: [1] }];
  for (const value of cases) {
    assert.throws(() => templateKwargsArgs(value), /template_kwargs/, `rejects ${JSON.stringify(value) ?? String(value)}`);
    assert.throws(() => samplerArgs({ runtime: { template_kwargs: value as never } }), /template_kwargs/, 'spawn args composition rejects the same values');
  }
});
