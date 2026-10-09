import type { HubSearchResponseT, ModelManifestT } from '../../common/contracts/modelhub.ts';

export interface HubSearchResult {
  models: Array<{ repo_id: string; downloads: number; likes: number; tags: string[] }>;
}

export interface HubDownloadJobSnapshot {
  job_id: string;
  repo_id: string;
  revision: string | null;
  filename: string;
  status: 'running' | 'done' | 'error' | 'cancelled';
  bytes_done: number;
  bytes_total: number | null;
  error: string | null;
}

export interface HubEvent {
  event: 'progress' | 'done' | 'error' | 'cancelled';
  job_id: string;
  bytes_done?: number;
  bytes_total?: number | null;
  eta_s?: number | null;
  filename?: string;
  manifest?: ModelManifestT;
  error?: string;
}

export interface StartDownloadArgs {
  repo_id: string;
  filename: string;
  revision?: string;
  expected_size?: number;
  expected_sha256?: string;
  quant_label?: string | null;
  urlTemplate?: string;
}

export interface BeginDownloadArgs {
  repo_id: string;
  filename: string;
  revision: string;
  expected_size: number;
  expected_sha256: string;
  quant_label?: string | null;
}

export declare function createHubService(options: {
  workspace: string;
  modelsDir: string;
  allowExternalModelsDir?: boolean;
  fetchImpl?: typeof fetch;
  onEvent?: (event: HubEvent) => void;
  authorization?: () => Promise<string | null>;
  assertExternalEgressAllowed?: () => void;
  metadataTimeoutMs?: number;
  downloadIdleTimeoutMs?: number;
}): {
  workspace: string;
  search(q: string, sort?: string, limit?: number): Promise<HubSearchResult>;
  listRepoFiles(repoId: string): Promise<{ repo_id: string; revision: string; files: Array<{ filename: string; size: number | null; lfs_sha256: string | null }> }>;
  startDownload(args: StartDownloadArgs): Promise<void>;
  beginDownload(args: BeginDownloadArgs): { job_id: string };
  cancel(jobId: string): Promise<{ cancelled: boolean }>;
  listDownloads(): HubDownloadJobSnapshot[];
  listEvents(): HubEvent[];
  importFromPath(sourcePath: string): Promise<{ manifest: ModelManifestT }>;
  close(): void;
};

export type { HubSearchResponseT };
