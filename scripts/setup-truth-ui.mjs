// Actual setup component in a browser with controlled API results. This is
// component regression evidence; it does not qualify a packaged/live journey.
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

async function run() {
const baselinePersistence = process.argv.includes('--reproduce-persistence');
const baselineMode = baselinePersistence || process.argv.includes('--reproduce');
const baselineId = path.resolve('browser/src/cockpit/__setup_truth_baseline__.ts').replaceAll('\\', '/');
const baselineSource = baselineMode ? execFileSync('git', ['show', 'fc263fe26f364b5c972be79a8ac6e651a671dcd0:browser/src/cockpit/SetupSession.ts'], { encoding: 'utf8' }) : '';
const server = await createServer({
  configFile: 'browser/vite.config.ts',
  plugins: baselineMode ? [{ name: 'readonly-original-setup',
    resolveId(id) { if (id.endsWith('/__setup_truth_baseline__.ts')) return baselineId; },
    load(id) { if (id === baselineId) return baselineSource; },
  }] : [],
  server: { host: '127.0.0.1', port: 0, strictPort: false },
});
let browser;
try {
  await server.listen();
  const address = server.httpServer.address();
  assert(address && typeof address === 'object');
  browser = await chromium.launch({
    ...(process.platform === 'win32' ? { channel: 'msedge' } : {}),
    headless: true,
  });
  const page = await browser.newPage();
  await page.route('**/__setup_truth__', route => route.fulfill({
    contentType: 'text/html', body: '<!doctype html><div id="host"></div>',
  }));
  await page.goto(`http://127.0.0.1:${address.port}/__setup_truth__`);
  await page.evaluate(async baseline => {
    const { api } = await import('/src/services/api.ts');
    const { createSetupSession } = await import(baseline ? '/src/cockpit/__setup_truth_baseline__.ts' : '/src/cockpit/SetupSession.ts');
    window.fixture = { failure: '', healthState: 'HEALTHY', pendingHealth: false, choices: {}, writes: [], writeAttempts: 0, failAtWrite: 0, completed: 0, toasts: [], saved: null };
    const state = window.fixture;
    const check = name => { if (state.failure === name) throw new Error('fixture unavailable'); };
    Object.assign(api, {
      fileRead: async () => ({ content: state.saved }),
      fileWrite: async (_path, content) => { state.writeAttempts++; check('save'); if (state.writeAttempts === state.failAtWrite) throw new Error('fixture write failed'); state.saved = content; state.writes.push(JSON.parse(content)); },
      onboardingState: async () => { check('onboarding-read'); return { user_choices: state.choices }; },
      onboardingNext: async choices => { check('onboarding'); state.choices = choices; return { state: { user_choices: state.choices } }; },
      onboardingComplete: async () => { check('complete'); state.completed++; return { complete: true }; },
      health: async () => { if (state.pendingHealth) await new Promise(resolve => { window.releaseHealth = resolve; }); check('daemon'); return { state: state.healthState, workspace: 'fixture' }; },
      hardwareProfile: async () => { check('hardware'); return { totalRamBytes: 16 * 1073741824, freeRamBytes: 8 * 1073741824, logicalCpus: 12 }; },
      hardwareRecommend: async () => ({ recommendations: [] }),
      modelsStatus: async () => { check('registry'); return { models: [] }; },
      workflowState: async () => { check('workflow'); return { stage: 'DISCOVERY' }; },
      auditRead: async () => { check('audit'); return { events: [] }; },
      byokStatus: async () => { check('providers'); return { consent_enabled: false, providers: [] }; },
    });
    window.setup = createSetupSession(document.getElementById('host'), {}, {
      onToast: (_code, message) => state.toasts.push(message), onNavigate: () => {},
    });
    window.setup.open();
  }, baselineMode);
  const title = page.locator('.cockpit-setup-title');
  const next = page.locator('.cockpit-setup-primary');
  if (baselinePersistence) {
    await page.evaluate(() => { window.fixture.failure = 'onboarding'; });
    for (let i = 0; i < 4; i++) await next.click();
    await page.waitForFunction(() => document.querySelector('.cockpit-setup-stage').textContent.startsWith('SETUP 5 OF'));
    assert.equal(await title.innerText(), 'PROVIDERS / SECRETS');
    assert.equal(await page.evaluate(() => window.fixture.writes.length), 0);
    assert.match(await page.evaluate(() => window.fixture.toasts.join(' ')), /continuing with local plan/);
    for (let i = 4; i < 11; i++) await next.click();
    await page.waitForFunction(() => document.querySelector('.cockpit-setup-stage').textContent.startsWith('SETUP 12 OF'));
    assert.equal(await next.isVisible(), false);
    assert.equal(await page.evaluate(() => window.fixture.writes.length), 0);
    console.log(JSON.stringify({ evidence: 'F02 baseline', source: 'fc263fe', onboardingWriteFailed: true, advancedAfterFailure: true, finalSaveControlHidden: true, profileWrites: 0 }));
    return;
  }
  async function goToValidation() {
    for (let i = 0; i < 10; i++) {
      await next.click();
      await page.waitForFunction(expected => document.querySelector('.cockpit-setup-stage').textContent.startsWith(`SETUP ${expected} OF`), i + 2);
    }
  }
  await page.evaluate(() => { window.fixture.failure = 'daemon'; });
  await goToValidation();
  const before = await page.locator('.cockpit-setup-body').innerText();
  await next.click();
  await page.waitForFunction(() => document.querySelector('.cockpit-setup-stage').textContent.startsWith('SETUP 12 OF'));
  const after = await page.locator('.cockpit-setup-body').innerText();
  if (process.argv.includes('--reproduce')) {
    assert.match(before, /CORE VALIDATION PASSED/);
    assert.match(after, /YOUR WORKFLOW IS READY/);
    console.log(JSON.stringify({ evidence: 'F01 baseline reproduction', requiredDaemonFailed: true, prematurePass: true, staleReadyAfterFailure: true, title: await title.innerText() }));
  } else {
    assert.doesNotMatch(before, /CORE VALIDATION PASSED/);
    assert.doesNotMatch(after, /YOUR WORKFLOW IS READY/);
    assert.match(after, /UNAVAILABLE/);
    console.log('PASS UI: unavailable required check never READY');
    await page.evaluate(() => { window.fixture.failure = ''; window.fixture.healthState = 'UNHEALTHY'; });
    await page.getByRole('button', { name: 'RERUN VALIDATION' }).click();
    await next.click();
    await page.waitForFunction(() => document.querySelector('.cockpit-setup-stage').textContent.startsWith('SETUP 12 OF'));
    assert.match(await page.locator('.cockpit-setup-body').innerText(), /VALIDATION FAILED/);
    console.log('PASS UI: explicit unhealthy daemon never READY');
    await page.evaluate(() => { window.fixture.healthState = 'HEALTHY'; });
    await page.getByRole('button', { name: 'RERUN VALIDATION' }).click();
    assert.match(await page.locator('.cockpit-setup-body').innerText(), /NOT_RUN/);
    await next.click();
    await page.waitForFunction(() => document.querySelector('.cockpit-setup-stage').textContent.startsWith('SETUP 12 OF'));
    assert.match(await page.locator('.cockpit-setup-body').innerText(), /CORE VALIDATION PASSED/);
    console.log('PASS UI: completed all-pass validation establishes core pass');
    await page.locator('.cockpit-setup-controls').getByRole('button', { name: 'BACK', exact: true }).click();
    assert.match(await page.locator('.cockpit-setup-body').innerText(), /NOT_RUN/);
    assert.doesNotMatch(await page.locator('.cockpit-setup-body').innerText(), /CORE VALIDATION PASSED/);
    await page.evaluate(() => { window.fixture.failure = 'daemon'; });
    await next.click();
    await page.waitForFunction(() => document.querySelector('.cockpit-setup-stage').textContent.startsWith('SETUP 12 OF'));
    assert.doesNotMatch(await page.locator('.cockpit-setup-body').innerText(), /CORE VALIDATION PASSED/);
    console.log('PASS UI: back/forward and success-to-failure revoke stale pass');
    await page.evaluate(() => { window.fixture.failure = ''; window.fixture.pendingHealth = true; });
    await page.getByRole('button', { name: 'RERUN VALIDATION' }).click();
    await next.click();
    await page.waitForFunction(() => typeof window.releaseHealth === 'function');
    assert.match(await page.locator('.cockpit-setup-body').innerText(), /RUNNING/);
    assert.equal(await next.isDisabled(), true);
    assert.equal(await page.locator('.cockpit-setup-controls').getByRole('button', { name: 'BACK', exact: true }).isDisabled(), true);
    console.log('PASS UI: pending check cannot advance or display pass');
    await page.evaluate(() => { window.setup.close(); window.fixture.pendingHealth = false; window.fixture.saved = null; window.setup.open(); window.releaseHealth(); });
    await page.waitForFunction(() => !document.querySelector('.cockpit-setup-primary').disabled);
    assert.equal(await title.innerText(), 'WELCOME');
    await goToValidation();
    assert.match(await page.locator('.cockpit-setup-body').innerText(), /NOT_RUN/);
    console.log('PASS UI: abandoned completion cannot promote reopened session');
    const cloudEvidence = await page.evaluate(async () => {
      const { createTopbar } = await import('/src/shell/topbar.ts');
      const { createCloudStatusReader } = await import('/src/services/cloud-status.ts');
      const host = document.createElement('div'); document.body.appendChild(host);
      const topbar = createTopbar(host, {});
      const labels = [host.querySelector('[data-chip-label="cloud"]').textContent];
      await createCloudStatusReader(async () => { throw new Error('BYOK status unavailable'); }, state => {
        topbar.setCloud(state); labels.push(host.querySelector('[data-chip-label="cloud"]').textContent);
      }).refresh();
      return { labels, terminalTitle: host.querySelector('[aria-label="Terminal keyboard shortcut unavailable"]').title };
    });
    assert.deepEqual(cloudEvidence.labels, ['REMOTE: CHECKING', 'REMOTE: CHECKING', 'REMOTE STATUS UNAVAILABLE']);
    console.log('PASS UI: provider read failure renders unknown rather than LOCAL ONLY');
    assert.match(cloudEvidence.terminalTitle, /approved interactive sessions/);
    assert.doesNotMatch(cloudEvidence.terminalTitle, /read-only/);
    console.log('PASS UI: terminal shortcut copy distinguishes the real interactive panel');
    async function fresh(failure) {
      await page.evaluate(value => {
        window.setup.close(); window.fixture.saved = null; window.fixture.failure = value;
        window.fixture.choices = {}; window.fixture.completed = 0; window.fixture.writes = [];
        window.fixture.writeAttempts = 0; window.fixture.failAtWrite = 0;
        window.setup.open();
      }, failure);
      await page.waitForFunction(() => !document.querySelector('.cockpit-setup-primary').disabled);
    }
    for (const failure of ['onboarding', 'save']) {
      await fresh(failure);
      for (let i = 0; i < 4; i++) await next.click();
      await page.waitForFunction(() => !document.querySelector('.cockpit-setup-primary').disabled);
      assert.equal(await title.innerText(), 'APPROVAL');
      assert.match(await page.locator('.cockpit-setup-body').innerText(), /UNRESOLVED|FAILED/);
      assert.equal(await page.evaluate(() => window.fixture.completed), 0);
      console.log(`PASS UI: ${failure} failure blocks approval advancement/completion`);
    }
    await fresh(''); await goToValidation();
    await next.click();
    await page.waitForFunction(() => document.querySelector('.cockpit-setup-stage').textContent.startsWith('SETUP 12 OF'));
    assert.equal(await next.isVisible(), true);
    assert.match(await page.locator('.cockpit-setup-body').innerText(), /SAVED AS PREFERENCE/);
    await page.evaluate(() => { window.fixture.failure = 'save'; });
    await next.click();
    await page.waitForFunction(() => !document.querySelector('.cockpit-setup-controls button').disabled);
    assert.equal(await page.evaluate(() => window.fixture.completed), 0);
    assert.match(await page.locator('.cockpit-setup-body').innerText(), /SETUP SAVE FAILED/);
    assert.equal(await next.isDisabled(), true);
    console.log('PASS UI: final preference failure cannot call onboarding completion');
    await page.evaluate(() => { window.fixture.failure = ''; });
    await page.getByRole('button', { name: 'RERUN VALIDATION' }).click(); await next.click();
    await page.waitForFunction(() => document.querySelector('.cockpit-setup-stage').textContent.startsWith('SETUP 12 OF'));
    await page.evaluate(() => { window.fixture.failure = 'complete'; }); await next.click();
    await page.waitForFunction(() => !document.querySelector('.cockpit-setup-controls button').disabled);
    assert.equal(await page.evaluate(() => window.setup.isOpen()), true);
    assert.match(await page.locator('.cockpit-setup-body').innerText(), /SETUP COMPLETION FAILED/);
    assert.equal(await page.evaluate(() => JSON.parse(window.fixture.saved).completedAt), null);
    console.log('PASS UI: canonical completion failure stays open without completed timestamp');
    await page.evaluate(() => { window.fixture.failure = ''; });
    await page.getByRole('button', { name: 'RERUN VALIDATION' }).click(); await next.click();
    await page.waitForFunction(() => document.querySelector('.cockpit-setup-stage').textContent.startsWith('SETUP 12 OF'));
    await next.click();
    await page.waitForFunction(() => document.querySelector('.cockpit-setup-body').textContent.includes('COMPLETION RECORDED.'));
    assert.equal(await page.evaluate(() => window.fixture.completed), 1);
    assert.equal(await page.evaluate(() => typeof JSON.parse(window.fixture.saved).completedAt), 'string');
    console.log('PASS UI: success records preferences and canonical completion before completion claim');
    await page.evaluate(() => { window.setup.close(); window.setup.open(); });
    await page.waitForFunction(() => !document.querySelector('.cockpit-setup-primary').disabled);
    assert.equal(await title.innerText(), 'VALIDATION');
    assert.match(await page.locator('.cockpit-setup-body').innerText(), /NOT_RUN/);
    console.log('PASS UI: completed profile resumes with validation required rather than stale READY');
    await fresh(''); await goToValidation(); await next.click();
    await page.waitForFunction(() => document.querySelector('.cockpit-setup-stage').textContent.startsWith('SETUP 12 OF'));
    await page.evaluate(() => { window.fixture.failAtWrite = window.fixture.writeAttempts + 2; });
    await next.click();
    await page.waitForFunction(() => !document.querySelector('.cockpit-setup-controls button').disabled);
    assert.equal(await page.evaluate(() => window.fixture.completed), 1);
    assert.equal(await page.evaluate(() => JSON.parse(window.fixture.saved).completedAt), null);
    assert.doesNotMatch(await page.locator('.cockpit-setup-body').innerText(), /PREFERENCES SAVED AND COMPLETION RECORDED/);
    assert.match(await page.locator('.cockpit-setup-body').innerText(), /COMPLETION UNRESOLVED/);
    console.log('PASS UI: last completion-marker write failure cannot manufacture successful setup');
    await fresh(''); await next.click();
    await page.getByLabel('OpenAI / compatible', { exact: true }).check();
    await page.getByLabel('Anthropic / Claude', { exact: true }).check();
    await next.click(); await next.click(); await next.click();
    await page.waitForFunction(() => !document.querySelector('.cockpit-setup-primary').disabled);
    assert.deepEqual(await page.evaluate(() => JSON.parse(window.fixture.saved).answers.providers), ['OpenAI / compatible', 'Anthropic / Claude']);
    console.log('PASS UI: multiple provider preferences persist without losing earlier selections');
  }
} finally {
  await browser?.close();
  await server.close();
}
}
await run();
