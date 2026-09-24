import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { IntelligenceEntry } from '../../node/src/services/intelligence-registry.ts';
import { IntelligenceEntrySchema, IntelligenceRegistry } from '../../node/src/services/intelligence-registry.ts';
import { RuntimeAdapterRegistry, type RuntimeAdapter } from '../../node/src/services/runtime-adapter.ts';
import { routeForModelSelectionRequest } from '../../node/src/routes/model-manager.ts';
import { ModelSelectionRequestInput, ModelSelectionRequestResponse } from '../../common/contracts/model-manager.ts';

const localDiscovery = async () => ({ entries: [], scanned_dirs: 0, errors: [] });

const healthyUnsloth: RuntimeAdapter = {
  name: 'Unsloth',
  capabilities: { tools: false, metrics: true, unload: false },
  async discover() { return ['model-a', 'model-b', 'too-large', 'no-artifact', 'stale'].map(id => ({ id, loaded: false })); },
  async status() { return null; },
  async load(model_id) { return { id: model_id, status: 'loaded' }; },
  async unload(model_id) { return { id: model_id, status: 'unloaded' }; },
  async health() { return { ok: true }; },
  async generate() { return { content: '', finish_reason: 'stop', latency_ms: 0 }; },
  async tools() { return []; },
  async metrics() { return {}; }
};

function localEntry(id: string, overrides: Partial<IntelligenceEntry> = {}): IntelligenceEntry {
  return IntelligenceEntrySchema.parse({
    id, display_name: id, provider: 'local', locality: 'LOCAL', availability: 'INSTALLED',
    artifact: { file: `${id}.gguf`, revision: 'rev-1', hash: 'a'.repeat(64), hash_status: 'verified', format: 'gguf', quantization: 'Q4_K_M' },
    runtime: { backend: 'UNSLOTH' },
    qualification: { state: 'QUALIFIED', qualified_roles: ['IMPLEMENTER'], unqualified_roles: [], evidence_refs: [`passport/${id}`], basis: { artifact_hash: 'a'.repeat(64), runtime: 'UNSLOTH' } },
    known_strengths: [], known_failures: [], resource_requirements: { ram_mb: 1024 }, ...overrides
  });
}

async function setup(run: (workspace: string, manifest: string, registry: IntelligenceRegistry, adapters: RuntimeAdapterRegistry) => Promise<void>): Promise<void> {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'aide-selection-'));
  const manifest = path.join(workspace, 'manifest.json');
  await fs.writeFile(manifest, JSON.stringify({ packs: [] }), 'utf8');
  const registry = new IntelligenceRegistry({ workspace });
  await registry.load();
  const adapters = new RuntimeAdapterRegistry();
  adapters.register(healthyUnsloth);
  try { await run(workspace, manifest, registry, adapters); }
  finally { await fs.rm(workspace, { recursive: true, force: true }); }
}

test('Model Selection Request is project-scoped, role-bound, and never mutates mission routing', async () => {
  await setup(async (workspace, manifest, registry, adapters) => {
    await registry.upsert(localEntry('model-a'));
    await registry.upsert(localEntry('model-b', { resource_requirements: { ram_mb: 3000 } }));
    const before = JSON.stringify(registry.list());
    const options = {
      workspace, modelPacksPath: manifest, runtimeAdapters: adapters, localDiscovery,
      availableRamMb: 8192, providerProbe: async () => []
    };
    const route = routeForModelSelectionRequest(options);
    const schemaRequest = ModelSelectionRequestInput.parse({ requested_role: 'IMPLEMENTER', selected_model_id: 'model-a', operator_override: false });
    const ctx = { query: {}, body: schemaRequest };
    const operation = await route.describeOperation?.(ctx, 'selection-task');
    assert.equal(operation?.kind, 'capability.read');
    assert.deepEqual(operation?.args, { body: { requested_role: 'IMPLEMENTER', selected_model_id: 'model-a', operator_override: false } });

    const result = ModelSelectionRequestResponse.parse(await route.handler(ctx));
    assert.equal(result.decision, 'RECOMMENDED');
    assert.equal(result.routing_applied, false);
    assert.equal(result.authority_evaluated, false);
    assert.equal(result.resource_admission_evaluated, false);
    assert.match(result.selection_request?.scope.project_id ?? '', /^sha256:[a-f0-9]{64}$/);
    assert.equal(result.selection_request?.scope.mission_id, null);
    assert.equal(result.selection_request?.requested_role, 'IMPLEMENTER');
    assert.equal(JSON.stringify(registry.list()), before);

    const override = ModelSelectionRequestResponse.parse(await route.handler({
      query: {}, body: { requested_role: 'IMPLEMENTER', selected_model_id: 'model-b', operator_override: true }
    }));
    assert.equal(override.decision, 'OPERATOR_SELECTED');
    assert.equal(override.selection_request?.operator_override, true);
    assert.equal(JSON.stringify(registry.list()), before);
  });
});

test('operator override cannot bypass estimated resource conflict, missing artifact, or stale qualification', async () => {
  await setup(async (workspace, manifest, registry, adapters) => {
    await registry.upsert(localEntry('too-large', { resource_requirements: { ram_mb: Number.MAX_SAFE_INTEGER } }));
    await registry.upsert(localEntry('no-artifact', { artifact: undefined }));
    await registry.upsert(localEntry('stale', {
      qualification: { state: 'STALE', qualified_roles: ['IMPLEMENTER'], unqualified_roles: [], evidence_refs: ['passport/stale'] }
    }));
    const route = routeForModelSelectionRequest({
      workspace, modelPacksPath: manifest, runtimeAdapters: adapters, localDiscovery,
      availableRamMb: 4096, providerProbe: async () => []
    });
    for (const [modelId, expected] of [
      ['too-large', 'RESOURCE_INCOMPATIBLE'],
      ['no-artifact', 'MISSING_ARTIFACT'],
      ['stale', 'QUALIFICATION_INVALID_OR_STALE']
    ] as const) {
      const result = ModelSelectionRequestResponse.parse(await route.handler({
        query: {}, body: { requested_role: 'IMPLEMENTER', selected_model_id: modelId, operator_override: true }
      }));
      assert.equal(result.decision, 'SYSTEM_BLOCKED');
      assert.ok(result.block_reasons.includes(expected));
      assert.equal(result.selection_request, null);
      assert.equal(result.routing_applied, false);
      assert.equal(result.authority_evaluated, false);
      assert.equal(result.resource_admission_evaluated, false);
    }
  });
});
