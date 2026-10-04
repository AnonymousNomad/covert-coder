import { test, expect } from '@playwright/test';

test('browser startup presents secure pairing in the page without a native prompt', async ({ page }) => {
  let nativePromptShown = false;
  page.on('dialog', async dialog => {
    if (dialog.type() === 'prompt') nativePromptShown = true;
    await dialog.dismiss();
  });

  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Secure browser pairing' })).toBeVisible();
  await expect(page.getByLabel('One-use pairing code')).toBeVisible();
  expect(nativePromptShown).toBe(false);
});

test('an invalid or expired code leaves pairing available and reports a clear retry', async ({ page }) => {
  await page.route('**/api/authority/pair', async route => {
    if (route.request().method() === 'OPTIONS') return route.continue();
    await route.fulfill({
      status: 403,
      contentType: 'application/json',
      body: JSON.stringify({ ok: false, error: { code: 'FORBIDDEN', message: 'Pairing proof rejected' } })
    });
  });

  await page.goto('/');
  const input = page.getByLabel('One-use pairing code');
  await input.fill('x'.repeat(43));
  await page.getByRole('button', { name: 'Pair Covert' }).click();

  await expect(page.getByRole('alert')).toContainText(/invalid, expired, or already used/i);
  await expect(input).toHaveValue('');
  await expect(page.getByRole('button', { name: 'Pair Covert' })).toBeEnabled();
  expect(await page.evaluate(() => localStorage.length)).toBe(0);
});

test('a pairing transport failure is not mislabeled as a bad code', async ({ page }) => {
  await page.route('**/api/authority/pair', async route => {
    if (route.request().method() === 'OPTIONS') return route.continue();
    await route.abort('failed');
  });

  await page.goto('/');
  await page.getByLabel('One-use pairing code').fill('x'.repeat(43));
  await page.getByRole('button', { name: 'Pair Covert' }).click();

  await expect(page.getByRole('alert')).toContainText(/could not verify the code/i);
  await expect(page.getByLabel('One-use pairing code')).toHaveValue('');
});

test('a valid pairing response transitions from the local pairing form into Covert', async ({ page }) => {
  await page.route('**/api/authority/pair', async route => {
    if (route.request().method() === 'OPTIONS') return route.continue();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        data: { token: 'local-test-authority-token-000000000000', actor_id: 'browser-test', expires_at: Date.now() + 60_000 }
      })
    });
  });

  await page.goto('/');
  await page.getByLabel('One-use pairing code').fill('x'.repeat(43));
  await page.getByRole('button', { name: 'Pair Covert' }).click();

  await expect(page.locator('#app[data-active-panel]')).toBeVisible();
  await expect(page.locator('.cockpit-resident')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Secure browser pairing' })).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.length)).toBe(0);
});
