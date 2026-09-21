import { startReview } from './cockpit-live-review.mjs';
const review = await startReview({ approveAllLocalOperations: true });
try {
  await review.page.waitForTimeout(15_000);
  await review.page.locator('[data-item-id="models"]').click();
  const panel = review.page.locator('.models-panel:visible');
  await panel.waitFor({ timeout: 60_000 });
  await review.page.waitForTimeout(15_000);
  const card = review.page.locator('.model-card', { hasText: 'SmolLM2-360M-Instruct-Q4_K_M' });
  await card.waitFor({ timeout: 60_000 });
  const before = (await card.locator('.model-card-status').textContent())?.trim();
  if (before !== 'READY') {
    await card.getByRole('button', { name: 'START MODEL', exact: true }).click();
    await review.page.waitForFunction(() => [...document.querySelectorAll('.model-card')].some(node => (node.textContent ?? '').includes('SmolLM2-360M-Instruct-Q4_K_M') && node.querySelector('.model-card-status')?.textContent === 'READY'), undefined, { timeout: 180_000 });
  }
  const readyCard = review.page.locator('.model-card', { hasText: 'SmolLM2-360M-Instruct-Q4_K_M' });
  await readyCard.getByRole('button', { name: 'TEST MODEL', exact: true }).click();
  await review.page.waitForTimeout(30_000);
  console.log(JSON.stringify({
    before,
    text: (await panel.innerText()).slice(-6000),
    feedback: await panel.locator('.models-feedback').textContent(),
    buttons: await readyCard.locator('button').allTextContents(),
    errors: review.errors,
    httpFailures: review.httpFailures
  }, null, 2));
  const stop = readyCard.getByRole('button', { name: 'STOP MODEL', exact: true });
  if (await stop.isVisible().catch(() => false)) await stop.click();
  await review.page.waitForTimeout(3_000);
} finally {
  await review.close();
}
