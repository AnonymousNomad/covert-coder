import { type Route, type RouteContext, RouteError } from '../server.ts';
import {
  AndroidArtifactQuery,
  AndroidArtifactResponse,
  AndroidBuildRequest,
  AndroidBuildResponse,
  AndroidDeviceListResponse,
  AndroidEnvironmentResponse,
  AndroidInstallRequest,
  AndroidInstallResponse,
  AndroidLaunchRequest,
  AndroidLaunchResponse,
  AndroidLogcatRequest,
  AndroidLogcatResponse,
  AndroidProjectQuery,
  AndroidProjectResponse,
  AndroidStopResponse,
  AppleBuildRequest,
  AppleBuildResponse,
  AppleEnvironmentResponse,
  AppleProjectQuery,
  AppleProjectResponse,
  MobilePluginResponseEnvelope
} from '../../../common/contracts/mobile.ts';
import { MobileProductionError } from '../services/mobile-production.mjs';

export interface MobileProductionService {
  plugin(): unknown;
  androidEnvironment(): Promise<unknown>;
  inspectAndroidProject(projectPath: string): Promise<unknown>;
  buildDebugApk(input: unknown): Promise<unknown>;
  artifactFromFile(path: string): Promise<unknown>;
  listDevices(): Promise<unknown>;
  installApk(input: unknown): Promise<unknown>;
  launchApp(input: unknown): Promise<unknown>;
  stopApp(input: unknown): Promise<unknown>;
  logcat(input: unknown): Promise<unknown>;
  appleEnvironment(): Promise<unknown>;
  inspectAppleProject(projectPath: string): Promise<unknown>;
  appleBuild(input: unknown): Promise<unknown>;
}

function mapError(error: unknown): RouteError {
  if (error instanceof RouteError) return error;
  if (error instanceof MobileProductionError) {
    const code = error.code === 'FORBIDDEN' || error.code === 'NOT_READY' || error.code === 'NOT_FOUND' || error.code === 'BAD_REQUEST' ? error.code : 'CHILD_FAILED';
    return new RouteError(code, error.message, error.detail);
  }
  return new RouteError('CHILD_FAILED', error instanceof Error ? error.message.slice(0, 500) : 'mobile production adapter failed');
}

function wrap(handler: (ctx: RouteContext) => Promise<unknown> | unknown): (ctx: RouteContext) => Promise<unknown> {
  return async ctx => {
    try {
      return await handler(ctx);
    } catch (error) {
      throw mapError(error);
    }
  };
}

function descriptor(workspace: string, kind: 'capability.read' | 'capability.execute', body: unknown, taskId: string) {
  return { workspace, taskId, kind, args: { body } };
}

export function routesForMobileProduction(service: MobileProductionService, workspace: string): Route[] {
  return [
    {
      method: 'GET',
      path: '/api/mobile/plugin',
      response: MobilePluginResponseEnvelope,
      describeOperation: async (_ctx, taskId) => descriptor(workspace, 'capability.read', {}, taskId),
      handler: async () => ({ plugin: service.plugin() })
    },
    {
      method: 'GET',
      path: '/api/mobile/android/environment',
      response: AndroidEnvironmentResponse,
      describeOperation: async (_ctx, taskId) => descriptor(workspace, 'capability.read', {}, taskId),
      handler: wrap(async () => ({ environment: await service.androidEnvironment() }))
    },
    {
      method: 'GET',
      path: '/api/mobile/android/project',
      query: AndroidProjectQuery,
      response: AndroidProjectResponse,
      describeOperation: async ({ query }, taskId) => descriptor(workspace, 'capability.read', query, taskId),
      handler: wrap(async ({ query }) => ({ project: await service.inspectAndroidProject(String(query.project_path)) }))
    },
    {
      method: 'GET',
      path: '/api/mobile/android/devices',
      response: AndroidDeviceListResponse,
      describeOperation: async (_ctx, taskId) => descriptor(workspace, 'capability.read', {}, taskId),
      handler: wrap(async () => service.listDevices())
    },
    {
      method: 'POST',
      path: '/api/mobile/android/build-debug',
      body: AndroidBuildRequest,
      response: AndroidBuildResponse,
      describeOperation: async ({ body }, taskId) => descriptor(workspace, 'capability.execute', body, taskId),
      handler: wrap(async ({ body }) => service.buildDebugApk(body))
    },
    {
      method: 'GET',
      path: '/api/mobile/android/artifact',
      query: AndroidArtifactQuery,
      response: AndroidArtifactResponse,
      describeOperation: async ({ query }, taskId) => descriptor(workspace, 'capability.read', query, taskId),
      handler: wrap(async ({ query }) => ({ artifact: await service.artifactFromFile(String(query.artifact_path)) }))
    },
    {
      method: 'POST',
      path: '/api/mobile/android/install',
      body: AndroidInstallRequest,
      response: AndroidInstallResponse,
      describeOperation: async ({ body }, taskId) => descriptor(workspace, 'capability.execute', body, taskId),
      handler: wrap(async ({ body }) => service.installApk(body))
    },
    {
      method: 'POST',
      path: '/api/mobile/android/launch',
      body: AndroidLaunchRequest,
      response: AndroidLaunchResponse,
      describeOperation: async ({ body }, taskId) => descriptor(workspace, 'capability.execute', body, taskId),
      handler: wrap(async ({ body }) => service.launchApp(body))
    },
    {
      method: 'POST',
      path: '/api/mobile/android/stop',
      body: AndroidLaunchRequest,
      response: AndroidStopResponse,
      describeOperation: async ({ body }, taskId) => descriptor(workspace, 'capability.execute', body, taskId),
      handler: wrap(async ({ body }) => service.stopApp(body))
    },
    {
      method: 'POST',
      path: '/api/mobile/android/logcat',
      body: AndroidLogcatRequest,
      response: AndroidLogcatResponse,
      describeOperation: async ({ body }, taskId) => descriptor(workspace, 'capability.read', body, taskId),
      handler: wrap(async ({ body }) => service.logcat(body))
    },
    {
      method: 'GET',
      path: '/api/mobile/apple/environment',
      response: AppleEnvironmentResponse,
      describeOperation: async (_ctx, taskId) => descriptor(workspace, 'capability.read', {}, taskId),
      handler: wrap(async () => ({ environment: await service.appleEnvironment() }))
    },
    {
      method: 'GET',
      path: '/api/mobile/apple/project',
      query: AppleProjectQuery,
      response: AppleProjectResponse,
      describeOperation: async ({ query }, taskId) => descriptor(workspace, 'capability.read', query, taskId),
      handler: wrap(async ({ query }) => ({ project: await service.inspectAppleProject(String(query.project_path)) }))
    },
    {
      method: 'POST',
      path: '/api/mobile/apple/build',
      body: AppleBuildRequest,
      response: AppleBuildResponse,
      describeOperation: async ({ body }, taskId) => descriptor(workspace, 'capability.execute', body, taskId),
      handler: wrap(async ({ body }) => service.appleBuild(body))
    }
  ];
}
