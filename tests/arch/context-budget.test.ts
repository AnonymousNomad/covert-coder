// tests/arch/context-budget.test.ts
// Context economics: every injected block is accounted for per source, totals
// are labeled EXACT or ESTIMATED (never an estimate presented as exact), a
// source breakdown never double counts, and anti-drift fires on CONVERSATION
// domination — not on methodology injections (the 2026-09-19 false positive).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createChatContextComposer } from '../../node/src/services/chat-context.ts';
import { ChatResponse } from '../../common/contracts/chat.ts';

function fakeRuntime(overrides: Record<string, unknown> = {}) {
  return {
    refreshServedContext: async () => undefined,
    getEffectiveContext: () => 2048,
    ...overrides
  } as Parameters<typeof createChatContextComposer>[0]['runtime'];
}

interface Budget {
  input_tokens: number;
  input_measurement: string;
  sources: Array<{ source: string; tokens: number; entries: number; measurement: string }>;
  double_count_ok: boolean;
  generation_reserve_tokens: number;
  reasoning_reserve_tokens: number | null;
}

test('short prompts with rich methodology are accounted for and do not trigger drift', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'aide-budget-'));
  try {
    const composer = createChatContextComposer({
      workspace,
      runtime: fakeRuntime(),
      providers: {
        resident: async () => 'resident observation: workspace is quiet',
        skills: async () => `SKILL CONTEXT ${'procedure '.repeat(400)}`
      }
    });
    const result = await composer.compose({
      modelId: 'stub', messages: [{ role: 'user', content: 'hello world' }], harness: true
    } as never);
    const harness = result.harness as Record<string, unknown>;
    assert.equal(harness.injected, true);
    assert.equal(harness.drift_reinjected, false, 'methodology injections must not be mistaken for conversation domination');
    const budget = harness.context_budget as Budget;
    assert.ok(budget, 'a structured context budget is reported');
    assert.equal(budget.input_measurement, 'ESTIMATED');
    assert.equal(budget.reasoning_reserve_tokens, null, 'reasoning reserve is UNKNOWN, not fabricated');
    const sources = budget.sources.map(source => source.source);
    assert.ok(sources.includes('SYSTEM_SCAFFOLD'));
    assert.ok(sources.includes('SKILL_CONTEXT'));
    assert.ok(sources.includes('RESIDENT'));
    assert.ok(sources.includes('USER_REQUEST'));
    const sum = budget.sources.reduce((total, source) => total + source.tokens, 0);
    const estimated = harness.approx_prompt_tokens as number;
    assert.ok(Math.abs(sum - estimated) <= Math.max(16, Math.ceil(estimated * 0.05)), `source sum ${sum} must match total ${estimated}`);
    assert.equal(budget.double_count_ok, true);
    assert.ok((harness.served_context_tokens as number) > 0);
    // The harness metadata must satisfy the ChatResponse contract; a composer
    // addition that the response schema rejects would 500 the whole chat route.
    const responseParsed = ChatResponse.safeParse({ text: 'ok', modelId: 'stub', harness });
    assert.equal(responseParsed.success, true, responseParsed.success ? '' : JSON.stringify(responseParsed.error.issues.slice(0, 3)));
  } finally {
    await fs.rm(workspace, { recursive: true, force: true });
  }
});

test('the engine tokenizer replaces the estimate exactly when available', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'aide-budget-exact-'));
  try {
    const composer = createChatContextComposer({
      workspace,
      runtime: fakeRuntime({ measurePromptTokens: async () => 1234 })
    });
    const result = await composer.compose({
      modelId: 'stub', messages: [{ role: 'user', content: 'measure me' }], harness: true
    } as never);
    const harness = result.harness as Record<string, unknown>;
    const budget = harness.context_budget as Budget;
    assert.equal(budget.input_measurement, 'EXACT');
    assert.equal(budget.input_tokens, 1234);
    assert.equal(harness.exact_prompt_tokens, 1234);
    assert.notEqual(harness.approx_prompt_tokens, 1234, 'the estimate remains visible alongside the exact count');
  } finally {
    await fs.rm(workspace, { recursive: true, force: true });
  }
});

test('long conversations still receive anti-drift reinforcement', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'aide-budget-drift-'));
  try {
    const composer = createChatContextComposer({ workspace, runtime: fakeRuntime() });
    const messages = [];
    for (let index = 0; index < 30; index++) {
      messages.push({ role: 'user', content: `question ${index} ${'x'.repeat(220)}` });
      messages.push({ role: 'assistant', content: `answer ${index} ${'y'.repeat(220)}` });
    }
    messages.push({ role: 'user', content: 'final question' });
    const result = await composer.compose({ modelId: 'stub', messages, harness: true } as never);
    const harness = result.harness as Record<string, unknown>;
    assert.equal(harness.drift_reinjected, true, 'conversation domination must keep the protection');
    const budget = harness.context_budget as Budget;
    assert.ok(budget.sources.some(source => source.source === 'DRIFT_REMINDER'));
    assert.ok(budget.sources.some(source => source.source === 'CONVERSATION_HISTORY'));
  } finally {
    await fs.rm(workspace, { recursive: true, force: true });
  }
});

test('harness-disabled requests carry no budget and no injection', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'aide-budget-off-'));
  try {
    const composer = createChatContextComposer({ workspace, runtime: fakeRuntime() });
    const result = await composer.compose({
      modelId: 'stub', messages: [{ role: 'user', content: 'no harness' }], harness: false
    } as never);
    const harness = result.harness as Record<string, unknown>;
    assert.equal(harness.injected, false);
    assert.equal(harness.context_budget, undefined);
  } finally {
    await fs.rm(workspace, { recursive: true, force: true });
  }
});
