import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import type { RuntimeCapabilityDescriptorT, RuntimeHealthT, RuntimeMetricsT, RuntimeModelIdentityT, RuntimeStatusResponseT } from '../../../common/contracts/runtime.ts';
import { RuntimeAdapterError, unknownMetrics, unknownModelIdentity, type RuntimeAdapter, type RuntimeInferenceRequest, type RuntimeInferenceResult, type RuntimeLoadRequest } from './runtime-adapter.ts';
import type { ModelEntry } from './model-runtime.ts';

export interface LlamaCppRuntimeAdapterOptions {
  workspace: string;
  listModels: () => ModelEntry[];
  getModel: (id: string) => ModelEntry | undefined;
  isOwned: (id: string) => boolean;
  pidForModel: (id: string) => number | null;
  engineName: () => string | null;
  start: (id: string) => Promise<{ id: string; status: string; endpoint: string }>;
  waitReady: (id: string) => Promise<boolean>;
  stop: (id: string) => Promise<{ id: string; status: string }>;
  chat: (id: string, messages: RuntimeInferenceRequest['messages'], options: { maxTokens?: number; temperature?: number }) => Promise<{ text: string; modelId: string; tokens?: number; timingMs: number }>;
  chatStream: (id: string, messages: RuntimeInferenceRequest['messages'], onDelta: (delta: string) => void, signal: AbortSignal, options: { maxTokens?: number; temperature?: number }) => Promise<void>;
  available: () => Promise<boolean>;
  now?: () => Date;
}

function artifactHash(file: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(file);
    stream.on('data', chunk => hash.update(chunk));
    stream.once('error', reject);
    stream.once('end', () => resolve(hash.digest('hex')));
  });
}

export class LlamaCppRuntimeAdapter implements RuntimeAdapter {
  readonly backendId = 'LLAMA_CPP' as const;
  private readonly options: LlamaCppRuntimeAdapterOptions;
  private readonly now: () => Date;
  private loaded: RuntimeModelIdentityT | null = null;
  private loadedModelId: string | null = null;
  private startedAt: string | null = null;
  private controllers = new Set<AbortController>();

  constructor(options: LlamaCppRuntimeAdapterOptions) {
    this.options = options;
    this.now = options.now ?? (() => new Date());
  }

  async discover(): Promise<void> {
    // Availability is determined from the existing pinned/local binary resolver.
    await this.options.available();
  }

  async health(): Promise<RuntimeHealthT> {
    if (this.loadedModelId !== null && this.options.isOwned(this.loadedModelId)) return 'HEALTHY';
    return await this.options.available() ? 'STOPPED' : 'NOT_INSTALLED';
  }

  capabilities(): RuntimeCapabilityDescriptorT {
    return {
      api_chat_completions: 'SUPPORTED',
      api_responses: 'UNKNOWN',
      api_anthropic_messages: 'UNKNOWN',
      api_embeddings: 'UNKNOWN',
      embeddings: 'UNKNOWN',
      model_discovery: 'SUPPORTED',
      model_load: 'SUPPORTED',
      model_unload: 'SUPPORTED',
      model_switching: 'PARTIAL',
      hot_swap: 'UNKNOWN',
      streaming: 'SUPPORTED',
      cancellation: 'PARTIAL',
      tool_calling: 'UNKNOWN',
      tool_repair: 'UNKNOWN',
      structured_output: 'UNKNOWN',
      vision: 'UNKNOWN',
      speculative_decoding: 'UNKNOWN',
      parallel_requests: 'UNKNOWN',
      context_controls: 'UNKNOWN',
      kv_cache_controls: 'UNKNOWN',
      metrics: 'UNKNOWN',
      headless: 'SUPPORTED',
      offline_local_inference: 'SUPPORTED'
    };
  }

  async models(): Promise<RuntimeModelIdentityT[]> {
    return this.options.listModels().map(model => ({
      model_id: model.id,
      display_name: model.name,
      artifact_name: model.file ? path.basename(model.file) : null,
      artifact_sha256: null,
      identity_evidence: 'UNKNOWN' as const
    }));
  }

  async load(request: RuntimeLoadRequest): Promise<RuntimeModelIdentityT> {
    const model = this.options.getModel(request.modelId);
    if (!model || path.resolve(model.file) !== path.resolve(request.modelPath)) throw new RuntimeAdapterError('MODEL_NOT_ALLOWLISTED', 'direct llama.cpp recovery accepts only the registered model artifact');
    const result = await this.options.start(request.modelId);
    if (!this.options.isOwned(request.modelId)) throw new RuntimeAdapterError('OWNERSHIP_UNVERIFIED', 'direct llama.cpp start did not yield a retained Covert-owned process');
    if (result.status === 'starting' && !(await this.options.waitReady(request.modelId))) {
      if (this.options.isOwned(request.modelId)) await this.options.stop(request.modelId);
      throw new RuntimeAdapterError('LLAMA_CPP_NOT_READY', 'direct llama.cpp did not become ready');
    }
    const identity: RuntimeModelIdentityT = {
      model_id: model.id,
      display_name: request.displayName ?? model.name,
      artifact_name: path.basename(model.file),
      artifact_sha256: await artifactHash(model.file),
      identity_evidence: 'REQUESTED_ARTIFACT'
    };
    this.loaded = identity;
    this.loadedModelId = model.id;
    this.startedAt = this.now().toISOString();
    return identity;
  }

  async unload(modelId: string): Promise<void> {
    if (this.loadedModelId !== modelId || !this.options.isOwned(modelId)) throw new RuntimeAdapterError('OWNERSHIP_UNVERIFIED', 'direct llama.cpp unload is permitted only for a process started and retained by Covert');
    await this.options.stop(modelId);
    this.loaded = null;
    this.loadedModelId = null;
  }

  async infer(request: RuntimeInferenceRequest): Promise<RuntimeInferenceResult> {
    if (request.tools !== undefined) throw new RuntimeAdapterError('CAPABILITY_UNKNOWN', 'tool-call behavior is not exposed by the direct recovery adapter');
    if (request.responseFormat !== undefined) throw new RuntimeAdapterError('CAPABILITY_UNKNOWN', 'structured output is not exposed by the direct recovery adapter');
    if (this.loadedModelId !== request.modelId || !this.options.isOwned(request.modelId)) throw new RuntimeAdapterError('MODEL_NOT_LOADED', 'requested direct llama.cpp model is not Covert-owned and loaded');
    const generationOptions = {
      ...(request.maxTokens === undefined ? {} : { maxTokens: request.maxTokens }),
      ...(request.temperature === undefined ? {} : { temperature: request.temperature })
    };
    const result = await this.options.chat(request.modelId, request.messages, generationOptions);
    return {
      text: result.text,
      model: this.loaded ?? unknownModelIdentity(request.modelId),
      promptTokens: null,
      completionTokens: result.tokens ?? null,
      timingMs: result.timingMs,
      toolCalls: [],
      toolEvidence: { raw_model_output: null, runtime_adjusted_output: null, executed_tool_call: null, attribution: 'UNKNOWN', limitation: 'Direct recovery adapter exposes text-only inference in this contract.' },
      finishReason: null
    };
  }

  async stream(request: RuntimeInferenceRequest, onDelta: (delta: string) => void, signal: AbortSignal): Promise<RuntimeInferenceResult> {
    if (request.tools !== undefined || request.responseFormat !== undefined) throw new RuntimeAdapterError('CAPABILITY_UNKNOWN', 'tool and structured-output requests are not exposed by the direct recovery adapter');
    if (this.loadedModelId !== request.modelId || !this.options.isOwned(request.modelId)) throw new RuntimeAdapterError('MODEL_NOT_LOADED', 'requested direct llama.cpp model is not Covert-owned and loaded');
    const controller = new AbortController();
    const abort = (): void => controller.abort(signal.reason);
    if (signal.aborted) abort();
    else signal.addEventListener('abort', abort, { once: true });
    this.controllers.add(controller);
    let text = '';
    try {
      const started = Date.now();
      const generationOptions = {
        ...(request.maxTokens === undefined ? {} : { maxTokens: request.maxTokens }),
        ...(request.temperature === undefined ? {} : { temperature: request.temperature })
      };
      await this.options.chatStream(request.modelId, request.messages, delta => { text += delta; onDelta(delta); }, controller.signal, generationOptions);
      return {
        text,
        model: this.loaded ?? unknownModelIdentity(request.modelId),
        promptTokens: null,
        completionTokens: null,
        timingMs: Math.max(0, Date.now() - started),
        toolCalls: [],
        toolEvidence: { raw_model_output: null, runtime_adjusted_output: null, executed_tool_call: null, attribution: 'UNKNOWN', limitation: 'Direct recovery adapter exposes text-only inference in this contract.' },
        finishReason: null
      };
    } finally {
      signal.removeEventListener('abort', abort);
      this.controllers.delete(controller);
    }
  }

  async cancel(): Promise<boolean> {
    if (this.controllers.size === 0) return false;
    for (const controller of this.controllers) controller.abort();
    return true;
  }

  async metrics(): Promise<RuntimeMetricsT> { return unknownMetrics(); }

  async shutdown(): Promise<void> {
    if (this.loadedModelId !== null) await this.unload(this.loadedModelId);
  }

  async status(): Promise<RuntimeStatusResponseT> {
    const model = this.loadedModelId === null ? null : this.options.getModel(this.loadedModelId);
    const owned = this.loadedModelId !== null && this.options.isOwned(this.loadedModelId);
    const health = await this.health();
    let endpoint: string | null = null;
    let port: number | null = null;
    if (model) {
      try {
        const url = new URL(model.endpoint);
        endpoint = `${url.protocol}//${url.host}`;
        port = Number(url.port || (url.protocol === 'https:' ? 443 : 80));
      } catch { /* leave malformed manifest endpoint unknown */ }
    }
    return {
      contract_version: 1,
      canonical_backend: 'UNSLOTH',
      backend: 'LLAMA_CPP',
      version: null,
      engine: this.options.engineName(),
      endpoint,
      port,
      pid: owned && this.loadedModelId !== null ? this.options.pidForModel(this.loadedModelId) : null,
      started_at: this.startedAt,
      health,
      ownership: owned ? 'COVERT_OWNED' : 'UNKNOWN',
      loaded_model: this.loaded,
      capabilities: this.capabilities(),
      metrics: await this.metrics(),
      last_error: null,
      fallback_event_id: null,
      updated_at: this.now().toISOString()
    };
  }
}
