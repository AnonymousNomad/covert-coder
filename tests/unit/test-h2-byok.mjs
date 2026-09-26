import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createByokService } from '../../node/src/services/byok-service.mjs';

function fakeStore() {
  const map = new Map();
  return {
    setKey: (id, key) => { map.set(id, `enc(${key})`); },
    getKey: id => (map.has(id) ? String(map.get(id)).replace(/^enc\(|\)$/g, '') : null),
    deleteKey: id => map.delete(id),
    listProviderIds: () => [...map.keys()],
  };
}

function mkService(overrides = {}) {
  const egress = [];
  const service = createByokService({
    workspace: fs.mkdtempSync(path.join(os.tmpdir(), 'aide-h2-')),
    secretStore: fakeStore(),
    fetchImpl: overrides.fetchImpl ?? null,
    onEgress: entry => egress.push(entry),
    testTimeoutMs: overrides.testTimeoutMs,
    chatTimeoutMs: overrides.chatTimeoutMs,
  });
  return { service, egress };
}

const provider = { id: 'p1', name: 'Gateway', base_url: 'https://gw.example.com/v1', api_type: 'chat-completions', model_id: 'm-1', tool_calling: false };

test('byok: provider CRUD never leaks key material; key_stored reflects store', () => {
  const { service } = mkService();
  service.setProvider(provider);
  assert.deepEqual(service.status().providers.map(p => ({ id: p.id, key_stored: p.key_stored })), [{ id: 'p1', key_stored: false }]);
  service.putKey('p1', 'sk-' + 'abcdefghijklmnop1234');
  assert.equal(service.status().providers[0].key_stored, true);
  const raw = JSON.stringify(service.status());
  assert.doesNotMatch(raw, /abcdefghijklmnop/);
  service.deleteKey('p1');
  assert.equal(service.status().providers[0].key_stored, false);
});

test('byok: putKey to unknown provider is NOT_FOUND; routing defaults local and roundtrips', () => {
  const { service } = mkService();
  assert.throws(() => service.putKey('nope', 'x'), err => err.code === 'NOT_FOUND');
  assert.deepEqual(service.getRouting(), { plan: 'local', act: 'local', utility: 'local' });
  service.setRouting({ plan: 'local', act: { provider_id: 'p1', model_id: 'm-9' }, utility: 'local' });
  assert.deepEqual(service.getRouting().act, { provider_id: 'p1', model_id: 'm-9' });
});

test('byok: resolveChatFn returns null without consent or key even when routed', () => {
  const { service } = mkService({ fetchImpl: async () => ({ ok: true, status: 200 }) });
  service.setProvider(provider);
  service.setRouting({ plan: 'local', act: { provider_id: 'p1', model_id: 'm-1' }, utility: 'local' });
  assert.equal(service.resolveChatFn('act'), null);
  service.putKey('p1', 'k' + 'e'.repeat(24));
  service.setConsent(false);
  assert.equal(service.resolveChatFn('act'), null);
  service.setConsent(true);
  const chatFn = service.resolveChatFn('act');
  assert.ok(typeof chatFn === 'function');
});

test('byok: resolved chat forwards caller abort to the provider fetch', async () => {
  let observedSignal = null;
  const { service } = mkService({
    fetchImpl: async (_url, init) => {
      observedSignal = init?.signal ?? null;
      return await new Promise((_resolve, reject) => {
        const fail = () => reject(new DOMException('cancelled', 'AbortError'));
        if (observedSignal?.aborted) fail();
        else observedSignal?.addEventListener('abort', fail, { once: true });
      });
    },
  });
  service.setProvider(provider);
  service.putKey('p1', 'k'.repeat(20));
  service.setRouting({ plan: 'local', act: { provider_id: 'p1', model_id: 'm-1' }, utility: 'local' });
  service.setConsent(true);
  const chatFn = service.resolveChatFn('act');
  assert.ok(typeof chatFn === 'function');
  const controller = new AbortController();
  const pending = chatFn([{ role: 'user', content: 'wait' }], controller.signal);
  controller.abort();
  await assert.rejects(pending, err => err?.name === 'AbortError');
  assert.ok(observedSignal, 'provider fetch receives a composed abort signal');
  assert.equal(observedSignal.aborted, true);
});

test('byok: testProvider bounds a hung provider probe', async () => {
  const { service } = mkService({
    testTimeoutMs: 40,
    fetchImpl: async (_url, init) => await new Promise((_resolve, reject) => {
      const fail = () => reject(new DOMException('timed out', 'AbortError'));
      if (init?.signal?.aborted) fail();
      else init?.signal?.addEventListener('abort', fail, { once: true });
    }),
  });
  service.setProvider(provider);
  service.putKey('p1', 'k'.repeat(20));
  service.setConsent(true);
  const started = Date.now();
  const out = await service.testProvider('p1');
  assert.equal(out.ok, false);
  assert.match(out.detail, /timed out/i);
  assert.ok(Date.now() - started < 1000, 'provider probe must settle on the configured bound');
});

test('byok: resolved chat bounds a hung provider call without operator cancellation', async () => {
  const { service } = mkService({
    chatTimeoutMs: 40,
    fetchImpl: async (_url, init) => await new Promise((_resolve, reject) => {
      const fail = () => reject(new DOMException('timed out', 'AbortError'));
      if (init?.signal?.aborted) fail();
      else init?.signal?.addEventListener('abort', fail, { once: true });
    }),
  });
  service.setProvider(provider);
  service.putKey('p1', 'k'.repeat(20));
  service.setRouting({ plan: 'local', act: { provider_id: 'p1', model_id: 'm-1' }, utility: 'local' });
  service.setConsent(true);
  const chatFn = service.resolveChatFn('act');
  assert.ok(typeof chatFn === 'function');
  await assert.rejects(
    () => chatFn([{ role: 'user', content: 'wait' }]),
    error => error?.code === 'TIMEOUT' && /timed out/i.test(error.message)
  );
});

test('byok: testProvider journals egress before fetch and surfaces failure honestly', async () => {
  let calls = 0;
  const { service, egress } = mkService({
    fetchImpl: async () => { calls += 1; return { ok: true, status: 200 }; },
  });
  service.setProvider(provider);
  service.putKey('p1', 'k'.repeat(20));
  await assert.rejects(() => service.testProvider('p1'), err => err.code === 'FORBIDDEN');
  service.setConsent(true);
  const out = await service.testProvider('p1');
  assert.equal(out.ok, true);
  assert.equal(calls, 1);
  assert.equal(egress.length, 1);
  assert.equal(egress[0].kind, 'byok-test');
  assert.match(JSON.stringify(egress), /gw\.example\.com/);

  const { service: failing } = mkService({ fetchImpl: async () => ({ ok: false, status: 401 }) });
  failing.setProvider(provider);
  failing.putKey('p1', 'k'.repeat(20));
  failing.setConsent(true);
  const bad = await failing.testProvider('p1');
  assert.equal(bad.ok, false);
});
