// Freeze the failed real-development mission as the provider-switch CONTROL case.
// The frozen bundle is self-contained: project code state, objective, plan, SOP,
// acceptance criteria, tests, evidence, worker, failure, Resident response, and a
// replay runner that reruns the SAME mission against a DIFFERENT worker endpoint.
import { promises as fs } from 'node:fs';
import path from 'node:path';

const REPO = 'E:\\aide-sovereign-workbench';
const PROJECT = 'E:\\pip_temp\\opencode\\resident-orch-project';
const OUT = path.join(REPO, 'experiments', 'resident-orchestration', 'frozen', 'provider-switch-control');
const SNAPSHOT = path.join(OUT, 'PROJECT-SNAPSHOT');

const m1 = JSON.parse(await fs.readFile(path.join(REPO, 'experiments', 'resident-orchestration', 'results', 'M1-plan-coder-review.json'), 'utf8'));
const m2 = JSON.parse(await fs.readFile(path.join(REPO, 'experiments', 'resident-orchestration', 'results', 'M2M3-restart-continuity-failure-recovery.json'), 'utf8'));

await fs.rm(OUT, { recursive: true, force: true });
await fs.mkdir(SNAPSHOT, { recursive: true });
for (const rel of ['package.json', 'PROJECT.md', 'src/version.mjs', 'test/version.test.mjs', '.aide/workflow/state.json', '.aide/orch/PROJECT_STATE.md', '.aide/orch/continuity.jsonl']) {
  const source = path.join(PROJECT, rel);
  const target = path.join(SNAPSHOT, rel);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.copyFile(source, target).catch(() => {});
}

const control = {
  schema: 'provider-switch-control-v1',
  frozen_at: new Date().toISOString(),
  objective: m1.reconstruction?.objective ?? 'make the version parser obey its contract tests',
  acceptance_criteria: 'the project test suite exits 0 without weakening tests; keep the public function name parseVersion',
  tests: 'node --test test/',
  sop_selection: m1.methodology?.ids ?? [],
  method: 'resident orchestration lane: reconstruction -> assignment (plan) -> coder proposal applied via approved write -> approved terminal execution -> deterministic verdict -> reviewer advisory',
  authority: 'approved exact operations only (file.write, terminal.run); proposal-only workers',
  harness: 'node/src/routes/terminal.ts (approved), node/src/routes/file.ts (approved)',
  veritas: 'deterministic execution checks + harness/veritas.mjs evaluateExecution',
  worker_used_local: { id: 'qwen2.5-coder-1.5b-instruct-q4_k_m', endpoint_kind: 'local llama-server' },
  alt_worker_local: { id: 'smollm2-360m-instruct-q8_0' },
  local_result: {
    m1: { artifact_sha256: m1.coder?.artifact_sha256 ?? null, exit_code: m1.harness?.exit_code ?? null, deterministic: m1.verdict?.deterministic ?? null, advisory: m1.verdict?.advisory ?? null, placeholder_detected: /implementation logic here/i.test(await fs.readFile(path.join(SNAPSHOT, 'src', 'version.mjs'), 'utf8')) },
    m2: { attempts: m2.attempts ?? [], deterministic: m2.verdict?.deterministic ?? null, advisory: m2.verdict?.advisory ?? null, action: m2.decision?.action ?? null, action_reason: m2.decision?.reason ?? null }
  },
  failure_evidence: m2.failure ?? null,
  resident_response: { continue: m2.continue ?? null, decision: m2.decision ?? null, interpretation: m1.interpretation ?? null },
  replay_contract: {
    same: ['resident', 'project (snapshot)', 'objective', 'workflow', 'SOP selection', 'acceptance criteria', 'authority', 'harness', 'veritas'],
    different: ['coder worker (provider/model)'],
    rule: 'Do not rewrite the task or add project truth manually; any context must come through the canonical assignment.'
  }
};
await fs.writeFile(path.join(OUT, 'MISSION.json'), JSON.stringify(control, null, 2), 'utf8');

const replay = `// Frozen provider-switch replay: SAME mission, DIFFERENT coder worker.
// Usage (when a governed provider path is exposed):
//   AIDE_FROZEN_WORKER=openai-compatible AIDE_FROZEN_WORKER_ENDPOINT=http://127.0.0.1:PORT \\
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

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\\//, ''));
const MISSION = JSON.parse(await fs.readFile(path.join(HERE, 'MISSION.json'), 'utf8'));
const WORKSPACE = process.env.AIDE_FROZEN_WORKSPACE || 'E:\\\\pip_temp\\\\opencode\\\\resident-orch-replay';
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
const response = await fetch(ENDPOINT.replace(/\\/$/, '') + '/chat/completions', {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ messages: [{ role: 'system', content: 'You are a worker; proposal-only; return one fenced code block.' }, { role: 'user', content: JSON.stringify(assignment, null, 2) }], max_tokens: 700, temperature: 0.1 }),
  signal: AbortSignal.timeout(300000)
});
const body = await response.json();
const text = String(body?.choices?.[0]?.message?.content ?? '');
const fenced = /\\\`\\\`\\\`[a-z]*\\n([\\s\\S]*?)\\\`\\\`\\\`/i.exec(text);
if (!fenced) { console.log('[replay] worker produced no fenced code block — capacity failure reproduced'); process.exit(2); }
await fs.writeFile(path.join(WORKSPACE, 'src', 'version.mjs'), fenced[1] + '\\n', 'utf8');
let exitCode = 1; let stdout = '';
try { stdout = execFileSync('node', ['--test', 'test/'], { cwd: WORKSPACE, encoding: 'utf8', timeout: 120000 }); exitCode = 0; } catch (error) { exitCode = error.status ?? 1; stdout = String(error.stdout ?? ''); }
const execution = { passed: exitCode === 0, results: [{ command: 'node --test test/', exitCode, stdout_tail: stdout.split('\\n').slice(-6).join('\\n') }], checks: [{ name: 'tests-green', passed: exitCode === 0 }] };
const veritas = evaluateExecution(execution);
console.log('[replay] worker=' + MODEL + ' exit=' + exitCode + ' deterministic=' + (exitCode === 0 ? 'PASS' : 'FAIL'));
console.log('[replay] veritas=' + JSON.stringify(veritas).slice(0, 160));
console.log('[replay] control local result: ' + JSON.stringify(MISSION.local_result.m2));
`;
await fs.writeFile(path.join(OUT, 'replay.mjs'), replay, 'utf8');

await fs.writeFile(path.join(OUT, 'REPLAY.md'), [
  '# Provider-switch control case (frozen)',
  '',
  'This bundle freezes the REAL development mission that ended in a verified local',
  'FAIL (weak local coder produced a placeholder; deterministic gate refused it).',
  'When a governed provider path exists (DeepSeek-owned wiring), rerun the SAME',
  'mission with a DIFFERENT worker using `replay.mjs` and compare verdicts.',
  '',
  '- Same: Resident, project snapshot, objective, workflow, SOP selection,',
  '  acceptance criteria, authority, harness, veritas.',
  '- Different: the coder worker (provider/model).',
  '- Do not rewrite the task or add hidden truth; context must flow through the',
  '  canonical assignment.',
  '',
  `Local control result: ${JSON.stringify(control.local_result.m2)}`
].join('\n'), 'utf8');

// Provider path availability (static, honest): a governed provider requires an
// approved provider entry + credentials in this workspace.
const byokCandidates = [
  path.join(PROJECT, '.aide', 'byok', 'providers.json'),
  path.join(REPO, '.aide', 'byok', 'providers.json'),
  path.join(PROJECT, '.aide', 'connections.json')
];
const present = [];
for (const candidate of byokCandidates) if (await fs.stat(candidate).then(() => true).catch(() => false)) present.push(candidate);
console.log('[freeze] provider credential/bridge files present:', present.length > 0 ? present.join(', ') : 'NONE');
console.log('[freeze] provider path available:', present.length > 0 ? 'POSSIBLE (verify governed approval)' : 'NO');
console.log('[freeze] bundle written to', OUT);
