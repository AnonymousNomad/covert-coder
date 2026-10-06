import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMediaLifecycle } from '../../browser/src/workstation/media/media-lifecycle.mjs';

function owned(state = 'ACTIVE') {
  let current = state; let stops = 0;
  return {
    adapter: { stop() { stops++; current = 'INACTIVE'; }, observe() { return current; } },
    state: () => current, stops: () => stops,
  };
}

test('stopping both owned paths confirms observation without a model dependency', async () => {
  const capture = owned(), output = owned(), events = [];
  const lifecycle = createMediaLifecycle({ capture: capture.adapter, output: output.adapter, onState: value => events.push(value) });
  assert.equal(Object.hasOwn(lifecycle, 'start'), false);
  const report = await lifecycle.stop('operator');
  assert.equal(capture.state(), 'INACTIVE');
  assert.equal(output.state(), 'INACTIVE');
  assert.equal(report.scope, 'OPTIONAL_MEDIA');
  assert.equal(report.status, 'STOPPED');
  assert.equal(report.capture.status, 'STOPPED');
  assert.equal(events[0].status, 'STOP_REQUESTED');
  assert.equal(events.at(-1).status, 'STOPPED');
  assert.ok(Object.isFrozen(report.capture));
});

test('a returned acknowledgment cannot overrule an active observed capture', async () => {
  const lifecycle = createMediaLifecycle({
    capture: { stop() { return { stopped: true }; }, observe() { return 'ACTIVE'; } },
    output: owned('INACTIVE').adapter,
  });
  const report = await lifecycle.stop('buddy-off');
  assert.equal(report.status, 'PARTIAL');
  assert.equal(report.capture.status, 'ACTIVE');
  assert.equal(report.capture.stopOutcome, 'RETURNED');
});

test('capture failure does not prevent stopping output', async () => {
  const output = owned();
  const lifecycle = createMediaLifecycle({ capture: { stop() { throw new Error('secret-password'); }, observe() { return 'ACTIVE'; } }, output: output.adapter });
  const report = await lifecycle.stop('operator');
  assert.equal(output.state(), 'INACTIVE');
  assert.equal(report.capture.stopOutcome, 'FAILED');
  assert.equal(report.status, 'PARTIAL');
  assert.ok(!JSON.stringify(report).includes('secret-password'));
});

test('unavailable observation cannot be called confirmed containment', async () => {
  const lifecycle = createMediaLifecycle({ capture: { stop() {}, observe() { throw new Error('credential'); } } });
  const report = await lifecycle.stop('lock');
  assert.equal(report.capture.status, 'UNKNOWN');
  assert.equal(report.status, 'PARTIAL');
  assert.ok(!JSON.stringify(report).includes('credential'));
});

test('hanging stop is bounded while other path still stops', async () => {
  const output = owned();
  const lifecycle = createMediaLifecycle({ capture: { stop() { return new Promise(() => {}); }, observe() { return 'ACTIVE'; } }, output: output.adapter, timeoutMs: 10 });
  const report = await lifecycle.stop('sleep');
  assert.equal(report.capture.stopOutcome, 'TIMED_OUT');
  assert.equal(report.capture.status, 'ACTIVE');
  assert.equal(output.state(), 'INACTIVE');
  assert.equal(report.status, 'PARTIAL');
});

test('concurrent stop reasons share one in-flight operation', async () => {
  const capture = owned();
  const lifecycle = createMediaLifecycle({ capture: capture.adapter });
  const a = lifecycle.stop('operator'), b = lifecycle.stop('lock');
  assert.equal(a, b);
  await Promise.all([a, b]);
  assert.equal(capture.stops(), 1);
});

test('repeat attempts do not multiply a stop that has not actually settled', async () => {
  let attempts = 0;
  const lifecycle = createMediaLifecycle({ capture: { stop() { attempts++; return new Promise(() => {}); }, observe() { return 'ACTIVE'; } }, timeoutMs: 10 });
  await lifecycle.stop('operator');
  await lifecycle.stop('buddy-off');
  assert.equal(attempts, 1);
});

test('hanging observation remains bounded and does not multiply', async () => {
  let reads = 0;
  const lifecycle = createMediaLifecycle({ capture: { stop() {}, observe() { reads++; return new Promise(() => {}); } }, timeoutMs: 10 });
  const a = await lifecycle.stop('operator'), b = await lifecycle.stop('operator');
  assert.equal(a.capture.status, 'UNKNOWN');
  assert.equal(b.capture.status, 'UNKNOWN');
  assert.equal(reads, 1);
});

for (const reason of ['operator', 'buddy-off', 'lock', 'sleep', 'restart', 'project-switch', 'dispose']) {
  test(reason + ' stops optional media without restoring or starting it', async () => {
    const capture = owned();
    const lifecycle = createMediaLifecycle({ capture: capture.adapter });
    const result = await lifecycle.stop(reason);
    assert.equal(result.reason, reason);
    assert.equal(capture.state(), 'INACTIVE');
    assert.equal(capture.stops(), 1);
  });
}

test('renderer failure cannot prevent deterministic media teardown', async () => {
  const capture = owned();
  const lifecycle = createMediaLifecycle({ capture: capture.adapter, onState() { throw new Error('UI is broken'); } });
  const result = await lifecycle.stop('operator');
  assert.equal(capture.state(), 'INACTIVE');
  assert.equal(result.status, 'STOPPED');
  assert.equal(result.projection, 'FAILED');
});

test('missing adapters are explicitly not configured rather than active devices', async () => {
  const result = await createMediaLifecycle({}).stop('restart');
  assert.equal(result.capture.status, 'NOT_CONFIGURED');
  assert.equal(result.output.status, 'NOT_CONFIGURED');
  assert.equal(result.scope, 'OPTIONAL_MEDIA');
  assert.equal(result.status, 'STOPPED');
});

test('an unrelated action is not accepted as a teardown reason', () => {
  const lifecycle = createMediaLifecycle({});
  assert.throws(() => lifecycle.stop('download-model'), { code: 'INVALID_STOP_REASON' });
});

test('malformed observed state remains unknown instead of coercing true to inactive', async () => {
  const lifecycle = createMediaLifecycle({ capture: { stop() {}, observe() { return { stopped: true }; } } });
  assert.equal((await lifecycle.stop('operator')).capture.status, 'UNKNOWN');
});

test('an old inactive observation cannot confirm a later failed teardown', async () => {
  let releaseOld, startedStop, reads = 0, stops = 0, active = false;
  const old = new Promise(resolve => { releaseOld = resolve; });
  const secondStarted = new Promise(resolve => { startedStop = resolve; });
  const lifecycle = createMediaLifecycle({ timeoutMs: 15, capture: {
    stop() { if (++stops === 2) { startedStop(); throw new Error('failed'); } },
    observe() { reads++; return reads === 1 ? old : (active ? 'ACTIVE' : 'INACTIVE'); },
  } });
  assert.equal((await lifecycle.stop('operator')).capture.status, 'UNKNOWN');
  active = true;
  const later = lifecycle.stop('lock');
  await secondStarted;
  // Let the second teardown reach observation before completing the old read.
  await new Promise(resolve => setImmediate(resolve));
  releaseOld('INACTIVE');
  const report = await later;
  assert.equal(report.capture.stopOutcome, 'FAILED');
  assert.equal(report.capture.status, 'UNKNOWN');
  assert.equal(report.status, 'PARTIAL');
  assert.equal(active, true);
  assert.equal(reads, 1);
  assert.equal((await lifecycle.stop('operator')).capture.status, 'ACTIVE');
  assert.equal(reads, 2);
});
