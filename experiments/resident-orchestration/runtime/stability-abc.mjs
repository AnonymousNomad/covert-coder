// Engine stability A/B/C (closure wave section 6).
// A: Liquid alone (direct engine). B: Liquid + Covert services (supervised stack).
// C: Liquid + realistic worker coexistence (candidate + qwen0.5b worker).
// Measures RAM before/peak, engine RSS, load, prompt eval, generation speed,
// exit reason; verifies owned processes are reaped and foreign ones untouched.
import { spawn, execFileSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { bootOrchestration, writeJson, residentSay, WORKER_MODELS } from '../lib.mjs';

const REPO = 'E:\\aide-sovereign-workbench';
const ENGINE = 'E:\\llama-cpp\\llama-server.exe';
const MODEL = path.join(REPO, 'models', 'LFM2.5-2.6B-QAD-Q4_0.gguf');
const PROJECT = 'E:\\pip_temp\\opencode\\resident-orch-project';
const sleep = ms => new Promise(r => setTimeout(r, ms));

function stats() {
  const result = { free_mb: null, engines: [] };
  try {
    const free = execFileSync('powershell', ['-NoProfile', '-Command', "(Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory"], { encoding: 'utf8' }).trim();
    result.free_mb = Number(free);
  } catch { /* keep null */ }
  try {
    const out = execFileSync('powershell', ['-NoProfile', '-Command', "Get-CimInstance Win32_Process -Filter \"Name='llama-server.exe'\" | ForEach-Object { \"$($_.ProcessId)|$([math]::Round($_.WorkingSetSize/1MB))\" }"], { encoding: 'utf8' }).trim();
    result.engines = out === '' ? [] : out.split(/\r?\n/).map(l => { const [pid, rss] = l.split('|'); return { pid: Number(pid), rss_mb: Number(rss) }; });
  } catch { /* keep empty */ }
  return result;
}

const REALISTIC = ('[CANONICAL PROJECT STATE] objective: make the version parser obey its test contract (all tests green). workflow_stage: IMPLEMENTATION git_branch: main. '.repeat(12)) + '\n[TASK]\nWhich git branch is the current project on? One line.';

const report = { schema: 'liquid-stability-v1', at: new Date().toISOString(), python_note: 'runner own measurements', tests: {} };

// ---------------- A: Liquid alone (direct engine) ----------------
{
  const before = stats();
  const t0 = Date.now();
  const child = spawn(ENGINE, ['-m', MODEL, '--host', '127.0.0.1', '--port', '8194', '--ctx-size', '4096', '--threads', '4', '--parallel', '1', '--no-warmup', '--prio', '-1', '--jinja', '--temperature', '0.1', '--top-k', '50', '--repeat-penalty', '1.1', '-ngl', '0'], { cwd: path.dirname(ENGINE), stdio: ['ignore', 'pipe', 'pipe'], detached: true });
  let stderr = '';
  child.stderr.on('data', d => { stderr += String(d); });
  let ready = false;
  for (let i = 0; i < 240; i += 1) { try { const r = await fetch('http://127.0.0.1:8194/v1/models', { signal: AbortSignal.timeout(3000) }); if (r.ok) { ready = true; break; } } catch {} await sleep(1000); }
  const load_ms = Date.now() - t0;
  const during = stats();
  let request = null;
  if (ready) {
    const started = Date.now();
    try {
      const r = await fetch('http://127.0.0.1:8194/v1/chat/completions', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ messages: [{ role: 'user', content: REALISTIC }], max_tokens: 1280 }), signal: AbortSignal.timeout(600000) });
      const body = await r.json();
      request = { status: r.status, finish: body?.choices?.[0]?.finish_reason, content_chars: String(body?.choices?.[0]?.message?.content ?? '').length, usage: body?.usage, latency_ms: Date.now() - started };
    } catch (e) { request = { error: String(e.name ?? e) }; }
  }
  const peak = stats();
  let exitCode = null;
  child.kill('SIGTERM');
  await sleep(4000);
  if (child.exitCode === null) { try { execFileSync('taskkill', ['/PID', String(child.pid), '/F', '/T'], { timeout: 15000 }); } catch {} }
  await sleep(2000);
  exitCode = child.exitCode;
  const after = stats();
  report.tests.A = { ready, load_ms, free_before_mb: before.free_mb, free_peak_mb: peak.free_mb, engine_rss_mb: peak.engines, request, exit_code: exitCode, free_after_mb: after.free_mb, engines_after: after.engines, stderr_tail: stderr.slice(-300).replace(/\s+/g, ' ') };
  console.log('[stability] A', JSON.stringify({ ready, load_ms, free_before: before.free_mb, free_peak: peak.free_mb, request, exit: exitCode }).slice(0, 260));
}

// ---------------- B: Liquid + Covert services (supervised stack) ----------------
{
  const before = stats();
  let ok = false;
  let request = null;
  let error = null;
  try {
    const orch = await bootOrchestration({ models: ['candidate'], candidateFile: 'LFM2.5-2.6B-QAD-Q4_0.gguf', skipResident: true });
    ok = true;
    const during = stats();
    try {
      const answer = await residentSay(orch, REALISTIC, { modelId: orch.started['LFM2.5-2.6B-QAD-Q4_0.gguf'].id, maxTokens: 1280, timeoutMs: 600000, temperature: 0.1 });
      request = { content_chars: answer.text.length, latency_ms: answer.timingMs, head: answer.text.replace(/\s+/g, ' ').slice(0, 80) };
    } catch (e) { request = { error: String(e.message ?? e).slice(0, 140) }; }
    report.tests.B = { ...report.tests.B, free_before_mb: before.free_mb, free_during_mb: during.free_mb, engines_during: during.engines, request };
    await orch.close();
  } catch (e) { error = String(e.message ?? e).slice(0, 160); }
  await sleep(6000);
  const after = stats();
  report.tests.B = { ...report.tests.B, boot_ok: ok, error, free_after_mb: after.free_mb, engines_after: after.engines };
  console.log('[stability] B', JSON.stringify(report.tests.B).slice(0, 300));
}

// ---------------- C: Liquid + realistic worker coexistence ----------------
{
  const before = stats();
  let ok = false;
  let error = null;
  try {
    const orch = await bootOrchestration({ models: ['candidate', 'alt'], candidateFile: 'LFM2.5-2.6B-QAD-Q4_0.gguf', skipResident: true });
    ok = true;
    const during = stats();
    let request = null;
    try {
      const answer = await residentSay(orch, REALISTIC, { modelId: orch.started['LFM2.5-2.6B-QAD-Q4_0.gguf'].id, maxTokens: 1280, timeoutMs: 600000, temperature: 0.1 });
      request = { content_chars: answer.text.length, latency_ms: answer.timingMs };
    } catch (e) { request = { error: String(e.message ?? e).slice(0, 140) }; }
    report.tests.C = { boot_ok: ok, free_before_mb: before.free_mb, free_during_mb: during.free_mb, engines_during: during.engines, request };
    await orch.close();
  } catch (e) { error = String(e.message ?? e).slice(0, 160); }
  await sleep(8000);
  const after = stats();
  report.tests.C = { ...report.tests.C, error, free_after_mb: after.free_mb, engines_after: after.engines };
  console.log('[stability] C', JSON.stringify(report.tests.C).slice(0, 300));
}

report.finished_at = new Date().toISOString();
await writeJson('LIQUID-STABILITY.json', report);
console.log('[stability] done');
