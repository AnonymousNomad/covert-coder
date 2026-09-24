// M2/M3 — Continue after restart + worker-failure recovery + model switch.
//
// The project state from M1 persists on disk (failing tests + continuity entry).
// This runner boots a FRESH stack (no transcript, no in-memory state), asks the
// Resident to continue, feeds it the structured failure, and executes its chosen
// next action — including switching the coder model — then verifies.
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import {
  PROJECT_DIR, bootOrchestration, residentSay, reconstructProject, selectMethodology,
  selectWorkerFor, assignAndRun, approvedWrite, approvedTerminal, deterministicVerdict,
  veritasExecution, writeJson, appendJournal, accountStage, approxTokens, readContainmentTail,
  extractCode, WORKER_MODELS
} from './lib.mjs';
import { buildWorkerAssignment } from '../../node/src/services/resident-worker-bridge.mjs';

const JOURNAL = 'resident-orchestration-journal.jsonl';
const mission = { mission: 'M2M3-restart-continuity-failure-recovery', started_at: new Date().toISOString(), stages: [], economics: [] };

const containmentBefore = (await readContainmentTail(PROJECT_DIR, 0)).length;
const orch = await bootOrchestration({ models: ['resident', 'coder', 'reviewer', 'alt'] });
try {
  // ---- 1. reconstruction from CANONICAL state only (no transcript) ----------
  const reconstruction = await reconstructProject(orch);
  const continuity = (await fs.readFile(path.join(PROJECT_DIR, '.aide', 'orch', 'continuity.jsonl'), 'utf8'))
    .trim().split('\n').map(line => { try { return JSON.parse(line); } catch { return null; } }).filter(Boolean);
  const lastState = continuity.at(-1) ?? null;
  const projectStateMd = await fs.readFile(path.join(PROJECT_DIR, '.aide', 'orch', 'PROJECT_STATE.md'), 'utf8').catch(() => '');
  mission.reconstruction = { workflow: reconstruction, continuity_entries: continuity.length, last_state: lastState, project_state_md: projectStateMd };
  mission.stages.push({ stage: 'reconstruction-after-restart', stage_name: reconstruction.stage, continuity_entries: continuity.length, last_verdict: lastState?.verdict ?? null });

  // ---- 2. "Continue." — Resident must reconstruct from system truth ---------
  const cont = await residentSay(orch, 'Continue.\n\nReconstruct the current project state from the canonical state below. Answer in exactly four short lines, each starting with the given label and nothing else:\na) OBJECTIVE: <one line>\nb) COMPLETED: <one line>\nc) FAILED: <one line>\nd) NEXT: <one line>\n\nCanonical state: ' + JSON.stringify({ stage: reconstruction.stage, objective: reconstruction.objective, changes: reconstruction.changes.map(c => c.path), continuity: lastState }), { maxTokens: 200 });
  mission.continue = cont.text;
  mission.economics.push(accountStage('resident-continue', { residentInput: 180, outputTokens: approxTokens(cont.text), calls: 1 }));
  console.log('[m2] continue says:', cont.text.replace(/\s+/g, ' ').slice(0, 160));

  // ---- 3. structured failure from canonical evidence ------------------------
  const baseline = await approvedTerminal(orch, 'node', ['--test', 'test/']);
  const currentSource = await fs.readFile(path.join(PROJECT_DIR, 'src', 'version.mjs'), 'utf8');
  const placeholder = /implementation logic here|todo|your code/i.test(currentSource);
  const failure = {
    kind: 'VERIFICATION_FAILURE',
    exit_code: baseline.body?.data?.code,
    artifact_placeholder_detected: placeholder,
    artifact_sha256: createHash('sha256').update(currentSource).digest('hex'),
    prior_worker: WORKER_MODELS.planner.id,
    detail: 'the previous coder artifact did not implement the contract (tests exit ' + baseline.body?.data?.code + (placeholder ? '; placeholder content detected' : '') + ')'
  };
  mission.failure = failure;

  // ---- 4. Resident chooses the next action (evidence-driven, no thrashing) --
  const decisionPrompt = 'A worker failure was recorded.\nStructured failure: ' + JSON.stringify(failure) +
    '\nAvailable actions: RETRY_SAME_WORKER, DIFFERENT_WORKER, REPLAN, ASK_OPERATOR, FAIL_CLOSED.' +
    '\nChoose exactly one action and give one sentence of reason plus the expected benefit. Format: ACTION: <action> | REASON: <sentence>';
  const decision = await residentSay(orch, decisionPrompt);
  const action = (/(RETRY_SAME_WORKER|DIFFERENT_WORKER|REPLAN|ASK_OPERATOR|FAIL_CLOSED)/.exec(decision.text) ?? [null])[0] ?? 'FAIL_CLOSED';
  const reason = (/REASON:\s*([^\n]+)/.exec(decision.text) ?? [null, decision.text.replace(/\s+/g, ' ').slice(0, 160)])[1];
  mission.decision = { raw: decision.text, action, reason };
  mission.economics.push(accountStage('resident-decision', { residentInput: 200, outputTokens: approxTokens(decision.text), calls: 1 }));
  console.log('[m2] resident action:', action, '|', String(reason).slice(0, 100));

  // ---- 5. execute the chosen action (honored; bounded recovery) -------------
  let attempt = 0;
  let exitCode = failure.exit_code;
  let artifactSha = null;
  let modelUsed = null;
  let advisory = null;
  const attemptsLog = [];
  // The Resident's decision drives the recovery plan. ASK_OPERATOR / FAIL_CLOSED
  // stop here — the mission does not continue merely to appear autonomous.
  let revisedPlan = null;
  if (action === 'REPLAN') {
    const plannerModel = orch.started[WORKER_MODELS.planner.file];
    const replanAssignment = buildWorkerAssignment({
      objective: reconstruction.objective,
      workflowStage: 'IMPLEMENTATION',
      requestedRole: 'planner',
      task: 'The implementation failed verification. Produce a REVISED bounded implementation plan (max 5 steps) that avoids the failure. Failure evidence: ' + JSON.stringify(failure) + '\nThe plan must specify the exact validation logic for parseVersion (strict N.N.N numeric segments, else null).',
      constraints: ['proposal-only', 'no test weakening'],
      canonicalProjectState: 'src/version.mjs fails its contract tests; placeholder artifact was produced',
      requiredSkills: ['verification'],
      requiredEvidence: ['revised plan artifact'],
      returnContract: 'numbered plan, no code'
    });
    const replanResult = await assignAndRun({ orch, role: 'planner', model: plannerModel, assignment: replanAssignment, maxTokens: 420 });
    revisedPlan = replanResult.text.trim();
    mission.revised_plan = revisedPlan.slice(0, 1200);
    mission.economics.push(accountStage('replan', { workerContext: approxTokens(JSON.stringify(replanAssignment)), outputTokens: approxTokens(replanResult.text), calls: 1, note: 'action honored: REPLAN produced a revised plan' }));
    console.log('[m2] replan chars', revisedPlan.length);
  }
  const willAttempt = action === 'RETRY_SAME_WORKER' || action === 'DIFFERENT_WORKER' || action === 'REPLAN';
  mission.action_honored = { action, attempted: willAttempt };
  while (willAttempt && attempt < 2 && exitCode !== 0) {
    attempt += 1;
    // DIFFERENT_WORKER switches immediately; RETRY_SAME_WORKER/REPLAN try the
    // primary worker first and escalate to the alternate only after a failure.
    const useAlt = action === 'DIFFERENT_WORKER' ? attempt === 1 : attempt === 2;
    const coderModel = useAlt ? orch.started[WORKER_MODELS.alt.file] : orch.started[WORKER_MODELS.planner.file];
    modelUsed = coderModel.id;
    const switchReason = useAlt
      ? (attempt === 1 ? reason : 'previous attempt still failed after the chosen action; bounded recovery escalates to a different local worker')
      : (action === 'REPLAN' ? 'retry with the REVISED plan (action honored)' : 'retry same worker with the recorded failure evidence');
    const coderAssignment = buildWorkerAssignment({
      objective: reconstruction.objective,
      workflowStage: 'IMPLEMENTATION',
      requestedRole: 'coder',
      task: 'Implement the FULL module now. Return ONLY one fenced javascript code block with the complete replacement for src/version.mjs.\nContract: parseVersion(value) returns {major,minor,patch} for strict N.N.N with numeric segments only, else null. Reject "1.2", "v1.2.3", "1.2.x". No placeholders — a stub is a failure.\n' + (revisedPlan ? 'REVISED PLAN:\n' + revisedPlan.slice(0, 1000) + '\n' : '') + 'Previous failure evidence: ' + JSON.stringify(failure),
      constraints: ['proposal-only', 'no test edits', 'no placeholders', 'complete implementation'],
      canonicalProjectState: 'src/version.mjs currently fails its contract tests',
      requiredSkills: ['verification'],
      requiredEvidence: ['implementation artifact', 'test execution evidence'],
      returnContract: 'one fenced code block',
      scratchTarget: 'src/version.mjs'
    });
    const coderResult = await assignAndRun({ orch, role: 'coder', model: coderModel, assignment: coderAssignment, maxTokens: 520 });
    const code = extractCode(coderResult.text);
    if (code) {
      const write = await approvedWrite(orch, 'src/version.mjs', code + '\n');
      assert.equal(write.status, 200);
      artifactSha = createHash('sha256').update(code + '\n').digest('hex');
    }
    const tests = await approvedTerminal(orch, 'node', ['--test', 'test/']);
    exitCode = tests.body?.data?.code;
    attemptsLog.push({ attempt, model: modelUsed, switched: useAlt, switch_reason: switchReason, artifact_sha256: artifactSha, exit_code: exitCode, code_extracted: code !== null });
    mission.economics.push(accountStage('coder-attempt-' + attempt, { workerContext: approxTokens(JSON.stringify(coderAssignment)), outputTokens: approxTokens(coderResult.text), calls: 1, note: switchReason }));
    console.log('[m2] attempt', attempt, modelUsed, 'exit', exitCode, artifactSha ? 'sha ' + artifactSha.slice(0, 10) : 'no artifact');
  }
  mission.attempts = attemptsLog;

  // ---- 6. deterministic verdict + reviewer advisory -------------------------
  const tests = await approvedTerminal(orch, 'node', ['--test', 'test/']);
  const stdout = String(tests.body?.data?.stdout ?? '');
  const { execution, veritas } = veritasExecution({ command: 'node --test test/', exitCode: tests.body?.data?.code, stdout, artifactSha: artifactSha ?? failure.artifact_sha256 });
  const verdict = deterministicVerdict(execution.checks);
  const reviewerModel = orch.started[WORKER_MODELS.reviewer.file];
  const reviewAssignment = buildWorkerAssignment({
    objective: reconstruction.objective,
    workflowStage: 'VALIDATION',
    requestedRole: 'reviewer',
    task: 'Review the change against the acceptance criteria. State PASS or FAIL with reasons; do not trust the coder.',
    constraints: ['independent review'],
    canonicalProjectState: 'change applied to src/version.mjs',
    requiredSkills: ['verification'],
    requiredEvidence: ['artifact', 'acceptance criteria', 'execution evidence'],
    returnContract: 'verdict + reasons',
    executionEvidence: { result: JSON.stringify(execution.checks), artifact_sha256: artifactSha, exit_code: tests.body?.data?.code }
  });
  const reviewerResult = await assignAndRun({ orch, role: 'reviewer', model: reviewerModel, assignment: reviewAssignment, maxTokens: 320 });
  advisory = String(reviewerResult.text).trim().split('\n')[0].slice(0, 80);
  mission.verdict = { deterministic: verdict.passed ? 'PASS' : 'FAIL', advisory, authoritative: verdict.passed ? 'PASS' : 'FAIL', execution, veritas };
  mission.economics.push(accountStage('reviewer', { workerContext: approxTokens(JSON.stringify(reviewAssignment)), outputTokens: approxTokens(reviewerResult.text), calls: 1 }));
  console.log('[m2] deterministic', mission.verdict.deterministic, '| advisory', advisory);

  // ---- 7. Resident status report ("Where are we?") --------------------------
  const status = await residentSay(orch, 'Where are we?\n\nCanonical state: ' + JSON.stringify({ objective: reconstruction.objective, stage: reconstruction.stage, verdict: mission.verdict.authoritative, attempts: attemptsLog.map(a => ({ attempt: a.attempt, model: a.model, exit_code: a.exit_code })), next: verdict.passed ? 'continue the project objective' : 'recovery exhausted; operator decision required' }) + '\nGive a concise status: objective, verified completed work, failures, evidence, blockers, next step.');
  mission.status_report = status.text;
  mission.economics.push(accountStage('resident-status', { residentInput: 160, outputTokens: approxTokens(status.text), calls: 1 }));
  console.log('[m2] status:', status.text.replace(/\s+/g, ' ').slice(0, 140));

  // ---- 8. continuity update -------------------------------------------------
  const continuityEntry = {
    at: new Date().toISOString(),
    mission: mission.mission,
    objective: reconstruction.objective,
    stage: reconstruction.stage,
    completed: verdict.passed ? [{ what: 'version parser fixed and verified', artifact_sha256: artifactSha, evidence: 'node --test exit 0' }] : (lastState?.completed ?? []),
    failures: verdict.passed ? [] : [{ what: 'implementation still failing after bounded recovery', exit_code: tests.body?.data?.code, attempts: attemptsLog.length }],
    blockers: verdict.passed ? [] : ['worker capability: local coders produced non-implementing artifacts'],
    next_step: verdict.passed ? 'continue the project objective' : 'operator decision: provide a stronger coder model or accept manual implementation',
    verdict: { deterministic: mission.verdict.deterministic, advisory: mission.verdict.advisory },
    model_switch: attemptsLog.some(a => a.switched) ? { reason: attemptsLog.find(a => a.switched)?.switch_reason, from: WORKER_MODELS.planner.id, to: WORKER_MODELS.alt.id } : null
  };
  await fs.appendFile(path.join(PROJECT_DIR, '.aide', 'orch', 'continuity.jsonl'), JSON.stringify(continuityEntry) + '\n', 'utf8');
  mission.continuity_entry = continuityEntry;

  // ---- 9. governance + write results ----------------------------------------
  mission.containment_events = (await readContainmentTail(PROJECT_DIR, containmentBefore)).map(row => ({ request: String(row.request ?? '').slice(0, 60), disposition: row.disposition, triggers: row.triggers }));
  mission.finished_at = new Date().toISOString();
  const file = await writeJson('M2M3-restart-continuity-failure-recovery.json', mission);
  await appendJournal(JOURNAL, { mission: mission.mission, at: mission.finished_at, action, verdict: mission.verdict.deterministic, attempts: attemptsLog.length, model_switch: Boolean(continuityEntry.model_switch), exit_code: tests.body?.data?.code });
  console.log('[m2] DONE ->', file);
} catch (error) {
  mission.error = String(error && error.stack ? error.stack.split('\n').slice(0, 3).join(' | ') : error);
  mission.finished_at = new Date().toISOString();
  await writeJson('M2M3-restart-continuity-failure-recovery.json', mission);
  await appendJournal(JOURNAL, { mission: mission.mission, at: mission.finished_at, error: mission.error });
  console.log('[m2] FAILED:', mission.error);
} finally {
  await orch.close().catch(() => {});
}
