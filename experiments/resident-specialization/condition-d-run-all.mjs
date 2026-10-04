// Condition D runner: externalized executive state across the frozen pool.
// Sequential, one engine at a time. Run-dev is invoked with AIDE_SEAT_PACKET=1;
// everything else (tasks/checks/thresholds/reserve 1536) is the frozen apparatus.
import { spawn } from 'node:child_process';
import path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\//, ''));
const REPO = path.resolve(HERE, '..', '..');
const NODE = process.execPath;

const MODELS = [
  { file: 'LFM2.5-2.6B-QAD-Q4_0.gguf', label: 'liq-d' },
  { file: 'granite-3.3-2b-instruct-Q4_K_M.gguf', label: 'granite-d' },
  { file: 'SmolLM3-Q4_K_M.gguf', label: 'smollm3-d' },
  { file: 'Phi-4-mini-instruct-Q4_K_M.gguf', label: 'phi4-d' },
  { file: 'LFM2.5-2.6B-Terminal-SFT.Q4_K_M.gguf', label: 'terminal-d' },
  { file: 'Macaw.Q4_K_M.gguf', label: 'macaw-d' }
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

for (const model of MODELS) {
  console.log(`\n=== condition D ${model.label} (${model.file}) ===`);
  const code = await run({ AIDE_CANDIDATE_FILE: model.file, AIDE_CANDIDATE_LABEL: model.label, AIDE_SEAT_PACKET: '1', AIDE_DEV_MAXTOKENS: '1536' });
  console.log(`=== condition D ${model.label} exit ${code} ===`);
}
console.log('\n[condition-d] all models complete');
