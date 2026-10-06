import { test, expect } from '@playwright/test';
import { promises as fs } from 'node:fs';
import { randomUUID } from 'node:crypto';

const proofFile = process.env.AIDE_WORKSTATION_E2E_PAIRING_PROOF;
if (!proofFile) throw new Error('workstation pairing proof path is unavailable');

test('two workstation windows own distinct native PTYs and preserve their sessions through window actions', async ({ page }) => {
  test.skip(process.platform !== 'win32', 'Windows native-PTY acceptance requires the Windows host');
  let proof = await fs.readFile(`${proofFile}.dual-terminals`, 'utf8');
  const errors: string[] = [];
  const opened: string[] = [];
  const geometry = new Map<string, { cols: number; rows: number }>();
  page.on('pageerror', error => errors.push(`${error.name}: ${error.message}`));
  page.on('dialog', async dialog => {
    if (dialog.type() === 'prompt') await dialog.accept(proof);
    else if (dialog.message().startsWith('Approve this operation once?') && /POST \/api\/terminal\/sessions(?:\/(?:stop|resume))?(?:\s|$)/.test(dialog.message())) await dialog.accept();
    else await dialog.dismiss();
  });
  page.on('response', response => {
    if (response.request().method() === 'GET' && new URL(response.url()).pathname === '/api/terminal/sessions') {
      void response.json().then((raw: { ok?: boolean; data?: { sessions?: Array<{ sessionId: string; cols: number; rows: number }> } }) => {
        for (const session of raw.data?.sessions ?? []) geometry.set(session.sessionId, { cols: session.cols, rows: session.rows });
      });
      return;
    }
    if (response.request().method() !== 'POST' || new URL(response.url()).pathname !== '/api/terminal/sessions') return;
    void response.json().then((raw: { ok?: boolean; data?: { session?: { sessionId?: string } } }) => {
      const id = raw.ok ? raw.data?.session?.sessionId : undefined;
      if (id) opened.push(id);
    });
  });
  await page.addInitScript(() => {
    (globalThis as typeof globalThis & { __AIDE_RUNTIME_CONFIG__?: { facadeOrigin: string } }).__AIDE_RUNTIME_CONFIG__ = { facadeOrigin: window.location.origin };
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Pair browser session', exact: true }).click();
  await expect(page.locator('[aria-label="Authority paired: PAIRED"]')).toBeVisible();
  const first = page.locator('.desktop-window[data-instance-id="terminal"]');
  const second = page.locator('.desktop-window[data-instance-id="terminal:2"]');
  for (const frame of [first, second]) {
    await expect(frame).toBeVisible();
    // A missing native prerequisite fails qualification; it cannot become a fake green session.
    await expect(frame.locator('.terminal-provider.available').filter({ hasText: /native/i })).toBeVisible();
    await frame.locator('.terminal-open .terminal-select').first().selectOption('native');
    const shell = frame.locator('.terminal-open .terminal-select').nth(1);
    const hasPwsh = await shell.locator('option[value="pwsh"]').count();
    await shell.selectOption(hasPwsh ? 'pwsh' : 'powershell');
  }
  try {
    await first.getByRole('button', { name: 'OPEN SESSION', exact: true }).click();
    await expect.poll(() => opened.length).toBe(1);
    await second.getByRole('button', { name: 'OPEN SESSION', exact: true }).click();
    await expect.poll(() => opened.length).toBe(2);
    expect(new Set(opened).size).toBe(2);
    const [firstSessionId, secondSessionId] = opened;
    if (!firstSessionId || !secondSessionId) throw new Error('Both canonical session IDs are required');
    const sessionIds = [firstSessionId, secondSessionId] as const;
    await expect(first.locator('.terminal-session-state')).toContainText('RUNNING');
    await expect(second.locator('.terminal-session-state')).toContainText('RUNNING');
    const suffixA = randomUUID().replaceAll('-', '');
    const suffixB = randomUUID().replaceAll('-', '');
    const a = `COVERT_A_${suffixA}`;
    const b = `COVERT_B_${suffixB}`;
    await first.locator('.xterm-helper-textarea').pressSequentially(`Write-Output ('COVERT_A_' + '${suffixA}')`);
    await first.locator('.xterm-helper-textarea').press('Enter');
    await second.locator('.xterm-helper-textarea').pressSequentially(`Write-Output ('COVERT_B_' + '${suffixB}')`);
    await second.locator('.xterm-helper-textarea').press('Enter');
    await expect(first.locator('.xterm-screen')).toContainText(a);
    await expect(second.locator('.xterm-screen')).toContainText(b);
    await expect(first.locator('.xterm-screen')).not.toContainText(b);
    await expect(second.locator('.xterm-screen')).not.toContainText(a);
    await first.getByRole('button', { name: 'REFRESH', exact: true }).click();
    await expect.poll(() => geometry.get(firstSessionId)?.cols ?? 0).toBeGreaterThan(0);
    const beforeCols = geometry.get(firstSessionId)!.cols;
    await first.getByRole('button', { name: 'Maximize or restore window', exact: true }).click();
    await expect.poll(async () => {
      await first.getByRole('button', { name: 'REFRESH', exact: true }).click();
      return geometry.get(firstSessionId)?.cols ?? beforeCols;
    }).not.toBe(beforeCols);
    await first.getByRole('button', { name: 'Maximize or restore window', exact: true }).click();
    await first.getByRole('button', { name: 'Minimize window', exact: true }).click();
    await expect(first).toBeHidden();
    await page.getByRole('button', { name: 'Focus or restore Terminal, minimized', exact: true }).click();
    await expect(first).toBeVisible();
    await second.getByRole('button', { name: 'Close window', exact: true }).click();
    await expect(second).toHaveCount(0);
    await page.getByRole('button', { name: 'New terminal window', exact: true }).click();
    await expect(second).toBeVisible();
    await expect(second.locator('.terminal-session-meta')).toContainText(secondSessionId.slice(0, 8));
    expect(opened.length).toBe(2);
    const suffixC = randomUUID().replaceAll('-', '');
    const c = `COVERT_REOPEN_${suffixC}`;
    await second.locator('.xterm-helper-textarea').pressSequentially(`Write-Output ('COVERT_REOPEN_' + '${suffixC}')`);
    await second.locator('.xterm-helper-textarea').press('Enter');
    await expect(second.locator('.xterm-screen')).toContainText(c);
    await expect(first.locator('.xterm-screen')).not.toContainText(c);
    proof = await fs.readFile(`${proofFile}.dual-restart`, 'utf8');
    await page.reload();
    await page.getByRole('button', { name: 'Pair browser session', exact: true }).click();
    await expect(page.locator('[aria-label="Authority paired: PAIRED"]')).toBeVisible();
    for (const [index, frame] of [first, second].entries()) {
      const sessionId = sessionIds[index];
      if (!sessionId) throw new Error('Unexpected terminal window index');
      await frame.getByRole('button', { name: `Reattach terminal session ${sessionId}`, exact: true }).click();
      await expect(frame.locator('.terminal-session-state')).toContainText('RUNNING');
      await expect(frame.locator('.terminal-session-meta')).toContainText(sessionId.slice(0, 8));
    }
    const suffixD = randomUUID().replaceAll('-', '');
    const d = `COVERT_RESTORE_${suffixD}`;
    await first.locator('.xterm-helper-textarea').pressSequentially(`Write-Output ('COVERT_RESTORE_' + '${suffixD}')`);
    await first.locator('.xterm-helper-textarea').press('Enter');
    await expect(first.locator('.xterm-screen')).toContainText(d);
    await expect(second.locator('.xterm-screen')).not.toContainText(d);
    expect(opened.length).toBe(2);
    await page.screenshot({ path: test.info().outputPath('covert-retro-dual-native-terminals.png'), fullPage: true });
    expect(errors).toEqual([]);
  } finally {
    for (const frame of [first, second]) {
      const stop = frame.getByRole('button', { name: 'STOP SESSION', exact: true });
      if (await stop.isVisible()) {
        await stop.click();
        await expect(frame.locator('.terminal-session')).toContainText(/Session stopped/i);
      }
    }
  }
});
