import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ArchServer } from '../../node/src/server.ts';

const fixturePath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'server-signal-shutdown-fixture.mjs');

function listenerSnapshot(signal: 'SIGINT' | 'SIGTERM'): Function[] {
  return process.listeners(signal);
}

function closeListener(listener: Awaited<ReturnType<ArchServer['listen']>>): Promise<void> {
  listener.closeAllConnections();
  return new Promise((resolve, reject) => {
    listener.close(error => error ? reject(error) : resolve());
  });
}

async function runSignalFixture(signal: 'SIGINT' | 'SIGTERM'): Promise<{ exitCode: number | null; messages: unknown[]; stderr: string }> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'covert-server-signal-shutdown-'));
  const resolvedRoot = path.resolve(root);
  assert.equal(path.dirname(resolvedRoot), path.resolve(os.tmpdir()));
  assert.ok(path.basename(resolvedRoot).startsWith('covert-server-signal-shutdown-'));

  const child = fork(fixturePath, [signal, resolvedRoot], {
    cwd: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'),
    execArgv: [],
    stdio: ['ignore', 'ignore', 'pipe', 'ipc']
  });
  const stderr: string[] = [];
  child.stderr?.setEncoding('utf8');
  child.stderr?.on('data', chunk => stderr.push(String(chunk)));
  child.on('error', error => stderr.push(error.message));
  const messages: unknown[] = [];
  child.on('message', message => messages.push(message));
  const exited = new Promise<{ exitCode: number | null }>(resolve => {
    child.once('exit', exitCode => resolve({ exitCode }));
  });

  try {
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, 10_000);
    const { exitCode } = await exited;
    clearTimeout(timeout);
    assert.equal(timedOut, false, `${signal} shutdown callback did not finish within 10s`);
    return { exitCode, messages, stderr: stderr.join('') };
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill();
      await exited;
    }
    await fs.rm(resolvedRoot, { recursive: true, force: true });
  }
}

test('ArchServer releases only its own signal handlers across repeated and concurrent lifecycles', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'covert-server-signal-cleanup-'));
  t.after(async () => {
    for (const listener of openListeners) {
      if (listener.listening) await closeListener(listener);
    }
    assert.equal(path.dirname(path.resolve(root)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(root).startsWith('covert-server-signal-cleanup-'));
    await fs.rm(root, { recursive: true, force: true });
  });
  const openListeners: Array<Awaited<ReturnType<ArchServer['listen']>>> = [];
  const signals = ['SIGINT', 'SIGTERM'] as const;
  const baseline = new Map(signals.map(signal => [signal, listenerSnapshot(signal)]));

  async function start(id: string) {
    const instance = new ArchServer(root, path.join(root, `${id}.log`));
    const before = new Map(signals.map(signal => [signal, listenerSnapshot(signal)]));
    const listener = await instance.listen(0);
    openListeners.push(listener);
    const owned = new Map(signals.map(signal => [
      signal,
      listenerSnapshot(signal).filter(handler => !before.get(signal)?.includes(handler))
    ]));
    for (const signal of signals) assert.equal(owned.get(signal)?.length, 1, `${id} owns one ${signal} handler`);
    return { listener, owned };
  }

  for (let index = 0; index < 3; index += 1) {
    const instance = await start(`cycle-${index}`);
    await closeListener(instance.listener);
    for (const signal of signals) assert.deepEqual(listenerSnapshot(signal), baseline.get(signal));
  }

  const first = await start('concurrent-first');
  const second = await start('concurrent-second');
  for (const signal of signals) {
    assert.notEqual(first.owned.get(signal)?.[0], second.owned.get(signal)?.[0]);
  }

  await closeListener(first.listener);
  for (const signal of signals) {
    const afterFirstClose = listenerSnapshot(signal);
    assert.equal(afterFirstClose.includes(first.owned.get(signal)?.[0] as Function), false);
    assert.equal(afterFirstClose.includes(second.owned.get(signal)?.[0] as Function), true);
    assert.equal(afterFirstClose.length, (baseline.get(signal)?.length ?? 0) + 1);
  }

  await closeListener(second.listener);
  for (const signal of signals) assert.deepEqual(listenerSnapshot(signal), baseline.get(signal));
});

test('synthetic SIGINT and SIGTERM dispatch each reach canonical shutdown hooks in isolated children', async () => {
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    const result = await runSignalFixture(signal);
    assert.equal(result.exitCode, 0, `${signal} child exits successfully: ${result.stderr}`);
    const messages = result.messages as Array<Record<string, unknown>>;
    assert.equal(messages.filter(message => message.type === 'ready').length, 1);
    const completed = messages.filter(message => message.type === 'shutdown-hook');
    assert.equal(completed.length, 1, `${signal} runs one canonical shutdown hook`);
    const hook = completed[0];
    assert.ok(hook !== undefined, `${signal} shutdown hook is present`);
    assert.equal(hook.signal, signal);
    assert.deepEqual(hook.listenerCounts, hook.baselineCounts);
  }
});
