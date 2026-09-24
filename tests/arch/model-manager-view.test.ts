import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { IntelligenceEntry } from '../../node/src/services/intelligence-registry.ts';
import { IntelligenceRegistry, IntelligenceEntrySchema } from '../../node/src/services/intelligence-registry.ts';
import { buildModelManagerSnapshot } from '../../node/src/services/model-manager-view.ts';
import { RuntimeAdapterRegistry, UnimplementedRuntimeAdapter } from '../../node/src/services/runtime-adapter.ts';
import { routeForModelManager } from '../../node/src/routes/model-manager.ts';
import { overrideBlockReason } from '../../browser/src/panels/model-manager-logic.ts';
import { ModelManagerDeveloperNote, ModelManagerSystemAdvisory } from '../../common/contracts/model-manager.ts';
import { httpOperationKind } from '../../common/security/operation-policy.mjs';

interface Pack {
  id: string;
  name: string;
  role: string;
  license: string;
  download_bytes_approx: number | null;
  source_repo: string;
  file: string | null;
  sha256?: string;
}

function model(overrides: Partial<IntelligenceEntry> & { id: string }): IntelligenceEntry {
  return IntelligenceEntrySchema.parse({
    display_name: overrides.id,
    provider: 'local',
    locality: 'LOCAL',
    availability: 'INSTALLED',
    qualification: { state: 'UNTESTED', qualified_roles: [], unqualified_roles: [], evidence_refs: [] },
    known_strengths: [],
    known_failures: [],
    ...overrides
  });
}

async function withWorkspace(run: (workspace: string, manifestPath: string) => Promise<void>, packs: Pack[] = []): Promise<void> {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'aide-model-manager-view-'));
  const manifestPath = path.join(workspace, 'manifest.json');
  try {
    await fs.writeFile(manifestPath, JSON.stringify({ packs }), 'utf8');
    await run(workspace, manifestPath);
  } finally {
    await fs.rm(workspace, { recursive: true, force: true });
  }
}

async function register(workspace: string, ...entries: IntelligenceEntry[]): Promise<void> {
  const registry = new IntelligenceRegistry({ workspace });
  await registry.load();
  for (const item of entries) await registry.upsert(item);
}

const emptyDiscovery = async () => ({ entries: [], scanned_dirs: 0, errors: [] });

test('Model Manager preserves installed-versus-qualified and stale qualification states', async () => {
  await withWorkspace(async (workspace, modelPacksPath) => {
    await register(workspace,
      model({ id: 'installed-unqualified', display_name: 'Installed but unqualified' }),
      model({
        id: 'stale-model',
        display_name: 'Stale qualification example',
        artifact: { file: 'stale.gguf', hash: 'new-hash', hash_status: 'verified' },
        qualification: { state: 'QUALIFIED', qualified_roles: ['RESIDENT'], unqualified_roles: [], evidence_refs: ['evidence/stale'], basis: { artifact_hash: 'old-hash' } }
      })
    );
    const snapshot = await buildModelManagerSnapshot({ workspace, modelPacksPath, localDiscovery: emptyDiscovery, availableRamMb: 4096 });
    const installed = snapshot.models.find(entry => entry.id === 'installed-unqualified');
    const stale = snapshot.models.find(entry => entry.id === 'stale-model');
    assert.equal(installed?.availability, 'INSTALLED');
    assert.equal(installed?.qualification.state, 'UNTESTED');
    assert.equal(overrideBlockReason(installed), null, 'qualification caution does not hard-block a compatible available local model');
    assert.equal(stale?.qualification.state, 'STALE');
    assert.equal(stale?.qualification.stale, true);
    assert.deepEqual(stale?.qualification.stale_reasons, ['artifact_hash_changed']);
    assert.ok(stale?.qualification.evidence_refs.includes('evidence/stale'));
    assert.equal(snapshot.recommendation.recommended.some(candidate => candidate.id === 'stale-model'), false, 'stale role evidence is not presented as a current recommendation');
  });
});

test('offline recommendation uses qualified local models and excludes cloud models', async () => {
  await withWorkspace(async (workspace, modelPacksPath) => {
    await register(workspace,
      model({ id: 'local-builder', qualification: { state: 'QUALIFIED', qualified_roles: ['IMPLEMENTER'], unqualified_roles: [], evidence_refs: ['local/passport'], basis: { artifact_hash: 'local-hash' } }, resource_requirements: { ram_mb: 1024 } }),
      model({ id: 'cloud-reviewer', provider: 'opencode', locality: 'CLOUD', availability: 'CONNECTED', provider_state: 'AUTHENTICATED', qualification: { state: 'QUALIFIED', qualified_roles: ['IMPLEMENTER'], unqualified_roles: [], evidence_refs: ['cloud/passport'], basis: { artifact_hash: 'remote-revision' } } })
    );
    const snapshot = await buildModelManagerSnapshot({ workspace, modelPacksPath, localDiscovery: emptyDiscovery, availableRamMb: 4096, offline: true });
    assert.deepEqual(snapshot.recommendation.recommended.map(candidate => candidate.id), ['local-builder']);
    assert.ok(snapshot.recommendation.excluded.some(candidate => candidate.id === 'cloud-reviewer'));
    assert.equal(snapshot.models.find(entry => entry.id === 'local-builder')?.offline_capable, true);
  });
});

test('provider probe failure does not erase local model state or infer cloud availability', async () => {
  await withWorkspace(async (workspace, modelPacksPath) => {
    await register(workspace, model({ id: 'offline-local' }));
    const snapshot = await buildModelManagerSnapshot({
      workspace,
      modelPacksPath,
      localDiscovery: emptyDiscovery,
      providerProbe: async () => { throw new Error('probe failed'); },
      availableRamMb: 4096
    });
    assert.equal(snapshot.provider_probe, 'FAILED');
    assert.ok(snapshot.models.some(entry => entry.id === 'offline-local'));
    assert.deepEqual(snapshot.providers, []);
  });
});

test('resource-incompatible models remain visible but are excluded from recommendation and override', async () => {
  await withWorkspace(async (workspace, modelPacksPath) => {
    await register(workspace, model({
      id: 'too-large',
      qualification: { state: 'QUALIFIED', qualified_roles: ['IMPLEMENTER'], unqualified_roles: [], evidence_refs: ['large/evidence'], basis: { artifact_hash: 'large-hash' } },
      resource_requirements: { ram_mb: 3000 }
    }));
    const snapshot = await buildModelManagerSnapshot({ workspace, modelPacksPath, localDiscovery: emptyDiscovery, availableRamMb: 2000 });
    const item = snapshot.models.find(entry => entry.id === 'too-large');
    assert.equal(item?.resource_fit, 'INCOMPATIBLE');
    assert.equal(snapshot.recommendation.recommended.some(candidate => candidate.id === 'too-large'), false);
    assert.equal(overrideBlockReason(item), 'RESOURCE_INCOMPATIBLE');
  });
});

test('recommendation exposes deterministic role and resource reason codes', async () => {
  await withWorkspace(async (workspace, modelPacksPath) => {
    await register(workspace, model({
      id: 'role-fit',
      qualification: { state: 'QUALIFIED', qualified_roles: ['IMPLEMENTER'], unqualified_roles: [], evidence_refs: ['role/evidence'], basis: { artifact_hash: 'role-hash' } },
      resource_requirements: { ram_mb: 1200 }
    }));
    const snapshot = await buildModelManagerSnapshot({ workspace, modelPacksPath, localDiscovery: emptyDiscovery, availableRamMb: 4096 });
    const candidate = snapshot.recommendation.recommended.find(item => item.id === 'role-fit');
    assert.ok(candidate?.reasons.includes('ROLE_QUALIFIED'));
    assert.ok(candidate?.reasons.includes('LOW_RESOURCE_FIT'));
    assert.ok(candidate?.evidence_refs.includes('role/evidence'));
  });
});

test('cloud candidates without authenticated provider state are not recommended or selectable', async () => {
  await withWorkspace(async (workspace, modelPacksPath) => {
    await register(workspace, model({
      id: 'opencode/MiniMax-M3',
      display_name: 'MiniMax M3',
      provider: 'opencode',
      locality: 'CLOUD',
      availability: 'CONNECTED',
      provider_state: 'CONFIGURED_NOT_VERIFIED',
      qualification: { state: 'QUALIFIED', qualified_roles: ['IMPLEMENTER'], unqualified_roles: [], evidence_refs: ['cloud/evidence'], basis: { artifact_hash: 'provider-managed' } }
    }));
    const snapshot = await buildModelManagerSnapshot({
      workspace,
      modelPacksPath,
      localDiscovery: emptyDiscovery,
      providerProbe: async () => [{ id: 'opencode', state: 'CONFIGURED_NOT_VERIFIED', models: [] }],
      availableRamMb: 4096
    });
    assert.equal(snapshot.models[0]?.id, 'opencode/MiniMax-M3');
    assert.equal(snapshot.recommendation.recommended.some(candidate => candidate.id === 'opencode/MiniMax-M3'), false);
    assert.ok(snapshot.recommendation.excluded.some(candidate => candidate.id === 'opencode/MiniMax-M3' && candidate.reasons.includes('PROVIDER_NOT_AUTHENTICATED')));
    assert.equal(overrideBlockReason(snapshot.models[0]), 'PROVIDER_NOT_AUTHENTICATED');
  });
});

test('hybrid setup distinguishes provider connection from missing reviewer qualification', async () => {
  await withWorkspace(async (workspace, modelPacksPath) => {
    await register(workspace,
      model({ id: 'local-implementer', qualification: { state: 'QUALIFIED', qualified_roles: ['IMPLEMENTER'], unqualified_roles: [], evidence_refs: ['local/evidence'], basis: { artifact_hash: 'local-hash' } } }),
      model({ id: 'cloud-reviewer', provider: 'opencode', locality: 'CLOUD', availability: 'CONNECTED', provider_state: 'CONFIGURED_NOT_VERIFIED' })
    );
    const disconnected = await buildModelManagerSnapshot({ workspace, modelPacksPath, localDiscovery: emptyDiscovery, availableRamMb: 4096 });
    assert.equal(disconnected.model_packs.hybrid_setup.state, 'PROVIDER_CONNECTION_REQUIRED');

    // Registry provider state is explicit and takes precedence over a probe.
    // Advance both fixture sources together to model authenticated-but-
    // unqualified state rather than injecting contradictory observations.
    await register(workspace, model({
      id: 'cloud-reviewer',
      provider: 'opencode',
      locality: 'CLOUD',
      availability: 'CONNECTED',
      provider_state: 'AUTHENTICATED'
    }));
    const authenticated = await buildModelManagerSnapshot({
      workspace,
      modelPacksPath,
      localDiscovery: emptyDiscovery,
      providerProbe: async () => [{ id: 'opencode', state: 'AUTHENTICATED', models: [] }],
      availableRamMb: 4096
    });
    assert.equal(authenticated.model_packs.hybrid_setup.state, 'QUALIFICATION_MISSING');
  });
});

test('Model Pack view distinguishes missing artifacts, source-only entries, and qualification', async () => {
  const packs: Pack[] = [
    { id: 'pack-missing', name: 'Missing local artifact', role: 'IMPLEMENTER', license: 'Apache-2.0', source_repo: 'org/model', file: 'model-q4.gguf', download_bytes_approx: 1000 },
    { id: 'source-only', name: 'Source only candidate', role: 'REVIEWER', license: 'Apache-2.0', source_repo: 'org/source', file: null, download_bytes_approx: null },
    { id: 'pack-installed', name: 'Installed but unqualified', role: 'IMPLEMENTER', license: 'Apache-2.0', source_repo: 'org/installed', file: 'installed.gguf', download_bytes_approx: 2000 }
  ];
  await withWorkspace(async (workspace, modelPacksPath) => {
    await register(workspace, model({ id: 'pack-installed', artifact: { file: 'installed.gguf', format: 'gguf', quantization: 'Q4_K_M', hash_status: 'not_computed' } }));
    const snapshot = await buildModelManagerSnapshot({ workspace, modelPacksPath, localDiscovery: emptyDiscovery, availableRamMb: 4096 });
    const missing = snapshot.model_packs.items.find(item => item.id === 'pack-missing');
    const sourceOnly = snapshot.model_packs.items.find(item => item.id === 'source-only');
    const installed = snapshot.model_packs.items.find(item => item.id === 'pack-installed');
    assert.equal(missing?.installation_state, 'MISSING');
    assert.equal(missing?.qualification_state, null);
    assert.equal(snapshot.model_packs.offline_bundle.state, 'MISSING_DEPENDENCY');
    assert.equal(snapshot.model_packs.offline_bundle.installation_available, false);
    assert.equal(sourceOnly?.installation_state, 'SOURCE_ONLY');
    assert.equal(installed?.installation_state, 'INSTALLED');
    assert.equal(installed?.qualification_state, 'UNTESTED');
  }, packs);
});

test('Developer Notes and System Advisories remain distinct tagged surfaces', async () => {
  await withWorkspace(async (workspace, modelPacksPath) => {
    await register(workspace, model({ id: 'needs-qualification' }));
    const snapshot = await buildModelManagerSnapshot({ workspace, modelPacksPath, localDiscovery: emptyDiscovery, availableRamMb: 4096 });
    assert.ok(snapshot.developer_notes.length > 0);
    assert.ok(snapshot.developer_notes.every(note => note.kind === 'developer-note' && note.source === 'DEVELOPER_NOTES — James Ferrell'));
    assert.ok(snapshot.system_advisories.some(item => item.kind === 'system-advisory'));
    const note = snapshot.developer_notes[0];
    const advisory = snapshot.system_advisories[0];
    assert.ok(note && advisory);
    assert.equal(ModelManagerSystemAdvisory.safeParse(note).success, false);
    assert.equal(ModelManagerDeveloperNote.safeParse(advisory).success, false);
  });
});

test('Unsloth RuntimeAdapter read state is shown without implementing a runtime', async () => {
  await withWorkspace(async (workspace, modelPacksPath) => {
    const adapters = new RuntimeAdapterRegistry();
    adapters.register(new UnimplementedRuntimeAdapter('Unsloth'));
    const snapshot = await buildModelManagerSnapshot({ workspace, modelPacksPath, runtimeAdapters: adapters, localDiscovery: emptyDiscovery, availableRamMb: 4096 });
    assert.equal(snapshot.runtime.canonical_name, 'UNSLOTH');
    assert.equal(snapshot.runtime.registered, true);
    assert.equal(snapshot.runtime.health, 'UNHEALTHY');
    assert.match(snapshot.runtime.health_detail ?? '', /not implemented/i);
    assert.equal(snapshot.runtime.version, null);
    assert.equal(snapshot.runtime.ownership, null);
  });
});

test('public-safe Model Manager projection omits local paths, endpoints, and credential values', async () => {
  await withWorkspace(async (workspace, modelPacksPath) => {
    const artifactPath = path.join(workspace, 'private', 'model.gguf');
    await register(workspace, model({
      id: 'safe-local',
      artifact: { file: artifactPath, format: 'gguf', quantization: 'Q4_K_M', hash_status: 'not_computed' },
      runtime: { backend: 'Unsloth', endpoint: 'http://127.0.0.1:9999/private' }
    }), model({ id: 'C:/private/model', display_name: 'path-like identifier' }), model({ id: 'model-with-secret-label', display_name: 'sk-0123456789abcdef0123456789abcdef' }));
    await fs.mkdir(path.join(workspace, '.aide'), { recursive: true });
    await fs.writeFile(path.join(workspace, '.aide', 'providers.json'), JSON.stringify({ 'openai-codex': { apiKey: 'sk-0123456789abcdef0123456789abcdef' } }), 'utf8');
    const snapshot = await buildModelManagerSnapshot({ workspace, modelPacksPath, localDiscovery: emptyDiscovery, availableRamMb: 4096 });
    const serialized = JSON.stringify(snapshot);
    assert.equal(snapshot.public_safe, true);
    assert.equal(serialized.includes(workspace), false);
    assert.equal(serialized.includes('127.0.0.1'), false);
    assert.equal(serialized.includes('sk-0123456789abcdef0123456789abcdef'), false);
    assert.equal(serialized.includes('C:/private/model'), false);
    assert.equal(snapshot.models.some(entry => entry.id === 'model-with-secret-label'), false);
    assert.equal(snapshot.models[0]?.artifact.label, 'model.gguf');
  });
});

test('read-only Model Manager route validates its response and has the existing central read policy', async () => {
  await withWorkspace(async (workspace, modelPacksPath) => {
    const route = routeForModelManager({ workspace, modelPacksPath, providerProbe: async () => [] });
    assert.equal(route.method, 'GET');
    assert.equal(route.path, '/api/models/manager');
    assert.equal(httpOperationKind(route.method, route.path), 'capability.read');
    const result = await route.handler({ query: { role: 'IMPLEMENTER', offline: 'true' }, body: undefined });
    assert.equal(route.response.safeParse(result).success, true);
  });
});
