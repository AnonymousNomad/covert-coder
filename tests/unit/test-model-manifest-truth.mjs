import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const manifestPath = path.join(repoRoot, 'models', 'manifest.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));

test('active model catalog does not expose retired or removed model entries', () => {
  const entries = manifest.models;
  assert.ok(Array.isArray(entries));
  assert.equal(entries.some(entry => entry.id === 'aide-cipher-v1'), false);
  assert.equal(entries.some(entry => /deprecated|\(removed/i.test(`${entry.name ?? ''} ${entry.artifact_uri ?? ''}`)), false);
});
