import { test, expect } from '@playwright/test';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const appOrigin = 'http://127.0.0.1:4174';
const workspace = process.env.AIDE_WORKSTATION_E2E_WORKSPACE;
const pairingProofFile = process.env.AIDE_WORKSTATION_E2E_PAIRING_PROOF;
if (!workspace || !pairingProofFile) throw new Error('workstation fixture paths are unavailable');

test('real paired AgentLoop mutation reaches the same Monaco session and preserves its dirty draft', async ({ page }) => {
  const pairingProof = await fs.readFile(pairingProofFile, 'utf8');
  const paired = { token: null as string | null };
  const pageErrors: string[] = [];
  const authorityDialogs: string[] = [];
  const workspaceReads: string[] = [];
  const workspaceRequestHeaders: string[] = [];
  let browserFileWrites = 0;
  let phase = 'page-load';
  let lastAuthorityRoute = 'none';
  page.on('pageerror', error => pageErrors.push(`${phase} · ${error.stack ?? `${error.name}: ${error.message}`}`));
  page.on('request', request => {
    const pathname = new URL(request.url()).pathname;
    if (pathname === '/api/authority/prepare' && request.method() === 'POST') {
      try {
        const operation = request.postDataJSON() as { method?: unknown; path?: unknown };
        lastAuthorityRoute = typeof operation.method === 'string' && typeof operation.path === 'string'
          ? `${operation.method.toUpperCase()} ${operation.path}` : 'unclassified';
      } catch { lastAuthorityRoute = 'unparseable'; }
    }
    if (pathname === '/api/file/write' && request.method() === 'POST') browserFileWrites++;
    if (pathname === '/api/workspace' && request.method() === 'GET') {
      const headers = request.headers();
      const refererState = headers.referer ? (() => {
        try { return new URL(headers.referer).origin === appOrigin ? 'same-origin' : 'other-origin'; }
        catch { return 'invalid'; }
      })() : 'absent';
      workspaceRequestHeaders.push(`authorization=${headers.authorization?.startsWith('Bearer ') ? 'present' : 'absent'},origin=${headers.origin ? 'present' : 'absent'},sec-fetch-site=${headers['sec-fetch-site'] ?? 'absent'},referer=${refererState}`);
    }
  });
  page.on('response', response => {
    const request = response.request();
    if (request.method() !== 'GET' || new URL(response.url()).pathname !== '/api/workspace') return;
    void response.json().then((raw: unknown) => {
      const envelope = raw as { ok?: boolean; error?: { code?: string } };
      workspaceReads.push(`${response.status()}:${envelope.ok === true ? 'ok' : envelope.error?.code ?? 'invalid'}`);
    }).catch(() => workspaceReads.push(`${response.status()}:non-json`));
  });
  page.on('dialog', async dialog => {
    if (dialog.type() === 'prompt') {
      authorityDialogs.push(`${phase} · pairing-prompt · accepted`);
      await dialog.accept(pairingProof);
    } else {
      const category = dialog.message().startsWith('Approve this operation once?') ? 'authority-confirm' : 'other-confirm';
      authorityDialogs.push(`${phase} · ${category} · ${lastAuthorityRoute} · dismissed`);
      await dialog.dismiss();
    }
  });

  // Pairing and every protected read below go through the real local daemon.
  // Capture the in-memory test actor token only so the harness can request a
  // governed AgentLoop task for this same browser actor; do not print or persist it.
  await page.route('**/api/authority/pair', async route => {
    const response = await route.fetch();
    const envelope = await response.json() as { ok?: boolean; data?: { token?: string } };
    paired.token = envelope.data?.token ?? null;
    await route.fulfill({ response, body: JSON.stringify(envelope) });
  });
  await page.addInitScript(() => {
    (globalThis as typeof globalThis & { __AIDE_RUNTIME_CONFIG__?: { facadeOrigin: string } }).__AIDE_RUNTIME_CONFIG__ = {
      facadeOrigin: window.location.origin
    };
  });

  phase = 'pairing';
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Pair browser session' })).toBeVisible();
  await page.getByRole('button', { name: 'Pair browser session' }).click();
  await expect.poll(() => paired.token).not.toBeNull();
  const actorToken = paired.token;
  if (!actorToken) throw new Error('pair route did not return an actor token to the test harness');
  phase = 'paired-workspace-load';
  await expect(page.locator('[aria-label="Authority paired: PAIRED"]')).toBeVisible();
  try {
    await expect(page.locator('.desktop-workspace-gate')).toHaveCount(0);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`${detail}; sanitized GET /api/workspace responses: ${workspaceReads.join(', ') || 'none'}; request headers: ${workspaceRequestHeaders.join('; ') || 'none'}`);
  }
  const tab = page.locator('.group-tabbar .tab').filter({ hasText: 'fixture.ts' });
  await expect(tab).toBeVisible();
  await expect(page.locator('.monaco-editor')).toBeVisible();

  const send = async (pathname: string, body: unknown, extraHeaders: Record<string, string> = {}): Promise<unknown> => {
    const result = await page.evaluate(async ({ requestPath, requestBody, token, headers }) => {
      const response = await fetch(requestPath, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-AIDE-API-Format': 'envelope-v1',
          ...headers
        },
        body: JSON.stringify(requestBody)
      });
      return {
        status: response.status,
        envelope: await response.json() as { ok: boolean; data?: unknown; error?: { code?: string } }
      };
    }, { requestPath: pathname, requestBody: body, token: actorToken, headers: extraHeaders });
    expect(result.status, `${pathname} status ${result.status}, code ${result.envelope.error?.code ?? 'none'}`).toBe(200);
    expect(result.envelope.ok, `${pathname} rejected with ${result.envelope.error?.code ?? 'unknown'}`).toBe(true);
    return result.envelope.data;
  };

  const approvePost = async (pathname: string, body: unknown): Promise<any> => {
    const taskId = randomUUID();
    const operation = await send('/api/authority/prepare', {
      method: 'POST', path: pathname, task_id: taskId, body
    }) as { operation_id: string };
    await send('/api/authority/decision', { operation_id: operation.operation_id, decision: 'approve' });
    return send(pathname, body, { 'X-AIDE-Operation': operation.operation_id, 'X-AIDE-Task': taskId });
  };

  const editor = page.locator('.monaco-editor').first();
  await editor.click();
  await page.keyboard.press('Control+a');
  await page.keyboard.type('export const value = "operator draft";');
  phase = 'agent-loop-execution';
  await expect(tab).toHaveClass(/dirty/);

  const started = await approvePost('/api/agent/start', {
    task: 'Update fixture.ts using the approved workspace tool.',
    mode: 'act',
    chat_source: 'local'
  }) as { session_id: string };
  const readStatus = async (): Promise<{ pending_approval: { tool: string; approval_id: string } | null; state: string }> => {
    const result = await page.evaluate(async ({ sessionId, token }) => {
      const response = await fetch(`/api/agent/status?id=${encodeURIComponent(sessionId)}`, {
        headers: { Authorization: `Bearer ${token}`, 'X-AIDE-API-Format': 'envelope-v1' }
      });
      return {
        status: response.status,
        envelope: await response.json() as { ok: boolean; data?: unknown; error?: { code?: string } }
      };
    }, { sessionId: started.session_id, token: actorToken });
    expect(result.status, `agent status code ${result.envelope.error?.code ?? 'none'}`).toBe(200);
    expect(result.envelope.ok).toBe(true);
    return result.envelope.data as { pending_approval: { tool: string; approval_id: string } | null; state: string };
  };
  const approvePendingTool = async (expectedTool: string): Promise<void> => {
    await expect.poll(async () => (await readStatus()).pending_approval?.tool ?? null, { timeout: 15000 }).toBe(expectedTool);
    const waiting = await readStatus();
    if (waiting.pending_approval === null || waiting.pending_approval.tool !== expectedTool) {
      throw new Error(`AgentLoop did not remain on the expected ${expectedTool} approval`);
    }
    await approvePost('/api/agent/decision', {
      session_id: started.session_id,
      approval_id: waiting.pending_approval.approval_id,
      decision: 'approve'
    });
  };
  await approvePendingTool('checkpoint.snapshot');
  await approvePendingTool('write_file');
  await expect.poll(async () => (await readStatus()).state, { timeout: 15000 }).toBe('done');

  await expect(tab).toHaveClass(/external-conflict/);
  await expect(tab).toHaveClass(/dirty/);
  await expect(tab).toHaveAttribute('title', /disk version changed/);
  await expect(editor.locator('.view-line').first()).toContainText('operator draft');
  expect(await fs.readFile(path.join(workspace, 'fixture.ts'), 'utf8')).toBe('export const value = "agent edit";\n');

  phase = 'dirty-draft-save-refusal';
  await page.keyboard.press('Control+s');
  await expect(tab).toHaveClass(/external-conflict/);
  await expect(tab).toHaveClass(/dirty/);
  await expect.poll(() => browserFileWrites).toBe(0);
  expect(await fs.readFile(path.join(workspace, 'fixture.ts'), 'utf8')).toBe('export const value = "agent edit";\n');
  await expect.poll(() => authorityDialogs.filter(entry => entry.includes('authority-confirm · PUT /api/session · dismissed')).length)
    .toBeGreaterThan(0);
  expect(authorityDialogs.filter(entry => entry.includes('other-confirm') && !entry.includes('dirty-draft-save-refusal'))).toEqual([]);
  await expect(page.locator('[data-aide-toast-region] .aide-toast').filter({
    hasText: 'Workbench session was not saved. Current workstation state remains in memory'
  }).first()).toBeVisible();
  phase = 'cipher-interaction-mode-ui';
  await page.locator('.desktop-resident-presence').click();
  const interactionModes = page.getByRole('group', { name: 'Cipher interaction mode' });
  await expect(interactionModes).toBeVisible();
  await expect(page.locator('.chat-input')).toHaveCount(1);
  await expect(interactionModes.getByRole('button', { name: 'ASK' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.chat-model-binding')).toBeVisible();
  await interactionModes.getByRole('button', { name: 'PLAN' }).click();
  await expect(interactionModes.getByRole('button', { name: 'PLAN' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.chat-model-binding')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Start PLAN' })).toBeVisible();
  await interactionModes.getByRole('button', { name: 'ACT' }).click();
  await expect(interactionModes.getByRole('button', { name: 'ACT' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Start ACT' })).toBeVisible();
  expect(pageErrors, `unexpected browser errors; sanitized authority dialogs: ${authorityDialogs.join('; ') || 'none'}`).toEqual([]);
});
