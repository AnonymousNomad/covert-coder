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
  // The production daemons require a trusted parent-owned IPC supervisor.
  // Start the same canonical stack used by `npm start`; direct node launches
  // of node/src/server.ts or scripts/facade.mjs fail closed by design.
  webServer: {
    command: 'npm start',
    url: 'http://127.0.0.1:4777/api/health',
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      AIDE_UI_PORT: '4173',
      AIDE_FACADE_PORT: '4777',
      AIDE_ARCH_PORT: '4778',
      AIDE_LEGACY_PORT: '4779',
      AIDE_ALLOWED_ORIGINS: 'http://127.0.0.1:4173',
      AIDE_CLOSED_LOOP: 'false',
      AIDE_START_TIMEOUT_MS: '120000',
      AIDE_VERSION: 'e2e'
    }
  }
});
