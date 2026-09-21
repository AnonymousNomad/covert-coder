// Policy-level network-off proof: local-only routing is selected through the
// visible Connections UI, then a real local model serves a real Resident reply.
// No external firewall mutation is performed by this evidence driver.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startReview } from './cockpit-live-review.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workspace = process.env.AIDE_WORKSPACE;
if (!workspace) throw new Error('AIDE_WORKSPACE must point to a prepared workspace with a registered local model.');
const evidenceDir = path.join(root, '.aide', 'hardening-live');
await mkdir(evidenceDir, { recursive: true });
const review = await startReview({ approveAllLocalOperations: true });
const page = review.page;
const evidence = { workspace, preference: null, model: null, response: null, egress: null, pageErrors: review.errors, httpFailures: review.httpFailures };
let egressBeforeLocalChat = [];
const shot = async name => {
  const target = path.join(evidenceDir, `offline-${name}.png`);
  await page.screenshot({ path: target, fullPage: true });
  return target;
};
try {
  await page.waitForTimeout(8_000);
  const skip = page.getByRole('button', { name: 'SKIP', exact: true });
  if (await skip.isVisible()) await skip.click();

  await page.locator('[data-item-id="settings"]').click();
  const preference = page.locator('#connections-pref:visible');
  await preference.waitFor({ timeout: 60_000 });
  await page.waitForFunction(() => document.querySelectorAll('#connections-pref option').length > 0, undefined, { timeout: 60_000 });
  await preference.selectOption('local-only');
  await page.waitForFunction(() => document.querySelector('#connections-pref')?.value === 'local-only', undefined, { timeout: 60_000 });
  evidence.preference = { value: await preference.inputValue(), screenshot: await shot('local-only') };
  const journalPath = path.join(workspace, '.aide', 'egress', 'journal.jsonl');
  const beforeJournal = await readFile(journalPath, 'utf8').catch(() => '');
  egressBeforeLocalChat = beforeJournal.length === 0 ? [] : beforeJournal.trim().split(/\r?\n/).map(line => JSON.parse(line));

  await page.locator('[data-item-id="models"]').click();
  const panel = page.locator('.models-panel:visible');
  await panel.waitFor({ timeout: 60_000 });
  const card = panel.locator('.model-card', { hasText: 'SmolLM2-360M-Instruct-Q4_K_M' }).first();
  await card.waitFor({ timeout: 60_000 });
  let status = (await card.locator('.model-card-status').textContent())?.trim() ?? '';
  if (status !== 'READY') {
    const start = card.getByRole('button', { name: 'START MODEL', exact: true });
    await start.click();
    await page.waitForFunction(() => [...document.querySelectorAll('.model-card')].some(node =>
      (node.textContent ?? '').includes('SmolLM2-360M-Instruct-Q4_K_M') && node.querySelector('.model-card-status')?.textContent?.trim() === 'READY'), undefined, { timeout: 240_000 });
    status = 'READY';
  }
  evidence.model = { name: 'SmolLM2-360M-Instruct-Q4_K_M', status, screenshot: await shot('model-ready') };

  await page.locator('[data-item-id="resident"]').click();
  const input = page.locator('#chat-input:visible');
  await input.waitFor({ timeout: 60_000 });
  await input.fill('Give me one concise sentence proving the local model is serving.');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  const reply = page.locator('.chat-message.assistant .chat-message-body').last();
  await page.waitForFunction(() => {
    const body = document.querySelector('.chat-message.assistant .chat-message-body:last-of-type');
    const stop = document.querySelector('#chat-stop');
    return body !== null && (body.textContent ?? '').trim().length > 0 && stop?.classList.contains('hidden') === true;
  }, undefined, { timeout: 180_000 });
  await page.waitForTimeout(3_000);
  evidence.response = { text: (await reply.textContent())?.trim() ?? '', screenshot: await shot('resident-response') };

  const journal = await readFile(journalPath, 'utf8').catch(() => '');
  const afterJournal = journal.length === 0 ? [] : journal.trim().split(/\r?\n/).map(line => JSON.parse(line));
  const newEntries = afterJournal.slice(egressBeforeLocalChat.length);
  evidence.egress = {
    journalPath,
    totalEntries: afterJournal.length,
    beforeLocalChat: egressBeforeLocalChat.length,
    newDuringLocalChat: newEntries.map(entry => entry.action ?? 'UNKNOWN'),
    providerEgressDuringLocalChat: newEntries.filter(entry => /provider|builtin-chat|subscription/i.test(entry.action ?? '')).length
  };
  if (evidence.egress.providerEgressDuringLocalChat > 0) throw new Error(`Unexpected provider egress under local-only: ${evidence.egress.newDuringLocalChat.join(', ')}`);

  await page.locator('[data-item-id="models"]').click();
  const stop = page.locator('.model-card', { hasText: 'SmolLM2-360M-Instruct-Q4_K_M' }).first().getByRole('button', { name: 'STOP MODEL', exact: true });
  if (await stop.isVisible().catch(() => false)) {
    await stop.click();
    await page.waitForFunction(() => ![...document.querySelectorAll('.model-card')].some(node =>
      (node.textContent ?? '').includes('SmolLM2-360M-Instruct-Q4_K_M') && node.querySelector('.model-card-status')?.textContent?.trim() === 'READY'), undefined, { timeout: 60_000 });
  }
} finally {
  await writeFile(path.join(evidenceDir, 'offline-live-proof.json'), JSON.stringify(evidence, null, 2));
  await review.close();
}
console.log(JSON.stringify(evidence, null, 2));
