import childProcess from 'node:child_process';
import http from 'node:http';
import { syncBuiltinESMExports } from 'node:module';
import path from 'node:path';

export async function runStartupFixture(mode, workspace, modelDir) {
  if (!['pairing-error', 'success'].includes(mode)) throw new Error('invalid startup fixture mode');
  if (!path.isAbsolute(modelDir)) throw new Error('an external absolute model directory is required by the startup fixture');
  const originalSpawn = childProcess.spawn;
  const originalCreateServer = http.createServer;
  const originalFetch = globalThis.fetch;
  const children = [];
  const servers = [];
  const sentinel = new Error('controlled pairing transport failure');
  let healthUrl;
  let healthSucceeded = false;
  let stack;
  let startupError;
  let report;

  childProcess.spawn = function (...args) {
    const child = originalSpawn.apply(this, args);
    if (['node/src/server.ts', 'daemon/server.mjs'].includes(args[1]?.[0])) {
      const closed = new Promise(resolve => child.once('close', resolve));
      children.push({ child, closed });
    }
    return child;
  };
  http.createServer = function (...args) {
    const server = originalCreateServer.apply(this, args);
    servers.push(server);
    return server;
  };
  syncBuiltinESMExports();
  globalThis.fetch = async function (url, options) {
    const pathname = new URL(String(url)).pathname;
    if (mode === 'pairing-error' && pathname === '/api/authority/pair' && options?.method === 'POST') throw sentinel;
    const response = await originalFetch(url, options);
    if (pathname === '/api/health' && response.ok) {
      healthUrl = String(url);
      healthSucceeded = true;
    }
    return response;
  };

  async function terminateCapturedChild({ child, closed }) {
    if (child.pid !== undefined && child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    let timer;
    try {
      await Promise.race([closed, new Promise((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error('owned fixture child cleanup was not confirmed')), 5000);
      })]);
    } finally { clearTimeout(timer); }
  }

  try {
    const { launchSupervisedStack } = await import('../helpers/supervised-stack.mjs');
    try {
      stack = await launchSupervisedStack({ workspace, env: { AIDE_MODEL_DIR: modelDir, AIDE_EMBEDDINGS_URL: '' } });
    } catch (error) {
      startupError = error;
    }
    let requestStatus = null;
    let closeErrorCount = null;
    let sharedClosePromise = null;
    if (stack) {
      requestStatus = (await stack.json('facade', 'GET', '/api/plugins/presets')).status;
      const firstClose = stack.close();
      const secondClose = stack.close();
      sharedClosePromise = firstClose === secondClose;
      closeErrorCount = (await Promise.allSettled([firstClose, secondClose])).filter(result => result.status === 'rejected').length;
    }
    const childrenExited = children.every(({ child }) => child.exitCode !== null || child.signalCode !== null);
    let facadeReachable = false;
    if (healthUrl) {
      try {
        const response = await originalFetch(healthUrl, { signal: AbortSignal.timeout(1000) });
        facadeReachable = true;
        await response.body?.cancel();
      } catch {}
    }
    report = {
      mode, healthSucceeded, childCount: children.length, childrenExited,
      startupRejected: startupError !== undefined, originalErrorPreserved: startupError === sentinel,
      facadeUnreachable: !facadeReachable, requestStatus, closeErrorCount, sharedClosePromise,
      emergencyCleanupNeeded: !childrenExited || servers.some(server => server.listening)
    };
  } finally {
    globalThis.fetch = originalFetch;
    childProcess.spawn = originalSpawn;
    http.createServer = originalCreateServer;
    syncBuiltinESMExports();
    const cleanupResults = await Promise.allSettled([...servers.map(async server => {
      server.closeAllConnections();
      if (server.listening) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }), ...children.map(terminateCapturedChild)]);
    const failures = cleanupResults.filter(result => result.status === 'rejected').map(result => result.reason);
    if (failures.length) throw new AggregateError(failures, 'fixture cleanup was not confirmed');
  }
  if (!report) throw new Error('startup fixture did not produce a report');
  report.fixtureCleanupConfirmed = children.every(({ child }) => child.exitCode !== null || child.signalCode !== null)
    && servers.every(server => !server.listening);
  return report;
}
