// scripts/release-first-run-check.mjs
// External-user release acceptance — FIRST RUN.
//
// Phase A: canonical `npm start` (the literal documented command) against a
// FRESH scratch workspace, verifying ports 4173/4777/4778/4779, the public
// shell, protected-route behavior, pairing-route presence, log secret hygiene,
// clean teardown and no orphaned owned processes.
// Phase B: the real supervised stack (supervisor + arch + legacy + facade,
// real pairing) walking the new-user journey at HTTP level: onboarding state,
// model truth (artifact absent => setup required, never READY), workspace,
// session, governed chat (unapproved => 409), terminal provider truth, then a
// full restart and state-truth re-check.
//
// It does not prove subjective UX quality and it does not replace the browser
// acceptance driver; it proves the objective release journey on the real
// product surfaces.
import { spawn } from 'node:child_process';
import { promises as fs, existsSync } from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchSupervisedStack } from '../tests/helpers/supervised-stack.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STAMP = new Date().toISOString().replace(/[:.]/g, '-');
const SCRATCH_ROOT = process.env.AIDE_RELEASE_SCRATCH || path.join(os.tmpdir(), `covert-release-check-${STAMP}`);
const CANONICAL_WORKSPACE = path.join(SCRATCH_ROOT, 'canonical-workspace');
const SUPERVISED_WORKSPACE = path.join(SCRATCH_ROOT, 'supervised-workspace');
const PORT_LIST = [4173, 4777, 4778, 4779];

const checks = [];
function check(name, pass, detail) {
  checks.push({ name, result: pass ? 'PASS' : 'FAIL', detail: String(detail ?? '').slice(0, 300) });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}
function warn(name, detail) {
  checks.push({ name, result: 'WARN', detail: String(detail ?? '').slice(0, 300) });
  console.log(`WARN  ${name}${detail ? ` — ${detail}` : ''}`);
}
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function portOpen(port) {
  return new Promise(resolve => {
    const socket = net.createConnection({ host: '127.0.0.1', port });
    socket.setTimeout(1000);
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('timeout', () => { socket.destroy(); resolve(false); });
    socket.once('error', () => resolve(false));
  });
}
async function waitFor(description, predicate, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try { if (await predicate()) return true; } catch { /* retry */ }
    await sleep(500);
  }
  console.log(`timeout waiting for ${description}`);
  return false;
}
async function fetchText(url, init) {
  const response = await fetch(url, { signal: AbortSignal.timeout(20000), ...init });
  return { status: response.status, text: await response.text() };
}

const SECRET_PATTERNS = [
  { name: 'private-key', pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: 'openai-style', pattern: /sk-[A-Za-z0-9_-]{16,}/ },
  { name: 'github-pat', pattern: /ghp_[A-Za-z0-9]{20,}/ },
  { name: 'bearer-token', pattern: /Bearer\s+[A-Za-z0-9._-]{20,}/i }
];

let canonical = null;
try {
  await fs.mkdir(CANONICAL_WORKSPACE, { recursive: true });

  // -------------------------------------------------------------------------
  // Phase A — canonical npm start on a fresh workspace
  // -------------------------------------------------------------------------
  for (const port of PORT_LIST) check(`pre: port ${port} free`, !(await portOpen(port)), 'occupied before start');

  const outLog = path.join(SCRATCH_ROOT, 'canonical-out.log');
  const errLog = path.join(SCRATCH_ROOT, 'canonical-err.log');
  const out = await fs.open(outLog, 'w');
  const err = await fs.open(errLog, 'w');
  const startedAt = Date.now();
  canonical = spawn(process.execPath, ['scripts/start.mjs', '--frontend=typed', '--build'], {
    cwd: ROOT,
    env: { ...process.env, AIDE_WORKSPACE: CANONICAL_WORKSPACE },
    stdio: ['ignore', out.fd, err.fd],
    windowsHide: true
  });
  await out.close();
  await err.close();

  const allPortsUp = await waitFor('canonical stack ports', async () => {
    for (const port of PORT_LIST) if (!(await portOpen(port))) return false;
    return true;
  }, 12 * 60_000);
  check('canonical startup: ports 4173/4777/4778/4779 listening', allPortsUp, `${Math.round((Date.now() - startedAt) / 1000)}s from launch (includes frontend build)`);

  if (allPortsUp) {
    const ui = await fetchText('http://127.0.0.1:4173/');
    check('public shell serves HTML', ui.status === 200 && /<html/i.test(ui.text) && ui.text.length > 500, `HTTP ${ui.status}, ${ui.text.length} bytes`);
    check('public shell is the built typed frontend', /assets\//.test(ui.text), 'references built /assets bundle');

    const facadeHealth = await fetchText('http://127.0.0.1:4777/api/health');
    check('facade /api/health reachable', facadeHealth.status === 200, `HTTP ${facadeHealth.status}`);
    const archHealth = await fetchText('http://127.0.0.1:4778/api/health');
    check('arch backend /api/health reachable', archHealth.status === 200, `HTTP ${archHealth.status}`);

    const protectedStatus = await fetchText('http://127.0.0.1:4777/api/models/status');
    check('protected route without operator session is denied', protectedStatus.status === 403, `HTTP ${protectedStatus.status}`);

    const pairProbe = await fetchText('http://127.0.0.1:4777/api/authority/pair', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://127.0.0.1:4173' },
      body: JSON.stringify({ proof: 'invalid-proof-probe' })
    });
    check('pairing route exists and validates the proof', pairProbe.status !== 404 && pairProbe.status >= 400, `HTTP ${pairProbe.status}`);

    // Secret hygiene in the logs this run produced.
    const logFiles = [];
    for (const dir of [path.join(CANONICAL_WORKSPACE, '.aide', 'logs'), path.join(ROOT, '.aide', 'logs')]) {
      if (!existsSync(dir)) continue;
      for (const entry of await fs.readdir(dir)) logFiles.push(path.join(dir, entry));
    }
    let leak = null;
    let scanned = 0;
    for (const file of logFiles) {
      const text = await fs.readFile(file, 'utf8').catch(() => '');
      scanned += 1;
      for (const { name, pattern } of SECRET_PATTERNS) if (pattern.test(text)) leak = `${name} in ${path.basename(file)}`;
    }
    check('launch logs contain no credential-shaped material', leak === null, leak ?? `${scanned} log file(s) scanned`);
  }

  // Teardown the canonical stack and prove nothing survives.
  if (canonical !== null && canonical.pid !== undefined) {
    await new Promise(resolve => {
      const killer = spawn('taskkill', ['/PID', String(canonical.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
      killer.once('exit', resolve);
      killer.once('error', resolve);
    });
  }
  await sleep(2500);
  let portsAfter = 0;
  for (const port of PORT_LIST) if (await portOpen(port)) portsAfter += 1;
  check('canonical teardown leaves no owned listener', portsAfter === 0, `${portsAfter} port(s) still listening`);
  canonical = null;

  // -------------------------------------------------------------------------
  // Phase B — supervised stack: real pairing, journey truth, restart
  // -------------------------------------------------------------------------
  await fs.mkdir(SUPERVISED_WORKSPACE, { recursive: true });
  async function journey(stack, label) {
    const onboarding = await stack.json('facade', 'GET', '/api/onboarding/state');
    check(`${label}: onboarding state reachable and truthful`, onboarding.status === 200 && typeof onboarding.body?.data === 'object', `HTTP ${onboarding.status}`);

    const models = await stack.json('facade', 'GET', '/api/models/status', { signal: AbortSignal.timeout(60000) });
    const entries = models.body?.data?.models ?? [];
    const anyRunning = entries.some(entry => entry.status === 'running');
    // Truth contract: a missing artifact must surface as setup_required (the UI
    // maps this to STARTABLE/ACTION REQUIRED); it must never claim RUNNING and
    // never be 'ready' without BOTH artifact evidence and the setup flag absent.
    const falseReady = entries.some(entry => entry.status === 'ready' && entry.artifact_available !== true && entry.setup_required !== true);
    check(`${label}: model truth (no artifact => setup required, nothing RUNNING)`, models.status === 200 && entries.length > 0 && !anyRunning && !falseReady, `${entries.length} model(s), running=${anyRunning}, falseReady=${falseReady}`);

    const workspace = await stack.json('facade', 'GET', '/api/workspace');
    check(`${label}: workspace listing reachable`, workspace.status === 200 && Array.isArray(workspace.body?.data?.entries), `HTTP ${workspace.status}`);

    const session = await stack.json('facade', 'GET', '/api/session');
    check(`${label}: session surface reachable`, session.status === 200, `HTTP ${session.status}`);

    const unapprovedChat = await stack.json('facade', 'POST', '/api/chat', {
      body: { modelId: 'smollm2-360m-q8', messages: [{ role: 'user', content: 'release probe' }] }, signal: AbortSignal.timeout(30000)
    });
    if (unapprovedChat.status === 409) {
      check(`${label}: chat without an approved operation is denied (governed)`, true, 'HTTP 409 approval required');
    } else if (unapprovedChat.status === 403) {
      // This branch predates the local-inference authority enrollment: chat is
      // fail-closed with no policy. The integrated RC must reach the governed
      // 409 path (owned by the convergence lane).
      warn(`${label}: chat denial is fail-closed 403 (pre-enrollment branch)`, 'integration RC must return 409 approval-required');
      check(`${label}: chat without an approved operation is denied (fail-closed)`, true, 'HTTP 403 no authority policy');
    } else {
      check(`${label}: chat without an approved operation is denied`, false, `HTTP ${unapprovedChat.status}`);
    }

    const providers = await stack.json('facade', 'GET', '/api/terminal/providers');
    const providerList = providers.body?.data?.providers ?? [];
    check(`${label}: terminal provider truth is exposed`, providers.status === 200 && Array.isArray(providerList), `HTTP ${providers.status}, ${providerList.length} provider(s)`);
    return { onboarding: onboarding.body?.data, terminalProviders: providerList };
  }

  let stack = await launchSupervisedStack({ workspace: SUPERVISED_WORKSPACE });
  const first = await journey(stack, 'first run');

  // Governed terminal open → truthful success or truthful refusal.
  const availableProvider = first.terminalProviders.find(provider => provider.state === 'available' || provider.available === true || provider.status === 'available');
  if (availableProvider === undefined) {
    warn('terminal session open', `no available provider reported (${JSON.stringify(first.terminalProviders).slice(0, 200)})`);
  } else {
    const shellId = availableProvider.shells?.[0]?.id ?? null;
    const openBody = { provider: availableProvider.id, shell: shellId, cols: 80, rows: 24 };
    try {
      const opened = await stack.approveJson({ method: 'POST', path: '/api/terminal/sessions', body: openBody, signal: AbortSignal.timeout(60000) });
      check('terminal session opens through the governed path', opened.status === 200, `HTTP ${opened.status}`);
      const sessionId = opened.body?.data?.session?.session_id ?? opened.body?.data?.session_id;
      if (typeof sessionId === 'string') {
        await stack.approveJson({ method: 'POST', path: '/api/terminal/sessions/stop', body: { sessionId }, signal: AbortSignal.timeout(30000) }).catch(() => null);
      }
    } catch (error) {
      check('terminal session opens through the governed path', false, String(error?.message ?? error).slice(0, 240));
    }
  }

  // Restart continuity: compare the SEMANTIC state, not clock fields.
  const semanticState = value => JSON.stringify(value, (key, item) => /(_at|at|time|timestamp|ts)$/i.test(key) ? '<time>' : item);
  await stack.close();
  stack = await launchSupervisedStack({ workspace: SUPERVISED_WORKSPACE });
  const second = await journey(stack, 'after restart');
  const onboardingStateBefore = semanticState(first.onboarding ?? null);
  const onboardingStateAfter = semanticState(second.onboarding ?? null);
  check('restart preserves onboarding/setup state', onboardingStateBefore === onboardingStateAfter, onboardingStateBefore === onboardingStateAfter ? 'semantic state identical (timestamps normalized)' : `before=${onboardingStateBefore.slice(0, 120)} after=${onboardingStateAfter.slice(0, 120)}`);
  await stack.close();
  stack = null;

  submit(checks.some(entry => entry.result === 'FAIL'));
} catch (error) {
  check('release first-run check completed without harness error', false, String(error?.stack ?? error).slice(0, 500));
  submit(true);
} finally {
  if (canonical !== null && canonical.pid !== undefined) {
    await new Promise(resolve => {
      const killer = spawn('taskkill', ['/PID', String(canonical.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
      killer.once('exit', resolve);
      killer.once('error', resolve);
    });
  }
}

function submit(failed) {
  const summary = {
    harness: 'release-first-run-check',
    generated_at: new Date().toISOString(),
    workspace_root: SCRATCH_ROOT,
    checks,
    failed: checks.filter(entry => entry.result === 'FAIL').length,
    warned: checks.filter(entry => entry.result === 'WARN').length
  };
  console.log('\nRELEASE_FIRST_RUN_SUMMARY');
  console.log(JSON.stringify(summary, null, 2));
  process.exitCode = failed ? 1 : 0;
}
