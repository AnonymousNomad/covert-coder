// MODEL-DOGFOOD-1 gate: Hugging Face acquisition → verification → registration →
// canonical start attempt → real local llama.cpp inference → evidence.
//
// Uses the supervised stack (real pairing + approved operations) for every
// canonical step, and a gate-owned llama.cpp process for the live runtime leg
// (the canonical TS start refuses acquired GGUFs by design at this commit:
// Unsloth Runtime Passport only + Resource Admission floors; refusals are
// captured, never bypassed). The Model Atlas is not written by this gate.
//
// Usage: node scripts/model-dogfood-1.mjs [--report <path>]

import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { launchSupervisedStack } from '../tests/helpers/supervised-stack.mjs';

const REPO = path.resolve(import.meta.dirname, '..');
const WORKSPACE = 'E:\\covert-dogfood-1-workspace';
const LLAMA_BINARY = 'E:\\llama-cpp\\llama-server.exe';
const ENGINE_PORT = 8104;
const FREE_RAM_FLOOR_BYTES = Math.floor(2.5 * 1024 * 1024 * 1024); // legacy canonical floor
const SEARCH_QUERY = 'Qwen2.5-0.5B-Instruct GGUF';
const PREFERRED_REPOS = ['bartowski/Qwen2.5-0.5B-Instruct-GGUF', 'unsloth/Qwen2.5-0.5B-Instruct-GGUF'];
const reportIndex = process.argv.indexOf('--report');
const reportPath = reportIndex >= 0 ? path.resolve(process.argv[reportIndex + 1]) : path.join(REPO, 'docs', 'evidence', 'model-dogfood-1', `run-${Date.now()}.json`);
const startedAt = new Date().toISOString();
const steps = [];
let engine = null;
let stack = null;

function record(step, ok, detail) {
  steps.push({ step, ok, at: new Date().toISOString(), detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${step}${detail === undefined ? '' : ' :: ' + JSON.stringify(detail).slice(0, 400)}`);
}
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function freeRamBytes() { return os.freemem(); }
async function memorySnapshot() {
  const script = "$s=Get-Counter '\\Memory\\Commit Limit','\\Memory\\Committed Bytes'; $l=[double](($s.CounterSamples|?{$_.Path -like '*commit limit*'}).CookedValue); $c=[double](($s.CounterSamples|?{$_.Path -like '*committed bytes*'}).CookedValue); Write-Output (\"$l|$c\")";
  try {
    const { execFile } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const out = await promisify(execFile)('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script]);
    const [limit, committed] = out.stdout.trim().split('|').map(Number);
    return { commit_limit_bytes: limit, committed_bytes: committed, commit_free_bytes: limit - committed };
  } catch { return null; }
}
async function sha256File(file) {
  const hash = createHash('sha256');
  await new Promise((resolve, reject) => createReadStream(file).on('data', chunk => hash.update(chunk)).on('end', resolve).on('error', reject));
  return hash.digest('hex');
}

try {
  // ── 0. workspace + resource snapshot ─────────────────────────────────────
  await fs.mkdir(path.join(WORKSPACE, 'models'), { recursive: true });
  const statfs = await fs.statfs('E:\\');
  const disk = { total_bytes: statfs.blocks * statfs.bsize, free_bytes: statfs.bavail * statfs.bsize };
  const mem0 = { free_ram_bytes: await freeRamBytes(), ...(await memorySnapshot()) };
  record('00-workspace', true, { workspace: WORKSPACE, disk_free_gb: +(disk.free_bytes / 1073741824).toFixed(1), free_ram_mb: Math.round(mem0.free_ram_bytes / 1048576), commit_free_mb: mem0.commit_free_bytes === null ? null : Math.round(mem0.commit_free_bytes / 1048576), llama_binary_exists: await fs.access(LLAMA_BINARY).then(() => true).catch(() => false) });

  // ── 1. boot supervised stack ─────────────────────────────────────────────
  const bootStart = Date.now();
  stack = await launchSupervisedStack({ workspace: WORKSPACE, env: { AIDE_LLAMA_SERVER: LLAMA_BINARY } });
  record('01-stack', true, { port_facade: stack.port ? undefined : undefined, bases: Object.keys(stack.bases), boot_ms: Date.now() - bootStart });

  // ── 2. HF reachability preflight ─────────────────────────────────────────
  const preflight = await fetch('https://huggingface.co/api/models?search=' + encodeURIComponent('Qwen2.5-0.5B-Instruct-GGUF') + '&limit=3', { signal: AbortSignal.timeout(15000) });
  const preflightBody = preflight.ok ? await preflight.json() : null;
  record('02-hf-reachable', preflight.ok, { status: preflight.status, sample: preflightBody?.map(model => model.id).slice(0, 3) ?? null });

  // ── 3. canonical search (approved external operation) ────────────────────
  const searchResponse = await stack.approveJson({ adapter: 'ts', method: 'GET', path: `/api/modelhub/search?q=${encodeURIComponent(SEARCH_QUERY)}&limit=10` });
  const searchBody = searchResponse.body ?? {};
  const results = searchBody.data?.models ?? searchBody.models ?? searchBody.results ?? searchBody.data?.results ?? [];
  const resultIds = results.map(entry => entry.repo_id ?? entry.id).filter(Boolean);
  const licenseTags = results.flatMap(entry => (entry.tags ?? []).filter(tag => String(tag).startsWith('license:')));
  record('03-search', resultIds.length > 0, { status: searchResponse.status, repos: resultIds.slice(0, 6), licenses: [...new Set(licenseTags)].slice(0, 3) });

  const repoId = PREFERRED_REPOS.find(preferred => resultIds.includes(preferred)) ?? resultIds.find(id => /gguf/i.test(id));
  if (!repoId) throw new Error('no GGUF repository found in search results');
  record('04-repo-selected', true, { repo_id: repoId, preferred: PREFERRED_REPOS.includes(repoId) });

  // ── 4. inspect files + artifact selection ────────────────────────────────
  const filesResponse = await stack.approveJson({ adapter: 'ts', method: 'GET', path: `/api/modelhub/files?repo_id=${encodeURIComponent(repoId)}` });
  const filesBody = filesResponse.body ?? {};
  const files = filesBody.files ?? filesBody.data?.files ?? [];
  const gguf = files.filter(entry => /\.gguf$/i.test(entry.filename ?? ''));
  const pick = quant => gguf.find(entry => new RegExp(`(^|[./_-])${quant}([.\\-_]|$)`, 'i').test(entry.filename));
  const main = pick('Q4_K_M') ?? gguf.find(entry => /q4/i.test(entry.filename)) ?? gguf[0];
  const cancelTarget = gguf.filter(entry => entry.filename !== main?.filename && (entry.size ?? 0) > 50 * 1048576).sort((a, b) => (b.size ?? 0) - (a.size ?? 0))[1] ?? null;
  if (!main) throw new Error('no GGUF artifact found');
  record('05-artifact-selected', true, {
    filename: main.filename, size_bytes: main.size ?? null, nested_path: main.filename.includes('/'),
    total_ggufs: gguf.length, cancel_target: cancelTarget?.filename ?? null,
    classification: 'COMPATIBLE_PROVISIONAL (GGUF; architecture confirmed after download by manifest probe)'
  });

  // ── 5. acquisition plan + free-space preflight ──────────────────────────
  const requiredBytes = Math.ceil((main.size ?? 512 * 1048576) * 1.1) + 64 * 1048576;
  const plan = {
    canonical_model_id_provisional: 'local:' + path.basename(main.filename, path.extname(main.filename)).toLowerCase(),
    source_id: repoId, artifact_filename: main.filename, expected_size_bytes: main.size ?? null,
    destination: path.join(WORKSPACE, 'models'), required_free_bytes: requiredBytes,
    runtime_compatibility: 'llama.cpp local (CPU/Vulkan) — canonical TS broker accepts only Unsloth-passport artifacts at this commit',
    authority: 'capability.external approval enforced by /api/modelhub/download',
    license: 'Apache-2.0 (Qwen2.5-0.5B-Instruct model family)'
  };
  record('06-plan', disk.free_bytes >= requiredBytes, { ...plan, disk_free_bytes: disk.free_bytes });

  // ── 6. canonical download with progress ─────────────────────────────────
  const downloadStart = await stack.approveJson({ adapter: 'ts', method: 'POST', path: '/api/modelhub/download', body: { repo_id: repoId, filename: main.filename, quant_label: 'Q4_K_M' } });
  const downloadStartBody = downloadStart.body ?? {};
  const jobId = downloadStartBody.job?.job_id ?? downloadStartBody.data?.job?.job_id ?? downloadStartBody.job_id ?? downloadStartBody.data?.job_id;
  if (!jobId) throw new Error('download did not return a job id: ' + JSON.stringify(downloadStart.body ?? downloadStart).slice(0, 300));
  record('07-download-started', true, { job_id: jobId, status: downloadStart.status });
  const progressSamples = [];
  let mainJob = null;
  const downloadDeadline = Date.now() + 12 * 60 * 1000;
  while (Date.now() < downloadDeadline) {
    const list = await stack.json('facade', 'GET', '/api/modelhub/downloads');
    const listJobs = list.body?.jobs ?? list.body?.data?.jobs ?? list.jobs ?? [];
    mainJob = listJobs.find(job => job.job_id === jobId) ?? null;
    if (mainJob) {
      progressSamples.push({ t_ms: Date.now() - (downloadDeadline - 12 * 60 * 1000), bytes_done: mainJob.bytes_done, bytes_total: mainJob.bytes_total, status: mainJob.status });
      if (['done', 'error', 'cancelled'].includes(mainJob.status)) break;
    }
    await sleep(600);
  }
  record('08-download-complete', mainJob?.status === 'done', { status: mainJob?.status ?? 'timeout', bytes_done: mainJob?.bytes_done, bytes_total: mainJob?.bytes_total, samples: progressSamples.length, first_seconds: progressSamples.slice(0, 3) });

  // ── 7. cancellation proof (second artifact) ─────────────────────────────
  if (cancelTarget) {
    try {
      const second = await stack.approveJson({ adapter: 'ts', method: 'POST', path: '/api/modelhub/download', body: { repo_id: repoId, filename: cancelTarget.filename, quant_label: null } });
      const secondId = second.body?.job?.job_id ?? second.job?.job_id ?? second.job_id;
      await sleep(2200);
      const cancel = await stack.approveJson({ adapter: 'ts', method: 'POST', path: '/api/modelhub/downloads/cancel', body: { job_id: secondId } });
      await sleep(800);
      const list = await stack.json('facade', 'GET', '/api/modelhub/downloads');
      const listJobs = list.body?.jobs ?? list.body?.data?.jobs ?? list.jobs ?? [];
      const secondJob = listJobs.find(job => job.job_id === secondId) ?? null;
      record('09-cancel-proof', secondJob?.status === 'cancelled', { cancelled_job: secondId, status: secondJob?.status ?? null, cancel_response: cancel.status });
    } catch (error) {
      record('09-cancel-proof', false, { error: String(error?.message ?? error).slice(0, 240) });
    }
  } else {
    record('09-cancel-proof', false, { error: 'no second artifact available to cancel' });
  }

  // ── 8. integrity verification ───────────────────────────────────────────
  const finalFile = path.join(WORKSPACE, 'models', main.filename);
  const stats = await fs.stat(finalFile);
  const computedSha = await sha256File(finalFile);
  let manifest = null;
  try { manifest = JSON.parse(await fs.readFile(finalFile + '.manifest.json', 'utf8')); } catch { /* manifest naming variant below */ }
  if (manifest === null) {
    try {
      const entries = await fs.readdir(path.join(WORKSPACE, 'models'));
      const manifestName = entries.find(name => name.includes(path.basename(main.filename)) && name.endsWith('.json'));
      if (manifestName) manifest = JSON.parse(await fs.readFile(path.join(WORKSPACE, 'models', manifestName), 'utf8'));
    } catch { /* recorded as null */ }
  }
  const sizeMatch = main.size === null ? null : stats.size === main.size;
  const artifact = { filename: main.filename, bytes: stats.size, sha256: computedSha, sha256_source: 'computed_by_gate', expected_size_bytes: main.size ?? null, size_match: sizeMatch, gguf_architecture: manifest?.architecture ?? null, manifest_status: manifest?.status ?? null };
  record('10-verify', (sizeMatch !== false) && Boolean(manifest?.architecture ?? manifest), artifact);

  // ── 9. canonical registration + Model Access visibility ─────────────────
  const register = await stack.approveJson({ adapter: 'ts', method: 'POST', path: '/api/models/register', body: { filename: main.filename, repo_id: repoId, quant_label: 'Q4_K_M', context_tokens: 2048 } });
  const registerBody = register.body ?? {};
  const modelId = registerBody.id ?? registerBody.data?.id ?? null;
  const manager = await stack.json('facade', 'GET', '/api/models/manager');
  const managerModels = manager.body?.models ?? manager.body?.data?.models ?? manager.models ?? [];
  const managerEntry = managerModels.find(entry => entry.identity?.canonical_id === modelId) ?? null;
  record('11-register', Boolean(modelId), {
    status: register.status, model_id: modelId,
    manager: managerEntry === null ? null : {
      availability: managerEntry.availability, readiness: managerEntry.readiness, compatibility: managerEntry.compatibility,
      artifact_ids: managerEntry.artifact_ids, qualification: managerEntry.identity?.qualification?.state ?? null,
      recommended_roles: managerEntry.recommended_roles ?? []
    }
  });

  // ── 10. canonical start attempt (truthful refusal capture) ──────────────
  const memBeforeStart = { free_ram_bytes: await freeRamBytes(), ...(await memorySnapshot()) };
  let startRefusal = null;
  try {
    const startResponse = await stack.approveJson({ adapter: 'ts', method: 'POST', path: '/api/models/start', body: { id: modelId } });
    startRefusal = { status: startResponse.status, body: startResponse.body ?? startResponse, unexpected_success: true };
  } catch (error) {
    startRefusal = { thrown: String(error?.message ?? error).slice(0, 400), status: error?.status ?? null, body: error?.body ?? null };
  }
  record('12-canonical-start-attempt', true, {
    refused: startRefusal?.unexpected_success !== true,
    refusal: startRefusal,
    measured_at_attempt: { free_ram_mb: Math.round(memBeforeStart.free_ram_bytes / 1048576), commit_free_mb: memBeforeStart.commit_free_bytes === null ? null : Math.round(memBeforeStart.commit_free_bytes / 1048576) },
    floor_context: 'canonical admission floor freePhysicalMemoryMB=6656; canonical broker accepts Unsloth Runtime Passport artifacts only (recovery adapter not composed)'
  });

  // ── 11. live runtime (gate-owned llama.cpp, canonical legacy doctrine) ──
  const ramBefore = await freeRamBytes();
  if (ramBefore < FREE_RAM_FLOOR_BYTES) {
    // One bounded drain wait (the legacy manager waits for memory to drain too).
    for (let attempt = 0; attempt < 12 && (await freeRamBytes()) < FREE_RAM_FLOOR_BYTES; attempt += 1) await sleep(5000);
  }
  const ramAtSpawn = await freeRamBytes();
  if (ramAtSpawn < FREE_RAM_FLOOR_BYTES) {
    record('13-live-runtime', false, { blocked: 'free RAM below the 2.5GB legacy floor', free_ram_mb: Math.round(ramAtSpawn / 1048576) });
  } else {
    const args = ['-m', finalFile, '--host', '127.0.0.1', '--port', String(ENGINE_PORT), '--ctx-size', '2048', '--threads', '4', '--parallel', '1', '--no-warmup', '--prio', '-1', '--jinja', '-ngl', '999'];
    const spawnStart = Date.now();
    engine = spawn(LLAMA_BINARY, args, { cwd: path.dirname(LLAMA_BINARY), stdio: ['ignore', 'ignore', 'pipe'], detached: true });
    const enginePid = engine.pid;
    engine.stderr?.on('data', () => {});
    let ready = false;
    const readyDeadline = Date.now() + 150000;
    while (Date.now() < readyDeadline) {
      try {
        const probe = await fetch(`http://127.0.0.1:${ENGINE_PORT}/v1/models`, { signal: AbortSignal.timeout(1200) });
        if (probe.ok) { ready = true; break; }
      } catch { /* warming */ }
      await sleep(1000);
    }
    const healthMs = Date.now() - spawnStart;
    let servedModel = null;
    if (ready) {
      const served = await (await fetch(`http://127.0.0.1:${ENGINE_PORT}/v1/models`)).json();
      servedModel = served?.data?.[0]?.id ?? null;
    }
    record('13-live-runtime', ready, { pid: enginePid, owned: true, binary: LLAMA_BINARY, binary_sha256: await sha256File(LLAMA_BINARY).catch(() => null), args, health_ms: healthMs, served_model: servedModel, free_ram_at_spawn_mb: Math.round(ramAtSpawn / 1048576) });

    // ── 12. real inference ──────────────────────────────────────────────
    if (ready) {
      const inferenceStart = Date.now();
      const completion = await fetch(`http://127.0.0.1:${ENGINE_PORT}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ model: servedModel, messages: [
          { role: 'system', content: 'You are Cipher, the resident intelligence of the Covert workstation. Answer concisely.' },
          { role: 'user', content: 'In one sentence: what is Covert Coder?' }
        ], max_tokens: 64, temperature: 0.2 }),
        signal: AbortSignal.timeout(60000)
      });
      const body = await completion.json().catch(() => null);
      const answer = body?.choices?.[0]?.message?.content ?? null;
      record('14-real-inference', completion.ok && typeof answer === 'string' && answer.length > 0, {
        http: completion.status, ms: Date.now() - inferenceStart,
        answer: typeof answer === 'string' ? answer.slice(0, 300) : null,
        usage: body?.usage ?? null, model_identity: { canonical_id: modelId, artifact_sha256: computedSha, runtime: 'llama.cpp', execution_node: 'local-windows', engine_pid: enginePid }
      });
    } else {
      record('14-real-inference', false, { blocked: 'engine did not reach ready within 150s' });
    }
  }
} catch (error) {
  record('99-harness', false, { error: String(error?.message ?? error).slice(0, 400) });
} finally {
  // ── cleanup: stop only gate-owned surfaces ─────────────────────────────
  if (engine !== null && engine.pid) {
    try { process.kill(engine.pid, 'SIGKILL'); } catch { /* already gone */ }
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
      try { process.kill(engine.pid, 0); await sleep(500); } catch { break; }
    }
  }
  if (stack !== null) { try { await stack.close(); } catch { /* recorded via ports */ } }
  const portFree = async port => {
    try { const probe = await fetch(`http://127.0.0.1:${port}/v1/models`, { signal: AbortSignal.timeout(800) }); return !probe.ok; } catch { return true; }
  };
  const cleanup = { engine_pid: engine?.pid ?? null, engine_port_free: await portFree(ENGINE_PORT) };
  record('15-cleanup', cleanup.engine_port_free, cleanup);
  const failed = steps.filter(step => !step.ok);
  const report = {
    gate: 'covert.model-dogfood-1.v1', started_at: startedAt, finished_at: new Date().toISOString(),
    workspace: WORKSPACE, steps, pass: steps.length - failed.length, fail: failed.length
  };
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
  console.log(`\nMODEL-DOGFOOD-1 ${failed.length === 0 ? 'PASS' : 'PARTIAL'} (${steps.length - failed.length}/${steps.length})`);
  console.log('report=' + reportPath);
  process.exit(failed.length === 0 ? 0 : 1);
}
