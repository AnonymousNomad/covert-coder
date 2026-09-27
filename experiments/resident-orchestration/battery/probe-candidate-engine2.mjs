// Deeper candidate probe: full response JSON + --jinja + raw completion path.
import { spawn, execFileSync } from 'node:child_process';

const ENGINE = 'E:\\llama-cpp\\llama-server.exe';
const MODEL = 'E:\\aide-sovereign-workbench\\models\\LFM2.5-2.6B-QAD-Q4_0.gguf';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function waitReady(port) {
  for (let i = 0; i < 240; i += 1) {
    try { const r = await fetch(`http://127.0.0.1:${port}/v1/models`, { signal: AbortSignal.timeout(3000) }); if (r.ok) return true; } catch {}
    await sleep(1000);
  }
  return false;
}

async function session(label, extraArgs, port) {
  const child = spawn(ENGINE, ['-m', MODEL, '--host', '127.0.0.1', '--port', String(port), '--ctx-size', '2048', '--threads', '4', '--parallel', '1', '--no-warmup', '--prio', '-1', ...extraArgs], { cwd: 'E:\\llama-cpp', stdio: ['ignore', 'pipe', 'pipe'], detached: true });
  let stderr = '';
  child.stderr.on('data', d => { stderr += String(d); });
  const ready = await waitReady(port);
  console.log(`[probe2] ${label}: ready=${ready} args=${extraArgs.join(' ') || '(none)'}`);
  if (ready) {
    const r = await fetch(`http://127.0.0.1:${port}/v1/chat/completions`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'Reply with exactly: PROBE-OK' }], max_tokens: 16, temperature: 0.2 }),
      signal: AbortSignal.timeout(120000)
    });
    const body = await r.json().catch(() => null);
    console.log('[probe2]   full JSON:', JSON.stringify(body).slice(0, 500));
    const raw = await fetch(`http://127.0.0.1:${port}/completion`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: 'Reply with exactly: PROBE-OK', n_predict: 16, temperature: 0.2 }),
      signal: AbortSignal.timeout(120000)
    });
    const rawBody = await raw.json().catch(() => null);
    console.log('[probe2]   raw completion:', JSON.stringify(rawBody?.content ?? null).slice(0, 200));
    const template = await fetch(`http://127.0.0.1:${port}/props`, { signal: AbortSignal.timeout(30000) });
    const props = await template.json().catch(() => null);
    console.log('[probe2]   template:', JSON.stringify(String(props?.chat_template ?? '').slice(0, 180)));
  } else {
    console.log('[probe2]   stderr:', stderr.slice(-300));
  }
  try { execFileSync('taskkill', ['/PID', String(child.pid), '/F', '/T'], { timeout: 15000 }); } catch {}
  await sleep(2000);
}

await session('no-jinja', [], 8198);
await session('jinja', ['--jinja'], 8197);
console.log('[probe2] done');
