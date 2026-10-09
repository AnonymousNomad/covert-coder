import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { createProjectRegistry } from '../../node/src/services/project-registry.ts';
import { createProjectSeat } from '../../node/src/services/project-seat.ts';
import { createAppCatalog, sealPackageManifest, validateAppInstanceBinding } from '../../node/src/services/app-catalog.ts';
import { AppManifest, PackageManifest, InstalledAppRecord, AppInstance, AppCatalogQuery, AuthorityGrantReference } from '../../common/contracts/platform-app.ts';
import { routesForAppCatalog } from '../../node/src/routes/app-catalog.ts';
import { pairServiceFixture } from './authority-fixture.ts';
import { pairFixture } from './authority-fixture.ts';
import { ArchServer } from '../../node/src/server.ts';
import { buildRoutes } from '../../node/src/openapi.ts';
import type { ProjectAddressT } from '../../common/contracts/project.ts';
import { httpOperationKind, OPERATION_POLICY } from '../../common/security/operation-policy.mjs';
import { routesForProjects } from '../../node/src/routes/projects.ts';

async function fixture(run: (f: { root: string; catalog: ReturnType<typeof createAppCatalog>; seat: ReturnType<typeof createProjectSeat>; address: ProjectAddressT }) => Promise<void>) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'covert-app-p1-'));
  try {
    const seat = createProjectSeat(createProjectRegistry({ storageRoot: path.join(root, '.aide', 'platform-projects') }), root);
    const checkout = await seat.initialize();
    await run({ root, seat, catalog: createAppCatalog(seat), address: { project_id: checkout.project_id, checkout_id: checkout.checkout_id } });
  } finally { await fs.rm(root, { recursive: true, force: true }); }
}

test('canonical catalog describes nine real surfaces while window identities stay presentation metadata', () => fixture(async ({ catalog, address }) => {
  const snapshot = await catalog.read(address);
  assert.deepEqual(snapshot.apps.map(a => a.manifest.presentation_id), ['projects', 'editor', 'terminal', 'cipher-laptop', 'models', 'connections', 'resources', 'verification', 'settings']);
  assert.equal(snapshot.apps.find(a => a.manifest.app_id === 'covert.app.terminal')?.manifest.canonical_state_owner, 'TerminalSessionService');
  assert.deepEqual(snapshot.project, address);
  assert.equal(snapshot.package.artifact_digest, null);
  assert.equal(snapshot.package.artifact_state, 'UNATTESTED');
  assert.equal(snapshot.effect_replay, false);
}));

test('discovery never conflates installation, trust, grant, admission or execution', () => fixture(async ({ catalog, address }) => {
  const snapshot = await catalog.read(address);
  for (const app of snapshot.apps) {
    assert.equal(app.installation_state, 'UNOBSERVED');
    assert.equal(app.grant_state, 'NOT_EVALUATED');
    assert.equal(app.admission_state, 'NOT_EVALUATED');
    assert.equal(app.execution_state, 'GATED');
    assert.equal(app.execution_reason, 'APP_PRINCIPAL_ENFORCEMENT_UNPROVEN');
  }
  assert.ok(!('invoke' in catalog) && !('install' in catalog) && !('grant' in catalog));
}));

test('missing optional owner routes are explicit; registered route does not mean authorized execution', () => fixture(async ({ seat, address }) => {
  const snapshot = await createAppCatalog(seat, [{ method: 'GET', path: '/api/projects/current', capabilityPolicy: { owner: 'ProjectSeat', operation: 'capability.read' }, describeOperation: async () => ({ kind: 'capability.read' }) }]).read(address);
  assert.equal(snapshot.apps[0]!.capability_bindings[0]!.state, 'ADDRESSABLE');
  assert.equal(snapshot.apps[2]!.capability_bindings[0]!.state, 'UNAVAILABLE');
  assert.equal(snapshot.apps[2]!.capability_bindings[0]!.reason, 'OWNER_ROUTE_UNAVAILABLE');
  assert.equal(snapshot.apps[0]!.execution_state, 'GATED');
}));

test('unknown app/capability and cross-app capability are refused rather than falling back', () => fixture(async ({ catalog, address }) => {
  await assert.rejects(() => catalog.read(address, { app_id: 'covert.app.unknown' }), /UNKNOWN_APP/);
  await assert.rejects(() => catalog.read(address, { capability_id: 'shell.unrestricted' }), /UNKNOWN_CAPABILITY/);
  await assert.rejects(() => catalog.read(address, { app_id: 'covert.app.editor', capability_id: 'terminal.session.open' }), /UNKNOWN_CAPABILITY/);
}));

test('all capability routes present still leaves every application execution gated', () => fixture(async ({ catalog, seat, address }) => {
  const inventory = (await catalog.read(address)).apps;
  const routeRows = inventory.flatMap(app => app.manifest.capabilities.map(c => ({ method: c.method, path: c.route, capabilityPolicy: { owner: c.owner, operation: c.operation_kind }, ...(httpOperationKind(c.method, c.route) === null ? { describeOperation: async () => ({ kind: c.operation_kind }) } : {}) })));
  const registered = [...new Map(routeRows.map(route => [`${route.method} ${route.path}`, route] as const)).values()];
  const view = await createAppCatalog(seat, registered).read(address);
  assert.ok(view.apps.every(app => app.capability_bindings.every(c => c.state === 'ADDRESSABLE')),
    JSON.stringify(view.apps.flatMap(app => app.capability_bindings.filter(capability => capability.state !== 'ADDRESSABLE').map(capability => ({ app: app.manifest.app_id, ...capability })))));
  assert.ok(view.apps.every(app => app.execution_state === 'GATED' && app.grant_state === 'NOT_EVALUATED' && app.admission_state === 'NOT_EVALUATED'));
}));

test('effect and audience describe exact domain policy rather than method or blanket access', () => fixture(async ({ catalog, address }) => {
  const caps = (await catalog.read(address)).apps.flatMap(app => app.manifest.capabilities);
  const open = caps.find(c => c.id === 'terminal.session.open')!;
  assert.equal(open.method, 'POST'); assert.equal(open.operation_kind, 'terminal.session.start'); assert.equal(open.effect, 'EXECUTE');
  assert.equal(OPERATION_POLICY[httpOperationKind('POST', '/api/git/diff')!], 'read');
  assert.deepEqual(caps.find(c => c.id === 'cipher.activity.read')!.audiences, ['OPERATOR']);
  assert.equal(caps.find(c => c.id === 'cipher.agent.start')!.operation_kind, 'agent.start');
  assert.deepEqual(caps.find(c => c.id === 'cipher.agent.start')!.audiences, ['OPERATOR']);
  assert.deepEqual(caps.find(c => c.id === 'settings.read')!.audiences, ['OPERATOR']);
  assert.deepEqual(caps.find(c => c.id === 'workspace.file.write')!.audiences, ['OPERATOR', 'WORKER']);
}));

test('registered route identity alone cannot launder a foreign owner or wrong operation policy', () => fixture(async ({ seat, address }) => {
  const path = '/api/cipher/laptop/activity';
  const correct = { method: 'GET', path, capabilityPolicy: { owner: 'CipherLedger', operation: 'capability.read' } };
  for (const [route, reason] of [
    [{ ...correct, capabilityPolicy: { owner: 'CipherNotebook', operation: 'capability.read' } }, 'OWNER_DECLARATION_MISMATCH'],
    [{ ...correct, capabilityPolicy: { owner: 'CipherLedger', operation: 'capability.write' } }, 'OPERATION_POLICY_MISMATCH']
  ] as const) {
    const view = await createAppCatalog(seat, [route]).read(address), binding = view.apps[3]!.capability_bindings[0]!;
    assert.equal(binding.state, 'UNAVAILABLE'); assert.equal(binding.reason, reason);
  }
  const view = await createAppCatalog(seat, [correct]).read(address);
  assert.notEqual(view.apps[3]!.manifest.canonical_state_owner, correct.capabilityPolicy.owner);
  assert.equal(view.apps[3]!.capability_bindings[0]!.state, 'ADDRESSABLE');
}));

test('catalog read rejects a seat invalidated across its asynchronous owner read', () => fixture(async ({ seat, address }) => {
  let calls = 0;
  const owner = { ...seat, assertAddress: async (a: ProjectAddressT) => { if (++calls > 1) throw new Error('PROJECT_SEAT_INVALIDATED'); return seat.assertAddress(a); } };
  await assert.rejects(() => createAppCatalog(owner).read(address), /PROJECT_SEAT_INVALIDATED/);
}));

test('canonical identifiers are lowercase case-sensitive while owner labels preserve spelling', () => fixture(async ({ catalog, address }) => {
  const app = (await catalog.read(address)).apps[0]!.manifest;
  assert.equal(AppManifest.safeParse({ ...app, app_id: app.app_id.toUpperCase() }).success, false);
  assert.equal(AppCatalogQuery.safeParse({ ...address, capability_id: 'Project.Identity.Read' }).success, false);
  assert.equal(AppCatalogQuery.safeParse({ ...address, project_id: address.project_id.toUpperCase() }).success, false);
  assert.equal(app.canonical_state_owner, 'ProjectSeat');
}));

test('canonical project descriptor matches discovery metadata and a nonfunction cannot claim addressability', () => fixture(async ({ seat, root, address }) => {
  const route = routesForProjects(seat, root)[0]!;
  const operation = await route.describeOperation!({ query: {}, body: null }, 'catalog-policy-test');
  assert.equal(operation.kind, route.capabilityPolicy!.operation);
  assert.equal(route.capabilityPolicy!.owner, 'ProjectSeat');
  const tampered = { ...route, describeOperation: true };
  const view = await createAppCatalog(seat, [tampered]).read(address);
  assert.equal(view.apps[0]!.capability_bindings[0]!.reason, 'OPERATION_POLICY_MISMATCH');
  assert.equal(view.apps[0]!.execution_state, 'GATED');
}));

test('exact project AND checkout binding are mandatory even for metadata', () => fixture(async ({ catalog, address }) => {
  for (const foreign of [{ ...address, project_id: randomUUID() }, { ...address, checkout_id: randomUUID() }]) {
    await assert.rejects(() => catalog.read(foreign), /PROJECT_SCOPE_MISMATCH/);
  }
  assert.equal(AppCatalogQuery.safeParse({ app_id: 'covert.app.editor' }).success, false);
  assert.equal(AppCatalogQuery.safeParse({ ...address, principal_id: 'operator', granted: true }).success, false);
}));

test('catalog corruption invalidates earlier snapshots and never fabricates replacement identity', () => fixture(async ({ catalog, root, address }) => {
  const snapshot = await catalog.read(address);
  const file = path.join(root, '.aide', 'platform-projects', 'catalog.json');
  await fs.writeFile(file, '{corrupt');
  await assert.rejects(() => catalog.assertFresh(snapshot), /PROJECT_CATALOG_INVALID/);
  assert.equal(await fs.readFile(file, 'utf8'), '{corrupt');
}));

test('another composition generation invalidates a snapshot even with identical package/project', () => fixture(async ({ catalog, seat, address }) => {
  const snapshot = await catalog.read(address);
  await assert.rejects(() => createAppCatalog(seat).assertFresh(snapshot), /CATALOG_GENERATION_CHANGED/);
}));

test('retained digest/generation cannot launder changed manifest content', () => fixture(async ({ catalog, address }) => {
  const snapshot = JSON.parse(JSON.stringify(await catalog.read(address)));
  snapshot.apps[0].manifest.capabilities[0].route = '/api/unrestricted';
  await assert.rejects(() => catalog.assertFresh(snapshot), /CATALOG_CONTENT_CHANGED/);
}));

test('unfiltered snapshots cannot silently drop apps; intentional selected projections remain valid', () => fixture(async ({ catalog, address }) => {
  const snapshot = JSON.parse(JSON.stringify(await catalog.read(address)));
  snapshot.apps.pop();
  await assert.rejects(() => catalog.assertFresh(snapshot), /CATALOG_CONTENT_CHANGED/);
  const selected = await catalog.read(address, { app_id: 'covert.app.editor' });
  assert.equal(selected.apps.length, 1);
  await catalog.assertFresh(selected);
}));

test('declarations and snapshots are recursively immutable; repeat discovery creates no durable state', () => fixture(async ({ catalog, root, address }) => {
  const file = path.join(root, '.aide', 'platform-projects', 'catalog.json');
  const before = await fs.readFile(file, 'utf8');
  const snapshot = await catalog.read(address);
  assert.throws(() => snapshot.apps[0]!.manifest.required_capabilities.push('self.grant'), TypeError);
  assert.throws(() => { snapshot.apps[0]!.manifest.display_name = 'Injected'; }, TypeError);
  await catalog.assertFresh(snapshot);
  assert.equal(await fs.readFile(file, 'utf8'), before);
}));

test('imported declaration cannot carry grants/credentials and installation records are distinct schemas', () => fixture(async ({ catalog, address }) => {
  const snapshot = await catalog.read(address), app = snapshot.apps[0]!.manifest;
  assert.equal(AppManifest.safeParse({ ...app, granted_capabilities: ['*'] }).success, false);
  assert.equal(PackageManifest.safeParse({ ...snapshot.package, credential: 'plaintext' }).success, false);
  assert.equal(InstalledAppRecord.safeParse(app).success, false);
  assert.equal(AuthorityGrantReference.safeParse({ owner: 'Cipher', grant_ref: 'self-granted', principal_id: 'cipher', project: address, revision: 1 }).success, false);
}));

test('artifact substitution changes package identity despite unchanged friendly ID/version', () => fixture(async ({ catalog, address }) => {
  const original = (await catalog.read(address)).package;
  const { manifest_digest: _digest, ...declaration } = original;
  const changed = sealPackageManifest({ ...declaration, artifact_state: 'DIGEST_DECLARED', artifact_digest: 'a'.repeat(64) });
  assert.equal(changed.package_id, original.package_id);
  assert.equal(changed.version, original.version);
  assert.notEqual(changed.manifest_digest, original.manifest_digest);
  assert.equal(original.artifact_digest, null);
}));

test('instance reuse requires exact immutable package/app AND current installation revision/project', () => fixture(async ({ catalog, address }) => {
  const snapshot = await catalog.read(address), manifest = snapshot.apps[0]!.manifest;
  const installed = InstalledAppRecord.parse({ schema: 'covert.installed-app.v1', installation_id: randomUUID(), revision: 1, app_id: manifest.app_id, package_manifest_digest: snapshot.package.manifest_digest, app_manifest_digest: manifest.manifest_digest, location_ref: 'builtin:workstation', compatibility: 'UNKNOWN', readiness: 'UNKNOWN', state: 'DISABLED' });
  const instance = AppInstance.parse({ schema: 'covert.app-instance.v1', instance_id: randomUUID(), principal_id: randomUUID(), generation: randomUUID(), installation_id: installed.installation_id, installation_revision: 1, app_id: manifest.app_id, package_manifest_digest: snapshot.package.manifest_digest, app_manifest_digest: manifest.manifest_digest, project: address, state: 'STOPPED' });
  validateAppInstanceBinding(instance, installed, manifest, address);
  for (const changed of [{ ...installed, revision: 2 }, { ...installed, package_manifest_digest: 'b'.repeat(64) }, { ...installed, app_manifest_digest: 'c'.repeat(64) }]) assert.throws(() => validateAppInstanceBinding(instance, changed, manifest, address), /APP_BINDING_CHANGED/);
  assert.throws(() => validateAppInstanceBinding(instance, installed, manifest, { ...address, checkout_id: randomUUID() }), /APP_BINDING_CHANGED/);
  assert.equal(installed.state, 'DISABLED'); // Identity consistency grants no permission to run.
}));

test('read route requires a live Authority actor and exposes no lifecycle/effect endpoint', () => fixture(async ({ catalog, root, address }) => {
  const { authority, owner } = await pairServiceFixture(root);
  try {
    const routes = routesForAppCatalog(catalog, root);
    assert.deepEqual(routes.map(r => [r.method, r.path]), [['GET', '/api/apps/catalog']]);
    const route = routes[0]!;
    await assert.rejects(async () => route.handler({ query: address, body: null }), /authenticated/);
    const response = await route.handler({ query: address, body: null, authority, actor: owner });
    assert.equal(route.response.safeParse(response).success, true);
    authority.control.revoke(owner);
    await assert.rejects(async () => route.handler({ query: address, body: null, authority, actor: owner }), /revoked|invalid/);
  } finally { authority.control.close(); }
}));

test('revocation during an asynchronous catalog read refuses the result', () => fixture(async ({ catalog, root, address }) => {
  const { authority, owner } = await pairServiceFixture(root);
  try {
    const delayed = { ...catalog, read: async (...args: Parameters<typeof catalog.read>) => { const result = await catalog.read(...args); authority.control.revoke(owner); return result; } };
    await assert.rejects(async () => routesForAppCatalog(delayed, root)[0]!.handler({ query: address, body: null, authority, actor: owner }), /revoked|invalid/);
  } finally { authority.control.close(); }
}));

test('production HTTP mount validates scope/identity and never installs or permits an effect', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'covert-app-http-'));
  const arch = new ArchServer(root, path.join(root, 'arch.log'));
  const routes = await buildRoutes(root, 'test', { authority: arch.authority, events: arch.events });
  for (const route of routes) arch.route(route);
  const server = await arch.listen(0), address = server.address();
  assert.ok(address && typeof address === 'object');
  try {
    const owner = await pairFixture(arch, 'http://127.0.0.1:' + address.port);
    const project = await arch.projects.current();
    const query = new URLSearchParams({ project_id: project.project_id, checkout_id: project.checkout_id }).toString();
    const response = await owner.request('/api/apps/catalog?' + query);
    assert.equal(response.status, 200);
    const data = (await response.json()).data;
    assert.equal(data.apps.length, 9);
    for (const app of data.apps) for (const capability of app.manifest.capabilities) {
      const registered = routes.some(route => route.method === capability.method && route.path === capability.route);
      const binding = app.capability_bindings.find((entry: { id: string }) => entry.id === capability.id);
      assert.equal(binding.state, registered ? 'ADDRESSABLE' : 'UNAVAILABLE', `${app.manifest.app_id}:${capability.id}:${binding.reason}`);
      assert.equal(binding.reason, registered ? 'ROUTE_REGISTERED' : 'OWNER_ROUTE_UNAVAILABLE');
    }
    assert.equal((await owner.request('/api/apps/catalog')).status, 400);
    assert.equal((await owner.request('/api/apps/catalog?' + query + '&app_id=covert.app.unknown')).status, 404);
    assert.equal((await owner.request('/api/apps/catalog?' + query + '&capability_id=shell.unrestricted')).status, 404);
    assert.notEqual((await owner.request('/api/apps/catalog?' + query.replace(project.checkout_id, randomUUID()))).status, 200);
    for (const operation of ['install', 'update', 'uninstall', 'grant', 'invoke']) assert.equal((await owner.request('/api/apps/' + operation, { method: 'POST', body: '{}' })).status, 404);
    assert.equal((await owner.request('/api/apps/catalog?' + query, { headers: { Authorization: 'Bearer invalid' } })).status, 403);
    assert.equal((await arch.cipherLedger.status()).unresolved_actions.length, 0);
  } finally {
    arch.events.close(); arch.authority.control.close(); await arch.logger.flush();
    await new Promise<void>(resolve => server.close(() => resolve()));
    await fs.rm(root, { recursive: true, force: true });
  }
});
