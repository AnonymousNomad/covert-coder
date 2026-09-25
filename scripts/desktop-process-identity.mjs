import {
  readWindowsProcessIdentity,
  sameWindowsProcessIdentity,
  waitForWindowsProcessIdentity
} from '../node/src/services/windows-process-identity.mjs';

export { readWindowsProcessIdentity, sameWindowsProcessIdentity, waitForWindowsProcessIdentity };

export async function terminateOwnedTestProcess(child, expectedIdentity, { readIdentity = readWindowsProcessIdentity, timeoutMs = 5000 } = {}) {
  if (!child || !Number.isSafeInteger(child.pid) || child.pid !== expectedIdentity?.pid || typeof child.kill !== 'function') {
    return { ok: false, status: 'OWNERSHIP_UNPROVEN', reason: 'retained child handle does not match captured PID' };
  }

  const observed = await readIdentity(expectedIdentity.pid);
  if (!sameWindowsProcessIdentity(expectedIdentity, observed)) {
    return { ok: false, status: 'OWNERSHIP_UNPROVEN', reason: 'live PID/executable/start identity differs from captured launch' };
  }
  if (child.exitCode !== null || child.signalCode !== null) {
    return { ok: true, status: 'ALREADY_EXITED', pid: child.pid };
  }

  let closeListener;
  let timer;
  const closed = new Promise(resolve => {
    closeListener = () => resolve(true);
    child.once('close', closeListener);
    if (child.exitCode !== null || child.signalCode !== null) resolve(true);
    timer = setTimeout(() => resolve(false), timeoutMs);
  });

  let requested = false;
  try { requested = child.kill(); }
  catch (error) {
    clearTimeout(timer);
    child.off('close', closeListener);
    return { ok: false, status: 'CLEANUP_FAILED', pid: child.pid, reason: String(error?.message ?? error).slice(0, 240) };
  }
  if (!requested) {
    clearTimeout(timer);
    child.off('close', closeListener);
    return { ok: false, status: 'CLEANUP_UNCONFIRMED', pid: child.pid, reason: 'retained child handle refused termination' };
  }

  const closeObserved = await closed;
  clearTimeout(timer);
  child.off('close', closeListener);
  if (!closeObserved) return { ok: false, status: 'CLEANUP_UNCONFIRMED', pid: child.pid, reason: 'owned process exit was not observed before deadline' };

  const after = await readIdentity(expectedIdentity.pid);
  if (sameWindowsProcessIdentity(expectedIdentity, after)) {
    return { ok: false, status: 'CLEANUP_UNCONFIRMED', pid: child.pid, reason: 'captured process identity remains present after close event' };
  }
  return { ok: true, status: 'TERMINATED', pid: child.pid };
}
