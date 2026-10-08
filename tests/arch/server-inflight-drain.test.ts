import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type http from 'node:http';
import { z } from 'zod';
import { ArchServer } from '../../node/src/server.ts';

test('ArchServer drain waits for request handlers after their client socket closes', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'aide-server-drain-'));
  const logFile = path.join(workspace, '.aide', 'arch-server-drain.log');
  const server = new ArchServer(workspace, logFile);
  let httpServer: http.Server | undefined;
  let releaseHandler!: () => void;
  let markHandlerStarted!: () => void;
  const handlerGate = new Promise<void>(resolve => { releaseHandler = resolve; });
  const handlerStarted = new Promise<void>(resolve => { markHandlerStarted = resolve; });

  server.route({
    method: 'GET',
    path: '/test/slow',
    authorityMode: 'pair',
    response: z.object({ ok: z.literal(true) }),
    handler: async () => {
      markHandlerStarted();
      await handlerGate;
      return { ok: true };
    }
  });

  try {
    httpServer = await server.listen(0);
    const address = httpServer.address();
    assert.ok(address && typeof address === 'object');

    const controller = new AbortController();
    const request = fetch(`http://127.0.0.1:${address.port}/test/slow`, { signal: controller.signal });
    await handlerStarted;
    controller.abort();
    await assert.rejects(request, { name: 'AbortError' });

    httpServer.closeAllConnections();
    await new Promise<void>(resolve => httpServer!.close(() => resolve()));

    let drained = false;
    const drain = server.drainInFlightRequests().then(() => { drained = true; });
    await new Promise<void>(resolve => setImmediate(resolve));
    assert.equal(drained, false, 'drain must wait while an accepted route handler is still running');

    releaseHandler();
    await drain;
    await server.logger.flush();
    const log = await fs.readFile(logFile, 'utf8');
    assert.match(log, /"path":"\/test\/slow"/);
  } finally {
    releaseHandler();
    server.events.close();
    if (httpServer?.listening) {
      httpServer.closeAllConnections();
      await new Promise<void>(resolve => httpServer!.close(() => resolve()));
    }
    await server.drainInFlightRequests();
    await server.logger.flush();
    await fs.rm(workspace, { recursive: true, force: true });
  }
});
