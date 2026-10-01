import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ByokStatusResponse } from '../../common/contracts/byok.ts';
import { ConnectionsViewResponse, ProviderConnection } from '../../common/contracts/connections.ts';
import { deriveCloudStatus, createCloudStatusReader, type NetworkState } from '../../browser/src/services/cloud-status.ts';

const byok = ByokStatusResponse.parse({ consent_enabled: true, providers: [], routing: {} });
const configured = ProviderConnection.parse({
  id: 'fixture', provider_id: 'fixture', name: 'fixture', kind: 'subscription', status: 'configured_not_verified',
  detail: 'controlled result', capabilities: ['chat'], routing_available: false, account_label: 'fixture',
  access: { authentication_mode: 'official_cli', authentication_configured: true,
    credential_source: { id: 'fixture', kind: 'official_cli_auth', configuration_state: 'configured' },
    health: 'unknown', execution_adapters: ['codex-cli'], model_refs: [], external_egress_required: true,
    operator_setup_required: true, setup_state: 'verification_required' },
});
const view = (connections = [configured]) => ConnectionsViewResponse.parse({ consensus: 'none', preference: 'local-first', routed_roles: {}, connections });
const observed = () => ({ byok, connections: view() });

test('empty discovery and failed provider read never mean local only', async () => {
  assert.equal(deriveCloudStatus(byok, view([])), 'STATUS_UNAVAILABLE');
  const states: NetworkState[] = [];
  await createCloudStatusReader(async () => { throw new Error('status read failed'); }, state => states.push(state)).refresh();
  assert.deepEqual(states, ['CHECKING', 'STATUS_UNAVAILABLE']);
});
test('explicit local-only policy and disabled consent stay distinct', () => {
  assert.equal(deriveCloudStatus(byok, { ...view(), preference: 'local-only' }), 'LOCAL_ONLY');
  assert.equal(deriveCloudStatus({ ...byok, consent_enabled: false }, view()), 'CONSENT_DISABLED');
});
test('configured auth does not establish verified model availability', () => {
  assert.equal(deriveCloudStatus(byok, view()), 'REMOTE_CONFIGURED');
  const connected = { ...configured, status: 'connected' as const, routing_available: true,
    access: { ...configured.access, health: 'healthy' as const, setup_state: 'ready' as const } };
  assert.equal(deriveCloudStatus(byok, view([connected])), 'REMOTE_CONFIGURED');
  const qualified = { ...connected, access: { ...connected.access, model_refs: [{ model_id: 'fixture:model', provider_model_id: 'model', model_support_state: 'verified' as const }] } };
  assert.equal(deriveCloudStatus(byok, view([qualified])), 'REMOTE_AVAILABLE');
  assert.equal(deriveCloudStatus(byok, view([{ ...qualified, routing_available: false }])), 'REMOTE_CONFIGURED');
});
test('missing authentication, unknown auth and observed unavailable configured route remain distinct', () => {
  const missing = { ...configured, access: { ...configured.access, authentication_configured: false,
    credential_source: { ...configured.access.credential_source, configuration_state: 'missing' as const } } };
  assert.equal(deriveCloudStatus(byok, view([missing])), 'CREDENTIAL_MISSING');
  assert.equal(deriveCloudStatus(byok, view([{ ...missing, access: { ...missing.access,
    credential_source: { ...missing.access.credential_source, configuration_state: 'unknown' as const } } }])), 'STATUS_UNAVAILABLE');
  assert.equal(deriveCloudStatus(byok, view([{ ...configured, access: { ...configured.access, health: 'unavailable' } }])), 'REMOTE_UNAVAILABLE');
});
test('new failed read revokes a previous configured observation', async () => {
  let fail = false;
  const states: NetworkState[] = [];
  const reader = createCloudStatusReader(async () => { if (fail) throw new Error('offline'); return observed(); }, state => states.push(state));
  await reader.refresh(); fail = true; await reader.refresh();
  assert.deepEqual(states, ['CHECKING', 'REMOTE_CONFIGURED', 'CHECKING', 'STATUS_UNAVAILABLE']);
});
test('out of order and disposed reads cannot publish stale successful state', async () => {
  const states: NetworkState[] = [];
  let release!: (value: ReturnType<typeof observed>) => void;
  let calls = 0;
  const reader = createCloudStatusReader(async () => {
    if (++calls === 1) return new Promise(resolve => { release = resolve; });
    throw new Error('new failed observation');
  }, state => states.push(state));
  const old = reader.refresh(); await reader.refresh(); release(observed()); await old;
  assert.equal(states.at(-1), 'STATUS_UNAVAILABLE');
  const disposed = createCloudStatusReader(() => new Promise(resolve => { release = resolve; }), state => states.push(state));
  const pending = disposed.refresh(); disposed.dispose(); release(observed()); await pending;
  assert.equal(states.at(-1), 'CHECKING');
});
