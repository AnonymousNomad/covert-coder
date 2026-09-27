// Generation-budget sweep + full-field capture (addendum section 4/6/8/9/11/12/14).
// Same frozen task, same prompt, same sampling; only the output reserve changes.
// Captures reasoning / content / tool_calls / finish_reason / usage per run.
import { spawn, execFileSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const REPO = 'E:\\aide-sovereign-workbench';
const ENGINE = 'E:\\llama-cpp\\llama-server.exe';
const MODEL = path.join(REPO, 'models', 'LFM2.5-2.6B-QAD-Q4_0.gguf');
const OUT_DIR = path.join(REPO, 'experiments', 'resident-orchestration', 'results');
const PROFILE = JSON.parse(await fs.readFile(path.join(REPO, 'experiments', 'resident-orchestration', 'runtime', 'LIQUID-PROFILE.json'), 'utf8'));
const PORT = 8196;
const sleep = ms => new Promise(r => setTimeout(r, ms));

const BUDGETS = (process.env.AIDE_SWEEP_BUDGETS ?? '1024').split(',').map(Number);
const TASKS = (process.env.AIDE_SWEEP_TASKS ?? 'status-branch-stage,structured-proposal').split(',');
const CTX = Number(process.env.AIDE_SWEEP_CTX || PROFILE.context_size);
// Mirror the Covert runtime exactly when requested: engine-level sampler flags
// (from the profile sidecar) instead of per-request samplers.
const ENGINE_SAMPLERS = process.env.AIDE_SWEEP_ENGINE_SAMPLERS === '1';
const engineSamplerArgs = ENGINE_SAMPLERS
  ? ['--temperature', String(PROFILE.sampling.temperature), '--top-k', String(PROFILE.sampling.top_k), '--repeat-penalty', String(PROFILE.sampling.repeat_penalty), '-ngl', '0']
  : [];
const requestSamplers = ENGINE_SAMPLERS ? {} : { temperature: PROFILE.sampling.temperature, top_k: PROFILE.sampling.top_k, repeat_penalty: PROFILE.sampling.repeat_penalty };

// Battery messages (reconstructed with the same builder inputs; documented).
const BATTERY_TASKS = {
  'status-branch-stage': 'Which git branch is the current project on, and what is the workflow stage?',
  'structured-proposal': 'Return ONLY a JSON object with exactly these keys: {"action": string, "worker_role": string, "requires_approval": boolean, "required_evidence": array}. The action: run the project test suite.'
};
const baseContext = [
  '[CANONICAL PROJECT STATE]',
  'objective: make the version parser obey its test contract (all tests green).',
  'workflow_stage: IMPLEMENTATION',
  'git_branch: main',
  'changed_files: src/version.mjs',
  'last_continuity: {"objective":"make the version parser obey its test contract (all tests green).","next_step":"review the change and continue the project objective"}',
  'available_worker_models: liquid-dogfood-merged-q8_0, qwen2.5-coder-1.5b-instruct-q4_k_m, qwen2.5-coder-0.5b-instruct-q4_k_m'
].join('\n');

const metrics = { started_at: new Date().toISOString(), profile: { model_id: PROFILE.model_id, sha256: PROFILE.artifact_sha256, context_size: PROFILE.context_size, sampling: PROFILE.sampling, threads: PROFILE.threads, gpu_offload_layers: PROFILE.gpu_offload_layers }, engine_start: null, runs: [] };

const jinjaArgs = process.env.AIDE_SWEEP_NO_JINJA === '1' ? [] : ['--jinja'];
const child = spawn(ENGINE, ['-m', MODEL, '--host', '127.0.0.1', '--port', String(PORT), '--ctx-size', String(CTX), '--threads', String(PROFILE.threads), '--parallel', '1', '--no-warmup', '--prio', '-1', ...jinjaArgs, ...engineSamplerArgs], { cwd: path.dirname(ENGINE), stdio: ['ignore', 'pipe', 'pipe'], detached: true });
let stderr = '';
child.stderr.on('data', d => { stderr += String(d); });
const t0 = Date.now();
let ready = false;
for (let i = 0; i < 300; i += 1) { try { const r = await fetch(`http://127.0.0.1:${PORT}/v1/models`, { signal: AbortSignal.timeout(3000) }); if (r.ok) { ready = true; break; } } catch {} await sleep(1000); }
metrics.engine_start = { ready, load_ms: Date.now() - t0 };
console.log('[sweep] engine ready:', ready, 'load_ms:', metrics.engine_start.load_ms);
if (!ready) { console.log('[sweep] stderr tail:', stderr.slice(-400)); try { execFileSync('taskkill', ['/PID', String(child.pid), '/F', '/T'], { timeout: 15000 }); } catch {} process.exit(2); }

for (const budget of BUDGETS) {
  for (const taskId of TASKS) {
    const prompt = baseContext + '\nrelevant_procedures: none\n\n[TASK]\n' + BATTERY_TASKS[taskId];
    const started = Date.now();
    let record = { task: taskId, budget, profile_sampling: PROFILE.sampling };
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/v1/chat/completions`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: prompt }],
          max_tokens: budget,
          ...requestSamplers
        }),
        signal: AbortSignal.timeout(PROFILE.timeout_ms)
      });
      const body = await r.json().catch(() => null);
      const choice = body?.choices?.[0] ?? {};
      const message = choice.message ?? {};
      record = {
        ...record,
        http_status: r.status,
        finish_reason: choice.finish_reason ?? null,
        truncated: choice.finish_reason === 'length',
        prompt_tokens: body?.usage?.prompt_tokens ?? null,
        completion_tokens: body?.usage?.completion_tokens ?? null,
        reasoning_chars: String(message.reasoning_content ?? '').length,
        content_chars: String(message.content ?? '').length,
        tool_calls: message.tool_calls ? JSON.parse(JSON.stringify(message.tool_calls)).slice(0, 2) : null,
        content_head: String(message.content ?? '').replace(/\s+/g, ' ').slice(0, 160),
        reasoning_head: String(message.reasoning_content ?? '').replace(/\s+/g, ' ').slice(0, 140),
        latency_ms: Date.now() - started
      };
    } catch (error) {
      record = { ...record, error: String(error.name ?? error).slice(0, 80), latency_ms: Date.now() - started };
    }
    console.log(`[sweep] ${taskId} budget=${budget} finish=${record.finish_reason} reasoning=${record.reasoning_chars}c content=${record.content_chars}c tool_calls=${record.tool_calls ? 'YES' : 'no'} ${record.latency_ms}ms`);
    metrics.runs.push(record);
  }
}
metrics.engine_stderr_tail = stderr.slice(-500).replace(/\s+/g, ' ');
metrics.finished_at = new Date().toISOString();
await fs.writeFile(path.join(OUT_DIR, 'LIQUID-RUNTIME-METRICS.json'), JSON.stringify(metrics, null, 2), 'utf8');
try { execFileSync('taskkill', ['/PID', String(child.pid), '/F', '/T'], { timeout: 15000 }); } catch {}
console.log('[sweep] done; engine terminated');
