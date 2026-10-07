import { defineConfig } from '@playwright/test';
import os from 'node:os';
import path from 'node:path';

const runId = process.env.AIDE_WORKSTATION_E2E_RUN_ID;
if (!runId || !/^[0-9a-f-]{36}$/i.test(runId)) {
  throw new Error('AIDE_WORKSTATION_E2E_RUN_ID must be supplied by npm run test:workstation');
}
const workspace = path.join(os.tmpdir(), `covert-workstation-e2e-${runId}`);
const pairingProof = path.join(os.tmpdir(), `covert-workstation-e2e-pair-${runId}.txt`);
const appOrigin = 'http://127.0.0.1:4174';

process.env.AIDE_WORKSTATION_E2E_WORKSPACE = workspace;
process.env.AIDE_WORKSTATION_E2E_PAIRING_PROOF = pairingProof;
process.env.AIDE_WORKSTATION_E2E_ORIGIN = appOrigin;
process.env.AIDE_WORKSTATION_E2E_PORT = '4878';

export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: ['workstation-real-mutation.spec.ts', 'terminal-authority-refresh.spec.ts', 'workstation-dual-terminals.spec.ts', 'workstation-utilities.spec.ts', 'workstation-cipher-laptop.spec.ts'],
  timeout: 60000,
  expect: { timeout: 15000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: appOrigin,
    headless: true,
    channel: process.env.AIDE_PLAYWRIGHT_CHANNEL,
    extraHTTPHeaders: { 'X-AIDE-API-Format': 'envelope-v1' }
  },
  webServer: [
    {
      command: 'node tests/e2e/workstation-test-server.mjs',
      url: 'http://127.0.0.1:4878/api/health',
      reuseExistingServer: false,
      timeout: 60000,
      env: {
        AIDE_WORKSTATION_E2E_RUN_ID: runId,
        AIDE_WORKSTATION_E2E_WORKSPACE: workspace,
        AIDE_WORKSTATION_E2E_PAIRING_PROOF: pairingProof,
        AIDE_WORKSTATION_E2E_ORIGIN: appOrigin,
        AIDE_WORKSTATION_E2E_PORT: '4878'
      }
    },
    {
      command: 'node node_modules/vite/bin/vite.js preview --config tests/e2e/workstation-vite.config.ts',
      url: appOrigin,
      reuseExistingServer: false,
      timeout: 120000
    }
  ]
});