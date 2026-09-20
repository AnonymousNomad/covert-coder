import type { ReleaseManifestT } from '../../../common/contracts/mobile.ts';

export interface ConciergeService {
  manifest(): Promise<ReleaseManifestT>;
  resolve(input: unknown): Promise<unknown>;
}

export declare function createConciergeService(options?: { repoRoot?: string; manifestPath?: string }): ConciergeService;
