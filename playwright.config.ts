import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60000,
  expect: { timeout: 15000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    headless: true,
    channel: process.env.AIDE_PLAYWRIGHT_CHANNEL,
    extraHTTPHeaders: { 'X-AIDE-API-Format': 'envelope-v1' }
  },
  // The arch backend and the facade refuse to run without the trusted launch
  // supervisor (they require a live IPC parent), so the e2e stack must boot
  // through the product entrypoint. `scripts/start.mjs --frontend=typed`
  // serves the built cockpit on 4173 and owns the supervised backend/facade.
  webServer: {
    command: 'node scripts/start.mjs --frontend=typed',
    url: 'http://127.0.0.1:4777/api/health',
    reuseExistingServer: true,
    timeout: 120000
  }
});
