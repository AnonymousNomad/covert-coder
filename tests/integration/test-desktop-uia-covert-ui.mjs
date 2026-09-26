import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createDesktopControl } from '../../node/src/services/desktop-control.mjs';
import { createExecutionAuthority } from '../../node/src/services/execution-authority.mjs';
import { readWindowsProcessIdentity, sameWindowsProcessIdentity } from '../../node/src/services/windows-process-identity.mjs';

test('Desktop Control owns and inspects the built Covert desktop shell', {
  skip: process.platform !== 'win32', timeout: 180000
}, async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'covert-desktop-control-ui-'));
  const executable = path.resolve('desktop/target/release/aide-sovereign-workbench.exe');
  const records = [];
  const authority = createExecutionAuthority({ workspace, record: async event => { records.push(event); return { persisted: true }; } });
  const origin = 'http://covert-desktop-control-ui.local';
  const paired = await authority.pair(authority.control.createPairing(origin), origin);
  const actor = authority.authenticate(paired.token, origin);
  const desktop = createDesktopControl({ workspace, authority });
  const sessionId = 'covert-ui-' + process.pid + '-' + Date.now();
  let task = 0;
  let appPid = null;
  let primaryFailure = null;

  async function execute(kind, body, callback) {
    const input = { workspace, taskId: 'covert-ui-' + (++task), kind, args: { body } };
    const operation = await authority.prepare(actor, input);
    await authority.decide(actor, operation.operation_id, 'approve');
    return authority.execute(actor, operation.operation_id, input, (_descriptor, handle) => callback(handle));
  }

  async function action(body) {
    const request = { ...body, approved: true };
    return execute('desktop.action', request, handle => desktop.act(request, handle, sessionId));
  }

  async function discover(pid) {
    const result = await action({ op: 'uia_action', target: JSON.stringify({ action: 'discover', pid }) });
    return JSON.parse(result.output).details.windows;
  }

  try {
    assert.equal(await fs.access(executable).then(() => true).catch(() => false), true, 'release-protocol Covert executable exists');
    const grants = { enabled: true, grants: { apps: [executable], roots: [workspace], window_titles: [] }, ttl_minutes: 10 };
    await execute('desktop.grants', grants, handle => desktop.setGrants(grants, handle));

    const launched = await action({ op: 'launch_app', target: executable, args: [], show_window: true });
    const match = /owned process (\d+)/.exec(launched.output);
    assert.ok(match, launched.output);
    appPid = Number(match[1]);
    assert.ok(appPid > 0);
    const identity = await readWindowsProcessIdentity(appPid);
    assert.ok(identity, 'the Covert process remains live after launch');
    assert.equal(identity.pid, appPid, 'the exact Covert process identity was retained');
    const launchStatus = await desktop.status();
    assert.equal(launchStatus.tracked_children, 1, 'Desktop Control retained the launched Covert process');
    console.log('COVERT_SHELL_LAUNCHED=' + JSON.stringify({ pid: appPid, tracked_children: launchStatus.tracked_children }));

    const bootDeadline = Date.now() + 20000;
    let bootIdentity = identity;
    let bootFailure = null;
    let healthStatus = 0;
    while (Date.now() < bootDeadline) {
      try {
        bootIdentity = await readWindowsProcessIdentity(appPid);
      } catch (error) {
        bootFailure = error;
        break;
      }
      if (!sameWindowsProcessIdentity(identity, bootIdentity)) break;
      try {
        const response = await fetch('http://127.0.0.1:4777/api/health', { signal: AbortSignal.timeout(750) });
        healthStatus = response.status;
        if (healthStatus === 200) break;
      } catch { healthStatus = 0; }
      await new Promise(resolve => setTimeout(resolve, 150));
    }
    console.log('COVERT_SHELL_BOOT=' + JSON.stringify({
      process_present: sameWindowsProcessIdentity(identity, bootIdentity),
      health_status: healthStatus,
      probe_error: bootFailure?.code ?? null
    }));
    assert.ok(sameWindowsProcessIdentity(identity, bootIdentity), 'the owned Covert process survives stack startup' + (bootFailure ? ': ' + bootFailure.message : ''));
    assert.equal(healthStatus, 200, 'the owned Covert shell stack reaches local facade health');

    let window = null;
    const deadline = Date.now() + 60000;
    let lastError = null;
    while (!window && Date.now() < deadline) {
      let currentIdentity = null;
      try {
        currentIdentity = await readWindowsProcessIdentity(appPid);
        if (!sameWindowsProcessIdentity(identity, currentIdentity)) {
          lastError = new Error(currentIdentity ? 'owned process identity changed during window discovery' : 'owned Covert process exited before window discovery');
          break;
        }
        const status = await desktop.status();
        if (status.tracked_children !== 1) {
          lastError = new Error(`Desktop Control now tracks ${status.tracked_children} children`);
          break;
        }
        const windows = await discover(appPid);
        window = windows.find(row => Number(row.window_handle) > 0) ?? null;
      } catch (error) {
        lastError = error;
        if (['UIA_TARGET_NOT_OWNED', 'UIA_IDENTITY_UNVERIFIED', 'UIA_IDENTITY_MISMATCH'].includes(error?.code)) break;
      }
      if (!window) await new Promise(resolve => setTimeout(resolve, 200));
    }
    assert.ok(window, 'the owned Covert window was discovered' + (lastError ? ': ' + lastError.message : ''));

    const inspection = await action({ op: 'uia_action', target: JSON.stringify({
      action: 'inspect', pid: appPid, window_handle: window.window_handle, lease_id: window.lease_id
    }) });
    assert.equal(inspection.assertion.pass, true);
    const inspectionDetails = JSON.parse(inspection.output).details;
    assert.equal(inspectionDetails.action, 'inspect');
    assert.ok(Array.isArray(inspectionDetails.controls));
    assert.equal(inspectionDetails.controls_truncated, false);
    assert.ok(inspectionDetails.controls.length > 0, 'the live Covert webview exposes inspectable controls');

    const healthDeadline = Date.now() + 30000;
    let health = null;
    while (!health && Date.now() < healthDeadline) {
      try {
        const response = await fetch('http://127.0.0.1:4777/api/health', { signal: AbortSignal.timeout(1500) });
        if (response.ok) health = await response.json();
      } catch { /* bounded retry while the owned local stack starts */ }
      if (!health) await new Promise(resolve => setTimeout(resolve, 200));
    }
    assert.ok(health, 'the Covert shell owns a responding local facade');

    console.log('COVERT_SHELL_OWNERSHIP=' + JSON.stringify({ pid: appPid, window_handle: window.window_handle, class_name: window.class_name }));
    console.log('COVERT_SHELL_LOCAL_HEALTH=PASS');
    console.log('COVERT_SHELL_UIA_INSPECT=' + JSON.stringify({ controls: inspectionDetails.controls.length, automation_ids: inspectionDetails.controls.map(control => control.automation_id) }));
    assert.ok(records.some(event => event.type === 'desktop' && event.op === 'launch_app' && event.decision === 'executed'));
    assert.ok(records.some(event => event.type === 'desktop' && event.op === 'uia_action' && event.decision === 'executed' && event.assertion?.check === 'uia_verified:inspect'));
  } catch (error) {
    primaryFailure = error;
    console.error('COVERT_UI_PRIMARY_FAILURE=' + JSON.stringify({ name: error?.name, code: error?.code, message: String(error?.message ?? '').slice(0, 300) }));
    throw error;
  } finally {
    let cleanupFailure = null;
    try {
      if (appPid !== null && await readWindowsProcessIdentity(appPid)) {
        const cleanup = await execute('desktop.panic', {}, handle => desktop.panic(handle));
        console.log('COVERT_SHELL_CLEANUP=' + JSON.stringify(cleanup));
        assert.equal(cleanup.ok, true, 'panic confirmed termination of every retained owned process');
        assert.equal((await desktop.status()).tracked_children, 0);
      }
      if (appPid !== null) assert.equal(await readWindowsProcessIdentity(appPid), null, 'the exact Covert process is absent after cleanup');
    } catch (error) {
      cleanupFailure = error;
      console.error('COVERT_UI_CLEANUP_FAILURE=' + JSON.stringify({ name: error?.name, code: error?.code, message: String(error?.message ?? '').slice(0, 300) }));
    }
    try {
      authority.control.close();
      await fs.rm(workspace, { recursive: true, force: true });
    } catch (error) {
      cleanupFailure ??= error;
    }
    if (cleanupFailure && !primaryFailure) throw cleanupFailure;
  }
});
