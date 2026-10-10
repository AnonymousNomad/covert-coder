import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import { promises as fs } from 'node:fs';
import type http from 'node:http';
import { ArchServer } from '../../node/src/server.ts';
import { ModelRuntime, ModelRuntimeError } from '../../node/src/services/model-runtime.ts';
import { routeForModelReady, routeForModelRegister, routeForModelProfile } from '../../node/src/routes/models.ts';
import { routesForAuthority } from '../../node/src/routes/authority.ts';
import { pairFixture } from './authority-fixture.ts';
import { Envelope } from '../../common/errors.ts';

let dir: string;
let modelDir: string;
let runtime: ModelRuntime;
let server: ArchServer;
let httpServer: http.Server;
let base: string;
let owner: Awaited<ReturnType<typeof pairFixture>>;

function syntheticGgufWithChatTemplate(): Buffer {
  const values = [['general.architecture', 'llama'], ['tokenizer.chat_template', 'messages']];
  const parts: Buffer[] = [];
  const header = Buffer.alloc(24);
  header.write('GGUF', 0, 'utf8');
  header.writeUInt32LE(3, 4);
  header.writeBigUInt64LE(0n, 8);
  header.writeBigUInt64LE(BigInt(values.length), 16);
  parts.push(header);
  for (const [key, value] of values) {
    const keyBytes = Buffer.from(key!, 'utf8');
    const valueBytes = Buffer.from(value!, 'utf8');
    const item = Buffer.alloc(8 + keyBytes.length + 4 + 8 + valueBytes.length);
    let offset = 0;
    item.writeBigUInt64LE(BigInt(keyBytes.length), offset); offset += 8;
    keyBytes.copy(item, offset); offset += keyBytes.length;
    item.writeUInt32LE(8, offset); offset += 4;
    item.writeBigUInt64LE(BigInt(valueBytes.length), offset); offset += 8;
    valueBytes.copy(item, offset);
    parts.push(item);
  }
  return Buffer.concat(parts);
}

before(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'aide-model-register-'));
  modelDir = path.join(dir, 'models');
  await fs.mkdir(modelDir, { recursive: true });
  await fs.mkdir(path.join(dir, '.aide'), { recursive: true });
  await fs.writeFile(path.join(modelDir, 'manifest.json'), JSON.stringify({ models: [] }), 'utf8');
  await fs.writeFile(path.join(modelDir, 'fantom-4b.gguf'), syntheticGgufWithChatTemplate());
  await fs.writeFile(path.join(modelDir, 'second.gguf'), syntheticGgufWithChatTemplate());

  runtime = new ModelRuntime({
    workspace: dir,
    manifestPath: path.join(modelDir, 'manifest.json'),
    ingestedPath: path.join(dir, '.aide', 'ingested-models.json'),
    modelDir
  });
  await runtime.load();

  server = new ArchServer(dir, path.join(dir, '.aide', 'arch-model-register.log'));
  for (const route of routesForAuthority()) server.route(route);
  server
    .route(routeForModelReady(runtime))
    .route(routeForModelRegister(runtime))
    .route(routeForModelProfile(runtime));
  httpServer = await server.listen(0);
  const address = httpServer.address();
  assert.ok(address && typeof address === 'object');
  base = `http://127.0.0.1:${address.port}`;
  owner = await pairFixture(server, base);
});

after(async () => {
  server.events.close();
  await server.logger.flush();
  httpServer.closeAllConnections();
  await new Promise<void>(resolve => httpServer.close(() => resolve()));
  await fs.rm(dir, { recursive: true, force: true });
});

function okData(body: unknown): unknown {
  const parsed = Envelope.safeParse(body);
  assert.ok(parsed.success, 'envelope must parse');
  assert.ok(parsed.data.ok, 'envelope must be ok');
  return parsed.data.data;
}

function errorCode(body: unknown): string {
  const parsed = Envelope.safeParse(body);
  assert.ok(parsed.success, 'envelope must parse');
  assert.ok(!parsed.data.ok, 'envelope must be an error');
  return parsed.data.error.code;
}

async function mutate(pathname: string, body: unknown, taskId: string): Promise<Response> {
  const headers = await owner.approve('POST', pathname, body, taskId);
  return owner.request(pathname, { method: 'POST', headers, body: JSON.stringify(body) });
}

const ingestedRaw = () => fs.readFile(path.join(dir, '.aide', 'ingested-models.json'), 'utf8').catch(() => '');

test('POST /api/models/register adds a gguf engine and is idempotent', async () => {
  const first = await mutate('/api/models/register', { filename: 'fantom-4b.gguf', repo_id: 'fantom/org', quant_label: 'Q4_K_M', context_tokens: 4096 }, 'task:mr-first');
  assert.equal(first.status, 200);
  const firstData = okData(await first.json()) as { id: string; status: string; endpoint: string; sha256: string; architecture: string };
  assert.equal(firstData.id, 'fantom-4b');
  assert.equal(firstData.status, 'registered');
  assert.match(firstData.sha256, /^[a-f0-9]{64}$/);
  assert.equal(firstData.architecture, 'llama');
  assert.ok(firstData.endpoint.startsWith('http://127.0.0.1:809'));

  const second = await mutate('/api/models/register', { filename: 'fantom-4b.gguf' }, 'task:mr-second');
  assert.equal(second.status, 200);
  const secondData = okData(await second.json()) as { id: string; status: string; endpoint: string };
  assert.equal(secondData.id, 'fantom-4b');
  assert.equal(secondData.endpoint, firstData.endpoint);

  const restartedRuntime = new ModelRuntime({
    workspace: dir,
    manifestPath: path.join(modelDir, 'manifest.json'),
    ingestedPath: path.join(dir, '.aide', 'ingested-models.json'),
    modelDir
  });
  await restartedRuntime.load({ sweepLegacyEngines: false });
  const restored = restartedRuntime.get(firstData.id);
  assert.ok(restored, 'registered absolute artifact path must survive a runtime restart');
  assert.equal(restored.file, path.join(modelDir, 'fantom-4b.gguf'));
  assert.equal(restored.sha256, firstData.sha256);
});

test('nested external model paths survive runtime restart', async () => {
  const nestedDir = path.join(modelDir, 'nested');
  await fs.mkdir(nestedDir, { recursive: true });
  await fs.writeFile(path.join(nestedDir, 'nested-fantom.gguf'), syntheticGgufWithChatTemplate());
  const registered = await runtime.register({ filename: 'nested/nested-fantom.gguf', repo_id: 'fantom/org' });

  const restartedRuntime = new ModelRuntime({
    workspace: dir,
    manifestPath: path.join(modelDir, 'manifest.json'),
    ingestedPath: path.join(dir, '.aide', 'ingested-models.json'),
    modelDir
  });
  await restartedRuntime.load({ sweepLegacyEngines: false });
  const restored = restartedRuntime.get(registered.id);
  assert.ok(restored, 'nested absolute artifact path must survive a runtime restart');
  assert.equal(restored.file, path.join(nestedDir, 'nested-fantom.gguf'));
  assert.equal(restored.sha256, registered.sha256);
});

test('legacy ingest refuses an artifact outside the canonical model directory', async () => {
  const outsidePath = path.join(dir, 'outside-model.gguf');
  await fs.writeFile(outsidePath, syntheticGgufWithChatTemplate());
  const before = await ingestedRaw();

  await assert.rejects(
    () => runtime.ingest(outsidePath),
    (error: unknown) => error instanceof ModelRuntimeError && error.code === 'NOT_READY' && /within configured AIDE_MODEL_DIR/.test(error.message)
  );

  assert.equal(await ingestedRaw(), before, 'rejected off-root imports do not change persisted model registrations');
});

test('legacy ingest retains exact identity for an artifact within the canonical model directory', async () => {
  const canonicalPath = path.join(modelDir, 'inside-model.gguf');
  await fs.writeFile(canonicalPath, syntheticGgufWithChatTemplate());
  const imported = await runtime.ingest(canonicalPath);

  assert.equal(runtime.get(imported.id)?.file, canonicalPath);
  assert.equal(runtime.get(imported.id)?.sha256, imported.sha256);
  assert.equal((await ingestedRaw()).includes(imported.sha256), true);
});

test('POST /api/models/register rejects non-gguf and escaping filenames', async () => {
  const nonGguf = await owner.request('/api/models/register', { method: 'POST', body: JSON.stringify({ filename: 'notes.txt' }) });
  assert.equal(nonGguf.status, 400);
  assert.equal(errorCode(await nonGguf.json()), 'BAD_REQUEST');

  const escaping = await owner.request('/api/authority/prepare', {
    method: 'POST',
    body: JSON.stringify({ method: 'POST', path: '/api/models/register', body: { filename: '..\\..\\evil.gguf' }, task_id: 'task:mr-escape' })
  });
  assert.equal(escaping.status, 400, 'escaping filename fails before authorization');

  await assert.rejects(
    runtime.register({ filename: '..\\..\\evil.gguf' }),
    (error: unknown) => error instanceof ModelRuntimeError && error.code === 'BAD_REQUEST'
  );
  await assert.rejects(
    runtime.register({ filename: 'missing.gguf' }),
    (error: unknown) => error instanceof ModelRuntimeError && error.code === 'BAD_REQUEST' && error.message.includes('artifact not found')
  );
});

test('POST /api/models/profile applies a preset and writes the sidecar', async () => {
  const res = await mutate('/api/models/profile', { id: 'fantom-4b', preset: 'balanced' }, 'task:mp-preset');
  assert.equal(res.status, 200);
  const data = okData(await res.json()) as { id: string; preset: string; saved: boolean };
  assert.equal(data.id, 'fantom-4b');
  assert.equal(data.preset, 'balanced');
  assert.equal(data.saved, true);

  const sidecarPath = path.join(modelDir, 'fantom-4b.gguf.profile.json');
  const sidecar = JSON.parse(await fs.readFile(sidecarPath, 'utf8')) as { preset?: string; samplers?: Record<string, number> };
  assert.equal(sidecar.preset, 'balanced');
  assert.equal(sidecar.samplers?.temperature, 0.7);
});

test('POST /api/models/profile rejects unknown presets and sampler keys', async () => {
  const badPreset = await mutate('/api/models/profile', { id: 'fantom-4b', preset: 'wildcard' }, 'task:mp-badpreset');
  assert.equal(badPreset.status, 400);
  assert.equal(errorCode(await badPreset.json()), 'BAD_REQUEST');

  const badSampler = await mutate('/api/models/profile', { id: 'fantom-4b', samplers: { temperature: 0.7, do_a_barrel_roll: 1 }, preset: 'custom' }, 'task:mp-badsampler');
  assert.equal(badSampler.status, 400);
  assert.equal(errorCode(await badSampler.json()), 'BAD_REQUEST');
});

test('GET /api/model/ready reports not-ready without a server and 400 without id', async () => {
  const res = await owner.request('/api/model/ready?id=fantom-4b');
  assert.equal(res.status, 200);
  const data = okData(await res.json()) as { id: string; ready: boolean; status: string; endpoint: string };
  assert.equal(data.id, 'fantom-4b');
  assert.equal(data.ready, false);
  assert.ok(data.status === 'not-ready' || data.status === 'conflict', `unexpected status ${data.status}`);
  assert.ok(data.endpoint.startsWith('http://127.0.0.1:809'));

  const noId = await owner.request('/api/model/ready');
  assert.equal(noId.status, 400);
  assert.equal(errorCode(await noId.json()), 'BAD_REQUEST');
});

test('GET /api/model/ready reports not-ready and an allowlist error for an unknown model', async () => {
  const res = await owner.request('/api/model/ready?id=nope');
  assert.equal(res.status, 200);
  const data = okData(await res.json()) as { id: string; ready: boolean; status: string; endpoint: string; error?: string };
  assert.equal(data.id, 'nope');
  assert.equal(data.ready, false);
  assert.equal(data.status, 'not-ready');
  assert.equal(data.endpoint, '');
  assert.match(data.error ?? '', /allowlist/);
});

test('model authority: exact registry/profile binding, zero mutation without approval, no execution', async () => {
  const anonymous = await fetch(`${base}/api/models/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ filename: 'fantom-4b.gguf' })
  });
  assert.equal(anonymous.status, 403, 'anonymous actor rejected');

  const before = await ingestedRaw();
  const blocked = await owner.request('/api/models/register', { method: 'POST', body: JSON.stringify({ filename: 'fantom-4b.gguf' }) });
  assert.equal(blocked.status, 409, 'paired actor without approval fails');
  assert.equal(await ingestedRaw(), before, 'no registration without approval');

  // Changed filename cannot reuse an approval; exact approved target executes.
  const original = { filename: 'second.gguf' };
  const changed = { filename: 'fantom-4b.gguf' };
  const headers = await owner.approve('POST', '/api/models/register', original, 'task:mr-bound');
  const changedAttempt = await owner.request('/api/models/register', { method: 'POST', headers, body: JSON.stringify(changed) });
  assert.equal(changedAttempt.status, 409, 'changed filename cannot reuse approval');
  const applied = await owner.request('/api/models/register', { method: 'POST', headers, body: JSON.stringify(original) });
  assert.equal(applied.status, 200);
  assert.equal((okData(await applied.json()) as { id: string }).id, 'second');
  const replay = await owner.request('/api/models/register', { method: 'POST', headers, body: JSON.stringify(original) });
  assert.equal(replay.status, 409, 'consumed registration approval cannot replay');

  // Profile: model A approval cannot write model B; changed patch cannot reuse.
  const profileBody = { id: 'fantom-4b', preset: 'precise' };
  const profileChanged = { id: 'fantom-4b', preset: 'creative' };
  const profileHeaders = await owner.approve('POST', '/api/models/profile', profileBody, 'task:mp-bound');
  const wrongModel = await owner.request('/api/models/profile', { method: 'POST', headers: profileHeaders, body: JSON.stringify({ id: 'second', preset: 'precise' }) });
  assert.equal(wrongModel.status, 409, 'model A approval cannot profile model B');
  const changedProfile = await owner.request('/api/models/profile', { method: 'POST', headers: profileHeaders, body: JSON.stringify(profileChanged) });
  assert.equal(changedProfile.status, 409, 'changed profile cannot reuse approval');
  const appliedProfile = await owner.request('/api/models/profile', { method: 'POST', headers: profileHeaders, body: JSON.stringify(profileBody) });
  assert.equal(appliedProfile.status, 200);
  const profileReplay = await owner.request('/api/models/profile', { method: 'POST', headers: profileHeaders, body: JSON.stringify(profileBody) });
  assert.equal(profileReplay.status, 409, 'consumed profile approval cannot replay');

  // No hidden execution: registering/profiling never spawns an engine or
  // starts inference, and no authority material reaches the persisted state.
  const ingested = await ingestedRaw();
  assert.match(ingested, /second/);
  const token = owner.headers.Authorization.slice(7);
  assert.ok(!ingested.includes(token) && !ingested.includes(owner.actorId), 'registry must not serialize authority material');
  assert.ok(!ingested.includes(headers['X-AIDE-Operation']), 'registry must not serialize operation ids');
  const sidecar = await fs.readFile(path.join(modelDir, 'fantom-4b.gguf.profile.json'), 'utf8');
  assert.ok(!sidecar.includes(token) && !sidecar.includes(owner.actorId), 'profile sidecar must not serialize authority material');
});
