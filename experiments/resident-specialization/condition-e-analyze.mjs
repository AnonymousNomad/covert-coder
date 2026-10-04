// Condition E analysis: A -> D -> E1 compound matrix + cross-family verdict.
// Run after condition-e-run-all (e1 mode) completes.
import { promises as fs } from 'node:fs';
import path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\//, ''));
const RESULTS = path.resolve(HERE, '..', 'resident-orchestration', 'results');
const OUT = path.resolve(HERE, '..', '..', 'docs', 'resident', 'CONDITION-E-RESULTS.json');

const PAIRS = [
  { model: 'Liquid QAD', a: 'DEV-liq-a.json', d: 'DEV-liq-d.json', e: 'DEV-liq-e1.json' },
  { model: 'Granite 3.3 2B', a: 'DEV-granite-3.3-2b.json', d: 'DEV-granite-d.json', e: 'DEV-granite-e1.json' },
  { model: 'SmolLM3 3B', a: 'DEV-smollm3.json', d: 'DEV-smollm3-d.json', e: 'DEV-smollm3-e1.json' },
  { model: 'Phi-4-mini', a: 'DEV-phi4mini.json', d: 'DEV-phi4-d.json', e: 'DEV-phi4-e1.json' },
  { model: 'Terminal-SFT', a: 'DEV-terminal-sft.json', d: 'DEV-terminal-d.json', e: 'DEV-terminal-e1.json' },
  { model: 'Macaw', a: 'DEV-macaw.json', d: 'DEV-macaw-d.json', e: 'DEV-macaw-e1.json' }
];

const read = async name => JSON.parse(await fs.readFile(path.join(RESULTS, name), 'utf8'));
const rows = {};
for (const pair of PAIRS) {
  try {
    const e2name = pair.e.replace('-e1.json', '-e2.json');
    const e2 = await fs.readFile(path.join(RESULTS, e2name), 'utf8').then(JSON.parse).catch(() => null);
    rows[pair.model] = { a: await read(pair.a), d: await read(pair.d), e: await read(pair.e), e2 };
  } catch { /* not complete */ }
}
const present = Object.keys(rows);
const compound = j => (j.rows ?? []).filter(r => r.class === 'COMPOUND').map(r => ({ id: r.example_id, pass: r.pass }));
const nonCompound = j => (j.rows ?? []).filter(r => r.class !== 'COMPOUND');

const matrix = {};
for (const m of present) {
  const { a, d, e, e2 } = rows[m];
  const c = j => compound(j);
  const e1Compound = c(e);
  const dCompound = c(d);
  const controlRegression = nonCompound(d).filter(dr => {
    const er = nonCompound(e).find(x => x.example_id === dr.example_id);
    return dr.pass === true && er && er.pass === false;
  }).map(r => r.example_id);
  matrix[m] = {
    screen: { a: a.summary.passed, d: d.summary.passed, e1: e.summary.passed, e2: e2 ? e2.summary.passed : null },
    compound: { a: c(a).map(r => r.pass), d: dCompound.map(r => r.pass), e1: e1Compound.map(r => r.pass), e2: e2 ? c(e2).map(r => r.pass) : null },
    compound_pass_e1: e1Compound.filter(r => r.pass).length,
    compound_pass_e2: e2 ? c(e2).filter(r => r.pass).length : null,
    claims: { d: d.summary.by_class?.CLAIM_DISCIPLINE?.passed ?? 0, e1: e.summary.by_class?.CLAIM_DISCIPLINE?.passed ?? 0 },
    control_regressions: controlRegression,
    e1_errors: (e.rows ?? []).filter(r => r.error).map(r => r.example_id)
  };
}

const familiesE1 = present.filter(m => matrix[m].compound_pass_e1 > 0).length;
const familiesE2 = present.filter(m => (matrix[m].compound_pass_e2 ?? 0) > 0).length;
let verdict = 'PENDING_MORE_MODELS';
if (present.length >= 3) {
  if (familiesE1 >= 3) verdict = 'RELATION_REPRESENTATION_DOMINANT';
  else if (familiesE2 >= 3) verdict = 'SEQUENCING_DOMINANT';
  else if (familiesE1 + familiesE2 >= 1) verdict = 'MODEL_SPECIFIC_INTERACTION';
  else verdict = 'COMPOUND_CAPABILITY_DOMINANT';
}
const out = { schema: 'condition-e-results-v1', at: new Date().toISOString(), models_present: present, matrix, compound_families_with_pass: familiesE1, compound_families_with_pass_e2: familiesE2, verdict,
  note: 'A and D columns frozen; E1 adds the obligation graph, E2 adds the deterministic sequencer. Apparatus error rows recorded per model.' };
await fs.writeFile(OUT, JSON.stringify(out, null, 2));
console.log(JSON.stringify({ models_present: present, compound_families_e1: familiesE1, compound_families_e2: familiesE2, verdict }, null, 2));
for (const m of present) console.log(m, 'screen', matrix[m].screen.a, '->', matrix[m].screen.d, '->', matrix[m].screen.e1, '->', matrix[m].screen.e2, '| compound e1', JSON.stringify(matrix[m].compound.e1), 'e2', JSON.stringify(matrix[m].compound.e2));
