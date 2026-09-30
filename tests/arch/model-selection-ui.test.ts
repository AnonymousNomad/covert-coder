import { test } from 'node:test';
import assert from 'node:assert/strict';
import { projectRoleTargetOptions, roleTargetKey } from '../../browser/src/byok/role-target-options.ts';
import { initialConversationRouteId, restoreConversationRouteId } from '../../browser/src/chat/model-selection.ts';

test('workspace role options expose multiple discovered Go models under one connection', () => {
  const options = projectRoleTargetOptions(
    [{ id: 'openrouter', name: 'OpenRouter', model_id: 'vendor/model' }],
    [{
      id: 'opencode-managed', provider_id: 'opencode', status: 'connected',
      access: { model_refs: [
        { provider_model_id: 'opencode-go/deepseek-v4.1-flash', model_support_state: 'unknown' },
        { provider_model_id: 'opencode-go/minimax-m2.5', model_support_state: 'unknown' }
      ] }
    }] as never,
    'local'
  );

  const openCodeOptions = options.filter(option => option.target !== 'local' && option.target.provider_id === 'opencode');
  assert.equal(openCodeOptions.length, 2);
  assert.deepEqual(openCodeOptions.map(option => option.target === 'local' ? '' : option.target.model_id).sort(), [
    'opencode-go/deepseek-v4.1-flash', 'opencode-go/minimax-m2.5'
  ]);
  assert.ok(openCodeOptions.every(option => option.label.startsWith('OpenCode Go · ') && option.label.includes('(UNKNOWN)')));
  assert.ok(openCodeOptions.every(option => !option.unavailable));
});

test('unavailable persisted role target is preserved and not replaced with Local', () => {
  const current = { provider_id: 'opencode', model_id: 'opencode-go/retired-model' } as const;
  const options = projectRoleTargetOptions(
    [{ id: 'openrouter', name: 'OpenRouter', model_id: 'vendor/model' }],
    [{
      id: 'opencode-managed', provider_id: 'opencode', status: 'configured_not_verified',
      access: { model_refs: [{ provider_model_id: current.model_id, model_support_state: 'unknown' }] }
    }] as never,
    current
  );

  const preserved = options.find(option => option.key === roleTargetKey(current));
  assert.ok(preserved);
  assert.equal(preserved.unavailable, true);
  assert.match(preserved.label, /not in the current catalog; preserved/);
  assert.equal(preserved.target === 'local' ? null : preserved.target.model_id, current.model_id);
});

test('ambiguous OpenCode provider/model identity is visible but cannot be selected', () => {
  const exactModel = 'opencode-go/deepseek-v4.1-flash';
  const options = projectRoleTargetOptions(
    [{ id: 'opencode', name: 'Custom API endpoint', model_id: exactModel }],
    [{
      id: 'opencode-managed', provider_id: 'opencode', status: 'connected',
      access: { model_refs: [{ provider_model_id: exactModel, model_support_state: 'unknown' }] }
    }] as never,
    'local'
  );

  const collision = options.find(option => option.key === roleTargetKey({ provider_id: 'opencode', model_id: exactModel }));
  assert.ok(collision);
  assert.equal(collision.unavailable, true);
  assert.match(collision.label, /Ambiguous provider\/model identity/);
});

test('new conversation uses the workspace act target or local route, never the first ready cloud route', () => {
  const routes = [
    { id: 'cloud:openai:gpt-x', providerType: 'cloud', status: 'ready' },
    { id: 'local:local-coder', providerType: 'local', status: 'unverified' }
  ] as const;
  assert.equal(initialConversationRouteId(routes, 'local'), 'local:local-coder');
  assert.equal(
    initialConversationRouteId(routes, { provider_id: 'opencode', model_id: 'opencode-go/deepseek-v4.1-flash' }),
    'cloud:opencode:opencode-go/deepseek-v4.1-flash'
  );
  assert.equal(initialConversationRouteId([{ ...routes[0], status: 'down' }], 'local'), '');
});

test('saved conversation route remains exact when its catalog entry disappears', () => {
  const saved = 'cloud:opencode:opencode-go/deepseek-v4.1-flash';
  assert.equal(restoreConversationRouteId(saved, [{ id: 'cloud:openai:gpt-x', providerType: 'cloud', status: 'ready' }]), saved);
  assert.equal(restoreConversationRouteId('legacy-model', [{ id: 'local:legacy-model', providerType: 'local', status: 'ready' }]), 'local:legacy-model');
});
