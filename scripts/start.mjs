import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { createReadStream, promises as fs, mkdirSync, openSync, closeSync, appendFileSync } from 'node:fs';
import { userInfo } from 'node:os';
import path from 'node:path';
import { execFile, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline';
import { superviseAuthority } from '../common/security/authority-channel.mjs';

const modulePath = fileURLToPath(import.meta.url);
const defaultRoot = path.resolve(path.dirname(modulePath), '..');
const MIME_TYPES = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.map', 'application/json; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.wasm', 'application/wasm'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2']
]);

export function resolveFrontend(argv = process.argv.slice(2), root = defaultRoot) {
  const selectors = argv.filter(arg => arg.startsWith('--frontend='));
  if (selectors.length > 1) throw new Error('frontend may be selected only once');
  const kind = selectors[0]?.slice('--frontend='.length) || 'typed';
  if (kind === 'typed') return { kind, root: path.join(root, 'browser', 'dist'), spa: true };
  if (kind === 'legacy') return { kind, root, spa: false };
  if (kind === 'vite') return { kind, root: path.join(root, 'browser'), spa: true };
  throw new Error(`unsupported frontend: ${kind}`);
}

function containedPath(root, pathname) {
  const candidate = path.resolve(root, pathname);
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative)) ? candidate : null;
}

async function existingFile(candidate) {
  try {
    const stat = await fs.stat(candidate);
    return stat.isFile() ? candidate : null;
  } catch {
    return null;
  }
}

export async function createFrontendServer({ frontend, host = '127.0.0.1', port = 4173 }) {
  if (frontend.kind === 'vite') throw new Error('Vite owns its own development server');
  const indexPath = path.join(frontend.root, 'index.html');
  if (!(await existingFile(indexPath))) {
    const label = frontend.kind === 'typed' ? 'typed frontend build' : 'legacy frontend';
    throw new Error(`${label} is missing at ${indexPath}${frontend.kind === 'typed' ? '; run npm run build:frontend or npm start' : ''}`);
  }

  const server = http.createServer(async (request, response) => {
    let pathname;
    try { pathname = decodeURIComponent(new URL(request.url || '/', 'http://localhost').pathname); }
    catch { response.writeHead(400).end('Bad request'); return; }
    if (pathname.includes('\0')) { response.writeHead(400).end('Bad request'); return; }
    if (pathname === '/api' || pathname.startsWith('/api/') || pathname === '/ws') {
      response.writeHead(421, { 'Content-Type': 'text/plain; charset=utf-8' }).end('API and WebSocket traffic belongs on the facade');
      return;
    }
    const requested = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    const candidate = containedPath(frontend.root, requested);
    if (candidate === null) { response.writeHead(403).end('Forbidden'); return; }
    let file = await existingFile(candidate);
    if (file === null && frontend.spa && (request.method === 'GET' || request.method === 'HEAD') && path.extname(pathname) === '') file = indexPath;
    if (file === null) { response.writeHead(404).end('Not found'); return; }
    response.writeHead(200, { 'Content-Type': MIME_TYPES.get(path.extname(file).toLowerCase()) || 'application/octet-stream' });
    if (request.method === 'HEAD') response.end();
    else createReadStream(file).pipe(response);
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => { server.off('error', reject); resolve(); });
  });
  return {
    server,
    close: () => new Promise(resolve => {
      server.closeAllConnections?.();
      server.close(() => resolve());
    })
  };
}

async function launchTrustedLocalBrowser({ origin, session, generation, evidenceDir }) {
  mkdirSync(evidenceDir, { recursive: true });
  const { chromium } = await import('@playwright/test');
  // Playwright launches an isolated browser context and controls Chromium over
  // its private process pipe; no remote-debugging TCP port or token URL exists.
  const browser = await chromium.launch({ channel: process.platform === 'win32' ? 'msedge' : 'chrome', headless: false });
  try {
    const context = await browser.newContext();
    await context.addInitScript(({ expectedOrigin, localSession }) => {
      if (location.origin === expectedOrigin) {
        Object.defineProperty(window, '__COVERT_LOCAL_OPERATOR_EXPECTED__', { value: true, configurable: true });
        Object.defineProperty(window, '__COVERT_LOCAL_OPERATOR_SESSION__', { value: localSession, configurable: true });
      }
    }, { expectedOrigin: origin, localSession: session });
    const page = await context.newPage();
    const logFile = path.join(evidenceDir, `browser-${generation}.log`);
    const log = line => appendFileSync(logFile, `${new Date().toISOString()} ${line}\n`);
    const safeText = value => String(value).split(session.token).join('[redacted]').slice(0, 500);
    const safePath = value => {
      try { return new URL(value).pathname; } catch { return '(invalid-url)'; }
    };
    page.on('console', message => {
      if (message.type() === 'error' || message.type() === 'warning') log(`console ${message.type()}: ${safeText(message.text())}`);
    });
    page.on('pageerror', error => log(`pageerror: ${error.name}: ${safeText(error.message)}`));
    page.on('requestfailed', request => log(`request-failed ${request.method()} ${safePath(request.url())}: ${request.failure()?.errorText ?? 'unknown'}`));
    page.on('response', response => {
      if (response.status() >= 400) log(`response ${response.status()} ${safePath(response.url())}`);
    });
    page.on('dialog', dialog => {
      // Keep the governed Authority prompt visible for the operator. The local
      // bootstrap authenticates identity; it never accepts a capability action.
      if (dialog.type() === 'prompt') {
        log('unexpected-pairing-prompt: dismissed in trusted local browser to fail closed');
        void dialog.dismiss();
        return;
      }
      log(`dialog ${dialog.type()}: Authority decision awaiting operator input`);
    });
    log(`session-handoff=trusted-local origin=${new URL(origin).origin} credential=not-logged`);
    await page.goto(origin, { waitUntil: 'domcontentloaded' });
    let bootState = 'unknown';
    try {
      await page.waitForFunction(() => {
        const state = document.getElementById('app')?.dataset.bootState;
        return state === 'ready' || state === 'failed';
      }, null, { timeout: 30_000 });
      bootState = await page.locator('#app').getAttribute('data-boot-state') || 'unknown';
    } catch (error) {
      log(`boot-state-timeout: ${error instanceof Error ? error.name : 'unknown'}`);
    }
    const authorityState = await page.locator('#app').getAttribute('data-authority-state') || 'unknown';
    log(`frontend-state: boot=${bootState} authority=${authorityState}`);
    if (bootState === 'ready') {
      await page.screenshot({ path: path.join(evidenceDir, `local-operator-${generation}.png`), fullPage: true });
      await page.getByRole('button', { name: 'MODELS: Loaded lineup' }).click();
      await page.locator('#cockpit-models-stage .models-panel').waitFor({ state: 'visible', timeout: 15_000 });
      await page.screenshot({ path: path.join(evidenceDir, `models-${generation}.png`), fullPage: true });
      const activePanel = await page.locator('#app').getAttribute('data-active-panel') || 'unknown';
      log(`launch-proof: boot=${bootState} authority=${authorityState} active-panel=${activePanel}`);
    } else {
      log(`launch-proof: frontend boot state=${bootState}`);
      await page.screenshot({ path: path.join(evidenceDir, `startup-state-${generation}.png`), fullPage: true }).catch(() => {});
    }
    return { browser, close: () => browser.isConnected() ? browser.close() : Promise.resolve(), bootState };
  } catch (error) {
    await browser.close().catch(() => {});
    throw error;
  }
}

function wait(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

async function waitForHttp(label, url, child, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let last = 'not reachable';
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`${label} exited before readiness (code ${child.exitCode})`);
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1000) });
      if (response.ok) return;
      last = `HTTP ${response.status}`;
    } catch (error) {
      last = error instanceof Error ? error.message : String(error);
    }
    await wait(200);
  }
  throw new Error(`${label} did not become ready at ${url}: ${last}`);
}

function processGroupExists(groupId) {
  try {
    process.kill(-groupId, 0);
    return true;
  } catch (error) {
    return error?.code !== 'ESRCH';
  }
}

async function waitForOwnedTree(child, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const childExited = child.exitCode !== null || child.signalCode !== null;
    const groupExists = process.platform !== 'win32' && child.pid !== undefined && processGroupExists(child.pid);
    if (childExited && !groupExists) return true;
    await wait(100);
  }
  const childExited = child.exitCode !== null || child.signalCode !== null;
  if (process.platform === 'win32') return childExited;
  return childExited && (child.pid === undefined || !processGroupExists(child.pid));
}

async function terminateTree(child) {
  const childExited = child.exitCode !== null || child.signalCode !== null;
  if (child.pid === undefined) return childExited ? null : 'child pid unavailable';
  if (childExited && (process.platform === 'win32' || !processGroupExists(child.pid))) return null;

  if (process.platform === 'win32') {
    const result = await new Promise(resolve => {
      execFile('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true }, (error, _stdout, stderr) => {
        resolve({ error: error?.message ?? null, stderr: String(stderr ?? '').trim() });
      });
    });
    if (await waitForOwnedTree(child)) return null;
    return `owned process tree ${child.pid} did not exit after taskkill (${result.error ?? result.stderr ?? 'no error detail'})`;
  }

  let signalError = null;
  try { process.kill(-child.pid, 'SIGTERM'); }
  catch (error) {
    if (error?.code !== 'ESRCH') signalError = error instanceof Error ? error.message : String(error);
    try { child.kill('SIGTERM'); } catch (fallbackError) {
      if (fallbackError?.code !== 'ESRCH') signalError ??= fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
    }
  }
  if (await waitForOwnedTree(child)) return null;

  try { process.kill(-child.pid, 'SIGKILL'); }
  catch (error) {
    if (error?.code !== 'ESRCH') signalError ??= error instanceof Error ? error.message : String(error);
    try { child.kill('SIGKILL'); } catch (fallbackError) {
      if (fallbackError?.code !== 'ESRCH') signalError ??= fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
    }
  }
  if (await waitForOwnedTree(child)) return null;
  return `owned process group ${child.pid} did not exit after SIGTERM and SIGKILL${signalError ? ` (${signalError})` : ''}`;
}

// Windows only: discover the owning ancestor (terminal/IDE/cmd wrapper) by walking
// up the process tree, skipping the npm-node layer and the script-runner shell it
// spawns. This is the process whose death means the user closed the terminal or
// the launcher was killed.
async function getWindowsProcessInfo(pid) {
  return new Promise(resolve => {
    execFile('powershell.exe', ['-NoProfile', '-Command', `Get-CimInstance Win32_Process -Filter "ProcessId = ${pid}" | Select-Object Name, ParentProcessId, CommandLine | ConvertTo-Json -Compress`], { windowsHide: true }, (err, stdout) => {
      if (err) return resolve(null);
      try {
        const data = JSON.parse(stdout);
        return resolve({ name: data.Name || '', ppid: Number(data.ParentProcessId) || 0, commandLine: data.CommandLine || '' });
      } catch {
        return resolve(null);
      }
    });
  });
}

async function findOwningAncestor() {
  if (process.platform !== 'win32') return null;
  const shellNames = new Set(['cmd.exe', 'powershell.exe', 'pwsh.exe']);
  const isNpmNode = info => info && info.name.toLowerCase() === 'node.exe' && /npm/i.test(info.commandLine || '');

  let current = process.pid;
  while (true) {
    const info = await getWindowsProcessInfo(current);
    if (!info) return null;
    const parent = info.ppid;
    if (!parent || parent <= 0) return null;
    const parentInfo = await getWindowsProcessInfo(parent);
    if (!parentInfo) return parent;

    if (isNpmNode(parentInfo)) {
      current = parent;
      continue;
    }

    if (shellNames.has(parentInfo.name.toLowerCase())) {
      const grandparentInfo = await getWindowsProcessInfo(parentInfo.ppid);
      if (isNpmNode(grandparentInfo)) {
        current = parent;
        continue;
      }
    }

    return parent;
  }
}

// Start a watch on the owning ancestor. On non-Windows or when discovery fails,
// fall back to the immediate parent process.
async function startOwnershipDeathWatch(onDeath) {
  const target = await findOwningAncestor();
  const ppid = target || process.ppid;
  if (!ppid || ppid <= 0) return null;
  return {
    target,
    timer: setInterval(() => {
      try {
        process.kill(ppid, 0);
      } catch {
        onDeath();
      }
    }, 1000)
  };
}

function shouldBuild(argv = process.argv.slice(2)) {
  return argv.includes('--build');
}

export async function run(argv = process.argv.slice(2), root = defaultRoot) {
  const frontend = resolveFrontend(argv, root);
  const buildRequested = shouldBuild(argv);
  const host = '127.0.0.1';
  const ports = {
    ui: Number(process.env.AIDE_UI_PORT || (frontend.kind === 'vite' ? 5173 : 4173)),
    facade: Number(process.env.AIDE_FACADE_PORT || 4777),
    arch: Number(process.env.AIDE_ARCH_PORT || 4778),
    legacy: Number(process.env.AIDE_LEGACY_PORT || process.env.AIDE_DAEMON_PORT || 4779)
  };
  const timeoutMs = Number(process.env.AIDE_START_TIMEOUT_MS || 30000);
  const runtimeGeneration = randomUUID();
  const runtimeOwner = userInfo().username;
  const workspace = path.resolve(process.env.AIDE_WORKSPACE || root);
  const logsDir = path.join(workspace, '.aide', 'logs');
  const children = new Map();
  let frontendServer = null;
  let buildChild = null;
  let parentWatch = null;
  let authoritySupervisor = null;
  let pairingConsole = null;
  let localBrowser = null;
  let stopping = false;
  let settle;
  const stopped = new Promise(resolve => { settle = resolve; });

  mkdirSync(logsDir, { recursive: true });

  const stop = async code => {
    if (stopping) return;
    stopping = true;
    const cleanupFailures = [];
    pairingConsole?.close();
    if (localBrowser) {
      try { await localBrowser.close(); }
      catch (error) { cleanupFailures.push(`trusted local browser: ${error instanceof Error ? error.message : 'close failed'}`); }
      localBrowser = null;
    }
    authoritySupervisor?.close();
    if (parentWatch) { clearInterval(parentWatch.timer); parentWatch = null; }
    if (buildChild && buildChild.exitCode === null && buildChild.pid !== undefined) {
      const failure = await terminateTree(buildChild);
      if (failure) cleanupFailures.push(`frontend build pid=${buildChild.pid}: ${failure}`);
      buildChild = null;
    }
    if (frontendServer) await frontendServer.close();
    const ownedChildren = [...children.entries()];
    const childResults = await Promise.all(ownedChildren.map(async ([label, child]) => ({
      label,
      pid: child.pid,
      failure: await terminateTree(child)
    })));
    for (const result of childResults) {
      if (result.failure) cleanupFailures.push(`${result.label} pid=${result.pid ?? 'unknown'}: ${result.failure}`);
    }
    if (cleanupFailures.length > 0) {
      code = 1;
      appendFileSync(path.join(logsDir, 'start-err.log'), `[start.mjs] owned child cleanup failed: ${cleanupFailures.join('; ')}\n`);
    }
    process.exitCode = code;
    settle();
  };

  const spawnChild = (label, args, extraEnv = {}) => {
    const outPath = path.join(logsDir, `${label}-out.log`);
    const errPath = path.join(logsDir, `${label}-err.log`);
    const out = openSync(outPath, 'a');
    const err = openSync(errPath, 'a');
    const child = spawn(process.execPath, args, {
      cwd: root,
      env: { ...process.env, AIDE_WORKSPACE: workspace, ...extraEnv },
      stdio: ['ignore', out, err, 'ipc'],
      detached: process.platform !== 'win32',
      windowsHide: true
    });
    closeSync(out);
    closeSync(err);
    children.set(label, child);
    child.once('error', error => {
      appendFileSync(errPath, `[start.mjs] ${label} spawn error: ${error.message}\n`);
      if (!stopping) void stop(1);
    });
    child.once('exit', code => {
      if (!stopping) {
        appendFileSync(errPath, `[start.mjs] ${label} exited code=${code ?? 'null'} at ${new Date().toISOString()}\n`);
        void stop(code === 0 ? 1 : (code ?? 1));
      }
    });
    return child;
  };

  process.once('SIGINT', () => void stop(0));
  process.once('SIGTERM', () => void stop(0));

  try {
    if (frontend.kind === 'typed' && buildRequested) {
      console.log('[start.mjs] building typed frontend...');
      buildChild = spawn(process.execPath, [path.join(root, 'node_modules', 'vite', 'bin', 'vite.js'), 'build', '--config', 'browser/vite.config.ts'], {
        cwd: root,
        env: process.env,
        stdio: 'inherit',
        detached: process.platform !== 'win32',
        windowsHide: true
      });
      const buildCode = await new Promise(resolve => buildChild.once('exit', code => resolve(code)));
      buildChild = null;
      if (stopping) return;
      if (buildCode !== 0) throw new Error(`frontend build failed with code ${buildCode}`);
    }

    if (stopping) return;

    if (frontend.kind === 'typed' || frontend.kind === 'legacy') frontendServer = await createFrontendServer({ frontend, host, port: ports.ui });

    const arch = spawnChild('arch', ['node/src/server.ts'], {
      AIDE_ARCH_PORT: String(ports.arch),
      AIDE_RUNTIME_GENERATION: runtimeGeneration,
      AIDE_RUNTIME_OWNER: runtimeOwner
    });
    authoritySupervisor = superviseAuthority(arch);
    const legacy = spawnChild('legacy', ['daemon/server.mjs'], { AIDE_DAEMON_PORT: String(ports.legacy), AIDE_LEGACY_PORT: String(ports.legacy) });
    authoritySupervisor.attach('legacy', legacy);
    await Promise.all([
      waitForHttp('TypeScript backend', `http://${host}:${ports.arch}/api/health`, arch, timeoutMs),
      waitForHttp('legacy backend', `http://${host}:${ports.legacy}/health`, legacy, timeoutMs)
    ]);
    const facade = spawnChild('facade', ['scripts/facade.mjs'], {
      AIDE_FACADE_PORT: String(ports.facade),
      AIDE_ARCH_PORT: String(ports.arch),
      AIDE_LEGACY_PORT: String(ports.legacy)
    });
    authoritySupervisor.attach('facade', facade);
    await waitForHttp('facade', `http://${host}:${ports.facade}/api/health`, facade, timeoutMs);

    if (frontend.kind === 'vite') {
      const vite = spawnChild('vite', ['node_modules/vite/bin/vite.js', '--config', 'browser/vite.config.ts', '--port', String(ports.ui), '--host', host]);
      await waitForHttp('Vite frontend', `http://${host}:${ports.ui}/`, vite, timeoutMs);
    }

    if (process.stdin.isTTY && process.stdout.isTTY) {
      const origin = `http://${host}:${ports.ui}`;
      const session = await authoritySupervisor.localOperatorSession(origin, runtimeGeneration, runtimeOwner);
      localBrowser = await launchTrustedLocalBrowser({ origin, session, generation: runtimeGeneration,
        evidenceDir: path.join(workspace, '.aide', 'evidence') });
    }

    const watch = await startOwnershipDeathWatch(() => {
      const label = parentWatch?.target ? `owning ancestor ${parentWatch.target}` : `parent ${process.ppid}`;
      appendFileSync(path.join(logsDir, 'start-err.log'), `[start.mjs] ${label} died; stopping owned stack\n`);
      void stop(0);
    });
    parentWatch = watch;

    console.log(`Covert frontend=${frontend.kind} ui=http://${host}:${ports.ui} facade=http://${host}:${ports.facade} pid=${process.pid}`);
    // Pairing secrets are written only to the attached interactive terminal,
    // never child logs, workspace files, environment variables or URLs.
    if (process.stdin.isTTY && process.stdout.isTTY) {
      pairingConsole = createInterface({ input: process.stdin, output: process.stdout });
      process.stdout.write('The Covert-launched local browser uses a private operator session. Type pair only for an unrecognized browser client.\n');
      pairingConsole.on('line', async line => {
        if (line.trim() !== 'pair' || stopping) return;
        try {
          const result = await authoritySupervisor.pairing(`http://${host}:${ports.ui}`);
          if (!stopping) process.stdout.write(`One-use pairing code (5 min): ${result.proof}\n`);
        } catch { process.stdout.write('Pairing unavailable; no authority granted.\n'); }
      });
    }
    await stopped;
  } catch (error) {
    console.error(`[start.mjs] ${error instanceof Error ? error.message : String(error)}`);
    await stop(1);
  } finally {
    if (parentWatch) { clearInterval(parentWatch.timer); parentWatch = null; }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === modulePath) await run();
