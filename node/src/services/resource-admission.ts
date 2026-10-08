// Canonical resource admission. Single decision path over the machine's real
// resource truth (free memory), optional VRAM truth (nvidia-smi when present),
// and host load where the platform reports it. Deterministic rules, recorded
// reasons, no mutation: admission never kills or restarts anything.
//
// Doctrine (from the machine reality: 16GB RAM, GTX 1060 6GB, ~7-8GB effective):
// - SAFETY floor: never admit below 512MB free.
// - Resident reserve: disposable workers must leave 1024MB for the Permanent
//   Resident; resident admissions do not reserve against themselves.
// - Disposable requests that cannot fit QUEUE (they may fit later);
//   non-disposable requests that cannot fit are REFUSE_RESOURCE (hard).
// - Unknowable probes (load on win32, VRAM without nvidia-smi) are recorded as
//   unknown and never block an admission.
import { execFile } from 'node:child_process';
import os from 'node:os';
import type { AdmissionRequestT, AdmissionResponseT } from '../../../common/contracts/admission.ts';

const SAFETY_MB = 512;
const RESIDENT_RESERVE_MB = 1024;
const VRAM_SAFETY_MB = 256;

// Conservative preflight for the only locally qualified product profile on
// this host (Unsloth V1 / Windows Administrator / Vulkan / GTX 1060).
// These values are intentionally separate from the generic worker/resident
// admission policy and must not be inferred for other machines or models.
export const LOCAL_RUNTIME_START_FLOORS = Object.freeze({
  freePhysicalMemoryMB: 6_656,
  freeCommitMB: 5_120,
  freeVramMB: 4_608,
  gpuUtilizationBelowPercent: 50
});

function defaultCommitProbeMB(): Promise<number | null> {
  if (process.platform !== 'win32') return Promise.resolve(null);
  return new Promise(resolve => {
    const script = "$ErrorActionPreference='Stop'; $s=Get-Counter -Counter '\\Memory\\Commit Limit','\\Memory\\Committed Bytes'; $limit=[double](($s.CounterSamples | Where-Object { $_.Path.ToLowerInvariant().EndsWith('\\commit limit') }).CookedValue); $used=[double](($s.CounterSamples | Where-Object { $_.Path.ToLowerInvariant().EndsWith('\\committed bytes') }).CookedValue); [Console]::Out.WriteLine([math]::Floor(($limit-$used)/1MB))";
    execFile('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', script], { timeout: 5000, windowsHide: true }, (error, stdout) => {
      if (error) { resolve(null); return; }
      const value = Number(String(stdout).trim());
      resolve(Number.isFinite(value) && value >= 0 ? value : null);
    });
  });
}

function defaultGpuUtilizationProbePercent(): Promise<number | null> {
  return new Promise(resolve => {
    execFile('nvidia-smi', ['--query-gpu=utilization.gpu', '--format=csv,noheader,nounits'], { timeout: 3000, windowsHide: true }, (error, stdout) => {
      if (error) { resolve(null); return; }
      const value = Number(String(stdout).split('\n').map(line => line.trim()).find(Boolean));
      resolve(Number.isFinite(value) && value >= 0 && value <= 100 ? value : null);
    });
  });
}

export interface ResourceAdmissionOptions {
  memoryProbeMB?: () => number;
  vramProbeMB?: () => Promise<number | null>;
  loadProbe?: () => number;
  cores?: number;
  safetyMB?: number;
  residentReserveMB?: number;
  commitProbeMB?: () => Promise<number | null>;
  gpuUtilizationProbePercent?: () => Promise<number | null>;
  now?: () => Date;
}

function defaultVramProbe(): Promise<number | null> {
  return new Promise(resolve => {
    try {
      execFile('nvidia-smi', ['--query-gpu=memory.free', '--format=csv,noheader,nounits'], { timeout: 3000, windowsHide: true }, (error, stdout) => {
        if (error) { resolve(null); return; }
        const first = String(stdout).split('\n').map(line => line.trim()).find(line => line.length > 0);
        const value = first === undefined ? Number.NaN : Number(first);
        resolve(Number.isFinite(value) ? value : null);
      });
    } catch {
      resolve(null);
    }
  });
}

export function createResourceAdmission(options: ResourceAdmissionOptions = {}) {
  const memoryProbeMB = options.memoryProbeMB ?? (() => Math.round(os.freemem() / 1048576));
  const vramProbeMB = options.vramProbeMB ?? defaultVramProbe;
  const loadProbe = options.loadProbe ?? (() => os.loadavg()[0] ?? 0);
  const cores = options.cores ?? os.cpus().length;
  const safetyMB = options.safetyMB ?? SAFETY_MB;
  const residentReserveMB = options.residentReserveMB ?? RESIDENT_RESERVE_MB;
  const commitProbeMB = options.commitProbeMB ?? defaultCommitProbeMB;
  const gpuUtilizationProbePercent = options.gpuUtilizationProbePercent ?? defaultGpuUtilizationProbePercent;
  const now = options.now ?? (() => new Date());

  const admit = async (request: AdmissionRequestT): Promise<AdmissionResponseT> => {
    const freeMB = memoryProbeMB();
    const [vramFreeMB, freeCommitMB] = await Promise.all([
      vramProbeMB().catch(() => null),
      request.requirement.free_commit_strictly_above_mb === undefined ? Promise.resolve(null) : commitProbeMB().catch(() => null)
    ]);
    const load = loadProbe();
    const disposable = request.disposable === true;
    const evidence: Record<string, string | number | boolean | null> = {
      free_memory_mb: freeMB,
      safety_mb: safetyMB,
      resident_reserve_mb: residentReserveMB,
      required_memory_mb: request.requirement.memory_mb ?? null,
      vram_free_mb: vramFreeMB,
      vram_required_mb: request.requirement.vram_mb ?? null,
      load_1m: load,
      cores,
      disposable,
      load_probe: load > 0 ? 'available' : 'unknown (platform reports no load average)'
    };
    if (request.requirement.minimum_free_memory_mb !== undefined) {
      evidence.minimum_free_memory_mb = request.requirement.minimum_free_memory_mb;
    }
    if (request.requirement.free_commit_strictly_above_mb !== undefined) {
      evidence.free_commit_mb = freeCommitMB;
      evidence.free_commit_strictly_above_mb = request.requirement.free_commit_strictly_above_mb;
    }
    if (request.workload) {
      evidence.worker_session_id = request.workload.worker_session_id;
      evidence.project_id = request.workload.project_id;
      evidence.checkout_id = request.workload.checkout_id;
      evidence.route_id = request.workload.route_id;
      evidence.model_id = request.workload.model_id;
      evidence.artifact_sha256 = request.workload.artifact_sha256;
      evidence.runtime_id = request.workload.runtime_id;
      evidence.runtime_version = request.workload.runtime_version;
      evidence.context_tokens = request.workload.context_tokens;
    }
    const finish = (decision: AdmissionResponseT['decision'], reason: string): AdmissionResponseT => ({
      decision, kind: request.kind, reason, evidence, checked_at: now().toISOString()
    });

    if (!Number.isFinite(freeMB)) {
      return finish('REFUSE_RESOURCE', 'system free physical memory could not be measured');
    }
    if (freeMB < safetyMB) {
      return finish('REFUSE_RESOURCE', `system free memory ${freeMB}MB is below the ${safetyMB}MB safety floor`);
    }
    if (request.requirement.minimum_free_memory_mb !== undefined && freeMB < request.requirement.minimum_free_memory_mb) {
      return finish('REFUSE_RESOURCE', `free physical memory ${freeMB}MB is below the request floor ${request.requirement.minimum_free_memory_mb}MB`);
    }
    if (request.requirement.free_commit_strictly_above_mb !== undefined) {
      if (freeCommitMB === null || !Number.isFinite(freeCommitMB)) {
        return finish('REFUSE_RESOURCE', 'free Windows commit could not be measured for this worker request');
      }
      if (freeCommitMB <= request.requirement.free_commit_strictly_above_mb) {
        return finish('REFUSE_RESOURCE', `free commit ${freeCommitMB}MB must be greater than ${request.requirement.free_commit_strictly_above_mb}MB`);
      }
    }
    const reserveApplied = request.kind === 'resident' ? 0 : residentReserveMB;
    const usableMB = freeMB - safetyMB - reserveApplied;
    if (request.requirement.memory_mb !== undefined && request.requirement.memory_mb > usableMB) {
      const msg = `requires ${request.requirement.memory_mb}MB but only ${usableMB}MB usable (free ${freeMB}MB - safety ${safetyMB}MB - resident reserve ${reserveApplied}MB)`;
      return disposable ? finish('QUEUE', `disposable request queued: ${msg}`) : finish('REFUSE_RESOURCE', msg);
    }
    if (request.requirement.vram_mb !== undefined && vramFreeMB !== null) {
      const vramUsableMB = vramFreeMB - VRAM_SAFETY_MB;
      if (request.requirement.vram_mb > vramUsableMB) {
        const msg = `requires ${request.requirement.vram_mb}MB VRAM but only ${vramUsableMB}MB usable (free ${vramFreeMB}MB - safety ${VRAM_SAFETY_MB}MB)`;
        return disposable ? finish('QUEUE', `disposable request queued: ${msg}`) : finish('REFUSE_RESOURCE', msg);
      }
    }
    if (request.kind === 'worker' && load > 0 && load > cores * 2) {
      return finish('QUEUE', `disposable worker queued: host load ${load.toFixed(2)} exceeds ${cores * 2} (2x cores)`);
    }
    return finish('START', `admitted: ${request.kind} fits within usable resources`);
  };

  const admitLocalRuntimeStart = async (): Promise<AdmissionResponseT> => {
    const base = await admit({ kind: 'model_start', requirement: {}, disposable: false });
    const [freeCommitMB, gpuUtilizationPercent] = await Promise.all([
      commitProbeMB().catch(() => null),
      gpuUtilizationProbePercent().catch(() => null)
    ]);
    const freeMemoryMB = base.evidence.free_memory_mb;
    const freeVramMB = base.evidence.vram_free_mb;
    const evidence = {
      ...base.evidence,
      minimum_free_physical_memory_mb: LOCAL_RUNTIME_START_FLOORS.freePhysicalMemoryMB,
      free_commit_mb: freeCommitMB,
      minimum_free_commit_mb: LOCAL_RUNTIME_START_FLOORS.freeCommitMB,
      minimum_free_vram_mb: LOCAL_RUNTIME_START_FLOORS.freeVramMB,
      gpu_utilization_percent: gpuUtilizationPercent,
      gpu_utilization_must_be_below_percent: LOCAL_RUNTIME_START_FLOORS.gpuUtilizationBelowPercent
    };
    const failures: string[] = [];
    if (base.decision !== 'START') failures.push(base.reason);
    if (typeof freeMemoryMB !== 'number' || !Number.isFinite(freeMemoryMB) || freeMemoryMB < LOCAL_RUNTIME_START_FLOORS.freePhysicalMemoryMB) {
      failures.push(`free physical memory ${String(freeMemoryMB)}MB is below the ${LOCAL_RUNTIME_START_FLOORS.freePhysicalMemoryMB}MB local runtime start floor`);
    }
    if (freeCommitMB === null) failures.push('free Windows commit could not be measured; local runtime start is refused');
    else if (freeCommitMB < LOCAL_RUNTIME_START_FLOORS.freeCommitMB) failures.push(`free commit ${freeCommitMB}MB is below the ${LOCAL_RUNTIME_START_FLOORS.freeCommitMB}MB local runtime start floor`);
    if (typeof freeVramMB !== 'number' || !Number.isFinite(freeVramMB) || freeVramMB < LOCAL_RUNTIME_START_FLOORS.freeVramMB) {
      failures.push(`free VRAM ${String(freeVramMB)}MB is below the ${LOCAL_RUNTIME_START_FLOORS.freeVramMB}MB qualified-profile start floor`);
    }
    if (gpuUtilizationPercent === null) failures.push('GPU utilization could not be measured; local runtime start is refused');
    else if (gpuUtilizationPercent >= LOCAL_RUNTIME_START_FLOORS.gpuUtilizationBelowPercent) failures.push(`GPU utilization ${gpuUtilizationPercent}% is not below the ${LOCAL_RUNTIME_START_FLOORS.gpuUtilizationBelowPercent}% qualified-profile limit`);
    return {
      ...base,
      decision: failures.length === 0 ? 'START' : 'REFUSE_RESOURCE',
      reason: failures.length === 0 ? 'admitted: current host sample meets the qualified local runtime start floors' : failures.join('; ').slice(0, 600),
      evidence
    };
  };

  return { admit, admitLocalRuntimeStart };
}
