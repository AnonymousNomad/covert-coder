import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const playwrightCli = path.join(root, 'node_modules', '@playwright', 'test', 'cli.js');
const runId = randomUUID();
const tempRoot = path.resolve(os.tmpdir());
const workspace = path.join(tempRoot, `covert-workstation-e2e-${runId}`);
const pairingProof = path.join(tempRoot, `covert-workstation-e2e-pair-${runId}.txt`);

function assertOwnedTempPath(target) {
  const relative = path.relative(tempRoot, target);
  if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error('Workstation E2E cleanup target escaped the OS temp directory');
  }
}

function probePort(port) {
  return new Promise(resolve => {
    const socket = net.createConnection({ host: '127.0.0.1', port });
    let settled = false;
    const finish = result => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(result);
    };
    socket.once('connect', () => finish('open'));
    socket.once('error', error => {
      const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
      finish(code === 'ECONNREFUSED' ? 'closed' : 'unknown');
    });
    socket.setTimeout(300, () => finish('unknown'));
  });
}

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function cleanupFixture() {
  assertOwnedTempPath(workspace);
  assertOwnedTempPath(pairingProof);
  const exists = async target => {
    try {
      await fs.access(target);
      return true;
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') return false;
      throw error;
    }
  };
  const ownedArtifactExists = await Promise.all([workspace, pairingProof].map(exists));
  if (!ownedArtifactExists.some(Boolean)) return;

  let portsClosed = false;
  for (let attempt = 0; attempt < 30; attempt++) {
    const ports = await Promise.all([4174, 4878].map(probePort));
    if (ports.every(status => status === 'closed')) { portsClosed = true; break; }
    await delay(100);
  }
  if (!portsClosed) throw new Error('Workstation E2E cleanup refused while a fixture port remained open or unknown');

  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      await fs.rm(pairingProof, { force: true });
      await fs.rm(workspace, { recursive: true, force: true });
      return;
    } catch (error) {
      const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
      if (!['EBUSY', 'ENOTEMPTY', 'EPERM'].includes(code ?? '') || attempt === 9) throw error;
      await delay(100);
    }
  }
}

const child = spawn(process.execPath, [
  playwrightCli,
  'test',
  '--config',
  path.join(root, 'playwright.workstation.config.ts'),
  ...process.argv.slice(2)
], {
  cwd: root,
  env: {
    ...process.env,
    AIDE_WORKSTATION_E2E_RUN_ID: runId
  },
  stdio: 'inherit'
});

child.on('error', error => {
  process.stderr.write(`Unable to start the Workstation Playwright runner: ${error.message}\n`);
  process.exitCode = 1;
});

child.on('close', (code, signal) => {
  const playwrightExitCode = code ?? (signal ? 1 : 0);
  void cleanupFixture().then(() => {
    process.exitCode = playwrightExitCode;
  }).catch(error => {
    process.stderr.write(`Workstation E2E fixture cleanup failed: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
});
