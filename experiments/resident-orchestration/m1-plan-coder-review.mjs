// M1 — Resident orchestration: operator intent → reconstruct → methodology →
// worker select → plan → coder → harness evidence → deterministic verdict →
// reviewer advisory → Resident interpretation → continuity update.
//
// The operator gives a natural goal; the Resident lane coordinates the workers.
// Workers are proposal-only; every write goes through an approved exact operation.
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import {
  REPO, PROJECT_DIR, prepareProject, bootOrchestration, residentSay, reconstructProject,
  selectMethodology, selectWorkerFor, assignAndRun, approvedWrite, approvedTerminal,
  deterministicVerdict, veritasExecution, writeJson, appendJournal, accountStage, approxTokens,
  readContainmentTail, extractCode
} from './lib.mjs';
import { buildWorkerAssignment } from '../../node/src/services/resident-worker-bridge.mjs';

const JOURNAL = 'resident-orchestration-journal.jsonl';
const mission = {
  mission: 'M1-operator-intent-plan-coder-review',
  started_at: new Date().toISOString(),
  stages: [],
  economics: []
};

await prepareProject();
const containmentBefore = (await readContainmentTail(PROJECT_DIR, 0)).length;
const orch = await bootOrchestration({ models: ['resident', 'planner', 'coder', 'reviewer'] });
let planText = null;
let artifactSha = null;
try {
  // ---- baseline: the failing suite is the mission premise -------------------
  const baseline = await approvedTerminal(orch, 'node', ['--test', 'test/']);
  const baselineCode = baseline.body?.data?.code;
  mission.stages.push({ stage: 'baseline-tests', exit_code: baselineCode, passed: baselineCode === 0 });
  console.log('[m1] baseline exit', baselineCode);

  // ---- 1. operator intent (natural goal) ------------------------------------
  const intent = 'The version parser is failing its tests. Fix it so all tests pass.';
  mission.intent = intent;

  // ---- 2. Resident understanding + questions --------------------------------
  const understanding = await residentSay(orch, `${intent}\n\nIn two sentences: state the objective and what project state you need before delegating.`);
  mission.stages.push({ stage: 'resident-understanding', output: understanding.text, timing_ms: understanding.timingMs });
  mission.economics.push(accountStage('resident-understanding', { residentInput: approxTokens(intent), outputTokens: approxTokens(understanding.text), calls: 1 }));

  // ---- 3. project reconstruction (canonical state only) ---------------------
  const reconstruction = await reconstructProject(orch);
  mission.reconstruction = reconstruction;
  mission.stages.push({ stage: 'reconstruction', summary: { stage: reconstruction.stage, branch: reconstruction.branch, changes: reconstruction.changes.length, objective: reconstruction.objective } });

  // ---- 4. methodology (canonical SOP discovery + deterministic selection) ---
  const methodology = await selectMethodology(intent);
  mission.methodology = { ids: methodology.selection.ids, mode: methodology.selection.mode, operation_class: methodology.selection.operation_class, candidates: methodology.candidates.slice(0, 3) };
  mission.stages.push({ stage: 'methodology', ids: methodology.selection.ids, mode: methodology.selection.mode });

  // ---- 5. worker selection from the live Arsenal projection -----------------
  const plannerPick = await selectWorkerFor(orch, 'planner');
  const coderPick = await selectWorkerFor(orch, 'coder');
  const reviewerPick = await selectWorkerFor(orch, 'reviewer');
  mission.workers = { planner: plannerPick.pick, coder: coderPick.pick, reviewer: reviewerPick.pick, projection: plannerPick.projection_summary };

  // ---- 6. planner assignment (bounded; receives reconstruction, not transcript)
  const plannerModel = orch.started['qwen2.5-coder-1.5b-instruct-q4_k_m.gguf'];
  const planAssignment = buildWorkerAssignment({
    objective: reconstruction.objective ?? intent,
    workflowStage: reconstruction.stage ?? 'IMPLEMENTATION',
    requestedRole: 'planner',
    task: 'Produce a bounded implementation plan (max 5 steps) for: ' + intent + '\nAcceptance: the project test suite exits 0 without weakening tests.\nRelevant files: src/version.mjs, test/version.test.mjs.',
    constraints: ['proposal-only', 'no test weakening', 'keep public function name'],
    canonicalProjectState: `stage=${reconstruction.stage}; branch=${reconstruction.branch}; changes=${reconstruction.changes.map(c => c.path).join(',') || 'none'}`,
    requiredSkills: methodology.selection.ids.slice(0, 2),
    requiredEvidence: ['plan artifact'],
    returnContract: 'numbered plan, no code'
  });
  const plannerResult = await assignAndRun({ orch, role: 'planner', model: plannerModel, assignment: planAssignment, maxTokens: 420 });
  planText = plannerResult.text.trim();
  mission.plan = { assignment: planAssignment, raw: planText.slice(0, 1200), model: plannerModel.id, latency_ms: plannerResult.latency_ms };
  mission.economics.push(accountStage('planner', { workerContext: approxTokens(JSON.stringify(planAssignment)), outputTokens: approxTokens(planText), calls: 1, note: 'assignment carries reconstruction, not transcript' }));
  console.log('[m1] plan chars', planText.length);

  // ---- 7. coder receives the ACCEPTED PLAN ----------------------------------
  const coderModel = orch.started['qwen2.5-coder-1.5b-instruct-q4_k_m.gguf'];
  const coderAssignment = buildWorkerAssignment({
    objective: reconstruction.objective ?? intent,
    workflowStage: 'IMPLEMENTATION',
    requestedRole: 'coder',
    task: 'Implement the accepted plan. Return ONLY one fenced javascript code block containing the full replacement for src/version.mjs.\nACCEPTED PLAN:\n' + planText.slice(0, 1200) + '\nAcceptance: node --test exits 0; keep the export name parseVersion.',
    constraints: ['proposal-only', 'no test edits', 'single file'],
    canonicalProjectState: 'accepted plan above; target file src/version.mjs',
    requiredSkills: methodology.selection.ids.slice(0, 1),
    requiredEvidence: ['implementation artifact', 'test execution evidence'],
    returnContract: 'one fenced code block',
    scratchTarget: 'src/version.mjs'
  });
  const coderResult = await assignAndRun({ orch, role: 'coder', model: coderModel, assignment: coderAssignment, maxTokens: 520 });
  const code = extractCode(coderResult.text);
  assert.ok(code, 'coder produced a fenced code block');
  const write = await approvedWrite(orch, 'src/version.mjs', code + '\n');
  assert.equal(write.status, 200, JSON.stringify(write.body).slice(0, 200));
  artifactSha = createHash('sha256').update(code + '\n').digest('hex');
  mission.coder = { model: coderModel.id, artifact_sha256: artifactSha, write_status: write.status, latency_ms: coderResult.latency_ms };
  mission.economics.push(accountStage('coder', { workerContext: approxTokens(JSON.stringify(coderAssignment)), outputTokens: approxTokens(coderResult.text), calls: 1, note: 'coder received the accepted plan, not the conversation' }));
  console.log('[m1] coder artifact sha', artifactSha.slice(0, 12));

  // ---- 8. harness execution (approved terminal = real execution evidence) ---
  const tests = await approvedTerminal(orch, 'node', ['--test', 'test/']);
  const exitCode = tests.body?.data?.code;
  const stdout = String(tests.body?.data?.stdout ?? '');
  const { execution, veritas } = veritasExecution({ command: 'node --test test/', exitCode, stdout, artifactSha });
  const verdict = deterministicVerdict(execution.checks);
  mission.harness = { exit_code: exitCode, stdout_tail: stdout.split('\n').slice(-8).join('\n'), execution, veritas, deterministic: verdict };
  mission.economics.push(accountStage('harness', { calls: 0, note: 'approved terminal execution; no model call' }));
  console.log('[m1] tests exit', exitCode, 'deterministic', verdict.passed ? 'PASS' : 'FAIL');

  // ---- 9. reviewer receives objective + change + execution evidence ---------
  const reviewerModel = orch.started['qwen2.5-coder-0.5b-instruct-q4_k_m.gguf'];
  const reviewAssignment = buildWorkerAssignment({
    objective: reconstruction.objective ?? intent,
    workflowStage: 'VALIDATION',
    requestedRole: 'reviewer',
    task: 'Review the change against the acceptance criteria. State PASS or FAIL with reasons; do not trust the coder.',
    constraints: ['independent review', 'adversarial check'],
    canonicalProjectState: 'change applied to src/version.mjs; see execution evidence',
    requiredSkills: ['verification'],
    requiredEvidence: ['artifact', 'acceptance criteria', 'execution evidence'],
    returnContract: 'verdict + reasons',
    executionEvidence: { result: JSON.stringify(execution.checks), artifact_sha256: artifactSha, exit_code: exitCode }
  });
  const reviewerResult = await assignAndRun({ orch, role: 'reviewer', model: reviewerModel, assignment: reviewAssignment, maxTokens: 420 });
  const advisory = String(reviewerResult.text).trim().split('\n')[0].slice(0, 80);
  mission.review = { model: reviewerModel.id, advisory, raw: reviewerResult.text.slice(0, 800), latency_ms: reviewerResult.latency_ms };
  mission.economics.push(accountStage('reviewer', { workerContext: approxTokens(JSON.stringify(reviewAssignment)), outputTokens: approxTokens(reviewerResult.text), calls: 1 }));
  // Program 15 invariant: deterministic failure cannot be overridden by advisory PASS.
  mission.verdict = { deterministic: verdict.passed ? 'PASS' : 'FAIL', advisory, authoritative: verdict.passed ? 'PASS' : 'FAIL' };
  console.log('[m1] deterministic', mission.verdict.deterministic, '| advisory', advisory);

  // ---- 10. Resident interpretation (governed) -------------------------------
  const interpretation = await residentSay(orch, 'Canonical verdict (deterministic execution gate): ' + mission.verdict.authoritative + '\nReviewer advisory (not authoritative): ' + advisory + '\nTest exit code: ' + exitCode + '\nSummarize the mission outcome honestly and state the next lawful step.');
  mission.interpretation = interpretation.text;
  mission.economics.push(accountStage('resident-interpretation', { residentInput: 120, outputTokens: approxTokens(interpretation.text), calls: 1 }));
  console.log('[m1] resident says:', interpretation.text.replace(/\s+/g, ' ').slice(0, 120));

  // ---- 11. continuity update (canonical project state) ----------------------
  const continuity = {
    at: new Date().toISOString(),
    mission: mission.mission,
    objective: reconstruction.objective,
    stage: reconstruction.stage,
    completed: [{ what: 'version parser fixed to contract', artifact_sha256: artifactSha, evidence: 'node --test exit ' + exitCode }],
    failures: exitCode === 0 ? [] : [{ what: 'test suite still failing', exit_code: exitCode }],
    blockers: [],
    next_step: exitCode === 0 ? 'review the change and continue the project objective' : 'replan and retry the implementation',
    verdict: mission.verdict
  };
  await fs.mkdir(path.join(PROJECT_DIR, '.aide', 'orch'), { recursive: true });
  await fs.appendFile(path.join(PROJECT_DIR, '.aide', 'orch', 'continuity.jsonl'), JSON.stringify(continuity) + '\n', 'utf8');
  await fs.writeFile(path.join(PROJECT_DIR, '.aide', 'orch', 'PROJECT_STATE.md'), [
    '# Mission state', '', `- objective: ${continuity.objective}`, `- stage: ${continuity.stage}`,
    `- completed: ${continuity.completed.map(c => c.what).join('; ') || 'none'}`,
    `- verdict: ${continuity.verdict.authoritative} (deterministic) / ${continuity.verdict.advisory} (advisory)`,
    `- next: ${continuity.next_step}`, ''
  ].join('\n'), 'utf8');
  mission.continuity = continuity;

  // ---- 12. governance + economics -------------------------------------------
  const containmentAfter = await readContainmentTail(PROJECT_DIR, containmentBefore);
  mission.containment_events = containmentAfter.map(row => ({ request: String(row.request ?? '').slice(0, 60), disposition: row.disposition, triggers: row.triggers }));
  mission.finished_at = new Date().toISOString();
  const resultFile = await writeJson('M1-plan-coder-review.json', mission);
  await appendJournal(JOURNAL, { mission: mission.mission, at: mission.finished_at, verdict: mission.verdict, exit_code: exitCode, artifact_sha256: artifactSha, workers: mission.workers, methodology: mission.methodology });
  console.log('[m1] DONE ->', resultFile);
} catch (error) {
  mission.error = String(error && error.stack ? error.stack.split('\n')[0] : error);
  mission.finished_at = new Date().toISOString();
  await writeJson('M1-plan-coder-review.json', mission);
  await appendJournal(JOURNAL, { mission: mission.mission, at: mission.finished_at, error: mission.error });
  console.log('[m1] FAILED:', mission.error);
} finally {
  await orch.close().catch(() => {});
}
