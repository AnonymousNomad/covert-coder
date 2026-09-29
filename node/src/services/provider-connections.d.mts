// Type declarations for node/src/services/provider-connections.mjs (strict TS).
import type { ConnectionsViewResponseT } from '../../../common/contracts/connections.ts';

export interface ProviderConnectionsService {
  list(): Promise<ConnectionsViewResponseT>;
  getPreference(): string;
  setPreference(preference: string): string;
  test(connectionId: string, providerModelId?: string): Promise<{ ok: boolean; detail: string }>;
  subscriptionAuth(subscriptionId: string): Promise<{ ok: boolean; command: string; status: string; detail: string }>;
  getHfTokenStored(): { stored: boolean };
  setHfToken(apiKey: string): { stored: true };
  deleteHfToken(): { ok: true };
}

export interface ProviderConnectionsServiceOptions {
  workspace: string;
  providerService: {
    list(): Promise<Array<Record<string, unknown>>>;
    modelSupportState?(providerId: string, modelId: string): 'verified' | 'unknown' | 'unsupported';
  };
  byokService: {
    status(): unknown;
    testProvider(providerId: string): Promise<{ ok: boolean; detail: string }>;
  };
  opencodeBridge?: {
    runTaskStream(options: {
      workspace: string;
      prompt: string;
      providerID: string;
      modelID: string;
      timeoutMs?: number;
      signal?: AbortSignal;
      onDelta: (delta: string) => void;
    }): Promise<{
      text: string;
      delegated_provider: string | null;
      delegated_model: string | null;
      session_id: string;
      server_url: string;
      duration_ms: number;
      version: string | null;
    }>;
  };
  assertExternalEgressAllowed?: () => void;
  onEgress?: (entry: { action: string; url: string; [key: string]: unknown }) => void | Promise<void>;
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
