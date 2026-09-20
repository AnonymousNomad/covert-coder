import type {
  AndroidBuildResponseT,
  AndroidDeviceListResponseT,
  AndroidProjectT,
  MobileArtifactT,
  MobilePluginResponseT
} from '../../../common/contracts/mobile.ts';

export declare class MobileProductionError extends Error {
  readonly code: string;
  readonly detail: unknown;
  constructor(code: string, message: string, detail?: unknown);
}

export interface MobileProductionService {
  plugin(): MobilePluginResponseT;
  androidEnvironment(): Promise<unknown>;
  inspectAndroidProject(projectPath: string): Promise<AndroidProjectT>;
  buildDebugApk(input: unknown): Promise<AndroidBuildResponseT>;
  artifactFromFile(artifactPath: string, options?: Record<string, unknown>): Promise<MobileArtifactT>;
  listDevices(): Promise<AndroidDeviceListResponseT>;
  installApk(input: unknown): Promise<unknown>;
  launchApp(input: unknown): Promise<unknown>;
  stopApp(input: unknown): Promise<unknown>;
  logcat(input: unknown): Promise<unknown>;
  appleEnvironment(): Promise<unknown>;
  inspectAppleProject(projectPath: string): Promise<unknown>;
  appleBuild(input: unknown): Promise<unknown>;
}

export declare function createMobileProductionService(options?: {
  workspace?: string;
  commandRunner?: (file: string, args: string[], options?: Record<string, unknown>) => Promise<{ code: number; stdout: string; stderr: string }>;
  clock?: () => number;
}): MobileProductionService;
