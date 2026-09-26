import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { createDesktopControl } from '../../node/src/services/desktop-control.mjs';
import { createExecutionAuthority } from '../../node/src/services/execution-authority.mjs';
import { readWindowsProcessIdentity, sameWindowsProcessIdentity } from '../../node/src/services/windows-process-identity.mjs';

const execFileAsync = promisify(execFile);

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

  async function bringToFront(windowHandle) {
    const script = [
      '$signature = \'[DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow(); [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr handle, out uint processId); [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint attach, uint attachTo, bool flag); [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr handle); [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr handle, int command); [DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId();\'',
      'Add-Type -MemberDefinition $signature -Name WindowFront -Namespace CovertFront | Out-Null',
      `$handle = [IntPtr]${windowHandle}`,
      '[void][CovertFront.WindowFront]::ShowWindow($handle, 9)',
      '$foreground = [CovertFront.WindowFront]::GetForegroundWindow()',
      '$foregroundThread = [CovertFront.WindowFront]::GetWindowThreadProcessId($foreground, [ref]([uint32]0))',
      '$currentThread = [CovertFront.WindowFront]::GetCurrentThreadId()',
      'if ($foregroundThread -ne $currentThread) { [void][CovertFront.WindowFront]::AttachThreadInput($currentThread, $foregroundThread, $true) }',
      'try { $ok = [CovertFront.WindowFront]::SetForegroundWindow($handle) } finally { if ($foregroundThread -ne $currentThread) { [void][CovertFront.WindowFront]::AttachThreadInput($currentThread, $foregroundThread, $false) } }',
      'Write-Output $ok'
    ].join('; ');
    await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script]);
  }

  async function activateTarget({ name, automationId, verifyName, verifyAutomationId }) {
    let lastError = null;
    const deadline = Date.now() + 45000;
    while (Date.now() < deadline) {
      const windows = await discover(appPid);
      const target = windows.find(row => row.class_name === 'Tauri Window') ?? windows.find(row => Number(row.window_handle) > 0);
      console.error('COVERT_NAV_WINDOWS=' + JSON.stringify({ rows: windows.map(row => ({ h: row.window_handle, cls: row.class_name })) }));
      if (!target) { lastError = new Error('the owned Covert window was not rediscovered'); break; }
      await bringToFront(target.window_handle);
      await new Promise(resolve => setTimeout(resolve, 300));
      try {
        return await action({ op: 'uia_action', target: JSON.stringify({
          action: 'activate', pid: appPid, window_handle: target.window_handle, lease_id: target.lease_id,
          ...(automationId ? { automation_id: automationId } : { target_name: name }),
          ...(verifyAutomationId ? { verify_automation_id: verifyAutomationId } : { verify_name: verifyName })
        }) });
      } catch (error) {
        lastError = error;
        const notReady = error?.code === 'UIA_CONTROL_NOT_UNIQUE' && Array.isArray(error?.diagnostic?.control_name) && error.diagnostic.control_name.length === 0;
        const retryable = notReady || ['UIA_FOCUS_LOST', 'UIA_LEASE_INVALID', 'UIA_WINDOW_UNAVAILABLE', 'UIA_WINDOW_STALE', 'UIA_POSTCONDITION_FAILED'].includes(error?.code);
        console.error('COVERT_NAV_ATTEMPT=' + JSON.stringify({ name: name ?? automationId, code: error?.code, retryable }));
        if (!retryable) throw error;
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    throw lastError ?? new Error(`activation did not complete for ${name ?? automationId}`);
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

    const inspectionDeadline = Date.now() + 30000;
    let inspectionDetails = null;
    while (!inspectionDetails && Date.now() < inspectionDeadline) {
      try {
        const inspected = await action({ op: 'uia_action', target: JSON.stringify({
          action: 'inspect', pid: appPid, window_handle: window.window_handle, lease_id: window.lease_id
        }) });
        const details = JSON.parse(inspected.output).details;
        if (Array.isArray(details.controls) && details.controls.length > 0) inspectionDetails = details;
      } catch (error) {
        if (!['UIA_WINDOW_UNAVAILABLE', 'UIA_WINDOW_STALE', 'UIA_LEASE_INVALID', 'UIA_WINDOW_OWNER_MISMATCH'].includes(error?.code)) throw error;
      }
      if (!inspectionDetails) await new Promise(resolve => setTimeout(resolve, 400));
    }
    assert.ok(inspectionDetails, 'the live Covert webview exposes inspectable controls');
    assert.equal(inspectionDetails.action, 'inspect');
    assert.equal(inspectionDetails.controls_truncated, false);

    await bringToFront(window.window_handle);
    const settingsActivation = await activateTarget({ name: 'SETTINGS: Operator config', verifyName: 'SEARCH SETTINGS' });
    assert.equal(settingsActivation.assertion.pass, true);
    assert.equal(settingsActivation.receipt.result, 'SUCCESS');
    console.log('COVERT_NAV_SETTINGS=PASS');
    const healthActivation = await activateTarget({ name: 'System health READ-ONLY', verifyName: 'SYSTEM HEALTH' });
    assert.equal(healthActivation.assertion.pass, true);
    assert.equal(healthActivation.receipt.result, 'SUCCESS');
    console.log('COVERT_NAV_SYSTEM_HEALTH=PASS');
    const returnActivation = await activateTarget({ name: 'COMMAND CENTER: Operator overview', verifyName: 'COMMAND CENTER' });
    assert.equal(returnActivation.assertion.pass, true);
    assert.equal(returnActivation.receipt.result, 'SUCCESS');
    console.log('COVERT_NAV_RETURN=PASS');

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
    assert.ok(records.some(event => event.type === 'desktop' && event.op === 'uia_action' && event.decision === 'executed' && event.assertion?.check === 'uia_verified:activate'));
    const missionOps = [...new Set(records.filter(event => event.type === 'desktop').map(event => event.op))];
    for (const op of missionOps) {
      assert.ok(['launch_app', 'uia_action', 'desktop.grants', 'desktop.panic'].includes(op), `unexpected desktop operation during the read-only mission: ${op}`);
    }
    console.log('COVERT_NAV_READ_ONLY_OPS=' + JSON.stringify(missionOps));
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
      if (appPid !== null) {
        const shutdownDeadline = Date.now() + 20000;
        let stackResponding = true;
        while (stackResponding && Date.now() < shutdownDeadline) {
          try {
            const response = await fetch('http://127.0.0.1:4777/api/health', { signal: AbortSignal.timeout(750) });
            stackResponding = response.status === 200;
          } catch { stackResponding = false; }
          if (stackResponding) await new Promise(resolve => setTimeout(resolve, 250));
        }
        console.log('COVERT_SHELL_STACK_SHUTDOWN=' + JSON.stringify({ responding: stackResponding }));
        assert.equal(stackResponding, false, 'the owned local stack shuts down after the shell process is terminated');
      }
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
