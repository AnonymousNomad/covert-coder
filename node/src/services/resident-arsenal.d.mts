// Type declarations for node/src/services/resident-arsenal.mjs
// (Resident Awareness Layer, Slice 1 — canonical arsenal projection.)

export declare const ARSENAL_SCHEMA_VERSION: string;

export declare const AVAILABILITY: Readonly<{
  READY: 'READY';
  RUNNING: 'RUNNING';
  STARTING: 'STARTING';
  STOPPED: 'STOPPED';
  DEGRADED: 'DEGRADED';
  UNAVAILABLE: 'UNAVAILABLE';
  DISCONNECTED: 'DISCONNECTED';
  NOT_CONFIGURED: 'NOT_CONFIGURED';
  NOT_INSTALLED: 'NOT_INSTALLED';
  CONNECTING: 'CONNECTING';
  UNKNOWN: 'UNKNOWN';
}>;

export declare const ARSENAL_SOURCES: Readonly<Record<string, string>>;

export interface ArsenalDescriptor {
  id: string;
  kind: 'SKILL' | 'MODEL' | 'PROVIDER' | 'PLUGIN' | 'WORKFLOW' | 'TOOL' | 'VERIFICATION' | 'DEVICE' | 'RUNTIME';
  availability: string;
  location?: 'local' | 'cloud' | 'device';
  category?: string;
  capabilities?: string[];
  roles?: string[];
  context_limit?: number;
  read_only?: boolean;
}

export interface ArsenalMeasurements {
  note: string;
  characters: number;
  estimated_tokens: number;
  summary_tokens: number;
  by_kind: Record<string, { count: number; characters: number; estimated_tokens: number }>;
}

export interface ArsenalProjection {
  schema_version: string;
  generated_at: string;
  note: string;
  availability_values: string[];
  sources: Record<string, string>;
  descriptors: ArsenalDescriptor[];
  summary: {
    total: number;
    by_kind: Record<string, number>;
    by_availability: Record<string, number>;
  };
  unsupported: {
    classes: Array<{ id: string; reason: string }>;
    fields: Array<{ id: string; reason: string }>;
  };
  warnings: string[];
  measurements: ArsenalMeasurements;
}

export interface ArsenalHardwareFacts {
  totalRamBytes?: number;
  freeRamBytes?: number;
  logicalCpus?: number;
  vramBytes?: number;
  freeVramBytes?: number;
  vramSource?: string;
}

export interface ArsenalProbes {
  hardware?: () => Promise<ArsenalHardwareFacts> | ArsenalHardwareFacts;
  providerStatus?: (providerId: string) => Promise<string | undefined> | string | undefined;
  modelStatus?: (modelId: string) => Promise<string | undefined> | string | undefined;
  runtimeProviders?: { list(): Promise<Array<{ id: string; state?: string }>> };
}

export declare function buildArsenalProjection(options: {
  workspace: string;
  repoRoot?: string;
  probes?: ArsenalProbes;
}): Promise<ArsenalProjection>;
