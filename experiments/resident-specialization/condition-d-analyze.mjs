// Condition D analysis: A-vs-D comparison across the pool + architecture verdict.
// Run after condition-d-run-all completes (or when enough models are present).
import { promises as fs } from 'node:fs';
import path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\//, ''));
const RESULTS = path.resolve(HERE, '..', 'resident-orchestration', 'results');
const OUT = path.resolve(HERE, '..', '..', 'docs', 'resident', 'CONDITION-D-RESULTS.json');

const PAIRS = [
  { model: 'Liquid QAD', a: 'DEV-liq-a.json', d: 'DEV-liq-d.json' },
  { model: 'Granite 3.3 2B', a: 'DEV-granite-3.3-2b.json', d: 'DEV-granite-d.json' },
  { model: 'SmolLM3 3B', a: 'DEV-smollm3.json', d: 'DEV-smollm3-d.json' },
  { model: 'Phi-4-mini', a: 'DEV-phi4mini.json', d: 'DEV-phi4-d.json' },
  { model: 'Terminal-SFT', a: 'DEV-terminal-sft.json', d: 'DEV-terminal-d.json' },
  { model: 'Macaw', a: 'DEV-macaw.json', d: 'DEV-macaw-d.json' }
];

const read = async name => JSON.parse(await fs.readFile(path.join(RESULTS, name), 'utf8'));
const rows = {};
for (const pair of PAIRS) {
  try {
    rows[pair.model] = { a: await read(pair.a), d: await read(pair.d) };
  } catch { /* model D run not complete yet */ }
}
const present = Object.keys(rows);

const cmp = (model, key) => {
  const { a, d } = rows[model];
  const score = j => ({ passed: j.summary.passed, by_class: j.summary.by_class, comp: j.summary.critical_failures });
  const errors = j => (j.rows ?? []).filter(r => r.error).length;
  const c = k => ({ a: a.summary.by_class[k]?.passed ?? 0, d: d.summary.by_class[k]?.passed ?? 0 });
  return {
    screen: { a: score(a).passed, d: score(d).passed },
    authority: c('AUTHORITY'),
    claims: c('CLAIM_DISCIPLINE'),
    compound: c('COMPOUND'),
    retrieval: c('RETRIEVAL'),
    routing: c('ROUTING'),
    tool: c('TOOL'),
    communication: c('COMMUNICATION'),
    critical: { a: score(a).comp, d: score(d).comp },
    apparatus_error_rows: { a: errors(a), d: errors(d) },
    verdict: { a: a.summary.verdict, d: d.summary.verdict }
  };
};

const matrix = Object.fromEntries(present.map(m => [m, cmp(m)]));

// Verdict rules (pre-registered):
// - ARCHITECTURAL LOAD DOMINANT: >=2 models gain >=1 compound row (from 0) OR claims >=3 with no authority regression >1.
// - MODEL-SPECIFIC INTERACTION: gains only within one family.
// - MODEL CAPABILITY DOMINANT: no material cross-model movement.
// - MIXED: partial movement (e.g. claims up broadly but compound still 0).
const compoundGain = present.filter(m => matrix[m].compound.d > matrix[m].compound.a).length;
const claimsUp = present.filter(m => matrix[m].claims.d - matrix[m].claims.a >= 1).length;
const claimsThree = present.filter(m => matrix[m].claims.d >= 3).length;
const authorityDrop = present.filter(m => matrix[m].authority.a - matrix[m].authority.d >= 2).length;

let verdict = 'PENDING_MORE_MODELS';
if (present.length >= 3) {
  if (compoundGain >= 2) verdict = 'ARCHITECTURAL_LOAD_DOMINANT';
  else if (claimsThree >= 2 && authorityDrop === 0) verdict = 'MIXED_CLAIMS_UP_COMPOUND_OPEN';
  else if (claimsUp >= 2 && authorityDrop === 0) verdict = 'MIXED_PARTIAL_MOVEMENT';
  else if (claimsUp === 0 && compoundGain === 0) verdict = 'MODEL_CAPABILITY_DOMINANT';
  else verdict = 'MIXED_PARTIAL_MOVEMENT';
}

const out = { schema: 'condition-d-results-v1', at: new Date().toISOString(), models_present: present, matrix, verdict,
  signal_counts: { compound_gain_models: compoundGain, claims_up_models: claimsUp, claims_ge_3_models: claimsThree, authority_drop_ge_2_models: authorityDrop },
  note: 'A = frozen pool screens (reserve 1024 for non-Liquid; Liquid A at 1536). D = packets at reserve 1536. Apparatus error rows recorded per model; exclude when judging model behavior.' };
await fs.writeFile(OUT, JSON.stringify(out, null, 2));
console.log(JSON.stringify({ models_present: present, verdict, signal_counts: out.signal_counts }, null, 2));
for (const m of present) console.log(m, 'screen', matrix[m].screen.a, '->', matrix[m].screen.d, '| claims', matrix[m].claims.a, '->', matrix[m].claims.d, '| compound', matrix[m].compound.a, '->', matrix[m].compound.d, '| auth', matrix[m].authority.a, '->', matrix[m].authority.d);
