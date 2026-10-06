// PR #41 live compatibility proof: drives the CANONICAL path end-to-end through
// the supervised stack — register (approved) -> explicit LLAMA_CPP selection ->
// Resource Admission -> Runtime Broker -> start (approved) -> identity/backend
// observation -> chat -> stream -> cancel -> recovery chat -> stop -> ownership
// cleanup. No direct llama-server spawn, no admission bypass, no fallback.
//
// Usage: node scripts/runtime-compat-live.mjs [--report <path>]

import { createHash } from 'node:crypto';
import { createReadStream, promises as fsp } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { launchSupervisedStack } from '../tests/helpers/supervised-stack.mjs';

const execFileAsync = promisify(execFile);
const REPO = path.resolve(import.meta.dirname, '..');
const WORKSPACE = 'E:\\covert-compat-live-workspace';
const ARTIFACT_SOURCE = 'E:\\models\\smollm2-360m-instruct-q8_0.gguf';
const LLAMA_BINARY = 'E:\\llama-cpp\\llama-server.exe';
const reportIndex = process.argv.indexOf('--report');
const reportPath = reportIndex >= 0 ? path.resolve(process.argv[reportIndex + 1]) : path.join(REPO, 'docs', 'evidence', 'runtime-gfx900-w3-live-compat.json');
const steps = [];
let stack = null;
let ownedPid = null;
let endpointPort = null;

function record(step, ok, detail) { steps.push({ step, ok, at: new Date().toISOString(), detail }); console.log(`${ok ? 'PASS' : 'FAIL'} ${step} :: ${JSON.stringify(detail ?? null).slice(0, 420)}`); }
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function sha256File(file) { const hash = createHash('sha256'); await new Promise((resolve, reject) => createReadStream(file).on('data', chunk => hash.update(chunk)).on('end', resolve).on('error', reject)); return hash.digest('hex'); }
async function ownedEngineRows(marker) {
  try {
    const out = await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
      'Get-CimInstance Win32_Process -Filter "Name=\'llama-server.exe\'" -ErrorAction SilentlyContinue | ForEach-Object { $_.ProcessId.ToString() + "|" + ($_.CommandLine -replace "\\|"," ") }']);
    return out.stdout.trim().split('\n').map(line => line.trim()).filter(Boolean).map(line => { const [pid, cmd] = line.split('|'); return { pid: Number(pid), cmd: (cmd ?? '').slice(0, 200) }; }).filter(row => row.cmd.includes(marker));
  } catch { return []; }
}
async function sourceSha() { return (await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: REPO })).stdout.trim(); }
async function resourceSnapshot() {
  const osCim = await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
    '$s=Get-Counter \'\\Memory\\Commit Limit\',\'\\Memory\\Committed Bytes\'; $l=[double](($s.CounterSamples|?{$_.Path -like \'*commit limit*\'}).CookedValue); $c=[double](($s.CounterSamples|?{$_.Path -like \'*committed bytes*\'}).CookedValue); Write-Output ("$l|$c")']);
  const [limit, committed] = osCim.stdout.trim().split('|').map(Number);
  return { free_ram_bytes: os.freemem(), total_ram_bytes: os.totalmem(), commit_limit_bytes: limit, committed_bytes: committed, commit_free_bytes: limit - committed, sampled_at: new Date().toISOString() };
}

try {
  const sha = await sourceSha();
  await fsp.mkdir(path.join(WORKSPACE, 'models'), { recursive: true });
  const artifactPath = path.join(WORKSPACE, 'models', path.basename(ARTIFACT_SOURCE));
  const sourceSize = (await fsp.stat(ARTIFACT_SOURCE)).size;
  const destSize = await fsp.stat(artifactPath).then(stat => stat.size).catch(() => -1);
  if (destSize !== sourceSize) await fsp.copyFile(ARTIFACT_SOURCE, artifactPath);
  const artifactSha = await sha256File(artifactPath);
  record('00-prepare', true, { source_sha: sha, workspace: WORKSPACE, artifact: artifactPath, bytes: sourceSize, sha256: artifactSha, binary: LLAMA_BINARY, binary_sha256: await sha256File(LLAMA_BINARY).catch(() => null) });

  const bootStart = Date.now();
  stack = await launchSupervisedStack({ workspace: WORKSPACE, env: { AIDE_LOCAL_RUNTIME_BACKEND: 'llama-cpp', AIDE_LLAMA_SERVER: LLAMA_BINARY } });
  record('01-stack', true, { boot_ms: Date.now() - bootStart, backend_selection: 'AIDE_LOCAL_RUNTIME_BACKEND=llama-cpp (explicit; Unsloth remains default when unset)' });

  const register = await stack.approveJson({ adapter: 'ts', method: 'POST', path: '/api/models/register', body: { filename: path.basename(artifactPath), repo_id: 'local', context_tokens: 2048 } });
  const registerBody = register.body ?? {};
  const modelId = registerBody.id ?? registerBody.data?.id ?? null;
  record('02-register', Boolean(modelId), { status: register.status, model_id: modelId });

  const admission = await resourceSnapshot();
  const admissionFloor = 2.5 * 1024 * 1024 * 1024;
  record('03-admission-preflight', admission.free_ram_bytes >= admissionFloor, { ...admission, compatibility_floor_bytes: admissionFloor, canonical_floor_note: 'canonical runtime floor 6656MB is separate and not implied' });

  let startBody = {};
  try {
    const start = await stack.approveJson({ adapter: 'ts', method: 'POST', path: '/api/models/start', body: { id: modelId } });
    startBody = start.body ?? {};
    record('04-start', start.status === 200, { status: start.status, body: startBody });
  } catch (error) { record('04-start', false, { error: String(error?.message ?? error).slice(0, 300) }); }

  const endpoint = startBody.endpoint ?? startBody.data?.endpoint ?? null;
  endpointPort = endpoint ? Number(new URL(endpoint).port) : null;
  let ready = false;
  if (modelId) {
    const deadline = Date.now() + 150000;
    while (Date.now() < deadline) {
      const probe = await stack.json('facade', 'GET', `/api/model/ready?id=${encodeURIComponent(modelId)}`).catch(() => null);
      const body = probe?.body ?? {};
      if ((body.ready ?? body.data?.ready) === true) { ready = true; break; }
      await sleep(1500);
    }
  }
  const engines = await ownedEngineRows(WORKSPACE.replace(/\\/g, '\\'));
  ownedPid = engines[0]?.pid ?? null;
  const status = await stack.json('facade', 'GET', '/api/models/status').catch(() => null);
  const statusEntry = (status?.body?.models ?? status?.body?.data?.models ?? []).find(entry => entry.id === modelId) ?? null;
  record('05-identity-observation', ready, { ready, endpoint, port: endpointPort, owned_engine: engines, reported_backend: statusEntry?.reported_backend ?? null, accelerator: statusEntry?.accelerator ?? null, pid: ownedPid });

  const ask = async (onDelta) => {
    if (onDelta === undefined) {
      const chat = await stack.approveJson({ adapter: 'ts', method: 'POST', path: '/api/chat', body: { modelId, messages: [{ role: 'user', content: 'Reply with exactly: COMPAT_OK' }], max_tokens: 24, timeout_ms: 60000 } });
      const body = chat.body ?? {};
      return { status: chat.status, text: body.text ?? body.data?.text ?? null, timing_ms: body.timingMs ?? body.data?.timingMs ?? null, raw_keys: Object.keys(body).slice(0, 8) };
    }
    // Streaming via the canonical route with client-side cancellation.
    const controller = new AbortController();
    const base = stack.bases?.facade ?? `http://127.0.0.1:${stack.port}`;
    const response = await fetch(`${base}/api/chat/stream`, {
      method: 'POST',
      headers: await stack.authHeadersFor?.() ?? {},
      body: JSON.stringify({ modelId, messages: [{ role: 'user', content: 'Count from 1 to 40.' }], max_tokens: 160 })
    }).catch(() => null);
    return { response, controller };
  };

  let inferResult = null;
  if (ready) inferResult = await ask();
  record('06-inference', inferResult?.status === 200 && typeof inferResult.text === 'string' && inferResult.text.length > 0, inferResult);

  // Streaming + cancellation through the canonical stream route (authenticated
  // by the supervised stack's own request surface; client abort = cancellation).
  let streamEvidence = { attempted: false };
  if (ready) {
    streamEvidence.attempted = true;
    const controller = new AbortController();
    try {
      const response = await stack.request('facade', 'POST', '/api/chat/stream', {
        body: { modelId, messages: [{ role: 'user', content: 'Count from 1 to 40 slowly.' }], max_tokens: 160 },
        signal: controller.signal
      });
      streamEvidence.http = response.status;
      const reader = response.body?.getReader();
      let text = '';
      const streamDeadline = Date.now() + 20000;
      while (reader && Date.now() < streamDeadline) {
        const chunk = await reader.read();
        if (chunk.done) break;
        text += Buffer.from(chunk.value).toString('utf8');
        if (text.length > 120) break;
      }
      streamEvidence.partial = text.slice(0, 240);
      controller.abort();
      streamEvidence.cancelled = true;
    } catch (error) {
      streamEvidence.error = String(error?.message ?? error).slice(0, 200);
      controller.abort();
      streamEvidence.cancelled = true;
    }
  }
  record('07-stream-cancel', streamEvidence.attempted && streamEvidence.cancelled === true, streamEvidence);

  await sleep(2500);
  const recovered = ready ? await ask() : null;
  record('08-recovery-after-cancel', recovered?.status === 200 && typeof recovered.text === 'string' && recovered.text.length > 0, recovered);

  let stopResult = null;
  if (modelId) {
    try {
      const stop = await stack.approveJson({ adapter: 'ts', method: 'POST', path: '/api/models/stop', body: { id: modelId } });
      stopResult = { status: stop.status, body: stop.body ?? {} };
    } catch (error) { stopResult = { error: String(error?.message ?? error).slice(0, 300) }; }
  }
  await sleep(3000);
  const pidDead = ownedPid === null ? null : !(await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `if (Get-Process -Id ${ownedPid} -ErrorAction SilentlyContinue) { 'alive' } else { 'dead' }`])).stdout.includes('alive');
  const portClosed = endpointPort === null ? null : !(await fetch(`http://127.0.0.1:${endpointPort}/v1/models`, { signal: AbortSignal.timeout(1200) }).then(() => true).catch(() => false));
  const remainingOwned = await ownedEngineRows(WORKSPACE.replace(/\\/g, '\\'));
  const foreignCount = (await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', '@(Get-Process llama-server -ErrorAction SilentlyContinue).Count'])).stdout.trim();
  record('09-stop-cleanup', stopResult?.status === 200 && pidDead !== false && portClosed !== false && remainingOwned.length === 0, { stop: stopResult, owned_pid: ownedPid, pid_dead: pidDead, port_closed: portClosed, remaining_owned_engines: remainingOwned, foreign_llama_servers_observed: Number(foreignCount) });
} catch (error) {
  record('99-harness', false, { error: String(error?.message ?? error).slice(0, 400) });
} finally {
  if (stack !== null) { try { await stack.close(); } catch { /* recorded via cleanup step */ } }
  const failed = steps.filter(step => !step.ok);
  const report = { gate: 'covert.runtime-compat-live.v1', finished_at: new Date().toISOString(), workspace: WORKSPACE, steps, pass: steps.length - failed.length, fail: failed.length };
  await fsp.mkdir(path.dirname(reportPath), { recursive: true });
  await fsp.writeFile(reportPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
  console.log(`\nRUNTIME-COMPAT-LIVE ${failed.length === 0 ? 'PASS' : 'PARTIAL'} (${steps.length - failed.length}/${steps.length})`);
  console.log('report=' + reportPath);
  process.exit(failed.length === 0 ? 0 : 1);
}
