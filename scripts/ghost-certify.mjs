// Ghost real-task certification runner (Wave 8).
//
//   node --experimental-strip-types scripts/ghost-certify.mjs --scenario <id> [--keep]
//   node --experimental-strip-types scripts/ghost-certify.mjs --affected [--files a,b] [--diff]
//
// Executes a REAL scenario through the canonical product path, performs the
// scenario's OWN canonical verification (harness evidence — never the worker's
// claim), assembles the Ghost episode from canonical stores, and writes a
// machine-readable certification result.
import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { assembleEpisode } from '../node/src/services/ghost-episode.ts';
import { certifyEpisode, scenarioById, affectedScenarios, GHOST_SCENARIOS } from '../node/src/services/ghost-certify.ts';
import { launchSupervisedStack } from '../tests/helpers/supervised-stack.mjs';

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const KEEP = process.argv.includes('--keep');
const EVIDENCE_DIR = 'E:\\pip_temp\\opencode\\ghost-evidence';
// The authority fixture's default per-request deadline is 5s; this box's HDD
// fsync floor can exceed that under load. Raise it for scenario runs only.
process.env.AIDE_FIXTURE_TIMEOUT_MS ??= '30000';

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function gitSha() {
  try {
    const { stdout } = await execFileAsync('git', ['-C', ROOT, 'rev-parse', 'HEAD']);
    return stdout.trim().slice(0, 64);
  } catch {
    return null;
  }
}

async function hashTree(dir) {
  const out = new Map();
  const walk = async (current, depth) => {
    if (depth > 4) return;
    for (const entry of await fs.readdir(current, { withFileTypes: true }).catch(() => [])) {
      if (entry.name === '.aide' || entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      const target = path.join(current, entry.name);
      if (entry.isDirectory()) await walk(target, depth + 1);
      else if (entry.isFile()) {
        const content = await fs.readFile(target).catch(() => Buffer.alloc(0));
        out.set(path.relative(dir, target).replace(/\\/g, '/'), createHash('sha256').update(content).digest('hex'));
      }
    }
  };
  await walk(dir, 0);
  return out;
}

async function diffTrees(before, after) {
  const changed = [];
  for (const [file, hash] of after) {
    if (before.get(file) !== hash) changed.push(file);
  }
  return changed.sort();
}

async function runFixtureTests(dir) {
  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, ['--test'], { cwd: dir, timeout: 120000 });
    return { passed: true, detail: `exit 0; ${String(stdout).split('\n').filter(line => /pass|fail/.test(line)).slice(-2).join(' ').slice(0, 200)}`, output: String(stdout) + String(stderr) };
  } catch (error) {
    const detail = `exit ${error.code ?? '?'}; ${String(error.stdout ?? '').split('\n').filter(line => /pass|fail/.test(line)).slice(-2).join(' ').slice(0, 200)}`;
    return { passed: false, detail, output: `${String(error.stdout ?? '')}${String(error.stderr ?? '')}` };
  }
}

function bugfixFixtureFiles(broken) {
  const math = `export function add(a, b) {\n  return a - b;\n}\n`;
  const test = broken
    ? `import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport { add } from '../src/math.mjs';\n\ntest('add returns the numeric sum', () => {\n  assert.equal(add(2, 3), 5);\n});\n\ntest('add also returns the same value as a string', () => {\n  assert.equal(add(2, 3), '5');\n});\n`
    : `import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport { add } from '../src/math.mjs';\n\ntest('add returns the numeric sum', () => {\n  assert.equal(add(2, 3), 5);\n});\n\ntest('add with zero keeps the value (regression)', () => {\n  assert.equal(add(5, 0), 5);\n});\n`;
  return {
    'package.json': JSON.stringify({ name: 'ghost-bugfix-fixture', type: 'module', scripts: { test: 'node --test' } }, null, 2),
    'src/math.mjs': math,
    'test/math.test.mjs': test
  };
}

async function writeFixture(dir, files) {
  for (const [rel, content] of Object.entries(files)) {
    const target = path.join(dir, rel);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, content, 'utf8');
  }
}

async function waitTerminal(stack, sessionId, timeoutMs = 480000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = await stack.json('facade', 'GET', `/api/agent/status?id=${encodeURIComponent(sessionId)}`, { signal: AbortSignal.timeout(60000) });
    const data = result.body?.data;
    if (data?.pending_approval?.approval_id) {
      await stack.approveJson({
        method: 'POST', path: '/api/agent/decision',
        body: { session_id: sessionId, approval_id: data.pending_approval.approval_id, decision: 'approve' },
        taskId: `ghost-decide-${String(data.pending_approval.approval_id).slice(0, 8)}`
      });
      continue;
    }
    if (['done', 'error', 'aborted'].includes(data?.state)) return data;
    await new Promise(resolve => setTimeout(resolve, 1500));
  }
  return { state: 'timeout', error: 'status polling budget exhausted' };
}

async function runCodexScenario(scenarioId, broken) {
  const runDir = await fs.mkdtemp(path.join(os.tmpdir(), `ghost-${scenarioId}-`));
  const workspace = path.join(runDir, 'workspace');
  await fs.mkdir(workspace, { recursive: true });
  await writeFixture(workspace, bugfixFixtureFiles(broken));
  const before = await hashTree(workspace);
  const startedAt = Date.now();
  const stack = await launchSupervisedStack({ workspace });
  const harness = { tests_passed: null, tests_detail: null, changed_files: [], evidence_refs: [] };
  let sessionId = null;
  let episode = null;
  try {
    await stack.approveJson({ method: 'PUT', path: '/api/byok/consent', body: { enabled: true }, taskId: 'ghost-consent' });
    await stack.approveJson({
      method: 'PUT', path: '/api/byok/routing',
      body: { routing: { plan: 'local', act: { provider_id: 'codex-cli', model_id: '' }, utility: 'local' } },
      taskId: 'ghost-routing'
    });
    const task = 'This repository has a failing test. Fix the source code so that running the tests (node --test) passes for all tests. Do not modify the test files themselves. Work only inside the current directory. When you are completely finished, end your final message with exactly this marker: <attempt_completion><result>short summary</result></attempt_completion>';
    const readiness = await stack.json('facade', 'POST', '/api/resident/intent', { body: { task } });
    if (readiness.status !== 200 || readiness.body?.data?.status !== 'READY') {
      return { status: 'BLOCKED', reason: `readiness not READY: ${JSON.stringify(readiness.body).slice(0, 200)}`, runDir, episode: null };
    }
    const start = await stack.approveJson({
      method: 'POST', path: '/api/agent/start',
      body: { task, mode: 'act', chat_source: 'provider', readiness_id: readiness.body.data.readiness_id },
      taskId: 'ghost-start'
    });
    if (start.status !== 200) return { status: 'BLOCKED', reason: `agent start refused: ${JSON.stringify(start.body).slice(0, 250)}`, runDir, episode: null };
    sessionId = start.body.data.session_id;
    const final = await waitTerminal(stack, sessionId);
    const tests = await runFixtureTests(workspace);
    const after = await hashTree(workspace);
    harness.tests_passed = tests.passed;
    harness.tests_detail = tests.detail;
    harness.changed_files = await diffTrees(before, after);
    await fs.writeFile(path.join(workspace, '.aide', 'ghost-harness.json'), JSON.stringify({ scenario: scenarioId, session_state: final.state, tests_passed: tests.passed, tests_detail: tests.detail, changed_files: harness.changed_files, tests_output_tail: tests.output.slice(-1500) }, null, 2), 'utf8');
    harness.evidence_refs.push(`harness/${scenarioId}.json`);
    episode = await assembleEpisode({ workspace, episodeId: sessionId });
    const scenario = scenarioById(scenarioId);
    const result = certifyEpisode({ scenario, episode, harness, testedSha: await gitSha(), durationMs: Date.now() - startedAt });
    await writeOutputs(scenarioId, runDir, episode, result, harness);
    return { status: result.status, result, episode, runDir };
  } finally {
    await stack.close().catch(() => {});
  }
}

async function runMissingCompilerScenario() {
  const runDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ghost-missing-compiler-'));
  const workspace = path.join(runDir, 'workspace');
  await fs.mkdir(workspace, { recursive: true });
  const startedAt = Date.now();
  const { ArchServer } = await import('../node/src/server.ts');
  const { pairFixture } = await import('../tests/arch/authority-fixture.ts');
  const server = new ArchServer(workspace, path.join(workspace, 'arch-ghost.log'));
  const { buildRoutes } = await import('../node/src/openapi.ts');
  const scripted = [
    '<run_command>\n<command>ghost-missing-compiler-xyz --build</command>\n</run_command>',
    '<attempt_completion>\n<result>gave up</result>\n</attempt_completion>'
  ];
  let index = 0;
  const stubRuntime = {
    list: () => [{ id: 'scripted-local', name: 'Scripted Local', endpoint: 'http://127.0.0.1:9/v1', model: 'scripted', context_tokens: 8192, roles: ['chat', 'act'] }],
    status: async () => ({ models: [{ id: 'scripted-local', status: 'running' }] }),
    verifyEndpointModel: async () => ({ ready: true }),
    getEffectiveContext: () => 8192,
    getEffectiveBudget: () => 8192 - 512,
    refreshServedContext: async () => undefined,
    chat: async () => scripted[Math.min(index++, scripted.length - 1)] ?? '',
    chatStream: async (_id, _messages, onDelta) => { onDelta(scripted[Math.min(index++, scripted.length - 1)] ?? ''); return { modelId: 'local:scripted-local', usedApprox: 1, dropped: 0, truncatedSystem: false, timingMs: 1 }; }
  };
  const routes = await buildRoutes(workspace, 'test', {
    authority: server.authority,
    events: server.events,
    modelRuntime: stubRuntime,
    agentChatFn: async () => scripted[Math.min(index++, scripted.length - 1)] ?? ''
  });
  for (const route of routes) server.route(route);
  const http = await server.listen(0);
  const address = http.address();
  const owner = await pairFixture(server, `http://127.0.0.1:${address.port}`);
  let sessionId = null;
  try {
    const headers = await owner.approve('POST', '/api/agent/start', { task: 'compile the project', mode: 'act' }, 'task:ghost-compiler');
    const start = await owner.request('/api/agent/start', { method: 'POST', headers, body: JSON.stringify({ task: 'compile the project', mode: 'act' }), signal: AbortSignal.timeout(120000) });
    const startBody = await start.json();
    if (start.status !== 200) return { status: 'BLOCKED', reason: `start refused: ${JSON.stringify(startBody).slice(0, 200)}`, runDir, episode: null };
    sessionId = startBody.data.session_id;
    const deadline = Date.now() + 120000;
    while (Date.now() < deadline) {
      const statusResponse = await owner.request(`/api/agent/status?id=${encodeURIComponent(sessionId)}`, { signal: AbortSignal.timeout(30000) });
      const statusBody = await statusResponse.json();
      const data = statusBody.data;
      if (data?.pending_approval?.approval_id) {
        const decision = { session_id: sessionId, approval_id: data.pending_approval.approval_id, decision: 'approve' };
        const headers = await owner.approve('POST', '/api/agent/decision', decision, `ghost-decide-${String(data.pending_approval.approval_id).slice(0, 8)}`);
        await owner.request('/api/agent/decision', { method: 'POST', headers, body: JSON.stringify(decision), signal: AbortSignal.timeout(60000) });
        continue;
      }
      if (['done', 'error', 'aborted'].includes(data?.state)) break;
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    const episode = await assembleEpisode({ workspace, episodeId: sessionId });
    const harness = { tests_passed: null, tests_detail: 'no harness test step for this scenario', changed_files: [], evidence_refs: [] };
    const scenario = scenarioById('missing-compiler');
    const result = certifyEpisode({ scenario, episode, harness, testedSha: await gitSha(), durationMs: Date.now() - startedAt });
    await writeOutputs('missing-compiler', runDir, episode, result, harness);
    return { status: result.status, result, episode, runDir };
  } finally {
    http.closeAllConnections?.();
    await new Promise(resolve => http.close(() => resolve()));
    server.events.close();
    await server.logger.flush();
  }
}

async function writeOutputs(scenarioId, runDir, episode, result, harness) {
  const ghostDir = path.join(runDir, 'workspace', '.aide', 'ghost');
  await fs.mkdir(ghostDir, { recursive: true });
  await fs.writeFile(path.join(ghostDir, `${scenarioId}.episode.json`), JSON.stringify(episode, null, 2), 'utf8');
  await fs.writeFile(path.join(ghostDir, `${scenarioId}.result.json`), JSON.stringify(result, null, 2), 'utf8');
  await fs.mkdir(EVIDENCE_DIR, { recursive: true });
  await fs.writeFile(path.join(EVIDENCE_DIR, `${scenarioId}.result.json`), JSON.stringify({ result, harness, runDir }, null, 2), 'utf8');
  await fs.writeFile(path.join(EVIDENCE_DIR, `${scenarioId}.episode.json`), JSON.stringify(episode, null, 2), 'utf8');
}

async function main() {
  if (process.argv.includes('--affected')) {
    let files = (argValue('--files') ?? '').split(',').map(file => file.trim()).filter(Boolean);
    if (process.argv.includes('--diff')) {
      try {
        const { stdout } = await execFileAsync('git', ['-C', ROOT, 'diff', '--name-only', 'HEAD']);
        files = stdout.split('\n').map(line => line.trim()).filter(Boolean);
      } catch { /* no diff available */ }
    }
    const selection = affectedScenarios(files);
    console.log(JSON.stringify({ files, ...selection, battery: GHOST_SCENARIOS.map(scenario => scenario.scenario_id) }, null, 2));
    return;
  }
  const scenarioId = argValue('--scenario') ?? 'codex-bugfix';
  let outcome;
  if (scenarioId === 'codex-bugfix') outcome = await runCodexScenario('codex-bugfix', false);
  else if (scenarioId === 'codex-bugfix-broken') outcome = await runCodexScenario('codex-bugfix-broken', true);
  else if (scenarioId === 'missing-compiler') outcome = await runMissingCompilerScenario();
  else {
    console.log(JSON.stringify({ error: `unknown scenario ${scenarioId}`, known: GHOST_SCENARIOS.map(scenario => scenario.scenario_id) }));
    process.exitCode = 2;
    return;
  }
  const summary = {
    scenario: scenarioId,
    status: outcome.status,
    run_dir: outcome.runDir,
    keep: KEEP,
    first_divergence: outcome.result?.first_divergence ?? null,
    checks: outcome.result?.checks?.map(check => ({ kind: check.check.kind, target: check.check.target, status: check.status })) ?? null,
    reason: outcome.reason ?? null,
    episode_summary: outcome.episode === null ? null : {
      events: outcome.episode.events.length,
      workers: outcome.episode.workers,
      handoffs: outcome.episode.handoffs,
      egress: outcome.episode.egress.length,
      files: outcome.episode.files,
      claims: outcome.episode.claims,
      verified_facts: outcome.episode.verified_facts,
      limitations: outcome.episode.limitations
    }
  };
  console.log(JSON.stringify(summary, null, 2));
  if (!KEEP && outcome.runDir !== undefined) {
    // Retain evidence copies; scratch removal is best-effort.
    await fs.rm(outcome.runDir, { recursive: true, force: true }).catch(() => {});
  }
  if (outcome.status === 'BLOCKED') process.exitCode = 3;
}

await main();
