import { createHash } from 'node:crypto';
import { type Route, type RouteContext, RouteError } from '../server.ts';
import type { OperationInput } from '../../../common/security/operation-policy.mjs';
import {
  CreationStudioListResponse,
  CreationStudioPutRequest,
  CreationStudioRecord
} from '../../../common/contracts/creation-studio.ts';

type CreationStudioService = {
  list(): unknown;
  put(input: unknown): unknown;
};

function digest(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex');
}

function wrap(handler: (ctx: RouteContext) => Promise<unknown> | unknown) {
  return async (ctx: RouteContext): Promise<unknown> => {
    try {
      return await handler(ctx);
    } catch (error) {
      if (error instanceof RouteError) throw error;
      const code = (error as { code?: string })?.code;
      const message = String((error as Error)?.message ?? error).slice(0, 300);
      if (code === 'CONFLICT') throw new RouteError('CONFLICT', message);
      throw new RouteError('CHILD_FAILED', message);
    }
  };
}

export function routesForCreationStudio(service: CreationStudioService, workspace: string): Route[] {
  return [
    {
      method: 'GET',
      path: '/api/creation-studio/productions',
      response: CreationStudioListResponse,
      handler: wrap(() => service.list())
    },
    {
      method: 'PUT',
      path: '/api/creation-studio/production',
      body: CreationStudioPutRequest,
      response: CreationStudioRecord,
      describeOperation: async ({ body }, taskId): Promise<OperationInput> => {
        const input = CreationStudioPutRequest.parse(body);
        return {
          workspace,
          taskId,
          kind: 'capability.write',
          args: {
            body: {
              production_id: input.production.production_id,
              expected_revision: input.expected_revision,
              input_digest_sha256: digest(input),
              scene_count: input.production.scenes.length,
              bible_entry_count: input.bible_entries.length,
              continuity_entry_count: input.continuity_entries.length
            }
          }
        };
      },
      handler: wrap(({ body }) => service.put(CreationStudioPutRequest.parse(body)))
    }
  ];
}
