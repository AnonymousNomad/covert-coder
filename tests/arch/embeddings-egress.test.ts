import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEmbedGate } from '../../node/src/openapi.ts';
import { EventHub } from '../../node/src/events.ts';
import { Logger } from '../../node/src/services/logger.ts';
import { IndexStreamEvent } from '../../common/contracts/index.ts';

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

test('embedding gate publishes truthful boot verdicts accepted by the canonical index event contract', async () => {
  for (const fixture of [
    { endpoint: null, enabled: false },
    { endpoint: 'invalid-endpoint', enabled: false },
    { endpoint: 'https://embeddings.example', enabled: false },
    { endpoint: 'http://127.0.0.1:12345', enabled: true },
    { endpoint: 'http://127.0.0.1:12345', enabled: false, httpStatus: 501 },
    { endpoint: 'http://127.0.0.1:12345', enabled: false, malformed: true }
  ]) {
    const errors: string[] = [];
    class CapturingLogger extends Logger {
      override error(message: string): void { errors.push(message); }
    }
    const hub = new EventHub(new CapturingLogger('unused-embedding-gate.log'));
    const verdicts: Array<{ data: unknown; accepted: boolean }> = [];
    const publish = hub.publish.bind(hub);
    hub.publish = (channel, data, audience) => {
      const result = publish(channel, data, audience);
      verdicts.push({ data, accepted: result.accepted });
      return result;
    };
    const gate = createEmbedGate(hub, {
      endpoint: fixture.endpoint,
      fetchImpl: (async () => Response.json({ data: fixture.malformed ? [] : [{ embedding: [0.25, 0.5] }] }, { status: fixture.httpStatus ?? 200 })) as typeof fetch
    });
    const embed = await gate.resolve();
    assert.equal(typeof embed === 'function', fixture.enabled);
    assert.equal(await gate.resolve(), embed, 'boot verdict must be cached');
    assert.equal(verdicts.length, 1, 'one measured verdict per boot');
    assert.equal(verdicts[0]?.accepted, true, 'real EventHub must accept the embedding boot verdict');
    assert.deepEqual(errors, [], 'ordinary missing/failed embeddings must not emit a contract violation');
    const data = verdicts[0]?.data as { type: string; reason?: string; dim?: number };
    assert.equal(data.type, fixture.enabled ? 'embed-enabled' : 'embed-disabled');
    if (fixture.enabled) assert.equal(data.dim, 2);
    else assert.ok(typeof data.reason === 'string' && data.reason.length > 0);
    hub.close();
  }
});

test('index embedding verdicts reject malformed state, unknown events and extra fields', () => {
  for (const data of [
    { type: 'embed-disabled', reason: '' },
    { type: 'embed-enabled', dim: 0 },
    { type: 'embed-enabled', dim: 1.5 },
    { type: 'embed-enabled', dim: 2, ready: true },
    { type: 'embed-disabled', reason: 'absent', ready: true },
    { type: 'invented-index-ready' }
  ]) assert.equal(IndexStreamEvent.safeParse(data).success, false);
});
