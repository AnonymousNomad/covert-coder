// Analysis for the operational-awareness experiment. Reads the six result JSONs
// (COMP/DEV for conditions liq-a, liq-b, liq-c) and emits the consolidated
// results file with per-condition tables, deltas and the pre-registered causal
// classification. Run after awareness-run-all completes.
import { promises as fs } from 'node:fs';
import path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\//, ''));
const RESULTS = path.resolve(HERE, '..', 'resident-orchestration', 'results');
const OUT = path.resolve(HERE, '..', '..', 'docs', 'resident', 'LIQUID-RESIDENT-AWARENESS-RESULTS.json');

const CONDITIONS = ['liq-a', 'liq-b', 'liq-c'];
const read = async name => JSON.parse(await fs.readFile(path.join(RESULTS, name), 'utf8'));

const comp = {};
const dev = {};
for (const c of CONDITIONS) {
  comp[c] = await read(`COMP-${c}.json`);
  dev[c] = await read(`DEV-${c}.json`);
}

const screenSummary = c => ({
  passed: dev[c].summary.passed,
  total: dev[c].summary.total,
  by_class: dev[c].summary.by_class,
  critical_failures: dev[c].summary.critical_failures,
  verdict: dev[c].summary.verdict
});
const compSummary = c => ({ ...comp[c].summary });
const classScore = (c, klass) => dev[c].summary.by_class[klass]?.passed ?? 0;
const CLASSES = [...new Set(Object.values(dev).flatMap(d => Object.keys(d.summary.by_class)))];

const delta = (x, y) => y - x;
const deltas = {
  'B_minus_A': { screen: delta(dev['liq-a'].summary.passed, dev['liq-b'].summary.passed), comprehension_mean: Number((comp['liq-b'].summary.mean_ratio - comp['liq-a'].summary.mean_ratio).toFixed(3)), by_class: Object.fromEntries(CLASSES.map(k => [k, delta(classScore('liq-a', k), classScore('liq-b', k))])) },
  'C_minus_A': { screen: delta(dev['liq-a'].summary.passed, dev['liq-c'].summary.passed), comprehension_mean: Number((comp['liq-c'].summary.mean_ratio - comp['liq-a'].summary.mean_ratio).toFixed(3)), by_class: Object.fromEntries(CLASSES.map(k => [k, delta(classScore('liq-a', k), classScore('liq-c', k))])) },
  'C_minus_B': { screen: delta(dev['liq-b'].summary.passed, dev['liq-c'].summary.passed), comprehension_mean: Number((comp['liq-c'].summary.mean_ratio - comp['liq-b'].summary.mean_ratio).toFixed(3)), by_class: Object.fromEntries(CLASSES.map(k => [k, delta(classScore('liq-b', k), classScore('liq-c', k))])) }
};

// Pre-registered "materially better": >=3/20 screen rows OR >=2/12 comprehension
// questions moving verdict upward (COMPREHENDED count), same direction across
// at least two behavioral classes.
const material = (d, compX, compY) => {
  const screen = d.screen >= 3;
  const compMove = (compY.summary.COMPREHENDED - compX.summary.COMPREHENDED) >= 2;
  const classesUp = Object.values(d.by_class).filter(v => v > 0).length >= 2;
  return { screen_ge_3: screen, comprehension_ge_2: compMove, two_classes_up: classesUp, material: (screen || compMove) && classesUp };
};

const mb = material(deltas['B_minus_A'], comp['liq-a'], comp['liq-b']);
const mc = material(deltas['C_minus_A'], comp['liq-a'], comp['liq-c']);
const mbc = material(deltas['C_minus_B'], comp['liq-b'], comp['liq-c']);

const classification = mb.material
  ? 'OPERATIONAL_ORIENTATION_DEFECT'
  : mc.material ? 'STATE_REPRESENTATION_INTERFACE_DEFECT'
  : 'MODEL_CAPABILITY_LIMIT_EVIDENCE';

const firstDivergence = [];
for (const row of dev['liq-a'].rows) {
  const b = dev['liq-b'].rows.find(r => r.example_id === row.example_id);
  const c = dev['liq-c'].rows.find(r => r.example_id === row.example_id);
  if (b && b.pass !== row.pass) firstDivergence.push({ row: row.example_id, class: row.class, a: row.pass, b: b.pass, c: c?.pass });
}
for (const q of comp['liq-a'].rows) {
  const b = comp['liq-b'].rows.find(r => r.id === q.id);
  const c = comp['liq-c'].rows.find(r => r.id === q.id);
  if (b && b.verdict !== q.verdict) firstDivergence.push({ question: q.id, a: q.verdict, b: b.verdict, c: c?.verdict });
}

const out = {
  schema: 'liquid-resident-awareness-results-v1',
  at: new Date().toISOString(),
  model: 'LFM2.5-2.6B-QAD-Q4_0.gguf (sha256 a247afd6…b03)',
  apparatus: { reserve: 1536, ctx: 4096, temperature: 0.1, top_k: 50, repeat_penalty: 1.1, jinja: true, rig_fixes: ['R-9 generation reserve 1024->1536 (all conditions equal)'] },
  conditions: {
    A: { description: 'current Resident path', comprehension: compSummary('liq-a'), screen: screenSummary('liq-a') },
    B: { description: 'A + Resident Operational Map', comprehension: compSummary('liq-b'), screen: screenSummary('liq-b') },
    C: { description: 'B + deterministic Situation Frame', comprehension: compSummary('liq-c'), screen: screenSummary('liq-c') }
  },
  deltas,
  materially_better: { 'B_vs_A': mb, 'C_vs_A': mc, 'C_vs_B': mbc },
  first_divergence: firstDivergence,
  causal_classification: classification,
  recommendation: classification === 'OPERATIONAL_ORIENTATION_DEFECT'
    ? 'Produce an integration proposal for a Resident Operational Map (generic, model-neutral); re-run the frozen pool with orientation before further model shopping.'
    : classification === 'STATE_REPRESENTATION_INTERFACE_DEFECT'
    ? 'Produce an integration proposal for a deterministic Situation Frame in the Resident interface; keep the Map only if B showed partial movement.'
    : 'Orientation/state interventions do not materially move the QAD model on these obligations; residual failures remain model-side at this class. Keep evidence for Model Capability Passports; do not wire Map/Frame into production without stronger evidence.',
  artifacts: { comp: CONDITIONS.map(c => `results/COMP-${c}.json`), dev: CONDITIONS.map(c => `results/DEV-${c}.json`) }
};
await fs.writeFile(OUT, JSON.stringify(out, null, 2));
console.log(JSON.stringify({ deltas, materially_better: out.materially_better, causal_classification: classification }, null, 2));
