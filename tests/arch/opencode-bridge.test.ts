// tests/arch/opencode-bridge.test.ts
// Phase 3: the OpenCode bridge speaks ONLY the documented headless server API
// (health / provider / provider-auth / session / message). The fixture is a
// real HTTP server launched through the real spawn path, so lifecycle,
// announcement parsing, delegated-identity capture, and truthful provider
// errors are all exercised without vendor credentials.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createOpenCodeBridge, parseOpenCodeModelRef } from '../../node/src/services/opencode-bridge.ts';

const fixture = `#!/usr/bin/env node
import http from 'node:http';
import { writeFileSync } from 'node:fs';
const args = process.argv.slice(2);
if (args.includes('--version')) { console.log('9.9.9-fixture'); process.exit(0); }
if (args[0] !== 'serve') { console.error('unexpected args'); process.exit(2); }
if (process.env.FIXTURE_PID_FILE) writeFileSync(process.env.FIXTURE_PID_FILE, String(process.pid));
const mode = process.env.FIXTURE_MODE ?? 'ok';
const server = http.createServer((request, response) => {
  const send = (code, body) => { response.writeHead(code, { 'content-type': 'application/json' }); response.end(JSON.stringify(body)); };
  if (request.url === '/global/health') return send(200, { healthy: true, version: '9.9.9-fixture' });
  if (request.url === '/provider') return send(200, { all: [], default: {}, connected: ['fixture-provider'] });
  if (request.url === '/provider/auth') return send(200, { fixture: [{ type: 'api' }] });
  if (request.url === '/session' && request.method === 'POST') return send(200, { id: 'ses_fixture' });
  if (request.url === '/session/ses_fixture/message' && request.method === 'POST') {
    if (mode === 'provider-error') {
      return send(200, { info: { providerID: 'fixture-provider', modelID: 'fixture-model', error: { name: 'APIError', data: { message: 'Payment Required: Insufficient balance', statusCode: 402 } } }, parts: [] });
    }
    return send(200, { info: { providerID: 'fixture-provider', modelID: 'fixture-model' }, parts: [{ type: 'text', text: 'FIXTURE-ANSWER' }] });
  }
  if (request.url === '/session/ses_fixture' && request.method === 'DELETE') return send(200, true);
  send(404, { error: 'not found' });
});
server.listen(0, '127.0.0.1', () => {
  const address = server.address();
  console.log('opencode server listening on http://127.0.0.1:' + address.port);
});
`;

async function fixtureBridge(dir: string, mode?: string, pidFile?: string) {
  const bin = path.join(dir, 'opencode-fixture.mjs');
  await fs.writeFile(bin, fixture, 'utf8');
  const { spawn } = await import('node:child_process');
  return createOpenCodeBridge({
    executableOverride: { bin: process.execPath, prefix: [bin], version: null },
    spawnFn: ((command: string, args: string[], options: Record<string, unknown>) => spawn(command, args, {
      ...options,
      env: {
        ...(options.env as Record<string, string>),
        ...(mode !== undefined ? { FIXTURE_MODE: mode } : {}),
        ...(pidFile !== undefined ? { FIXTURE_PID_FILE: pidFile } : {})
      }
    })) as unknown as typeof spawn
  });
}

test('model references parse as provider/model without inferring identity', () => {
  assert.deepEqual(parseOpenCodeModelRef('opencode/big-pickle'), { providerID: 'opencode', modelID: 'big-pickle' });
  assert.deepEqual(parseOpenCodeModelRef('bare-model'), { providerID: undefined, modelID: 'bare-model' });
  assert.deepEqual(parseOpenCodeModelRef(''), { providerID: undefined, modelID: undefined });
  assert.deepEqual(parseOpenCodeModelRef('/leading'), { providerID: undefined, modelID: '/leading' });
});

test('status reports readiness from the documented server API', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'aide-oc-'));
  const bridge = await fixtureBridge(dir);
  try {
    const status = await bridge.status();
    assert.equal(status.status, 'READY');
    assert.equal(status.version, '9.9.9-fixture');
    assert.deepEqual(status.connected_providers, ['fixture-provider']);
    assert.deepEqual(status.auth_methods.fixture, ['api']);
  } finally {
    await bridge.stop();
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('a task returns text plus the authoritative delegated identity', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'aide-oc-'));
  const bridge = await fixtureBridge(dir);
  try {
    const result = await bridge.runTask({ workspace: dir, prompt: 'answer', timeoutMs: 30000 });
    assert.equal(result.text, 'FIXTURE-ANSWER');
    assert.equal(result.delegated_provider, 'fixture-provider');
    assert.equal(result.delegated_model, 'fixture-model');
    assert.equal(result.session_id, 'ses_fixture');
    assert.match(result.server_url, /^http:\/\/127\.0\.0\.1:\d+$/);
  } finally {
    await bridge.stop();
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('a delegated provider error surfaces truthfully instead of an empty response', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'aide-oc-'));
  const bridge = await fixtureBridge(dir, 'provider-error');
  try {
    await assert.rejects(
      () => bridge.runTask({ workspace: dir, prompt: 'answer', timeoutMs: 30000 }),
      (error: unknown) => (error as { code?: string })?.code === 'CHILD_FAILED' && /Payment Required/.test(String((error as Error).message))
    );
  } finally {
    await bridge.stop();
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('stop terminates the server it started (R7)', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'aide-oc-'));
  const pidFile = path.join(dir, 'server.pid');
  const bridge = await fixtureBridge(dir, undefined, pidFile);
  try {
    const status = await bridge.status();
    assert.equal(status.status, 'READY');
    const pid = Number.parseInt(await fs.readFile(pidFile, 'utf8'), 10);
    assert.ok(Number.isInteger(pid) && pid > 0);
    await bridge.stop();
    await new Promise(resolve => setTimeout(resolve, 1500));
    let alive = true;
    try { process.kill(pid, 0); } catch { alive = false; }
    assert.equal(alive, false, 'the fixture server must be dead after stop');
  } finally {
    await bridge.stop();
    await fs.rm(dir, { recursive: true, force: true });
  }
});
