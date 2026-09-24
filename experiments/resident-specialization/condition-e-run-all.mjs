// Condition E runner: obligation graph (E1) then sequencer (E2) across the pool.
// Sequential, one engine at a time; one model at a time; runs AFTER Condition D
// completes. E1 and E2 can be run in one pass (env AIDE_E_CONDITION=e1|e2|both).
import { spawn } from 'node:child_process';
import path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\//, ''));
const REPO = path.resolve(HERE, '..', '..');
const NODE = process.execPath;
const MODE = process.env.AIDE_E_CONDITION ?? 'e1';

const MODELS = [
  { file: 'LFM2.5-2.6B-QAD-Q4_0.gguf', label: 'liq' },
  { file: 'granite-3.3-2b-instruct-Q4_K_M.gguf', label: 'granite' },
  { file: 'SmolLM3-Q4_K_M.gguf', label: 'smollm3' },
  { file: 'Phi-4-mini-instruct-Q4_K_M.gguf', label: 'phi4' },
  { file: 'LFM2.5-2.6B-Terminal-SFT.Q4_K_M.gguf', label: 'terminal' },
  { file: 'Macaw.Q4_K_M.gguf', label: 'macaw' }
];

function run(env) {
  return new Promise(resolve => {
    const child = spawn(NODE, ['--experimental-strip-types', path.join(HERE, 'run-dev.mjs')], {
      cwd: REPO, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true
    });
    child.stdout.on('data', d => process.stdout.write(String(d)));
    child.stderr.on('data', d => process.stdout.write(String(d)));
    child.once('exit', code => resolve(code));
  });
}

const conditions = MODE === 'both' ? ['e1', 'e2'] : [MODE];
for (const condition of conditions) {
  for (const model of MODELS) {
    const label = `${model.label}-${condition}`;
    console.log(`\n=== condition ${condition} ${label} (${model.file}) ===`);
    const env = { AIDE_CANDIDATE_FILE: model.file, AIDE_CANDIDATE_LABEL: label, AIDE_SEAT_PACKET: '1', AIDE_DEV_MAXTOKENS: '1536' };
    if (condition === 'e1') env.AIDE_SEAT_GRAPH = '1';
    else env.AIDE_SEAT_SEQUENCER = '1';
    const code = await run(env);
    console.log(`=== condition ${condition} ${label} exit ${code} ===`);
  }
}
console.log('\n[condition-e] complete');
