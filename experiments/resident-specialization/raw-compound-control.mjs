// RAW-only compound control (no Covert layers): direct engine, native template.
import { spawn, execFileSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const REPO = 'E:\\aide-sovereign-workbench';
const ENGINE = 'E:\\llama-cpp\\llama-server.exe';
const CANDIDATE = process.env.AIDE_CANDIDATE_FILE;
const LABEL = process.env.AIDE_CANDIDATE_LABEL ?? 'raw';
if (!CANDIDATE) throw new Error('AIDE_CANDIDATE_FILE required');
const MODEL = path.join(REPO, 'models', CANDIDATE);
const PORT = 8189;
const SPECIMEN = 'The parser tests are failing. Give me the workflow stage, the governing procedure, and the role that owns the fix.';
const sleep = ms => new Promise(r => setTimeout(r, ms));

const child = spawn(ENGINE, ['-m', MODEL, '--host', '127.0.0.1', '--port', String(PORT), '--ctx-size', '4096', '--threads', '4', '--parallel', '1', '--no-warmup', '--prio', '-1', '--jinja', '--temperature', '0.1', '--top-k', '50', '--repeat-penalty', '1.1', '-ngl', '0'], { cwd: path.dirname(ENGINE), stdio: ['ignore', 'pipe', 'pipe'], detached: true });
let ready = false;
for (let i = 0; i < 240; i += 1) { try { const r = await fetch(`http://127.0.0.1:${PORT}/v1/models`, { signal: AbortSignal.timeout(3000) }); if (r.ok) { ready = true; break; } } catch {} await sleep(1000); }
const out = { schema: 'raw-compound-control-v1', at: new Date().toISOString(), candidate: LABEL, ready };
if (ready) {
  const started = Date.now();
  const r = await fetch(`http://127.0.0.1:${PORT}/v1/chat/completions`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ messages: [{ role: 'user', content: SPECIMEN }], max_tokens: 1024 }), signal: AbortSignal.timeout(600000) });
  const body = await r.json().catch(() => null);
  const text = String(body?.choices?.[0]?.message?.content ?? '');
  out.answer = text.replace(/\s+/g, ' ').slice(0, 500);
  out.score = { A_stage: /IMPLEMENTATION/i.test(text), B_sop: /handle-verification-failure/i.test(text), C_role: /\bcoder\b/i.test(text) };
  out.count = [out.score.A_stage, out.score.B_sop, out.score.C_role].filter(Boolean).length;
  out.prompt_tokens = body?.usage?.prompt_tokens;
  out.latency_ms = Date.now() - started;
}
try { execFileSync('taskkill', ['/PID', String(child.pid), '/F', '/T'], { timeout: 15000 }); } catch {}
await fs.writeFile(path.join(REPO, 'experiments', 'resident-specialization', 'RAW-' + LABEL + '.json'), JSON.stringify(out, null, 2), 'utf8');
console.log('[raw]', JSON.stringify(out).slice(0, 400));
