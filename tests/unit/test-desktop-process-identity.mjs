import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  readWindowsProcessIdentity,
  sameWindowsProcessIdentity,
  terminateOwnedTestProcess,
  waitForWindowsProcessIdentity
} from '../../scripts/desktop-process-identity.mjs';

const liveFixtureArgs = ['-e', 'setInterval(() => {}, 1000)'];
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

async function startFixture() {
  const child = spawn(process.execPath, liveFixtureArgs, { stdio: 'ignore', windowsHide: true, shell: false });
  await once(child, 'spawn');
  return child;
}

test('same-executable foreign process is never selected by test-owned cleanup', { skip: process.platform !== 'win32' }, async () => {
  const foreign = await startFixture();
  let foreignIdentity;
  let owned;
  let ownedIdentity;
  try {
    foreignIdentity = await waitForWindowsProcessIdentity(foreign.pid, { expectedExecutablePath: process.execPath });
    assert.ok(foreignIdentity, 'foreign fixture identity captured');

    await new Promise(resolve => setTimeout(resolve, 30));
    owned = await startFixture();
    ownedIdentity = await waitForWindowsProcessIdentity(owned.pid, { expectedExecutablePath: process.execPath });
    assert.ok(ownedIdentity, 'owned fixture identity captured');
    assert.equal(ownedIdentity.executablePath.toLowerCase(), foreignIdentity.executablePath.toLowerCase());
    assert.notEqual(ownedIdentity.pid, foreignIdentity.pid);
    assert.notEqual(ownedIdentity.createdAtUtc, foreignIdentity.createdAtUtc);

    const pidReuseImpostor = { ...ownedIdentity, createdAtUtc: foreignIdentity.createdAtUtc };
    const refused = await terminateOwnedTestProcess(owned, pidReuseImpostor);
    assert.equal(refused.status, 'OWNERSHIP_UNPROVEN');
    assert.equal(owned.exitCode, null, 'identity mismatch must not terminate the retained child');
    assert.equal(foreign.exitCode, null, 'foreign same-image process remains untouched');

    const cleanup = await terminateOwnedTestProcess(owned, ownedIdentity);
    assert.deepEqual({ ok: cleanup.ok, status: cleanup.status }, { ok: true, status: 'TERMINATED' });
    assert.ok(owned.exitCode !== null || owned.signalCode !== null, 'exact owned child exited');
    assert.equal(foreign.exitCode, null, 'foreign same-image process is not selected');
    assert.equal(foreign.signalCode, null, 'foreign same-image process is not signaled');
    assert.equal(sameWindowsProcessIdentity(foreignIdentity, await readWindowsProcessIdentity(foreign.pid)), true);
  } finally {
    if (owned && ownedIdentity && owned.exitCode === null && owned.signalCode === null) {
      const current = await readWindowsProcessIdentity(owned.pid);
      if (sameWindowsProcessIdentity(ownedIdentity, current)) await terminateOwnedTestProcess(owned, ownedIdentity);
    }
    if (foreignIdentity && foreign.exitCode === null && foreign.signalCode === null) {
      const current = await readWindowsProcessIdentity(foreign.pid);
      if (sameWindowsProcessIdentity(foreignIdentity, current)) await terminateOwnedTestProcess(foreign, foreignIdentity);
    }
  }
});

test('desktop cleanup scripts contain no image-wide or recursive process selector', async () => {
  const files = [
    'scripts/desktop-battery.mjs',
    'scripts/desktop-staged-smoke.mjs',
    'desktop/stack-launcher.mjs'
  ];
  const unsafeSelector = /\btaskkill(?:\.exe)?\b|\/IM\b|\/T\b|\b(?:killall|pkill)\b|Stop-Process\s+[^\r\n]*-Name/i;
  for (const relative of files) {
    const source = await readFile(path.join(repoRoot, relative), 'utf8');
    assert.doesNotMatch(source, unsafeSelector, `${relative} must not use image-wide or recursive process cleanup`);
  }
});
