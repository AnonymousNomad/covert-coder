// Ghost scenario certification (Wave 8). Separation of concerns:
//   GHOST   — what happened (the episode, assembled from canonical stores)
//   SCENARIO — what should happen (expected checks, not prose)
//   HARNESS — canonical post-execution verification performed by the runner
//             (e.g. actually running the fixture tests after a worker ran)
//   RESULT  — machine-readable PASS/FAIL/BLOCKED + FIRST DIVERGENCE
// Workers can never self-certify: PASS derives from episode evidence plus the
// harness's own canonical execution, never from a worker's claim.
import {
  GhostCertificationResult,
  type GhostCertificationResultT,
  type GhostDivergenceT,
  type GhostEpisodeT,
  type GhostScenarioCheckT,
  type GhostScenarioT
} from '../../../common/contracts/ghost.ts';

export type GhostHarnessEvidence = {
  tests_passed: boolean | null;
  tests_detail: string | null;
  changed_files: string[];
  answer_matches: boolean | null;
  answer_detail: string | null;
  evidence_refs: string[];
};

export const GHOST_SCENARIOS: GhostScenarioT[] = [
  {
    scenario_id: 'scripted-bugfix',
    version: 1,
    description: 'A worker fixes a genuine fixture bug through Covert\'s own governed tools; canonical post-run tests prove the fix. Deterministic success case.',
    tags: ['worker', 'real-task', 'files', 'verification'],
    checks: [
      { kind: 'required_event', target: 'tool.result', description: 'the write tool succeeded' },
      { kind: 'required_event', target: 'session.done', description: 'the worker session completed (done)' },
      { kind: 'harness_evidence', target: 'tests_passed', description: 'fixture tests actually pass after the worker ran' },
      { kind: 'harness_evidence', target: 'changed_files_present', description: 'the worker actually changed fixture files' }
    ],
    expected_status: 'PASS',
    limitations: ['the worker model is scripted (the execution chain, authority, and verification are real)']
  },
  {
    scenario_id: 'codex-analysis',
    version: 1,
    description: 'Real Codex subscription worker performs a read-only analysis task; the harness verifies the worker\'s answer against ground truth.',
    tags: ['worker', 'codex', 'real-task', 'read-only', 'verification'],
    checks: [
      { kind: 'required_event', target: 'session.done', description: 'the worker session completed (done)' },
      { kind: 'required_event', target: 'egress.observed', description: 'the remote worker egress was captured' },
      { kind: 'harness_evidence', target: 'answer_matches', description: 'the worker answer matches ground truth' }
    ],
    expected_status: 'PASS',
    limitations: ['read-only analysis: no file effects are expected']
  },
  {
    scenario_id: 'codex-bugfix',
    version: 1,
    description: 'Real Codex subscription worker attempts a file-writing task. On this Windows box the codex workspace-write sandbox cannot apply its ACLs, so the worker cannot edit; the harness must prove the no-op and the certification must FAIL.',
    tags: ['worker', 'codex', 'real-task', 'files', 'environment'],
    checks: [
      { kind: 'required_event', target: 'session.done', description: 'the worker session completed (done)' },
      { kind: 'required_event', target: 'egress.observed', description: 'the remote worker egress was captured' },
      { kind: 'harness_evidence', target: 'tests_passed', description: 'fixture tests actually pass after the worker ran' },
      { kind: 'harness_evidence', target: 'changed_files_present', description: 'the worker actually changed fixture files' }
    ],
    expected_status: 'FAIL',
    limitations: [
      'expected FAIL is an environment truth (codex 0.155.1 workspace-write sandbox on Windows), not a Covert product defect',
      'a PASS here would mean the environment changed; re-scope the scenario before trusting it'
    ]
  },
  {
    scenario_id: 'missing-compiler',
    version: 1,
    description: 'Deterministic failure dogfood: a tool invocation targets a missing compiler; the episode must localize it and the certification must FAIL with a useful first divergence.',
    tags: ['failure', 'tool', 'dogfood'],
    checks: [
      { kind: 'required_event', target: 'tool.result', description: 'the tool invocation succeeded' },
      { kind: 'forbidden_event', target: 'session.error', description: 'the session did not end in error' }
    ],
    expected_status: 'FAIL',
    limitations: ['process-level events are not yet captured; divergence lands at the tool boundary']
  }
];

export function scenarioById(id: string): GhostScenarioT | null {
  return GHOST_SCENARIOS.find(scenario => scenario.scenario_id === id) ?? null;
}

function evaluateCheck(
  check: GhostScenarioCheckT,
  episode: GhostEpisodeT,
  harness: GhostHarnessEvidence
): { status: 'PASS' | 'FAIL'; detail: string } {
  const fail = (detail: string): { status: 'FAIL'; detail: string } => ({ status: 'FAIL', detail });
  const pass = (detail: string): { status: 'PASS'; detail: string } => ({ status: 'PASS', detail });
  switch (check.kind) {
    case 'required_event': {
      const matches = episode.events.filter(event => event.kind === check.target);
      return matches.length > 0 ? pass(`${check.target} observed ${matches.length}x`) : fail(`${check.target} not observed`);
    }
    case 'forbidden_event': {
      const matches = episode.events.filter(event => event.kind === check.target);
      return matches.length === 0 ? pass('forbidden event absent') : fail(`${check.target} observed ${matches.length}x`);
    }
    case 'required_file': {
      const inEpisode = episode.files.some(file => file.endsWith(check.target) || file.includes(check.target));
      const inHarness = harness.changed_files.some(file => file.endsWith(check.target) || file.includes(check.target));
      return inEpisode || inHarness ? pass('file effect present') : fail(`no file effect matching ${check.target}`);
    }
    case 'forbidden_egress':
      return episode.egress.length === 0 ? pass('zero egress captured') : fail(`egress observed ${episode.egress.length}x`);
    case 'verification_check': {
      const [name, state] = check.target.split(':');
      const match = episode.verification?.checks.find(entry => entry.name === name);
      return match !== undefined && match.state === state ? pass(`verification ${name}:${state}`) : fail(`verification ${check.target} not observed`);
    }
    case 'artifact_required':
      return episode.artifacts.length > 0 ? pass(`${episode.artifacts.length} artifact ref(s)`) : fail('no artifact refs');
    case 'harness_evidence': {
      if (check.target === 'tests_passed') {
        return harness.tests_passed === true ? pass(`tests passed (${harness.tests_detail ?? ''})`.slice(0, 380)) : fail(`tests did not pass (${harness.tests_detail ?? 'no result'})`.slice(0, 380));
      }
      if (check.target === 'changed_files_present') {
        return harness.changed_files.length > 0 ? pass(`${harness.changed_files.length} changed file(s)`) : fail('no changed files');
      }
      if (check.target === 'answer_matches') {
        return harness.answer_matches === true ? pass(`answer matches ground truth (${harness.answer_detail ?? ''})`.slice(0, 380)) : fail(`answer did not match ground truth (${harness.answer_detail ?? 'no answer captured'})`.slice(0, 380));
      }
      return fail(`unknown harness evidence target ${check.target}`);
    }
    default:
      return fail(`unknown check kind`);
  }
}

function boundaryFor(check: GhostScenarioCheckT): string {
  if (check.kind === 'harness_evidence') return 'worker effect -> canonical verification';
  if (check.kind === 'verification_check') return 'execution -> verification';
  if (check.kind === 'required_event' && (check.target.startsWith('process.') || check.target === 'tool.result')) return 'workflow -> execution dispatch';
  if (check.kind === 'forbidden_egress') return 'policy -> egress boundary';
  return 'episode observation boundary';
}

export function certifyEpisode(options: {
  scenario: GhostScenarioT;
  episode: GhostEpisodeT;
  harness: GhostHarnessEvidence;
  testedSha: string | null;
  durationMs: number;
}): GhostCertificationResultT {
  const results = options.scenario.checks.map(check => ({ check, ...evaluateCheck(check, options.episode, options.harness) }));
  const firstFailIndex = results.findIndex(result => result.status === 'FAIL');
  const status = firstFailIndex === -1 ? 'PASS' as const : 'FAIL' as const;
  let firstDivergence: GhostDivergenceT | null = null;
  if (firstFailIndex !== -1) {
    const failed = results[firstFailIndex]!;
    const lastEvent = options.episode.events.length > 0 ? options.episode.events[options.episode.events.length - 1]! : null;
    firstDivergence = {
      expected: failed.check.description,
      observed: failed.detail,
      last_verified_event: lastEvent !== null ? `${lastEvent.kind}: ${lastEvent.summary}`.slice(0, 400) : null,
      likely_boundary: boundaryFor(failed.check),
      check_index: firstFailIndex
    };
  }
  return GhostCertificationResult.parse({
    scenario_id: options.scenario.scenario_id,
    scenario_version: options.scenario.version,
    episode_id: options.episode.episode_id,
    tested_sha: options.testedSha,
    status,
    expected_status: options.scenario.expected_status,
    agreement: status === options.scenario.expected_status,
    first_divergence: firstDivergence,
    checks: results,
    workers: options.episode.workers,
    handoffs: options.episode.handoffs,
    egress: options.episode.egress.length,
    files: options.episode.files,
    artifacts: options.episode.artifacts.map(artifact => artifact.ref),
    verification: options.episode.verification?.state ?? null,
    duration_ms: options.durationMs,
    evidence_refs: [...new Set([...options.harness.evidence_refs, ...options.episode.continuation_chains.map(chain => `continuations/${chain}.json`), ...options.episode.handoffs.map(handoff => `worker-handoffs/${handoff}.json`)])].slice(0, 32),
    limitations: [...new Set([...options.scenario.limitations, ...options.episode.limitations])].slice(0, 24),
    produced_at: new Date().toISOString()
  });
}

// --- Selective regression (conservative by design: when uncertain, run more) ---

type AffectedRule = { pattern: RegExp; scenarios: string[]; reason: string };

const AFFECTED_RULES: AffectedRule[] = [
  { pattern: /resident-intent|resident-intent-admission/, scenarios: ['missing-compiler'], reason: 'admission/readiness changes affect task execution entry' },
  { pattern: /subscription-transports|provider-connections|providers\.ts|model-router|byok/, scenarios: ['codex-bugfix', 'codex-analysis'], reason: 'worker/provider transport changes affect remote worker scenarios' },
  { pattern: /agent-loop|agent-tools|agent-parser|server\.ts|openapi\.ts|routes\/agent/, scenarios: ['missing-compiler', 'scripted-bugfix', 'codex-bugfix'], reason: 'execution core changes affect every real-task scenario' },
  { pattern: /worker-handoff|continuation|failure/, scenarios: ['missing-compiler'], reason: 'continuity changes affect failure localization' }
];

export function affectedScenarios(changedFiles: string[]): { selected: string[]; reasons: string[]; conservative: boolean } {
  const selected = new Set<string>();
  const reasons: string[] = [];
  let conservative = false;
  for (const file of changedFiles) {
    const normalized = file.replace(/\\/g, '/');
    let matched = false;
    for (const rule of AFFECTED_RULES) {
      if (rule.pattern.test(normalized)) {
        matched = true;
        for (const scenario of rule.scenarios) selected.add(scenario);
        reasons.push(`${normalized}: ${rule.reason}`);
      }
    }
    if (!matched) {
      conservative = true;
      reasons.push(`${normalized}: no mapping rule; conservative fallback selects the full battery`);
    }
  }
  if (conservative) {
    for (const scenario of GHOST_SCENARIOS) selected.add(scenario.scenario_id);
  }
  return {
    selected: [...selected].sort(),
    reasons: reasons.slice(0, 24),
    conservative
  };
}
