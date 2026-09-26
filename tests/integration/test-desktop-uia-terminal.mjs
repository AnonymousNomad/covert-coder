import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { createDesktopControl } from '../../node/src/services/desktop-control.mjs';
import { createExecutionAuthority } from '../../node/src/services/execution-authority.mjs';
import { readWindowsProcessIdentity, sameWindowsProcessIdentity } from '../../node/src/services/windows-process-identity.mjs';

const execFileAsync = promisify(execFile);
const TERMINAL_TOKEN = 'COVERT_DESKTOP_CONTROL_TEST';
const WRONG_FOCUS_TOKEN = 'COVERT_WRONG_FOCUS_MUST_NOT_APPEAR';
const valueHash = value => createHash('sha256').update(value, 'utf8').digest('hex');

async function waitForReadyFile(filePath, timeoutMs = 40000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const text = await fs.readFile(filePath, 'utf8');
      const match = /host=(\d+) terminal=(\d+)/.exec(text);
      if (match) return { hostPid: Number(match[1]), terminalPid: Number(match[2]) };
    } catch { /* not written yet */ }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  assert.fail(`terminal host ready file was not written: ${filePath}`);
}

async function closeExactWindow(pid, windowHandle) {
  const script = [
    '$signature = \'[DllImport("user32.dll")] public static extern bool PostMessage(IntPtr handle, uint message, IntPtr wParam, IntPtr lParam);\'',
    'Add-Type -MemberDefinition $signature -Name WindowClose -Namespace CovertClose | Out-Null',
    `[CovertClose.WindowClose]::PostMessage([IntPtr]${windowHandle}, 0x0010, [IntPtr]::Zero, [IntPtr]::Zero)`
  ].join('; ');
  await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script]);
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    let remaining = 'unknown';
    try { remaining = await readWindowsProcessIdentity(pid); }
    catch { remaining = 'unknown'; }
    if (remaining === null) return;
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  assert.fail(`distractor PID ${pid} did not exit after its window closed`);
}

test('Desktop Control drives an owned terminal GUI with bounded input, verified output, and exact cleanup', {
  skip: process.platform !== 'win32', timeout: 180000
}, async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'covert-desktop-uia-terminal-'));
  const records = [];
  const authority = createExecutionAuthority({ workspace, record: async event => { records.push(event); return { persisted: true }; } });
  const origin = 'http://uia-terminal-fixture.local';
  const paired = await authority.pair(authority.control.createPairing(origin), origin);
  const actor = authority.authenticate(paired.token, origin);
  let desktop = createDesktopControl({ workspace, authority });
  const sessionId = `uia-terminal-${process.pid}-${Date.now()}`;
  const fixture = path.resolve('tests/fixtures/desktop-uia-fixture.ps1');
  const terminalHost = path.resolve('tests/fixtures/desktop-uia-terminal-host.ps1');
  const ownedReadyPath = path.join(workspace, 'owned-terminal.ready');
  const foreignReadyPath = path.join(workspace, 'foreign-terminal.ready');
  const ownedLogPath = 'E:\\pip_temp\\opencode\\owned-terminal.log';
  let ownedHostPid = null;
  let ownedConsoleHostPid = null;
  let ownedTerminalPid = null;
  let distractorPid = null;
  let foreignHostPid = null;
  let foreignTerminalPid = null;
  let task = 0;
  let primaryFailure = null;

  async function execute(kind, body, callback) {
    const input = { workspace, taskId: `desktop-uia-terminal-${++task}`, kind, args: { body } };
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

  async function waitForConsoleWindow(pid, timeoutMs = 20000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const windows = await discover(pid);
      const found = windows.find(row => row.class_name === 'ConsoleWindowClass' && Number(row.window_handle) > 0);
      if (found) return found;
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    assert.fail(`owned terminal window was not discovered for PID ${pid}`);
  }

  async function focusWithRetry(pid, window, attempts = 3) {
    let lastError = null;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        const focused = await action({ op: 'uia_action', target: JSON.stringify({
          action: 'focus', pid, window_handle: window.window_handle, lease_id: window.lease_id
        }) });
        if (focused.assertion.pass === true) return;
        lastError = new Error('focus assertion failed');
      } catch (error) {
        lastError = error;
        console.error('TERMINAL_FOCUS_ATTEMPT=' + JSON.stringify({ attempt: attempt + 1, code: error?.code, input_phase: error?.diagnostic?.input_phase, focus_check: error?.diagnostic?.focus_check }));
      }
      await new Promise(resolve => setTimeout(resolve, 400));
    }
    throw lastError ?? new Error('focus did not succeed');
  }

  try {
    const grants = { enabled: true, grants: { apps: ['powershell.exe'], roots: [workspace], window_titles: [] }, ttl_minutes: 5 };
    await execute('desktop.grants', grants, handle => desktop.setGrants(grants, handle));

    const launched = await action({ op: 'launch_app', target: 'powershell.exe',
      args: ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', terminalHost,
        '-ReadyPath', ownedReadyPath, '-LogPath', ownedLogPath], show_window: true });
    const match = /owned process (\d+)/.exec(launched.output);
    assert.ok(match, launched.output);
    ownedHostPid = Number(match[1]);
    assert.ok(ownedHostPid > 0);
    const hostIdentity = await readWindowsProcessIdentity(ownedHostPid);
    assert.equal(hostIdentity?.pid, ownedHostPid, 'the terminal host launcher identity was retained');

    const ownedReady = await waitForReadyFile(ownedReadyPath);
    ownedConsoleHostPid = ownedReady.hostPid;
    ownedTerminalPid = ownedReady.terminalPid;
    const terminalIdentity = await readWindowsProcessIdentity(ownedTerminalPid);
    assert.equal(terminalIdentity?.parentPid, ownedConsoleHostPid, 'the terminal child belongs to the hosted conhost');

    let window = await waitForConsoleWindow(ownedTerminalPid);
    assert.equal(window.process_id, ownedTerminalPid);
    await focusWithRetry(ownedTerminalPid, window);

    const firstInput = await action({ op: 'uia_action', target: JSON.stringify({
      action: 'window_input', pid: ownedTerminalPid, window_handle: window.window_handle, lease_id: window.lease_id,
      text: `echo ${TERMINAL_TOKEN}`, expect_text: TERMINAL_TOKEN, submit: true
    }) });
    assert.equal(firstInput.assertion.pass, true);
    assert.equal(firstInput.receipt.result, 'SUCCESS');
    assert.equal(firstInput.receipt.ownership_state, 'ATTEMPT_OWNED_DESCENDANT_CHAIN');
    assert.equal(firstInput.receipt.parent_process_id, ownedHostPid);
    assert.equal(firstInput.receipt.ancestry_depth, 1);
    assert.equal(firstInput.receipt.postcondition, 'text_pattern_output_line');
    const firstDetails = JSON.parse(firstInput.output).details;
    assert.equal(firstDetails.output_line_matched, true);
    assert.match(firstDetails.post_text_sha256, /^[0-9a-f]{64}$/);
    console.log(`TERMINAL_INPUT_VERIFIED=${JSON.stringify({ token: TERMINAL_TOKEN, method: firstInput.receipt.postcondition, ownership: firstInput.receipt.ownership_state })}`);

    const distractorLaunch = await action({ op: 'launch_app', target: 'powershell.exe',
      args: ['-NoProfile', '-STA', '-File', fixture, '-SafeScreenshotOnly'], show_window: true });
    const distractorMatch = /owned process (\d+)/.exec(distractorLaunch.output);
    assert.ok(distractorMatch, distractorLaunch.output);
    distractorPid = Number(distractorMatch[1]);
    let distractorWindow = null;
    const distractorDeadline = Date.now() + 15000;
    while (!distractorWindow && Date.now() < distractorDeadline) {
      const windows = await discover(distractorPid);
      distractorWindow = windows.find(row => row.automation_id === 'covertDesktopFixtureWindow') ?? null;
      if (!distractorWindow) await new Promise(resolve => setTimeout(resolve, 200));
    }
    assert.ok(distractorWindow, 'the distractor fixture window was discovered');
    await focusWithRetry(distractorPid, distractorWindow);
    await assert.rejects(
      () => action({ op: 'uia_action', target: JSON.stringify({
        action: 'window_input', pid: ownedTerminalPid, window_handle: window.window_handle, lease_id: window.lease_id,
        text: `echo ${WRONG_FOCUS_TOKEN}`, expect_text: WRONG_FOCUS_TOKEN, submit: true
      }) }),
      error => {
        assert.equal(error.code, 'UIA_FOCUS_LOST');
        assert.equal(error.desktopReceipt?.result, 'FAILURE');
        assert.equal(error.diagnostic?.input_phase, 'BEFORE_INPUT');
        assert.equal(error.diagnostic?.focus_check?.foreground_matches, false);
        assert.doesNotMatch(JSON.stringify(error.desktopReceipt), new RegExp(WRONG_FOCUS_TOKEN));
        return true;
      },
      'terminal input refuses before dispatch while a different owned window holds focus'
    );
    await closeExactWindow(distractorPid, distractorWindow.window_handle);
    distractorPid = null;
    window = await waitForConsoleWindow(ownedTerminalPid);
    await focusWithRetry(ownedTerminalPid, window);
    const secondInput = await action({ op: 'uia_action', target: JSON.stringify({
      action: 'window_input', pid: ownedTerminalPid, window_handle: window.window_handle, lease_id: window.lease_id,
      text: 'echo COVERT_TERMINAL_POSTCHECK', expect_text: 'COVERT_TERMINAL_POSTCHECK', submit: true
    }) });
    const secondDetails = JSON.parse(secondInput.output).details;
    assert.equal(secondDetails.output_line_matched, true);
    assert.equal(secondDetails.pre_text_sha256, firstDetails.post_text_sha256,
      'the refused wrong-focus attempt typed zero characters into the terminal surface');
    console.log('TERMINAL_WRONG_FOCUS=ZERO_INPUT_PROVEN');

    await assert.rejects(
      () => action({ op: 'uia_action', target: JSON.stringify({
        action: 'window_input', pid: ownedTerminalPid, window_handle: window.window_handle, lease_id: window.lease_id,
        text: 'echo COVERT_TERMINAL_BOUNDED_TIMEOUT', expect_text: 'COVERT_NEVER_APPEARS_ON_THIS_TERMINAL', submit: true
      }) }),
      error => {
        assert.equal(error.code, 'UIA_POSTCONDITION_FAILED');
        assert.equal(error.desktopReceipt?.result, 'FAILURE');
        return true;
      },
      'a bounded input whose expected output never appears fails closed'
    );
    console.log('TERMINAL_BOUNDED_TIMEOUT=FAIL_CLOSED');

    // The foreign same-executable terminal is created only after the owned
    // mission completes: its own deterministic focus setup must not steal the
    // foreground while the owned mission still requires it.
    const foreign = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', terminalHost, '-ReadyPath', foreignReadyPath, '-LogPath', 'E:\\pip_temp\\opencode\\foreign-terminal.log'],
      { windowsHide: false, stdio: ['ignore', 'pipe', 'pipe'] });
    foreign.stdout.on('data', () => {});
    foreign.stderr.on('data', () => {});
    foreignHostPid = foreign.pid;
    assert.ok(foreignHostPid > 0);
    const foreignReady = await waitForReadyFile(foreignReadyPath, 90000);
    foreignTerminalPid = foreignReady.terminalPid;
    const foreignIdentity = await readWindowsProcessIdentity(foreignTerminalPid);
    assert.ok(foreignIdentity, 'the foreign terminal identity is observable');

    const cleanup = await execute('desktop.panic', {}, handle => desktop.panic(handle));
    assert.equal(cleanup.ok, true);
    assert.equal((await desktop.status()).tracked_children, 0);
    let hostGone = null;
    let consoleHostGone = null;
    let terminalGone = null;
    const goneDeadline = Date.now() + 15000;
    while (Date.now() < goneDeadline) {
      hostGone = await readWindowsProcessIdentity(ownedHostPid);
      consoleHostGone = await readWindowsProcessIdentity(ownedConsoleHostPid);
      terminalGone = await readWindowsProcessIdentity(ownedTerminalPid);
      if (hostGone === null && consoleHostGone === null && terminalGone === null) break;
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    assert.equal(hostGone, null, 'the owned terminal host is absent after panic');
    assert.equal(consoleHostGone, null, 'the owned console host is absent after panic');
    assert.equal(terminalGone, null, 'the owned terminal child is absent after panic');
    const foreignAfter = await readWindowsProcessIdentity(foreignTerminalPid);
    assert.equal(sameWindowsProcessIdentity(foreignIdentity, foreignAfter), true, 'the foreign terminal survives panic untouched');
    console.log('TERMINAL_CLEANUP=EXACT_OWNED_TREE_AND_FOREIGN_SURVIVAL');

    const serialized = JSON.stringify(records);
    assert.doesNotMatch(serialized, new RegExp(TERMINAL_TOKEN));
    assert.doesNotMatch(serialized, new RegExp(WRONG_FOCUS_TOKEN));
  } catch (error) {
    primaryFailure = error;
    console.error('TERMINAL_PRIMARY_FAILURE=' + JSON.stringify({ name: error?.name, code: error?.code, message: String(error?.message ?? '').slice(0, 300) }));
    throw error;
  } finally {
    let cleanupFailure = null;
    try {
      const panic = await execute('desktop.panic', {}, handle => desktop.panic(handle));
      assert.equal(panic.ok, true);
      assert.equal((await desktop.status()).tracked_children, 0);
    } catch (error) { cleanupFailure = error; }
    if (foreignTerminalPid) { try { process.kill(foreignTerminalPid); } catch { /* already gone */ } }
    if (foreignHostPid) { try { process.kill(foreignHostPid); } catch { /* already gone */ } }
    if (distractorPid !== null && await readWindowsProcessIdentity(distractorPid) !== null) {
      try { process.kill(distractorPid); } catch { /* exact retained fixture PID only */ }
    }
    if (ownedHostPid !== null && await readWindowsProcessIdentity(ownedHostPid) !== null) {
      try { process.kill(ownedHostPid); } catch { /* exact retained fixture PID only */ }
    }
    authority.control.close();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try { await fs.rm(workspace, { recursive: true, force: true }); cleanupFailure ??= null; break; }
      catch (error) {
        if (!['EBUSY', 'EPERM', 'ENOTEMPTY'].includes(error?.code)) { cleanupFailure = error; break; }
        await new Promise(resolve => setTimeout(resolve, 400));
        if (attempt === 4) cleanupFailure = error;
      }
    }
    if (cleanupFailure && !primaryFailure) throw cleanupFailure;
  }
});
