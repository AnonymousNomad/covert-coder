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
    // Windows release validation uses the installed Edge channel when the
    // managed Playwright browser cache is absent. CI/Linux keeps Chromium's
    // normal Playwright resolution unless explicitly overridden.
    channel: process.env.AIDE_PLAYWRIGHT_CHANNEL ?? (process.platform === 'win32' ? 'msedge' : undefined),
    extraHTTPHeaders: { 'X-AIDE-API-Format': 'envelope-v1' }
  },
  // The typed backend and facade require the production authority supervisor.
  // Launch the complete owned stack through start.mjs rather than starting
  // node/src/server.ts directly; direct launches are intentionally rejected.
  webServer: {
    command: 'npm run start',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      AIDE_UI_PORT: '4173',
      AIDE_FACADE_PORT: '4777',
      AIDE_ARCH_PORT: '4778',
      AIDE_LEGACY_PORT: '4779',
      AIDE_VERSION: 'e2e'
    }
  }
});
