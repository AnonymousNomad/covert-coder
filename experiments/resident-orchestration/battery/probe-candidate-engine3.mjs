// Probe 3: does disabling the thinking block produce direct content?
import { spawn, execFileSync } from 'node:child_process';

const ENGINE = 'E:\\llama-cpp\\llama-server.exe';
const MODEL = 'E:\\aide-sovereign-workbench\\models\\LFM2.5-2.6B-QAD-Q4_0.gguf';
const PORT = 8196;
const sleep = ms => new Promise(r => setTimeout(r, ms));

const child = spawn(ENGINE, ['-m', MODEL, '--host', '127.0.0.1', '--port', String(PORT), '--ctx-size', '4096', '--threads', '4', '--parallel', '1', '--no-warmup', '--prio', '-1', '--jinja'], { cwd: 'E:\\llama-cpp', stdio: ['ignore', 'pipe', 'pipe'], detached: true });
let ready = false;
for (let i = 0; i < 240; i += 1) { try { const r = await fetch(`http://127.0.0.1:${PORT}/v1/models`, { signal: AbortSignal.timeout(3000) }); if (r.ok) { ready = true; break; } } catch {} await sleep(1000); }
console.log('[probe3] ready:', ready);

async function tryCase(label, extra) {
  const started = Date.now();
  const r = await fetch(`http://127.0.0.1:${PORT}/v1/chat/completions`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ messages: [{ role: 'user', content: 'Reply with exactly: PROBE-OK' }], max_tokens: 300, temperature: 0.2, ...extra }),
    signal: AbortSignal.timeout(300000)
  });
  const body = await r.json().catch(() => null);
  const message = body?.choices?.[0]?.message ?? {};
  console.log(`[probe3] ${label}: ms=${Date.now() - started} content=${JSON.stringify(String(message.content ?? '').slice(0, 80))} reasoningLen=${String(message.reasoning_content ?? '').length}`);
}

await tryCase('preserve_thinking:false', { chat_template_kwargs: { preserve_thinking: false } });
await tryCase('enable_thinking:false', { chat_template_kwargs: { enable_thinking: false } });
await tryCase('no-kwargs-300tok', {});

try { execFileSync('taskkill', ['/PID', String(child.pid), '/F', '/T'], { timeout: 15000 }); } catch {}
console.log('[probe3] done');
