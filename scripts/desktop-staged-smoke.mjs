import { execFile, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { open, mkdtemp, rm } from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runtimeNode = path.join(root, 'desktop', 'resources', 'runtime', process.platform === 'win32' ? 'node.exe' : 'node');
const launcher = path.join(root, 'desktop', 'resources', 'stack-launcher.mjs');
if (!existsSync(launcher) || !existsSync(runtimeNode)) {
  console.log(`desktop staged smoke SKIPPED: staged resources absent (${path.dirname(launcher)}); run "node desktop/prepare.mjs" and stage stack-launcher.mjs first - the packaged-stack gate is enforced where the staged tree exists`);
  process.exit(0);
}

const workspace = await mkdtemp(path.join(os.tmpdir(), 'aide-staged-smoke-'));
const pairOrigin = process.platform === 'win32' ? 'http://tauri.localhost' : 'tauri://localhost';
const labels = ['arch', 'legacy', 'facade'];
const checks = [];
let diagnostic = '';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function allocatePorts(count) {
  const reservations = [];
  try {
    for (let i = 0; i < count; i++) {
      const server = net.createServer();
      await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', resolve);
      });
      reservations.push(server);
    }
    return reservations.map(server => server.address().port);
  } finally {
    await Promise.all(reservations.map(server => new Promise(resolve => server.close(resolve))));
  }
}

function canConnect(port) {
  return new Promise(resolve => {
    const socket = net.connect({ host: '127.0.0.1', port });
    socket.setTimeout(750);
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('error', () => resolve(false));
    socket.once('timeout', () => { socket.destroy(); resolve(true); });
  });
}

async function portsAreClosed(ports) {
  for (let attempt = 0; attempt < 10; attempt++) {
    const open = await Promise.all(ports.map(canConnect));
    if (open.every(isOpen => !isOpen)) return true;
    await sleep(200);
  }
  return false;
}

async function readTail(file, maxBytes = 8192) {
  let handle;
  try {
    handle = await open(file, 'r');
    const { size } = await handle.stat();
    const length = Math.min(size, maxBytes);
    const bytes = Buffer.alloc(length);
    await handle.read(bytes, 0, length, size - length);
    const prefix = size > length ? `[older log bytes omitted; showing last ${length} of ${size}]\n` : '';
    return `${prefix}${bytes.toString('utf8')}`;
  } catch (error) {
    if (error.code === 'ENOENT') return '(not created)';
    return `(unavailable: ${error.code || error.name})`;
  } finally {
    await handle?.close().catch(() => {});
  }
}

function redactDiagnostic(value) {
  return value
    .replaceAll(pairingProof || '\u0000', '[redacted-pairing-proof]')
    .replaceAll(sessionToken || '\u0000', '[redacted-session-token]')
    .replace(/COVERT_PAIRING_V1\s+\S+/g, 'COVERT_PAIRING_V1 [redacted]')
    .replace(/\bBearer\s+\S+/gi, 'Bearer [redacted]')
    .replace(/\bsk-[A-Za-z0-9_-]{12,}/g, '[redacted-key]')
    .replace(/((?:api[_-]?key|access[_-]?token|refresh[_-]?token)\s*[:=]\s*)[^\s"'&]+/gi, '$1[redacted]');
}

const [archPort, legacyPort, facadePort] = await allocatePorts(3);
const ports = [archPort, legacyPort, facadePort];
const child = spawn(runtimeNode, [launcher, '--native-bootstrap', `--pair-origin=${pairOrigin}`], {
  cwd: root,
  env: {
    ...process.env,
    AIDE_WORKSPACE: workspace,
    AIDE_MODEL_DIR: path.join(workspace, 'models'),
    AIDE_ARCH_PORT: String(archPort),
    AIDE_LEGACY_PORT: String(legacyPort),
    AIDE_DAEMON_PORT: String(legacyPort),
    AIDE_FACADE_PORT: String(facadePort),
    AIDE_LLAMA_SERVER: path.join(root, 'desktop', 'resources', 'runtime', process.platform === 'win32' ? 'llama-server.exe' : 'llama-server'),
    AIDE_CLOSED_LOOP: 'false'
  },
  detached: process.platform !== 'win32',
  shell: false,
  windowsHide: true,
  stdio: ['ignore', 'pipe', 'pipe']
});

let pairingObserved = false;
let pairingProof = null;
let sessionToken = null;
let stdoutPending = '';
let stderrTail = '';
let spawnError = null;
let closeResult = null;
const closePromise = new Promise(resolve => child.once('close', (code, signal) => {
  closeResult = { code, signal };
  resolve(closeResult);
}));

child.stdout.on('data', chunk => {
  stdoutPending += chunk.toString('utf8');
  const lines = stdoutPending.split(/\r?\n/);
  stdoutPending = lines.pop() || '';
  for (const line of lines) {
    const proofMatch = /^COVERT_PAIRING_V1 ([A-Za-z0-9_-]{43})$/.exec(line);
    if (proofMatch) {
      pairingObserved = true;
      pairingProof = proofMatch[1];
    }
    // The launcher sends this one-time proof over stdout to its native parent.
    // Keep only its presence and never display or write its contents.
    if (line.startsWith('COVERT_PAIRING_V1 ')) continue;
    if (line.trim()) diagnostic += `launcher stdout: ${redactDiagnostic(line).slice(0, 2000)}\n`;
  }
});
child.stderr.on('data', chunk => {
  stderrTail = (stderrTail + chunk.toString('utf8')).slice(-8192);
});
child.once('error', error => { spawnError = error; });

const alive = () => child.exitCode === null && child.signalCode === null;
const tryFetch = async url => {
  try {
    const res = await fetch(url);
    return { status: res.status, body: await res.text() };
  } catch {
    return { status: 0, body: '' };
  }
};

async function waitFor(url, attempts = 40) {
  for (let i = 0; i < attempts; i++) {
    if (!alive()) throw new Error('staged stack died early');
    const response = await tryFetch(url);
    if (response.status >= 200 && response.status < 500) return response;
    await sleep(500);
  }
  return tryFetch(url);
}

try {
  const health = await waitFor(`http://127.0.0.1:${facadePort}/api/health`);
  checks.push({ name: 'staged facade /api/health', pass: health.status === 200, detail: `${health.status} ${health.body.slice(0, 120)}` });

  const modelStatusUrl = `http://127.0.0.1:${facadePort}/api/models/status`;
  const unpairedModels = await tryFetch(modelStatusUrl);
  checks.push({ name: 'staged model route requires pairing', pass: unpairedModels.status === 403, detail: `${unpairedModels.status}` });
  if (!pairingObserved || !pairingProof) throw new Error('native-parent pairing proof missing or malformed');

  const pairResponse = await fetch(`http://127.0.0.1:${facadePort}/api/authority/pair`, {
    method: 'POST',
    headers: {
      Origin: pairOrigin,
      'Content-Type': 'application/json',
      'X-AIDE-API-Format': 'envelope-v1'
    },
    body: JSON.stringify({ proof: pairingProof })
  });
  const pairEnvelope = await pairResponse.json().catch(() => null);
  if (pairResponse.status === 200 && pairEnvelope?.ok === true && typeof pairEnvelope.data?.token === 'string') {
    sessionToken = pairEnvelope.data.token;
  }
  checks.push({ name: 'native-parent pairing exchange', pass: Boolean(sessionToken), detail: sessionToken ? 'paired; credential retained in memory only' : `rejected (HTTP ${pairResponse.status})` });
  if (!sessionToken) throw new Error(`native-parent pairing exchange rejected (HTTP ${pairResponse.status})`);

  const authorizedHeaders = { Origin: pairOrigin, Authorization: `Bearer ${sessionToken}` };
  const models = await fetch(modelStatusUrl, { headers: authorizedHeaders }).then(async response => ({ status: response.status, body: await response.text() }));
  let modelsOk = false;
  try {
    const parsed = JSON.parse(models.body);
    modelsOk = parsed && typeof parsed.runtime === 'boolean' && Array.isArray(parsed.models);
  } catch {}
  checks.push({ name: 'staged facade /api/models/status', pass: models.status === 200 && modelsOk, detail: `${models.status} schema=${modelsOk ? 'valid' : 'invalid'}` });

  const tsHealth = await fetch(`http://127.0.0.1:${facadePort}/api/health/ts`, { headers: authorizedHeaders }).then(async response => ({ status: response.status, body: await response.text() }));
  checks.push({ name: 'staged facade /api/health/ts sentinel', pass: tsHealth.status === 200 && tsHealth.body.includes('ok'), detail: `${tsHealth.status} ${tsHealth.body.slice(0, 80)}` });

  const legacyProbe = await fetch(`http://127.0.0.1:${facadePort}/api/diagnostics`, { headers: authorizedHeaders }).then(async response => ({ status: response.status, body: await response.text() }));
  checks.push({ name: 'staged legacy route through facade', pass: legacyProbe.status === 200, detail: `${legacyProbe.status}` });

  const archProbe = await fetch(`http://127.0.0.1:${archPort}/api/health`, { headers: authorizedHeaders }).then(async response => ({ status: response.status, body: await response.text() }));
  checks.push({ name: 'staged arch route reachable', pass: archProbe.status === 200, detail: `${archProbe.status}` });

  const unknown = await fetch(`http://127.0.0.1:${facadePort}/api/does-not-exist`, { headers: authorizedHeaders }).then(response => ({ status: response.status }));
  checks.push({ name: 'facade unknown /api route', pass: unknown.status === 404, detail: `${unknown.status}` });
  checks.push({ name: 'native-parent pairing proof received', pass: pairingObserved, detail: pairingObserved ? 'valid one-time proof received; value redacted' : 'proof missing or malformed' });
} catch (error) {
  checks.push({ name: 'staged stack boot', pass: false, detail: error.message });
}

async function stopLauncher() {
  if (alive()) {
    if (process.platform === 'win32' && child.pid) {
      try {
        await execFileAsync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true });
      } catch {
        if (alive()) child.kill();
      }
    } else if (child.pid) {
      try { process.kill(-child.pid, 'SIGTERM'); } catch { child.kill('SIGTERM'); }
    }
  }
  let timer;
  const closed = closeResult || await Promise.race([
    closePromise,
    new Promise(resolve => { timer = setTimeout(() => resolve(null), 5000); })
  ]);
  clearTimeout(timer);
  if (!closed && process.platform !== 'win32' && child.pid) {
    try { process.kill(-child.pid, 'SIGKILL'); } catch { child.kill('SIGKILL'); }
    let forceTimer;
    const forcedClose = await Promise.race([
      closePromise,
      new Promise(resolve => { forceTimer = setTimeout(() => resolve(null), 5000); })
    ]);
    clearTimeout(forceTimer);
    return forcedClose;
  }
  return closed;
}

const stopped = await stopLauncher();
const listenersClosed = await portsAreClosed(ports);
const processClean = Boolean(stopped && listenersClosed);
checks.push({
  name: 'staged process and listener cleanup',
  pass: processClean,
  detail: `launcher pid=${child.pid ?? 'unavailable'} ${stopped ? `closed after expected test shutdown (${stopped.code ?? 'null'}/${stopped.signal || 'none'})` : 'still running'} ports=${ports.join(',')} listeners=${listenersClosed ? 'closed' : 'still reachable'}`
});

if (!checks.every(check => check.pass)) {
  const logDirectory = path.join(workspace, '.aide', 'logs');
  const logReports = await Promise.all(labels.flatMap(label => [
    readTail(path.join(logDirectory, `desktop-${label}-out.log`)).then(value => [`${label} stdout`, value]),
    readTail(path.join(logDirectory, `desktop-${label}-err.log`)).then(value => [`${label} stderr`, value])
  ]));
  const launcherError = spawnError ? `launcher spawn error: ${spawnError.message}\n` : '';
  const stderr = stderrTail ? `launcher stderr:\n${redactDiagnostic(stderrTail)}\n` : '';
  const childLogs = logReports.map(([name, value]) => `${name}:\n${redactDiagnostic(value)}`).join('\n');
  console.error(`staged smoke diagnostics: pid=${child.pid ?? 'unavailable'} ports=${ports.join(',')} stagedRoot=${path.dirname(launcher)} workspace=${workspace}\n${launcherError}${diagnostic}${stderr}${childLogs}`);
}

if (processClean) {
  await rm(workspace, { recursive: true, force: true });
} else {
  console.error(`staged smoke workspace retained for process diagnosis: ${workspace}`);
}

for (const check of checks) {
  console.log(`${check.pass ? 'PASS' : 'FAIL'}  ${check.name}: ${check.detail}`);
}
const passed = checks.length > 0 && checks.every(check => check.pass);
console.log(passed ? 'staged stack smoke PASSED' : 'staged stack smoke FAILED');
process.exitCode = passed ? 0 : 1;
