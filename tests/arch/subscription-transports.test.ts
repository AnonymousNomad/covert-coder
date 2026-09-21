// tests/arch/subscription-transports.test.ts
// Wave 7 release proof: governed Codex / Claude Code subscription transports.
// The CLI binaries are FIXTURES (node scripts with the real invocation shapes):
// no real vendor credentials are used or required; the real CLIs are exercised
// separately by the environment-gated live smoke. Covers the A–W matrix.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { randomUUID } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { ArchServer } from '../../node/src/server.ts';
import { pairFixture } from './authority-fixture.ts';
import { createSubscriptionTransports } from '../../node/src/services/subscription-transports.ts';

const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'aide-sub-cli-'));
let fakeCodex = '';
let fakeClaude = '';
let server: ArchServer;
let httpServer: import('node:http').Server;
type Stack = { server: ArchServer; http: import('node:http').Server; owner: Awaited<ReturnType<typeof pairFixture>> };

const codexFixture = `#!/usr/bin/env node
import { appendFileSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
const args = process.argv.slice(2);
if (args.includes('--version')) { console.log('codex-cli 9.9.9-fixture'); process.exit(0); }
let stdinPrompt = '';
if (args[args.length - 1] === '-') {
  stdinPrompt = await new Promise(resolve => { let data = ''; process.stdin.on('data', chunk => { data += chunk; }); process.stdin.on('end', () => resolve(data)); });
}
void stdinPrompt;
const mode = process.env.FIXTURE_MODE ?? 'ok';
if (process.env.FIXTURE_PID_FILE) writeFileSync(process.env.FIXTURE_PID_FILE, String(process.pid));
if (mode === 'timeout') {
  if (process.env.FIXTURE_CHILD_PID_FILE) {
    const child = spawn(process.execPath, ['-e', 'setTimeout(()=>{}, 60000)'], { stdio: 'ignore' });
    writeFileSync(process.env.FIXTURE_CHILD_PID_FILE, String(child.pid));
  }
  setTimeout(() => process.exit(0), 60000);
} else if (mode === 'exit3') {
  console.error('fixture provider failure');
  process.exit(3);
} else if (mode === 'garbage') {
  console.log('this is not json');
  console.log('{also not json');
  process.exit(0);
} else {
  if (mode === 'mixed') console.log('this is not json');
  console.log(JSON.stringify({ type: 'thread.started', thread_id: 'thread-fixture-1' }));
  console.log(JSON.stringify({ type: 'env.probe', has_secret: process.env.AIDE_FIXTURE_SYNTHETIC_SECRET ?? null }));
  console.log(JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: '<attempt_completion><result>FIXTURE-CODEX-OK</result></attempt_completion>' } }));
  process.exit(0);
}
`;
const claudeFixture = `#!/usr/bin/env node
import { writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
const args = process.argv.slice(2);
if (args.includes('--version')) { console.log('9.9.9 (Claude Code fixture)'); process.exit(0); }
const mode = process.env.FIXTURE_MODE ?? 'ok';
if (process.env.FIXTURE_PID_FILE) writeFileSync(process.env.FIXTURE_PID_FILE, String(process.pid));
if (mode === 'timeout') {
  if (process.env.FIXTURE_CHILD_PID_FILE) {
    const child = spawn(process.execPath, ['-e', 'setTimeout(()=>{}, 60000)'], { stdio: 'ignore' });
    writeFileSync(process.env.FIXTURE_CHILD_PID_FILE, String(child.pid));
  }
  setTimeout(() => process.exit(0), 60000);
} else if (mode === 'exit3') {
  console.error('fixture claude failure');
  process.exit(3);
} else if (mode === 'garbage') {
  console.log('not json at all');
  process.exit(0);
} else {
  if (mode === 'mixed') console.log('not json at all');
  console.log(JSON.stringify({ type: 'result', subtype: 'success', result: '<attempt_completion><result>FIXTURE-CLAUDE-OK</result></attempt_completion>' }));
  process.exit(0);
}
`;

function fixtureTransports(overrides: { codexAuth?: boolean; claudeAuth?: boolean; codexBin?: string; claudeBin?: string } = {}) {
  return createSubscriptionTransports({
    executableOverride: {
      'codex-cli': { bin: process.execPath, prefix: [overrides.codexBin ?? fakeCodex], version: null },
      'claude-code-cli': { bin: process.execPath, prefix: [overrides.claudeBin ?? fakeClaude], version: null }
    },
    authArtifactExists: {
      'codex-cli': overrides.codexAuth ?? true,
      'claude-code-cli': overrides.claudeAuth ?? true
    }
  });
}

async function buildStack(transports: ReturnType<typeof fixtureTransports>): Promise<Stack> {
  const arch = new ArchServer(workspace, path.join(workspace, `arch-sub-${randomUUID().slice(0, 8)}.log`));
  const { buildRoutes } = await import('../../node/src/openapi.ts');
  const routes = await buildRoutes(workspace, 'test', { authority: arch.authority, events: arch.events, subscriptionTransports: transports });
  for (const route of routes) arch.route(route);
  const http = await arch.listen(0);
  const address = http.address();
  assert.ok(address && typeof address === 'object');
  const paired = await pairFixture(arch, `http://127.0.0.1:${address.port}`);
  await paired.request('/api/models/status', { signal: AbortSignal.timeout(180000) }).catch(() => {});
  return { server: arch, http, owner: paired };
}

async function disposeStack(stack: Stack): Promise<void> {
  stack.http.closeAllConnections?.();
  await new Promise<void>(resolve => stack.http.close(() => resolve()));
  stack.server.events.close();
  await stack.server.logger.flush();
}

function envWith(mode: string, extras: Record<string, string> = {}): () => void {
  const saved: Record<string, string | undefined> = {};
  const set: Record<string, string> = { FIXTURE_MODE: mode, ...extras };
  for (const [key, value] of Object.entries(set)) {
    saved[key] = process.env[key];
    process.env[key] = value;
  }
  return () => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  };
}

async function waitGone(pid: number, timeoutMs = 8000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try { process.kill(pid, 0); } catch { return true; }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  return false;
}

before(async () => {
  await fs.writeFile(path.join(workspace, 'package.json'), JSON.stringify({ name: 'sub-cli-fixture', scripts: { test: 'node --test' } }, null, 2), 'utf8');
  fakeCodex = path.join(workspace, 'fake-codex.mjs');
  fakeClaude = path.join(workspace, 'fake-claude.mjs');
  await fs.writeFile(fakeCodex, codexFixture, 'utf8');
  await fs.writeFile(fakeClaude, claudeFixture, 'utf8');
  server = new ArchServer(workspace, path.join(workspace, 'arch-sub-root.log'));
  httpServer = await server.listen(0);
});

after(async () => {
  httpServer.closeAllConnections?.();
  await new Promise<void>(resolve => httpServer.close(() => resolve()));
  server.events.close();
  await server.logger.flush();
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

for (const provider of ['codex-cli', 'claude-code-cli'] as const) {
  const label = provider === 'codex-cli' ? 'CODEX' : 'CLAUDE CODE';

  test(`${label}: detection distinguishes UNAVAILABLE / AUTH_REQUIRED / AVAILABLE`, async () => {
    const missing = createSubscriptionTransports({ findExecutable: async () => null, authArtifactExists: { [provider]: true } as never });
    assert.equal((await missing.detect(provider)).status, 'UNAVAILABLE');

    const unauthenticated = fixtureTransports(provider === 'codex-cli' ? { codexAuth: false } : { claudeAuth: false });
    const authRequired = await unauthenticated.detect(provider);
    assert.equal(authRequired.status, 'AUTH_REQUIRED');
    assert.match(authRequired.detail, /sign-in required/);

    const ready = fixtureTransports();
    const available = await ready.detect(provider);
    assert.equal(available.status, 'AVAILABLE');
    assert.ok((available.version ?? '').includes('9.9.9'), `version probed: ${available.version}`);
    assert.equal(available.provider_family, provider === 'codex-cli' ? 'openai' : 'anthropic');
    assert.equal(available.auth_class, provider === 'codex-cli' ? 'chatgpt_subscription' : 'claude_subscription');
  });

  test(`${label}: structured success through the bounded invocation`, async () => {
    const restore = envWith('ok');
    try {
      const transports = fixtureTransports();
      const result = await transports.invoke(provider, { prompt: 'fixture prompt', workspace, timeoutMs: 60000 });
      assert.match(result.text, new RegExp(`FIXTURE-${provider === 'codex-cli' ? 'CODEX' : 'CLAUDE'}-OK`));
      assert.ok(result.event_count >= 1);
      assert.equal(result.exit_code, 0);
      assert.equal(result.sandbox, 'workspace-write');
    } finally { restore(); }
  });

  test(`${label}: timeout kills the owned tree and reports TIMEOUT-class truth`, async () => {
    const pidFile = path.join(workspace, `${provider}.timeout.pid`);
    const childPidFile = path.join(workspace, `${provider}.timeout.child.pid`);
    const restore = envWith('timeout', { FIXTURE_PID_FILE: pidFile, FIXTURE_CHILD_PID_FILE: childPidFile });
    try {
      const transports = fixtureTransports();
      await assert.rejects(
        () => transports.invoke(provider, { prompt: 'x', workspace, timeoutMs: 2000 }),
        /timed out after 5000ms/
      );
      const pid = Number(await fs.readFile(pidFile, 'utf8'));
      assert.ok(await waitGone(pid), 'the CLI process is dead after timeout');
      const childPid = Number(await fs.readFile(childPidFile, 'utf8'));
      assert.ok(await waitGone(childPid), 'the owned child tree is dead after timeout');
    } finally { restore(); }
  });

  test(`${label}: cancellation terminates only the owned process`, async () => {
    const pidFile = path.join(workspace, `${provider}.cancel.pid`);
    const restore = envWith('timeout', { FIXTURE_PID_FILE: pidFile });
    try {
      const transports = fixtureTransports();
      const controller = new AbortController();
      const pending = transports.invoke(provider, { prompt: 'x', workspace, timeoutMs: 60000, signal: controller.signal });
      // Wait until the fixture is actually running (its pid artifact exists),
      // then cancel deterministically — never race a slow spawn.
      let pid = 0;
      const deadline = Date.now() + 10000;
      while (Date.now() < deadline && pid === 0) {
        pid = Number(await fs.readFile(pidFile, 'utf8').catch(() => '0'));
        if (pid === 0) await new Promise(resolve => setTimeout(resolve, 100));
      }
      assert.ok(pid > 0, 'fixture CLI started before cancellation');
      controller.abort();
      await assert.rejects(() => pending, /cancelled/);
      assert.ok(await waitGone(pid), 'cancelled CLI process is dead');
    } finally { restore(); }
  });

  test(`${label}: malformed output is tolerated; empty structured result fails truthfully`, async () => {
    const restoreMixed = envWith('mixed');
    try {
      const result = await fixtureTransports().invoke(provider, { prompt: 'x', workspace, timeoutMs: 60000 });
      assert.ok(result.unparsed_lines >= 1, 'malformed lines are counted, not fatal');
      assert.match(result.text, new RegExp(`FIXTURE-${provider === 'codex-cli' ? 'CODEX' : 'CLAUDE'}-OK`));
    } finally { restoreMixed(); }
    const restoreGarbage = envWith('garbage');
    try {
      await assert.rejects(
        () => fixtureTransports().invoke(provider, { prompt: 'x', workspace, timeoutMs: 60000 }),
        /empty response/
      );
    } finally { restoreGarbage(); }
  });

  test(`${label}: process failure and auth-required states fail truthfully`, async () => {
    const restore = envWith('exit3');
    try {
      await assert.rejects(
        () => fixtureTransports().invoke(provider, { prompt: 'x', workspace, timeoutMs: 60000 }),
        /exited with code 3/
      );
    } finally { restore(); }
    const unauthenticated = fixtureTransports(provider === 'codex-cli' ? { codexAuth: false } : { claudeAuth: false });
    await assert.rejects(
      () => unauthenticated.invoke(provider, { prompt: 'x', workspace, timeoutMs: 60000 }),
      /not connected/
    );
  });

  test(`${label}: sensitive environment names never reach the CLI process`, async () => {
    const restore = envWith('ok', { AIDE_FIXTURE_SYNTHETIC_SECRET: 'sk-synthetic-secret-value' });
    try {
      const result = await fixtureTransports().invoke(provider, { prompt: 'x', workspace, timeoutMs: 60000 });
      const probe = result.events.find(event => event.type === 'env.probe') as { payload: { has_secret: unknown } } | undefined;
      if (provider === 'codex-cli') {
        assert.ok(probe !== undefined);
        assert.equal(probe.payload.has_secret, null, 'the synthetic secret is not present in the CLI environment');
      }
      assert.ok(!JSON.stringify(result).includes('sk-synthetic-secret-value'), 'no secret in the transport result');
    } finally { restore(); }
  });
}

test('local-only and consent gates block subscription transports with zero spawns', async () => {
  const pidDir = path.join(workspace, 'gate-pids');
  await fs.mkdir(pidDir, { recursive: true });
  const transports = fixtureTransports();
  const stack = await buildStack(transports);
  try {
    const approve = async (method: string, routePath: string, payload: unknown, task: string) => {
      const headers = await stack.owner.approve(method, routePath, payload, task);
      return stack.owner.request(routePath, { method, headers, body: JSON.stringify(payload), signal: AbortSignal.timeout(120000) });
    };
    // Consent ON, routing act -> codex-cli; preference stays local-first.
    assert.equal((await approve('PUT', '/api/byok/consent', { enabled: true }, 'task:sub-consent')).status, 200);
    assert.equal((await approve('PUT', '/api/byok/routing', { routing: { plan: 'local', act: { provider_id: 'codex-cli', model_id: 'gpt-5-codex' }, utility: 'local' } }, 'task:sub-routing')).status, 200);

    // Local-only pin blocks even the ready subscription worker.
    assert.equal((await approve('PUT', '/api/connections/preference', { preference: 'local-only' }, 'task:sub-pin')).status, 200);
    const pinned = await approve('POST', '/api/agent/start', { task: 'must stay local', mode: 'act', chat_source: 'provider' }, 'task:sub-start-pinned');
    assert.equal(pinned.status, 409, JSON.stringify(await pinned.text()).slice(0, 200));
    assert.equal((await approve('PUT', '/api/connections/preference', { preference: 'local-first' }, 'task:sub-unpin')).status, 200);

    // Consent OFF blocks before any transport work.
    assert.equal((await approve('PUT', '/api/byok/consent', { enabled: false }, 'task:sub-consent-off')).status, 200);
    const noConsent = await approve('POST', '/api/agent/start', { task: 'needs consent', mode: 'act', chat_source: 'provider' }, 'task:sub-start-noconsent');
    assert.equal(noConsent.status, 403);

    const spawned = await fs.readdir(pidDir).catch(() => [] as string[]);
    assert.equal(spawned.length, 0, 'no CLI process spawned under either gate');
    const egress = await fs.access(path.join(workspace, '.aide', 'egress', 'journal.jsonl')).then(() => true).catch(() => false);
    assert.equal(egress, false, 'zero subscription egress under the gates');
  } finally {
    await disposeStack(stack);
  }
});

test('roles route through the subscription worker and handoffs flow across it', async () => {
  const restore = envWith('ok');
  const transports = fixtureTransports();
  const stack = await buildStack(transports);
  try {
    const approve = async (method: string, routePath: string, payload: unknown, task: string) => {
      const headers = await stack.owner.approve(method, routePath, payload, task);
      const response = await stack.owner.request(routePath, { method, headers, body: JSON.stringify(payload), signal: AbortSignal.timeout(180000) });
      return { status: response.status, body: (await response.json()) as { ok: boolean; data?: Record<string, unknown>; error?: { code: string; message: string } } };
    };
    assert.equal((await approve('PUT', '/api/byok/consent', { enabled: true }, 'task:sub2-consent')).status, 200);
    assert.equal((await approve('PUT', '/api/byok/routing', { routing: { plan: 'local', act: { provider_id: 'codex-cli', model_id: 'gpt-5-codex' }, utility: 'local' } }, 'task:sub2-routing')).status, 200);

    const waitTerminal = async (id: string): Promise<string> => {
      const deadline = Date.now() + 60000;
      while (Date.now() < deadline) {
        const response = await stack.owner.request(`/api/agent/status?id=${encodeURIComponent(id)}`, { signal: AbortSignal.timeout(30000) });
        const body = (await response.json()) as { ok: boolean; data?: { state: string } };
        if (body.data && ['done', 'error', 'aborted'].includes(body.data.state)) return body.data.state;
        await new Promise(resolve => setTimeout(resolve, 400));
      }
      throw new Error('timeout');
    };

    // Codex-executed stage through the governed provider path.
    const codexStage = await approve('POST', '/api/agent/start', { task: 'cross transport stage two', mode: 'act', chat_source: 'provider' }, 'task:sub2-codex');
    assert.equal(codexStage.status, 200, JSON.stringify(codexStage.body).slice(0, 250));
    const codexSession = (codexStage.body.data as { session_id: string }).session_id;
    assert.equal(await waitTerminal(codexSession), 'done');
    const trajectoryDir = path.join(workspace, '.aide', 'trajectories');
    const trajectory = await fs.readFile(path.join(trajectoryDir, `${codexSession}.traj.json`), 'utf8');
    assert.match(trajectory, /FIXTURE-CODEX-OK/);

    // Handoff out of the Codex session into another subscription worker
    // (Codex -> Claude Code mechanism with the accepted Wave-3/4 contract).
    const to = { worker: 'cloud:claude-code-cli:claude-sonnet', provider: 'claude-code-cli', model: 'claude-sonnet', role: 'act' };
    const created = await approve('POST', '/api/worker-handoff/create', {
      task_id: codexSession, from: { worker: 'cloud:codex-cli:gpt-5-codex', provider: 'codex-cli', model: 'gpt-5-codex', role: 'act' }, to,
      objective: 'cross-vendor review', next_action: 'review the stage'
    }, 'task:sub2-handoff');
    assert.equal(created.status, 200, JSON.stringify(created.body).slice(0, 250));
    const handoffId = (created.body.data as { handoff: { handoff_id: string } }).handoff.handoff_id;

    assert.equal((await approve('PUT', '/api/byok/routing', { routing: { plan: 'local', act: { provider_id: 'claude-code-cli', model_id: 'claude-sonnet' }, utility: 'local' } }, 'task:sub2-routing2')).status, 200);
    const claudeStage = await approve('POST', '/api/agent/start', { task: 'cross transport stage three', mode: 'act', chat_source: 'provider', handoff_id: handoffId, worker: to }, 'task:sub2-claude');
    assert.equal(claudeStage.status, 200, JSON.stringify(claudeStage.body).slice(0, 250));
    const claudeSession = (claudeStage.body.data as { session_id: string }).session_id;
    assert.equal(await waitTerminal(claudeSession), 'done');
    const claudeTrajectory = await fs.readFile(path.join(trajectoryDir, `${claudeSession}.traj.json`), 'utf8');
    assert.match(claudeTrajectory, /FIXTURE-CLAUDE-OK/);
    assert.match(claudeTrajectory, /RECEIVING CONTEXT — handed off from a previous worker/);
    const handoff = await stack.owner.request(`/api/worker-handoff/get?id=${encodeURIComponent(handoffId)}`, { signal: AbortSignal.timeout(60000) });
    const handoffBody = (await handoff.json()) as { data: { handoff: { state: string } } };
    assert.equal(handoffBody.data.handoff.state, 'CONSUMED');
  } finally {
    restore();
    await disposeStack(stack);
  }
});

test('restart re-evaluates provider state instead of trusting stale availability', async () => {
  const unauthenticated = fixtureTransports({ codexAuth: false });
  assert.equal((await unauthenticated.detect('codex-cli')).status, 'AUTH_REQUIRED');
  const reauthenticated = fixtureTransports({ codexAuth: true });
  assert.equal((await reauthenticated.detect('codex-cli')).status, 'AVAILABLE');
});

test('subscription failures classify into the frozen Wave-6 continuation policy', async () => {
  await fs.mkdir(path.join(workspace, '.aide', 'trajectories'), { recursive: true });
  await fs.writeFile(path.join(workspace, '.aide', 'trajectories', 'sub-fail-1.traj.json'), JSON.stringify({
    session_id: 'sub-fail-1', task: 'subscription failure', mode: 'act', outcome: 'error',
    iterations: 1, mistake_count: 1, error: 'provider codex-cli exited with code 3', started_at: '', ended_at: '', transcript: [], tool_log: []
  }), 'utf8');
  const transports = fixtureTransports();
  const stack = await buildStack(transports);
  try {
    const headers = await stack.owner.approve('POST', '/api/agent/continuation', {
      failed_session_id: 'sub-fail-1',
      failed_worker: { worker: 'cloud:codex-cli:gpt-5-codex', provider: 'codex-cli', model: 'gpt-5-codex', role: 'act' },
      replacement: { worker: 'cloud:claude-code-cli:claude-sonnet', provider: 'claude-code-cli', model: 'claude-sonnet', role: 'act' }
    }, 'task:sub-fail-plan');
    const response = await stack.owner.request('/api/agent/continuation', {
      method: 'POST', headers,
      body: JSON.stringify({
        failed_session_id: 'sub-fail-1',
        failed_worker: { worker: 'cloud:codex-cli:gpt-5-codex', provider: 'codex-cli', model: 'gpt-5-codex', role: 'act' },
        replacement: { worker: 'cloud:claude-code-cli:claude-sonnet', provider: 'claude-code-cli', model: 'claude-sonnet', role: 'act' }
      }),
      signal: AbortSignal.timeout(120000)
    });
    const body = (await response.json()) as { ok: boolean; data?: { decision: string; failure_class: string; handoff_id: string | null }; error?: { message?: string } };
    assert.equal(response.status, 200, JSON.stringify(body).slice(0, 250));
    assert.equal(body.data!.failure_class, 'PROVIDER_UNAVAILABLE');
    assert.ok(['switch', 'terminal'].includes(body.data!.decision));
  } finally {
    await disposeStack(stack);
  }
});
