import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type http from 'node:http';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { WebSocket } from 'ws';
import { ArchServer } from '../../node/src/server.ts';
import { buildRoutes } from '../../node/src/openapi.ts';
import { Envelope } from '../../common/errors.ts';
import { TerminalProviderListResponse, TerminalSessionListResponse, TerminalSessionOpenResponse, TerminalSessionStopResponse } from '../../common/contracts/terminal.ts';
import { pairFixture } from './authority-fixture.ts';
import { TerminalSessionService, buildTerminalEnv } from '../../node/src/services/terminal-sessions.ts';
import { translateCwd, createDefaultProviderDeps, type PtySpawnOptions } from '../../node/src/services/runtime-providers.ts';

// Interactive terminal session tests.
//
// Authority model under test: the PTY spawn is the authority-bearing action —
// a session is admitted ONLY by an approved central `terminal.session.start`
// execute operation (no other path can reach the pty spawn), the session is
// bound to the authenticated actor, WebSocket control verifies server-derived
// identity on every message, and output is audience-filtered to the owner.

class FakePty {
  readonly pid: number;
  readonly options: PtySpawnOptions;
  written: string[] = [];
  resizeCalls: Array<{ cols: number; rows: number }> = [];
  killed = false;
  private dataListeners: Array<(data: string) => void> = [];
  private exitListeners: Array<(event: { exitCode: number }) => void> = [];
  private static sequence = 1000;

  constructor(options: PtySpawnOptions) {
    this.options = options;
    this.pid = ++FakePty.sequence;
  }

  onData(listener: (data: string) => void): void { this.dataListeners.push(listener); }
  onExit(listener: (event: { exitCode: number }) => void): void { this.exitListeners.push(listener); }
  write(data: string): void { this.written.push(data); }
  resize(cols: number, rows: number): void { this.resizeCalls.push({ cols, rows }); }
  kill(): void { this.killed = true; }
  emitData(data: string): void { for (const listener of this.dataListeners) listener(data); }
  emitExit(exitCode: number): void { for (const listener of this.exitListeners) listener({ exitCode }); }
}

const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'aide-terminal-sessions-'));
let server: ArchServer;
let httpServer: http.Server;
let base: string;
let port: number;
let owner: Awaited<ReturnType<typeof pairFixture>>;
let intruder: Awaited<ReturnType<typeof pairFixture>>;
let sessions: TerminalSessionService;
let spawnCount = 0;
const ptyInstances: FakePty[] = [];
const sockets: WebSocket[] = [];

const openBody = { provider: 'native', shell: null, cwd: workspace, cols: 120, rows: 40 };

before(async () => {
  server = new ArchServer(workspace, path.join(workspace, 'arch-test.log'));
  sessions = new TerminalSessionService({
    defaultCwd: workspace,
    // Small buffer + fast drain make the backpressure/truncation test
    // deterministic without degrading the runtime defaults.
    maxBufferBytes: 16 * 1024,
    drainIntervalMs: 10,
    onEvent: (event, sessionOwner) => {
      server.events.publish('terminal', event, identity => identity?.id === sessionOwner);
    },
    spawnOverride: (options) => {
      spawnCount += 1;
      const pty = new FakePty(options);
      ptyInstances.push(pty);
      return pty;
    },
    deps: createDefaultProviderDeps({
      platform: 'win32',
      loadPty: () => ({ spawn() { throw new Error('test must never reach the real engine'); } }),
      fileExists: async () => true,
      listDir: async () => ['Microsoft.PowerShell_7.6.6.0_x64__8wekyb3d8bbwe'],
      exec: async () => ({ code: 0, stdout: 'Debian', stderr: '' })
    })
  });
  server.registerControlHandler((message, context) => sessions.handleControl(message, context.identity));
  const routes = await buildRoutes(workspace, 'test', { authority: server.authority, events: server.events, terminalSessions: sessions });
  for (const route of routes) server.route(route);
  httpServer = await server.listen(0);
  const address = httpServer.address();
  assert.ok(address && typeof address === 'object');
  base = `http://127.0.0.1:${address.port}`;
  port = address.port;
  owner = await pairFixture(server, base);
  intruder = await pairFixture(server, base, 'http://intruder.local');
});

after(async () => {
  for (const socket of sockets) socket.terminate();
  sessions.stopAll();
  server.events.close();
  await new Promise<void>(resolve => httpServer.close(() => resolve()));
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      await fs.rm(workspace, { recursive: true, force: true });
      return;
    } catch (error) {
      if (!['EBUSY', 'ENOTEMPTY', 'EPERM'].includes((error as NodeJS.ErrnoException).code ?? '')) throw error;
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
});

function tokenOf(fixture: Awaited<ReturnType<typeof pairFixture>>): string {
  const header = (fixture.headers as Record<string, string>)['Authorization'];
  assert.ok(header, 'pair fixture must carry a bearer token');
  return header.slice('Bearer '.length);
}

function waitFor(messages: unknown[], predicate: (message: unknown) => boolean, timeoutMs = 5000): Promise<void> {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const timer = setInterval(() => {
      if (messages.some(predicate)) { clearInterval(timer); resolve(); }
      else if (Date.now() - started > timeoutMs) { clearInterval(timer); reject(new Error('timeout waiting for websocket event')); }
    }, 10);
  });
}

async function pollUntil(check: () => boolean, timeoutMs = 3000): Promise<void> {
  const started = Date.now();
  while (!check()) {
    if (Date.now() - started > timeoutMs) throw new Error('condition not met in time');
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}

async function connectWs(fixture: Awaited<ReturnType<typeof pairFixture>>, origin: string, channels: string[] = ['terminal']): Promise<{ socket: WebSocket; messages: unknown[] }> {
  const socket = new WebSocket(`ws://127.0.0.1:${port}/ws`, { headers: { Origin: origin, Authorization: `Bearer ${tokenOf(fixture)}` } });
  const messages: unknown[] = [];
  socket.on('message', (raw: WebSocket.RawData) => {
    try { messages.push(JSON.parse(String(raw))); } catch { /* ignore non-JSON control frames */ }
  });
  await new Promise<void>((resolve, reject) => {
    socket.once('open', resolve);
    socket.once('error', reject);
  });
  socket.send(JSON.stringify({ type: 'authenticate', token: tokenOf(fixture) }));
  await waitFor(messages, message => (message as { type?: string }).type === 'authenticated');
  socket.send(JSON.stringify({ type: 'subscribe', channels }));
  await new Promise(resolve => setTimeout(resolve, 30));
  sockets.push(socket);
  return { socket, messages };
}

const terminalEvent = (message: unknown, predicate: (data: { sessionId: string; kind: string }) => boolean): { data: { sessionId: string; kind: string } } | null => {
  const candidate = message as { channel?: string; data?: { sessionId: string; kind: string } };
  if (candidate.channel !== 'terminal') return null;
  if (!predicate(candidate.data ?? { sessionId: '', kind: '' })) return null;
  return candidate as { data: { sessionId: string; kind: string } };
};

test('GET /api/terminal/providers reports the native provider truthfully', async () => {
  const response = await owner.request('/api/terminal/providers');
  assert.equal(response.status, 200);
  const envelope = Envelope.safeParse(await response.json());
  assert.equal(envelope.success, true);
  if (!envelope.success) return;
  assert.equal(envelope.data.ok, true);
  if (!envelope.data.ok) return;
  const payload = TerminalProviderListResponse.safeParse(envelope.data.data);
  assert.equal(payload.success, true);
  if (!payload.success) return;
  const native = payload.data.providers.find(provider => provider.id === 'native');
  assert.ok(native, 'native provider must be reported');
  assert.equal(native.state, 'available');
  assert.ok(native.shells.some(shell => shell.id === 'pwsh'));
});

test('GET /api/terminal/sessions starts empty', async () => {
  const response = await owner.request('/api/terminal/sessions');
  assert.equal(response.status, 200);
  const envelope = Envelope.safeParse(await response.json());
  assert.equal(envelope.success, true);
  if (!envelope.success) return;
  assert.equal(envelope.data.ok, true);
  if (!envelope.data.ok) return;
  const payload = TerminalSessionListResponse.safeParse(envelope.data.data);
  assert.equal(payload.success, true);
  if (!payload.success) return;
  assert.deepEqual(payload.data.sessions, []);
});

test('no PTY is ever spawned without an approved terminal.session.start (409)', async () => {
  const beforeCount = spawnCount;
  const denied = await owner.request('/api/terminal/sessions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(openBody)
  });
  assert.equal(denied.status, 409);
  assert.equal(spawnCount, beforeCount, 'approved open is the only path to the PTY spawn');
});

test('approved open admits exactly one PTY and reports a running owned session', async () => {
  const beforeCount = spawnCount;
  const headers = await owner.approve('POST', '/api/terminal/sessions', openBody, 'open-session');
  const response = await owner.request('/api/terminal/sessions', {
    method: 'POST',
    headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify(openBody)
  });
  assert.equal(response.status, 200);
  const envelope = Envelope.safeParse(await response.json());
  assert.equal(envelope.success, true);
  if (!envelope.success) return;
  assert.equal(envelope.data.ok, true);
  if (!envelope.data.ok) return;
  const payload = TerminalSessionOpenResponse.safeParse(envelope.data.data);
  assert.equal(payload.success, true);
  if (!payload.success) return;
  assert.equal(spawnCount, beforeCount + 1, 'exactly one PTY spawn per approved open');
  assert.equal(payload.data.session.state, 'running');
  assert.equal(payload.data.session.provider, 'native');
  assert.equal(payload.data.session.owner, owner.actorId);
  assert.equal(payload.data.session.cwd, workspace);
  assert.equal(payload.data.session.cols, 120);
  assert.equal(payload.data.session.rows, 40);
  const spawned = ptyInstances[ptyInstances.length - 1];
  assert.ok(spawned);
  assert.equal(spawned.options.file, 'C:\\Program Files\\PowerShell\\7\\pwsh.exe');
});

test('approved open with an unknown provider fails closed with NOT_READY', async () => {
  const beforeCount = spawnCount;
  const unknownProviderBody = { ...openBody, provider: 'not-a-provider' };
  const headers = await owner.approve('POST', '/api/terminal/sessions', unknownProviderBody, 'open-unknown-provider');
  const response = await owner.request('/api/terminal/sessions', {
    method: 'POST',
    headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify(unknownProviderBody)
  });
  assert.equal(response.status, 409);
  assert.equal(spawnCount, beforeCount, 'unknown provider must not spawn');
});

test('WebSocket control: owner input/resize flow, intruder control is refused, output is owner-only', async () => {
  const headers = await owner.approve('POST', '/api/terminal/sessions', openBody, 'open-control-session');
  const response = await owner.request('/api/terminal/sessions', {
    method: 'POST',
    headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify(openBody)
  });
  const envelope = Envelope.safeParse(await response.json());
  assert.equal(envelope.success, true);
  if (!envelope.success) return;
  if (!envelope.data.ok) return;
  const payload = TerminalSessionOpenResponse.safeParse(envelope.data.data);
  assert.equal(payload.success, true);
  if (!payload.success) return;
  const sessionId = payload.data.session.sessionId;
  const pty = ptyInstances[ptyInstances.length - 1];
  assert.ok(pty);

  const ownerClient = await connectWs(owner, 'http://fixture.local');
  const intruderClient = await connectWs(intruder, 'http://intruder.local');
  const ownerInput = { type: 'terminal', sessionId, action: 'input', data: 'echo coverage\r' };
  const intruderInput = { type: 'terminal', sessionId, action: 'input', data: 'rm -rf /etc\r' };

  ownerClient.socket.send(JSON.stringify(ownerInput));
  await pollUntil(() => pty.written.length === 1);
  assert.deepEqual(pty.written, ['echo coverage\r'], 'owner input must reach the PTY');

  const writtenBefore = pty.written.length;
  intruderClient.socket.send(JSON.stringify(intruderInput));
  await new Promise(resolve => setTimeout(resolve, 50));
  assert.equal(pty.written.length, writtenBefore, 'intruder input must never reach the PTY');
  assert.equal(intruderClient.socket.readyState, WebSocket.OPEN, 'fail closed without closing the subscriber');

  ownerClient.socket.send(JSON.stringify({ type: 'terminal', sessionId, action: 'resize', cols: 200, rows: 50 }));
  await pollUntil(() => pty.resizeCalls.length === 1);
  assert.deepEqual(pty.resizeCalls.slice(-1)[0], { cols: 200, rows: 50 }, 'owner resize reaches the PTY');

  pty.emitData('own output\r\n');
  await waitFor(ownerClient.messages, message => terminalEvent(message, data => data.sessionId === sessionId && data.kind === 'output') !== null);
  await new Promise(resolve => setTimeout(resolve, 50));
  const intruderSawOutput = intruderClient.messages.some(message => terminalEvent(message, data => data.sessionId === sessionId && data.kind === 'output') !== null);
  assert.equal(intruderSawOutput, false, 'terminal output is audience-filtered to the owner');

  ownerClient.socket.send(JSON.stringify({ type: 'terminal', sessionId, action: 'close' }));
  await pollUntil(() => pty.killed, 5000);
  assert.ok(pty.killed, 'session close kills the PTY through the owned stop path');
});

test('handleControl fails closed on malformed payloads, ambient identity, and wrong owner', async () => {
  const headers = await owner.approve('POST', '/api/terminal/sessions', openBody, 'open-direct-control-session');
  const response = await owner.request('/api/terminal/sessions', {
    method: 'POST',
    headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify(openBody)
  });
  const envelope = Envelope.safeParse(await response.json());
  assert.equal(envelope.success, true);
  if (!envelope.success) return;
  if (!envelope.data.ok) return;
  const payload = TerminalSessionOpenResponse.safeParse(envelope.data.data);
  assert.equal(payload.success, true);
  if (!payload.success) return;
  const sessionId = payload.data.session.sessionId;
  const pty = ptyInstances[ptyInstances.length - 1];
  assert.ok(pty);

  sessions.handleControl({ type: 'terminal', sessionId, action: 'input', data: 'no identity\r' });
  sessions.handleControl({ type: 'terminal', sessionId, action: 'input', data: 'wrong owner\r' }, { id: intruder.actorId, kind: 'operator' });
  sessions.handleControl({ type: 'terminal', sessionId, action: 'input', data: 42 }, { id: owner.actorId, kind: 'operator' });
  assert.equal(pty.written.length, 0, 'no action without verified owner identity and a schema-valid message');

  sessions.handleControl({ type: 'terminal', sessionId, action: 'input', data: 'right owner\r' }, { id: owner.actorId, kind: 'operator' });
  assert.deepEqual(pty.written, ['right owner\r'], 'verified owner identity acts inside the admitted session');
});

test('backpressure: output drains in bounded frames and reports honest truncation', async () => {
  const headers = await owner.approve('POST', '/api/terminal/sessions', openBody, 'open-backpressure-session');
  const response = await owner.request('/api/terminal/sessions', {
    method: 'POST',
    headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify(openBody)
  });
  const envelope = Envelope.safeParse(await response.json());
  assert.equal(envelope.success, true);
  if (!envelope.success) return;
  if (!envelope.data.ok) return;
  const payload = TerminalSessionOpenResponse.safeParse(envelope.data.data);
  assert.equal(payload.success, true);
  if (!payload.success) return;
  const sessionId = payload.data.session.sessionId;
  const pty = ptyInstances[ptyInstances.length - 1];
  assert.ok(pty);

  const ownerClient = await connectWs(owner, 'http://fixture.local');
  pty.emitData('x'.repeat(64 * 1024));
  await waitFor(ownerClient.messages, message => {
    const event = terminalEvent(message, data => data.sessionId === sessionId);
    return event?.data.kind === 'error';
  });
  await new Promise(resolve => setTimeout(resolve, 50));
  const outputs = ownerClient.messages
    .map(message => terminalEvent(message, data => data.sessionId === sessionId && data.kind === 'output'))
    .filter((event): event is { data: { sessionId: string; kind: string } } => event !== null);
  assert.ok(outputs.length > 0, 'output must drain');
  for (const event of outputs) {
    const parsed = (event.data as { sessionId: string; kind: string; data?: string });
    assert.ok((parsed.data?.length ?? 0) <= 4096, 'output frames stay under the transport cap');
  }
  assert.ok(ownerClient.messages.some(message => {
    const event = terminalEvent(message, data => data.sessionId === sessionId && data.kind === 'error');
    return event !== null && /truncated/i.test(JSON.stringify(event.data));
  }), 'buffer overflow must be reported honestly, not silently dropped');
});

test('stop by the owner stops the session; stop by another actor is refused', async () => {
  const headers = await owner.approve('POST', '/api/terminal/sessions', openBody, 'open-stop-session');
  const response = await owner.request('/api/terminal/sessions', {
    method: 'POST',
    headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify(openBody)
  });
  const envelope = Envelope.safeParse(await response.json());
  assert.equal(envelope.success, true);
  if (!envelope.success) return;
  if (!envelope.data.ok) return;
  const payload = TerminalSessionOpenResponse.safeParse(envelope.data.data);
  assert.equal(payload.success, true);
  if (!payload.success) return;
  const sessionId = payload.data.session.sessionId;
  const pty = ptyInstances[ptyInstances.length - 1];
  assert.ok(pty);

  const intruderStopHeaders = await intruder.approve('POST', '/api/terminal/sessions/stop', { sessionId }, `intruder-stop-${sessionId}`);
  const intruderStop = await intruder.request('/api/terminal/sessions/stop', {
    method: 'POST',
    headers: { ...intruderStopHeaders, 'content-type': 'application/json' },
    body: JSON.stringify({ sessionId })
  });
  assert.equal(intruderStop.status, 403, 'transport-approved stop by a non-owner must be refused');
  assert.equal(pty.killed, false, 'the PTY survives a refused stop');

  const ownerStopHeaders = await owner.approve('POST', '/api/terminal/sessions/stop', { sessionId }, `owner-stop-${sessionId}`);
  const ownerStop = await owner.request('/api/terminal/sessions/stop', {
    method: 'POST',
    headers: { ...ownerStopHeaders, 'content-type': 'application/json' },
    body: JSON.stringify({ sessionId })
  });
  assert.equal(ownerStop.status, 200);
  const stopEnvelope = Envelope.safeParse(await ownerStop.json());
  assert.equal(stopEnvelope.success, true);
  if (!stopEnvelope.success) return;
  if (!stopEnvelope.data.ok) return;
  const stopPayload = TerminalSessionStopResponse.safeParse(stopEnvelope.data.data);
  assert.equal(stopPayload.success, true);
  if (!stopPayload.success) return;
  assert.equal(stopPayload.data.state, 'stopping');
  assert.ok(pty.killed, 'owned stop kills the PTY');

  const ownerClient = await connectWs(owner, 'http://fixture.local');
  pty.emitExit(0);
  await waitFor(ownerClient.messages, message => terminalEvent(message, data => data.sessionId === sessionId && data.kind === 'exit') !== null);
  const list = await owner.request('/api/terminal/sessions');
  const listEnvelope = Envelope.safeParse(await list.json());
  assert.equal(listEnvelope.success, true);
  if (!listEnvelope.success) return;
  if (!listEnvelope.data.ok) return;
  const listPayload = TerminalSessionListResponse.safeParse(listEnvelope.data.data);
  assert.equal(listPayload.success, true);
  if (!listPayload.success) return;
  const stopped = listPayload.data.sessions.find(session => session.sessionId === sessionId);
  assert.ok(stopped, 'the stopped session is still listed');
  assert.equal(stopped.state, 'stopped');
  assert.equal(stopped.cleanup, 'clean');
  assert.equal(stopped.exitCode, 0);
});

test('env scrub drops secrets while keeping a safe core', () => {
  const { env, dropped } = buildTerminalEnv({
    PATH: 'C:\\Windows\\System32',
    USERNAME: 'operator',
    TERM: 'xterm-256color',
    NODE_OPTIONS: '--max-old-space-size=512',
    AIDE_DPAPI_IN: 'must-drop',
    'AWS_SECRET_ACCESS_KEY': 'must-drop',
    'MY_API_KEY': 'must-drop',
    'DB_CONNECTION_STRING': 'must-drop',
    'GITHUB_TOKEN': 'must-drop',
    session_password: 'must-drop'
  });
  assert.equal(dropped, 6);
  assert.equal(env.PATH, 'C:\\Windows\\System32');
  assert.equal(env.USERNAME, 'operator');
  assert.equal(env.TERM, 'xterm-256color');
  assert.equal(env.NODE_OPTIONS, '--max-old-space-size=512');
  assert.ok(!('AIDE_DPAPI_IN' in env));
  assert.ok(!('AWS_SECRET_ACCESS_KEY' in env));
  assert.ok(!('MY_API_KEY' in env));
  assert.ok(!('DB_CONNECTION_STRING' in env));
  assert.ok(!('GITHUB_TOKEN' in env));
  assert.ok(!('session_password' in env));
  assert.ok(!('SESSION_PASSWORD' in env));

  const defaults = buildTerminalEnv({ PATH: 'C:\\Windows' });
  assert.equal(defaults.env.TERM, 'xterm-256color');
  assert.equal(defaults.env.COLORTERM, 'truecolor');
});

test('cwd translation maps Windows paths into WSL mounts and leaves native paths alone', () => {
  assert.equal(translateCwd('native', 'C:\\Users\\operator\\repo'), 'C:\\Users\\operator\\repo');
  assert.equal(translateCwd('wsl', 'C:\\Users\\operator\\repo'), '/mnt/c/Users/operator/repo');
  assert.equal(translateCwd('wsl', 'D:\\'), '/mnt/d');
  assert.equal(translateCwd('wsl', '/mnt/c/Users/operator'), '/mnt/c/Users/operator');
});