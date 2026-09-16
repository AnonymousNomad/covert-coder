import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, preview } from 'vite';
import { chromium } from '@playwright/test';
import { WebSocketServer } from 'ws';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = 0;
const facadePort = 0;
const edgeProfile = mkdtempSync(path.join(tmpdir(), 'aide-cockpit-edge-'));
const bootTimeoutMs = Number.parseInt(process.env.AIDE_COCKPIT_BOOT_TIMEOUT_MS ?? '60000', 10);

const modelStatus = {
  runtime: true,
  models: [
    { id: 'model-a', name: 'Local Planner', status: 'ready', declared_status: 'ready', endpoint: 'http://127.0.0.1:8085', runtime_available: true, artifact_available: true, setup_required: false },
    { id: 'model-b', name: 'Local Unassigned', status: 'stopped', declared_status: 'stopped', endpoint: '', runtime_available: true, artifact_available: true, setup_required: false }
  ]
};

const routes = {
  routes: [
    { id: 'local:model-a', displayName: 'Local Planner', providerType: 'local', baseUrl: 'http://127.0.0.1:8085', modelString: 'model-a', contextLength: 4096, chatTemplate: 'chatml', status: 'ready', probeMs: 2, roles: ['planner'], capabilities: ['chat'] }
  ]
};

const workspace = {
  workspace: 'E:\\aide-sovereign-workbench',
  entries: [
    { name: 'browser', kind: 'directory' },
    { name: 'README.md', kind: 'file' },
    { name: 'package.json', kind: 'file' }
  ]
};

const task = {
  label: 'test',
  type: 'shell',
  command: 'npm',
  args: ['test'],
  group: 'test',
  source: 'detected'
};

const fixtures = {
  '/api/health': { version: 'fixture', uptimeMs: 1000, workspace: workspace.workspace, freeMemoryMB: 4096 },
  '/api/session': { version: 1, tabs: [] },
  '/api/workspace': workspace,
  '/api/lsp/status': { servers: [{ languageId: 'typescript', name: 'fixture-lsp', status: 'available' }] },
  '/api/models/status': modelStatus,
  '/api/models/routes': routes,
  '/api/hardware/profile': { totalRamBytes: 16 * 1024 ** 3, freeRamBytes: 8 * 1024 ** 3, logicalCpus: 12, vramBytes: 0, freeVramBytes: 0, vramSource: 'none', tier: 'M', backend: 'cpu', detectedAt: 1 },
  '/api/tasks': { fileFound: true, filePath: 'package.json', detectedFrom: null, tasks: [task] },
  '/api/tasks/status': { jobs: [{ job_id: 'fixture-failed-job', label: 'fixture failure', command: 'npm', args: ['test'], status: 'failed', exitCode: 1, startedAt: 1, endedAt: 2 }] },
  '/api/audit/events': { events: [{ type: 'agent.message', summary: 'fixture-backed audit evidence', ok: true }], count: 1, known_types: ['agent.message'] },
  '/api/resident/summary': {
    summary: {
      generated_at: 1, status: 'ready', projectType: 'typescript', workspace: workspace.workspace, nodeVersion: 'v20',
      git: { git_repo: true, branch: 'covert-production', upstream: 'origin/covert-production', ahead: 0, behind: 0, changes: 0, conflicts: 0, clean: true },
      lsp: { available: true, servers: [{ languageId: 'typescript', status: 'available' }] },
      model: { runtime_available: true, running: false, ready_count: 1, artifact_available: true },
      deps: { has_manifest: true, dependencies: 1, dev_dependencies: 1, has_lockfile: true, action: null },
      hasTestScript: true, conditions: [], recommendation: 'Workspace is ready for operator review.', workflow: null
    }
  },
  '/api/resident/context': {
    context: {
      generated_at: 1, projectType: 'typescript', workspace: workspace.workspace, git_status: 'clean', changed_files: [], diagnostics: [], conditions: [], workflows_available: [], model_status: 'one ready model', approx_tokens: 12
    }
  },
  '/api/resident/push-summary': {
    push: { repo: true, branch: 'covert-production', ahead: 0, behind: 0, changed_files: [], changed_count: 0, staged_count: 0, diagnostics_errors: 0, test_script_present: true, risky_changes: [], generated_artifacts: [], verdict: 'READY', reasons: [] }
  },
  '/api/resident/decisions': { decisions: [] },
  '/api/byok/status': { providers: [], routing: { plan: 'local', act: 'local', utility: 'local' }, consent_enabled: false },
  '/api/providers': { providers: [] },
  '/api/workbenches': { workbenches: [] },
  '/api/closed-loop/status': { enabled: false, last_run_logged_at: null, signal_file_count: 0, bus_event_count: 0 },
  '/api/chat/history': { conversations: [] }
};

function envelope(data) {
  return JSON.stringify({ ok: true, data });
}

async function fulfillApi(route) {
  const url = new URL(route.request().url());
  if (url.pathname === '/api/authority/pair') {
    await route.fulfill({ status: 200, contentType: 'application/json', body: envelope({ token: 'fixture-token-012345678901234567890123', actor_id: 'fixture-operator', expires_at: Date.now() + 600000 }) });
    return;
  }
  if (url.pathname === '/api/session' && route.request().method() === 'PUT') {
    await route.fulfill({ status: 200, contentType: 'application/json', body: envelope({ version: 1, tabs: [] }) });
    return;
  }
  if (url.pathname === '/api/audit/events' && url.searchParams.get('type') === 'agent.verification') {
    await route.fulfill({ status: 200, contentType: 'application/json', body: envelope({ events: [], count: 0, known_types: [] }) });
    return;
  }
  const data = fixtures[url.pathname] ?? {};
  await route.fulfill({ status: 200, contentType: 'application/json', body: envelope(data) });
}

async function clickDestination(page, id) {
  await page.locator(`.cockpit-rail-item[data-item-id="${id}"]`).click();
  await page.waitForTimeout(80);
  assert.equal(await page.locator('#app').getAttribute('data-active-panel'), id, `${id} did not resolve through the cockpit registry`);
}

async function waitForVite(url, timeoutMs) {
  const started = Date.now();
  let lastError = 'no response';
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (response.ok) return;
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Vite did not become ready at ${url} within ${timeoutMs}ms (${lastError})`);
}

async function captureBootDiagnostics(page, events, cause) {
  let dom = null;
  try {
    dom = await page.evaluate(() => ({
      url: location.href,
      readyState: document.readyState,
      title: document.title,
      appHtml: document.querySelector('#app')?.innerHTML.slice(0, 4000) ?? null,
      appActivePanel: document.querySelector('#app')?.getAttribute('data-active-panel') ?? null,
      scriptSources: Array.from(document.scripts).map(script => script.src),
      bodyText: document.body.innerText.slice(0, 2000)
    }));
  } catch (error) {
    dom = { evaluateError: error instanceof Error ? error.message : String(error) };
  }
  const reportPath = process.env.AIDE_COCKPIT_DIAGNOSTICS_PATH
    ?? path.join(tmpdir(), `aide-cockpit-acceptance-${process.pid}.json`);
  const report = {
    generatedAt: new Date().toISOString(),
    cause: cause instanceof Error ? cause.stack ?? cause.message : String(cause),
    bootTimeoutMs,
    dom,
    events
  };
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.error(`[cockpit-acceptance] BOOT_DIAGNOSTICS=${reportPath}`);
  console.error(`[cockpit-acceptance] BOOT_DOM=${JSON.stringify(dom)}`);
  console.error(`[cockpit-acceptance] BOOT_EVENTS=${JSON.stringify(events)}`);
}

async function removeEdgeProfile(profile) {
  const retryableCodes = new Set(['EPERM', 'EBUSY', 'ENOTEMPTY']);
  const attempts = 24;
  let lastError;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      rmSync(profile, { recursive: true, force: true });
      return;
    } catch (error) {
      lastError = error;
      const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
      if (!retryableCodes.has(code) || attempt === attempts - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 250));
    }
  }

  throw lastError;
}

const viteConfig = path.join(repo, 'browser', 'vite.config.ts');
await build({ configFile: viteConfig });
const wsServer = new WebSocketServer({ host: '127.0.0.1', port: facadePort, path: '/ws' });
wsServer.on('connection', socket => {
  socket.on('message', raw => {
    try {
      const message = JSON.parse(String(raw));
      if (message?.type === 'authenticate') socket.send(JSON.stringify({ type: 'authenticated' }));
    } catch {
      // The frontend ignores malformed event frames; the fixture does the same.
    }
  });
});
await new Promise((resolve, reject) => {
  wsServer.once('listening', resolve);
  wsServer.once('error', reject);
});
let context;
let server;
try {
  const wsAddress = wsServer.address();
  if (wsAddress === null || typeof wsAddress === 'string') throw new Error('fixture WebSocket server did not expose a TCP address');
  const facadeOrigin = `http://127.0.0.1:${wsAddress.port}`;
  server = await preview({ configFile: viteConfig, preview: { host: '127.0.0.1', port } });
  const httpAddress = server.httpServer.address();
  if (httpAddress === null || httpAddress === undefined || typeof httpAddress === 'string') throw new Error('Vite server did not expose a TCP address');
  const baseUrl = `http://127.0.0.1:${httpAddress.port}`;
  await waitForVite(baseUrl, bootTimeoutMs);
  context = await chromium.launchPersistentContext(edgeProfile, { channel: 'msedge', headless: true, timeout: bootTimeoutMs, viewport: { width: 1600, height: 1000 }, args: ['--disable-gpu'] });
  const page = await context.newPage();
  await page.addInitScript(origin => {
    window.__AIDE_RUNTIME_CONFIG__ = { facadeOrigin: origin };
  }, facadeOrigin);
  const pageErrors = [];
  const consoleErrors = [];
  const pendingRequests = new Map();
  let appearanceInteractionActive = false;
  let appearanceApiRequests = 0;
  const bootEvents = { dialogs: [], pageErrors: [], console: [], requestFailed: [], badResponses: [], pendingRequests: [] };
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('pageerror', error => bootEvents.pageErrors.push(error.message));
  page.on('request', request => pendingRequests.set(request, { method: request.method(), url: request.url(), resourceType: request.resourceType() }));
  page.on('request', request => {
    if (appearanceInteractionActive && new URL(request.url()).pathname.startsWith('/api/')) appearanceApiRequests += 1;
  });
  page.on('requestfinished', request => pendingRequests.delete(request));
  page.on('requestfailed', request => pendingRequests.delete(request));
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text());
    if (message.type() === 'error' || message.type() === 'warning') bootEvents.console.push({ type: message.type(), text: message.text() });
  });
  page.on('requestfailed', request => bootEvents.requestFailed.push({ method: request.method(), url: request.url(), failure: request.failure()?.errorText ?? 'unknown' }));
  page.on('response', response => {
    if (response.status() >= 400 || response.request().resourceType() === 'document' || response.request().resourceType() === 'script') {
      bootEvents.badResponses.push({ status: response.status(), url: response.url(), resourceType: response.request().resourceType() });
    }
  });
  page.on('dialog', async dialog => {
    bootEvents.dialogs.push({ type: dialog.type(), message: dialog.message() });
    if (dialog.type() === 'prompt') await dialog.accept('p'.repeat(32));
    else await dialog.dismiss();
  });
  await page.route('**/api/**', fulfillApi);
  try {
    // The Monaco module graph can keep DOMContentLoaded pending while all
    // resources are healthy. Synchronize on the actual cockpit mount below.
    await page.goto(`${baseUrl}/`, { waitUntil: 'commit', timeout: bootTimeoutMs });
    await page.waitForFunction(() => document.querySelector('#app[data-active-panel]') !== null, { timeout: bootTimeoutMs });
    await page.waitForSelector('.cockpit-resident', { state: 'visible', timeout: bootTimeoutMs });
  } catch (error) {
    bootEvents.pendingRequests = [...pendingRequests.values()];
    await captureBootDiagnostics(page, bootEvents, error);
    throw error;
  }

  assert.equal(await page.locator('.cockpit-rail-item').count(), 12, 'cockpit must expose 12 navigation destinations');
  assert.equal(await page.locator('#app').getAttribute('data-active-panel'), 'command-center', 'Command Center must be the default landing');
  assert.equal(await page.locator('.cockpit-command-center-mount .command-center-panel').count(), 1, 'Command Center evidence surface is not mounted');
  assert.equal(await page.locator('.cockpit-resident').count(), 1, 'Resident core is not mounted');
  assert.equal(await page.locator('.cockpit-operator-identity[data-variant="engineering"]').count(), 1, 'Engineering operator identity is not mounted');
  assert.equal(await page.locator('[aria-label="Resident appearance"]').count(), 1, 'Resident appearance control is missing');
  assert.equal(await page.locator('[aria-label="Resident appearance"] option').count(), 4, 'identity registry must expose four governed profiles');
  assert.equal(await page.locator('.cockpit-operator-artwork[data-artwork-state="required"]').count(), 1, 'missing Engineering artwork must remain explicitly required');
  assert.match(await page.locator('.cockpit-operator-artwork').innerText(), /APPROVED ARTWORK REQUIRED/, 'missing artwork state is not truthful');
  const appearance = page.locator('[aria-label="Resident appearance"]');
  appearanceInteractionActive = true;
  await appearance.selectOption('security');
  appearanceInteractionActive = false;
  await page.waitForFunction(() => {
    const identity = document.querySelector('.cockpit-operator-identity');
    return identity?.getAttribute('data-variant') === 'security' && identity?.getAttribute('data-transition-state') === 'stable';
  });
  assert.equal(appearanceApiRequests, 0, 'appearance selection must not call backend capabilities');
  assert.equal(await page.locator('.cockpit-operator-identity[data-authority="none"]').count(), 1, 'identity switching must remain presentation-only');
  assert.match(await page.locator('.cockpit-operator-status').innerText(), /^SECURITY · ARTWORK REQUIRED · /, 'missing selected-variant artwork must remain truthful');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForFunction(() => document.querySelector('.cockpit-operator-identity')?.getAttribute('data-reduced-motion') === 'true');
  await appearance.selectOption('engineering');
  assert.equal(await page.locator('.cockpit-operator-identity').getAttribute('data-variant'), 'engineering', 'reduced-motion selection must apply immediately');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.locator('.cockpit-operator-hide').check();
  assert.equal(await page.locator('.cockpit-resident').count(), 1, 'hiding artwork destroyed Resident');
  assert.equal(await page.locator('.cockpit-resident-title').innerText(), 'RESIDENT', 'Resident identity label disappeared when artwork was hidden');
  assert.equal(await page.locator('.cockpit-resident-composer').count(), 1, 'Resident controls disappeared when artwork was hidden');
  assert.equal(await page.locator('.cockpit-operator-artwork[hidden]').count(), 1, 'hide artwork did not hide only the artwork region');
  await page.locator('.cockpit-operator-hide').uncheck();
  assert.equal(await page.locator('.cockpit-intel-slot').count(), 3, 'intelligence rail is incomplete');
  assert.equal(await page.locator('.cockpit-strip-tab').count(), 6, 'lower console must expose six approved tabs');
  await page.waitForFunction(() => document.querySelector('[data-chip-label="engine"]')?.textContent?.includes('1 OF 2 MODELS READY') === true);
  assert.match(await page.locator('[data-chip-label="daemon"]').textContent() ?? '', /DAEMON: ONLINE/, 'daemon reachability chip is not independently live');
  assert.doesNotMatch(await page.locator('[data-chip-label="engine"]').textContent() ?? '', /DAEMON|fixture/i, 'daemon health leaked into model readiness chip');
  await page.waitForFunction(() => document.querySelectorAll('.cockpit-telemetry-card').length >= 5);
  const telemetryText = await page.locator('.cockpit-telemetry').innerText();
  assert.match(telemetryText, /CPU[\s\S]*UNAVAILABLE/, 'CPU usage must be explicitly unavailable');
  assert.match(telemetryText, /VRAM[\s\S]*UNAVAILABLE/, 'unsupported VRAM must be explicitly unavailable');
  assert.match(telemetryText, /DISK[\s\S]*UNAVAILABLE/, 'disk usage must be explicitly unavailable');
  assert.equal(await page.locator('.cockpit-resident-action[disabled]').count(), 8, 'Resident quick actions must not pretend to execute');
  assert.equal(await page.locator('.cockpit-resident-input[disabled]').count(), 1, 'Resident composer must be visibly unavailable');
  assert.match(await page.locator('.cockpit-lineup-roles').innerText(), /Coder[\s\S]*UNASSIGNED/, 'unassigned role slots must remain truthful');
  await page.waitForFunction(() => Array.from(document.querySelectorAll('.wf-stage-name')).some(node => node.textContent === 'BUILD'));
  const buildStage = page.locator('.wf-stage').filter({ has: page.locator('.wf-stage-name', { hasText: 'BUILD' }) });
  const buildStatus = await buildStage.locator('.wf-stage-meta').innerText();
  assert.equal(buildStatus, 'FAILED', 'failed task jobs must render BUILD FAILED');
  assert.notEqual(buildStatus, 'ACTIVE', 'failed task jobs must never render BUILD ACTIVE');

  const wideGeometry = await page.evaluate(() => {
    const center = document.querySelector('#cockpit-center').getBoundingClientRect();
    const intel = document.querySelector('#cockpit-intel').getBoundingClientRect();
    const bottom = document.querySelector('#cockpit-bottom').getBoundingClientRect();
    return { centerBottom: center.bottom, intelBottom: intel.bottom, bottomTop: bottom.top, centerWidth: center.width };
  });
  assert.ok(wideGeometry.centerBottom <= wideGeometry.bottomTop + 1, 'center overlaps lower console');
  assert.ok(wideGeometry.intelBottom <= wideGeometry.bottomTop + 1, 'intelligence rail overlaps lower console');

  const destinations = [
    'command-center', 'resident', 'projects', 'editor', 'terminal', 'models', 'skills', 'memory', 'verification', 'security', 'extensions', 'settings'
  ];
  const destinationSurfaces = {
    'command-center': '.command-center-panel',
    resident: '.cockpit-resident',
    projects: '.cockpit-projects-surface',
    editor: '.cockpit-editor-layout',
    terminal: '.terminal-panel',
    models: '.models-panel',
    skills: '.skills-panel',
    memory: '.memory-panel',
    verification: '.verification-panel',
    security: '.security-panel',
    extensions: '.cockpit-phase-gated',
    settings: '.cockpit-settings-surface'
  };
  for (const id of destinations) {
    await clickDestination(page, id);
    const surface = destinationSurfaces[id];
    assert.equal(await page.locator(surface).count(), 1, `${id} did not mount its registered surface`);
    assert.equal(await page.locator(surface).isVisible(), true, `${id} surface is not visible after navigation`);
  }
  assert.equal(await page.locator('.models-panel').count(), 1, 'MODELS did not mount the existing model surface');
  assert.equal(await page.locator('.terminal-panel').count(), 1, 'TERMINAL did not mount the existing terminal surface');
  assert.equal(await page.locator('.verification-panel').count(), 1, 'VERIFICATION did not mount the existing verification surface');
  assert.equal(await page.locator('.cockpit-projects-surface').count(), 1, 'PROJECTS did not mount workspace/workbench surface');
  assert.equal(await page.locator('.cockpit-settings-surface').count(), 1, 'SETTINGS did not mount provider/BYOK surface');
  assert.equal(await page.locator('.cockpit-phase-gated').count(), 1, 'EXTENSIONS did not render a phase-gated state');
  await clickDestination(page, 'command-center');
  await page.waitForSelector('.cockpit-activity-item');
  assert.equal(await page.locator('.cockpit-activity-time').first().innerText(), 'TIME UNKNOWN', 'activity invented a timestamp for an untimestamped event');

  await clickDestination(page, 'skills');
  await page.locator('.skills-panel').click();
  assert.equal(await page.locator('.skills-panel .panel-empty').count(), 1, 'toast path destroyed the Skills surface');
  assert.equal(await page.locator('.skills-panel .aide-toast').count(), 1, 'dedicated toast was not rendered');

  await clickDestination(page, 'editor');
  assert.equal(await page.locator('.cockpit-editor-layout').count(), 1, 'editor workspace was orphaned');
  assert.equal(await page.locator('.cockpit-editor-search').count(), 1, 'Search was orphaned from the editor');
  assert.equal(await page.locator('.topbar-hint[disabled]').count(), 2, 'inert keyboard affordances are not visibly disabled');

  await page.setViewportSize({ width: 640, height: 800 });
  await clickDestination(page, 'command-center');
  const narrowGeometry = await page.evaluate(() => {
    const center = document.querySelector('#cockpit-center').getBoundingClientRect();
    const bottom = document.querySelector('#cockpit-bottom').getBoundingClientRect();
    return { centerBottom: center.bottom, bottomTop: bottom.top, centerWidth: center.width, intelHidden: getComputedStyle(document.querySelector('#cockpit-intel')).display === 'none' };
  });
  assert.ok(narrowGeometry.centerWidth > 280, `narrow center is unusable: ${narrowGeometry.centerWidth}px`);
  assert.ok(narrowGeometry.centerBottom <= narrowGeometry.bottomTop + 1, 'narrow center overlaps lower console');
  assert.equal(narrowGeometry.intelHidden, true, 'narrow layout must collapse the intelligence rail');

  assert.deepEqual(pageErrors, [], `browser page exceptions: ${pageErrors.join(' | ')}`);
  assert.deepEqual(consoleErrors, [], `browser console errors: ${consoleErrors.join(' | ')}`);
  console.log('COCKPIT ACCEPTANCE PASSED: shell, registry, truth surfaces, toast isolation, editor/search, geometry, responsive layout, and no browser errors.');
} finally {
  await context?.close();
  for (const client of wsServer.clients) client.terminate();
  await new Promise(resolve => wsServer.close(() => resolve()));
  await server?.close();
  await removeEdgeProfile(edgeProfile);
}
