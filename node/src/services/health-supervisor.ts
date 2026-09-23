// Canonical Health Supervisor. Deterministic component states over the truth
// sources that actually exist in this process: backend liveness (this handler
// answering), owned model engine bookkeeping (Wave 10A pid map) cross-checked
// with the model runtime status, and honest UNKNOWN for probes that are not
// wired (facade identity, resident runtime, worker registry, remote bridge).
//
// Rules:
// - PID existence alone is not health: a recorded pid that is alive but has no
//   status truth is UNKNOWN; a dead recorded pid is DEGRADED (stale bookkeeping).
// - No automatic recovery happens here; this service only observes. The
//   deterministic recovery hook is sweepStaleEngines at model-runtime startup.
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { HealthComponentStateT, HealthComponentT, HealthResponseT } from '../../../common/contracts/health.ts';

interface EngineRecord {
  pid?: unknown;
  file?: unknown;
}

interface EngineObservation {
  modelId: string;
  pid: number | null;
  file: string | null;
  alive: boolean;
}

export interface HealthSupervisorOptions {
  workspace: string;
  version: string;
  modelStatus?: () => Promise<{ models: Array<{ id: string; status: string }> }>;
  enginePidsPath?: string;
  isProcessAlive?: (pid: number) => boolean;
  now?: () => Date;
}

function defaultIsProcessAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
}

const RUNNING_MODEL_STATUSES = new Set(['running', 'ready', 'loaded']);
const FAILED_MODEL_STATUSES = new Set(['error', 'failed', 'crashed']);

export function createHealthSupervisor(options: HealthSupervisorOptions) {
  const enginePidsPath = options.enginePidsPath ?? path.join(options.workspace, '.aide', 'model-engines.json');
  const isProcessAlive = options.isProcessAlive ?? defaultIsProcessAlive;
  const now = options.now ?? (() => new Date());

  const readEngines = async (): Promise<EngineObservation[]> => {
    try {
      const raw = JSON.parse(await fs.readFile(enginePidsPath, 'utf8')) as Record<string, EngineRecord>;
      return Object.entries(raw).map(([modelId, record]) => {
        const pid = typeof record?.pid === 'number' ? record.pid : null;
        const file = typeof record?.file === 'string' ? record.file : null;
        return { modelId, pid, file, alive: pid !== null && isProcessAlive(pid) };
      });
    } catch {
      return [];
    }
  };

  const observeModelEngines = async (checkedAt: string): Promise<HealthComponentT> => {
    const engines = await readEngines();
    const models = options.modelStatus === undefined ? null : await options.modelStatus().catch(() => null);
    const running = models === null ? [] : models.models.filter(model => RUNNING_MODEL_STATUSES.has(model.status));
    const failed = models === null ? [] : models.models.filter(model => FAILED_MODEL_STATUSES.has(model.status));
    const stale = engines.filter(engine => engine.pid !== null && !engine.alive);
    const evidence: Record<string, string | number | boolean | null> = {
      engines_recorded: engines.length,
      engines_alive: engines.filter(engine => engine.alive).length,
      engines_stale: stale.length,
      models_running: running.length,
      models_failed: failed.length,
      status_probe: models === null ? 'not wired' : 'wired'
    };
    if (engines.length === 0 && running.length === 0 && failed.length === 0) {
      return { component: 'model_engines', state: 'STOPPED', detail: 'no model engines observed', evidence, checked_at: checkedAt };
    }
    if (failed.length > 0) {
      return { component: 'model_engines', state: 'UNHEALTHY', detail: `model status reports failure: ${failed.map(model => model.id).join(', ')}`, evidence, checked_at: checkedAt };
    }
    if (stale.length > 0) {
      return { component: 'model_engines', state: 'DEGRADED', detail: `stale owned-engine bookkeeping: ${stale.map(engine => `${engine.modelId}#${String(engine.pid)}`).join(', ')}`, evidence, checked_at: checkedAt };
    }
    if (running.length > 0) {
      return { component: 'model_engines', state: 'HEALTHY', detail: `${running.length} model engine(s) running`, evidence, checked_at: checkedAt };
    }
    if (engines.length > 0 && models === null) {
      return { component: 'model_engines', state: 'UNKNOWN', detail: 'engine pids recorded and alive; no status probe wired to confirm readiness', evidence, checked_at: checkedAt };
    }
    return { component: 'model_engines', state: 'STOPPED', detail: 'engines recorded but no model is running', evidence, checked_at: checkedAt };
  };

  const snapshot = async (): Promise<HealthResponseT> => {
    const checkedAt = now().toISOString();
    const components: HealthComponentT[] = [
      {
        component: 'backend',
        state: 'HEALTHY',
        detail: 'route handler executing in-process (liveness by evidence)',
        evidence: { pid: process.pid, uptime_ms: Math.round(process.uptime() * 1000) },
        checked_at: checkedAt
      },
      {
        component: 'facade',
        state: 'UNKNOWN',
        detail: 'facade identity is not observable from the backend process',
        evidence: {},
        checked_at: checkedAt
      },
      await observeModelEngines(checkedAt),
      {
        component: 'resident',
        state: 'UNKNOWN',
        detail: 'resident runtime not wired into this process',
        evidence: {},
        checked_at: checkedAt
      },
      {
        component: 'workers',
        state: 'UNKNOWN',
        detail: 'no worker registry probe wired',
        evidence: {},
        checked_at: checkedAt
      },
      {
        component: 'remote_bridge',
        state: 'UNKNOWN',
        detail: 'remote bridge not present',
        evidence: {},
        checked_at: checkedAt
      }
    ];
    const states = new Set(components.map(component => component.state));
    let aggregate: HealthComponentStateT = 'HEALTHY';
    if (states.has('UNHEALTHY')) aggregate = 'UNHEALTHY';
    else if (states.has('DEGRADED')) aggregate = 'DEGRADED';
    else if (states.has('STARTING') || states.has('STOPPED')) aggregate = 'DEGRADED';
    return {
      version: options.version,
      uptimeMs: Math.round(process.uptime() * 1000),
      workspace: path.resolve(options.workspace),
      freeMemoryMB: Math.round(os.freemem() / 1048576),
      state: aggregate,
      components,
      checked_at: checkedAt
    };
  };

  return { snapshot };
}
