import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createProjectRegistry } from '../../node/src/services/project-registry.ts';

async function fixture(run: (root: string, storage: string, checkout: string) => Promise<void>) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'covert-project-'));
  const storage = path.join(root, 'catalog');
  const checkout = path.join(root, 'checkout');
  await fs.mkdir(checkout);
  try { await run(root, storage, checkout); }
  finally { await fs.rm(root, { recursive: true, force: true }); }
}

test('separate Windows Node processes restore the same IDs and reject lost catalog history', () => fixture(async (_root, storage, checkout) => {
  const execute = promisify(execFile);
  const moduleUrl = new URL('../../node/src/services/project-registry.ts', import.meta.url).href;
  const code = "const {createProjectRegistry}=await import(process.argv[1]); console.log(JSON.stringify(await createProjectRegistry({storageRoot:process.argv[2]}).enrollCheckout(process.argv[3])));";
  const invoke = () => execute(process.execPath, ['--max-old-space-size=128', '--input-type=module', '--eval', code, moduleUrl, storage, checkout], { timeout: 5000, maxBuffer: 16384 });
  const first = JSON.parse((await invoke()).stdout), second = JSON.parse((await invoke()).stdout);
  assert.deepEqual(second, first);
  await fs.unlink(path.join(storage, 'identity.json')); await fs.unlink(path.join(storage, 'catalog.json'));
  await assert.rejects(invoke, /PROJECT_CATALOG_INVALID/);
  await assert.rejects(() => fs.access(path.join(storage, 'catalog.json')));
}));

test('project and checkout have separate durable UUIDs, independent of path/window labels', () => fixture(async (_root, storage, checkout) => {
  const owner = createProjectRegistry({ storageRoot: storage });
  const binding = await owner.enrollCheckout(checkout);
  assert.match(binding.project_id, /^[0-9a-f-]{36}$/);
  assert.match(binding.checkout_id, /^[0-9a-f-]{36}$/);
  assert.notEqual(binding.project_id, binding.checkout_id);
  const bytes = await fs.readFile(path.join(storage, 'catalog.json'), 'utf8');
  const restored = await createProjectRegistry({ storageRoot: storage }).enrollCheckout(checkout);
  assert.deepEqual(restored, binding);
  assert.equal(await fs.readFile(path.join(storage, 'catalog.json'), 'utf8'), bytes);
}));

test('many known projects and explicit additional checkouts do not collapse into one identity', () => fixture(async (root, storage, checkout) => {
  const second = path.join(root, 'second'), worktree = path.join(root, 'worktree');
  await fs.mkdir(second); await fs.mkdir(worktree);
  const owner = createProjectRegistry({ storageRoot: storage });
  const a = await owner.enrollCheckout(checkout), b = await owner.enrollCheckout(second);
  const a2 = await owner.enrollCheckout(worktree, a.project_id);
  assert.notEqual(a.project_id, b.project_id);
  assert.equal(a2.project_id, a.project_id);
  assert.notEqual(a2.checkout_id, a.checkout_id);
  const state = await owner.list();
  assert.equal(state.projects.length, 2); assert.equal(state.checkouts.length, 3);
  await assert.rejects(() => owner.assertBinding(b.project_id, a.checkout_id, checkout), /PROJECT_SCOPE_MISMATCH/);
  await assert.rejects(() => owner.assertBinding(a.project_id, a.checkout_id, second), /PROJECT_SCOPE_MISMATCH/);
}));

test('caller-supplied unknown project identity cannot create or acquire a binding', () => fixture(async (_root, storage, checkout) => {
  const owner = createProjectRegistry({ storageRoot: storage });
  await assert.rejects(() => owner.enrollCheckout(checkout, randomUUID()), /PROJECT_NOT_FOUND/);
  await assert.rejects(() => fs.access(path.join(storage, 'catalog.json')));
}));

test('a known checkout cannot be silently reassigned to another project', () => fixture(async (root, storage, checkout) => {
  const second = path.join(root, 'second'); await fs.mkdir(second);
  const owner = createProjectRegistry({ storageRoot: storage });
  const a = await owner.enrollCheckout(checkout), b = await owner.enrollCheckout(second);
  const bytes = await fs.readFile(path.join(storage, 'catalog.json'), 'utf8');
  await assert.rejects(() => owner.enrollCheckout(checkout, b.project_id), /PROJECT_SCOPE_MISMATCH/);
  assert.equal((await owner.assertBinding(a.project_id, a.checkout_id, checkout)).project_id, a.project_id);
  assert.equal(await fs.readFile(path.join(storage, 'catalog.json'), 'utf8'), bytes);
}));

test('root replacement is detected rather than assigning existing identity to new files', () => fixture(async (root, storage, checkout) => {
  const owner = createProjectRegistry({ storageRoot: storage });
  const binding = await owner.enrollCheckout(checkout);
  await fs.rename(checkout, path.join(root, 'original-root'));
  await fs.mkdir(checkout);
  const bytes = await fs.readFile(path.join(storage, 'catalog.json'), 'utf8');
  await assert.rejects(() => owner.enrollCheckout(checkout), /CHECKOUT_ROOT_CHANGED/);
  await assert.rejects(() => owner.assertBinding(binding.project_id, binding.checkout_id, checkout), /CHECKOUT_ROOT_CHANGED/);
  assert.equal(await fs.readFile(path.join(storage, 'catalog.json'), 'utf8'), bytes);
}));

test('corrupt or unsupported catalog is preserved and never replaced with invented identities', () => fixture(async (_root, storage, checkout) => {
  await fs.mkdir(storage);
  for (const bytes of ['{broken', JSON.stringify({ schema: 'future', projects: [], checkouts: [] })]) {
    await fs.writeFile(path.join(storage, 'catalog.json'), bytes);
    await assert.rejects(() => createProjectRegistry({ storageRoot: storage }).enrollCheckout(checkout), /PROJECT_CATALOG_INVALID/);
    assert.equal(await fs.readFile(path.join(storage, 'catalog.json'), 'utf8'), bytes);
  }
}));

test('duplicate identities and dangling checkout references are rejected on reopen', () => fixture(async (_root, storage, checkout) => {
  const owner = createProjectRegistry({ storageRoot: storage }); await owner.enrollCheckout(checkout);
  const file = path.join(storage, 'catalog.json'), original = await fs.readFile(file, 'utf8');
  for (const mutate of [
    (state: any) => state.projects.push(state.projects[0]),
    (state: any) => state.checkouts.push(state.checkouts[0]),
    (state: any) => { state.checkouts[0].project_id = randomUUID(); }
  ]) {
    const state = JSON.parse(original); mutate(state); const invalid = JSON.stringify(state);
    await fs.writeFile(file, invalid);
    await assert.rejects(() => createProjectRegistry({ storageRoot: storage }).list(), /PROJECT_CATALOG_INVALID/);
    assert.equal(await fs.readFile(file, 'utf8'), invalid);
  }
}));

test('concurrent in-process owners serialize enrollment without replacing established IDs', () => fixture(async (_root, storage, checkout) => {
  const bindings = await Promise.all(Array.from({ length: 8 }, () => createProjectRegistry({ storageRoot: storage }).enrollCheckout(checkout)));
  assert.ok(bindings.every(binding => binding.project_id === bindings[0]?.project_id && binding.checkout_id === bindings[0]?.checkout_id));
  assert.equal((await createProjectRegistry({ storageRoot: storage }).list()).projects.length, 1);
}));

test('failed atomic replacement does not return an identity or corrupt the prior catalog', () => fixture(async (root, storage, checkout) => {
  const owner = createProjectRegistry({ storageRoot: storage }); await owner.enrollCheckout(checkout);
  const bytes = await fs.readFile(path.join(storage, 'catalog.json'), 'utf8');
  const second = path.join(root, 'second'); await fs.mkdir(second);
  const failing = createProjectRegistry({ storageRoot: storage, testHooks: { beforePhase: phase => { if (phase === 'replace') throw new Error('write canary'); } } });
  await assert.rejects(() => failing.enrollCheckout(second), /atomic JSON write failed/);
  assert.equal(await fs.readFile(path.join(storage, 'catalog.json'), 'utf8'), bytes);
  assert.equal((await owner.list()).checkouts.length, 1);
}));

test('catalog cannot be redirected through a storage-directory junction', () => fixture(async (root, storage, checkout) => {
  const external = path.join(root, 'external'); await fs.mkdir(external);
  await fs.symlink(external, storage, process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(() => createProjectRegistry({ storageRoot: storage }).enrollCheckout(checkout), /PROJECT_STORAGE_UNSAFE/);
  await assert.rejects(() => fs.access(path.join(external, 'catalog.json')));
}));

test('live catalog identity replacement cannot silently change a known owner', () => fixture(async (_root, storage, checkout) => {
  const owner = createProjectRegistry({ storageRoot: storage }); await owner.enrollCheckout(checkout);
  const file = path.join(storage, 'catalog.json'), state = JSON.parse(await fs.readFile(file, 'utf8'));
  state.catalog_id = randomUUID();
  await fs.writeFile(file, JSON.stringify(state));
  await fs.writeFile(path.join(storage, 'identity.json'), JSON.stringify({ schema: 'covert.project-catalog-identity.v1', catalog_id: state.catalog_id }));
  await fs.writeFile(path.join(path.dirname(storage), 'catalog-enrollment.json'), JSON.stringify({ schema: 'covert.project-catalog-identity.v1', catalog_id: state.catalog_id }));
  await assert.rejects(() => owner.list(), /PROJECT_CATALOG_CHANGED/);
  assert.equal(JSON.parse(await fs.readFile(file, 'utf8')).catalog_id, state.catalog_id);
}));

test('deleting both catalog files does not become first use after restart', () => fixture(async (_root, storage, checkout) => {
  await createProjectRegistry({ storageRoot: storage }).enrollCheckout(checkout);
  const enrollmentFile = path.join(path.dirname(storage), 'catalog-enrollment.json');
  const marker = await fs.readFile(enrollmentFile, 'utf8').catch(() => null);
  await fs.unlink(path.join(storage, 'identity.json')); await fs.unlink(path.join(storage, 'catalog.json'));
  await assert.rejects(() => createProjectRegistry({ storageRoot: storage }).enrollCheckout(checkout), /PROJECT_CATALOG_INVALID/);
  assert.notEqual(marker, null);
  assert.equal(await fs.readFile(enrollmentFile, 'utf8'), marker);
  await assert.rejects(() => fs.access(path.join(storage, 'catalog.json')));
}));

test('missing catalog with surviving identity requires recovery on restart', () => fixture(async (_root, storage, checkout) => {
  await createProjectRegistry({ storageRoot: storage }).enrollCheckout(checkout);
  const identity = await fs.readFile(path.join(storage, 'identity.json'), 'utf8');
  await fs.unlink(path.join(storage, 'catalog.json'));
  await assert.rejects(() => createProjectRegistry({ storageRoot: storage }).enrollCheckout(checkout), /PROJECT_CATALOG_INVALID/);
  assert.equal(await fs.readFile(path.join(storage, 'identity.json'), 'utf8'), identity);
  await assert.rejects(() => fs.access(path.join(storage, 'catalog.json')));
}));

test('first-use catalog write failure leaves a recovery marker, never a claimed registration', () => fixture(async (_root, storage, checkout) => {
  const owner = createProjectRegistry({ storageRoot: storage, testHooks: { beforePhase: phase => { if (phase === 'replace') throw new Error('first-use canary'); } } });
  await assert.rejects(() => owner.enrollCheckout(checkout), /atomic JSON write failed/);
  const identity = await fs.readFile(path.join(storage, 'identity.json'), 'utf8');
  await assert.rejects(() => createProjectRegistry({ storageRoot: storage }).enrollCheckout(checkout), /PROJECT_CATALOG_INVALID/);
  assert.equal(await fs.readFile(path.join(storage, 'identity.json'), 'utf8'), identity);
}));

test('capacity refusal occurs before replacing a valid readable catalog', () => fixture(async (root, storage, checkout) => {
  const owner = createProjectRegistry({ storageRoot: storage }); await owner.enrollCheckout(checkout);
  const file = path.join(storage, 'catalog.json'), state = JSON.parse(await fs.readFile(file, 'utf8'));
  const limit = 2 * 1024 * 1024;
  const bytes = () => JSON.stringify(state, null, 2) + '\n';
  let index = 0;
  while (Buffer.byteLength(bytes()) < limit - 4300) {
    state.checkouts.push({ ...state.checkouts[0], checkout_id: randomUUID(), root: path.join(root, 'unused-' + index++ + '-' + 'x'.repeat(3900)) });
  }
  const candidate = { ...state.checkouts[0], checkout_id: randomUUID(), root: path.join(root, 'unused-final-') };
  state.checkouts.push(candidate);
  const padding = limit - 100 - Buffer.byteLength(bytes());
  assert.ok(padding > 0 && candidate.root.length + padding <= 4096);
  candidate.root += 'x'.repeat(padding);
  const previous = bytes(); assert.equal(Buffer.byteLength(previous), limit - 100);
  await fs.writeFile(file, previous);
  assert.equal((await owner.list()).catalog_id, state.catalog_id);
  const nextRoot = path.join(root, 'new'); await fs.mkdir(nextRoot);
  await assert.rejects(() => owner.enrollCheckout(nextRoot), /PROJECT_CATALOG_CAPACITY/);
  assert.equal(await fs.readFile(file, 'utf8'), previous);
  assert.equal((await owner.list()).checkouts.length, state.checkouts.length);
}));
