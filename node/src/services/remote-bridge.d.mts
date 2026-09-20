import type { EdgeCommandResponseT, EdgeSnapshotT } from '../../../common/contracts/mobile.ts';

export interface RemoteBridgeService {
  snapshot(): Promise<EdgeSnapshotT>;
  capabilities(): unknown;
  command(input: unknown): Promise<EdgeCommandResponseT>;
}

export declare function createRemoteBridgeService(options?: {
  workspace?: string;
  resident?: unknown;
  workflow?: unknown;
  tasks?: unknown;
  notifications?: unknown;
  modelRuntime?: unknown;
  clock?: () => number;
}): RemoteBridgeService;
