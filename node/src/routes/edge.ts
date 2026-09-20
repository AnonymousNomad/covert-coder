import { type Route, type RouteContext, RouteError } from '../server.ts';
import {
  EdgeCapabilitiesResponse,
  EdgeCommandRequest,
  EdgeCommandResponse,
  EdgePairRequest,
  EdgePairResponse,
  EdgePairingChallengeRequest,
  EdgePairingChallengeResponse,
  EdgeStatusResponse,
  VoiceCapabilitiesResponse,
  VoiceCommandRequest,
  VoiceCommandResponse
} from '../../../common/contracts/mobile.ts';
import type { ExecutionAuthority } from '../services/execution-authority.mjs';

export interface RemoteBridgeService {
  snapshot(): Promise<unknown>;
  capabilities(): unknown;
  command(input: unknown): Promise<unknown>;
}

export interface CipherVoiceService {
  capabilities(): unknown;
  classify(transcript: string): { category: 'read' | 'mutate' | 'high-risk' | 'unknown'; command: string | null; response: string };
  command(input: unknown): Promise<unknown>;
}

function descriptor(workspace: string, kind: 'capability.read' | 'capability.execute', body: unknown, taskId: string) {
  return { workspace, taskId, kind, args: { body } };
}

function fail(error: unknown): RouteError {
  if (error instanceof RouteError) return error;
  return new RouteError('CHILD_FAILED', error instanceof Error ? error.message.slice(0, 500) : 'remote bridge failed');
}

function wrap(handler: (ctx: RouteContext) => Promise<unknown> | unknown): (ctx: RouteContext) => Promise<unknown> {
  return async ctx => {
    try {
      return await handler(ctx);
    } catch (error) {
      throw fail(error);
    }
  };
}

function isReadCommand(command: string): boolean {
  return ['status.read', 'resident.read', 'verification.read', 'notifications.read', 'workers.read'].includes(command);
}

export function routesForEdge({ workspace, bridge, voice, authority }: { workspace: string; bridge: RemoteBridgeService; voice: CipherVoiceService; authority?: ExecutionAuthority | undefined }): Route[] {
  return [
    {
      method: 'GET',
      path: '/api/edge/status',
      response: EdgeStatusResponse,
      describeOperation: async (_ctx, taskId) => descriptor(workspace, 'capability.read', {}, taskId),
      handler: wrap(async () => ({ snapshot: await bridge.snapshot() }))
    },
    {
      method: 'GET',
      path: '/api/edge/capabilities',
      response: EdgeCapabilitiesResponse,
      describeOperation: async (_ctx, taskId) => descriptor(workspace, 'capability.read', {}, taskId),
      handler: async () => bridge.capabilities()
    },
    {
      method: 'POST',
      path: '/api/edge/pairing/challenge',
      authorityMode: 'control',
      body: EdgePairingChallengeRequest,
      response: EdgePairingChallengeResponse,
      handler: ctx => {
        if (!authority) throw new RouteError('NOT_READY', 'execution authority is not connected');
        const challenge = authority.control.createPairing(ctx.origin ?? '');
        return { challenge, expires_at: Date.now() + 300_000, single_use: true as const };
      }
    },
    {
      method: 'POST',
      path: '/api/edge/pair',
      authorityMode: 'pair',
      body: EdgePairRequest,
      response: EdgePairResponse,
      handler: async ctx => {
        if (!authority) throw new RouteError('NOT_READY', 'execution authority is not connected');
        return authority.pair((ctx.body as { proof: string }).proof, ctx.origin ?? '');
      }
    },
    {
      method: 'POST',
      path: '/api/edge/command',
      body: EdgeCommandRequest,
      response: EdgeCommandResponse,
      describeOperation: async ({ body }, taskId) => {
        const input = body as { command: string; confirmation?: true };
        return descriptor(workspace, isReadCommand(input.command) ? 'capability.read' : 'capability.execute', body, taskId);
      },
      handler: wrap(async ({ body }) => bridge.command(body))
    },
    {
      method: 'GET',
      path: '/api/edge/voice/capabilities',
      response: VoiceCapabilitiesResponse,
      describeOperation: async (_ctx, taskId) => descriptor(workspace, 'capability.read', {}, taskId),
      handler: async () => voice.capabilities()
    },
    {
      method: 'POST',
      path: '/api/edge/voice/command',
      body: VoiceCommandRequest,
      response: VoiceCommandResponse,
      describeOperation: async ({ body }, taskId) => {
        const input = body as { transcript: string };
        const classified = voice.classify(input.transcript);
        return descriptor(workspace, classified.category === 'read' || classified.category === 'unknown' ? 'capability.read' : 'capability.execute', body, taskId);
      },
      handler: wrap(async ({ body }) => voice.command(body))
    }
  ];
}
