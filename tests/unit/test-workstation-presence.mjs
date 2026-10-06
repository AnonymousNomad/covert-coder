import { test } from 'node:test';
import assert from 'node:assert/strict';
import { projectPresence, createPresenceEngine } from '../../browser/src/workstation/presence/presence-engine.mjs';
const binding = { projectId: 'project:a', rootGeneration: 2 };
const fact = fields => ({ project: { ...binding }, observedAt: 1000, ...fields });
const facts = () => ({
  resident: fact({ residentId: 'resident:cipher', binding: 'BOUND', availability: 'AVAILABLE' }),
  task: fact({ state: 'NONE' }),
  media: fact({ capture: 'INACTIVE', output: 'INACTIVE', remote: 'INACTIVE' }),
  attention: fact({ state: 'NONE' }),
});
const view = value => projectPresence({ binding, facts: value, now: 1100, freshForMs: 5000 });
function scheduler() {
  let now = 1100; let next = 1; const pending = new Map();
  return {
    clock: () => now, schedule: (fn, delay) => { const id = next++; pending.set(id, { fn, at: now + delay }); return id; },
    cancel: id => pending.delete(id), size: () => pending.size,
    advance(to) { now = to; for (const [id, task] of [...pending]) if (task.at <= now) { pending.delete(id); task.fn(); } },
  };
}

test('idle requires fresh owner facts rather than a cosmetic gesture', () => {
  const result = view(facts());
  assert.equal(result.status, 'IDLE');
  assert.equal(result.capture, 'INACTIVE');
  assert.equal(result.resident.id, 'resident:cipher');
  assert.equal(result.task.taskId, null);
});

test('actual running task projects working but never verified success', () => {
  const source = facts(); source.task = fact({ state: 'RUNNING', taskId: 'task:one' });
  const result = view(source);
  assert.equal(result.status, 'WORKING');
  assert.equal(result.task.taskId, 'task:one');
  source.task = fact({ state: 'SUCCEEDED', taskId: 'task:one' });
  assert.equal(view(source).status, 'IDLE');
  assert.equal(Object.hasOwn(view(source), 'verified'), false);
});

test('media dimensions coexist with an offline Resident', () => {
  const source = facts();
  source.resident = fact({ residentId: 'resident:cipher', binding: 'BOUND', availability: 'UNAVAILABLE' });
  source.media = fact({ capture: 'ACTIVE', output: 'ACTIVE', remote: 'ACTIVE' });
  const result = view(source);
  assert.equal(result.status, 'OFFLINE');
  assert.equal(result.capture, 'ACTIVE');
  assert.equal(result.output, 'ACTIVE');
  assert.equal(result.remote, 'ACTIVE');
});

test('stale facts become unknown, not inactive or ready', () => {
  const result = projectPresence({ binding, facts: facts(), now: 7000, freshForMs: 5000 });
  assert.equal(result.status, 'UNKNOWN');
  assert.equal(result.capture, 'UNKNOWN');
  assert.equal(result.task.state, 'UNKNOWN');
});

test('foreign project or root generation cannot manufacture work or recording state', () => {
  for (const project of [{ ...binding, projectId: 'project:b' }, { ...binding, rootGeneration: 1 }]) {
    const source = facts(); source.task = { ...fact({ state: 'RUNNING', taskId: 'task:b' }), project };
    source.media = { ...fact({ capture: 'ACTIVE', output: 'INACTIVE', remote: 'INACTIVE' }), project };
    const result = view(source);
    assert.equal(result.task.state, 'UNKNOWN');
    assert.equal(result.capture, 'UNKNOWN');
    assert.notEqual(result.status, 'WORKING');
  }
});

test('future timestamps and task without identity are unknown', () => {
  const source = facts(); source.media.observedAt = 1200;
  source.task = fact({ state: 'RUNNING' });
  assert.equal(view(source).capture, 'UNKNOWN');
  assert.equal(view(source).task.state, 'UNKNOWN');
});

test('pending decision is waiting, not delegated or verified', () => {
  const source = facts(); source.task = fact({ state: 'WAITING_FOR_OPERATOR', taskId: 'task:one' });
  assert.equal(view(source).status, 'WAITING_FOR_OPERATOR');
});

test('warning and active capture retain distinct visible truth', () => {
  const source = facts(); source.attention = fact({ state: 'WARNING' });
  source.media = fact({ capture: 'ACTIVE', output: 'INACTIVE', remote: 'INACTIVE' });
  assert.equal(view(source).status, 'WARNING');
  assert.equal(view(source).capture, 'ACTIVE');
});

test('all four families preserve Resident identity, task and media facts', () => {
  const seen = []; const time = scheduler();
  const engine = createPresenceEngine({ binding, render: frame => seen.push(frame), ...time });
  engine.update(facts());
  for (const family of ['scout', 'rook', 'mutt', 'tinker']) {
    engine.setPresentation({ family, personalityRef: 'persona:calm', voiceRef: 'voice:local' });
    const frame = seen.at(-1);
    assert.equal(frame.family, family);
    assert.equal(frame.resident.id, 'resident:cipher');
    assert.equal(frame.capture, 'INACTIVE');
    assert.equal(frame.task.state, 'NONE');
    assert.equal(frame.personalityRef, 'persona:calm');
    assert.equal(frame.assetStatus, 'UNQUALIFIED');
  }
  engine.dispose();
});

test('cosmetic laptop or personality fields cannot overwrite operational truth', () => {
  const seen = []; const time = scheduler();
  const engine = createPresenceEngine({ binding, render: frame => seen.push(frame), ...time });
  engine.update(facts());
  engine.setPresentation({ family: 'tinker' });
  assert.equal(seen.at(-1).status, 'IDLE');
  assert.throws(() => engine.setPresentation({ family: 'tinker', working: true }), { code: 'INVALID_PRESENTATION' });
  assert.throws(() => engine.setPresentation({ residentId: 'another' }), { code: 'INVALID_PRESENTATION' });
  engine.dispose();
});

test('hidden presence cancels optional rendering and timers; show reconciles freshness', () => {
  const seen = []; const time = scheduler();
  const engine = createPresenceEngine({ binding, render: frame => seen.push(frame), ...time });
  engine.update(facts());
  assert.equal(time.size(), 1);
  engine.setVisible(false);
  const count = seen.length;
  assert.equal(time.size(), 0);
  engine.update(facts());
  assert.equal(seen.length, count);
  time.advance(7000);
  engine.setVisible(true);
  assert.equal(seen.at(-1).status, 'UNKNOWN');
  assert.equal(seen.at(-1).capture, 'UNKNOWN');
  engine.dispose();
});

test('reduced motion is static; only one bounded freshness timer exists', () => {
  const seen = []; const time = scheduler();
  const engine = createPresenceEngine({ binding, render: frame => seen.push(frame), reducedMotion: true, ...time });
  const source = facts(); source.task = fact({ state: 'RUNNING', taskId: 'task:one' });
  engine.update(source);
  assert.equal(seen.at(-1).motion, 'STATIC');
  assert.equal(time.size(), 1);
  time.advance(6001);
  assert.equal(seen.at(-1).task.state, 'UNKNOWN');
  assert.equal(time.size(), 0);
  engine.dispose();
});

test('input mutation cannot change stored facts or skip expiry', () => {
  const seen = []; const time = scheduler();
  const engine = createPresenceEngine({ binding, render: frame => seen.push(frame), ...time });
  const source = facts();
  engine.update(source);
  source.media.capture = 'ACTIVE';
  engine.setPresentation({ family: 'rook' });
  assert.equal(seen.at(-1).capture, 'INACTIVE');
  engine.dispose();
});

test('same semantic observation does not generate avatar chatter', () => {
  const seen = []; const time = scheduler();
  const engine = createPresenceEngine({ binding, render: frame => seen.push(frame), ...time });
  engine.update(facts()); const count = seen.length;
  for (let i = 0; i < 100; i++) engine.update(facts());
  assert.equal(seen.length, count);
  assert.equal(time.size(), 1);
  engine.dispose();
  assert.equal(time.size(), 0);
  const finalCount = seen.length;
  engine.update(facts()); engine.setVisible(true);
  time.advance(7000);
  assert.equal(seen.length, finalCount);
});

test('unbound and absent owner truth stay distinct', () => {
  const source = facts(); source.resident.binding = 'UNBOUND';
  assert.equal(view(source).status, 'UNBOUND');
  assert.equal(view({}).status, 'UNKNOWN');
});

test('unknown family and malformed owner records cannot execute contributions', () => {
  const time = scheduler(); const engine = createPresenceEngine({ binding, render() {}, ...time });
  assert.throws(() => engine.setPresentation({ family: 'downloaded-script' }), { code: 'INVALID_PRESENTATION' });
  assert.equal(view({ resident: { ...facts().resident, credential: 'secret' } }).resident.id, null);
  engine.dispose();
});
