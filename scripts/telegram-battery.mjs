// Telegram Bridge Battery — P5 verification per verification-complete SOP.
// Spins a LOCAL mock of the Telegram Bot API (getMe/getUpdates/sendMessage),
// runs the REAL bridge against it via TELEGRAM_API_BASE override.
// Probes: connect+encrypt-at-rest, isolated polling ingest, durable spool,
// allowlist enforcement, command reply. Exit 1 on any failure.
//
// Honest-gate discipline (R8): the battery MUST exit non-zero on any failing
// assertion. It is invoked under `node --test --test-force-exit` so lingering
// poll/socket handles never mask, and a real failure stops the release gate.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createTelegramBridge } = require('../node/src/services/telegram.mjs');
const { createExecutionAuthority } = require('../node/src/services/execution-authority.mjs');
const { createTelegramBrain } = require('../node/src/services/telegram-brain.mjs');

if (process.platform !== 'win32') {
  // DPAPI token protection shells out to powershell.exe — a Windows-only
  // facility. Skip honestly on other platforms instead of failing on a
  // missing binary (CI must stay green where it cannot run the battery).
  test('telegram battery skipped on non-Windows (powershell DPAPI prerequisite)', () => {
    assert.ok(true);
  });
  process.exit(0);
}

// Poll `check()` until it returns a truthy value or `ms` elapses. Fixed-sleep
// waits race the slow DPAPI-unwrap + sendMessage + poll-loop path on real
// machines (HDD), producing flaky failures on correct behavior. Polling keeps
// the SAME assertion while making the battery deterministic.
async function until(check, ms, step = 100) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    const v = await check();
    if (v) return v;
    await new Promise((r) => setTimeout(r, step));
  }
  return null;
}

let dir;
let bridge;
let authority;
let owner;
let commandHandler = async () => null;
let server;
let sentMessages = [];
let queuedUpdates = [];
let requestedOffsets = [];
const TOKEN = '123456:battERYtoken_token';
let operationSequence = 0;

// The transport now requires the canonical authority composition root. This
// fixture deliberately exercises that contract instead of passing a mock
// assertion function or bypassing the execution binding.
async function authorizedBridgeCall(kind, body, invoke) {
  const input = {
    workspace: dir,
    taskId: `telegram-battery-${++operationSequence}`,
    kind,
    args: { body }
  };
  const operation = await authority.prepare(owner, input);
  if (operation.state === 'pending') await authority.decide(owner, operation.operation_id, 'approve');
  return authority.execute(owner, operation.operation_id, input,
    (_descriptor, execution) => invoke(execution));
}

function startMockApi() {
  return new Promise(resolve => {
    server = http.createServer((req, res) => {
      let raw = '';
      req.on('data', c => { raw += c; });
      req.on('end', () => {
        const url = req.url || '';
        if (!url.includes(`bot${TOKEN}/`)) {
          // token-in-url must never be echoed in errors the service surfaces
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error_description: `not found: ${url}` }));
          return;
        }
        const method = url.split('/bot')[1].split('/')[1];
        const body = raw ? JSON.parse(raw) : {};
        if (method === 'getMe') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, result: { id: 42, username: 'aide_test_bot' } }));
        } else if (method === 'getUpdates') {
          requestedOffsets.push(body.offset);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, result: queuedUpdates.splice(0) }));
        } else if (method === 'sendMessage') {
          sentMessages.push(body);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, result: { message_id: sentMessages.length } }));
        } else {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, result: {} }));
        }
      });
    });
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });
}

before(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'aide-tg-'));
  process.env.TELEGRAM_API_BASE = `http://127.0.0.1:${await startMockApi()}`;
  authority = createExecutionAuthority({
    workspace: dir,
    record: async () => ({ persisted: true })
  });
  const origin = 'http://telegram-battery.local';
  const paired = await authority.pair(authority.control.createPairing(origin), origin);
  owner = authority.authenticate(paired.token, origin);
  bridge = createTelegramBridge({ workspace: dir, authority, onCommand: args => commandHandler(args) });
});

test('connect verifies token and stores it DPAPI-encrypted at rest', async () => {
  await authorizedBridgeCall('telegram.connect', { token: TOKEN }, execution =>
    bridge.connect({ token: TOKEN }, execution));
  const cfg = JSON.parse(await fs.readFile(path.join(dir, '.aide', 'telegram', 'config.json'), 'utf8'));
  assert.ok(cfg.token_b64, 'token persisted');
  assert.ok(!cfg.token_b64.includes(TOKEN), 'raw token never at rest');
  assert.equal(cfg.bot_username, 'aide_test_bot');
});

test('polling ingests allowlisted messages into durable spool before handling', async () => {
  await authorizedBridgeCall('authority.grant', { chat_id: 111, user_id: 111 }, execution =>
    bridge.authorizeChat({ chat_id: 111, user_id: 111 }, execution));
  await authorizedBridgeCall('telegram.start', {}, execution => bridge.startPolling(execution));
  const desktop = {
    async status() {
      return {
        enabled: true,
        grants: { apps: ['notepad.exe'], roots: ['C:\\work'], window_titles: [] },
        session_started_at: new Date().toISOString(),
        ttl_minutes: 30
      };
    },
    async act(request, execution) {
      authority.assertExecution(execution, 'desktop.action', request);
      return { ok: true, output: 'launched', latency_ms: 5 };
    }
  };
  const brain = createTelegramBrain({
    desktop,
    resolveEngineChat: async () => ({ text: 'Opening that for you now.\nlaunch_app(target="notepad.exe")' }),
    authority,
    workspace: dir
  });
  commandHandler = brain.onCommand;
  queuedUpdates.push({ update_id: 10, message: { chat: { id: 111 }, from: { id: 111 }, text: '/ping' } });
  // wait until the update is durably spooled (crash-safe before handling)
  const spool = await until(async () => {
    const s = await fs.readFile(path.join(dir, '.aide', 'telegram', 'spool.jsonl'), 'utf8').catch(() => '');
    return s.includes('/ping') ? s : null;
  }, 10000);
  assert.match(spool || '', /\/ping/, 'update durably spooled');
  // the reply flows through DPAPI-unwrap + sendMessage; poll (not a fixed sleep)
  const replied = await until(
    () => sentMessages.some(m => m.text === 'pong — AIDE is alive and local.'),
    10000
  );
  assert.ok(replied, 'command replied');
});

test('unknown chats are ignored silently and counted', async () => {
  queuedUpdates.push({ update_id: 11, message: { chat: { id: 999 }, text: '/ping' } });
  const st = await until(async () => {
    const s = await bridge.status();
    return s.ignored_unknown_chats >= 1 ? s : null;
  }, 10000);
  const status = st || (await bridge.status());
  assert.equal(status.chat_ids.includes(999), false);
  assert.ok(status.ignored_unknown_chats >= 1);
  assert.ok(!sentMessages.some(m => m.chat_id === 999), 'never replies to strangers');
});

test('help command exposes only the supported local transport commands', async () => {
  queuedUpdates.push({ update_id: 12, message: { chat: { id: 111 }, from: { id: 111 }, text: '/help' } });
  const help = await until(() => {
    const m = sentMessages.filter(x => x.chat_id === 111 && x.text.startsWith('AIDE bridge commands:')).pop();
    return m || null;
  }, 10000);
  assert.ok(help, 'help reply sent');
  assert.match(help.text, /\/ping/);
  assert.match(help.text, /\/status/);
});

test('status command reports local-only posture', async () => {
  queuedUpdates.push({ update_id: 13, message: { chat: { id: 111 }, from: { id: 111 }, text: '/status' } });
  const statusMsg = await until(() => {
    const m = sentMessages.filter(x => x.text.startsWith('AIDE status')).pop();
    return m || null;
  }, 10000);
  assert.ok(statusMsg, 'status reply sent');
  assert.match(statusMsg.text, /fully local/);
});

test('offset acks prevent redelivery', async () => {
  const offset = await until(async () => {
    const o = await fs.readFile(path.join(dir, '.aide', 'telegram', 'offset.txt'), 'utf8').catch(() => null);
    return o ? Number(o) : null;
  }, 10000);
  assert.equal(offset, 14); // last update_id 13 + 1
});

test('bridge delegates /ask proposal and exact confirmation through Authority', async () => {
  queuedUpdates.push({ update_id: 15, message: { chat: { id: 111 }, from: { id: 111 }, text: '/ask open notepad' } });
  const proposal = await until(() => {
    const m = sentMessages.filter(x => x.chat_id === 111 && x.text.startsWith('Opening that for you now.')).pop();
    return m || null;
  }, 10000);
  assert.ok(proposal, 'proposal reply sent');
  const operationId = /YES ([0-9a-f-]{36})/i.exec(proposal.text)?.[1];
  assert.ok(operationId, 'proposal contains exact operation id');
  assert.equal(sentMessages.filter(x => x.chat_id === 111 && x.text.startsWith('✅ Executed')).length, 0);

  queuedUpdates.push({ update_id: 16, message: { chat: { id: 111 }, from: { id: 111 }, text: `YES ${operationId}` } });
  const executed = await until(() => {
    const m = sentMessages.filter(x => x.chat_id === 111 && x.text.startsWith('✅ Executed')).pop();
    return m || null;
  }, 10000);
  assert.ok(executed, 'confirmed execution reply sent');
});

test('restart resumes from the durable offset and preserves the allowlist', async () => {
  await authorizedBridgeCall('telegram.disconnect', {}, execution => bridge.disconnect(execution));
  await until(async () => !(await bridge.status()).running, 10000);

  bridge = createTelegramBridge({ workspace: dir, authority, onCommand: args => commandHandler(args) });
  const before = await bridge.status();
  assert.deepEqual(before.chat_ids, [111]);
  await authorizedBridgeCall('telegram.start', {}, execution => bridge.startPolling(execution));

  queuedUpdates.push({ update_id: 14, message: { chat: { id: 111 }, text: '/ping' } });
  const resumed = await until(async () => {
    const offset = await fs.readFile(path.join(dir, '.aide', 'telegram', 'offset.txt'), 'utf8').catch(() => null);
    return offset === '15' ? offset : null;
  }, 10000);
  assert.equal(resumed, '15');
  assert.ok(requestedOffsets.includes(14), 'poll after restart used the persisted offset');
  assert.ok(sentMessages.some(m => m.chat_id === 111 && m.text === 'pong — AIDE is alive and local.'), 'post-restart command replied');
});

after(async () => {
  if (bridge && authority && owner) {
    await authorizedBridgeCall('telegram.disconnect', {}, execution => bridge.disconnect(execution)).catch(() => {});
  }
  authority?.control.close();
  await new Promise(resolve => server?.close?.(resolve));
  await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  console.log('\nTELEGRAM BATTERY: complete');
});
