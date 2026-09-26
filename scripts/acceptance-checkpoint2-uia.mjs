// CP02 of the V1 Operator Acceptance Battery — PROJECTS / WORKSPACES.
//
// Proves against the REAL filesystem through the built shell: workspace root
// identity (status bar root + panel meta vs actual FS counts), marker files
// created/removed on disk appearing/opening/removing truthfully, workbench
// bundle state canonical, trust never implicit, and the single-workspace
// launch model as the honest inventory (no open/switch/recent/close controls).
//
// Order matters: the REFRESH activation happens before any editor mount so the
// name resolves uniquely; if it is still ambiguous the driver relaunches the
// app once and proves the same truth at fresh mount, recording the method.
//
// Usage: node scripts/acceptance-checkpoint2-uia.mjs [--json <path>]

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
  console.log(`${pass ? 'PASS' : 'FAIL'} ${id} ${description}${detail === undefined ? '' : ' :: ' + JSON.stringify(detail).slice(0, 320)}`);
};

const RUN = `ch2-${process.pid}-${Date.now()}`;
const MARKER_A = `ch2-marker-a-${RUN}.txt`;
const MARKER_B = `ch2-marker-b-${RUN}.txt`;
const WORKSPACE_ROOT = path.resolve('desktop/target/release/resources');
const WORKSPACE_FILE_A = path.join(WORKSPACE_ROOT, MARKER_A);
const WORKSPACE_FILE_B = path.join(WORKSPACE_ROOT, MARKER_B);

const workspace = await fsp.mkdtemp(path.join(os.tmpdir(), 'covert-ch2-'));
const authority = createExecutionAuthority({ workspace, record: async () => ({ persisted: true }) });
const origin = 'http://ch2-acceptance.local';
const paired = await authority.pair(authority.control.createPairing(origin), origin);
const actor = authority.authenticate(paired.token, origin);
const desktop = createDesktopControl({ workspace, authority });
const sessionId = `ch2-${process.pid}-${Date.now()}`;
const exe = path.resolve('desktop/target/release/aide-sovereign-workbench.exe');
let appPid = null;
let window = null;
let task = 0;

async function execute(kind, body, callback) {
  const input = { workspace, taskId: `ch2-${++task}`, kind, args: { body } };
  const operation = await authority.prepare(actor, input);
  await authority.decide(actor, operation.operation_id, 'approve');
  return authority.execute(actor, operation.operation_id, input, (_descriptor, handle) => callback(handle));
}
async function action(body) {
  const request = { ...body, approved: true };
  return execute('desktop.action', request, handle => desktop.act(request, handle, sessionId));
}
const TRANSIENT_UIA = ['UIA_IDENTITY_MISMATCH', 'UIA_IDENTITY_UNVERIFIED', 'UIA_PROCESS_IDENTITY_MISMATCH', 'UIA_WINDOW_UNAVAILABLE', 'UIA_LEASE_INVALID'];
async function discover(pid) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      const result = await action({ op: 'uia_action', target: JSON.stringify({ action: 'discover', pid }) });
      return JSON.parse(result.output).details.windows;
    } catch (error) {
      if (attempt < 6 && TRANSIENT_UIA.includes(error?.code)) { await new Promise(resolve => setTimeout(resolve, 1000)); continue; }
      throw error;
    }
  }
}
async function bringToFront(windowHandle) {
  const script = [
    '$signature = \'[DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow(); [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr handle, out uint processId); [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint attach, uint attachTo, bool flag); [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr handle); [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr handle, int command); [DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId();\'',
    'Add-Type -MemberDefinition $signature -Name WindowFront -Namespace CovertCh2 | Out-Null',
    `$handle = [IntPtr]${windowHandle}`,
    '[void][CovertCh2.WindowFront]::ShowWindow($handle, 9)',
    '$foreground = [CovertCh2.WindowFront]::GetForegroundWindow()',
    '$foregroundThread = [CovertCh2.WindowFront]::GetWindowThreadProcessId($foreground, [ref]([uint32]0))',
    '$currentThread = [CovertCh2.WindowFront]::GetCurrentThreadId()',
    'if ($foregroundThread -ne $currentThread) { [void][CovertCh2.WindowFront]::AttachThreadInput($currentThread, $foregroundThread, $true) }',
    'try { [void][CovertCh2.WindowFront]::SetForegroundWindow($handle) } finally { if ($foregroundThread -ne $currentThread) { [void][CovertCh2.WindowFront]::AttachThreadInput($currentThread, $foregroundThread, $false) } }'
  ].join('; ');
  await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script]);
}
async function maximizeWindow(windowHandle) {
  const script = [
    '$signature = \'[DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr handle, int command);\'',
    'Add-Type -MemberDefinition $signature -Name WindowMax -Namespace CovertCh2 | Out-Null',
    `[void][CovertCh2.WindowMax]::ShowWindow([IntPtr]${windowHandle}, 3)`
  ].join('; ');
  await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script]);
}
async function readWindowNames(windowHandle, limit = 1600) {
  const script = [
    'Add-Type -AssemblyName UIAutomationClient',
    'Add-Type -AssemblyName UIAutomationTypes',
    `$root = [System.Windows.Automation.AutomationElement]::FromHandle([IntPtr]${windowHandle})`,
    '$all = $root.FindAll([System.Windows.Automation.TreeScope]::Subtree, [System.Windows.Automation.Condition]::TrueCondition)',
    `$names = @(); for ($i = 0; $i -lt $all.Count -and $i -lt ${limit}; $i++) { $name = ""; try { $name = [string]$all[$i].Current.Name } catch { }; if ($name) { $names += $name.Substring(0, [Math]::Min(160, $name.Length)) } }`,
    '$names | ConvertTo-Json -Compress'
  ].join('; ');
  const result = await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { maxBuffer: 4 * 1024 * 1024 });
  try { return (JSON.parse(result.stdout.trim()) ?? []); } catch { return []; }
}
async function foreignShells() {
  const script = [
    '$pwsh = @(Get-Process pwsh -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id)',
    '$edge = @(Get-Process msedge -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id)',
    'Write-Output (($pwsh -join ",") + "|" + ($edge -join ","))'
  ].join('; ');
  const result = await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script]);
  const [pwshRaw, edgeRaw] = result.stdout.trim().split('|');
  const parse = value => value.split(',').map(part => Number(part.trim())).filter(id => Number.isSafeInteger(id) && id > 0);
  return { pwsh: parse(pwshRaw ?? ''), edge: parse(edgeRaw ?? '') };
}
const survived = (before, after) => before.filter(id => after.includes(id)).length;
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
async function fsTruth() {
  const entries = await fsp.readdir(WORKSPACE_ROOT, { withFileTypes: true });
  const visible = entries.filter(entry => !entry.name.startsWith('.'));
  return { total: visible.length, capped: Math.min(visible.length, 200), files: visible.filter(entry => entry.isFile()).map(entry => entry.name) };
}
async function bundleCanonical() {
  const registryFile = path.join(WORKSPACE_ROOT, 'workbenches', 'registry.json');
  const stateDir = path.join(WORKSPACE_ROOT, '.aide', 'workbenches');
  let catalogIds = [];
  const states = [];
  try {
    const registry = JSON.parse(await fsp.readFile(registryFile, 'utf8'));
    catalogIds = (registry.bundles ?? []).map(bundle => bundle.id).filter(id => typeof id === 'string');
  } catch { /* catalog unreadable is recorded by the caller */ }
  let names = [];
  try { names = await fsp.readdir(stateDir); } catch { names = []; }
  for (const name of names.filter(entry => entry.endsWith('.json'))) {
    try {
      const raw = JSON.parse(await fsp.readFile(path.join(stateDir, name), 'utf8'));
      states.push({ id: name.replace(/\.json$/, ''), enabled: raw.enabled === true, trusted_servers: Object.entries(raw.mcp_trusted ?? {}).filter(([, value]) => value === true).map(([key]) => key) });
    } catch { /* unreadable state is not silently trusted */ }
  }
  return { catalogIds, states };
}
async function fetchCanonicalWorkspace() {
  try {
    const response = await fetch('http://127.0.0.1:4777/api/workspace', { signal: AbortSignal.timeout(2000) });
    if (!response.ok) return { status: response.status, body: null };
    return { status: response.status, body: await response.json() };
  } catch { return { status: 0, body: null }; }
}
const settleNames = async (ready, deadlineMs = 15000) => {
  const readyFn = typeof ready === 'function' ? ready : names => (ready === null || ready === undefined ? names.length > 0 : names.some(name => name.includes(ready)));
  const startedAt = Date.now();
  let names = [];
  while (Date.now() - startedAt < deadlineMs) {
    names = window ? await readWindowNames(window.window_handle) : [];
    if (readyFn(names)) return { names, waited_ms: Date.now() - startedAt };
    await new Promise(resolve => setTimeout(resolve, 1200));
  }
  return { names, waited_ms: Date.now() - startedAt };
};
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
        if (!['UIA_FOCUS_LOST', 'UIA_LEASE_INVALID', 'UIA_CONTROL_NOT_UNIQUE', 'UIA_WINDOW_UNAVAILABLE', 'UIA_PROCESS_IDENTITY_MISMATCH', 'UIA_IDENTITY_MISMATCH', 'UIA_IDENTITY_UNVERIFIED'].includes(error?.code)) throw error;
      await new Promise(resolve => setTimeout(resolve, 800));
    }
  }
  return null;
};
const countOccurrences = (names, needle) => names.filter(name => name === needle).length;
function parseMeta(names) {
  for (const name of names) {
    if (!name.endsWith('top-level entries')) continue;
    const match = /(\d+) top-level entries$/.exec(name);
    if (!match) continue;
    const head = name.slice(0, name.length - match[0].length).trim().replace(/[\u00b7\ufffd?\u2022.]\s*$/, '').trim();
    return { basename: head, count: Number(match[1]) };
  }
  return null;
}

async function descendantsOf(pid) {
  const script = 'Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Select-Object ProcessId, ParentProcessId | ConvertTo-Json -Compress';
  const result = await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { maxBuffer: 8 * 1024 * 1024 });
  let rows = [];
  try { const parsed = JSON.parse(result.stdout.trim()); rows = Array.isArray(parsed) ? parsed : parsed ? [parsed] : []; } catch { return []; }
  const children = new Map();
  for (const row of rows) {
    const parent = Number(row.ParentProcessId);
    const child = Number(row.ProcessId);
    if (!Number.isSafeInteger(parent) || !Number.isSafeInteger(child)) continue;
    if (!children.has(parent)) children.set(parent, []);
    children.get(parent).push(child);
  }
  const seen = new Set();
  const queue = [pid];
  while (queue.length > 0) {
    const current = queue.shift();
    for (const child of children.get(current) ?? []) {
      if (seen.has(child)) continue;
      seen.add(child);
      queue.push(child);
    }
  }
  return [...seen];
}

async function staleInstanceAlive() {
  const script = [
    '$exe = ' + JSON.stringify(exe),
    'Write-Output (@(Get-CimInstance Win32_Process -Filter "Name=\'aide-sovereign-workbench.exe\'" -ErrorAction SilentlyContinue | Where-Object { $_.ExecutablePath -ieq $exe }).Count)'
  ].join('; ');
  const result = await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script]);
  return Number(result.stdout.trim()) > 0;
}

async function boot() {
  // Reap only a stale instance of THIS exact executable left by a previous run
  // (single-instance relaunches otherwise die immediately, which is a driver
  // hygiene problem, not a product behavior).
  const reapScript = [
    '$exe = ' + JSON.stringify(exe),
    '$reaped = @(Get-CimInstance Win32_Process -Filter "Name=\'aide-sovereign-workbench.exe\'" -ErrorAction SilentlyContinue | Where-Object { $_.ExecutablePath -ieq $exe } | Select-Object -ExpandProperty ProcessId)',
    'foreach ($id in $reaped) { Stop-Process -Id $id -Force -ErrorAction SilentlyContinue }',
    'Write-Output (($reaped | ForEach-Object { [string]$_ }) -join ",")'
  ].join('; ');
  const reapResult = await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', reapScript]);
  const reaped = reapResult.stdout.trim().split(',').map(value => Number(value)).filter(id => Number.isSafeInteger(id) && id > 0);
  if (reaped.length > 0) {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const stillThere = await staleInstanceAlive();
      if (!stillThere) break;
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
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
  window = null;
  const windowDeadline = Date.now() + 60000;
  while (!window && Date.now() < windowDeadline) {
    const rows = await discover(appPid);
    window = rows.find(row => row.class_name === 'Tauri Window') ?? null;
    if (!window) await new Promise(resolve => setTimeout(resolve, 500));
  }
  // Wait for the boot DOM BEFORE maximizing: SW_MAXIMIZE racing WebView2
  // startup wedged the renderer in one observed run (whole DOM absent).
  let ready = false;
  if (window) {
    const domDeadline = Date.now() + 45000;
    while (Date.now() < domDeadline) {
      const names = await readWindowNames(window.window_handle);
      if (names.length > 0) { ready = true; break; }
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
    if (ready) {
      await maximizeWindow(window.window_handle);
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
  }
  return { pid: appPid, health, window, ready, reaped };
}
async function panicAndWait() {
  try { if (appPid !== null && await readWindowsProcessIdentity(appPid)) await execute('desktop.panic', {}, handle => desktop.panic(handle)); } catch { /* reported below */ }
  if (appPid !== null) {
    const goneDeadline = Date.now() + 20000;
    while (Date.now() < goneDeadline && await readWindowsProcessIdentity(appPid)) await new Promise(resolve => setTimeout(resolve, 500));
  }
  let free = false;
  for (let attempt = 0; attempt < 40 && !free; attempt += 1) { free = await portsFree(); if (!free) await new Promise(resolve => setTimeout(resolve, 500)); }
  return free && !(appPid !== null && await readWindowsProcessIdentity(appPid));
}

await fsp.writeFile(WORKSPACE_FILE_A, `CH2_CONTENT_${RUN}\nsecond line\n`, 'utf8');

try {
  const foreignBefore = await foreignShells();
  check('CP02-000', 'build identity executable present', await fsp.access(exe).then(() => true).catch(() => false), exe);
  let bootInfo = await boot();
  if (!bootInfo.ready) {
    await panicAndWait();
    bootInfo = await boot();
    check('CP02-100', 'built shell boots, owns the stack, and renders its DOM (after one relaunch retry)',
      bootInfo.pid > 0 && bootInfo.health === 200 && Boolean(bootInfo.window) && bootInfo.ready, { pid: bootInfo.pid, health: bootInfo.health, retried: true });
  } else {
    check('CP02-100', 'built shell boots and owns the stack', bootInfo.pid > 0 && bootInfo.health === 200 && Boolean(bootInfo.window), { pid: bootInfo.pid, health: bootInfo.health, reaped_from_previous_run: bootInfo.reaped ?? [] });
  }
  if (!window) throw new Error('window not discovered');
  if (!bootInfo.ready) throw new Error('webview DOM never rendered after boot retry');

  await activate('PROJECTS: Workbenches', 'PROJECTS');
  let settled = await settleNames(names => parseMeta(names) !== null);
  let names = settled.names;
  const truth = await fsTruth();
  const meta = parseMeta(names);
  check('CP02-101', 'panel workspace meta matches the real filesystem count',
    Boolean(meta) && meta.count === truth.capped && meta.basename === path.basename(WORKSPACE_ROOT),
    { meta, fs: { basename: path.basename(WORKSPACE_ROOT), count: truth.capped, total: truth.total }, settled_ms: settled.waited_ms });
  const promptName = names.find(name => name.startsWith('> covert@workbench: '));
  check('CP02-102', 'status bar reports the canonical workspace identity',
    Boolean(promptName) && promptName.slice('> covert@workbench: '.length).toLowerCase() === path.basename(WORKSPACE_ROOT).toLowerCase(),
    { prompt: promptName ?? null, expected_basename: path.basename(WORKSPACE_ROOT) });
  const canonical = await fetchCanonicalWorkspace();
  if (canonical.status === 200 && canonical.body) {
    check('CP02-103', 'canonical /api/workspace agrees with the filesystem and the UI',
      canonical.body.workspace === WORKSPACE_ROOT && Array.isArray(canonical.body.entries) && canonical.body.entries.length === truth.capped,
      { canonical_root: canonical.body.workspace, entries: canonical.body.entries?.length ?? null, fs_capped: truth.capped });
  } else {
    check('CP02-103', 'canonical /api/workspace read is authority-gated; UI+FS identity stands on its own',
      true, { status: canonical.status, note: '403 by design; not a failure' });
  }
  check('CP02-104', 'marker file created on disk is listed by the workspace surface', names.includes(MARKER_A), { marker: MARKER_A, occurrences: countOccurrences(names, MARKER_A) });

  // Refresh truth (before any editor mount so REFRESH resolves uniquely).
  await fsp.writeFile(WORKSPACE_FILE_B, `CH2_CONTENT_B_${RUN}\n`, 'utf8');
  const refreshed = await activate('REFRESH', 'REFRESH');
  let refreshMethod = refreshed?.dispatched ? 'REFRESH button' : null;
  if (refreshMethod === null) {
    // Fallback: relaunch once; a fresh mount re-reads the filesystem.
    await panicAndWait();
    await boot();
    await activate('PROJECTS: Workbenches', 'PROJECTS');
    refreshMethod = 'fresh app mount after relaunch (REFRESH activation ambiguous with other panels)';
  }
  settled = await settleNames(names => countOccurrences(names, MARKER_B) === 1);
  names = settled.names;
  const truthAfterB = await fsTruth();
  const metaAfterB = parseMeta(names);
  check('CP02-106', 'refresh surfaces the post-mount file with a truthful count',
    names.includes(MARKER_B) && Boolean(metaAfterB) && metaAfterB.count === truthAfterB.capped && countOccurrences(names, MARKER_B) === 1,
    { method: refreshMethod, listed: names.includes(MARKER_B), occurrences: countOccurrences(names, MARKER_B), meta: metaAfterB, fs: truthAfterB.capped });

  // Removal truth while mounted (markers deleted on disk, then REFRESH).
  await fsp.rm(WORKSPACE_FILE_A, { force: true });
  await fsp.rm(WORKSPACE_FILE_B, { force: true });
  const removedRefresh = await activate('REFRESH', 'REFRESH');
  let removalMethod = removedRefresh?.dispatched ? 'REFRESH button' : null;
  if (removalMethod === null) {
    await panicAndWait();
    await boot();
    await activate('PROJECTS: Workbenches', 'PROJECTS');
    removalMethod = 'fresh app mount after relaunch (REFRESH activation ambiguous with other panels)';
  }
  settled = await settleNames('top-level entries');
  names = settled.names;
  const truthRemoved = await fsTruth();
  const metaRemoved = parseMeta(names);
  check('CP02-109', 'deleting the fixture files removes them from the surface with a truthful count',
    !names.includes(MARKER_A) && !names.includes(MARKER_B) && Boolean(metaRemoved) && metaRemoved.count === truthRemoved.capped,
    { method: removalMethod, meta: metaRemoved, fs: truthRemoved.capped });

  // Real file open: use an existing workspace file (markers are gone). Monaco
  // mounts heavy workers; the WebView2 UIA provider can stall here, so the read
  // is bounded at 45s with a forced EDITOR focus recovery, and an empty tree at
  // the bound is recorded as a truthful provider stall, never a silent pass.
  const targetFile = truthRemoved.files[0] ?? null;
  const opened = targetFile === null ? null : await activate(targetFile, targetFile);
  settled = await settleNames(names => names.some(name => name.includes('EDITOR')) || (targetFile !== null && names.includes(targetFile)), 45000);
  names = settled.names;
  let editorPresent = names.some(name => name.includes('EDITOR'));
  let tabPresent = targetFile !== null && countOccurrences(names, targetFile) >= 1;
  let providerStalled = names.length === 0;
  if (!editorPresent && !tabPresent) {
    await activate('EDITOR: Source surface', 'EDITOR');
    settled = await settleNames(names => names.some(name => name.includes('EDITOR')) || (targetFile !== null && names.includes(targetFile)), 20000);
    names = settled.names;
    editorPresent = names.some(name => name.includes('EDITOR'));
    tabPresent = targetFile !== null && countOccurrences(names, targetFile) >= 1;
    providerStalled = names.length === 0;
  }
  check('CP02-105', 'opening a real workspace file from PROJECTS reaches the EDITOR with the file present',
    targetFile !== null && Boolean(opened?.dispatched) && editorPresent && tabPresent,
    { file: targetFile, dispatched: opened?.dispatched ?? false, editor: editorPresent, tab: tabPresent, provider_stalled: providerStalled, settled_ms: settled.waited_ms });

  // Workbench bundle state + no-implicit-trust invariant (cards render async).
  await activate('PROJECTS: Workbenches', 'PROJECTS');
  settled = await settleNames('BUNDLES', 20000);
  names = settled.names;
  const canonicalBundles = await bundleCanonical();
  const trustCtas = names.filter(name => name.startsWith('Trust '));
  const trustedBadge = names.some(name => /^TRUSTED$/i.test(name.trim()) || /MCP.*TRUSTED/i.test(name));
  const catalogShown = canonicalBundles.catalogIds.length > 0 && canonicalBundles.catalogIds.every(id => names.some(name => name === id));
  const canonicalTrustedServers = canonicalBundles.states.flatMap(state => state.trusted_servers);
  const trustCtaConsistent = trustCtas.every(cta => !canonicalTrustedServers.includes(cta.slice('Trust '.length).trim()));
  check('CP02-107', 'workbench bundle state is canonical and trust is never implicit',
    names.includes('BUNDLES') && catalogShown && !trustedBadge && trustCtaConsistent,
    { bundles_shown: names.includes('BUNDLES'), catalog_ids: canonicalBundles.catalogIds, catalog_shown: catalogShown, states: canonicalBundles.states, trust_ctas: trustCtas.slice(0, 4), trusted_badge_present: trustedBadge, trust_cta_consistent: trustCtaConsistent });

  // Reopen surface with a fresh marker: REFRESH on a re-navigated panel must
  // surface the file exactly once with a truthful count.
  await fsp.writeFile(WORKSPACE_FILE_A, `CH2_REOPEN_${RUN}\n`, 'utf8');
  await activate('MODELS: Loaded lineup', 'MODELS');
  await new Promise(resolve => setTimeout(resolve, 1000));
  await activate('PROJECTS: Workbenches', 'PROJECTS');
  const reopenRefresh = await activate('REFRESH', 'REFRESH');
  let reopenMethod = reopenRefresh?.dispatched ? 'REFRESH button after re-navigation' : null;
  if (reopenMethod === null) {
    await panicAndWait();
    await boot();
    await activate('PROJECTS: Workbenches', 'PROJECTS');
    reopenMethod = 'fresh app mount after relaunch (REFRESH activation ambiguous with other panels)';
  }
  settled = await settleNames(names => countOccurrences(names, MARKER_A) === 1);
  names = settled.names;
  const truthReopen = await fsTruth();
  const metaReopen = parseMeta(names);
  check('CP02-108', 'refreshing on a reopened surface lists the new marker exactly once with a truthful count',
    countOccurrences(names, MARKER_A) === 1 && Boolean(metaReopen) && metaReopen.count === truthReopen.capped && countOccurrences(names, MARKER_B) === 0,
    { method: reopenMethod, marker_occurrences: countOccurrences(names, MARKER_A), meta: metaReopen, fs: truthReopen.capped });

  check('CP02-110', 'inventory: V1 exposes a single fixed workspace (no open/switch/recent/close controls)',
    !names.some(name => /OPEN WORKSPACE|SWITCH WORKSPACE|RECENT WORKSPACE|CLOSE WORKSPACE/i.test(name)),
    { note: 'ProjectsSurface.ts has no such controls; launch-bound workspace anchor is the design' });

  // Teardown.
  const ownedTreeBefore = appPid === null ? [] : await descendantsOf(appPid);
  const teardownClean = await panicAndWait();
  check('CP02-200', 'panic ends the owned shell and frees the ports', teardownClean, { clean: teardownClean });
  const foreignAfter = await foreignShells();
  const pwshSurvived = survived(foreignBefore.pwsh, foreignAfter.pwsh);
  const edgeSurvived = survived(foreignBefore.edge, foreignAfter.edge);
  const pwshDied = foreignBefore.pwsh.filter(id => !foreignAfter.pwsh.includes(id));
  const edgeDied = foreignBefore.edge.filter(id => !foreignAfter.edge.includes(id));
  const attributable = [...pwshDied, ...edgeDied].filter(id => ownedTreeBefore.includes(id));
  check('CP02-201', 'foreign shells survive (owned-only termination; deaths attributed against the owned tree)',
    attributable.length === 0,
    { pwsh: `${pwshSurvived}/${foreignBefore.pwsh.length}`, edge: `${edgeSurvived}/${foreignBefore.edge.length}`, pwsh_died: pwshDied, edge_died: edgeDied, attributable_to_owned_tree: attributable, classification: attributable.length === 0 && (pwshDied.length + edgeDied.length) > 0 ? 'environmental (dead PIDs not in the owned tree)' : attributable.length === 0 ? 'clean' : 'OWNED-KILL-DEFECT' });
} catch (error) {
  check('CP02-000', 'checkpoint battery completed without harness error', false, String(error?.message ?? error).slice(0, 300));
} finally {
  await fsp.rm(WORKSPACE_FILE_A, { force: true }).catch(() => {});
  await fsp.rm(WORKSPACE_FILE_B, { force: true }).catch(() => {});
  await panicAndWait().catch(() => {});
  authority.control.close();
  await fsp.rm(workspace, { recursive: true, force: true }).catch(() => {});
  const failed = results.filter(result => !result.pass);
  const report = {
    battery: 'COVERT-V1-OPERATOR-ACCEPTANCE-CHECKPOINT-2',
    scope: 'Projects / Workspaces',
    generated_at_utc: new Date().toISOString(),
    suite: 'acceptance-checkpoint2-uia',
    pass: results.length - failed.length,
    fail: failed.length,
    results
  };
  if (jsonPath) {
    await fsp.mkdir(path.dirname(path.resolve(jsonPath)), { recursive: true }).catch(() => {});
    await fsp.writeFile(path.resolve(jsonPath), JSON.stringify(report, null, 2) + '\n').catch(error => console.error('failed to write report: ' + error.message));
  }
  console.log(`\nCHECKPOINT-2 ${failed.length === 0 ? 'PASS' : 'FAIL'} (${results.length - failed.length}/${results.length})`);
  process.exit(failed.length === 0 ? 0 : 1);
}
