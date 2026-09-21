// Ghost real-task certification runner (Wave 8 / overnight closure).
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
import { createHash, randomUUID } from 'node:crypto';
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

async function sha256File(target) {
  try {
    return createHash('sha256').update(await fs.readFile(target)).digest('hex');
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

async function processImageCount() {
  try {
    const { stdout } = await execFileAsync('tasklist', ['/FI', 'IMAGENAME eq codex.exe', '/NH'], { timeout: 30000 });
    const { stdout: stdout2 } = await execFileAsync('tasklist', ['/FI', 'IMAGENAME eq claude.exe', '/NH'], { timeout: 30000 });
    const count = (text) => text.split('\n').filter(line => /\.exe/i.test(line)).length;
    return count(stdout) + count(stdout2);
  } catch {
    return -1;
  }
}

function bugfixFixtureFiles() {
  return {
    'package.json': JSON.stringify({ name: 'ghost-bugfix-fixture', type: 'module', scripts: { test: 'node --test' } }, null, 2),
    'src/math.mjs': `export function add(a, b) {\n  return a - b;\n}\n`,
    'test/math.test.mjs': `import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport { add } from '../src/math.mjs';\n\ntest('add returns the numeric sum', () => {\n  assert.equal(add(2, 3), 5);\n});\n\ntest('add with zero keeps the value (regression)', () => {\n  assert.equal(add(5, 0), 5);\n});\n`
  };
}

function artifactFixtureFiles() {
  return {
    'package.json': JSON.stringify({ name: 'ghost-artifact-fixture', type: 'module', scripts: { test: 'node --test' } }, null, 2),
    'test/artifact.test.mjs': `import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport { readFile } from 'node:fs/promises';\n\ntest('the build artifact exists with expected content', async () => {\n  const content = await readFile(new URL('../dist/report.txt', import.meta.url), 'utf8');\n  assert.equal(content.trim(), 'GHOST-ARTIFACT-V1');\n});\n`
  };
}

async function writeFixture(dir, files) {
  for (const [rel, content] of Object.entries(files)) {
    const target = path.join(dir, rel);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, content, 'utf8');
  }
}

function makeLanes(list, options = {}) {
  return {
    list,
    index: 0,
    calls: 0,
    failWith: options.failWith ?? null,
    failAfter: options.failAfter ?? 0,
    next() {
      this.calls += 1;
      if (this.failWith !== null && this.calls > this.failAfter) {
        const message = this.failWith;
        this.failWith = null;
        throw new Error(message);
      }
      return this.list[Math.min(this.index++, this.list.length - 1)] ?? '';
    }
  };
}

function makeStubRuntime(lanes) {
  return {
    list: () => [{ id: 'scripted-local', name: 'Scripted Local', endpoint: 'http://127.0.0.1:9/v1', model: 'scripted', context_tokens: 8192, roles: ['chat', 'act'] }],
    status: async () => ({ models: [{ id: 'scripted-local', status: 'running' }] }),
    verifyEndpointModel: async () => ({ ready: true }),
    getEffectiveContext: () => 8192,
    getEffectiveBudget: () => 8192 - 512,
    refreshServedContext: async () => undefined,
    chat: async () => ({ text: lanes.next(), modelId: 'local:scripted-local', timingMs: 1 }),
    chatStream: async (_id, _messages, onDelta) => { onDelta(lanes.next()); return { modelId: 'local:scripted-local', usedApprox: 1, dropped: 0, truncatedSystem: false, timingMs: 1 }; }
  };
}

async function startDirectStack(workspace, lanes, label = 'ghost') {
  const { ArchServer } = await import('../node/src/server.ts');
  const { buildRoutes } = await import('../node/src/openapi.ts');
  const { pairFixture } = await import('../tests/arch/authority-fixture.ts');
  const server = new ArchServer(workspace, path.join(workspace, `arch-${label}.log`));
  const routes = await buildRoutes(workspace, 'test', {
    authority: server.authority,
    events: server.events,
    modelRuntime: makeStubRuntime(lanes),
    agentChatFn: async () => lanes.next()
  });
  for (const route of routes) server.route(route);
  const http = await server.listen(0);
  const address = http.address();
  const owner = await pairFixture(server, `http://127.0.0.1:${address.port}`);
  return { server, http, owner };
}

async function closeDirectStack(ref) {
  if (!ref) return;
  ref.http.closeAllConnections?.();
  await new Promise(resolve => ref.http.close(() => resolve()));
  ref.server.events.close();
  await ref.server.logger.flush();
}

async function directApproved(owner, method, pathname, body, taskId) {
  const headers = await owner.approve(method, pathname, body, taskId);
  return owner.request(pathname, { method, headers, body: JSON.stringify(body), signal: AbortSignal.timeout(180000) });
}

async function directTerminal(owner, sessionId, timeoutMs = 120000, seen = { approvals: [] }) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const response = await owner.request(`/api/agent/status?id=${encodeURIComponent(sessionId)}`, { signal: AbortSignal.timeout(30000) });
    const body = await response.json();
    const data = body.data;
    if (data?.pending_approval?.approval_id) {
      const decision = { session_id: sessionId, approval_id: data.pending_approval.approval_id, decision: 'approve' };
      seen.approvals.push(data.pending_approval.approval_id);
      const headers = await owner.approve('POST', '/api/agent/decision', decision, `ghost-decide-${String(data.pending_approval.approval_id).slice(0, 8)}`);
      await owner.request('/api/agent/decision', { method: 'POST', headers, body: JSON.stringify(decision), signal: AbortSignal.timeout(60000) });
      continue;
    }
    if (['done', 'error', 'aborted'].includes(data?.state)) return data;
    await new Promise(resolve => setTimeout(resolve, 400));
  }
  return { state: 'timeout', error: 'status polling budget exhausted' };
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

async function finalize(scenarioId, runDir, episode, harness, startedAt) {
  const scenario = scenarioById(scenarioId);
  const result = certifyEpisode({ scenario, episode, harness, testedSha: await gitSha(), durationMs: Date.now() - startedAt });
  await writeOutputs(scenarioId, runDir, episode, result, harness);
  return { status: result.status, result, episode, runDir };
}

async function freshRunDir(scenarioId) {
  const runDir = await fs.mkdtemp(path.join(os.tmpdir(), `ghost-${scenarioId}-`));
  const workspace = path.join(runDir, 'workspace');
  await fs.mkdir(workspace, { recursive: true });
  return { runDir, workspace };
}

function emptyHarness() {
  return { flags: {}, details: {}, changed_files: [], evidence_refs: [] };
}

// --- G1: scripted worker fixes a real fixture bug through Covert's own tools ---

async function runScriptedBugfix() {
  const { runDir, workspace } = await freshRunDir('scripted-bugfix');
  const startedAt = Date.now();
  const harness = emptyHarness();
  await writeFixture(workspace, bugfixFixtureFiles());
  const beforeTests = await runFixtureTests(workspace);
  harness.flags.tests_failed_before = beforeTests.passed === false;
  harness.details.tests_failed_before = beforeTests.detail;
  const before = await hashTree(workspace);
  const lanes = makeLanes([
    `<write_file>\n<path>src/math.mjs</path>\n<content>export function add(a, b) {\n  return a + b;\n}\n</content>\n</write_file>`,
    `<attempt_completion>\n<result>fixed add() to sum</result>\n</attempt_completion>`
  ]);
  const stack = await startDirectStack(workspace, lanes, 'bugfix');
  let sessionId = null;
  try {
    const start = await directApproved(stack.owner, 'POST', '/api/agent/start', { task: 'Fix the failing test.', mode: 'act' }, 'ghost-bugfix-start');
    const startBody = await start.json();
    sessionId = startBody.data.session_id;
    await directTerminal(stack.owner, sessionId);
    const tests = await runFixtureTests(workspace);
    const after = await hashTree(workspace);
    harness.flags.tests_passed = tests.passed === true;
    harness.details.tests_passed = tests.detail;
    harness.changed_files = await diffTrees(before, after);
    const episode = await assembleEpisode({ workspace, episodeId: sessionId });
    return await finalize('scripted-bugfix', runDir, episode, harness, startedAt);
  } finally {
    await closeDirectStack(stack);
  }
}

// --- G2: deterministic failure localization (missing compiler) ---

async function runMissingCompiler() {
  const { runDir, workspace } = await freshRunDir('missing-compiler');
  const startedAt = Date.now();
  const harness = emptyHarness();
  const lanes = makeLanes([
    `<run_command>\n<command>ghost-missing-compiler-xyz --build</command>\n</run_command>`,
    `<attempt_completion>\n<result>gave up</result>\n</attempt_completion>`
  ]);
  const stack = await startDirectStack(workspace, lanes, 'compiler');
  try {
    const start = await directApproved(stack.owner, 'POST', '/api/agent/start', { task: 'compile the project', mode: 'act' }, 'ghost-compiler-start');
    const startBody = await start.json();
    const sessionId = startBody.data.session_id;
    await directTerminal(stack.owner, sessionId);
    const episode = await assembleEpisode({ workspace, episodeId: sessionId });
    return await finalize('missing-compiler', runDir, episode, harness, startedAt);
  } finally {
    await closeDirectStack(stack);
  }
}

// --- G4: local-only — zero remote egress ---

async function runLocalOnly() {
  const { runDir, workspace } = await freshRunDir('local-only');
  const startedAt = Date.now();
  const harness = emptyHarness();
  const egressPath = path.join(workspace, '.aide', 'egress', 'journal.jsonl');
  const beforeEgress = await fs.readFile(egressPath, 'utf8').catch(() => '');
  const beforeProcesses = await processImageCount();
  const lanes = makeLanes([`<attempt_completion>\n<result>local task complete</result>\n</attempt_completion>`]);
  const stack = await startDirectStack(workspace, lanes, 'localonly');
  try {
    await directApproved(stack.owner, 'PUT', '/api/connections/preference', { preference: 'local-only' }, 'ghost-localonly-pin');
    const start = await directApproved(stack.owner, 'POST', '/api/agent/start', { task: 'run a fully local task', mode: 'act' }, 'ghost-localonly-start');
    const startBody = await start.json();
    const sessionId = startBody.data.session_id;
    const final = await directTerminal(stack.owner, sessionId);
    const afterEgress = await fs.readFile(egressPath, 'utf8').catch(() => '');
    const afterProcesses = await processImageCount();
    const deltaLines = afterEgress.split('\n').filter(Boolean).length - beforeEgress.split('\n').filter(Boolean).length;
    harness.flags.no_remote_egress_delta = deltaLines === 0;
    harness.details.no_remote_egress_delta = `egress delta ${deltaLines}; session ${final.state}; codex/claude image count ${beforeProcesses}->${afterProcesses}`;
    const episode = await assembleEpisode({ workspace, episodeId: sessionId });
    return await finalize('local-only', runDir, episode, harness, startedAt);
  } finally {
    await closeDirectStack(stack);
  }
}

// --- G5: authority approval -> consume -> effect -> replay denied ---

async function runAuthorityReplay() {
  const { runDir, workspace } = await freshRunDir('authority-replay');
  const startedAt = Date.now();
  const harness = emptyHarness();
  const lanes = makeLanes([
    `<write_file>\n<path>authority-effect.txt</path>\n<content>AUTHORITY-EFFECT-V1\n</content>\n</write_file>`,
    `<attempt_completion>\n<result>effect written</result>\n</attempt_completion>`
  ]);
  const stack = await startDirectStack(workspace, lanes, 'authority');
  try {
    const start = await directApproved(stack.owner, 'POST', '/api/agent/start', { task: 'produce the approved effect', mode: 'act' }, 'ghost-authority-start');
    const startBody = await start.json();
    const sessionId = startBody.data.session_id;
    const seen = { approvals: [] };
    await directTerminal(stack.owner, sessionId, 120000, seen);
    const effect = await fs.readFile(path.join(workspace, 'authority-effect.txt'), 'utf8').catch(() => '');
    harness.flags.effect_applied = effect.trim() === 'AUTHORITY-EFFECT-V1';
    harness.details.effect_applied = harness.flags.effect_applied ? 'effect file matches' : 'effect file missing or wrong';
    const approvalId = seen.approvals[seen.approvals.length - 1];
    if (approvalId === undefined) {
      harness.flags.replay_denied = false;
      harness.details.replay_denied = 'no tool approval was captured; replay could not be attempted';
    } else {
      const replay = await stack.owner.request('/api/agent/decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-AIDE-API-Format': 'envelope-v1' },
        body: JSON.stringify({ session_id: sessionId, approval_id: approvalId, decision: 'approve' }),
        signal: AbortSignal.timeout(60000)
      });
      const replayBody = await replay.json().catch(() => ({}));
      harness.flags.replay_denied = replay.status !== 200;
      harness.details.replay_denied = `replay HTTP ${replay.status} ${JSON.stringify(replayBody).slice(0, 160)}`;
    }
    const episode = await assembleEpisode({ workspace, episodeId: sessionId });
    return await finalize('authority-replay', runDir, episode, harness, startedAt);
  } finally {
    await closeDirectStack(stack);
  }
}

// --- G6: failure -> classification -> governed handoff -> replacement completes ---

const LOCAL_AUTO = { worker: 'local:auto', provider: 'local', model: 'auto', role: 'act' };
const LOCAL_B = { worker: 'local:coder-2', provider: 'local', model: 'coder-2', role: 'act' };

async function runContinuationHandoff() {
  const { runDir, workspace } = await freshRunDir('continuation-handoff');
  const startedAt = Date.now();
  const harness = emptyHarness();
  await fs.writeFile(path.join(workspace, 'package.json'), JSON.stringify({ name: 'ghost-continuation-fixture' }, null, 2), 'utf8');
  const lanesA = makeLanes([`<read_file>\n<path>package.json</path>\n</read_file>`, 'never used'], { failWith: 'provider timed out after 60s', failAfter: 1 });
  const stack = await startDirectStack(workspace, lanesA, 'continuation-a');
  let sessionA = null;
  try {
    const startA = await directApproved(stack.owner, 'POST', '/api/agent/start', { task: 'journey task A', mode: 'act' }, 'ghost-cont-a');
    sessionA = (await startA.json()).data.session_id;
    const finalA = await directTerminal(stack.owner, sessionA);
    const plan = await directApproved(stack.owner, 'POST', '/api/agent/continuation', { failed_session_id: sessionA, failed_worker: LOCAL_AUTO, replacement: LOCAL_B }, 'ghost-cont-plan');
    const planBody = await plan.json();
    const handoffId = planBody.data?.handoff_id;
    harness.flags.continuation_planned = planBody.data?.decision === 'switch' && typeof handoffId === 'string';
    harness.details.continuation_planned = `A=${finalA.state}; decision=${planBody.data?.decision}; handoff=${String(handoffId).slice(0, 12)}`;
    if (typeof handoffId === 'string') {
      lanesA.list = [`<attempt_completion>\n<result>CONTINUATION-DONE</result>\n</attempt_completion>`];
      lanesA.index = 0;
      lanesA.failWith = null;
      const startB = await directApproved(stack.owner, 'POST', '/api/agent/start', { task: 'journey task B', mode: 'act', handoff_id: handoffId, worker: LOCAL_B }, 'ghost-cont-b');
      const startBBody = await startB.json();
      const sessionB = startBBody.data.session_id;
      const finalB = await directTerminal(stack.owner, sessionB);
      const trajectoryB = await fs.readFile(path.join(workspace, '.aide', 'trajectories', `${sessionB}.traj.json`), 'utf8').catch(() => '');
      harness.flags.continuation_completed = finalB.state === 'done' && trajectoryB.includes('RECEIVING CONTEXT');
      harness.details.continuation_completed = `B=${finalB.state}; handoff context present=${trajectoryB.includes('RECEIVING CONTEXT')}`;
    } else {
      harness.flags.continuation_completed = false;
      harness.details.continuation_completed = 'no handoff id was issued';
    }
    const episode = await assembleEpisode({ workspace, episodeId: sessionA });
    return await finalize('continuation-handoff', runDir, episode, harness, startedAt);
  } finally {
    await closeDirectStack(stack);
  }
}

// --- G7: restart continuity — chain + handoff persist; replacement completes; no duplicate effect ---

async function runRestartContinuity() {
  const { runDir, workspace } = await freshRunDir('restart-continuity');
  const startedAt = Date.now();
  const harness = emptyHarness();
  await fs.writeFile(path.join(workspace, 'package.json'), JSON.stringify({ name: 'ghost-restart-fixture' }, null, 2), 'utf8');
  const outputPath = path.join(workspace, 'output.txt');
  const lanesA = makeLanes([
    `<write_file>\n<path>output.txt</path>\n<content>A-partial\n</content>\n</write_file>`,
    'never used'
  ], { failWith: 'provider timed out after 60s', failAfter: 1 });
  const stackA = await startDirectStack(workspace, lanesA, 'restart-a');
  let sessionA = null;
  let handoffId = null;
  try {
    const startA = await directApproved(stackA.owner, 'POST', '/api/agent/start', { task: 'restart journey A', mode: 'act' }, 'ghost-restart-a');
    sessionA = (await startA.json()).data.session_id;
    await directTerminal(stackA.owner, sessionA);
    const plan = await directApproved(stackA.owner, 'POST', '/api/agent/continuation', { failed_session_id: sessionA, failed_worker: LOCAL_AUTO, replacement: LOCAL_B }, 'ghost-restart-plan');
    const planBody = await plan.json();
    handoffId = planBody.data?.handoff_id ?? null;
  } finally {
    await closeDirectStack(stackA);
  }
  const lanesB = makeLanes([
    `<write_file>\n<path>output.txt</path>\n<content>B-final\n</content>\n</write_file>`,
    `<attempt_completion>\n<result>restart continuation done</result>\n</attempt_completion>`
  ]);
  const stackB = await startDirectStack(workspace, lanesB, 'restart-b');
  try {
    const chainsResponse = await stackB.owner.request('/api/agent/continuations', { signal: AbortSignal.timeout(60000) });
    const chainsBody = await chainsResponse.json().catch(() => ({}));
    const chains = chainsBody.data?.chains ?? [];
    const chainPresent = chains.some(chain => (chain.attempts ?? []).some(attempt => attempt.session_id === sessionA));
    const handoffResponse = typeof handoffId === 'string'
      ? await stackB.owner.request(`/api/worker-handoff/get?id=${encodeURIComponent(handoffId)}`, { signal: AbortSignal.timeout(60000) })
      : null;
    const handoffBody = handoffResponse === null ? {} : await handoffResponse.json().catch(() => ({}));
    const handoffPresent = handoffResponse !== null && handoffResponse.status === 200;
    harness.flags.restart_persisted = chainPresent && handoffPresent;
    harness.details.restart_persisted = `chains=${chains.length}; chain has A=${chainPresent}; handoff HTTP ${handoffResponse?.status ?? 'n/a'}`;
    if (typeof handoffId === 'string') {
      const startB = await directApproved(stackB.owner, 'POST', '/api/agent/start', { task: 'restart journey B', mode: 'act', handoff_id: handoffId, worker: LOCAL_B }, 'ghost-restart-b');
      const sessionB = (await startB.json()).data.session_id;
      const finalB = await directTerminal(stackB.owner, sessionB);
      const finalContent = await fs.readFile(outputPath, 'utf8').catch(() => '');
      harness.flags.continuation_completed = finalB.state === 'done';
      harness.details.continuation_completed = `B=${finalB.state}`;
      harness.flags.no_duplicate_effect = finalContent.trim() === 'B-final';
      harness.details.no_duplicate_effect = `final content ${JSON.stringify(finalContent.trim().slice(0, 60))}`;
    } else {
      harness.flags.continuation_completed = false;
      harness.details.continuation_completed = 'no handoff id was issued before restart';
      harness.flags.no_duplicate_effect = false;
      harness.details.no_duplicate_effect = 'not reached';
    }
    const episode = await assembleEpisode({ workspace, episodeId: sessionA });
    return await finalize('restart-continuity', runDir, episode, harness, startedAt);
  } finally {
    await closeDirectStack(stackB);
  }
}

// --- G8: artifact production with real verification ---

async function runArtifactProduction() {
  const { runDir, workspace } = await freshRunDir('artifact-production');
  const startedAt = Date.now();
  const harness = emptyHarness();
  await writeFixture(workspace, artifactFixtureFiles());
  // write_file validates that the parent directory exists (real tool contract);
  // a build output directory is pre-created by the harness.
  await fs.mkdir(path.join(workspace, 'dist'), { recursive: true });
  const lanes = makeLanes([
    `<write_file>\n<path>dist/report.txt</path>\n<content>GHOST-ARTIFACT-V1\n</content>\n</write_file>`,
    `<attempt_completion>\n<result>artifact produced</result>\n</attempt_completion>`
  ]);
  const stack = await startDirectStack(workspace, lanes, 'artifact');
  try {
    const start = await directApproved(stack.owner, 'POST', '/api/agent/start', { task: 'produce the build artifact', mode: 'act' }, 'ghost-artifact-start');
    const sessionId = (await start.json()).data.session_id;
    await directTerminal(stack.owner, sessionId);
    const artifactPath = path.join(workspace, 'dist', 'report.txt');
    const content = await fs.readFile(artifactPath, 'utf8').catch(() => null);
    const hash = await sha256File(artifactPath);
    const tests = await runFixtureTests(workspace);
    const episode = await assembleEpisode({ workspace, episodeId: sessionId });
    const inEpisode = episode.files.some(file => file.includes('dist/report.txt'));
    harness.flags.artifact_verified = content !== null && content.trim() === 'GHOST-ARTIFACT-V1' && hash !== null && inEpisode;
    harness.details.artifact_verified = `exists=${content !== null}; sha256=${String(hash).slice(0, 16)}; linked to task=${inEpisode}`;
    harness.flags.tests_passed = tests.passed === true;
    harness.details.tests_passed = tests.detail;
    return await finalize('artifact-production', runDir, episode, harness, startedAt);
  } finally {
    await closeDirectStack(stack);
  }
}

// --- G3a: real Codex read-only analysis with answer verification ---

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

async function runCodexAnalysis() {
  const runDir = await fs.mkdtemp(path.join('C:\\Users\\Grey_\\AppData\\Local\\Temp\\', 'ghost-codex-analysis-'));
  const workspace = path.join(runDir, 'workspace');
  await fs.mkdir(workspace, { recursive: true });
  await writeFixture(workspace, bugfixFixtureFiles());
  const startedAt = Date.now();
  const harness = emptyHarness();
  const stack = await launchSupervisedStack({ workspace });
  let sessionId = null;
  try {
    await stack.approveJson({ method: 'PUT', path: '/api/byok/consent', body: { enabled: true }, taskId: 'ghost-consent' });
    await stack.approveJson({
      method: 'PUT', path: '/api/byok/routing',
      body: { routing: { plan: 'local', act: { provider_id: 'codex-cli', model_id: '' }, utility: 'local' } },
      taskId: 'ghost-routing'
    });
    const task = 'Read src/math.mjs and test/math.test.mjs. The test fails because of exactly one wrong line in src/math.mjs. Do not modify anything. Reply with exactly one line: BUGLINE: <the full wrong line of code>. When you are completely finished, end your final message with exactly this marker: <attempt_completion><result>short summary</result></attempt_completion>';
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
    const trajectory = await fs.readFile(path.join(workspace, '.aide', 'trajectories', `${sessionId}.traj.json`), 'utf8').catch(() => '{}');
    let answer = '';
    try {
      const parsed = JSON.parse(trajectory);
      const transcript = Array.isArray(parsed.transcript) ? parsed.transcript : [];
      for (let index = transcript.length - 1; index >= 0; index--) {
        if (transcript[index]?.role === 'assistant') { answer = String(transcript[index]?.content ?? ''); break; }
      }
    } catch { /* trajectory unreadable */ }
    const match = answer.match(/BUGLINE:\s*(.+)/);
    const answerLine = match === null ? '' : match[1].trim();
    harness.flags.answer_matches = answerLine.includes('return a - b;');
    harness.details.answer_matches = `session=${final.state}; answer=${JSON.stringify(answerLine.slice(0, 160))}`;
    const episode = await assembleEpisode({ workspace, episodeId: sessionId });
    return await finalize('codex-analysis', runDir, episode, harness, startedAt);
  } finally {
    await stack.close().catch(() => {});
  }
}

// --- G3b: real Codex write attempt (expected FAIL on this box) ---

async function runCodexBugfix() {
  const runDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ghost-codex-bugfix-'));
  const workspace = path.join(runDir, 'workspace');
  await fs.mkdir(workspace, { recursive: true });
  await writeFixture(workspace, bugfixFixtureFiles());
  const startedAt = Date.now();
  const harness = emptyHarness();
  const before = await hashTree(workspace);
  const stack = await launchSupervisedStack({ workspace });
  let sessionId = null;
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
    await waitTerminal(stack, sessionId);
    const tests = await runFixtureTests(workspace);
    const after = await hashTree(workspace);
    harness.flags.tests_passed = tests.passed === true;
    harness.details.tests_passed = tests.detail;
    harness.changed_files = await diffTrees(before, after);
    const episode = await assembleEpisode({ workspace, episodeId: sessionId });
    return await finalize('codex-bugfix', runDir, episode, harness, startedAt);
  } finally {
    await stack.close().catch(() => {});
  }
}

const RUNNERS = {
  'scripted-bugfix': runScriptedBugfix,
  'missing-compiler': runMissingCompiler,
  'local-only': runLocalOnly,
  'authority-replay': runAuthorityReplay,
  'continuation-handoff': runContinuationHandoff,
  'restart-continuity': runRestartContinuity,
  'artifact-production': runArtifactProduction,
  'codex-analysis': runCodexAnalysis,
  'codex-bugfix': runCodexBugfix
};

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
  const scenarioId = argValue('--scenario') ?? 'scripted-bugfix';
  const runner = RUNNERS[scenarioId];
  if (runner === undefined) {
    console.log(JSON.stringify({ error: `unknown scenario ${scenarioId}`, known: Object.keys(RUNNERS) }));
    process.exitCode = 2;
    return;
  }
  const outcome = await runner();
  const summary = {
    scenario: scenarioId,
    status: outcome.status,
    expected_status: outcome.result?.expected_status ?? null,
    agreement: outcome.result?.agreement ?? null,
    run_dir: outcome.runDir,
    keep: KEEP,
    first_divergence: outcome.result?.first_divergence ?? null,
    checks: outcome.result?.checks?.map(check => ({ kind: check.check.kind, target: check.check.target, status: check.status })) ?? null,
    reason: outcome.reason ?? null,
    episode_summary: outcome.episode === null || outcome.episode === undefined ? null : {
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
    await fs.rm(outcome.runDir, { recursive: true, force: true }).catch(() => {});
  }
  if (outcome.status === 'BLOCKED') process.exitCode = 3;
}

await main();
