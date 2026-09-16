import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type http from 'node:http';
import { promises as fs } from 'node:fs';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { ArchServer } from '../../node/src/server.ts';
import { pairFixture } from './authority-fixture.ts';

const sha256 = (value: string) => createHash('sha256').update(value, 'utf8').digest('hex');

const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'aide-h2-arch-'));
let server: ArchServer;
let httpServer: http.Server;
let base: string;
let owner: Awaited<ReturnType<typeof pairFixture>>;

before(async () => {
  server = new ArchServer(workspace, path.join(workspace, 'arch-h2.log'));
  const { buildRoutes } = await import('../../node/src/openapi.ts');
  const store = new Map<string, string>();
  const routes = await buildRoutes(workspace, 'test', {
    authority: server.authority,
    events: server.events,
    byokSecretStore: {
      setKey: (id, key) => { store.set(id, ['enc:', key].join('')); },
      getKey: id => (store.has(id) ? String(store.get(id)).slice(4) : null),
      deleteKey: id => store.delete(id),
      listProviderIds: () => [...store.keys()],
    },
  });
  for (const route of routes) server.route(route);
  httpServer = await server.listen(0);
  const address = httpServer.address();
  assert.ok(address && typeof address === 'object');
  base = `http://127.0.0.1:${address.port}`;
  owner = await pairFixture(server, base);
});

after(async () => {
  server.events.close();
  await server.logger.flush();
  httpServer.closeAllConnections?.();
  await new Promise<void>(resolve => httpServer.close(() => resolve()));
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      await fs.rm(workspace, { recursive: true, force: true });
      return;
    } catch (error) {
      if (!['EBUSY', 'ENOTEMPTY', 'EPERM'].includes((error as NodeJS.ErrnoException).code ?? '')) throw error;
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
});

type Envelope<T> = { ok: boolean; data?: T; error?: { code: string; message: string } };

async function call<T>(method: string, pathName: string, payload?: unknown): Promise<{ status: number; body: Envelope<T> }> {
  const response = await owner.request(pathName, {
    method,
    headers: { 'content-type': 'application/json' },
    ...(payload !== undefined ? { body: JSON.stringify(payload) } : {}),
    signal: AbortSignal.timeout(30000)
  });
  return { status: response.status, body: (await response.json()) as Envelope<T> };
}

test('byok: status starts empty local-default with consent off; contract shape holds', async () => {
  const res = await call<{ providers: unknown[]; routing: Record<string, string>; consent_enabled: boolean }>('GET', '/api/byok/status');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.data!.providers, []);
  assert.equal(res.body.data!.consent_enabled, false);
  assert.equal(res.body.data!.routing.plan, 'local');
});

test('byok: provider set + key put are governed writes; digest-bound approval, denial, replay and privacy', async () => {
  const providerConfig = { id: 'prov1', name: 'GW', base_url: 'https://gw.example.com/v1', api_type: 'chat-completions', model_id: 'm-1', tool_calling: false };
  const secret = 'sk-abcdefghijklmnop1234';

  // Anonymous writes are refused before any authority edge.
  const anonymous = await fetch(`${base}/api/byok/key`, {
    method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ provider_id: 'prov1', api_key: secret }), signal: AbortSignal.timeout(5000)
  });
  assert.equal(anonymous.status, 403, 'anonymous credential write rejected');

  // Paired but unapproved writes fail with the approval-gated 409.
  const unapprovedSet = await call('PUT', '/api/byok/providers/set', { provider: providerConfig });
  assert.equal(unapprovedSet.status, 409);
  assert.equal(unapprovedSet.body.ok, false);
  assert.equal(unapprovedSet.body.error?.code, 'NOT_READY');
  assert.equal((unapprovedSet.body.error as { detail?: { reason?: string } }).detail?.reason, 'APPROVAL_REQUIRED');
  const unapprovedKey = await call('PUT', '/api/byok/key', { provider_id: 'prov1', api_key: secret });
  assert.equal(unapprovedKey.status, 409);
  assert.equal(unapprovedKey.body.error?.code, 'NOT_READY');
  const statusGap = await call<{ providers: Array<Record<string, unknown>> }>('GET', '/api/byok/status');
  assert.deepEqual(statusGap.body.data!.providers, [], 'denied writes must leave zero provider state');

  // Prepare/inspect privacy: the descriptor binds provider identity, the secret
  // SHA-256 digest and its exact length — never the secret itself.
  const prepared = await owner.request('/api/authority/prepare', {
    method: 'POST',
    body: JSON.stringify({ method: 'PUT', path: '/api/byok/key', task_id: 'task:byok-key-inspect', body: { provider_id: 'prov1', api_key: secret } })
  });
  assert.equal(prepared.status, 200);
  const preparedText = await prepared.text();
  const preparedEnvelope = JSON.parse(preparedText) as { data: { operation_id: string; state: string; args: { body: { provider_id: string; keyDigest: string; keyLength: number } } } };
  assert.equal(preparedEnvelope.data.state, 'pending');
  assert.equal(preparedEnvelope.data.args.body.provider_id, 'prov1');
  assert.equal(preparedEnvelope.data.args.body.keyDigest, sha256(secret), 'canonical sha256 of the exact UTF-8 secret');
  assert.equal(preparedEnvelope.data.args.body.keyLength, secret.length, 'exact UTF-16 code-unit length');
  assert.ok(!preparedText.includes(secret), 'raw secret must not appear in the prepare serialization');
  assert.ok(!/sk-abcdefg/.test(preparedText), 'no partial key material may reach the operator');
  const inspected = await owner.request(`/api/authority/operation?id=${preparedEnvelope.data.operation_id}`);
  assert.equal(inspected.status, 200);
  const inspectedText = await inspected.text();
  assert.ok(!inspectedText.includes(secret), 'inspect exposes the digest, never the raw secret');
  assert.equal((await owner.decide(preparedEnvelope.data.operation_id, 'reject')).status, 200);

  // Exact approved provider set; a changed provider cannot reuse the approval.
  const setHeaders = await owner.approve('PUT', '/api/byok/providers/set', { provider: providerConfig }, 'task:byok-set');
  const changedProvider = await owner.request('/api/byok/providers/set', { method: 'PUT', headers: setHeaders, body: JSON.stringify({ provider: { ...providerConfig, model_id: 'm-other' } }) });
  assert.equal(changedProvider.status, 409, 'changed provider cannot reuse the approval');
  const appliedSet = await owner.request('/api/byok/providers/set', { method: 'PUT', headers: setHeaders, body: JSON.stringify({ provider: providerConfig }) });
  assert.equal(appliedSet.status, 200);
  const setBody = (await appliedSet.json()) as { data: { providers: Array<Record<string, unknown>> } };
  assert.equal(setBody.data.providers[0]?.id, 'prov1');
  const replaySet = await owner.request('/api/byok/providers/set', { method: 'PUT', headers: setHeaders, body: JSON.stringify({ provider: providerConfig }) });
  assert.equal(replaySet.status, 409, 'consumed set approval cannot replay');

  // Exact approved secret put: key terminology never echoed, replay refused.
  const keyHeaders = await owner.approve('PUT', '/api/byok/key', { provider_id: 'prov1', api_key: secret }, 'task:byok-key');
  const keyChanged = await owner.request('/api/byok/key', { method: 'PUT', headers: keyHeaders, body: JSON.stringify({ provider_id: 'prov1', api_key: `${secret}x` }) });
  assert.equal(keyChanged.status, 409, 'a different secret cannot reuse the approval');
  const keyShort = await owner.request('/api/byok/key', { method: 'PUT', headers: keyHeaders, body: JSON.stringify({ provider_id: 'prov1', api_key: 'sk-a' }) });
  assert.equal(keyShort.status, 409, 'a length-differing secret cannot reuse the approval');
  const appliedKey = await owner.request('/api/byok/key', { method: 'PUT', headers: keyHeaders, body: JSON.stringify({ provider_id: 'prov1', api_key: secret }) });
  assert.equal(appliedKey.status, 200);
  const keyBody = (await appliedKey.json()) as { ok: boolean; data: { stored: true } };
  assert.equal(keyBody.ok, true);
  assert.deepEqual(keyBody.data, { stored: true });
  assert.ok(!JSON.stringify(keyBody).includes(secret), 'the stored-secret response never echoes the key');
  const replayKey = await owner.request('/api/byok/key', { method: 'PUT', headers: keyHeaders, body: JSON.stringify({ provider_id: 'prov1', api_key: secret }) });
  assert.equal(replayKey.status, 409, 'consumed key approval cannot replay');

  // Denied and applied writes respected; status reports key_stored without the key.
  const afterStatus = await call<{ providers: Array<{ id: string; key_stored: boolean }> }>('GET', '/api/byok/status');
  assert.equal(afterStatus.body.data!.providers.length, 1);
  assert.equal(afterStatus.body.data!.providers[0]!.key_stored, true);
  assert.ok(!JSON.stringify(afterStatus.body).includes(secret), 'status never leaks the secret');

  // Governed key delete: approved exact id, replay refused.
  const delHeaders = await owner.approve('DELETE', '/api/byok/key/delete', { id: 'prov1' }, 'task:byok-key-delete');
  const appliedDel = await owner.request('/api/byok/key/delete', { method: 'DELETE', headers: delHeaders, body: JSON.stringify({ id: 'prov1' }) });
  assert.equal(appliedDel.status, 200);
  const delStatus = await call<{ providers: Array<{ id: string; key_stored: boolean }> }>('GET', '/api/byok/status');
  assert.equal(delStatus.body.data!.providers[0]!.key_stored, false, 'approved delete removes the stored key');

  // Governed provider delete tears the whole provider down.
  const provDelHeaders = await owner.approve('DELETE', '/api/byok/providers/delete', { id: 'prov1' }, 'task:byok-provider-delete');
  const appliedProvDel = await owner.request('/api/byok/providers/delete', { method: 'DELETE', headers: provDelHeaders, body: JSON.stringify({ id: 'prov1' }) });
  assert.equal(appliedProvDel.status, 200);
  const emptyStatus = await call<{ providers: Array<Record<string, unknown>> }>('GET', '/api/byok/status');
  assert.deepEqual(emptyStatus.body.data!.providers, [], 'approved provider delete leaves no provider state');

  // Durable authorities: the audit journal never captures the raw secret.
  const auditText = await fs.readFile(path.join(workspace, '.aide', 'cipher-state.jsonl'), 'utf8');
  assert.ok(!auditText.includes(secret), 'audit journal never stores the raw secret');
  const authorityRows = auditText.split('\n').filter(Boolean).map(line => JSON.parse(line) as { type: string; digest?: string });
  assert.ok(authorityRows.some(row => row.type === 'authority' && typeof row.digest === 'string' && /^[0-9a-f]{64}$/.test(row.digest)), 'canonical operation digest present per the authority contract');
});

test('byok: routing and consent are governed writes; test is a governed external capability', async () => {
  // A governed provider + key is re-created for this test so the probe routes
  // reach the consent gate (torn down by the previous test's provider delete).
  const providerConfig = { id: 'prov1', name: 'GW', base_url: 'https://gw.example.com/v1', api_type: 'chat-completions', model_id: 'm-1', tool_calling: false };
  const setHeaders = await owner.approve('PUT', '/api/byok/providers/set', { provider: providerConfig }, 'task:byok-set-t3');
  assert.equal((await owner.request('/api/byok/providers/set', { method: 'PUT', headers: setHeaders, body: JSON.stringify({ provider: providerConfig }) })).status, 200);
  const keyHeaders = await owner.approve('PUT', '/api/byok/key', { provider_id: 'prov1', api_key: 'sk-probe-key' }, 'task:byok-key-t3');
  assert.equal((await owner.request('/api/byok/key', { method: 'PUT', headers: keyHeaders, body: JSON.stringify({ provider_id: 'prov1', api_key: 'sk-probe-key' }) })).status, 200);

  // routing and consent are governed writes: unapproved attempts fail closed,
  // approved exact values execute once, and changed values cannot reuse it.
  const routingValue = { routing: { plan: 'local', act: { provider_id: 'prov1', model_id: 'm-1' }, utility: 'local' } };
  const routingUnapproved = await call('PUT', '/api/byok/routing', routingValue);
  assert.equal(routingUnapproved.status, 409);
  const routingHeaders = await owner.approve('PUT', '/api/byok/routing', routingValue, 'task:byok-routing-t3');
  const routingChanged = await owner.request('/api/byok/routing', { method: 'PUT', headers: routingHeaders, body: JSON.stringify({ routing: { plan: 'local', act: 'local', utility: 'local' } }) });
  assert.equal(routingChanged.status, 409, 'changed routing cannot reuse approval');
  const routingApplied = await owner.request('/api/byok/routing', { method: 'PUT', headers: routingHeaders, body: JSON.stringify(routingValue) });
  assert.equal(routingApplied.status, 200, 'approved routing executes');
  const routingReplay = await owner.request('/api/byok/routing', { method: 'PUT', headers: routingHeaders, body: JSON.stringify(routingValue) });
  assert.equal(routingReplay.status, 409, 'consumed routing approval cannot replay');

  const consentUnapproved = await call('PUT', '/api/byok/consent', { enabled: true });
  assert.equal(consentUnapproved.status, 409);
  const consentHeaders = await owner.approve('PUT', '/api/byok/consent', { enabled: false }, 'task:byok-consent-t3');
  const consentApplied = await owner.request('/api/byok/consent', { method: 'PUT', headers: consentHeaders, body: JSON.stringify({ enabled: false }) });
  assert.equal(consentApplied.status, 200, 'approved consent executes');

  // POST /api/byok/test is an enrolled external capability: it emits egress.
  const anonymous = await fetch(`${base}/api/byok/test`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ provider_id: 'prov1' }), signal: AbortSignal.timeout(5000)
  });
  assert.equal(anonymous.status, 403, 'anonymous test rejected');
  const unapproved = await call('POST', '/api/byok/test', { provider_id: 'prov1' });
  assert.equal(unapproved.status, 409);
  assert.equal(unapproved.body.error?.code, 'NOT_READY');

  // Unknown provider, governed and approved: the authority admits the exact
  // probe; the handler reports the unknown provider (404), never the secret.
  const unknownHeaders = await owner.approve('POST', '/api/byok/test', { provider_id: 'ghost' }, 'task:byok-test-ghost');
  const ghostRes = await owner.request('/api/byok/test', { method: 'POST', headers: unknownHeaders, body: JSON.stringify({ provider_id: 'ghost' }) });
  assert.equal(ghostRes.status, 404);
  const ghostEnvelope = (await ghostRes.json()) as { ok: boolean; error: { code: string } };
  assert.equal(ghostEnvelope.error.code, 'NOT_FOUND');
  const replayUnknown = await owner.request('/api/byok/test', { method: 'POST', headers: unknownHeaders, body: JSON.stringify({ provider_id: 'ghost' }) });
  assert.equal(replayUnknown.status, 409, 'consumed test approval cannot replay');

  // Approved exact provider: the handler runs and stops at consent (still off).
  const testHeaders = await owner.approve('POST', '/api/byok/test', { provider_id: 'prov1' }, 'task:byok-test-prov1');
  const testRes = await owner.request('/api/byok/test', { method: 'POST', headers: testHeaders, body: JSON.stringify({ provider_id: 'prov1' }) });
  assert.equal(testRes.status, 403, 'consent-off blocks the actual provider probe');
  const consentBlocked = JSON.stringify(await testRes.json());
  assert.match(consentBlocked, /consent disabled/);

  const status = await call<{ routing: Record<string, string>; consent_enabled: boolean }>('GET', '/api/byok/status');
  assert.equal(status.status, 200);
  assert.equal(status.body.data!.consent_enabled, false, 'no denied mutation may flip consent');
  assert.equal(status.body.data!.routing.plan, 'local', 'no denied mutation may alter routing');
});
