import { defineConfig } from '@playwright/test';

const channel = process.env.AIDE_PLAYWRIGHT_CHANNEL;

export default defineConfig({
  testDir: 'tests/e2e/model-manager',
  testMatch: 'model-manager.spec.ts',
  timeout: 30000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    ...(channel ? { channel } : {}),
    baseURL: 'http://127.0.0.1:4188',
    headless: true,
    storageState: { cookies: [], origins: [] }
  },
  webServer: {
    command: 'node node_modules/vite/bin/vite.js --config tests/e2e/model-manager/vite.config.ts',
    url: 'http://127.0.0.1:4188',
    reuseExistingServer: false,
    timeout: 30000
  }
});
