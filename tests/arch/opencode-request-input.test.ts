import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fixtureBridge, readLog } from './opencode-bridge-fixture.ts';

const digest = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');
const revision = 'b'.repeat(64);
const route = 'cloud:opencode:opencode-go/deepseek-v4.1-flash';
const prompt = 'SYSTEM: SYNTHETIC SOP\n\nUSER: SYNTHETIC CURRENT TASK Ω';
type Scalar = string | number | boolean | null;
function scalar(value: unknown): Record<string, Scalar> {
  assert.ok(typeof value === 'object' && value !== null);
  const out: Record<string, Scalar> = {};
  for (const [key, field] of Object.entries(value)) {
    if (field !== null && !['string', 'number', 'boolean'].includes(typeof field)) throw new Error('Non-scalar observation');
    out[key] = field;
  }
  return out;
}
async function fixture(t: TestContext, mode = 'success') {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'covert-opencode-input-'));
  const bodies: string[] = [], observations: unknown[] = [];
  const state = { egress: true, eventCancelCalls: 0, eventReaderUnlocks: 0, eventSourceUnlocks: 0 };
  const controller = new AbortController();
  const { bridge, log } = await fixtureBridge(root, mode, {
    assertExternalEgressAllowed: () => { if (!state.egress) throw Object.assign(new Error('controlled egress revoked'), { code: 'FORBIDDEN' }); },
    fetchFn: async (url, init) => {
      if (String(url).endsWith('/prompt_async')) {
        assert.equal(observations.length, 1, 'observation must precede the managed mission POST');
        bodies.push(String(init?.body));
      }
      const response = await fetch(url, init);
      if (!String(url).endsWith('/event') || response.body === null) return response;
      const upstream = response.body.getReader();
      let upstreamReleased = false;
      const releaseUpstream = (): void => {
        if (upstreamReleased) return;
        upstream.releaseLock(); upstreamReleased = true; state.eventSourceUnlocks += 1;
      };
      const tracked = new ReadableStream<Uint8Array>({
        async pull(stream) {
          try {
            const next = await upstream.read();
            if (next.done) { stream.close(); releaseUpstream(); }
            else stream.enqueue(next.value);
          } catch (error) {
            try { stream.error(error); }
            finally { releaseUpstream(); }
          }
        },
        async cancel(reason) {
          try { await upstream.cancel(reason); }
          finally { releaseUpstream(); }
        }
      });
      const getTrackedReader = tracked.getReader.bind(tracked);
      Object.defineProperty(tracked, 'getReader', {
        value: () => new Proxy(getTrackedReader(), {
          get(reader, property) {
            if (property === 'cancel') return (reason?: unknown) => {
              state.eventCancelCalls += 1; return reader.cancel(reason);
            };
            if (property === 'releaseLock') return () => {
              state.eventReaderUnlocks += 1; return reader.releaseLock();
            };
            const value: unknown = Reflect.get(reader, property, reader);
            return typeof value === 'function' ? value.bind(reader) : value;
          }
        })
      });
      return new Response(tracked, { status: response.status, headers: response.headers });
    }
  });
  t.after(async () => {
    try { await bridge.stop(); assert.ok((await readLog(log)).some(event => event.event === 'server-child-close'), 'owned bridge child must close'); }
    finally {
      assert.equal(path.dirname(path.resolve(root)), path.resolve(os.tmpdir()));
      assert.ok(path.basename(root).startsWith('covert-opencode-input-'));
      await fs.rm(root, { recursive: true, force: true });
    }
  });
  const options = { workspace: root, prompt, providerID: 'opencode-go', modelID: 'deepseek-v4.1-flash', timeoutMs: 30000,
    signal: controller.signal, onDelta: () => {}, adapterInput: { route_id: route, target_revision: revision,
      onRequestInput: async (value: unknown) => { observations.push(value); } } };
  const invoke = (stream: boolean) => stream ? bridge.runTaskStream(options) : bridge.runTask(options);
  return { bridge, log, bodies, observations, state, controller, options, invoke };
}

for (const stream of [false, true]) {
  test(`OpenCode ${stream ? 'stream' : 'task'} records exact prepared managed bytes and confirms session/reader cleanup`, async t => {
    const f = await fixture(t);
    const result = await f.invoke(stream);
    assert.equal(result.delegated_provider, 'opencode-go');
    assert.equal(result.delegated_model, 'deepseek-v4.1-flash');
    assert.equal(f.bodies.length, 1); assert.equal(f.observations.length, 1);
    assert.equal(Object.isFrozen(f.observations[0]), true);
    assert.deepEqual(scalar(f.observations[0]), { scope: 'ADAPTER_REQUEST_INPUT', adapter: 'opencode-bridge',
      protocol: 'opencode-prompt-async', route_id: route, target_revision: revision,
      requested_model: 'opencode-go/deepseek-v4.1-flash', request_index: 1,
      body_sha256: digest(f.bodies[0]!), body_bytes: Buffer.byteLength(f.bodies[0]!, 'utf8'), stream: true });
    assert.equal(JSON.stringify(f.observations).includes('SYNTHETIC'), false);
    const body = JSON.parse(f.bodies[0]!) as { model: { providerID: string; modelID: string }; parts: Array<{ text: string }> };
    assert.deepEqual(body.model, { providerID: 'opencode-go', modelID: 'deepseek-v4.1-flash' });
    assert.equal(body.parts[0]!.text, prompt);
    assert.equal((await readLog(f.log)).filter(event => event.event === 'delete').length, 1);
    assert.equal(f.state.eventCancelCalls, 1); assert.equal(f.state.eventReaderUnlocks, 1); assert.equal(f.state.eventSourceUnlocks, 1);
  });
  test(`OpenCode ${stream ? 'stream' : 'task'} observation failure refuses prompt and closes allocated session/reader`, async t => {
    const f = await fixture(t);
    f.options.adapterInput.onRequestInput = async () => { throw new Error('controlled managed persistence failure'); };
    await assert.rejects(() => f.invoke(stream), /controlled managed persistence failure/);
    assert.equal(f.bodies.length, 0);
    const events = await readLog(f.log);
    assert.equal(events.some(event => event.event === 'prompt'), false);
    assert.equal(events.filter(event => event.event === 'abort').length, 1);
    assert.equal(events.filter(event => event.event === 'delete').length, 1);
    assert.equal(f.state.eventCancelCalls, 1); assert.equal(f.state.eventReaderUnlocks, 1); assert.equal(f.state.eventSourceUnlocks, 1);
  });
  test(`OpenCode ${stream ? 'stream' : 'task'} cancellation during input persistence permits no late managed prompt`, async t => {
    const f = await fixture(t);
    f.options.adapterInput.onRequestInput = async value => { f.observations.push(value); f.controller.abort(); };
    await assert.rejects(() => f.invoke(stream), error => (error as { code?: string }).code === 'CANCELLED');
    assert.equal(f.bodies.length, 0);
    const events = await readLog(f.log);
    assert.equal(events.some(event => event.event === 'prompt'), false);
    assert.equal(events.filter(event => event.event === 'delete').length, 1);
    assert.equal(f.state.eventCancelCalls, 1); assert.equal(f.state.eventReaderUnlocks, 1); assert.equal(f.state.eventSourceUnlocks, 1);
  });
  test(`OpenCode ${stream ? 'stream' : 'task'} rechecks canonical egress permission after awaited observation`, async t => {
    const f = await fixture(t);
    f.options.adapterInput.onRequestInput = async value => { f.observations.push(value); f.state.egress = false; };
    await assert.rejects(() => f.invoke(stream), error => (error as { code?: string }).code === 'FORBIDDEN');
    assert.equal(f.bodies.length, 0);
    assert.equal((await readLog(f.log)).some(event => event.event === 'prompt'), false);
    assert.equal((await readLog(f.log)).filter(event => event.event === 'delete').length, 1);
    assert.equal(f.state.eventCancelCalls, 1); assert.equal(f.state.eventReaderUnlocks, 1); assert.equal(f.state.eventSourceUnlocks, 1);
  });
  test(`OpenCode ${stream ? 'stream' : 'task'} observer cannot mutate serialized bytes or snapshotted target`, async t => {
    const f = await fixture(t);
    f.options.adapterInput.onRequestInput = async value => {
      f.observations.push(value); f.options.prompt = 'SYNTHETIC MUTATED';
      f.options.providerID = 'other-provider'; f.options.modelID = 'other-model';
    };
    const result = await f.invoke(stream);
    assert.equal(result.delegated_provider, 'opencode-go'); assert.equal(result.delegated_model, 'deepseek-v4.1-flash');
    const body = JSON.parse(f.bodies[0]!) as { model: { providerID: string; modelID: string }; parts: Array<{ text: string }> };
    assert.equal(body.parts[0]!.text, prompt);
    assert.deepEqual(body.model, { providerID: 'opencode-go', modelID: 'deepseek-v4.1-flash' });
    assert.equal(scalar(f.observations[0]).body_sha256, digest(f.bodies[0]!));
  });
}

test('OpenCode pre-cancelled observed request allocates no session, prompt or observer', async t => {
  const f = await fixture(t); f.controller.abort();
  await assert.rejects(() => f.invoke(true), error => (error as { code?: string }).code === 'CANCELLED');
  assert.equal(f.observations.length, 0); assert.equal(f.bodies.length, 0);
  assert.equal((await readLog(f.log)).some(event => event.event === 'create' || event.event === 'prompt'), false);
  // No child is started for this request, so start a read-only catalog fixture
  // to let the shared teardown verify its retained child handle explicitly.
  await f.bridge.discoverGoModels(f.options.workspace);
});

test('OpenCode input refusal cannot hide failed session deletion', async t => {
  const f = await fixture(t, 'cleanup-fail');
  f.options.adapterInput.onRequestInput = async () => { throw new Error('controlled persistence refusal'); };
  await assert.rejects(() => f.invoke(true), error => (error as { code?: string }).code === 'CLEANUP_FAILED');
  assert.equal(f.bodies.length, 0); assert.equal((await readLog(f.log)).some(event => event.event === 'prompt'), false);
  assert.equal(f.state.eventCancelCalls, 1); assert.equal(f.state.eventReaderUnlocks, 1); assert.equal(f.state.eventSourceUnlocks, 1);
});

test('OpenCode same exact model request survives owned stop and fresh restart with new input evidence', async t => {
  const f = await fixture(t);
  await f.invoke(true); await f.bridge.stop();
  assert.ok((await readLog(f.log)).some(event => event.event === 'server-child-close'));
  f.observations.length = 0;
  await f.invoke(false);
  assert.equal(f.bodies.length, 2); assert.equal(f.observations.length, 1);
  assert.equal((await readLog(f.log)).filter(event => event.event === 'delete').length, 2);
  assert.equal(f.state.eventCancelCalls, 2); assert.equal(f.state.eventReaderUnlocks, 2); assert.equal(f.state.eventSourceUnlocks, 2);
});
