// Ghost scenario certification (Wave 8). Separation of concerns:
//   GHOST    — what happened (the episode, assembled from canonical stores)
//   SCENARIO — what should happen (expected checks + declared expected status)
//   HARNESS  — canonical post-execution verification performed by the runner
//              (running the fixture tests, comparing answers, replay attempts,
//              restart persistence, artifact hashing) — never a worker claim
//   RESULT   — machine-readable PASS/FAIL/BLOCKED + agreement + FIRST DIVERGENCE
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
  // Boolean outcomes the harness itself established (canonical verification).
  flags: Record<string, boolean>;
  // Human-readable detail per flag (bounded).
  details: Record<string, string>;
  // Files that actually changed on disk during the run (hash-diffed by the harness).
  changed_files: string[];
  // References to persisted harness evidence artifacts.
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
      { kind: 'harness_evidence', target: 'tests_failed_before', description: 'the fixture test genuinely failed before the fix' },
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
  },
  {
    scenario_id: 'local-only',
    version: 1,
    description: 'A real local task under the local-only preference: zero remote egress journaled, proven by the episode and the harness egress-delta check.',
    tags: ['local-only', 'egress', 'policy'],
    checks: [
      { kind: 'required_event', target: 'session.done', description: 'the local session completed' },
      { kind: 'forbidden_egress', target: 'any', description: 'zero egress captured in the episode' },
      { kind: 'harness_evidence', target: 'no_remote_egress_delta', description: 'no remote invocation was journaled during the run' }
    ],
    expected_status: 'PASS',
    limitations: ['remote-process proof uses the canonical egress journal plus a codex/claude image-count snapshot']
  },
  {
    scenario_id: 'authority-replay',
    version: 1,
    description: 'Protected operation: approval -> consume -> effect -> replay attempt denied. Ghost captures the causality chain without authority tokens.',
    tags: ['authority', 'replay', 'security'],
    checks: [
      { kind: 'required_event', target: 'authority.granted', description: 'the operation was approved' },
      { kind: 'required_event', target: 'authority.consumed', description: 'the approval was consumed exactly once' },
      { kind: 'required_event', target: 'tool.result', description: 'the approved effect actually ran' },
      { kind: 'harness_evidence', target: 'replay_denied', description: 'the replayed approval was refused' },
      { kind: 'harness_evidence', target: 'effect_applied', description: 'the approved effect actually landed on disk' }
    ],
    expected_status: 'PASS',
    limitations: ['the episode carries operation digests as audit references but no tokens or credentials']
  },
  {
    scenario_id: 'continuation-handoff',
    version: 1,
    description: 'Worker A fails deterministically; Wave 6 classification issues a governed handoff; Worker B completes the same task identity. Ghost shows both workers, the failure, and the handoff.',
    tags: ['continuation', 'handoff', 'failure'],
    checks: [
      { kind: 'required_event', target: 'failure.classified', description: 'the failure was classified' },
      { kind: 'required_event', target: 'handoff.created', description: 'a governed handoff was created' },
      { kind: 'required_event', target: 'handoff.consumed', description: 'the handoff was consumed by the replacement' },
      { kind: 'harness_evidence', target: 'continuation_completed', description: 'the replacement completed the same task' }
    ],
    expected_status: 'PASS',
    limitations: ['the episode keys on the failed session; the replacement session is verified by the harness']
  },
  {
    scenario_id: 'restart-continuity',
    version: 1,
    description: 'A meaningful task is interrupted by a controlled stack restart; the continuation chain persists; the replacement completes; no duplicate effect; verification passes.',
    tags: ['restart', 'persistence', 'continuation'],
    checks: [
      { kind: 'required_event', target: 'failure.classified', description: 'the pre-restart failure was classified' },
      { kind: 'harness_evidence', target: 'restart_persisted', description: 'the continuation chain survived the restart' },
      { kind: 'harness_evidence', target: 'no_duplicate_effect', description: 'the completed effect happened exactly once' },
      { kind: 'harness_evidence', target: 'continuation_completed', description: 'the replacement completed after the restart' }
    ],
    expected_status: 'PASS',
    limitations: ['in-memory agent sessions do not survive restart by design; continuity rides the persisted chain + handoff']
  },
  {
    scenario_id: 'artifact-production',
    version: 1,
    description: 'A task genuinely produces an artifact; certification verifies existence, producing task linkage, size/hash, and the artifact verification test.',
    tags: ['artifact', 'verification'],
    checks: [
      { kind: 'required_file', target: 'dist/report.txt', description: 'the artifact exists as a file effect' },
      { kind: 'harness_evidence', target: 'artifact_verified', description: 'artifact exists with expected size/hash and correct producing task' },
      { kind: 'harness_evidence', target: 'tests_passed', description: 'the artifact verification test passed' }
    ],
    expected_status: 'PASS',
    limitations: [
      'the artifact is produced by the scripted worker through Covert write_file; hash/size are computed by the harness',
      'the dist/ output directory is pre-created by the harness (write_file requires an existing parent directory)'
    ]
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
      if (check.target === 'changed_files_present') {
        return harness.changed_files.length > 0 ? pass(`${harness.changed_files.length} changed file(s)`) : fail('no changed files');
      }
      const flag = harness.flags[check.target];
      if (flag === undefined) return fail(`unknown harness evidence target ${check.target}`);
      const detail = harness.details[check.target] ?? `${check.target}=${String(flag)}`;
      return flag === true ? pass(detail.slice(0, 380)) : fail(detail.slice(0, 380));
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
  { pattern: /worker-handoff|continuation|failure/, scenarios: ['missing-compiler', 'continuation-handoff', 'restart-continuity'], reason: 'continuity changes affect failure localization and handoff scenarios' },
  { pattern: /authority|operation-policy/, scenarios: ['authority-replay', 'missing-compiler'], reason: 'authority changes affect approval/consume/replay integrity' },
  { pattern: /connections|preference/, scenarios: ['local-only'], reason: 'preference changes affect local-only egress guarantees' },
  { pattern: /egress|journal/, scenarios: ['local-only', 'codex-analysis', 'codex-bugfix'], reason: 'egress journaling changes affect every egress-proof scenario' },
  { pattern: /verification|veritas/, scenarios: ['scripted-bugfix', 'artifact-production'], reason: 'verification changes affect outcome-proof scenarios' },
  { pattern: /task-service|task-runner/, scenarios: ['artifact-production'], reason: 'task execution changes affect artifact production' }
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
