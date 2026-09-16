// tests/arch/workflow-contracts.test.ts
// Slice 1 verification: the workflow state contract (common/contracts/workflow.ts)
// is schema-only. These tests are the accept/reject tables for stage enum,
// versioning, artifact references and transition rules (adjacency, no skips,
// revision-reason). No runtime, routes, or authority are exercised — the
// contract is inert until the workflow service slice lands.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  WORKFLOW_PREDECESSOR,
  WORKFLOW_STATE_VERSION,
  WORKFLOW_SUCCESSOR,
  WorkflowArtifactRef,
  WorkflowStage,
  WorkflowState,
  WorkflowTransitionEvent,
  WorkflowTransitionRequest
} from '../../common/contracts/workflow.ts';

const UUID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
const SHA = 'a'.repeat(64);
const TS = '2026-09-15T00:00:00.000Z';

const artifactRef = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  artifact_id: UUID,
  artifact_type: 'EXPERIENCE_BRIEF',
  stage: 'DISCOVERY',
  path: '.aide/workflow/artifacts/brief.json',
  sha256: SHA,
  created_at: TS,
  verification_status: 'validated',
  ...overrides
});

const workflowState = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  version: WORKFLOW_STATE_VERSION,
  workflow_id: UUID,
  workspace: 'E:/work/example',
  project_id: 'example-project',
  stage: 'DISCOVERY',
  previous_stage: null,
  revision: 0,
  artifacts: [artifactRef()],
  last_transition_id: null,
  created_at: TS,
  updated_at: TS,
  ...overrides
});

const transitionRequest = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  workflow_id: UUID,
  from_stage: 'DISCOVERY',
  to_stage: 'ARCHITECTURE',
  kind: 'forward',
  requested_by: 'operator',
  evidence: [artifactRef()],
  ...overrides
});

const transitionEvent = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  type: 'workflow.transition',
  ts: TS,
  workflow_id: UUID,
  workspace: 'E:/work/example',
  sequence: 1,
  from_stage: 'DISCOVERY',
  to_stage: 'ARCHITECTURE',
  kind: 'forward',
  status: 'applied',
  reason: null,
  operation_id: UUID,
  actor_id: 'operator',
  gate: { result: 'satisfied', failed: [] },
  evidence: [{ artifact_id: UUID, artifact_type: 'EXPERIENCE_BRIEF', sha256: SHA }],
  error: null,
  ...overrides
});

test('workflow stage enum contains exactly the six stages in order', () => {
  assert.deepEqual([...WorkflowStage.options], [
    'DISCOVERY',
    'ARCHITECTURE',
    'DESIGN',
    'IMPLEMENTATION',
    'VALIDATION',
    'DEPLOYMENT'
  ]);
  assert.equal(WorkflowStage.safeParse('PLANNING').success, false);
  assert.equal(WorkflowStage.safeParse('discovery').success, false);
});

test('workflow graph: successor/predecessor maps mirror each other', () => {
  for (const stage of WorkflowStage.options) {
    const next = WORKFLOW_SUCCESSOR[stage];
    if (next !== null) assert.equal(WORKFLOW_PREDECESSOR[next], stage);
    const prev = WORKFLOW_PREDECESSOR[stage];
    if (prev !== null) assert.equal(WORKFLOW_SUCCESSOR[prev], stage);
  }
  assert.equal(WORKFLOW_SUCCESSOR.DEPLOYMENT, null);
  assert.equal(WORKFLOW_PREDECESSOR.DISCOVERY, null);
});

test('workflow state: version literal is 1 and a wrong version fails', () => {
  assert.equal(WORKFLOW_STATE_VERSION, 1);
  assert.equal(WorkflowState.safeParse(workflowState()).success, true);
  assert.equal(WorkflowState.safeParse(workflowState({ version: 2 })).success, false);
});

test('workflow state: strict object rejects unknown keys', () => {
  assert.equal(WorkflowState.safeParse(workflowState({ extra: true })).success, false);
});

test('workflow state: rejects non-uuid workflow_id, bad stage and negative revision', () => {
  assert.equal(WorkflowState.safeParse(workflowState({ workflow_id: 'not-a-uuid' })).success, false);
  assert.equal(WorkflowState.safeParse(workflowState({ stage: 'PLANNING' })).success, false);
  assert.equal(WorkflowState.safeParse(workflowState({ revision: -1 })).success, false);
});

test('workflow state: artifacts are capped at 64 references', () => {
  const refs = (count: number): Array<Record<string, unknown>> => Array.from({ length: count }, () => artifactRef());
  assert.equal(WorkflowState.safeParse(workflowState({ artifacts: refs(64) })).success, true);
  assert.equal(WorkflowState.safeParse(workflowState({ artifacts: refs(65) })).success, false);
});

test('artifact ref: accepts a valid reference', () => {
  assert.equal(WorkflowArtifactRef.safeParse(artifactRef()).success, true);
});

test('artifact ref: rejects bad sha256, status, type, stage and unknown keys', () => {
  assert.equal(WorkflowArtifactRef.safeParse(artifactRef({ sha256: 'abc' })).success, false);
  assert.equal(WorkflowArtifactRef.safeParse(artifactRef({ sha256: 'A'.repeat(64) })).success, false);
  assert.equal(WorkflowArtifactRef.safeParse(artifactRef({ verification_status: 'ok' })).success, false);
  assert.equal(WorkflowArtifactRef.safeParse(artifactRef({ artifact_type: 'DESIGN_DOC' })).success, false);
  assert.equal(WorkflowArtifactRef.safeParse(artifactRef({ stage: 3 })).success, false);
  assert.equal(WorkflowArtifactRef.safeParse(artifactRef({ extra: 1 })).success, false);
});

test('transition request: accepts a valid forward transition', () => {
  assert.equal(WorkflowTransitionRequest.safeParse(transitionRequest()).success, true);
});

test('transition request: forward skips are forbidden', () => {
  assert.equal(WorkflowTransitionRequest.safeParse(transitionRequest({ to_stage: 'DESIGN' })).success, false);
});

test('transition request: forward edges must follow the graph, not reverse it', () => {
  assert.equal(WorkflowTransitionRequest.safeParse(transitionRequest({ from_stage: 'ARCHITECTURE', to_stage: 'DISCOVERY' })).success, false);
});

test('transition request: no forward transition exists out of DEPLOYMENT', () => {
  assert.equal(WorkflowTransitionRequest.safeParse(transitionRequest({ from_stage: 'DEPLOYMENT', to_stage: 'DISCOVERY' })).success, false);
});

test('transition request: accepts a revision with a reason', () => {
  const revision = transitionRequest({
    from_stage: 'ARCHITECTURE',
    to_stage: 'DISCOVERY',
    kind: 'revision',
    reason: 'brief missed the conversion goal'
  });
  assert.equal(WorkflowTransitionRequest.safeParse(revision).success, true);
});

test('transition request: revision requires a reason', () => {
  const revision = transitionRequest({ from_stage: 'ARCHITECTURE', to_stage: 'DISCOVERY', kind: 'revision' });
  assert.equal(WorkflowTransitionRequest.safeParse(revision).success, false);
});

test('transition request: revisions move exactly one stage back', () => {
  const jump = transitionRequest({
    from_stage: 'VALIDATION',
    to_stage: 'ARCHITECTURE',
    kind: 'revision',
    reason: 'architecture invalidated by validation findings'
  });
  assert.equal(WorkflowTransitionRequest.safeParse(jump).success, false);
});

test('transition request: no revision exists out of DISCOVERY', () => {
  const revision = transitionRequest({
    from_stage: 'DISCOVERY',
    to_stage: 'ARCHITECTURE',
    kind: 'revision',
    reason: 'some reason for the revision'
  });
  assert.equal(WorkflowTransitionRequest.safeParse(revision).success, false);
});

test('transition request: rejects unknown kinds and unknown keys', () => {
  assert.equal(WorkflowTransitionRequest.safeParse(transitionRequest({ kind: 'rollback' })).success, false);
  assert.equal(WorkflowTransitionRequest.safeParse(transitionRequest({ extra: true })).success, false);
});

test('transition event: accepts applied, requested and rejected rows', () => {
  assert.equal(WorkflowTransitionEvent.safeParse(transitionEvent()).success, true);
  const requested = transitionEvent({ status: 'requested', operation_id: null, actor_id: 'agent-session' });
  assert.equal(WorkflowTransitionEvent.safeParse(requested).success, true);
  const rejected = transitionEvent({ status: 'rejected', operation_id: null, error: 'operator rejected the transition' });
  assert.equal(WorkflowTransitionEvent.safeParse(rejected).success, true);
});

test('transition event: rejects unknown status and wrong type literal', () => {
  assert.equal(WorkflowTransitionEvent.safeParse(transitionEvent({ status: 'approved' })).success, false);
  assert.equal(WorkflowTransitionEvent.safeParse(transitionEvent({ type: 'workflow.stage' })).success, false);
});

test('transition event: gate must be present and well formed', () => {
  const noGate = transitionEvent();
  delete noGate.gate;
  assert.equal(WorkflowTransitionEvent.safeParse(noGate).success, false);
  assert.equal(WorkflowTransitionEvent.safeParse(transitionEvent({ gate: { result: 'yes', failed: [] } })).success, false);
  assert.equal(WorkflowTransitionEvent.safeParse(transitionEvent({ gate: { result: 'unsatisfied', failed: ['missing:EXPERIENCE_BRIEF'] } })).success, true);
});

test('transition event: evidence entries are strict and digests are enforced', () => {
  assert.equal(WorkflowTransitionEvent.safeParse(transitionEvent({ evidence: [{ artifact_id: UUID, artifact_type: 'EXPERIENCE_BRIEF', sha256: SHA, extra: 1 }] })).success, false);
  assert.equal(WorkflowTransitionEvent.safeParse(transitionEvent({ evidence: [{ artifact_id: 'nope', artifact_type: 'EXPERIENCE_BRIEF', sha256: SHA }] })).success, false);
  assert.equal(WorkflowTransitionEvent.safeParse(transitionEvent({ evidence: [{ artifact_id: UUID, artifact_type: 'EXPERIENCE_BRIEF', sha256: 'zz' }] })).success, false);
});

test('transition event: strict object rejects unknown keys', () => {
  assert.equal(WorkflowTransitionEvent.safeParse(transitionEvent({ extra: true })).success, false);
});
