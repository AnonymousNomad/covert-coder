import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNodePtyEngine, type PtyProcess, type PtySpawnOptions } from '../../node/src/services/runtime-providers.ts';

function options(): PtySpawnOptions {
  return {
    file: 'C:\\Windows\\System32\\cmd.exe',
    args: ['/d'],
    cwd: 'E:\\workspace',
    env: { SystemRoot: 'C:\\Windows', TERM: 'xterm-256color' },
    cols: 100,
    rows: 30
  };
}

test('Windows node-pty adapter selects the DLL-backed ConPTY shutdown path', () => {
  const pty = { pid: 1234 } as PtyProcess;
  let call: { file: string; args: string[]; options: Record<string, unknown> } | undefined;
  const engine = createNodePtyEngine({
    spawn(file, args, spawnOptions) {
      call = { file, args, options: spawnOptions };
      return pty;
    }
  }, 'win32');

  assert.equal(engine.spawn(options()), pty);
  assert.deepEqual(call, {
    file: 'C:\\Windows\\System32\\cmd.exe',
    args: ['/d'],
    options: {
      name: 'xterm-256color',
      cols: 100,
      rows: 30,
      cwd: 'E:\\workspace',
      env: { SystemRoot: 'C:\\Windows', TERM: 'xterm-256color' },
      useConpty: true,
      useConptyDll: true
    }
  });
});

test('non-Windows node-pty adapter does not set Windows ConPTY options', () => {
  let call: { options: Record<string, unknown> } | undefined;
  const engine = createNodePtyEngine({
    spawn(_file, _args, spawnOptions) {
      call = { options: spawnOptions };
      return { pid: 2345 };
    }
  }, 'linux');

  engine.spawn(options());
  assert.deepEqual(call?.options, {
    name: 'xterm-256color',
    cols: 100,
    rows: 30,
    cwd: 'E:\\workspace',
    env: { SystemRoot: 'C:\\Windows', TERM: 'xterm-256color' }
  });
});
