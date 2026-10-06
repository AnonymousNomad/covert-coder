import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDropIntent, createDropInspector } from '../../browser/src/workstation/interactions/drop-intent.mjs';

const binding = { projectId: 'project:a', rootGeneration: 2 };
const file = { version: 1, kind: 'file', id: 'file:one', revision: 'r1', project: binding };
const transfer = resource => ({ mime: 'application/vnd.covert.resource+json', data: JSON.stringify(resource) });
const inspectResource = async intent => ({ ...intent.resource, label: 'Selected source' });
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };

test('file drops form a scoped preview intent without approving execution', () => {
  const result = parseDropIntent(transfer(file), 'cipher', binding);
  assert.equal(result.kind, 'context.attach.preview');
  assert.deepEqual(result.project, binding);
  assert.deepEqual(result.resource, { kind: 'file', id: 'file:one', revision: 'r1' });
  assert.equal(result.activation, 'DISABLED');
  assert.ok(Object.isFrozen(result.resource));
});

for (const [kind, target, want] of [
  ['project', 'desktop', 'project.open.preview'],
  ['file', 'editor', 'file.open.preview'],
  ['model-artifact', 'models', 'model.inspect.preview'],
  ['profile', 'profiles', 'profile.apply.preview'],
  ['tool', 'launcher', 'tool.inspect.preview'],
  ['application', 'launcher', 'application.inspect.preview'],
]) test(kind + ' dispatches only its appropriate target', () => {
  const value = { version: 1, kind, id: kind + ':one', revision: 'r1', ...(kind === 'file' ? { project: binding } : {}) };
  assert.equal(parseDropIntent(transfer(value), target, binding).kind, want);
  assert.throws(() => parseDropIntent(transfer(value), 'unknown', binding), { code: 'UNSUPPORTED_DROP' });
});

test('native file metadata requests inspection without revealing a host path', () => {
  const result = parseDropIntent({ mime: 'application/x-covert-file-hint', files: [{ name: 'weights.gguf', size: 123, type: 'application/octet-stream', lastModified: 1 }] }, 'models', binding);
  assert.equal(result.kind, 'external-file.inspect');
  assert.deepEqual(result.file, { name: 'weights.gguf', size: 123, type: 'application/octet-stream', lastModified: 1 });
  assert.equal(result.activation, 'DISABLED');
});

for (const [name, value, code] of [
  ['HTML is not a resource', { mime: 'text/html', data: '<script>run()</script>' }, 'UNSUPPORTED_DROP'],
  ['URI does not trigger fetch', { mime: 'text/uri-list', data: 'https://evil.test/x' }, 'UNSUPPORTED_DROP'],
  ['invalid JSON', { mime: 'application/vnd.covert.resource+json', data: '{' }, 'INVALID_TRANSFER'],
  ['oversized input', { mime: 'application/vnd.covert.resource+json', data: 'x'.repeat(9000) }, 'TRANSFER_TOO_LARGE'],
  ['command field', transfer({ ...file, command: 'curl evil' }), 'INVALID_TRANSFER'],
  ['prototype field', { mime: 'application/vnd.covert.resource+json', data: '{"version":1,"kind":"file","id":"file:one","revision":"r1","project":{"projectId":"project:a","rootGeneration":2},"__proto__":{"grant":true}}' }, 'INVALID_TRANSFER'],
  ['path field', transfer({ ...file, path: 'C:\\Users\\secret' }), 'INVALID_TRANSFER'],
  ['foreign project', transfer({ ...file, project: { ...binding, projectId: 'project:b' } }), 'PROJECT_MISMATCH'],
  ['stale root', transfer({ ...file, project: { ...binding, rootGeneration: 1 } }), 'PROJECT_MISMATCH'],
]) test(name + ' refuses before owner inspection', () => {
  assert.throws(() => parseDropIntent(value, 'editor', binding), { code });
});

test('invalid geometry-free project binding and resource revisions reject', () => {
  assert.throws(() => parseDropIntent(transfer(file), 'editor', { ...binding, rootGeneration: Infinity }), { code: 'INVALID_TRANSFER' });
  assert.throws(() => parseDropIntent(transfer({ ...file, revision: '' }), 'editor', binding), { code: 'INVALID_TRANSFER' });
  assert.throws(() => parseDropIntent(transfer(file), 'editor', null), { code: 'PROJECT_REQUIRED' });
});

test('no registered owner yields unavailable rather than a successful preview', async () => {
  const inspector = createDropInspector({ getBinding: () => binding });
  assert.equal((await inspector.stage(transfer(file), 'editor')).status, 'UNAVAILABLE');
  inspector.dispose();
});

test('owner inspection is still effect-disabled and immutable', async () => {
  const inspector = createDropInspector({ getBinding: () => binding, inspectResource });
  const result = await inspector.stage(transfer(file), 'editor');
  assert.equal(result.status, 'PREVIEW');
  assert.equal(result.activation, 'DISABLED');
  assert.equal(result.preview.label, 'Selected source');
  assert.equal(Object.hasOwn(result, 'grant'), false);
  assert.equal(Object.hasOwn(inspector, 'execute'), false);
  assert.ok(Object.isFrozen(result.preview));
  inspector.dispose();
});

test('binding changes while an owner read is in flight discard the result', async () => {
  let current = { ...binding };
  const read = deferred();
  const inspector = createDropInspector({ getBinding: () => current, inspectResource: () => read.promise });
  const pending = inspector.stage(transfer(file), 'editor');
  current.rootGeneration = 3;
  read.resolve({ kind: 'file', id: 'file:one', revision: 'r1', label: 'old project' });
  assert.deepEqual(await pending, { status: 'REFUSED', code: 'PROJECT_CHANGED' });
  inspector.dispose();
});

test('invalidate cancels a hung owner read instead of resurrecting its preview', async () => {
  const read = deferred();
  const inspector = createDropInspector({ getBinding: () => binding, inspectResource: () => read.promise });
  const pending = inspector.stage(transfer(file), 'editor');
  inspector.invalidate();
  assert.deepEqual(await pending, { status: 'REFUSED', code: 'CANCELLED' });
  read.resolve({ kind: 'file', id: 'file:one', revision: 'r1', label: 'late' });
  inspector.dispose();
});

test('dispose rejects new requests and cancels the previous one', async () => {
  const inspector = createDropInspector({ getBinding: () => binding, inspectResource: () => new Promise(() => {}) });
  const pending = inspector.stage(transfer(file), 'editor');
  inspector.dispose();
  assert.equal((await pending).code, 'CANCELLED');
  assert.equal((await inspector.stage(transfer(file), 'editor')).code, 'DISPOSED');
});

test('owner cannot substitute resource identity or leak arbitrary fields', async () => {
  for (const result of [
    { kind: 'file', id: 'file:other', revision: 'r1', label: 'changed' },
    { kind: 'file', id: 'file:one', revision: 'r2', label: 'changed' },
    { kind: 'file', id: 'file:one', revision: 'r1', label: 'valid', credential: 'never echo' },
  ]) {
    const inspector = createDropInspector({ getBinding: () => binding, inspectResource: async () => result });
    const preview = await inspector.stage(transfer(file), 'editor');
    assert.equal(preview.status, 'REFUSED');
    assert.ok(!JSON.stringify(preview).includes('never echo'));
    inspector.dispose();
  }
});

test('concurrent inspection count is bounded and can be cancelled', async () => {
  const inspector = createDropInspector({ getBinding: () => binding, inspectResource: () => new Promise(() => {}), maxPending: 2 });
  const a = inspector.stage(transfer(file), 'editor');
  const b = inspector.stage(transfer(file), 'editor');
  assert.deepEqual(await inspector.stage(transfer(file), 'editor'), { status: 'REFUSED', code: 'BUSY' });
  inspector.dispose();
  assert.equal((await a).code, 'CANCELLED');
  assert.equal((await b).code, 'CANCELLED');
});

test('an unresponsive owner times out without any implicit fallback', async () => {
  const inspector = createDropInspector({ getBinding: () => binding, inspectResource: () => new Promise(() => {}), timeoutMs: 10 });
  assert.deepEqual(await inspector.stage(transfer(file), 'editor'), { status: 'REFUSED', code: 'INSPECTION_TIMEOUT' });
  inspector.dispose();
});

test('native metadata cannot masquerade as an authenticated file selection', async () => {
  const inspector = createDropInspector({ getBinding: () => binding, inspectResource });
  const result = await inspector.stage({ mime: 'application/x-covert-file-hint', files: [{ name: 'x.gguf', size: 1, type: '', lastModified: 0 }] }, 'models');
  assert.deepEqual(result, { status: 'UNAVAILABLE', code: 'NATIVE_FILE_SELECTION_REQUIRED' });
  inspector.dispose();
});

test('cancelled owner reads retain capacity until the owner actually settles', async () => {
  const read = deferred();
  const inspector = createDropInspector({ getBinding: () => binding, inspectResource: () => read.promise, maxPending: 1 });
  const pending = inspector.stage(transfer(file), 'editor');
  await Promise.resolve();
  inspector.invalidate();
  assert.equal((await pending).code, 'CANCELLED');
  assert.equal((await inspector.stage(transfer(file), 'editor')).code, 'BUSY');
  read.resolve({ kind: 'file', id: 'file:one', revision: 'r1', label: 'late' });
  await Promise.resolve();
  await Promise.resolve();
  inspector.dispose();
});
