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
