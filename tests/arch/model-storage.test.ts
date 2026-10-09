import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ModelStorageError, resolveModelStorageDirectory, sameModelStorageDirectory } from '../../node/src/services/model-storage.mjs';
import { createModelManagerView } from '../../node/src/services/model-manager-view.ts';

function storageErrorMatching(pattern: RegExp): (error: unknown) => boolean {
  return error => error instanceof ModelStorageError && error.code === 'NOT_READY' && pattern.test(error.message);
}

test('model storage refuses unset, relative, missing, and unreadable roots explicitly', async t => {
  const previousModelDir = process.env.AIDE_MODEL_DIR;
  delete process.env.AIDE_MODEL_DIR;
  t.after(() => {
    if (previousModelDir === undefined) delete process.env.AIDE_MODEL_DIR;
    else process.env.AIDE_MODEL_DIR = previousModelDir;
  });
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'covert-model-storage-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const modelDir = path.join(root, 'models');
  await fs.mkdir(modelDir);
  const file = path.join(root, 'not-a-directory');
  await fs.writeFile(file, 'x');

  await assert.rejects(() => resolveModelStorageDirectory(), storageErrorMatching(/not configured/));
  await assert.rejects(() => resolveModelStorageDirectory('relative-models'), storageErrorMatching(/absolute path/));
  await assert.rejects(() => resolveModelStorageDirectory(path.join(root, 'missing')), storageErrorMatching(/does not exist/));
  await assert.rejects(() => resolveModelStorageDirectory(file), storageErrorMatching(/not a directory/));
  await assert.rejects(() => resolveModelStorageDirectory(modelDir, {
    stat: async () => ({ isDirectory: () => true }),
    realpath: async value => value,
    access: async () => { throw Object.assign(new Error('denied'), { code: 'EACCES' }); }
  }), storageErrorMatching(/not readable and writable/));
});

test('model storage resolves symlinks once and compares the same canonical path', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'covert-model-storage-canonical-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const realDir = path.join(root, 'volume', 'models');
  const aliasDir = path.join(root, 'alias');
  await fs.mkdir(realDir, { recursive: true });
  await fs.symlink(realDir, aliasDir, process.platform === 'win32' ? 'junction' : 'dir');
  const resolved = await resolveModelStorageDirectory(aliasDir);
  assert.equal(resolved, await fs.realpath(realDir));
  assert.equal(sameModelStorageDirectory(resolved, realDir), true);
  assert.equal(sameModelStorageDirectory(realDir, path.join(root, 'different')), false);
});

test('Model Manager rejects storage-root disagreement and never invents a workspace models folder', async () => {
  const runtime = { modelDir: path.resolve('runtime-models'), list: () => [], status: async () => ({ runtime: false, models: [] }) };
  assert.throws(() => createModelManagerView({
    workspace: path.resolve('workspace'),
    modelDir: path.resolve('different-models'),
    manifestPath: path.resolve('manifest.json'),
    modelRuntime: runtime,
    connectionsService: { list: async () => ({ connections: [] }) as never }
  }), /storage path disagreement/);

  const view = createModelManagerView({
    workspace: path.resolve('workspace'),
    manifestPath: path.resolve('manifest.json'),
    modelRuntime: { list: () => [], status: async () => ({ runtime: false, models: [] }) },
    connectionsService: { list: async () => ({ connections: [] }) as never }
  });
  await assert.rejects(() => view.snapshot(), /canonical model directory from Model Runtime/);
});
