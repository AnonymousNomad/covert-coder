// tests/arch/kimi-transport.test.ts
// Phase 2: official Kimi Code CLI transport — detection from the executable,
// readiness only from a bounded real probe (never config presence), truthful
// NOT_READY on auth failure, bounded invocation with parsed stream-json.
// Fixture CLI only; no vendor credentials.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createKimiTransport } from '../../node/src/services/kimi-transport.ts';

const fixture = `#!/usr/bin/env node
const args = process.argv.slice(2);
if (args.includes('--version')) { console.log('kimi, version 9.9.9-fixture'); process.exit(0); }
const mode = process.env.FIXTURE_MODE ?? 'ok';
if (mode === 'authfail') { console.error('LLM not set'); process.exit(1); }
const promptIndex = args.indexOf('-p');
const prompt = promptIndex >= 0 ? String(args[promptIndex + 1] ?? '') : '';
const text = prompt.includes('KIMI-READY') ? 'KIMI-READY' : '<attempt_completion><result>KIMI-FIXTURE-OK</result></attempt_completion>';
console.log(JSON.stringify({ type: 'assistant', text }));
console.log(JSON.stringify({ type: 'done' }));
process.exit(0);
`;

async function fixtureTransport(dir: string, mode?: string) {
  const bin = path.join(dir, 'kimi-fixture.mjs');
  await fs.writeFile(bin, fixture, 'utf8');
  const { spawn } = await import('node:child_process');
  return createKimiTransport({
    executableOverride: { bin: process.execPath, prefix: [bin], version: null },
    spawnFn: ((command: string, args: string[], options: Record<string, unknown>) => spawn(command, args, {
      ...options,
      env: { ...(options.env as Record<string, string>), ...(mode !== undefined ? { FIXTURE_MODE: mode } : {}) }
    })) as unknown as typeof spawn
  });
}

test('detection is executable-based and readiness starts unproven', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'aide-kimi-'));
  try {
    const transport = await fixtureTransport(dir);
    const detection = await transport.detect();
    assert.equal(detection.provider, 'kimi-code');
    assert.equal(detection.connection_mode, 'subscription_client');
    assert.equal(detection.auth_class, 'kimi_code_subscription');
    assert.equal(detection.version, 'kimi, version 9.9.9-fixture');
    assert.equal(detection.authenticated, null, 'config presence must never manufacture readiness');
    assert.match(detection.detail, /authentication unproven/);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('a bounded probe marks the client authenticated', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'aide-kimi-'));
  try {
    const transport = await fixtureTransport(dir);
    const probed = await transport.probe();
    assert.equal(probed.authenticated, true);
    const detection = await transport.detect();
    assert.equal(detection.authenticated, true);
    assert.match(detection.detail, /bounded capability probe succeeded/);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('an unauthenticated client is AUTH_REQUIRED with a truthful probe detail', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'aide-kimi-'));
  try {
    const transport = await fixtureTransport(dir, 'authfail');
    const probed = await transport.probe();
    assert.equal(probed.authenticated, false);
    assert.match(probed.detail, /official login required/);
    const detection = await transport.detect();
    assert.equal(detection.status, 'AUTH_REQUIRED');
    assert.equal(detection.authenticated, false);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('invocation parses stream-json and returns the final text', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'aide-kimi-'));
  try {
    const transport = await fixtureTransport(dir);
    const result = await transport.invoke({ prompt: 'do the task', workspace: dir, timeoutMs: 30000 });
    assert.match(result.text, /KIMI-FIXTURE-OK/);
    assert.ok(result.event_count >= 2);
    assert.equal(result.exit_code, 0);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('auth-failed invocation fails truthfully with NOT_READY', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'aide-kimi-'));
  try {
    const transport = await fixtureTransport(dir, 'authfail');
    await assert.rejects(
      () => transport.invoke({ prompt: 'do the task', workspace: dir, timeoutMs: 30000 }),
      (error: unknown) => (error as { code?: string })?.code === 'NOT_READY' && /official login required/.test(String((error as Error).message))
    );
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
