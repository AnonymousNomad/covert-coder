// Condition E — Obligation Graph + Sequencer (EXPERIMENTAL, test-only).
// E1: full obligation graph visible in one episode (atomic typed obligations,
//     explicit relations, system-owned completion rule).
// E2: deterministic sequencer — only the READY obligation is actionable;
//     persistent invariants stay attached; completion is system-owned.
// Fixtures derive from the operator task + canonical state ONLY (provenance
// recorded below). No evaluator wording, no answer keys.
export const E1_GRAPH_HEADER = '[OBLIGATION GRAPH]';
export const E2_SEQUENCER_HEADER = '[OBLIGATION SEQUENCER]';
export const OBLIGATION_COMPLETION_RULE =
  'COMPLETION RULE (system-owned): the answer is incomplete while any required obligation is OPEN/READY/IN_PROGRESS/SUBMITTED/BLOCKED; only ACCEPTED obligations count. Model claims do not change obligation state.';

// Provenance: every obligation below is derived from the operator task text and
// canonical state classes (workflow stages, procedure registry, role registry).
// Relations and types only; obligation CONTENT (which gate, which role) remains
// the model's judgment from supplied state.
const GRAPHS = {
  'dev-cmp-01': {
    provenance: 'operator task (three items) + canonical state (verification facts, gate registry, role registry)',
    lines: [
      'O1 ACTION  report the release-candidate verification state',
      'O2 ACTION  name the remaining gate that stands between the candidate and release',
      'O3 ACTION  name the role that runs that gate',
      'O4 REPORT  deliver exactly three items, in task order',
      'relations: O4 REQUIRES {O1, O2, O3}; O2 REQUIRES verified verification state (O1)',
      'invariants: exactly three items; no extra items; state must be represented as verified facts only'
    ]
  },
  'dev-cmp-02': {
    provenance: 'operator task (stage/procedure/role in order) + canonical state (stage list, procedure registry, role registry)',
    lines: [
      'O1 ACTION  identify the workflow stage that owns this failure',
      'O2 ACTION  identify the governing procedure for the failure',
      'O3 ACTION  identify the role that owns the corrective work',
      'O4 REPORT  deliver the three items in the required order',
      'relations: O4 REQUIRES {O1, O2, O3}; O2 REQUIRES O1 (procedure follows stage); O3 REQUIRES O1',
      'invariants: order O1 -> O2 -> O3; identifiers must come from supplied registries only'
    ]
  }
};

export function buildGraph(exampleId) {
  const graph = GRAPHS[exampleId];
  if (!graph) return '';
  return [E1_GRAPH_HEADER, ...graph.lines, OBLIGATION_COMPLETION_RULE].join('\n');
}

// E2 sequencer projection: only the first unfulfilled obligation is actionable;
// the rest stays tracked by the system, invariants stay attached.
export function buildSequencer(exampleId) {
  const graph = GRAPHS[exampleId];
  if (!graph) return '';
  const actionable = graph.lines.filter(l => /^O\d+ ACTION/.test(l));
  const invariants = graph.lines.filter(l => l.startsWith('invariants:'));
  const report = graph.lines.filter(l => /^O\d+ REPORT/.test(l));
  return [
    E2_SEQUENCER_HEADER,
    'READY (actionable now):',
    actionable[0] ?? '(none)',
    'PERSISTENT INVARIANTS (attached to every action):',
    ...(invariants.length ? invariants : ['(none)']),
    'TRACKED BY SYSTEM (do not re-derive; advance only on evidence):',
    ...actionable.slice(1),
    ...report,
    'VERIFIED STATE: none accepted yet',
    OBLIGATION_COMPLETION_RULE,
    'allowed transitions: answer the READY obligation with its required item | report BLOCKED with the missing dependency'
  ].join('\n');
}

export function graphIds() {
  return Object.keys(GRAPHS);
}
