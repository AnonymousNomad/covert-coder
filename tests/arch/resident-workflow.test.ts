// tests/arch/resident-workflow.test.ts
// Slice 8 verification — Resident OBSERVE / EXPLAIN / REQUEST over the frozen
// workflow kernel. The Resident surfaces canonical workflow facts in its
// context projection, EXPLAINs them as deterministic statements, and composes
// transition REQUESTS that stay pending until the operator approves them
// through the Slice 7 route + authority. Resident NEVER mutates state and
// NEVER self-approves: the probe is narrowed to load/buildTransitionRequest/
// evaluateTransition, and every transition_option/proposal carries
// requires_authorization: true.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { ArchServer } from '../../node/src/server.ts';
import { pairFixture, pairServiceFixture } from './authority-fixture.ts';
import { createAuditTrail } from '../../node/src/services/audit-trail.mjs';
import { createWorkflowService } from '../../node/src/services/workflow-service.ts';
import {
  createResidentService,
  makeResidentWorkflowProbe,
  buildResidentWorkflowContext,
  explainWorkflow,
  renderWorkflowBlock,
  renderResidentContext,
  routesForResident,
  type ResidentWorkflowProbe
} from '../../node/src/routes/resident.ts';
import { validContentFor, writeArtifact, TS } from './workflow-fixtures.ts';
import { WorkflowTransitionRequest, type WorkflowStateT } from '../../common/contracts/workflow.ts';

// Throwing authority: proves the resident probe never reaches authority —
// load/build/evaluate do not need it and must NEVER invoke it.
function throwingAuthority() {
  return {
    assertExecution: () => {
      throw new Error('authority.assertExecution must never be reached by the resident probe');
    },
    claimExecution: () => {
      throw new Error('authority.claimExecution must never be reached by the resident probe');
    }
  } as unknown as Parameters<typeof createWorkflowService>[0]['authority'];
}

function countingAudit() {
  const events: string[] = [];
  const audit = {
    emitChat: async () => { events.push('chat'); return { persisted: true as const, ts: '' }; },
    emitWorkflowTransition: async () => { events.push('transition'); return { persisted: true as const, error: null }; },
    readEvents: async () => { events.push('read'); return []; }
  } as unknown as ReturnType<typeof createAuditTrail>;
  return { audit, events };
}

async function seedState(workspace: string, overrides: Partial<WorkflowStateT> = {}): Promise<WorkflowStateT> {
  const state: WorkflowStateT = {
    version: 1,
    workflow_id: randomUUID(),
    workspace,
    project_id: 'resident-seed',
    stage: 'DISCOVERY',
    previous_stage: null,
    revision: 0,
    artifacts: [],
    last_transition_id: null,
    created_at: TS,
    updated_at: TS,
    ...overrides
  };
  const dir = path.join(workspace, '.aide', 'workflow');
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, 'state.json'), JSON.stringify(state, null, 2), 'utf8');
  return state;
}

async function freshDir(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), `aide-resident-workflow-${prefix}-`));
}

async function removeDir(dir: string): Promise<void> {
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      await fs.rm(dir, { recursive: true, force: true });
      return;
    } catch (error) {
      if (!['EBUSY', 'ENOTEMPTY', 'EPERM'].includes((error as NodeJS.ErrnoException).code ?? '')) throw error;
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
}

function unitService(workspace: string, workflow?: ResidentWorkflowProbe) {
  return createResidentService(workspace, workflow === undefined ? {} : { workflow });
}

// ---------------------------------------------------------------------------
// 1. canonical stage projection in the resident context
// ---------------------------------------------------------------------------
test('context carries the canonical workflow stage projection when a probe is wired', async () => {
  const workspace = await freshDir('projection');
  try {
    await seedState(workspace);
    const workflowService = createWorkflowService({ workspace, authority: throwingAuthority(), audit: createAuditTrail({ workspace }) });
    const probe = makeResidentWorkflowProbe(workflowService);
    const service = createResidentService(workspace, { workflow: probe });
    const context = await service.context();
    assert.ok(context.workflow, 'workflow projection must be present when a probe is wired');
    assert.equal(context.workflow.stage, 'DISCOVERY');
    assert.equal(context.workflow.revision, 0);
    assert.equal(context.workflow.previous_stage, null);
    assert.deepEqual(context.workflow.artifacts, []);
  } finally {
    await removeDir(workspace);
  }
});

// ---------------------------------------------------------------------------
// 2. references-only projection, strict schema, no artifact bodies
// ---------------------------------------------------------------------------
test('projection is references-only (refs/status, no bodies) and parses the strict contract', async () => {
  const workspace = await freshDir('refsonly');
  try {
    const brief = await writeArtifact(workspace, 'EXPERIENCE_BRIEF', validContentFor('EXPERIENCE_BRIEF'));
    await seedState(workspace, { artifacts: [brief] });
    const workflowService = createWorkflowService({ workspace, authority: throwingAuthority(), audit: createAuditTrail({ workspace }) });
    const service = await unitService(workspace, makeResidentWorkflowProbe(workflowService));
    const context = await service.context();
    assert.ok(context.workflow);
    assert.equal(context.workflow.artifacts.length, 1);
    const ref = context.workflow.artifacts[0]!;
    assert.deepEqual(Object.keys(ref).sort(), ['artifact_id', 'artifact_type', 'created_at', 'path', 'sha256', 'stage', 'verification_status']);
    assert.equal(JSON.stringify(context.workflow).includes('business_objective'), false);
    assert.equal(JSON.stringify(context.workflow).includes('anti_audience'), false);
    assert.equal(typeof ref.sha256, 'string');
    assert.match(ref.sha256, /^[0-9a-f]{64}$/);
  } finally {
    await removeDir(workspace);
  }
});

// ---------------------------------------------------------------------------
// 3. EXPLAIN derives stage / completed / required artifacts
// ---------------------------------------------------------------------------
test('explainWorkflow derives stage, completed artifacts and required-for-progress blockers', async () => {
  const workspace = await freshDir('explain');
  try {
    await seedState(workspace);
    const workflowService = createWorkflowService({ workspace, authority: throwingAuthority(), audit: createAuditTrail({ workspace }) });
    const probe = makeResidentWorkflowProbe(workflowService);
    const context = await buildResidentWorkflowContext(probe);
    assert.ok(context);
    const facts = explainWorkflow(context);
    assert.ok(facts.some(f => f.includes('workflow: DISCOVERY')), 'explain must state the canonical stage');
    assert.ok(facts.some(f => f.includes('validated artifacts: none')), 'explain must state validated artifacts');
    assert.ok(facts.some(f => f.includes('required for progress: missing:EXPERIENCE_BRIEF')), 'explain must state required-for-progress blockers');
    assert.ok(facts.some(f => f.includes('authorization: all workflow transitions require operator approval')), 'explain must state the authorization law');
  } finally {
    await removeDir(workspace);
  }
});

// ---------------------------------------------------------------------------
// 4. blockers reflect missing verification
// ---------------------------------------------------------------------------
test('blockers reflect the missing-verification gate outcome', async () => {
  const workspace = await freshDir('blockers');
  try {
    await seedState(workspace);
    const workflowService = createWorkflowService({ workspace, authority: throwingAuthority(), audit: createAuditTrail({ workspace }) });
    const context = await buildResidentWorkflowContext(makeResidentWorkflowProbe(workflowService));
    assert.ok(context);
    assert.deepEqual(context.blockers, ['missing:EXPERIENCE_BRIEF']);
    assert.equal(context.transition_options.length, 1);
    assert.equal(context.transition_options[0]!.kind, 'forward');
    assert.equal(context.transition_options[0]!.to_stage, 'ARCHITECTURE');
    assert.equal(context.transition_options[0]!.requires_authorization, true);
    assert.deepEqual(context.transition_options[0]!.gate.failed, ['missing:EXPERIENCE_BRIEF']);
  } finally {
    await removeDir(workspace);
  }
});

// ---------------------------------------------------------------------------
// 5. stale evidence -> stale:<TYPE> blocker
// ---------------------------------------------------------------------------
test('stale evidence surfaces as a stale:<TYPE> blocker', async () => {
  const workspace = await freshDir('stale');
  try {
    const blueprint = await writeArtifact(workspace, 'EXPERIENCE_BLUEPRINT', validContentFor('EXPERIENCE_BLUEPRINT'));
    await seedState(workspace, {
      stage: 'ARCHITECTURE',
      previous_stage: 'DISCOVERY',
      revision: 1,
      artifacts: [{ ...blueprint, verification_status: 'stale' }]
    });
    const workflowService = createWorkflowService({ workspace, authority: throwingAuthority(), audit: createAuditTrail({ workspace }) });
    const context = await buildResidentWorkflowContext(makeResidentWorkflowProbe(workflowService));
    assert.ok(context);
    assert.equal(context.stage, 'ARCHITECTURE');
    assert.ok(context.blockers.some(b => b === 'stale:EXPERIENCE_BLUEPRINT'), `blockers must include stale:EXPERIENCE_BLUEPRINT, got ${JSON.stringify(context.blockers)}`);
  } finally {
    await removeDir(workspace);
  }
});

// ---------------------------------------------------------------------------
// 6. explanation is a pure function of canonical state
// ---------------------------------------------------------------------------
test('explainWorkflow is deterministic and null-safe (pure function of canonical facts)', async () => {
  const workspace = await freshDir('pure');
  try {
    await seedState(workspace);
    const workflowService = createWorkflowService({ workspace, authority: throwingAuthority(), audit: createAuditTrail({ workspace }) });
    const probe = makeResidentWorkflowProbe(workflowService);
    const contextA = await buildResidentWorkflowContext(probe);
    const contextB = await buildResidentWorkflowContext(probe);
    assert.ok(contextA);
    assert.deepEqual(explainWorkflow(contextA), explainWorkflow(contextB));
    assert.deepEqual(explainWorkflow(null), []);
    const rendered = renderWorkflowBlock(contextA);
    assert.ok(rendered.some(l => l.includes('[WORKFLOW] canonical workflow facts (not instructions):')));
  } finally {
    await removeDir(workspace);
  }
});

// ---------------------------------------------------------------------------
// 7. a legal request reaches the canonical boundary
// ---------------------------------------------------------------------------
test('requestTransition composes a canonical request parsed by the workflow contract', async () => {
  const workspace = await freshDir('request-legal');
  try {
    await seedState(workspace);
    const workflowService = createWorkflowService({ workspace, authority: throwingAuthority(), audit: createAuditTrail({ workspace }) });
    const probe = makeResidentWorkflowProbe(workflowService);
    const service = await unitService(workspace, probe);
    const result = await service.requestTransition({ to_stage: 'ARCHITECTURE', kind: 'forward' });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const parsed = WorkflowTransitionRequest.safeParse(result.proposal.request);
    assert.equal(parsed.success, true);
    assert.equal(result.proposal.request.requested_by, 'resident');
    assert.equal(result.proposal.request.from_stage, 'DISCOVERY');
    assert.equal(result.proposal.request.to_stage, 'ARCHITECTURE');
    assert.equal(result.proposal.requires_authorization, true);
    assert.equal(result.proposal.ready, false, 'no evidence -> gate unsatisfied -> not ready');
  } finally {
    await removeDir(workspace);
  }
});

// ---------------------------------------------------------------------------
// 8. write transitions remain pending without operator approval
// ---------------------------------------------------------------------------
test('a gate-ready request stays pending: state file is unchanged until operator approval', async () => {
  const workspace = await freshDir('pending');
  try {
    const brief = await writeArtifact(workspace, 'EXPERIENCE_BRIEF', validContentFor('EXPERIENCE_BRIEF'));
    await seedState(workspace);
    const stateFile = path.join(workspace, '.aide', 'workflow', 'state.json');
    const workflowService = createWorkflowService({ workspace, authority: throwingAuthority(), audit: createAuditTrail({ workspace }) });
    const probe = makeResidentWorkflowProbe(workflowService);
    const service = await unitService(workspace, probe);
    const before = await fs.readFile(stateFile);
    const result = await service.requestTransition({ to_stage: 'ARCHITECTURE', evidence: [brief] });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.proposal.ready, true);
    assert.equal(result.proposal.requires_authorization, true);
    assert.deepEqual(await fs.readFile(stateFile), before, 'resident request must not advance state');
  } finally {
    await removeDir(workspace);
  }
});

// ---------------------------------------------------------------------------
// 9. resident cannot self-approve
// ---------------------------------------------------------------------------
test('resident cannot self-approve: probe keys are exactly load/build/evaluate and requires_authorization is literal true', async () => {
  const workspace = await freshDir('no-self-approve');
  try {
    await seedState(workspace);
    const workflowService = createWorkflowService({ workspace, authority: throwingAuthority(), audit: createAuditTrail({ workspace }) });
    const probe = makeResidentWorkflowProbe(workflowService);
    assert.deepEqual(Object.keys(probe).sort(), ['buildTransitionRequest', 'evaluateTransition', 'load']);
    assert.equal('applyTransition' in probe, false, 'probe must never expose applyTransition');
    const brief = await writeArtifact(workspace, 'EXPERIENCE_BRIEF', validContentFor('EXPERIENCE_BRIEF'));
    const service = await unitService(workspace, probe);
    const result = await service.requestTransition({ to_stage: 'ARCHITECTURE', evidence: [brief] });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.proposal.requires_authorization, true);
    assert.equal(result.proposal.ready, true);
  } finally {
    await removeDir(workspace);
  }
});

// ---------------------------------------------------------------------------
// 10. approved valid transition applies (integration)
// ---------------------------------------------------------------------------
const integrationWorkspace = await fs.mkdtemp(path.join(os.tmpdir(), 'aide-resident-workflow-integration-'));
const longSignal = (): AbortSignal => AbortSignal.timeout(60_000);
let server: ArchServer;
let httpServer: import('node:http').Server;
let base: string;
let owner: Awaited<ReturnType<typeof pairFixture>>;
let audit: ReturnType<typeof createAuditTrail>;
let workflowId = '';

type Envelope<T> = { ok: boolean; data?: T; error?: { code: string; message: string; detail?: unknown } };
type TransitionData = {
  status: string;
  gate: { result: string; failed: string[] };
  state: { workflow_id?: string; stage?: string; revision?: number } | null;
  operation_id: string | null;
};

async function asJson<T>(response: Response): Promise<{ status: number; body: Envelope<T> }> {
  return { status: response.status, body: (await response.json()) as Envelope<T> };
}

async function postTransition(body: unknown, headers: Record<string, string> = {}): Promise<{ status: number; body: Envelope<TransitionData> }> {
  return asJson(await owner.request('/api/workflow/transition', { method: 'POST', headers, body: JSON.stringify(body), signal: longSignal() }));
}

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

before(async () => {
  server = new ArchServer(integrationWorkspace, path.join(integrationWorkspace, 'arch-resident-workflow.log'));
  const { buildRoutes } = await import('../../node/src/openapi.ts');
  const routes = await buildRoutes(integrationWorkspace, 'test', { authority: server.authority, events: server.events });
  for (const route of routes) server.route(route);
  httpServer = await server.listen(0);
  const address = httpServer.address();
  assert.ok(address && typeof address === 'object');
  base = `http://127.0.0.1:${address.port}`;
  const warm = createAuditTrail({ workspace: integrationWorkspace });
  await warm.emitChat({ task: 'resident-workflow warmup' });
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      owner = await pairFixture(server, base);
      break;
    } catch (error) {
      if (attempt === 2) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  const setupFixture = await pairServiceFixture(integrationWorkspace);
  const setupService = createWorkflowService({ workspace: integrationWorkspace, authority: setupFixture.authority, audit: createAuditTrail({ workspace: integrationWorkspace }) });
  await setupFixture.approveAndExecute('workflow.create', { project_id: 'resident-integration' }, 'resident-setup', execution => setupService.create(execution, { project_id: 'resident-integration' }));
  audit = createAuditTrail({ workspace: integrationWorkspace });
});

after(async () => {
  await new Promise<void>(resolve => httpServer.close(() => resolve()));
  await removeDir(integrationWorkspace);
});

async function integrationResident(): Promise<{ service: ReturnType<typeof createResidentService>; probe: ReturnType<typeof makeResidentWorkflowProbe> }> {
  const workflowService = createWorkflowService({ workspace: integrationWorkspace, authority: server.authority, audit: createAuditTrail({ workspace: integrationWorkspace }) });
  const probe = makeResidentWorkflowProbe(workflowService);
  return { service: createResidentService(integrationWorkspace, { workflow: probe }), probe };
}

test('approved valid resident-composed request applies end-to-end (integration)', async () => {
  const brief = await writeArtifact(integrationWorkspace, 'EXPERIENCE_BRIEF', validContentFor('EXPERIENCE_BRIEF'));
  const { service } = await integrationResident();
  const result = await service.requestTransition({ to_stage: 'ARCHITECTURE', evidence: [brief] });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.proposal.ready, true);
  const body = result.proposal.request;
  workflowId = body.workflow_id;

  const archived = await asJson<{ context: { workflow: { stage: string } | null } }>(await owner.request('/api/resident/context', { signal: longSignal() }));
  assert.equal(archived.status, 200);
  assert.equal(archived.body.data?.context.workflow?.stage, 'DISCOVERY', 'wired server resident context must carry the canonical stage');

  const approval = await approveLong('POST', '/api/workflow/transition', body, 'resident-integration-apply');
  const applied = await postTransition(body, approval);
  assert.equal(applied.status, 200);
  assert.equal(applied.body.ok, true);
  assert.equal(applied.body.data?.status, 'applied');
  assert.equal(applied.body.data?.gate.result, 'satisfied');
  assert.equal(applied.body.data?.state?.stage, 'ARCHITECTURE');
  assert.equal(applied.body.data?.state?.revision, 1);
  assert.equal(applied.body.data?.operation_id, approval['X-AIDE-Operation']);
});

// ---------------------------------------------------------------------------
// 11. approved-but-tampered request fails 409, state unchanged (integration)
// ---------------------------------------------------------------------------
test('tampering a resident-composed body after approval fails at the authority digest (integration)', async () => {
  const blueprintA = await writeArtifact(integrationWorkspace, 'EXPERIENCE_BLUEPRINT', validContentFor('EXPERIENCE_BLUEPRINT'));
  const blueprintB = await writeArtifact(integrationWorkspace, 'EXPERIENCE_BLUEPRINT', validContentFor('EXPERIENCE_BLUEPRINT'));
  const approvedBody = { workflow_id: workflowId, from_stage: 'ARCHITECTURE', to_stage: 'DESIGN', kind: 'forward' as const, evidence: [blueprintA] };
  const swappedBody = { ...approvedBody, evidence: [blueprintB] };
  const rowsBefore = (await workflowRows()).length;
  const approval = await approveLong('POST', '/api/workflow/transition', approvedBody, 'resident-integration-swap');
  const result = await postTransition(swappedBody, approval);
  assert.equal(result.status, 409);
  assert.equal(result.body.ok, false);
  assert.equal(result.body.error?.code, 'CONFLICT');
  const persisted = JSON.parse(await fs.readFile(path.join(integrationWorkspace, '.aide', 'workflow', 'state.json'), 'utf8')) as { stage?: string; revision?: number };
  assert.equal(persisted.stage, 'ARCHITECTURE');
  assert.equal(persisted.revision, 1);
  assert.equal((await workflowRows()).length, rowsBefore);
});

// ---------------------------------------------------------------------------
// 12. failed gate leaves canonical state unchanged (integration)
// ---------------------------------------------------------------------------
test('a gate-unsatisfied resident request is rejected and leaves state unchanged (integration)', async () => {
  const blueprint = await writeArtifact(integrationWorkspace, 'EXPERIENCE_BLUEPRINT', validContentFor('EXPERIENCE_BLUEPRINT'));
  const target = path.join(integrationWorkspace, blueprint.path);
  await fs.writeFile(target, JSON.stringify({ tampered: true }, null, 2), 'utf8');
  const { service } = await integrationResident();
  const result = await service.requestTransition({ to_stage: 'DESIGN', evidence: [{ ...blueprint, sha256: '0'.repeat(64) }] });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.proposal.ready, false, 'checksum-mismatched evidence must not be ready');
  const body = result.proposal.request;
  const rowsBefore = (await workflowRows()).length;
  const approval = await approveLong('POST', '/api/workflow/transition', body, 'resident-integration-gate');
  const rejected = await postTransition(body, approval);
  assert.equal(rejected.status, 200);
  assert.equal(rejected.body.ok, true);
  assert.equal(rejected.body.data?.status, 'rejected');
  assert.equal(rejected.body.data?.gate.result, 'unsatisfied');
  assert.equal(rejected.body.data?.state?.stage, 'ARCHITECTURE');
  const persisted = JSON.parse(await fs.readFile(path.join(integrationWorkspace, '.aide', 'workflow', 'state.json'), 'utf8')) as { stage?: string; revision?: number };
  assert.equal(persisted.stage, 'ARCHITECTURE');
  assert.equal(persisted.revision, 1);
  assert.ok((await workflowRows()).length > rowsBefore, 'rejected rows journal the attempt');
});

// ---------------------------------------------------------------------------
// 13. requestTransition is read-only
// ---------------------------------------------------------------------------
test('requestTransition is read-only: no state bytes change and no transition row is journaled', async () => {
  const workspace = await freshDir('readonly');
  try {
    const brief = await writeArtifact(workspace, 'EXPERIENCE_BRIEF', validContentFor('EXPERIENCE_BRIEF'));
    await seedState(workspace);
    const stateFile = path.join(workspace, '.aide', 'workflow', 'state.json');
    const counter = countingAudit();
    const workflowService = createWorkflowService({ workspace, authority: throwingAuthority(), audit: counter.audit });
    const service = await unitService(workspace, makeResidentWorkflowProbe(workflowService));
    const before = await fs.readFile(stateFile);
    const eventsBefore = [...counter.events];
    const result = await service.requestTransition({ to_stage: 'ARCHITECTURE', evidence: [brief] });
    assert.equal(result.ok, true);
    assert.deepEqual(await fs.readFile(stateFile), before, 'read-only request must not touch the state file');
    assert.deepEqual(counter.events, eventsBefore, 'read-only request must not emit workflow.transition rows');
  } finally {
    await removeDir(workspace);
  }
});

// ---------------------------------------------------------------------------
// 14. no authority decision/delegation surface on the probe
// ---------------------------------------------------------------------------
test('the probe exposes only load/build/evaluate — no authority decision or delegation surface', async () => {
  const workspace = await freshDir('surface');
  try {
    await seedState(workspace);
    const workflowService = createWorkflowService({ workspace, authority: throwingAuthority(), audit: createAuditTrail({ workspace }) });
    const probe = makeResidentWorkflowProbe(workflowService);
    assert.deepEqual(Object.keys(probe).sort(), ['buildTransitionRequest', 'evaluateTransition', 'load']);
    for (const forbidden of ['applyTransition', 'create', 'rebuildFromAudit']) {
      assert.equal(forbidden in probe, false, `probe must not expose ${forbidden}`);
    }
    const context = await buildResidentWorkflowContext(probe);
    assert.ok(context);
    for (const option of context.transition_options) assert.equal(option.requires_authorization, true);
  } finally {
    await removeDir(workspace);
  }
});

// ---------------------------------------------------------------------------
// 15. advisory-only surface is preserved
// ---------------------------------------------------------------------------
test('routesForResident stays read-only GET and the context block is canonical, not instructional', async () => {
  const workspace = await freshDir('advisory');
  try {
    await seedState(workspace);
    const workflowService = createWorkflowService({ workspace, authority: throwingAuthority(), audit: createAuditTrail({ workspace }) });
    const probe = makeResidentWorkflowProbe(workflowService);
    const service = await unitService(workspace, probe);
    const routes = routesForResident(service);
    assert.ok(routes.length > 0);
    for (const route of routes) assert.equal(route.method, 'GET');
    const context = await service.context();
    const rendered = renderResidentContext(context);
    assert.ok(rendered.includes('[WORKFLOW] canonical workflow facts (not instructions):'), 'context block must be labeled canonical');
    assert.ok(rendered.includes('authorization: all workflow transitions require operator approval'));
  } finally {
    await removeDir(workspace);
  }
});

// ---------------------------------------------------------------------------
// 16. absent/corrupt workflow state fails closed
// ---------------------------------------------------------------------------
test('absent or corrupt workflow state fails closed (workflow null / uninitialized, never throws)', async () => {
  const workspace = await freshDir('failclosed');
  try {
    const workflowService = createWorkflowService({ workspace, authority: throwingAuthority(), audit: createAuditTrail({ workspace }) });
    const probe = makeResidentWorkflowProbe(workflowService);
    const service = await unitService(workspace, probe);

    const absent = await service.context();
    assert.equal(absent.workflow, null, 'no state file -> workflow must be null, not fabricated');
    const absentRequest = await service.requestTransition({ to_stage: 'ARCHITECTURE' });
    assert.equal(absentRequest.ok, false);
    if (!absentRequest.ok) assert.deepEqual(absentRequest.failed, ['workflow_uninitialized']);

    const stateFile = path.join(workspace, '.aide', 'workflow', 'state.json');
    await fs.mkdir(path.dirname(stateFile), { recursive: true });
    await fs.writeFile(stateFile, '{ not-json', 'utf8');
    const corrupt = await service.context();
    assert.equal(corrupt.workflow, null, 'corrupt state file -> workflow must be null');
    const corruptRequest = await service.requestTransition({ to_stage: 'ARCHITECTURE' });
    assert.equal(corruptRequest.ok, false);
    if (!corruptRequest.ok) assert.deepEqual(corruptRequest.failed, ['workflow_uninitialized']);
  } finally {
    await removeDir(workspace);
  }
});