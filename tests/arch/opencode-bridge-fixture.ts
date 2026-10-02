import { appendFileSync, promises as fs } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createOpenCodeBridge } from '../../node/src/services/opencode-bridge.ts';

const fixtureExecutable = path.join(path.dirname(fileURLToPath(import.meta.url)), 'opencode-fixture-server.mjs');

export async function fixtureBridge(dir: string, mode: string, fixtureOptions: { startupDelayMs?: number; fetchFn?: typeof fetch; assertExternalEgressAllowed?: () => void } = {}) {
  const log = path.join(dir, 'events.jsonl');
  await fs.writeFile(log, '', 'utf8');
  const bridge = createOpenCodeBridge({
    ...(fixtureOptions.fetchFn !== undefined ? { fetchFn: fixtureOptions.fetchFn } : {}),
    ...(fixtureOptions.assertExternalEgressAllowed !== undefined ? { assertExternalEgressAllowed: fixtureOptions.assertExternalEgressAllowed } : {}),
    executableOverride: { bin: process.execPath, prefix: [fixtureExecutable], version: '1.18.20-fixture' },
    spawnFn: ((command: string, args: string[], spawnOptions: Record<string, unknown>) => {
      const child = spawn(command, args, {
        ...spawnOptions,
        env: {
          ...(spawnOptions.env as Record<string, string>),
          FIXTURE_MODE: mode,
          FIXTURE_LOG: log,
          FIXTURE_START_DELAY_MS: String(fixtureOptions.startupDelayMs ?? 0)
        }
      });
      child.once('close', (code, signal) => {
        appendFileSync(log, JSON.stringify({ event: 'server-child-close', code, signal }) + '\n');
      });
      return child;
    }) as unknown as typeof spawn
  });
  return { bridge, log };
}

export async function readLog(log: string): Promise<Array<{ event: string; body?: Record<string, unknown> }>> {
  const text = await fs.readFile(log, 'utf8');
  return text.trim().length === 0 ? [] : text.trim().split(/\r?\n/).map(line => JSON.parse(line) as { event: string; body?: Record<string, unknown> });
}
