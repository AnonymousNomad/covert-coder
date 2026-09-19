// scripts/harness-lab.mjs
// Harness Lab live runner — Day-Zero baseline collection.
//
// Drives the REAL Covert supervised stack (supervisor + arch + legacy +
// facade, real HTTP authority pairing) and sends every battery task through
// the production chat path with the production harness scaffold. Verification
// is objective (harness/lab/battery.mjs); nothing here grades a model with a
// model. Observations are appended to the local performance ledger and the
// derived passports/snapshot are written under <repo>/.aide/harness-lab.
//
// Usage:
//   node scripts/harness-lab.mjs [--models=k1,k2] [--tasks=id1,id2]
//                               [--variant=harness|no-harness] [--keep]
//                               [--label=day-zero]
// Env:
//   AIDE_LAB_MODELS  same as --models
import { launchSupervisedStack } from '../tests/helpers/supervised-stack.mjs';
import { loadBattery, evaluateTask } from '../harness/lab/battery.mjs';
import { createPerformanceLedger } from '../node/src/services/performance-ledger.ts';
import { derivePassports, writePassports } from '../node/src/services/model-passport.ts';
import { HARNESS_VERSION } from '../harness/scaffold.mjs';
import { promises as fs } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { createReadStream } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const execFileAsync = promisify(execFile);
const LAB_ROOT = path.join(ROOT, '.aide', 'harness-lab');
const BENCH_WORKSPACE = path.join(LAB_ROOT, 'workspace');
const MODELS_DIR = path.join(ROOT, 'models');
const RUNS_DIR = path.join(LAB_ROOT, 'runs');

const ARGS = process.argv.slice(2);
const flag = name => ARGS.find(argument => argument.startsWith(`--${name}=`))?.slice(name.length + 3);
const has = name => ARGS.includes(`--${name}`);
const KEEP = has('keep');
const VARIANT = flag('variant') === 'no-harness' ? 'no-harness' : 'harness';
const LABEL = flag('label') ?? 'day-zero';

const CANDIDATES = [
  { key: 'smollm2-360m', file: 'E:\\models\\smollm2-360m-instruct-q8_0.gguf', quant: 'Q8_0', repo: 'HuggingFaceTB/SmolLM2-360M-Instruct-GGUF' },
  { key: 'qwen2.5-coder-3b', file: 'E:\\models\\Qwen2.5-Coder-3B-Instruct-Q4_K_M.gguf', quant: 'Q4_K_M', repo: 'Qwen/Qwen2.5-Coder-3B-Instruct-GGUF' },
  { key: 'lfm2.5-1.2b', file: 'E:\\models\\lfm2.5-thinking\\LFM2.5-1.2B-Thinking-Q4_K_M.gguf', quant: 'Q4_K_M', repo: 'LiquidAI/LFM2.5-1.2B-Thinking-GGUF' }
];

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const log = (...parts) => console.log('[lab]', ...parts);

function selectedModels() {
  const requested = (flag('models') ?? process.env.AIDE_LAB_MODELS ?? '').split(',').map(value => value.trim()).filter(Boolean);
  return requested.length === 0 ? CANDIDATES : CANDIDATES.filter(candidate => requested.includes(candidate.key));
}

async function sha256File(file) {
  const hash = createHash('sha256');
  await new Promise((resolve, reject) => {
    const stream = createReadStream(file);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', resolve);
    stream.on('error', reject);
  });
  return hash.digest('hex');
}

async function gitSha() {
  const { stdout } = await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: ROOT });
  return stdout.trim();
}

async function hardwareProfileId() {
  let gpu = 'unknown';
  try {
    const { stdout } = await execFileAsync('nvidia-smi', ['--query-gpu=name,memory.total', '--format=csv,noheader'], { timeout: 10000 });
    gpu = stdout.trim().split(/\r?\n/)[0] ?? 'unknown';
  } catch { /* GPU probe optional */ }
  const profile = `${os.platform()}|${os.cpus()[0]?.model ?? 'cpu'}|${os.cpus().length}|${Math.round(os.totalmem() / (1024 ** 3))}gb|${gpu}`;
  return createHash('sha256').update(profile).digest('hex').slice(0, 16);
}

async function enginePids(fileName) {
  const { stdout } = await execFileAsync('powershell', ['-NoProfile', '-Command',
    `Get-CimInstance Win32_Process -Filter "Name='llama-server.exe'" | Where-Object { $_.CommandLine -like '*${fileName}*' } | Select-Object -ExpandProperty ProcessId`]);
  return stdout.split(/\r?\n/).map(line => line.trim()).filter(Boolean).map(Number);
}

let stack = null;
async function approvedJson({ method = 'POST', routePath, body, signalMs = 300000 }) {
  const operation = await stack.prepare({ method, path: routePath, body });
  await stack.decide(operation.operation_id);
  const response = await stack.request('facade', method, routePath, {
    body,
    headers: { 'X-AIDE-Operation': operation.operation_id, 'X-AIDE-Task': operation.task_id },
    signal: AbortSignal.timeout(signalMs)
  });
  let parsed = {};
  try { parsed = await response.json(); } catch { /* envelope */ }
  return { status: response.status, body: parsed, operation_id: operation.operation_id };
}

async function waitReady(id, timeoutMs = 240000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const { body } = await stack.json('facade', 'GET', `/api/model/ready?id=${encodeURIComponent(id)}`, { signal: AbortSignal.timeout(60000) });
    if (body?.data?.ready === true) return true;
    await sleep(1000);
  }
  return false;
}

const summary = { label: LABEL, variant: VARIANT, started_at: new Date().toISOString(), models: [], tasks: [] };

try {
  await fs.mkdir(LAB_ROOT, { recursive: true });
  await fs.mkdir(BENCH_WORKSPACE, { recursive: true });
  await fs.mkdir(RUNS_DIR, { recursive: true });

  const battery = await loadBattery();
  const requestedTasks = (flag('tasks') ?? '').split(',').map(value => value.trim()).filter(Boolean);
  const tasks = requestedTasks.length === 0 ? battery.tasks : battery.tasks.filter(task => requestedTasks.includes(task.id));
  if (tasks.length === 0) throw new Error('no battery tasks selected');

  const covertSha = await gitSha();
  const machineId = await hardwareProfileId();
  const runId = `${LABEL}-${VARIANT}-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  const ledger = createPerformanceLedger({ root: LAB_ROOT });
  log(`battery ${battery.suite_id}@${battery.suite_version}; ${tasks.length} task(s); variant=${VARIANT}; run=${runId}`);

  stack = await launchSupervisedStack({ workspace: BENCH_WORKSPACE });
  log('supervised stack up');

  for (const candidate of selectedModels()) {
    const artifactSource = candidate.file;
    const exists = await fs.stat(artifactSource).catch(() => null);
    if (exists === null) {
      log(`SKIP ${candidate.key}: artifact not present at ${artifactSource}`);
      summary.models.push({ key: candidate.key, status: 'artifact-missing', artifact: artifactSource });
      continue;
    }
    const fileName = path.basename(artifactSource);
    const target = path.join(MODELS_DIR, fileName);
    if (!(await fs.stat(target).catch(() => null))) await fs.copyFile(artifactSource, target);
    const artifactHash = await sha256File(artifactSource);
    const registered = await approvedJson({ routePath: '/api/models/register', body: { filename: fileName, repo_id: candidate.repo, quant_label: candidate.quant, context_tokens: 2048 }, signalMs: 600000 });
    if (registered.status !== 200) {
      log(`SKIP ${candidate.key}: register failed ${registered.status}`);
      summary.models.push({ key: candidate.key, status: `register-${registered.status}` });
      continue;
    }
    const modelId = registered.body.data.id;

    const started = await approvedJson({ routePath: '/api/models/start', body: { id: modelId } });
    if (started.status !== 200) {
      log(`SKIP ${candidate.key}: start failed ${started.status} ${JSON.stringify(started.body).slice(0, 160)}`);
      summary.models.push({ key: candidate.key, status: `start-${started.status}`, model_id: modelId });
      continue;
    }
    const ready = await waitReady(modelId);
    if (!ready) {
      log(`SKIP ${candidate.key}: never became ready`);
      summary.models.push({ key: candidate.key, status: 'not-ready', model_id: modelId });
      await approvedJson({ routePath: '/api/models/stop', body: { id: modelId } }).catch(() => {});
      continue;
    }
    log(`READY ${candidate.key} (${modelId})`);
    const modelSummary = { key: candidate.key, status: 'benchmarked', model_id: modelId, artifact_hash: artifactHash, tasks: [] };

    for (const task of tasks) {
      const requestBody = {
        modelId,
        messages: [{ role: 'user', content: task.prompt }],
        options: { maxTokens: task.max_tokens, temperature: 0 },
        harness: VARIANT === 'harness'
      };
      const startedAt = Date.now();
      let response;
      try {
        response = await approvedJson({ routePath: '/api/chat', body: requestBody, signalMs: 600000 });
      } catch (error) {
        response = { status: 0, body: { error: { message: String(error?.message ?? error) } }, operation_id: null };
      }
      const durationMs = Date.now() - startedAt;
      const data = response.status === 200 ? response.body?.data ?? null : null;
      const text = data?.text ?? '';
      const runDir = path.join(RUNS_DIR, runId, candidate.key, task.id);
      await fs.mkdir(runDir, { recursive: true });
      const evaluation = await evaluateTask({ task, responseText: text, scratchDir: path.join(runDir, 'scratch') });
      await fs.writeFile(path.join(runDir, 'response.txt'), text, 'utf8');
      await fs.writeFile(path.join(runDir, 'checks.json'), JSON.stringify(evaluation, null, 2), 'utf8');
      const meta = {
        run_id: runId, variant: VARIANT, model_id: modelId, key: candidate.key, task_id: task.id, task_class: task.class,
        http_status: response.status, duration_ms: durationMs, output_tokens: data?.tokens ?? null,
        harness: data?.harness ?? null, operation_id: response.operation_id,
        error: response.status === 200 ? null : String(response.body?.error?.message ?? 'chat failed').slice(0, 200)
      };
      await fs.writeFile(path.join(runDir, 'meta.json'), JSON.stringify(meta, null, 2), 'utf8');
      log(`${candidate.key} ${task.id}: ${evaluation.passed ? 'PASS' : 'FAIL'} (${evaluation.checks_passed}/${evaluation.checks.length}, ${durationMs}ms${data?.tokens ? `, ${data.tokens} tok` : ''})`);

      const event = {
        schema_version: '1.0',
        event_id: randomUUID(),
        run: { run_id: runId, task_id: task.id, timestamp: new Date().toISOString(), covert_sha: covertSha, harness_version: HARNESS_VERSION },
        model: {
          model_id: modelId,
          provider: 'local',
          runtime: 'llama-server',
          model_version: `${candidate.repo}@${fileName}`,
          artifact_hash: artifactHash,
          quantization: candidate.quant,
          configured_context: 2048
        },
        machine: { hardware_profile_id: machineId },
        operating_mode: { mode_id: 'software-engineering' },
        methodology: { workflow_id: VARIANT === 'harness' ? battery.suite_id : `${battery.suite_id}-no-harness`, workflow_version: battery.suite_version, skill_ids: [], sop_ids: [] },
        task: { benchmark_suite: battery.suite_id, benchmark_task_id: task.id, task_class: task.class },
        execution: {
          attempts: 1,
          tool_calls: evaluation.executed_commands,
          tool_failures: evaluation.checks.filter(check => check.type.startsWith('exec_') && !check.passed).length,
          retries: 0,
          escalations: 0,
          authority_requests: response.operation_id === null ? 0 : 1,
          duration_ms: durationMs,
          time_to_first_token_ms: null,
          input_tokens: null,
          output_tokens: typeof data?.tokens === 'number' ? data.tokens : null,
          peak_ram_mb: null,
          peak_vram_mb: null
        },
        verification: {
          deterministic_checks: { passed: evaluation.checks_passed, failed: evaluation.checks_failed },
          tests_passed: evaluation.tests_passed,
          tests_failed: evaluation.tests_failed,
          veritas_verdict: null,
          evidence_refs: [path.join(runDir, 'meta.json'), path.join(runDir, 'checks.json'), path.join(runDir, 'response.txt'), ledger.file]
        },
        outcome: { completed: evaluation.passed, first_attempt_success: evaluation.passed, fallback_required: false, failure_class: evaluation.failure_class },
        provenance: { ghost_ref: null }
      };
      await ledger.append(event);
      modelSummary.tasks.push({ task_id: task.id, passed: evaluation.passed, duration_ms: durationMs, failure_class: evaluation.failure_class });
    }

    const stopped = await approvedJson({ routePath: '/api/models/stop', body: { id: modelId }, signalMs: 120000 });
    log(`STOP ${candidate.key}: ${stopped.status}`);
    await sleep(1000);
    const leftover = await enginePids(fileName);
    if (leftover.length > 0) log(`WARNING ${candidate.key}: engine pid(s) still alive ${leftover.join(',')}`);
    summary.models.push(modelSummary);
  }

  const { events, issues } = await ledger.read();
  const passports = derivePassports(events);
  const passportsFile = await writePassports(LAB_ROOT, passports);
  const snapshot = {
    label: LABEL,
    variant: VARIANT,
    generated_at: new Date().toISOString(),
    run_id: runId,
    covert_sha: covertSha,
    harness_version: HARNESS_VERSION,
    battery: { suite_id: battery.suite_id, suite_version: battery.suite_version, task_ids: tasks.map(task => task.id) },
    machine_profile_id: machineId,
    ledger: { file: ledger.file, events: events.length, integrity_ok: issues.length === 0, issues },
    passports_file: passportsFile,
    passports
  };
  const snapshotFile = path.join(LAB_ROOT, `${LABEL}-${VARIANT}-snapshot.json`);
  await fs.writeFile(snapshotFile, JSON.stringify(snapshot, null, 2), 'utf8');
  summary.finished_at = new Date().toISOString();
  summary.ledger_events = events.length;
  summary.ledger_integrity_ok = issues.length === 0;
  summary.snapshot = snapshotFile;
  summary.passports = passports.map(passport => ({
    model_id: passport.identity.model_id,
    identity: passport.performance_identity,
    sample_size: passport.evidence.sample_size,
    completed: passport.outcome.completed,
    completion_rate: passport.outcome.completion_rate,
    median_duration_ms: passport.execution.median_duration_ms
  }));
  console.log('[lab] SUMMARY');
  console.log(JSON.stringify(summary, null, 2));
} catch (error) {
  summary.error = error instanceof Error ? error.message : String(error);
  console.error('[lab] FAILED:', summary.error);
  console.log('[lab] SUMMARY');
  console.log(JSON.stringify(summary, null, 2));
  process.exitCode = 1;
} finally {
  if (stack !== null) await stack.close().catch(() => {});
  await sleep(1000);
  const stray = await execFileAsync('powershell', ['-NoProfile', '-Command',
    `Get-CimInstance Win32_Process -Filter "Name='llama-server.exe'" | Where-Object { $_.CommandLine -like '*harness-lab*' } | Select-Object -ExpandProperty ProcessId`]).then(result => result.stdout.trim()).catch(() => '');
  if (stray) {
    for (const pid of stray.split(/\r?\n/).filter(Boolean)) await execFileAsync('taskkill', ['/PID', pid, '/F', '/T']).catch(() => {});
    console.error(`[lab] killed stray harness-lab engines: ${stray}`);
  }
  if (!KEEP) {
    for (const candidate of selectedModels()) {
      await fs.rm(path.join(MODELS_DIR, path.basename(candidate.file)), { force: true });
    }
    log('model copies cleaned (pass --keep to retain them)');
  }
}
