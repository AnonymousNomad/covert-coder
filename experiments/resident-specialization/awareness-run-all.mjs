// Sequential A/B/C runner for the operational-awareness experiment (2026-09-23).
// Phases: comprehension + frozen 20-row screen for each condition:
//   A = current Resident path (doctrine + canonical state)
//   B = + Resident Operational Map
//   C = + Map + deterministic Situation Frame
// Children are spawned one at a time (single engine at a time, RAM-safe);
// each child writes its own results JSON; failures do not stop the sequence.
import { spawn } from 'node:child_process';
import path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\//, ''));
const REPO = path.resolve(HERE, '..', '..');
const MAP = path.join(REPO, 'docs', 'resident', 'RESIDENT-OPERATIONAL-MAP.md');
const CANDIDATE = 'LFM2.5-2.6B-QAD-Q4_0.gguf';
const NODE = process.execPath;

const PHASES = [
  { kind: 'comp', label: 'liq-a', map: false, frame: false },
  { kind: 'screen', label: 'liq-a', map: false, frame: false },
  { kind: 'comp', label: 'liq-b', map: true, frame: false },
  { kind: 'screen', label: 'liq-b', map: true, frame: false },
  { kind: 'comp', label: 'liq-c', map: true, frame: true },
  { kind: 'screen', label: 'liq-c', map: true, frame: true }
];

function run(file, env) {
  return new Promise(resolve => {
    const child = spawn(NODE, ['--experimental-strip-types', file], {
      cwd: REPO, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true
    });
    child.stdout.on('data', d => process.stdout.write(String(d)));
    child.stderr.on('data', d => process.stdout.write(String(d)));
    child.once('exit', code => resolve(code));
  });
}

const SKIP = new Set((process.env.AIDE_AWARENESS_SKIP ?? '').split(',').map(s => s.trim()).filter(Boolean));
for (const phase of PHASES) {
  if (SKIP.has(`${phase.kind}-${phase.label}`)) { console.log(`\n=== skip ${phase.kind} ${phase.label} (already complete) ===`); continue; }
  const env = { AIDE_CANDIDATE_FILE: CANDIDATE, AIDE_DEV_MAXTOKENS: '1536' };
  if (phase.map) env.AIDE_SEAT_MAP_FILE = MAP;
  if (phase.frame) env.AIDE_SEAT_FRAME = '1';
  if (phase.kind === 'comp') env.AIDE_COMP_LABEL = phase.label; else env.AIDE_CANDIDATE_LABEL = phase.label;
  console.log(`\n=== ${phase.kind} ${phase.label} map=${!!phase.map} frame=${!!phase.frame} ===`);
  const code = await run(path.join(HERE, phase.kind === 'comp' ? 'comprehension-test.mjs' : 'run-dev.mjs'), env);
  console.log(`=== ${phase.kind} ${phase.label} exit ${code} ===`);
}
console.log('\n[awareness] all phases complete');
