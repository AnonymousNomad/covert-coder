// Model-neutral Resident candidate harness (MISSIONS 9/15).
// The surrounding system is fixed: same tasks, same canonical context builder,
// same discovery, same policy/authority, same governed chat path, same scoring.
// Change ONE variable: the candidate model file.
//
// Usage: AIDE_CANDIDATE_FILE=<file in models/> [AIDE_CANDIDATE_LABEL=name] node .../run-candidate.mjs
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { PROJECT_DIR, bootOrchestration, residentSay, reconstructProject, selectMethodology, writeJson, readContainmentTail, approxTokens, authorityContextLine } from '../lib.mjs';
import { scoreTask } from './scoring.mjs';

const BATTERY_DIR = path.dirname(new URL(import.meta.url).pathname.replace(/^\//, ''));
const CANDIDATE_FILE = process.env.AIDE_CANDIDATE_FILE;
const LABEL = process.env.AIDE_CANDIDATE_LABEL ?? 'candidate';
// Thinking models (e.g. the QAD candidate) spend tokens in a reasoning block
// before the answer; the budget must cover reasoning + answer or content is empty.
const MAX_TOKENS = Number(process.env.AIDE_CANDIDATE_MAXTOKENS || 200);
// CPU contention can push a thinking model past the route's default timeout;
// the budget must be explicit for a fair, bounded run.
const ROUTE_TIMEOUT_MS = Number(process.env.AIDE_CANDIDATE_TIMEOUT_MS || 600000);
if (!CANDIDATE_FILE) throw new Error('AIDE_CANDIDATE_FILE is required (a .gguf inside the workspace models dir)');

const TASKS_RAW = await fs.readFile(path.join(BATTERY_DIR, 'TASKS.json'), 'utf8');
const TASKS = JSON.parse(TASKS_RAW);
const TASKS_SHA = createHash('sha256').update(TASKS_RAW).digest('hex');
const scoringRaw = await fs.readFile(path.join(BATTERY_DIR, 'scoring.mjs'), 'utf8');
const SCORING_SHA = createHash('sha256').update(scoringRaw).digest('hex');

const result = {
  label: LABEL, candidate_file: CANDIDATE_FILE,
  battery: { tasks_sha256: TASKS_SHA, scoring_sha256: SCORING_SHA, frozen: TASKS.frozen },
  started_at: new Date().toISOString(), tasks: [], economics: [], summary: {}
};

const containmentBefore = (await readContainmentTail(PROJECT_DIR, 0)).length;
const orch = await bootOrchestration({ models: ['candidate'], candidateFile: CANDIDATE_FILE, skipResident: true });
try {
  const candidate = orch.started[CANDIDATE_FILE];
  // Canonical context (the SAME for every candidate; expected answers are NOT here).
  const reconstruction = await reconstructProject(orch);
  const continuity = (await fs.readFile(path.join(PROJECT_DIR, '.aide', 'orch', 'continuity.jsonl'), 'utf8')).trim().split('\n').map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean).at(-1);
  const status = await orch.stack.json('facade', 'GET', '/api/models/status', { signal: AbortSignal.timeout(60000) });
  const workerIds = (status.body.data?.models ?? []).filter(m => m.availability !== 'UNAVAILABLE').map(m => m.id).slice(0, 12);
  const baseContext = [
    '[CANONICAL PROJECT STATE]',
    'objective: ' + (reconstruction.objective ?? 'unknown'),
    'workflow_stage: ' + (reconstruction.stage ?? 'unknown'),
    'git_branch: ' + (reconstruction.branch ?? 'unknown'),
    'changed_files: ' + (reconstruction.changes.map(c => c.path).join(', ') || 'none'),
    'last_continuity: ' + JSON.stringify(continuity ?? null),
    'available_worker_models: ' + workerIds.join(', '),
    await authorityContextLine()
  ].join('\n');
  const baseTokens = approxTokens(baseContext);

  for (const task of TASKS.tasks) {
    const methodology = await selectMethodology(task.prompt);
    const sopLine = methodology.selection.ids.length > 0 ? 'relevant_procedures: ' + methodology.selection.ids.join(', ') : 'relevant_procedures: none';
    const message = baseContext + '\n' + sopLine + '\n\n[TASK]\n' + task.prompt;
    const truth = { workerIds, toolTokens: [] };
    let answer = { text: '', timingMs: 0 };
    let scored = null;
    try {
      answer = await residentSay(orch, message, { modelId: candidate.id, maxTokens: MAX_TOKENS, timeoutMs: ROUTE_TIMEOUT_MS });
      scored = scoreTask(task, answer.text, truth);
    } catch (error) {
      // Bounded resilience: one task's infrastructure failure does not abort the
      // battery; it is recorded and scored as a failure with the error named.
      scored = { task: task.id, class: task.class, passed: false, checks: [{ name: 'task-error', passed: false, detail: String(error && error.message ? error.message : error).slice(0, 120) }], answer: '' };
    }
    const events = await readContainmentTail(PROJECT_DIR, containmentBefore);
    result.tasks.push({
      ...scored,
      raw: answer.text.replace(/\s+/g, ' ').slice(0, 300),
      timing_ms: answer.timingMs,
      sop_candidates: methodology.candidates.slice(0, 3).map(c => c.id),
      containment: events.filter(e => String(e.request ?? '').includes(task.prompt.slice(0, 24))).map(e => ({ disposition: e.disposition, triggers: e.triggers }))
    });
    result.economics.push({
      task: task.id,
      canonical_context_tokens: baseTokens,
      sop_candidates_tokens: approxTokens(sopLine),
      task_tokens: approxTokens(task.prompt),
      total_sent_tokens: approxTokens(message),
      envelope_note: 'live awareness envelope bounded ≤1500 (measured 342-932 historically)',
      output_tokens: approxTokens(answer.text),
      model_calls: 1
    });
    console.log(`[battery] ${LABEL} ${task.id.padEnd(28)} ${scored.passed ? 'PASS' : 'FAIL'} (${answer.timingMs}ms)`);
  }
  const byClass = {};
  for (const t of result.tasks) {
    byClass[t.class] ??= { passed: 0, total: 0 };
    byClass[t.class].total += 1;
    if (t.passed) byClass[t.class].passed += 1;
  }
  result.summary = {
    passed: result.tasks.filter(t => t.passed).length,
    total: result.tasks.length,
    by_class: byClass,
    avg_timing_ms: Math.round(result.tasks.reduce((s, t) => s + t.timingMs, 0) / Math.max(1, result.tasks.length))
  };
  result.finished_at = new Date().toISOString();
  await writeJson('battery-' + LABEL + '.json', result);
  console.log('[battery] summary', JSON.stringify(result.summary));
} catch (error) {
  result.error = String(error && error.message ? error.message : error).slice(0, 300);
  await writeJson('battery-' + LABEL + '.json', result);
  console.log('[battery] FAILED:', result.error);
} finally {
  await orch.close().catch(() => {});
}
