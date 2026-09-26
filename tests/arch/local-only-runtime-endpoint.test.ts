import { test } from 'node:test';
import assert from 'node:assert/strict';
import { routeForModelReady, routeForModelStart } from '../../node/src/routes/models.ts';
import type { ModelRuntime } from '../../node/src/services/model-runtime.ts';

test('model readiness/start reject manifest endpoints outside numeric loopback before runtime contact', async () => {
  let endpoint = 'https://provider.example.invalid/v1';
  let probes = 0;
  let starts = 0;
  const manager = {
    workspace: 'C:\\fixture-workspace',
    get(id: string) { return { id, endpoint }; },
    async isReady(id: string) { probes += 1; return { id, ready: true, status: 'running', endpoint }; },
    async start(id: string) { starts += 1; return { id, status: 'running', endpoint }; }
  } as unknown as ModelRuntime;
  const ready = routeForModelReady(manager);
  const start = routeForModelStart(manager);
  const readyHandler = ready.handler as unknown as (context: unknown) => Promise<unknown>;
  const startHandler = start.handler as unknown as (context: unknown) => Promise<unknown>;
  const startDescriptor = start.describeOperation as unknown as (context: unknown, taskId: string) => Promise<unknown>;

  await assert.rejects(() => readyHandler({ query: { id: 'remote-fixture' } }), { code: 'FORBIDDEN' });
  await assert.rejects(() => startDescriptor({ body: { id: 'remote-fixture' } }, 'task:remote-fixture'), { code: 'FORBIDDEN' });
  assert.equal(probes, 0, 'remote endpoint is never probed');
  assert.equal(starts, 0, 'remote endpoint is never started/adopted');

  endpoint = 'http://127.0.0.1:8787/v1';
  await readyHandler({ query: { id: 'local-fixture' } });
  assert.equal(probes, 1, 'numeric loopback readiness remains available');
  await startDescriptor({ body: { id: 'local-fixture' } }, 'task:local-fixture');

  // Revalidate at dispatch in case the server-side endpoint changed after the
  // operation descriptor was created.
  endpoint = 'https://provider.example.invalid/v1';
  await assert.rejects(() => startHandler({ body: { id: 'local-fixture' } }), { code: 'FORBIDDEN' });
  assert.equal(starts, 0, 'target substitution after preparation is refused');
});
