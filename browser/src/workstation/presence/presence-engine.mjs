import { BoundaryError, refuse, record, identifier, integer, snapshotBinding, sameBinding, freeze } from '../interactions/record-guards.mjs';

export const COMPANION_FAMILIES = freeze({
  scout: { title: 'Scout', idlePose: 'park', attentivePose: 'visor-tilt', assetStatus: 'UNQUALIFIED' },
  rook: { title: 'Rook', idlePose: 'perch', attentivePose: 'head-tilt', assetStatus: 'UNQUALIFIED' },
  mutt: { title: 'Mutt', idlePose: 'low-sit', attentivePose: 'sensor-lift', assetStatus: 'UNQUALIFIED' },
  tinker: { title: 'Tinker', idlePose: 'bench', attentivePose: 'hands-still', assetStatus: 'UNQUALIFIED' },
});
const taskStates = ['NONE', 'RUNNING', 'QUEUED', 'WAITING_FOR_OPERATOR', 'SUCCEEDED', 'FAILED', 'CANCELLED'];
const mediaStates = ['ACTIVE', 'INACTIVE', 'UNKNOWN'];
const oneOf = (value, values) => { if (!values.includes(value)) refuse('INVALID_TRANSFER'); return value; };

function normalizeFact(kind, value) {
  try {
    const fields = {
      resident: ['residentId', 'binding', 'availability'],
      task: ['state', 'taskId'],
      media: ['capture', 'output', 'remote'],
      attention: ['state'],
    }[kind];
    record(value, ['project', 'observedAt', ...fields], ['project', 'observedAt', ...fields.filter(x => x !== 'taskId')]);
    const project = snapshotBinding(value.project);
    const base = { project, observedAt: integer(value.observedAt) };
    if (kind === 'resident') {
      const binding = oneOf(value.binding, ['BOUND', 'UNBOUND']);
      if (binding === 'BOUND' && project === null) refuse('INVALID_TRANSFER');
      return { ...base, residentId: identifier(value.residentId), binding, availability: oneOf(value.availability, ['AVAILABLE', 'UNAVAILABLE']) };
    }
    if (kind === 'task') {
      const state = oneOf(value.state, taskStates);
      if (state !== 'NONE' && project === null) refuse('INVALID_TRANSFER');
      if (state === 'NONE' && value.taskId != null) refuse('INVALID_TRANSFER');
      return { ...base, state, taskId: state === 'NONE' ? null : identifier(value.taskId) };
    }
    if (kind === 'media') return { ...base, capture: oneOf(value.capture, mediaStates), output: oneOf(value.output, mediaStates), remote: oneOf(value.remote, mediaStates) };
    return { ...base, state: oneOf(value.state, ['NONE', 'WARNING', 'UNKNOWN']) };
  } catch { return undefined; }
}
function normalizeFacts(value) {
  try { record(value, ['resident', 'task', 'media', 'attention'], []); }
  catch { return {}; }
  const result = {};
  for (const kind of ['resident', 'task', 'media', 'attention']) {
    const fact = normalizeFact(kind, value[kind]);
    if (fact) result[kind] = fact;
  }
  return freeze(result);
}
function selectStatus(result) {
  if (result.resident.binding === 'UNBOUND') return 'UNBOUND';
  if (result.resident.availability === 'UNAVAILABLE') return 'OFFLINE';
  if (result.resident.binding !== 'BOUND' || result.resident.availability !== 'AVAILABLE') return 'UNKNOWN';
  if (result.attention === 'WARNING' || result.task.state === 'FAILED') return 'WARNING';
  if (result.task.state === 'WAITING_FOR_OPERATOR') return 'WAITING_FOR_OPERATOR';
  if (result.task.state === 'RUNNING') return 'WORKING';
  if (result.capture === 'ACTIVE') return 'LISTENING';
  if (result.output === 'ACTIVE') return 'SPEAKING';
  if (result.remote === 'ACTIVE') return 'PROCESSING';
  if (result.task.state === 'QUEUED') return 'QUEUED';
  if (['NONE', 'SUCCEEDED', 'CANCELLED'].includes(result.task.state) &&
      result.capture === 'INACTIVE' && result.output === 'INACTIVE' && result.remote === 'INACTIVE' && result.attention === 'NONE') return 'IDLE';
  return 'UNKNOWN';
}
function projectNormalized(binding, facts, now, freshForMs) {
  const current = kind => {
    const fact = facts[kind];
    return fact && sameBinding(fact.project, binding) && fact.observedAt <= now && now - fact.observedAt <= freshForMs ? fact : undefined;
  };
  const resident = current('resident'), task = current('task'), media = current('media'), attention = current('attention');
  const result = {
    resident: { id: resident?.residentId ?? null, binding: resident?.binding ?? 'UNKNOWN', availability: resident?.availability ?? 'UNKNOWN' },
    task: { state: task?.state ?? 'UNKNOWN', taskId: task?.taskId ?? null },
    capture: media?.capture ?? 'UNKNOWN', output: media?.output ?? 'UNKNOWN', remote: media?.remote ?? 'UNKNOWN',
    attention: attention?.state ?? 'UNKNOWN',
  };
  return freeze({ ...result, status: selectStatus(result) });
}
export function projectPresence({ binding, facts, now, freshForMs = 5000 }) {
  integer(now); integer(freshForMs, 1, 60000);
  return projectNormalized(snapshotBinding(binding), normalizeFacts(facts), now, freshForMs);
}

// One engine for all families. These builtin declarations have no qualified
// artwork yet, so all frames are static fallback intents, never execution cues.
export function createPresenceEngine({ binding, render, clock = Date.now, schedule = setTimeout, cancel = clearTimeout,
  family = 'scout', reducedMotion = false, freshForMs = 5000 }) {
  if (![render, clock, schedule, cancel].every(x => typeof x === 'function')) throw new TypeError('Presence callbacks required');
  const project = snapshotBinding(binding);
  integer(freshForMs, 1, 60000);
  let facts = {};
  let visible = true;
  let disposed = false;
  let timer;
  let lastSignature;
  let presentation = { family: 'scout', personalityRef: 'persona:developers-special', voiceRef: null, reducedMotion: false };
  const stopTimer = () => { if (timer !== undefined) { cancel(timer); timer = undefined; } };
  const scheduleExpiry = now => {
    stopTimer();
    if (!visible || disposed) return;
    const deadlines = Object.values(facts).filter(fact => sameBinding(fact.project, project) && fact.observedAt <= now)
      .map(fact => fact.observedAt + freshForMs + 1).filter(deadline => deadline > now);
    if (deadlines.length) timer = schedule(() => { timer = undefined; emit(); }, Math.min(...deadlines) - now);
  };
  const emit = () => {
    if (disposed) return;
    const now = integer(clock());
    const truth = projectNormalized(project, facts, now, freshForMs);
    const chassis = COMPANION_FAMILIES[presentation.family];
    const frame = freeze({ ...truth, family: presentation.family, personalityRef: presentation.personalityRef,
      voiceRef: presentation.voiceRef, visible, motion: 'STATIC', reducedMotion: presentation.reducedMotion,
      assetStatus: chassis.assetStatus, pose: truth.status === 'IDLE' ? chassis.idlePose : chassis.attentivePose });
    const signature = JSON.stringify(frame);
    if (signature !== lastSignature) { lastSignature = signature; render(frame); }
    scheduleExpiry(now);
  };
  const setPresentation = value => {
    if (disposed) return;
    try {
      record(value, ['family', 'personalityRef', 'voiceRef', 'reducedMotion'], []);
      if (value.family !== undefined && (typeof value.family !== 'string' || !Object.hasOwn(COMPANION_FAMILIES, value.family))) refuse('INVALID_TRANSFER');
      if (value.reducedMotion !== undefined && typeof value.reducedMotion !== 'boolean') refuse('INVALID_TRANSFER');
      presentation = { ...presentation,
        ...(value.family === undefined ? {} : { family: value.family }),
        ...(value.personalityRef === undefined ? {} : { personalityRef: identifier(value.personalityRef) }),
        ...(value.voiceRef === undefined ? {} : { voiceRef: value.voiceRef === null ? null : identifier(value.voiceRef) }),
        ...(value.reducedMotion === undefined ? {} : { reducedMotion: value.reducedMotion }) };
    } catch { throw new BoundaryError('INVALID_PRESENTATION'); }
    if (visible) emit();
  };
  setPresentation({ family, reducedMotion });
  return Object.freeze({
    update(value) {
      if (disposed) return;
      const now = integer(clock());
      // Future-dated facts remain discarded until an actual new owner update.
      facts = freeze(Object.fromEntries(Object.entries(normalizeFacts(value)).filter(([, fact]) => fact.observedAt <= now)));
      if (visible) emit();
    },
    setPresentation,
    setVisible(value) {
      if (disposed) return;
      if (typeof value !== 'boolean') throw new BoundaryError('INVALID_PRESENTATION');
      if (value === visible) return;
      visible = value;
      emit();
    },
    dispose() {
      if (disposed) return;
      visible = false;
      emit();
      disposed = true;
      stopTimer();
      facts = {};
    },
  });
}
