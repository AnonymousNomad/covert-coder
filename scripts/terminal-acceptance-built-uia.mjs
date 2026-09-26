// Built-shell embedded terminal battery (UIA-driven) — runs on an IDLE desktop.
//
// The CDP route is blocked because Tauri v2 passes explicit additionalBrowserArgs
// that override WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS, so the built shell is
// driven through Desktop Control's own UIA actions (act/activate/window_input)
// plus bounded read-only UIA text dumps for panel state. Focus-gated actions
// fail closed by design; run only while the operator desktop is idle.
//
// Usage: node scripts/terminal-acceptance-built-uia.mjs [--json <path>]

import { execFile } from 'node:child_process';
import { promises as fsp } from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { createDesktopControl } from '../node/src/services/desktop-control.mjs';
import { createExecutionAuthority } from '../node/src/services/execution-authority.mjs';
import { readWindowsProcessIdentity } from '../node/src/services/windows-process-identity.mjs';

const execFileAsync = promisify(execFile);
const args = process.argv.slice(2);
const jsonIndex = args.indexOf('--json');
const jsonPath = jsonIndex >= 0 ? args[jsonIndex + 1] : null;
const results = [];
const check = (id, description, pass, detail) => {
  results.push({ id, description, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'} ${id} ${description}${detail === undefined ? '' : ' :: ' + JSON.stringify(detail).slice(0, 300)}`);
};

const workspace = await fsp.mkdtemp(path.join(os.tmpdir(), 'covert-terminal-built-'));
const authority = createExecutionAuthority({ workspace, record: async () => ({ persisted: true }) });
const origin = 'http://terminal-built-uia.local';
const paired = await authority.pair(authority.control.createPairing(origin), origin);
const actor = authority.authenticate(paired.token, origin);
const desktop = createDesktopControl({ workspace, authority });
const sessionId = `terminal-built-${process.pid}-${Date.now()}`;
const exe = path.resolve('desktop/target/release/aide-sovereign-workbench.exe');
let appPid = null;
let task = 0;

async function execute(kind, body, callback) {
  const input = { workspace, taskId: `terminal-built-${++task}`, kind, args: { body } };
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
    'try { [void][CovertFront.WindowFront]::SetForegroundWindow($handle) } finally { if ($foregroundThread -ne $currentThread) { [void][CovertFront.WindowFront]::AttachThreadInput($currentThread, $foregroundThread, $false) } }'
  ].join('; ');
  await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script]);
}
async function readWindowNames(windowHandle, limit = 260) {
  const script = [
    'Add-Type -AssemblyName UIAutomationClient',
    'Add-Type -AssemblyName UIAutomationTypes',
    `$root = [System.Windows.Automation.AutomationElement]::FromHandle([IntPtr]${windowHandle})`,
    '$all = $root.FindAll([System.Windows.Automation.TreeScope]::Subtree, [System.Windows.Automation.Condition]::TrueCondition)',
    `$names = @(); for ($i = 0; $i -lt $all.Count -and $i -lt ${limit}; $i++) { $name = ""; try { $name = [string]$all[$i].Current.Name } catch { }; if ($name) { $names += $name.Substring(0, [Math]::Min(120, $name.Length)) } }`,
    '$names | ConvertTo-Json -Compress'
  ].join('; ');
  const result = await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { maxBuffer: 4 * 1024 * 1024 });
  try { return (JSON.parse(result.stdout.trim()) ?? []); } catch { return []; }
}
async function shellChildrenOfArchServer() {
  // The arch server pid owns port 4778; its pwsh/cmd children are the terminal shells.
  const script = [
    '$listener = Get-NetTCPConnection -State Listen -LocalPort 4778 -ErrorAction SilentlyContinue | Select-Object -First 1',
    'if ($null -eq $listener) { Write-Output "[]"; exit 0 }',
    '$archPid = $listener.OwningProcess',
    '$children = Get-CimInstance Win32_Process -Filter "ParentProcessId=$archPid" -ErrorAction SilentlyContinue | Where-Object { $_.Name -in @("pwsh.exe","powershell.exe","cmd.exe") } | Select-Object ProcessId, Name',
    '$children | ConvertTo-Json -Compress'
  ].join('; ');
  const result = await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script]);
  try { const parsed = JSON.parse(result.stdout.trim()); return Array.isArray(parsed) ? parsed : parsed ? [parsed] : []; } catch { return []; }
}

const portsFree = async () => {
  for (const port of [4777, 4778, 4779]) {
    const busy = await new Promise(resolve => {
      const socket = net.connect({ host: '127.0.0.1', port }, () => { socket.destroy(); resolve(true); });
      socket.on('error', () => resolve(false));
      socket.setTimeout(400, () => { socket.destroy(); resolve(false); });
    });
    if (busy) return false;
  }
  return true;
};

try {
  check('BUILT-000', 'build identity executable present', await fsp.access(exe).then(() => true).catch(() => false), exe);
  const grants = { enabled: true, grants: { apps: [exe], roots: [workspace], window_titles: [] }, ttl_minutes: 10 };
  await execute('desktop.grants', grants, handle => desktop.setGrants(grants, handle));
  const launched = await action({ op: 'launch_app', target: exe, args: [], show_window: true });
  appPid = Number(/owned process (\d+)/.exec(launched.output)[1]);
  check('BUILT-001', 'owned built shell launched', appPid > 0, { pid: appPid });

  // Boot: health + window
  let health = 0;
  const bootDeadline = Date.now() + 60000;
  while (Date.now() < bootDeadline) {
    try { const response = await fetch('http://127.0.0.1:4777/api/health', { signal: AbortSignal.timeout(1000) }); health = response.status; if (health === 200) break; } catch { health = 0; }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  check('BUILT-002', 'owned stack reaches facade health', health === 200, { health });
  let window = null;
  const windowDeadline = Date.now() + 60000;
  while (!window && Date.now() < windowDeadline) {
    const rows = await discover(appPid);
    window = rows.find(row => row.class_name === 'Tauri Window') ?? null;
    if (!window) await new Promise(resolve => setTimeout(resolve, 500));
  }
  check('BUILT-003', 'owned shell window discovered', Boolean(window), window ?? null);
  if (!window) throw new Error('window not discovered');

  // Terminal panel
  await bringToFront(window.window_handle);
  const activate = async (name, verifyName) => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const rows = await discover(appPid);
      const target = rows.find(row => row.class_name === 'Tauri Window') ?? rows.find(row => Number(row.window_handle) > 0);
      await bringToFront(target.window_handle);
      await new Promise(resolve => setTimeout(resolve, 400));
      try {
        return await action({ op: 'uia_action', target: JSON.stringify({
          action: 'activate', pid: appPid, window_handle: target.window_handle, lease_id: target.lease_id,
          target_name: name, verify_name: verifyName
        }) });
      } catch (error) {
        if (!['UIA_FOCUS_LOST', 'UIA_LEASE_INVALID', 'UIA_POSTCONDITION_FAILED', 'UIA_CONTROL_NOT_UNIQUE', 'UIA_WINDOW_UNAVAILABLE'].includes(error?.code)) throw error;
        await new Promise(resolve => setTimeout(resolve, 800));
      }
    }
    return null;
  };
  const terminalNav = await activate('TERMINAL: Governed sessions', 'TERMINAL');
  check('BUILT-004', 'TERMINAL navigation activates', Boolean(terminalNav), null);
  let names = [];
  const providerDeadline = Date.now() + 60000;
  while (Date.now() < providerDeadline) {
    names = await readWindowNames(window.window_handle);
    if (names.some(name => name.includes('OPEN SESSION')) || names.some(name => /Provider probe failed|timed out/.test(name))) break;
    await new Promise(resolve => setTimeout(resolve, 1500));
  }
  check('BUILT-005', 'provider probe resolves and OPEN SESSION is offered', names.some(name => name.includes('AVAILABLE')) && names.some(name => name.includes('OPEN SESSION')), { available: names.some(name => name.includes('AVAILABLE')), open: names.some(name => name.includes('OPEN SESSION')) });

  const shellsBefore = await shellChildrenOfArchServer();
  const openActivation = await activate('OPEN SESSION', 'OPEN SESSION');
  check('BUILT-006', 'OPEN SESSION activation dispatches', Boolean(openActivation), null);

  // Native approval dialog (WebView2 confirm) under the owned process.
  let dialog = null;
  const dialogDeadline = Date.now() + 30000;
  while (!dialog && Date.now() < dialogDeadline) {
    const rows = await discover(appPid);
    dialog = rows.find(row => row.class_name === '#32770') ?? null;
    if (!dialog) await new Promise(resolve => setTimeout(resolve, 400));
  }
  check('BUILT-007', 'approval dialog appears under the owned shell', Boolean(dialog), dialog ? { handle: dialog.window_handle } : null);
  if (dialog) {
    await bringToFront(dialog.window_handle);
    const okActivation = await activate('OK', 'OK').catch(() => null);
    check('BUILT-008', 'approval dialog accepted once', Boolean(okActivation), null);
    await new Promise(resolve => setTimeout(resolve, 6000));
  }
  const shellsDuring = await shellChildrenOfArchServer();
  check('BUILT-009', 'real owned shell process exists for the session', shellsDuring.length > shellsBefore.length, { before: shellsBefore.length, during: shellsDuring.length, shells: shellsDuring });

  // Panel state: STOP SESSION means the session is active.
  const stopDeadline = Date.now() + 30000;
  while (Date.now() < stopDeadline) {
    names = await readWindowNames(window.window_handle);
    if (names.some(name => name.includes('STOP SESSION'))) break;
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  check('BUILT-010', 'session reaches the active state (STOP SESSION offered)', names.some(name => name.includes('STOP SESSION')), null);

  // Canonical stop, then cleanup accounting.
  const stopActivation = await activate('STOP SESSION', 'STOP SESSION');
  check('BUILT-011', 'STOP SESSION activation dispatches', Boolean(stopActivation), null);
  await new Promise(resolve => setTimeout(resolve, 8000));
  const shellsAfter = await shellChildrenOfArchServer();
  check('BUILT-012', 'owned shell process count returns to zero after stop', shellsAfter.length === 0, { after: shellsAfter.length, shells: shellsAfter });
} catch (error) {
  check('BUILT-000', 'battery completed without harness error', false, String(error?.message ?? error).slice(0, 300));
} finally {
  try {
    if (appPid !== null && await readWindowsProcessIdentity(appPid)) {
      await execute('desktop.panic', {}, handle => desktop.panic(handle));
    }
    if (appPid !== null) {
      const goneDeadline = Date.now() + 20000;
      while (Date.now() < goneDeadline && await readWindowsProcessIdentity(appPid)) await new Promise(resolve => setTimeout(resolve, 500));
    }
  } catch { /* report below */ }
  for (let attempt = 0; attempt < 40 && !(await portsFree()); attempt += 1) await new Promise(resolve => setTimeout(resolve, 500));
  const leaked = await shellChildrenOfArchServer();
  check('BUILT-014', 'ports free and zero owned terminal shells after teardown', (await portsFree()) && leaked.length === 0, { leaked: leaked.length });
  authority.control.close();
  await fsp.rm(workspace, { recursive: true, force: true }).catch(() => {});
  const failed = results.filter(result => !result.pass);
  const report = {
    battery: 'EMBEDDED-TERMINAL-V1-BUILT-UIA',
    generated_at_utc: new Date().toISOString(),
    suite: 'terminal-acceptance-built-uia',
    pass: results.length - failed.length,
    fail: failed.length,
    results
  };
  if (jsonPath) {
    await fsp.mkdir(path.dirname(path.resolve(jsonPath)), { recursive: true }).catch(() => {});
    await fsp.writeFile(path.resolve(jsonPath), JSON.stringify(report, null, 2) + '\n').catch(error => console.error('failed to write report: ' + error.message));
  }
  console.log(`\nTERMINAL-BUILT-UIA ${failed.length === 0 ? 'PASS' : 'FAIL'} (${results.length - failed.length}/${results.length})`);
  process.exit(failed.length === 0 ? 0 : 1);
}
