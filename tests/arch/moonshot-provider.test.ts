// tests/arch/moonshot-provider.test.ts
// Kimi/Moonshot first-class provider (overnight closure): distinct identity in
// the builtin registry, truthful key gating (no silent fallback, no network
// before the key check), and the real Bearer chat path on the documented
// OpenAI-compatible endpoint. No live key is required for this file.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import { promises as fs } from 'node:fs';
import { BUILTIN_PROVIDERS, ProviderService, ProviderError, type ProviderServiceOptions } from '../../node/src/services/providers.ts';
import { CredentialStore, type CryptService } from '../../node/src/services/credentials.ts';

class FakeCrypt implements CryptService {
  readonly kind = 'fake';
  async available(): Promise<boolean> { return true; }
  async protect(plaintext: string): Promise<string> { return `enc:${Buffer.from(plaintext, 'utf8').toString('base64')}`; }
  async unprotect(blobB64: string): Promise<string> {
    if (!blobB64.startsWith('enc:')) throw new Error('bad blob');
    return Buffer.from(blobB64.slice(4), 'base64').toString('utf8');
  }
}

function makeService(dir: string, fetchFn: typeof fetch): ProviderService {
  const options: ProviderServiceOptions = {
    credentials: new CredentialStore(dir, new FakeCrypt()),
    fetchFn,
    logger: { info: () => undefined }
  };
  return new ProviderService(dir, options);
}

test('moonshot carries a distinct first-class identity', () => {
  const moonshot = BUILTIN_PROVIDERS.find(provider => provider.id === 'moonshot');
  assert.ok(moonshot);
  assert.equal(moonshot.name, 'Moonshot (Kimi)');
  assert.equal(moonshot.kind, 'openai-compatible');
  assert.equal(moonshot.baseUrl, 'https://api.moonshot.ai/v1');
  assert.equal(moonshot.egressHost, 'api.moonshot.ai');
  assert.deepEqual(moonshot.models, ['kimi-k2.6', 'kimi-k2.7-code', 'kimi-k3']);
});

test('chat without a stored key fails truthfully before any network attempt', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'aide-moonshot-'));
  try {
    let fetched = 0;
    const service = makeService(dir, (async () => { fetched += 1; return new Response(null, { status: 200 }); }) as typeof fetch);
    await assert.rejects(
      () => service.chat('moonshot', 'kimi-k2.6', [{ role: 'user', content: 'hi' }]),
      (error: unknown) => error instanceof ProviderError && error.code === 'NOT_READY' && /not connected/.test(error.message)
    );
    assert.equal(fetched, 0, 'no egress may happen before the key check');
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('connected moonshot chats over the documented endpoint with a Bearer key', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'aide-moonshot-'));
  try {
    const calls: Array<{ url: string; auth: string | null; body: Record<string, unknown> }> = [];
    const fetchFn = (async (url: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      calls.push({ url: String(url), auth: headers.get('authorization'), body: JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown> });
      if (String(url).endsWith('/chat/completions') && calls.length === 1) return new Response(null, { status: 200 });
      return new Response(JSON.stringify({ choices: [{ message: { content: 'KIMI-OK' } }], usage: { completion_tokens: 3 } }), { status: 200 });
    }) as typeof fetch;
    const service = makeService(dir, fetchFn);
    const connect = await service.connect({ providerId: 'moonshot', key: 'ms-test-key' });
    assert.equal(connect.status, 'connected');
    assert.ok(calls[0]!.url.startsWith('https://api.moonshot.ai/v1/'));
    assert.equal(calls[0]!.auth, 'Bearer ms-test-key');
    const result = await service.chat('moonshot', 'kimi-k2.6', [{ role: 'user', content: 'hi' }]);
    assert.equal(result.text, 'KIMI-OK');
    assert.equal(result.modelId, 'moonshot:kimi-k2.6');
    const chatCall = calls[calls.length - 1]!;
    assert.ok(chatCall.url.endsWith('/chat/completions'));
    assert.equal(chatCall.auth, 'Bearer ms-test-key');
    assert.equal(chatCall.body.model, 'kimi-k2.6');
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('a rejected key surfaces as NOT_READY, never as a silent local fallback', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'aide-moonshot-'));
  try {
    const fetchFn = (async () => new Response(null, { status: 401 })) as typeof fetch;
    const service = makeService(dir, fetchFn);
    await service.connect({ providerId: 'moonshot', key: 'ms-bad-key' }).catch(() => undefined);
    await assert.rejects(
      () => service.chat('moonshot', 'kimi-k2.6', [{ role: 'user', content: 'hi' }]),
      (error: unknown) => error instanceof ProviderError && (error.code === 'NOT_READY' || error.code === 'CHILD_FAILED')
    );
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
