// Real first-run model bootstrap acceptance driver.
// It uses only visible cockpit controls after the canonical stack is paired.
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startReview } from './cockpit-live-review.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const evidenceDir = path.join(root, '.aide', 'model-bootstrap-review');
await mkdir(evidenceDir, { recursive: true });

const review = await startReview({ approveAllLocalOperations: true });
const page = review.page;
const evidence = { steps: [], pageErrors: review.errors, httpFailures: review.httpFailures };
const record = (step, value) => evidence.steps.push({ step, value });
const shot = async name => {
  const target = path.join(evidenceDir, `${name}.png`);
  await page.screenshot({ path: target, fullPage: true });
  return target;
};
await writeFile(path.join(evidenceDir, 'result.json'), JSON.stringify(evidence, null, 2));

try {
  await page.waitForTimeout(12_000);
  const skip = page.getByRole('button', { name: 'SKIP', exact: true });
  if (await skip.isVisible()) await skip.click();
  await page.locator('[data-item-id="models"]').click();
  await page.waitForTimeout(2_000);
  const visibleModels = page.locator('.models-panel:visible');
  await visibleModels.waitFor({ timeout: 60_000 });
  await visibleModels.getByText('NO LOCAL MODELS READY', { exact: true }).waitFor({ timeout: 60_000 });
  record('zero-model-screen', { screenshot: await shot('01-zero-model'), text: await page.locator('#cockpit-center').innerText() });

  await visibleModels.getByRole('button', { name: 'INSTALL A LOCAL MODEL', exact: true }).click();
  await visibleModels.getByText('QUICK START · LIVE HUB RECOMMENDATIONS', { exact: true }).waitFor({ timeout: 60_000 });
  await page.waitForFunction(() => {
    const status = document.querySelector('.models-quick-start-status')?.textContent ?? '';
    return status === 'CURRENT HUB DATA' || document.querySelector('.models-hub-warning') !== null;
  }, undefined, { timeout: 180_000 });
  await page.waitForTimeout(1_000);
  record('live-starters', { screenshot: await shot('02-live-starters'), text: await page.locator('.models-quick-start').innerText() });

  const starterCards = visibleModels.locator('.models-starter-card:visible');
  const cardCount = await starterCards.count();
  let selectedCard = -1;
  for (let index = 0; index < cardCount; index += 1) {
    const candidateButton = starterCards.nth(index).getByRole('button', { name: 'INSTALL & SET UP', exact: true });
    if (await candidateButton.count() > 0 && await candidateButton.isEnabled()) { selectedCard = index; break; }
  }
  record('starter-selection', { cardCount, selectedCard });
  if (selectedCard < 0) throw new Error('No live starter had a truthful installable fit.');
  await starterCards.nth(selectedCard).getByRole('button', { name: 'INSTALL & SET UP', exact: true }).click();
  // A real Hugging Face transfer can be slow on the operator host. Keep the
  // stack alive long enough to observe the first durable job projection; this
  // is evidence-driver timing only and does not alter product timeouts.
  await visibleModels.locator('.model-acquisition-job-status:visible').filter({ hasText: /DOWNLOADING|VERIFYING|REGISTERING|STARTING|READY/ }).first().waitFor({ timeout: 900_000 });
  record('download-started', { screenshot: await shot('03-download-started'), text: await visibleModels.locator('.models-download-jobs:visible').innerText() });
  await page.waitForFunction(() => {
    const statuses = [...document.querySelectorAll('.models-panel .model-acquisition-job-status')]
      .filter(node => node.offsetParent !== null)
      .map(node => node.textContent ?? '');
    return statuses.some(status => status === 'READY' || status === 'FAILED' || status === 'CANCELLED');
  }, undefined, { timeout: 1_800_000 });
  const acquisitionText = await visibleModels.locator('.models-download-jobs:visible').innerText();
  if (!acquisitionText.includes('READY')) throw new Error(`model bootstrap did not reach READY: ${acquisitionText}`);
  record('model-ready', { screenshot: await shot('04-model-ready'), text: await page.locator('#cockpit-center').innerText() });

  const residentButton = page.getByRole('button', { name: 'USE WITH RESIDENT', exact: true });
  if (await residentButton.isVisible()) await residentButton.click();
  else await page.locator('[data-item-id="resident"]').click();
  await page.locator('#chat-model').waitFor({ timeout: 60_000 });
  await page.waitForTimeout(5_000);
  record('resident-after-ready', { screenshot: await shot('05-resident-ready'), text: await page.locator('.cockpit-resident-chat').innerText() });

  await page.locator('#chat-input').fill('Give me a concise local readiness summary.');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await page.locator('.chat-message.assistant .chat-message-body').last().waitFor({ timeout: 180_000 });
  await page.waitForTimeout(3_000);
  record('resident-local-response', { screenshot: await shot('06-resident-local-response'), text: await page.locator('.cockpit-resident-chat').innerText() });
} finally {
  await writeFile(path.join(evidenceDir, 'result.json'), JSON.stringify(evidence, null, 2));
  await review.close();
}

console.log(JSON.stringify({ evidenceDir, ...evidence }, null, 2));
