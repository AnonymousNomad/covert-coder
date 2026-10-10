import { createHash } from 'node:crypto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import type { ConnectionsViewResponseT } from '../../common/contracts/connections.ts';
import { presentModelQualification } from '../../browser/src/panels/model-qualification-presentation.ts';
import { createModelManagerView, type ModelQualificationPreflightObservation } from '../../node/src/services/model-manager-view.ts';

const HASH_A = 'a'.repeat(64);

function emptyConnections(routedModelId: string | null = null, modelIds: string[] = []): ConnectionsViewResponseT {
  return {
    consensus: 'local-first',
    routed_roles: {
      planner: 'local',
      coder: routedModelId === null ? 'local' : { provider_id: 'local', model_id: routedModelId },
      reviewer: 'local',
      utility: 'local'
    },
    preference: 'local-first',
    connections: modelIds.length === 0 ? [] : [{
      id: 'local-runtime',
      provider_id: 'local',
      name: 'Local runtime fixture',
      kind: 'local-runtime',
      status: 'connected',
      detail: 'synthetic test connection',
      capabilities: ['chat'],
      routing_available: true,
      account_label: 'self-hosted',
      access: {
        authentication_mode: 'none',
        authentication_configured: false,
        credential_source: { id: null, kind: 'local_none', configuration_state: 'not_required' },
        health: 'healthy',
        execution_adapters: ['local-runtime'],
        model_refs: modelIds.map(modelId => ({ model_id: modelId, provider_model_id: modelId, model_support_state: 'verified' })),
        external_egress_required: false,
        operator_setup_required: false,
        setup_state: 'ready'
      }
    }]
  };
}

async function createFixture(options: {
  artifact?: boolean;
  manifestModel?: boolean;
  preflight?: () => Promise<ModelQualificationPreflightObservation | null>;
  runtimeEntries?: Array<Record<string, unknown>>;
  runtimeModels?: Array<Record<string, unknown>>;
  connections?: ConnectionsViewResponseT;
  runtimeObservation?: Record<string, unknown>;
}) {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'covert-model-gate-'));
  const modelDir = path.join(workspace, 'models');
  await fs.mkdir(modelDir, { recursive: true });
  if (options.artifact) await fs.writeFile(path.join(modelDir, 'liquid-fixture-Q4_K_M.gguf'), 'synthetic fixture bytes only');
  if (options.manifestModel) {
    await fs.writeFile(path.join(workspace, 'manifest.json'), JSON.stringify({ models: [{
      id: 'liquid-fixture', name: 'Liquid fixture', file: 'liquid-fixture.gguf', format: 'GGUF', sha256: HASH_A
    }] }));
  }
  let runtimeStartCalls = 0;
  const view = createModelManagerView({
    workspace,
    modelDir,
    manifestPath: path.join(workspace, 'manifest.json'),
    modelRuntime: {
      list: () => options.runtimeEntries ?? [],
      status: async () => ({ runtime: true, models: options.runtimeModels ?? [] }),
      start: async () => { runtimeStartCalls += 1; }
    } as never,
    connectionsService: { list: async () => options.connections ?? emptyConnections() },
    runtimeStatus: async () => (options.runtimeObservation ?? { backend: 'LLAMA_CPP', health: 'STOPPED' }) as never,
    ...(options.preflight ? { qualificationPreflight: options.preflight } : {})
  });
  return { workspace, view, runtimeStartCalls: () => runtimeStartCalls };
}

test('A-D and H: qualification blockers are separate from identity/integrity and are recomputed per snapshot', async t => {
  const observations: Array<ModelQualificationPreflightObservation | null> = [];
  let current: ModelQualificationPreflightObservation | null = {
    storage_read_safety: 'SAFE', available_physical_memory_mib: 8192
  };
  const fixture = await createFixture({ artifact: true, preflight: async () => { observations.push(current); return current; } });
  t.after(() => fs.rm(fixture.workspace, { recursive: true, force: true }));

  const snapshotA = await fixture.view.snapshot();
  const modelA = snapshotA.models[0]!;
  assert.equal(modelA.availability, 'DISCOVERED');
  assert.equal(modelA.identity.qualification.state, 'UNTESTED');
  assert.equal(modelA.readiness, 'SETUP_REQUIRED');
  assert.deepEqual(modelA.qualification_gate, { state: 'PREFLIGHT_CLEAR', reasons: [] });
  assert.equal(snapshotA.artifacts[0]?.hash_status, 'NOT_COMPUTED');
  assert.equal(presentModelQualification(modelA, snapshotA.artifacts).integrity, 'INTEGRITY_NOT_VERIFIED');
  assert.equal('resource_admission' in snapshotA, false, 'the projection does not fabricate an Admission result');

  current = { storage_read_safety: 'UNSAFE', available_physical_memory_mib: 8192 };
  const snapshotB = await fixture.view.snapshot();
  const modelB = snapshotB.models[0]!;
  assert.deepEqual(modelB.qualification_gate, { state: 'QUALIFICATION_BLOCKED', reasons: ['STORAGE_UNSAFE'] });
  assert.equal(modelB.availability, 'DISCOVERED');
  assert.equal(modelB.identity.qualification.state, 'UNTESTED');
  assert.equal(modelB.readiness, 'NOT_READY');
  assert.equal(snapshotB.artifacts[0]?.hash_status, 'NOT_COMPUTED');

  current = { storage_read_safety: 'SAFE', available_physical_memory_mib: 4000 };
  const snapshotC = await fixture.view.snapshot();
  assert.deepEqual(snapshotC.models[0]?.qualification_gate, { state: 'QUALIFICATION_BLOCKED', reasons: ['RESOURCE_FLOOR_NOT_MET'] });
  assert.equal(snapshotC.models[0]?.availability, 'DISCOVERED');

  current = { storage_read_safety: 'UNSAFE', available_physical_memory_mib: 4000 };
  const snapshotD = await fixture.view.snapshot();
  const modelD = snapshotD.models[0]!;
  assert.deepEqual(modelD.qualification_gate, {
    state: 'QUALIFICATION_BLOCKED', reasons: ['STORAGE_UNSAFE', 'RESOURCE_FLOOR_NOT_MET']
  });
  assert.equal(modelD.identity.qualification.state, 'UNTESTED');
  const presentationD = presentModelQualification(modelD, snapshotD.artifacts);
  assert.equal(presentationD.artifact_presence, 'ARTIFACT PRESENT');
  assert.equal(presentationD.integrity, 'INTEGRITY_NOT_VERIFIED');
  assert.equal(presentationD.qualification, 'QUALIFICATION BLOCKED');
  assert.deepEqual(presentationD.reason_codes, ['STORAGE_UNSAFE', 'RESOURCE_FLOOR_NOT_MET']);
  assert.match(presentationD.explanation ?? '', /storage device is unsafe to read and available memory is below the runtime requirement/);

  current = { storage_read_safety: 'SAFE', available_physical_memory_mib: 6656 };
  const snapshotH = await fixture.view.snapshot();
  assert.deepEqual(snapshotH.models[0]?.qualification_gate, { state: 'PREFLIGHT_CLEAR', reasons: [] });
  assert.equal(observations.length, 5, 'each Model Manager snapshot reevaluates the ephemeral observation');
  assert.equal(fixture.runtimeStartCalls(), 0, 'Model Manager qualification projection never invokes a runtime adapter');
});

test('E: absent artifact remains unavailable without inheriting a storage blocker', async t => {
  let preflightCalls = 0;
  const fixture = await createFixture({
    manifestModel: true,
    preflight: async () => { preflightCalls += 1; return { storage_read_safety: 'UNSAFE', available_physical_memory_mib: 1 }; }
  });
  t.after(() => fs.rm(fixture.workspace, { recursive: true, force: true }));

  const snapshot = await fixture.view.snapshot();
  const model = snapshot.models.find(item => item.identity.canonical_id === 'liquid-fixture');
  assert.ok(model);
  assert.equal(model.availability, 'UNAVAILABLE');
  assert.deepEqual(model.qualification_gate, { state: 'NOT_EVALUATED', reasons: [] });
  assert.equal(preflightCalls, 0);
  assert.doesNotMatch(JSON.stringify(model.qualification_gate), /STORAGE_UNSAFE/);
});

test('F: an actual synthetic-file hash mismatch is distinct from pending integrity verification', async t => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'covert-model-hash-fixture-'));
  const modelDir = path.join(workspace, 'models');
  const filename = 'liquid-fixture.gguf';
  const filePath = path.join(modelDir, filename);
  await fs.mkdir(modelDir, { recursive: true });
  const bytes = Buffer.from('synthetic fixture bytes only');
  await fs.writeFile(filePath, bytes);
  const actualHash = createHash('sha256').update(bytes).digest('hex');
  await fs.writeFile(path.join(workspace, 'manifest.json'), JSON.stringify({ models: [{
    id: 'liquid-fixture', name: 'Liquid fixture', file: filename, format: 'GGUF', sha256: HASH_A
  }] }));
  t.after(() => fs.rm(workspace, { recursive: true, force: true }));
  const view = createModelManagerView({
    workspace,
    modelDir,
    manifestPath: path.join(workspace, 'manifest.json'),
    modelRuntime: {
      list: () => [{ id: 'liquid-fixture', file: filePath, model: filename, ingested: true, sha256: HASH_A }],
      status: async () => ({ runtime: true, models: [{
        id: 'liquid-fixture', status: 'pending', artifact_available: true, observed_sha256: actualHash,
        qualification: 'accepted_hash_verified'
      }] })
    } as never,
    connectionsService: { list: async () => emptyConnections() },
    runtimeStatus: async () => ({ backend: 'LLAMA_CPP', health: 'HEALTHY', version: 'fixture-runtime' }) as never,
    qualificationPreflight: async () => ({ storage_read_safety: 'SAFE', available_physical_memory_mib: 8192 })
  });

  const snapshot = await view.snapshot();
  const artifact = snapshot.artifacts.find(item => item.model_id === 'liquid-fixture');
  const model = snapshot.models.find(item => item.identity.canonical_id === 'liquid-fixture');
  assert.ok(artifact);
  assert.ok(model);
  assert.equal(artifact.hash_status, 'MISMATCH');
  assert.equal(artifact.observed_sha256, actualHash);
  assert.equal(model.identity.qualification.state, 'STALE');
  assert.deepEqual(model.qualification_gate, { state: 'PREFLIGHT_CLEAR', reasons: [] });
  const presentation = presentModelQualification(model, snapshot.artifacts);
  assert.equal(presentation.integrity, 'INTEGRITY_FAILED');
  assert.equal(presentation.model_invalid, 'MODEL INVALID');
});

test('G: exact blocked selection remains selected while an independent model route is available', async t => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'covert-model-selected-blocked-'));
  const modelDir = path.join(workspace, 'models');
  await fs.mkdir(modelDir, { recursive: true });
  const selectedPath = path.join(modelDir, 'selected-liquid.gguf');
  await fs.writeFile(selectedPath, 'synthetic selected artifact');
  t.after(() => fs.rm(workspace, { recursive: true, force: true }));
  const selectedId = 'selected-liquid';
  const connections = emptyConnections(selectedId, [selectedId]);
  connections.connections.push({
    id: 'provider-fixture',
    provider_id: 'provider-fixture',
    name: 'Provider fixture',
    kind: 'api-key',
    status: 'connected',
    detail: 'synthetic test connection',
    capabilities: ['chat'],
    routing_available: true,
    account_label: 'fixture',
    access: {
      authentication_mode: 'api_key',
      authentication_configured: true,
      credential_source: { id: 'fixture-credential', kind: 'api_key_vault', configuration_state: 'configured' },
      health: 'healthy',
      execution_adapters: ['direct-http'],
      model_refs: [{ model_id: 'ready-alternate', provider_model_id: 'ready-alternate', model_support_state: 'verified' }],
      external_egress_required: true,
      operator_setup_required: false,
      setup_state: 'ready'
    }
  });
  const view = createModelManagerView({
    workspace,
    modelDir,
    manifestPath: path.join(workspace, 'manifest.json'),
    modelRuntime: {
      list: () => [{ id: selectedId, model: 'selected-liquid.gguf', file: selectedPath, artifact_uri: 'local://selected-liquid.gguf', ingested: true, sha256: HASH_A }],
      status: async () => ({ runtime: true, models: [
        { id: selectedId, status: 'ready', artifact_available: true, observed_sha256: HASH_A, qualification: 'accepted_hash_verified' }
      ] })
    } as never,
    connectionsService: { list: async () => connections },
    runtimeStatus: async () => ({ backend: 'LLAMA_CPP', health: 'HEALTHY', version: 'fixture-runtime' }) as never,
    qualificationPreflight: async () => ({ storage_read_safety: 'UNSAFE', available_physical_memory_mib: 4000 })
  });

  const snapshot = await view.snapshot();
  const selected = snapshot.models.find(item => item.identity.canonical_id === selectedId);
  const alternateRoute = snapshot.routes.find(route => route.model_id === 'ready-alternate');
  assert.ok(selected);
  assert.ok(alternateRoute);
  assert.deepEqual(selected.qualification_gate, {
    state: 'QUALIFICATION_BLOCKED', reasons: ['STORAGE_UNSAFE', 'RESOURCE_FLOOR_NOT_MET']
  });
  assert.equal(selected.identity.qualification.state, 'QUALIFIED', 'historical evidence remains distinct from the live blocker');
  assert.deepEqual(selected.execution_selected_roles, ['IMPLEMENTATION']);
  assert.equal(selected.readiness, 'NOT_READY');
  assert.equal(snapshot.routes.find(route => route.model_id === selectedId)?.available, false);
  assert.equal(alternateRoute?.available, true, 'an independent ready route is visible but is not selected for the role');
});
