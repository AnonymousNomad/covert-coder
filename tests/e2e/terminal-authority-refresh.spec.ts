import { test, expect } from '@playwright/test';
import { promises as fs } from 'node:fs';

const pairingProofFile = process.env.AIDE_WORKSTATION_E2E_PAIRING_PROOF;
if (!pairingProofFile) throw new Error('workstation pairing proof path is unavailable');

test('Terminal discovers and reattaches to a running session after Authority pairing', async ({ page }) => {
  const pairingProof = await fs.readFile(pairingProofFile, 'utf8');
  const sessionId = 'controlled-running-session';
  let resumeResponseReturned = false;
  let resumeRequestBody: { sessionId?: string; expectedOwner?: string } | null = null;
  const pendingPrePairFailures: Array<() => void> = [];
  const requests = { providersUnauthenticated: 0, providersAuthenticated: 0, historyUnauthenticated: 0, historyAuthenticated: 0, sessionsUnauthenticated: 0, sessionsAuthenticated: 0 };
  const terminalSubscriptions: string[][] = [];
  const pageErrors: string[] = [];
  const pairingObservations: string[] = [];
  page.on('pageerror', error => pageErrors.push(`${error.name}: ${error.message}`));
  page.on('websocket', socket => {
    if (new URL(socket.url()).pathname !== '/ws') return;
    socket.on('framesent', frame => {
      const raw = typeof frame.payload === 'string' ? frame.payload : frame.payload.toString('utf8');
      try {
        const message = JSON.parse(raw) as { type?: unknown; channels?: unknown };
        if (message.type === 'subscribe' && Array.isArray(message.channels)) {
          terminalSubscriptions.push(message.channels.filter((channel): channel is string => typeof channel === 'string'));
        }
      } catch {
        // Ignore non-subscription frames without retaining authentication material.
      }
    });
  });
  page.on('dialog', async dialog => {
    if (dialog.type() === 'prompt') {
      pairingObservations.push('prompt-opened');
      try {
        await dialog.accept(pairingProof);
        pairingObservations.push('prompt-accepted');
      } catch {
        pairingObservations.push('prompt-accept-failed');
      }
    } else {
      pairingObservations.push(`dialog-${dialog.type()}`);
      if (dialog.message().includes('POST /api/terminal/sessions/resume') || dialog.message().includes('POST /api/terminal/sessions/stop')) await dialog.accept();
      else await dialog.dismiss();
    }
  });
  page.on('request', request => {
    if (new URL(request.url()).pathname === '/api/authority/pair') pairingObservations.push('pair-request-started');
  });
  page.on('requestfailed', request => {
    if (new URL(request.url()).pathname === '/api/authority/pair') pairingObservations.push(`pair-request-failed:${request.failure()?.errorText ?? 'unknown'}`);
  });
  page.on('response', response => {
    if (new URL(response.url()).pathname !== '/api/authority/pair') return;
    void response.json().then((body: unknown) => {
      const envelope = body as { ok?: boolean; error?: { code?: string } };
      pairingObservations.push(`pair-response:${response.status()}:${envelope.ok === true ? 'ok' : envelope.error?.code ?? 'invalid'}`);
    }).catch(() => pairingObservations.push(`pair-response:${response.status()}:non-json`));
  });

  const json = (value: unknown): string => JSON.stringify(value);
  const ok = (data: unknown): string => json({ ok: true, data });
  const forbidden = (): string => json({ ok: false, error: { code: 'FORBIDDEN', message: 'authenticated actor required' } });
  const waitToRelease = (): Promise<void> => new Promise(resolve => pendingPrePairFailures.push(resolve));

  await page.route('**/api/terminal/providers', async route => {
    const authenticated = route.request().headers().authorization?.startsWith('Bearer ') === true;
    if (!authenticated) {
      requests.providersUnauthenticated++;
      await waitToRelease();
      await route.fulfill({ status: 403, contentType: 'application/json', body: forbidden() });
      return;
    }
    requests.providersAuthenticated++;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: ok({ providers: [{
        id: 'native',
        label: 'Native terminal',
        state: 'available',
        detail: 'Browser regression fixture; no shell is spawned by this test.',
        shells: [{ id: 'pwsh', label: 'PowerShell', path: 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe' }]
      }] })
    });
  });

  await page.route('**/api/tasks/status', async route => {
    const authenticated = route.request().headers().authorization?.startsWith('Bearer ') === true;
    if (!authenticated) {
      requests.historyUnauthenticated++;
      await waitToRelease();
      await route.fulfill({ status: 403, contentType: 'application/json', body: forbidden() });
      return;
    }
    requests.historyAuthenticated++;
    await route.fulfill({ status: 200, contentType: 'application/json', body: ok({ jobs: [] }) });
  });

  const session = {
    sessionId, owner: 'controlled-previous-actor', provider: 'native', shell: 'pwsh',
    cwd: 'C:\\controlled-workspace', cols: 120, rows: 35, state: 'running',
    createdAt: Date.now(), exitCode: null, cleanup: 'pending'
  };
  let sessionOwner = session.owner;
  let sessionState: 'running' | 'stopped' = 'running';
  let stopResponseReturned = false;
  await page.route('**/api/terminal/sessions/resume', async route => {
    resumeRequestBody = route.request().postDataJSON() as { sessionId?: string; expectedOwner?: string };
    sessionOwner = 'controlled-current-actor';
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: ok({ session: { ...session, owner: sessionOwner }, scrollbackTruncated: false })
    });
    resumeResponseReturned = true;
  });

  await page.route('**/api/terminal/sessions/stop', async route => {
    const requestBody = route.request().postDataJSON() as { sessionId?: string };
    expect(requestBody).toEqual({ sessionId });
    sessionState = 'stopped';
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: ok({ sessionId, state: 'stopped', cleanup: 'clean' })
    });
    stopResponseReturned = true;
  });

  await page.route('**/api/terminal/sessions', async route => {
    const authenticated = route.request().headers().authorization?.startsWith('Bearer ') === true;
    if (!authenticated) {
      requests.sessionsUnauthenticated++;
      await waitToRelease();
      await route.fulfill({ status: 403, contentType: 'application/json', body: forbidden() });
      return;
    }
    requests.sessionsAuthenticated++;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: ok({ sessions: [{ ...session, owner: sessionOwner, state: sessionState, cleanup: sessionState === 'stopped' ? 'clean' : 'pending' }] })
    });
  });

  await page.addInitScript(() => {
    (globalThis as typeof globalThis & { __AIDE_RUNTIME_CONFIG__?: { facadeOrigin: string } }).__AIDE_RUNTIME_CONFIG__ = {
      facadeOrigin: window.location.origin
    };
  });

  try {
    await page.goto('/');
    const terminalWindow = page.locator('.desktop-window[data-instance-id="terminal"]');
    const nativeProvider = terminalWindow.locator('.terminal-provider.available').filter({ hasText: 'Native terminal' });
    if (await terminalWindow.count() === 0) {
      await page.getByRole('button', { name: 'Terminal application' }).click();
    }
    await expect(terminalWindow).toBeVisible();
    await expect.poll(() => requests.providersUnauthenticated).toBeGreaterThan(0);
    await expect.poll(() => requests.historyUnauthenticated).toBeGreaterThan(0);

    await page.getByRole('button', { name: 'Pair browser session' }).click();
    try {
      await expect(page.locator('[aria-label="Authority paired: PAIRED"]')).toBeVisible();
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(`${detail}; sanitized pairing observations: ${pairingObservations.join(', ') || 'none'}`);
    }
    await expect.poll(() => requests.providersAuthenticated).toBeGreaterThan(0);
    await expect.poll(() => requests.historyAuthenticated).toBeGreaterThan(0);
    await expect.poll(() => requests.sessionsAuthenticated).toBeGreaterThan(0);
    await expect.poll(() => terminalSubscriptions.some(channels => channels.includes('terminal'))).toBe(true);
    await expect(nativeProvider).toBeVisible();
    await expect(terminalWindow.getByRole('button', { name: 'OPEN SESSION' })).toBeVisible();
    await expect(terminalWindow.locator('.terminal-body .panel-empty')).toContainText('No task history yet');

    for (const release of pendingPrePairFailures.splice(0)) release();
    await expect(nativeProvider).toBeVisible();
    await expect(terminalWindow.locator('.terminal-providers .panel-error')).toHaveCount(0);
    await expect(terminalWindow.getByRole('button', { name: 'OPEN SESSION' })).toBeVisible();
    await expect(terminalWindow.locator('.terminal-body .panel-error')).toHaveCount(0);
    const reattach = terminalWindow.getByRole('button', { name: `Reattach terminal session ${sessionId}` });
    await expect(reattach).toBeVisible();
    await reattach.click();
    await expect.poll(() => resumeResponseReturned).toBe(true);
    expect(resumeRequestBody).toEqual({ sessionId, expectedOwner: 'controlled-previous-actor' });
    await expect(terminalWindow.locator('.terminal-session-meta-item').filter({ hasText: `session=${sessionId.slice(0, 8)}` })).toBeVisible();
    await expect(terminalWindow.locator('.terminal-session-state')).toContainText('RUNNING');
    await expect(terminalWindow.locator('.terminal-xterm')).toBeVisible();
    await expect(terminalWindow.locator('.terminal-resume-row')).toHaveCount(0);

    await terminalWindow.getByRole('button', { name: 'STOP SESSION' }).click();
    await expect.poll(() => stopResponseReturned).toBe(true);
    await expect(terminalWindow.locator('.terminal-session')).toContainText(/Session stopped/i);
    await expect(terminalWindow.getByRole('button', { name: 'OPEN SESSION' })).toBeVisible();
    expect(sessionState).toBe('stopped');
    expect(pageErrors).toEqual([]);
  } finally {
    for (const release of pendingPrePairFailures.splice(0)) release();
  }
});