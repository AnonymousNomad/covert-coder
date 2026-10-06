import {
  type AtlasRecordedEvaluationT,
  type ModelAtlasCandidateResponseT,
  type ModelAtlasModelsResponseT,
  type ModelAtlasRecordResponseT
} from '../../../common/contracts/model-atlas.ts';
import type { AtlasFreshnessBasis, ModelAtlas } from './model-atlas.ts';

// Stable read contract for future Model Catalog / Model Lab consumers. It is a
// projection over canonical Atlas records: consumers ask what exists, what was
// evaluated, how current the evidence is, and what roles are supported, without
// knowing Harness internals.

export interface AtlasReadModelInput {
  model_id: string;
  display_name: string;
  artifact_sha256: string | null;
  basis: AtlasFreshnessBasis;
  recommended_roles?: string[];
}

export interface ModelAtlasReadOptions {
  atlas: ModelAtlas;
  now?: () => Date;
}

export function createModelAtlasRead(options: ModelAtlasReadOptions) {
  const now = options.now ?? (() => new Date());

  async function modelsResponse(models: AtlasReadModelInput[]): Promise<ModelAtlasModelsResponseT> {
    // One store scan for the whole list; per-model semantics come from the
    // canonical state composition in the store.
    const basisByModel = new Map(models.map(model => [model.model_id, model.basis]));
    const states = await options.atlas.statesFor(models.map(model => model.model_id), modelId => basisByModel.get(modelId)!);
    const entries: ModelAtlasModelsResponseT['models'] = [];
    for (const model of models) {
      const state = states.get(model.model_id);
      if (state === undefined) continue;
      const candidate = await options.atlas.readCandidate(model.model_id);
      const latest: AtlasRecordedEvaluationT | null = state.latest;
      entries.push({
        model_id: model.model_id,
        display_name: model.display_name,
        artifact_sha256: model.artifact_sha256,
        evaluation_state: state.state,
        qualification_state: latest?.qualification.state ?? null,
        latest_evaluation_id: latest?.evaluation_id ?? null,
        latest_evaluated_at: latest?.evaluated_at ?? null,
        stale_reasons: state.stale_reasons,
        scope: state.scope,
        recommended_roles: latest !== null && latest.recommended_roles.length > 0
          ? latest.recommended_roles.map(recommendation => recommendation.role)
          : model.recommended_roles ?? [],
        candidate_id: candidate?.candidate_id ?? null
      });
    }
    return { generated_at: now().toISOString(), models: entries };
  }

  async function recordResponse(modelId: string, basis: AtlasFreshnessBasis): Promise<ModelAtlasRecordResponseT | null> {
    const latest = await options.atlas.latestFor(modelId, basis);
    if (latest === null) return null;
    const history = await options.atlas.historyFor(modelId);
    return { generated_at: now().toISOString(), record: latest, history };
  }

  async function candidateResponse(modelId: string): Promise<ModelAtlasCandidateResponseT> {
    const candidate = await options.atlas.readCandidate(modelId);
    return { generated_at: now().toISOString(), candidate };
  }

  return { modelsResponse, recordResponse, candidateResponse };
}

export type ModelAtlasRead = ReturnType<typeof createModelAtlasRead>;
