import { BoundaryError, integer, freeze } from '../interactions/record-guards.mjs';

const reasons = ['operator', 'buddy-off', 'lock', 'sleep', 'restart', 'project-switch', 'dispose'];

// Only handles already bound by their canonical media owner belong here.
// This module cannot start capture/output, grant permission or select a route.
export function createMediaLifecycle({ capture, output, onState, timeoutMs = 1000 } = {}) {
  integer(timeoutMs, 1, 30000);
  if (onState !== undefined && typeof onState !== 'function') throw new TypeError('Projection callback required');
  const path = adapter => {
    if (adapter === undefined) return null;
    if (!adapter || typeof adapter.stop !== 'function' || typeof adapter.observe !== 'function') throw new TypeError('Owned stop/observe adapter required');
    const stop = adapter.stop.bind(adapter), observe = adapter.observe.bind(adapter);
    const pending = {};
    const request = key => {
      if (!pending[key]) {
        const original = Promise.resolve().then(key === 'stop' ? stop : observe)
          .then(value => ({ type: 'RETURNED', ...(key === 'observe' ? { value } : {}) }), () => ({ type: 'FAILED' }));
        pending[key] = original;
        original.then(() => { if (pending[key] === original) delete pending[key]; });
      }
      return pending[key];
    };
    return { request };
  };
  const paths = { capture: path(capture), output: path(output) };
  let inFlight;
  const bounded = async promise => {
    let timer;
    const deadline = new Promise(resolve => { timer = setTimeout(() => resolve({ type: 'TIMED_OUT' }), timeoutMs); });
    try { return await Promise.race([promise, deadline]); }
    finally { clearTimeout(timer); }
  };
  const runPath = async owner => {
    if (!owner) return freeze({ status: 'NOT_CONFIGURED', stopRequested: false, stopOutcome: 'NOT_CONFIGURED' });
    const stopped = await bounded(owner.request('stop'));
    // Acknowledgment is discarded. The separate owner observation decides truth.
    const observed = await bounded(owner.request('observe'));
    const state = observed.type === 'RETURNED' && ['ACTIVE', 'INACTIVE', 'UNKNOWN'].includes(observed.value) ? observed.value : 'UNKNOWN';
    return freeze({ status: state === 'INACTIVE' ? 'STOPPED' : state, stopRequested: true, stopOutcome: stopped.type });
  };
  return Object.freeze({
    stop(reason) {
      if (!reasons.includes(reason)) throw new BoundaryError('INVALID_STOP_REASON');
      if (inFlight) return inFlight;
      // Queue work after publishing the promise so a reentrant renderer cannot
      // create a second teardown or delay deterministic owner controls.
      inFlight = Promise.resolve().then(async () => {
        let projectionFailed = false;
        const notify = value => {
          if (!onState) return;
          try { onState(value); } catch { projectionFailed = true; }
        };
        notify(freeze({ scope: 'OPTIONAL_MEDIA', status: 'STOP_REQUESTED', reason }));
        const [captureResult, outputResult] = await Promise.all([runPath(paths.capture), runPath(paths.output)]);
        const stopped = [captureResult, outputResult].every(value => ['STOPPED', 'NOT_CONFIGURED'].includes(value.status));
        const result = freeze({ scope: 'OPTIONAL_MEDIA', reason, status: stopped ? 'STOPPED' : 'PARTIAL',
          capture: captureResult, output: outputResult });
        notify(result);
        return freeze({ ...result, projection: onState ? (projectionFailed ? 'FAILED' : 'DELIVERED') : 'UNCONFIGURED' });
      }).finally(() => { inFlight = undefined; });
      return inFlight;
    },
  });
}
