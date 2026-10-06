import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DEFAULT_CIPHER_MODE, resolveCipherDispatch } from '../../browser/src/cockpit/interaction-mode.ts';

test('Cipher defaults to ASK and keeps the direct conversation path separate', () => {
  assert.equal(DEFAULT_CIPHER_MODE, 'ask');
  assert.deepEqual(resolveCipherDispatch('ask'), { path: 'chat', mode: 'ask' });
});

test('Cipher PLAN uses the governed read-only Planner role', () => {
  assert.deepEqual(resolveCipherDispatch('plan'), { path: 'agent', mode: 'plan', role: 'planner' });
});

test('Cipher ACT uses the governed Coder role', () => {
  assert.deepEqual(resolveCipherDispatch('act'), { path: 'agent', mode: 'act', role: 'coder' });
});

test('Cipher keeps one composer while routing ASK, governed roles, and typed AgentLoop events to their owners', () => {
  const chat = readFileSync(new URL('../../browser/src/chat/chat.ts', import.meta.url), 'utf8');
  const resident = readFileSync(new URL('../../browser/src/cockpit/ResidentCore.ts', import.meta.url), 'utf8');

  assert.match(chat, /resolveCipherDispatch\(mode\)/);
  assert.match(chat, /api\.chatStream\(modelId, history, controller\.signal\)/);
  assert.match(chat, /onGovernedSubmit\(dispatch\.mode, content\)/);
  assert.match(chat, /\.chat-mode-button/);
  assert.match(resident, /residentWorkerForSelection\(view, dispatch\.role\)/);
  assert.match(resident, /mode: dispatch\.mode, role: dispatch\.role/);
  assert.match(resident, /getSharedEvents\(\)\?\.subscribe\('agent'/);
  assert.match(resident, /AgentStreamEvent\.safeParse\(raw\)/);
  assert.match(resident, /projection\?\.sessionId === event\.session_id/);
  assert.doesNotMatch(resident, /connectEvents\(/, 'Cipher must reuse the cockpit EventHub instead of opening another event bus');
  assert.doesNotMatch(resident, /cockpit-resident-input/, 'PLAN and ACT must use the ASK composer rather than a second textarea');
});
