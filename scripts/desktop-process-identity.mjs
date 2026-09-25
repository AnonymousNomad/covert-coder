import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';

const execFile = promisify(execFileCallback);

function normalizeWindowsPath(value) {
  return String(value ?? '').replace(/^\\\\\?\\/, '').replaceAll('/', '\\').replace(/\\+$/, '').toLowerCase();
}

export async function readWindowsProcessIdentity(pid) {
  if (process.platform !== 'win32') throw new Error('Windows process identity is available only on Windows');
  if (!Number.isSafeInteger(pid) || pid <= 0) throw new TypeError('PID must be a positive safe integer');

  const query = [
    "$ErrorActionPreference = 'Stop'",
    `$targetPid = ${pid}`,
    '$item = Get-CimInstance -ClassName Win32_Process -Filter "ProcessId = $targetPid" -ErrorAction SilentlyContinue',
    "if ($null -eq $item) { [Console]::Out.Write('null'); exit 0 }",
    '$created = $item.CreationDate',
    'if ($created -isnot [datetime]) { $created = [System.Management.ManagementDateTimeConverter]::ToDateTime([string]$created) }',
    '[pscustomobject]@{ pid=[int]$item.ProcessId; parentPid=[int]$item.ParentProcessId; name=[string]$item.Name; executablePath=[string]$item.ExecutablePath; createdAtUtc=$created.ToUniversalTime().ToString(\'o\') } | ConvertTo-Json -Compress'
  ].join('; ');

  let stdout;
  try {
    ({ stdout } = await execFile('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', query], {
      windowsHide: true,
      timeout: 5000,
      maxBuffer: 16 * 1024
    }));
  } catch (error) {
    const wrapped = new Error(`process identity query failed for PID ${pid}: ${String(error?.message ?? error).slice(0, 240)}`);
    wrapped.code = 'PROCESS_IDENTITY_QUERY_FAILED';
    throw wrapped;
  }

  const text = String(stdout).trim();
  if (!text || text === 'null') return null;
  let value;
  try { value = JSON.parse(text); }
  catch { throw Object.assign(new Error('process identity query returned malformed JSON'), { code: 'PROCESS_IDENTITY_INVALID' }); }

  const identity = {
    pid: Number(value.pid),
    parentPid: Number(value.parentPid),
    name: String(value.name ?? ''),
    executablePath: String(value.executablePath ?? ''),
    createdAtUtc: String(value.createdAtUtc ?? '')
  };
  if (identity.pid !== pid || !Number.isSafeInteger(identity.parentPid) || !identity.name || !path.win32.isAbsolute(identity.executablePath) || !identity.createdAtUtc) {
    throw Object.assign(new Error(`process identity for PID ${pid} was incomplete`), { code: 'PROCESS_IDENTITY_INCOMPLETE' });
  }
  return identity;
}

export async function waitForWindowsProcessIdentity(pid, { timeoutMs = 3000, pollIntervalMs = 50, expectedExecutablePath } = {}) {
  const deadline = Date.now() + timeoutMs;
  do {
    const identity = await readWindowsProcessIdentity(pid);
    if (identity && (!expectedExecutablePath || normalizeWindowsPath(identity.executablePath) === normalizeWindowsPath(expectedExecutablePath))) return identity;
    if (Date.now() >= deadline) return null;
    await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
  } while (Date.now() <= deadline);
  return null;
}

export function sameWindowsProcessIdentity(expected, observed) {
  return Boolean(expected && observed &&
    expected.pid === observed.pid &&
    expected.parentPid === observed.parentPid &&
    String(expected.name).toLowerCase() === String(observed.name).toLowerCase() &&
    normalizeWindowsPath(expected.executablePath) === normalizeWindowsPath(observed.executablePath) &&
    expected.createdAtUtc === observed.createdAtUtc);
}

export async function terminateOwnedTestProcess(child, expectedIdentity, { readIdentity = readWindowsProcessIdentity, timeoutMs = 5000 } = {}) {
  if (!child || !Number.isSafeInteger(child.pid) || child.pid !== expectedIdentity?.pid || typeof child.kill !== 'function') {
    return { ok: false, status: 'OWNERSHIP_UNPROVEN', reason: 'retained child handle does not match captured PID' };
  }

  const observed = await readIdentity(expectedIdentity.pid);
  if (!sameWindowsProcessIdentity(expectedIdentity, observed)) {
    return { ok: false, status: 'OWNERSHIP_UNPROVEN', reason: 'live PID/executable/start identity differs from captured launch' };
  }
  if (child.exitCode !== null || child.signalCode !== null) {
    return { ok: true, status: 'ALREADY_EXITED', pid: child.pid };
  }

  let closeListener;
  let timer;
  const closed = new Promise(resolve => {
    closeListener = () => resolve(true);
    child.once('close', closeListener);
    if (child.exitCode !== null || child.signalCode !== null) resolve(true);
    timer = setTimeout(() => resolve(false), timeoutMs);
  });

  let requested = false;
  try { requested = child.kill(); }
  catch (error) {
    clearTimeout(timer);
    child.off('close', closeListener);
    return { ok: false, status: 'CLEANUP_FAILED', pid: child.pid, reason: String(error?.message ?? error).slice(0, 240) };
  }
  if (!requested) {
    clearTimeout(timer);
    child.off('close', closeListener);
    return { ok: false, status: 'CLEANUP_UNCONFIRMED', pid: child.pid, reason: 'retained child handle refused termination' };
  }

  const closeObserved = await closed;
  clearTimeout(timer);
  child.off('close', closeListener);
  if (!closeObserved) return { ok: false, status: 'CLEANUP_UNCONFIRMED', pid: child.pid, reason: 'owned process exit was not observed before deadline' };

  const after = await readIdentity(expectedIdentity.pid);
  if (sameWindowsProcessIdentity(expectedIdentity, after)) {
    return { ok: false, status: 'CLEANUP_UNCONFIRMED', pid: child.pid, reason: 'captured process identity remains present after close event' };
  }
  return { ok: true, status: 'TERMINATED', pid: child.pid };
}
