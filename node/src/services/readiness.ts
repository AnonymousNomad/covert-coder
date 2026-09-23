// Canonical first-run readiness. Deterministic items over the SAME truth
// sources the rest of the system uses: the Health Supervisor, the model
// runtime, git's truthful non-repo contract, the workspace filesystem, and
// the canonical resource admission path. No parallel resource/health truth.
//
// Aggregate rules:
// - ready: true when no item is BLOCKED with blocking=true.
// - ready_for_golden_mission: ready AND a model is RUNNING AND admission of a
//   model-sized request (1024MB) STARTs or QUEUEs.
import type { ReadinessItemT, ReadinessResponseT } from '../../../common/contracts/readiness.ts';

export interface ReadinessSources {
  healthSnapshot: () => Promise<{ state: string; components: Array<{ component: string; state: string }> }>;
  modelsStatus: () => Promise<{ models: Array<{ id: string; status: string }> }>;
  rgAvailable: () => boolean;
  workspaceWritable: () => Promise<boolean>;
  gitRepo: () => Promise<{ git_repo: boolean }>;
  memoryAdmit: () => Promise<{ decision: string; reason: string }>;
  now?: () => Date;
}

const RUNNING = new Set(['running', 'ready', 'loaded']);

export function createReadinessService(sources: ReadinessSources) {
  const now = sources.now ?? (() => new Date());

  const items = async (): Promise<ReadinessItemT[]> => {
    const result: ReadinessItemT[] = [];
    const health = await sources.healthSnapshot().catch(() => null);
    if (health === null) {
      result.push({ id: 'core', state: 'BLOCKED', code: 'CORE_PROBE_FAILED', explanation: 'health supervisor did not answer', repair: 'restart the Covert backend and check logs', blocking: true });
    } else if (health.state === 'UNHEALTHY') {
      result.push({ id: 'core', state: 'BLOCKED', code: 'CORE_UNHEALTHY', explanation: 'health supervisor reports UNHEALTHY', repair: 'open the health panel and repair the failing component', blocking: true });
    } else if (health.state === 'DEGRADED') {
      result.push({ id: 'core', state: 'DEGRADED', code: 'CORE_DEGRADED', explanation: 'backend is serving but a subsystem is degraded', repair: null, blocking: false });
    } else {
      result.push({ id: 'core', state: 'READY', code: 'CORE_HEALTHY', explanation: 'backend healthy', repair: null, blocking: false });
    }
    const writable = await sources.workspaceWritable().catch(() => false);
    result.push(writable
      ? { id: 'workspace', state: 'READY', code: 'WORKSPACE_WRITABLE', explanation: 'workspace is writable', repair: null, blocking: false }
      : { id: 'workspace', state: 'BLOCKED', code: 'WORKSPACE_NOT_WRITABLE', explanation: 'workspace is not writable', repair: 'check folder permissions or choose another workspace', blocking: true });
    const git = await sources.gitRepo().catch(() => null);
    if (git === null) {
      result.push({ id: 'git', state: 'UNKNOWN', code: 'GIT_PROBE_FAILED', explanation: 'git status probe did not answer', repair: null, blocking: false });
    } else if (git.git_repo) {
      result.push({ id: 'git', state: 'READY', code: 'GIT_REPO', explanation: 'workspace is a git repository', repair: null, blocking: false });
    } else {
      result.push({ id: 'git', state: 'READY', code: 'NON_GIT_WORKSPACE', explanation: 'workspace is not a git repository; git features are hidden, everything else works', repair: 'git init to enable version control features', blocking: false });
    }
    const models = await sources.modelsStatus().catch(() => null);
    const runningModels = models === null ? [] : models.models.filter(model => RUNNING.has(model.status));
    if (models === null) {
      result.push({ id: 'models', state: 'UNKNOWN', code: 'MODEL_PROBE_FAILED', explanation: 'model runtime status did not answer', repair: null, blocking: false });
    } else if (runningModels.length > 0) {
      result.push({ id: 'models', state: 'READY', code: 'MODEL_RUNNING', explanation: `${runningModels.length} model engine(s) running`, repair: null, blocking: false });
    } else {
      result.push({ id: 'models', state: 'DEGRADED', code: 'NO_MODEL_RUNNING', explanation: 'no local model is running; the golden mission needs one', repair: 'import/register a model in the Model Hub and start it', blocking: false });
    }
    const admission = await sources.memoryAdmit().catch(() => null);
    if (admission === null) {
      result.push({ id: 'resources', state: 'UNKNOWN', code: 'ADMISSION_PROBE_FAILED', explanation: 'resource admission did not answer', repair: null, blocking: false });
    } else if (admission.decision === 'REFUSE_RESOURCE') {
      result.push({ id: 'resources', state: 'BLOCKED', code: 'INSUFFICIENT_MEMORY', explanation: admission.reason, repair: 'close heavy applications or wait for the Resident to free memory', blocking: true });
    } else if (admission.decision === 'QUEUE') {
      result.push({ id: 'resources', state: 'DEGRADED', code: 'RESOURCES_TIGHT', explanation: admission.reason, repair: 'the request will be admitted when resources free up', blocking: false });
    } else {
      result.push({ id: 'resources', state: 'READY', code: 'RESOURCES_OK', explanation: 'a model-sized admission fits', repair: null, blocking: false });
    }
    result.push(sources.rgAvailable()
      ? { id: 'tools', state: 'READY', code: 'SEARCH_AVAILABLE', explanation: 'workspace search backend available', repair: null, blocking: false }
      : { id: 'tools', state: 'DEGRADED', code: 'SEARCH_UNAVAILABLE', explanation: 'workspace search backend unavailable', repair: 'install ripgrep or use the built-in fallback', blocking: false });
    result.push({ id: 'resident', state: 'UNKNOWN', code: 'RESIDENT_NOT_WIRED', explanation: 'resident runtime not wired into this process', repair: null, blocking: false });
    result.push({ id: 'providers', state: 'OPTIONAL', code: 'PROVIDERS_BY_CHOICE', explanation: 'external providers are opt-in; local is the default', repair: null, blocking: false });
    return result;
  };

  const snapshot = async (): Promise<ReadinessResponseT> => {
    const all = await items();
    const ready = !all.some(item => item.blocking && item.state === 'BLOCKED');
    const modelReady = all.find(item => item.id === 'models')?.state === 'READY';
    const resourcesOk = ['READY', 'DEGRADED'].includes(all.find(item => item.id === 'resources')?.state ?? 'BLOCKED');
    return {
      ready,
      ready_for_golden_mission: ready && modelReady && resourcesOk,
      items: all,
      generated_at: now().toISOString()
    };
  };

  return { snapshot };
}
