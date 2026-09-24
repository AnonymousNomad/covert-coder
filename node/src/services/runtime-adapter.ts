// node/src/services/runtime-adapter.ts
// RuntimeAdapter boundary — stable contract only; NO backend winner chosen here.
// The runtime-lab lane evaluates llama.cpp / Unsloth / Ollama / LM Studio; this
// module defines the interface backends must satisfy and a registry to hold them.
export interface RuntimeModelInfo {
  id: string;
  loaded: boolean;
  context_tokens?: number;
}

export interface RuntimeGenerateRequest {
  model_id: string;
  messages: Array<{ role: 'system' | 'user' | 'assistant' | 'tool'; content: string }>;
  max_tokens?: number;
  temperature?: number;
  stop?: string[];
}

export interface RuntimeGenerateResult {
  content: string;
  finish_reason: 'stop' | 'length' | 'tool_calls' | 'error';
  reasoning_content?: string;
  tool_calls?: unknown[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  latency_ms: number;
}

export interface RuntimeCapabilities {
  tools: boolean;
  metrics: boolean;
  unload: boolean;
}

export interface RuntimeAdapter {
  readonly name: string;
  readonly capabilities: RuntimeCapabilities;
  discover(): Promise<RuntimeModelInfo[]>;
  status(modelId: string): Promise<RuntimeModelInfo | null>;
  load(modelId: string): Promise<{ id: string; status: string }>;
  unload(modelId: string): Promise<{ id: string; status: string }>;
  health(): Promise<{ ok: boolean; detail?: string }>;
  generate(request: RuntimeGenerateRequest): Promise<RuntimeGenerateResult>;
  tools(): Promise<Array<{ name: string; description: string }>>;
  metrics(): Promise<Record<string, number>>;
}

export class RuntimeAdapterRegistry {
  private adapters = new Map<string, RuntimeAdapter>();

  register(adapter: RuntimeAdapter): void {
    this.adapters.set(adapter.name, adapter);
  }

  get(name: string): RuntimeAdapter | null {
    return this.adapters.get(name) ?? null;
  }

  list(): Array<{ name: string; capabilities: RuntimeCapabilities }> {
    return [...this.adapters.values()].map(adapter => ({ name: adapter.name, capabilities: adapter.capabilities }));
  }
}

// Backend-specific implementations remain stubs pending runtime-lab evidence.
// AUTO backend selection is intentionally NOT implemented in this slice.
export class UnimplementedRuntimeAdapter implements RuntimeAdapter {
  readonly name: string;
  readonly capabilities: RuntimeCapabilities = { tools: false, metrics: false, unload: false };
  constructor(name: string) { this.name = name; }
  async discover(): Promise<RuntimeModelInfo[]> { throw new Error(`runtime ${this.name}: discover not implemented (pending runtime-lab evidence)`); }
  async status(): Promise<RuntimeModelInfo | null> { throw new Error(`runtime ${this.name}: status not implemented`); }
  async load(): Promise<{ id: string; status: string }> { throw new Error(`runtime ${this.name}: load not implemented`); }
  async unload(): Promise<{ id: string; status: string }> { throw new Error(`runtime ${this.name}: unload not implemented`); }
  async health(): Promise<{ ok: boolean; detail?: string }> { return { ok: false, detail: 'not implemented' }; }
  async generate(): Promise<RuntimeGenerateResult> { throw new Error(`runtime ${this.name}: generate not implemented`); }
  async tools(): Promise<Array<{ name: string; description: string }>> { return []; }
  async metrics(): Promise<Record<string, number>> { return {}; }
}
