// Post-E1 chain: wait for E1 -> analyze -> conditional E2 -> held-out battery.
// Bounded waits; evidence-based decisions only (no hardcoded outcome).
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\//, ''));
const REPO = path.resolve(HERE, '..', '..');
const NODE = process.execPath;
const CHAIN_LOG = 'E:\\pip_temp\\opencode\\rq-chain.log';
const sleep = ms => new Promise(r => setTimeout(r, ms));

const MODELS = [
  { file: 'LFM2.5-2.6B-QAD-Q4_0.gguf', label: 'liq' },
  { file: 'granite-3.3-2b-instruct-Q4_K_M.gguf', label: 'granite' },
  { file: 'SmolLM3-Q4_K_M.gguf', label: 'smollm3' },
  { file: 'Phi-4-mini-instruct-Q4_K_M.gguf', label: 'phi4' },
  { file: 'LFM2.5-2.6B-Terminal-SFT.Q4_K_M.gguf', label: 'terminal' },
  { file: 'Macaw.Q4_K_M.gguf', label: 'macaw' }
];

function run(file, env) {
  return new Promise(resolve => {
    const child = spawn(NODE, [file], { cwd: REPO, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    child.stdout.on('data', d => process.stdout.write(String(d)));
    child.stderr.on('data', d => process.stdout.write(String(d)));
    child.once('exit', code => resolve(code));
  });
}

async function waitFor(marker, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try { const log = await fs.readFile(CHAIN_LOG, 'utf8'); if (log.includes(marker)) return true; } catch {}
    await sleep(60000);
  }
  return false;
}

console.log('[chain2] waiting for E1 completion...');
if (!await waitFor('[condition-e] complete', 8 * 60 * 60 * 1000)) { console.log('[chain2] E1 timeout'); }

console.log('[chain2] analyzing E1...');
await run(path.join(HERE, 'condition-e-analyze.mjs'), {});

let families = 0;
try {
  const e = JSON.parse(await fs.readFile(path.resolve(REPO, 'docs', 'resident', 'CONDITION-E-RESULTS.json'), 'utf8'));
  families = e.compound_families_with_pass ?? 0;
  console.log(`[chain2] E1 compound families with pass: ${families}`);
} catch { console.log('[chain2] E1 analysis missing; treating as weak (0)'); }

let treatment = 'e1';
if (families < 3) {
  console.log('[chain2] E1 weak on compound -> running E2 (deterministic sequencer)...');
  await run(path.join(HERE, 'condition-e-run-all.mjs'), { AIDE_E_CONDITION: 'e2' });
  treatment = 'e2';
  console.log('[chain2] re-analyzing after E2...');
  await run(path.join(HERE, 'condition-e-analyze.mjs'), {});
} else {
  console.log('[chain2] E1 strong on compound - E2 NOT REQUIRED');
}

console.log(`[chain2] running held-out compound battery with ${treatment} treatment...`);
const heldoutSummary = { schema: 'heldout-summary-v1', at: new Date().toISOString(), treatment, models: {} };
for (const model of MODELS) {
  const label = `${model.label}-heldout`;
  const env = { AIDE_CANDIDATE_FILE: model.file, AIDE_CANDIDATE_LABEL: label, AIDE_DEV_MAXTOKENS: '1536' };
  if (treatment === 'e2') env.AIDE_SEAT_SEQUENCER = '1'; else env.AIDE_SEAT_GRAPH = '1';
  await run(path.join(HERE, 'heldout-run.mjs'), env);
  try {
    const r = JSON.parse(await fs.readFile(path.resolve(REPO, 'experiments', 'resident-orchestration', 'results', `HELDOUT-${label}.json`), 'utf8'));
    heldoutSummary.models[model.label] = r.summary;
  } catch { heldoutSummary.models[model.label] = { error: 'result missing' }; }
}
await fs.writeFile(path.resolve(REPO, 'docs', 'resident', 'CONDITION-E-HELDOUT-RESULTS.json'), JSON.stringify(heldoutSummary, null, 2));
console.log('[chain2] held-out complete:', JSON.stringify(heldoutSummary.models));
console.log('[chain2] complete');
