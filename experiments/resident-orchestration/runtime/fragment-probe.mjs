// Why did Liquid see fragments? Render the template + call completions directly.
import { spawn, execFileSync } from 'node:child_process';
import path from 'node:path';

const ENGINE = 'E:\\llama-cpp\\llama-server.exe';
const MODEL = 'E:\\aide-sovereign-workbench\\models\\LFM2.5-2.6B-QAD-Q4_0.gguf';
const PORT = 8193;
const sleep = ms => new Promise(r => setTimeout(r, ms));

const message = '[CANONICAL PROJECT STATE]\nobjective: make the version parser obey its test contract.\nworkflow_stage: IMPLEMENTATION\ngit_branch: main\nauthority_policy: reads auto-approved.\n\n[TASK]\nWhich git branch is the current project on? One line.';

const child = spawn(ENGINE, ['-m', MODEL, '--host', '127.0.0.1', '--port', String(PORT), '--ctx-size', '4096', '--threads', '4', '--parallel', '1', '--no-warmup', '--prio', '-1', '--jinja', '--temperature', '0.1', '--top-k', '50', '--repeat-penalty', '1.1', '-ngl', '0'], { cwd: path.dirname(ENGINE), stdio: ['ignore', 'pipe', 'pipe'], detached: true });
let ready = false;
for (let i = 0; i < 240; i += 1) { try { const r = await fetch(`http://127.0.0.1:${PORT}/v1/models`, { signal: AbortSignal.timeout(3000) }); if (r.ok) { ready = true; break; } } catch {} await sleep(1000); }
console.log('[frag] ready:', ready);
if (ready) {
  const tpl = await fetch(`http://127.0.0.1:${PORT}/apply-template`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ messages: [{ role: 'user', content: message }] }), signal: AbortSignal.timeout(20000) });
  const rendered = await tpl.json().catch(() => null);
  const prompt = String(rendered?.prompt ?? '');
  console.log('[frag] rendered chars:', prompt.length);
  console.log('[frag] rendered HEAD:', JSON.stringify(prompt.slice(0, 120)));
  console.log('[frag] rendered TAIL:', JSON.stringify(prompt.slice(-160)));

  const tok = await fetch(`http://127.0.0.1:${PORT}/tokenize`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ content: prompt }), signal: AbortSignal.timeout(20000) });
  const tokBody = await tok.json().catch(() => null);
  console.log('[frag] prompt tokens:', Array.isArray(tokBody?.tokens) ? tokBody.tokens.length : 'n/a');

  const r = await fetch(`http://127.0.0.1:${PORT}/v1/chat/completions`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ messages: [{ role: 'user', content: message }], max_tokens: 2048 }), signal: AbortSignal.timeout(600000) });
  const body = await r.json().catch(() => null);
  const choice = body?.choices?.[0] ?? {};
  console.log('[frag] finish:', choice.finish_reason, 'content:', JSON.stringify(String(choice.message?.content ?? '').slice(0, 120)), 'reasoning chars:', String(choice.message?.reasoning_content ?? '').length, 'usage:', JSON.stringify(body?.usage));
}
try { execFileSync('taskkill', ['/PID', String(child.pid), '/F', '/T'], { timeout: 15000 }); } catch {}
console.log('[frag] done');
