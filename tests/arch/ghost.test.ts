// tests/arch/ghost.test.ts
// Wave 8 — Ghost real-task certification: the read-only episode assembler over
// canonical stores (trajectory, verification, audit bus, egress journal,
// handoffs, continuation chains), the scenario certifier (PASS/FAIL + FIRST
// DIVERGENCE), projection-level secret redaction, and the conservative
// selective-regression selector. Deterministic seeds; no live worker.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { assembleEpisode, redactGhostText } from '../../node/src/services/ghost-episode.ts';
import { certifyEpisode, affectedScenarios, scenarioById, GHOST_SCENARIOS } from '../../node/src/services/ghost-certify.ts';
import type { GhostScenarioT } from '../../common/contracts/ghost.ts';

const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'aide-ghost-'));
const EPISODE = 'ghost-ep-1';
const WINDOW = { start: '2026-01-01T00:00:00.000Z', end: '2026-01-01T00:05:00.000Z' };
const FAKE_KEY = 'sk-ghosttest1234567890abcdef';
let episode: Awaited<ReturnType<typeof assembleEpisode>>;

async function writeJsonl(target: string, rows: Array<Record<string, unknown>>): Promise<void> {
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, rows.map(row => JSON.stringify(row)).join('\n') + '\n', 'utf8');
}

before(async () => {
  const aide = path.join(workspace, '.aide');
  await fs.mkdir(path.join(aide, 'trajectories'), { recursive: true });
  await fs.writeFile(path.join(aide, 'trajectories', `${EPISODE}.traj.json`), JSON.stringify({
    trajectory_format: 'aide-1', session_id: EPISODE,
    task: `fix the fixture bug (token ${FAKE_KEY})`, mode: 'act', outcome: 'error',
    iterations: 3, mistake_count: 3, error: 'aborted after 3 malformed steps',
    started_at: WINDOW.start, ended_at: WINDOW.end,
    transcript: [{ role: 'user', content: 'UNTRUSTED TRANSCRIPT MARKER' }],
    tool_log: [
      { tool: 'write_file', ok: true, output: 'wrote src/fix.mjs' },
      { tool: 'run_command', ok: false, output: 'ghost-missing-compiler-xyz: not found' }
    ]
  }, null, 2), 'utf8');
  await fs.mkdir(path.join(aide, 'verifications'), { recursive: true });
  await fs.writeFile(path.join(aide, 'verifications', `${EPISODE}.verification.json`), JSON.stringify({
    outcome: 'error',
    execution: { results: [{ name: 'write', passed: true }, { name: 'compile', passed: false }] },
    verification: { state: 'failed', passed: false, checks: [{ name: 'execution', state: 'failed', reason: 'step compile failed' }] }
  }, null, 2), 'utf8');
  await writeJsonl(path.join(aide, 'cipher-state.jsonl'), [
    { type: 'agent', session_id: EPISODE, chatSource: 'provider', mode: 'act', ts: '2026-01-01T00:00:01.000Z' },
    { type: 'agent.start', session_id: EPISODE, mode: 'act', chat_source: 'agent-loop', at: '2026-01-01T00:00:02.000Z' },
    { type: 'approval', session_id: EPISODE, decision: 'approved', tool: 'write_file', ts: '2026-01-01T00:01:00.000Z' },
    { type: 'authority', task_id: EPISODE, kind: 'agent.tool', decision: 'consumed', ts: '2026-01-01T00:01:05.000Z' },
    { type: 'authority', task_id: EPISODE, kind: 'agent.tool', decision: 'execution-succeeded', ts: '2026-01-01T00:01:06.000Z' },
    { type: 'agent', session_id: 'unrelated-session', chatSource: 'local', ts: '2026-01-01T00:01:30.000Z' }
  ]);
  await writeJsonl(path.join(aide, 'egress', 'journal.jsonl'), [
    { ts: '2026-01-01T00:02:00.000Z', action: 'codex-cli', provider_id: 'codex-cli', role: 'act' },
    { ts: '2026-01-01T00:02:30.000Z', action: 'opencode', provider_id: 'opencode', role: 'act', delegated_provider: 'opencode', delegated_model: 'sk-delegated1234567890abcdef' },
    { ts: '2026-01-01T01:00:00.000Z', action: 'codex-cli', provider_id: 'codex-cli', role: 'act' }
  ]);
  await fs.mkdir(path.join(aide, 'worker-handoffs'), { recursive: true });
  await fs.writeFile(path.join(aide, 'worker-handoffs', 'h-1.json'), JSON.stringify({
    handoff_id: 'h-1', task_id: EPISODE, created_at: '2026-01-01T00:00:30.000Z',
    accepted_at: '2026-01-01T00:00:40.000Z', consumed_at: '2026-01-01T00:00:50.000Z',
    state: 'CONSUMED',
    from: { role: 'planner', worker: 'cloud:openai:gpt-5' },
    to: { role: 'coder', worker: 'cloud:codex-cli:gpt-5-codex' },
    objective: 'fix the fixture bug',
    artifacts: [{ path: 'src/fix.mjs', sha256: 'a'.repeat(64) }]
  }, null, 2), 'utf8');
  await fs.mkdir(path.join(aide, 'continuations', 'chains'), { recursive: true });
  await fs.writeFile(path.join(aide, 'continuations', 'chains', 'c-1.json'), JSON.stringify({
    chain_id: 'c-1', root_task_id: EPISODE, state: 'ACTIVE', replacement_count: 0,
    last_decision: 'retry', terminal_reason: null, updated_at: '2026-01-01T00:04:00.000Z',
    attempts: [{
      session_id: EPISODE, worker: { worker: 'cloud:codex-cli:gpt-5-codex' },
      failure_class: 'PROVIDER_UNAVAILABLE', error_summary: `worker died (key ${FAKE_KEY})`,
      failed_at: '2026-01-01T00:03:00.000Z'
    }]
  }, null, 2), 'utf8');
  episode = await assembleEpisode({ workspace, episodeId: EPISODE });
});

function inlineScenario(checks: GhostScenarioT['checks'], expected: 'PASS' | 'FAIL' = 'PASS'): GhostScenarioT {
  return { scenario_id: 'unit-inline', version: 1, description: 'inline unit scenario', tags: ['unit'], checks, expected_status: expected, limitations: [] };
}

const harnessPass = {
  flags: { tests_passed: true, answer_matches: true },
  details: { tests_passed: 'exit 0', answer_matches: 'BUGLINE matched' },
  changed_files: ['src/fix.mjs'],
  evidence_refs: ['harness/unit.json']
};

test('assembler projects canonical events from every store', () => {
  const kinds = episode.events.map(event => event.kind);
  for (const expected of ['session.started', 'tool.result', 'tool.failed', 'session.error', 'verification.produced', 'verification.failed', 'worker.started', 'authority.granted', 'handoff.created', 'handoff.accepted', 'handoff.consumed', 'failure.classified', 'continuation.decided', 'egress.observed']) {
    assert.ok(kinds.includes(expected as (typeof kinds)[number]), `missing event kind ${expected}`);
  }
  assert.equal(episode.egress.length, 2, 'only in-window egress is attributed');
  const delegated = episode.egress.find(entry => entry.action === 'opencode');
  assert.equal(delegated?.delegated_provider, 'opencode');
  assert.equal(delegated?.delegated_model, '[REDACTED]', 'token-shaped delegated values are redacted at the projection boundary');
  assert.ok(episode.files.includes('src/fix.mjs'), 'write_file effect surfaces as a file');
  assert.equal(episode.artifacts[0]?.ref, 'src/fix.mjs');
  assert.equal(episode.artifacts[0]?.sha256, 'a'.repeat(64));
  assert.ok(episode.workers.some(worker => worker.includes('codex-cli')));
  assert.ok(episode.workers.includes('agent-loop:provider'), 'audit agent rows surface the chat source');
  assert.ok(episode.workers.includes('agent-loop:agent-loop'), 'audit agent.start rows surface the worker');
  assert.ok(episode.handoffs.includes('h-1'));
  assert.ok(episode.continuation_chains.includes('c-1'));
  assert.ok(episode.failures.some(failure => failure.classification === 'PROVIDER_UNAVAILABLE'));
  assert.ok(episode.claims.includes('outcome: error'));
  assert.ok(episode.verified_facts.includes('step write: passed'));
  assert.ok(!episode.verified_facts.some(fact => fact.includes('compile')), 'failed steps are never verified facts');
  assert.ok(episode.limitations.some(limitation => limitation.includes('transcript')));
  assert.ok(episode.limitations.some(limitation => limitation.includes('time-window')));
  assert.ok(episode.limitations.some(limitation => limitation.includes('not causally')));
  assert.ok(episode.events.some(event => event.kind === 'authority.consumed'), 'task_id-correlated authority rows join the episode');
  assert.ok(!episode.events.some(event => event.data?.decision === 'execution-succeeded'), 'lifecycle completions are not mislabeled as authority transitions');
  assert.equal(episode.verification?.state, 'failed');
  assert.ok(!episode.events.some(event => event.session_id === 'unrelated-session'), 'audit rows are session-correlated');
});

test('projection-level redaction removes secrets everywhere', () => {
  const serialized = JSON.stringify(episode);
  assert.ok(!serialized.includes(FAKE_KEY), 'seeded secret must never appear in the episode');
  assert.ok(serialized.includes('[REDACTED]'));
  assert.ok(!serialized.includes('UNTRUSTED TRANSCRIPT MARKER'), 'raw transcripts are never copied');
});

test('redactGhostText covers key patterns and truncation', () => {
  assert.ok(redactGhostText(`token ${FAKE_KEY}`).includes('[REDACTED]'));
  assert.ok(!redactGhostText(`token ${FAKE_KEY}`).includes(FAKE_KEY));
  assert.ok(redactGhostText('api_key = hunter2secret').includes('[REDACTED]'));
  assert.ok(redactGhostText('-----BEGIN RSA PRIVATE KEY-----\nabc\n-----END RSA PRIVATE KEY-----').includes('[REDACTED]'));
  const long = redactGhostText('x'.repeat(1200));
  assert.ok(long.length <= 600 && long.endsWith('\u2026'));
});

test('certifier passes a matching episode with harness evidence', () => {
  const scenario = inlineScenario([
    { kind: 'required_event', target: 'tool.failed', description: 'the failing tool ran' },
    { kind: 'required_event', target: 'egress.observed', description: 'egress captured' },
    { kind: 'harness_evidence', target: 'changed_files_present', description: 'files changed' },
    { kind: 'harness_evidence', target: 'tests_passed', description: 'tests pass' }
  ]);
  const result = certifyEpisode({ scenario, episode, harness: harnessPass, testedSha: 'c5d3034', durationMs: 1234 });
  assert.equal(result.status, 'PASS');
  assert.equal(result.expected_status, 'PASS');
  assert.equal(result.agreement, true);
  assert.equal(result.first_divergence, null);
  assert.ok(result.checks.every(check => check.status === 'PASS'));
  assert.equal(result.tested_sha, 'c5d3034');
  assert.equal(result.workers.length > 0, true);
});

test('certifier fails on harness evidence with a useful first divergence', () => {
  const scenario = inlineScenario([
    { kind: 'required_event', target: 'tool.failed', description: 'the failing tool ran' },
    { kind: 'harness_evidence', target: 'tests_passed', description: 'tests pass' }
  ]);
  const result = certifyEpisode({
    scenario, episode,
    harness: { ...harnessPass, flags: { ...harnessPass.flags, tests_passed: false }, details: { ...harnessPass.details, tests_passed: 'exit 1; fail 2' } },
    testedSha: null, durationMs: 10
  });
  assert.equal(result.status, 'FAIL');
  assert.equal(result.agreement, false);
  assert.ok(result.first_divergence);
  assert.equal(result.first_divergence?.check_index, 1);
  assert.equal(result.first_divergence?.expected, 'tests pass');
  assert.ok(result.first_divergence?.observed.includes('exit 1'));
  assert.equal(result.first_divergence?.likely_boundary, 'worker effect -> canonical verification');
  assert.ok(result.first_divergence?.last_verified_event);
});

test('expected-failure scenarios agree when they fail', () => {
  const scenario = inlineScenario([
    { kind: 'required_event', target: 'session.done', description: 'session completed' }
  ], 'FAIL');
  const result = certifyEpisode({ scenario, episode, harness: harnessPass, testedSha: null, durationMs: 10 });
  assert.equal(result.status, 'FAIL');
  assert.equal(result.expected_status, 'FAIL');
  assert.equal(result.agreement, true);
});

test('unknown harness evidence targets fail closed', () => {
  const scenario = inlineScenario([
    { kind: 'harness_evidence', target: 'not_a_flag', description: 'unknown evidence' }
  ]);
  const result = certifyEpisode({ scenario, episode, harness: harnessPass, testedSha: null, durationMs: 10 });
  assert.equal(result.status, 'FAIL');
  assert.ok(result.first_divergence?.observed.includes('unknown harness evidence'));
});

test('certifier fails on a missing required event with boundary classification', () => {
  const scenario = inlineScenario([
    { kind: 'required_event', target: 'session.done', description: 'session completed' }
  ]);
  const result = certifyEpisode({ scenario, episode, harness: harnessPass, testedSha: null, durationMs: 10 });
  assert.equal(result.status, 'FAIL');
  assert.equal(result.first_divergence?.check_index, 0);
  assert.equal(result.first_divergence?.observed, 'session.done not observed');
  assert.equal(result.first_divergence?.likely_boundary, 'episode observation boundary');
});

test('selective regression is conservative when a file is unmapped', () => {
  const mapped = affectedScenarios(['node/src/services/subscription-transports.ts']);
  assert.equal(mapped.conservative, false);
  assert.ok(mapped.selected.includes('codex-bugfix'));
  assert.ok(mapped.selected.includes('codex-analysis'));
  const continuity = affectedScenarios(['node/src/services/continuation-manager.ts']);
  assert.ok(continuity.selected.includes('continuation-handoff'));
  assert.ok(continuity.selected.includes('restart-continuity'));
  const unknown = affectedScenarios(['src/brand-new-area/widget.tsx']);
  assert.equal(unknown.conservative, true);
  assert.deepEqual(unknown.selected.sort(), GHOST_SCENARIOS.map(scenario => scenario.scenario_id).sort());
  const empty = affectedScenarios([]);
  assert.deepEqual(empty.selected, []);
});

test('scenario registry is well formed', () => {
  const ids = GHOST_SCENARIOS.map(scenario => scenario.scenario_id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(ids.length, 9);
  for (const scenario of GHOST_SCENARIOS) {
    assert.ok(scenario.checks.length > 0);
    assert.ok(scenario.expected_status === 'PASS' || scenario.expected_status === 'FAIL');
    for (const check of scenario.checks) assert.ok(check.description.length > 4);
  }
  assert.equal(scenarioById('codex-bugfix')?.expected_status, 'FAIL');
  assert.equal(scenarioById('scripted-bugfix')?.expected_status, 'PASS');
  assert.equal(scenarioById('nope'), null);
});
