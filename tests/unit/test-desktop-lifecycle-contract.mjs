import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('MSI repair flags are confined to explicit upgrade and hosted command regression is required', async () => {
  const lifecycle = await readFile(new URL('../../scripts/desktop-lifecycle-smoke.ps1', import.meta.url), 'utf8');
  const workflow = await readFile(new URL('../../.github/workflows/desktop.yml', import.meta.url), 'utf8');
  assert.ok(lifecycle.includes("if ($Mode -eq 'upgrade') { $arguments += @('REINSTALL=ALL', 'REINSTALLMODE=amus') }"));
  assert.doesNotMatch(lifecycle, /@\('\/i',[^\r\n]*REINSTALL=/,
    'fresh MSI base install arguments cannot select only previously installed features');
  assert.ok(lifecycle.includes("[ValidateSet('install', 'upgrade', 'uninstall')]"));
  assert.ok(workflow.includes('./tests/unit/test-desktop-installer-contract.ps1 -LifecyclePath ./scripts/desktop-lifecycle-smoke.ps1'));
});

test('installed desktop smoke uses canonical public health and requires relaunch after cleanup', async () => {
  const lifecycle = await readFile(new URL('../../scripts/desktop-lifecycle-smoke.ps1', import.meta.url), 'utf8');
  assert.ok(lifecycle.includes("-Url 'http://127.0.0.1:4777/api/health'"));
  assert.ok(!lifecycle.includes("-Url 'http://127.0.0.1:4777/health'"));
  for (const label of ['first launch', 'same-install relaunch', 'forced parent exit', 'recovery after forced exit', 'after reinstall']) {
    assert.ok(lifecycle.includes(`-Label '${label}'`), `required lifecycle cycle: ${label}`);
  }
  assert.ok(lifecycle.includes('$_.LocalPort -in 4777,4778,4779'),
    'cleanup checks all three product listeners');
});

test('Windows native containment precedes child startup and installed checks require crash recovery', async () => {
  const native = await readFile(new URL('../../desktop/src/main.rs', import.meta.url), 'utf8');
  const job = await readFile(new URL('../../desktop/src/runtime_job.rs', import.meta.url), 'utf8');
  const lifecycle = await readFile(new URL('../../scripts/desktop-lifecycle-smoke.ps1', import.meta.url), 'utf8');
  const containment = native.indexOf('runtime_job::bind_current_process()');
  const builder = native.indexOf('tauri::Builder::default()');
  assert.ok(containment >= 0 && builder > containment, 'containment exists before Tauri startup');
  assert.ok(job.includes('JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE'));
  assert.ok(job.includes('AssignProcessToJobObject(job.as_raw_handle(), GetCurrentProcess())'));
  assert.ok(job.includes('job.into_raw_handle()'));
  assert.ok(lifecycle.includes("-Label 'forced parent exit' -ForceParentExit"));
  assert.ok(lifecycle.includes('$app.Kill()'));
  assert.ok(lifecycle.includes('$listenerCandidate.CreationDate -eq $healthListenerIdentity.CreationDate'));
  assert.ok(lifecycle.includes('$_.CreationDate -eq $ownedNodeBirths[[int]$_.ProcessId]'));
  assert.ok(lifecycle.includes('residual ownership metadata'));
});
