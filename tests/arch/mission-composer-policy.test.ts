import { test } from 'node:test';
import assert from 'node:assert/strict';
import { currentLocalDossierCandidates } from '../../browser/src/cockpit/mission-composer-policy.ts';
import type { ModelManagerResponseT } from '../../common/contracts/model-access.ts';
import type { ModelAtlasModelEntryT, ModelAtlasRecordResponseT } from '../../common/contracts/model-atlas.ts';
import type { RoutesResponseT } from '../../common/contracts/routing.ts';

const sha = 'a'.repeat(64);
const evaluatedAt = '2026-10-09T12:00:00.000Z';
const evaluationId = '43a1b6d0-e2c3-4d74-8b98-9c41ed92864b';
const modelId = 'liquid-2.6b';

function fixture() {
  const manager = {
    models: [{
      identity: { canonical_id: modelId, display_name: 'Liquid 2.6B', family: 'liquid', capabilities: [], context_window_tokens: 4096,
        qualification: { state: 'QUALIFIED', basis: { source_revision: 'rev-1', artifact_sha256: sha, runtime_id: 'unsloth', runtime_version: 'v1' }, stale_reasons: [] } },
      artifact_ids: ['artifact:liquid'], readiness: 'READY', availability: 'INSTALLED', compatibility: 'COMPATIBLE',
      recommended_roles: [], execution_selected_roles: []
    }],
    artifacts: [{ id: 'artifact:liquid', model_id: modelId, hash_status: 'VERIFIED', observed_sha256: sha }]
  } as unknown as ModelManagerResponseT;
  const entry: ModelAtlasModelEntryT = {
    model_id: modelId, display_name: 'Liquid display label', artifact_sha256: sha,
    evaluation_state: 'CURRENT', qualification_state: 'QUALIFIED', latest_evaluation_id: evaluationId,
    latest_evaluated_at: evaluatedAt, stale_reasons: [], scope: 'FULL', recommended_roles: ['CODER'], candidate_id: null
  };
  const record = {
    generated_at: evaluatedAt,
    record: {
      evaluation_id: evaluationId, model_id: modelId, display_name: 'Liquid 2.6B',
      recommended_roles: [{ role: 'CODER', reason: 'Verified coding score', evidence_refs: ['harness:run-1'] }],
      evidence_refs: ['harness:run-1'], qualification: { state: 'QUALIFIED', basis: null, stale_reasons: [] },
      freshness: { checked_at: evaluatedAt, state: 'FRESH', scope: 'FULL', stale_reasons: [] }
    }
  } as unknown as ModelAtlasRecordResponseT;
  const routes = { routes: [{ id: `local:${modelId}`, displayName: 'Liquid', providerType: 'local', status: 'ready' }] } as unknown as RoutesResponseT;
  return { manager, entry, record, routes };
}

test('mission lineup accepts only current, fully qualified evidence bound to an exact ready local route', () => {
  const { manager, entry, record, routes } = fixture();
  assert.deepEqual(currentLocalDossierCandidates(manager, [entry], new Map([[modelId, record]]), routes), [{
    model_id: modelId, display_name: 'Liquid 2.6B', route_id: `local:${modelId}`, roles: ['CODER'],
    evaluation_id: evaluationId, evidence_refs: ['harness:run-1']
  }]);

  const stale = { ...entry, evaluation_state: 'STALE' as const };
  const wrongDigest = { ...entry, artifact_sha256: 'b'.repeat(64) };
  const wrongRoute = { routes: [{ ...routes.routes[0]!, providerType: 'cloud' }] } as RoutesResponseT;
  const notReady = { routes: [{ ...routes.routes[0]!, status: 'unverified' }] } as RoutesResponseT;
  assert.deepEqual(currentLocalDossierCandidates(manager, [stale], new Map([[modelId, record]]), routes), []);
  assert.deepEqual(currentLocalDossierCandidates(manager, [wrongDigest], new Map([[modelId, record]]), routes), []);
  assert.deepEqual(currentLocalDossierCandidates(manager, [entry], new Map([[modelId, record]]), wrongRoute), []);
  assert.deepEqual(currentLocalDossierCandidates(manager, [entry], new Map([[modelId, record]]), notReady), []);
});

test('manifest role suggestions and incomplete, stale, or mismatched records never become dossier-backed lineup claims', () => {
  const { manager, entry, record, routes } = fixture();
  const manifestOnly = { ...entry, latest_evaluation_id: null, scope: 'NONE' as const, recommended_roles: ['CODER'] };
  assert.deepEqual(currentLocalDossierCandidates(manager, [manifestOnly], new Map(), routes), []);
  assert.deepEqual(currentLocalDossierCandidates(manager, [entry], new Map(), routes), []);
  const mismatchedRecord = { ...record, record: { ...record.record, evaluation_id: '84e1170b-63d0-4da6-b1f3-44d61b3759ec' } } as ModelAtlasRecordResponseT;
  assert.deepEqual(currentLocalDossierCandidates(manager, [entry], new Map([[modelId, mismatchedRecord]]), routes), []);
});
