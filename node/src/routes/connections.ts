import { type Route, type RouteContext, RouteError } from '../server.ts';
import type { OperationInput } from '../../../common/security/operation-policy.mjs';
import { createHash } from 'node:crypto';
import {
  ConnectionsViewResponse,
  ConnectionsPreferencePutRequest,
  ConnectionsTestRequest,
  ConnectionsTestResponse,
  HfTokenPutRequest,
  HfTokenPutResponse,
  HfTokenDeleteRequest,
  HfTokenDeleteResponse,
  ConnectionsAuthRequest,
  ConnectionsAuthResponse,
  type RoutingPreferenceT
} from '../../../common/contracts/connections.ts';

// Input-binding digest over the exact UTF-8 secret, plus its exact UTF-16
// code-unit length (same doctrine as routes/byok.ts). Nothing but the digest
// and length is ever remembered — never the credential itself.
function secretDigest(secret: string): string {
  return createHash('sha256').update(secret, 'utf8').digest('hex');
}

interface ConnectionsService {
  list(): Promise<unknown>;
  getPreference(): string;
  setPreference(preference: string): string;
  test(connectionId: string): Promise<{ ok: boolean; detail: string }>;
  subscriptionAuth(subscriptionId: string): Promise<{ ok: boolean; command: string; status: string; detail: string }>;
  getHfTokenStored(): { stored: boolean };
  setHfToken(apiKey: string): { stored: true };
  deleteHfToken(): { ok: true };
}

function wrap(handler: (ctx: RouteContext) => Promise<unknown> | unknown): (ctx: RouteContext) => Promise<unknown> {
  return async (ctx: RouteContext) => {
    try {
      return await handler(ctx);
    } catch (error) {
      if (error instanceof RouteError) throw error;
      const code = (error as { code?: string })?.code;
      const message = String((error as Error)?.message ?? error).slice(0, 300);
      if (code === 'NOT_FOUND') throw new RouteError('NOT_FOUND', message);
      if (code === 'FORBIDDEN') throw new RouteError('FORBIDDEN', message);
      if (code === 'NOT_READY' || code === 'NOT_SUPPORTED') throw new RouteError('NOT_READY', message);
      throw new RouteError('CHILD_FAILED', message);
    }
  };
}

export function routesForConnections(service: ConnectionsService, workspace: string): Route[] {
  return [
    // Read-only unified view. Central capability.read (see HTTP_POLICY); the
    // aggregation never performs egress, never reads secrets, and reports only
    // truthful derived states.
    { method: 'GET', path: '/api/connections', response: ConnectionsViewResponse, handler: wrap(async () => service.list()) },
    { method: 'PUT', path: '/api/connections/preference', body: ConnectionsPreferencePutRequest, response: ConnectionsViewResponse.pick({ preference: true }), describeOperation: async ({ body }, taskId): Promise<OperationInput> => {
      const request = body as { preference: RoutingPreferenceT };
      return { workspace, taskId, kind: 'capability.write', args: { body: { preference: request.preference } } };
    }, handler: wrap(async ({ body }) => {
      const request = body as { preference: RoutingPreferenceT };
      return { preference: service.setPreference(request.preference) };
    }) },
    { method: 'POST', path: '/api/connections/test', body: ConnectionsTestRequest, response: ConnectionsTestResponse, describeOperation: async ({ body }, taskId): Promise<OperationInput> => {
      const request = body as { connection_id: string };
      return { workspace, taskId, kind: 'capability.external', args: { body: { connection_id: request.connection_id } } };
    }, handler: wrap(async ({ body }) => {
      const request = body as { connection_id: string };
      return await service.test(request.connection_id);
    }) },
    { method: 'PUT', path: '/api/connections/hf-token', body: HfTokenPutRequest, response: HfTokenPutResponse, describeOperation: async ({ body }, taskId): Promise<OperationInput> => {
      const request = body as { api_key: string };
      return { workspace, taskId, kind: 'capability.write', args: { body: { keyDigest: secretDigest(request.api_key), keyLength: request.api_key.length } } };
    }, handler: wrap(async ({ body }) => {
      const request = body as { api_key: string };
      return service.setHfToken(request.api_key);
    }) },
    { method: 'DELETE', path: '/api/connections/hf-token', body: HfTokenDeleteRequest, response: HfTokenDeleteResponse, describeOperation: async ({ body }, taskId): Promise<OperationInput> => {
      void body;
      return { workspace, taskId, kind: 'capability.write', args: { body: { action: 'delete-hf-token' } } };
    }, handler: wrap(async () => service.deleteHfToken()) },
    { method: 'POST', path: '/api/connections/subscription/auth', body: ConnectionsAuthRequest, response: ConnectionsAuthResponse, describeOperation: async ({ body }, taskId): Promise<OperationInput> => {
      const request = body as { subscription_id: string };
      return { workspace, taskId, kind: 'capability.execute', args: { body: { subscription_id: request.subscription_id } } };
    }, handler: wrap(async ({ body }) => {
      const request = body as { subscription_id: string };
      return await service.subscriptionAuth(request.subscription_id);
    }) }
  ];
}
