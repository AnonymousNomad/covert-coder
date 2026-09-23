// Sovereignty / egress manifest battery.
// Controls:
// - local capabilities are classified PACKAGED_LOCAL / OS_PROVIDED with
//   consent local_only;
// - external providers appear ONLY from the real enrolled-provider list, with
//   consent reflecting the canonical BYOK switch;
// - the journal projection is whitelisted: secret-looking fields never leave;
// - corrupt journal lines never fabricate activity.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createEgressManifest } from '../../node/src/services/egress-manifest.ts';
import { ArchServer } from '../../node/src/server.ts';
import { pairFixture } from './authority-fixture.ts';
const { buildRoutes } = await import('../../node/src/openapi.ts');

test('local capabilities are packaged-local and local-only', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'egress-'));
  const manifest = createEgressManifest({ workspace, consentEnabled: () => false, providerIds: () => [] });
  const snapshot = await manifest.snapshot();
  assert.equal(snapshot.doctrine, 'Local by default. Connected by choice.');
  const locals = snapshot.capabilities.filter(capability => capability.classification === 'PACKAGED_LOCAL');
  assert.ok(locals.length >= 3);
  assert.ok(locals.every(capability => capability.consent === 'local_only' && capability.egress_host === null));
});

test('external providers reflect the canonical consent switch and real enrolled ids', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'egress-'));
  const off = createEgressManifest({ workspace, consentEnabled: () => false, providerIds: () => ['opencode'] });
  const offRow = (await off.snapshot()).capabilities.find(capability => capability.id === 'provider:opencode');
  assert.equal(offRow?.classification, 'OPTIONAL_EXTERNAL');
  assert.equal(offRow?.consent, 'not_configured');
  const on = createEgressManifest({ workspace, consentEnabled: () => true, providerIds: () => ['opencode'] });
  const onRow = (await on.snapshot()).capabilities.find(capability => capability.id === 'provider:opencode');
  assert.equal(onRow?.consent, 'opted_in');
});

test('journal projection whitelists fields: secrets never leave', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'egress-'));
  await fs.mkdir(path.join(workspace, '.aide', 'egress'), { recursive: true });
  await fs.writeFile(path.join(workspace, '.aide', 'egress', 'journal.jsonl'),
    JSON.stringify({ ts: '2026-09-23T01:00:00.000Z', action: 'byok.chat', provider_id: 'opencode', authorization: 'Bearer sk-supersecret' }) + '\n' +
    'corrupt row\n' +
    JSON.stringify({ ts: '2026-09-23T02:00:00.000Z', action: 'byok.chat', provider_id: 'opencode' }) + '\n', 'utf8');
  const manifest = createEgressManifest({ workspace, consentEnabled: () => true, providerIds: () => [] });
  const snapshot = await manifest.snapshot();
  assert.equal(snapshot.recent_external_activity.events, 2);
  assert.equal(snapshot.recent_external_activity.last_at, '2026-09-23T02:00:00.000Z');
  assert.deepEqual(snapshot.recent_external_activity.providers, ['opencode']);
  assert.ok(!JSON.stringify(snapshot).includes('sk-supersecret'));
  assert.ok(!JSON.stringify(snapshot).toLowerCase().includes('authorization'));
});

test('no journal: zero activity, never fabricated', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'egress-'));
  const manifest = createEgressManifest({ workspace, consentEnabled: () => false, providerIds: () => [] });
  const snapshot = await manifest.snapshot();
  assert.equal(snapshot.recent_external_activity.events, 0);
  assert.equal(snapshot.recent_external_activity.last_at, null);
});

test('route serves the canonical manifest', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'egress-route-'));
  const server = new ArchServer(workspace, path.join(workspace, 'arch.log'));
  const routes = await buildRoutes(workspace, 'test', { authority: server.authority, events: server.events });
  for (const route of routes) server.route(route);
  const http = await server.listen(0);
  const address = http.address() as { port: number };
  const owner = await pairFixture(server, `http://127.0.0.1:${address.port}`);
  try {
    const response = await owner.request('/api/egress/manifest', { signal: AbortSignal.timeout(60000) });
    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(payload.data.doctrine, 'Local by default. Connected by choice.');
    assert.ok(payload.data.capabilities.length >= 4);
  } finally {
    http.closeAllConnections?.();
    await new Promise<void>(resolve => http.close(() => resolve()));
    server.events.close();
    await server.logger.flush();
  }
});
