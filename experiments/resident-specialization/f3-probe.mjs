// F3 — interface/extraction diagnosis for the official Liquid artifact.
// One bounded variable per arm: chat-template rendering (--jinja ON vs OFF).
// Raw engine capture: finish_reason, content, reasoning_content, timing, keys.
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { buildPacket, PACKET_OUTPUT_CONTRACT } from './decision-packet.mjs';

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\//, ''));
const REPO = path.resolve(HERE, '..', '..');
const MODEL = path.join(REPO, 'models', 'LFM2.5-2.6B-Q4_K_M.gguf');
const ENGINE = 'E:\\llama-cpp\\llama-server.exe';
const PORTS = { jinja: 8141, nojinja: 8142 };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const rows = (await fs.readFile(path.join(HERE, 'dataset', 'dev.jsonl'), 'utf8')).trim().split('\n').map(l => JSON.parse(l));
const doctrine = rows[0].messages[0].content;
const target = process.env.AIDE_F3_ROW ?? 'dev-auth-02';
const taskRow = rows.find(r => r.example_id === target);
const message = doctrine + '\n\n' + buildPacket(target) + '\n' + PACKET_OUTPUT_CONTRACT + '\n\n[TASK]\n' + taskRow.messages[1].content;

async function waitReady(port, deadlineMs = 120000) {
  const deadline = Date.now() + deadlineMs;
  while (Date.now() < deadline) {
    try { const r = await fetch(`http://127.0.0.1:${port}/v1/models`, { signal: AbortSignal.timeout(3000) }); if (r.ok) return true; } catch {}
    await sleep(1500);
  }
  return false;
}

const results = { schema: 'f3-interface-probe-v1', at: new Date().toISOString(), model: path.basename(MODEL), row: target, arms: {} };
for (const [arm, port] of Object.entries(PORTS)) {
  const args = ['-m', MODEL, '--host', '127.0.0.1', '--port', String(port), '--ctx-size', '4096', '--threads', '4', '--parallel', '1', '--no-warmup', '--prio', '-1'];
  if (arm === 'jinja') args.push('--jinja');
  const child = spawn(ENGINE, args, { cwd: 'E:\\llama-cpp', stdio: ['ignore', 'ignore', 'pipe'], detached: true, windowsHide: true });
  let stderrTail = '';
  child.stderr?.on('data', chunk => { stderrTail = (stderrTail + String(chunk)).slice(-3000); });
  try {
    if (!await waitReady(port)) throw new Error(`engine not ready (${arm}): ${stderrTail.slice(-200)}`);
    const started = Date.now();
    const r = await fetch(`http://127.0.0.1:${port}/v1/chat/completions`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'lfm', messages: [{ role: 'system', content: doctrine }, { role: 'user', content: buildPacket(target) + '\n' + PACKET_OUTPUT_CONTRACT + '\n\n[TASK]\n' + taskRow.messages[1].content }], max_tokens: 2048, temperature: 0.1, top_k: 50, repeat_penalty: 1.1, stream: false }),
      signal: AbortSignal.timeout(420000)
    });
    const body = await r.json();
    const choice = body?.choices?.[0] ?? {};
    const msg = choice.message ?? {};
    results.arms[arm] = {
      status: r.status,
      finish_reason: choice.finish_reason ?? null,
      content_length: typeof msg.content === 'string' ? msg.content.length : null,
      reasoning_length: typeof msg.reasoning_content === 'string' ? msg.reasoning_content.length : (typeof msg.reasoning === 'string' ? msg.reasoning.length : null),
      message_keys: Object.keys(msg),
      usage: body?.usage ?? null,
      latency_ms: Date.now() - started,
      content_head: typeof msg.content === 'string' ? msg.content.slice(0, 160) : null,
      reasoning_tail: typeof msg.reasoning_content === 'string' ? msg.reasoning_content.slice(-160) : null
    };
    console.log(`[f3] ${arm}: finish=${results.arms[arm].finish_reason} content=${results.arms[arm].content_length} reasoning=${results.arms[arm].reasoning_length}`);
  } catch (error) {
    results.arms[arm] = { error: String(error.message ?? error).slice(0, 300) };
    console.log(`[f3] ${arm} ERROR: ${results.arms[arm].error}`);
  } finally {
    try { process.kill(-child.pid, 'SIGKILL'); } catch {}
    try { child.kill('SIGKILL'); } catch {}
    await sleep(2000);
    try { process.kill(child.pid, 0); console.log(`[f3] ${arm} engine still alive (audit)`); } catch { console.log(`[f3] ${arm} engine dead (verified)`); }
  }
}
await fs.writeFile(path.join(REPO, 'experiments', 'resident-orchestration', 'results', 'F3-INTERFACE-PROBE.json'), JSON.stringify(results, null, 2));
console.log('[f3] written F3-INTERFACE-PROBE.json');
