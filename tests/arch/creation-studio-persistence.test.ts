import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ArchServer } from '../../node/src/server.ts';
import { buildRoutes } from '../../node/src/openapi.ts';
import { createCreationStudioService } from '../../node/src/services/creation-studio-service.mjs';
import { CreationStudioListResponse, CreationStudioRecord } from '../../common/contracts/creation-studio.ts';
import { pairFixture } from './authority-fixture.ts';

const production = (title = 'Old Republic Pilot') => ({
  production_id: 'production-old-republic-pilot',
  title,
  premise: 'A governed local-first production test.',
  target_duration_seconds: 900,
  status: 'DRAFT' as const,
  execution_connection: 'NOT_CONNECTED' as const,
  scenes: [{
    scene_id: 'scene-001',
    order: 0,
    title: 'Ancient ruins',
    summary: 'Opening investigation.',
    shots: [{
      shot_id: 'shot-0001',
      order: 0,
      prompt: 'Slow cinematic push through ancient ruins at dawn.',
      duration_seconds: 8,
      aspect_ratio: '2.39:1' as const,
      state: 'PLANNED' as const,
      assignments: [{ capability: 'VIDEO' as const, provider_id: null, model_id: null, state: 'UNASSIGNED' as const }]
    }]
  }]
});

const bible = [{
  entry_id: 'character-hero',
  category: 'CHARACTER' as const,
  title: 'Hero',
  content: 'Dark travel cloak, scar above left eyebrow.',
  status: 'APPROVED' as const
}];

const continuity = [{
  entry_id: 'continuity-ruins-light',
  scope_kind: 'SCENE' as const,
  scope_id: 'scene-001',
  title: 'Ruins light',
  content: 'Dawn light remains from camera-left.',
  status: 'ACTIVE' as const
}];

const request = (expected_revision: number, title = 'Old Republic Pilot') => ({
  expected_revision,
  production: production(title),
  bible_entries: bible,
  continuity_entries: continuity
});

test('Creation Studio persists canonical production, Bible and continuity with revision identity across reconstruction', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'covert-creation-studio-'));
  try {
    let instant = new Date('2026-10-10T01:00:00.000Z');
    const first = createCreationStudioService({ workspace: root, now: () => instant });
    const created = CreationStudioRecord.parse(first.put(request(0)));
    assert.equal(created.revision, 1);
    assert.equal(created.updated_at, instant.toISOString());
    assert.deepEqual(created.bible_entries, bible);
    assert.deepEqual(created.continuity_entries, continuity);

    const reconstructed = createCreationStudioService({ workspace: root, now: () => instant });
    const listed = CreationStudioListResponse.parse(reconstructed.list());
    assert.equal(listed.records.length, 1);
    assert.deepEqual(listed.records[0], created);

    instant = new Date('2026-10-10T01:01:00.000Z');
    const updated = CreationStudioRecord.parse(reconstructed.put(request(1, 'Old Republic Pilot — revised')));
    assert.equal(updated.revision, 2);
    assert.equal(updated.production.title, 'Old Republic Pilot — revised');
    assert.deepEqual(updated.bible_entries, bible);
    assert.deepEqual(updated.continuity_entries, continuity);

    assert.throws(
      () => reconstructed.put(request(1, 'stale overwrite')),
      (error: unknown) => (error as { code?: string }).code === 'CONFLICT'
    );
    const current = CreationStudioListResponse.parse(reconstructed.list()).records[0];
    assert.ok(current);
    assert.equal(current.production.title, 'Old Republic Pilot — revised');
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('Creation Studio fails closed on corrupt persisted state instead of treating it as an empty store', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'covert-creation-studio-corrupt-'));
  const store = path.join(root, '.aide', 'creation-studio', 'productions.json');
  try {
    await fs.mkdir(path.dirname(store), { recursive: true });
    const corrupt = '{"not":"an array"}';
    await fs.writeFile(store, corrupt, 'utf8');
    const service = createCreationStudioService({ workspace: root });
    assert.throws(
      () => service.list(),
      (error: unknown) => (error as { code?: string }).code === 'CORRUPT_STATE'
    );
    assert.throws(
      () => service.put(request(0)),
      (error: unknown) => (error as { code?: string }).code === 'CORRUPT_STATE'
    );
    assert.equal(await fs.readFile(store, 'utf8'), corrupt);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('Creation Studio HTTP write is Authority-governed and GET returns the canonical persisted record', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'covert-creation-studio-http-'));
  const arch = new ArchServer(root, path.join(root, 'arch.log'));
  for (const route of await buildRoutes(root, 'test', { authority: arch.authority, events: arch.events })) arch.route(route);
  const server = await arch.listen(0);
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const base = 'http://127.0.0.1:' + address.port;
  const owner = await pairFixture(arch, base);
  try {
    const empty = await owner.request('/api/creation-studio/productions');
    assert.equal(empty.status, 200);
    assert.deepEqual(CreationStudioListResponse.parse((await empty.json()).data).records, []);

    const body = request(0);
    const unapproved = await owner.request('/api/creation-studio/production', {
      method: 'PUT',
      body: JSON.stringify(body)
    });
    assert.equal(unapproved.status, 409);
    assert.equal((await unapproved.json()).error.code, 'NOT_READY');

    const headers = await owner.approve('PUT', '/api/creation-studio/production', body, 'creation-studio-save');
    const saved = await owner.request('/api/creation-studio/production', {
      method: 'PUT',
      headers,
      body: JSON.stringify(body)
    });
    assert.equal(saved.status, 200);
    const record = CreationStudioRecord.parse((await saved.json()).data);
    assert.equal(record.revision, 1);

    const read = await owner.request('/api/creation-studio/productions');
    assert.equal(read.status, 200);
    const records = CreationStudioListResponse.parse((await read.json()).data).records;
    assert.equal(records.length, 1);
    assert.deepEqual(records[0], record);

    const route = arch.getRoutes().find(candidate => candidate.method === 'PUT' && candidate.path === '/api/creation-studio/production');
    assert.ok(route?.describeOperation);
    const operation = await route.describeOperation!({ query: {}, body, actor: undefined as never }, 'creation-studio-proof');
    const serialized = JSON.stringify(operation);
    assert.match(serialized, /input_digest_sha256/);
    assert.doesNotMatch(serialized, /Dark travel cloak|Dawn light|governed local-first production test/);
  } finally {
    arch.events.close();
    arch.authority.control.close();
    await arch.logger.flush();
    await new Promise<void>(resolve => server.close(() => resolve()));
    await fs.rm(root, { recursive: true, force: true });
  }
});
