import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { build, preview } from 'vite';
import { chromium } from '@playwright/test';
import { WebSocketServer } from 'ws';

const repo = process.cwd();
const evidenceFolderName = `operator-control-acceptance-${new Date().toISOString().slice(0, 10)}-${process.pid}`;
const evidenceRelativePath = `artifacts/${evidenceFolderName}`;
const evidenceDir = path.join(repo, 'artifacts', evidenceFolderName);
if (existsSync(evidenceDir)) throw new Error(`Refusing to overwrite existing evidence directory: ${evidenceDir}`);
mkdirSync(evidenceDir, { recursive: true });
const edgeProfile = mkdtempSync(path.join(tmpdir(), 'covert-settings-acceptance-'));
const workspacePath = 'CovertAcceptanceFixture';
const mode = { failHardware: false };
const failures = [];
const consoleErrors = [];
const badResponses = [];
const results = { browser: 'Microsoft Edge via Playwright', fixture: 'deterministic local API mock; no model/runtime/provider calls', checks: {}, screenshots: [], notes: [], httpErrors: [] };

const fixtures = {
  '/api/health': { version: 'fixture', uptimeMs: 1000, workspace: workspacePath, freeMemoryMB: 4096 },
  '/api/session': { version: 1, tabs: [] },
  '/api/workspace': { workspace: workspacePath, entries: [] },
  '/api/lsp/status': { servers: [] },
  '/api/models/status': { runtime: false, models: [] },
  '/api/models/routes': { routes: [] },
  '/api/hardware/profile': { totalRamBytes: 16 * 1024 ** 3, freeRamBytes: 8 * 1024 ** 3, logicalCpus: 12, vramBytes: 0, freeVramBytes: 0, vramSource: 'none', tier: 'M', backend: 'cpu', detectedAt: Date.now() },
  '/api/tasks': { fileFound: false, filePath: null, detectedFrom: null, tasks: [] },
  '/api/tasks/status': { jobs: [] },
  '/api/git/status': { git_repo: true, branch: 'fixture', oid: null, upstream: null, ahead: 0, behind: 0, detached: false, changes: [] },
  '/api/terminal/providers': { providers: [] },
  '/api/audit/events': { events: [], count: 0, known_types: [] },
  '/api/resident/summary': { summary: { generated_at: Date.now(), status: 'unknown', projectType: 'unknown', workspace: workspacePath, nodeVersion: 'unknown', git: { git_repo: false, branch: null, upstream: null, ahead: 0, behind: 0, changes: 0, conflicts: 0, clean: null }, lsp: { available: false, servers: [] }, model: { runtime_available: false, running: false, ready_count: 0, artifact_available: false }, deps: { has_manifest: false, dependencies: 0, dev_dependencies: 0, has_lockfile: false, action: null }, hasTestScript: false, conditions: [], recommendation: 'Fixture state only.', workflow: null } },
  '/api/resident/context': { context: { generated_at: Date.now(), projectType: 'unknown', workspace: workspacePath, git_status: 'unknown', changed_files: [], diagnostics: [], conditions: [], workflows_available: [], model_status: 'not reported', approx_tokens: 0 } },
  '/api/resident/push-summary': { push: { repo: false, branch: null, ahead: 0, behind: 0, changed_files: [], changed_count: 0, staged_count: 0, diagnostics_errors: 0, test_script_present: false, risky_changes: [], generated_artifacts: [], verdict: 'UNKNOWN', reasons: [] } },
  '/api/resident/decisions': { decisions: [] },
  '/api/byok/status': { providers: [], routing: { plan: 'local', act: 'local', utility: 'local' }, consent_enabled: false },
  '/api/providers': { providers: [] },
  '/api/connections': { consensus: 'Fixture: no provider connections configured.', routed_roles: { plan: 'local', act: 'local', utility: 'local' }, preference: 'local-only', connections: [] },
  '/api/workbenches': { workbenches: [] },
  '/api/closed-loop/status': { enabled: false, last_run_logged_at: null, signal_file_count: 0, bus_event_count: 0 },
  '/api/chat/history': { conversations: [] },
  '/api/onboarding/state': { complete: true, current_step: 'complete', completed_steps: [] }
};

function envelope(data) { return JSON.stringify({ ok: true, data }); }

async function fulfillApi(route) {
  const url = new URL(route.request().url());
  if (url.pathname === '/api/authority/pair') {
    await route.fulfill({ status: 200, contentType: 'application/json', body: envelope({ token: 'fixture-token-012345678901234567890123', actor_id: 'fixture-operator', expires_at: Date.now() + 600000 }) });
    return;
  }
  if (url.pathname === '/api/hardware/profile' && mode.failHardware) {
    await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ ok: false, error: { code: 'FIXTURE_UNAVAILABLE', message: 'fixture hardware status unavailable' } }) });
    return;
  }
  if (url.pathname === '/api/chat/stream') {
    await route.fulfill({ status: 200, contentType: 'text/event-stream', body: 'data: {"done":true}\n\n' });
    return;
  }
  if (url.pathname === '/api/session' && route.request().method() === 'PUT') {
    await route.fulfill({ status: 200, contentType: 'application/json', body: envelope({ version: 1, tabs: [] }) });
    return;
  }
  const data = fixtures[url.pathname];
  if (data === undefined) {
    await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ ok: false, error: { code: 'FIXTURE_UNMAPPED', message: `No fixture for ${url.pathname}` } }) });
    return;
  }
  await route.fulfill({ status: 200, contentType: 'application/json', body: envelope(data) });
}

async function boot(page, baseUrl) {
  await page.goto(`${baseUrl}/`, { waitUntil: 'commit', timeout: 60000 });
  await page.locator('#covert-pairing-code').fill('p'.repeat(32));
  await page.getByRole('button', { name: 'PAIR SESSION', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('#app[data-active-panel]') !== null, { timeout: 60000 });
  await page.waitForSelector('.cockpit-resident', { state: 'visible', timeout: 60000 });
}

async function navigate(page, panel) {
  await page.locator(`.cockpit-rail-item[data-item-id="${panel}"]`).click();
  await page.waitForFunction(id => document.querySelector('#app')?.getAttribute('data-active-panel') === id, panel);
}

async function screenshot(page, name) {
  const file = `${name}.png`;
  await page.screenshot({ path: path.join(evidenceDir, file), fullPage: false, animations: 'disabled' });
  results.screenshots.push(file);
}

const wsServer = new WebSocketServer({ host: '127.0.0.1', port: 0, path: '/ws' });
wsServer.on('connection', socket => socket.on('message', raw => {
  try { if (JSON.parse(String(raw))?.type === 'authenticate') socket.send(JSON.stringify({ type: 'authenticated' })); } catch { /* fixture ignores malformed frames */ }
}));
await new Promise((resolve, reject) => { wsServer.once('listening', resolve); wsServer.once('error', reject); });
let server;
let context;
try {
  await build({ configFile: path.join(repo, 'browser', 'vite.config.ts') });
  const wsAddress = wsServer.address();
  if (wsAddress === null || typeof wsAddress === 'string') throw new Error('Fixture websocket did not expose a TCP port');
  const facadeOrigin = `http://127.0.0.1:${wsAddress.port}`;
  server = await preview({ configFile: path.join(repo, 'browser', 'vite.config.ts'), preview: { host: '127.0.0.1', port: 0 } });
  const address = server.httpServer.address();
  if (address === null || typeof address === 'string') throw new Error('Vite preview did not expose a TCP port');
  const baseUrl = `http://127.0.0.1:${address.port}`;
  context = await chromium.launchPersistentContext(edgeProfile, { channel: 'msedge', headless: true, viewport: { width: 1440, height: 1000 }, args: ['--disable-gpu'] });
  const page = await context.newPage();
  await page.addInitScript(origin => { window.__AIDE_RUNTIME_CONFIG__ = { facadeOrigin: origin }; }, facadeOrigin);
  page.on('pageerror', error => failures.push(`pageerror: ${error.message}`));
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('response', response => {
    if (response.status() >= 400) badResponses.push({ status: response.status(), method: response.request().method(), url: response.url() });
  });
  await page.route('**/api/**', fulfillApi);
  await boot(page, baseUrl);

  const settingsNav = page.locator('.cockpit-rail-item[data-item-id="settings"]');
  assert.equal(await settingsNav.isVisible(), true);
  let settingsFocusedByKeyboard = false;
  for (let tab = 0; tab < 100; tab += 1) {
    await page.keyboard.press('Tab');
    if (await settingsNav.evaluate(node => node === document.activeElement)) {
      settingsFocusedByKeyboard = true;
      break;
    }
  }
  assert.equal(settingsFocusedByKeyboard, true, 'Tab order must reach Settings navigation');
  const settingsFocusStyle = await settingsNav.evaluate(node => ({ visible: node.matches(':focus-visible'), outlineStyle: getComputedStyle(node).outlineStyle, outlineWidth: getComputedStyle(node).outlineWidth }));
  assert.equal(settingsFocusStyle.visible, true, 'keyboard-focused Settings navigation must match :focus-visible');
  assert.equal(settingsFocusStyle.outlineStyle, 'solid', 'keyboard focus indicator must be visible');
  assert.equal(settingsFocusStyle.outlineWidth, '2px');
  await page.keyboard.press('Enter');
  await page.locator('.cockpit-settings-surface').waitFor({ state: 'visible' });
  results.checks.settingsOpen = true;
  await screenshot(page, '01-default-settings');
  await navigate(page, 'command-center');
  assert.equal(await page.locator('.cockpit-settings-surface').isVisible(), false, 'leaving Settings must close its active surface');
  await navigate(page, 'settings');
  results.checks.settingsClose = true;

  await page.locator('button[data-category="layout"]').click();
  assert.equal(await page.locator('[data-settings-category="layout"]').isVisible(), true);
  results.checks.settingsNavigation = true;
  const search = page.getByRole('searchbox', { name: 'Search settings and operator surfaces' });
  await search.focus();
  await page.keyboard.type('scratch');
  assert.equal(await page.locator('button[data-category="execution"]').getAttribute('aria-current'), 'page');
  results.checks.settingsSearch = true;
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Backspace');
  const unnamedControls = await page.locator('.cockpit-settings-surface button:visible, .cockpit-settings-surface input:visible, .cockpit-settings-surface select:visible').evaluateAll(nodes => nodes.filter(node => {
    const formControl = node instanceof HTMLInputElement || node instanceof HTMLSelectElement || node instanceof HTMLTextAreaElement;
    const label = node.getAttribute('aria-label') || (formControl ? Array.from(node.labels ?? []).map(item => item.textContent?.trim()).join(' ') : node.textContent?.trim() ?? '');
    return label.length === 0;
  }).map(node => `${node.tagName}.${node.className}`));
  assert.deepEqual(unnamedControls, [], `interactive Settings control(s) lack an accessible name: ${unnamedControls.join(', ')}`);
  results.checks.accessibleNames = true;
  await page.locator('button[data-category="appearance"]').click();

  const defaultTheme = page.getByRole('button', { name: /^DEFAULT COVERT:/ });
  const matrixTheme = page.getByRole('button', { name: /^MATRIX:/ });
  assert.equal(await defaultTheme.getAttribute('aria-pressed'), 'true');
  await matrixTheme.focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.documentElement.dataset.covertTheme === 'matrix');
  assert.equal(await page.locator('.cc-brand-map').evaluate(node => getComputedStyle(node).display), 'none');
  assert.ok(await page.locator('.cockpit-ambient-code-column').count() > 0);
  results.checks.matrixSwitch = true;
  await screenshot(page, '02-matrix-settings');
  await defaultTheme.focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.documentElement.dataset.covertTheme === undefined);
  results.checks.defaultSwitch = true;

  await matrixTheme.focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.documentElement.dataset.covertTheme === 'matrix');
  await navigate(page, 'command-center');
  assert.equal(await page.locator('.cockpit-resident').count(), 1);
  await navigate(page, 'terminal');
  assert.equal(await page.locator('.terminal-panel').count(), 1);
  assert.equal(await page.locator('.terminal-panel').isVisible(), true);
  await navigate(page, 'command-center');
  assert.equal(await page.locator('.cc-brand-map').evaluate(node => getComputedStyle(node).display), 'none');
  results.checks.matrixMainSurfaces = true;
  await screenshot(page, '03-matrix-workstation');

  for (const width of [1280, 1440, 1920, 1024]) {
    await page.setViewportSize({ width, height: 1000 });
    await navigate(page, 'settings');
    const geometry = await page.evaluate(() => ({ viewport: innerWidth, body: document.documentElement.scrollWidth, surface: document.querySelector('.cockpit-settings-surface')?.getBoundingClientRect().right ?? 0 }));
    assert.ok(geometry.body <= width, `horizontal overflow at ${width}: ${JSON.stringify(geometry)}`);
    assert.ok(geometry.surface <= width + 1, `Settings exceeds viewport at ${width}: ${JSON.stringify(geometry)}`);
  }
  results.checks.responsiveDesktopAndNarrow = true;
  await page.setViewportSize({ width: 1440, height: 1000 });

  await page.locator('button[data-category="health"]').click();
  await page.waitForSelector('.cockpit-health-surface');
  await page.waitForFunction(() => document.querySelectorAll('.cockpit-health-card').length >= 8);
  const healthText = await page.locator('.cockpit-health-surface').innerText();
  assert.match(healthText, /CPU[\s\S]*12 LOGICAL PROCESSORS/);
  assert.match(healthText, /GPU \/ VRAM[\s\S]*VRAM UNAVAILABLE/);
  assert.match(healthText, /RAM[\s\S]*8\.0 GB free/);
  assert.match(healthText, /STORAGE[\s\S]*UNAVAILABLE/);
  assert.match(healthText, /RESIDENT[\s\S]*UNKNOWN/);
  results.checks.healthTruthfulWithFixture = true;
  await screenshot(page, '04-system-health');

  mode.failHardware = true;
  await page.getByRole('button', { name: 'Refresh system health snapshot' }).click();
  await page.locator('.cockpit-blocked-state').waitFor({ state: 'visible' });
  const blockedText = await page.locator('.cockpit-blocked-state').innerText();
  assert.match(blockedText, /Blocked by[\s\S]*Local Covert status APIs/);
  assert.match(blockedText, /Next valid action[\s\S]*Check the local daemon status/);
  results.checks.whyBlocked = true;
  await page.locator('.cockpit-blocked-state').scrollIntoViewIfNeeded();
  await screenshot(page, '05-why-blocked');
  mode.failHardware = false;
  await page.getByRole('button', { name: 'Refresh system health snapshot' }).click();
  await page.waitForFunction(() => !document.querySelector('.cockpit-blocked-state'));

  await page.locator('button[data-category="appearance"]').click();
  await page.locator('.cockpit-settings-scope').selectOption('global');
  assert.match(await page.locator('[data-setting-source="appearance.theme"]').innerText(), /GLOBAL VALUE|DEFAULT VALUE/);
  await screenshot(page, '06-global-setting-source');
  await matrixTheme.focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.documentElement.dataset.covertTheme === 'matrix');
  await page.reload({ waitUntil: 'commit' });
  await page.locator('#covert-pairing-code').fill('p'.repeat(32));
  await page.getByRole('button', { name: 'PAIR SESSION', exact: true }).click();
  await page.waitForSelector('.cockpit-resident', { state: 'visible' });
  assert.equal(await page.locator('html').getAttribute('data-covert-theme'), 'matrix');
  results.checks.themeReloadPersistence = true;

  await navigate(page, 'settings');
  await page.locator('.cockpit-settings-scope').selectOption('workspace');
  const density = page.locator('[data-setting-control="layout.density"]');
  await page.locator('button[data-category="layout"]').click();
  await density.selectOption('compact');
  assert.match(await page.locator('[data-setting-source="layout.density"]').innerText(), /WORKSPACE VALUE: COMPACT[\s\S]*WORKSPACE OVERRIDE/);
  await screenshot(page, '07-workspace-override-source');
  const stored = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), 'covert.operator-preferences.v1');
  assert.equal(stored.workspaces[workspacePath]['layout.density'], 'compact');
  assert.equal(Object.hasOwn(stored.global, 'layout.density'), false, 'workspace override must not mutate the global preference');
  results.checks.workspaceScopeAndIsolation = true;
  await page.reload({ waitUntil: 'commit' });
  await page.locator('#covert-pairing-code').fill('p'.repeat(32));
  await page.getByRole('button', { name: 'PAIR SESSION', exact: true }).click();
  await page.waitForSelector('.cockpit-resident', { state: 'visible' });
  await navigate(page, 'settings');
  await page.locator('.cockpit-settings-scope').selectOption('workspace');
  await page.locator('button[data-category="layout"]').click();
  assert.equal(await page.locator('[data-setting-control="layout.density"]').inputValue(), 'compact');
  assert.match(await page.locator('[data-setting-source="layout.density"]').innerText(), /WORKSPACE OVERRIDE/);
  results.checks.workspaceReloadPersistence = true;

  await page.locator('button[data-category="appearance"]').click();
  await page.locator('.cockpit-settings-scope').selectOption('global');
  const effects = page.locator('[data-setting-control="appearance.effects"]');
  await effects.selectOption('reduced');
  assert.equal(await page.locator('html').getAttribute('data-covert-effects'), 'reduced');
  assert.equal(await page.locator('.cockpit-ambient-code-column').first().evaluate(node => getComputedStyle(node).animationName), 'none');
  await page.locator('[data-setting-control="accessibility.reducedMotion"]').check();
  assert.equal(await page.locator('html').getAttribute('data-covert-motion'), 'reduced');
  const transitionDuration = await page.locator('.cockpit-settings-nav-item').first().evaluate(node => getComputedStyle(node).transitionDuration);
  assert.ok(parseFloat(transitionDuration) <= 0.00001, `reduced motion transition is not effectively disabled: ${transitionDuration}`);
  assert.equal(await page.locator('.cockpit-settings-surface').isVisible(), true);
  results.checks.reducedMotionAndEffects = true;

  const malformedCases = [
    ['malformed', '{not-json', /READ-ONLY[\s\S]*invalid/i],
    ['unknown', JSON.stringify({ version: 1, global: { 'future.preference': 'kept' }, workspaces: {} }), /SAVED IN THIS BROWSER PROFILE/i],
    ['future-version', JSON.stringify({ version: 99, global: { theme: 'matrix' }, workspaces: {} }), /READ-ONLY[\s\S]*unsupported/i]
  ];
  for (const [name, raw, messagePattern] of malformedCases) {
    await page.evaluate(({ key, value }) => localStorage.setItem(key, value), { key: 'covert.operator-preferences.v1', value: raw });
    await page.reload({ waitUntil: 'commit' });
    await page.locator('#covert-pairing-code').fill('p'.repeat(32));
    await page.getByRole('button', { name: 'PAIR SESSION', exact: true }).click();
    await page.waitForSelector('.cockpit-resident', { state: 'visible' });
    await navigate(page, 'settings');
    assert.match(await page.locator('.cockpit-settings-storage-state').innerText(), messagePattern, `${name} preference recovery status`);
    assert.equal(await page.evaluate(key => localStorage.getItem(key), 'covert.operator-preferences.v1'), raw, `${name} state must not be overwritten`);
    assert.equal(await page.locator('.cockpit-settings-surface').isVisible(), true, `${name} state must not crash Settings`);
    results.checks[`preferenceRecovery_${name}`] = true;
  }

  await page.locator('button[data-category="appearance"]').click();
  const theme = await page.locator('html').getAttribute('data-covert-theme');
  assert.notEqual(theme, 'matrix', 'future-schema preference must not be applied as an arbitrary value');
  results.checks.futureValueNotApplied = true;

  assert.deepEqual(failures, [], `browser exceptions: ${failures.join(' | ')}`);
  results.checks.browserExceptions = true;
  results.httpErrors = badResponses.map(response => ({ status: response.status, method: response.method, route: new URL(response.url).pathname }));
  const expectedNegativeResponses = badResponses.filter(response => response.status === 503 && new URL(response.url).pathname === '/api/hardware/profile');
  const unexpectedHttpErrors = badResponses.filter(response => !expectedNegativeResponses.includes(response));
  assert.deepEqual(unexpectedHttpErrors, [], `unexpected HTTP errors: ${JSON.stringify(unexpectedHttpErrors)}`);
  const expectedNegativeConsole = 'Failed to load resource: the server responded with a status of 503 (Service Unavailable)';
  let expectedConsoleBudget = expectedNegativeResponses.length;
  const unexpectedConsoleErrors = consoleErrors.filter(message => {
    if (message === expectedNegativeConsole && expectedConsoleBudget > 0) {
      expectedConsoleBudget -= 1;
      return false;
    }
    return true;
  });
  assert.deepEqual(unexpectedConsoleErrors, [], `unexpected browser console errors: ${unexpectedConsoleErrors.join(' | ')}`);
  results.checks.consoleErrors = true;
  results.notes.push(`Expected negative fixture response: GET /api/hardware/profile → 503 (${expectedNegativeResponses.length})`);
} catch (error) {
  results.failure = error instanceof Error ? error.stack ?? error.message : String(error);
  throw error;
} finally {
  writeFileSync(path.join(evidenceDir, 'acceptance-result.json'), JSON.stringify({ generatedAt: new Date().toISOString(), evidenceDir: evidenceRelativePath, ...results }, null, 2));
  await context?.close();
  for (const client of wsServer.clients) client.terminate();
  await new Promise(resolve => wsServer.close(() => resolve()));
  await server?.close();
  rmSync(edgeProfile, { recursive: true, force: true, maxRetries: 12, retryDelay: 250 });
}

console.log(JSON.stringify({ evidenceDir: evidenceRelativePath, checks: results.checks, screenshots: results.screenshots, notes: results.notes }, null, 2));
