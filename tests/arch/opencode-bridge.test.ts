import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createOpenCodeBridge } from '../../node/src/services/opencode-bridge.ts';

const fixture = `#!/usr/bin/env node
import http from 'node:http';
import { appendFileSync } from 'node:fs';
const mode = process.env.FIXTURE_MODE ?? 'success';
const log = process.env.FIXTURE_LOG;
const clients = new Set();
const record = (event, extra = {}) => appendFileSync(log, JSON.stringify({ event, ...extra }) + '\\n');
const send = (response, status, body) => {
  response.writeHead(status, { 'content-type': 'application/json' });
  response.end(JSON.stringify(body));
};
const event = (type, properties = {}) => ({ id: 'evt_fixture', type, properties });
const emit = (type, properties = {}) => {
  const item = event(type, properties);
  for (const response of clients) response.write('data: ' + JSON.stringify(mode === 'wrapped' ? { payload: item } : item) + '\\n\\n');
};
const server = http.createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://127.0.0.1');
  if (url.pathname === '/provider' && request.method === 'GET') {
    const models = mode === 'catalog-missing' ? { 'deepseek-v4-flash': { name: 'DeepSeek V4 Flash' } } : { 'deepseek-v4.1-flash': { name: 'DeepSeek V4.1 Flash' } };
    return send(response, 200, { all: [{ id: 'opencode-go', models }], connected: ['opencode-go'] });
  }
  if (url.pathname === '/global/health') return send(response, 200, { healthy: true, version: '1.18.20-fixture' });
  if (url.pathname === '/session' && request.method === 'POST') return send(response, 200, { id: 'ses_fixture' });
  if (url.pathname === '/event' && request.method === 'GET') {
    response.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
    clients.add(response);
    response.write('data: ' + JSON.stringify(event('server.connected')) + '\\n\\n');
    response.on('close', () => clients.delete(response));
    return;
  }
  if (url.pathname === '/session/ses_fixture/prompt_async' && request.method === 'POST') {
    let body = '';
    request.on('data', chunk => { body += String(chunk); });
    request.on('end', () => {
      record('prompt', { body: JSON.parse(body) });
      response.writeHead(204);
      response.end();
      setTimeout(() => {
        emit('session.status', { sessionID: 'ses_fixture', status: { type: 'busy' } });
        if (mode === 'provider-error') {
          emit('session.error', { sessionID: 'ses_fixture', error: { data: { message: 'credential sentinel must not escape' } } });
          return;
        }
        emit('message.updated', { info: { id: 'msg_fixture', sessionID: 'ses_fixture', role: 'assistant' } });
        emit('message.part.updated', { part: { id: 'prt_fixture', sessionID: 'ses_fixture', messageID: 'msg_fixture', type: 'text' } });
        emit('message.part.delta', { sessionID: 'ses_fixture', messageID: 'msg_fixture', partID: 'prt_fixture', field: 'text', delta: mode === 'cancel' ? 'first' : 'streamed ' });
        if (mode !== 'cancel') {
          emit('message.part.delta', { sessionID: 'ses_fixture', messageID: 'msg_fixture', partID: 'prt_fixture', field: 'text', delta: 'answer' });
          emit('session.idle', { sessionID: 'ses_fixture' });
        }
      }, 5);
    });
    return;
  }
  if (url.pathname === '/session/ses_fixture/message' && request.method === 'GET') {
    const text = mode === 'cancel' ? 'first' : 'streamed answer';
    return send(response, 200, [{
      info: { id: 'msg_fixture', sessionID: 'ses_fixture', role: 'assistant', providerID: mode === 'mismatch' ? 'other-provider' : 'opencode-go', modelID: 'deepseek-v4.1-flash' },
      parts: [{ id: 'prt_fixture', messageID: 'msg_fixture', type: 'text', text }]
    }]);
  }
  if (url.pathname === '/session/ses_fixture/abort' && request.method === 'POST') {
    record('abort');
    return send(response, 200, true);
  }
  if (url.pathname === '/session/ses_fixture' && request.method === 'DELETE') {
    record('delete');
    if (mode === 'cleanup-fail') return send(response, 500, { error: 'not cleaned' });
    return send(response, 200, true);
  }
  return send(response, 404, { error: 'not found' });
});
server.listen(0, '127.0.0.1', () => {
  const address = server.address();
  console.log('opencode server listening on http://127.0.0.1:' + address.port);
});
`;

async function fixtureBridge(dir: string, mode: string) {
  const bin = path.join(dir, 'opencode-fixture.mjs');
  const log = path.join(dir, 'events.jsonl');
  await fs.writeFile(bin, fixture, 'utf8');
  await fs.writeFile(log, '', 'utf8');
  const { spawn } = await import('node:child_process');
  const bridge = createOpenCodeBridge({
    executableOverride: { bin: process.execPath, prefix: [bin], version: '1.18.20-fixture' },
    spawnFn: ((command: string, args: string[], options: Record<string, unknown>) => spawn(command, args, {
      ...options,
      env: { ...(options.env as Record<string, string>), FIXTURE_MODE: mode, FIXTURE_LOG: log }
    })) as unknown as typeof spawn
  });
  return { bridge, log };
}

async function readLog(log: string): Promise<Array<{ event: string; body?: Record<string, unknown> }>> {
  const text = await fs.readFile(log, 'utf8');
  return text.trim().length === 0 ? [] : text.trim().split(/\r?\n/).map(line => JSON.parse(line) as { event: string; body?: Record<string, unknown> });
}

test('wrapped OpenCode events stream the requested model identity and delete its session', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'aide-opencode-stream-'));
  const { bridge, log } = await fixtureBridge(dir, 'wrapped');
  const deltas: string[] = [];
  try {
    const result = await bridge.runTaskStream({
      workspace: dir,
      prompt: 'bounded fixture task',
      providerID: 'opencode-go',
      modelID: 'deepseek-v4.1-flash',
      timeoutMs: 30000,
      onDelta: delta => deltas.push(delta)
    });
    assert.equal(result.text, 'streamed answer');
    assert.equal(result.session_id, 'ses_fixture');
    assert.deepEqual(deltas, ['streamed ', 'answer']);
    assert.equal(result.delegated_provider, 'opencode-go');
    assert.equal(result.delegated_model, 'deepseek-v4.1-flash');
    const events = await readLog(log);
    const prompt = events.find(item => item.event === 'prompt')?.body as { model?: { providerID?: string; modelID?: string } } | undefined;
    assert.deepEqual(prompt?.model, { providerID: 'opencode-go', modelID: 'deepseek-v4.1-flash' });
    assert.ok(events.some(item => item.event === 'delete'));
    assert.equal(events.some(item => item.event === 'abort'), false);
  } finally {
    await bridge.stop();
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('streamed OpenCode task cancellation aborts and deletes its session', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'aide-opencode-cancel-'));
  const { bridge, log } = await fixtureBridge(dir, 'cancel');
  const controller = new AbortController();
  try {
    await assert.rejects(
      () => bridge.runTaskStream({
        workspace: dir,
        prompt: 'bounded fixture task',
        providerID: 'opencode-go',
        modelID: 'deepseek-v4.1-flash',
        timeoutMs: 30000,
        signal: controller.signal,
        onDelta: () => controller.abort()
      }),
      (error: unknown) => (error as { code?: string })?.code === 'CANCELLED'
    );
    const events = await readLog(log);
    assert.ok(events.some(item => item.event === 'abort'));
    assert.ok(events.some(item => item.event === 'delete'));
  } finally {
    await bridge.stop();
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('wrapped OpenCode events work and provider errors do not expose returned credentials or skip cleanup', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'aide-opencode-error-'));
  const { bridge, log } = await fixtureBridge(dir, 'provider-error');
  try {
    await assert.rejects(
      () => bridge.runTaskStream({
        workspace: dir,
        prompt: 'bounded fixture task',
        providerID: 'opencode-go',
        modelID: 'deepseek-v4.1-flash',
        timeoutMs: 30000,
        onDelta: () => undefined
      }),
      (error: unknown) => (error as { code?: string })?.code === 'CHILD_FAILED' && !String((error as Error).message).includes('credential sentinel')
    );
    const events = await readLog(log);
    assert.ok(events.some(item => item.event === 'abort'));
    assert.ok(events.some(item => item.event === 'delete'));
  } finally {
    await bridge.stop();
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('delegated provider identity mismatch fails closed and cleans the session', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'aide-opencode-mismatch-'));
  const { bridge, log } = await fixtureBridge(dir, 'mismatch');
  try {
    await assert.rejects(
      () => bridge.runTaskStream({
        workspace: dir,
        prompt: 'bounded fixture task',
        providerID: 'opencode-go',
        modelID: 'deepseek-v4.1-flash',
        timeoutMs: 30000,
        onDelta: () => undefined
      }),
      (error: unknown) => (error as { code?: string })?.code === 'TARGET_MISMATCH'
    );
    const events = await readLog(log);
    assert.ok(events.some(item => item.event === 'abort'));
    assert.ok(events.some(item => item.event === 'delete'));
  } finally {
    await bridge.stop();
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('non-stream entry point requires exact identity and uses the streaming lifecycle', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'aide-opencode-entrypoint-'));
  const { bridge, log } = await fixtureBridge(dir, 'success');
  try {
    await assert.rejects(
      () => bridge.runTask({ workspace: dir, prompt: 'missing target identity' }),
      (error: unknown) => (error as { code?: string })?.code === 'TARGET_MISMATCH'
    );
    const result = await bridge.runTask({
      workspace: dir,
      prompt: 'bounded fixture task',
      providerID: 'opencode-go',
      modelID: 'deepseek-v4.1-flash',
      timeoutMs: 30000
    });
    assert.equal(result.text, 'streamed answer');
    assert.equal(result.session_id, 'ses_fixture');
    assert.ok((await readLog(log)).some(item => item.event === 'delete'));
  } finally {
    await bridge.stop();
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('session deletion failure is reported and never converted into a successful result', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'aide-opencode-cleanup-'));
  const { bridge, log } = await fixtureBridge(dir, 'cleanup-fail');
  try {
    await assert.rejects(
      () => bridge.runTaskStream({
        workspace: dir,
        prompt: 'bounded fixture task',
        providerID: 'opencode-go',
        modelID: 'deepseek-v4.1-flash',
        timeoutMs: 30000,
        onDelta: () => undefined
      }),
      (error: unknown) => (error as { code?: string })?.code === 'CLEANUP_FAILED'
    );
    const events = await readLog(log);
    assert.ok(events.some(item => item.event === 'abort'));
    assert.equal(events.filter(item => item.event === 'delete').length, 2, 'failed cleanup is retried after abort and remains visible as failure');
  } finally {
    await bridge.stop();
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('exact model absent from the pinned provider catalog is rejected before session creation', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'aide-opencode-catalog-'));
  const { bridge, log } = await fixtureBridge(dir, 'catalog-missing');
  try {
    await assert.rejects(
      () => bridge.runTaskStream({
        workspace: dir,
        prompt: 'must not dispatch',
        providerID: 'opencode-go',
        modelID: 'deepseek-v4.1-flash',
        timeoutMs: 30000,
        onDelta: () => undefined
      }),
      (error: unknown) => (error as { code?: string })?.code === 'NOT_READY'
    );
    assert.deepEqual(await readLog(log), [], 'missing catalog target cannot create or prompt a session');
  } finally {
    await bridge.stop();
    await fs.rm(dir, { recursive: true, force: true });
  }
});
