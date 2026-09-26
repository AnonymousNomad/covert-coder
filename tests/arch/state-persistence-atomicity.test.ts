import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { atomicWriteJson, AtomicJsonWriteError, StatePersistenceError, type AtomicJsonPhase } from '../../node/src/services/atomic-json.ts';
import { ChatStore } from '../../node/src/services/chat-store.ts';
import { SessionStore } from '../../node/src/services/session-store.ts';
import { routeForChatHistory } from '../../node/src/routes/chat.ts';

async function makeWorkspace(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

function tempNames(entries: string[], basename: string): string[] {
  return entries.filter(entry => entry.startsWith(`.${basename}.tmp-aide-`));
}

function injectedReplaceFailure(): typeof atomicWriteJson {
  return (target, value, options = {}) => atomicWriteJson(target, value, {
    ...options,
    testHooks: {
      ...options.testHooks,
      beforePhase: async phase => {
        if (phase === 'replace') throw Object.assign(new Error('injected replace failure'), { code: 'EACCES' });
        await options.testHooks?.beforePhase?.(phase);
      }
    }
  });
}

test('atomic JSON replacement writes a validated same-directory temporary then replaces existing state', async () => {
  const root = await makeWorkspace('c2-02-atomic-replace-');
  try {
    const target = path.join(root, 'session.json');
    await fs.writeFile(target, JSON.stringify({ version: 1, tabs: [], marker: 'old' }), 'utf8');
    let observedTempInTargetDirectory = false;
    await atomicWriteJson(target, { version: 1, tabs: [], marker: 'new' }, {
      validate: value => {
        assert.equal((value as { version?: number }).version, 1);
      },
      testHooks: {
        beforePhase: async phase => {
          if (phase !== 'replace') return;
          const entries = await fs.readdir(root);
          observedTempInTargetDirectory = tempNames(entries, 'session.json').length === 1;
          assert.equal(JSON.parse(await fs.readFile(target, 'utf8')).marker, 'old', 'canonical bytes remain old until replace');
        }
      }
    });
    assert.equal(observedTempInTargetDirectory, true);
    assert.deepEqual(JSON.parse(await fs.readFile(target, 'utf8')), { version: 1, tabs: [], marker: 'new' });
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('serialization and temp/flush/verification/replace failures preserve prior valid canonical bytes', async () => {
  const root = await makeWorkspace('c2-02-atomic-faults-');
  try {
    const target = path.join(root, 'session.json');
    const previous = JSON.stringify({ version: 1, tabs: [], marker: 'previous' });
    await fs.writeFile(target, previous, 'utf8');

    const circular: { self?: unknown } = {};
    circular.self = circular;
    await assert.rejects(
      atomicWriteJson(target, circular),
      error => error instanceof AtomicJsonWriteError && error.phase === 'serialize'
    );
    assert.equal(await fs.readFile(target, 'utf8'), previous);

    const failures: Array<{ phase: AtomicJsonPhase; code: string }> = [
      { phase: 'create-temp', code: 'EACCES' },
      { phase: 'write-temp', code: 'ENOSPC' },
      { phase: 'flush-temp', code: 'ENOSPC' },
      { phase: 'verify-temp', code: 'EIO' },
      { phase: 'replace', code: 'EACCES' }
    ];
    for (const failure of failures) {
      await assert.rejects(
        atomicWriteJson(target, { version: 1, tabs: [], marker: failure.phase }, {
          testHooks: {
            beforePhase: phase => {
              if (phase === failure.phase) throw Object.assign(new Error('injected filesystem fault'), { code: failure.code });
            }
          }
        }),
        error => error instanceof AtomicJsonWriteError && error.phase === failure.phase && error.osCode === failure.code
      );
      assert.equal(await fs.readFile(target, 'utf8'), previous, `${failure.phase} must leave canonical bytes unchanged`);
      assert.deepEqual(JSON.parse(await fs.readFile(target, 'utf8')), { version: 1, tabs: [], marker: 'previous' });
    }
    assert.deepEqual(tempNames(await fs.readdir(root), 'session.json'), [], 'failed commits clean only their unique temporary files');
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('process interruption before replace preserves old state, ignores an orphan, and reclaims it after a later commit', async () => {
  const workspace = await makeWorkspace('c2-02-process-interrupt-');
  try {
    const directory = path.join(workspace, '.aide');
    await fs.mkdir(directory, { recursive: true });
    const target = path.join(directory, 'session.json');
    const previous = { version: 1, tabs: [], panel: 'before-interruption' };
    await fs.writeFile(target, JSON.stringify(previous), 'utf8');
    const childPath = path.resolve('tests/fixtures/atomic-json-crash.mjs');
    const child = spawnSync(process.execPath, ['--experimental-strip-types', childPath, target, 'during-temp-write'], {
      cwd: process.cwd(), encoding: 'utf8', timeout: 5000, windowsHide: true
    });
    assert.equal(child.error, undefined);
    assert.equal(child.signal, null);
    assert.equal(child.status, 70, `child exited at the injected interruption point: ${child.stderr}`);
    const orphanNames = tempNames(await fs.readdir(directory), 'session.json');
    assert.equal(orphanNames.length, 1, 'interruption leaves only the uniquely named non-canonical temp');
    const orphanPath = path.join(directory, orphanNames[0]!);
    const orphanBytes = await fs.readFile(orphanPath, 'utf8');
    const completeBytes = `${JSON.stringify({ version: 1, tabs: [], panel: 'after-interruption' }, null, 2)}\n`;
    assert.ok(orphanBytes.length > 0 && orphanBytes.length < completeBytes.length, 'interruption leaves a genuinely partial temporary representation');
    assert.throws(() => JSON.parse(orphanBytes), SyntaxError, 'partial temporary representation is invalid JSON');
    assert.deepEqual(JSON.parse(await fs.readFile(target, 'utf8')), previous);
    assert.deepEqual(await new SessionStore(workspace).load(), previous);

    const staleTime = new Date(Date.now() - 25 * 60 * 60 * 1000);
    await fs.utimes(path.join(directory, orphanNames[0]!), staleTime, staleTime);
    await new SessionStore(workspace).save({ panel: 'after-recovery' });
    assert.deepEqual(tempNames(await fs.readdir(directory), 'session.json'), [], 'aged helper-owned orphan is reclaimed after a later successful commit');
    assert.equal((await new SessionStore(workspace).load()).panel, 'after-recovery');
  } finally {
    await fs.rm(workspace, { recursive: true, force: true });
  }
});

test('process interruption after a complete temp write but before replace leaves old canonical state', async () => {
  const workspace = await makeWorkspace('c2-02-process-before-replace-');
  try {
    const directory = path.join(workspace, '.aide');
    await fs.mkdir(directory, { recursive: true });
    const target = path.join(directory, 'session.json');
    const previous = { version: 1, tabs: [], panel: 'before-replace' };
    await fs.writeFile(target, JSON.stringify(previous), 'utf8');
    const childPath = path.resolve('tests/fixtures/atomic-json-crash.mjs');
    const child = spawnSync(process.execPath, ['--experimental-strip-types', childPath, target, 'before-replace'], {
      cwd: process.cwd(), encoding: 'utf8', timeout: 5000, windowsHide: true
    });
    assert.equal(child.error, undefined);
    assert.equal(child.signal, null);
    assert.equal(child.status, 71, `child exited after temp validation but before rename: ${child.stderr}`);
    const orphanNames = tempNames(await fs.readdir(directory), 'session.json');
    assert.equal(orphanNames.length, 1);
    const orphanPath = path.join(directory, orphanNames[0]!);
    const orphan = await fs.readFile(orphanPath, 'utf8');
    assert.deepEqual(JSON.parse(orphan), { version: 1, tabs: [], panel: 'after-interruption' });
    assert.deepEqual(JSON.parse(await fs.readFile(target, 'utf8')), previous);
    assert.deepEqual(await new SessionStore(workspace).load(), previous, 'startup ignores a complete but uncommitted temp');
  } finally {
    await fs.rm(workspace, { recursive: true, force: true });
  }
});

test('process interruption after replace leaves the new complete canonical state', async () => {
  const workspace = await makeWorkspace('c2-02-process-after-replace-');
  try {
    const directory = path.join(workspace, '.aide');
    await fs.mkdir(directory, { recursive: true });
    const target = path.join(directory, 'session.json');
    await fs.writeFile(target, JSON.stringify({ version: 1, tabs: [], panel: 'old' }), 'utf8');
    const childPath = path.resolve('tests/fixtures/atomic-json-crash.mjs');
    const child = spawnSync(process.execPath, ['--experimental-strip-types', childPath, target, 'after-replace'], {
      cwd: process.cwd(), encoding: 'utf8', timeout: 5000, windowsHide: true
    });
    assert.equal(child.error, undefined);
    assert.equal(child.signal, null);
    assert.equal(child.status, 72, `child exited immediately after rename: ${child.stderr}`);
    assert.deepEqual(await new SessionStore(workspace).load(), { version: 1, tabs: [], panel: 'after-interruption' });
  } finally {
    await fs.rm(workspace, { recursive: true, force: true });
  }
});

test('missing state is an empty first run; malformed, unsupported, and unreadable state fail truthfully without mutation', async () => {
  const workspace = await makeWorkspace('c2-02-state-recovery-');
  try {
    assert.deepEqual(await new SessionStore(workspace).load(), { version: 1, tabs: [] });
    assert.deepEqual(await new ChatStore(workspace).load(), []);

    const directory = path.join(workspace, '.aide');
    await fs.mkdir(directory, { recursive: true });
    const sessionPath = path.join(directory, 'session.json');
    const badSession = '{ truncated';
    await fs.writeFile(sessionPath, badSession, 'utf8');
    await assert.rejects(new SessionStore(workspace).load(), error => error instanceof StatePersistenceError && error.reason === 'CORRUPT_STATE');
    assert.equal(await fs.readFile(sessionPath, 'utf8'), badSession);
    await fs.writeFile(sessionPath, '', 'utf8');
    await assert.rejects(new SessionStore(workspace).load(), error => error instanceof StatePersistenceError && error.reason === 'CORRUPT_STATE');
    assert.equal(await fs.readFile(sessionPath, 'utf8'), '', 'zero-length canonical state is not treated as first-run empty');
    const futureSession = JSON.stringify({ version: 2, tabs: [] });
    await fs.writeFile(sessionPath, futureSession, 'utf8');
    await assert.rejects(new SessionStore(workspace).load(), error => error instanceof StatePersistenceError && error.reason === 'UNSUPPORTED_SCHEMA');
    assert.equal(await fs.readFile(sessionPath, 'utf8'), futureSession);

    const chatPath = path.join(directory, 'chat-history.json');
    const badHistory = JSON.stringify({ conversations: [{ id: 'missing-required-fields' }] });
    await fs.writeFile(chatPath, badHistory, 'utf8');
    await assert.rejects(new ChatStore(workspace).load(), error => error instanceof StatePersistenceError && error.reason === 'CORRUPT_STATE');
    assert.equal(await fs.readFile(chatPath, 'utf8'), badHistory);
    await fs.writeFile(chatPath, '', 'utf8');
    await assert.rejects(new ChatStore(workspace).load(), error => error instanceof StatePersistenceError && error.reason === 'CORRUPT_STATE');
    assert.equal(await fs.readFile(chatPath, 'utf8'), '', 'zero-length canonical state is not treated as first-run empty');
    const futureHistory = JSON.stringify({ version: 2, conversations: [] });
    await fs.writeFile(chatPath, futureHistory, 'utf8');
    await assert.rejects(new ChatStore(workspace).load(), error => error instanceof StatePersistenceError && error.reason === 'UNSUPPORTED_SCHEMA');
    assert.equal(await fs.readFile(chatPath, 'utf8'), futureHistory);

    const unreadableWorkspace = await makeWorkspace('c2-02-read-error-');
    try {
      await fs.writeFile(path.join(unreadableWorkspace, '.aide'), 'not a directory', 'utf8');
      await assert.rejects(new SessionStore(unreadableWorkspace).load(), error => error instanceof StatePersistenceError && error.reason === 'READ_FAILED');
      await assert.rejects(new ChatStore(unreadableWorkspace).load(), error => error instanceof StatePersistenceError && error.reason === 'READ_FAILED');
    } finally {
      await fs.rm(unreadableWorkspace, { recursive: true, force: true });
    }
  } finally {
    await fs.rm(workspace, { recursive: true, force: true });
  }
});

test('session and chat save errors do not report success, alter old bytes, or publish an uncommitted in-memory chat update', async () => {
  const workspace = await makeWorkspace('c2-02-write-failure-');
  try {
    const directory = path.join(workspace, '.aide');
    await fs.mkdir(directory, { recursive: true });
    const sessionPath = path.join(directory, 'session.json');
    const oldSession = JSON.stringify({ version: 1, tabs: [], panel: 'terminal' });
    await fs.writeFile(sessionPath, oldSession, 'utf8');
    const session = new SessionStore(workspace, '.aide', injectedReplaceFailure());
    await assert.rejects(session.save({ panel: 'editor' }), error => error instanceof StatePersistenceError && error.reason === 'WRITE_FAILED' && error.phase === 'replace' && error.osCode === 'EACCES');
    assert.equal(await fs.readFile(sessionPath, 'utf8'), oldSession);

    const chatPath = path.join(directory, 'chat-history.json');
    const oldChat = JSON.stringify({ conversations: [{ id: 'c1', modelId: 'm1', title: 'old', messages: [], updatedAt: 1 }] });
    await fs.writeFile(chatPath, oldChat, 'utf8');
    const chat = new ChatStore(workspace, injectedReplaceFailure());
    await chat.load();
    await assert.rejects(chat.save({ id: 'c1', modelId: 'm1', title: 'new', messages: [] }), error => error instanceof StatePersistenceError && error.reason === 'WRITE_FAILED' && error.phase === 'replace');
    assert.equal(await fs.readFile(chatPath, 'utf8'), oldChat);
    assert.equal(chat.get('c1')?.title, 'old', 'failed persistence leaves the prior in-memory view');
    assert.deepEqual(chat.get('c1')?.messages, [], 'failed persistence leaves the prior messages in memory');
    await assert.rejects(
      chat.saveMany([
        { modelId: 'm1', title: 'batch one', messages: [] },
        { modelId: 'm1', title: 'batch two', messages: [] }
      ]),
      error => error instanceof StatePersistenceError && error.reason === 'WRITE_FAILED' && error.phase === 'replace'
    );
    assert.equal(await fs.readFile(chatPath, 'utf8'), oldChat, 'a failed batch commit leaves prior canonical bytes unchanged');
    assert.equal(chat.list().length, 1, 'a failed batch commit does not publish uncommitted conversations');
  } finally {
    await fs.rm(workspace, { recursive: true, force: true });
  }
});

test('concurrent session patches and independent chat stores serialize against the latest canonical state', async () => {
  const workspace = await makeWorkspace('c2-02-concurrent-writers-');
  try {
    const sessionA = new SessionStore(workspace);
    const sessionB = new SessionStore(workspace);
    await Promise.all([
      sessionA.save({ panel: 'editor' }),
      sessionB.save({ selected_engine_id: 'local-liquid' })
    ]);
    const session = await new SessionStore(workspace).load();
    assert.equal(session.panel, 'editor');
    assert.equal(session.selected_engine_id, 'local-liquid');

    const chatA = new ChatStore(workspace);
    const chatB = new ChatStore(workspace);
    await Promise.all([chatA.load(), chatB.load()]);
    const saved = await Promise.all([
      chatA.save({ id: 'conversation-a', modelId: 'm1', title: 'A', messages: [] }),
      chatB.save({ id: 'conversation-b', modelId: 'm1', title: 'B', messages: [] })
    ]);
    const chat = await new ChatStore(workspace).load();
    assert.deepEqual(chat.map(item => item.id).sort(), saved.map(item => item.id).sort());
    assert.deepEqual(chat.map(item => item.title).sort(), ['A', 'B']);
  } finally {
    await fs.rm(workspace, { recursive: true, force: true });
  }
});

test('chat-history GET restores canonical conversations in a fresh store instance', async () => {
  const workspace = await makeWorkspace('c2-02-chat-reload-');
  try {
    const writer = new ChatStore(workspace);
    const saved = await writer.save({ id: 'persisted', modelId: 'm1', title: 'Restored after restart', messages: [{ role: 'user', content: 'fixture' }] });
    const reader = new ChatStore(workspace);
    const route = routeForChatHistory(reader);
    const result = await route.handler({ query: {}, body: undefined } as never) as { conversations: Array<{ id: string; title: string }> };
    assert.ok(result.conversations.some(item => item.id === saved.id && item.title === 'Restored after restart'));

    const canonicalPath = path.join(workspace, '.aide', 'chat-history.json');
    await fs.writeFile(canonicalPath, JSON.stringify({ conversations: [{ ...saved, title: 'External edit' }] }), 'utf8');
    const refreshed = await route.handler({ query: {}, body: undefined } as never) as { conversations: Array<{ id: string; title: string }> };
    assert.ok(refreshed.conversations.some(item => item.id === saved.id && item.title === 'External edit'), 'a later read observes valid external canonical edits');
  } finally {
    await fs.rm(workspace, { recursive: true, force: true });
  }
});
