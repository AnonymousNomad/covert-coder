import { promises as fs, existsSync, createReadStream, readFileSync } from 'node:fs';
import { spawn, execFile, type ChildProcess } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import crypto from 'node:crypto';
import { probeGguf } from './gguf.ts';
import { fitModel } from './model-fit.ts';
import { probeHardware, type HardwareInfo } from './hardware.ts';
import { estimateTokens } from './history-fit.ts';
import { atomicWriteJson, withFileMutationLock } from './atomic-json.ts';
import type { ModelFitReportT } from '../../../common/contracts/models.ts';
import { observeAdapterRequestInput, type AdapterRequestInputOptions } from './model-request-input.ts';

export class ModelRuntimeError extends Error {
  readonly code: 'NOT_READY' | 'CONFLICT' | 'CHILD_FAILED' | 'BAD_REQUEST';
  readonly detail?: unknown;
  constructor(code: 'NOT_READY' | 'CONFLICT' | 'CHILD_FAILED' | 'BAD_REQUEST', message: string, detail?: unknown) {
    super(message);
    this.code = code;
    this.detail = detail;
  }
}

// Physical-memory guard for the legacy direct ModelRuntime path. The
// Authority-bound product route applies canonical Resource Admission,
// including Windows commit and qualified-profile GPU floors, first.
export const RAM_GUARD_BYTES = Math.ceil(6.5 * 1024 ** 3);

// W6 convergence: binary llama-server is the verified engine path on Windows
// (python llama_cpp.server spawn hangs under node on this class of machine;
// see AGENT_NOTES 2026-08-24/25). Resolution order mirrors the legacy manager:
// env override -> workspace runtime dir -> known local install.
const SAMPLER_FLAGS: Record<string, string> = {
  temperature: '--temp', top_k: '--top-k', top_p: '--top-p', min_p: '--min-p',
  repeat_penalty: '--repeat-penalty', mirostat: '--mirostat',
  mirostat_tau: '--mirostat-tau', mirostat_eta: '--mirostat-eta', seed: '--seed'
};

export interface ModelProfileSidecar {
  schema_version?: number;
  binding?: { artifact_sha256?: string; runtime_id?: string; runtime_version?: string | null };
  preset?: string;
  samplers?: Record<string, number>;
  runtime?: Record<string, number | string | boolean>;
  legacy_unbound?: Record<string, unknown>;
  invalid?: true;
}

export interface ModelProfilePatch {
  preset?: string;
  samplers?: Record<string, number>;
  runtime?: Record<string, number | string | boolean>;
}

export interface ModelProfileBinding {
  artifact_sha256: string;
  runtime_id: string;
  runtime_version: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function readModelProfileSidecar(file: string): ModelProfileSidecar {
  try {
    const raw = JSON.parse(readFileSync(`${file}.profile.json`, 'utf8')) as unknown;
    if (!isRecord(raw) || raw.invalid === true ||
        (raw.schema_version !== undefined && raw.schema_version !== 1) ||
        (raw.preset !== undefined && typeof raw.preset !== 'string')) return { invalid: true };
    if (raw.binding !== undefined) {
      const binding = raw.binding;
      if (!isRecord(binding) || typeof binding.artifact_sha256 !== 'string' ||
          typeof binding.runtime_id !== 'string' ||
          (binding.runtime_version !== null && typeof binding.runtime_version !== 'string')) return { invalid: true };
    }
    if (raw.samplers !== undefined && (!isRecord(raw.samplers) ||
        Object.values(raw.samplers).some(value => typeof value !== 'number' || !Number.isFinite(value)))) return { invalid: true };
    if (raw.runtime !== undefined && (!isRecord(raw.runtime) ||
        Object.values(raw.runtime).some(value => typeof value === 'number' ? !Number.isFinite(value) :
          typeof value !== 'string' && typeof value !== 'boolean'))) return { invalid: true };
    return raw as unknown as ModelProfileSidecar;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'ENOENT' ? {} : { invalid: true };
  }
}

export async function hashModelArtifact(file: string): Promise<string> {
  const hash = crypto.createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

export type LlamaAccelerator = 'cpu' | 'vulkan' | 'rocm' | 'unknown';

export function normalizeLlamaAccelerator(value: string | undefined): LlamaAccelerator {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'cpu' || normalized === 'vulkan' || normalized === 'rocm') return normalized;
  return 'unknown';
}

function inferLlamaAccelerator(binaryPath: string, configured?: string): LlamaAccelerator {
  const explicit = normalizeLlamaAccelerator(configured);
  if (explicit !== 'unknown') return explicit;
  const dir = path.dirname(binaryPath);
  if (['ggml-vulkan.dll', 'libggml-vulkan.so', 'libggml-vulkan.dylib'].some(name => existsSync(path.join(dir, name)))) return 'vulkan';
  if (['ggml-hip.dll', 'libggml-hip.so', 'libggml-hip.dylib'].some(name => existsSync(path.join(dir, name)))) return 'rocm';
  return 'unknown';
}

export function resolveLlamaBinary(workspace: string): { path: string; vulkan: boolean; accelerator: LlamaAccelerator } | null {
  const exe = process.platform === 'win32' ? 'llama-server.exe' : 'llama-server';
  const configured = (binaryPath: string): { path: string; vulkan: boolean; accelerator: LlamaAccelerator } => {
    const accelerator = inferLlamaAccelerator(binaryPath, process.env.AIDE_LLAMA_ACCELERATOR);
    return { path: binaryPath, vulkan: accelerator === 'vulkan', accelerator };
  };
  // An explicit operator path is an exact selection. If it is missing, fail
  // closed instead of silently using a workspace or machine-local binary.
  if (process.env.AIDE_LLAMA_SERVER) {
    return existsSync(process.env.AIDE_LLAMA_SERVER) ? configured(process.env.AIDE_LLAMA_SERVER) : null;
  }
  const candidates: Array<{ path: string; vulkan: boolean; accelerator: LlamaAccelerator }> = [
    configured(path.join(workspace, 'runtime', exe)),
    // Historical Windows CPU installation. Explicit AIDE_LLAMA_SERVER takes
    // precedence and is the cross-platform compatibility path.
    { path: 'E:\\llama-cpp\\llama-server.exe', vulkan: false, accelerator: 'cpu' },
    { path: 'E:\\llama-cpp-vulkan\\llama-server.exe', vulkan: true, accelerator: 'vulkan' }
  ].filter((candidate): candidate is { path: string; vulkan: boolean; accelerator: LlamaAccelerator } => candidate !== null && existsSync(candidate.path));
  return candidates[0] ?? null;
}

function samplerArgs(profile: ReturnType<typeof readModelProfileSidecar>): string[] {
  // A profile bound to another canonical runtime is never reinterpreted as a
  // legacy llama.cpp command line.
  if (profile.binding !== undefined) return [];
  const args: string[] = [];
  for (const [key, flag] of Object.entries(SAMPLER_FLAGS)) {
    const value = profile.samplers?.[key];
    if (typeof value === 'number' && Number.isFinite(value)) args.push(flag, String(value));
  }
  const runtime = profile.runtime || {};
  if (Number.isFinite(runtime.ngl as number)) args.push('-ngl', String(runtime.ngl));
  if (runtime.flash_attn === 1 || runtime.flash_attn === true) args.push('-fa');
  return args;
}

export interface ModelEntry {
  id: string;
  name: string;
  status: string;
  roles: string[];
  endpoint: string;
  model: string;
  artifact_uri: string;
  context_tokens: number;
  system_prompt?: string;
  ingested?: boolean;
  file: string;
  fileSize?: number;
  sha256?: string;
  repo_id?: string;
  quant_label?: string;
}

export interface ModelRuntimeOptions {
  workspace: string;
  manifestPath: string;
  ingestedPath: string;
  modelDir: string;
  pythonServer?: boolean;
  spawnChild?: typeof spawn;
  hardwareProbe?: () => Promise<HardwareInfo>;
  requestTimeoutMs?: number;
  logger?: { error(msg: string, meta?: Record<string, unknown>): void; warn(msg: string, meta?: Record<string, unknown>): void; info(msg: string, meta?: Record<string, unknown>): void } | undefined;
  onStatusChange?: (id: string, status: string, detail?: string) => void;
}

interface PythonCandidate {
  interp: string;
  args: string[];
}

function childIsRunning(child: ChildProcess): boolean {
  // On Windows, a child killed by a signal has exitCode === null and
  // signalCode set. Checking exitCode alone mistakes a terminated child for
  // a still-running owned process.
  return child.exitCode === null && child.signalCode === null;
}

// GGUF import is availability only. The qualified Liquid artifact reports lfm2;
// admission/qualification remain separate from recognizing its file format.
const ALLOWED_ARCHITECTURES = ['llama', 'qwen2', 'lfm2'];

// Pure registration-filename validation shared by the HTTP descriptor (before
// approval) and register() (at execution) so the approved target is the target
// executed. Rejections are deterministic and never rewrite the identifier.
export function validateRegistrationFilename(modelDir: string, filename: unknown): string {
  const rel = String(filename || '');
  if (!/\.gguf$/i.test(rel)) throw new ModelRuntimeError('BAD_REQUEST', 'only .gguf artifacts can be registered');
  if (rel.includes('\\') || rel.startsWith('/') || rel.split('/').some(segment => !segment || segment === '.' || segment === '..')) {
    throw new ModelRuntimeError('BAD_REQUEST', 'filename must be a relative path of safe segments');
  }
  const file = path.resolve(modelDir, rel);
  if (!file.startsWith(`${path.resolve(modelDir)}${path.sep}`)) throw new ModelRuntimeError('BAD_REQUEST', 'path escaped model directory');
  return rel;
}

export class ModelRuntime {
  readonly workspace: string;
  private readonly manifestPath: string;
  private readonly ingestedPath: string;
  private readonly enginePidsPath: string;
  readonly modelDir: string;
  private readonly spawnChild: typeof spawn;
  private readonly hardwareProbe: () => Promise<HardwareInfo>;
  private readonly logger: ModelRuntimeOptions['logger'];
  private readonly onStatusChange: NonNullable<ModelRuntimeOptions['onStatusChange']>;

  private pythonReady = false;
  private pythonCmd: PythonCandidate | null = null;
  private lastProbeAt = 0;
  private pythonProbe: Promise<boolean> | null = null;
  private models = new Map<string, ModelEntry>();
  private readonly processes = new Map<string, ChildProcess>();
  private readonly warmed = new Set<string>();
  private readonly hashCache = new Map<string, { mtimeMs: number; size: number; hash: string }>();
  private readonly servedCtx = new Map<string, number>();

  constructor(options: ModelRuntimeOptions) {
    this.workspace = options.workspace;
    this.manifestPath = options.manifestPath;
    this.ingestedPath = options.ingestedPath;
    this.modelDir = options.modelDir;
    this.enginePidsPath = path.join(options.workspace, '.aide', 'model-engines.json');
    this.spawnChild = options.spawnChild ?? spawn;
    this.hardwareProbe = options.hardwareProbe ?? probeHardware;
    this.logger = options.logger;
    this.onStatusChange = options.onStatusChange ?? (() => {});
  }

  async load(options: { sweepLegacyEngines?: boolean } = {}): Promise<void> {
    // Only the legacy engine owner may sweep its old processes. Canonical
    // Unsloth inventory loading must not mutate legacy ownership records.
    if (options.sweepLegacyEngines !== false) await this.sweepStaleEngines();
    const manifest = JSON.parse(await fs.readFile(this.manifestPath, 'utf8')) as { models?: Array<Record<string, unknown>> };
    for (const raw of manifest.models ?? []) {
      const entry = this.entryFromManifest(raw);
      if (entry !== null) this.models.set(entry.id, entry);
    }
    try {
      const ingested = JSON.parse(await fs.readFile(this.ingestedPath, 'utf8')) as Array<Record<string, unknown>>;
      for (const raw of ingested) {
        const entry = this.entryFromManifest(raw);
        if (entry !== null) {
          entry.ingested = true;
          this.models.set(entry.id, entry);
        }
      }
    } catch {
      // no ingested models yet
    }
  }

  private entryFromManifest(raw: Record<string, unknown>): ModelEntry | null {
    const id = raw.id;
    const endpoint = raw.endpoint;
    const file = typeof raw.file === 'string' ? raw.file : String(raw.artifact_uri ?? '').startsWith('local://')
      ? this.resolveArtifactPath(path.basename(String(raw.artifact_uri).replace('local://', '')))
      : '';
    if (typeof id !== 'string' || id.length === 0 || typeof endpoint !== 'string' || endpoint.length === 0) return null;
    const entry: ModelEntry = {
      id,
      name: String(raw.name ?? id),
      status: String(raw.status ?? 'pending'),
      roles: Array.isArray(raw.roles) ? raw.roles.map(String) : [],
      endpoint,
      model: String(raw.model ?? (file.length > 0 ? path.basename(file) : id)),
      artifact_uri: String(raw.artifact_uri ?? `local://${file}`),
      context_tokens: Number(raw.context_tokens ?? 2048),
      ingested: raw.ingested === true,
      file
    };
    if (typeof raw.system_prompt === 'string') entry.system_prompt = raw.system_prompt;
    if (typeof raw.file_size === 'number') entry.fileSize = raw.file_size;
    if (typeof raw.repo_id === 'string') entry.repo_id = raw.repo_id;
    if (typeof raw.quant_label === 'string') entry.quant_label = raw.quant_label;
    if (typeof raw.sha256 === 'string' && /^[a-f0-9]{64}$/i.test(raw.sha256)) entry.sha256 = raw.sha256.toLowerCase();
    return entry;
  }

  async probePython(): Promise<boolean> {
    if (this.pythonReady) return true;
    if (this.pythonProbe !== null) return this.pythonProbe;
    const candidates: PythonCandidate[] = [];
    const explicit = process.env.AIDE_PYTHON;
    if (explicit) candidates.push({ interp: explicit, args: ['-E'] });
    candidates.push({ interp: 'py', args: ['-3.10', '-E'] });
    candidates.push({ interp: 'py', args: ['-3', '-E'] });
    candidates.push({ interp: 'E:\\Python310\\python.exe', args: ['-E'] });
    this.lastProbeAt = Date.now();
    const probeCandidate = (candidate: PythonCandidate): Promise<boolean> => new Promise(resolve => {
      let settled = false;
      let timer: ReturnType<typeof setTimeout> | null = null;
      const finish = (ready: boolean): void => {
        if (settled) return;
        settled = true;
        if (timer !== null) clearTimeout(timer);
        resolve(ready);
      };
      let child: ChildProcess;
      try {
        child = this.spawnChild(candidate.interp, [...candidate.args, '-c', 'import llama_cpp'], { stdio: 'ignore', windowsHide: true });
      } catch {
        finish(false);
        return;
      }
      timer = setTimeout(() => {
        child.kill();
        finish(false);
      }, 5000);
      child.once('error', () => finish(false));
      child.once('exit', code => finish(code === 0));
    });
    this.pythonProbe = (async () => {
      for (const candidate of candidates) {
        if (await probeCandidate(candidate)) {
          this.pythonCmd = candidate;
          this.pythonReady = true;
          return true;
        }
      }
      this.pythonReady = false;
      this.pythonCmd = null;
      return false;
    })().finally(() => {
      this.pythonProbe = null;
    });
    return this.pythonProbe;
  }

  async status(): Promise<{ runtime: boolean; models: Array<Record<string, unknown>> }> {
    if (!this.pythonReady && this.pythonProbe === null && Date.now() - this.lastProbeAt > 5000) await this.probePython();
    // Engine availability = binary serving path OR python fallback. Binary is
    // the verified primary; conflating this with the python probe alone
    // mislabeled RUNNING binary engines as merely "installed".
    const engineAvailable = resolveLlamaBinary(this.workspace) !== null || this.pythonReady;
    return {
      runtime: engineAvailable,
      models: [...this.models.values()].map(model => {
        const child = this.processes.get(model.id);
        const artifactAvailable = model.file.length > 0 && existsSync(model.file);
        let modelStatus = model.status;
        if (artifactAvailable && model.status !== 'ready' && engineAvailable) modelStatus = 'ready';
        const setup: string[] = [];
        if (!engineAvailable) setup.push('no engine available: install llama-server binary (runtime/ or E:\\llama-cpp) or set AIDE_PYTHON to a Python 3.10 interpreter with llama-cpp-python');
        if (modelStatus === 'ready' && !artifactAvailable) setup.push(`model file was not found at ${model.file}`);
        const entry: Record<string, unknown> = {
          id: model.id,
          name: model.name,
          status: child !== undefined && childIsRunning(child) ? 'running' : modelStatus,
          declared_status: modelStatus,
          endpoint: model.endpoint,
          runtime_available: engineAvailable,
          artifact_available: artifactAvailable,
          setup_required: setup.length > 0 && modelStatus === 'ready',
          setup_message: setup.length > 0 ? setup.join('; ') : undefined,
          ingested: model.ingested === true
        };
        return entry;
      })
    };
  }

  get(id: string): ModelEntry | undefined {
    return this.models.get(id);
  }

  list(): ModelEntry[] {
    return [...this.models.values()];
  }

  /** Process ownership exposed to RuntimeAdapters without exposing mutable handles. */
  ownsRunningProcess(id: string): boolean {
    const child = this.processes.get(id);
    return child !== undefined && child.pid !== undefined && childIsRunning(child);
  }

  ownedProcessPid(id: string): number | null {
    const child = this.processes.get(id);
    return child !== undefined && childIsRunning(child) && child.pid !== undefined ? child.pid : null;
  }

  runtimeEngineName(): string | null {
    const binary = resolveLlamaBinary(this.workspace);
    if (binary !== null) return path.basename(binary.path);
    return this.pythonReady ? 'llama_cpp.server' : null;
  }

  /** Wait on the legacy llama-server endpoint directly while the adapter is loading. */
  async waitForDirectModelReady(id: string, timeoutMs = 60_000): Promise<boolean> {
    const model = this.models.get(id);
    if (model === undefined) throw new ModelRuntimeError('BAD_REQUEST', 'model is not allowlisted');
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const result = await ModelRuntime.prototype.verifyEndpointModel.call(this, id, 5000).catch(() => ({ ready: false as const, status: 'not-ready' as const, served_models: [] }));
      if (result.ready) return true;
      if (result.status === 'conflict') throw new ModelRuntimeError('CONFLICT', result.error ?? 'model endpoint is owned by a different runtime');
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    return false;
  }

  private expectedModelIds(model: ModelEntry): string[] {
    const values = [
      model.id,
      model.model,
      path.basename(model.file),
      model.file,
      path.resolve(model.file)
    ].filter(Boolean).map(value => String(value).toLowerCase());
    return [...new Set(values)];
  }

  private servedModelMatches(model: ModelEntry, servedId: string): boolean {
    const served = servedId.toLowerCase();
    if (served.length === 0) return false;
    return this.expectedModelIds(model).some(expected =>
      served === expected || served.endsWith(`/${expected}`) || served.endsWith(`\\${expected}`)
    );
  }

  private endpointPort(model: ModelEntry): { host: string; port: number } {
    const endpoint = new URL(model.endpoint);
    return { host: endpoint.hostname || '127.0.0.1', port: Number(endpoint.port || 80) };
  }

  private async endpointPortOpen(model: ModelEntry, timeoutMs = 1000): Promise<boolean> {
    const { host, port } = this.endpointPort(model);
    return new Promise(resolve => {
      const socket = net.createConnection({ host, port });
      const done = (open: boolean): void => {
        socket.removeAllListeners();
        socket.destroy();
        resolve(open);
      };
      socket.setTimeout(timeoutMs);
      socket.once('connect', () => done(true));
      socket.once('timeout', () => done(false));
      socket.once('error', () => done(false));
    });
  }

  async verifyEndpointModel(id: string, timeoutMs = 5000): Promise<{ ready: boolean; status: string; served_models: string[]; error?: string }> {
    const model = this.models.get(id);
    if (!model) throw new Error('model is not allowlisted');
    try {
      const response = await fetch(`${model.endpoint}/models`, { signal: AbortSignal.timeout(timeoutMs) });
      if (!response.ok) return { ready: false, status: 'not-ready', served_models: [] };
      const payload = await response.json().catch(() => ({})) as { data?: Array<{ id?: string }> };
      const servedModels = Array.isArray(payload.data) ? payload.data.map(item => item.id).filter((v): v is string => typeof v === 'string') : [];
      const matched = servedModels.some(servedId => this.servedModelMatches(model, servedId));
      if (!matched) {
        return {
          ready: false,
          status: 'conflict',
          served_models: servedModels,
          error: `port ${this.endpointPort(model).port} is serving ${servedModels.join(', ') || 'an unknown model'}, not ${model.id}`
        };
      }
      return { ready: true, status: 'running', served_models: servedModels };
    } catch {
      return { ready: false, status: 'not-ready', served_models: [] };
    }
  }

  private async warmup(id: string): Promise<boolean> {
    const model = this.models.get(id);
    if (!model || this.warmed.has(id)) return true;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await fetch(`${model.endpoint}/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: model.model, messages: [{ role: 'user', content: 'hi' }], max_tokens: 1, temperature: 0 }),
          signal: AbortSignal.timeout(10_000)
        });
        if (response.ok) {
          this.warmed.add(id);
          return true;
        }
      } catch {
        // server still loading; retry
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    return false;
  }

  async waitReady(id: string, timeoutMs = 60_000): Promise<boolean> {
    const model = this.models.get(id);
    if (!model) throw new Error('model is not allowlisted');
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      try {
        const result = await this.verifyEndpointModel(id, 5000);
        if (result.ready && await this.warmup(id)) {
          this.onStatusChange(id, 'running');
          return true;
        }
        if (result.status === 'conflict') throw new Error(result.error ?? 'endpoint conflict');
      } catch (error) {
        if (error instanceof Error && error.message.includes('is serving')) throw error;
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    throw new Error(`${model.name} did not become ready within ${timeoutMs}ms`);
  }

  async start(id: string): Promise<{ id: string; status: string; endpoint: string }> {
    const model = this.models.get(id);
    if (!model) throw new ModelRuntimeError('CHILD_FAILED', 'model is not allowlisted');
    const existingProcess = this.processes.get(id);
    if (existingProcess !== undefined && childIsRunning(existingProcess)) return { id, status: 'running', endpoint: model.endpoint };
    if (existingProcess !== undefined) {
      this.processes.delete(id);
      this.warmed.delete(id);
      void this.clearEnginePid(id);
    }
    if (model.file.length === 0) throw new ModelRuntimeError('NOT_READY', `Local model setup required: model file was not found at ${model.file || '(unknown path)'}.`);
    await fs.access(model.file).catch(() => {
      throw new ModelRuntimeError('NOT_READY', `Local model setup required: model file was not found at ${model.file}.`);
    });
    const hardware = await this.hardwareProbe();
    if (hardware.freeRamBytes < RAM_GUARD_BYTES) {
      throw new ModelRuntimeError('NOT_READY', `Not enough free RAM to start a model: ${Math.round(hardware.freeRamBytes / 1048576)} MB free, at least ${RAM_GUARD_BYTES / 1048576} MB required.`);
    }
    if (model.ingested === true && model.fileSize !== undefined) {
      const current = await fs.stat(model.file).catch(() => null);
      if (current === null) throw new ModelRuntimeError('CONFLICT', `model file went missing after ingestion: ${model.file}`);
      if (current.size !== model.fileSize) {
        throw new ModelRuntimeError('CONFLICT', `model file changed on disk since ingestion (${model.fileSize} -> ${current.size} bytes). Re-ingest the file or restore the original.`);
      }
    }
    // Binary llama-server first (verified engine path); Python llama_cpp.server
    // remains a fallback for hosts without the binary.
    const llamaResolution = resolveLlamaBinary(this.workspace);
    if (llamaResolution) {
      const llamaBinary = llamaResolution.path;
      const llamaBinaryDir = path.dirname(llamaBinary);
      const endpointUrl = new URL(model.endpoint);
      const profile = readModelProfileSidecar(model.file);
      if (profile.invalid) throw new ModelRuntimeError('CONFLICT', 'model runtime profile is invalid; inspect it before starting the model');
      if (profile.binding !== undefined) throw new ModelRuntimeError('CONFLICT', 'model runtime profile is bound to a different canonical runtime');
      // GPU builds may omit ngl in older profiles. Default to offload-all for
      // explicitly identified Vulkan or ROCm/HIP runtimes so a compatibility
      // binary does not silently execute on CPU. Unknown/CPU binaries never get
      // implicit GPU flags.
      const profileNgl = Number(profile.runtime?.ngl);
      const profileBackend = String(profile.runtime?.backend ?? '').trim().toLowerCase();
      const gpuAccelerated = llamaResolution.accelerator === 'vulkan' || llamaResolution.accelerator === 'rocm' ||
        profileBackend === 'vulkan' || profileBackend === 'rocm' || profileBackend === 'hip';
      // LAWS (aide-inhouse-model-runtime SOP, verified 2026-08-27 A/B):
      //   - --no-warmup REQUIRED: without it the Vulkan warmup epoch
      //     crashes the process (exit code 1, empty stderr).
      //   - cwd: binaryDir REQUIRED: Node spawn without cwd means the Windows
      //     loader cannot find ggml-vulkan.dll / llama.dll sibling to the
      //     binary, causing STATUS_DLL_NOT_FOUND (exit code 1).
      //   - --no-mmap is FORBIDDEN: the monolithic private-memory path
      //     wedges at heavy-init or dies with 0xFFFFFFFF and zero stderr on
      //     VMware-SVGA / Pascal-WDDM. Default mmap streams pages lazily and
      //     survives. NEVER add it back.
      const baseArgs = [
        '-m', model.file,
        '--host', '127.0.0.1',
        '--port', String(endpointUrl.port || 8080),
        '--ctx-size', String(model.context_tokens || 2048),
        '--threads', '4',
        '--parallel', '1',
        '--no-warmup',
        '--prio', '-1'
      ];
      const sampler = samplerArgs(profile);
      const binaryArgs = gpuAccelerated && !Number.isFinite(profileNgl)
        ? [...baseArgs, '-ngl', '999', ...sampler]
        : [...baseArgs, ...sampler];
      const alreadyUpBinary = await this.verifyEndpointModel(id).catch(async () => {
        if (await this.endpointPortOpen(model)) {
          return { ready: false as const, status: 'conflict' as const, served_models: [] as never[], error: `port ${this.endpointPort(model).port} occupied by foreign server` };
        }
        return { ready: false as const, status: '' as const, served_models: [] as never[] };
      });
      if (alreadyUpBinary.ready) return { id, status: 'running', endpoint: model.endpoint };
      if (alreadyUpBinary.status === 'conflict') {
        const from = model.endpoint;
        const port = await allocateFreePort();
        model.endpoint = `http://127.0.0.1:${port}/v1`;
        this.logger?.warn('model endpoint occupied by a foreign server; relocating to a free port', { id, from, to: model.endpoint, error: alreadyUpBinary.error ?? 'unknown occupant' });
        if (model.ingested === true) await this.persistIngested();
        endpointUrl.port = String(port);
        binaryArgs[5] = String(port);
      }
      // Doctrine (aide-engine-lifecycle-doctrine): re-check memory right
      // before spawn — the gate above ran before endpoint verification and a
      // concurrent engine load can have consumed RAM since. A killed engine
      // releases commit asynchronously; spawning a multi-GB mmap load into
      // that transient hole causes commit exhaustion and machine-wide thrash
      // (reproduced 2026-08-27).
      if ((await this.hardwareProbe()).freeRamBytes < RAM_GUARD_BYTES) {
        await this.waitForMemoryDrain();
      }
      for (let attempt = 1; attempt <= 2; attempt++) {
        // cwd MUST be the binary's directory so the Windows loader finds
        // ggml-vulkan.dll / llama.dll siblings (aide-inhouse-model-runtime SOP).
        const child = this.spawnChild(llamaBinary, binaryArgs, { cwd: llamaBinaryDir, stdio: ['ignore', 'ignore', 'pipe'], detached: true });
        this.processes.set(id, child);
        if (child.pid !== undefined) void this.recordEnginePid(id, child.pid, model.file);
        this.onStatusChange(id, 'starting');
        const stderrLog = path.join(this.workspace, '.aide', 'logs', `engine-${id}.err.log`);
        await fs.mkdir(path.dirname(stderrLog), { recursive: true }).catch(() => {});
        let stderrTail = '';
        child.stderr?.on('data', chunk => { stderrTail = (stderrTail + String(chunk)).slice(-8192); });
        child.once('exit', (code, signal) => {
          this.processes.delete(id);
          this.warmed.delete(id);
          void this.clearEnginePid(id);
          void fs.appendFile(stderrLog, `${stderrTail}[exit code=${code} signal=${signal}]\n`).catch(() => {});
          this.onStatusChange(id, 'stopped');
        });
        // Early-exit guard: the lethal window is the first seconds of load.
        const early = await new Promise<{ code: number | null; signal: NodeJS.Signals | null } | null>(resolve => {
          const timer = setTimeout(() => resolve(null), 8000);
          child.once('exit', (code, signal) => { clearTimeout(timer); resolve({ code, signal }); });
        });
        if (early === null) break; // survived the danger window
        if (attempt === 2) {
          throw new ModelRuntimeError('CHILD_FAILED', `${model.name} engine exited immediately (code ${early.code}${early.signal ? `, signal ${early.signal}` : ''}). stderr tail: ${stderrTail.slice(-400) || '(empty — likely killed externally; audit the machine for /IM kill logic; see .aide/logs/engine-' + id + '.err.log)'}`);
        }
        this.logger?.warn('engine died early; draining memory and retrying once', { id, code: early.code, signal: early.signal });
        await this.waitForMemoryDrain();
      }
      return { id, status: 'starting', endpoint: model.endpoint };
    }
    if (!this.pythonReady) await this.probePython();
    if (!this.pythonReady) {
      throw new ModelRuntimeError('NOT_READY', 'Local model setup required: no Python with llama_cpp found. Set AIDE_PYTHON to a Python 3.10 interpreter with llama-cpp-python installed (tried AIDE_PYTHON, `py -3.10 -E`, `py -3 -E`, E:\\Python310\\python.exe).');
    }
    const alreadyUp = await this.verifyEndpointModel(id).catch(async () => {
      if (await this.endpointPortOpen(model)) {
        return { ready: false, status: 'conflict', served_models: [], error: `port ${this.endpointPort(model).port} is occupied but did not return a verifiable /v1/models response for ${model.id}` };
      }
      return { ready: false, status: 'not-ready', served_models: [] };
    });
    if (alreadyUp.ready) return { id, status: 'running', endpoint: model.endpoint };
    if (alreadyUp.status === 'conflict') {
      const from = model.endpoint;
      const port = await allocateFreePort();
      model.endpoint = `http://127.0.0.1:${port}/v1`;
      this.logger?.warn('model endpoint occupied by a foreign server; relocating to a free port', { id, from, to: model.endpoint, error: alreadyUp.error ?? 'unknown occupant' });
      if (model.ingested === true) await this.persistIngested();
    }
    const endpoint = new URL(model.endpoint);
    const args = [
      ...(this.pythonCmd?.args ?? []),
      '-m', 'llama_cpp.server',
      '--model', model.file,
      '--host', '127.0.0.1',
      '--port', String(endpoint.port || 8080),
      '--n_ctx', String(model.context_tokens || 2048),
      '--n_gpu_layers', '0',
      '--logits_all', 'false'
    ];
    const child = this.spawnChild(this.pythonCmd!.interp, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    this.processes.set(id, child);
    this.onStatusChange(id, 'starting');
    const stderrLog = path.join(this.workspace, '.aide', 'logs', `model-${id}.err.log`);
    await fs.mkdir(path.dirname(stderrLog), { recursive: true }).catch(() => {});
    let stderrTail = '';
    child.stderr?.on('data', chunk => {
      stderrTail = (stderrTail + String(chunk)).slice(-8192);
    });
    child.once('exit', (code, signal) => {
      this.processes.delete(id);
      this.warmed.delete(id);
      void fs.appendFile(stderrLog, `${stderrTail}[exit code=${code} signal=${signal}]\n`).catch(() => {});
      this.onStatusChange(id, 'stopped');
    });
    return { id, status: 'starting', endpoint: model.endpoint };
  }

  // Doctrine (aide-engine-lifecycle-doctrine): a killed engine releases its
  // commit charge asynchronously; spawning a replacement model load before
  // that drain caused commit exhaustion, machine-wide thrash and the silent
  // exit-code-1 deaths (2026-08-27). Poll until the floor is actually free.
  private async waitForMemoryDrain(minFreeBytes: number = RAM_GUARD_BYTES, timeoutMs = 20_000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    let last = minFreeBytes;
    while (Date.now() < deadline) {
      last = (await this.hardwareProbe()).freeRamBytes;
      if (last >= minFreeBytes) return;
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    throw new ModelRuntimeError('NOT_READY', `Memory did not recover after stopping engines (${Math.round(last / 1048576)} MB free, need ${Math.round(minFreeBytes / 1048576)} MB). Close heavy applications and try again.`);
  }

  async stop(id: string): Promise<{ id: string; status: string }> {
    const child = this.processes.get(id);
    if (!child) return { id, status: 'stopped' };
    this.warmed.delete(id);
    const waitExit = (timeoutMs: number): Promise<void> => new Promise(resolve => {
      if (!childIsRunning(child)) return resolve();
      let timer: ReturnType<typeof setTimeout>;
      const onExit = (): void => {
        clearTimeout(timer);
        resolve();
      };
      child.once('exit', onExit);
      timer = setTimeout(() => {
        child.removeListener('exit', onExit);
        resolve();
      }, timeoutMs);
    });
    if (childIsRunning(child)) child.kill('SIGTERM');
    await waitExit(5000);
    if (childIsRunning(child)) {
      // Windows: child.kill() cannot reap engines that ignore signals or hold
      // grandchildren; taskkill /T tree-kills the whole process tree (same
      // proven repair as the legacy model-manager orphan fix).
      if (process.platform === 'win32' && child.pid) {
        await new Promise<void>(resolve => {
          execFile('taskkill', ['/PID', String(child.pid), '/F', '/T'], () => resolve());
        });
      } else {
        child.kill('SIGKILL');
      }
      await waitExit(3000);
    }
    if (childIsRunning(child)) {
      throw new ModelRuntimeError('CHILD_FAILED', 'owned model runtime process tree did not exit after bounded termination; ownership is retained for recovery');
    }
    this.processes.delete(id);
    await this.clearEnginePid(id);
    return { id, status: 'stopped' };
  }

  async stopAll(): Promise<void> {
    for (const id of [...this.processes.keys()]) await this.stop(id);
  }

  // --- Wave 10A: owned-engine lifecycle persistence + stale-engine sweep ---

  private async readEnginePids(): Promise<Record<string, { pid: number; file: string }>> {
    try {
      const raw = JSON.parse(await fs.readFile(this.enginePidsPath, 'utf8')) as Record<string, { pid?: unknown; file?: unknown }>;
      const out: Record<string, { pid: number; file: string }> = {};
      for (const [id, entry] of Object.entries(raw ?? {})) {
        const pid = Number(entry?.pid);
        const file = String(entry?.file ?? '');
        if (Number.isInteger(pid) && pid > 0 && file.length > 0) out[id] = { pid, file };
      }
      return out;
    } catch {
      return {};
    }
  }

  private async writeEnginePids(map: Record<string, { pid: number; file: string }>): Promise<void> {
    try {
      await fs.mkdir(path.dirname(this.enginePidsPath), { recursive: true });
      await fs.writeFile(this.enginePidsPath, JSON.stringify(map, null, 2), 'utf8');
    } catch {
      // Lifecycle bookkeeping is best-effort; it must never break runtime ops.
    }
  }

  private async recordEnginePid(id: string, pid: number, file: string): Promise<void> {
    const map = await this.readEnginePids();
    map[id] = { pid, file };
    await this.writeEnginePids(map);
  }

  private async clearEnginePid(id: string): Promise<void> {
    const map = await this.readEnginePids();
    if (map[id] !== undefined) {
      delete map[id];
      await this.writeEnginePids(map);
    }
  }

  private processInfo(pid: number): Promise<{ commandLine: string } | null> {
    return new Promise(resolve => {
      if (process.platform !== 'win32') return resolve(null);
      execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
        `$p = Get-CimInstance Win32_Process -Filter "ProcessId = ${pid}" -ErrorAction SilentlyContinue; if ($p -ne $null) { $p.CommandLine }`
      ], { windowsHide: true }, (error, stdout) => {
        if (error) return resolve(null);
        const commandLine = String(stdout ?? '').trim();
        resolve(commandLine.length > 0 ? { commandLine } : null);
      });
    });
  }

  // Reaps engines this runtime previously owned whose process survived a hard
  // shutdown. Never touches a process whose command line does not contain the
  // exact registered artifact path (foreign engines stay untouched).
  async sweepStaleEngines(): Promise<{ reaped: number[] }> {
    const map = await this.readEnginePids();
    const reaped: number[] = [];
    let changed = false;
    for (const [id, entry] of Object.entries(map)) {
      const info = await this.processInfo(entry.pid);
      if (info === null || !info.commandLine.includes(entry.file)) {
        // Gone already, or the PID now belongs to something else: never touch.
        delete map[id];
        changed = true;
        continue;
      }
      await new Promise<void>(resolve => {
        execFile('taskkill', ['/PID', String(entry.pid), '/F', '/T'], () => resolve());
      });
      const after = await this.processInfo(entry.pid);
      if (after === null) reaped.push(entry.pid);
      delete map[id];
      changed = true;
    }
    if (changed) await this.writeEnginePids(map);
    if (reaped.length > 0) this.logger?.warn('reaped stale owned model engines at startup', { pids: reaped });
    return { reaped };
  }

  // Effective context = what the engine ACTUALLY serves (llama-server clamps
  // n_ctx to train ctx for some artifacts). Cached from /props (served at
  // engine ROOT, not under /v1); falls back to the manifest's declared
  // context_tokens until first successful read (legacy parity).
  getEffectiveContext(id: string): number | null {
    const cached = this.servedCtx.get(id);
    if (cached !== undefined) return cached;
    const declared = Number(this.models.get(id)?.context_tokens);
    return Number.isFinite(declared) && declared > 0 ? declared : null;
  }
  async refreshServedContext(id: string): Promise<void> {
    const model = this.models.get(id);
    if (!model) return;
    try {
      const base = model.endpoint.replace(/\/v1\/?$/, '');
      const response = await fetch(`${base}/props`, { signal: AbortSignal.timeout(3000) });
      if (!response.ok) return;
      const props = await response.json() as { default_generation_settings?: { n_ctx?: number } };
      const nCtx = Number(props?.default_generation_settings?.n_ctx);
      if (Number.isFinite(nCtx) && nCtx > 0) this.servedCtx.set(id, nCtx);
    } catch {
      /* endpoint not up yet — keep previous value */
    }
  }

  // Effective context budget for an upcoming completion: what the engine
  // ACTUALLY serves (clamped n_ctx) minus the completion reserve. Manifest
  // context_tokens can overstate the served window (llama-server clamps to
  // train ctx for some artifacts), which produced hard HTTP-400 overflows in
  // the 2026-08-28 capability audit (C1/D1 empty-output aborts). Callers fit
  // history against THIS number, never the declared manifest value.
  getEffectiveBudget(id: string, reserveTokens: number): number | null {
    const model = this.models.get(id);
    if (!model) return null;
    const served = this.servedCtx.get(id);
    const context = served ?? (Number.isFinite(model.context_tokens) && model.context_tokens > 0 ? model.context_tokens : null);
    if (context === null) return null;
    const budget = Math.floor(context - reserveTokens);
    // Zero means the known window is exhausted; null means context is unknown.
    // Conflating them lets callers fall back to a larger declared window.
    return Math.max(0, budget);
  }

  // Retry a failed completion once with history re-fit to the effective
  // window. llama.cpp rejects an overflowing prompt with HTTP 400; without
  // this rescue the router surfaced a 504 with zero output (audit B3/G1).
  // The newest user turn is always preserved; oldest history is dropped.
  private refitForOverflow(id: string, messages: Array<{ role: string; content: string }>, reserveTokens: number): Array<{ role: string; content: string }> | null {
    const budget = this.getEffectiveBudget(id, reserveTokens);
    if (budget === null || budget <= 0) return null;
    const newest = messages[messages.length - 1];
    if (newest === undefined) return null;
    const kept: Array<{ role: string; content: string }> = [];
    let used = estimateTokens(newest.content);
    if (used > budget) {
      // Single oversized turn: hard-truncate its head, keep the tail.
      const keepChars = budget * 4;
      kept.push({ role: newest.role, content: newest.content.slice(Math.max(0, newest.content.length - keepChars)) });
      return kept;
    }
    kept.push(newest);
    for (let index = messages.length - 2; index >= 0; index--) {
      const message = messages[index]!;
      const cost = estimateTokens(message.content);
      if (used + cost > budget) continue;
      kept.unshift(message);
      used += cost;
    }
    return kept;
  }

  async chat(id: string, messages: Array<{ role: string; content: string }>, options: AdapterRequestInputOptions & { maxTokens?: number; temperature?: number; timeoutMs?: number; signal?: AbortSignal } = {}): Promise<{ text: string; modelId: string; tokens?: number; timingMs: number }> {
    const model = this.models.get(id);
    if (!model) throw new ModelRuntimeError('CHILD_FAILED', 'model is not allowlisted');
    if (!this.processes.has(id)) {
      // Adopt externally-started servers (e.g. legacy daemon or operator CLI):
      // if the endpoint verifiably serves this model, chat through it.
      const external = await this.verifyEndpointModel(id, 3000).catch(() => ({ ready: false as const }));
      if (!external.ready) throw new ModelRuntimeError('NOT_READY', 'start this model before chatting');
    }
    const warmed = await this.warmup(id);
    if (!warmed) throw new ModelRuntimeError('NOT_READY', 'model still warming up; try again in a few seconds');
    const started = Date.now();
    let requestIndex = 0;
    const attemptRequest = async (payloadMessages: Array<{ role: string; content: string }>): Promise<Response> => {
      const serialized = JSON.stringify({
          model: model.model,
          messages: payloadMessages,
          temperature: options.temperature ?? 0.2,
          max_tokens: Math.min(options.maxTokens ?? 512, 512)
      });
      const signal = options.signal !== undefined
        ? AbortSignal.any([options.signal, AbortSignal.timeout(Math.min(options.timeoutMs ?? 90_000, 300_000))])
        : AbortSignal.timeout(Math.min(options.timeoutMs ?? 90_000, 300_000));
      await observeAdapterRequestInput(serialized, { adapter: 'local-model-runtime', protocol: 'openai-chat-completions',
        requested_model: model.model, request_index: ++requestIndex, stream: false }, options, signal);
      return fetch(`${model.endpoint}/chat/completions`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: serialized, signal
      });
    };
    let response = await attemptRequest(messages);
    if (response.status === 400) {
      // Overflow rescue: the engine rejected the prompt (llama.cpp returns
      // HTTP 400 when prompt + max_tokens exceed the served window). Re-fit
      // history against the effective context and retry ONCE — never surface
      // an empty-output 504 when the newest turn itself fits.
      const reserve = Math.min(options.maxTokens ?? 512, 512);
      const refit = this.refitForOverflow(id, messages, reserve);
      if (refit !== null && refit.length < messages.length) {
        this.logger?.warn('completion overflowed served context; retrying with refit history', { id, messages: messages.length, refit: refit.length });
        await response.body?.cancel().catch(() => {});
        response = await attemptRequest(refit);
      }
    }
    if (!response.ok) {
      await response.body?.cancel().catch(() => {});
      throw new ModelRuntimeError('CHILD_FAILED', `local runtime returned HTTP ${response.status}`);
    }
    const payload = await response.json().catch(() => {
      throw new ModelRuntimeError('CHILD_FAILED', 'local runtime returned non-JSON');
    }) as { choices?: Array<{ message?: { content?: string } }>; usage?: { completion_tokens?: number } };
    const text = payload.choices?.[0]?.message?.content ?? '';
    const tokens = payload.usage?.completion_tokens;
    const result: { text: string; modelId: string; tokens?: number; timingMs: number } = { text, modelId: id, timingMs: Date.now() - started };
    if (tokens !== undefined) result.tokens = tokens;
    return result;
  }

  async chatStream(
    id: string,
    messages: Array<{ role: string; content: string }>,
    onDelta: (delta: string) => void,
    signal: AbortSignal,
    options: AdapterRequestInputOptions & { maxTokens?: number; temperature?: number } = {}
  ): Promise<void> {
    const model = this.models.get(id);
    if (!model) throw new ModelRuntimeError('CHILD_FAILED', 'model is not allowlisted');
    if (!this.processes.has(id)) {
      // Adopt externally-started servers (same bridge as chat()).
      const external = await this.verifyEndpointModel(id, 3000).catch(() => ({ ready: false as const }));
      if (!external.ready) throw new ModelRuntimeError('NOT_READY', 'start this model before chatting');
    }
    const warmed = await this.warmup(id);
    if (!warmed) throw new ModelRuntimeError('NOT_READY', 'model still warming up; try again in a few seconds');
    let requestIndex = 0;
    const attemptRequest = async (payloadMessages: Array<{ role: string; content: string }>): Promise<Response> => {
      const serialized = JSON.stringify({
          model: model.model,
          messages: payloadMessages,
          temperature: options.temperature ?? 0.2,
          max_tokens: Math.min(options.maxTokens ?? 512, 512),
          stream: true
      });
      await observeAdapterRequestInput(serialized, { adapter: 'local-model-runtime', protocol: 'openai-chat-completions',
        requested_model: model.model, request_index: ++requestIndex, stream: true }, options, signal);
      return fetch(`${model.endpoint}/chat/completions`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: serialized, signal
      });
    };
    let response = await attemptRequest(messages);
    if (response.status === 400) {
      // Overflow rescue (same semantics as chat()): refit to the effective
      // window and retry once. Streaming requests overflowed the audit's
      // 3072 window hardest — scaffold + long prompt + 512 reserve.
      const reserve = Math.min(options.maxTokens ?? 512, 512);
      const refit = this.refitForOverflow(id, messages, reserve);
      if (refit !== null && refit.length < messages.length) {
        this.logger?.warn('stream overflowed served context; retrying with refit history', { id, messages: messages.length, refit: refit.length });
        await response.body?.cancel().catch(() => {});
        response = await attemptRequest(refit);
      }
    }
    if (!response.ok || response.body === null) {
      await response.body?.cancel().catch(() => {});
      throw new ModelRuntimeError('CHILD_FAILED', `local runtime returned HTTP ${response.status}`);
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const raw = line.slice(5).trim();
        if (raw.length === 0 || raw === '[DONE]') continue;
        try {
          const chunk = JSON.parse(raw) as { choices?: Array<{ delta?: { content?: string } }> };
          const delta = chunk.choices?.[0]?.delta?.content ?? '';
          if (delta.length > 0) onDelta(delta);
        } catch {
          // skip malformed upstream frames
        }
      }
    }
  }

  async ingest(filePath: string): Promise<{ id: string; name: string; endpoint: string; context_tokens: number; quant: string; sha256: string; fit: ModelFitReportT }> {
    const absolute = path.resolve(filePath);
    if (!absolute.toLowerCase().endsWith('.gguf')) throw new Error('only .gguf files can be ingested');
    const stat = await fs.stat(absolute).catch(() => {
      throw new Error(`model file was not found at ${absolute}`);
    });
    if (!stat.isFile()) throw new Error('model path is not a file');
    const info = await probeGguf(absolute);
    if (!ALLOWED_ARCHITECTURES.includes(info.architecture)) throw new Error(`unsupported GGUF architecture: ${info.architecture}`);
    if (info.chatTemplate === null) throw new Error('this GGUF has no tokenizer.chat_template; serving it would silently fall back to llama-2 formatting (gibberish). Rejecting for safety.');

    const { freeRamBytes } = await probeHardware();
    const fit = fitModel(info, stat.size, freeRamBytes, absolute);

    const statAfter = await fs.stat(absolute);
    const cachedHash = this.hashCache.get(absolute);
    let digestHex: string;
    if (cachedHash !== undefined && cachedHash.mtimeMs === statAfter.mtimeMs && cachedHash.size === statAfter.size) {
      digestHex = cachedHash.hash;
    } else {
      const hash = crypto.createHash('sha256');
      await new Promise<void>((resolve, reject) => {
        const stream = createReadStream(absolute);
        stream.on('data', chunk => hash.update(chunk));
        stream.on('end', () => resolve());
        stream.on('error', reject);
      });
      digestHex = hash.digest('hex');
      this.hashCache.set(absolute, { mtimeMs: statAfter.mtimeMs, size: statAfter.size, hash: digestHex });
    }

    const base = path.basename(absolute).replace(/\.gguf$/i, '');
    const id = `${base}-${digestHex.slice(0, 8)}`.toLowerCase();
    if (this.models.has(id)) {
      const existing = this.models.get(id)!;
      if (existing.sha256 !== undefined && existing.sha256.toLowerCase() !== digestHex) {
        throw new ModelRuntimeError('CONFLICT', 'full model digest differs for an existing imported identity');
      }
      if (existing.sha256 === undefined && path.resolve(existing.file).toLowerCase() !== absolute.toLowerCase()) {
        throw new ModelRuntimeError('CONFLICT', 'cannot bind a digest to an existing imported identity from a different file path');
      }
      existing.sha256 = digestHex;
      existing.fileSize = statAfter.size;
      await this.persistIngested();
      return {
        id,
        name: existing.name,
        endpoint: existing.endpoint,
        context_tokens: existing.context_tokens,
        quant: fit.quant,
        sha256: digestHex,
        fit
      };
    }
    const port = await allocateFreePort();
    const endpoint = `http://127.0.0.1:${port}/v1`;
    const entry: ModelEntry = {
      id,
      name: info.name || base,
      status: 'ready',
      roles: ['chat'],
      endpoint,
      model: path.basename(absolute),
      artifact_uri: `local://${path.basename(absolute)}`,
      context_tokens: fit.contextLength,
      ingested: true,
      file: absolute,
      fileSize: statAfter.size,
      sha256: digestHex
    };
    this.models.set(id, entry);
    await this.persistIngested();
    this.logger?.info('model ingested', { id, endpoint, context: fit.contextLength, quant: fit.quant });

    return {
      id,
      name: entry.name,
      endpoint,
      context_tokens: fit.contextLength,
      quant: fit.quant,
      sha256: digestHex,
      fit
    };
  }

  // Readiness poll parity with the legacy /api/model/ready: verify the
  // endpoint, warm it, report running/warming/conflict/not-ready. Never
  // spawns — the cockpit polls this until ready, then calls start() which
  // adopts the verified server. Adoption bridge shares warmed/changed state.
  async isReady(id: string, timeoutMs = 5000): Promise<{ id: string; ready: boolean; status: 'running' | 'warming' | 'conflict' | 'not-ready'; endpoint: string; error?: string }> {
    const model = this.models.get(id);
    if (!model) return { id, ready: false, status: 'not-ready', endpoint: '', error: 'model is not allowlisted' };
    try {
      const verified = await this.verifyEndpointModel(id, timeoutMs);
      if (verified.ready) {
        const warmed = await this.warmup(id);
        if (!warmed) return { id, ready: false, status: 'warming', endpoint: model.endpoint, error: 'model endpoint answered but warmup did not complete' };
        this.onStatusChange(id, 'running');
        return { id, ready: true, status: 'running', endpoint: model.endpoint };
      }
      return {
        id,
        ready: false,
        status: verified.status === 'conflict' ? 'conflict' : 'not-ready',
        endpoint: model.endpoint,
        ...(verified.error !== undefined ? { error: verified.error } : {})
      };
    } catch (error) {
      return { id, ready: false, status: 'conflict', endpoint: model.endpoint, error: error instanceof Error ? error.message : 'endpoint verification failed' };
    }
  }

  // Register parity with the legacy /api/models/register: a downloaded GGUF in
  // the models directory becomes a ready engine. Persists to the TS dynamic
  // store (ingested-models.json), NOT the checked-in manifest.json — the
  // manifest stays pristine (git clean); the ingested store survives restarts.
  // Acquisition (import/download) lands artifacts in the WORKSPACE models
  // directory; the bundled starter manifest resolves from the repo models
  // directory. Registration and local:// resolution must accept both canonical
  // roots (D2 repair: import -> workspace/models vs register -> repoRoot/models
  // mismatch broke the artifact -> installed -> startable lifecycle).
  private resolveArtifactPath(rel: string): string {
    const repoCandidate = path.resolve(this.modelDir, rel);
    if (existsSync(repoCandidate)) return repoCandidate;
    const workspaceCandidate = path.resolve(path.join(this.workspace, 'models'), rel);
    if (existsSync(workspaceCandidate)) return workspaceCandidate;
    return repoCandidate;
  }

  async register(options: { filename: string; repo_id?: string; quant_label?: string; context_tokens?: number }): Promise<{ id: string; status: string; endpoint: string }> {
    const rel = validateRegistrationFilename(this.modelDir, options.filename);
    const file = this.resolveArtifactPath(rel);
    const stat = await fs.stat(file).catch(() => {
      throw new ModelRuntimeError('BAD_REQUEST', `artifact not found in models directory: ${rel}`);
    });
    const id = path.basename(rel).replace(/\.gguf$/i, '').toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
    const existing = this.models.get(id);
    if (existing) return { id: existing.id, status: 'ready', endpoint: existing.endpoint };
    const port = nextFreePort(this.models);
    const entry: ModelEntry = {
      id,
      name: path.basename(rel).replace(/\.gguf$/i, ''),
      status: 'ready',
      roles: ['chat'],
      endpoint: `http://127.0.0.1:${port}/v1`,
      model: rel,
      artifact_uri: `local://${rel}`,
      context_tokens: Number(options.context_tokens) || 2048,
      ingested: true,
      file,
      fileSize: stat.size
    };
    if (options.repo_id) entry.repo_id = options.repo_id;
    if (options.quant_label) entry.quant_label = options.quant_label;
    this.models.set(id, entry);
    await this.persistIngested();
    this.logger?.info('model registered', { id, endpoint: entry.endpoint, source: rel });
    return { id, status: 'ready', endpoint: entry.endpoint };
  }

  // Profile parity with the legacy /api/models/profile: presets + sampler /
  // runtime key validation (unknown keys -> BAD_REQUEST). Persists the next to
  // the same `${file}.profile.json` sidecar the engine layer reads.
  async saveProfile(id: string, patch: ModelProfilePatch): Promise<{ id: string; preset: string; saved: true }> {
    return this.persistProfile(id, patch, {
      samplerKeys: ['temperature', 'top_k', 'top_p', 'min_p', 'mirostat', 'mirostat_tau', 'mirostat_eta', 'repeat_penalty', 'seed'],
      runtimeKeys: ['ngl', 'flash_attn', 'backend']
    });
  }

  protected async persistProfile(
    id: string,
    patch: ModelProfilePatch,
    options: { samplerKeys: readonly string[]; runtimeKeys: readonly string[]; binding?: ModelProfileBinding }
  ): Promise<{ id: string; preset: string; saved: true }> {
    const model = this.models.get(id);
    if (!model) throw new ModelRuntimeError('BAD_REQUEST', 'model is not allowlisted');
    const PRESETS: Record<string, Record<string, number>> = {
      precise: { temperature: 0.1, min_p: 0.05, repeat_penalty: 1.05, seed: 0 },
      balanced: { temperature: 0.7, top_p: 0.9, min_p: 0.05 },
      creative: { temperature: 1.0, top_p: 0.95, min_p: 0.03 },
      mirostat: { mirostat: 2, mirostat_tau: 5.0, mirostat_eta: 0.1 }
    };
    const sidecarPath = `${model.file}.profile.json`;
    if (!model.file) throw new ModelRuntimeError('NOT_READY', 'model artifact is unavailable for profile binding');
    await fs.access(model.file).catch(() => { throw new ModelRuntimeError('NOT_READY', 'model artifact is unavailable for profile binding'); });
    return withFileMutationLock(sidecarPath, async () => {
      const base = readModelProfileSidecar(model.file);
      if (base.invalid) throw new ModelRuntimeError('CONFLICT', 'existing model profile is invalid; inspect it before replacing it');
      const samplerKeys = options.samplerKeys;
      const runtimeKeys = options.runtimeKeys;
      const sameBoundProfile = options.binding !== undefined && base.schema_version === 1 &&
        base.binding?.artifact_sha256?.toLowerCase() === options.binding.artifact_sha256.toLowerCase() &&
        base.binding.runtime_id === options.binding.runtime_id &&
        base.binding.runtime_version === options.binding.runtime_version &&
        Object.keys(base.samplers ?? {}).every(key => samplerKeys.includes(key)) &&
        Object.keys(base.runtime ?? {}).every(key => runtimeKeys.includes(key));
      const reuseBaseSettings = options.binding === undefined || sameBoundProfile;
      const preservedLegacyProfile = options.binding !== undefined && !sameBoundProfile &&
        (base.preset !== undefined || base.samplers !== undefined || base.runtime !== undefined)
        ? {
            schema_version: base.schema_version ?? null,
            binding: base.binding ?? null,
            preset: base.preset ?? null,
            samplers: base.samplers ?? null,
            runtime: base.runtime ?? null
          }
        : undefined;
      const legacyUnbound = {
        ...base.legacy_unbound,
        ...(preservedLegacyProfile === undefined ? {} : { previous_profile: preservedLegacyProfile })
      };
      const baseSamplers = reuseBaseSettings ? base.samplers : undefined;
      const baseRuntime = reuseBaseSettings ? base.runtime : undefined;
      const requestedSamplers = patch.samplers ?? {};
      const requestedRuntime = patch.runtime ?? {};
      for (const [key, value] of Object.entries(requestedSamplers)) {
        if (!samplerKeys.includes(key)) throw new ModelRuntimeError('BAD_REQUEST', `sampler ${key} is not supported by this runtime profile`);
        if (!Number.isFinite(value)) throw new ModelRuntimeError('BAD_REQUEST', `sampler ${key} must be a finite number`);
        if (key === 'temperature' && (value < 0 || value > 2)) throw new ModelRuntimeError('BAD_REQUEST', 'sampler temperature must be between 0 and 2');
      }
      for (const [key, value] of Object.entries(requestedRuntime)) {
        if (!runtimeKeys.includes(key)) throw new ModelRuntimeError('BAD_REQUEST', `runtime setting ${key} is not supported by this runtime profile`);
        if (key === 'backend' ? typeof value !== 'string' : typeof value !== 'number' || !Number.isFinite(value)) {
          throw new ModelRuntimeError('BAD_REQUEST', `runtime ${key} has invalid type`);
        }
        if (key === 'context_tokens' && (typeof value !== 'number' || !Number.isInteger(value) || value < 128 || value > 131072)) {
          throw new ModelRuntimeError('BAD_REQUEST', 'runtime context_tokens must be an integer from 128 to 131072');
        }
        if (key === 'max_tokens' && (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 8192)) {
          throw new ModelRuntimeError('BAD_REQUEST', 'runtime max_tokens must be an integer from 1 to 8192');
        }
      }
      const preset = patch.preset;
      let presetValues: Record<string, number> = {};
      if (preset !== undefined && preset !== 'custom') {
        const known = PRESETS[preset];
        if (!known) throw new ModelRuntimeError('BAD_REQUEST', `unknown preset: ${preset}`);
        const unsupported = Object.keys(known).find(key => !samplerKeys.includes(key));
        if (unsupported) throw new ModelRuntimeError('BAD_REQUEST', `preset ${preset} requires unsupported sampler ${unsupported}`);
        presetValues = known;
      }
      if (patch.preset === undefined && patch.samplers === undefined && patch.runtime === undefined) {
        throw new ModelRuntimeError('BAD_REQUEST', 'profile requires preset, samplers or runtime');
      }
      const next: ModelProfileSidecar = {
        schema_version: 1,
        ...(options.binding === undefined ? {} : { binding: options.binding }),
        preset: preset ?? (patch.samplers !== undefined ? 'custom' : reuseBaseSettings ? base.preset ?? 'custom' : 'custom'),
        ...(Object.keys(presetValues).length > 0 || baseSamplers !== undefined || patch.samplers !== undefined
          ? { samplers: { ...(preset === undefined || preset === 'custom' ? baseSamplers : {}), ...presetValues, ...requestedSamplers } }
          : {}),
        ...(baseRuntime !== undefined || patch.runtime !== undefined
          ? { runtime: { ...baseRuntime, ...requestedRuntime } }
          : {}),
        ...(Object.keys(legacyUnbound).length > 0 ? { legacy_unbound: legacyUnbound } : {})
      };
      await atomicWriteJson(sidecarPath, next);
      return { id, preset: String(next.preset ?? 'custom'), saved: true };
    });
  }

  private async persistIngested(): Promise<void> {
    const ingested = [...this.models.values()]
      .filter(model => model.ingested === true)
      .map(model => ({
        id: model.id,
        name: model.name,
        status: model.status,
        roles: model.roles,
        endpoint: model.endpoint,
        model: model.model,
        artifact_uri: model.artifact_uri,
        context_tokens: model.context_tokens,
        file: model.file,
        file_size: model.fileSize,
        sha256: model.sha256,
        repo_id: model.repo_id,
        quant_label: model.quant_label,
        ingested: true
      }));
    await fs.mkdir(path.dirname(this.ingestedPath), { recursive: true }).catch(() => {});
    await fs.writeFile(this.ingestedPath, JSON.stringify(ingested, null, 2), 'utf8');
  }
}

async function allocateFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (address === null || typeof address === 'string') {
        server.close();
        reject(new Error('failed to allocate a free port'));
        return;
      }
      const port = address.port;
      server.close(() => resolve(port));
    });
  });
}

// Register-port doctrine (legacy parity): claim from the 8090 pool, skipping
// any port already declared by another engine (running OR manifest-reserved)
// so two registrations never straddle the same endpoint.
function nextFreePort(models: ReadonlyMap<string, ModelEntry>): number {
  const used = new Set<number>();
  for (const model of models.values()) {
    try {
      used.add(Number(new URL(model.endpoint).port));
    } catch {
      // malformed endpoint — ignore
    }
  }
  let port = 8090;
  while (used.has(port) && port < 8199) port += 1;
  return port;
}
