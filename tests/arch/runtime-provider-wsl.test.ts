import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultProviderDeps, createRuntimeProviderRegistry, type ExecFn } from '../../node/src/services/runtime-providers.ts';
import { TerminalProviderInfo } from '../../common/contracts/terminal.ts';

function fixture(exec: ExecFn, overrides = {}) {
  return createRuntimeProviderRegistry(createDefaultProviderDeps({
    platform: 'win32', fileExists: async () => true,
    loadPty: () => ({ spawn() { throw new Error('discovery must not start a PTY'); } }),
    exec, ...overrides
  }));
}

test('WSL discovery requests UTF-16LE decoding and reports clean installed identities with observed stopped/running state', async () => {
  const calls: Array<{ args: string[]; encoding: unknown }> = [];
  const registry = fixture(async (_file, args, encoding) => {
    calls.push({ args, encoding });
    const text = args.includes('--running') ? 'Debian\r\n' : '\ufeffUbuntu-24.04\r\nDebian\r\n';
    return { code: 0, stdout: encoding === 'utf16le' ? text : Buffer.from(text, 'utf16le').toString('utf8'), stderr: '' };
  });
  const info = await registry.get('wsl')!.describe();
  assert.equal(info.state, 'available');
  assert.equal(info.installationState, 'installed');
  assert.deepEqual(info.shells.map(shell => ({ id: shell.id, runtimeState: shell.runtimeState })), [
    { id: 'Ubuntu-24.04', runtimeState: 'stopped' }, { id: 'Debian', runtimeState: 'running' }
  ]);
  assert.deepEqual(calls, [
    { args: ['-l', '-q'], encoding: 'utf16le' },
    { args: ['--list', '--running', '--quiet'], encoding: 'utf16le' }
  ]);
  assert.equal(TerminalProviderInfo.safeParse(info).success, true);
});

test('real child-process probe decodes Unicode before parsing rather than deleting NUL bytes', async () => {
  const result = await createDefaultProviderDeps().exec(process.execPath, [
    '-e', "process.stdout.write(Buffer.from('開発-Ubuntu\\r\\n', 'utf16le'))"
  ], 'utf16le');
  assert.equal(result.code, 0);
  assert.equal(result.stdout, '開発-Ubuntu\r\n');
});

test('WSL process-state failure keeps installed distributions but labels runtime state unknown', async () => {
  const info = await fixture(async (_file, args) => args.includes('--running')
    ? { code: 2, stdout: '', stderr: 'probe unavailable' }
    : { code: 0, stdout: 'Ubuntu-24.04\r\n', stderr: '' }).get('wsl')!.describe();
  assert.equal(info.state, 'available');
  assert.equal(info.installationState, 'installed');
  assert.equal(info.shells[0]?.runtimeState, 'unknown');
  assert.match(info.detail, /unknown/i);
  assert.match(info.detail, /exit 2/);
});

test('WSL thrown process-state probe never manufactures stopped state', async () => {
  const info = await fixture(async (_file, args) => {
    if (args.includes('--running')) throw new Error('probe timed out');
    return { code: 0, stdout: 'Ubuntu-24.04', stderr: '' };
  }).get('wsl')!.describe();
  assert.equal(info.shells[0]?.runtimeState, 'unknown');
  assert.match(info.detail, /timed out/);
});

test('WSL CLI absence is distinct from an installed platform with no distribution', async () => {
  const missing = await fixture(async () => { throw new Error('missing CLI must never be queried'); }, { fileExists: async () => false }).get('wsl')!.describe();
  assert.equal(missing.state, 'unsupported');
  assert.equal(missing.installationState, 'not-installed');
  const empty = await fixture(async () => ({ code: 0, stdout: '\r\n', stderr: '' })).get('wsl')!.describe();
  assert.equal(empty.state, 'requires-setup');
  assert.equal(empty.installationState, 'installed');
  assert.deepEqual(empty.shells, []);
});

test('WSL installation probe failure is unhealthy/unknown with no launchable shells', async () => {
  const registry = fixture(async () => ({ code: 1, stdout: 'Ubuntu', stderr: 'failed' }));
  const info = await registry.get('wsl')!.describe();
  assert.equal(info.state, 'unhealthy');
  assert.equal(info.installationState, 'unknown');
  assert.deepEqual(info.shells, []);
  assert.ok('error' in await registry.resolve('wsl', 'Ubuntu'));
});

test('WSL malformed NUL-containing identities cannot be treated as available or resolved', async () => {
  const registry = fixture(async () => ({ code: 0, stdout: 'U\0b\0u\0n\0t\0u\0', stderr: '' }));
  const info = await registry.get('wsl')!.describe();
  assert.equal(info.state, 'unhealthy');
  assert.deepEqual(info.shells, []);
  assert.ok('error' in await registry.resolve('wsl', 'Ubuntu'));
});

test('WSL unsupported host never probes or starts a runtime', async () => {
  const info = await fixture(async () => { throw new Error('unexpected probe'); }, { platform: 'linux' }).get('wsl')!.describe();
  assert.equal(info.state, 'unsupported');
  assert.deepEqual(info.shells, []);
});

test('WSL selection does not substitute a different installed distribution', async () => {
  const registry = fixture(async () => ({ code: 0, stdout: 'Debian', stderr: '' }));
  const result = await registry.resolve('wsl', 'Ubuntu-24.04');
  assert.ok('error' in result);
  assert.match(result.error, /unknown distribution/);
});

test('selected WSL distribution launches through wsl.exe with explicit distribution and Linux cwd, retaining Windows host cwd', async () => {
  const { TerminalSessionService } = await import('../../node/src/services/terminal-sessions.ts');
  const calls: import('../../node/src/services/runtime-providers.ts').PtySpawnOptions[] = [];
  let onExit: ((event: { exitCode: number }) => void) | undefined;
  const service = new TerminalSessionService({
    defaultCwd: 'E:\\project with spaces', onEvent() {},
    deps: createDefaultProviderDeps({
      platform: 'win32', fileExists: async () => true,
      exec: async () => ({ code: 0, stdout: 'Ubuntu-24.04', stderr: '' }),
      loadPty: () => ({ spawn(options) {
        calls.push(options);
        return { pid: 1000, onData() {}, onExit(listener) { onExit = listener; },
          write() {}, resize() {}, kill() { onExit?.({ exitCode: 0 }); } };
      } })
    })
  });
  try {
    const opened = await service.open({ owner: 'operator', provider: 'wsl', shell: 'Ubuntu-24.04', cwd: 'E:\\project with spaces', cols: 80, rows: 24 });
    assert.ok('session' in opened);
    assert.equal(opened.session.provider, 'wsl');
    assert.equal(opened.session.shell, 'Ubuntu-24.04');
    assert.equal(opened.session.cwd, '/mnt/e/project with spaces');
    assert.equal(calls[0]?.file, 'C:\\Windows\\System32\\wsl.exe');
    assert.equal(calls[0]?.cwd, 'E:\\project with spaces');
    assert.deepEqual(calls[0]?.args, ['--distribution', 'Ubuntu-24.04', '--cd', '/mnt/e/project with spaces', '--exec', '/bin/sh']);
  } finally { service.stopAll(); }
});
