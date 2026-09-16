// tests/arch/workflow-audit.test.ts
// Slice 2 verification: workflow.transition rows enter the existing audit
// spine only through emitWorkflowTransition — sanitized (identifiers, digests,
// stage names, status, gate results; never artifact bodies), validated against
// the frozen workflow contract, and rejected without a write when malformed.
// The workflow service that calls this is a later slice; this file proves the
// surface it will use against the real service and the real JSONL bus.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createAuditTrail } from '../../node/src/services/audit-trail.mjs';
import { AuditEventType } from '../../common/contracts/audit.ts';
import { WorkflowTransitionEvent } from '../../common/contracts/workflow.ts';

const UUID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
const SHA = 'a'.repeat(64);
const TS = '2026-09-15T00:00:00.000Z';
const PLANTED_BODY = 'ARTIFACT-BODY-PLANTED';

const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'aide-workflow-audit-'));
const audit = createAuditTrail({ workspace });

type EmitResult = { persisted: boolean; error?: string };
const emitTransition = (event: unknown): Promise<EmitResult> =>
  (audit.emitWorkflowTransition as unknown as (event: unknown) => Promise<EmitResult>)(event);

const transitionEvent = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  type: 'workflow.transition',
  ts: TS,
  workspace: 'E:/work/example',
  workflow_id: UUID,
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

async function readRows(): Promise<Array<Record<string, unknown>>> {
  let raw: string;
  try {
    raw = await fs.readFile(path.join(workspace, '.aide', 'cipher-state.jsonl'), 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
  return raw.split('\n').filter(Boolean).map(line => JSON.parse(line) as Record<string, unknown>);
}

const workflowRows = async (): Promise<Array<Record<string, unknown>>> =>
  (await readRows()).filter(row => row.type === 'workflow.transition');

after(async () => {
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      await fs.rm(workspace, { recursive: true, force: true });
      return;
    } catch (error) {
      if (!['EBUSY', 'ENOTEMPTY', 'EPERM'].includes((error as NodeJS.ErrnoException).code ?? '')) throw error;
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
});

test('workflow.transition is registered on the contract enum and the audit surface', () => {
  assert.equal(AuditEventType.safeParse('workflow.transition').success, true);
  assert.ok(audit.knownTypes().includes('workflow.transition'));
});

test('a valid transition row persists and validates against the frozen contract', async () => {
  const before = (await workflowRows()).length;
  const result = await emitTransition(transitionEvent());
  assert.deepEqual(result, { persisted: true });
  const rows = await workflowRows();
  assert.equal(rows.length, before + 1);
  const row = rows.at(-1);
  assert.ok(row);
  const { at, ...event } = row;
  assert.equal(typeof at, 'string');
  assert.equal(Number.isNaN(Date.parse(String(at))), false);
  assert.equal(WorkflowTransitionEvent.safeParse(event).success, true);
});

test('ts is stamped when absent and preserved when supplied', async () => {
  const noTs = transitionEvent({ sequence: 2 });
  delete noTs.ts;
  assert.deepEqual(await emitTransition(noTs), { persisted: true });
  const stamped = (await workflowRows()).find(row => row.sequence === 2);
  assert.ok(stamped);
  assert.equal(typeof stamped.ts, 'string');
  assert.equal(Number.isNaN(Date.parse(String(stamped.ts))), false);

  assert.deepEqual(await emitTransition(transitionEvent({ sequence: 3, ts: TS })), { persisted: true });
  const preserved = (await workflowRows()).find(row => row.sequence === 3);
  assert.ok(preserved);
  assert.equal(preserved.ts, TS);
});

test('sanitation strips unknown fields and never persists artifact bodies', async () => {
  const polluted = transitionEvent({
    sequence: 4,
    sneaky: 'unknown-top-level',
    gate: { result: 'satisfied', failed: [], extra: true },
    evidence: [{ artifact_id: UUID, artifact_type: 'EXPERIENCE_BRIEF', sha256: SHA, content: PLANTED_BODY }]
  });
  assert.deepEqual(await emitTransition(polluted), { persisted: true });
  const rows = await workflowRows();
  const row = rows.find(entry => entry.sequence === 4);
  assert.ok(row);
  assert.equal('sneaky' in row, false);
  assert.deepEqual(row.gate, { result: 'satisfied', failed: [] });
  assert.deepEqual(row.evidence, [{ artifact_id: UUID, artifact_type: 'EXPERIENCE_BRIEF', sha256: SHA }]);
  assert.equal((await fs.readFile(path.join(workspace, '.aide', 'cipher-state.jsonl'), 'utf8')).includes(PLANTED_BODY), false);
  const event = { ...row };
  delete event.at;
  assert.equal(WorkflowTransitionEvent.safeParse(event).success, true);
});

test('malformed events are rejected without any write', async () => {
  const cases: Array<[string, Record<string, unknown> | unknown]> = [
    ['unknown status', transitionEvent({ status: 'approved' })],
    ['unknown stage', transitionEvent({ to_stage: 'PLANNING' })],
    ['missing workflow_id', transitionEvent({ workflow_id: undefined })],
    ['bad gate result', transitionEvent({ gate: { result: 'yes', failed: [] } })],
    ['missing gate', transitionEvent({ gate: undefined })],
    ['evidence item missing sha256', transitionEvent({ evidence: [{ artifact_id: UUID, artifact_type: 'EXPERIENCE_BRIEF' }] })],
    ['wrong type literal', transitionEvent({ type: 'workflow.stage' })],
    ['unknown kind', transitionEvent({ kind: 'rollback' })],
    ['non-object event', 'not-an-event'],
    ['null event', null]
  ];
  for (const [label, payload] of cases) {
    const before = (await workflowRows()).length;
    const result = await emitTransition(payload);
    assert.equal(result.persisted, false, `${label} must be rejected`);
    assert.ok(typeof result.error === 'string' && result.error.length <= 500, `${label} must carry a bounded error`);
    assert.ok(result.error.startsWith('invalid workflow.transition event'), `${label} must name the contract`);
    assert.equal((await workflowRows()).length, before, `${label} must not write`);
  }
});

test('readEvents isolates workflow.transition rows from other audit traffic', async () => {
  assert.deepEqual(await audit.emitContext({ sessionId: 'ctx', source: 'skills', status: 'no_match', error: null }), { persisted: true });
  const rows = await audit.readEvents({ type: 'workflow.transition' });
  assert.ok(rows.length >= 1);
  assert.ok(rows.every(row => row.type === 'workflow.transition'));
  const all = await readRows();
  assert.ok(all.some(row => row.type === 'agent.context'));
});
