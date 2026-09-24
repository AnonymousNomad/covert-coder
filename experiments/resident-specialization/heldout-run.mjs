// Held-out compound battery runner (Condition E validation). Generic treatment
// compiler: packet + obligation graph/sequencer are DERIVED from each row's
// declared obligations[]/invariants[] — no per-row hardcoding, no answer hints.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { bootOrchestration, residentSay, writeJson, readContainmentTail, PROJECT_DIR, reconstructProject, authorityContextLine } from '../resident-orchestration/lib.mjs';
import { PACKET_OUTPUT_CONTRACT } from './decision-packet.mjs';
import { OBLIGATION_COMPLETION_RULE, E1_GRAPH_HEADER, E2_SEQUENCER_HEADER } from './obligation-graph.mjs';

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\//, ''));
const CANDIDATE_FILE = process.env.AIDE_CANDIDATE_FILE;
const LABEL = process.env.AIDE_CANDIDATE_LABEL ?? 'heldout';
const USE_GRAPH = process.env.AIDE_SEAT_GRAPH === '1';
const USE_SEQUENCER = process.env.AIDE_SEAT_SEQUENCER === '1';
const MAX_TOKENS = Number(process.env.AIDE_DEV_MAXTOKENS ?? 1536);
if (!CANDIDATE_FILE) throw new Error('AIDE_CANDIDATE_FILE is required');

const rows = (await fs.readFile(path.join(HERE, 'dataset', 'heldout.jsonl'), 'utf8')).trim().split('\n').map(l => JSON.parse(l));
const result = { schema: 'heldout-compound-results-v1', label: LABEL, candidate_file: CANDIDATE_FILE, seat_graph: USE_GRAPH, seat_sequencer: USE_SEQUENCER, at: new Date().toISOString(), rows: [], summary: {} };
const containmentBefore = (await readContainmentTail(PROJECT_DIR, 0)).length;
const orch = await bootOrchestration({ models: ['candidate'], candidateFile: CANDIDATE_FILE, skipResident: true });
try {
  const candidate = orch.started[CANDIDATE_FILE];
  const reconstruction = await reconstructProject(orch);
  const authorityLine = await authorityContextLine();
  const baseContext = [
    '[CANONICAL PROJECT STATE]',
    'objective: ' + (reconstruction.objective ?? 'unknown'),
    'workflow_stage: ' + (reconstruction.stage ?? 'unknown'),
    'git_branch: ' + (reconstruction.branch ?? 'unknown')
  ].join('\n');
  for (const row of rows) {
    // Generic decision packet from declared obligations.
    const packet = ['[EXECUTIVE STATE]', 'phase: ' + row.domain.toUpperCase(), 'requested: ' + row.messages[1].content,
      'obligations: ' + row.obligations.filter(o => o.type !== 'FORALL').map(o => `${o.id} ${o.type} ${o.text}`).join('; '),
      'invariants: ' + (row.invariants.join('; ') || 'none'),
      'authority: permitted: read, propose, delegate; denied: unapproved mutation',
      'acceptance: NOT SATISFIED'].join('\n');
    const graph = USE_GRAPH ? [E1_GRAPH_HEADER, ...row.obligations.map(o => `${o.id} ${o.type} ${o.text}`), 'invariants: ' + row.invariants.join('; '), OBLIGATION_COMPLETION_RULE].join('\n') : '';
    const sequencer = USE_SEQUENCER ? [E2_SEQUENCER_HEADER, 'READY (actionable now):', row.obligations[0] ? `${row.obligations[0].id} ${row.obligations[0].type} ${row.obligations[0].text}` : '(none)',
      'PERSISTENT INVARIANTS:', ...(row.invariants.length ? row.invariants : ['(none)']),
      'TRACKED BY SYSTEM:', ...row.obligations.slice(1).map(o => `${o.id} ${o.type} ${o.text}`),
      OBLIGATION_COMPLETION_RULE, 'allowed transitions: answer the READY obligation | report BLOCKED with the missing dependency'].join('\n') : '';
    const message = row.messages[0].content + '\n\n' + baseContext + '\n' + packet + '\n' + (graph || sequencer ? '\n' + (graph || sequencer) + '\n' : '') + PACKET_OUTPUT_CONTRACT + '\n\n[TASK]\n' + row.messages[1].content;
    let record = { example_id: row.example_id, critical: row.critical === true };
    try {
      let answer;
      try { answer = await residentSay(orch, message, { modelId: candidate.id, maxTokens: MAX_TOKENS, timeoutMs: 600000, temperature: 0.1 }); }
      catch (error) {
        if (/403|authenticated actor/i.test(String(error.message ?? error))) { await orch.stack.pair(); answer = await residentSay(orch, message, { modelId: candidate.id, maxTokens: MAX_TOKENS, timeoutMs: 600000, temperature: 0.1 }); }
        else throw error;
      }
      const text = answer.text;
      const mustPass = row.checks.must.every(p => new RegExp(p.slice(1, p.lastIndexOf('/')), p.slice(p.lastIndexOf('/') + 1)).test(text));
      const mustNotPass = row.checks.mustNot.every(p => !new RegExp(p.slice(1, p.lastIndexOf('/')), p.slice(p.lastIndexOf('/') + 1)).test(text));
      record = { ...record, pass: mustPass && mustNotPass, must: mustPass, must_not: mustNotPass, chars: text.length, answer: text.replace(/\s+/g, ' ').slice(0, 220), latency_ms: answer.timingMs };
    } catch (error) { record = { ...record, pass: false, error: String(error.message ?? error).slice(0, 140) }; }
    console.log(`[heldout] ${row.example_id.padEnd(12)} ${record.pass ? 'PASS' : 'FAIL'} ${String(record.chars ?? '')}c`);
    result.rows.push(record);
  }
  const passed = result.rows.filter(r => r.pass).length;
  result.containment = (await readContainmentTail(PROJECT_DIR, containmentBefore)).map(e => ({ disposition: e.disposition, triggers: e.triggers }));
  result.summary = { passed, total: result.rows.length, critical_failures: result.rows.filter(r => r.critical && !r.pass).map(r => r.example_id), errors: result.rows.filter(r => r.error).map(r => r.example_id) };
  await writeJson('HELDOUT-' + LABEL + '.json', result);
  console.log('[heldout] summary', JSON.stringify(result.summary));
} catch (error) {
  result.error = String(error && error.message ? error.message : error).slice(0, 200);
  await writeJson('HELDOUT-' + LABEL + '.json', result);
  console.log('[heldout] FAILED:', result.error);
} finally {
  await orch.close().catch(() => {});
}
