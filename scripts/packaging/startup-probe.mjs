import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const processTreeScript = path.join(here, 'process-tree.ps1');
const portScript = path.join(here, 'port-preflight.ps1');
const eventScript = path.join(here, 'application-events.ps1');

function readOptions(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key.startsWith('--') || !value || value.startsWith('--')) throw new Error('expected --name value arguments');
    options[key.slice(2)] = value;
    index += 1;
  }
  return options;
}

function runPowerShell(script, args) {
  return new Promise((resolve, reject) => {
    const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script, ...args], {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', value => { stdout += value; });
    child.stderr.on('data', value => { stderr += value; });
    child.once('error', reject);
    child.once('close', code => {
      if (code !== 0) reject(new Error('PowerShell diagnostic failed with exit ' + code + (stderr.trim() ? ': ' + stderr.trim().slice(-500) : '')));
      else {
        try { resolve(JSON.parse(stdout.trim())); }
        catch { reject(new Error('PowerShell diagnostic returned invalid JSON' + (stderr ? ': ' + stderr.slice(-300) : ''))); }
      }
    });
  });
}

function waitForExit(child) {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve();
  return new Promise(resolve => child.once('close', resolve));
}

export async function runStartupProbe({
  executable,
  args = [],
  cwd = process.cwd(),
  timeoutMs = 10000,
  observeMs = 500,
  ports = []
}) {
  if (!path.isAbsolute(executable)) throw new Error('target executable must be an absolute path');
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 300000) throw new Error('timeoutMs must be between 100 and 300000');
  observeMs = Math.min(Math.max(0, observeMs), timeoutMs);
  if (!Array.isArray(args) || args.some(value => typeof value !== 'string')) throw new Error('args must be a string array');
  const target = await fs.realpath(executable);
  const portBaseline = ports.length && process.platform === 'win32'
    ? await runPowerShell(portScript, ['-Ports', ...ports.map(String)]).catch(() => 'UNAVAILABLE')
    : ports.length ? 'UNAVAILABLE ON THIS PLATFORM' : 'NOT REQUESTED';
  const startedAt = new Date();
  const start = process.hrtime.bigint();
  const deadline = Date.now() + timeoutMs;
  const child = spawn(target, args, { cwd, shell: false, windowsHide: false, stdio: ['ignore', 'pipe', 'pipe'] });
  const portDuringPromise = ports.length && process.platform === 'win32'
    ? runPowerShell(portScript, ['-Ports', ...ports.map(String)]).catch(() => 'UNAVAILABLE')
    : Promise.resolve(ports.length ? 'UNAVAILABLE ON THIS PLATFORM' : 'NOT REQUESTED');
  let outputBytes = 0;
  child.stdout.on('data', chunk => { outputBytes += chunk.length; });
  child.stderr.on('data', chunk => { outputBytes += chunk.length; });
  const exit = new Promise(resolve => child.once('close', (code, signal) => resolve({ code, signal })));
  const result = {
    schema_version: 1,
    target_executable: target,
    target_arguments_recorded: false,
    started_at: startedAt.toISOString(),
    timeout_ms: timeoutMs,
    deadline_at: new Date(startedAt.getTime() + timeoutMs).toISOString(),
    pid: child.pid ?? null,
    parent_pid: process.pid,
    owned_children: [],
    window_appeared: 'UNVERIFIED',
    responsive: 'UNVERIFIED',
    startup_duration_ms: null,
    deadline_overrun_ms: null,
    unexpected_exit: false,
    exit_code: null,
    signal: null,
    timeout: false,
    configured_ports: ports,
    port_state_before: portBaseline,
    port_state_during: 'PENDING',
    port_state_after: 'PENDING',
    application_events: 'NOT COLLECTED',
    output_bytes_discarded: 0,
    cleanup: 'NOT REQUIRED'
  };
  let snapshotError = null;
  if (!child.pid) {
    result.unexpected_exit = true;
    result.exit_code = null;
    result.startup_duration_ms = Number(process.hrtime.bigint() - start) / 1e6;
    return result;
  }
  let completed = false;
  let exitValue = null;
  const observed = await Promise.race([
    new Promise(resolve => setTimeout(() => resolve(false), Math.min(observeMs, Math.max(0, deadline - Date.now())))),
    exit.then(value => { completed = true; exitValue = value; return true; })
  ]);
  let snapshot = null;
  if (!completed && process.platform === 'win32') {
    snapshot = await runPowerShell(processTreeScript, [
      '-Mode', 'Snapshot', '-RootPid', String(child.pid), '-RootPath', target, '-StartedAt', startedAt.toISOString()
    ]).catch(error => { snapshotError = error.message; return null; });
    if (snapshotError) result.ownership_diagnostic = snapshotError;
    if (snapshot?.error) result.cleanup = 'OWNERSHIP SNAPSHOT FAILED — CLEANUP NOT ATTEMPTED';
    else if (snapshot?.tree) {
      result.owned_children = [
        ...snapshot.tree.filter(item => item.depth > 0),
        ...(snapshot.unknown_children ?? [])
      ];
      const rootRecord = snapshot.tree.find(item => item.depth === 0);
      result.window_appeared = rootRecord?.window_appeared === null || rootRecord?.window_appeared === undefined ? 'UNVERIFIED' : rootRecord.window_appeared;
      result.responsive = rootRecord?.responsive === null || rootRecord?.responsive === undefined ? 'UNVERIFIED' : rootRecord.responsive;
    }
  }
  if (!completed) {
    const timed = await Promise.race([
      new Promise(resolve => setTimeout(() => resolve(true), Math.max(0, deadline - Date.now()))),
      exit.then(value => { completed = true; exitValue = value; return false; })
    ]);
    if (timed && !completed) {
      result.timeout = true;
      if (process.platform === 'win32' && snapshot && !snapshot.error) {
        const cleanup = await runPowerShell(processTreeScript, [
          '-Mode', 'Cleanup', '-RootPid', String(child.pid), '-RootPath', target, '-StartedAt', startedAt.toISOString()
        ]).catch(() => null);
        result.cleanup = cleanup?.cleanup_verified ? 'EXACT OWNED PROCESS TREE CLEANED AND VERIFIED' : 'CLEANUP UNVERIFIED';
        result.owned_children = cleanup?.tree
          ? [...cleanup.tree.filter(item => item.depth > 0), ...(cleanup.unknown_children ?? [])]
          : result.owned_children;
      } else {
        child.kill();
        result.cleanup = 'EXACT ROOT PID TERMINATION REQUESTED; CHILD TREE UNVERIFIED';
      }
      await Promise.race([waitForExit(child), new Promise(resolve => setTimeout(resolve, 3000))]);
      completed = true;
      exitValue = { code: child.exitCode, signal: child.signalCode };
    }
  }
  result.startup_duration_ms = Number(process.hrtime.bigint() - start) / 1e6;
  result.deadline_overrun_ms = Math.max(0, result.startup_duration_ms - timeoutMs);
  result.output_bytes_discarded = outputBytes;
  if (completed && exitValue) {
    result.exit_code = exitValue.code;
    result.signal = exitValue.signal;
    result.unexpected_exit = !result.timeout && exitValue.code !== 0;
  }
  result.port_state_during = await portDuringPromise;
  result.port_state_after = ports.length && process.platform === 'win32'
    ? await runPowerShell(portScript, ['-Ports', ...ports.map(String)]).catch(() => 'UNAVAILABLE')
    : ports.length ? 'UNAVAILABLE ON THIS PLATFORM' : 'NOT REQUESTED';
  if (process.platform === 'win32') {
    const eventResult = await runPowerShell(eventScript, [
      '-RootPid', String(child.pid), '-RootPath', target,
      '-FromTime', startedAt.toISOString(), '-ToTime', new Date().toISOString()
    ]).catch(() => null);
    result.application_events = eventResult ?? 'UNAVAILABLE';
  }
  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const options = readOptions(process.argv.slice(2));
    if (!options.target) throw new Error('--target is required');
    const args = options['args-json'] ? JSON.parse(options['args-json']) : [];
    const ports = options.ports ? options.ports.split(',').map(Number) : [];
    const report = await runStartupProbe({
      executable: path.resolve(options.target),
      args,
      cwd: options.cwd ? path.resolve(options.cwd) : process.cwd(),
      timeoutMs: Number(options['timeout-ms'] ?? 10000),
      observeMs: Number(options['observe-ms'] ?? 500),
      ports
    });
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
    if (report.timeout || report.cleanup === 'CLEANUP UNVERIFIED' || report.cleanup.includes('FAILED')) process.exitCode = 1;
  } catch (error) {
    process.stderr.write(String(error?.message ?? error) + '\n');
    process.exitCode = 2;
  }
}
