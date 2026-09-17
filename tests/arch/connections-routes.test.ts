import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type http from 'node:http';
import { promises as fs } from 'node:fs';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { ArchServer } from '../../node/src/server.ts';
import { pairFixture } from './authority-fixture.ts';
import { createProviderConnectionsService } from '../../node/src/services/provider-connections.mjs';
import { routesForConnections } from '../../node/src/routes/connections.ts';

const sha256 = (value: string) => createHash('sha256').update(value, 'utf8').digest('hex');

const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'aide-connections-arch-'));
let server: ArchServer;
let httpServer: http.Server;
let base: string;
let owner: Awaited<ReturnType<typeof pairFixture>>;

const secrets = new Map<string, string>();
let byokStatusValue: Record<string, unknown> = {
  providers: [],
  routing: { plan: 'local', act: 'local', utility: 'local' },
  consent_enabled: false
};

before(async () => {
  server = new ArchServer(workspace, path.join(workspace, 'arch-connections.log'));
  const service = createProviderConnectionsService({
    workspace,
    providerService: { list: async () => [] },
    byokService: {
      status: () => byokStatusValue,
      testProvider: async () => {
        const error = new Error('provider not configured');
        (error as { code?: string }).code = 'NOT_FOUND';
        throw error;
      }
    },
    modelRuntimeStatus: async () => ({ runtime: null, models: [] }),
    secretStore: {
      setKey: (id, key) => void secrets.set(id, key),
      getKey: id => (secrets.has(id) ? String(secrets.get(id)) : null),
      deleteKey: id => secrets.delete(id),
      listProviderIds: () => [...secrets.keys()]
    },
    findExecutable: async () => null,
    preferencePath: path.join(workspace, '.aide', 'routing-preference.json')
  });
  for (const route of routesForConnections(service, workspace)) server.route(route);
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

type Envelope<T> = { ok: boolean; data?: T; error?: { code: string; message: string; detail?: { reason?: string } } };

async function call<T>(method: string, pathName: string, payload?: unknown): Promise<{ status: number; body: Envelope<T> }> {
  const response = await owner.request(pathName, {
    method,
    headers: { 'content-type': 'application/json' },
    ...(payload !== undefined ? { body: JSON.stringify(payload) } : {}),
    signal: AbortSignal.timeout(30000)
  });
  return { status: response.status, body: (await response.json()) as Envelope<T> };
}

test('connections: unified view composes existing surfaces truthfully', async () => {
  const res = await call<{
    consensus: string;
    preference: string;
    routed_roles: Record<string, string>;
    connections: Array<{ id: string; kind: string; status: string; routing_available: boolean }>;
  }>('GET', '/api/connections');
  assert.equal(res.status, 200);
  assert.equal(res.body.data!.consensus, 'none');
  assert.equal(res.body.data!.preference, 'local-first');
  assert.equal(res.body.data!.routed_roles.plan, 'local');
  const ids = new Set(res.body.data!.connections.map(entry => entry.id));
  assert.ok(ids.has('subscription:codex'));
  assert.ok(ids.has('subscription:claude'));
  assert.ok(ids.has('local-runtime'));
  assert.ok(ids.has('hf-token'));
  const subscriptions = res.body.data!.connections.filter(entry => entry.kind === 'subscription');
  assert.equal(subscriptions.length, 2);
  assert.ok(subscriptions.every(entry => entry.status === 'unavailable'), 'absent official runtimes report unavailable, never fabricated connected');
  assert.ok(subscriptions.every(entry => entry.routing_available === false), 'subscription runtimes are invoked via the official CLI, not the router');
  const localEntry = res.body.data!.connections.find(entry => entry.id === 'local-runtime');
  assert.equal(localEntry!.status, 'not_configured');
  assert.equal(localEntry!.routing_available, true);

  // A configured BYOK provider + stored key surfaces as a connected api-key
  // connection and shifts the consensus (all truthful derived state).
  secrets.set('prov1', 'sk-prov1');
  byokStatusValue = {
    providers: [{ id: 'prov1', name: 'GW', base_url: 'https://gw.example.com/v1', api_type: 'chat-completions', model_id: 'm-1', tool_calling: false, key_stored: true }],
    routing: { plan: 'local', act: { provider_id: 'prov1', model_id: 'm-1' }, utility: 'local' },
    consent_enabled: false
  };
  const second = await call<{ consensus: string; connections: Array<{ id: string; status: string; capabilities: string[] }> }>('GET', '/api/connections');
  assert.equal(second.body.data!.consensus, 'api-keys');
  const apiEntry = second.body.data!.connections.find(entry => entry.id === 'api:prov1');
  assert.equal(apiEntry!.status, 'connected');
  assert.deepEqual(apiEntry!.capabilities, ['chat', 'act', 'utility']);
  const privacy = JSON.stringify(second.body);
  assert.ok(!privacy.includes('sk-prov1'), 'the unified view never leaks stored credentials');
});

test('connections: routing preference is a governed write (approval + replay + change refusal)', async () => {
  const unapproved = await call<unknown>('PUT', '/api/connections/preference', { preference: 'local-only' });
  assert.equal(unapproved.status, 409);
  assert.equal(unapproved.body.error?.code, 'NOT_READY');
  assert.equal(unapproved.body.error?.detail?.reason, 'APPROVAL_REQUIRED');

  const changedHeaders = await owner.approve('PUT', '/api/connections/preference', { preference: 'api-keys-with-approval' }, 'task:pref-change');
  const changed = await owner.request('/api/connections/preference', { method: 'PUT', headers: changedHeaders, body: JSON.stringify({ preference: 'local-only' }) });
  assert.equal(changed.status, 409, 'a changed preference cannot reuse the approval');

  const appliedHeaders = await owner.approve('PUT', '/api/connections/preference', { preference: 'local-only' }, 'task:pref-applied');
  const applied = await owner.request('/api/connections/preference', { method: 'PUT', headers: appliedHeaders, body: JSON.stringify({ preference: 'local-only' }) });
  assert.equal(applied.status, 200);
  const appliedBody = (await applied.json()) as { data?: { preference?: string } };
  assert.equal(appliedBody.data?.preference, 'local-only');

  const replay = await owner.request('/api/connections/preference', { method: 'PUT', headers: appliedHeaders, body: JSON.stringify({ preference: 'local-only' }) });
  assert.equal(replay.status, 409, 'consumed preference approval cannot replay');

  const view = await call<{ preference: string }>('GET', '/api/connections');
  assert.equal(view.body.data!.preference, 'local-only');
});

test('connections: HF token write is governed + digest-bound and never leaks the credential', async () => {
  const hfSecret = 'hf-abcdefghijklmnop1234';
  const anonymous = await fetch(`${base}/api/connections/hf-token`, {
    method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ api_key: hfSecret }), signal: AbortSignal.timeout(5000)
  });
  assert.equal(anonymous.status, 403, 'anonymous credential write rejected');

  const prepared = await owner.request('/api/authority/prepare', {
    method: 'POST',
    body: JSON.stringify({ method: 'PUT', path: '/api/connections/hf-token', task_id: 'task:hf-inspect', body: { api_key: hfSecret } })
  });
  assert.equal(prepared.status, 200);
  const preparedText = await prepared.text();
  const preparedEnvelope = JSON.parse(preparedText) as { data: { operation_id: string; args: { body: { keyDigest: string; keyLength: number } } } };
  assert.equal(preparedEnvelope.data.args.body.keyDigest, sha256(hfSecret), 'canonical sha256 of the exact secret');
  assert.equal(preparedEnvelope.data.args.body.keyLength, hfSecret.length, 'exact UTF-16 code-unit length');
  assert.ok(!preparedText.includes(hfSecret), 'prepare serialization never contains the credential');
  assert.equal((await owner.decide(preparedEnvelope.data.operation_id, 'reject')).status, 200);

  const keyHeaders = await owner.approve('PUT', '/api/connections/hf-token', { api_key: hfSecret }, 'task:hf-set');
  const changed = await owner.request('/api/connections/hf-token', { method: 'PUT', headers: keyHeaders, body: JSON.stringify({ api_key: `${hfSecret}x` }) });
  assert.equal(changed.status, 409, 'a different token cannot reuse the approval');
  const applied = await owner.request('/api/connections/hf-token', { method: 'PUT', headers: keyHeaders, body: JSON.stringify({ api_key: hfSecret }) });
  assert.equal(applied.status, 200);
  const appliedBody = JSON.stringify(await applied.json());
  assert.ok(!appliedBody.includes(hfSecret), 'the stored response never echoes the token');
  const replay = await owner.request('/api/connections/hf-token', { method: 'PUT', headers: keyHeaders, body: JSON.stringify({ api_key: hfSecret }) });
  assert.equal(replay.status, 409, 'consumed token approval cannot replay');

  const view = await call<{ consensus: string; connections: Array<{ id: string; status: string }> }>('GET', '/api/connections');
  assert.equal(view.body.data!.connections.find(entry => entry.id === 'hf-token')!.status, 'connected');
  assert.ok(view.body.data!.consensus.includes('catalog'), 'catalog consensus updates truthfully');

  const auditText = await fs.readFile(path.join(workspace, '.aide', 'cipher-state.jsonl'), 'utf8');
  assert.ok(!auditText.includes(hfSecret), 'audit journal never stores the raw credential');
});

test('connections: HF token delete is governed; approved exact delete removes the slot', async () => {
  const unapproved = await call<unknown>('DELETE', '/api/connections/hf-token', {});
  assert.equal(unapproved.status, 409);
  assert.equal(unapproved.body.error?.code, 'NOT_READY');

  const storedSecret = 'hf-delete-me-123456';
  const keyHeaders = await owner.approve('PUT', '/api/connections/hf-token', { api_key: storedSecret }, 'task:hf-delete-set');
  const stored = await owner.request('/api/connections/hf-token', { method: 'PUT', headers: keyHeaders, body: JSON.stringify({ api_key: storedSecret }) });
  assert.equal(stored.status, 200, 'store a token so the delete has a real slot to remove');
  const storedBody = JSON.stringify(await stored.json());
  assert.ok(!storedBody.includes(storedSecret), 'the stored response never echoes the token');

  const delHeaders = await owner.approve('DELETE', '/api/connections/hf-token', {}, 'task:hf-delete');
  const applied = await owner.request('/api/connections/hf-token', { method: 'DELETE', headers: delHeaders, body: JSON.stringify({}) });
  assert.equal(applied.status, 200);
  assert.equal(((await applied.json()) as Envelope<{ ok: true }>).data?.ok, true);
  const replay = await owner.request('/api/connections/hf-token', { method: 'DELETE', headers: delHeaders, body: JSON.stringify({}) });
  assert.equal(replay.status, 409, 'consumed delete approval cannot replay');

  const view = await call<{ connections: Array<{ id: string; status: string }> }>('GET', '/api/connections');
  assert.equal(view.body.data!.connections.find(entry => entry.id === 'hf-token')!.status, 'not_configured');

  // A second approved exact delete on the now-empty slot is honestly NOT_FOUND:
  // a non-destructive no-op never quietly reports ok.
  const emptyHeaders = await owner.approve('DELETE', '/api/connections/hf-token', {}, 'task:hf-delete-empty');
  const empty = await owner.request('/api/connections/hf-token', { method: 'DELETE', headers: emptyHeaders, body: JSON.stringify({}) });
  assert.equal(empty.status, 404);
  assert.equal(((await empty.json()) as Envelope<unknown>).error?.code, 'NOT_FOUND');
  const emptyReplay = await owner.request('/api/connections/hf-token', { method: 'DELETE', headers: emptyHeaders, body: JSON.stringify({}) });
  assert.equal(emptyReplay.status, 409, 'consumed empty-delete approval cannot replay');
});

test('connections: test and subscription-auth are governed external/execute capabilities', async () => {
  for (const [method, pathName, body] of [
    ['POST', '/api/connections/test', { connection_id: 'api:ghost' }],
    ['POST', '/api/connections/subscription/auth', { subscription_id: 'codex' }]
  ] as Array<[string, string, Record<string, unknown>]>) {
    const unapproved = await call<unknown>(method, pathName, body);
    assert.equal(unapproved.status, 409, `${method} ${pathName} unapproved must fail closed`);
    assert.equal(unapproved.body.error?.code, 'NOT_READY');
  }

  const testHeaders = await owner.approve('POST', '/api/connections/test', { connection_id: 'api:ghost' }, 'task:conn-test');
  const tested = await owner.request('/api/connections/test', { method: 'POST', headers: testHeaders, body: JSON.stringify({ connection_id: 'api:ghost' }) });
  assert.equal(tested.status, 200);
  const testedBody = (await tested.json()) as { data?: { ok: boolean; detail: string } };
  assert.equal(testedBody.data!.ok, false, 'unknown provider honestly reports not-configured');
  assert.match(testedBody.data!.detail, /not configured/);
  const testReplay = await owner.request('/api/connections/test', { method: 'POST', headers: testHeaders, body: JSON.stringify({ connection_id: 'api:ghost' }) });
  assert.equal(testReplay.status, 409, 'consumed test approval cannot replay');

  const authHeaders = await owner.approve('POST', '/api/connections/subscription/auth', { subscription_id: 'claude' }, 'task:conn-auth');
  const authed = await owner.request('/api/connections/subscription/auth', { method: 'POST', headers: authHeaders, body: JSON.stringify({ subscription_id: 'claude' }) });
  assert.equal(authed.status, 200);
  const authedBody = (await authed.json()) as { data?: { ok: boolean; status: string; detail: string } };
  assert.equal(authedBody.data!.ok, false);
  assert.equal(authedBody.data!.status, 'unavailable', 'absent runtime honestly reports unavailable');
  assert.match(authedBody.data!.detail, /CLI not detected/);
  const authReplay = await owner.request('/api/connections/subscription/auth', { method: 'POST', headers: authHeaders, body: JSON.stringify({ subscription_id: 'claude' }) });
  assert.equal(authReplay.status, 409, 'consumed auth approval cannot replay');
});