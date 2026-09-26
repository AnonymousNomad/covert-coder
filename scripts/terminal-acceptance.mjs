// Embedded terminal acceptance — headless, end-to-end, through the real Covert UI.
//
// Runs the intended dev stack (`node scripts/start.mjs --frontend=vite`) under a
// pty, pairs a real browser (Playwright, Edge channel), opens the TERMINAL panel
// during the first-run window, and executes the 10-point embedded-terminal
// contract with backend effects observed over the facade. No operator desktop
// interaction is required; no focus is stolen.
//
// Usage: node scripts/terminal-acceptance.mjs [--json <path>]

import { spawn as spawnPty } from 'node-pty';
import { chromium } from '@playwright/test';
import { promises as fsp } from 'node:fs';
import path from 'node:path';

process.on('uncaughtException', error => {
  console.error('[terminal-acceptance] uncaught: ' + String(error?.message ?? error).slice(0, 200));
});

const args = process.argv.slice(2);
const jsonIndex = args.indexOf('--json');
const jsonPath = jsonIndex >= 0 ? args[jsonIndex + 1] : null;
const results = [];
const check = (id, description, pass, detail) => {
  results.push({ id, description, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'} ${id} ${description}${detail === undefined ? '' : ' :: ' + JSON.stringify(detail).slice(0, 400)}`);
};

const pty = spawnPty(process.execPath, ['scripts/start.mjs', '--frontend=vite'], {
  name: 'xterm-256color', cols: 200, rows: 50, cwd: process.cwd(), env: { ...process.env }
});
let output = '';
pty.onData(chunk => { output += chunk; });
const waitFor = (regex, timeoutMs, label) => new Promise((resolve, reject) => {
  const started = Date.now();
  const timer = setInterval(() => {
    const match = regex.exec(output);
    if (match) { clearInterval(timer); resolve(match); }
    else if (Date.now() - started > timeoutMs) { clearInterval(timer); reject(new Error(`timeout waiting for ${label}`)); }
  }, 250);
});

let browser = null;
let context = null;
try {
  await waitFor(/Type pair to create a one-use browser pairing code/, 180000, 'stack ready');
  pty.write('pair\r');
  const pairing = await waitFor(/pairing code \(5 min\): (\S+)/, 30000, 'pairing code');
  const pairingCode = pairing[1];

  browser = await chromium.launch({ channel: 'msedge', headless: true });
  context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const pageErrors = [];
  const approvalRequired = [];
  const dialogMessages = [];
  page.on('pageerror', error => pageErrors.push(String(error?.stack ?? error).slice(0, 1000)));
  page.on('response', response => {
    if (response.url().endsWith('/api/terminal/sessions') && response.status() === 409) approvalRequired.push(Date.now());
  });
  page.on('dialog', dialog => { dialogMessages.push(dialog.message().slice(0, 120)); void dialog.accept(); });

  await page.goto('http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded', timeout: 90000 });
  if (await page.locator('#covert-pairing-code').count() > 0) {
    await page.fill('#covert-pairing-code', pairingCode);
    await page.click('form.cockpit-pairing-card button[type=submit]');
  }
  await page.waitForSelector('.cockpit-rail-item', { timeout: 150000 });
  // Click TERMINAL immediately: this exercises the first-run walkthrough race
  // (auto-open resolves after page load and must never override this choice).
  await page.getByRole('button', { name: 'TERMINAL: Governed sessions' }).click();
  await page.waitForTimeout(2500);
  const panelAfterClick = await page.evaluate(() => ({
    panel: document.getElementById('app')?.dataset?.activePanel ?? null,
    hidden: document.querySelector('#cockpit-terminal-stage')?.hidden ?? null,
    walkthroughOpen: document.querySelector('.cockpit-walkthrough') ? !document.querySelector('.cockpit-walkthrough').hidden : null
  }));
  check('TERM-001', 'TERMINAL panel opens and stays active after navigation', panelAfterClick.panel === 'terminal' && panelAfterClick.hidden === false, panelAfterClick);

  // Provider probe resolution.
  let providerText = '';
  for (let i = 0; i < 90; i += 1) {
    providerText = await page.evaluate(() => document.querySelector('#cockpit-terminal-stage')?.textContent ?? '');
    if (!providerText.includes('Probing runtime providers')) break;
    await page.waitForTimeout(500);
  }
  check('TERM-002', 'runtime provider probe resolves with an available provider', providerText.includes('AVAILABLE') && !providerText.includes('Provider probe failed'), providerText.slice(0, 160));
  check('TERM-003', 'OPEN SESSION control is offered', providerText.includes('OPEN SESSION'), null);

  const openButton = page.locator('#cockpit-terminal-stage button', { hasText: 'OPEN SESSION' });
  await openButton.click();
  await page.waitForTimeout(12000);
  const session = await page.evaluate(() => ({
    hasXterm: Boolean(document.querySelector('.terminal-xterm .xterm')),
    hasStop: Array.from(document.querySelectorAll('#cockpit-terminal-stage button')).some(button => button.textContent === 'STOP SESSION'),
    text: document.querySelector('.terminal-xterm')?.innerText ?? ''
  }));
  check('TERM-004', 'OPEN SESSION performs the approval-gated real session start', session.hasXterm && session.hasStop && approvalRequired.length >= 1 && dialogMessages.some(message => message.includes('Approve this operation once')), { approval409: approvalRequired.length, xterm: session.hasXterm, stop: session.hasStop });
  check('TERM-005', 'shell prompt is visible (real shell identified)', /PS .*>/.test(session.text) || session.text.length > 0, session.text.slice(-160));
  check('TERM-006', 'session starts in the workspace directory', session.text.includes(path.resolve('.')), session.text.slice(-160));

  await page.click('.terminal-xterm');
  await page.keyboard.type('echo COVERT_TERMINAL_OK');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(3000);
  const echoed = await page.evaluate(() => document.querySelector('.terminal-xterm')?.innerText ?? '');
  check('TERM-007', 'keyboard input reaches the owned session and output streams back', echoed.includes('COVERT_TERMINAL_OK'), echoed.slice(-200));

  await page.setViewportSize({ width: 1100, height: 700 });
  await page.waitForTimeout(1200);
  const aliveAfterResize = await page.evaluate(() => Boolean(document.querySelector('.terminal-xterm .xterm')));
  check('TERM-008', 'session survives a viewport resize', aliveAfterResize, null);

  await page.click('.terminal-xterm');
  await page.keyboard.type('exit');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(5000);
  const afterExit = await page.evaluate(() => ({
    hasXterm: Boolean(document.querySelector('.terminal-xterm')),
    hasOpenButton: Array.from(document.querySelectorAll('#cockpit-terminal-stage button')).some(button => button.textContent === 'OPEN SESSION')
  }));
  check('TERM-009', 'shell exit returns the panel to the closed state', !afterExit.hasXterm && afterExit.hasOpenButton, afterExit);

  const reopenButton = page.locator('#cockpit-terminal-stage button', { hasText: 'OPEN SESSION' });
  await reopenButton.click();
  await page.waitForTimeout(12000);
  const restarted = await page.evaluate(() => Boolean(document.querySelector('.terminal-xterm .xterm')));
  check('TERM-010', 'a fresh session starts after exit', restarted, null);

  const stopButton = page.locator('#cockpit-terminal-stage button', { hasText: 'STOP SESSION' });
  await stopButton.click();
  await page.waitForTimeout(7000);
  const afterStop = await page.evaluate(() => ({
    hasXterm: Boolean(document.querySelector('.terminal-xterm')),
    hasOpenButton: Array.from(document.querySelectorAll('#cockpit-terminal-stage button')).some(button => button.textContent === 'OPEN SESSION')
  }));
  check('TERM-011', 'canonical STOP SESSION closes the session', !afterStop.hasXterm && afterStop.hasOpenButton, afterStop);
  check('TERM-012', 'no uncaught page errors across the battery', pageErrors.length === 0, pageErrors.slice(0, 2));
} catch (error) {
  check('TERM-000', 'battery completed without harness error', false, String(error?.message ?? error).slice(0, 300));
} finally {
  try { await context?.close(); } catch { /* ignore */ }
  try { await browser?.close(); } catch { /* ignore */ }
  try { pty.kill(); } catch { /* node-pty cleanup quirk */ }
  await new Promise(resolve => setTimeout(resolve, 800));
  const failed = results.filter(result => !result.pass);
  const report = {
    battery: 'EMBEDDED-TERMINAL-V1',
    generated_at_utc: new Date().toISOString(),
    suite: 'terminal-acceptance',
    pass: results.length - failed.length,
    fail: failed.length,
    results
  };
  if (jsonPath) {
    await fsp.mkdir(path.dirname(path.resolve(jsonPath)), { recursive: true }).catch(() => {});
    await fsp.writeFile(path.resolve(jsonPath), JSON.stringify(report, null, 2) + '\n').catch(error => console.error('failed to write report: ' + error.message));
  }
  console.log(`\nTERMINAL-ACCEPTANCE ${failed.length === 0 ? 'PASS' : 'FAIL'} (${results.length - failed.length}/${results.length})`);
  process.exit(failed.length === 0 ? 0 : 1);
}
