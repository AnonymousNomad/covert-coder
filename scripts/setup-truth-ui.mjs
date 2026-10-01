// Actual setup component in a browser with controlled API results. This is
// component regression evidence; it does not qualify a packaged/live journey.
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { chromium } from '@playwright/test';

const server = await createServer({
  configFile: 'browser/vite.config.ts',
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
  await page.evaluate(async () => {
    const { api } = await import('/src/services/api.ts');
    const { createSetupSession } = await import('/src/cockpit/SetupSession.ts');
    window.fixture = { failure: '', healthState: 'HEALTHY', pendingHealth: false, writes: [], completed: 0, toasts: [], saved: null };
    const state = window.fixture;
    const check = name => { if (state.failure === name) throw new Error('fixture unavailable'); };
    Object.assign(api, {
      fileRead: async () => ({ content: state.saved }),
      fileWrite: async (_path, content) => { check('save'); state.saved = content; state.writes.push(JSON.parse(content)); },
      onboardingNext: async () => { check('onboarding'); return {}; },
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
  });
  const title = page.locator('.cockpit-setup-title');
  const next = page.locator('.cockpit-setup-primary');
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
  await page.waitForFunction(() => document.querySelector('.cockpit-setup-title').textContent === 'WORKSPACE READY');
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
    await page.waitForFunction(() => document.querySelector('.cockpit-setup-title').textContent === 'WORKSPACE READY');
    assert.match(await page.locator('.cockpit-setup-body').innerText(), /VALIDATION FAILED/);
    console.log('PASS UI: explicit unhealthy daemon never READY');
    await page.evaluate(() => { window.fixture.healthState = 'HEALTHY'; });
    await page.getByRole('button', { name: 'RERUN VALIDATION' }).click();
    assert.match(await page.locator('.cockpit-setup-body').innerText(), /NOT_RUN/);
    await next.click();
    await page.waitForFunction(() => document.querySelector('.cockpit-setup-title').textContent === 'WORKSPACE READY');
    assert.match(await page.locator('.cockpit-setup-body').innerText(), /CORE VALIDATION PASSED/);
    console.log('PASS UI: completed all-pass validation establishes core pass');
    await page.locator('.cockpit-setup-controls').getByRole('button', { name: 'BACK', exact: true }).click();
    assert.match(await page.locator('.cockpit-setup-body').innerText(), /NOT_RUN/);
    assert.doesNotMatch(await page.locator('.cockpit-setup-body').innerText(), /CORE VALIDATION PASSED/);
    await page.evaluate(() => { window.fixture.failure = 'daemon'; });
    await next.click();
    await page.waitForFunction(() => document.querySelector('.cockpit-setup-title').textContent === 'WORKSPACE READY');
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
    await page.evaluate(() => { window.setup.close(); window.fixture.pendingHealth = false; window.setup.open(); window.releaseHealth(); });
    await page.waitForFunction(() => !document.querySelector('.cockpit-setup-primary').disabled);
    assert.equal(await title.innerText(), 'WELCOME');
    await goToValidation();
    assert.match(await page.locator('.cockpit-setup-body').innerText(), /NOT_RUN/);
    console.log('PASS UI: abandoned completion cannot promote reopened session');
  }
} finally {
  await browser?.close();
  await server.close();
}
