import { createHash } from 'node:crypto';
import { createReadStream, existsSync } from 'node:fs';
import { execFile, spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import { CredentialStore } from './credentials.ts';
import {
  RuntimeCapabilityState,
  type RuntimeCapabilityDescriptorT,
  type RuntimeCapabilityStateT,
  type RuntimeHealthT,
  type RuntimeMetricsT,
  type RuntimeModelIdentityT,
  type RuntimeOwnershipT,
  type RuntimeStatusResponseT
} from '../../../common/contracts/runtime.ts';
import {
  RuntimeAdapterError,
  unknownMetrics,
  unknownModelIdentity,
  type RuntimeAdapter,
  type RuntimeInferenceRequest,
  type RuntimeInferenceResult,
  type RuntimeLoadRequest
} from './runtime-adapter.ts';

const STUDIO_SERVICE_MARKER = 'Unsloth UI Backend';
const DEFAULT_PORT = 18_888;
const DEFAULT_START_TIMEOUT_MS = 20_000;
export const UNSLOTH_API_KEY_CREDENTIAL_ID = 'unsloth-local-runtime';

type PortInspection = { state: 'FREE' } | { state: 'LISTENING'; pid: number } | { state: 'UNKNOWN' };
type AuthTokenProvider = () => Promise<string | null>;
type FetchLike = typeof fetch;
type SpawnLike = typeof spawn;
type ParentPidReader = (pid: number) => Promise<number | null>;
type ProcessTreeProbe = (rootPid: number, targetPid: number) => Promise<boolean | null>;

export interface UnslothRuntimeAdapterOptions {
  workspace: string;
  endpoint?: string;
  cliPath?: string;
  port?: number;
  fetcher?: FetchLike;
  spawnProcess?: SpawnLike;
  findExecutable?: () => Promise<string | null>;
  inspectPort?: (port: number) => Promise<PortInspection>;
  parentPidOf?: ParentPidReader;
  processTreeContains?: ProcessTreeProbe;
  terminateProcessTree?: (child: ChildProcess, pid: number) => Promise<void>;
  authTokenProvider?: AuthTokenProvider;
  credentialStore?: Pick<CredentialStore, 'get'>;
  discoverVersion?: (cliPath: string) => Promise<string | null>;
  startupTimeoutMs?: number;
  now?: () => Date;
}

interface ApiModel {
  id?: unknown;
  object?: unknown;
}

interface ChatResponse {
  choices?: Array<{
    message?: { content?: unknown; tool_calls?: unknown[] };
    finish_reason?: unknown;
  }>;
  usage?: { prompt_tokens?: unknown; completion_tokens?: unknown };
  error?: { message?: unknown };
}

function parseLoopbackEndpoint(input: string): URL {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new RuntimeAdapterError('INVALID_ENDPOINT', 'Unsloth endpoint must be an absolute loopback URL');
  }
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (url.protocol !== 'http:' || !['127.0.0.1', '::1', 'localhost'].includes(host) || url.username || url.password || url.search || url.hash) {
    throw new RuntimeAdapterError('INVALID_ENDPOINT', 'Unsloth endpoint must use HTTP on localhost, 127.0.0.1, or ::1 without embedded credentials');
  }
  if (!url.port) throw new RuntimeAdapterError('INVALID_ENDPOINT', 'Unsloth endpoint must include an explicit port');
  url.pathname = '';
  return url;
}

function discoverExecutable(): Promise<string | null> {
  const configured = process.env.AIDE_UNSLOTH_CLI;
  if (configured) return Promise.resolve(existsSync(configured) ? path.resolve(configured) : null);
  const command = process.platform === 'win32' ? 'where.exe' : 'which';
  return new Promise(resolve => {
    execFile(command, ['unsloth'], { windowsHide: true, timeout: 3000 }, (error, stdout) => {
      if (error) return resolve(null);
      const candidate = String(stdout).split(/\r?\n/).map(value => value.trim()).find(value =>
        value.length > 0 && existsSync(value) && (process.platform !== 'win32' || path.extname(value).toLowerCase() === '.exe')
      );
      resolve(candidate ? path.resolve(candidate) : null);
    });
  });
}

function inspectListeningPort(port: number): Promise<PortInspection> {
  if (!Number.isInteger(port) || port < 1 || port > 65535) return Promise.resolve({ state: 'UNKNOWN' });
  if (process.platform === 'win32') {
    const script = `try { $x = Get-NetTCPConnection -State Listen -LocalPort ${port} -ErrorAction Stop | Select-Object -First 1 -ExpandProperty OwningProcess; if ($null -eq $x) { 'FREE' } else { [string]$x } } catch { if ($_.FullyQualifiedErrorId -like 'CmdletizationQuery_NotFound,Get-NetTCPConnection*') { 'FREE' } else { exit 2 } }`;
    return new Promise(resolve => {
      execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true, timeout: 3000 }, (error, stdout) => {
        if (error) return resolve({ state: 'UNKNOWN' });
        const value = String(stdout).trim();
        if (value === 'FREE') return resolve({ state: 'FREE' });
        const pid = Number(value);
        resolve(Number.isInteger(pid) && pid > 0 ? { state: 'LISTENING', pid } : { state: 'UNKNOWN' });
      });
    });
  }
  return new Promise(resolve => {
    execFile('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'], { timeout: 3000 }, (error, stdout) => {
      const value = String(stdout ?? '').trim().split(/\r?\n/)[0] ?? '';
      const pid = Number(value);
      if (!error && Number.isInteger(pid) && pid > 0) return resolve({ state: 'LISTENING', pid });
      if (error && (error as NodeJS.ErrnoException).code === 'ENOENT') return resolve({ state: 'UNKNOWN' });
      if (error && Number(error.code) === 1 && value.length === 0) return resolve({ state: 'FREE' });
      resolve({ state: 'UNKNOWN' });
    });
  });
}

function readParentPid(pid: number): Promise<number | null> {
  if (!Number.isInteger(pid) || pid < 1) return Promise.resolve(null);
  if (process.platform === 'win32') {
    const script = `$p = Get-CimInstance Win32_Process -Filter "ProcessId = ${pid}" -ErrorAction SilentlyContinue; if ($p -ne $null) { [string]$p.ParentProcessId }`;
    return new Promise(resolve => {
      execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true, timeout: 3000 }, (error, stdout) => {
        if (error) return resolve(null);
        const text = String(stdout).trim();
        if (text.length === 0) return resolve(null);
        const parent = Number(text);
        resolve(Number.isInteger(parent) && parent >= 0 ? parent : null);
      });
    });
  }
  return new Promise(resolve => {
    execFile('ps', ['-o', 'ppid=', '-p', String(pid)], { timeout: 3000 }, (error, stdout) => {
      if (error) return resolve(null);
      const text = String(stdout).trim();
      if (text.length === 0) return resolve(null);
      const parent = Number(text);
      resolve(Number.isInteger(parent) && parent >= 0 ? parent : null);
    });
  });
}

export async function processIsInTree(rootPid: number, targetPid: number, parentPidOf: ParentPidReader = readParentPid): Promise<boolean | null> {
  if (!Number.isInteger(rootPid) || !Number.isInteger(targetPid) || rootPid < 1 || targetPid < 1) return false;
  let currentPid = targetPid;
  const visited = new Set<number>();
  for (let depth = 0; depth < 64; depth++) {
    if (currentPid === rootPid) return true;
    if (visited.has(currentPid)) return null;
    visited.add(currentPid);
    let parentPid: number | null;
    try {
      parentPid = await parentPidOf(currentPid);
    } catch {
      return null;
    }
    if (parentPid === null) return null;
    if (parentPid === 0) return false;
    if (parentPid === currentPid) return null;
    currentPid = parentPid;
  }
  return null;
}

function terminateOwnedProcessTree(child: ChildProcess, pid: number): Promise<void> {
  if (process.platform === 'win32') {
    return new Promise((resolve, reject) => {
      execFile('taskkill.exe', ['/PID', String(pid), '/T', '/F'], { windowsHide: true, timeout: 10_000 }, error => {
        if (error) reject(new RuntimeAdapterError('TREE_SHUTDOWN_FAILED', 'Windows could not stop the verified Covert-owned Unsloth process tree'));
        else resolve();
      });
    });
  }
  try {
    // Non-Windows launches are detached, making -pid the process group created for this child.
    process.kill(-pid, 'SIGTERM');
    return Promise.resolve();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ESRCH' && child.exitCode !== null) return Promise.resolve();
    return Promise.reject(new RuntimeAdapterError('TREE_SHUTDOWN_FAILED', 'the verified Covert-owned Unsloth process group could not be stopped'));
  }
}

function waitForChildExit(child: ChildProcess, timeoutMs: number): Promise<void> {
  if (child.exitCode !== null) return Promise.resolve();
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.removeListener('exit', onExit);
      child.removeListener('error', onError);
      reject(new RuntimeAdapterError('SHUTDOWN_TIMEOUT', 'Covert-owned Unsloth process did not exit'));
    }, timeoutMs);
    const finish = (): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.removeListener('exit', onExit);
      child.removeListener('error', onError);
      resolve();
    };
    const onExit = (): void => finish();
    const onError = (): void => finish();
    child.once('exit', onExit);
    child.once('error', onError);
    if (child.exitCode !== null) finish();
  });
}

function sha256(file: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(file);
    stream.on('data', chunk => hash.update(chunk));
    stream.once('error', reject);
    stream.once('end', () => resolve(hash.digest('hex')));
  });
}

function state(value: RuntimeCapabilityStateT): RuntimeCapabilityStateT {
  return RuntimeCapabilityState.parse(value);
}

function integerOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null;
}

function safeError(error: unknown): { code: string; message: string } {
  if (error instanceof RuntimeAdapterError) return { code: error.code, message: error.message };
  if (error instanceof Error && error.name === 'AbortError') return { code: 'CANCELLED', message: 'runtime request cancelled' };
  return { code: 'RUNTIME_REQUEST_FAILED', message: 'Unsloth runtime request failed; details were not recorded' };
}

export class UnslothRuntimeAdapter implements RuntimeAdapter {
  readonly backendId = 'UNSLOTH' as const;
  private readonly fetcher: FetchLike;
  private readonly spawnProcess: SpawnLike;
  private readonly findExecutable: () => Promise<string | null>;
  private readonly inspectPort: (port: number) => Promise<PortInspection>;
  private readonly processTreeContains: ProcessTreeProbe;
  private readonly terminateProcessTree: (child: ChildProcess, pid: number) => Promise<void>;
  private readonly versionProbe: (cliPath: string) => Promise<string | null>;
  private readonly now: () => Date;
  private readonly credentialStore: Pick<CredentialStore, 'get'>;
  private readonly endpoint: URL;
  private readonly externallyManaged: boolean;
  private readonly startupTimeoutMs: number;
  private cliPath: string | null;
  private version: string | null = null;
  private versionChecked = false;
  private ownership: RuntimeOwnershipT = 'UNKNOWN';
  private processHandle: ChildProcess | null = null;
  private listenerPid: number | null = null;
  private portState: PortInspection['state'] = 'UNKNOWN';
  private startedAt: string | null = null;
  private loadedModel: RuntimeModelIdentityT | null = null;
  private loadedPath: string | null = null;
  private activeControllers = new Set<AbortController>();
  private lastError: RuntimeStatusResponseT['last_error'] = null;
  private lastHealth: RuntimeHealthT = 'UNKNOWN';

  constructor(options: UnslothRuntimeAdapterOptions) {
    this.workspace = path.resolve(options.workspace);
    const configuredEndpoint = options.endpoint ?? process.env.AIDE_UNSLOTH_ENDPOINT;
    this.externallyManaged = configuredEndpoint !== undefined && configuredEndpoint.length > 0;
    this.endpoint = parseLoopbackEndpoint(configuredEndpoint ?? `http://127.0.0.1:${options.port ?? DEFAULT_PORT}`);
    this.fetcher = options.fetcher ?? fetch;
    this.spawnProcess = options.spawnProcess ?? spawn;
    this.findExecutable = options.findExecutable ?? discoverExecutable;
    this.inspectPort = options.inspectPort ?? inspectListeningPort;
    this.processTreeContains = options.processTreeContains ?? ((rootPid, targetPid) => processIsInTree(rootPid, targetPid, options.parentPidOf ?? readParentPid));
    this.terminateProcessTree = options.terminateProcessTree ?? terminateOwnedProcessTree;
    this.versionProbe = options.discoverVersion ?? (cliPath => this.discoverVersion(cliPath));
    this.startupTimeoutMs = options.startupTimeoutMs ?? DEFAULT_START_TIMEOUT_MS;
    this.now = options.now ?? (() => new Date());
    this.cliPath = options.cliPath ?? null;
    this.credentialStore = options.credentialStore ?? new CredentialStore(this.workspace);
    this.authTokenProvider = options.authTokenProvider ?? (async () =>
      (await this.credentialStore.get(UNSLOTH_API_KEY_CREDENTIAL_ID)) ?? null
    );
    if (options.port !== undefined && (options.port < 1 || options.port > 65535 || !Number.isInteger(options.port))) {
      throw new RuntimeAdapterError('INVALID_PORT', 'Unsloth port must be an integer from 1 to 65535');
    }
  }

  private readonly workspace: string;

  async discover(): Promise<void> {
    this.cliPath ??= await this.findExecutable();
    if (this.cliPath !== null && !this.versionChecked) {
      this.version = await this.versionProbe(this.cliPath);
      this.versionChecked = true;
    }
    if (this.externallyManaged) {
      this.ownership = 'USER_OWNED';
    } else if (this.processHandle !== null) {
      await this.verifyOwnedListener();
    } else {
      this.ownership = 'UNKNOWN';
    }
    this.lastHealth = await this.health();
  }

  private discoverVersion(executable: string): Promise<string | null> {
    return new Promise(resolve => {
      execFile(executable, ['--version'], { windowsHide: true, timeout: 4000 }, (error, stdout, stderr) => {
        if (error) return resolve(null);
        const text = `${String(stdout)}\n${String(stderr)}`;
        const match = text.match(/\b(?:unsloth(?:[- ]studio)?\s+)?v?(\d+\.\d+(?:\.\d+)?(?:[-+][\w.-]+)?)\b/i);
        resolve(match?.[1] ?? null);
      });
    });
  }

  capabilities(): RuntimeCapabilityDescriptorT {
    return {
      api_chat_completions: state('PARTIAL'),
      api_responses: state('UNKNOWN'),
      api_anthropic_messages: state('UNKNOWN'),
      api_embeddings: state('UNKNOWN'),
      embeddings: state('UNKNOWN'),
      model_discovery: state('PARTIAL'),
      model_load: state('PARTIAL'),
      model_unload: state('PARTIAL'),
      model_switching: state('PARTIAL'),
      hot_swap: state('UNKNOWN'),
      streaming: state('PARTIAL'),
      cancellation: state('PARTIAL'),
      tool_calling: state('PARTIAL'),
      tool_repair: state('UNKNOWN'),
      structured_output: state('UNKNOWN'),
      vision: state('UNKNOWN'),
      speculative_decoding: state('UNKNOWN'),
      parallel_requests: state('UNKNOWN'),
      context_controls: state('PARTIAL'),
      kv_cache_controls: state('UNKNOWN'),
      metrics: state('UNKNOWN'),
      headless: state('SUPPORTED'),
      offline_local_inference: state('SUPPORTED')
    };
  }

  private canContactEndpoint(): boolean {
    return this.externallyManaged && this.ownership === 'USER_OWNED' || this.ownership === 'COVERT_OWNED';
  }

  private async verifyOwnedListener(): Promise<boolean> {
    if (this.externallyManaged && this.ownership === 'USER_OWNED') return true;
    const child = this.processHandle;
    if (child === null || child.pid === undefined || child.exitCode !== null) return false;
    const listener = await this.inspectPort(Number(this.endpoint.port));
    this.portState = listener.state;
    this.listenerPid = listener.state === 'LISTENING' ? listener.pid : null;
    if (listener.state !== 'LISTENING') {
      this.ownership = 'UNKNOWN';
      return false;
    }
    const relation = listener.pid === child.pid ? true : await this.processTreeContains(child.pid, listener.pid).catch(() => null);
    const owned = relation === true;
    this.ownership = owned ? 'COVERT_OWNED' : relation === false ? 'FOREIGN' : 'UNKNOWN';
    return owned;
  }

  private endpointUrl(route: string): string {
    return new URL(route.replace(/^\//, ''), `${this.endpoint.origin}/`).toString();
  }

  private async fetchNoRedirect(route: string, init: RequestInit = {}, withAuth = false): Promise<Response> {
    if (!this.canContactEndpoint() || !(await this.verifyOwnedListener())) {
      throw new RuntimeAdapterError('OWNERSHIP_UNVERIFIED', 'Unsloth endpoint ownership is not verified; refusing to connect');
    }
    if (withAuth && await this.health() !== 'HEALTHY') {
      throw new RuntimeAdapterError('UNSLOTH_UNHEALTHY', 'Unsloth health identity was not verified before the API request');
    }
    const headers = new Headers(init.headers);
    if (withAuth && this.authTokenProvider) {
      let token: string | null;
      try {
        token = await this.authTokenProvider();
      } catch {
        throw new RuntimeAdapterError('AUTH_PROVIDER_FAILED', 'configured Unsloth token provider failed');
      }
      if (token?.trim()) headers.set('Authorization', `Bearer ${token.trim()}`);
    }
    let response: Response;
    try {
      response = await this.fetcher(this.endpointUrl(route), {
        ...init,
        headers,
        redirect: 'manual',
        signal: init.signal ?? AbortSignal.timeout(30_000)
      });
    } catch (error) {
      if (error instanceof RuntimeAdapterError) throw error;
      if (error instanceof Error && error.name === 'AbortError') throw error;
      throw new RuntimeAdapterError('ENDPOINT_UNAVAILABLE', 'Unsloth local endpoint is unavailable');
    }
    if (response.status >= 300 && response.status < 400) {
      throw new RuntimeAdapterError('REDIRECT_REFUSED', 'Unsloth endpoint redirected; credentials and requests were not forwarded');
    }
    return response;
  }

  async health(): Promise<RuntimeHealthT> {
    if (this.externallyManaged) {
      this.ownership = 'USER_OWNED';
      const listener = await this.inspectPort(Number(this.endpoint.port));
      this.portState = listener.state;
      this.listenerPid = listener.state === 'LISTENING' ? listener.pid : null;
    }
    if (this.processHandle !== null && !this.externallyManaged) await this.verifyOwnedListener();
    if (!this.externallyManaged && this.processHandle === null) {
      const listener = await this.inspectPort(Number(this.endpoint.port));
      this.portState = listener.state;
      this.listenerPid = listener.state === 'LISTENING' ? listener.pid : null;
      this.ownership = listener.state === 'LISTENING' ? 'FOREIGN' : 'UNKNOWN';
    }
    if (!this.canContactEndpoint()) {
      if (this.ownership === 'FOREIGN' || this.portState === 'UNKNOWN' || this.processHandle !== null && this.ownership === 'UNKNOWN') {
        this.lastHealth = 'UNKNOWN';
        return this.lastHealth;
      }
      this.lastHealth = this.cliPath === null ? 'NOT_INSTALLED' : 'STOPPED';
      return this.lastHealth;
    }
    try {
      const response = await this.fetcher(this.endpointUrl('/api/health'), {
        method: 'GET',
        redirect: 'manual',
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(3000)
      });
      if (!response.ok || response.status >= 300) {
        this.lastHealth = 'UNHEALTHY';
        return this.lastHealth;
      }
      const payload = await response.json().catch(() => null) as { service?: unknown } | null;
      this.lastHealth = payload?.service === STUDIO_SERVICE_MARKER ? 'HEALTHY' : 'UNHEALTHY';
      return this.lastHealth;
    } catch {
      this.lastHealth = 'UNHEALTHY';
      return this.lastHealth;
    }
  }

  async models(): Promise<RuntimeModelIdentityT[]> {
    const health = await this.health();
    if (health !== 'HEALTHY') return [];
    const response = await this.fetchNoRedirect('/v1/models', { method: 'GET', headers: { Accept: 'application/json' } }, true);
    if (response.status === 401) throw new RuntimeAdapterError('AUTH_REQUIRED', 'Unsloth model enumeration requires a valid local API key');
    if (response.status === 403) throw new RuntimeAdapterError('AUTH_FORBIDDEN', 'Unsloth denied the local API key for model enumeration');
    if (!response.ok) throw new RuntimeAdapterError('MODEL_DISCOVERY_FAILED', `Unsloth model enumeration returned HTTP ${response.status}`);
    const payload = await response.json().catch(() => null) as { data?: ApiModel[] } | null;
    if (!Array.isArray(payload?.data)) throw new RuntimeAdapterError('INVALID_MODEL_RESPONSE', 'Unsloth model enumeration returned an invalid response');
    return payload.data.flatMap(model => typeof model.id === 'string' && model.id.length > 0 ? [{
      model_id: model.id,
      display_name: model.id,
      artifact_name: null,
      artifact_sha256: null,
      identity_evidence: 'RUNTIME_REPORTED' as const
    }] : []);
  }

  async load(request: RuntimeLoadRequest, operatorAction = false): Promise<RuntimeModelIdentityT> {
    if (this.externallyManaged && !operatorAction) throw new RuntimeAdapterError('OPERATOR_ACTION_REQUIRED', 'loading into a user-owned Unsloth server requires an explicit operator action');
    const absolutePath = path.resolve(request.modelPath);
    const stat = await import('node:fs/promises').then(fs => fs.stat(absolutePath)).catch(() => null);
    if (stat === null || !stat.isFile()) throw new RuntimeAdapterError('ARTIFACT_UNAVAILABLE', 'the requested local model artifact is unavailable');
    if (!this.externallyManaged && this.processHandle === null) await this.startOwnedServer();
    if (await this.health() !== 'HEALTHY') throw new RuntimeAdapterError('UNSLOTH_UNHEALTHY', 'Unsloth did not become healthy; the model was not loaded');
    const artifactHashBeforeLoad = await sha256(absolutePath);
    const payload: Record<string, unknown> = {
      model_path: absolutePath,
      max_seq_length: request.contextTokens ?? 2048
    };
    if (request.loadIn4Bit !== undefined) payload.load_in_4bit = request.loadIn4Bit;
    if (this.loadedPath !== absolutePath || this.loadedModel?.artifact_sha256 !== artifactHashBeforeLoad) {
      this.loadedModel = null;
      this.loadedPath = null;
    }
    const response = await this.fetchNoRedirect('/api/inference/load', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30 * 60_000)
    }, true);
    const body = await this.readLifecycleResponse(response, 'load');
    if (body && typeof body === 'object' && '_deferred_error' in body) {
      throw new RuntimeAdapterError('MODEL_LOAD_FAILED', 'Unsloth reported a deferred model-load failure');
    }
    const artifactHash = await sha256(absolutePath);
    if (artifactHash !== artifactHashBeforeLoad) {
      this.loadedModel = null;
      this.loadedPath = null;
      throw new RuntimeAdapterError('ARTIFACT_CHANGED_DURING_LOAD', 'the model artifact changed while Unsloth loaded it; runtime identity is unqualified');
    }
    const identity: RuntimeModelIdentityT = {
      model_id: request.modelId,
      display_name: request.displayName ?? path.basename(absolutePath),
      artifact_name: path.basename(absolutePath),
      artifact_sha256: artifactHash,
      identity_evidence: 'REQUESTED_ARTIFACT'
    };
    this.loadedPath = absolutePath;
    this.loadedModel = identity;
    this.lastError = null;
    return identity;
  }

  private async readLifecycleResponse(response: Response, action: string): Promise<Record<string, unknown> | null> {
    if (response.status === 401) throw new RuntimeAdapterError('AUTH_REQUIRED', `Unsloth ${action} requires a valid local API key`);
    if (response.status === 403) throw new RuntimeAdapterError('AUTH_FORBIDDEN', `Unsloth denied the local API key for ${action}`);
    if (!response.ok) throw new RuntimeAdapterError(action === 'load' ? 'MODEL_LOAD_FAILED' : 'MODEL_UNLOAD_FAILED', `Unsloth ${action} returned HTTP ${response.status}`);
    const body = await response.json().catch(() => null) as Record<string, unknown> | null;
    if (body === null || typeof body !== 'object' || Array.isArray(body)) {
      throw new RuntimeAdapterError('INCOMPLETE_LIFECYCLE_RESPONSE', `Unsloth ${action} response did not confirm completion`);
    }
    const deferred = body._deferred_error;
    if (deferred !== undefined) {
      const detail = deferred && typeof deferred === 'object' ? (deferred as Record<string, unknown>).detail : null;
      throw new RuntimeAdapterError(action === 'load' ? 'MODEL_LOAD_FAILED' : 'MODEL_UNLOAD_FAILED', typeof detail === 'string' ? `Unsloth ${action} failed: ${detail.slice(0, 300)}` : `Unsloth ${action} reported a deferred failure`);
    }
    return body;
  }

  async unload(modelId: string, operatorAction = false): Promise<void> {
    if (this.ownership === 'FOREIGN' || this.ownership === 'UNKNOWN') throw new RuntimeAdapterError('OWNERSHIP_UNVERIFIED', 'model unload is prohibited without verified runtime ownership');
    if (this.ownership === 'USER_OWNED' && !operatorAction) throw new RuntimeAdapterError('OPERATOR_ACTION_REQUIRED', 'unloading from a user-owned runtime requires an explicit operator action');
    if (this.loadedModel === null || this.loadedPath === null) throw new RuntimeAdapterError('MODEL_NOT_LOADED', 'Unsloth has no model loaded by this adapter');
    if (this.loadedModel.model_id !== modelId) throw new RuntimeAdapterError('MODEL_ID_MISMATCH', 'requested model identity does not match the loaded artifact');
    const response = await this.fetchNoRedirect('/api/inference/unload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ model_path: this.loadedPath }),
      signal: AbortSignal.timeout(30 * 60_000)
    }, true);
    await this.readLifecycleResponse(response, 'unload');
    this.loadedModel = null;
    this.loadedPath = null;
  }

  async infer(request: RuntimeInferenceRequest, signal?: AbortSignal): Promise<RuntimeInferenceResult> {
    return this.chatRequest(request, false, () => {}, signal ?? new AbortController().signal);
  }

  async stream(request: RuntimeInferenceRequest, onDelta: (delta: string) => void, signal: AbortSignal): Promise<RuntimeInferenceResult> {
    return this.chatRequest(request, true, onDelta, signal);
  }

  private async chatRequest(request: RuntimeInferenceRequest, streaming: boolean, onDelta: (delta: string) => void, externalSignal: AbortSignal): Promise<RuntimeInferenceResult> {
    if (this.loadedModel === null || this.loadedModel.model_id !== request.modelId) throw new RuntimeAdapterError('MODEL_NOT_LOADED', 'requested model is not the model currently loaded in Unsloth');
    if (request.responseFormat !== undefined) throw new RuntimeAdapterError('CAPABILITY_UNKNOWN', 'structured output is not enabled until this Unsloth API version is qualified');
    const startedAt = Date.now();
    const controller = new AbortController();
    const abort = (): void => controller.abort(externalSignal.reason);
    if (externalSignal.aborted) abort();
    else externalSignal.addEventListener('abort', abort, { once: true });
    this.activeControllers.add(controller);
    const payload: Record<string, unknown> = {
      model: 'default',
      messages: request.messages,
      stream: streaming,
      max_tokens: request.maxTokens ?? 512,
      temperature: request.temperature ?? 0.2
    };
    if (request.tools !== undefined) payload.tools = request.tools;
    try {
      const response = await this.fetchNoRedirect('/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: streaming ? 'text/event-stream' : 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      }, true);
      if (response.status === 401) throw new RuntimeAdapterError('AUTH_REQUIRED', 'Unsloth inference requires a valid local API key');
      if (response.status === 403) throw new RuntimeAdapterError('AUTH_FORBIDDEN', 'Unsloth denied the local API key for inference');
      if (!response.ok) throw new RuntimeAdapterError('INFERENCE_FAILED', `Unsloth inference returned HTTP ${response.status}`);
      if (streaming) {
        if (response.body === null) throw new RuntimeAdapterError('STREAM_UNAVAILABLE', 'Unsloth returned no streaming body');
        return await this.readStream(response, request.modelId, onDelta, startedAt);
      }
      const result = await response.json().catch(() => null) as ChatResponse | null;
      if (result === null || result.error) throw new RuntimeAdapterError('INVALID_INFERENCE_RESPONSE', 'Unsloth returned an invalid inference response');
      const choice = result.choices?.[0];
      const text = typeof choice?.message?.content === 'string' ? choice.message.content : '';
      const toolCalls = Array.isArray(choice?.message?.tool_calls) ? choice.message.tool_calls : [];
      return this.result(request.modelId, text, toolCalls, result.usage, choice?.finish_reason, startedAt);
    } catch (error) {
      const safe = safeError(error);
      this.lastError = { code: safe.code, message: safe.message, at: this.now().toISOString() };
      throw error;
    } finally {
      externalSignal.removeEventListener('abort', abort);
      this.activeControllers.delete(controller);
    }
  }

  private async readStream(response: Response, modelId: string, onDelta: (delta: string) => void, startedAt: number): Promise<RuntimeInferenceResult> {
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let text = '';
    let finishReason: unknown = null;
    let usage: ChatResponse['usage'] | undefined;
    const toolCalls = new Map<number, Record<string, unknown>>();
    const consume = (line: string): void => {
      if (!line.startsWith('data:')) return;
      const data = line.slice(5).trim();
      if (data.length === 0 || data === '[DONE]') return;
      let chunk: ChatResponse;
      try { chunk = JSON.parse(data) as ChatResponse; } catch { return; }
      if (chunk.error) throw new RuntimeAdapterError('INFERENCE_FAILED', 'Unsloth streaming inference returned an error event');
      const choice = chunk.choices?.[0];
      if (!choice) {
        if (chunk.usage) usage = chunk.usage;
        return;
      }
      finishReason = choice.finish_reason ?? finishReason;
      const delta = (choice as unknown as { delta?: { content?: unknown; tool_calls?: Array<Record<string, unknown>> } }).delta;
      if (typeof delta?.content === 'string' && delta.content.length > 0) {
        text += delta.content;
        onDelta(delta.content);
      }
      for (const [index, call] of (delta?.tool_calls ?? []).entries()) {
        const key = typeof call.index === 'number' ? call.index : index;
        const previous = toolCalls.get(key) ?? {};
        const fn = (call.function ?? {}) as Record<string, unknown>;
        const priorFn = (previous.function ?? {}) as Record<string, unknown>;
        toolCalls.set(key, {
          ...previous,
          ...call,
          id: typeof call.id === 'string' ? `${String(previous.id ?? '')}${call.id}` : previous.id,
          function: {
            ...priorFn,
            ...fn,
            name: typeof fn.name === 'string' ? `${String(priorFn.name ?? '')}${fn.name}` : priorFn.name,
            arguments: typeof fn.arguments === 'string' ? `${String(priorFn.arguments ?? '')}${fn.arguments}` : priorFn.arguments
          }
        });
      }
      if (chunk.usage) usage = chunk.usage;
    };
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) consume(line.trimEnd());
    }
    buffer += decoder.decode();
    if (buffer.length > 0) consume(buffer.trimEnd());
    return this.result(modelId, text, [...toolCalls.values()], usage, finishReason, startedAt);
  }

  private result(modelId: string, text: string, toolCalls: unknown[], usage: ChatResponse['usage'] | undefined, finishReason: unknown, startedAt: number): RuntimeInferenceResult {
    return {
      text,
      model: this.loadedModel ?? unknownModelIdentity(modelId),
      promptTokens: integerOrNull(usage?.prompt_tokens),
      completionTokens: integerOrNull(usage?.completion_tokens),
      timingMs: Math.max(0, Date.now() - startedAt),
      toolCalls,
      toolEvidence: {
        raw_model_output: null,
        runtime_adjusted_output: toolCalls.length > 0 ? toolCalls : null,
        executed_tool_call: null,
        attribution: 'UNKNOWN',
        limitation: toolCalls.length > 0 ? 'Unsloth exposes the final API tool call but not pre-repair model output; Covert has not executed the call.' : 'No tool call was returned.'
      },
      finishReason: typeof finishReason === 'string' ? finishReason : null
    };
  }

  async cancel(): Promise<boolean> {
    if (this.activeControllers.size === 0) return false;
    for (const controller of this.activeControllers) controller.abort();
    return true;
  }

  async metrics(): Promise<RuntimeMetricsT> { return unknownMetrics(); }

  async shutdown(operatorAction = false): Promise<void> {
    if (this.ownership === 'USER_OWNED' && !operatorAction) throw new RuntimeAdapterError('OPERATOR_ACTION_REQUIRED', 'shutting down a user-owned Unsloth runtime requires explicit operator action');
    const child = this.processHandle;
    if (this.ownership !== 'COVERT_OWNED' || child === null || child.pid === undefined) {
      if (this.ownership === 'USER_OWNED') throw new RuntimeAdapterError('USER_RUNTIME_STOP_UNAVAILABLE', 'Covert cannot stop an external user-managed Unsloth process');
      throw new RuntimeAdapterError('OWNERSHIP_UNVERIFIED', 'shutdown is prohibited without a verified Covert-owned process');
    }
    if (!(await this.verifyOwnedListener())) throw new RuntimeAdapterError('OWNERSHIP_CHANGED', 'Unsloth listener identity changed; shutdown was refused');
    const rootPid = child.pid;
    await this.cancel();
    if (!(await this.verifyOwnedListener()) || this.ownership !== 'COVERT_OWNED') {
      throw new RuntimeAdapterError('OWNERSHIP_CHANGED', 'Unsloth listener ownership changed before shutdown; no process was terminated');
    }
    const ownedListenerPid = this.listenerPid;
    await this.terminateProcessTree(child, rootPid);
    await waitForChildExit(child, 10_000);
    const listener = await this.inspectPort(Number(this.endpoint.port));
    this.portState = listener.state;
    this.listenerPid = listener.state === 'LISTENING' ? listener.pid : null;
    this.processHandle = null;
    this.ownership = listener.state === 'LISTENING'
      ? listener.pid !== ownedListenerPid ? 'FOREIGN' : 'UNKNOWN'
      : 'UNKNOWN';
    if (listener.state !== 'FREE') throw new RuntimeAdapterError('SHUTDOWN_UNCONFIRMED', 'the Unsloth listener remained or could not be checked after its owned process tree exited; it was not terminated again');
    this.loadedModel = null;
    this.loadedPath = null;
    this.lastHealth = 'STOPPED';
  }

  async status(): Promise<RuntimeStatusResponseT> {
    await this.discover();
    const health = this.lastHealth;
    let loaded = this.loadedModel;
    if (loaded === null && health === 'HEALTHY') {
      const list = await this.models().catch(() => []);
      if (list.length === 1) loaded = list[0]!;
    }
    const processPid = this.ownership === 'COVERT_OWNED' || this.ownership === 'USER_OWNED' || this.ownership === 'FOREIGN'
      ? this.listenerPid
      : null;
    return {
      contract_version: 1,
      canonical_backend: 'UNSLOTH',
      backend: 'UNSLOTH',
      version: this.version,
      engine: null,
      endpoint: this.endpoint.toString().replace(/\/$/, ''),
      port: Number(this.endpoint.port),
      pid: processPid,
      started_at: this.startedAt,
      health,
      ownership: this.ownership,
      loaded_model: loaded,
      capabilities: this.capabilities(),
      metrics: await this.metrics(),
      last_error: this.lastError,
      fallback_event_id: null,
      updated_at: this.now().toISOString()
    };
  }

  private readonly authTokenProvider: AuthTokenProvider;

  private async cleanupFailedStart(child: ChildProcess): Promise<void> {
    const pid = child.pid;
    const previousListenerPid = this.listenerPid;
    let verifiedTree = false;
    if (pid !== undefined && child.exitCode === null) {
      verifiedTree = await this.verifyOwnedListener().catch(() => false) && this.ownership === 'COVERT_OWNED';
    }
    if (child.exitCode === null) {
      try {
        if (verifiedTree && pid !== undefined) await this.terminateProcessTree(child, pid);
        else child.kill('SIGTERM');
        await waitForChildExit(child, 5000);
      } catch {
        // Keep the retained handle and fail closed; never widen cleanup to an unverified listener.
      }
    }
    if (child.exitCode !== null && this.processHandle === child) this.processHandle = null;
    try {
      const listener = await this.inspectPort(Number(this.endpoint.port));
      this.portState = listener.state;
      this.listenerPid = listener.state === 'LISTENING' ? listener.pid : null;
      if (listener.state !== 'LISTENING') this.ownership = 'UNKNOWN';
      else if (verifiedTree && listener.pid === previousListenerPid) this.ownership = 'UNKNOWN';
      else if (this.ownership !== 'FOREIGN') this.ownership = 'UNKNOWN';
    } catch {
      this.portState = 'UNKNOWN';
      this.listenerPid = null;
      this.ownership = 'UNKNOWN';
    }
  }

  private async startOwnedServer(): Promise<void> {
    this.cliPath ??= await this.findExecutable();
    if (this.cliPath === null) throw new RuntimeAdapterError('NOT_INSTALLED', 'Unsloth CLI was not found; install Unsloth externally and restart Covert');
    const cliPath = this.cliPath;
    if (!this.versionChecked) {
      this.version = await this.versionProbe(cliPath);
      this.versionChecked = true;
    }
    if (this.externallyManaged) throw new RuntimeAdapterError('USER_RUNTIME_STOPPED', 'the configured user-managed Unsloth endpoint is not healthy');
    const port = Number(this.endpoint.port);
    const inspection = await this.inspectPort(port);
    if (inspection.state === 'LISTENING') {
      this.ownership = 'FOREIGN';
      throw new RuntimeAdapterError('PORT_CONFLICT', `Unsloth port ${port} is already owned by another process; no connection or termination was attempted`);
    }
    if (inspection.state !== 'FREE') throw new RuntimeAdapterError('PORT_OWNERSHIP_UNKNOWN', `Unsloth port ${port} ownership could not be verified; launch was refused`);
    const env: NodeJS.ProcessEnv = { ...process.env };
    for (const key of Object.keys(env)) {
      if (/^(?:_?UNSLOTH_CLOUDFLARE(?:_INTENT)?|UNSLOTH_STUDIO_SECURE|UNSLOTH_STUDIO_PASSWORD|CLOUDFLARE_TUNNEL_TOKEN|CF_TUNNEL_TOKEN|HF_TOKEN|HUGGING_FACE_HUB_TOKEN)$/i.test(key)) delete env[key];
    }
    env.UNSLOTH_API_ONLY = '1';
    env._UNSLOTH_CLOUDFLARE_INTENT = 'disabled';
    const child = this.spawnProcess(cliPath, ['studio', '-H', '127.0.0.1', '-p', String(port), '--api-only'], {
      cwd: this.workspace,
      env,
      stdio: 'ignore',
      windowsHide: true,
      detached: process.platform !== 'win32'
    });
    this.processHandle = child;
    this.ownership = 'UNKNOWN';
    this.startedAt = this.now().toISOString();
    child.once('exit', () => {
      if (this.processHandle === child) {
        this.processHandle = null;
        this.ownership = 'UNKNOWN';
        this.lastHealth = 'STOPPED';
        this.loadedModel = null;
        this.loadedPath = null;
      }
    });
    try {
      const deadline = Date.now() + this.startupTimeoutMs;
      while (Date.now() < deadline && child.exitCode === null) {
        const listener = await this.inspectPort(port);
        if (listener.state === 'LISTENING') {
          this.portState = 'LISTENING';
          this.listenerPid = listener.pid;
          const relation = child.pid === undefined
            ? null
            : listener.pid === child.pid ? true : await this.processTreeContains(child.pid, listener.pid).catch(() => null);
          if (relation === true) {
            this.ownership = 'COVERT_OWNED';
            const health = await this.health();
            if (health === 'HEALTHY') return;
          } else {
            this.ownership = relation === false ? 'FOREIGN' : 'UNKNOWN';
            throw new RuntimeAdapterError(relation === false ? 'PROCESS_OWNERSHIP_MISMATCH' : 'PROCESS_OWNERSHIP_UNKNOWN', 'Unsloth listener ancestry could not be proven for the process Covert started; no endpoint request was made');
          }
        } else if (listener.state === 'UNKNOWN') {
          this.portState = 'UNKNOWN';
          throw new RuntimeAdapterError('PORT_OWNERSHIP_UNKNOWN', 'Unsloth listener ownership could not be verified; no endpoint request was made');
        } else {
          this.portState = 'FREE';
        }
        await new Promise(resolve => setTimeout(resolve, 250));
      }
      if (child.exitCode !== null) throw new RuntimeAdapterError('UNSLOTH_START_FAILED', 'Covert-owned Unsloth process exited before becoming healthy');
      throw new RuntimeAdapterError('UNSLOTH_START_TIMEOUT', 'Covert-owned Unsloth did not become healthy before the startup deadline');
    } catch (error) {
      await this.cleanupFailedStart(child);
      throw error;
    }
  }
}
