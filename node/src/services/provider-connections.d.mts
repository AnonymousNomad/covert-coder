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
}

export function createProviderConnectionsService(options: ProviderConnectionsServiceOptions): ProviderConnectionsService;