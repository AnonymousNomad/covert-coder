import { startReview } from './cockpit-live-review.mjs';
const review = await startReview({ approveAllLocalOperations: true });
try {
  await review.page.waitForTimeout(15_000);
  await review.page.locator('[data-item-id="models"]').click();
  const panel = review.page.locator('.models-panel:visible');
  await panel.waitFor({ timeout: 60_000 });
  await review.page.waitForTimeout(15_000);
  const text = await panel.innerText().catch(error => `PANEL_READ_FAILED ${error}`);
  const screenshot = await review.capture('hardening-debug-models');
  console.log(JSON.stringify({ screenshot, text: text.slice(0, 12000), pageErrors: review.errors, httpFailures: review.httpFailures }, null, 2));
} finally {
  await review.close();
}
