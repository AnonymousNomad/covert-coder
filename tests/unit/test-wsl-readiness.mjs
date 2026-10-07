// Focused WSL cold-readiness contract tests.
// Proves: readiness budget seam; typed refusals (reject/nonzero); successful
// readiness reaches the PTY spawn path; failed readiness prevents PTY spawn;
// exact distro preserved; no backend substitution (payload untouched).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createRuntimeProviderRegistry,
  WSL_READINESS_BUDGET_MS
} from '../../node/src/services/runtime-providers.ts';
import { TerminalSessionService } from '../../node/src/services/terminal-sessions.ts';

function makeDeps(execBounded) {
  return {
    exec: async () => ({ code: 0, stdout: 'Ubuntu-24.04\n', stderr: '' }),
    execBounded,
    fileExists: async candidate => candidate === 'C:\\Windows\\System32\\wsl.exe',
    listDir: async () => [],
    loadPty: () => ({ spawn: () => { throw new Error('engine spawn must not be reached in this test'); } }),
    platform: 'win32',
    env: {}
  };
}

function fakePty() {
  return {
    pid: 4242,
    onData: () => {},
    onExit: () => {},
    write: () => {},
    resize: () => {},
    kill: () => {}
  };
}

test('readiness ok returns the exact distro and bounded budget constant exists', async () => {
  let seenTimeout = 0;
  let seenArgs = [];
  const deps = makeDeps(async (_file, args, timeoutMs) => {
    seenArgs = args;
    seenTimeout = timeoutMs;
    return { code: 0, stdout: '', stderr: '' };
  });
  const registry = createRuntimeProviderRegistry(deps);
  const resolved = await registry.resolve('wsl', 'Ubuntu-24.04');
  assert.ok(!('error' in resolved));
  assert.equal(resolved.shell.id, 'Ubuntu-24.04');
  const readiness = await resolved.provider.prepareSession(resolved.shell);
  assert.deepEqual(readiness, { ok: true });
  assert.equal(seenTimeout, WSL_READINESS_BUDGET_MS);
  assert.deepEqual(seenArgs, ['--distribution', 'Ubuntu-24.04', '--exec', '/bin/true']);
});

test('readiness timeout (execBounded rejects) returns a typed error naming the distro and budget', async () => {
  const deps = makeDeps(async () => { throw new Error('Command failed: killed'); });
  const registry = createRuntimeProviderRegistry(deps);
  const resolved = await registry.resolve('wsl', 'Ubuntu-24.04');
  assert.ok(!('error' in resolved));
  const readiness = await resolved.provider.prepareSession(resolved.shell);
  assert.ok('error' in readiness);
  assert.match(readiness.error, /Ubuntu-24\.04/);
  assert.match(readiness.error, new RegExp(String(WSL_READINESS_BUDGET_MS)));
});

test('readiness nonzero exit returns a typed not-ready error', async () => {
  const deps = makeDeps(async () => ({ code: 1, stdout: '', stderr: 'no such distro' }));
  const registry = createRuntimeProviderRegistry(deps);
  const resolved = await registry.resolve('wsl', 'Ubuntu-24.04');
  assert.ok(!('error' in resolved));
  const readiness = await resolved.provider.prepareSession(resolved.shell);
  assert.ok('error' in readiness);
  assert.match(readiness.error, /not ready \(exit 1\)/);
});

test('failed readiness prevents PTY spawn; successful readiness reaches spawn', async () => {
  const spawns = [];
  const failing = new TerminalSessionService({
    deps: makeDeps(async () => { throw new Error('cold stall simulated'); }),
    onEvent: () => {},
    spawnOverride: options => { spawns.push(options.file); return fakePty(); }
  });
  const refused = await failing.open({ provider: 'wsl', shell: 'Ubuntu-24.04', cols: 80, rows: 24, owner: 'probe-owner', cwd: 'E:\\' });
  assert.ok('error' in refused, JSON.stringify(refused).slice(0, 200));
  assert.match(refused.error, /Ubuntu-24\.04/);
  assert.equal(spawns.length, 0, 'no PTY may be spawned when readiness fails');

  const passing = new TerminalSessionService({
    deps: makeDeps(async () => ({ code: 0, stdout: '', stderr: '' })),
    onEvent: () => {},
    spawnOverride: options => { spawns.push(options.file); return fakePty(); }
  });
  const opened = await passing.open({ provider: 'wsl', shell: 'Ubuntu-24.04', cols: 80, rows: 24, owner: 'probe-owner', cwd: 'E:\\' });
  assert.ok('session' in opened, JSON.stringify(opened).slice(0, 200));
  assert.equal(spawns.length, 1);
  const info = JSON.stringify(opened.session);
  assert.ok(info.includes('wsl'), 'provider identity preserved');
  assert.ok(info.includes('Ubuntu-24.04'), 'exact distro preserved');
});
