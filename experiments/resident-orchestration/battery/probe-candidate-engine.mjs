// Direct candidate probe: isolate the engine/model from the stacking harness.
// Spawns llama-server for the 2.6B candidate, sends (a) a trivial chat and
// (b) a battery-shaped message, and prints the raw responses.
import { spawn } from 'node:child_process';
import { execFileSync } from 'node:child_process';

const ENGINE = 'E:\\llama-cpp\\llama-server.exe';
const MODEL = 'E:\\aide-sovereign-workbench\\models\\LFM2.5-2.6B-QAD-Q4_0.gguf';
const PORT = 8199;
const sleep = ms => new Promise(r => setTimeout(r, ms));

const child = spawn(ENGINE, ['-m', MODEL, '--host', '127.0.0.1', '--port', String(PORT), '--ctx-size', '2048', '--threads', '4', '--parallel', '1', '--no-warmup', '--prio', '-1'], { cwd: 'E:\\llama-cpp', stdio: ['ignore', 'pipe', 'pipe'], detached: true });
let stderr = '';
child.stderr.on('data', d => { stderr += String(d); });

let ready = false;
for (let i = 0; i < 240; i += 1) {
  try { const r = await fetch(`http://127.0.0.1:${PORT}/v1/models`, { signal: AbortSignal.timeout(3000) }); if (r.ok) { ready = true; break; } } catch {}
  await sleep(1000);
}
console.log('[probe] engine ready:', ready);
if (!ready) {
  console.log('[probe] stderr tail:', stderr.slice(-600));
  try { execFileSync('taskkill', ['/PID', String(child.pid), '/F', '/T'], { timeout: 15000 }); } catch {}
  process.exit(2);
}

async function chat(label, messages, maxTokens = 120) {
  const started = Date.now();
  try {
    const r = await fetch(`http://127.0.0.1:${PORT}/v1/chat/completions`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages, max_tokens: maxTokens, temperature: 0.2 }),
      signal: AbortSignal.timeout(300000)
    });
    const body = await r.json().catch(() => null);
    const text = body?.choices?.[0]?.message?.content ?? '';
    console.log(`[probe] ${label}: status=${r.status} ms=${Date.now() - started} len=${String(text).length}`);
    console.log('[probe]   raw:', JSON.stringify(String(text).slice(0, 220)));
  } catch (error) {
    console.log(`[probe] ${label}: FAILED ${error.name} ${String(error.message).slice(0, 120)} ms=${Date.now() - started}`);
  }
}

await chat('trivial', [{ role: 'user', content: 'Reply with exactly: PROBE-OK' }], 16);
const batteryMessage = [
  '[CANONICAL PROJECT STATE]',
  'objective: make the version parser obey its test contract (all tests green).',
  'workflow_stage: IMPLEMENTATION',
  'git_branch: main',
  'changed_files: src/version.mjs',
  'available_worker_models: liquid-dogfood-merged-q8_0, qwen2.5-coder-1.5b-instruct-q4_k_m',
  'relevant_procedures: resident.handle-verification-failure',
  '',
  '[TASK]',
  'Which git branch is the current project on, and what is the workflow stage?'
].join('\n');
await chat('battery-shaped', [{ role: 'user', content: batteryMessage }], 120);

console.log('[probe] engine stderr tail:', stderr.slice(-400).replace(/\s+/g, ' '));
try { execFileSync('taskkill', ['/PID', String(child.pid), '/F', '/T'], { timeout: 15000 }); } catch {}
console.log('[probe] engine terminated');
