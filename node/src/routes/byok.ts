import { type Route, type RouteContext, RouteError } from '../server.ts';
import type { OperationInput } from '../../../common/security/operation-policy.mjs';
import { createHash } from 'node:crypto';
import {
  ByokStatusResponse,
  ProviderSetRequest,
  IdRequest,
  KeyPutRequest,
  KeyPutResponse,
  RoutingPutRequest,
  ConsentPutRequest,
  ByokTestRequest,
  ByokTestResponse
} from '../../../common/contracts/byok.ts';

// Input-binding digest over the exact UTF-8 secret, plus its exact UTF-16
// code-unit length. The digest and length bind the approved operation to the
// exact credential without ever persisting, logging, or displaying the secret
// itself. The digest is input-binding only: not permission, validation, or proof.
function secretDigest(secret: string): string {
  return createHash('sha256').update(secret, 'utf8').digest('hex');
}

// Provider config is non-secret metadata; bind the canonical fields explicitly.
function providerBinding(provider: Record<string, unknown>): Record<string, unknown> {
  return {
    id: provider.id,
    name: provider.name,
    base_url: provider.base_url,
    api_type: provider.api_type,
    model_id: provider.model_id,
    max_input_tokens: provider.max_input_tokens ?? null,
    tool_calling: provider.tool_calling
  };
}

// Role routing is non-secret configuration; bind the parsed role targets
// so an approval covers exactly the routing that will be applied.
function routingBinding(routing: Record<string, unknown>): Record<string, unknown> {
  const target = (value: unknown): unknown => typeof value === 'string'
    ? value
    : { provider_id: (value as { provider_id?: unknown }).provider_id ?? null, model_id: (value as { model_id?: unknown }).model_id ?? null };
  return { plan: target(routing.plan), act: target(routing.act), utility: target(routing.utility) };
}

type ByokService = {
  status(): unknown;
  setProvider(provider: unknown): unknown;
  deleteProvider(id: string): unknown;
  putKey(providerId: string, apiKey: string): { stored: true };
  deleteKey(providerId: string): unknown;
  getRouting(): unknown;
  setRouting(routing: unknown): unknown;
  setConsent(enabled: boolean): boolean;
  testProvider(providerId: string): Promise<{ ok: boolean; detail: string }>;
};

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
      if (code === 'NOT_SUPPORTED' || code === 'NOT_READY') throw new RouteError(code === 'NOT_READY' ? 'NOT_READY' : 'CHILD_FAILED', message);
      throw new RouteError('CHILD_FAILED', message);
    }
  };
}

export function routesForByok(service: ByokService, workspace: string): Route[] {
  return [
    { method: 'GET', path: '/api/byok/status', response: ByokStatusResponse, handler: wrap(async () => service.status()) },
    { method: 'PUT', path: '/api/byok/providers/set', body: ProviderSetRequest, response: ByokStatusResponse.pick({ providers: true }), describeOperation: async ({ body }, taskId): Promise<OperationInput> => {
      const request = body as { provider: Record<string, unknown> };
      return { workspace, taskId, kind: 'capability.write', args: { body: { provider: providerBinding(request.provider) } } };
    }, handler: wrap(async ({ body }) => {
      const request = body as { provider: Record<string, unknown> };
      const entry = service.setProvider(request.provider);
      return { providers: [entry] };
    }) },
    { method: 'DELETE', path: '/api/byok/providers/delete', body: IdRequest, response: ByokStatusResponse.pick({ providers: true }), describeOperation: async ({ body }, taskId): Promise<OperationInput> => {
      const request = body as { id: string };
      return { workspace, taskId, kind: 'capability.write', args: { body: { id: request.id } } };
    }, handler: wrap(async ({ body }) => {
      const request = body as { id: string };
      service.deleteProvider(request.id);
      const status = service.status() as { providers: unknown[] };
      return { providers: status.providers };
    }) },
    { method: 'PUT', path: '/api/byok/key', body: KeyPutRequest, response: KeyPutResponse, describeOperation: async ({ body }, taskId): Promise<OperationInput> => {
      const request = body as { provider_id: string; api_key: string };
      return { workspace, taskId, kind: 'capability.write', args: { body: { provider_id: request.provider_id, keyDigest: secretDigest(request.api_key), keyLength: request.api_key.length } } };
    }, handler: wrap(async ({ body }) => {
      const request = body as { provider_id: string; api_key: string };
      return service.putKey(request.provider_id, request.api_key);
    }) },
    { method: 'DELETE', path: '/api/byok/key/delete', body: IdRequest, response: ByokStatusResponse.pick({ providers: true }), describeOperation: async ({ body }, taskId): Promise<OperationInput> => {
      const request = body as { id: string };
      return { workspace, taskId, kind: 'capability.write', args: { body: { id: request.id } } };
    }, handler: wrap(async ({ body }) => {
      const request = body as { id: string };
      service.deleteKey(request.id);
      const status = service.status() as { providers: unknown[] };
      return { providers: status.providers };
    }) },
    { method: 'PUT', path: '/api/byok/routing', body: RoutingPutRequest, response: ByokStatusResponse.pick({ routing: true }), describeOperation: async ({ body }, taskId): Promise<OperationInput> => {
      const request = body as { routing: Record<string, unknown> };
      return { workspace, taskId, kind: 'capability.write', args: { body: { routing: routingBinding(request.routing) } } };
    }, handler: wrap(async ({ body }) => {
      const request = body as { routing: unknown };
      service.setRouting(request.routing);
      return { routing: service.getRouting() };
    }) },
    { method: 'PUT', path: '/api/byok/consent', body: ConsentPutRequest, response: ByokStatusResponse.pick({ consent_enabled: true }), describeOperation: async ({ body }, taskId): Promise<OperationInput> => {
      const request = body as { enabled: boolean };
      return { workspace, taskId, kind: 'capability.write', args: { body: { enabled: request.enabled } } };
    }, handler: wrap(async ({ body }) => {
      const request = body as { enabled: boolean };
      return { consent_enabled: service.setConsent(request.enabled) };
    }) },
    { method: 'POST', path: '/api/byok/test', body: ByokTestRequest, response: ByokTestResponse, describeOperation: async ({ body }, taskId): Promise<OperationInput> => {
      const request = body as { provider_id: string };
      return { workspace, taskId, kind: 'capability.external', args: { body: { provider_id: request.provider_id } } };
    }, handler: wrap(async ({ body }) => {
      const request = body as { provider_id: string };
      return await service.testProvider(request.provider_id);
    }) }
  ];
}
