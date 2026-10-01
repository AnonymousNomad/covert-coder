import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough, Writable } from 'node:stream';
import { spawn, type ChildProcess } from 'node:child_process';
import { LspManager } from '../../node/src/services/lsp.ts';
import { encodeJsonRpc, JsonRpcDecoder } from '../../node/src/services/jsonrpc.ts';

// Controlled service-unit children, never OS processes or runtime proof. These
// isolate exit confirmation and status semantics; real LSP tests remain required.
class ControlledChild extends EventEmitter {
  readonly stdout = new PassThrough();
  readonly stderr = new PassThrough();
  readonly stdin: Writable;
  readonly signals: string[] = [];
  exitCode: number | null = null;
  signalCode: string | null = null;
  private readonly behavior: 'cooperative' | 'kill' | 'unconfirmed' | 'exit-only';

  constructor(behavior: 'cooperative' | 'kill' | 'unconfirmed' | 'exit-only') {
    super();
    this.behavior = behavior;
    const decoder = new JsonRpcDecoder();
    this.stdin = new Writable({ write: (chunk, _encoding, done) => {
      for (const value of decoder.push(chunk)) {
        const message = value as { id?: number; method?: string };
        if (message.id !== undefined) {
          queueMicrotask(() => this.stdout.write(encodeJsonRpc({ jsonrpc: '2.0', id: message.id, result: {} })));
        } else if (message.method === 'exit' && this.behavior === 'exit-only') {
          queueMicrotask(() => this.reportExit(0));
        } else if (message.method === 'exit' && this.behavior === 'cooperative') {
          queueMicrotask(() => this.finish(0));
        }
      }
      done();
    } });
  }

  kill(signal: string): boolean {
    this.signals.push(signal);
    if (this.behavior === 'kill') queueMicrotask(() => this.finish(null, signal));
    return true; // A successful kill request alone must never prove exit.
  }

  reportExit(code: number | null, signal: string | null = null): void {
    this.exitCode = code;
    this.signalCode = signal;
    this.emit('exit', code, signal);
  }

  finish(code: number | null, signal: string | null = null): void {
    this.reportExit(code, signal);
    this.stdin.destroy();
    this.stdout.destroy();
    this.stderr.destroy();
    this.emit('close', code, signal);
  }
}

function fixture(behavior: 'cooperative' | 'kill' | 'unconfirmed' | 'exit-only') {
  const child = new ControlledChild(behavior);
  const statuses: string[] = [];
  const manager = new LspManager({
    command: process.execPath,
    workspace: process.cwd(),
    spawnChild: (() => child as unknown as ChildProcess) as typeof spawn,
    onStatusChange: (_language, status) => statuses.push(status)
  });
  return { child, manager, statuses };
}

test('LSP cooperative stop publishes stopped only after exit, without a false error', async () => {
  const { child, manager, statuses } = fixture('cooperative');
  await manager.start('typescript');
  await manager.stop('typescript');
  assert.equal(child.exitCode, 0);
  assert.deepEqual(child.signals, [], 'a confirmed graceful exit needs no kill');
  assert.deepEqual(statuses, ['starting', 'running', 'stopped']);
});

test('LSP confirmed signal exit requires no second kill and remains a healthy stop', async () => {
  const { child, manager, statuses } = fixture('kill');
  await manager.start('typescript');
  await manager.stop('typescript');
  assert.equal(child.signalCode, 'SIGTERM');
  assert.deepEqual(child.signals, ['SIGTERM'], 'signalCode confirms exit even when exitCode is null');
  assert.deepEqual(statuses, ['starting', 'running', 'stopped']);
});

test('LSP unconfirmed kill cannot publish stopped or preserve feature readiness', async () => {
  const { child, manager, statuses } = fixture('unconfirmed');
  try {
    await manager.start('typescript');
    await manager.didOpen('file:///lsp-stop-probe.ts', 'typescript', 'export const value = 1;');
    await assert.rejects(manager.stop('typescript'), /owned language server exit unconfirmed/);
    assert.deepEqual(child.signals, ['SIGTERM', 'SIGKILL']);
    assert.equal(statuses.at(-1), 'error');
    assert.equal(statuses.includes('stopped'), false);
    await assert.rejects(manager.completion('file:///lsp-stop-probe.ts', { line: 0, character: 0 }), /not ready/);
    await assert.rejects(manager.start('typescript'), /cleanup is unconfirmed/, 'cannot replace an unconfirmed retained child');
    assert.equal(child.listenerCount('close'), 1, 'timed-out wait listeners are removed; only the ownership tracker remains');
  } finally {
    child.finish(0); // End the unit fixture; this is not an OS cleanup receipt.
  }
});

test('LSP concurrent start cannot overlap a retained child shutdown', async () => {
  const { child, manager, statuses } = fixture('cooperative');
  await manager.start('typescript');
  const stopping = manager.stop('typescript');
  await assert.rejects(manager.start('typescript'), /is stopping/);
  await stopping;
  assert.equal(child.exitCode, 0);
  assert.deepEqual(statuses, ['starting', 'running', 'stopped']);
});

test('LSP exit without stdio closure cannot report stopped or signal a departed child', async () => {
  const { child, manager, statuses } = fixture('exit-only');
  try {
    await manager.start('typescript');
    await assert.rejects(manager.stop('typescript'), /owned language server exit unconfirmed/);
    assert.equal(child.exitCode, 0, 'process exit is known, but close has not occurred');
    assert.deepEqual(child.signals, [], 'never signal a departed child while waiting for stdio closure');
    assert.equal(statuses.at(-1), 'error');
    assert.equal(statuses.includes('stopped'), false);
    await assert.rejects(manager.start('typescript'), /cleanup is unconfirmed/);
    assert.equal(child.listenerCount('close'), 1, 'bounded wait listeners have all drained');
  } finally {
    child.finish(0);
  }
});

test('LSP unexpected child exit still publishes error and clears feature readiness', async () => {
  const { child, manager, statuses } = fixture('unconfirmed');
  await manager.start('typescript');
  await manager.didOpen('file:///lsp-crash-probe.ts', 'typescript', 'export const value = 1;');
  child.finish(1);
  assert.equal(statuses.at(-1), 'error');
  await assert.rejects(manager.completion('file:///lsp-crash-probe.ts', { line: 0, character: 0 }), /not ready/);
});
