import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('installed desktop smoke uses canonical public health and requires relaunch after cleanup', async () => {
  const lifecycle = await readFile(new URL('../../scripts/desktop-lifecycle-smoke.ps1', import.meta.url), 'utf8');
  assert.ok(lifecycle.includes("-Url 'http://127.0.0.1:4777/api/health'"));
  assert.ok(!lifecycle.includes("-Url 'http://127.0.0.1:4777/health'"));
  for (const label of ['first launch', 'same-install relaunch', 'after reinstall']) {
    assert.ok(lifecycle.includes(`-Label '${label}'`), `required lifecycle cycle: ${label}`);
  }
  assert.ok(lifecycle.includes('$_.LocalPort -in 4777,4778,4779'),
    'cleanup checks all three product listeners');
});
