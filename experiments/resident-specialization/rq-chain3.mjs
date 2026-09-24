// Post-held-out chain: F1 (official Liquid, best E treatment) -> F2 (preregistered
// 0c/budget diagnosis: reserve 2048) -> F summary draft. Waits for chain2.
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\//, ''));
const REPO = path.resolve(HERE, '..', '..');
const NODE = process.execPath;
const CHAIN2_LOG = 'E:\\pip_temp\\opencode\\rq-chain2.log';
const OFFICIAL = 'LFM2.5-2.6B-Q4_K_M.gguf';
const sleep = ms => new Promise(r => setTimeout(r, ms));

function run(file, env) {
  return new Promise(resolve => {
    const child = spawn(NODE, [file], { cwd: REPO, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    child.stdout.on('data', d => process.stdout.write(String(d)));
    child.stderr.on('data', d => process.stdout.write(String(d)));
    child.once('exit', code => resolve(code));
  });
}

console.log('[chain3] waiting for held-out completion (chain2)...');
const deadline = Date.now() + 14 * 60 * 60 * 1000;
let done = false;
while (Date.now() < deadline) {
  try { const log = await fs.readFile(CHAIN2_LOG, 'utf8'); if (log.includes('[chain2] complete')) { done = true; break; } } catch {}
  await sleep(120000);
}
console.log(`[chain3] held-out ${done ? 'complete' : 'timeout — proceeding with available evidence'}`);

let treatment = 'e1';
try {
  const h = JSON.parse(await fs.readFile(path.resolve(REPO, 'docs', 'resident', 'CONDITION-E-HELDOUT-RESULTS.json'), 'utf8'));
  treatment = h.treatment ?? 'e1';
} catch {}
console.log(`[chain3] F1 with treatment: ${treatment}`);

// F1 — official Liquid, best validated treatment, frozen apparatus.
{
  const env = { AIDE_CANDIDATE_FILE: OFFICIAL, AIDE_CANDIDATE_LABEL: 'lfm-official-f1', AIDE_DEV_MAXTOKENS: '1536' };
  if (treatment === 'e2') env.AIDE_SEAT_SEQUENCER = '1'; else env.AIDE_SEAT_GRAPH = '1';
  console.log('[chain3] F1 running...');
  await run(path.join(HERE, 'run-dev.mjs'), env);
}

// F2 — preregistered budget diagnosis (documented variable: reserve 1536 -> 2048).
// Purpose: classify the residual 0c rows (budget vs extraction vs template).
{
  const env = { AIDE_CANDIDATE_FILE: OFFICIAL, AIDE_CANDIDATE_LABEL: 'lfm-official-f2', AIDE_DEV_MAXTOKENS: '2048' };
  if (treatment === 'e2') env.AIDE_SEAT_SEQUENCER = '1'; else env.AIDE_SEAT_GRAPH = '1';
  console.log('[chain3] F2 running (reserve 2048 diagnosis)...');
  await run(path.join(HERE, 'run-dev.mjs'), env);
}

// F summary draft
const summary = { schema: 'condition-f-results-v1', at: new Date().toISOString(), artifact: OFFICIAL, artifact_sha256: '02a8b7e17487d326e46d68ce0ba24211e1b80a14c4cd0597fa73c1cd697f52ed', treatment, runs: {} };
for (const label of ['lfm-official-f1', 'lfm-official-f2']) {
  try {
    const r = JSON.parse(await fs.readFile(path.resolve(REPO, 'experiments', 'resident-orchestration', 'results', `DEV-${label}.json`), 'utf8'));
    summary.runs[label] = { summary: r.summary, errors: (r.rows ?? []).filter(x => x.error).map(x => x.example_id), zero_char_rows: (r.rows ?? []).filter(x => x.chars === 0).map(x => x.example_id) };
  } catch { summary.runs[label] = { error: 'missing' }; }
}
await fs.writeFile(path.resolve(REPO, 'docs', 'resident', 'CONDITION-F-RESULTS.json'), JSON.stringify(summary, null, 2));
console.log('[chain3] F summary:', JSON.stringify(summary.runs));
console.log('[chain3] complete');
