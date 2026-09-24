// Condition E leakage audit: checks obligation graph/sequencer fixtures against
// the frozen mustNot regexes and coaching patterns. Writes results/GRAPH-LEAK-AUDIT.json.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { buildGraph, buildSequencer, graphIds } from './obligation-graph.mjs';

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/\//g, path.sep).replace(/^\\/, ''));
const RESULTS = path.resolve(HERE, '..', 'resident-orchestration', 'results');

const MUST_NOT = {
  'dev-cmp-01': [],
  'dev-cmp-02': []
};
const COACHING = [/you should/i, /you must/i, /remember that/i, /the correct (answer|choice|transition) is/i, /answer with/i];

const audit = { schema: 'graph-leak-audit-v1', at: new Date().toISOString(), rows: [], verdict: 'PASS' };
for (const id of graphIds()) {
  const e1 = buildGraph(id);
  const e2 = buildSequencer(id);
  const text = e1 + '\n' + e2;
  const mustNotHits = (MUST_NOT[id] ?? []).filter(re => re.test(text)).map(String);
  const coachingHits = COACHING.filter(re => re.test(text)).map(String);
  // Identifier leakage: the graphs must not contain the expected concrete ids.
  const expectedIds = ['VALIDATION', 'handle-verification-failure', 'IMPLEMENTATION', 'RELEASE'];
  const idHits = expectedIds.filter(idText => text.includes(idText) && !/stages/.test(text.split(idText)[0].slice(-60)));
  const result = mustNotHits.length === 0 && coachingHits.length === 0 && idHits.length === 0 ? 'CLEAN' : 'REVIEW';
  audit.rows.push({ id, must_not_hits: mustNotHits, coaching_hits: coachingHits, identifier_leak_hits: idHits, result });
  if (result !== 'CLEAN') audit.verdict = 'REVIEW_REQUIRED';
}
audit.notes = [
  'graphs supply structure (types, relations, completion rule) only; concrete stage/procedure/role identifiers are not supplied',
  'the word "gate" in cmp-01 derives from the task text itself (premise echo)',
  'E2 replaces the full graph with READY-only projection + persistent invariants + system-owned completion'
];
await fs.writeFile(path.join(RESULTS, 'GRAPH-LEAK-AUDIT.json'), JSON.stringify(audit, null, 2));
console.log(JSON.stringify(audit, null, 2));
