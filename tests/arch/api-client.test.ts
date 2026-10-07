import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mock } from 'node:test';
import { ApiError, api } from '../../browser/src/services/api.ts';
import { egressFetch } from '../../browser/src/services/egress.ts';
import { ok, fail } from '../../common/errors.ts';
import { healthFixtures, fileReadFixtures, fileWriteFixtures, searchFixtures, searchReplaceFixtures, sessionFixtures, lspFixtures } from '../fixtures/index.ts';

function mockFetch(payload: unknown, status = 200): { seen: { url: string; method: string; format: string | null }[] } {
  const seen: { url: string; method: string; format: string | null }[] = [];
  mock.method(globalThis, 'fetch', async (url: string | URL | Request, init?: RequestInit) => {
    const parsed = new URL(String(url));
    seen.push({ url: parsed.pathname + parsed.search, method: init?.method ?? 'GET', format: new Headers(init?.headers).get('X-AIDE-API-Format') });
    return new Response(JSON.stringify(payload), { status });
  });
  return { seen };
}

test('offline guard refuses non-local urls', async () => {
  await assert.rejects(egressFetch('https://evil.example/x'), /offline guard/);
  await assert.rejects(egressFetch('file:///C:/Windows/win.ini'), /offline guard/);
});

test('api.health returns parsed data from an ok envelope', async () => {
  const payload = healthFixtures.healthy;
  mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify(ok(payload)), { status: 200 }));
  const health = await api.health();
  assert.equal(health.version, 'test');
  assert.equal(health.freeMemoryMB, 5120);
  mock.restoreAll();
});

test('api.modelProfileSave posts the validated exact runtime profile through the shared transport', async () => {
  const seen: Array<{ url: string; method: string; format: string | null; body: unknown }> = [];
  mock.method(globalThis, 'fetch', async (url: string | URL | Request, init?: RequestInit) => {
    seen.push({
      url: new URL(String(url)).pathname,
      method: init?.method ?? 'GET',
      format: new Headers(init?.headers).get('X-AIDE-API-Format'),
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined
    });
    return new Response(JSON.stringify(ok({ id: 'liquid-lfm25-2.6b-q4km', preset: 'custom', saved: true })), { status: 200 });
  });
  try {
    const result = await api.modelProfileSave({
      id: 'liquid-lfm25-2.6b-q4km',
      samplers: { temperature: 0 },
      runtime: { context_tokens: 2048, max_tokens: 512 }
    });
    assert.equal(result.saved, true);
    assert.deepEqual(seen, [{
      url: '/api/models/profile',
      method: 'POST',
      format: 'envelope-v1',
      body: {
        id: 'liquid-lfm25-2.6b-q4km',
        samplers: { temperature: 0 },
        runtime: { context_tokens: 2048, max_tokens: 512 }
      }
    }]);
  } finally {
    mock.restoreAll();
  }
});

test('Model Access Hugging Face calls preserve pinned source and exact artifact identity', async () => {
  const revision = 'a'.repeat(40);
  const digest = 'b'.repeat(64);
  const seen: Array<{ url: string; method: string; body: unknown }> = [];
  mock.method(globalThis, 'fetch', async (url: string | URL | Request, init?: RequestInit) => {
    const pathname = new URL(String(url)).pathname + new URL(String(url)).search;
    seen.push({
      url: pathname,
      method: init?.method ?? 'GET',
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined
    });
    const payload = pathname.startsWith('/api/modelhub/search')
      ? { models: [{ repo_id: 'LiquidAI/LFM2.5-2.6B-GGUF', downloads: 3, likes: 1, tags: ['gguf'] }] }
      : pathname.startsWith('/api/modelhub/files')
        ? { repo_id: 'LiquidAI/LFM2.5-2.6B-GGUF', revision, license: 'other', files: [{ filename: 'LFM2.5-Q4_K_M.gguf', size: 99, lfs_sha256: digest }] }
        : pathname === '/api/modelhub/download'
          ? { job_id: 'job-1' }
          : pathname === '/api/modelhub/downloads'
            ? { jobs: [] }
            : { id: 'lfm-local', status: 'ready', endpoint: 'http://127.0.0.1:8091/v1' };
    return new Response(JSON.stringify(ok(payload)), { status: 200 });
  });
  try {
    const search = await api.modelHubSearch('LFM2.5');
    assert.equal(search.models[0]?.repo_id, 'LiquidAI/LFM2.5-2.6B-GGUF');
    const files = await api.modelHubFiles('LiquidAI/LFM2.5-2.6B-GGUF');
    assert.equal(files.revision, revision);
    const download = await api.modelHubDownload({
      repo_id: files.repo_id,
      filename: files.files[0]!.filename,
      revision: files.revision,
      expected_sha256: files.files[0]!.lfs_sha256!,
      expected_size_bytes: files.files[0]!.size!,
      quant_label: 'Q4_K_M'
    });
    assert.equal(download.job_id, 'job-1');
    assert.deepEqual(await api.modelHubDownloads(), { jobs: [] });
    assert.equal((await api.modelRegister({ filename: files.files[0]!.filename, repo_id: files.repo_id })).id, 'lfm-local');
    assert.deepEqual(seen.map(item => [item.url.split('?')[0], item.method]), [
      ['/api/modelhub/search', 'GET'],
      ['/api/modelhub/files', 'GET'],
      ['/api/modelhub/download', 'POST'],
      ['/api/modelhub/downloads', 'GET'],
      ['/api/models/register', 'POST']
    ]);
    assert.deepEqual(seen[2]?.body, {
      repo_id: 'LiquidAI/LFM2.5-2.6B-GGUF',
      filename: 'LFM2.5-Q4_K_M.gguf',
      quant_label: 'Q4_K_M',
      revision,
      expected_sha256: digest,
      expected_size_bytes: 99
    });
  } finally {
    mock.restoreAll();
  }
});

test('Model Access rejects an unpinned Hugging Face download before transport', async () => {
  let calls = 0;
  mock.method(globalThis, 'fetch', async () => {
    calls += 1;
    return new Response(JSON.stringify(ok({ job_id: 'unexpected' })), { status: 200 });
  });
  try {
    assert.throws(
      () => api.modelHubDownload({ repo_id: 'org/model', filename: 'model.gguf' } as never),
      (error: unknown) => error instanceof ApiError && error.code === 'BAD_REQUEST'
    );
    assert.equal(calls, 0);
  } finally {
    mock.restoreAll();
  }
});

test('api throws ApiError with code and message on an error envelope', async () => {
  mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify(fail('NOT_READY', 'still warming up')), { status: 409 }));
  await assert.rejects(api.health(), (error: unknown) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.code, 'NOT_READY');
    assert.equal(error.message, 'still warming up');
    return true;
  });
  mock.restoreAll();
});

test('api throws ApiError BAD_RESPONSE when the envelope does not match the contract', async () => {
  mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify(ok({ garbage: true })), { status: 200 }));
  await assert.rejects(api.health(), (error: unknown) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.code, 'BAD_RESPONSE');
    return true;
  });
  mock.restoreAll();
});

test('api throws ApiError BAD_RESPONSE on a non-JSON daemon response', async () => {
  mock.method(globalThis, 'fetch', async () => new Response('internal server error', { status: 500 }));
  await assert.rejects(api.health(), (error: unknown) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.code, 'BAD_RESPONSE');
    return true;
  });
  mock.restoreAll();
});

test('api.fileRead serializes the query and validates the response', async () => {
  const { seen } = mockFetch(ok(fileReadFixtures.readNormal));
  const file = await api.fileRead('src/a.ts');
  assert.equal(file.content, 'export const a = 1;\n');
  assert.equal(seen[0]?.url, '/api/file?path=src%2Fa.ts');
  assert.equal(seen[0]?.format, 'envelope-v1');
  mock.restoreAll();
});

test('api.chatStream uses the shared versioned transport and propagates cancellation', async () => {
  const controller = new AbortController();
  mock.method(globalThis, 'fetch', async (_url: string | URL | Request, init?: RequestInit) => {
    assert.equal(new Headers(init?.headers).get('X-AIDE-API-Format'), 'envelope-v1');
    assert.equal(init?.signal, controller.signal);
    return await new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true });
    });
  });
  const pending = api.chatStream('model-1', [{ role: 'user', content: 'hello' }], controller.signal);
  controller.abort();
  await assert.rejects(pending, (error: unknown) => error instanceof Error && error.name === 'AbortError');
  mock.restoreAll();
});

test('workbench operations use the shared versioned transport and validated contracts', async () => {
  const summary = {
    id: 'sovereign-coder', name: 'Sovereign Coder', version: '1.0.0', description: 'Local bundle',
    installed: false, enabled: false, plugins_count: 1, skills_count: 1, mcp_count: 0,
    online_mcp_count: 0, validated: true, issues: []
  };
  const detail = {
    workbench: {
      id: summary.id, name: summary.name, version: summary.version, description: summary.description,
      offline_by_default: true, installed: true, enabled: false, plugins: [], skills: [],
      mcp_servers: [], recommended_models: [], setup: [], validated: true, issues: []
    }
  };
  const seen: Array<{ url: string; method: string; format: string | null; body: unknown }> = [];
  mock.method(globalThis, 'fetch', async (url: string | URL | Request, init?: RequestInit) => {
    const path = new URL(String(url)).pathname;
    seen.push({
      url: path,
      method: init?.method ?? 'GET',
      format: new Headers(init?.headers).get('X-AIDE-API-Format'),
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined
    });
    const payload = path === '/api/workbenches'
      ? { workbenches: [summary] }
      : path.endsWith('/uninstall') ? { removed: summary.id } : detail;
    return new Response(JSON.stringify(ok(payload)), { status: 200 });
  });
  try {
    assert.equal((await api.workbenches()).workbenches[0]?.id, summary.id);
    assert.equal((await api.workbenchInstall(summary.id)).workbench.installed, true);
    assert.equal((await api.workbenchTrust(summary.id, 'filesystem', true)).workbench.id, summary.id);
    assert.equal((await api.workbenchUninstall(summary.id)).removed, summary.id);
    assert.deepEqual(seen.map(entry => [entry.url, entry.method]), [
      ['/api/workbenches', 'GET'],
      ['/api/workbenches/install', 'POST'],
      ['/api/workbenches/trust', 'POST'],
      ['/api/workbenches/uninstall', 'POST']
    ]);
    assert.ok(seen.every(entry => entry.format === 'envelope-v1'));
    assert.deepEqual(seen[2]?.body, { id: summary.id, server: 'filesystem', trusted: true });
  } finally {
    mock.restoreAll();
  }
});

test('api.fileRead surfaces the too_large flag from the fixture', async () => {
  mockFetch(ok(fileReadFixtures.readTooLarge));
  const file = await api.fileRead('big.bin');
  assert.equal(file.too_large, true);
  assert.equal(file.content, null);
  mock.restoreAll();
});

test('api.fileWrite POSTs to /api/file/write (route path, not /api/file)', async () => {
  const { seen } = mockFetch(ok(fileWriteFixtures.writeNormal));
  await api.fileWrite('a.ts', 'export const a = 1;\n');
  assert.equal(seen[0]?.method, 'POST');
  assert.equal(seen[0]?.url, '/api/file/write');
  mock.restoreAll();
});

test('api.search serializes flags as 0/1 and validates the response', async () => {
  const { seen } = mockFetch(ok(searchFixtures.withMatches));
  const result = await api.search('monaco', { icase: true, regex: false });
  assert.equal(result.total, 3);
  assert.equal(result.results.length, 2);
  assert.equal(seen[0]?.url, '/api/search?q=monaco&regex=0&icase=1');
  mock.restoreAll();
});

test('api.search accepts an empty result set from the fixture', async () => {
  mockFetch(ok(searchFixtures.noMatches));
  const result = await api.search('nothing-here');
  assert.equal(result.total, 0);
  assert.deepEqual(result.results, []);
  mock.restoreAll();
});

test('api.searchReplace POSTs with approved and validates the response', async () => {
  const { seen } = mockFetch(ok(searchReplaceFixtures.replaced));
  const result = await api.searchReplace({ query: 'monaco', replacement: 'monaco-editor' });
  assert.equal(result.files_changed, 2);
  assert.equal(result.occurrences, 3);
  assert.equal(seen[0]?.method, 'POST');
  assert.equal(seen[0]?.url, '/api/search/replace');
  mock.restoreAll();
});

test('api.sessionPut uses PUT (route is registered as PUT, not POST)', async () => {
  const { seen } = mockFetch(ok(sessionFixtures.withSplits));
  const result = await api.sessionPut(sessionFixtures.withSplits);
  assert.equal(result.splits?.join(','), 'g1,g2');
  assert.equal(seen[0]?.method, 'PUT');
  assert.equal(seen[0]?.url, '/api/session');
  mock.restoreAll();
});

test('api.sessionGet validates the empty session fixture', async () => {
  mockFetch(ok(sessionFixtures.empty));
  const result = await api.sessionGet();
  assert.deepEqual(result.tabs, []);
  assert.deepEqual(result.splits, ['g1']);
  mock.restoreAll();
});

test('api.lspStatus GETs /api/lsp/status and validates the fixture', async () => {
  const { seen } = mockFetch(ok(lspFixtures.statusAvailable));
  const result = await api.lspStatus();
  assert.equal(result.servers.length, 2);
  assert.equal(seen[0]?.method, 'GET');
  assert.equal(seen[0]?.url, '/api/lsp/status');
  mock.restoreAll();
});

test('api.lspStart POSTs the language id and validates the fixture', async () => {
  const { seen } = mockFetch(ok(lspFixtures.startRunning));
  const result = await api.lspStart('typescript');
  assert.equal(result.status, 'running');
  assert.equal(seen[0]?.method, 'POST');
  assert.equal(seen[0]?.url, '/api/lsp/start');
  mock.restoreAll();
});

test('api.lspOpen POSTs uri, languageId and text and validates the fixture', async () => {
  const { seen } = mockFetch(ok(lspFixtures.openOpened));
  const result = await api.lspOpen('file:///broken.ts', 'typescript', 'export const x = 1;');
  assert.equal(result.opened, true);
  assert.equal(seen[0]?.method, 'POST');
  assert.equal(seen[0]?.url, '/api/lsp/open');
  mock.restoreAll();
});

test('api.lspClose POSTs the uri and validates the fixture', async () => {
  const { seen } = mockFetch(ok(lspFixtures.closeClosed));
  const result = await api.lspClose('file:///broken.ts');
  assert.equal(result.closed, true);
  assert.equal(seen[0]?.method, 'POST');
  assert.equal(seen[0]?.url, '/api/lsp/close');
  mock.restoreAll();
});

test('api.lspChange POSTs uri, text and version and validates the fixture', async () => {
  const { seen } = mockFetch(ok(lspFixtures.changeChanged));
  const result = await api.lspChange('file:///broken.ts', 'export const x = 1;', 2);
  assert.equal(result.changed, true);
  assert.equal(seen[0]?.method, 'POST');
  assert.equal(seen[0]?.url, '/api/lsp/change');
  mock.restoreAll();
});
