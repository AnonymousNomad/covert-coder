// Two-shot probe: does a preceding warmup-style request corrupt the next prompt
// via llama-server slot prefix reuse? Captures slot-selection stderr lines.
import { spawn, execFileSync } from 'node:child_process';
import path from 'node:path';

const ENGINE = 'E:\\llama-cpp\\llama-server.exe';
const MODEL = 'E:\\aide-sovereign-workbench\\models\\LFM2.5-2.6B-QAD-Q4_0.gguf';
const PORT = 8192;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const MESSAGE = '[CANONICAL PROJECT STATE]\nobjective: make the version parser obey its test contract.\nworkflow_stage: IMPLEMENTATION\ngit_branch: main\nauthority_policy: reads auto-approved.\n\n[TASK]\nWhich git branch is the current project on? One line.';

const child = spawn(ENGINE, ['-m', MODEL, '--host', '127.0.0.1', '--port', String(PORT), '--ctx-size', '4096', '--threads', '4', '--parallel', '1', '--no-warmup', '--prio', '-1', '--jinja'], { cwd: path.dirname(ENGINE), stdio: ['ignore', 'pipe', 'pipe'], detached: true });
let stderr = '';
child.stderr.on('data', d => { stderr += String(d); });
let ready = false;
for (let i = 0; i < 240; i += 1) { try { const r = await fetch(`http://127.0.0.1:${PORT}/v1/models`, { signal: AbortSignal.timeout(3000) }); if (r.ok) { ready = true; break; } } catch {} await sleep(1000); }
console.log('[two-shot] ready:', ready);

async function shot(label, content, maxTokens) {
  const r = await fetch(`http://127.0.0.1:${PORT}/v1/chat/completions`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ messages: [{ role: 'user', content }], max_tokens: maxTokens }), signal: AbortSignal.timeout(600000) });
  const body = await r.json().catch(() => null);
  const choice = body?.choices?.[0] ?? {};
  console.log(`[two-shot] ${label}: finish=${choice.finish_reason} content=${JSON.stringify(String(choice.message?.content ?? '').slice(0, 100))} usage=${JSON.stringify(body?.usage)}`);
}

// Shot 1: mimic the runtime's warmup (tiny single-token request).
await shot('warmup-like', 'warmup', 1);
// Shot 2: the real message.
await shot('real-after-warmup', MESSAGE, 512);
// Shot 3: another different message (suite-like sequence).
await shot('second-different', MESSAGE.replace('Which git branch is the current project on? One line.', 'Return a JSON object with keys action and requires_approval for running the tests.'), 512);

console.log('[two-shot] slot lines:');
for (const line of stderr.split(/\r?\n/).filter(l => /slot|LCP|f_keep|prompt eval|release/.test(l)).slice(-14)) console.log('   ', line.replace(/\x1b\[[0-9;]*m/g, '').slice(0, 170));
try { execFileSync('taskkill', ['/PID', String(child.pid), '/F', '/T'], { timeout: 15000 }); } catch {}
