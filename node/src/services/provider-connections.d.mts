// Type declarations for node/src/services/provider-connections.mjs (strict TS).
export interface ProviderConnectionsService {
  list(): Promise<{
    consensus: string;
    routed_roles: { plan: unknown; act: unknown; utility: unknown };
    preference: string;
    connections: Array<Record<string, unknown>>;
  }>;
  getPreference(): string;
  setPreference(preference: string): string;
  test(connectionId: string): Promise<{ ok: boolean; detail: string }>;
  subscriptionAuth(subscriptionId: string): Promise<{ ok: boolean; command: string; status: string; detail: string }>;
  getHfTokenStored(): { stored: boolean };
  setHfToken(apiKey: string): { stored: true };
  deleteHfToken(): { ok: true };
}

export interface ProviderConnectionsServiceOptions {
  workspace: string;
  providerService: { list(): Promise<Array<Record<string, unknown>>> };
  byokService: {
    status(): unknown;
    testProvider(providerId: string): Promise<{ ok: boolean; detail: string }>;
  };
  modelRuntime?: { status(): Promise<unknown> };
  modelRuntimeStatus?: () => Promise<{ runtime: unknown; models: Array<Record<string, unknown>> }>;
  secretStore: {
    setKey(id: string, key: string): void;
    getKey(id: string): string | null;
    deleteKey(id: string): boolean;
    listProviderIds(): string[];
  };
  findExecutable?: (name: string) => Promise<string | null>;
  preferencePath?: string;
  // Wave 7: governed subscription CLI transports (official Codex / Claude Code).
  subscriptionTransports?: {
    detect(provider: 'codex-cli' | 'claude-code-cli'): Promise<{
      provider: 'codex-cli' | 'claude-code-cli';
      provider_family: 'openai' | 'anthropic';
      transport: 'codex-cli' | 'claude-code-cli';
      connection_mode: 'subscription_client';
      auth_class: 'chatgpt_subscription' | 'claude_subscription';
      auth_source: 'chatgpt' | 'claude' | null;
      capabilities: { authenticated: boolean; analysis_executable: boolean; mutation_executable: boolean | null };
      status: 'UNAVAILABLE' | 'AUTH_REQUIRED' | 'AVAILABLE' | 'DEGRADED';
      binary_path: string | null;
      version: string | null;
      detail: string;
    }>;
  };
  // Subscription bridge Phase 2: official Kimi Code CLI transport.
  kimiTransport?: {
    detect(): Promise<{
      provider: 'kimi-code';
      transport: 'kimi-code-cli';
      auth_class: 'kimi_code_subscription';
      status: 'UNAVAILABLE' | 'AUTH_REQUIRED' | 'AVAILABLE' | 'DEGRADED';
      binary_path: string | null;
      version: string | null;
      authenticated: boolean | null;
      detail: string;
    }>;
    probe(): Promise<{ authenticated: boolean; detail: string }>;
  };
  // Subscription bridge Phase 3: documented OpenCode headless server bridge.
  opencodeBridge?: {
    detect(): Promise<{ bin: string; prefix: string[]; version: string | null } | null>;
    status(): Promise<{
      status: string;
      version: string | null;
      connected_providers: string[];
      detail: string;
    }>;
  };
}

export function createProviderConnectionsService(options: ProviderConnectionsServiceOptions): ProviderConnectionsService;