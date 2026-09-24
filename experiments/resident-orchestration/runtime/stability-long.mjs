// Stability diagnosis: does the engine survive consecutive LONG requests?
// Captures exit code, stderr tail (OOM/kill/crash signatures), and per-run results.
import { spawn, execFileSync } from 'node:child_process';
import path from 'node:path';

const ENGINE = 'E:\\llama-cpp\\llama-server.exe';
const MODEL = 'E:\\aide-sovereign-workbench\\models\\LFM2.5-2.6B-QAD-Q4_0.gguf';
const PORT = 8191;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const BASE = '[CANONICAL PROJECT STATE]\nobjective: make the version parser obey its test contract.\nworkflow_stage: IMPLEMENTATION\ngit_branch: main\nauthority_policy: reads auto-approved; non-read operations require an approved exact operation.\n\n[TASK]\n';
const TASKS = [
  'Which git branch is the current project on? One line.',
  'Return ONLY a JSON object with keys {"action": string, "worker_role": string, "requires_approval": boolean} for running the project test suite.',
  'The project tests are failing. Which operating procedure applies, and which worker role should fix it? One short line.',
  'Summarize the project objective in one sentence.'
];

const child = spawn(ENGINE, ['-m', MODEL, '--host', '127.0.0.1', '--port', String(PORT), '--ctx-size', '4096', '--threads', '4', '--parallel', '1', '--no-warmup', '--prio', '-1', '--jinja', '--temperature', '0.1', '--top-k', '50', '--repeat-penalty', '1.1', '-ngl', '0'], { cwd: path.dirname(ENGINE), stdio: ['ignore', 'pipe', 'pipe'], detached: true });
let stderr = '';
child.stderr.on('data', d => { stderr += String(d); });
let ready = false;
for (let i = 0; i < 240; i += 1) { try { const r = await fetch(`http://127.0.0.1:${PORT}/v1/models`, { signal: AbortSignal.timeout(3000) }); if (r.ok) { ready = true; break; } } catch {} await sleep(1000); }
console.log('[stab] ready:', ready, 'pid', child.pid);

for (const [index, task] of TASKS.entries()) {
  if (child.exitCode !== null) { console.log(`[stab] run ${index + 1}: engine already exited code=${child.exitCode}`); break; }
  const started = Date.now();
  try {
    const r = await fetch(`http://127.0.0.1:${PORT}/v1/chat/completions`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ messages: [{ role: 'user', content: BASE + task }], max_tokens: 2048 }), signal: AbortSignal.timeout(600000) });
    const body = await r.json().catch(() => null);
    const choice = body?.choices?.[0] ?? {};
    console.log(`[stab] run ${index + 1}: status=${r.status} finish=${choice.finish_reason} content=${JSON.stringify(String(choice.message?.content ?? '').slice(0, 90))} completion=${body?.usage?.completion_tokens} ms=${Date.now() - started}`);
  } catch (error) {
    console.log(`[stab] run ${index + 1}: FAILED ${error.name} ${String(error.message).slice(0, 90)} ms=${Date.now() - started} engineExit=${child.exitCode}`);
    break;
  }
}
await sleep(3000);
console.log('[stab] engine exit code:', child.exitCode, 'signal:', child.signalCode);
console.log('[stab] stderr signatures:', /out of memory|oom|abort|Assertion|GGML_ASSERT|error/i.test(stderr) ? stderr.split(/\r?\n/).filter(l => /out of memory|oom|abort|Assertion|error/i.test(l)).slice(-3).map(l => l.slice(0, 160)) : 'none');
try { execFileSync('taskkill', ['/PID', String(child.pid), '/F', '/T'], { timeout: 15000 }); } catch {}
