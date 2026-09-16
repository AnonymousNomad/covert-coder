// tests/arch/workflow-service.test.ts
// Slices 4-6 verification: the workflow service is a deterministic state
// engine over .aide/workflow/state.json whose transition gates are
// validator-backed (file existence, sha256 integrity, per-type content
// contracts, dependency presence, Veritas evidence lookup). Mutations require
// a live operator-approved execution handle; approval can never bypass the
// deterministic gates; rejected transitions are journaled with their reasons;
// and the progression skeleton can be rebuilt from audit rows alone. No model
// calls, no routes, no artifact generation.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { randomUUID } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { createExecutionAuthority } from '../../node/src/services/execution-authority.mjs';
import { createAuditTrail } from '../../node/src/services/audit-trail.mjs';
import { createWorkflowService } from '../../node/src/services/workflow-service.ts';
import { briefContent, validContentFor, writeArtifact, writeVerification } from './workflow-fixtures.ts';
import type { ExecutionHandle } from '../../node/src/services/execution-authority.mjs';
import type {
  WorkflowArtifactRefT,
  WorkflowStageT,
  WorkflowStateT,
  WorkflowTransitionRequestT
} from '../../common/contracts/workflow.ts';

const workspaces: string[] = [];

after(async () => {
  for (const workspace of workspaces) {
    for (let attempt = 0; attempt < 10; attempt++) {
      try {
        await fs.rm(workspace, { recursive: true, force: true });
        break;
      } catch (error) {
        if (!['EBUSY', 'ENOTEMPTY', 'EPERM'].includes((error as NodeJS.ErrnoException).code ?? '')) throw error;
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  }
});

async function setup() {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'aide-workflow-service-'));
  workspaces.push(workspace);
  const authority = createExecutionAuthority({
    workspace,
    clock: () => 1000,
    sessionTtlMs: 60_000,
    operationTtlMs: 60_000,
    record: async () => ({ persisted: true })
  });
  const origin = 'http://127.0.0.1:4173';
  const paired = await authority.pair(authority.control.createPairing(origin), origin);
  const owner = authority.authenticate(paired.token, origin);
  const audit = createAuditTrail({ workspace });
  const service = createWorkflowService({ workspace, authority, audit });
  return { workspace, authority, owner, audit, service };
}

type Env = Awaited<ReturnType<typeof setup>>;

async function runApproved<T>(env: Env, kind: string, payload: unknown, executor: (execution: ExecutionHandle) => T | Promise<T>): Promise<T> {
  const input = { workspace: env.workspace, taskId: 'task-workflow', kind, args: { body: payload } };
  const op = await env.authority.prepare(env.owner, input);
  assert.equal(op.state, 'pending', `${kind} must require operator approval`);
  await env.authority.decide(env.owner, op.operation_id, 'approve');
  return env.authority.execute(env.owner, op.operation_id, input, (_operation, execution) => executor(execution));
}

async function createWorkflow(env: Env, projectId = 'demo-project'): Promise<WorkflowStateT> {
  return runApproved(env, 'workflow.create', { project_id: projectId }, execution => env.service.create(execution, { project_id: projectId }));
}

async function applyRequest(env: Env, request: WorkflowTransitionRequestT): Promise<WorkflowStateT> {
  return runApproved(env, 'workflow.transition', request, execution => env.service.applyTransition(execution, request));
}

function buildForward(env: Env, state: WorkflowStateT, to: WorkflowStageT, evidence: WorkflowArtifactRefT[]): WorkflowTransitionRequestT {
  const built = env.service.buildTransitionRequest(state, { to_stage: to, kind: 'forward', requested_by: 'operator', evidence });
  assert.equal(built.ok, true, `build forward transition to ${to}`);
  if (!built.ok) throw new Error('unreachable');
  return built.request;
}

async function advance(env: Env, state: WorkflowStateT, to: WorkflowStageT, evidence: WorkflowArtifactRefT[]): Promise<WorkflowStateT> {
  return applyRequest(env, buildForward(env, state, to, evidence));
}

async function advanceToValidation(env: Env) {
  let state = await createWorkflow(env);
  const brief = await writeArtifact(env.workspace, 'EXPERIENCE_BRIEF', validContentFor('EXPERIENCE_BRIEF'));
  const blueprint = await writeArtifact(env.workspace, 'EXPERIENCE_BLUEPRINT', validContentFor('EXPERIENCE_BLUEPRINT'));
  const visual = await writeArtifact(env.workspace, 'VISUAL_SYSTEM', validContentFor('VISUAL_SYSTEM'));
  const interaction = await writeArtifact(env.workspace, 'INTERACTION_PLAN', validContentFor('INTERACTION_PLAN'));
  const implementation = await writeArtifact(env.workspace, 'IMPLEMENTATION_BLUEPRINT', validContentFor('IMPLEMENTATION_BLUEPRINT'));
  state = await advance(env, state, 'ARCHITECTURE', [brief]);
  state = await advance(env, state, 'DESIGN', [blueprint]);
  state = await advance(env, state, 'IMPLEMENTATION', [visual, interaction]);
  state = await advance(env, state, 'VALIDATION', [implementation]);
  return { state, brief, blueprint, visual, interaction, implementation };
}

async function reviseBack(env: Env, state: WorkflowStateT, to: WorkflowStageT): Promise<WorkflowStateT> {
  const built = env.service.buildTransitionRequest(state, {
    to_stage: to,
    kind: 'revision',
    reason: 'validation found a broken component boundary',
    requested_by: 'operator',
    evidence: []
  });
  assert.equal(built.ok, true);
  if (!built.ok) throw new Error('unreachable');
  return applyRequest(env, built.request);
}

test('create owns .aide/workflow/state.json; load validates and corrupt state fails closed', async () => {
  const env = await setup();
  assert.equal(await env.service.load(), null);
  const state = await createWorkflow(env);
  assert.equal(state.stage, 'DISCOVERY');
  assert.equal(state.revision, 0);
  assert.equal(state.workspace, env.workspace);
  const loaded = await env.service.load();
  assert.ok(loaded);
  assert.equal(loaded.workflow_id, state.workflow_id);
  const file = path.join(env.workspace, '.aide', 'workflow', 'state.json');
  assert.equal((await fs.stat(file)).isFile(), true);
  await assert.rejects(createWorkflow(env), { code: 'EXISTS' });
  await fs.writeFile(file, '{not json', 'utf8');
  await assert.rejects(env.service.load(), { code: 'CORRUPT' });
});

test('a valid artifact allows the transition and journals an applied row', async () => {
  const env = await setup();
  const created = await createWorkflow(env);
  const brief = await writeArtifact(env.workspace, 'EXPERIENCE_BRIEF', validContentFor('EXPERIENCE_BRIEF'));
  const request = buildForward(env, created, 'ARCHITECTURE', [brief]);
  assert.deepEqual(await env.service.evaluateTransition(created, request), { result: 'satisfied', failed: [] });
  const next = await applyRequest(env, request);
  assert.equal(next.stage, 'ARCHITECTURE');
  assert.equal(next.previous_stage, 'DISCOVERY');
  assert.equal(next.revision, 1);
  assert.ok(typeof next.last_transition_id === 'string');
  assert.equal(next.artifacts.length, 1);
  assert.equal(next.artifacts[0]?.artifact_id, brief.artifact_id);
  const loaded = await env.service.load();
  assert.equal(loaded?.stage, 'ARCHITECTURE');
  const rows = await env.audit.readEvents({ type: 'workflow.transition' });
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.status, 'applied');
  assert.equal(rows[0]?.sequence, 1);
  assert.equal(rows[0]?.from_stage, 'DISCOVERY');
  assert.equal(rows[0]?.to_stage, 'ARCHITECTURE');
});

test('skipped stages are rejected at build time and nothing mutates', async () => {
  const env = await setup();
  const created = await createWorkflow(env);
  const built = env.service.buildTransitionRequest(created, {
    to_stage: 'DESIGN',
    kind: 'forward',
    requested_by: 'operator',
    evidence: []
  });
  assert.equal(built.ok, false);
  if (built.ok) return;
  assert.ok(built.failed.some(entry => entry.includes('to_stage')));
  assert.equal((await env.service.load())?.revision, 0);
  assert.equal((await env.audit.readEvents({ type: 'workflow.transition' })).length, 0);
});

test('invalid artifact content blocks the transition and records the rejection reason', async () => {
  const env = await setup();
  const created = await createWorkflow(env);
  const malformed = briefContent();
  delete malformed.anti_audience;
  const ref = await writeArtifact(env.workspace, 'EXPERIENCE_BRIEF', malformed);
  const request = buildForward(env, created, 'ARCHITECTURE', [ref]);
  assert.deepEqual(await env.service.evaluateTransition(created, request), { result: 'unsatisfied', failed: ['content:EXPERIENCE_BRIEF'] });
  const statePath = path.join(env.workspace, '.aide', 'workflow', 'state.json');
  const before = await fs.readFile(statePath);
  await assert.rejects(applyRequest(env, request), { code: 'GATE_UNSATISFIED' });
  assert.deepEqual(await fs.readFile(statePath), before);
  const loaded = await env.service.load();
  assert.equal(loaded?.revision, 0);
  assert.equal(loaded?.stage, 'DISCOVERY');
  const rows = await env.audit.readEvents({ type: 'workflow.transition' });
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.status, 'rejected');
  const gate = rows[0]?.gate as { result?: string; failed?: string[] } | undefined;
  assert.equal(gate?.result, 'unsatisfied');
  assert.deepEqual(gate?.failed, ['content:EXPERIENCE_BRIEF']);
  assert.ok(String(rows[0]?.error).includes('content:EXPERIENCE_BRIEF'));
});

test('ref-level failures reject the gate with exact reasons', async () => {
  const env = await setup();
  const created = await createWorkflow(env);
  const validFile = await writeArtifact(env.workspace, 'EXPERIENCE_BRIEF', validContentFor('EXPERIENCE_BRIEF'));
  const cases: Array<[string, WorkflowArtifactRefT[], string]> = [
    ['missing', [], 'missing:EXPERIENCE_BRIEF'],
    ['wrong-stage', [{ ...validFile, stage: 'ARCHITECTURE' }], 'wrong_stage:EXPERIENCE_BRIEF'],
    ['invalid-status', [{ ...validFile, verification_status: 'invalid' }], 'invalid:EXPERIENCE_BRIEF'],
    ['stale', [{ ...validFile, verification_status: 'stale' }], 'stale:EXPERIENCE_BRIEF']
  ];
  for (const [label, evidence, expected] of cases) {
    const request = buildForward(env, created, 'ARCHITECTURE', evidence);
    assert.deepEqual(await env.service.evaluateTransition(created, request), { result: 'unsatisfied', failed: [expected] }, label);
  }
});

test('checksum mismatch blocks the transition', async () => {
  const env = await setup();
  const created = await createWorkflow(env);
  const ref = await writeArtifact(env.workspace, 'EXPERIENCE_BRIEF', validContentFor('EXPERIENCE_BRIEF'), { sha256: 'f'.repeat(64) });
  const request = buildForward(env, created, 'ARCHITECTURE', [ref]);
  assert.deepEqual(await env.service.evaluateTransition(created, request), { result: 'unsatisfied', failed: ['checksum:EXPERIENCE_BRIEF'] });
  await assert.rejects(applyRequest(env, request), { code: 'GATE_UNSATISFIED' });
  assert.equal((await env.service.load())?.revision, 0);
  const rejected = (await env.audit.readEvents({ type: 'workflow.transition' })).filter(row => row.status === 'rejected');
  assert.equal(rejected.length, 1);
  const gate = rejected[0]?.gate as { failed?: string[] } | undefined;
  assert.deepEqual(gate?.failed, ['checksum:EXPERIENCE_BRIEF']);
});

test('revision moves one stage back and stales the invalidated outputs', async () => {
  const env = await setup();
  const built = await advanceToValidation(env);
  const revised = await reviseBack(env, built.state, 'IMPLEMENTATION');
  assert.equal(revised.stage, 'IMPLEMENTATION');
  assert.equal(revised.previous_stage, 'VALIDATION');
  assert.equal(revised.revision, 5);
  const statusById = new Map(revised.artifacts.map(ref => [ref.artifact_id, ref.verification_status]));
  assert.equal(statusById.get(built.implementation.artifact_id), 'stale');
  assert.equal(statusById.get(built.visual.artifact_id), 'validated');
  assert.equal(statusById.get(built.interaction.artifact_id), 'validated');
  assert.equal(statusById.get(built.blueprint.artifact_id), 'validated');
  assert.equal(statusById.get(built.brief.artifact_id), 'validated');
  const rows = await env.audit.readEvents({ type: 'workflow.transition' });
  assert.equal(rows.filter(row => row.status === 'applied' && row.kind === 'revision').length, 1);
});

test('stale artifacts block forward progress until re-produced', async () => {
  const env = await setup();
  const built = await advanceToValidation(env);
  const revised = await reviseBack(env, built.state, 'IMPLEMENTATION');
  const staleImplementation = revised.artifacts.find(ref => ref.artifact_type === 'IMPLEMENTATION_BLUEPRINT');
  assert.ok(staleImplementation);
  assert.equal(staleImplementation.verification_status, 'stale');
  const blocked = buildForward(env, revised, 'VALIDATION', [staleImplementation]);
  assert.deepEqual(await env.service.evaluateTransition(revised, blocked), { result: 'unsatisfied', failed: ['stale:IMPLEMENTATION_BLUEPRINT'] });
  await assert.rejects(applyRequest(env, blocked), { code: 'GATE_UNSATISFIED' });
  assert.equal((await env.service.load())?.stage, 'IMPLEMENTATION');
  const reimplementation = await writeArtifact(env.workspace, 'IMPLEMENTATION_BLUEPRINT', validContentFor('IMPLEMENTATION_BLUEPRINT'));
  const recovered = buildForward(env, revised, 'VALIDATION', [reimplementation]);
  assert.deepEqual(await env.service.evaluateTransition(revised, recovered), { result: 'satisfied', failed: [] });
  assert.equal((await applyRequest(env, recovered)).stage, 'VALIDATION');
});

test('failed Veritas evidence blocks the release transition until the record is not failed', async () => {
  const env = await setup();
  const built = await advanceToValidation(env);
  const sessionId = randomUUID();
  await writeVerification(env.workspace, sessionId, { outcome: 'error', verification: { execution: 'failed', state: 'failed' } });
  const release = await writeArtifact(env.workspace, 'RELEASE_EVIDENCE', validContentFor('RELEASE_EVIDENCE', sessionId));
  const request = buildForward(env, built.state, 'DEPLOYMENT', [release]);
  assert.deepEqual(await env.service.evaluateTransition(built.state, request), { result: 'unsatisfied', failed: ['veritas_failed:RELEASE_EVIDENCE'] });
  await assert.rejects(applyRequest(env, request), { code: 'GATE_UNSATISFIED' });
  assert.equal((await env.service.load())?.stage, 'VALIDATION');
  const rejected = (await env.audit.readEvents({ type: 'workflow.transition' })).filter(row => row.status === 'rejected');
  assert.equal(rejected.length, 1);
  const gate = rejected[0]?.gate as { failed?: string[] } | undefined;
  assert.deepEqual(gate?.failed, ['veritas_failed:RELEASE_EVIDENCE']);
  await writeVerification(env.workspace, sessionId, { outcome: 'done', verification: { execution: 'succeeded', state: 'unavailable' } });
  assert.deepEqual(await env.service.evaluateTransition(built.state, request), { result: 'satisfied', failed: [] });
  assert.equal((await applyRequest(env, request)).stage, 'DEPLOYMENT');
});

test('operator approval cannot bypass the deterministic gate', async () => {
  const env = await setup();
  const created = await createWorkflow(env);
  const brief = await writeArtifact(env.workspace, 'EXPERIENCE_BRIEF', validContentFor('EXPERIENCE_BRIEF'));
  const request = buildForward(env, created, 'ARCHITECTURE', [brief]);
  assert.deepEqual(await env.service.evaluateTransition(created, request), { result: 'satisfied', failed: [] });
  const input = { workspace: env.workspace, taskId: 'task-workflow', kind: 'workflow.transition', args: { body: request } };
  const op = await env.authority.prepare(env.owner, input);
  await env.authority.decide(env.owner, op.operation_id, 'approve');
  // The artifact is tampered with AFTER approval; the gate must still block.
  await fs.writeFile(path.join(env.workspace, brief.path), JSON.stringify(briefContent({ anti_audience: 'tampered' }), null, 2), 'utf8');
  await assert.rejects(
    env.authority.execute(env.owner, op.operation_id, input, (_operation, execution) => env.service.applyTransition(execution, request)),
    { code: 'GATE_UNSATISFIED' }
  );
  const loaded = await env.service.load();
  assert.equal(loaded?.revision, 0);
  assert.equal(loaded?.stage, 'DISCOVERY');
  const rejected = (await env.audit.readEvents({ type: 'workflow.transition' })).filter(row => row.status === 'rejected');
  assert.equal(rejected.length, 1);
  const gate = rejected[0]?.gate as { result?: string; failed?: string[] } | undefined;
  assert.equal(gate?.result, 'unsatisfied');
  assert.ok(gate?.failed?.includes('checksum:EXPERIENCE_BRIEF'));
  assert.equal(rejected[0]?.operation_id, op.operation_id);
});

test('a transition built against stale state is rejected without mutation', async () => {
  const env = await setup();
  const created = await createWorkflow(env);
  const brief = await writeArtifact(env.workspace, 'EXPERIENCE_BRIEF', validContentFor('EXPERIENCE_BRIEF'));
  const first = buildForward(env, created, 'ARCHITECTURE', [brief]);
  const second = buildForward(env, created, 'ARCHITECTURE', [brief]);
  await applyRequest(env, first);
  await assert.rejects(applyRequest(env, second), { code: 'CONFLICT' });
  const loaded = await env.service.load();
  assert.equal(loaded?.revision, 1);
  assert.equal(loaded?.stage, 'ARCHITECTURE');
  assert.equal((await env.audit.readEvents({ type: 'workflow.transition' })).length, 1);
});

test('state progression can be rebuilt from audit events alone', async () => {
  const env = await setup();
  let state = await createWorkflow(env);
  state = await advance(env, state, 'ARCHITECTURE', [await writeArtifact(env.workspace, 'EXPERIENCE_BRIEF', validContentFor('EXPERIENCE_BRIEF'))]);
  state = await advance(env, state, 'DESIGN', [await writeArtifact(env.workspace, 'EXPERIENCE_BLUEPRINT', validContentFor('EXPERIENCE_BLUEPRINT'))]);
  const rebuilt = await env.service.rebuildFromAudit(state.workflow_id);
  assert.ok(rebuilt);
  assert.deepEqual(rebuilt, {
    workflow_id: state.workflow_id,
    workspace: state.workspace,
    stage: state.stage,
    previous_stage: state.previous_stage,
    revision: state.revision,
    last_transition_id: state.last_transition_id
  });
  await fs.rm(path.join(env.workspace, '.aide', 'workflow', 'state.json'));
  assert.equal(await env.service.load(), null);
  assert.deepEqual(await env.service.rebuildFromAudit(state.workflow_id), rebuilt);
});
