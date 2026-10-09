import type { ModelManagerResponseT } from '../../../common/contracts/model-access.ts';
import type { ModelAtlasModelEntryT, ModelAtlasRecordResponseT } from '../../../common/contracts/model-atlas.ts';
import type { RoutesResponseT } from '../../../common/contracts/routing.ts';

export interface DossierWorkerCandidate {
  model_id: string;
  display_name: string;
  route_id: string;
  roles: string[];
  evaluation_id: string;
  evidence_refs: string[];
}

// A role recommendation is usable for a proposal only when its dossier is
// current against observed identity, the Model Manager still reports the
// exact artifact qualified/ready, and an exact local route is ready. Display
// names, manifest suggestions, cloud connections and stale records do not
// qualify a worker.
export function currentLocalDossierCandidates(
  manager: ModelManagerResponseT,
  entries: ModelAtlasModelEntryT[],
  records: Map<string, ModelAtlasRecordResponseT>,
  routes: RoutesResponseT
): DossierWorkerCandidate[] {
  const routeById = new Map(routes.routes.map(route => [route.id, route] as const));
  const output: DossierWorkerCandidate[] = [];
  for (const entry of entries) {
    if (entry.evaluation_state !== 'CURRENT' || entry.qualification_state !== 'QUALIFIED' ||
        entry.scope !== 'FULL' || entry.latest_evaluation_id === null || entry.stale_reasons.length > 0) continue;
    const model = manager.models.find(candidate => candidate.identity.canonical_id === entry.model_id);
    const record = records.get(entry.model_id)?.record;
    if (model === undefined || record === undefined || model.readiness !== 'READY' ||
        model.identity.qualification.state !== 'QUALIFIED' || model.identity.qualification.stale_reasons.length > 0 ||
        record.evaluation_id !== entry.latest_evaluation_id || record.model_id !== entry.model_id ||
        record.qualification.state !== 'QUALIFIED' || record.freshness.state !== 'FRESH' ||
        record.freshness.scope !== 'FULL' || record.freshness.stale_reasons.length > 0) continue;

    const qualifiedHash = model.identity.qualification.basis?.artifact_sha256;
    const artifactIsCurrent = model.artifact_ids.some(id => {
      const artifact = manager.artifacts.find(candidate => candidate.id === id);
      return artifact !== undefined && artifact.hash_status === 'VERIFIED' &&
        artifact.observed_sha256 !== null && qualifiedHash !== null && qualifiedHash !== undefined &&
        artifact.observed_sha256.toLowerCase() === qualifiedHash.toLowerCase() &&
        entry.artifact_sha256?.toLowerCase() === artifact.observed_sha256.toLowerCase();
    });
    const routeId = `local:${entry.model_id}`;
    const route = routeById.get(routeId);
    if (!artifactIsCurrent || route === undefined || route.providerType !== 'local' || route.status !== 'ready') continue;

    const roles = record.recommended_roles
      .filter(recommendation => recommendation.evidence_refs.length > 0 &&
        recommendation.evidence_refs.every(ref => record.evidence_refs.includes(ref)))
      .map(recommendation => recommendation.role);
    if (roles.length === 0) continue;
    output.push({
      model_id: entry.model_id,
      display_name: model.identity.display_name,
      route_id: route.id,
      roles,
      evaluation_id: record.evaluation_id,
      evidence_refs: record.evidence_refs
    });
  }
  return output;
}
