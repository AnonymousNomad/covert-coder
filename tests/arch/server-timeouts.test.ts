import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  ArchServer,
  SERVER_HEADERS_TIMEOUT_MS,
  SERVER_KEEP_ALIVE_TIMEOUT_MS,
  SERVER_REQUEST_TIMEOUT_MS
} from '../../node/src/server.ts';

test('ArchServer applies explicit HTTP ingress timeout bounds', async () => {
  const workspace = await mkdtemp(path.join(os.tmpdir(), 'aide-server-timeouts-'));
  const arch = new ArchServer(workspace, path.join(workspace, 'server.log'));
  const server = await arch.listen(0, '127.0.0.1');
  try {
    assert.equal(server.requestTimeout, SERVER_REQUEST_TIMEOUT_MS);
    assert.equal(server.headersTimeout, SERVER_HEADERS_TIMEOUT_MS);
    assert.equal(server.keepAliveTimeout, SERVER_KEEP_ALIVE_TIMEOUT_MS);
    assert.ok(server.requestTimeout > server.headersTimeout);
    assert.ok(server.headersTimeout > server.keepAliveTimeout);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
