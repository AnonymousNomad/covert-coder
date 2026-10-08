import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { createProjectRegistry } from '../../node/src/services/project-registry.ts';
import { createProjectSeat } from '../../node/src/services/project-seat.ts';
import { createCipherLedger } from '../../node/src/services/cipher-ledger.ts';
import { createAppCatalog } from '../../node/src/services/app-catalog.ts';
import { createResidentCapabilityDiscovery } from '../../node/src/services/resident-capability-discovery.ts';
import { CIPHER_RESIDENT_ID } from '../../common/contracts/cipher-laptop.ts';
import { ResidentCapabilityQuery, ResidentCapabilityManifest } from '../../common/contracts/resident-capability.ts';
import type { ModelProviderRouteT, ModelExecutionAdapterT } from '../../common/contracts/model-access.ts';
import { ArchServer } from '../../node/src/server.ts';
import { buildRoutes } from '../../node/src/openapi.ts';
import { pairFixture } from './authority-fixture.ts';
import { pairServiceFixture } from './authority-fixture.ts';
import { routesForResidentCapabilities } from '../../node/src/routes/resident-capabilities.ts';
import { TerminalSessionService } from '../../node/src/services/terminal-sessions.ts';

const workerRoute = (overrides: Partial<ModelProviderRouteT> = {}): ModelProviderRouteT => ({ id: 'route:provider:model', model_id: 'model:worker', provider_id: 'provider', connection_id: 'connection', provider_model_id: 'worker', credential_source_id: 'credential:ref', execution_adapter_id: 'direct-http', model_support_state: 'VERIFIED', configured: true, health: 'HEALTHY', available: true, external_egress_required: true, operator_setup_required: false, setup_state: 'READY', selected_roles: ['IMPLEMENTATION'], ...overrides });
const adapter = (overrides: Partial<ModelExecutionAdapterT> = {}): ModelExecutionAdapterT => ({ id: 'direct-http', kind: 'DIRECT_HTTP', implementation: 'IMPLEMENTED', discovered: true, configured: true, available: true, canonical_default: false, ...overrides });
async function fixture(run: (f: { root: string; seat: ReturnType<typeof createProjectSeat>; catalog: ReturnType<typeof createAppCatalog>; ledger: ReturnType<typeof createCipherLedger>; project: { project_id: string; checkout_id: string } }) => Promise<void>) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'covert-resident-p2-'));
  try {
    const seat = createProjectSeat(createProjectRegistry({ storageRoot: path.join(root, '.aide', 'platform-projects') }), root);
    const checkout = await seat.initialize();
    const ledger = createCipherLedger({ storageRoot: path.join(root, '.aide', 'cipher-laptop'), residentId: CIPHER_RESIDENT_ID });
    // Fixture enrollment is a real owner write, never performed by discovery.
    await ledger.append({ action_id: 'fixture.identity-enrollment', event_type: 'SECURITY_EVENT', principal_id: 'fixture.service', principal_kind: 'service', origin_channel: 'test.fixture', project_id: checkout.project_id, checkout_id: checkout.checkout_id, task_id: null, capability: 'fixture.identity-enrollment', target_ref: 'fixture:ledger', target_digest: null, result_state: 'OBSERVED' });
    await run({ root, seat, catalog: createAppCatalog(seat, [{ method: 'GET', path: '/api/projects/current', capabilityPolicy: { owner: 'ProjectSeat', operation: 'capability.read' }, describeOperation: async () => ({ kind: 'capability.read' }) }]), ledger, project: { project_id: checkout.project_id, checkout_id: checkout.checkout_id } });
  } finally { await fs.rm(root, { recursive: true, force: true }); }
}

test('Resident discovery preserves one canonical identity and truthfully refuses to invent a live seat', () => fixture(async ({ catalog, ledger, project }) => {
  const discovery = createResidentCapabilityDiscovery({ catalog, ledger });
  const view = await discovery.read(project);
  assert.equal(view.resident_id, CIPHER_RESIDENT_ID);
  assert.equal(view.identity_state, 'OBSERVED');
  assert.equal(view.enrollment_state, 'GATED');
  assert.equal(view.principal_id, null);
  assert.equal(view.binding_generation, null);
  assert.equal(view.context_lease_ref, null);
  assert.deepEqual(view.project, project);
  assert.equal(view.grants.state, 'UNAVAILABLE');
  assert.deepEqual(view.grants.references, []);
  assert.equal(view.pending_operator_decisions.state, 'UNAVAILABLE');
  assert.ok(!('invoke' in discovery) && !('grant' in discovery) && !('enroll' in discovery));
}));

test('addressability is visible but never execution eligibility; missing owners remain unavailable', () => fixture(async ({ catalog, ledger, project }) => {
  const view = await createResidentCapabilityDiscovery({ catalog, ledger }).read(project);
  assert.equal(view.apps.length, 9);
  const bound = view.capabilities.find(c => c.id === 'project.identity.read')!;
  assert.equal(bound.route_state, 'ADDRESSABLE');
  assert.equal(bound.execution_state, 'GATED');
  assert.equal(view.capabilities.find(c => c.id === 'terminal.session.open')!.route_state, 'UNAVAILABLE');
  assert.equal(view.capabilities.find(c => c.id === 'terminal.session.open')!.reason, 'OWNER_ROUTE_UNAVAILABLE');
  assert.ok(view.capabilities.every(c => c.grant_state === 'NOT_EVALUATED' && c.admission_state === 'NOT_EVALUATED'));
}));

test('only canonical verified routes with implemented adapters become worker references, without credentials', () => fixture(async ({ catalog, ledger, project }) => {
  const discovery = createResidentCapabilityDiscovery({ catalog, ledger, workerSnapshot: async () => ({ generated_at: new Date().toISOString(), routes: [workerRoute(), workerRoute({ id: 'unknown', model_support_state: 'UNKNOWN' }), workerRoute({ id: 'unsupported', model_support_state: 'UNSUPPORTED' }), workerRoute({ id: 'contract-only', execution_adapter_id: 'codex-cli' })], execution_adapters: [adapter(), adapter({ id: 'codex-cli', kind: 'CODEX_CLI', implementation: 'CONTRACT_ONLY' })] }) });
  const view = await discovery.read(project);
  assert.equal(view.workers.references.length, 1);
  assert.match(view.workers.references[0]!.route_id, /^route:[a-f0-9]{64}$/);
  assert.equal(view.workers.references[0]!.identity_encoding, 'OWNER_REFERENCE_DIGEST');
  assert.equal(view.workers.references[0]!.external_egress_required, true);
  assert.equal(view.workers.references[0]!.execution_state, 'GATED');
  assert.ok(!JSON.stringify(view).includes('credential:ref'));
  assert.equal(view.workers.source, 'ModelManagerView');
}));

test('failed worker owner and failed ledger are explicit and do not remove direct operator catalog access', () => fixture(async ({ catalog, project }) => {
  const discovery = createResidentCapabilityDiscovery({ catalog, ledger: { status: async () => { throw new Error('offline'); } }, workerSnapshot: async () => { throw new Error('offline'); } });
  const view = await discovery.read(project);
  assert.equal(view.identity_state, 'UNAVAILABLE');
  assert.equal(view.workers.state, 'UNAVAILABLE');
  assert.equal((await catalog.read(project)).apps.length, 9);
}));

test('discovery never enrolls a fresh ledger or manufactures missing history', () => fixture(async ({ catalog, project, root }) => {
  const fresh = createCipherLedger({ storageRoot: path.join(root, '.aide', 'unenrolled-laptop'), residentId: CIPHER_RESIDENT_ID });
  const view = await createResidentCapabilityDiscovery({ catalog, ledger: fresh }).read(project);
  assert.equal(view.identity_state, 'UNAVAILABLE'); assert.equal(view.ledger_id, null);
  assert.deepEqual(await fresh.list(), []); assert.equal((await fresh.status()).ledger_id, null);
}));

test('identity disagreement refuses discovery rather than laundering another Resident', () => fixture(async ({ catalog, ledger, project }) => {
  const status = await ledger.status();
  const discovery = createResidentCapabilityDiscovery({ catalog, ledger: { status: async () => ({ ...status, resident_id: 'foreign.resident' }) } });
  await assert.rejects(() => discovery.read(project), /RESIDENT_IDENTITY_MISMATCH/);
}));

test('cross-project, stale generation and caller-grant fields are fail closed', () => fixture(async ({ catalog, ledger, project }) => {
  const discovery = createResidentCapabilityDiscovery({ catalog, ledger });
  await assert.rejects(() => discovery.read({ ...project, checkout_id: randomUUID() }), /PROJECT_SCOPE_MISMATCH/);
  await assert.rejects(() => discovery.read({ ...project, catalog_generation: randomUUID() }), /CATALOG_GENERATION_CHANGED/);
  assert.equal(ResidentCapabilityQuery.safeParse({ ...project, principal_id: 'cipher', grants: ['*'] }).success, false);
}));

test('project mutation while owners are awaited invalidates discovery output', () => fixture(async ({ catalog, ledger, project, root }) => {
  const discovery = createResidentCapabilityDiscovery({ catalog, ledger, workerSnapshot: async () => { await fs.writeFile(path.join(root, '.aide', 'platform-projects', 'catalog.json'), '{corrupt'); return { generated_at: new Date().toISOString(), routes: [], execution_adapters: [] }; } });
  await assert.rejects(() => discovery.read(project), /PROJECT_CATALOG_INVALID/);
}));

test('freshness uses explicit generation/expiry and bounded pull, with no fabricated event support', () => fixture(async ({ catalog, ledger, project }) => {
  const discovery = createResidentCapabilityDiscovery({ catalog, ledger });
  const view = await discovery.read(project);
  assert.equal(ResidentCapabilityManifest.safeParse(view).success, true);
  assert.equal(view.refresh.refresh_after_ms, 30000);
  assert.equal(view.refresh.change_events, 'GATED_NOT_IMPLEMENTED');
  assert.equal(Date.parse(view.valid_until) - Date.parse(view.observed_at), 30000);
  await discovery.assertFresh(view);
  await assert.rejects(() => createResidentCapabilityDiscovery({ catalog, ledger }).assertFresh(view), /DISCOVERY_GENERATION_CHANGED/);
  await assert.rejects(() => discovery.assertFresh({ ...view, observed_at: '2000-01-01T00:00:00.000Z', valid_until: '2000-01-01T00:00:30.000Z' }), /DISCOVERY_EXPIRED/);
}));

test('an awaited owner read cannot extend an existing discovery expiry', () => fixture(async ({ catalog, ledger, project }) => {
  let clock = Date.now(), delayed = false;
  const discovery = createResidentCapabilityDiscovery({ catalog, ledger, clock: () => clock, workerSnapshot: async () => { if (delayed) clock += 31000; return { generated_at: new Date(clock).toISOString(), routes: [], execution_adapters: [] }; } });
  const view = await discovery.read(project); delayed = true;
  await assert.rejects(() => discovery.assertFresh(view), /DISCOVERY_EXPIRED/);
}));

test('observed empty worker results cannot hide a failed or stale owner', () => fixture(async ({ catalog, ledger, project }) => {
  for (const failure of ['unavailable', 'stale']) {
    let changed = false;
    const discovery = createResidentCapabilityDiscovery({ catalog, ledger, workerSnapshot: async () => {
      if (changed && failure === 'unavailable') throw new Error('offline');
      return { generated_at: changed ? '2000-01-01T00:00:00.000Z' : new Date().toISOString(), routes: [], execution_adapters: [] };
    } });
    const view = await discovery.read(project); changed = true;
    await assert.rejects(() => discovery.assertFresh(view), /DISCOVERY_CHANGED/);
  }
}));

test('invented identity, capability, worker and eligibility cannot validate as an owner snapshot', () => fixture(async ({ catalog, ledger, project }) => {
  const discovery = createResidentCapabilityDiscovery({ catalog, ledger });
  const view = await discovery.read(project);
  for (const injected of [
    { ...view, identity_source: 'LOGICAL_PRODUCT_ID_UNOBSERVED' },
    { ...view, capabilities: [...view.capabilities, { ...view.capabilities[0], id: 'invented.capability' }] }
  ]) await assert.rejects(() => discovery.assertFresh(injected), /DISCOVERY_CHANGED/);
  for (const injected of [{ ...view, principal_id: 'invented' }, { ...view, enrollment_state: 'ENROLLED' }, { ...view, grants: { ...view.grants, references: [{ grant_ref: 'self' }] } }, { ...view, capabilities: [{ ...view.capabilities[0], execution_state: 'READY' }] }]) assert.equal(ResidentCapabilityManifest.safeParse(injected).success, false);
  const inventedWorker = { identity_encoding: 'OWNER_REFERENCE_DIGEST', route_id: 'route:' + '0'.repeat(64), model_id: 'model:' + '0'.repeat(64), provider_id: 'provider:' + '0'.repeat(64), adapter_id: 'adapter:' + '0'.repeat(64), availability: 'AVAILABLE', external_egress_required: false, selected_roles: [], qualification_state: 'NOT_PROJECTED', execution_state: 'GATED' };
  await assert.rejects(() => discovery.assertFresh({ ...view, workers: { ...view.workers, references: [inventedWorker] } }), /DISCOVERY_CHANGED/);
}));

test('duplicate adapter identities refuse the snapshot rather than combine conflicting owner facts', () => fixture(async ({ catalog, ledger, project }) => {
  const view = await createResidentCapabilityDiscovery({ catalog, ledger, workerSnapshot: async () => ({ generated_at: new Date().toISOString(), routes: [workerRoute()], execution_adapters: [adapter(), adapter({ implementation: 'CONTRACT_ONLY' })] }) }).read(project);
  assert.equal(view.workers.state, 'UNAVAILABLE'); assert.equal(view.workers.reason, 'MODEL_SNAPSHOT_INVALID'); assert.deepEqual(view.workers.references, []);
}));

test('valid catalog project or checkout substitution during an owner wait is refused', () => fixture(async ({ catalog, ledger, project, root }) => {
  const file = path.join(root, '.aide', 'platform-projects', 'catalog.json'), original = await fs.readFile(file, 'utf8');
  for (const kind of ['project', 'checkout']) {
    const discovery = createResidentCapabilityDiscovery({ catalog, ledger, workerSnapshot: async () => {
      const state = JSON.parse(original);
      if (kind === 'project') { const id = randomUUID(); state.projects[0].project_id = id; state.checkouts[0].project_id = id; }
      else state.checkouts[0].checkout_id = randomUUID();
      await fs.writeFile(file, JSON.stringify(state)); return { generated_at: new Date().toISOString(), routes: [], execution_adapters: [] };
    } });
    await assert.rejects(() => discovery.read(project), /PROJECT_SCOPE_MISMATCH/);
    await fs.writeFile(file, original);
  }
}));

test('Cipher owner failure only degrades Cipher capabilities; direct platform capabilities stay addressable', () => fixture(async ({ catalog, seat, project }) => {
  const apps = (await catalog.read(project)).apps;
  const routes = apps.flatMap(app => app.manifest.capabilities.map(c => ({ method: c.method, path: c.route, capabilityPolicy: { owner: c.owner, operation: c.operation_kind }, ...(c.id === 'project.identity.read' ? { describeOperation: async () => ({ kind: 'capability.read' }) } : {}) })));
  // Controlled registered-route inventory; no PTY/effect is invoked.
  const owner = createAppCatalog(seat, routes);
  const view = await createResidentCapabilityDiscovery({ catalog: owner, ledger: { status: async () => { throw new Error('offline'); } } }).read(project);
  assert.ok(view.capabilities.filter(c => c.owner.startsWith('Cipher')).every(c => c.route_state === 'UNAVAILABLE'));
  assert.ok(view.capabilities.filter(c => ['ProjectSeat', 'WorkspaceService', 'TerminalSessionService'].includes(c.owner)).every(c => c.route_state === 'ADDRESSABLE'));
  assert.equal((await catalog.read(project)).apps.length, 9);
}));

test('actor revocation during awaited Resident discovery refuses the response', () => fixture(async ({ catalog, ledger, project, root }) => {
  const { authority, owner } = await pairServiceFixture(root);
  try {
    const discovery = createResidentCapabilityDiscovery({ catalog, ledger, workerSnapshot: async () => { authority.control.revoke(owner); return { generated_at: new Date().toISOString(), routes: [], execution_adapters: [] }; } });
    await assert.rejects(async () => routesForResidentCapabilities(discovery, root)[0]!.handler({ query: project, body: null, authority, actor: owner }), /revoked|invalid/);
  } finally { authority.control.close(); }
}));

test('seat invalidation during an asynchronous worker snapshot refuses discovery', () => fixture(async ({ catalog, seat, ledger, project }) => {
  let valid = true;
  const scopedCatalog = createAppCatalog({ ...seat, assertAddress: async address => { if (!valid) throw new Error('PROJECT_SEAT_INVALIDATED'); return seat.assertAddress(address); } });
  const discovery = createResidentCapabilityDiscovery({ catalog: scopedCatalog, ledger, workerSnapshot: async () => { valid = false; return { generated_at: new Date().toISOString(), routes: [], execution_adapters: [] }; } });
  await assert.rejects(() => discovery.read(project), /PROJECT_SEAT_INVALIDATED/);
  assert.equal((await catalog.read(project)).apps.length, 9);
}));

test('production Resident discovery route is authenticated, scoped and read-only when AI is absent', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'covert-p2-http-'));
  await fs.writeFile(path.join(root, 'direct.txt'), 'DIRECT_OPERATOR_READ');
  const arch = new ArchServer(root, path.join(root, 'arch.log'));
  const terminals = new TerminalSessionService({ defaultCwd: root, onEvent: () => {}, spawnOverride: () => { throw new Error('read-only discovery must never spawn a PTY'); } });
  for (const route of await buildRoutes(root, 'test', { authority: arch.authority, events: arch.events, terminalSessions: terminals })) arch.route(route);
  const server = await arch.listen(0), address = server.address(); assert.ok(address && typeof address === 'object');
  try {
    const owner = await pairFixture(arch, 'http://127.0.0.1:' + address.port), project = await arch.projects.current();
    const query = new URLSearchParams({ project_id: project.project_id, checkout_id: project.checkout_id }).toString();
    const response = await owner.request('/api/resident/capabilities?' + query);
    assert.equal(response.status, 200);
    const view = ResidentCapabilityManifest.parse((await response.json()).data);
    assert.equal(view.enrollment_state, 'GATED');
    assert.equal((await owner.request('/api/resident/capabilities')).status, 400);
    assert.equal((await owner.request('/api/resident/capabilities?' + query + '&principal_id=cipher')).status, 400);
    assert.equal((await owner.request('/api/resident/capabilities?' + query, { headers: { Authorization: 'Bearer invalid' } })).status, 403);
    assert.equal((await owner.request('/api/resident/capabilities', { method: 'POST', body: '{}' })).status, 404);
    assert.equal((await owner.request('/api/projects/current')).status, 200);
    assert.equal((await owner.request('/api/terminal/sessions')).status, 200);
    const directRead = await owner.request('/api/file?path=direct.txt');
    assert.equal(directRead.status, 200);
    assert.equal((await directRead.json()).data.content, 'DIRECT_OPERATOR_READ');
    assert.equal((await arch.cipherLedger.status()).unresolved_actions.length, 0);
  } finally { terminals.stopAll(); arch.events.close(); arch.authority.control.close(); await arch.logger.flush(); await new Promise<void>(resolve => server.close(() => resolve())); await fs.rm(root, { recursive: true, force: true }); }
});


test('injected clock expires discovery at the exact boundary', () => fixture(async ({ catalog, ledger, project }) => {
  let now = Date.now();
  const discovery = createResidentCapabilityDiscovery({ catalog, ledger, clock: () => now });
  const view = await discovery.read(project);
  now = Date.parse(view.valid_until) - 1;
  await discovery.assertFresh(view);
  now += 1;
  await assert.rejects(() => discovery.assertFresh(view), /DISCOVERY_EXPIRED/);
}));

test('canonical ledger provenance and revision bind the same logical Resident identity', () => fixture(async ({ catalog, ledger, project }) => {
  const discovery = createResidentCapabilityDiscovery({ catalog, ledger });
  const view = await discovery.read(project);
  assert.equal(view.identity_provenance?.owner, 'CipherLedger');
  assert.equal(view.identity_provenance?.attestation, 'UNSIGNED_HASH_CHAIN');
  assert.equal(view.identity_provenance?.ledger_id, view.ledger_id);
  assert.ok(view.identity_provenance && view.identity_provenance.record_count > 0);
  for (const field of ['ledger_id', 'checkpoint_root', 'record_count', 'integrity_generation']) {
    const provenance = { ...view.identity_provenance!, [field]: field === 'ledger_id' ? randomUUID() : field === 'checkpoint_root' ? '0'.repeat(64) : 999 };
    await assert.rejects(() => discovery.assertFresh({ ...view, identity_provenance: provenance }), /DISCOVERY_CHANGED/);
  }
  await ledger.append({ action_id: 'fixture.next-revision', event_type: 'SECURITY_EVENT', principal_id: 'fixture.service', principal_kind: 'service', origin_channel: 'test.fixture', ...project, task_id: null, capability: 'fixture.next-revision', target_ref: 'fixture:ledger', target_digest: null, result_state: 'OBSERVED' });
  await assert.rejects(() => discovery.assertFresh(view), /DISCOVERY_CHANGED/);
}));

test('underlying App Catalog generation invalidates otherwise identical discovery', () => fixture(async ({ seat, ledger, project }) => {
  let owner = createAppCatalog(seat);
  const discovery = createResidentCapabilityDiscovery({ catalog: { read: query => owner.read(query), assertFresh: view => owner.assertFresh(view) }, ledger });
  const view = await discovery.read(project);
  owner = createAppCatalog(seat);
  await assert.rejects(() => discovery.assertFresh(view), /CATALOG_GENERATION_CHANGED/);
}));

test('all registered routes remain GATED and P1 effects and audiences are preserved exactly', () => fixture(async ({ seat, catalog, ledger, project }) => {
  const apps = (await catalog.read(project)).apps;
  const routes = apps.flatMap(app => app.manifest.capabilities.map(c => ({ method: c.method, path: c.route, capabilityPolicy: { owner: c.owner, operation: c.operation_kind }, describeOperation: async () => ({ kind: c.operation_kind }) })));
  const owner = createAppCatalog(seat, routes), source = await owner.read(project);
  const view = await createResidentCapabilityDiscovery({ catalog: owner, ledger }).read(project);
  assert.ok(view.capabilities.every(c => c.route_state === 'ADDRESSABLE' && c.execution_state === 'GATED' && c.grant_state === 'NOT_EVALUATED' && c.admission_state === 'NOT_EVALUATED'));
  for (const capability of source.apps.flatMap(app => app.manifest.capabilities)) {
    const projected = view.capabilities.find(c => c.id === capability.id)!;
    assert.equal(projected.effect, capability.effect);
    assert.deepEqual(projected.audiences, capability.audiences);
    assert.equal(projected.operation_kind, capability.operation_kind);
  }
}));

test('full ledger and worker availability matrix preserves independent operator access and unknown pending state', () => fixture(async ({ catalog, ledger, project }) => {
  for (const ledgerAvailable of [false, true]) for (const workersAvailable of [false, true]) {
    const view = await createResidentCapabilityDiscovery({ catalog, ledger: ledgerAvailable ? ledger : { status: async () => { throw new Error('offline'); } }, workerSnapshot: async () => {
      if (!workersAvailable) throw new Error('offline');
      return { generated_at: new Date().toISOString(), routes: [], execution_adapters: [] };
    } }).read(project);
    assert.equal(view.identity_state, ledgerAvailable ? 'OBSERVED' : 'UNAVAILABLE');
    assert.equal(view.workers.state, workersAvailable ? 'OBSERVED' : 'UNAVAILABLE');
    assert.equal(view.pending_operator_decisions.state, 'UNAVAILABLE');
    assert.equal(view.pending_operator_decisions.reason, 'SCOPED_AUTHORITY_DISCOVERY_UNAVAILABLE');
    assert.deepEqual(view.pending_operator_decisions.references, []);
    assert.ok(!('count' in view.pending_operator_decisions));
    assert.equal((await catalog.read(project)).apps.length, 9);
  }
}));

test('structural owner references exclude arbitrary credential values and handles while preserving role and egress facts', () => fixture(async ({ catalog, ledger, project }) => {
  const secret = 'arbitrary-private-value-not-a-token-pattern';
  for (const egress of [false, true]) {
    const source = workerRoute({ id: secret + ':route', model_id: secret + ':model', provider_id: secret + ':provider', execution_adapter_id: secret + ':adapter', credential_source_id: secret + ':credential-handle', connection_id: secret + ':connection', provider_model_id: secret + ':label', selected_roles: ['UTILITY', 'REVIEW'], external_egress_required: egress });
    const view = await createResidentCapabilityDiscovery({ catalog, ledger, workerSnapshot: async () => ({ generated_at: new Date().toISOString(), routes: [source], execution_adapters: [adapter({ id: source.execution_adapter_id })] }) }).read(project);
    assert.equal(view.workers.state, 'OBSERVED');
    assert.deepEqual(view.workers.references[0]!.selected_roles, source.selected_roles);
    assert.equal(view.workers.references[0]!.external_egress_required, egress);
    assert.ok(!JSON.stringify(view).includes(secret));
    const reference = view.workers.references[0]!;
    for (const id of ['route_id', 'model_id', 'adapter_id', 'provider_id'] as const) assert.equal(ResidentCapabilityManifest.safeParse({ ...view, workers: { ...view.workers, references: [{ ...reference, [id]: secret }] } }).success, false);
    assert.equal(ResidentCapabilityManifest.safeParse({ ...view, workers: { ...view.workers, references: [{ ...reference, credential_source_id: secret }] } }).success, false);
  }
  const invalid = await createResidentCapabilityDiscovery({ catalog, ledger, workerSnapshot: async () => ({ generated_at: new Date().toISOString(), routes: [workerRoute({ selected_roles: [secret] })], execution_adapters: [adapter()] }) }).read(project);
  assert.equal(invalid.workers.state, 'UNAVAILABLE');
  assert.equal(invalid.workers.reason, 'MODEL_SNAPSHOT_INVALID');
  assert.ok(!JSON.stringify(invalid).includes(secret));
}));


test('canonical Resident revision change during an asynchronous owner read is refused', () => fixture(async ({ catalog, ledger, project }) => {
  const discovery = createResidentCapabilityDiscovery({ catalog, ledger, workerSnapshot: async () => {
    await ledger.append({ action_id: 'fixture.async-revision', event_type: 'SECURITY_EVENT', principal_id: 'fixture.service', principal_kind: 'service', origin_channel: 'test.fixture', ...project, task_id: null, capability: 'fixture.async-revision', target_ref: 'fixture:ledger', target_digest: null, result_state: 'OBSERVED' });
    return { generated_at: new Date().toISOString(), routes: [], execution_adapters: [] };
  } });
  await assert.rejects(() => discovery.read(project), /RESIDENT_IDENTITY_CHANGED/);
}));


test('seat invalidation during the final ledger read cannot escape the last scope check', () => fixture(async ({ seat, ledger, project }) => {
  let valid = true, reads = 0;
  const scoped = createAppCatalog({ ...seat, assertAddress: async address => { if (!valid) throw new Error('PROJECT_SEAT_INVALIDATED'); return seat.assertAddress(address); } });
  const discovery = createResidentCapabilityDiscovery({ catalog: scoped, ledger: { status: async () => { if (++reads === 2) valid = false; return ledger.status(); } } });
  await assert.rejects(() => discovery.read(project), /PROJECT_SEAT_INVALIDATED/);
}));
