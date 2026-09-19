// scripts/local-inference-gate.mjs
// LIVE production gate for the local-inference lane.
//
// Drives the REAL supervised stack (supervisor + arch + legacy + facade with
// real HTTP authority pairing) through the full local-model lifecycle:
//   artifact truth -> import -> register -> profile -> governed start ->
//   readiness -> REAL inference through the router -> governed stop ->
//   restart continuity -> SECOND real inference
// plus the failure cases that must stay truthful (invalid artifacts, missing
// files, unknown models, port occupancy, external process death).
//
// No mocks: the engine is the real llama-server binary serving a real GGUF,
// and every mutation is an operator-approved exact operation. The gate is
// read-only outside its own workspace state and cleans its artifacts up
// unless --keep is passed.
//
// Usage:
//   node scripts/local-inference-gate.mjs [--keep]
// Env:
//   AIDE_GATE_GGUF  path to the release-proof GGUF artifact
//                   (default E:\models\smollm2-360m-instruct-q8_0.gguf)
import { launchSupervisedStack } from '../tests/helpers/supervised-stack.mjs';
import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const execFileAsync = promisify(execFile);
const KEEP = process.argv.includes('--keep');
const GGUF = process.env.AIDE_GATE_GGUF || 'E:\\models\\smollm2-360m-instruct-q8_0.gguf';
const FILENAME = path.basename(GGUF);
const MODEL_ID = FILENAME.replace(/\.gguf$/i, '').toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
const MODEL_FILE = path.join(ROOT, 'models', FILENAME);
const SIDECAR = `${MODEL_FILE}.manifest.json`;
const PROFILE = `${MODEL_FILE}.profile.json`;
const INGESTED = path.join(ROOT, '.aide', 'ingested-models.json');

const evidence = {
  gate: 'local-inference-production-gate',
  baseline: 'a92eb996d438ba433916a886d3d1de084c71dd4f',
  gguf: GGUF,
  model_id: MODEL_ID,
  phases: {},
  failures: [],
  started_at: new Date().toISOString()
};

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
function record(phase, data) {
  evidence.phases[phase] = data;
  console.log(`[gate] ${phase}: ${JSON.stringify(data)}`);
}
function check(condition, message) {
  if (!condition) {
    evidence.failures.push(message);
    throw new Error(`GATE FAILURE: ${message}`);
  }
}
function envelopeData(body, label) {
  check(body?.ok === true, `${label}: not an ok envelope: ${JSON.stringify(body).slice(0, 240)}`);
  return body.data;
}

async function enginePids() {
  const { stdout } = await execFileAsync('powershell', ['-NoProfile', '-Command',
    `Get-CimInstance Win32_Process -Filter "Name='llama-server.exe'" | Where-Object { $_.CommandLine -like '*${FILENAME}*' } | Select-Object -ExpandProperty ProcessId`]);
  return stdout.split(/\r?\n/).map(line => line.trim()).filter(Boolean).map(Number);
}

// The facade bounds nothing upstream-side; the client signal decides how long
// an authority-gated write may wait behind durably-fsynced audit appends. On
// this E:-HDD box a stalled append can exceed 30s under load, so every
// happy-path mutation gets a generous window (domain failures still return
// immediately and are asserted as-is).
async function approvedRequest(stack, { method, path: routePath, body, signalMs = 120000 }) {
  const operation = await stack.prepare({ method, path: routePath, body });
  await stack.decide(operation.operation_id);
  return stack.request('facade', method, routePath, {
    body,
    headers: { 'X-AIDE-Operation': operation.operation_id, 'X-AIDE-Task': operation.task_id },
    signal: AbortSignal.timeout(signalMs)
  });
}
async function approvedJson(stack, options) {
  const response = await approvedRequest(stack, options);
  let body = {};
  try { body = await response.json(); } catch { /* non-JSON body */ }
  return { status: response.status, body };
}

// Authority-gated reads await durably-fsynced audit appends (cipher-state
// handle.sync() on the E: HDD); under import/engine I/O those appends can stall
// past a 20s client window on this machine. Bounded retries on transport
// timeout/5xx keep the gate honest under disk stalls — a 200 response that
// lies is still asserted against, retries never mask state.
async function modelStatus(stack, id) {
  for (let attempt = 1; ; attempt++) {
    try {
      const { status, body } = await stack.json('facade', 'GET', '/api/models/status', { signal: AbortSignal.timeout(120000) });
      if (status !== 200 || body?.ok !== true) throw new Error(`models/status http ${status}`);
      const data = body.data;
      return { runtime: data.runtime, entry: data.models.find(model => model.id === id) ?? null };
    } catch (error) {
      if (attempt >= 3) throw error;
      console.warn(`[gate] models/status stalled (attempt ${attempt}): ${error?.message ?? error}; retrying`);
      await sleep(2000);
    }
  }
}

async function probeReady(stack, id) {
  for (let attempt = 1; ; attempt++) {
    try {
      const { status, body } = await stack.json('facade', 'GET', `/api/model/ready?id=${encodeURIComponent(id)}`, { signal: AbortSignal.timeout(60000) });
      if (status !== 200 || body?.ok !== true) throw new Error(`model/ready http ${status}`);
      return body.data;
    } catch (error) {
      if (attempt >= 3) throw error;
      console.warn(`[gate] model/ready stalled (attempt ${attempt}): ${error?.message ?? error}; retrying`);
      await sleep(2000);
    }
  }
}

async function waitReady(stack, id, timeoutMs = 180000) {
  const started = Date.now();
  let last = null;
  while (Date.now() - started < timeoutMs) {
    const { status, body } = await stack.json('facade', 'GET', `/api/model/ready?id=${encodeURIComponent(id)}`, { signal: AbortSignal.timeout(20000) });
    check(status === 200, `model/ready http ${status}`);
    const ready = envelopeData(body, 'model/ready');
    last = ready;
    if (ready.ready === true) return { ready: true, ms: Date.now() - started, endpoint: ready.endpoint };
    if (ready.status === 'conflict') return { ready: false, ms: Date.now() - started, conflict: ready.error };
    await sleep(1000);
  }
  return { ready: false, ms: Date.now() - started, timeout: true, last };
}

function startOccupyingServer(port) {
  return new Promise(resolve => {
    const server = http.createServer((request, response) => {
      if (request.url?.endsWith('/v1/models') || request.url?.endsWith('/models')) {
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ object: 'list', data: [{ id: 'foreign-squatter', object: 'model' }] }));
        return;
      }
      response.writeHead(404, { 'content-type': 'application/json' });
      response.end('{}');
    });
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}

async function failureCase(label, run, expectStatus, expectCode, expectMessage) {
  let result;
  try {
    result = await run();
  } catch (error) {
    const message = String(error?.message ?? error);
    const match = /HTTP (\d{3})/.exec(message);
    if (match === null) throw error;
    result = { status: Number(match[1]), body: { error: { code: null, message } } };
  }
  const { status, body } = result;
  const detail = { status, code: body?.error?.code ?? null, message: String(body?.error?.message ?? '').slice(0, 200) };
  check(status === expectStatus, `${label}: expected HTTP ${expectStatus}, got ${status} (${JSON.stringify(body).slice(0, 200)})`);
  if (expectCode !== undefined) check(detail.code === expectCode, `${label}: expected code ${expectCode}, got ${detail.code}`);
  if (expectMessage !== undefined) check(new RegExp(expectMessage, 'i').test(detail.message), `${label}: message ${JSON.stringify(detail.message)} does not match ${expectMessage}`);
  return detail;
}

async function cleanupGateState() {
  await fs.rm(MODEL_FILE, { force: true });
  await fs.rm(SIDECAR, { force: true });
  await fs.rm(PROFILE, { force: true });
  await fs.rm(path.join(ROOT, '.aide', 'gate-invalid.gguf'), { force: true });
  await fs.rm(path.join(ROOT, '.aide', 'gate-invalid.txt'), { force: true });
  // Remove only this gate's own registry entry; never touch other models.
  try {
    const raw = JSON.parse(await fs.readFile(INGESTED, 'utf8'));
    if (Array.isArray(raw)) {
      const remaining = raw.filter(model => model?.id !== MODEL_ID);
      if (remaining.length === 0) await fs.rm(INGESTED, { force: true });
      else await fs.writeFile(INGESTED, JSON.stringify(remaining, null, 2), 'utf8');
    }
  } catch { /* no store yet */ }
}

let stack = null;
async function safeStop(id) {
  if (stack === null) return;
  try { await approvedJson(stack, { method: 'POST', path: '/api/models/stop', body: { id }, signalMs: 60000 }); } catch { /* already gone */ }
}

try {
  // -------------------------------------------------------------------------
  // Preconditions
  // -------------------------------------------------------------------------
  const sourceStat = await fs.stat(GGUF);
  check(sourceStat.isFile(), `artifact not found: ${GGUF}`);
  await cleanupGateState();
  record('P0_preconditions', { artifact: GGUF, bytes: sourceStat.size });

  // -------------------------------------------------------------------------
  // Stack #1 — full lifecycle
  // -------------------------------------------------------------------------
  stack = await launchSupervisedStack({ workspace: ROOT });

  // A. Artifact truth BEFORE import: no artifact, no false READY/RUNNING.
  const before = await modelStatus(stack, MODEL_ID);
  check(before.entry === null, `model ${MODEL_ID} must not be registered before import`);
  const manifestGhost = await modelStatus(stack, 'smollm2-360m-q8');
  check(manifestGhost.entry?.artifact_available === false, 'bundled manifest entry must report artifact_available=false without its GGUF');
  check(manifestGhost.entry?.setup_required === true, 'bundled manifest entry must require setup without its GGUF');
  record('A_artifact_truth_before_import', { registered: before.entry, bundled_entry: manifestGhost.entry });

  // B. Import through the governed local-artifact path.
  const imported = await approvedJson(stack, { method: 'POST', path: '/api/models/import', body: { path: GGUF }, signalMs: 300000 });
  check(imported.status === 200, `import http ${imported.status}: ${JSON.stringify(imported.body).slice(0, 200)}`);
  const copied = await fs.stat(MODEL_FILE);
  check(copied.size === sourceStat.size, `imported copy size ${copied.size} != source ${sourceStat.size}`);
  check((await fs.stat(SIDECAR)).isFile(), 'import sidecar manifest missing');
  const sidecar = JSON.parse(await fs.readFile(SIDECAR, 'utf8'));
  record('B_import', { id: envelopeData(imported.body, 'import').manifest?.filename, bytes: copied.size, sidecar_status: sidecar.status, sidecar_source: sidecar.source });

  // C. Register: artifact -> persisted model identity.
  const registered = await approvedJson(stack, { method: 'POST', path: '/api/models/register', body: {
    filename: FILENAME, repo_id: 'HuggingFaceTB/SmolLM2-360M-Instruct-GGUF', quant_label: 'Q8_0', context_tokens: 2048
  }, signalMs: 300000 });
  check(registered.status === 200, `register http ${registered.status}`);
  const registeredData = envelopeData(registered.body, 'register');
  check(registeredData.id === MODEL_ID, `register id ${registeredData.id} != ${MODEL_ID}`);
  const ingested = JSON.parse(await fs.readFile(INGESTED, 'utf8'));
  const persisted = ingested.find(model => model.id === MODEL_ID);
  check(persisted !== undefined, 'registered model must persist in .aide/ingested-models.json');
  record('C_register', { ...registeredData, persisted_file: persisted.file, store: INGESTED });

  // D. Profile: persisted engine profile.
  const profiled = await approvedJson(stack, { method: 'POST', path: '/api/models/profile', body: { id: MODEL_ID, preset: 'precise' }, signalMs: 300000 });
  check(profiled.status === 200, `profile http ${profiled.status}`);
  const profileSidecar = JSON.parse(await fs.readFile(PROFILE, 'utf8'));
  check(profileSidecar.preset === 'precise', 'profile sidecar must record the approved preset');
  record('D_profile', { ...envelopeData(profiled.body, 'profile'), sidecar: profileSidecar });

  // E. Governed start -> real llama-server -> readiness.
  const startedAt = Date.now();
  const started = await approvedJson(stack, { method: 'POST', path: '/api/models/start', body: { id: MODEL_ID }, signalMs: 240000 });
  check(started.status === 200, `start http ${started.status}: ${JSON.stringify(started.body).slice(0, 240)}`);
  const startData = envelopeData(started.body, 'start');
  const ready = await waitReady(stack, MODEL_ID);
  check(ready.ready === true, `model did not become ready: ${JSON.stringify(ready)}`);
  const running = await modelStatus(stack, MODEL_ID);
  check(running.entry?.status === 'running', `status must report running, got ${running.entry?.status}`);
  const pids = await enginePids();
  check(pids.length === 1, `expected exactly one owned llama-server, got [${pids.join(', ')}]`);
  record('E_governed_start', { start: startData, ready, startup_ms: Date.now() - startedAt, engine_pid: pids[0], endpoint: running.entry.endpoint });

  // F. REAL inference through Covert's router.
  const chat = await approvedJson(stack, { method: 'POST', path: '/api/chat', body: {
    modelId: MODEL_ID, messages: [{ role: 'user', content: 'Reply with exactly: GATE-OK' }], options: { maxTokens: 16, temperature: 0 }
  }, signalMs: 300000 });
  check(chat.status === 200, `chat http ${chat.status}: ${JSON.stringify(chat.body).slice(0, 240)}`);
  const chatData = envelopeData(chat.body, 'chat');
  check(typeof chatData.text === 'string' && chatData.text.trim().length > 0, 'chat must return generated text');
  record('F_first_inference', { modelId: chatData.modelId, tokens: chatData.tokens ?? null, timingMs: chatData.timingMs ?? null, text: chatData.text.slice(0, 200) });

  // G. Governed stop -> process dead -> truthful state.
  const stopped = await approvedJson(stack, { method: 'POST', path: '/api/models/stop', body: { id: MODEL_ID }, signalMs: 120000 });
  check(stopped.status === 200, `stop http ${stopped.status}`);
  await sleep(1500);
  const pidsAfterStop = await enginePids();
  check(pidsAfterStop.length === 0, `engine must be dead after stop, still alive: [${pidsAfterStop.join(', ')}]`);
  const readyAfterStop = await probeReady(stack, MODEL_ID);
  check(readyAfterStop.ready === false, 'model must not report ready after stop');
  const statusAfterStop = await modelStatus(stack, MODEL_ID);
  check(statusAfterStop.entry?.status !== 'running', 'status must not report running after stop');
  record('G_governed_stop', { stop: envelopeData(stopped.body, 'stop'), pids_after: pidsAfterStop, ready_after: readyAfterStop, status_after: statusAfterStop.entry?.status });

  // H. Failure cases that must stay truthful (no engine needed).
  await failureCase('register path escape',
    () => approvedJson(stack, { method: 'POST', path: '/api/models/register', body: { filename: '..\\..\\evil.gguf' } }),
    400, undefined, 'safe segments|escaped');
  await failureCase('register missing artifact',
    () => approvedJson(stack, { method: 'POST', path: '/api/models/register', body: { filename: 'missing-model.gguf' } }),
    400, undefined, 'artifact not found');
  const invalidGguf = path.join(ROOT, '.aide', 'gate-invalid.gguf');
  const invalidTxt = path.join(ROOT, '.aide', 'gate-invalid.txt');
  await fs.mkdir(path.dirname(invalidGguf), { recursive: true });
  await fs.writeFile(invalidGguf, 'not a gguf at all');
  await fs.writeFile(invalidTxt, 'plain text, wrong extension');
  await failureCase('import invalid GGUF',
    () => approvedJson(stack, { method: 'POST', path: '/api/models/import', body: { path: invalidGguf } }),
    400, 'BAD_REQUEST', 'not a valid GGUF');
  await failureCase('ingest non-gguf extension',
    () => approvedJson(stack, { method: 'POST', path: '/api/models/ingest', body: { path: invalidTxt } }),
    504, 'CHILD_FAILED', 'only \\.gguf');
  await failureCase('ingest malformed gguf',
    () => approvedJson(stack, { method: 'POST', path: '/api/models/ingest', body: { path: invalidGguf } }),
    504, 'CHILD_FAILED', 'truncated|invalid|magic');
  await failureCase('start unknown model',
    () => approvedJson(stack, { method: 'POST', path: '/api/models/start', body: { id: 'not-allowlisted' }, signalMs: 60000 }),
    504, 'CHILD_FAILED', 'not allowlisted');
  await failureCase('start manifest model without artifact',
    () => approvedJson(stack, { method: 'POST', path: '/api/models/start', body: { id: 'qwen-coder-0.5b-q4' }, signalMs: 60000 }),
    409, 'NOT_READY', 'setup required|was not found');
  await failureCase('unapproved start is denied',
    async () => { const response = await stack.request('facade', 'POST', '/api/models/start', { body: { id: MODEL_ID } }); return { status: response.status, body: await response.json() }; },
    409, 'NOT_READY', 'approval required');
  record('H_failure_cases', { count: 8, verdict: 'all truthful' });

  // Restart continuity phase 1: close the whole stack; nothing may survive.
  await stack.close();
  stack = null;
  await sleep(1500);
  const pidsAfterClose = await enginePids();
  check(pidsAfterClose.length === 0, `no engine may survive Covert shutdown, found [${pidsAfterClose.join(', ')}]`);
  record('I_covert_shutdown', { engine_pids_after_close: pidsAfterClose });

  // -------------------------------------------------------------------------
  // Stack #2 — restart continuity + second inference + harder failure cases
  // -------------------------------------------------------------------------
  stack = await launchSupervisedStack({ workspace: ROOT });

  // J. State truth after restart: identity persists, nothing claims RUNNING.
  const afterRestart = await modelStatus(stack, MODEL_ID);
  check(afterRestart.entry !== null, 'registered model must survive restart');
  check(afterRestart.entry.artifact_available === true, 'artifact must survive restart');
  check(afterRestart.entry.status !== 'running', `restarted Covert must not claim running (got ${afterRestart.entry.status})`);
  const readyAfterRestart = await probeReady(stack, MODEL_ID);
  check(readyAfterRestart.ready === false, 'restarted Covert must not claim ready before a governed start');
  record('J_restart_continuity', { entry: afterRestart.entry, ready_probe: readyAfterRestart });

  // K. Second governed start + second REAL inference.
  const started2 = await approvedJson(stack, { method: 'POST', path: '/api/models/start', body: { id: MODEL_ID }, signalMs: 240000 });
  check(started2.status === 200, `second start http ${started2.status}`);
  const ready2 = await waitReady(stack, MODEL_ID);
  check(ready2.ready === true, `second start not ready: ${JSON.stringify(ready2)}`);
  const chat2 = await approvedJson(stack, { method: 'POST', path: '/api/chat', body: {
    modelId: MODEL_ID, messages: [{ role: 'user', content: 'Say the word: SECOND' }], options: { maxTokens: 16, temperature: 0 }
  }, signalMs: 300000 });
  check(chat2.status === 200, `second chat http ${chat2.status}`);
  const chat2Data = envelopeData(chat2.body, 'chat2');
  check(typeof chat2Data.text === 'string' && chat2Data.text.trim().length > 0, 'second inference must return generated text');
  record('K_second_inference', { modelId: chat2Data.modelId, tokens: chat2Data.tokens ?? null, timingMs: chat2Data.timingMs ?? null, text: chat2Data.text.slice(0, 200) });

  // L. External process death must not leave a stale RUNNING claim.
  const pidsBeforeKill = await enginePids();
  check(pidsBeforeKill.length === 1, `expected one engine before kill, got [${pidsBeforeKill.join(', ')}]`);
  await execFileAsync('taskkill', ['/PID', String(pidsBeforeKill[0]), '/F', '/T']);
  const deathDeadline = Date.now() + 15000;
  let statusAfterKill = null;
  while (Date.now() < deathDeadline) {
    await sleep(1000);
    statusAfterKill = await modelStatus(stack, MODEL_ID);
    if (statusAfterKill.entry?.status !== 'running') break;
  }
  check(statusAfterKill?.entry?.status !== 'running', 'status must drop running after the engine dies');
  const readyAfterKill = await probeReady(stack, MODEL_ID);
  check(readyAfterKill.ready === false, 'ready must be false after the engine dies');
  record('L_external_death_truth', { killed_pid: pidsBeforeKill[0], status_after: statusAfterKill?.entry?.status, ready_after: readyAfterKill });

  // M. Occupied endpoint: the engine's own port is squatted by a foreign
  // server; the governed start must relocate instead of squatting or failing.
  const beforeSquat = await modelStatus(stack, MODEL_ID);
  const occupiedPort = Number(new URL(beforeSquat.entry.endpoint).port);
  const squatter = await startOccupyingServer(occupiedPort);
  try {
    const started3 = await approvedJson(stack, { method: 'POST', path: '/api/models/start', body: { id: MODEL_ID }, signalMs: 240000 });
    check(started3.status === 200, `occupied-port start http ${started3.status}: ${JSON.stringify(started3.body).slice(0, 200)}`);
    const ready3 = await waitReady(stack, MODEL_ID);
    check(ready3.ready === true, `occupied-port start not ready: ${JSON.stringify(ready3)}`);
    const relocated = new URL(envelopeData(started3.body, 'start3').endpoint);
    check(Number(relocated.port) !== occupiedPort, `endpoint must relocate from the occupied ${occupiedPort}, got ${relocated.port}`);
    const chat3 = await approvedJson(stack, { method: 'POST', path: '/api/chat', body: {
      modelId: MODEL_ID, messages: [{ role: 'user', content: 'Reply with exactly: RELOCATED' }], options: { maxTokens: 16, temperature: 0 }
    }, signalMs: 300000 });
    check(chat3.status === 200, `relocated chat http ${chat3.status}`);
    const chat3Data = envelopeData(chat3.body, 'chat3');
    check(typeof chat3Data.text === 'string' && chat3Data.text.trim().length > 0, 'relocated inference must return generated text');
    record('M_occupied_port_relocation', { occupied_port: occupiedPort, relocated_endpoint: relocated.href, chat: { tokens: chat3Data.tokens ?? null, timingMs: chat3Data.timingMs ?? null, text: chat3Data.text.slice(0, 200) } });
    const stopped3 = await approvedJson(stack, { method: 'POST', path: '/api/models/stop', body: { id: MODEL_ID }, signalMs: 120000 });
    check(stopped3.status === 200, `relocated stop http ${stopped3.status}`);
  } finally {
    await new Promise(resolve => squatter.close(() => resolve()));
  }
  await sleep(1500);
  const pidsFinal = await enginePids();
  check(pidsFinal.length === 0, `no engine may remain after the gate, found [${pidsFinal.join(', ')}]`);
  record('N_final_hygiene', { engine_pids: pidsFinal, verdict: 'no orphans' });

  evidence.ok = evidence.failures.length === 0;
  evidence.finished_at = new Date().toISOString();
  console.log('[gate] EVIDENCE');
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = evidence.ok ? 0 : 1;
} catch (error) {
  evidence.ok = false;
  evidence.error = error instanceof Error ? error.message : String(error);
  evidence.finished_at = new Date().toISOString();
  console.error('[gate] FAILED:', evidence.error);
  console.log('[gate] EVIDENCE');
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = 1;
} finally {
  await safeStop(MODEL_ID).catch(() => {});
  if (stack !== null) await stack.close().catch(() => {});
  await sleep(1000);
  const leftover = await enginePids().catch(() => []);
  if (leftover.length > 0) {
    console.error(`[gate] WARNING: engine processes still alive after cleanup: [${leftover.join(', ')}]`);
    for (const pid of leftover) await execFileAsync('taskkill', ['/PID', String(pid), '/F', '/T']).catch(() => {});
  }
  if (!KEEP) {
    await cleanupGateState();
    console.log('[gate] artifacts cleaned (pass --keep to retain the imported model)');
  } else {
    console.log('[gate] artifacts retained (--keep)');
  }
}
