// tests/arch/subscription-capability.test.ts
// Phase 1 of the subscription bridge: readiness must describe the actual
// executable path — connection mode, supported login status (never credential
// parsing), and the three-way capability truth (authenticated / analysis /
// mutation). Fixture CLIs only; no vendor credentials.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { createSubscriptionTransports } from '../../node/src/services/subscription-transports.ts';

async function writeFixture(dir: string, name: string, body: string): Promise<string> {
  const target = path.join(dir, name);
  await fs.writeFile(target, body, 'utf8');
  return target;
}

const loginStatusFixture = `#!/usr/bin/env node
import { writeFileSync } from 'node:fs';
const args = process.argv.slice(2);
if (args.includes('--version')) { console.log('codex-cli 9.9.9-cap'); process.exit(0); }
if (args[0] === 'login' && args[1] === 'status') {
  console.log(process.env.FIXTURE_LOGIN === 'out' ? 'Not logged in' : 'Logged in using ChatGPT');
  process.exit(0);
}
if (args[args.length - 1] === '-') { await new Promise(resolve => { process.stdin.on('end', resolve); process.stdin.resume(); }); }
if (process.env.FIXTURE_MODE === 'sandbox-denied') {
  console.error('sandbox: apply deny-read ACLs failed');
  process.exit(3);
}
console.log(JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: '<attempt_completion><result>CAP-OK</result></attempt_completion>' } }));
process.exit(0);
`;

const legacyFixture = `#!/usr/bin/env node
const args = process.argv.slice(2);
if (args.includes('--version')) { console.log('codex-cli 9.9.9-legacy'); process.exit(0); }
console.log(JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: '<attempt_completion><result>LEGACY-OK</result></attempt_completion>' } }));
process.exit(0);
`;

test('supported login status drives readiness without touching credential files', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'aide-cap-'));
  try {
    const fixture = await writeFixture(dir, 'codex-cap.mjs', loginStatusFixture);
    const transports = createSubscriptionTransports({
      executableOverride: { 'codex-cli': { bin: process.execPath, prefix: [fixture], version: null } },
      homeDir: path.join(dir, 'no-home')
    });
    const detection = await transports.detect('codex-cli');
    assert.equal(detection.connection_mode, 'subscription_client');
    assert.equal(detection.auth_source, 'chatgpt');
    assert.equal(detection.capabilities.authenticated, true);
    assert.equal(detection.capabilities.analysis_executable, true);
    assert.equal(detection.capabilities.mutation_executable, null, 'mutation is unproven until a real invocation outcome exists');
    assert.equal(detection.status, 'AVAILABLE');
    assert.match(detection.detail, /supported login status/);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('a not-logged-in client is AUTH_REQUIRED with zero analysis capability', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'aide-cap-'));
  try {
    const fixture = await writeFixture(dir, 'codex-out.mjs', loginStatusFixture);
    const transports = createSubscriptionTransports({
      executableOverride: { 'codex-cli': { bin: process.execPath, prefix: [fixture], version: null } },
      homeDir: path.join(dir, 'no-home'),
      spawnFn: ((command: string, args: string[], options: Record<string, unknown>) => {
        return spawn(command, args, { ...options, env: { ...(options.env as Record<string, string>), FIXTURE_LOGIN: 'out' } });
      }) as unknown as typeof spawn
    });
    const detection = await transports.detect('codex-cli');
    assert.equal(detection.status, 'AUTH_REQUIRED');
    assert.equal(detection.capabilities.authenticated, false);
    assert.equal(detection.capabilities.analysis_executable, false);
    assert.equal(detection.capabilities.mutation_executable, null);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('legacy clients fall back to credential-artifact presence and say so', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'aide-cap-'));
  try {
    const fixture = await writeFixture(dir, 'codex-legacy.mjs', legacyFixture);
    const home = path.join(dir, 'home');
    await fs.mkdir(path.join(home, '.codex'), { recursive: true });
    await fs.writeFile(path.join(home, '.codex', 'auth.json'), '{"never":"parsed"}', 'utf8');
    const transports = createSubscriptionTransports({
      executableOverride: { 'codex-cli': { bin: process.execPath, prefix: [fixture], version: null } },
      homeDir: home
    });
    const detection = await transports.detect('codex-cli');
    assert.equal(detection.capabilities.authenticated, true);
    assert.equal(detection.auth_source, null);
    assert.match(detection.detail, /credential artifact presence/);
    assert.equal(detection.status, 'AVAILABLE');
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('a successful workspace-write invocation records mutation capability truthfully', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'aide-cap-'));
  try {
    const fixture = await writeFixture(dir, 'codex-cap.mjs', loginStatusFixture);
    const transports = createSubscriptionTransports({
      executableOverride: { 'codex-cli': { bin: process.execPath, prefix: [fixture], version: null } },
      homeDir: path.join(dir, 'no-home')
    });
    const before = await transports.detect('codex-cli');
    assert.equal(before.capabilities.mutation_executable, null);
    const result = await transports.invoke('codex-cli', { prompt: 'do the task', workspace: dir, sandbox: 'workspace-write', timeoutMs: 30000 });
    assert.equal(result.text.includes('CAP-OK'), true);
    const after = await transports.detect('codex-cli');
    assert.equal(after.capabilities.mutation_executable, true);
    assert.match(after.detail, /workspace mutation proven/);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('a sandbox-denied workspace-write failure records mutation blocked', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'aide-cap-'));
  try {
    const fixture = await writeFixture(dir, 'codex-cap.mjs', loginStatusFixture);
    const wrapped = createSubscriptionTransports({
      executableOverride: { 'codex-cli': { bin: process.execPath, prefix: [fixture], version: null } },
      homeDir: path.join(dir, 'no-home'),
      spawnFn: ((command: string, args: string[], options: Record<string, unknown>) => spawn(command, args, { ...options, env: { ...(options.env as Record<string, string>), FIXTURE_MODE: 'sandbox-denied' } })) as unknown as typeof spawn
    });
    await assert.rejects(() => wrapped.invoke('codex-cli', { prompt: 'mutate', workspace: dir, sandbox: 'workspace-write', timeoutMs: 30000 }));
    const after = await wrapped.detect('codex-cli');
    assert.equal(after.capabilities.mutation_executable, false);
    assert.match(after.detail, /workspace mutation blocked \(environment\)/);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('fixture override and explicit outcome overrides stay honored', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'aide-cap-'));
  try {
    const fixture = await writeFixture(dir, 'codex-legacy.mjs', legacyFixture);
    const transports = createSubscriptionTransports({
      executableOverride: { 'codex-cli': { bin: process.execPath, prefix: [fixture], version: null } },
      authArtifactExists: { 'codex-cli': true },
      mutationOutcomeOverride: { 'codex-cli': null },
      homeDir: path.join(dir, 'no-home')
    });
    const detection = await transports.detect('codex-cli');
    assert.equal(detection.capabilities.authenticated, true);
    assert.match(detection.detail, /fixture override/);
    assert.equal(detection.capabilities.mutation_executable, null);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
