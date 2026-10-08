import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { createHubService } from '../../node/src/services/modelhub.mjs';
import { logEgress } from '../../node/src/services/egress-journal.mjs';
import { probeGguf } from '../../node/src/services/gguf.ts';

let tmpRoot;
let ws;
let modelsDir;
const allowExternalEgress = () => true;
const REVISION = 'a'.repeat(40);

function verifiedArtifact(payload) {
  return {
    revision: REVISION,
    expected_sha256: createHash('sha256').update(payload).digest('hex'),
    expected_size_bytes: payload.length
  };
}

beforeEach(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'aide-m-hub-'));
  ws = path.join(tmpRoot, 'ws');
  modelsDir = path.join(ws, 'models');
  await fs.mkdir(modelsDir, { recursive: true });
});

afterEach(async () => {
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

function u32(value) {
  const buf = Buffer.alloc(4);
  buf.writeUInt32LE(value);
  return buf;
}

function u64(value) {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(BigInt(value));
  return buf;
}

function str(value) {
  return Buffer.concat([u64(Buffer.byteLength(value)), Buffer.from(value, 'utf8')]);
}

const TYPE_UINT32 = 4;
const TYPE_STRING = 8;

function kv(key, type, value) {
  if (type === TYPE_STRING) return Buffer.concat([str(key), u32(TYPE_STRING), str(value)]);
  return Buffer.concat([str(key), u32(type), u32(value)]);
}

function synthesizeGguf({ architecture = 'llama', blockCount = 2, license = null } = {}) {
  const kvs = [
    kv('general.architecture', TYPE_STRING, architecture),
    kv('general.name', TYPE_STRING, 'tiny-test'),
    kv('general.file_type', TYPE_UINT32, 1)
  ];
  if (license !== null) kvs.push(kv('general.license', TYPE_STRING, license));
  if (architecture === 'llama') {
    kvs.push(kv(`${architecture}.block_count`, TYPE_UINT32, blockCount));
    kvs.push(kv(`${architecture}.context_length`, TYPE_UINT32, 512));
  }
  const header = Buffer.concat([
    Buffer.from('GGUF', 'utf8'),
    u32(3),
    u64(0),
    u64(kvs.length),
    ...kvs
  ]);
  return Buffer.concat([header, Buffer.alloc(1024, 7)]);
}

const HF_FIXTURE = [
  { id: 'testorg/tiny-gguf', downloads: 12345, likes: 42, tags: ['gguf', 'llama'] },
  { id: 'otherorg/small-gguf', downloads: 999, likes: 7, tags: ['gguf'] }
];

test('m1: search maps HF fixture through injectable fetcher and journals egress before call', async () => {
  let called = false;
  const hub = createHubService({
    workspace: ws,
    modelsDir,
    assertExternalEgressAllowed: allowExternalEgress,
    fetchImpl: async () => {
      called = true;
      return {
        ok: true,
        status: 200,
        json: async () => HF_FIXTURE
      };
    }
  });
  const result = await hub.search('tiny', 'downloads', 20);
  assert.equal(called, true);
  assert.deepEqual(result.models.map(m => m.repo_id).sort(), ['otherorg/small-gguf', 'testorg/tiny-gguf']);
  assert.equal(result.models[0].downloads >= result.models[1].downloads, true);
  const journalPath = path.join(ws, '.aide', 'egress', 'journal.jsonl');
  const journal = await fs.readFile(journalPath, 'utf8');
  assert.match(journal, /huggingface\.co\/api\/models/);
});

test('modelhub: missing Authority egress guard fails closed before network contact', async () => {
  let calls = 0;
  const hub = createHubService({
    workspace: ws,
    modelsDir,
    fetchImpl: async () => { calls += 1; return new Response('unexpected', { status: 200 }); }
  });
  await assert.rejects(() => hub.search('fixture'), error => error.code === 'NOT_READY');
  assert.equal(calls, 0);
});

test('m1: metadata fetches abort on the configured timeout instead of hanging', async () => {
  const fetchImpl = async (_url, options = {}) => await new Promise((_resolve, reject) => {
    const fail = () => reject(new DOMException('timed out', 'AbortError'));
    if (options.signal?.aborted) fail();
    else options.signal?.addEventListener('abort', fail, { once: true });
  });
  const hub = createHubService({ workspace: ws, modelsDir, assertExternalEgressAllowed: allowExternalEgress, fetchImpl, metadataTimeoutMs: 40 });
  const started = Date.now();
  await assert.rejects(() => hub.search('hung'), error => error?.code === 'TIMEOUT' && /timed out/i.test(error.message));
  assert.ok(Date.now() - started < 1000, 'metadata request must settle on the configured bound');
  await assert.rejects(() => hub.listRepoFiles('org/hung'), error => error?.code === 'TIMEOUT' && /timed out/i.test(error.message));
});

test('m1: repository inspection returns immutable revision, LFS digest, size, and custom license name', async () => {
  const hub = createHubService({
    workspace: ws,
    modelsDir,
    assertExternalEgressAllowed: allowExternalEgress,
    fetchImpl: async () => new Response(JSON.stringify({
      sha: REVISION,
      cardData: { license: 'other', license_name: 'lfm1.0', license_link: 'LICENSE' },
      siblings: [
        { rfilename: 'LFM2.5-Q4_K_M.gguf', size: 12, lfs: { oid: 'D'.repeat(64), size: 12 } },
        { rfilename: 'README.md', size: 40 }
      ]
    }), { status: 200 })
  });
  const listing = await hub.listRepoFiles('LiquidAI/model');
  assert.deepEqual(listing, {
    repo_id: 'LiquidAI/model',
    revision: REVISION,
    license: 'lfm1.0',
    files: [{ filename: 'LFM2.5-Q4_K_M.gguf', size: 12, lfs_sha256: 'd'.repeat(64) }]
  });
});

test('m1: repository inspection maps Hugging Face RepoFile lfs.sha256 metadata', async () => {
  const expectedSha256 = 'e'.repeat(64);
  const hub = createHubService({
    workspace: ws,
    modelsDir,
    assertExternalEgressAllowed: allowExternalEgress,
    fetchImpl: async () => new Response(JSON.stringify({
      sha: REVISION,
      cardData: { license: 'apache-2.0' },
      siblings: [
        { rfilename: 'LFM2.5-Q4_K_M.gguf', size: 12, lfs: { sha256: expectedSha256, size: 12, pointer_size: 134 } }
      ]
    }), { status: 200 })
  });

  const listing = await hub.listRepoFiles('LiquidAI/model');
  assert.equal(listing.license, 'apache-2.0');
  assert.equal(listing.files[0].lfs_sha256, expectedSha256);
  assert.equal(listing.files[0].size, 12);
});

test('m1: download rejects missing immutable pins before network contact', () => {
  let calls = 0;
  const hub = createHubService({
    workspace: ws,
    modelsDir,
    assertExternalEgressAllowed: allowExternalEgress,
    fetchImpl: async () => { calls += 1; return new Response('unexpected', { status: 200 }); }
  });
  assert.throws(() => hub.beginDownload({ repo_id: 'org/repo', filename: 'model.gguf' }), error => error?.code === 'VALIDATION');
  assert.equal(calls, 0);
});

test('m1: mismatched LFS digest and invalid GGUF never publish a final artifact or ready manifest', async () => {
  const payload = synthesizeGguf();
  const hub = createHubService({
    workspace: ws,
    modelsDir,
    assertExternalEgressAllowed: allowExternalEgress,
    fetchImpl: async () => new Response(payload, { status: 200, headers: { 'content-length': String(payload.length) } })
  });
  await hub.startDownload({
    repo_id: 'org/repo', filename: 'mismatch.gguf', quant_label: null,
    ...verifiedArtifact(payload), expected_sha256: 'f'.repeat(64)
  });
  assert.equal(hub.listDownloads()[0]?.status, 'error');
  await assert.rejects(() => fs.access(path.join(modelsDir, 'mismatch.gguf')));
  await assert.rejects(() => fs.access(path.join(modelsDir, 'mismatch.gguf.manifest.json')));

  const invalid = Buffer.from('not-a-gguf');
  const invalidHub = createHubService({
    workspace: ws,
    modelsDir,
    assertExternalEgressAllowed: allowExternalEgress,
    fetchImpl: async () => new Response(invalid, { status: 200, headers: { 'content-length': String(invalid.length) } })
  });
  await invalidHub.startDownload({
    repo_id: 'org/repo', filename: 'invalid.gguf', quant_label: null,
    ...verifiedArtifact(invalid)
  });
  assert.equal(invalidHub.listDownloads()[0]?.status, 'error');
  await assert.rejects(() => fs.access(path.join(modelsDir, 'invalid.gguf')));
  await assert.rejects(() => fs.access(path.join(modelsDir, 'invalid.gguf.manifest.json')));
});

test('m1: happy-path download streams to final file with manifest and no .part left', { timeout: 15000 }, async () => {
  const payload = synthesizeGguf();
  const server = http.createServer((_req, res) => {
    res.setHeader('content-length', String(payload.length));
    res.setHeader('etag', '"abc123"');
    res.end(payload);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const hub = createHubService({
    workspace: ws,
    modelsDir,
    assertExternalEgressAllowed: allowExternalEgress,
    fetchImpl: (url, options) => fetch(url, options)
  });
  try {
    await hub.startDownload({
      repo_id: 'testorg/tiny-gguf',
      filename: 'tiny-q4.gguf',
      quant_label: 'Q4_K_M',
      ...verifiedArtifact(payload),
      urlTemplate: `http://127.0.0.1:${port}/resolve/{revision}/{filename}`
    });
    const doneEvent = hub.listEvents().find(event => event.event === 'done');
    assert.ok(doneEvent, 'expected a done event');
    assert.equal(doneEvent.bytes_total, payload.length);

    const saved = await fs.readFile(path.join(modelsDir, 'tiny-q4.gguf'));
    assert.equal(saved.equals(payload), true);
    await assert.rejects(() => fs.access(path.join(modelsDir, 'tiny-q4.gguf.part')));

    const manifest = JSON.parse(await fs.readFile(path.join(modelsDir, 'tiny-q4.gguf.manifest.json'), 'utf8'));
    assert.equal(manifest.repo_id, 'testorg/tiny-gguf');
    assert.equal(manifest.size_bytes, payload.length);
    assert.equal(manifest.revision, REVISION);
    assert.equal(manifest.expected_sha256, verifiedArtifact(payload).expected_sha256);
    assert.equal(manifest.sha256, verifiedArtifact(payload).expected_sha256);
    assert.equal(manifest.source, 'hf');
    assert.equal(manifest.status, 'ready');
    assert.equal(manifest.etag, '"abc123"');

    const jobs = hub.listDownloads();
    assert.equal(jobs[0].status, 'done');
  } finally {
    server.close();
    server.closeAllConnections();
  }
});

test('m1: downloaded manifest preserves pinned Hugging Face license name beside GGUF metadata', { timeout: 15000 }, async () => {
  const payload = synthesizeGguf({ license: 'other' });
  const pins = verifiedArtifact(payload);
  const observedUrls = [];
  const hub = createHubService({
    workspace: ws,
    modelsDir,
    assertExternalEgressAllowed: allowExternalEgress,
    fetchImpl: async url => {
      const value = String(url);
      observedUrls.push(value);
      if (value.startsWith('https://huggingface.co/api/models/')) {
        return new Response(JSON.stringify({
          sha: REVISION,
          cardData: { license: 'other', license_name: 'lfm1.0', license_link: 'LICENSE' },
          siblings: [{ rfilename: 'licensed-q4.gguf', size: payload.length, lfs: { sha256: pins.expected_sha256, size: payload.length } }]
        }), { status: 200 });
      }
      return new Response(payload, { status: 200, headers: { 'content-length': String(payload.length) } });
    }
  });

  const inspected = await hub.listRepoFiles('LiquidAI/LFM2.5-2.6B-GGUF');
  assert.equal(inspected.revision, REVISION);
  assert.equal(inspected.license, 'lfm1.0');
  assert.equal(inspected.files[0].lfs_sha256, pins.expected_sha256);
  assert.equal(inspected.files[0].size, pins.expected_size_bytes);

  await hub.startDownload({
    repo_id: 'LiquidAI/LFM2.5-2.6B-GGUF',
    filename: 'licensed-q4.gguf',
    quant_label: 'Q4_K_M',
    ...pins
  });

  const manifest = JSON.parse(await fs.readFile(path.join(modelsDir, 'licensed-q4.gguf.manifest.json'), 'utf8'));
  assert.equal(manifest.license, 'other', 'keep the artifact-embedded GGUF value');
  assert.equal(manifest.repository_license, 'lfm1.0', 'preserve the exact revision card license name separately');
  assert.ok(observedUrls.some(url => url === 'https://huggingface.co/api/models/LiquidAI/LFM2.5-2.6B-GGUF?blobs=true'), 'server-derived license came from the inspected repository response');
});

test('m1: a download cannot change file pins after its repository revision was inspected', async () => {
  const payload = synthesizeGguf();
  const pins = verifiedArtifact(payload);
  let downloads = 0;
  const hub = createHubService({
    workspace: ws,
    modelsDir,
    assertExternalEgressAllowed: allowExternalEgress,
    fetchImpl: async url => {
      if (String(url).startsWith('https://huggingface.co/api/models/')) {
        return new Response(JSON.stringify({
          sha: REVISION,
          cardData: { license: 'mit' },
          siblings: [{ rfilename: 'pinned.gguf', size: payload.length, lfs: { sha256: pins.expected_sha256, size: payload.length } }]
        }), { status: 200 });
      }
      downloads += 1;
      return new Response(payload, { status: 200, headers: { 'content-length': String(payload.length) } });
    }
  });

  await hub.listRepoFiles('testorg/repo');
  assert.throws(() => hub.beginDownload({
    repo_id: 'testorg/repo',
    filename: 'pinned.gguf',
    revision: REVISION,
    expected_sha256: 'f'.repeat(64),
    expected_size_bytes: payload.length
  }), error => error?.code === 'VALIDATION' && /inspected Hugging Face file metadata/i.test(error.message));
  assert.equal(downloads, 0, 'mismatched pins are rejected before artifact egress');
});

test('m1: interrupted download auto-resumes via Range request and completes', { timeout: 20000 }, async () => {
  const header = synthesizeGguf();
  const payload = Buffer.concat([header, Buffer.alloc(48 * 1024 - header.length, 0xCD)]);
  let requests = 0;
  const prefixLength = 16 * 1024;
  const rangeHeaders = [];
  const fetchImpl = async (_url, init) => {
    requests += 1;
    const range = new Headers(init?.headers).get('range');
    rangeHeaders.push(range);
    if (requests === 1) {
      let prefixSent = false;
      const body = new ReadableStream({
        pull(controller) {
          if (!prefixSent) {
            prefixSent = true;
            controller.enqueue(payload.subarray(0, prefixLength));
            return;
          }
          controller.error(new Error('fixture interrupted after prefix'));
        }
      }, { highWaterMark: 0 });
      return new Response(body, { status: 200, headers: { 'content-length': String(payload.length) } });
    }
    const match = /bytes=(\d+)-/.exec(range ?? '');
    const start = match ? Number(match[1]) : 0;
    if (start !== prefixLength) return new Response(null, { status: 416 });
    return new Response(payload.subarray(start), {
      status: 206,
      headers: { 'content-length': String(payload.length - start) }
    });
  };
  const hub = createHubService({
    workspace: ws,
    modelsDir,
    assertExternalEgressAllowed: allowExternalEgress,
    fetchImpl
  });
  await hub.startDownload({
    repo_id: 'testorg/resume',
    filename: 'resume.gguf',
    quant_label: null,
    ...verifiedArtifact(payload),
    urlTemplate: 'http://fixture.invalid/resolve/{revision}/{filename}'
  });
  const doneEvent = hub.listEvents().find(event => event.event === 'done');
  assert.ok(doneEvent, 'expected done after resume');
  assert.equal(doneEvent.bytes_total, payload.length);
  const saved = await fs.readFile(path.join(modelsDir, 'resume.gguf'));
  assert.equal(saved.equals(payload), true);
  assert.deepEqual(rangeHeaders, [null, `bytes=${prefixLength}-`], 'retry resumes from the fully persisted prefix');
  assert.equal(requests, 2);
  const errorEvents = hub.listEvents().filter(event => event.event === 'error');
  assert.equal(errorEvents.length >= 1, true, 'the interruption should surface as an error event before recovery');
});

test('m1: stalled download stream hits the idle timeout, retries boundedly, and never publishes final artifact', { timeout: 5000 }, async () => {
  let requests = 0;
  const server = http.createServer((_req, res) => {
    requests += 1;
    res.setHeader('content-length', String(1024));
    res.write(Buffer.alloc(4, 0x22));
    // Deliberately never end: the client-side idle watchdog must abort.
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const hub = createHubService({
    workspace: ws,
    modelsDir,
    assertExternalEgressAllowed: allowExternalEgress,
    fetchImpl: (url, options) => fetch(url, options),
    downloadIdleTimeoutMs: 60
  });
  try {
    const started = Date.now();
    await hub.startDownload({
      repo_id: 'testorg/stalled',
      filename: 'stalled.gguf',
      quant_label: null,
      revision: REVISION,
      expected_sha256: 'b'.repeat(64),
      expected_size_bytes: 1024,
      urlTemplate: `http://127.0.0.1:${port}/resolve/{revision}/{filename}`
    });
    assert.ok(Date.now() - started < 2000, 'three bounded retries must settle quickly in the fixture');
    assert.equal(requests, 3, 'transient timeout retries are capped at three attempts');
    const job = hub.listDownloads()[0];
    assert.equal(job.status, 'error');
    assert.match(job.error ?? '', /timed out/i);
    assert.equal(hub.listEvents().some(event => event.event === 'done'), false);
    await assert.rejects(() => fs.access(path.join(modelsDir, 'stalled.gguf')));
    const part = await fs.stat(path.join(modelsDir, 'stalled.gguf.part'));
    assert.ok(part.size > 0, 'partial bytes remain resumable after a timeout');
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(() => resolve()));
  }
});

test('m1: cancel aborts mid-stream, deletes .part, emits cancelled and never done', { timeout: 12000 }, async () => {
  const server = http.createServer((_req, res) => {
    res.setHeader('content-length', String(10 * 1024 * 1024));
    const timer = setInterval(() => res.write(Buffer.alloc(64 * 1024, 0x11)), 20);
    res.on('close', () => clearInterval(timer));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const hub = createHubService({
    workspace: ws,
    modelsDir,
    assertExternalEgressAllowed: allowExternalEgress,
    fetchImpl: (url, options) => fetch(url, options)
  });
  try {
    const jobPromise = hub.startDownload({
      repo_id: 'testorg/slow',
      filename: 'slow.gguf',
      quant_label: null,
      revision: REVISION,
      expected_sha256: 'c'.repeat(64),
      expected_size_bytes: 10 * 1024 * 1024,
      urlTemplate: `http://127.0.0.1:${port}/resolve/{revision}/{filename}`
    });
    jobPromise.catch(() => {});
    await new Promise(resolve => setTimeout(resolve, 400));
    const running = hub.listDownloads().find(job => job.status === 'running');
    assert.ok(running, 'expected a running download');
    const cancelled = await hub.cancel(running.job_id);
    assert.equal(cancelled.cancelled, true);
    await jobPromise;
    await new Promise(resolve => setTimeout(resolve, 200));
    await assert.rejects(() => fs.access(path.join(modelsDir, 'slow.gguf.part')));
    await assert.rejects(() => fs.access(path.join(modelsDir, 'slow.gguf')));
    const events = hub.listEvents();
    assert.equal(events.some(event => event.event === 'cancelled'), true);
    assert.equal(events.some(event => event.event === 'done'), false);
    assert.equal(hub.listDownloads()[0].status, 'cancelled');
  } finally {
    server.close();
    server.closeAllConnections();
  }
});

test('m3: import valid gguf copies into models dir; invalid rejects; unsupported arch flagged', async () => {
  const src = path.join(tmpRoot, 'outside.gguf');
  await fs.writeFile(src, synthesizeGguf());
  const hub = createHubService({ workspace: ws, modelsDir });

  const imported = await hub.importFromPath(src);
  assert.equal(imported.manifest.source, 'manual');
  assert.equal(imported.manifest.status, 'ready');
  assert.equal(imported.manifest.architecture, 'llama');
  const copied = await fs.readFile(path.join(modelsDir, 'outside.gguf'));
  const original = await fs.readFile(src);
  assert.equal(copied.equals(original), true);

  const bad = path.join(tmpRoot, 'bad.gguf');
  await fs.writeFile(bad, Buffer.from('NOTGGUFL!', 'utf8'));
  await assert.rejects(
    () => hub.importFromPath(bad),
    error => error != null && typeof error === 'object' && error.code === 'IMPORT_INVALID'
  );

  const weird = path.join(tmpRoot, 'weird.gguf');
  await fs.writeFile(weird, synthesizeGguf({ architecture: 'madeupspec' }));
  const flagged = await hub.importFromPath(weird);
  assert.equal(flagged.manifest.status, 'unsupported-runtime');

  const parsed = await probeGguf(path.join(modelsDir, 'outside.gguf'));
  assert.equal(parsed.blockCount, 2);
});

test('egress journal appends structured entries', async () => {
  logEgress(ws, { action: 'modelhub.search', url: 'https://example.test/x' });
  logEgress(ws, { action: 'modelhub.download', url: 'https://example.test/y' });
  const lines = (await fs.readFile(path.join(ws, '.aide', 'egress', 'journal.jsonl'), 'utf8')).trim().split('\n');
  assert.equal(lines.length, 2);
  const entry = JSON.parse(lines[1]);
  assert.equal(entry.action, 'modelhub.download');
  assert.equal(typeof entry.ts, 'string');
});
