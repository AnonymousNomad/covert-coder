// tests/arch/workflow-authority.test.ts
// Slice 3 verification: workflow operations are enrolled in the Execution
// Authority policy with exact risk classes, and the workflow boundary holds
// structurally — a service actor may request workflow operations and apply
// them after operator approval, but can never approve, never acquire
// decision/grant scope, and never execute a payload other than the approved
// one. The authority engine is unchanged; this file proves the enrollment.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createExecutionAuthority } from '../../node/src/services/execution-authority.mjs';
import { normalizeOperation, OPERATION_POLICY } from '../../common/security/operation-policy.mjs';
import type { OperationInput } from '../../common/security/operation-policy.mjs';

async function fixture() {
  const authority = createExecutionAuthority({
    workspace: 'workspace-1',
    clock: () => 1000,
    sessionTtlMs: 1000,
    operationTtlMs: 100,
    record: async () => ({ persisted: true })
  });
  const origin = 'http://127.0.0.1:4173';
  const paired = await authority.pair(authority.control.createPairing(origin), origin);
  const owner = authority.authenticate(paired.token, origin);
  return { authority, owner };
}

const workflowInput = (kind: string, args: Record<string, unknown> = {}): OperationInput => ({
  workspace: 'workspace-1',
  taskId: 'task-workflow',
  kind,
  args
});

test('workflow operations are enrolled with exact risk classes', () => {
  assert.equal(OPERATION_POLICY['workflow.read'], 'read');
  assert.equal(OPERATION_POLICY['workflow.create'], 'write');
  assert.equal(OPERATION_POLICY['workflow.transition'], 'write');
  const normalized = normalizeOperation(workflowInput('workflow.transition', { workflow_id: 'w1', to_stage: 'ARCHITECTURE' }));
  assert.equal(normalized.risk, 'write');
  assert.ok(Object.isFrozen(normalized) && Object.isFrozen(normalized.args));
});

test('workflow.read is auto-approved and single-use', async () => {
  const f = await fixture();
  const input = workflowInput('workflow.read', { workflow_id: 'w1' });
  const op = await f.authority.prepare(f.owner, input);
  assert.equal(op.state, 'approved');
  assert.equal(await f.authority.execute(f.owner, op.operation_id, input, () => 'state'), 'state');
  await assert.rejects(f.authority.execute(f.owner, op.operation_id, input, () => 'again'), { code: 'CONFLICT' });
});

test('workflow.create and workflow.transition stay pending until the operator approves', async () => {
  for (const kind of ['workflow.create', 'workflow.transition'] as const) {
    const f = await fixture();
    const input = workflowInput(kind, { workflow_id: 'w1' });
    const op = await f.authority.prepare(f.owner, input);
    assert.equal(op.state, 'pending', kind);
    let mutations = 0;
    await assert.rejects(f.authority.execute(f.owner, op.operation_id, input, () => mutations++), { code: 'CONFLICT' });
    assert.equal(mutations, 0);
    await f.authority.decide(f.owner, op.operation_id, 'approve');
    assert.equal(await f.authority.execute(f.owner, op.operation_id, input, () => { mutations += 1; return 'applied'; }), 'applied');
    assert.equal(mutations, 1);
    await assert.rejects(f.authority.execute(f.owner, op.operation_id, input, () => mutations++), { code: 'CONFLICT' });
    assert.equal(mutations, 1);
  }
});

test('a workflow service actor can request and apply but never approve', async () => {
  const f = await fixture();
  const router = f.authority.control.delegate(f.owner, 'service', ['workflow.read', 'workflow.transition']);
  const input = workflowInput('workflow.transition', { workflow_id: 'w1', to_stage: 'ARCHITECTURE' });
  const op = await f.authority.prepare(router, input);
  assert.equal(op.state, 'pending');
  await assert.rejects(f.authority.decide(router, op.operation_id, 'approve'), { code: 'FORBIDDEN' });
  await f.authority.decide(f.owner, op.operation_id, 'approve');
  assert.equal(await f.authority.execute(router, op.operation_id, input, () => 'applied'), 'applied');
});

test('decision and grant scopes can never be delegated to a workflow actor', async () => {
  const f = await fixture();
  assert.throws(() => f.authority.control.delegate(f.owner, 'service', ['workflow.decision']), { code: 'FORBIDDEN' });
  assert.throws(() => f.authority.control.delegate(f.owner, 'service', ['workflow.grants']), { code: 'FORBIDDEN' });
});

test('a read-scoped workflow actor cannot prepare a transition', async () => {
  const f = await fixture();
  const reader = f.authority.control.delegate(f.owner, 'service', ['workflow.read']);
  await assert.rejects(f.authority.prepare(reader, workflowInput('workflow.transition', { workflow_id: 'w1' })), { code: 'FORBIDDEN' });
});

test('a transition payload cannot change after approval', async () => {
  const f = await fixture();
  const approvedInput = workflowInput('workflow.transition', { workflow_id: 'w1', to_stage: 'ARCHITECTURE' });
  const op = await f.authority.prepare(f.owner, approvedInput);
  await f.authority.decide(f.owner, op.operation_id, 'approve');
  let mutations = 0;
  await assert.rejects(
    f.authority.execute(f.owner, op.operation_id, workflowInput('workflow.transition', { workflow_id: 'w1', to_stage: 'DEPLOYMENT' }), () => mutations++),
    { code: 'CONFLICT' }
  );
  assert.equal(mutations, 0);
});

test('unregistered workflow kinds are rejected as unknown capabilities', async () => {
  const f = await fixture();
  assert.throws(() => normalizeOperation(workflowInput('workflow.approve')), { name: 'TypeError' });
  await assert.rejects(f.authority.prepare(f.owner, workflowInput('workflow.approve')), { code: 'BAD_REQUEST' });
});
