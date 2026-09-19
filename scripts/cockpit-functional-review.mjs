// Real stack only. Approves only terminal start/stop in this isolated worktree.
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { startReview } from './cockpit-live-review.mjs';

const review = await startReview({ approveTerminal: true });
const { page } = review;
const evidence = { screenshots: [], checks: [], errors: review.errors, httpFailures: review.httpFailures };
evidence.requestFailures = [];
page.on('requestfailed', request => evidence.requestFailures.push({ path: new URL(request.url()).pathname, error: request.failure()?.errorText }));
await page.evaluate(() => {
  window.__covertReviewNotifications = [];
  const seen = new WeakSet();
  const collect = () => document.querySelectorAll('.aide-toast').forEach(node => {
    if (!seen.has(node)) { seen.add(node); window.__covertReviewNotifications.push(node.textContent); }
  });
  collect();
  new MutationObserver(collect).observe(document.body, { childList: true, subtree: true });
});
const navigate = id => page.locator(`[data-item-id="${id}"]`).click();
async function capture(name) { await page.waitForTimeout(250); evidence.screenshots.push(await review.capture(name)); }
try {
  await page.waitForTimeout(20000);
  const skip = page.getByRole('button', { name: 'SKIP', exact: true });
  if (await skip.isVisible()) await skip.click();
  await page.waitForTimeout(8500);
  await page.getByRole('tab', { name: 'SYSTEM MAP tab', exact: true }).click();
  await capture('release-command-center');
  await navigate('resident');
  await page.getByRole('button', { name: 'GOVERNED TASK', exact: true }).click();
  assert.ok(await page.locator('.cockpit-resident-input').evaluate(node => node.getBoundingClientRect().width > 400), 'governed composer must remain usable');
  await capture('release-resident');
  await page.getByRole('button', { name: 'CONVERSATION', exact: true }).click();
  await navigate('projects');
  await page.locator('#app[data-editor-ready="true"]').waitFor({ timeout: 40000 });
  assert.equal(await page.getByText('Restoring editor session…', { exact: true }).count(), 0);
  if (await page.getByRole('button', { name: 'package.json', exact: true }).count() === 0) {
    evidence.checks.push('Initial workspace read unavailable; exercised existing Refresh once before file opening');
    await page.locator('.cockpit-projects-refresh').click();
  }
  await page.getByRole('button', { name: 'package.json', exact: true }).click();
  await page.locator('.monaco-editor').first().waitFor({ timeout: 30000 });
  await page.waitForTimeout(1500);
  assert.equal(await page.locator('#app').getAttribute('data-active-panel'), 'editor');
  await page.getByRole('button', { name: 'Split editor right', exact: true }).click();
  assert.equal(await page.locator('.group').count(), 2);
  assert.equal(new Set(await page.locator('.group').evaluateAll(nodes => nodes.map(node => node.dataset.group))).size, 2);
  await page.getByRole('button', { name: 'Close editor group', exact: true }).last().click();
  assert.equal(await page.locator('.group').count(), 1);
  assert.equal(await page.locator('.group-pane').count(), 0);
  assert.equal(await page.getByRole('button', { name: 'Close editor group', exact: true }).isDisabled(), true, 'last group close must explain its unavailable state');
  assert.equal(await page.locator('.monaco-editor').count(), 1, 'last group must keep its open file');
  evidence.checks.push('Real workspace file opens in Monaco; split IDs unique; split collapse; last-group close safe');
  await page.waitForTimeout(8500);
  await capture('release-editor');
  await navigate('settings');
  const setup = page.getByRole('button', { name: 'RUN ADAPTIVE SETUP', exact: true });
  await setup.click();
  assert.equal(await page.getByRole('dialog', { name: 'Resident adaptive setup session' }).isVisible(), true);
  await capture('review-setup');
  await page.keyboard.press('Escape');
  assert.equal(await setup.evaluate(node => node === document.activeElement), true);
  evidence.checks.push('Setup opens; Escape closes and restores keyboard focus without applying changes');
  await navigate('terminal');
  await page.getByRole('button', { name: 'OPEN SESSION', exact: true }).click();
  await page.locator('.xterm-helper-textarea').waitFor({ timeout: 30000 });
  await page.locator('.xterm-helper-textarea').fill('Write-Output COVERT_PTY_REVIEW');
  await page.locator('.xterm-helper-textarea').press('Enter');
  await page.waitForTimeout(1500);
  await capture('review-terminal');
  await page.getByRole('button', { name: 'STOP SESSION', exact: true }).click();
  await page.waitForFunction(() => !document.querySelector('.terminal-open-btn')?.disabled, { timeout: 20000 });
  evidence.checks.push('Real governed PTY opens and stops through explicit exact-operation approvals');
  for (const [width, height] of [[1920, 1080], [1366, 768], [1024, 768], [640, 800]]) {
    await page.setViewportSize({ width, height });
    await navigate('command-center');
    const geometry = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
      center: document.querySelector('#cockpit-center').getBoundingClientRect().width }));
    assert.ok(geometry.scrollWidth <= width, `horizontal page overflow at ${width}`);
    assert.ok(geometry.center > 280, `unusable center at ${width}`);
    if (width < 1200) {
      await page.getByRole('button', { name: 'INTELLIGENCE', exact: true }).click();
      assert.equal(await page.locator('#cockpit-intel').isVisible(), true);
      await page.keyboard.press('Escape');
    }
    await capture(`review-responsive-${width}`);
    evidence.checks.push(`Responsive ${width}x${height}: no document overflow; center usable; intelligence reachable`);
  }
  await page.setViewportSize({ width: 1600, height: 1000 });
  evidence.surfaces = [];
  for (const id of ['command-center', 'resident', 'projects', 'editor', 'terminal', 'models', 'skills', 'memory', 'verification', 'security', 'extensions', 'settings']) {
    await navigate(id);
    await page.waitForTimeout(750);
    await capture(`final-${id}`);
    evidence.surfaces.push({ id, text: await page.locator('#cockpit-center').innerText(), controls: await page.locator('button:visible, input:visible, select:visible, textarea:visible').evaluateAll(nodes => nodes.map(node => ({ label: node.getAttribute('aria-label') || node.textContent || node.getAttribute('placeholder') || node.getAttribute('title'), disabled: node.matches(':disabled') }))) });
  }
  assert.deepEqual(review.errors, []);
} catch (error) {
  evidence.failure = error instanceof Error ? error.message : String(error);
  await capture('functional-failure');
  throw error;
} finally {
  evidence.notifications = await page.evaluate(() => window.__covertReviewNotifications).catch(() => []);
  evidence.lastSurface = await page.locator('#cockpit-center').innerText().catch(() => 'unavailable');
  await writeFile(new URL('../.aide/ui-review/functional-review.json', import.meta.url), JSON.stringify(evidence, null, 2));
  await review.close();
  console.log(JSON.stringify({ launcherPid: review.launcherPid, ...evidence }));
}
