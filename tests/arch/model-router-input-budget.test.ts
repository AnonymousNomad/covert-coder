import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ModelRuntime } from '../../node/src/services/model-runtime.ts';
import { ModelRouter, RouterError } from '../../node/src/services/model-router.ts';
import type { ProviderService } from '../../node/src/services/providers.ts';
import type { ChatMessageT } from '../../common/contracts/chat.ts';

// Real manifest loading, budget calculation and exact-bound Router dispatch.
// Only inference is controlled: no model process, endpoint or qualification.
async function fixture(t: TestContext, contextTokens = 1024) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'covert-input-budget-'));
  t.after(async () => {
    assert.equal(path.dirname(path.resolve(root)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(root).startsWith('covert-input-budget-'));
    await fs.rm(root, { recursive: true, force: true });
  });
  const id = 'controlled-budget';
  const manifestPath = path.join(root, 'manifest.json');
  await fs.writeFile(manifestPath, JSON.stringify({ models: [{ id, roles: ['chat'],
    endpoint: 'http://127.0.0.1:1/v1', context_tokens: contextTokens,
    artifact_uri: 'local://controlled.gguf', file: path.join(root, 'controlled.gguf'), model: 'controlled.gguf' }] }));
  const runtime = new ModelRuntime({ workspace: root, manifestPath,
    ingestedPath: path.join(root, 'ingested.json'), modelDir: root });
  await runtime.load({ sweepLegacyEngines: false });
  const calls: Array<Array<{ role: string; content: string }>> = [];
  runtime.chat = async (_id, messages) => {
    calls.push(structuredClone(messages));
    return { text: 'controlled response', modelId: id, timingMs: 1 };
  };
  runtime.chatStream = async (_id, messages, onDelta, signal) => {
    signal?.throwIfAborted();
    calls.push(structuredClone(messages));
    onDelta('controlled response');
  };
  const router = new ModelRouter(runtime, {} as ProviderService, []);
  const resolution = await router.resolveAuthorityTarget(`local:${id}`);
  assert.equal(resolution.status, 'RESOLVED');
  if (resolution.status !== 'RESOLVED') throw new Error('Controlled target unresolved');
  const target = resolution.target;
  const stream = (messages: ChatMessageT[], maxTokens?: number, signal = new AbortController().signal) =>
    router.chatStreamResolvedTarget(target, messages, () => {}, signal, { maxTokens });
  return { runtime, router, target, calls, stream, id };
}

test('exact-bound local stream preserves a small task with the default output reserve counted once', async t => {
  const f = await fixture(t);
  const messages: ChatMessageT[] = [{ role: 'user', content: 'Explain the bounded current task and preserve this instruction.' }];
  assert.equal(f.runtime.getEffectiveBudget(f.id, 512), 512);
  const result = await f.stream(messages);
  assert.deepEqual(f.calls, [messages]);
  assert.equal(result.usedApprox, 16);
  assert.equal(result.overflowTrimmed, undefined);
});

test('exact-bound one-shot local chat preserves a task at the full input-budget boundary', async t => {
  const f = await fixture(t);
  const messages: ChatMessageT[] = [{ role: 'user', content: 'b'.repeat(2048) }];
  const result = await f.router.chatResolvedTarget(f.target, messages);
  assert.deepEqual(f.calls, [messages]);
  assert.equal(result.usedApprox, 512);
  assert.equal(result.overflowTrimmed, undefined);
});

test('custom completion reserve is counted once by real Runtime and Router', async t => {
  const f = await fixture(t, 2048);
  const messages: ChatMessageT[] = [{ role: 'user', content: 'c'.repeat(1600) }];
  assert.equal(f.runtime.getEffectiveBudget(f.id, 1024), 1024);
  const result = await f.stream(messages, 1024);
  assert.deepEqual(f.calls, [messages]);
  assert.equal(result.usedApprox, 400);
  assert.equal(result.overflowTrimmed, undefined);
});

test('system and newest task that jointly fit retain every byte', async t => {
  const f = await fixture(t);
  const messages: ChatMessageT[] = [{ role: 'system', content: 's'.repeat(400) }, { role: 'user', content: 'u'.repeat(400) }];
  const result = await f.stream(messages);
  assert.deepEqual(f.calls, [messages]);
  assert.equal(result.usedApprox, 200);
  assert.equal(result.truncatedSystem, false);
});

test('oversized historical turn is dropped while the newest task remains intact', async t => {
  const f = await fixture(t);
  const newest: ChatMessageT = { role: 'user', content: 'Keep this exact current instruction.' };
  const result = await f.stream([{ role: 'user', content: 'old question' }, { role: 'assistant', content: 'a'.repeat(12000) }, newest]);
  assert.deepEqual(f.calls[0], [{ role: 'user', content: 'old question' }, newest]);
  assert.equal(result.dropped, 1);
  assert.equal(result.overflowTrimmed, undefined);
});

test('oversized newest turn retains the full available input-budget tail', async t => {
  const f = await fixture(t);
  const task = 'head' + 'z'.repeat(2048);
  const result = await f.stream([{ role: 'user', content: task }]);
  assert.deepEqual(f.calls[0], [{ role: 'user', content: task.slice(-2048) }]);
  assert.equal(result.usedApprox, 512);
  assert.equal(result.overflowTrimmed, true);
});

test('cancelled exact-bound dispatch stays cancelled with no controlled inference call', async t => {
  const f = await fixture(t);
  const controller = new AbortController();
  controller.abort(new Error('controlled cancellation'));
  await assert.rejects(() => f.stream([{ role: 'user', content: 'Keep this task.' }], undefined, controller.signal), /controlled cancellation/);
  assert.deepEqual(f.calls, []);
  await f.stream([{ role: 'user', content: 'Second task after cancellation.' }]);
  assert.deepEqual(f.calls, [[{ role: 'user', content: 'Second task after cancellation.' }]]);
});

test('completion reserve that exhausts a known window fails before dispatch', async t => {
  const f = await fixture(t);
  await assert.rejects(() => f.stream([{ role: 'user', content: 'Do not dispatch.' }], 1024),
    (error: unknown) => error instanceof RouterError && error.reason === 'context_overflow');
  assert.deepEqual(f.calls, []);
});

test('exhausted observed served window never falls back to a larger declared window', async t => {
  const f = await fixture(t, 8192);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ default_generation_settings: { n_ctx: 512 } }), { status: 200 });
  try {
    await f.runtime.refreshServedContext(f.id);
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(f.runtime.getEffectiveContext(f.id), 512);
  await assert.rejects(() => f.stream([{ role: 'user', content: 'Do not use the declared 8192 window.' }]),
    (error: unknown) => error instanceof RouterError && error.reason === 'context_overflow');
  assert.deepEqual(f.calls, []);
});

test('joint system and newest overflow is rejected rather than dispatched above the input budget', async t => {
  const f = await fixture(t);
  await assert.rejects(() => f.stream([{ role: 'system', content: 's'.repeat(1600) }, { role: 'user', content: 'u'.repeat(800) }]),
    (error: unknown) => error instanceof RouterError && error.reason === 'context_overflow');
  assert.deepEqual(f.calls, []);
});

test('full-budget system plus a small newest task cannot bypass the joint budget', async t => {
  const f = await fixture(t);
  await assert.rejects(() => f.stream([{ role: 'system', content: 's'.repeat(2048) }, { role: 'user', content: 'Keep this instruction.' }]),
    (error: unknown) => error instanceof RouterError && error.reason === 'context_overflow');
  assert.deepEqual(f.calls, []);
});
