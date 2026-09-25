// Desktop Control — P6 DC-a bounded domain. Strict opt-in grants, deny-by-default,
// session-scoped TTL, panic kill switch, evidence to the memory spine.
// Zero new native deps: Windows ops via cmd start / explorer / PowerShell / fs.
import { promises as fs } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import { createStateBus } from '../../../harness/cipher-state.mjs';
import { AuthorityError } from './execution-authority.mjs';
import { createOwnedProcesses } from './owned-process.mjs';
import { readWindowsProcessIdentity, sameWindowsProcessIdentity } from './windows-process-identity.mjs';
import { validateWindowsUiaRequest, windowsUiaAction } from './windows-uia.mjs';

const GRANTS_FILE = '.aide/desktop/grants.json';

export class DesktopRefusedError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function isSubpath(root, target) {
  const r = path.resolve(root);
  const t = path.resolve(target);
  const rel = path.relative(r, t);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

function hasPathTraversalSegment(value) {
  return /(?:^|[\\/])\.\.(?:[\\/]|$)/.test(String(value));
}

function isReparsePoint(stat) {
  return stat.isSymbolicLink() || (Number.isInteger(stat.attributes) && (stat.attributes & 0x400) !== 0);
}

async function assertNoReparseComponents(root, target) {
  const canonicalRoot = path.resolve(root);
  const samePath = (left, right) => process.platform === 'win32'
    ? left.toLowerCase() === right.toLowerCase()
    : left === right;
  let cursor = path.resolve(target);
  if (!isSubpath(canonicalRoot, cursor)) throw new DesktopRefusedError('PATH_NOT_GRANTED', 'file picker path escaped its approved root');
  while (true) {
    let stat;
    try { stat = await fs.lstat(cursor); }
    catch { throw new DesktopRefusedError('FILE_PICKER_PATH_UNAVAILABLE', 'approved picker path is unavailable'); }
    if (isReparsePoint(stat)) throw new DesktopRefusedError('PATH_NOT_GRANTED', 'file picker path contains a reparse point');
    if (samePath(path.resolve(cursor), canonicalRoot)) return;
    const parent = path.dirname(cursor);
    if (parent === cursor) throw new DesktopRefusedError('PATH_NOT_GRANTED', 'file picker path did not reach its approved root');
    cursor = parent;
  }
}

function projectActionOutput(operation, output) {
  const text = String(output ?? '');
  if (operation !== 'uia_action') return text.slice(0, 2000);
  let result;
  try { result = JSON.parse(text); }
  catch { throw new DesktopRefusedError('UIA_RESULT_INVALID', 'UI Automation returned malformed result data'); }
  const details = result?.details;
  if (details && Array.isArray(details.windows) && details.windows.length > 64) {
    details.windows_truncated = true;
    details.windows_omitted = details.windows.length - 64;
    details.windows = details.windows.slice(0, 64);
  }
  if (details && Array.isArray(details.controls) && details.controls.length > 64) {
    details.controls_truncated = true;
    details.controls_omitted = details.controls.length - 64;
    details.controls = details.controls.slice(0, 64);
  }
  const projected = JSON.stringify(result);
  if (projected.length > 16000) throw new DesktopRefusedError('UIA_RESULT_TOO_LARGE', 'bounded UI Automation result exceeded its response limit');
  return projected;
}

export function createDesktopControl({ workspace, authority, clock = Date.now }) {
  function authorized(execution, kind, body) {
    if (!authority) throw new AuthorityError('FORBIDDEN', 'canonical authority required');
    return authority.assertExecution(execution, kind, body);
  }
  let manifest = null;
  const processes = createOwnedProcesses();
  const ownedUiProcesses = new Map();
  const windowLeases = new Map();
  let grantOwner = null;
  let panicked = false;
  let unownedHandlers = 0;
  const panics = [];
  let turnCounter = 0;
  // Executor seam (T2 contract): external desktop-agent submits actions,
  // holds <=60s for a verdict rendered as an approval card in the cockpit.
  const pendingApprovals = new Map(); // id -> {action_raw, class, session_id, created_at, resolver}

  function submitPending({ action_raw, class: permClass, session_id = 'default' }) {
    const id = `da-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const entry = {
      approval_id: id,
      action_raw: String(action_raw ?? '').slice(0, 300),
      class: String(permClass ?? 'WRITE'),
      session_id,
      created_at: new Date().toISOString()
    };
    const deferred = {};
    deferred.promise = new Promise(resolve => { deferred.resolve = resolve; });
    pendingApprovals.set(id, { ...entry, deferred });
    return { ...entry, promise: deferred.promise };
  }

  async function waitForVerdict(id, timeoutMs = 55_000) {
    const entry = pendingApprovals.get(id);
    if (!entry) throw new DesktopRefusedError('NOT_FOUND', `no pending approval ${id}`);
    const timeout = new Promise(resolve => setTimeout(() => resolve('timeout'), timeoutMs));
    const winner = await Promise.race([entry.deferred.promise.then(v => ({ v })), timeout.then(t => ({ t }))]);
    if ('t' in winner && winner.t === 'timeout') return { verdict: 'timeout' };
    return { verdict: winner.v.verdict };
  }

  function resolvePending(id, decision) {
    const entry = pendingApprovals.get(id);
    if (!entry) throw new DesktopRefusedError('NOT_FOUND', `no pending approval ${id}`);
    pendingApprovals.delete(id);
    entry.deferred.resolve({ verdict: decision === 'approve' ? 'approved' : 'rejected' });
    void evidence('desktop', { op: 'executor_approval', target: entry.action_raw, decision });
    return { ok: true, approval_id: id, verdict: decision === 'approve' ? 'approved' : decision };
  }

  function listPending() {
    return [...pendingApprovals.values()].map(e => ({
      approval_id: e.approval_id, action_raw: e.action_raw, class: e.class,
      session_id: e.session_id, created_at: e.created_at
    }));
  }

  async function loadManifest() {
    if (manifest) return manifest;
    try {
      manifest = { ...JSON.parse(await fs.readFile(path.join(workspace, GRANTS_FILE), 'utf8')), enabled: false };
    } catch { manifest = null; }
    return manifest;
  }

  async function saveManifest(next) {
    const file = path.join(workspace, GRANTS_FILE);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, JSON.stringify(next, null, 2), 'utf8');
    manifest = next;
    return next;
  }

  async function activeGrants() {
    const m = await loadManifest();
    if (panicked) throw new DesktopRefusedError('PANIC', 'panic switch tripped for this session');
    if (!m || !m.enabled || !grantOwner) throw new DesktopRefusedError('DISABLED', 'desktop control is not enabled');
    authority.assertActor(grantOwner);
    const ageMin = (clock() - new Date(m.session_started_at).getTime()) / 60000;
    if (ageMin > m.ttl_minutes) throw new DesktopRefusedError('EXPIRED', `grants expired after ${m.ttl_minutes} minutes`);
    return m.grants;
  }

  async function evidence(kind, detail) {
    try { await createStateBus(workspace).append({ type: 'desktop', ...detail }); } catch { /* best-effort */ }
    void kind;
  }

  async function run(cmd, args, opts = {}) {
    let stdout = ''; let stderr = '';
    const launched = processes.launch(cmd, args, { cwd: workspace,
      ...(opts.input === undefined ? {} : { stdio: ['pipe', 'pipe', 'pipe'] }),
      onStdout: chunk => { stdout = (stdout + String(chunk)).slice(-262144); },
      onStderr: chunk => { stderr = (stderr + String(chunk)).slice(-262144); } });
    await launched.spawned;
    let timedOut = false;
    let timeoutTermination = null;
    const timer = setTimeout(() => {
      timedOut = true;
      timeoutTermination = processes.terminate(launched.handle);
    }, opts.timeout ?? 8000);
    try {
      if (opts.input !== undefined) {
        launched.writeStdin(opts.input);
        launched.endStdin();
      }
      const result = await launched.finished;
      if (timedOut) {
        const termination = await timeoutTermination;
        if (!['terminated', 'exited'].includes(termination?.status)) {
          throw Object.assign(new Error('desktop helper timed out and owned-process cleanup was unconfirmed'), {
            code: 'DESKTOP_HELPER_CLEANUP_UNCONFIRMED'
          });
        }
        throw Object.assign(new Error('desktop helper exceeded its bounded runtime'), { code: 'UIA_HELPER_TIMEOUT' });
      }
      if (result.code !== 0 || result.signal || result.error) throw new Error(stderr || result.error || 'desktop helper failed or was terminated');
      return stdout;
    } catch (error) {
      if (processes.alive(launched.handle)) {
        const cleanup = await processes.terminate(launched.handle);
        if (!['terminated', 'exited'].includes(cleanup.status)) {
          throw Object.assign(new Error(`desktop helper failed and owned-process cleanup was ${cleanup.status}`), {
            code: 'DESKTOP_HELPER_CLEANUP_UNCONFIRMED',
            cause: error
          });
        }
      }
      throw error;
    } finally { clearTimeout(timer); }
  }
  const psLiteral = text => `'${String(text).replaceAll("'", "''")}'`;
  const safeActionTarget = request => {
    if (request?.op !== 'uia_action') return request?.target;
    try {
      const value = JSON.parse(String(request.target));
      return JSON.stringify({
        pid: value.pid,
        action: value.action,
        window_handle: value.window_handle,
        lease_id: value.lease_id,
        automation_id: value.automation_id,
        verify_automation_id: value.verify_automation_id,
        expected_state: value.expected_state,
        horizontal_percent: value.horizontal_percent,
        vertical_percent: value.vertical_percent,
        key: value.key,
        selection_root: value.selection_root ? '[approved root]' : undefined,
        file_path: value.file_path ? '[approved fixture path]' : undefined,
        result_window_handle: value.result_window_handle,
        result_lease_id: value.result_lease_id,
        text: value.text === undefined ? undefined : '[input omitted]'
      });
    } catch { return '[redacted UI Automation target]'; }
  };

  function resolveWindowLease(sessionId, leaseId, pid, windowHandle, identity) {
    const lease = windowLeases.get(leaseId);
    if (!lease || lease.sessionId !== sessionId || lease.pid !== pid || lease.windowHandle !== windowHandle ||
        !sameWindowsProcessIdentity(lease.identity, identity)) {
      throw new DesktopRefusedError('UIA_LEASE_INVALID', 'window lease is absent, stale, or belongs to another attempt');
    }
    return lease;
  }

  function rememberWindowLease(sessionId, identity, row) {
    if (!Number.isSafeInteger(row.window_handle) || row.window_handle <= 0 ||
        !Array.isArray(row.runtime_id) || row.runtime_id.length < 1 ||
        typeof row.class_name !== 'string' || !row.class_name) {
      throw new DesktopRefusedError('UIA_WINDOW_IDENTITY_INCOMPLETE', 'window provider did not expose a stable window identity');
    }
    const runtimeId = row.runtime_id.map(String).join(',');
    const existing = [...windowLeases.values()].find(lease => lease.sessionId === sessionId &&
      lease.pid === identity.pid && lease.windowHandle === row.window_handle &&
      lease.runtimeId === runtimeId && lease.className === row.class_name &&
      sameWindowsProcessIdentity(lease.identity, identity));
    if (existing) return existing;
    if (windowLeases.size >= 256) throw new DesktopRefusedError('UIA_LEASE_CAPACITY', 'session window lease capacity reached');
    const lease = {
      id: randomUUID(),
      sessionId,
      pid: identity.pid,
      windowHandle: row.window_handle,
      runtimeId,
      className: row.class_name,
      identity
    };
    windowLeases.set(lease.id, lease);
    return lease;
  }

  async function validateSelectionPath(grants, selectionRoot, filePath) {
    const selectionRootText = String(selectionRoot);
    const filePathText = String(filePath);
    if (!path.isAbsolute(selectionRootText) || !path.isAbsolute(filePathText) ||
        hasPathTraversalSegment(selectionRootText) || hasPathTraversalSegment(filePathText)) {
      throw new DesktopRefusedError('PATH_NOT_GRANTED', 'file picker paths must be absolute and cannot contain traversal segments');
    }
    const requestedRoot = path.resolve(selectionRootText);
    const requestedFile = path.resolve(filePathText);
    if (requestedRoot !== selectionRootText || requestedFile !== filePathText) {
      throw new DesktopRefusedError('PATH_NOT_GRANTED', 'file picker paths must use canonical absolute syntax');
    }
    const grant = grants.roots.find(root => isSubpath(root, requestedRoot));
    if (!grant) throw new DesktopRefusedError('PATH_NOT_GRANTED', 'file picker root is outside granted roots');
    const resolvedGrant = path.resolve(grant);
    if (!isSubpath(resolvedGrant, requestedRoot) || !isSubpath(requestedRoot, requestedFile)) {
      throw new DesktopRefusedError('PATH_NOT_GRANTED', 'selected file must be a child of the approved picker root');
    }
    await assertNoReparseComponents(resolvedGrant, requestedRoot);
    await assertNoReparseComponents(requestedRoot, requestedFile);
    let realGrant;
    let realRoot;
    let realFile;
    try {
      [realGrant, realRoot, realFile] = await Promise.all([
        fs.realpath(resolvedGrant),
        fs.realpath(requestedRoot),
        fs.realpath(requestedFile)
      ]);
    } catch {
      throw new DesktopRefusedError('FILE_PICKER_PATH_UNAVAILABLE', 'approved picker root or fixture file is unavailable');
    }
    const windowsPathEqual = (left, right) => process.platform === 'win32'
      ? left.toLowerCase() === right.toLowerCase()
      : left === right;
    if (!isSubpath(realGrant, realRoot) || !windowsPathEqual(realRoot, requestedRoot) ||
        !windowsPathEqual(realFile, requestedFile) || realFile === realRoot || !isSubpath(realRoot, realFile)) {
      throw new DesktopRefusedError('PATH_NOT_GRANTED', 'selected file must be a child of the approved picker root');
    }
    await assertNoReparseComponents(realGrant, realRoot);
    await assertNoReparseComponents(realRoot, realFile);
    const stat = await fs.stat(realFile);
    if (!stat.isFile()) throw new DesktopRefusedError('FILE_PICKER_NOT_A_FILE', 'selected path is not a regular file');
    return { selectionRoot: realRoot, filePath: realFile };
  }

  const ops = {
    // Business-lane ops (drafts-first doctrine: AIDE creates drafts, humans
    // send). COM via PowerShell -STA; typed UNAVAILABLE when Office absent.
    async outlook_create_draft(grants, target, destination) {
      let input;
      try { input = JSON.parse(String(target || '{}')); }
      catch { throw new DesktopRefusedError('VALIDATION', 'target must be JSON {to,subject,body}'); }
      const to = String(input.to || '').trim();
      const subject = String(input.subject || '').slice(0, 200);
      const body = String(input.body || '').slice(0, 8000);
      if (!to || !subject) throw new DesktopRefusedError('VALIDATION', 'draft requires to + subject');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to.split(';')[0])) throw new DesktopRefusedError('VALIDATION', 'invalid recipient address');
      const script = [
        '$o = New-Object -ComObject Outlook.Application -ErrorAction Stop',
        `$m = $o.CreateItem(0)`,
        `$m.To = ${psLiteral(to)}`,
        `$m.Subject = ${psLiteral(subject)}`,
        `$m.Body = ${psLiteral(body)}`,
        '$m.Save()',
        'Write-Output "draft-saved"'
      ].join('; ');
      let out;
      try { out = await run('powershell.exe', ['-NoProfile', '-STA', '-NonInteractive', '-Command', script], { timeout: 30000 }); }
      catch (error) {
        if (error.message.includes('0x80040154')) throw new DesktopRefusedError('OUTLOOK_UNAVAILABLE', 'classic Outlook COM unavailable');
        throw error;
      }
      return out.includes('draft-saved') ? `draft saved to Outlook (${to})` : out;
    },
    async excel_generate_report(grants, target, destination) {
      const root = grants.roots.find(r => isSubpath(r, String(destination)));
      if (!root) throw new DesktopRefusedError('PATH_NOT_GRANTED', 'destination must be inside granted roots');
      let input;
      try { input = JSON.parse(String(target || '{}')); }
      catch { throw new DesktopRefusedError('VALIDATION', 'target must be JSON {title, rows:[[...]]}'); }
      const title = String(input.title || 'Report').slice(0, 100);
      const rows = Array.isArray(input.rows) ? input.rows.slice(0, 5000) : null;
      if (!rows || !rows.length) throw new DesktopRefusedError('VALIDATION', 'rows required');
      // Build CSV payload in Node (no COM needed for data), then hand to Excel
      // only for XLSX conversion IF Excel exists; else write .csv honestly.
      const csvPath = path.join(path.dirname(path.resolve(destination)), `${title.replace(/[^\w.-]+/g, '_')}.csv`);
      const csv = rows.map(r => Array.isArray(r) ? r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',') : `"${String(r).replace(/"/g, '""')}"`).join('\r\n');
      await fs.writeFile(csvPath, csv, 'utf8');
      try {
        const script = [
          '$e = New-Object -ComObject Excel.Application -ErrorAction Stop',
          '$e.Visible = $false; $e.DisplayAlerts = $false',
          `$w = $e.Workbooks.Open(${psLiteral(csvPath)})`,
          `$w.SaveAs(${psLiteral(destination)}, 51)`, // xlOpenXMLWorkbook
          '$w.Close($false); $e.Quit()',
          'Write-Output "xlsx-written"'
        ].join('; ');
        const out = await run('powershell.exe', ['-NoProfile', '-STA', '-NonInteractive', '-Command', script], { timeout: 60000 });
        return out.includes('xlsx-written') ? `report written: ${destination}` : out;
      } catch (error) {
        if (String(error?.message || error).includes('0x80040154')) {
          throw new DesktopRefusedError('EXCEL_UNAVAILABLE', 'Excel is not installed (COM class not registered); CSV written instead at ' + csvPath);
        }
        throw new DesktopRefusedError('CHILD_FAILED', `excel failed: ${String(error?.message || error).slice(0, 200)}`);
      }
    },
    async launch_app(grants, target, _destination, request) {
      const name = String(target || '').trim().toLowerCase().replace(/\.exe$/, '');
      const hit = grants.apps.find(a => a.toLowerCase().replace(/\.exe$/, '') === name);
      if (!hit) throw new DesktopRefusedError('NOT_ALLOWLISTED', `app "${target}" is not on the allowlist`);
      const launched = processes.launch(hit, request.args ?? [], { cwd: workspace, windowsHide: request.show_window !== true });
      await launched.spawned;
      if (process.platform === 'win32' && Number.isSafeInteger(launched.handle.pid)) {
        try {
          const identity = await readWindowsProcessIdentity(launched.handle.pid);
          if (identity?.pid === launched.handle.pid && processes.alive(launched.handle)) {
            ownedUiProcesses.set(launched.handle.pid, { handle: launched.handle, identity });
          }
        } catch { /* launch remains valid; UIA fails closed without verified identity */ }
      }
      return { output: `launched ${hit}; owned process ${launched.handle.pid}`, handle: launched.handle };
    },
    async open_path(grants, target) {
      const root = grants.roots.find(r => isSubpath(r, String(target)));
      if (!root) throw new DesktopRefusedError('PATH_NOT_GRANTED', `"${target}" is outside granted roots`);
      const stat = await fs.stat(target).catch(() => null);
      if (!stat) throw new DesktopRefusedError('NOT_FOUND', `${target} does not exist`);
      // The registered OS handler may reuse another application's process.
      // Own only the helper, and explicitly report the handler as unowned.
      await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `Start-Process -FilePath ${psLiteral(target)} -WindowStyle Hidden -ErrorAction Stop`]);
      unownedHandlers += 1;
      return `open requested for ${target}; handler process ownership unproven`;
    },
    async move_file(grants, target, destination) {
      const fromRoot = grants.roots.find(r => isSubpath(r, String(target)));
      const toRoot = grants.roots.find(r => isSubpath(r, String(destination)));
      if (!fromRoot || !toRoot) throw new DesktopRefusedError('PATH_NOT_GRANTED', 'both paths must be inside granted roots');
      await fs.rename(target, destination);
      return `moved to ${destination}`;
    },
    async list_windows() {
      const out = await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
        'Get-Process | Where-Object { $_.MainWindowTitle } | Select-Object -First 25 Id,ProcessName,MainWindowTitle | ConvertTo-Json -Compress']);
      return out;
    },
    async focus_window(grants, target) {
      const title = grants.window_titles.find(t => String(target).toLowerCase().includes(t.toLowerCase()));
      if (!title) throw new DesktopRefusedError('NOT_ALLOWLISTED', `window "${target}" is not on the allowlist`);
      // Probe-first honesty: only claim success when a window title actually matched.
      const listing = await ops.list_windows();
      if (!listing.toLowerCase().includes(title.toLowerCase())) {
        throw new DesktopRefusedError('WINDOW_NOT_FOUND', `no visible window matches "${title}"`);
      }
      const script = `(New-Object -ComObject WScript.Shell).AppActivate(${psLiteral(title)}) | Out-Null`;
      await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script]);
      return `focused window matching ${title}`;
    },
    async uia_action(grants, target, _destination, _request, sessionId = 'default') {
      if (process.platform !== 'win32') throw new DesktopRefusedError('UIA_UNAVAILABLE', 'Windows UI Automation is available only on Windows');
      let request;
      try { request = validateWindowsUiaRequest(JSON.parse(String(target))); }
      catch (error) { throw new DesktopRefusedError('UIA_INVALID_REQUEST', String(error?.message ?? error).slice(0, 180)); }
      const owned = ownedUiProcesses.get(request.pid);
      if (!owned || !processes.alive(owned.handle) || owned.handle.pid !== request.pid) {
        throw new DesktopRefusedError('UIA_TARGET_NOT_OWNED', 'UI Automation is restricted to a live process launched and retained by this Desktop Control session');
      }
      let observed;
      try { observed = await readWindowsProcessIdentity(request.pid); }
      catch { throw new DesktopRefusedError('UIA_IDENTITY_UNVERIFIED', 'target process identity could not be revalidated'); }
      if (!sameWindowsProcessIdentity(owned.identity, observed)) throw new DesktopRefusedError('UIA_IDENTITY_MISMATCH', 'target PID no longer matches its captured process identity');
      const actionId = randomUUID();
      let windowLease = null;
      let resultWindowLease = null;
      let helperRequest = request;
      let selection = null;
      let capturePath = null;
      const captureRoot = path.resolve(workspace, '.aide', 'desktop', 'evidence');
      const helperDirectory = path.resolve(workspace, '.aide', 'desktop', 'helpers');
      if (request.action === 'discover') {
        const discovered = await windowsUiaAction(request, owned.identity, (cmd, args, options) => run(cmd, args, options), {
          workspaceRoot: workspace, helperDirectory
        });
        const windows = discovered.details?.windows;
        if (!Array.isArray(windows)) throw new DesktopRefusedError('UIA_RESULT_INVALID', 'window discovery returned no window identity list');
        const leasedWindows = windows.map(row => {
          const lease = rememberWindowLease(sessionId, owned.identity, row);
          return {
            window_handle: row.window_handle,
            process_id: row.process_id,
            class_name: row.class_name,
            automation_id: row.automation_id || null,
            lease_id: lease.id
          };
        });
        return {
          output: JSON.stringify({ action: 'discover', verified: true, details: { windows: leasedWindows } }),
          verified: true,
          action: 'discover'
        };
      }

      try {
        windowLease = resolveWindowLease(sessionId, request.lease_id, request.pid, request.window_handle, owned.identity);
        const helperIdentity = {
          ...owned.identity,
          windowRuntimeId: windowLease.runtimeId,
          windowClassName: windowLease.className
        };
        if (request.action === 'select_file') {
          resultWindowLease = resolveWindowLease(sessionId, request.result_lease_id, request.pid, request.result_window_handle, owned.identity);
          selection = await validateSelectionPath(grants, request.selection_root, request.file_path);
          helperRequest = { ...request, selection_root: selection.selectionRoot, file_path: selection.filePath };
          helperIdentity.resultWindowRuntimeId = resultWindowLease.runtimeId;
          helperIdentity.resultWindowClassName = resultWindowLease.className;
        }
        if (request.action === 'screenshot') {
          await fs.mkdir(captureRoot, { recursive: true });
          const rootStat = await fs.lstat(captureRoot);
          if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw new DesktopRefusedError('UIA_CAPTURE_ROOT_INVALID', 'screenshot evidence root is not a real directory');
          capturePath = path.join(captureRoot, actionId + '.png');
          if (!isSubpath(captureRoot, capturePath)) throw new DesktopRefusedError('UIA_CAPTURE_PATH_DENIED', 'screenshot destination escaped its evidence root');
          helperIdentity.captureRoot = captureRoot;
        }
        const result = await windowsUiaAction(helperRequest, helperIdentity, (cmd, args, options) => run(cmd, args, options), {
          workspaceRoot: workspace,
          helperDirectory,
          ...(capturePath ? { capturePath } : {}),
          ...(request.action === 'select_file' ? { timeout: 12000 } : {})
        });
        if (capturePath) {
          const bytes = await fs.readFile(capturePath);
          const digest = createHash('sha256').update(bytes).digest('hex');
          if (bytes.length < 100 || digest !== result.details?.capture_sha256 ||
              bytes[0] !== 0x89 || bytes.subarray(1, 4).toString('ascii') !== 'PNG') {
            throw new DesktopRefusedError('UIA_CAPTURE_VERIFICATION_FAILED', 'window screenshot failed PNG/hash verification');
          }
          result.details.capture_sha256 = digest;
          result.details.capture_bytes = bytes.length;
          result.details.capture_ref = path.relative(workspace, capturePath).split(path.sep).join('/');
        }
        if (request.action === 'select_file') windowLeases.delete(windowLease.id);
        const receipt = {
          action_id: actionId,
          attempt_id: String(sessionId).slice(0, 120),
          target_application: owned.identity.name,
          process_id: owned.identity.pid,
          window_handle: windowLease.windowHandle,
          lease_id: windowLease.id,
          ownership_state: 'ATTEMPT_OWNED',
          requested_operation: request.action,
          target_element: request.automation_id ?? (request.action === 'select_file' ? '1148' : null),
          precondition: 'owned_process_identity_and_window_lease_revalidated',
          result: 'SUCCESS',
          postcondition: String(result.details?.verified_by ?? result.details?.action ?? result.action),
          evidence_refs: result.details?.capture_ref ? [result.details.capture_ref] : []
        };
        return {
          output: JSON.stringify({ action: result.action, verified: result.verified, details: result.details ?? null }),
          verified: result.verified,
          action: result.action,
          receipt
        };
      } catch (error) {
        if (capturePath) {
          try { await fs.unlink(capturePath); }
          catch (cleanupError) { if (cleanupError?.code !== 'ENOENT') error = Object.assign(new Error('failed UIA screenshot artifact could not be removed'), { code: 'UIA_CAPTURE_CLEANUP_FAILED', cause: error }); }
        }
        if ([
          'UIA_WINDOW_STALE', 'UIA_WINDOW_OWNER_MISMATCH', 'UIA_WINDOW_NOT_UNIQUE', 'UIA_WINDOW_UNAVAILABLE',
          'UIA_IDENTITY_MISMATCH', 'UIA_PROCESS_IDENTITY_MISMATCH', 'UIA_FOCUS_LOST', 'UIA_HELPER_TIMEOUT',
          'DESKTOP_HELPER_CLEANUP_UNCONFIRMED', 'UIA_FILE_PICKER_CONTROL_STALE', 'UIA_FILE_PICKER_DIALOG_NOT_CLOSED'
        ].includes(error?.code)) {
          windowLeases.delete(windowLease?.id);
        }
        const failure = new DesktopRefusedError(error?.code ?? 'UIA_OPERATION_FAILED', 'approved window action failed closed');
        if (error?.diagnostic && typeof error.diagnostic === 'object') failure.diagnostic = error.diagnostic;
        failure.desktopReceipt = {
          action_id: actionId,
          attempt_id: String(sessionId).slice(0, 120),
          target_application: owned.identity.name,
          process_id: owned.identity.pid,
          window_handle: windowLease?.windowHandle ?? request.window_handle,
          lease_id: windowLease?.id ?? request.lease_id,
          ownership_state: 'ATTEMPT_OWNED',
          requested_operation: request.action,
          target_element: request.automation_id ?? (request.action === 'select_file' ? '1148' : null),
          precondition: 'owned_process_identity_and_window_lease_revalidated',
          result: 'FAILURE',
          postcondition: 'not_verified',
          evidence_refs: [],
          failure_classification: failure.code
        };
        throw failure;
      }
    }
  };

  async function autoAssert(op, target, destination, output) {
    // DC-b: every trajectory row carries a state assertion — R3 law forbids
    // training on unverified rollouts. Assertions are mechanical, per-op.
    switch (op) {
      case 'launch_app': {
        return { pass: processes.alive(output?.handle), check: `owned_process_alive:${output?.handle?.pid ?? 'unknown'}` };
      }
      case 'move_file': {
        try {
          await fs.access(String(destination));
          return { pass: true, check: 'destination_exists' };
        } catch {
          return { pass: false, check: 'destination_exists' };
        }
      }
      case 'open_path':
        return { pass: false, check: 'handler_ownership_unproven' };
      case 'uia_action': {
        let rawDetails = {};
        try { rawDetails = JSON.parse(String(output?.output ?? '')).details ?? {}; } catch { /* malformed helper detail cannot establish verification */ }
        const details = { action: String(rawDetails.action ?? output?.action ?? 'unknown').slice(0, 32) };
        if (Number.isSafeInteger(rawDetails.window_handle)) details.window_handle = rawDetails.window_handle;
        for (const key of ['automation_id', 'verified_by']) {
          if (typeof rawDetails[key] === 'string' && rawDetails[key].length <= 64) details[key] = rawDetails[key];
        }
        if (Number.isFinite(rawDetails.vertical_percent)) details.vertical_percent = rawDetails.vertical_percent;
        if (typeof rawDetails.input_method === 'string') details.input_method = rawDetails.input_method;
        if (typeof rawDetails.key === 'string') details.key = rawDetails.key;
        if (typeof rawDetails.capture_sha256 === 'string' && /^[0-9a-f]{64}$/i.test(rawDetails.capture_sha256)) details.capture_sha256 = rawDetails.capture_sha256;
        if (typeof rawDetails.capture_ref === 'string' && rawDetails.capture_ref.startsWith('.aide/desktop/evidence/')) details.capture_ref = rawDetails.capture_ref;
        for (const key of ['capture_bytes', 'capture_width', 'capture_height']) {
          if (Number.isSafeInteger(rawDetails[key]) && rawDetails[key] > 0) details[key] = rawDetails[key];
        }
        if (Array.isArray(rawDetails.windows)) details.windows_found = rawDetails.windows.length;
        if (Array.isArray(rawDetails.controls)) details.controls_inspected = rawDetails.controls.length;
        return { pass: output?.verified === true, check: `uia_verified:${output?.action ?? 'unknown'}`, details };
      }
      case 'focus_window':
      case 'list_windows':
      default:
        return { pass: true, check: `${op}:observation-only` };
    }
  }

  const TRAJECTORY_DIR = '.aide/desktop/trajectories';

  async function recordTrajectory(sessionId, row) {
    try {
      const file = path.join(workspace, TRAJECTORY_DIR, `${sessionId}.jsonl`);
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.appendFile(file, JSON.stringify(row) + '\n', 'utf8');
    } catch { /* training capture is best-effort; never blocks actions */ }
  }

  async function act(request, execution, sessionId = 'default') {
    const trusted = authorized(execution, 'desktop.action', request);
    const started = Date.now();
    if (request.show_window !== undefined && request.op !== 'launch_app') throw new DesktopRefusedError('INVALID_SHOW_WINDOW', 'show_window is supported only for launch_app');
    if (request.approved !== true) {
      await evidence('desktop', { op: request.op, target: safeActionTarget(request), decision: 'refused-no-approval' });
      await recordTrajectory(sessionId, {
        ts: new Date().toISOString(), turn: ++turnCounter,
        observation: { op: request.op, target: safeActionTarget(request) },
        thought: request.op === 'uia_action' ? '[UI Automation input omitted]' : request.note || '', action_raw: `${request.op}(target="${safeActionTarget(request)}")`,
        class: 'UNKNOWN', verdict: 'NO_APPROVAL', latency_ms: Date.now() - started
      });
      throw new DesktopRefusedError('NO_APPROVAL', 'explicit approval required for desktop actions');
    }
    const grants = await activeGrants();
    if (trusted.owner !== grantOwner) throw new AuthorityError('FORBIDDEN', 'desktop grants belong to another operator');
    authorized(execution, 'desktop.action', request);
    const fn = ops[request.op];
    if (!fn) throw new DesktopRefusedError('UNKNOWN_OP', `unsupported op: ${request.op}`);
    try {
      const output = await fn(grants, request.target, request.destination, request, sessionId);
      const assertion = await autoAssert(request.op, request.target, request.destination, output);
      const result = {
        ok: true,
        decision: 'executed',
        output: projectActionOutput(request.op, output?.output ?? output),
        latency_ms: Date.now() - started,
        assertion,
        ...(output?.receipt ? { receipt: output.receipt } : {})
      };
      await evidence('desktop', { op: request.op, target: safeActionTarget(request), decision: 'executed', assertion, ...(output?.receipt ? { receipt: output.receipt } : {}) });
      await recordTrajectory(sessionId, {
        ts: new Date().toISOString(), turn: ++turnCounter,
        observation: { op: request.op, target: safeActionTarget(request), destination: request.destination ?? null },
        thought: request.op === 'uia_action' ? '[UI Automation input omitted]' : request.note || '', action_raw: `${request.op}(target="${safeActionTarget(request)}"${request.destination ? `, destination="${request.destination}"` : ''})`,
        class: 'WRITE', verdict: 'executed', assertion, ...(output?.receipt ? { receipt: output.receipt } : {}), latency_ms: result.latency_ms
      });
      return result;
    } catch (error) {
      const code = error instanceof DesktopRefusedError ? error.code : 'CHILD_FAILED';
      const failureReceipt = error?.desktopReceipt;
      await evidence('desktop', { op: request.op, target: safeActionTarget(request), decision: code, ...(failureReceipt ? { receipt: failureReceipt } : {}) });
      // Refusal-recovery rows are TRAINING GOLD per the model spec — recorded
      // with the refusal code as the verdict so T2's corpus includes recovery.
      await recordTrajectory(sessionId, {
        ts: new Date().toISOString(), turn: ++turnCounter,
        observation: { op: request.op, target: safeActionTarget(request) },
        thought: request.op === 'uia_action' ? '[UI Automation input omitted]' : request.note || '', action_raw: `${request.op}(target="${safeActionTarget(request)}")`,
        class: code === 'NOT_ALLOWLISTED' || code === 'PATH_NOT_GRANTED' ? 'FORBIDDEN' : 'WRITE',
        verdict: code, ...(failureReceipt ? { receipt: failureReceipt } : {}), latency_ms: Date.now() - started
      });
      throw error;
    }
  }

  async function panic(execution) {
    authorized(execution, 'desktop.panic', {});
    const started = Date.now();
    panicked = true; grantOwner = null;
    authority.control.revokePending();
    if (manifest) panics.push(manifest.session_started_at);
    const outcomes = await processes.revoke();
    ownedUiProcesses.clear();
    windowLeases.clear();
    const killed = outcomes.filter(item => item.killed).length;
    const result = { ok: outcomes.every(item => item.status === 'terminated' || item.status === 'exited'), children_killed: killed,
      unowned_handlers: unownedHandlers, outcomes, revoked_at: new Date().toISOString(), latency_ms: Date.now() - started };
    await evidence('desktop', { op: 'panic', decision: 'executed', children_killed: killed });
    return result;
  }

  return {
    status: async () => {
      // Contract: DesktopStatusResponse in common/contracts/desktop.ts
      // (lines 53-62) is .strict() with `additionalProperties: false`. The
      // previous return included `pending_approvals: listPending()` which
      // is NOT in the contract — that field is exposed via the dedicated
      // `GET /api/desktop/pending` route, not the status one. Returning it
      // here caused the route to fail with HTTP 500 (BAD_RESPONSE: contains
      // unrecognized keys). Per aide-debugging-discipline (verified trap
      // "Strict zod rejects legacy keys") + AGENT_NOTES line 8 documented
      // "desktop control returns 502 on /api/desktop/status" root cause.
      const m = await loadManifest();
      return {
        enabled: Boolean(m?.enabled && grantOwner && !panicked),
        ttl_minutes: m?.ttl_minutes ?? null,
        session_started_at: m?.session_started_at ?? null,
        grants: m?.grants ?? { apps: [], roots: [], window_titles: [] },
        tracked_children: processes.snapshot().length,
        panicked
      };
    },
    setGrants: async (input, execution) => {
      const trusted = authorized(execution, 'desktop.grants', input);
      const next = await saveManifest({ version: 1, ...input, session_started_at: new Date(clock()).toISOString(), approved_by: 'operator-wizard' });
      authorized(execution, 'desktop.grants', input);
      grantOwner = trusted.owner; panicked = false;
      windowLeases.clear();
      if (input.enabled) processes.arm();
      else {
        await processes.revoke();
        ownedUiProcesses.clear();
      }
      return next;
    },
    act,
    panic,
    submitPending,
    waitForVerdict,
    resolvePending,
    listPending,
    _test: { panics } // no injectable PID/ownership registry
  };
}
