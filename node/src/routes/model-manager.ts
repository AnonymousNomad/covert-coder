import { createHash } from 'node:crypto';
import path from 'node:path';
import {
  ModelManagerQuery,
  ModelManagerSnapshotResponse,
  ModelPackInstallRequest,
  ModelPackInstallResponse,
  ModelSelectionRequestInput,
  ModelSelectionRequestResponse,
  type ModelManagerSnapshotResponseT
} from '../../../common/contracts/model-manager.ts';
import type { OperationInput } from '../../../common/security/operation-policy.mjs';
import type { RuntimeAdapterRegistry } from '../services/runtime-adapter.ts';
import type { CloudProviderProbe, LocalDiscoveryResult } from '../services/intelligence-discovery.ts';
import { buildModelManagerSnapshot } from '../services/model-manager-view.ts';
import { createModelPackInstaller, ModelPackError } from '../services/model-packs.ts';
import type { ModelPackInstallPlan } from '../services/model-packs.ts';
import { RouteError, type Route, type RouteContext } from '../server.ts';

export interface ModelManagerRouteOptions {
  workspace: string;
  modelPacksPath: string;
  runtimeAdapters?: RuntimeAdapterRegistry;
  providerProbe?: (workspace: string) => Promise<CloudProviderProbe[]>;
  localDiscovery?: (workspace: string) => Promise<LocalDiscoveryResult>;
  availableRamMb?: number | null;
}

function snapshotOptions(options: ModelManagerRouteOptions, role?: string) {
  return {
    workspace: options.workspace,
    modelPacksPath: options.modelPacksPath,
    ...(options.runtimeAdapters ? { runtimeAdapters: options.runtimeAdapters } : {}),
    ...(options.providerProbe ? { providerProbe: options.providerProbe } : {}),
    ...(options.localDiscovery ? { localDiscovery: options.localDiscovery } : {}),
    ...(options.availableRamMb !== undefined && options.availableRamMb !== null ? { availableRamMb: options.availableRamMb } : {}),
    ...(role ? { role } : {})
  };
}

function modelForSelection(snapshot: ModelManagerSnapshotResponseT, modelId: string) {
  return snapshot.models.find(model => model.id === modelId);
}

function selectionBlocks(snapshot: ModelManagerSnapshotResponseT, modelId: string): string[] {
  const model = modelForSelection(snapshot, modelId);
  if (!model) return ['MODEL_UNAVAILABLE'];
  const blocks: string[] = [];
  if (model.availability === 'UNAVAILABLE') blocks.push('MODEL_UNAVAILABLE');
  if (model.locality === 'LOCAL') {
    if (!model.artifact.label || model.artifact.hash_status === 'mismatch') blocks.push('MISSING_ARTIFACT');
    if (!['INSTALLED', 'DISCOVERED', 'AVAILABLE', 'LOADABLE'].includes(model.availability)) blocks.push('MODEL_UNAVAILABLE');
    const runtimeIdentityMatches = model.runtime_backend?.toLocaleLowerCase() === 'unsloth';
    const runtimeHasModel = snapshot.runtime.loaded_models.some(runtimeModel =>
      runtimeModel.id.toLocaleLowerCase() === model.id.toLocaleLowerCase() ||
      runtimeModel.id.toLocaleLowerCase() === (model.artifact.label ?? '').toLocaleLowerCase()
    );
    if (!snapshot.runtime.registered || snapshot.runtime.health !== 'HEALTHY' || snapshot.runtime.canonical_name !== 'UNSLOTH' || !runtimeIdentityMatches || !runtimeHasModel) {
      blocks.push('RUNTIME_UNAVAILABLE');
    }
  } else {
    const provider = snapshot.providers.find(item => item.id.toLocaleLowerCase() === model.provider.toLocaleLowerCase());
    if (model.provider_state !== 'AUTHENTICATED' || provider?.state !== 'AUTHENTICATED') blocks.push('MISSING_PROVIDER');
  }
  if (model.resource_fit === 'INCOMPATIBLE') blocks.push('RESOURCE_INCOMPATIBLE');
  if (model.qualification.state === 'STALE' || model.qualification.state === 'INVALID_EVIDENCE') blocks.push('QUALIFICATION_INVALID_OR_STALE');
  return [...new Set(blocks)];
}

function mapPackError(error: unknown): RouteError {
  if (error instanceof RouteError) return error;
  if (!(error instanceof ModelPackError)) return new RouteError('INTERNAL', 'The local Model Pack operation failed.');
  return new RouteError(error.code, error.message);
}

// Read-only operator projection. It composes the existing Registry, bounded
// discovery, provider-state probe, and recommendation engine. It never writes
// Registry state, downloads artifacts, probes cloud models, or starts a runtime.
export function routeForModelManager(options: ModelManagerRouteOptions): Route {
  return {
    method: 'GET',
    path: '/api/models/manager',
    query: ModelManagerQuery,
    response: ModelManagerSnapshotResponse,
    handler: async ({ query }) => {
      const params = query as { role?: string; offline?: 'true' | 'false' };
      return buildModelManagerSnapshot({
        ...snapshotOptions(options),
        ...(params.role ? { role: params.role } : {}),
        offline: params.offline === 'true'
      });
    }
  };
}

// The installer accepts only an explicitly selected local artifact. The
// operation descriptor binds its path by digest and the artifact by SHA; the
// path itself never enters Authority metadata or the response projection.
export function routeForModelPackInstall(options: ModelManagerRouteOptions): Route {
  const installer = createModelPackInstaller({ workspace: options.workspace, modelPacksPath: options.modelPacksPath });
  const plannedByRequest = new WeakMap<RouteContext, ModelPackInstallPlan>();
  return {
    method: 'POST',
    path: '/api/models/manager/packs/install',
    body: ModelPackInstallRequest,
    response: ModelPackInstallResponse,
    describeOperation: async (ctx, taskId): Promise<OperationInput> => {
      try {
        const plan = await installer.plan(ctx.body);
        plannedByRequest.set(ctx, plan);
        return {
          workspace: options.workspace,
          taskId,
          kind: 'capability.write',
          args: { body: {
            model_id: plan.model.id,
            destination_filename: plan.destination_filename,
            source_path_digest: plan.source_path_digest,
            artifact_sha256: plan.source_sha256,
            expected_sha256: plan.model.sha256,
            source_repo: plan.model.source_repo,
            source_revision: plan.model.source_revision,
            declared_license: plan.model.license
          } }
        };
      } catch (error) { throw mapPackError(error); }
    },
    handler: async ctx => {
      if (!ctx.execution) throw new RouteError('FORBIDDEN', 'an exact approved Model Pack installation is required');
      const plan = plannedByRequest.get(ctx);
      if (!plan) throw new RouteError('NOT_READY', 'Model Pack approval context is unavailable; prepare the operation again.');
      try { return await installer.installPlan(plan); }
      catch (error) { throw mapPackError(error); }
    }
  };
}

// A selection request is an ephemeral, project-scoped proposal. It is
// deliberately read-class: creating it does not write routing state, evaluate
// Authority, or admit resources. Those remain downstream owners.
export function routeForModelSelectionRequest(options: ModelManagerRouteOptions): Route {
  return {
    method: 'POST',
    path: '/api/models/manager/selection-request',
    body: ModelSelectionRequestInput,
    response: ModelSelectionRequestResponse,
    describeOperation: async ({ body }, taskId): Promise<OperationInput> => {
      const request = ModelSelectionRequestInput.parse(body);
      return {
        workspace: options.workspace,
        taskId,
        kind: 'capability.read',
        args: { body: { requested_role: request.requested_role, selected_model_id: request.selected_model_id, operator_override: request.operator_override } }
      };
    },
    handler: async ({ body }) => {
      const request = ModelSelectionRequestInput.parse(body);
      const snapshot = await buildModelManagerSnapshot(snapshotOptions(options, request.requested_role));
      const model = modelForSelection(snapshot, request.selected_model_id);
      const blockReasons = selectionBlocks(snapshot, request.selected_model_id);
      if (!model || blockReasons.length > 0) {
        return {
          decision: 'SYSTEM_BLOCKED', selection_request: null, block_reasons: blockReasons,
          routing_applied: false, authority_evaluated: false, resource_admission_evaluated: false
        };
      }
      const rankedCandidates = [
        ...snapshot.recommendation.recommended,
        ...snapshot.recommendation.alternatives
      ];
      const rankedCandidate = rankedCandidates.find(item => item.id === model.id);
      const excludedCandidate = snapshot.recommendation.excluded.find(item => item.id === model.id);
      const isTopRecommendation = snapshot.recommendation.recommended[0]?.id === model.id;
      const operatorOverride = request.operator_override || !isTopRecommendation;
      const projectRealPath = await import('node:fs/promises').then(fs => fs.realpath(options.workspace)).catch(() => path.resolve(options.workspace));
      const projectId = createHash('sha256').update(process.platform === 'win32' ? projectRealPath.toLocaleLowerCase() : projectRealPath).digest('hex');
      const selected = {
        requested_role: request.requested_role,
        selected_intelligence_id: model.id,
        artifact_identity: {
          locality: model.locality,
          artifact_id: model.artifact.label ?? model.id,
          revision: model.artifact.revision,
          sha256: model.artifact.hash,
          hash_status: model.artifact.hash_status
        },
        qualification_state: model.qualification.state,
        operator_override: operatorOverride,
        recommendation_evidence: rankedCandidate?.evidence_refs ?? [],
        reason_codes: rankedCandidate?.reasons ?? excludedCandidate?.reasons ?? ['INSUFFICIENT_EVIDENCE'],
        scope: { project_id: `sha256:${projectId}`, mission_id: null },
        created_at: new Date().toISOString()
      };
      return {
        decision: operatorOverride ? 'OPERATOR_SELECTED' : 'RECOMMENDED',
        selection_request: selected,
        block_reasons: [],
        routing_applied: false,
        authority_evaluated: false,
        resource_admission_evaluated: false
      };
    }
  };
}
