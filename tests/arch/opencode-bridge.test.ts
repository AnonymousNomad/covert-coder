import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fixtureBridge, readLog } from './opencode-bridge-fixture.ts';

test('wrapped OpenCode events stream the requested model identity and delete its session', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'aide-opencode-stream-'));
  const { bridge, log } = await fixtureBridge(dir, 'wrapped');
  const deltas: string[] = [];
  try {
    const result = await bridge.runTaskStream({
      workspace: dir,
      prompt: 'bounded fixture task',
      providerID: 'opencode-go',
      modelID: 'deepseek-v4.1-flash',
      timeoutMs: 30000,
      onDelta: delta => deltas.push(delta)
    });
    assert.equal(result.text, 'streamed answer');
    assert.equal(result.session_id, 'ses_fixture');
    assert.deepEqual(deltas, ['streamed ', 'answer']);
    assert.equal(result.delegated_provider, 'opencode-go');
    assert.equal(result.delegated_model, 'deepseek-v4.1-flash');
    const events = await readLog(log);
    const prompt = events.find(item => item.event === 'prompt')?.body as { model?: { providerID?: string; modelID?: string } } | undefined;
    assert.deepEqual(prompt?.model, { providerID: 'opencode-go', modelID: 'deepseek-v4.1-flash' });
    assert.ok(events.some(item => item.event === 'delete'));
    assert.equal(events.some(item => item.event === 'abort'), false);
  } finally {
    await bridge.stop();
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('streamed OpenCode task cancellation aborts and deletes its session', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'aide-opencode-cancel-'));
  const { bridge, log } = await fixtureBridge(dir, 'cancel');
  const controller = new AbortController();
  try {
    await assert.rejects(
      () => bridge.runTaskStream({
        workspace: dir,
        prompt: 'bounded fixture task',
        providerID: 'opencode-go',
        modelID: 'deepseek-v4.1-flash',
        timeoutMs: 30000,
        signal: controller.signal,
        onDelta: () => controller.abort()
      }),
      (error: unknown) => (error as { code?: string })?.code === 'CANCELLED'
    );
    const events = await readLog(log);
    assert.ok(events.some(item => item.event === 'abort'));
    assert.ok(events.some(item => item.event === 'delete'));
  } finally {
    await bridge.stop();
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('OpenCode task timeout aborts and deletes its session', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'aide-opencode-timeout-'));
  const { bridge, log } = await fixtureBridge(dir, 'timeout');
  try {
    await assert.rejects(
      () => bridge.runTaskStream({
        workspace: dir,
        prompt: 'bounded fixture task',
        providerID: 'opencode-go',
        modelID: 'deepseek-v4.1-flash',
        timeoutMs: 5000,
        onDelta: () => undefined
      }),
      (error: unknown) => (error as { code?: string })?.code === 'TIMEOUT'
    );
    const events = await readLog(log);
    assert.ok(events.some(item => item.event === 'abort'), 'timeout aborts the active OpenCode session');
    assert.equal(events.filter(item => item.event === 'delete').length, 1, 'timeout cleanup deletes the session');
  } finally {
    await bridge.stop();
    await fs.rm(dir, { recursive: true, force: true });
  }
});
test('wrapped OpenCode events work and provider errors do not expose returned credentials or skip cleanup', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'aide-opencode-error-'));
  const { bridge, log } = await fixtureBridge(dir, 'provider-error');
  try {
    await assert.rejects(
      () => bridge.runTaskStream({
        workspace: dir,
        prompt: 'bounded fixture task',
        providerID: 'opencode-go',
        modelID: 'deepseek-v4.1-flash',
        timeoutMs: 30000,
        onDelta: () => undefined
      }),
      (error: unknown) => (error as { code?: string })?.code === 'CHILD_FAILED' && !String((error as Error).message).includes('credential sentinel')
    );
    const events = await readLog(log);
    assert.ok(events.some(item => item.event === 'abort'));
    assert.ok(events.some(item => item.event === 'delete'));
  } finally {
    await bridge.stop();
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('delegated provider identity mismatch fails closed and cleans the session', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'aide-opencode-mismatch-'));
  const { bridge, log } = await fixtureBridge(dir, 'mismatch');
  try {
    const deltas: string[] = [];
    await assert.rejects(
      () => bridge.runTaskStream({
        workspace: dir,
        prompt: 'bounded fixture task',
        providerID: 'opencode-go',
        modelID: 'deepseek-v4.1-flash',
        timeoutMs: 30000,
        onDelta: delta => deltas.push(delta)
      }),
      (error: unknown) => (error as { code?: string })?.code === 'TARGET_MISMATCH'
    );
    assert.deepEqual(deltas, [], 'a mismatched delegated identity is rejected before any assistant delta escapes');
    const events = await readLog(log);
    assert.ok(events.some(item => item.event === 'abort'));
    assert.ok(events.some(item => item.event === 'delete'));
  } finally {
    await bridge.stop();
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('non-stream entry point requires exact identity and uses the streaming lifecycle', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'aide-opencode-entrypoint-'));
  const { bridge, log } = await fixtureBridge(dir, 'success');
  try {
    await assert.rejects(
      () => bridge.runTask({ workspace: dir, prompt: 'missing target identity' }),
      (error: unknown) => (error as { code?: string })?.code === 'TARGET_MISMATCH'
    );
    const result = await bridge.runTask({
      workspace: dir,
      prompt: 'bounded fixture task',
      providerID: 'opencode-go',
      modelID: 'deepseek-v4.1-flash',
      timeoutMs: 30000
    });
    assert.equal(result.text, 'streamed answer');
    assert.equal(result.session_id, 'ses_fixture');
    assert.ok((await readLog(log)).some(item => item.event === 'delete'));
  } finally {
    await bridge.stop();
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('session deletion failure is reported and never converted into a successful result', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'aide-opencode-cleanup-'));
  const { bridge, log } = await fixtureBridge(dir, 'cleanup-fail');
  try {
    await assert.rejects(
      () => bridge.runTaskStream({
        workspace: dir,
        prompt: 'bounded fixture task',
        providerID: 'opencode-go',
        modelID: 'deepseek-v4.1-flash',
        timeoutMs: 30000,
        onDelta: () => undefined
      }),
      (error: unknown) => (error as { code?: string })?.code === 'CLEANUP_FAILED'
    );
    const events = await readLog(log);
    assert.ok(events.some(item => item.event === 'abort'));
    assert.equal(events.filter(item => item.event === 'delete').length, 2, 'failed cleanup is retried after abort and remains visible as failure');
  } finally {
    await bridge.stop();
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('exact model absent from the pinned provider catalog is rejected before session creation', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'aide-opencode-catalog-'));
  const { bridge, log } = await fixtureBridge(dir, 'catalog-missing');
  try {
    await assert.rejects(
      () => bridge.runTaskStream({
        workspace: dir,
        prompt: 'must not dispatch',
        providerID: 'opencode-go',
        modelID: 'deepseek-v4.1-flash',
        timeoutMs: 30000,
        onDelta: () => undefined
      }),
      (error: unknown) => (error as { code?: string })?.code === 'NOT_READY'
    );
    assert.deepEqual(await readLog(log), [], 'missing catalog target cannot create or prompt a session');
  } finally {
    await bridge.stop();
    await fs.rm(dir, { recursive: true, force: true });
  }
});
