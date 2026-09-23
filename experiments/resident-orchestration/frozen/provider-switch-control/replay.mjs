// Frozen provider-switch replay: SAME mission, DIFFERENT coder worker.
// Usage (when a governed provider path is exposed):
//   AIDE_FROZEN_WORKER=openai-compatible AIDE_FROZEN_WORKER_ENDPOINT=http://127.0.0.1:PORT \
//   AIDE_FROZEN_WORKER_MODEL=<model-id> node experiments/resident-orchestration/frozen/provider-switch-control/replay.mjs
//
// The replay copies PROJECT-SNAPSHOT to a fresh workspace, reproduces the frozen
// assignment (same objective/plan/acceptance/constraints), applies the proposal
// through the SAME approved operations, executes the SAME tests, and compares the
// deterministic verdict with the frozen local FAIL.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { buildWorkerAssignment } from '../../../../node/src/services/resident-worker-bridge.mjs';
import { evaluateExecution } from '../../../../harness/veritas.mjs';

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\//, ''));
const MISSION = JSON.parse(await fs.readFile(path.join(HERE, 'MISSION.json'), 'utf8'));
const WORKSPACE = process.env.AIDE_FROZEN_WORKSPACE || 'E:\\pip_temp\\opencode\\resident-orch-replay';
const ENDPOINT = process.env.AIDE_FROZEN_WORKER_ENDPOINT;
const MODEL = process.env.AIDE_FROZEN_WORKER_MODEL || 'external-worker';
if (!ENDPOINT) throw new Error('AIDE_FROZEN_WORKER_ENDPOINT is required (governed provider endpoint)');

await fs.rm(WORKSPACE, { recursive: true, force: true });
await fs.cp(path.join(HERE, 'PROJECT-SNAPSHOT'), WORKSPACE, { recursive: true });

// SAME assignment (frozen plan is reconstructed from the local run's plan text).
const assignment = buildWorkerAssignment({
  objective: MISSION.objective,
  workflowStage: 'IMPLEMENTATION',
  requestedRole: 'coder',
  task: 'Implement the FULL module now. Return ONLY one fenced javascript code block with the complete replacement for src/version.mjs. Contract: parseVersion(value) returns {major,minor,patch} for strict N.N.N numeric segments only, else null; reject "1.2", "v1.2.3", "1.2.x". No placeholders. Acceptance: ' + MISSION.acceptance_criteria,
  constraints: ['proposal-only', 'no test edits', 'no placeholders', 'complete implementation'],
  canonicalProjectState: 'src/version.mjs currently fails its contract tests',
  requiredEvidence: ['implementation artifact', 'test execution evidence'],
  returnContract: 'one fenced code block',
  scratchTarget: 'src/version.mjs'
});
const response = await fetch(ENDPOINT.replace(/\/$/, '') + '/chat/completions', {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ messages: [{ role: 'system', content: 'You are a worker; proposal-only; return one fenced code block.' }, { role: 'user', content: JSON.stringify(assignment, null, 2) }], max_tokens: 700, temperature: 0.1 }),
  signal: AbortSignal.timeout(300000)
});
const body = await response.json();
const text = String(body?.choices?.[0]?.message?.content ?? '');
const fenced = /\`\`\`[a-z]*\n([\s\S]*?)\`\`\`/i.exec(text);
if (!fenced) { console.log('[replay] worker produced no fenced code block — capacity failure reproduced'); process.exit(2); }
await fs.writeFile(path.join(WORKSPACE, 'src', 'version.mjs'), fenced[1] + '\n', 'utf8');
let exitCode = 1; let stdout = '';
try { stdout = execFileSync('node', ['--test', 'test/'], { cwd: WORKSPACE, encoding: 'utf8', timeout: 120000 }); exitCode = 0; } catch (error) { exitCode = error.status ?? 1; stdout = String(error.stdout ?? ''); }
const execution = { passed: exitCode === 0, results: [{ command: 'node --test test/', exitCode, stdout_tail: stdout.split('\n').slice(-6).join('\n') }], checks: [{ name: 'tests-green', passed: exitCode === 0 }] };
const veritas = evaluateExecution(execution);
console.log('[replay] worker=' + MODEL + ' exit=' + exitCode + ' deterministic=' + (exitCode === 0 ? 'PASS' : 'FAIL'));
console.log('[replay] veritas=' + JSON.stringify(veritas).slice(0, 160));
console.log('[replay] control local result: ' + JSON.stringify(MISSION.local_result.m2));
