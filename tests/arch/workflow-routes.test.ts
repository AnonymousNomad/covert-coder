// tests/arch/workflow-routes.test.ts
// Slice 7 verification: the workflow kernel is exposed through adapters only.
// Contract tests prove the route edge rejects malformed bodies; the
// integration test drives the full chain (POST transition -> workflow service
// -> authority prepare -> operator approval -> execute -> audit rows -> state
// update); security tests prove the route cannot skip the validator, cannot
// mutate state without an approved operation, and that a payload swap after
// approval fails at the authority digest. The requested row is informational
// (status 'requested') and precedes the applied/rejected row.
//
// Machine note: the authority audit bus fsyncs every row, and the first cold
// writes on this box can take >10s, so this file warms the bus once in
// before(), retries the pairing handshake, and uses generous 60s signals on
// every request it controls (the shared fixture's default is 5s).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ArchServer } from '../../node/src/server.ts';
import { pairFixture, pairServiceFixture } from './authority-fixture.ts';
import { createAuditTrail } from '../../node/src/services/audit-trail.mjs';
import { createWorkflowService } from '../../node/src/services/workflow-service.ts';
import { validContentFor, writeArtifact } from './workflow-fixtures.ts';

const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'aide-workflow-routes-'));
const statePath = path.join(workspace, '.aide', 'workflow', 'state.json');
// AbortSignal.timeout counts from creation, so every request gets a fresh one.
const longSignal = (): AbortSignal => AbortSignal.timeout(60_000);
let server: ArchServer;
let httpServer: import('node:http').Server;
let base: string;
let owner: Awaited<ReturnType<typeof pairFixture>>;
let setupFixture: Awaited<ReturnType<typeof pairServiceFixture>>;
let audit: ReturnType<typeof createAuditTrail>;
let workflowId = '';

before(async () => {
  server = new ArchServer(workspace, path.join(workspace, 'arch-workflow-routes.log'));
  const { buildRoutes } = await import('../../node/src/openapi.ts');
  const routes = await buildRoutes(workspace, 'test', { authority: server.authority, events: server.events });
  for (const route of routes) server.route(route);
  httpServer = await server.listen(0);
  const address = httpServer.address();
  assert.ok(address && typeof address === 'object');
  base = `http://127.0.0.1:${address.port}`;
  // Warm the audit bus once so cold fsync latency does not break the pairing
  // handshake's 5s fixture timeout.
  const warm = createAuditTrail({ workspace });
  await warm.emitChat({ task: 'workflow-routes warmup' });
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      owner = await pairFixture(server, base);
      break;
    } catch (error) {
      if (attempt === 2) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  setupFixture = await pairServiceFixture(workspace);
  const setupService = createWorkflowService({ workspace, authority: setupFixture.authority, audit: createAuditTrail({ workspace }) });
  await setupFixture.approveAndExecute('workflow.create', { project_id: 'route-demo' }, 'route-setup', execution => setupService.create(execution, { project_id: 'route-demo' }));
  audit = createAuditTrail({ workspace });
});

after(async () => {
  setupFixture.authority.control.close();
  await new Promise<void>(resolve => httpServer.close(() => resolve()));
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

type Envelope<T> = { ok: boolean; data?: T; error?: { code: string; message: string; detail?: unknown } };
type TransitionData = {
  status: string;
  gate: { result: string; failed: string[] };
  state: { workflow_id?: string; stage?: string; revision?: number; artifacts?: Array<Record<string, unknown>> } | null;
  operation_id: string | null;
};

async function asJson<T>(response: Response): Promise<{ status: number; body: Envelope<T> }> {
  return { status: response.status, body: (await response.json()) as Envelope<T> };
}

async function getState(): Promise<{ status: number; body: Envelope<{ state: TransitionData['state'] }> }> {
  return asJson(await owner.request('/api/workflow/state', { signal: longSignal() }));
}

async function postTransition(body: unknown, headers: Record<string, string> = {}): Promise<{ status: number; body: Envelope<TransitionData> }> {
  return asJson(await owner.request('/api/workflow/transition', { method: 'POST', headers, body: JSON.stringify(body), signal: longSignal() }));
}

// Same two-phase handshake as the shared fixture's approve(), with the long
// signal the shared helper does not expose.
async function approveLong(method: string, pathname: string, body: unknown, taskId: string): Promise<Record<string, string>> {
  const proposed = await asJson<{ operation_id: string; state: string }>(await owner.request('/api/authority/prepare', {
    method: 'POST', body: JSON.stringify({ method, path: pathname, body, task_id: taskId }), signal: longSignal()
  }));
  assert.equal(proposed.status, 200);
  assert.equal(proposed.body.ok, true);
  const operationId = proposed.body.data?.operation_id;
  assert.ok(typeof operationId === 'string');
  const decision = await owner.request('/api/authority/decision', {
    method: 'POST', body: JSON.stringify({ operation_id: operationId, decision: 'approve' }), signal: longSignal()
  });
  assert.equal(decision.status, 200);
  return { 'X-AIDE-Operation': operationId, 'X-AIDE-Task': taskId };
}

const workflowRows = async (): Promise<Array<Record<string, unknown>>> => audit.readEvents({ type: 'workflow.transition' });

test('the route edge rejects malformed transition bodies', async () => {
  const cases: Array<[string, unknown]> = [
    ['empty body', {}],
    ['unknown stage', { workflow_id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301', from_stage: 'DISCOVERY', to_stage: 'PLANNING', kind: 'forward', evidence: [] }],
    ['missing evidence', { workflow_id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301', from_stage: 'DISCOVERY', to_stage: 'ARCHITECTURE', kind: 'forward' }],
    ['non-uuid workflow', { workflow_id: 'not-a-uuid', from_stage: 'DISCOVERY', to_stage: 'ARCHITECTURE', kind: 'forward', evidence: [] }],
    ['unknown kind', { workflow_id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301', from_stage: 'DISCOVERY', to_stage: 'ARCHITECTURE', kind: 'rollback', evidence: [] }]
  ];
  for (const [label, body] of cases) {
    const result = await postTransition(body);
    assert.equal(result.status, 400, label);
    assert.equal(result.body.ok, false, label);
    assert.equal(result.body.error?.code, 'BAD_REQUEST', label);
  }
});

test('GET /api/workflow/state returns the created workflow as a references-only projection', async () => {
  const result = await getState();
  assert.equal(result.status, 200);
  assert.equal(result.body.ok, true);
  const state = result.body.data?.state;
  assert.ok(state);
  assert.equal(state.stage, 'DISCOVERY');
  assert.equal(state.revision, 0);
  assert.ok(typeof state.workflow_id === 'string');
  workflowId = String(state.workflow_id);
  assert.deepEqual(state.artifacts, []);
  const serialized = JSON.stringify(state);
  assert.equal(serialized.includes('business_objective'), false);
  assert.equal(serialized.includes('anti_audience'), false);
});

test('POST transition without an approved operation cannot mutate state', async () => {
  const before = await fs.readFile(statePath);
  const rowsBefore = (await workflowRows()).length;
  const result = await postTransition({
    workflow_id: workflowId,
    from_stage: 'DISCOVERY',
    to_stage: 'ARCHITECTURE',
    kind: 'forward',
    evidence: []
  });
  assert.equal(result.status, 409);
  assert.equal(result.body.ok, false);
  assert.equal(result.body.error?.code, 'NOT_READY');
  assert.deepEqual((result.body.error?.detail as { reason?: string } | undefined)?.reason, 'APPROVAL_REQUIRED');
  assert.deepEqual(await fs.readFile(statePath), before);
  assert.equal((await workflowRows()).length, rowsBefore);
});

test('an approved transition applies end-to-end and journals requested then applied rows', async () => {
  const brief = await writeArtifact(workspace, 'EXPERIENCE_BRIEF', validContentFor('EXPERIENCE_BRIEF'));
  const body = { workflow_id: workflowId, from_stage: 'DISCOVERY', to_stage: 'ARCHITECTURE', kind: 'forward', evidence: [brief] };
  const approval = await approveLong('POST', '/api/workflow/transition', body, 'route-integration');
  const result = await postTransition(body, approval);
  assert.equal(result.status, 200);
  assert.equal(result.body.ok, true);
  const data = result.body.data;
  assert.ok(data);
  assert.equal(data.status, 'applied');
  assert.equal(data.gate.result, 'satisfied');
  assert.deepEqual(data.gate.failed, []);
  assert.equal(data.state?.stage, 'ARCHITECTURE');
  assert.equal(data.state?.revision, 1);
  assert.equal(data.operation_id, approval['X-AIDE-Operation']);

  const afterState = await getState();
  assert.equal(afterState.body.data?.state?.stage, 'ARCHITECTURE');
  assert.equal(afterState.body.data?.state?.revision, 1);
  const artifact = afterState.body.data?.state?.artifacts?.[0];
  assert.ok(artifact);
  assert.deepEqual(Object.keys(artifact).sort(), ['artifact_id', 'artifact_type', 'created_at', 'path', 'sha256', 'stage', 'verification_status']);
  assert.equal(JSON.stringify(afterState.body.data?.state).includes('business_objective'), false);

  const persisted = JSON.parse(await fs.readFile(statePath, 'utf8')) as { stage?: string; revision?: number };
  assert.equal(persisted.stage, 'ARCHITECTURE');
  assert.equal(persisted.revision, 1);

  const rows = await workflowRows();
  assert.equal(rows.length, 2);
  assert.equal(rows[0]?.status, 'applied');
  assert.equal(rows[1]?.status, 'requested');
  assert.equal(rows[1]?.operation_id, approval['X-AIDE-Operation']);
  assert.equal(rows[1]?.sequence, 1);
  assert.deepEqual(rows[1]?.gate, { result: 'satisfied', failed: [] });
  assert.equal(rows[0]?.sequence, 1);
});

test('an approved transition with an invalid artifact is rejected by the deterministic gate', async () => {
  const malformed = validContentFor('EXPERIENCE_BLUEPRINT');
  delete malformed.page_character;
  const blueprint = await writeArtifact(workspace, 'EXPERIENCE_BLUEPRINT', malformed);
  const body = { workflow_id: workflowId, from_stage: 'ARCHITECTURE', to_stage: 'DESIGN', kind: 'forward', evidence: [blueprint] };
  const approval = await approveLong('POST', '/api/workflow/transition', body, 'route-invalid-artifact');
  const result = await postTransition(body, approval);
  assert.equal(result.status, 200);
  assert.equal(result.body.data?.status, 'rejected');
  assert.equal(result.body.data?.gate.result, 'unsatisfied');
  assert.deepEqual(result.body.data?.gate.failed, ['content:EXPERIENCE_BLUEPRINT']);
  assert.equal(result.body.data?.state?.stage, 'ARCHITECTURE');
  assert.equal(result.body.data?.state?.revision, 1);

  const persisted = JSON.parse(await fs.readFile(statePath, 'utf8')) as { stage?: string; revision?: number };
  assert.equal(persisted.stage, 'ARCHITECTURE');
  assert.equal(persisted.revision, 1);

  const rows = await workflowRows();
  assert.equal(rows.length, 4);
  assert.equal(rows[0]?.status, 'rejected');
  assert.equal(rows[1]?.status, 'requested');
  assert.deepEqual(rows[0]?.gate, { result: 'unsatisfied', failed: ['content:EXPERIENCE_BLUEPRINT'] });
  assert.ok(String(rows[0]?.error).includes('content:EXPERIENCE_BLUEPRINT'));
  assert.equal(rows[0]?.operation_id, approval['X-AIDE-Operation']);
});

test('a payload swap after approval fails at the authority digest', async () => {
  const blueprintA = await writeArtifact(workspace, 'EXPERIENCE_BLUEPRINT', validContentFor('EXPERIENCE_BLUEPRINT'));
  const blueprintB = await writeArtifact(workspace, 'EXPERIENCE_BLUEPRINT', validContentFor('EXPERIENCE_BLUEPRINT'));
  const approvedBody = { workflow_id: workflowId, from_stage: 'ARCHITECTURE', to_stage: 'DESIGN', kind: 'forward', evidence: [blueprintA] };
  const swappedBody = { workflow_id: workflowId, from_stage: 'ARCHITECTURE', to_stage: 'DESIGN', kind: 'forward', evidence: [blueprintB] };
  const approval = await approveLong('POST', '/api/workflow/transition', approvedBody, 'route-swap');
  const rowsBefore = (await workflowRows()).length;
  const result = await postTransition(swappedBody, approval);
  assert.equal(result.status, 409);
  assert.equal(result.body.ok, false);
  assert.equal(result.body.error?.code, 'CONFLICT');
  const persisted = JSON.parse(await fs.readFile(statePath, 'utf8')) as { stage?: string; revision?: number };
  assert.equal(persisted.stage, 'ARCHITECTURE');
  assert.equal(persisted.revision, 1);
  assert.equal((await workflowRows()).length, rowsBefore);
});
