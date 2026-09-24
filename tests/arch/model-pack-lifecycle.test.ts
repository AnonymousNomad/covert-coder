import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type http from 'node:http';
import {
  ModelManagerEntry,
  ModelPackDefinition,
  type ModelManagerRuntimeT
} from '../../common/contracts/model-manager.ts';
import {
  createModelPackInstaller,
  ModelPackError,
  projectModelPackBundles,
  type ModelPackArtifactCandidate
} from '../../node/src/services/model-packs.ts';
import { IntelligenceRegistry } from '../../node/src/services/intelligence-registry.ts';
import { routeForModelPackInstall } from '../../node/src/routes/model-manager.ts';
import { ArchServer } from '../../node/src/server.ts';
import { routesForAuthority } from '../../node/src/routes/authority.ts';
import { pairFixture } from './authority-fixture.ts';

function minimalGguf(): Buffer {
  const key = Buffer.from('general.architecture', 'utf8');
  const value = Buffer.from('llama', 'utf8');
  const header = Buffer.alloc(24);
  header.write('GGUF', 0, 'utf8');
  header.writeUInt32LE(3, 4);
  header.writeBigUInt64LE(0n, 8);
  header.writeBigUInt64LE(1n, 16);
  const metadata = Buffer.alloc(8 + key.length + 4 + 8 + value.length);
  let offset = 0;
  metadata.writeBigUInt64LE(BigInt(key.length), offset); offset += 8;
  key.copy(metadata, offset); offset += key.length;
  metadata.writeUInt32LE(8, offset); offset += 4;
  metadata.writeBigUInt64LE(BigInt(value.length), offset); offset += 8;
  value.copy(metadata, offset);
  const size = header.length + metadata.length;
  const padding = (32 - (size % 32)) % 32;
  return Buffer.concat([header, metadata, Buffer.alloc(padding)]);
}

async function temporaryWorkspace(run: (root: string, workspace: string, catalogPath: string) => Promise<void>): Promise<void> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'aide-model-pack-'));
  const workspace = path.join(root, 'workspace');
  const catalogPath = path.join(root, 'model-manifest.json');
  await fs.mkdir(workspace, { recursive: true });
  try { await run(root, workspace, catalogPath); }
  finally { await fs.rm(root, { recursive: true, force: true }); }
}

function catalogItem(filename: string, hash: string | null): ModelPackArtifactCandidate {
  return {
    id: 'qwen-local', name: 'Qwen local', role: 'IMPLEMENTER', license: 'Apache-2.0',
    source_repo: 'Qwen/Qwen-GGUF', source_revision: 'revision-7', file: filename,
    download_bytes_approx: 1234, sha256: hash
  };
}

function localModel(overrides: Record<string, unknown> = {}) {
  return ModelManagerEntry.parse({
    id: 'qwen-local', display_name: 'Qwen local', family: 'Qwen', provider: 'local', locality: 'LOCAL',
    availability: 'INSTALLED', provider_state: null, offline_capable: true,
    qualification: { state: 'UNTESTED', qualified_roles: [], unqualified_roles: [], evidence_refs: [], stale: false, stale_reasons: [] },
    artifact: { label: 'qwen.gguf', revision: 'revision-7', hash: 'a'.repeat(64), hash_status: 'verified', format: 'gguf', quantization: 'Q4_K_M' },
    runtime_backend: 'UNSLOTH', resource_requirements: { ram_mb: 1024, vram_mb: null, disk_mb: 1234 },
    resource_fit: 'FIT', passport_ref: null, evidence_refs: [], known_strengths: [], known_failures: [],
    ...overrides
  });
}

const runtime: ModelManagerRuntimeT = {
  canonical_name: 'UNSLOTH', registered: true, health: 'HEALTHY', health_detail: null,
  version: null, ownership: null, loaded_models: [{ id: 'qwen-local', loaded: false, context_tokens: 4096 }], metrics: {},
  capabilities: { tools: false, metrics: false, unload: false }
};

function definition() {
  return ModelPackDefinition.parse({
    id: 'local-coder', version: '1.2.0', display_name: 'Local Coder', summary: 'Bounded local implementation setup.',
    required_models: [{ model_id: 'qwen-local', roles: ['IMPLEMENTER'] }],
    optional_models: [], provider_dependencies: [],
    runtime_requirements: [{ runtime_id: 'UNSLOTH', health_required: true, capabilities: [] }],
    qualification_requirements: [{ model_id: 'qwen-local', roles: ['IMPLEMENTER'] }],
    resource_expectations: { ram_mb: null, vram_mb: null, disk_mb: null }
  });
}

test('Model Pack readiness separates installed artifacts from role qualification', () => {
  const item = catalogItem('qwen.gguf', 'a'.repeat(64));
  const installedUnqualified = localModel();
  const projected = projectModelPackBundles({
    definitions: [definition()], catalogItems: [item], models: [installedUnqualified], providers: [], runtime,
    discoveredEntries: [], availableRamMb: 4096
  })[0];
  assert.ok(projected);
  assert.equal(projected.installation_state, 'INSTALLED');
  assert.equal(projected.state, 'QUALIFICATION_REQUIRED');
  assert.equal(projected.qualification_state, 'QUALIFICATION_REQUIRED');
  assert.equal(projected.members[0]?.installation_state, 'INSTALLED');

  const qualified = localModel({
    qualification: { state: 'QUALIFIED', qualified_roles: ['IMPLEMENTER'], unqualified_roles: [], evidence_refs: ['passport/qwen'], stale: false, stale_reasons: [] },
    evidence_refs: ['passport/qwen']
  });
  const ready = projectModelPackBundles({
    definitions: [definition()], catalogItems: [item], models: [qualified], providers: [], runtime,
    discoveredEntries: [], availableRamMb: 4096
  })[0];
  assert.equal(ready?.state, 'READY');
  assert.equal(ready?.qualification_state, 'QUALIFIED');
});

test('Model Pack projection distinguishes absent catalog artifacts, providers, and estimated resource conflicts', () => {
  const required = definition();
  const noArtifact = projectModelPackBundles({
    definitions: [required], catalogItems: [], models: [], providers: [], runtime,
    discoveredEntries: [], availableRamMb: 4096
  })[0];
  assert.equal(noArtifact?.state, 'MISSING_ARTIFACT');

  const providerDefinition = ModelPackDefinition.parse({
    ...required, provider_dependencies: ['opencode']
  });
  const missingProvider = projectModelPackBundles({
    definitions: [providerDefinition], catalogItems: [catalogItem('qwen.gguf', null)], models: [], providers: [], runtime,
    discoveredEntries: [], availableRamMb: 4096
  })[0];
  assert.equal(missingProvider?.state, 'MISSING_PROVIDER');

  const resourceConflict = projectModelPackBundles({
    definitions: [ModelPackDefinition.parse({ ...required, resource_expectations: { ram_mb: 1000, vram_mb: null, disk_mb: null } })],
    catalogItems: [catalogItem('qwen.gguf', null)], models: [], providers: [], runtime,
    discoveredEntries: [], availableRamMb: 100
  })[0];
  assert.equal(resourceConflict?.state, 'RESOURCE_INCOMPATIBLE');
  assert.ok(resourceConflict?.block_reasons.includes('RESOURCE_INCOMPATIBLE'));
});

test('Model Pack lifecycle distinguishes available, partially installed, installed, and runtime-blocked bundles', () => {
  const first = catalogItem('qwen.gguf', 'a'.repeat(64));
  const second = { ...catalogItem('qwen-second.gguf', null), id: 'qwen-second' };
  const installedModel = localModel();
  const available = projectModelPackBundles({
    definitions: [definition()], catalogItems: [first], models: [], providers: [], runtime,
    discoveredEntries: [], availableRamMb: 4096
  })[0];
  assert.equal(available?.state, 'AVAILABLE');

  const twoModelDefinition = ModelPackDefinition.parse({
    ...definition(), required_models: [
      { model_id: 'qwen-local', roles: ['IMPLEMENTER'] },
      { model_id: 'qwen-second', roles: ['REVIEWER'] }
    ]
  });
  const partial = projectModelPackBundles({
    definitions: [twoModelDefinition], catalogItems: [first, second], models: [installedModel], providers: [], runtime,
    discoveredEntries: [], availableRamMb: 4096
  })[0];
  assert.equal(partial?.installation_state, 'PARTIALLY_INSTALLED');
  assert.equal(partial?.state, 'PARTIALLY_INSTALLED');

  const noQualificationRequirement = ModelPackDefinition.parse({ ...definition(), qualification_requirements: [] });
  const installed = projectModelPackBundles({
    definitions: [noQualificationRequirement], catalogItems: [first], models: [installedModel], providers: [], runtime,
    discoveredEntries: [], availableRamMb: 4096
  })[0];
  assert.equal(installed?.installation_state, 'INSTALLED');
  assert.equal(installed?.state, 'INSTALLED');

  const unavailableRuntime = projectModelPackBundles({
    definitions: [definition()], catalogItems: [first], models: [installedModel], providers: [],
    runtime: { ...runtime, health: 'UNAVAILABLE' }, discoveredEntries: [], availableRamMb: 4096
  })[0];
  assert.equal(unavailableRuntime?.state, 'RUNTIME_UNAVAILABLE');
});

test('local Model Pack import verifies source, copied GGUF, and Registry identity without qualifying it', async () => {
  await temporaryWorkspace(async (root, workspace, catalogPath) => {
    const filename = 'qwen.gguf';
    const bytes = minimalGguf();
    const source = path.join(root, filename);
    await fs.writeFile(source, bytes);
    const digest = createHash('sha256').update(bytes).digest('hex');
    await fs.writeFile(catalogPath, JSON.stringify({ packs: [{ ...catalogItem(filename, digest), name: 'Qwen local' }] }), 'utf8');

    const installer = createModelPackInstaller({ workspace, modelPacksPath: catalogPath });
    const plan = await installer.plan({ model_id: 'qwen-local', source_path: source });
    assert.equal(plan.source_sha256, digest);
    const result = await installer.installPlan(plan);
    assert.equal(result.availability, 'INSTALLED');
    assert.equal(result.qualification_state, 'UNTESTED');
    assert.equal(result.runtime, 'UNSLOTH');
    assert.equal(result.identity_verification, 'EXPECTED_HASH_MATCH');
    assert.equal(JSON.stringify(result).includes(root), false);

    const installed = await fs.readFile(path.join(workspace, 'models', filename));
    assert.deepEqual(installed, bytes);
    const registry = new IntelligenceRegistry({ workspace });
    await registry.load();
    const entry = registry.get('qwen-local');
    assert.equal(entry?.availability, 'INSTALLED');
    assert.equal(entry?.qualification.state, 'UNTESTED');
    assert.equal(entry?.artifact?.hash, digest);

    const repeat = await installer.install({ model_id: 'qwen-local', source_path: source });
    assert.equal(repeat.idempotent, true);
    assert.equal(repeat.qualification_state, 'UNTESTED');
  });
});

test('Model Pack route binds a local import to an exact approved write without exposing the path', async () => {
  await temporaryWorkspace(async (root, workspace, catalogPath) => {
    const filename = 'qwen.gguf';
    const bytes = minimalGguf();
    const source = path.join(root, filename);
    await fs.writeFile(source, bytes);
    const digest = createHash('sha256').update(bytes).digest('hex');
    await fs.writeFile(catalogPath, JSON.stringify({ packs: [{ ...catalogItem(filename, digest), name: 'Qwen local' }] }), 'utf8');
    const route = routeForModelPackInstall({ workspace, modelPacksPath: catalogPath });
    const request = { model_id: 'qwen-local', source_path: source };
    const ctx = { query: {}, body: request, execution: {} as never };
    const operation = await route.describeOperation?.(ctx, 'pack-install-task');
    assert.equal(operation?.kind, 'capability.write');
    const encodedOperation = JSON.stringify(operation?.args);
    assert.equal(encodedOperation.includes(source), false);
    assert.equal(encodedOperation.includes(digest), true);
    assert.equal(await fs.stat(path.join(workspace, 'models')).then(() => true, () => false), false);

    const result = await route.handler(ctx);
    assert.equal(route.response.safeParse(result).success, true);
    assert.equal(JSON.stringify(result).includes(root), false);
    assert.equal((result as { qualification_state?: string }).qualification_state, 'UNTESTED');
  });
});

test('HTTP Model Pack import requires exact Authority approval and cannot reuse it for another source path', async () => {
  await temporaryWorkspace(async (root, workspace, catalogPath) => {
    const filename = 'qwen.gguf';
    const bytes = minimalGguf();
    const source = path.join(root, 'source-a', filename);
    const alternateSource = path.join(root, 'source-b', filename);
    await fs.mkdir(path.dirname(source), { recursive: true });
    await fs.mkdir(path.dirname(alternateSource), { recursive: true });
    await fs.writeFile(source, bytes);
    await fs.writeFile(alternateSource, bytes);
    const digest = createHash('sha256').update(bytes).digest('hex');
    await fs.writeFile(catalogPath, JSON.stringify({ packs: [{ ...catalogItem(filename, digest), name: 'Qwen local' }] }), 'utf8');

    const server = new ArchServer(workspace, path.join(root, 'model-pack-authority.log'));
    let httpServer: http.Server | undefined;
    try {
      for (const route of routesForAuthority()) server.route(route);
      server.route(routeForModelPackInstall({ workspace, modelPacksPath: catalogPath }));
      httpServer = await server.listen(0);
      const address = httpServer.address();
      assert.ok(address && typeof address === 'object');
      const base = `http://127.0.0.1:${address.port}`;
      const owner = await pairFixture(server, base);
      const body = { model_id: 'qwen-local', source_path: source };
      const anonymous = await fetch(`${base}/api/models/manager/packs/install`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body)
      });
      assert.equal(anonymous.status, 403);
      assert.equal((await owner.request('/api/models/manager/packs/install', { method: 'POST', body: JSON.stringify(body) })).status, 409);
      assert.equal(await fs.stat(path.join(workspace, 'models')).then(() => true, () => false), false);

      const approval = await owner.approve('POST', '/api/models/manager/packs/install', body, 'task:model-pack-exact-path');
      const changedBody = { ...body, source_path: alternateSource };
      const reused = await owner.request('/api/models/manager/packs/install', { method: 'POST', headers: approval, body: JSON.stringify(changedBody) });
      assert.equal(reused.status, 409, 'approval for one source path cannot authorize another');
      assert.equal(await fs.stat(path.join(workspace, 'models')).then(() => true, () => false), false);

      const exactApproval = await owner.approve('POST', '/api/models/manager/packs/install', body, 'task:model-pack-approved');
      const installed = await owner.request('/api/models/manager/packs/install', { method: 'POST', headers: exactApproval, body: JSON.stringify(body) });
      assert.equal(installed.status, 200);
      const envelope = await installed.json() as { ok: boolean; data?: { availability: string; qualification_state: string } };
      assert.equal(envelope.ok, true);
      assert.equal(envelope.data?.availability, 'INSTALLED');
      assert.equal(envelope.data?.qualification_state, 'UNTESTED');
      assert.equal(JSON.stringify(envelope).includes(root), false);
    } finally {
      if (httpServer) {
        httpServer.closeAllConnections();
        await new Promise<void>(resolve => httpServer!.close(() => resolve()));
      }
      server.authority.control.close();
      server.events.close();
      await server.logger.flush();
    }
  });
});

test('local Model Pack import rejects wrong hashes and malformed artifacts before registration', async () => {
  await temporaryWorkspace(async (root, workspace, catalogPath) => {
    const filename = 'qwen.gguf';
    const source = path.join(root, filename);
    await fs.writeFile(source, Buffer.from('not a GGUF artifact'));
    await fs.writeFile(catalogPath, JSON.stringify({ packs: [{ ...catalogItem(filename, 'b'.repeat(64)), name: 'Qwen local' }] }), 'utf8');
    const installer = createModelPackInstaller({ workspace, modelPacksPath: catalogPath });
    await assert.rejects(() => installer.plan({ model_id: 'qwen-local', source_path: source }), (error: unknown) => error instanceof ModelPackError && error.code === 'BAD_REQUEST');
    assert.equal(await fs.stat(path.join(workspace, 'models')).then(() => true, () => false), false);
    const registry = new IntelligenceRegistry({ workspace });
    await registry.load();
    assert.equal(registry.get('qwen-local'), undefined);
  });
});

test('local Model Pack import fails closed on an invalid Registry and a non-directory managed path', async () => {
  await temporaryWorkspace(async (root, workspace, catalogPath) => {
    const filename = 'qwen.gguf';
    const bytes = minimalGguf();
    const source = path.join(root, filename);
    await fs.writeFile(source, bytes);
    const digest = createHash('sha256').update(bytes).digest('hex');
    await fs.writeFile(catalogPath, JSON.stringify({ packs: [{ ...catalogItem(filename, digest), name: 'Qwen local' }] }), 'utf8');
    const installer = createModelPackInstaller({ workspace, modelPacksPath: catalogPath });
    await fs.mkdir(path.join(workspace, '.aide', 'intelligence'), { recursive: true });
    await fs.writeFile(path.join(workspace, '.aide', 'intelligence', 'registry.json'), '{invalid', 'utf8');
    await assert.rejects(() => installer.install({ model_id: 'qwen-local', source_path: source }), (error: unknown) => error instanceof ModelPackError && error.code === 'NOT_READY');
    await fs.rm(path.join(workspace, '.aide'), { recursive: true, force: true });
    await fs.writeFile(path.join(workspace, 'models'), 'not-a-directory');
    await assert.rejects(() => installer.install({ model_id: 'qwen-local', source_path: source }), (error: unknown) => error instanceof ModelPackError && error.code === 'BAD_REQUEST');
    assert.equal(await fs.readFile(path.join(workspace, 'models'), 'utf8'), 'not-a-directory');
  });
});
