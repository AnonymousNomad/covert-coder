import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEmbedGate } from '../../node/src/openapi.ts';

test('automatic embedding probe rejects non-loopback endpoint before network contact', async () => {
  let calls = 0;
  const gate = createEmbedGate(undefined, {
    endpoint: 'https://embeddings.example/v1',
    fetchImpl: (async () => { calls += 1; return new Response('{}', { status: 200 }); }) as typeof fetch
  });
  assert.equal(await gate.resolve(), null);
  assert.equal(calls, 0);
});

test('loopback embedding endpoint remains available for local indexing', async () => {
  const urls: string[] = [];
  const gate = createEmbedGate(undefined, {
    endpoint: 'http://127.0.0.1:12345',
    fetchImpl: (async (input: RequestInfo | URL) => {
      urls.push(String(input));
      return new Response(JSON.stringify({ data: [{ embedding: [0.25, 0.5] }] }), {
        status: 200, headers: { 'content-type': 'application/json' }
      });
    }) as typeof fetch
  });
  const embed = await gate.resolve();
  assert.equal(typeof embed, 'function');
  assert.deepEqual(await embed!(['fixture']), [[0.25, 0.5]]);
  assert.deepEqual(urls, [
    'http://127.0.0.1:12345/v1/embeddings',
    'http://127.0.0.1:12345/v1/embeddings'
  ]);
});
