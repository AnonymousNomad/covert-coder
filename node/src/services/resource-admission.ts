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

export interface ResourceAdmissionOptions {
  memoryProbeMB?: () => number;
  vramProbeMB?: () => Promise<number | null>;
  loadProbe?: () => number;
  cores?: number;
  safetyMB?: number;
  residentReserveMB?: number;
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
  const now = options.now ?? (() => new Date());

  const admit = async (request: AdmissionRequestT): Promise<AdmissionResponseT> => {
    const freeMB = memoryProbeMB();
    const vramFreeMB = await vramProbeMB().catch(() => null);
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
    const finish = (decision: AdmissionResponseT['decision'], reason: string): AdmissionResponseT => ({
      decision, kind: request.kind, reason, evidence, checked_at: now().toISOString()
    });

    if (freeMB < safetyMB) {
      return finish('REFUSE_RESOURCE', `system free memory ${freeMB}MB is below the ${safetyMB}MB safety floor`);
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

  return { admit };
}
