// RQ chain: wait for Condition D runner to complete -> run D analysis ->
// launch Condition E1 runner. Detached; logs to rq-chain.log. Bounded waits.
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\//, ''));
const REPO = path.resolve(HERE, '..', '..');
const NODE = process.execPath;
const D_LOG = 'E:\\pip_temp\\opencode\\condition-d.log';
const sleep = ms => new Promise(r => setTimeout(r, ms));

function run(file, env, outFile) {
  return new Promise(resolve => {
    const child = spawn(NODE, [file], { cwd: REPO, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    let buffer = '';
    child.stdout.on('data', d => { buffer += String(d); process.stdout.write(String(d)); });
    child.stderr.on('data', d => process.stdout.write(String(d)));
    child.once('exit', async code => { if (outFile) await fs.writeFile(outFile, buffer).catch(() => {}); resolve(code); });
  });
}

console.log('[chain] waiting for Condition D completion marker...');
const deadline = Date.now() + 6 * 60 * 60 * 1000;
let done = false;
while (Date.now() < deadline) {
  try {
    const log = await fs.readFile(D_LOG, 'utf8');
    if (log.includes('[condition-d] all models complete')) { done = true; break; }
  } catch { /* log not yet present */ }
  await sleep(60000);
}
console.log(`[chain] Condition D ${done ? 'complete' : 'timeout — proceeding anyway'}`);

console.log('[chain] running D analysis...');
await run(path.join(HERE, 'condition-d-analyze.mjs'), {}, 'E:\\pip_temp\\opencode\\d-analysis.txt');

console.log('[chain] launching Condition E1 runner...');
await run(path.join(HERE, 'condition-e-run-all.mjs'), { AIDE_E_CONDITION: 'e1' }, 'E:\\pip_temp\\opencode\\condition-e1.txt');
console.log('[chain] complete');
