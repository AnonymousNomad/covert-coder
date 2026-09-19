// Local real-stack review driver. No API fixtures and no persisted credentials.
import { createRequire } from 'node:module';
import process from 'node:process';
import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

export async function startReview({ approveTerminal = false } = {}) {
  const { spawn } = require('node-pty');
  const { chromium } = require('@playwright/test');
  const ports = { ui: 4273, facade: 4877, arch: 4878, legacy: 4879 };
  const origin = `http://127.0.0.1:${ports.ui}`;
  const launcher = spawn('cmd.exe', ['/d', '/c', 'npm start'], {
    name: 'xterm-color', cols: 140, rows: 35, cwd: root, useConptyDll: false,
    env: { ...process.env, AIDE_UI_PORT: String(ports.ui),
      AIDE_FACADE_PORT: String(ports.facade), AIDE_ARCH_PORT: String(ports.arch),
      AIDE_LEGACY_PORT: String(ports.legacy), AIDE_ALLOWED_ORIGINS: origin,
      AIDE_CLOSED_LOOP: 'false', AIDE_START_TIMEOUT_MS: '120000' }
  });
  let output = '';
  let exited = false;
  launcher.onData(data => { output = (output + data).slice(-32000); });
  launcher.onExit(() => { exited = true; });
  let browser;
  const safeLog = () => output.replace(/One-use pairing code[^\r\n]*/g, 'Pairing code: [redacted]');
  async function close() {
    await browser?.close();
    launcher.kill();
    await pause(1000);
    if (!exited) await new Promise(resolve => execFile('taskkill.exe', ['/PID', String(launcher.pid), '/T', '/F'], { windowsHide: true }, () => resolve()));
  }
  try {
    const deadline = Date.now() + 240000;
    while (!/Covert frontend=typed ui=http/.test(output)) {
      if (exited || Date.now() > deadline) throw new Error(`Canonical launch did not become ready. ${safeLog()}`);
      await pause(250);
    }
    browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-gpu'], timeout: 90000 });
    const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
    await context.addInitScript(facadeOrigin => { globalThis.__AIDE_RUNTIME_CONFIG__ = { facadeOrigin }; }, `http://127.0.0.1:${ports.facade}`);
    const page = await context.newPage();
    const errors = [];
    const httpFailures = [];
    page.on('response', response => {
      if (response.status() >= 400) httpFailures.push({ path: new URL(response.url()).pathname, status: response.status() });
    });
    page.on('pageerror', error => errors.push(error.message));
    async function pairing() {
      output = '';
      launcher.write('pair\r');
      const until = Date.now() + 65000;
      while (Date.now() < until) {
        const plain = output.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '');
        const proof = plain.match(/One-use pairing code \(5 min\):\s*([^\s]+)/)?.[1];
        if (proof) { output = ''; return proof; }
        await pause(100);
      }
      throw new Error('Interactive launcher did not issue a pairing code.');
    }
    page.on('dialog', async dialog => {
      if (dialog.type() === 'prompt' && /Pair this Covert/.test(dialog.message())) await dialog.accept(await pairing());
      else if (approveTerminal && dialog.type() === 'confirm' && dialog.message().startsWith('Approve this operation once?')) {
        let operation;
        try { operation = JSON.parse(dialog.message().slice(dialog.message().indexOf('\n') + 1)); } catch { /* deny malformed */ }
        if (operation?.workspace?.toLowerCase() === root.toLowerCase() && ['terminal.session.start', 'terminal.session.stop'].includes(operation.operation)) await dialog.accept();
        else await dialog.dismiss();
      }
      else await dialog.dismiss();
    });
    await page.goto(origin, { waitUntil: 'commit', timeout: 90000 });
    await page.waitForFunction(() => document.querySelector('#app[data-active-panel], #covert-pairing-code') !== null, { timeout: 90000 });
    if (await page.locator('#covert-pairing-code').isVisible()) {
      await page.locator('#covert-pairing-code').fill(await pairing());
      await page.getByRole('button', { name: 'PAIR SESSION', exact: true }).click();
    }
    await page.locator('#app[data-active-panel]').waitFor({ timeout: 90000 });
    return { page, context, ports, errors, httpFailures, launcherPid: launcher.pid, pairing, close,
      async capture(name) {
        const directory = path.join(root, '.aide', 'ui-review');
        await mkdir(directory, { recursive: true });
        const target = path.join(directory, `${name}.png`);
        await page.screenshot({ path: target });
        return target;
      }
    };
  } catch (error) { await close(); throw error; }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const label = process.argv[2] ?? 'review';
  const review = await startReview();
  console.log(`Canonical stack and Edge ready; launcher=${review.launcherPid}`);
  const results = [];
  try {
    const { page } = review;
    await page.waitForTimeout(20000);
    const skip = page.getByRole('button', { name: 'SKIP', exact: true });
    if (await skip.isVisible()) await skip.click();
    await page.waitForTimeout(1500);
    for (const id of ['command-center', 'resident', 'projects', 'editor', 'terminal', 'models', 'skills', 'memory', 'verification', 'security', 'extensions', 'settings']) {
      await page.locator(`[data-item-id="${id}"]`).click();
      await page.waitForTimeout(750);
      const screenshot = await review.capture(`${label}-${id}`);
      const controls = await page.locator('button:visible, input:visible, select:visible, textarea:visible').evaluateAll(nodes => nodes.map(node => ({
        text: (node.getAttribute('aria-label') || node.textContent || node.getAttribute('placeholder') || '').trim().slice(0, 120),
        disabled: node.matches(':disabled'), title: node.getAttribute('title')
      })));
      const text = await page.locator('#cockpit-center').innerText();
      results.push({ id, screenshot, text, controls });
      console.log(`Captured ${id}`);
    }
    await writeFile(path.join(root, '.aide', 'ui-review', `${label}-surfaces.json`), JSON.stringify({ label, results, errors: review.errors, httpFailures: review.httpFailures }, null, 2));
    console.log(JSON.stringify({ screenshots: results.length, pageErrors: review.errors, directory: path.join(root, '.aide', 'ui-review') }));
  } finally { await review.close(); console.log(`Closed browser and launcher tree ${review.launcherPid}`); }
}
