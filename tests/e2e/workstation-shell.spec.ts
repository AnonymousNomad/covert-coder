import { test, expect } from '@playwright/test';

test('Cipher console prioritizes chat and progressively discloses workspace status', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(`${error.name}: ${error.message}`));

  await page.goto('/');
  const shell = page.locator('.covert-desktop-shell');
  await expect(shell).toBeVisible();

  const resident = shell.locator('.desktop-window[data-app-id="resident"]');
  await expect(resident).toBeVisible();
  const chat = resident.locator('.cockpit-resident-chat');
  const chatInput = chat.locator('#chat-input');
  const chatSend = chat.locator('#chat-send');
  const status = resident.locator('.cockpit-resident-context-disclosure');
  const statusSummary = status.locator(':scope > summary');

  await expect(statusSummary).toContainText(/\d\/4 SOURCES RETURNING DATA/);
  await expect(status).not.toHaveAttribute('open', '');
  await expect(chatInput).toBeVisible();
  await expect(chatSend).toBeVisible();

  const chatPrecedesStatus = await resident.evaluate(root => {
    const chatPanel = root.querySelector('.cockpit-resident-chat');
    const details = root.querySelector('.cockpit-resident-context-disclosure');
    return chatPanel !== null && details !== null
      && Boolean(chatPanel.compareDocumentPosition(details) & Node.DOCUMENT_POSITION_FOLLOWING);
  });
  expect(chatPrecedesStatus).toBe(true);

  const controlsFitWindow = await resident.evaluate(root => {
    const bounds = root.querySelector('.desktop-window-content')?.getBoundingClientRect();
    const input = root.querySelector('#chat-input')?.getBoundingClientRect();
    const send = root.querySelector('#chat-send')?.getBoundingClientRect();
    return bounds !== undefined && input !== undefined && send !== undefined
      && input.top >= bounds.top && input.bottom <= bounds.bottom
      && send.top >= bounds.top && send.bottom <= bounds.bottom;
  });
  expect(controlsFitWindow).toBe(true);

  await statusSummary.click();
  await expect(status).toHaveAttribute('open', '');
  await expect(status.locator('.cockpit-resident-empty').first()).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test('file mutation event receiver preserves a dirty Monaco buffer and cancels an unconfirmed overwrite', async ({ page }) => {
  const fixtureToken = 'test-only-authority-token-0123456789abcdef';
  const originalDisk = 'export const value = "base";\n';
  const agentDisk = 'export const value = "agent edit";\n';
  let diskContent = originalDisk;
  let fileWriteRequests = 0;
  let fileReadRequests = 0;
  const pageErrors: string[] = [];
  let publishMutation: (() => void) | null = null;
  let agentSubscribed = false;
  let pairingPromptSeen = false;
  let pairedSessionRead = false;

  const ok = (data: unknown): string => JSON.stringify({ ok: true, data });
  const unavailable = (): string => JSON.stringify({ ok: false, error: { code: 'NOT_READY', message: 'fixture endpoint unavailable' } });

  // These API responses isolate the browser receiver; Authority and AgentLoop publication are proven separately by the real paired backend test.
  await page.route('**/api/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const authenticated = request.headers().authorization === `Bearer ${fixtureToken}`;
    if (url.pathname === '/api/authority/pair' && request.method() === 'POST') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: ok({ token: fixtureToken, actor_id: 'fixture-operator', expires_at: Date.now() + 600000 }) });
      return;
    }
    if (url.pathname === '/api/health') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: ok({ version: 'e2e', uptimeMs: 1, workspace: 'fixture', freeMemoryMB: 0, state: 'UNKNOWN', components: [], checked_at: new Date().toISOString() }) });
      return;
    }
    if (url.pathname === '/api/workspace') {
      await route.fulfill({ status: authenticated ? 200 : 403, contentType: 'application/json', body: authenticated
        ? ok({ workspace: 'fixture', entries: [{ name: 'fixture.ts', kind: 'file' }] })
        : unavailable() });
      return;
    }
    // Preload the editor document so this fixture isolates dirty-buffer reconciliation; file-read Authority is not under test here.
    if (url.pathname === '/api/session' && request.method() === 'GET') {
      if (authenticated) pairedSessionRead = true;
      await route.fulfill({ status: 200, contentType: 'application/json', body: ok({ version: 1, activeTab: 'file:///fixture.ts', tabs: [{ uri: 'file:///fixture.ts' }] }) });
      return;
    }
    if (url.pathname === '/api/session' && request.method() === 'PUT') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: ok(request.postDataJSON()) });
      return;
    }
    if (url.pathname === '/api/file' && request.method() === 'GET') {
      fileReadRequests++;
      await route.fulfill({ status: 200, contentType: 'application/json', body: ok({ path: 'fixture.ts', content: diskContent, too_large: false, size: Buffer.byteLength(diskContent) }) });
      return;
    }
    if (url.pathname === '/api/file/write' && request.method() === 'POST') {
      fileWriteRequests++;
      await route.fulfill({ status: 200, contentType: 'application/json', body: ok({ path: 'fixture.ts', bytes: 0 }) });
      return;
    }
    await route.fulfill({ status: 503, contentType: 'application/json', body: unavailable() });
  });

  await page.routeWebSocket('**/ws', socket => {
    socket.onMessage(message => {
      let request: { type?: string; token?: string; channels?: string[] };
      try { request = JSON.parse(String(message)) as typeof request; }
      catch { return; }
      if (request.type === 'authenticate' && request.token === fixtureToken) {
        socket.send(JSON.stringify({ type: 'authenticated' }));
      } else if (request.type === 'subscribe' && request.channels?.includes('agent')) {
        agentSubscribed = true;
        publishMutation = () => socket.send(JSON.stringify({
          channel: 'agent', ts: Date.now(),
          data: { event: 'file_mutation', session_id: 'fixture-agent-session', paths: ['fixture.ts'], outcome: 'observed' }
        }));
      }
    });
  });

  page.on('pageerror', error => pageErrors.push(`${error.name}: ${error.message}`));
  page.on('dialog', dialog => {
    if (!pairingPromptSeen && dialog.type() === 'prompt') {
      pairingPromptSeen = true;
      void dialog.accept('fixture pairing proof longer than thirty two chars');
      return;
    }
    void dialog.dismiss();
  });
  await page.goto('/');
  await expect(page.locator('.group-tabbar .tab')).toContainText('fixture.ts');
  expect(fileReadRequests).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Pair browser session' }).click();
  await expect.poll(() => pairedSessionRead).toBe(true);
  await expect(page.locator('.desktop-workspace-gate')).toHaveCount(0);
  await expect(page.locator('.group-tabbar .tab')).toContainText('fixture.ts');
  await expect(page.locator('.monaco-editor')).toBeVisible();
  await expect.poll(() => agentSubscribed).toBe(true);

  const editor = page.locator('.monaco-editor').first();
  await editor.click();
  await page.keyboard.press('Control+a');
  await page.keyboard.type('export const value = "operator draft";');
  const tab = page.locator('.group-tabbar .tab').filter({ hasText: 'fixture.ts' });
  await expect(tab).toHaveClass(/dirty/);

  diskContent = agentDisk;
  expect(publishMutation).not.toBeNull();
  publishMutation?.();

  await expect(tab).toHaveClass(/external-conflict/);
  await expect(tab).toHaveAttribute('title', /disk version changed/);
  await page.keyboard.press('Control+s');
  await expect.poll(() => fileWriteRequests).toBe(0);
  await expect(tab).toHaveClass(/dirty/);
  await expect(tab).toHaveClass(/external-conflict/);
  await expect(editor.locator('.view-line').first()).toContainText('operator draft');
  expect(pageErrors).toEqual([]);
});
