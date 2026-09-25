// Dogfood host resource preflight against the frozen start gates.
// Writes evidence JSON; prints a compact summary.
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const EVIDENCE_PATH = path.resolve('docs', 'v1', 'dogfood', 'evidence', 'HOST-PREFLIGHT.json');
const GIB = 1024 ** 3;

function psJson(script) {
  const b64 = Buffer.from(script, 'utf16le').toString('base64');
  return JSON.parse(execFileSync('powershell.exe', ['-NoProfile', '-EncodedCommand', b64], { encoding: 'utf8', timeout: 20000, windowsHide: true }).trim() || 'null');
}

const out = { schema: 'dogfood-host-preflight-v1', at: new Date().toISOString(), observed: {}, gates: {}, pass: false };

try {
  out.observed.admin = psJson('$a=([Security.Principal.WindowsPrincipal]([Security.Principal.WindowsIdentity]::GetCurrent())).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator); $m=Get-CimInstance Win32_PerfFormattedData_PerfOS_Memory; [pscustomobject]@{is_admin=$a; commit_free_bytes=[long]($m.CommitLimit-$m.CommittedBytes); commit_used_bytes=[long]$m.CommittedBytes; commit_limit_bytes=[long]$m.CommitLimit} | ConvertTo-Json -Compress');
} catch (error) { out.observed.admin = { error: String(error.message).slice(0, 120) }; }

try {
  out.observed.ram = { free_bytes: os.freemem(), total_bytes: os.totalmem() };
} catch {}

try {
  const gpu = execFileSync('nvidia-smi.exe', ['--query-gpu=memory.used,memory.free,utilization.gpu', '--format=csv,noheader,nounits'], { encoding: 'utf8', timeout: 8000, windowsHide: true }).trim().split(/\r?\n/)[0];
  const [used, free, util] = gpu.split(',').map(v => Number(v.trim()));
  out.observed.gpu = { used_mib: used, free_mib: free, utilization_percent: util };
} catch (error) { out.observed.gpu = { error: String(error.message).slice(0, 100) }; }

try {
  const procs = psJson('@(Get-CimInstance Win32_Process | Where-Object { $_.Name -match "llama|unsloth" } | Select-Object Name,ProcessId,ParentProcessId) | ConvertTo-Json -Compress');
  out.observed.runtime_processes = [].concat(procs ?? []);
  out.observed.llama_count = out.observed.runtime_processes.filter(p => /llama/i.test(p.Name ?? '')).length;
  out.observed.unsloth_count = out.observed.runtime_processes.filter(p => /unsloth/i.test(p.Name ?? '')).length;
} catch (error) { out.observed.runtime_processes = { error: String(error.message).slice(0, 100) }; }

try {
  const listener = psJson('(Get-NetTCPConnection -LocalPort 18888 -State Listen -ErrorAction SilentlyContinue | Measure-Object).Count | ConvertTo-Json -Compress');
  out.observed.port_18888_listeners = Number(listener ?? 0);
} catch { out.observed.port_18888_listeners = null; }

const freeRamGiB = out.observed.ram ? out.observed.ram.free_bytes / GIB : null;
const commitFreeGiB = out.observed.admin?.commit_free_bytes ? out.observed.admin.commit_free_bytes / GIB : null;
const vramFreeMiB = out.observed.gpu?.free_mib ?? null;
const util = out.observed.gpu?.utilization_percent ?? null;

out.gates = {
  administrator_required: out.observed.admin?.is_admin === true,
  free_ram_ge_6_5_gib: freeRamGiB !== null && freeRamGiB >= 6.5,
  free_commit_ge_5_gib: commitFreeGiB !== null && commitFreeGiB >= 5,
  free_vram_ge_4608_mib: vramFreeMiB !== null && vramFreeMiB >= 4608,
  gpu_util_lt_50: util !== null && util < 50,
  no_existing_runtime: (out.observed.llama_count ?? 0) === 0 && (out.observed.unsloth_count ?? 0) === 0,
  port_18888_free: (out.observed.port_18888_listeners ?? 0) === 0
};
out.pass = Object.values(out.gates).every(Boolean);
out.summary = {
  free_ram_gib: freeRamGiB === null ? null : Number(freeRamGiB.toFixed(2)),
  commit_free_gib: commitFreeGiB === null ? null : Number(commitFreeGiB.toFixed(2)),
  vram_free_mib: vramFreeMiB,
  gpu_util: util,
  llama_count: out.observed.llama_count ?? null,
  unsloth_count: out.observed.unsloth_count ?? null,
  port_18888_listeners: out.observed.port_18888_listeners ?? null
};

await fs.mkdir(path.dirname(EVIDENCE_PATH), { recursive: true });
await fs.writeFile(EVIDENCE_PATH, JSON.stringify(out, null, 2));
console.log(JSON.stringify({ pass: out.pass, gates: out.gates, summary: out.summary }, null, 2));
