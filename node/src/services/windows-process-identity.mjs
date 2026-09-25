import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';

const execFile = promisify(execFileCallback);

function normalizeWindowsPath(value) {
  return String(value ?? '').replace(/^\\\\\?\\/, '').replaceAll('/', '\\').replace(/\\+$/, '').toLowerCase();
}

export function windowsProcessIdentityQuery(pid) {
  if (!Number.isSafeInteger(pid) || pid <= 0) throw new TypeError('PID must be a positive safe integer');
  return [
    "$ErrorActionPreference = 'Stop'",
    `$targetPid = ${pid}`,
    '$item = Get-CimInstance -ClassName Win32_Process -Filter "ProcessId = $targetPid" -ErrorAction SilentlyContinue',
    "if ($null -eq $item) { [Console]::Out.Write('null'); exit 0 }",
    '$created = $item.CreationDate',
    'if ($created -isnot [datetime]) { $created = [System.Management.ManagementDateTimeConverter]::ToDateTime([string]$created) }',
    '[pscustomobject]@{ pid=[int]$item.ProcessId; parentPid=[int]$item.ParentProcessId; name=[string]$item.Name; executablePath=[string]$item.ExecutablePath; createdAtUtc=$created.ToUniversalTime().ToString(\'o\') } | ConvertTo-Json -Compress'
  ].join('; ');
}

export function parseWindowsProcessIdentity(pid, stdout) {
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

export function sameWindowsProcessIdentity(expected, observed) {
  return Boolean(expected && observed &&
    expected.pid === observed.pid &&
    expected.parentPid === observed.parentPid &&
    String(expected.name).toLowerCase() === String(observed.name).toLowerCase() &&
    normalizeWindowsPath(expected.executablePath) === normalizeWindowsPath(observed.executablePath) &&
    expected.createdAtUtc === observed.createdAtUtc);
}

export async function readWindowsProcessIdentity(pid) {
  if (process.platform !== 'win32') throw new Error('Windows process identity is available only on Windows');
  let stdout;
  try {
    ({ stdout } = await execFile('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', windowsProcessIdentityQuery(pid)], {
      windowsHide: true,
      timeout: 5000,
      maxBuffer: 16 * 1024
    }));
  } catch (error) {
    const wrapped = new Error(`process identity query failed for PID ${pid}: ${String(error?.message ?? error).slice(0, 240)}`);
    wrapped.code = 'PROCESS_IDENTITY_QUERY_FAILED';
    throw wrapped;
  }
  return parseWindowsProcessIdentity(pid, stdout);
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
