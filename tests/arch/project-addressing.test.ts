import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { ArchServer } from '../../node/src/server.ts';
import { buildRoutes } from '../../node/src/openapi.ts';
import { pairFixture } from './authority-fixture.ts';
import { CurrentProjectResponse } from '../../common/contracts/project.ts';

async function fixture(run: (ctx: any) => Promise<void>, retainedRoot?: string) {
  const root = retainedRoot ?? await fs.mkdtemp(path.join(os.tmpdir(), 'covert-project-http-'));
  const arch = new ArchServer(root, path.join(root, 'arch.log'));
  for (const route of await buildRoutes(root, 'test', { authority: arch.authority, events: arch.events })) arch.route(route);
  const listener = await arch.listen(0), address = listener.address();
  assert.ok(address && typeof address === 'object');
  const owner = await pairFixture(arch, 'http://127.0.0.1:' + address.port);
  const operator = arch.authority.authenticate(owner.headers.Authorization.slice(7), owner.headers.Origin);
  try { await run({ root, arch, owner, operator }); }
  finally {
    arch.events.close(); arch.authority.control.close(); await arch.logger.flush();
    await new Promise<void>(resolve => listener.close(() => resolve()));
    if (retainedRoot === undefined) await fs.rm(root, { recursive: true, force: true });
  }
}

test('paired operator reads actual durable foreground address through the production route', () => fixture(async ({ root, arch, owner }) => {
  const response = await owner.request('/api/projects/current'); assert.equal(response.status, 200);
  const envelope = await response.json(); const current = CurrentProjectResponse.parse(envelope.data);
  assert.equal(current.checkout.root, await fs.realpath(root));
  assert.equal(current.project.project_id, current.checkout.project_id);
  assert.equal(current.switching, 'GATED_OWNER_REBIND_REQUIRED');
  assert.equal((await owner.request('/api/projects/current?project_id=foreign')).status, 400);
  const persisted = JSON.parse(await fs.readFile(path.join(root, '.aide', 'platform-projects', 'catalog.json'), 'utf8'));
  assert.equal(persisted.checkouts[0].checkout_id, current.checkout.checkout_id);
  assert.equal((await arch.projects.current()).project_id, current.project.project_id);
}));

test('both human UI and scoped capability port record the same canonical project with separate principals', () => fixture(async ({ root, arch, owner, operator }) => {
  const address = await arch.projects.current();
  const body = { path: 'operator.txt', content: 'HUMAN', approved: true };
  const headers = await owner.approve('POST', '/api/file/write', body, 'human-project');
  assert.equal((await owner.request('/api/file/write', { method: 'POST', headers, body: JSON.stringify(body) })).status, 200);
  const resident = arch.authority.control.delegate(operator, 'service', ['workspace.write']);
  const seat = arch.capabilityPort(resident);
  const request = { method: 'POST' as const, path: '/api/file/write', task_id: 'resident-project', project: { project_id: address.project_id, checkout_id: address.checkout_id }, body: { path: 'resident.txt', content: 'RESIDENT', approved: true } };
  const operation = await seat.prepare(request);
  await assert.rejects(() => seat.invoke(request, operation.operation_id), /not approved/);
  await arch.authority.decide(operator, operation.operation_id, 'approve');
  await seat.invoke(request, operation.operation_id);
  assert.equal(await fs.readFile(path.join(root, 'resident.txt'), 'utf8'), 'RESIDENT');
  const records = await arch.cipherLedger.list();
  assert.ok(records.length >= 8);
  assert.ok(records.every((record: any) => record.project_id === address.project_id && record.checkout_id === address.checkout_id));
  assert.deepEqual(new Set(records.map((record: any) => record.principal_id)), new Set([operator.id, resident.id]));
}));

test('an explicit foreign project/checkout cannot retarget a granted principal or reuse a permit', () => fixture(async ({ root, arch, operator }) => {
  const second = path.join(root, 'other-checkout'); await fs.mkdir(second);
  const foreign = await arch.projects.registry.enrollCheckout(second), current = await arch.projects.current();
  const resident = arch.authority.control.delegate(operator, 'service', ['workspace.write']);
  const seat = arch.capabilityPort(resident);
  const request = { method: 'POST' as const, path: '/api/file/write', task_id: 'scope', project: { project_id: current.project_id, checkout_id: current.checkout_id }, body: { path: 'never.txt', content: 'NEVER', approved: true } };
  const op = await seat.prepare(request); await arch.authority.decide(operator, op.operation_id, 'approve');
  await assert.rejects(() => seat.invoke({ ...request, project: { project_id: foreign.project_id, checkout_id: foreign.checkout_id } }, op.operation_id), /PROJECT_SCOPE_MISMATCH/);
  await assert.rejects(() => seat.prepare({ ...request, project: { project_id: current.project_id, checkout_id: foreign.checkout_id } }), /PROJECT_SCOPE_MISMATCH/);
  await assert.rejects(() => fs.access(path.join(root, 'never.txt')));
  await assert.rejects(() => fs.access(path.join(second, 'never.txt')));
  assert.equal(arch.authority.inspect(operator, op.operation_id).state, 'approved');
  assert.equal((await arch.projects.current()).project_id, current.project_id);
  arch.authority.control.revoke(resident);
}));

test('catalog corruption before consumption blocks an approved effect and retains operator evidence access', () => fixture(async ({ root, arch, owner }) => {
  const body = { path: 'never.txt', content: 'NEVER', approved: true };
  const headers = await owner.approve('POST', '/api/file/write', body, 'corrupt-project');
  const file = path.join(root, '.aide', 'platform-projects', 'catalog.json'); await fs.writeFile(file, '{corrupt');
  const response = await owner.request('/api/file/write', { method: 'POST', headers, body: JSON.stringify(body) });
  assert.notEqual(response.status, 200);
  await assert.rejects(() => fs.access(path.join(root, 'never.txt')));
  assert.equal((await arch.cipherLedger.status()).state, 'LOCKDOWN');
  assert.equal((await owner.request('/api/cipher/laptop/activity')).status, 200);
  assert.equal(await fs.readFile(file, 'utf8'), '{corrupt');
}));

test('generic file capability cannot read or mutate canonical identity catalog', () => fixture(async ({ arch, owner }) => {
  assert.equal((await owner.request('/api/file?path=.aide%2Fplatform-projects%2Fcatalog.json')).status, 403);
  for (const alias of ['.aide/platform-projects-enrollment.json', '.aide/platform-projects-enrollment.json::$DATA', '.AIDE/PLATFORM-PROJECTS-ENROLLMENT.JSON.']) assert.equal((await owner.request('/api/file?path=' + encodeURIComponent(alias))).status, 403);
  const body = { path: '.aide/platform-projects/catalog.json', content: '{}', approved: true };
  const headers = await owner.approve('POST', '/api/file/write', body, 'catalog-write');
  assert.equal((await owner.request('/api/file/write', { method: 'POST', headers, body: JSON.stringify(body) })).status, 403);
  assert.equal((await arch.cipherLedger.status()).state, 'NORMAL');
}));

test('service restart retains identity and effect references while old principals and permits remain invalid', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'covert-project-restart-'));
  let address: any, oldPrincipal: any, oldHeaders: any, oldOperation: any;
  try {
    await fixture(async ({ arch, owner, operator }) => {
      address = await arch.projects.current(); oldPrincipal = operator; oldHeaders = owner.headers;
      const body = { path: 'restart.txt', content: 'PERSISTED_EFFECT', approved: true };
      const headers = await owner.approve('POST', '/api/file/write', body, 'before-restart');
      assert.equal((await owner.request('/api/file/write', { method: 'POST', headers, body: JSON.stringify(body) })).status, 200);
      oldOperation = await arch.capabilityPort(operator).prepare({ method: 'POST', path: '/api/file/write', task_id: 'old-permit', body: { path: 'never.txt', content: 'X', approved: true } });
      await arch.authority.decide(operator, oldOperation.operation_id, 'approve');
    }, root);
    await fixture(async ({ arch, owner }) => {
      assert.deepEqual(await arch.projects.current(), address);
      assert.equal(await fs.readFile(path.join(root, 'restart.txt'), 'utf8'), 'PERSISTED_EFFECT');
      assert.equal((await owner.request('/api/projects/current', { headers: oldHeaders })).status, 403);
      assert.throws(() => arch.capabilityPort(oldPrincipal), { code: 'FORBIDDEN' });
      assert.equal((await arch.cipherLedger.status()).state, 'RECONCILING');
      assert.ok((await arch.cipherLedger.status()).unresolved_actions.includes(oldOperation.operation_id));
      assert.equal((await owner.request('/api/cipher/laptop/activity')).status, 200);
      await assert.rejects(() => fs.access(path.join(root, 'never.txt')));
      assert.ok((await arch.cipherLedger.list()).every((record: any) => record.project_id === address.project_id && record.checkout_id === address.checkout_id));
    }, root);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test('restart with lost catalog preserves effects/evidence and never fabricates new enrollment', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'covert-project-loss-'));
  try {
    await fixture(async ({ owner }) => {
      const body = { path: 'existing.txt', content: 'KEEP_EXISTING', approved: true };
      const headers = await owner.approve('POST', '/api/file/write', body, 'before-loss');
      assert.equal((await owner.request('/api/file/write', { method: 'POST', headers, body: JSON.stringify(body) })).status, 200);
    }, root);
    await fs.rm(path.join(root, '.aide', 'platform-projects'), { recursive: true });
    const marker = await fs.readFile(path.join(root, '.aide', 'platform-projects-enrollment.json'), 'utf8');
    await fixture(async ({ arch, owner, operator }) => {
      assert.equal((await arch.cipherLedger.status()).state, 'LOCKDOWN');
      assert.equal((await owner.request('/api/projects/current')).status, 409);
      assert.equal((await owner.request('/api/cipher/laptop/activity')).status, 200);
      await assert.rejects(() => arch.capabilityPort(operator).prepare({ method: 'POST', path: '/api/file/write', task_id: 'must-not-run', body: { path: 'never.txt', content: 'X', approved: true } }), { code: 'NOT_READY' });
      assert.equal(await fs.readFile(path.join(root, 'existing.txt'), 'utf8'), 'KEEP_EXISTING');
      assert.equal(await fs.readFile(path.join(root, '.aide', 'platform-projects-enrollment.json'), 'utf8'), marker);
      await assert.rejects(() => fs.access(path.join(root, '.aide', 'platform-projects', 'catalog.json')));
    }, root);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test('addressing contract rejects window/path labels and incomplete project addresses', () => fixture(async ({ arch, operator }) => {
  const seat = arch.capabilityPort(arch.authority.control.delegate(operator, 'service', ['workspace.read']));
  for (const project of [{ project_id: 'Editor', checkout_id: 'window-1' }, { project_id: 'E:/project' }, { checkout_id: 'tab-1' }]) {
    await assert.rejects(() => seat.invoke({ method: 'GET', path: '/api/file?path=x', task_id: 'bad-address', project } as any));
  }
}));
