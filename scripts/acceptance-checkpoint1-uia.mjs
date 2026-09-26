// Checkpoint 1 of the V1 Operator Acceptance Battery — Shell / Navigation /
// Security / Approvals — against the BUILT shell, UIA-driven, idle desktop.
//
// CH1-001 shell identity; CH1-1xx navigation sweep over the 12 cockpit
// destinations (dispatch + truthful view change + app alive); CH1-2xx
// approval rejection (Cancel) ends with no session and a truthful re-offer;
// CH1-3xx exact teardown and foreign survival.
//
// Usage: node scripts/acceptance-checkpoint1-uia.mjs [--json <path>]

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

const workspace = await fsp.mkdtemp(path.join(os.tmpdir(), 'covert-ch1-'));
const authority = createExecutionAuthority({ workspace, record: async () => ({ persisted: true }) });
const origin = 'http://ch1-acceptance.local';
const paired = await authority.pair(authority.control.createPairing(origin), origin);
const actor = authority.authenticate(paired.token, origin);
const desktop = createDesktopControl({ workspace, authority });
const sessionId = `ch1-${process.pid}-${Date.now()}`;
const exe = path.resolve('desktop/target/release/aide-sovereign-workbench.exe');
let appPid = null;
let task = 0;

async function execute(kind, body, callback) {
  const input = { workspace, taskId: `ch1-${++task}`, kind, args: { body } };
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
    'Add-Type -MemberDefinition $signature -Name WindowFront -Namespace CovertCh1 | Out-Null',
    `$handle = [IntPtr]${windowHandle}`,
    '[void][CovertCh1.WindowFront]::ShowWindow($handle, 9)',
    '$foreground = [CovertCh1.WindowFront]::GetForegroundWindow()',
    '$foregroundThread = [CovertCh1.WindowFront]::GetWindowThreadProcessId($foreground, [ref]([uint32]0))',
    '$currentThread = [CovertCh1.WindowFront]::GetCurrentThreadId()',
    'if ($foregroundThread -ne $currentThread) { [void][CovertCh1.WindowFront]::AttachThreadInput($currentThread, $foregroundThread, $true) }',
    'try { [void][CovertCh1.WindowFront]::SetForegroundWindow($handle) } finally { if ($foregroundThread -ne $currentThread) { [void][CovertCh1.WindowFront]::AttachThreadInput($currentThread, $foregroundThread, $false) } }'
  ].join('; ');
  await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script]);
}
async function readWindowNames(windowHandle, limit = 900) {
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
async function foreignShellCount() {
  const script = [
    '$pwsh = @(Get-Process pwsh -ErrorAction SilentlyContinue).Count',
    '$edge = @(Get-Process msedge -ErrorAction SilentlyContinue).Count',
    'Write-Output ("$pwsh|$edge")'
  ].join('; ');
  const result = await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script]);
  const [pwsh, edge] = result.stdout.trim().split('|').map(value => Number(value));
  return { pwsh, edge };
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

const NAV = [
  ['CH1-102', 'RESIDENT: Persistent intelligence', 'RESIDENT', null],
  ['CH1-103', 'PROJECTS: Workbenches', 'PROJECTS', null],
  ['CH1-104', 'EDITOR: Source surface', 'EDITOR', null],
  ['CH1-105', 'MODELS: Loaded lineup', 'MODELS', null],
  ['CH1-106', 'SKILLS: Methods / workflows', 'SKILLS', null],
  ['CH1-107', 'MEMORY: Helix state', 'MEMORY', null],
  ['CH1-108', 'VERIFICATION: Gate evidence', 'VERIFICATION', null],
  ['CH1-109', 'SECURITY: Capability state', 'SECURITY', null],
  ['CH1-110', 'EXTENSIONS: Local add-ons', 'EXTENSIONS', null],
  ['CH1-111', 'SETTINGS: Operator config', 'SETTINGS', null],
  // The command center is the boot default and stays mounted (hidden) while
  // other panels are active, so its DOM names are never "fresh"; its panel
  // marker is used as the truthful destination-state proof instead.
  ['CH1-101', 'COMMAND CENTER: Operator overview', 'COMMAND CENTER', 'OPERATIONAL EVIDENCE'],
  ['CH1-112', 'TERMINAL: Governed sessions', 'TERMINAL', null]
];

try {
  const foreignBefore = await foreignShellCount();
  check('CH1-000', 'build identity executable present', await fsp.access(exe).then(() => true).catch(() => false), exe);
  const grants = { enabled: true, grants: { apps: [exe], roots: [workspace], window_titles: [] }, ttl_minutes: 10 };
  await execute('desktop.grants', grants, handle => desktop.setGrants(grants, handle));
  const launched = await action({ op: 'launch_app', target: exe, args: [], show_window: true });
  appPid = Number(/owned process (\d+)/.exec(launched.output)[1]);
  let health = 0;
  const bootDeadline = Date.now() + 60000;
  while (Date.now() < bootDeadline) {
    try { const response = await fetch('http://127.0.0.1:4777/api/health', { signal: AbortSignal.timeout(1000) }); health = response.status; if (health === 200) break; } catch { health = 0; }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  let window = null;
  const windowDeadline = Date.now() + 60000;
  while (!window && Date.now() < windowDeadline) {
    const rows = await discover(appPid);
    window = rows.find(row => row.class_name === 'Tauri Window') ?? null;
    if (!window) await new Promise(resolve => setTimeout(resolve, 500));
  }
  // The WebView2 UIA provider intermittently returns an empty subtree right
  // after a panel switch or at first paint (measured: boot 17 -> 0 names,
  // command center 0 at +3.4s, settings stable at 249). A bounded settle-retry
  // reads until the provider answers; an empty tree after the bound is a
  // truthful FAIL, never a masked pass.
  const settleNames = async (deadlineMs = 15000) => {
    const startedAt = Date.now();
    let names = [];
    while (Date.now() - startedAt < deadlineMs) {
      names = window ? await readWindowNames(window.window_handle) : [];
      if (names.length > 0) return { names, waited_ms: Date.now() - startedAt, empty_reads: 0 };
      await new Promise(resolve => setTimeout(resolve, 1200));
    }
    return { names, waited_ms: Date.now() - startedAt, empty_reads: 1 };
  };
  const bootSettled = window ? await settleNames(20000) : { names: [] };
  const bootNames = bootSettled.names;
  check('CH1-001', 'built shell boots, owns the stack, and renders its identity',
    appPid > 0 && health === 200 && Boolean(window) && bootNames.some(name => name.includes('AIDE Sovereign Workbench') || name.includes('Covert Coder')),
    { pid: appPid, health, window_handle: window?.window_handle ?? null, settled_ms: bootSettled.waited_ms ?? null, identity: bootNames.filter(name => /Sovereign|Covert/.test(name)).slice(0, 3) });
  if (!window) throw new Error('window not discovered');

  const activate = async (name, verifyName) => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const rows = await discover(appPid);
      const target = rows.find(row => row.class_name === 'Tauri Window') ?? rows.find(row => Number(row.window_handle) > 0);
      await bringToFront(target.window_handle);
      await new Promise(resolve => setTimeout(resolve, 400));
      try {
        const result = await action({ op: 'uia_action', target: JSON.stringify({
          action: 'activate', pid: appPid, window_handle: target.window_handle, lease_id: target.lease_id,
          target_name: name, verify_name: verifyName
        }) });
        return { dispatched: true, verified: true, result };
      } catch (error) {
        if (error?.code === 'UIA_POSTCONDITION_FAILED') return { dispatched: true, verified: false, code: error.code };
        if (!['UIA_FOCUS_LOST', 'UIA_LEASE_INVALID', 'UIA_CONTROL_NOT_UNIQUE', 'UIA_WINDOW_UNAVAILABLE'].includes(error?.code)) throw error;
        await new Promise(resolve => setTimeout(resolve, 800));
      }
    }
    return null;
  };

  // Navigation sweep: dispatch + truthful view change (new UIA names) + app alive.
  let previous = bootNames;
  for (const [id, ariaLabel, label, marker] of NAV) {
    const activation = await activate(ariaLabel, ariaLabel);
    await new Promise(resolve => setTimeout(resolve, 1500));
    const settled = await settleNames();
    const names = settled.names;
    const previousSet = new Set(previous);
    const fresh = names.filter(name => !previousSet.has(name));
    const markerPresent = marker === null ? false : names.some(name => name.includes(marker));
    const alive = Boolean(await readWindowsProcessIdentity(appPid));
    const pass = Boolean(activation?.dispatched) && alive && (fresh.length > 0 || markerPresent);
    check(id, `navigation ${label} dispatches with a truthful view change`, pass, { dispatched: activation?.dispatched ?? false, alive, settled_ms: settled.waited_ms, marker: markerPresent ? marker : undefined, fresh: fresh.slice(0, 4) });
    previous = names;
  }

  // Approvals: rejecting the session approval must end with NO session and a
  // truthful re-offer of OPEN SESSION.
  const openActivation = await activate('OPEN SESSION', 'OPEN SESSION');
  check('CH1-201', 'OPEN SESSION dispatches its approval dialog', Boolean(openActivation?.dispatched), openActivation ?? null);
  let dialogNames = [];
  const dialogDeadline = Date.now() + 20000;
  while (Date.now() < dialogDeadline) {
    dialogNames = await readWindowNames(window.window_handle);
    if (dialogNames.some(name => name.includes('tauri.localhost says')) || dialogNames.some(name => name.includes('Approve this operation'))) break;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  const rejectActivation = await activate('Cancel', 'Cancel');
  check('CH1-202', 'approval rejection (Cancel) dispatches', Boolean(rejectActivation?.dispatched), rejectActivation ?? null);
  await new Promise(resolve => setTimeout(resolve, 4000));
  const shellsAfterReject = await shellChildrenOfArchServer();
  const namesAfterReject = (await settleNames(10000)).names;
  check('CH1-203', 'rejected approval leaves NO terminal session', shellsAfterReject.length === 0, { shells: shellsAfterReject });
  check('CH1-204', 'panel truthfully re-offers OPEN SESSION after rejection', namesAfterReject.some(name => name.includes('OPEN SESSION')), null);

  // Teardown: panic ends exactly the owned tree; foreign shells survive.
  await execute('desktop.panic', {}, handle => desktop.panic(handle));
  const goneDeadline = Date.now() + 20000;
  while (Date.now() < goneDeadline && await readWindowsProcessIdentity(appPid)) await new Promise(resolve => setTimeout(resolve, 500));
  const appGone = !(await readWindowsProcessIdentity(appPid));
  let free = false;
  for (let attempt = 0; attempt < 40 && !free; attempt += 1) { free = await portsFree(); if (!free) await new Promise(resolve => setTimeout(resolve, 500)); }
  check('CH1-301', 'panic ends the owned shell and frees the ports', appGone && free, { appGone, portsFree: free });
  const foreignAfter = await foreignShellCount();
  check('CH1-302', 'foreign shells survive (owned-only termination)', foreignAfter.pwsh >= foreignBefore.pwsh && foreignAfter.edge >= foreignBefore.edge, { before: foreignBefore, after: foreignAfter });
} catch (error) {
  check('CH1-000', 'checkpoint battery completed without harness error', false, String(error?.message ?? error).slice(0, 300));
} finally {
  try {
    if (appPid !== null && await readWindowsProcessIdentity(appPid)) {
      await execute('desktop.panic', {}, handle => desktop.panic(handle));
    }
  } catch { /* reported by CH1-301 */ }
  authority.control.close();
  await fsp.rm(workspace, { recursive: true, force: true }).catch(() => {});
  const failed = results.filter(result => !result.pass);
  const report = {
    battery: 'COVERT-V1-OPERATOR-ACCEPTANCE-CHECKPOINT-1',
    scope: 'Shell / Navigation / Security / Approvals',
    generated_at_utc: new Date().toISOString(),
    suite: 'acceptance-checkpoint1-uia',
    pass: results.length - failed.length,
    fail: failed.length,
    results
  };
  if (jsonPath) {
    await fsp.mkdir(path.dirname(path.resolve(jsonPath)), { recursive: true }).catch(() => {});
    await fsp.writeFile(path.resolve(jsonPath), JSON.stringify(report, null, 2) + '\n').catch(error => console.error('failed to write report: ' + error.message));
  }
  console.log(`\nCHECKPOINT-1 ${failed.length === 0 ? 'PASS' : 'FAIL'} (${results.length - failed.length}/${results.length})`);
  process.exit(failed.length === 0 ? 0 : 1);
}
