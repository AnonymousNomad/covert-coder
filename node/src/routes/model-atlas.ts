import { z } from 'zod';
import {
  ModelAtlasCandidateResponse,
  ModelAtlasModelsResponse,
  ModelAtlasRecordResponse,
  type ModelAtlasModelsResponseT
} from '../../../common/contracts/model-atlas.ts';
import type { ModelManagerResponseT } from '../../../common/contracts/model-access.ts';
import { type Route, type RouteContext, RouteError } from '../server.ts';
import type { AtlasFreshnessBasis } from '../services/model-atlas.ts';
import type { ModelAtlasRead } from '../services/model-atlas-read.ts';

const ModelQuery = z.strictObject({ model_id: z.string().min(1).max(240) });

export interface ModelAtlasReadRouteOptions {
  atlas: ModelAtlasRead;
  manager: { snapshot(): Promise<ModelManagerResponseT> };
}

function currentModels(snapshot: ModelManagerResponseT): Array<{
  model_id: string;
  display_name: string;
  artifact_sha256: string | null;
  basis: AtlasFreshnessBasis;
  recommended_roles: string[];
}> {
  const artifacts = new Map(snapshot.artifacts.map(artifact => [artifact.id, artifact] as const));
  return snapshot.models.map(model => {
    const artifact = model.artifact_ids
      .map(id => artifacts.get(id))
      .find((entry): entry is NonNullable<typeof entry> => entry !== undefined);
    const basis: AtlasFreshnessBasis = {
      // A historical qualification basis is not a current observation. If
      // Model Manager cannot currently observe the source revision, keep it
      // unknown so Atlas freshness can fail closed.
      source_revision: artifact?.revision ?? null,
      // An expected catalog digest is not an observation. Only the actual
      // artifact/runtime observation can establish the current dossier basis.
      artifact_sha256: artifact?.observed_sha256 ?? null,
      quantization: artifact?.quantization ?? null,
      runtime_id: snapshot.runtime.configured_runtime_id,
      // Runtime version is intentionally unknown until a live version
      // observation is exposed by the canonical Model Manager projection.
      runtime_version: null,
      harness_version: null,
      benchmark_id: null,
      benchmark_version: null,
      grader_version: null,
      inference_config_digest: null,
      machine_profile_digest: null,
      execution_node: null
    };
    return {
      model_id: model.identity.canonical_id,
      display_name: model.identity.display_name,
      artifact_sha256: basis.artifact_sha256,
      basis,
      recommended_roles: model.recommended_roles
    };
  });
}

function findCurrentModel(models: ReturnType<typeof currentModels>, modelId: string) {
  return models.find(model => model.model_id === modelId) ?? null;
}

export function routesForModelAtlas(options: ModelAtlasReadRouteOptions): Route[] {
  const models = async () => currentModels(await options.manager.snapshot());
  const currentModelIds = async () => new Set((await models()).map(model => model.model_id));

  return [
    {
      method: 'GET',
      path: '/api/models/atlas',
      capabilityPolicy: { owner: 'ModelAtlas', operation: 'capability.read' },
      response: ModelAtlasModelsResponse,
      handler: async (): Promise<ModelAtlasModelsResponseT> => {
        const inputs = await models();
        return options.atlas.modelsResponse(inputs);
      }
    },
    {
      method: 'GET',
      path: '/api/models/atlas/record',
      capabilityPolicy: { owner: 'ModelAtlas', operation: 'capability.read' },
      query: ModelQuery,
      response: ModelAtlasRecordResponse,
      handler: async (context: RouteContext) => {
        const query = ModelQuery.parse(context.query);
        const model = findCurrentModel(await models(), query.model_id);
        if (model === null) throw new RouteError('NOT_FOUND', 'model is not in the current canonical Model Manager inventory');
        const result = await options.atlas.recordResponse(model.model_id, model.basis);
        if (result === null) throw new RouteError('NOT_FOUND', 'no Model Atlas evaluation exists for this model identity');
        return result;
      }
    },
    {
      method: 'GET',
      path: '/api/models/atlas/candidate',
      capabilityPolicy: { owner: 'ModelAtlas', operation: 'capability.read' },
      query: ModelQuery,
      response: ModelAtlasCandidateResponse,
      handler: async (context: RouteContext) => {
        const query = ModelQuery.parse(context.query);
        if (!(await currentModelIds()).has(query.model_id)) {
          throw new RouteError('NOT_FOUND', 'model is not in the current canonical Model Manager inventory');
        }
        return options.atlas.candidateResponse(query.model_id);
      }
    }
  ];
}
