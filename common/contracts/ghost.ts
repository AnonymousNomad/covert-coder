// Ghost Code contracts (Wave 8): canonical observable-execution episodes,
// real-task scenarios, and machine-readable certification results. Ghost is a
// PROJECTION over existing canonical stores (trajectories, verifications,
// audit bus, egress journal, handoffs, continuations) — it never invents a
// second identity universe, never records hidden reasoning, and never promotes
// worker claims to verified facts.
import { z } from 'zod';

export const GhostEventKind = z.enum([
  'session.started', 'session.done', 'session.error', 'session.aborted',
  'worker.started', 'worker.completed', 'worker.failed', 'worker.replaced',
  'handoff.created', 'handoff.accepted', 'handoff.consumed', 'handoff.failed', 'handoff.cancelled',
  'authority.requested', 'authority.granted', 'authority.denied', 'authority.consumed',
  'tool.called', 'tool.result', 'tool.failed',
  'process.started', 'process.exited', 'process.timeout', 'process.cancelled',
  'file.changed',
  'egress.observed',
  'verification.produced', 'verification.passed', 'verification.failed', 'verification.incomplete',
  'artifact.produced',
  'failure.classified', 'continuation.decided'
]);
export type GhostEventKindT = z.infer<typeof GhostEventKind>;

export const GhostEventSource = z.enum(['trajectory', 'verification', 'audit', 'egress', 'handoff', 'continuation']);

export const GhostEvent = z.strictObject({
  event_id: z.string().min(1).max(240),
  kind: GhostEventKind,
  at: z.string().max(40),
  source: GhostEventSource,
  task_id: z.string().max(200).nullable(),
  session_id: z.string().max(200).nullable(),
  worker: z.string().max(200).nullable(),
  causal: z.strictObject({
    parent_event_id: z.string().max(240).nullable(),
    operation_id: z.string().max(200).nullable(),
    handoff_id: z.string().max(200).nullable(),
    verification_id: z.string().max(200).nullable()
  }),
  summary: z.string().max(600),
  data: z.record(z.string(), z.unknown())
});
export type GhostEventT = z.infer<typeof GhostEvent>;

export const GhostEpisode = z.strictObject({
  episode_id: z.string().min(1).max(200),
  workspace: z.string().max(1000),
  task: z.string().max(2000).nullable(),
  outcome: z.string().max(60).nullable(),
  started_at: z.string().max(40).nullable(),
  ended_at: z.string().max(40).nullable(),
  events: z.array(GhostEvent).max(4000),
  workers: z.array(z.string().max(200)).max(32),
  handoffs: z.array(z.string().max(200)).max(64),
  continuation_chains: z.array(z.string().max(200)).max(32),
  egress: z.array(z.strictObject({
    action: z.string().max(80),
    provider_id: z.string().max(120).nullable(),
    role: z.string().max(40).nullable(),
    at: z.string().max(40),
    // Recorded only when the bridge authoritatively returns the delegated
    // provider/model (e.g. OpenCode message payload). Never inferred.
    delegated_provider: z.string().max(120).nullable().optional(),
    delegated_model: z.string().max(200).nullable().optional()
  })).max(200),
  files: z.array(z.string().max(500)).max(200),
  artifacts: z.array(z.strictObject({ ref: z.string().max(500), sha256: z.string().max(128).nullable() })).max(64),
  verification: z.strictObject({
    state: z.string().max(60).nullable(),
    passed: z.boolean().nullable(),
    checks: z.array(z.strictObject({ name: z.string().max(120), state: z.string().max(60), reason: z.string().max(400) })).max(32)
  }).nullable(),
  failures: z.array(z.strictObject({
    classification: z.string().max(80),
    summary: z.string().max(400),
    at: z.string().max(40)
  })).max(16),
  claims: z.array(z.string().max(600)).max(32),
  verified_facts: z.array(z.string().max(600)).max(32),
  limitations: z.array(z.string().max(300)).max(24)
});
export type GhostEpisodeT = z.infer<typeof GhostEpisode>;

export const GhostCheckKind = z.enum([
  'required_event', 'forbidden_event', 'required_file', 'forbidden_egress', 'verification_check', 'artifact_required', 'harness_evidence'
]);

export const GhostScenarioCheck = z.strictObject({
  kind: GhostCheckKind,
  target: z.string().min(1).max(300),
  description: z.string().max(300)
});
export type GhostScenarioCheckT = z.infer<typeof GhostScenarioCheck>;

export const GhostScenario = z.strictObject({
  scenario_id: z.string().min(1).max(120),
  version: z.number().int().gte(1),
  description: z.string().max(600),
  tags: z.array(z.string().max(60)).max(24),
  checks: z.array(GhostScenarioCheck).min(1).max(64),
  // Some scenarios certify environment truth rather than product health
  // (e.g. a worker sandbox that is known-broken on this box): the expected
  // outcome is declared up front so agreement is measured, not assumed.
  expected_status: z.enum(['PASS', 'FAIL']),
  limitations: z.array(z.string().max(300)).max(16)
});
export type GhostScenarioT = z.infer<typeof GhostScenario>;

export const GhostDivergence = z.strictObject({
  expected: z.string().max(400),
  observed: z.string().max(400),
  last_verified_event: z.string().max(400).nullable(),
  likely_boundary: z.string().max(200),
  check_index: z.number().int().gte(0)
});
export type GhostDivergenceT = z.infer<typeof GhostDivergence>;

export const GhostCertificationResult = z.strictObject({
  scenario_id: z.string().max(120),
  scenario_version: z.number().int().gte(1),
  episode_id: z.string().max(200),
  tested_sha: z.string().max(64).nullable(),
  status: z.enum(['PASS', 'FAIL', 'BLOCKED']),
  expected_status: z.enum(['PASS', 'FAIL']),
  agreement: z.boolean(),
  first_divergence: GhostDivergence.nullable(),
  checks: z.array(z.strictObject({
    check: GhostScenarioCheck,
    status: z.enum(['PASS', 'FAIL', 'SKIP']),
    detail: z.string().max(400)
  })).max(64),
  workers: z.array(z.string().max(200)).max(32),
  handoffs: z.array(z.string().max(200)).max(64),
  egress: z.number().int().gte(0),
  files: z.array(z.string().max(500)).max(200),
  artifacts: z.array(z.string().max(500)).max(64),
  verification: z.string().max(120).nullable(),
  duration_ms: z.number().int().gte(0),
  evidence_refs: z.array(z.string().max(500)).max(32),
  limitations: z.array(z.string().max(300)).max(24),
  produced_at: z.string().max(40)
});
export type GhostCertificationResultT = z.infer<typeof GhostCertificationResult>;
