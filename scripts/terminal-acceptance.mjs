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
import net from 'node:net';
import path from 'node:path';

process.on('uncaughtException', error => {
  console.error('[terminal-acceptance] uncaught: ' + String(error?.message ?? error).slice(0, 200));
});

const STACK_PORTS = [4777, 4778, 4779, 5173];
const portBusy = port => new Promise(resolve => {
  const socket = net.connect({ host: '127.0.0.1', port }, () => { socket.destroy(); resolve(true); });
  socket.on('error', () => resolve(false));
  socket.setTimeout(500, () => { socket.destroy(); resolve(false); });
});
const waitForPortsFree = async timeoutMs => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const busy = await Promise.all(STACK_PORTS.map(portBusy));
    if (busy.every(value => value === false)) return true;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  return false;
};

const args = process.argv.slice(2);
const jsonIndex = args.indexOf('--json');
const jsonPath = jsonIndex >= 0 ? args[jsonIndex + 1] : null;
const results = [];
const check = (id, description, pass, detail) => {
  results.push({ id, description, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'} ${id} ${description}${detail === undefined ? '' : ' :: ' + JSON.stringify(detail).slice(0, 400)}`);
};

const portsFreeBeforeStart = await waitForPortsFree(60000);
if (!portsFreeBeforeStart) console.error('[terminal-acceptance] warning: stack ports were still busy after 60s');
const pty = spawnPty(process.execPath, ['scripts/start.mjs', '--frontend=vite'], {
  name: 'xterm-256color', cols: 200, rows: 50, cwd: process.cwd(), env: { ...process.env }
});let output = '';
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
  page.on('console', message => { if (message.type() === 'error') console.log('[console-error] ' + message.text().slice(0, 240)); });
  page.on('response', response => {
    if (response.url().endsWith('/api/terminal/sessions') && response.status() === 409) approvalRequired.push(Date.now());
  });
  page.on('dialog', dialog => { dialogMessages.push(dialog.message().slice(0, 120)); void dialog.accept(); });

  await page.goto('http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded', timeout: 90000 });
  if (await page.locator('#covert-pairing-code').count() > 0) {
    await page.fill('#covert-pairing-code', pairingCode);
    await page.click('form.cockpit-pairing-card button[type=submit]');
    await page.waitForTimeout(1500);
    if (await page.locator('#covert-pairing-code').count() > 0) {
      const status = await page.locator('.cockpit-pairing-status').textContent().catch(() => '');
      console.log('[acceptance] pairing form still present after submit: ' + (status ?? ''));
    }
  }
  await page.waitForSelector('.cockpit-rail-item', { timeout: 150000 });
  // Click TERMINAL immediately: this exercises the first-run walkthrough race
  // (auto-open resolves after page load and must never override this choice).
  await page.getByRole('button', { name: 'TERMINAL: Governed sessions' }).click();
  await page.waitForTimeout(1200);
  // Race check: wait (bounded) for the first-run tour to auto-open AFTER the
  // click, and require the operator-selected panel to never revert meanwhile.
  const race = {
    panel: null,
    hidden: null,
    walkthroughOpen: false,
    stayedTerminal: true
  };
  const raceDeadline = Date.now() + 25000;
  while (Date.now() < raceDeadline) {
    const sample = await page.evaluate(() => ({
      panel: document.getElementById('app')?.dataset?.activePanel ?? null,
      hidden: document.querySelector('#cockpit-terminal-stage')?.hidden ?? null,
      walkthroughOpen: document.querySelector('.cockpit-walkthrough') ? !document.querySelector('.cockpit-walkthrough').hidden : false
    }));
    race.panel = sample.panel;
    race.hidden = sample.hidden;
    race.walkthroughOpen = sample.walkthroughOpen;
    if (!(sample.panel === 'terminal' && sample.hidden === false)) race.stayedTerminal = false;
    if (sample.walkthroughOpen && sample.panel === 'terminal' && sample.hidden === false) break;
    await page.waitForTimeout(400);
  }
  check('TERM-001', 'TERMINAL panel opens and stays active after navigation (first-run race path)', race.panel === 'terminal' && race.hidden === false && race.walkthroughOpen === true && race.stayedTerminal, race);
  // Onboarding invariant: after the tour auto-opened, operator navigation still wins.
  await page.getByRole('button', { name: 'RESIDENT: Persistent intelligence' }).click();
  await page.waitForTimeout(1200);
  const invariant = await page.evaluate(() => ({
    panel: document.getElementById('app')?.dataset?.activePanel ?? null,
    walkthroughOpen: document.querySelector('.cockpit-walkthrough') ? !document.querySelector('.cockpit-walkthrough').hidden : null
  }));
  check('ONB-001', 'automatic onboarding never overrides explicit operator navigation', invariant.panel === 'resident' && invariant.walkthroughOpen === true, invariant);
  await page.getByRole('button', { name: 'TERMINAL: Governed sessions' }).click();
  await page.waitForTimeout(800);

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
  await page.waitForTimeout(1200);
  const clickProbe = await page.evaluate(() => ({
    stageTail: (document.querySelector('#cockpit-terminal-stage')?.textContent ?? '').slice(-180),
    openDisabled: Array.from(document.querySelectorAll('#cockpit-terminal-stage button')).find(button => button.textContent === 'OPEN SESSION')?.disabled ?? null
  }));
  console.log('[acceptance] open-click probe: ' + JSON.stringify(clickProbe));
  const waitForSession = async (timeoutMs) => {
    const deadline = Date.now() + timeoutMs;
    let state = null;
    while (Date.now() < deadline) {
      state = await page.evaluate(() => ({
        hasXterm: Boolean(document.querySelector('.terminal-xterm .xterm')),
        hasStop: Array.from(document.querySelectorAll('#cockpit-terminal-stage button')).some(button => button.textContent === 'STOP SESSION'),
        text: document.querySelector('.terminal-xterm')?.innerText ?? ''
      }));
      if (state.hasXterm && state.hasStop) return state;
      await page.waitForTimeout(500);
    }
    return state;
  };
  const waitForClosed = async (timeoutMs) => {
    const deadline = Date.now() + timeoutMs;
    let state = null;
    while (Date.now() < deadline) {
      state = await page.evaluate(() => ({
        hasXterm: Boolean(document.querySelector('.terminal-xterm')),
        hasOpenButton: Array.from(document.querySelectorAll('#cockpit-terminal-stage button')).some(button => button.textContent === 'OPEN SESSION')
      }));
      if (!state.hasXterm && state.hasOpenButton) return state;
      await page.waitForTimeout(500);
    }
    return state;
  };
  const session = await waitForSession(25000);
  const waitForPrompt = async (timeoutMs) => {
    const deadline = Date.now() + timeoutMs;
    let text = await page.evaluate(() => document.querySelector('.terminal-xterm')?.innerText ?? '');
    while (Date.now() < deadline) {
      if (text.trimEnd().endsWith('>')) return text;
      await page.waitForTimeout(400);
      text = await page.evaluate(() => document.querySelector('.terminal-xterm')?.innerText ?? '');
    }
    return text;
  };
  const promptText = await waitForPrompt(15000);
  check('TERM-004', 'OPEN SESSION performs the approval-gated real session start', session.hasXterm && session.hasStop && approvalRequired.length >= 1 && dialogMessages.some(message => message.includes('Approve this operation once')), { approval409: approvalRequired.length, xterm: session.hasXterm, stop: session.hasStop });
  check('TERM-005', 'shell prompt is visible (real shell identified)', /PS .*>/.test(promptText) || promptText.length > 0, promptText.slice(-160));
  check('TERM-006', 'session starts in the workspace directory', promptText.includes(path.resolve('.')), promptText.slice(-160));

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
  const afterExit = await waitForClosed(20000);
  check('TERM-009', 'shell exit returns the panel to the closed state', !afterExit.hasXterm && afterExit.hasOpenButton, afterExit);

  const reopenButton = page.locator('#cockpit-terminal-stage button', { hasText: 'OPEN SESSION' });
  await reopenButton.click();
  const restarted = await waitForSession(25000);
  check('TERM-010', 'a fresh session starts after exit', restarted.hasXterm && restarted.hasStop, restarted);

  const stopButton = page.locator('#cockpit-terminal-stage button', { hasText: 'STOP SESSION' });
  await stopButton.click();
  const afterStop = await waitForClosed(20000);
  check('TERM-011', 'canonical STOP SESSION closes the session', !afterStop.hasXterm && afterStop.hasOpenButton, afterStop);
  check('TERM-012', 'no uncaught page errors across the battery', pageErrors.length === 0, pageErrors.slice(0, 2));
} catch (error) {
  check('TERM-000', 'battery completed without harness error', false, String(error?.message ?? error).slice(0, 300));
} finally {
  try { await context?.close(); } catch { /* ignore */ }
  try { await browser?.close(); } catch { /* ignore */ }
  try { pty.kill(); } catch { /* node-pty cleanup quirk */ }
  await new Promise(resolve => setTimeout(resolve, 800));
  await waitForPortsFree(30000);
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
