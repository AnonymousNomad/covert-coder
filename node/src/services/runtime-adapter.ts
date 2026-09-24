import { appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  RuntimeFallbackEvent,
  type RuntimeBackendT,
  type RuntimeCapabilityDescriptorT,
  type RuntimeHealthT,
  type RuntimeMetricsT,
  type RuntimeModelIdentityT,
  type RuntimeOwnershipT,
  type RuntimeStatusResponseT,
  type RuntimeToolEvidenceT
} from '../../../common/contracts/runtime.ts';

export interface RuntimeLoadRequest {
  modelId: string;
  modelPath: string;
  displayName?: string;
  contextTokens?: number;
  loadIn4Bit?: boolean;
}

export interface RuntimeMessage {
  role: string;
  content: string;
}

export interface RuntimeInferenceRequest {
  modelId: string;
  messages: RuntimeMessage[];
  maxTokens?: number;
  temperature?: number;
  tools?: unknown[];
  responseFormat?: unknown;
}

export interface RuntimeInferenceResult {
  text: string;
  model: RuntimeModelIdentityT;
  completionTokens: number | null;
  promptTokens: number | null;
  timingMs: number;
  toolCalls: unknown[];
  toolEvidence: RuntimeToolEvidenceT;
  finishReason: string | null;
}

export type RuntimeDeltaHandler = (delta: string) => void;

export interface RuntimeQualificationIdentity {
  backend: RuntimeBackendT;
  backendVersion: string;
  artifactSha256: string;
}

/** Unknown identity is never qualified; any backend, release, or artifact change invalidates it. */
export function isRuntimeQualificationCurrent(qualified: RuntimeQualificationIdentity, current: RuntimeStatusResponseT): boolean {
  return qualified.backend === current.backend &&
    qualified.backendVersion.length > 0 && current.version === qualified.backendVersion &&
    /^[a-f0-9]{64}$/i.test(qualified.artifactSha256) &&
    current.loaded_model?.artifact_sha256?.toLowerCase() === qualified.artifactSha256.toLowerCase();
}

export interface RuntimeAdapter {
  readonly backendId: RuntimeBackendT;
  discover(): Promise<void>;
  health(): Promise<RuntimeHealthT>;
  capabilities(): RuntimeCapabilityDescriptorT;
  models(): Promise<RuntimeModelIdentityT[]>;
  load(request: RuntimeLoadRequest, operatorAction?: boolean): Promise<RuntimeModelIdentityT>;
  unload(modelId: string, operatorAction?: boolean): Promise<void>;
  infer(request: RuntimeInferenceRequest, signal?: AbortSignal): Promise<RuntimeInferenceResult>;
  stream(request: RuntimeInferenceRequest, onDelta: RuntimeDeltaHandler, signal: AbortSignal): Promise<RuntimeInferenceResult>;
  cancel(): Promise<boolean>;
  metrics(): Promise<RuntimeMetricsT>;
  shutdown(operatorAction?: boolean): Promise<void>;
  status(): Promise<RuntimeStatusResponseT>;
}

export class RuntimeAdapterError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'RuntimeAdapterError';
    this.code = code;
  }
}

export function unknownCapabilities(): RuntimeCapabilityDescriptorT {
  const unknown = 'UNKNOWN' as const;
  return {
    api_chat_completions: unknown,
    api_responses: unknown,
    api_anthropic_messages: unknown,
    api_embeddings: unknown,
    embeddings: unknown,
    model_discovery: unknown,
    model_load: unknown,
    model_unload: unknown,
    model_switching: unknown,
    hot_swap: unknown,
    streaming: unknown,
    cancellation: unknown,
    tool_calling: unknown,
    tool_repair: unknown,
    structured_output: unknown,
    vision: unknown,
    speculative_decoding: unknown,
    parallel_requests: unknown,
    context_controls: unknown,
    kv_cache_controls: unknown,
    metrics: unknown,
    headless: unknown,
    offline_local_inference: unknown
  };
}

export function unknownMetrics(): RuntimeMetricsT {
  return {
    ram_bytes: null,
    vram_bytes: null,
    windows_commit_bytes: null,
    loaded_model_bytes: null,
    context_tokens: null,
    source: 'UNKNOWN'
  };
}

export function unknownModelIdentity(modelId: string): RuntimeModelIdentityT {
  return {
    model_id: modelId,
    display_name: null,
    artifact_name: null,
    artifact_sha256: null,
    identity_evidence: 'UNKNOWN'
  };
}

export class RuntimeBroker {
  readonly canonicalBackend = 'UNSLOTH' as const;
  private active: RuntimeAdapter;
  private fallbackEventId: string | null = null;
  private lastError: RuntimeStatusResponseT['last_error'] = null;
  private readonly canonical: RuntimeAdapter;
  private readonly recovery: RuntimeAdapter | null;
  private readonly workspace: string;

  constructor(
    canonical: RuntimeAdapter,
    recovery: RuntimeAdapter | null,
    workspace: string
  ) {
    this.canonical = canonical;
    this.recovery = recovery;
    this.workspace = workspace;
    if (canonical.backendId !== 'UNSLOTH') throw new Error('the canonical Runtime Broker adapter must be Unsloth');
    if (recovery !== null && recovery.backendId !== 'LLAMA_CPP') throw new Error('the recovery adapter must be direct llama.cpp');
    this.active = canonical;
  }

  get selectedBackend(): RuntimeBackendT {
    return this.active.backendId;
  }

  async discover(): Promise<void> {
    // Discovery follows the product path only. Recovery remains dormant unless explicitly selected.
    await this.canonical.discover();
  }

  private async invoke<T>(operation: () => Promise<T>): Promise<T> {
    try {
      const result = await operation();
      this.lastError = null;
      return result;
    } catch (error) {
      const code = error instanceof RuntimeAdapterError ? error.code : 'RUNTIME_OPERATION_FAILED';
      const message = error instanceof RuntimeAdapterError ? error.message : 'Runtime operation failed; details were not recorded';
      this.lastError = { code, message, at: new Date().toISOString() };
      throw error;
    }
  }

  health(): Promise<RuntimeHealthT> { return this.invoke(() => this.active.health()); }
  capabilities(): RuntimeCapabilityDescriptorT { return this.active.capabilities(); }
  models(): Promise<RuntimeModelIdentityT[]> { return this.invoke(() => this.active.models()); }
  load(request: RuntimeLoadRequest, operatorAction = false): Promise<RuntimeModelIdentityT> {
    return this.invoke(() => this.active.load(request, operatorAction));
  }
  unload(modelId: string, operatorAction = false): Promise<void> { return this.invoke(() => this.active.unload(modelId, operatorAction)); }
  infer(request: RuntimeInferenceRequest, signal?: AbortSignal): Promise<RuntimeInferenceResult> {
    return this.invoke(() => this.active.infer(request, signal));
  }
  stream(request: RuntimeInferenceRequest, onDelta: RuntimeDeltaHandler, signal: AbortSignal): Promise<RuntimeInferenceResult> {
    return this.invoke(() => this.active.stream(request, onDelta, signal));
  }
  cancel(): Promise<boolean> { return this.invoke(() => this.active.cancel()); }
  metrics(): Promise<RuntimeMetricsT> { return this.active.metrics(); }
  shutdown(operatorAction = false): Promise<void> { return this.invoke(() => this.active.shutdown(operatorAction)); }

  async status(): Promise<RuntimeStatusResponseT> {
    const status = await this.active.status();
    return { ...status, canonical_backend: 'UNSLOTH', fallback_event_id: this.fallbackEventId, last_error: this.lastError ?? status.last_error };
  }

  /** Explicit recovery only. Failure to persist the event leaves Unsloth selected. */
  async activateLlamaRecovery(reason: string, explicitOperatorAction: boolean): Promise<string> {
    if (!explicitOperatorAction) throw new RuntimeAdapterError('OPERATOR_ACTION_REQUIRED', 'runtime fallback requires an explicit operator action');
    if (this.recovery === null) throw new RuntimeAdapterError('RECOVERY_UNAVAILABLE', 'direct llama.cpp recovery is not configured');
    if (this.active !== this.canonical) throw new RuntimeAdapterError('ALREADY_IN_RECOVERY', 'a recovery backend is already selected');
    const normalizedReason = reason.trim();
    if (normalizedReason.length === 0 || normalizedReason.length > 1000) {
      throw new RuntimeAdapterError('INVALID_REASON', 'fallback reason must contain 1 to 1000 characters');
    }
    await this.recovery.discover();
    const recoveryHealth = await this.recovery.health();
    if (recoveryHealth !== 'HEALTHY' && recoveryHealth !== 'STOPPED') throw new RuntimeAdapterError('RECOVERY_UNHEALTHY', 'direct llama.cpp recovery is unavailable');
    const current = await this.canonical.status();
    if ((current.ownership === 'COVERT_OWNED' || current.ownership === 'USER_OWNED') && current.loaded_model !== null) {
      await this.canonical.unload(current.loaded_model.model_id, true);
    }
    const event = RuntimeFallbackEvent.parse({
      event_id: randomUUID(),
      from_backend: 'UNSLOTH',
      to_backend: 'LLAMA_CPP',
      reason: normalizedReason,
      explicit_operator_action: true,
      model_id: current.loaded_model?.model_id ?? null,
      artifact_sha256: current.loaded_model?.artifact_sha256 ?? null,
      at: new Date().toISOString()
    });
    const eventPath = path.join(this.workspace, '.aide', 'runtime-events.jsonl');
    await mkdir(path.dirname(eventPath), { recursive: true });
    await appendFile(eventPath, `${JSON.stringify(event)}\n`, { encoding: 'utf8', flag: 'a' });
    this.fallbackEventId = event.event_id;
    this.active = this.recovery;
    return event.event_id;
  }

  /** Return to Unsloth only after it is independently healthy; never switch silently. */
  async selectCanonical(explicitOperatorAction: boolean): Promise<void> {
    if (!explicitOperatorAction) throw new RuntimeAdapterError('OPERATOR_ACTION_REQUIRED', 'runtime selection requires an explicit operator action');
    if (await this.canonical.health() !== 'HEALTHY') throw new RuntimeAdapterError('CANONICAL_UNHEALTHY', 'Unsloth is not healthy');
    this.active = this.canonical;
    this.fallbackEventId = null;
  }
}

export function ownershipHealth(ownership: RuntimeOwnershipT, healthy: boolean): RuntimeHealthT {
  if (healthy) return 'HEALTHY';
  if (ownership === 'UNKNOWN' || ownership === 'FOREIGN') return 'UNKNOWN';
  return 'UNHEALTHY';
}
