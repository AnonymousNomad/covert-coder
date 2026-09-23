// experiments/resident-orchestration/lib.mjs
//
// Resident orchestration lane — shared helpers. Consumes CANONICAL surfaces only:
//   - supervised stack (real pairing + exact-operation approvals)
//   - /api/chat (governed Resident answer path: awareness envelope + containment)
//   - canonical workflow store (.aide/workflow/state.json) + git status + tasks
//   - resident SOP discovery + deterministic selection (the exact functions the
//     live awareness provider uses)
//   - Arsenal projection + worker bridge (assignment contract, proposal-only)
//   - harness/veritas.mjs (deterministic evidence gate)
// No new production services are created here.
import { promises as fs } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { launchSupervisedStack } from '../../tests/helpers/supervised-stack.mjs';
import { loadRoleContracts, buildWorkerAssignment, runWorker, selectWorker, extractCode } from '../../node/src/services/resident-worker-bridge.mjs';
import { buildArsenalProjection } from '../../node/src/services/resident-arsenal.mjs';
import { loadResidentCatalog, discoverResidentSops, loadResidentSopBodies } from '../../node/src/services/resident-sops.mjs';
import { selectSopsDeterministically } from '../../node/src/services/resident-awareness-provider.mjs';
import { evaluateExecution } from '../../harness/veritas.mjs';

export const REPO = 'E:\\aide-sovereign-workbench';
export const OUT_DIR = path.join(REPO, 'experiments', 'resident-orchestration', 'results');
export const PROJECT_DIR = 'E:\\pip_temp\\opencode\\resident-orch-project';
export const RESIDENT_MODEL_FILE = 'liquid-dogfood-merged-q8_0.gguf';
export const WORKER_MODELS = {
  planner: { file: 'qwen2.5-coder-1.5b-instruct-q4_k_m.gguf', id: 'qwen2.5-coder-1.5b-instruct-q4_k_m' },
  coder: { file: 'qwen2.5-coder-1.5b-instruct-q4_k_m.gguf', id: 'qwen2.5-coder-1.5b-instruct-q4_k_m' },
  reviewer: { file: 'qwen2.5-coder-0.5b-instruct-q4_k_m.gguf', id: 'qwen2.5-coder-0.5b-instruct-q4_k_m' },
  alt: { file: 'smollm2-360m-instruct-q8_0.gguf', id: 'smollm2-360m-instruct-q8_0' }
};

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

export function git(args, cwd = PROJECT_DIR) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', timeout: 30000 }).trim();
}

// ---------------------------------------------------------------- disposable project
export async function prepareProject() {
  await fs.rm(PROJECT_DIR, { recursive: true, force: true }).catch(() => {});
  await fs.mkdir(path.join(PROJECT_DIR, 'src'), { recursive: true });
  await fs.mkdir(path.join(PROJECT_DIR, 'test'), { recursive: true });
  await fs.mkdir(path.join(PROJECT_DIR, '.aide', 'workflow'), { recursive: true });
  await fs.writeFile(path.join(PROJECT_DIR, 'package.json'), JSON.stringify({
    name: 'resident-orch-target', version: '0.0.1', type: 'module', private: true,
    scripts: { test: 'node --test test/' }
  }, null, 2) + '\n', 'utf8');
  // The mission target: parseVersion must return {major,minor,patch} for "1.2.3"
  // and null for anything else. The shipped implementation is wrong for
  // multi-digit and missing-patch inputs; the test suite encodes the contract.
  await fs.writeFile(path.join(PROJECT_DIR, 'src', 'version.mjs'), [
    'export function parseVersion(value) {',
    '  const parts = String(value).split(".");',
    '  if (parts.length !== 3) return null;',
    '  return { major: Number(parts[0]), minor: Number(parts[1]), patch: Number(parts[2]) };',
    '}',
    ''
  ].join('\n'), 'utf8');
  await fs.writeFile(path.join(PROJECT_DIR, 'test', 'version.test.mjs'), [
    "import { test } from 'node:test';",
    "import assert from 'node:assert/strict';",
    "import { parseVersion } from '../src/version.mjs';",
    '',
    "test('parses a three-part version', () => {",
    "  assert.deepEqual(parseVersion('1.2.3'), { major: 1, minor: 2, patch: 3 });",
    '});',
    '',
    "test('parses multi-digit segments', () => {",
    "  assert.deepEqual(parseVersion('10.200.3'), { major: 10, minor: 200, patch: 3 });",
    '});',
    '',
    "test('rejects non-semver strings', () => {",
    "  assert.equal(parseVersion('1.2'), null);",
    "  assert.equal(parseVersion('v1.2.3'), null);",
    "  assert.equal(parseVersion('1.2.x'), null);",
    '});',
    ''
  ].join('\n'), 'utf8');
  await fs.writeFile(path.join(PROJECT_DIR, 'PROJECT.md'), [
    '# Resident orchestration target',
    '',
    'Objective: make the version parser obey its test contract (all tests green).',
    'Constraint: do not weaken or delete tests; keep the public function name.',
    ''
  ].join('\n'), 'utf8');
  const now = new Date().toISOString();
  await fs.writeFile(path.join(PROJECT_DIR, '.aide', 'workflow', 'state.json'), JSON.stringify({
    version: 1,
    workflow_id: '11111111-2222-4333-8444-555555555555',
    workspace: PROJECT_DIR,
    project_id: 'resident-orch-mission',
    stage: 'IMPLEMENTATION',
    previous_stage: 'DESIGN',
    revision: 0,
    artifacts: [],
    last_transition_id: null,
    created_at: now,
    updated_at: now
  }, null, 2) + '\n', 'utf8');
  git(['init', '-q', '-b', 'main']);
  git(['config', 'user.email', 'resident-orch@local']);
  git(['config', 'user.name', 'Resident Orch']);
  git(['add', '.']);
  git(['commit', '-qm', 'baseline: version parser with failing contract tests']);
  return PROJECT_DIR;
}

// ---------------------------------------------------------------- stack + models
export async function bootOrchestration({ models = ['resident', 'planner', 'coder', 'reviewer'], candidateFile = null, skipResident = false } = {}) {
  const stack = await launchSupervisedStack({ workspace: PROJECT_DIR, env: { AIDE_MODEL_DIR: path.join(REPO, 'models'), AIDE_CLOSED_LOOP: 'false' } });
  const started = {};
  async function ensureModel(file) {
    const reg = await approveWithRetry(stack, { adapter: 'ts', method: 'POST', path: '/api/models/register', body: { filename: file, quant_label: 'q8_0' } });
    if (reg.status !== 200) throw new Error(`register ${file} -> ${reg.status}`);
    const id = reg.body.data.id;
    const start = await approveWithRetry(stack, { adapter: 'ts', method: 'POST', path: '/api/models/start', body: { id } });
    if (start.status !== 200) throw new Error(`start ${id} -> ${start.status}`);
    const deadline = Date.now() + 120000;
    while (Date.now() < deadline) {
      const ready = await stack.json('facade', 'GET', `/api/model/ready?id=${encodeURIComponent(id)}`, { signal: AbortSignal.timeout(20000) }).catch(() => null);
      if (ready?.body?.data?.ready === true) break;
      await sleep(1500);
    }
    const status = await stack.json('facade', 'GET', '/api/models/status', { signal: AbortSignal.timeout(60000) });
    const entry = (status.body.data?.models ?? []).find(m => m.id === id);
    started[file] = { id, endpoint: entry?.endpoint ? entry.endpoint.replace(/\/v1$/, '') : null, roles: entry?.roles ?? [] };
    return started[file];
  }
  const wanted = new Set(models);
  try {
    const resident = skipResident ? null : await ensureModel(RESIDENT_MODEL_FILE);
    if (wanted.has('candidate')) {
      if (!candidateFile) throw new Error('candidateFile is required when models includes candidate');
      await ensureModel(candidateFile);
    }
    if (wanted.has('planner') || wanted.has('coder')) await ensureModel(WORKER_MODELS.planner.file);
    if (wanted.has('reviewer')) await ensureModel(WORKER_MODELS.reviewer.file);
    if (wanted.has('alt')) await ensureModel(WORKER_MODELS.alt.file);
    return { stack, resident, started, close: () => stack.close() };
  } catch (error) {
    // Partial-boot lifecycle repair: a failure after some engines started must
    // not leak them (observed: the RAM guard refused the 4th model and the three
    // already-started engines were orphaned because no handle was returned).
    console.log('[orch] boot failed; closing the stack to reap started engines');
    await stack.close().catch(() => {});
    throw error;
  }
}

export async function approveWithRetry(stack, options, attempts = 2) {
  let last = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    last = await stack.approveJson({ ...options, signal: AbortSignal.timeout(180000) });
    if (last.status === 200) return last;
    console.log(`[orch] ${options.path} attempt ${attempt} -> ${last.status}`);
    await sleep(2000);
  }
  return last;
}

// ---------------------------------------------------------------- governed Resident
export async function residentSay(orch, text, { modelId = null, maxTokens = 320, timeoutMs = null, temperature = 0.2 } = {}) {
  const id = modelId ?? orch.resident.id;
  const started = Date.now();
  const response = await orch.stack.json('facade', 'POST', '/api/chat', {
    body: { messages: [{ role: 'user', content: text }], modelId: `local:${id}`, options: { maxTokens, temperature, ...(timeoutMs ? { timeoutMs } : {}) } },
    signal: AbortSignal.timeout(180000 + Number(timeoutMs || 0))
  });
  if (response.status !== 200) throw new Error(`resident chat ${response.status}: ${JSON.stringify(response.body).slice(0, 200)}`);
  const data = response.body.data ?? {};
  return { text: String(data.text ?? ''), modelId: data.modelId, timingMs: Date.now() - started, harness: data.harness ?? null };
}

// ---------------------------------------------------------------- reconstruction
export async function reconstructProject(orch) {
  const [workflow, gitStatus, tree] = await Promise.all([
    orch.stack.json('facade', 'GET', '/api/workflow/state', { signal: AbortSignal.timeout(30000) }).catch(() => null),
    orch.stack.json('facade', 'GET', '/api/git/status', { signal: AbortSignal.timeout(30000) }).catch(() => null),
    orch.stack.json('facade', 'GET', '/api/workspace/tree', { signal: AbortSignal.timeout(30000) }).catch(() => null)
  ]);
  const brief = await fs.readFile(path.join(PROJECT_DIR, 'PROJECT.md'), 'utf8').catch(() => '');
  const state = workflow?.body?.data?.state ?? null;
  const changes = (gitStatus?.body?.data?.changes ?? []).map(c => ({ path: c.path, staged: c.staged, untracked: c.untracked }));
  const reconstruction = {
    project_id: state?.project_id ?? null,
    stage: state?.stage ?? null,
    previous_stage: state?.previous_stage ?? null,
    revision: state?.revision ?? null,
    artifacts: (state?.artifacts ?? []).map(a => ({ artifact_type: a.artifact_type, path: a.path, verification_status: a.verification_status })),
    branch: gitStatus?.body?.data?.branch ?? null,
    changes,
    objective: brief.split('\n').find(line => line.startsWith('Objective:'))?.slice('Objective:'.length).trim() ?? null,
    constraint: brief.split('\n').find(line => line.startsWith('Constraint:'))?.slice('Constraint:'.length).trim() ?? null,
    tree_top: (tree?.body?.data?.tree ?? []).slice(0, 12).map(item => item.name),
    next_step: null
  };
  reconstruction.next_step = reconstruction.stage === 'IMPLEMENTATION'
    ? 'implement the objective against the failing tests, then verify'
    : 'reconstruct and continue the objective';
  return reconstruction;
}

// ---------------------------------------------------------------- methodology
export async function selectMethodology(request) {
  const catalog = await loadResidentCatalog({ root: REPO });
  const discovery = await discoverResidentSops(request, { root: REPO, catalog });
  const selection = selectSopsDeterministically(discovery, { strongScore: 5.0, limit: 2 });
  const bodies = selection.ids.length > 0 ? await loadResidentSopBodies(selection.ids, { root: REPO, catalog, max: 2 }) : [];
  return { selection, candidates: (discovery.candidates ?? []).map(c => ({ id: c.id, score: Number(Number(c.score ?? 0).toFixed(2)) })), bodies };
}

// ---------------------------------------------------------------- worker selection + assignment
export async function buildProjection(orch) {
  const probes = {
    modelStatus: async id => {
      const status = await orch.stack.json('facade', 'GET', '/api/models/status', { signal: AbortSignal.timeout(30000) });
      return (status.body.data?.models ?? []).find(m => m.id === id)?.status ?? null;
    }
  };
  return buildArsenalProjection({ workspace: PROJECT_DIR, repoRoot: REPO, probes });
}

export async function selectWorkerFor(orch, role) {
  const projection = await buildProjection(orch);
  const pick = selectWorker(projection, role);
  return { pick, projection_summary: projection.summary };
}

export async function assignAndRun({ orch, role, model, assignment, maxTokens = 512 }) {
  const roleContracts = await loadRoleContracts();
  const result = await runWorker({ assignment, endpoint: model.endpoint, modelId: model.id, roleContracts, maxTokens, temperature: 0.1 });
  return result;
}

// ---------------------------------------------------------------- approved product operations
export async function approvedWrite(orch, relPath, content) {
  return approveWithRetry(orch.stack, { adapter: 'ts', method: 'POST', path: '/api/file/write', body: { path: relPath, content, approved: true } });
}

export async function approvedTerminal(orch, program, args) {
  return approveWithRetry(orch.stack, { adapter: 'ts', method: 'POST', path: '/api/terminal/run', body: { program, args, approved: true } });
}

// ---------------------------------------------------------------- verdicts + evidence
export function deterministicVerdict(checks) {
  const passed = checks.every(check => check.passed === true);
  return { passed, checks };
}

export function veritasExecution({ command, exitCode, stdout, artifactSha }) {
  const checks = [
    { name: 'command-ran', passed: exitCode !== null && exitCode !== undefined },
    { name: 'tests-green', passed: exitCode === 0 },
    { name: 'artifact-hashed', passed: typeof artifactSha === 'string' && artifactSha.length === 64 }
  ];
  const execution = {
    passed: checks.every(c => c.passed),
    results: [{ command, exitCode, stdout_tail: String(stdout ?? '').split('\n').slice(-6).join('\n') }],
    checks
  };
  let veritas = null;
  try { veritas = evaluateExecution(execution); } catch (error) { veritas = { error: String(error) }; }
  return { execution, veritas };
}

export async function writeJson(name, obj) {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const file = path.join(OUT_DIR, name);
  await fs.writeFile(file, JSON.stringify(obj, null, 2), 'utf8');
  return file;
}

export async function appendJournal(name, row) {
  await fs.mkdir(OUT_DIR, { recursive: true });
  await fs.appendFile(path.join(OUT_DIR, name), JSON.stringify(row) + '\n', 'utf8');
}

export function accountStage(stage, entry) {
  return {
    stage,
    resident_input_tokens: entry.residentInput ?? 0,
    worker_context_tokens: entry.workerContext ?? 0,
    retrieved_memory_tokens: entry.memoryTokens ?? 0,
    skill_sop_tokens: entry.sopTokens ?? 0,
    output_tokens: entry.outputTokens ?? 0,
    model_calls: entry.calls ?? 0,
    note: entry.note ?? null
  };
}

export function approxTokens(text) {
  return Math.ceil(String(text ?? '').length / 4);
}

// Bounded authority truth for the working context (closure wave section 4):
// derived from the canonical operation policy — never hardcoded, never a grant.
export async function authorityContextLine() {
  const { OPERATION_POLICY } = await import('../../common/security/operation-policy.mjs');
  const byRisk = {};
  for (const [kind, risk] of Object.entries(OPERATION_POLICY)) {
    if (kind.endsWith('.read')) continue;
    byRisk[risk] = byRisk[risk] ?? [];
    if (byRisk[risk].length < 4) byRisk[risk].push(kind);
  }
  const parts = Object.entries(byRisk).map(([risk, kinds]) => `${risk}: ${kinds.join(', ')}`);
  return 'authority_policy: read operations are auto-approved; every non-read operation requires its own approved exact operation (' + parts.join('; ') + ')';
}

export async function readContainmentTail(workspace, sinceLines = 0) {
  const file = path.join(workspace, '.aide', 'logs', 'containment.jsonl');
  const raw = await fs.readFile(file, 'utf8').catch(() => '');
  const lines = raw.trim() === '' ? [] : raw.trim().split('\n');
  return lines.slice(sinceLines).map(line => { try { return JSON.parse(line); } catch { return null; } }).filter(Boolean);
}

export { extractCode };
