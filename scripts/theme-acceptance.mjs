// Covert V1 theme acceptance: real dev stack + paired Edge + rendered UI.
import { spawn as spawnPty } from 'node-pty';
import { chromium } from '@playwright/test';
import { promises as fs } from 'node:fs';
import net from 'node:net';
import path from 'node:path';

const OUT = path.resolve('docs/evidence/themes');
const PORTS = [4777, 4778, 4779, 5173];
const results = [];
const check = (id, description, pass, detail = null) => {
  results.push({ id, description, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'} ${id} ${description}`);
};
const portBusy = port => new Promise(resolve => {
  const socket = net.connect({ host: '127.0.0.1', port }, () => { socket.destroy(); resolve(true); });
  socket.on('error', () => resolve(false));
  socket.setTimeout(500, () => { socket.destroy(); resolve(false); });
});
async function waitPortsFree(timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if ((await Promise.all(PORTS.map(portBusy))).every(value => !value)) return true;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  return false;
}
await fs.mkdir(OUT, { recursive: true });
if (!await waitPortsFree(60000)) throw new Error('Covert stack ports are not free');

const pty = spawnPty(process.execPath, ['scripts/start.mjs', '--frontend=vite'], {
  name: 'xterm-256color', cols: 200, rows: 50, cwd: process.cwd(), env: { ...process.env }
});
let output = '';
pty.onData(chunk => { output += chunk; });
const waitOutput = (regex, timeoutMs, label) => new Promise((resolve, reject) => {
  const started = Date.now();
  const timer = setInterval(() => {
    const match = regex.exec(output);
    if (match) { clearInterval(timer); resolve(match); }
    else if (Date.now() - started > timeoutMs) {
      clearInterval(timer);
      reject(new Error(`timeout waiting for ${label}`));
    }
  }, 250);
});

let browser = null;
let context = null;
let page = null;
const pageErrors = [];
try {
  await waitOutput(/Type pair to create a one-use browser pairing code/, 180000, 'stack ready');
  pty.write('pair\r');
  const pairing = await waitOutput(/pairing code \(5 min\): (\S+)/, 30000, 'pairing code');
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  page = await context.newPage();
  page.on('pageerror', error => pageErrors.push(String(error?.stack ?? error)));
  await page.goto('http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded', timeout: 90000 });
  if (await page.locator('#covert-pairing-code').count()) {
    await page.fill('#covert-pairing-code', pairing[1]);
    await page.click('form.cockpit-pairing-card button[type=submit]');
    await page.waitForTimeout(1500);
    if (await page.locator('#covert-pairing-code').count()) {
      const status = await page.locator('.cockpit-pairing-status').textContent().catch(() => '');
      console.log('[theme-acceptance] pairing form still present after submit: ' + (status ?? ''));
    }
  }
  await page.waitForSelector('.cockpit-rail-item', { timeout: 150000 });
  await page.waitForTimeout(1200);

  const skip = page.getByRole('button', { name: 'SKIP' });
  if (await skip.count() && await skip.isVisible().catch(() => false)) {
    await skip.click();
    await page.waitForTimeout(300);
  }

  await page.screenshot({ path: path.join(OUT, 'default-1440.png'), fullPage: true });
  check('THEME-001', 'Default Covert renders without an alternate theme marker',
    await page.evaluate(() => !document.documentElement.dataset.covertTheme));
  check('THEME-002', 'Default Covert keeps alternate-theme resource dials hidden',
    await page.locator('.topbar-resources').evaluate(el => getComputedStyle(el).display === 'none'));
  await page.getByRole('button', { name: 'SETTINGS: Operator config' }).click();
  await page.waitForSelector('.cockpit-theme-option');
  const themeNames = await page.locator('.cockpit-theme-option').evaluateAll(items =>
    items.map(item => item.textContent?.trim() ?? ''));
  check('THEME-003', 'Appearance exposes exactly the three V1 themes',
    themeNames.length === 3 && themeNames.some(v => v.includes('DEFAULT COVERT'))
      && themeNames.some(v => v.includes('MATRIX')) && themeNames.some(v => v.includes('DEVELOPER')), themeNames);

  await page.getByRole('button', { name: /MATRIX:/ }).click();
  await page.waitForTimeout(250);
  const matrixStatic = await page.evaluate(() => ({
    theme: document.documentElement.dataset.covertTheme,
    motion: document.documentElement.dataset.covertMatrixMotion,
    animation: getComputedStyle(document.querySelector('.cockpit-ambient-code-column')).animationName,
    resourceDisplay: getComputedStyle(document.querySelector('.topbar-resources')).display
  }));
  check('THEME-004', 'Matrix is visually selected and static by default',
    matrixStatic.theme === 'matrix' && matrixStatic.motion === 'off' && matrixStatic.animation === 'none', matrixStatic);
  check('THEME-005', 'Matrix replaces decorative header content with resource instrumentation',
    matrixStatic.resourceDisplay !== 'none', matrixStatic);

  const motion = page.locator('[data-setting-control="appearance.matrixMotion"]');
  const signal = page.locator('[data-setting-control="appearance.matrixSignal"]');
  check('THEME-006', 'Matrix controls become operator-editable when Matrix is selected',
    !await motion.isDisabled() && !await signal.isDisabled());
  await motion.selectOption('slow');
  await signal.selectOption('amber');
  await page.waitForTimeout(150);
  const slowState = await page.evaluate(() => ({
    motion: document.documentElement.dataset.covertMatrixMotion,
    signal: document.documentElement.dataset.covertMatrixSignal,
    animation: getComputedStyle(document.querySelector('.cockpit-ambient-code-column')).animationName,
    duration: getComputedStyle(document.querySelector('.cockpit-ambient-code-column')).animationDuration,
    signalCss: getComputedStyle(document.documentElement).getPropertyValue('--matrix-signal').trim()
  }));
  check('THEME-007', 'Matrix SLOW motion and manual signal color are real presentation states',
    slowState.motion === 'slow' && slowState.signal === 'amber'
      && slowState.animation === 'covert-code-fall' && slowState.duration === '52s', slowState);

  await motion.selectOption('adaptive');
  await signal.selectOption('adaptive');
  await page.getByRole('button', { name: 'COMMAND CENTER: Operator overview' }).click();
  await page.waitForTimeout(150);
  const adaptiveIdle = await page.evaluate(() => ({
    activity: document.documentElement.dataset.covertMatrixActivity,
    animation: getComputedStyle(document.querySelector('.cockpit-ambient-code-column')).animationName
  }));
  check('THEME-008', 'Matrix adaptive mode stays static while the operator is idle',
    adaptiveIdle.activity === 'idle' && adaptiveIdle.animation === 'none', adaptiveIdle);

  await page.getByRole('button', { name: 'EDITOR: Source surface' }).click();
  await page.waitForTimeout(200);
  const adaptiveWork = await page.evaluate(() => ({
    activity: document.documentElement.dataset.covertMatrixActivity,
    animation: getComputedStyle(document.querySelector('.cockpit-ambient-code-column')).animationName,
    duration: getComputedStyle(document.querySelector('.cockpit-ambient-code-column')).animationDuration
  }));
  check('THEME-009', 'Matrix adaptive motion follows real working-surface state',
    adaptiveWork.activity === 'work' && adaptiveWork.animation === 'covert-code-fall'
      && adaptiveWork.duration === '58s', adaptiveWork);

  await page.getByRole('button', { name: 'SETTINGS: Operator config' }).click();
  await page.getByRole('button', { name: /DEVELOPER:/ }).click();
  await page.waitForTimeout(200);
  const developer = await page.evaluate(() => ({
    theme: document.documentElement.dataset.covertTheme,
    rain: getComputedStyle(document.querySelector('.cockpit-ambient-code-column')).display,
    resourceDisplay: getComputedStyle(document.querySelector('.topbar-resources')).display
  }));
  check('THEME-010', 'Developer is a distinct static circuit-workstation theme',
    developer.theme === 'developer' && developer.rain === 'none' && developer.resourceDisplay !== 'none', developer);

  const resourceLabels = await page.locator('[data-resource-value]').allTextContents();
  check('THEME-011', 'Resource header shows measured RAM/VRAM/storage and truthful CPU capability',
    resourceLabels.length === 4
      && !resourceLabels.slice(0, 3).some(value => value === 'UNKNOWN')
      && /LOGICAL/.test(resourceLabels[3] ?? ''), resourceLabels);
  await page.screenshot({ path: path.join(OUT, 'developer-1440.png'), fullPage: true });

  await page.getByRole('button', { name: /MATRIX:/ }).click();
  await page.screenshot({ path: path.join(OUT, 'matrix-1440.png'), fullPage: true });
  await page.setViewportSize({ width: 1100, height: 760 });
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(OUT, 'matrix-1100.png'), fullPage: true });
  const persisted = await page.evaluate(() => {
    const raw = localStorage.getItem('covert.operator-preferences.v1');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return {
      theme: parsed?.global?.['appearance.theme'] ?? null,
      motion: parsed?.global?.['appearance.matrixMotion'] ?? null,
      signal: parsed?.global?.['appearance.matrixSignal'] ?? null
    };
  });
  check('THEME-012', 'Theme and Matrix controls are durably written to the canonical preference store',
    persisted?.theme === 'matrix' && persisted?.motion === 'adaptive' && persisted?.signal === 'adaptive', persisted);
  check('THEME-013', 'Rendered theme battery has no uncaught page errors', pageErrors.length === 0, pageErrors.slice(0, 3));
} catch (error) {
  check('THEME-000', 'Theme acceptance harness completed', false, String(error?.stack ?? error).slice(0, 1200));
} finally {
  try { await context?.close(); } catch {}
  try { await browser?.close(); } catch {}
  try { pty.kill(); } catch {}
  await waitPortsFree(30000);
  const failed = results.filter(result => !result.pass);
  const report = {
    battery: 'COVERT-V1-THEME-ACCEPTANCE',
    generated_at_utc: new Date().toISOString(),
    pass: results.length - failed.length,
    fail: failed.length,
    results
  };
  await fs.writeFile(path.join(OUT, 'theme-acceptance.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(`THEME-ACCEPTANCE ${failed.length ? 'FAIL' : 'PASS'} (${results.length - failed.length}/${results.length})`);
  process.exit(failed.length ? 1 : 0);
}
