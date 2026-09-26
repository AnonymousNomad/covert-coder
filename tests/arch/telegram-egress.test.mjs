import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createTelegramBridge } from '../../node/src/services/telegram.mjs';

test('Telegram Local-Only blocks connection and poll startup before network or running state', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'aide-telegram-egress-'));
  const configFile = path.join(workspace, '.aide', 'telegram', 'config.json');
  await fs.mkdir(path.dirname(configFile), { recursive: true });
  await fs.writeFile(configFile, JSON.stringify({ enabled: true, token_b64: 'fixture-token', chat_ids: [] }), 'utf8');
  let fetches = 0;
  const originalFetch = globalThis.fetch;
  const authority = {
    assertExecution(_execution, kind) { return { operation: kind }; },
    assertExternalEgressAllowed() {
      throw Object.assign(new Error('external egress blocked by Local-Only'), { code: 'FORBIDDEN' });
    }
  };
  globalThis.fetch = async () => { fetches += 1; return new Response(JSON.stringify({ ok: true, result: [] })); };
  try {
    const bridge = createTelegramBridge({ workspace, authority });
    await assert.rejects(() => bridge.connect({ token: 'fixture-token' }, {}), { code: 'FORBIDDEN' });
    await assert.rejects(() => bridge.startPolling({}), { code: 'FORBIDDEN' });
    assert.equal((await bridge.status()).running, false);
    assert.equal(fetches, 0);
  } finally {
    globalThis.fetch = originalFetch;
    await fs.rm(workspace, { recursive: true, force: true });
  }
});

test('Telegram external action fails closed when Authority egress guard is absent', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'aide-telegram-no-authority-'));
  let fetches = 0;
  const originalFetch = globalThis.fetch;
  const authority = { assertExecution() { return {}; } };
  globalThis.fetch = async () => { fetches += 1; return new Response('{}'); };
  try {
    const bridge = createTelegramBridge({ workspace, authority });
    await assert.rejects(() => bridge.connect({ token: 'fixture-token' }, {}), { code: 'NOT_READY' });
    assert.equal(fetches, 0);
  } finally {
    globalThis.fetch = originalFetch;
    await fs.rm(workspace, { recursive: true, force: true });
  }
});
