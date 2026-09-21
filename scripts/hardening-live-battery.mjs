// Bounded real-stack evidence for model role persistence and restart continuity.
// The model is pre-acquired only so this battery can exercise restart boundaries
// without repeating a multi-hundred-megabyte Hub transfer.
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startReview } from './cockpit-live-review.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workspace = process.env.AIDE_WORKSPACE;
if (!workspace) throw new Error('AIDE_WORKSPACE must point to a disposable model workspace');
const evidenceDir = path.join(root, '.aide', 'hardening-live');
await mkdir(evidenceDir, { recursive: true });

const evidence = {
  workspace,
  steps: [],
  pageErrors: [],
  httpFailures: []
};
const record = (step, value) => evidence.steps.push({ step, value });
const shot = async (page, name) => {
  const target = path.join(evidenceDir, `${name}.png`);
  await page.screenshot({ path: target, fullPage: true });
  return target;
};

async function openModels(review) {
  const { page } = review;
  const skip = page.getByRole('button', { name: 'SKIP', exact: true });
  if (await skip.isVisible().catch(() => false)) await skip.click();
  await page.locator('[data-item-id="models"]').click();
  const panel = page.locator('.models-panel:visible');
  await panel.waitFor({ timeout: 60_000 });
  // On this Windows host the first model-status projection can complete after
  // the shell is already interactive. Wait for that ordinary retry window
  // before treating an empty inventory as a restart failure.
  await page.waitForTimeout(15_000);
  await page.locator('.model-card', { hasText: 'SmolLM2-360M-Instruct-Q4_K_M' }).waitFor({ timeout: 60_000 });
  return panel;
}

async function ensurePaired(review) {
  const { page } = review;
  await page.locator('#app[data-active-panel], #covert-pairing-code').first().waitFor({ timeout: 90_000 });
  const pairingInput = page.locator('#covert-pairing-code');
  if (await pairingInput.isVisible().catch(() => false)) {
    await pairingInput.fill(await review.pairing());
    await page.getByRole('button', { name: 'PAIR SESSION', exact: true }).click();
  }
  await page.locator('#app[data-active-panel]').waitFor({ timeout: 90_000 });
}

async function waitForModelState(page, state) {
  const card = page.locator('.model-card', { hasText: 'SmolLM2-360M-Instruct-Q4_K_M' });
  await page.waitForFunction(expected => {
    const cards = [...document.querySelectorAll('.model-card')];
    const card = cards.find(node => (node.textContent ?? '').includes('SmolLM2-360M-Instruct-Q4_K_M'));
    return (card?.querySelector('.model-card-status')?.textContent ?? '') === expected;
  }, state, { timeout: 180_000 });
  return card;
}

async function startAndAssign(review, phase, testInference = true) {
  const { page } = review;
  const panel = await openModels(review);
  const card = page.locator('.model-card', { hasText: 'SmolLM2-360M-Instruct-Q4_K_M' });
  const status = (await card.locator('.model-card-status').textContent())?.trim() ?? '';
  if (status !== 'READY') {
    await card.getByRole('button', { name: 'START MODEL', exact: true }).click();
    await waitForModelState(page, 'READY');
  }
  const checks = card.locator('.models-role-check input');
  const checkCount = await checks.count();
  for (let i = 0; i < checkCount; i += 1) {
    if (!(await checks.nth(i).isChecked())) await checks.nth(i).check();
  }
  const assign = card.getByRole('button', { name: 'ASSIGN ROLES', exact: true });
  if (await assign.isEnabled()) {
    await assign.click();
    await page.locator('.models-feedback').filter({ hasText: 'roles saved' }).waitFor({ timeout: 60_000 });
  }
  if (testInference) {
    await card.getByRole('button', { name: 'TEST MODEL', exact: true }).click();
    await page.locator('.models-feedback').filter({ hasText: 'MODEL_TEST_INFERENCE PASSED' }).waitFor({ timeout: 180_000 });
  }
  const roles = (await card.locator('.models-role-check input').evaluateAll(nodes => nodes.filter(node => node.checked).map(node => node.parentElement?.textContent?.trim() ?? '')));
  record(`${phase}-model-ready-role-proof`, {
    screenshot: await shot(page, `${phase}-model-ready`),
    state: (await card.locator('.model-card-status').textContent())?.trim(),
    roles,
    test: testInference ? (await page.locator('.models-feedback').textContent())?.trim() : 'SKIPPED · isolated UI test passed before restart battery'
  });
  return panel;
}

async function residentPrompt(review, phase, prompt) {
  const { page } = review;
  await page.locator('[data-item-id="resident"]').click();
  await page.locator('#chat-model').waitFor({ timeout: 60_000 });
  const selected = await page.locator('#chat-model option:checked').textContent();
  const readyOptions = await page.locator('#chat-model option:not(:disabled)').count();
  await page.locator('#chat-input').fill(prompt);
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await page.locator('.chat-message.assistant .chat-message-body').last().waitFor({ timeout: 180_000 });
  const response = (await page.locator('.chat-message.assistant .chat-message-body').last().textContent())?.trim() ?? '';
  record(`${phase}-resident-local-response`, {
    screenshot: await shot(page, `${phase}-resident-response`),
    selectedModel: selected?.trim() ?? '',
    readyOptions,
    response: response.slice(0, 500)
  });
}

const first = await startReview({ approveAllLocalOperations: true });
evidence.pageErrors.push(...first.errors);
evidence.httpFailures.push(...first.httpFailures);
try {
  await first.page.waitForTimeout(5_000);
  await startAndAssign(first, 'r1');
  await residentPrompt(first, 'r1', 'Give me one concise sentence proving local Resident service is responding.');
  await first.page.waitForTimeout(2_000);
  await first.page.reload({ waitUntil: 'commit', timeout: 90_000 });
  await ensurePaired(first);
  await first.page.locator('[data-item-id="resident"]').click();
  await first.page.locator('#chat-model').waitFor({ timeout: 60_000 });
  record('r2-ui-reload', {
    screenshot: await shot(first.page, 'r2-ui-reload'),
    selectedModel: ((await first.page.locator('#chat-model option:checked').textContent()) ?? '').trim(),
    messages: await first.page.locator('.chat-message').count()
  });
  await first.page.locator('[data-item-id="models"]').click();
  await first.page.locator('.models-panel:visible').waitFor({ timeout: 60_000 });
  const firstCard = await waitForModelState(first.page, 'READY');
  await firstCard.getByRole('button', { name: 'STOP MODEL', exact: true }).click();
  await first.page.waitForTimeout(3_000);
  record('r1-stop-before-stack-restart', { state: (await firstCard.locator('.model-card-status').textContent())?.trim() ?? '' });
} finally {
  evidence.pageErrors.push(...first.errors);
  evidence.httpFailures.push(...first.httpFailures);
  await first.close();
}

const second = await startReview({ approveAllLocalOperations: true });
evidence.pageErrors.push(...second.errors);
evidence.httpFailures.push(...second.httpFailures);
try {
  await second.page.waitForTimeout(5_000);
  const panel = await openModels(second);
  const card = second.page.locator('.model-card', { hasText: 'SmolLM2-360M-Instruct-Q4_K_M' });
  const persistedRoles = await card.locator('.models-role-check input').evaluateAll(nodes => nodes.filter(node => node.checked).map(node => node.parentElement?.textContent?.trim() ?? ''));
  const preStart = ((await card.locator('.model-card-status').textContent()) ?? '').trim();
  record('r4-full-stack-restart-persisted-registration', {
    screenshot: await shot(second.page, 'r4-after-stack-restart'),
    stateBeforeStart: preStart,
    persistedRoles,
    inventoryText: (await panel.innerText()).slice(0, 1200)
  });
  await startAndAssign(second, 'r4', false);
  await residentPrompt(second, 'r4', 'After a controlled stack restart, give one concise local status sentence.');
  await second.page.locator('[data-item-id="models"]').click();
  await second.page.locator('.models-panel:visible').waitFor({ timeout: 60_000 });
  const readyCard = await waitForModelState(second.page, 'READY');
  await readyCard.getByRole('button', { name: 'STOP MODEL', exact: true }).click();
  await second.page.waitForTimeout(3_000);
} finally {
  evidence.pageErrors.push(...second.errors);
  evidence.httpFailures.push(...second.httpFailures);
  await second.close();
}

await writeFile(path.join(evidenceDir, 'restart-model-battery.json'), JSON.stringify(evidence, null, 2));
console.log(JSON.stringify({ evidenceDir, steps: evidence.steps, pageErrors: evidence.pageErrors, httpFailures: evidence.httpFailures }, null, 2));
