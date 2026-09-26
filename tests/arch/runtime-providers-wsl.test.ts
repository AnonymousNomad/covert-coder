import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createDefaultProviderDeps,
  createRuntimeProviderRegistry,
  normalizeWslDistroOutput
} from '../../node/src/services/runtime-providers.ts';

// UI-TERM-013 regression: wsl.exe -l -q emits UTF-16LE. When that output was
// decoded as UTF-8 the distro names arrived NUL-interleaved. The boundary now
// selects UTF-16LE for wsl.exe, and the exported normalizer recovers text that
// was already mis-decoded elsewhere. Representative input below is the exact
// NUL-interleaved form observed live from the provider card.

const MISDECODED = 'U\u0000b\u0000u\u0000n\u0000t\u0000u\u0000-\u00002\u00004\u0000.\u00000\u00004\u0000\r\u0000\n\u0000D\u0000e\u0000b\u0000i\u0000a\u0000n\u0000\r\u0000\n\u0000';

function wslRegistryDeps(stdout: string) {
  return createDefaultProviderDeps({
    platform: 'win32',
    fileExists: async () => true,
    listDir: async () => [],
    loadPty: () => ({ spawn() { throw new Error('describe must never spawn'); } }),
    exec: async () => ({ code: 0, stdout, stderr: '' })
  });
}

test('WSL provider decodes NUL-interleaved UTF-16LE distro output (UI-TERM-013)', async () => {
  const registry = createRuntimeProviderRegistry(wslRegistryDeps(MISDECODED));
  const wsl = registry.get('wsl');
  assert.ok(wsl);
  const info = await wsl.describe();
  assert.equal(info.state, 'available');
  assert.equal(info.detail, 'Interactive sessions in Ubuntu-24.04, Debian.');
  assert.deepEqual(info.shells.map(shell => shell.id), ['Ubuntu-24.04', 'Debian']);
  assert.doesNotMatch(JSON.stringify(info), /\u0000/);
});

test('WSL provider leaves correctly decoded text unchanged and strips only a leading BOM', async () => {
  assert.equal(normalizeWslDistroOutput('Ubuntu-24.04\nDebian\n'), 'Ubuntu-24.04\nDebian\n');
  assert.equal(normalizeWslDistroOutput('\uFEFFUbuntu-24.04'), 'Ubuntu-24.04');
  const registry = createRuntimeProviderRegistry(wslRegistryDeps('Ubuntu-24.04\r\nDebian\r\n'));
  const info = await registry.get('wsl')!.describe();
  assert.equal(info.detail, 'Interactive sessions in Ubuntu-24.04, Debian.');
  assert.deepEqual(info.shells.map(shell => shell.id), ['Ubuntu-24.04', 'Debian']);
});

test('WSL provider reports no-distribution and error states without fabricating names', async () => {
  const empty = createRuntimeProviderRegistry(wslRegistryDeps('\r\n'));
  const emptyInfo = await empty.get('wsl')!.describe();
  assert.equal(emptyInfo.state, 'requires-setup');
  assert.deepEqual(emptyInfo.shells, []);

  const failing = createRuntimeProviderRegistry(createDefaultProviderDeps({
    platform: 'win32',
    fileExists: async () => true,
    listDir: async () => [],
    loadPty: () => ({ spawn() { throw new Error('describe must never spawn'); } }),
    exec: async () => ({ code: 1, stdout: '', stderr: 'not installed' })
  }));
  const failingInfo = await failing.get('wsl')!.describe();
  assert.equal(failingInfo.state, 'unhealthy');
  assert.deepEqual(failingInfo.shells, []);
});
