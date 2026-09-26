import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createDesktopControl } from '../../node/src/services/desktop-control.mjs';
import { createExecutionAuthority } from '../../node/src/services/execution-authority.mjs';
import { readWindowsProcessIdentity } from '../../node/src/services/windows-process-identity.mjs';

const execFileAsync = promisify(execFile);
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

function toFileUrl(filePath) {
  return 'file:///' + filePath.replace(/\\/g, '/');
}

test('Desktop Control drives the qualified native picker through a real browser flow with exact file identity', {
  skip: process.platform !== 'win32', timeout: 300000
}, async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'covert-desktop-uia-browser-'));
  const records = [];
  const authority = createExecutionAuthority({ workspace, record: async event => { records.push(event); return { persisted: true }; } });
  const origin = 'http://uia-browser-fixture.local';
  const paired = await authority.pair(authority.control.createPairing(origin), origin);
  const actor = authority.authenticate(paired.token, origin);
  let desktop = createDesktopControl({ workspace, authority });
  const sessionId = `uia-browser-${process.pid}-${Date.now()}`;
  let edgePid = null;
  let primaryFailure = null;
  let task = 0;

  async function execute(kind, body, callback) {
    const input = { workspace, taskId: `desktop-uia-browser-${++task}`, kind, args: { body } };
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

  async function waitForWindow(pid, predicate, timeoutMs = 40000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const windows = await discover(pid);
      const found = windows.find(predicate);
      if (found) return found;
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    return null;
  }

  async function closeOwnedWindow(pid, windowHandle) {
    const script = [
      '$signature = \'[DllImport("user32.dll")] public static extern bool PostMessage(IntPtr handle, uint message, IntPtr wParam, IntPtr lParam);\'',
      'Add-Type -MemberDefinition $signature -Name WindowClose -Namespace CovertClose | Out-Null',
      `[CovertClose.WindowClose]::PostMessage([IntPtr]${windowHandle}, 0x0010, [IntPtr]::Zero, [IntPtr]::Zero)`
    ].join('; ');
    await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script]);
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
      const windows = await discover(pid).catch(() => []);
      if (!windows.some(row => row.window_handle === windowHandle)) return true;
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    return false;
  }

  async function findPageWithControl(pid, automationId, timeoutMs = 90000) {
    const started = Date.now();
    const deadline = started + timeoutMs;
    let lastError = null;
    let welcomeClosed = false;
    while (Date.now() < deadline) {
      const windows = await discover(pid);
      const frames = windows.filter(row => row.class_name === 'Chrome_WidgetWin_1');
      if (!welcomeClosed && Date.now() - started > 6000) {
        // Dismiss the Edge first-run window only after the browser settles.
        for (const frame of frames) {
          try {
            const inspected = await action({ op: 'uia_action', target: JSON.stringify({
              action: 'inspect', pid, window_handle: frame.window_handle, lease_id: frame.lease_id
            }) });
            const controls = JSON.parse(inspected.output).details.controls;
            if (controls.some(control => control.automation_id === 'got-it-button')) {
              console.error('BROWSER_WELCOME_DISMISS=' + JSON.stringify({ h: frame.window_handle }));
              welcomeClosed = await closeOwnedWindow(pid, frame.window_handle);
              break;
            }
          } catch (error) {
            lastError = error;
            if (!['UIA_WINDOW_UNAVAILABLE', 'UIA_WINDOW_STALE', 'UIA_LEASE_INVALID', 'UIA_WINDOW_OWNER_MISMATCH', 'UIA_WINDOW_NOT_UNIQUE', 'UIA_HELPER_TIMEOUT'].includes(error?.code)) throw error;
          }
        }
      }
      for (const frame of frames) {
        try {
          // Chromium builds its UIA accessibility tree for the active window;
          // activate the candidate before inspecting so the DOM is exposed.
          await bringToFront(frame.window_handle);
          await new Promise(resolve => setTimeout(resolve, 250));
          const inspected = await action({ op: 'uia_action', target: JSON.stringify({
            action: 'inspect', pid, window_handle: frame.window_handle, lease_id: frame.lease_id
          }) });
          const controls = JSON.parse(inspected.output).details.controls;
          console.error('BROWSER_PAGE_POLL=' + JSON.stringify({ h: frame.window_handle, count: controls.length, has_input: controls.some(control => control.automation_id === automationId), has_welcome: controls.some(control => control.automation_id === 'got-it-button') }));
          if (controls.some(control => control.automation_id === automationId)) return { window: frame, controls };
        } catch (error) {
          lastError = error;
          if (!['UIA_WINDOW_UNAVAILABLE', 'UIA_WINDOW_STALE', 'UIA_LEASE_INVALID', 'UIA_WINDOW_OWNER_MISMATCH', 'UIA_WINDOW_NOT_UNIQUE', 'UIA_HELPER_TIMEOUT'].includes(error?.code)) throw error;
        }
      }
      await new Promise(resolve => setTimeout(resolve, 400));
    }
    if (lastError) throw lastError;
    return null;
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

  function valueHash(value) {
    return createHash('sha256').update(value, 'utf8').digest('hex');
  }

  const stagedPage = path.join(workspace, 'browser-fixture.html');
  const uploadName = 'browser-upload.txt';
  const uploadContents = 'COVERT-BROWSER-PICKER-FIXTURE';
  const ownedProfile = path.join(workspace, 'owned-edge-profile');

  try {
    await fs.copyFile(path.resolve('tests/fixtures/covert-browser-picker-fixture.html'), stagedPage);
    await fs.writeFile(path.join(workspace, uploadName), uploadContents, { encoding: 'utf8', flag: 'wx' });
    const uploadBytes = await fs.readFile(path.join(workspace, uploadName));
    const uploadSha256 = createHash('sha256').update(uploadBytes).digest('hex');

    const grants = { enabled: true, grants: { apps: [EDGE], roots: [workspace], window_titles: [] }, ttl_minutes: 5 };
    await execute('desktop.grants', grants, handle => desktop.setGrants(grants, handle));

    // Foreign same-executable control: every Edge process that already exists
    // before the mission must survive the owned launch and panic unchanged.
    const foreignEdges = [];
    const foreignList = await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', 'Get-Process msedge -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id']);
    for (const value of String(foreignList.stdout).trim().split(/\r?\n/).filter(Boolean).map(Number)) {
      const identity = Number.isSafeInteger(value) && value > 0 ? await readWindowsProcessIdentity(value) : null;
      if (identity) foreignEdges.push(identity);
    }
    console.log('BROWSER_FOREIGN_BASELINE=' + JSON.stringify({ count: foreignEdges.length, pids: foreignEdges.map(identity => identity.pid) }));

    let launched = null;
    let edgeIdentity = null;
    for (let launchAttempt = 0; launchAttempt < 2 && !launched; launchAttempt += 1) {
      const attempt = await action({ op: 'launch_app', target: EDGE,
        args: [`--user-data-dir=${ownedProfile}`, '--no-first-run', '--no-default-browser-check', '--new-window', toFileUrl(stagedPage)],
        show_window: true });
      const match = /owned process (\d+)/.exec(attempt.output);
      assert.ok(match, attempt.output);
      edgePid = Number(match[1]);
      const settleDeadline = Date.now() + 15000;
      while (Date.now() < settleDeadline) {
        const identity = await readWindowsProcessIdentity(edgePid);
        if (identity === null) break;
        let windows = [];
        try { windows = await discover(edgePid); }
        catch (error) { if (error?.code !== 'UIA_TARGET_NOT_OWNED') throw error; }
        if (windows.some(row => row.class_name === 'Chrome_WidgetWin_1')) { edgeIdentity = identity; launched = attempt; break; }
        await new Promise(resolve => setTimeout(resolve, 400));
      }
      if (!launched) {
        console.error('BROWSER_LAUNCH_RETRY=' + JSON.stringify({ pid: edgePid, identity_present: (await readWindowsProcessIdentity(edgePid)) !== null }));
        edgePid = null;
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }
    assert.ok(launched, 'the owned browser process survived startup and exposed a window');
    assert.equal(edgeIdentity?.pid, edgePid, 'the owned browser process identity was retained');
    console.log('BROWSER_LAUNCHED=' + JSON.stringify({ pid: edgePid, foreign_count: foreignEdges.length }));

    const pageWindow = await waitForWindow(edgePid, row => row.class_name === 'Chrome_WidgetWin_1');
    assert.ok(pageWindow, 'the owned browser window was discovered');
    assert.equal(pageWindow.process_id, edgePid);

    const pageReady = await findPageWithControl(edgePid, 'fileInput');
    assert.ok(pageReady, 'the local fixture page exposes the file input control');
    let page = pageReady.window;

    let activation = null;
    let activationError = null;
    for (let attempt = 0; attempt < 3 && !activation; attempt += 1) {
      const current = await findPageWithControl(edgePid, 'fileInput', 20000);
      if (!current) { activationError = new Error('the fixture page was not re-discovered'); break; }
      page = current.window;
      await bringToFront(page.window_handle);
      await new Promise(resolve => setTimeout(resolve, 400));
      try {
        activation = await action({ op: 'uia_action', target: JSON.stringify({
          action: 'activate', pid: edgePid, window_handle: page.window_handle, lease_id: page.lease_id,
          automation_id: 'fileInput', verify_automation_id: 'fileInput', expect_new_window_class: '#32770'
        }) });
      } catch (error) {
        activationError = error;
        if (!['UIA_FOCUS_LOST', 'UIA_LEASE_INVALID'].includes(error?.code)) throw error;
      }
    }
    assert.ok(activation, `the page control activated${activationError ? ': ' + activationError.message : ''}`);
    assert.equal(activation.assertion.pass, true);
    assert.equal(activation.receipt.result, 'SUCCESS');
    assert.equal(activation.receipt.ownership_state, 'ATTEMPT_OWNED');
    const activationDetails = JSON.parse(activation.output).details;
    assert.equal(activationDetails.activate_dispatch, 'INVOKE_PATTERN');
    assert.ok(Number(activationDetails.new_window_handle) > 0, 'a native picker dialog was observed after activation');
    const dialogPid = Number(activationDetails.new_window_pid);
    assert.ok(Number.isSafeInteger(dialogPid) && dialogPid > 0, 'the observed picker dialog owner is reported');
    console.log('BROWSER_PICKER_OPENED=' + JSON.stringify({ dispatch: activationDetails.activate_dispatch, dialog: activationDetails.new_window_handle, dialog_pid: dialogPid }));

    const dialogWindow = await waitForWindow(dialogPid, row => row.class_name === '#32770');
    assert.ok(dialogWindow, 'the native picker dialog is discoverable under its owned descendant process');
    console.log('BROWSER_DIALOG_OWNERSHIP=' + JSON.stringify({ dialog_pid: dialogPid, browser_pid: edgePid }));

    const requestForSelection = (dialog, root, filePath) => ({
      action: 'select_file', pid: dialogPid, window_handle: dialog.window_handle, lease_id: dialog.lease_id,
      selection_root: root, file_path: filePath,
      result_pid: edgePid, result_window_handle: page.window_handle, result_lease_id: page.lease_id,
      verify_file_automation_id: 'fixtureSelectedPath', verify_sha256_automation_id: 'fixtureSelectedSha256'
    });

    const outsideRoot = path.resolve(workspace, '..', `not-granted-${path.basename(workspace)}`);
    await assert.rejects(
      () => action({ op: 'uia_action', target: JSON.stringify(requestForSelection(dialogWindow, outsideRoot, path.join(outsideRoot, uploadName))) }),
      { code: 'PATH_NOT_GRANTED' },
      'a selection outside the granted root is refused before native picker input'
    );

    let selection = null;
    let selectionError = null;
    for (let attempt = 0; attempt < 3 && !selection; attempt += 1) {
      const dialog = await waitForWindow(dialogPid, row => row.class_name === '#32770', 15000);
      if (!dialog) { selectionError = new Error('the picker dialog disappeared before selection'); break; }
      await bringToFront(dialog.window_handle);
      await new Promise(resolve => setTimeout(resolve, 300));
      try {
        selection = await action({ op: 'uia_action', target: JSON.stringify(requestForSelection(dialog, workspace, path.join(workspace, uploadName))) });
      } catch (error) {
        selectionError = error;
        console.error('BROWSER_SELECT_ATTEMPT=' + JSON.stringify({ attempt: attempt + 1, code: error?.code, phase: error?.diagnostic?.input_phase ?? null, stage: error?.diagnostic?.focus_check?.stage ?? null }));
        if (!['UIA_FOCUS_LOST', 'UIA_LEASE_INVALID', 'UIA_FILE_PICKER_CONTROL_STALE', 'UIA_WINDOW_STALE'].includes(error?.code)) throw error;
      }
    }
    assert.ok(selection, `the picker selection completed${selectionError ? ': ' + selectionError.message : ''}`);
    assert.equal(selection.assertion.pass, true);
    assert.equal(selection.receipt.result, 'SUCCESS');
    const selectionDetails = JSON.parse(selection.output).details;
    assert.equal(selectionDetails.file_sha256, uploadSha256);
    assert.equal(selectionDetails.file_bytes, uploadBytes.length);
    assert.equal(selectionDetails.filename_focus_verified, true);
    assert.equal(selectionDetails.input_path_readback_verified, true);
    assert.equal(selectionDetails.path_containment, 'PASS');
    assert.equal(selectionDetails.dialog_closed, true);
    assert.equal(selectionDetails.caller_path_receipt_verified, true);
    assert.equal(selectionDetails.caller_sha256_receipt_verified, true);
    assert.equal(selectionDetails.open_dispatch, 'BM_CLICK_EXACT_OWNED_BUTTON');
    console.log('BROWSER_PICKER_SELECTION=' + JSON.stringify({
      file_sha256: selectionDetails.file_sha256, caller_path_receipt: selectionDetails.caller_path_receipt_verified,
      caller_sha256_receipt: selectionDetails.caller_sha256_receipt_verified, dialog_closed: selectionDetails.dialog_closed,
      path_containment: selectionDetails.path_containment
    }));

    const cleanup = await execute('desktop.panic', {}, handle => desktop.panic(handle));
    assert.equal(cleanup.ok, true);
    assert.equal((await desktop.status()).tracked_children, 0);
    assert.equal(await readWindowsProcessIdentity(edgePid), null, 'the owned browser process is absent after panic');
    let foreignSurvivors = 0;
    for (const identity of foreignEdges) {
      const after = await readWindowsProcessIdentity(identity.pid);
      if (after && after.createdAtUtc === identity.createdAtUtc && after.parentPid === identity.parentPid && after.executablePath === identity.executablePath) foreignSurvivors += 1;
    }
    assert.equal(foreignSurvivors, foreignEdges.length, 'every pre-existing browser process survives panic unchanged');
    console.log('BROWSER_CLEANUP=EXACT_OWNED_AND_FOREIGN_SURVIVAL=' + JSON.stringify({ foreign_baseline: foreignEdges.length, foreign_survivors: foreignSurvivors }));

    const serialized = JSON.stringify(records);
    assert.doesNotMatch(serialized, new RegExp(uploadContents));
    assert.equal(valueHash(uploadContents).length, 64);
  } catch (error) {
    primaryFailure = error;
    console.error('BROWSER_PRIMARY_FAILURE=' + JSON.stringify({ name: error?.name, code: error?.code, message: String(error?.message ?? '').slice(0, 300) }));
    throw error;
  } finally {
    let cleanupFailure = null;
    try {
      const panic = await execute('desktop.panic', {}, handle => desktop.panic(handle));
      assert.equal(panic.ok, true);
      assert.equal((await desktop.status()).tracked_children, 0);
    } catch (error) { cleanupFailure = error; }
    authority.control.close();
    for (let attempt = 0; attempt < 6; attempt += 1) {
      try { await fs.rm(workspace, { recursive: true, force: true }); cleanupFailure = null; break; }
      catch (error) {
        if (!['EBUSY', 'EPERM', 'ENOTEMPTY'].includes(error?.code)) { cleanupFailure = error; break; }
        await new Promise(resolve => setTimeout(resolve, 500));
        if (attempt === 5) cleanupFailure = error;
      }
    }
    if (cleanupFailure && !primaryFailure) throw cleanupFailure;
  }
});
