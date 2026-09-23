// Compound-failure layer isolation (directive: localize the first causal layer).
// Specimen: dev-cmp-01 — "The parser tests are failing. Give me the workflow
// stage, the governing procedure, and the role that owns the fix."
// Obligations: A) stage IMPLEMENTATION  B) SOP resident.handle-verification-failure  C) role coder.
// Layers: RAW (direct engine) -> ADAPTER (runtime path, harness:false) ->
//         COVERT PATH (scaffold+awareness, no seat system) -> +SEAT SYSTEM ->
//         +PROJECTIONS. Same model, prompt, sampling, reserve, containment.
import { spawn, execFileSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { bootOrchestration, writeJson, PROJECT_DIR } from '../resident-orchestration/lib.mjs';
import { projectObligations, projectRetrievalState } from './projections.mjs';

const REPO = 'E:\\aide-sovereign-workbench';
const ENGINE = 'E:\\llama-cpp\\llama-server.exe';
const CANDIDATE = process.env.AIDE_CANDIDATE_FILE;
const LABEL = process.env.AIDE_CANDIDATE_LABEL ?? 'candidate';
if (!CANDIDATE) throw new Error('AIDE_CANDIDATE_FILE required');
const MODEL = path.join(REPO, 'models', CANDIDATE);
const PORT = 8190;
const SPECIMEN = 'The parser tests are failing. Give me the workflow stage, the governing procedure, and the role that owns the fix.';
const SEAT_SYSTEM = JSON.parse((await fs.readFile(path.join(REPO, 'experiments', 'resident-specialization', 'dataset', 'dev.jsonl'), 'utf8')).trim().split('\n')[0]).messages[0].content;
const sleep = ms => new Promise(r => setTimeout(r, ms));

const score = text => ({
  A_stage: /IMPLEMENTATION/i.test(text),
  B_sop: /handle-verification-failure/i.test(text),
  C_role: /\bcoder\b/i.test(text),
  count: ['A_stage', 'B_sop', 'C_role'].filter(k => ({ A_stage: /IMPLEMENTATION/i.test(text), B_sop: /handle-verification-failure/i.test(text), C_role: /\bcoder\b/i.test(text) })[k]).length
});

const report = { schema: 'resident-path-isolation-v1', at: new Date().toISOString(), candidate: LABEL, specimen: SPECIMEN, layers: {} };

// ---------- Layer 1: RAW MODEL (direct engine, native template, no extras) ----------
{
  const child = spawn(ENGINE, ['-m', MODEL, '--host', '127.0.0.1', '--port', String(PORT), '--ctx-size', '4096', '--threads', '4', '--parallel', '1', '--no-warmup', '--prio', '-1', '--jinja', '--temperature', '0.1', '--top-k', '50', '--repeat-penalty', '1.1', '-ngl', '0'], { cwd: path.dirname(ENGINE), stdio: ['ignore', 'pipe', 'pipe'], detached: true });
  let ready = false;
  for (let i = 0; i < 240; i += 1) { try { const r = await fetch(`http://127.0.0.1:${PORT}/v1/models`, { signal: AbortSignal.timeout(3000) }); if (r.ok) { ready = true; break; } } catch {} await sleep(1000); }
  if (ready) {
    const started = Date.now();
    const r = await fetch(`http://127.0.0.1:${PORT}/v1/chat/completions`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ messages: [{ role: 'user', content: SPECIMEN }], max_tokens: 1024 }), signal: AbortSignal.timeout(600000) });
    const body = await r.json().catch(() => null);
    const text = String(body?.choices?.[0]?.message?.content ?? '');
    report.layers.RAW = { prompt_tokens: body?.usage?.prompt_tokens, answer: text.replace(/\s+/g, ' ').slice(0, 400), ...score(text), latency_ms: Date.now() - started };
  } else report.layers.RAW = { error: 'engine failed to start' };
  try { execFileSync('taskkill', ['/PID', String(child.pid), '/F', '/T'], { timeout: 15000 }); } catch {}
  await sleep(3000);
  console.log('[iso] RAW', JSON.stringify(report.layers.RAW).slice(0, 240));
}

// ---------- Layers 2-5 through the Covert path ----------
const orch = await bootOrchestration({ models: ['candidate'], candidateFile: CANDIDATE, skipResident: true });
try {
  const candidate = orch.started[CANDIDATE];
  const call = async (message, { harness = true, maxTokens = 1024 } = {}) => {
    const started = Date.now();
    const stack = orch.stack;
    const auth = { 'Authorization': `Bearer ${stack.getToken()}`, 'Origin': stack.origin };
    const r = await fetch(`${stack.bases.facade}/api/chat`, { method: 'POST', headers: { 'content-type': 'application/json', 'X-AIDE-API-Format': 'envelope-v1', ...auth }, body: JSON.stringify({ messages: [{ role: 'user', content: message }], modelId: `local:${candidate.id}`, harness, options: { maxTokens, temperature: 0.1, timeoutMs: 600000 } }), signal: AbortSignal.timeout(900000) });
    const body = await r.json().catch(() => null);
    const text = String(body?.data?.text ?? '');
    const used = Number(body?.data?.harness?.usedApprox ?? 0);
    return { text, used, ms: Date.now() - started, status: r.status };
  };
  // Layer 2: ADAPTER only (harness:false -> composer passthrough)
  {
    const out = await call(SPECIMEN, { harness: false });
    report.layers.ADAPTER = { status: out.status, answer: out.text.replace(/\s+/g, ' ').slice(0, 400), ...score(out.text), latency_ms: out.ms };
    console.log('[iso] ADAPTER', JSON.stringify(report.layers.ADAPTER).slice(0, 240));
  }
  // Layer 3: COVERT PATH (scaffold + awareness, no seat system, no projections)
  {
    const out = await call(SPECIMEN, { harness: true });
    report.layers.COVERT_PATH = { status: out.status, harness_tokens_approx: out.used, answer: out.text.replace(/\s+/g, ' ').slice(0, 400), ...score(out.text), latency_ms: out.ms };
    console.log('[iso] COVERT_PATH', JSON.stringify(report.layers.COVERT_PATH).slice(0, 240));
  }
  // Layer 4: + SEAT SYSTEM (current screen baseline)
  {
    const out = await call(SEAT_SYSTEM + '\n\n[TASK]\n' + SPECIMEN, { harness: true });
    report.layers.SEAT_SYSTEM = { status: out.status, harness_tokens_approx: out.used, answer: out.text.replace(/\s+/g, ' ').slice(0, 400), ...score(out.text), latency_ms: out.ms };
    console.log('[iso] SEAT_SYSTEM', JSON.stringify(report.layers.SEAT_SYSTEM).slice(0, 240));
  }
  // Layer 5: + PROJECTIONS
  {
    const projections = [projectObligations(SPECIMEN), projectRetrievalState({})].filter(Boolean).join('\n\n');
    const out = await call(SEAT_SYSTEM + '\n\n' + projections + '\n\n[TASK]\n' + SPECIMEN, { harness: true });
    report.layers.PROJECTIONS = { status: out.status, projections_tokens_approx: Math.ceil(projections.length / 4), harness_tokens_approx: out.used, answer: out.text.replace(/\s+/g, ' ').slice(0, 400), ...score(out.text), latency_ms: out.ms };
    console.log('[iso] PROJECTIONS', JSON.stringify(report.layers.PROJECTIONS).slice(0, 240));
  }
  report.summary = {
    raw: report.layers.RAW?.count ?? 'n/a',
    adapter: report.layers.ADAPTER?.count ?? 'n/a',
    covert_path: report.layers.COVERT_PATH?.count ?? 'n/a',
    seat_system: report.layers.SEAT_SYSTEM?.count ?? 'n/a',
    projections: report.layers.PROJECTIONS?.count ?? 'n/a',
    first_failing_transition: (() => {
      const order = ['RAW', 'ADAPTER', 'COVERT_PATH', 'SEAT_SYSTEM', 'PROJECTIONS'];
      let prev = null;
      for (const layer of order) {
        const entry = report.layers[layer];
        if (!entry || entry.count === undefined) continue;
        if (prev !== null && prev.count === 3 && entry.count < 3) return `${prev.layer}(${prev.count}/3) -> ${layer}(${entry.count}/3)`;
        prev = { layer, count: entry.count };
      }
      return prev ? `no degradation through ${prev.layer} (${prev.count}/3)` : 'n/a';
    })()
  };
  await writeJson('ISOLATION-' + LABEL + '.json', report);
  console.log('[iso] summary', JSON.stringify(report.summary));
} catch (error) {
  report.error = String(error && error.message ? error.message : error).slice(0, 200);
  await writeJson('ISOLATION-' + LABEL + '.json', report);
  console.log('[iso] FAILED:', report.error);
} finally {
  await orch.close().catch(() => {});
}
