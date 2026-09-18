import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type http from 'node:http';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ArchServer } from '../../node/src/server.ts';
import { pairFixture } from './authority-fixture.ts';
import { createSetupService, type SetupProbes } from '../../node/src/services/setup-service.ts';
import { routesForSetup } from '../../node/src/routes/setup.ts';
import type { SetupAnswersT, SetupProfileT, SetupReadinessT } from '../../common/contracts/setup.ts';

const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'aide-setup-arch-'));
const skillsRoot = path.join(workspace, 'skills-root');
let server: ArchServer;
let httpServer: http.Server;
let base: string;
let owner: Awaited<ReturnType<typeof pairFixture>>;

//
// Mutable probe stubs. Flipping these between tests proves the plan and the
// readiness verdict are derived from live probe state, never from memory.
//
let viewValue: unknown = {
  connections: [
    { id: 'local-runtime', name: 'Local llama.cpp', kind: 'local', status: 'not_configured', detail: 'no engine started; start from MODELS', routing_available: true },
    { id: 'api:prov1', name: 'Gateway', kind: 'api-key', status: 'connected', detail: 'key stored', routing_available: true },
    { id: 'subscription:claude', name: 'Claude', kind: 'subscription', status: 'unavailable', detail: 'CLI not detected', routing_available: false }
  ],
  preference: 'local-first'
};
let preferenceValue = 'local-first';
let hardwareValue: unknown = { totalRamBytes: 16 * 1024 ** 3, logicalCpus: 12, vramBytes: 6 * 1024 ** 3, tier: 'gtx1060', backend: 'cuda' };
let recsValue: unknown = {
  recommendations: [
    { role: 'planner', modelId: 'local:planner-m', name: 'Planner Mini', quant: 'Q4_K_M', fileBytes: 0.4 * 1024 ** 3, contextTokens: 8192, fit: 'COMFORTABLE', onDisk: true, reason: 'native planner fit' },
    { role: 'coder', modelId: 'local:coder-m', name: 'Coder Mini', quant: 'Q8_0', fileBytes: 0.9 * 1024 ** 3, contextTokens: 16384, fit: 'COMFORTABLE', onDisk: true, reason: 'best measured tok/s' },
    { role: 'reviewer', modelId: 'local:reviewer-m', name: 'Reviewer Mini', quant: 'Q4_K_M', fileBytes: 0.3 * 1024 ** 3, contextTokens: 4096, fit: 'TIGHT', onDisk: false, reason: 'available on request' }
  ]
};
let modelStatusValue = {
  runtime: true,
  models: [
    { id: 'local:coder-m', status: 'running', artifact_available: true },
    { id: 'local:planner-m', status: 'stopped', artifact_available: true }
  ]
};
let modelRoutesValue = [
  { id: 'local:coder-m', status: 'ready' },
  { id: 'local:planner-m', status: 'down' }
];
let telegramValue: unknown = { connected: false, running: true, bot_username: null };
let auditValue = true;

const probes: SetupProbes = {
  connectionsView: async () => viewValue as Awaited<ReturnType<SetupProbes['connectionsView']>>,
  connectionsGetPreference: async () => preferenceValue,
  hardwareProfile: async () => hardwareValue as Awaited<ReturnType<SetupProbes['hardwareProfile']>>,
  recommendRoles: async () => recsValue as Awaited<ReturnType<SetupProbes['recommendRoles']>>,
  modelStatus: async () => modelStatusValue,
  modelRoutes: async () => modelRoutesValue,
  telegramStatus: async () => telegramValue as Awaited<ReturnType<SetupProbes['telegramStatus']>>,
  auditReachable: async () => auditValue
};

const ANSWERS: SetupAnswersT = {
  workType: 'Software Engineering',
  secondaryWork: 'None',
  mode: 'LOCAL_FIRST',
  providers: ['Local only'],
  projectLocations: '',
  localModelUse: 'Primary driver',
  approvalStrictness: 'STRICT',
  integrations: [],
  importantWorkflows: ''
};

function buildProfile(over: Partial<SetupProfileT> = {}): SetupProfileT {
  return {
    version: 1,
    answers: { ...ANSWERS, ...(over.answers ?? {}) },
    skillFamilies: ['aide-arch-backend-core', 'aide-debugging-discipline', 'aide-route-slice-sop', 'aide-unified-diff-repair'],
    selectedModelId: 'local:coder-m',
    roles: { planner: 'local:planner-m', coder: 'local:coder-m', reviewer: null },
    hardware: { totalRamGb: 16, logicalCpus: 12, vramMb: 6144, tier: 'gtx1060', backend: 'cuda', scannedAt: 1 },
    // Positive placeholders: the contract requires positive timestamps and the
    // service stamps real appliedAt/updatedAt on apply.
    appliedAt: 1,
    updatedAt: 1,
    ...over
  };
}

before(async () => {
  // Real skills filesystem for the availability probe: the four
  // Software-Engineering families exist under skills/packs/<id>/SKILL.md.
  for (const family of ['aide-arch-backend-core', 'aide-debugging-discipline', 'aide-route-slice-sop', 'aide-unified-diff-repair']) {
    await fs.mkdir(path.join(skillsRoot, 'skills', 'packs', family), { recursive: true });
    await fs.writeFile(path.join(skillsRoot, 'skills', 'packs', family, 'SKILL.md'), `# ${family}\n`, 'utf8');
  }
  server = new ArchServer(workspace, path.join(workspace, 'arch-setup.log'));
  const service = createSetupService({ workspace, probes, skillsRoot });
  for (const route of routesForSetup(service, workspace)) server.route(route);
  httpServer = await server.listen(0);
  const address = httpServer.address();
  assert.ok(address && typeof address === 'object');
  base = `http://127.0.0.1:${address.port}`;
  owner = await pairFixture(server, base);
});

after(async () => {
  server.events.close();
  await server.logger.flush();
  httpServer.closeAllConnections?.();
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

type Envelope<T> = { ok: boolean; data?: T; error?: { code: string; message: string; detail?: { reason?: string } } };

async function get<T>(pathName: string): Promise<{ status: number; body: Envelope<T> }> {
  const response = await owner.request(pathName, { method: 'GET', signal: AbortSignal.timeout(30000) });
  return { status: response.status, body: (await response.json()) as Envelope<T> };
}

test('setup: a fresh workspace has no profile (plan precedes mutation, nothing fabricated)', async () => {
  const res = await get<{ profile: SetupProfileT | null }>('/api/setup/profile');
  assert.equal(res.status, 200);
  assert.equal(res.body.data!.profile, null);
});

test('setup: configuration plan composes live evidence truthfully (probes → plan)', async () => {
  const encoded = encodeURIComponent(JSON.stringify(ANSWERS));
  const res = await get<{
    plan: {
      workflowProfile: string;
      mode: string;
      providers: Array<{ id: string; status: string; routing_available: boolean }>;
      hardware: { totalRamGb: number };
      localRuntime: { state: string; runtime: boolean };
      models: Array<{ role: string; state: string }>;
      skillFamilies: Array<{ id: string; available: boolean }>;
    };
  }>(`/api/setup/plan?answers=${encoded}`);
  assert.equal(res.status, 200);
  const plan = res.body.data!.plan;
  assert.equal(plan.mode, 'LOCAL_FIRST');
  assert.match(plan.workflowProfile, /local-first/);
  assert.equal(plan.hardware.totalRamGb, 16);
  assert.equal(plan.localRuntime.runtime, true);
  assert.equal(plan.localRuntime.state, 'available');
  const ids = new Set(plan.providers.map(p => p.id));
  assert.ok(ids.has('local-runtime'));
  assert.ok(ids.has('api:prov1'));
  assert.ok(ids.has('subscription:claude'));
  const runtime = plan.providers.find(p => p.id === 'local-runtime');
  assert.equal(runtime!.status, 'not_configured');
  assert.equal(runtime!.routing_available, true);
  const states = Object.fromEntries(plan.models.map(m => [m.role, m.state]));
  assert.equal(states.planner, 'stopped', 'engine records stopped → never claim running');
  assert.equal(states.coder, 'ready', 'verified model route projects READY');
  assert.equal(states.reviewer, 'degraded', 'no engine record + no artifact → degraded, never running');
  assert.ok(plan.skillFamilies.length >= 1);
  assert.ok(plan.skillFamilies.every(f => f.available), 'packs verified on disk through the real filesystem probe');
});

test('setup: malformed or unknown answers are rejected at the contract edge (never a fabricated plan)', async () => {
  const res = await get<unknown>('/api/setup/plan?answers=' + encodeURIComponent(JSON.stringify({ mode: 'MODE_WITHOUT_ANSWERS' })));
  assert.equal(res.status, 400);
  const res2 = await get<unknown>('/api/setup/plan?answers=' + encodeURIComponent('not-json'));
  assert.equal(res2.status, 400);
});

test('setup: apply is a governed capability.write — unapproved 409, changed body 409, replay 409', async () => {
  const body = { profile: buildProfile(), expectedUpdatedAt: null };
  const unapproved = await owner.request('/api/setup/profile', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  assert.equal(unapproved.status, 409);
  const unapprovedEnvelope = (await unapproved.json()) as Envelope<unknown>;
  assert.equal(unapprovedEnvelope.error?.code, 'NOT_READY');
  assert.equal(unapprovedEnvelope.error?.detail?.reason, 'APPROVAL_REQUIRED');

  // Approve the exact first profile; a DIFFERENT profile must not be able to
  // ride the same approval.
  const headers = await owner.approve('PUT', '/api/setup/profile', body, 'task:setup-apply');
  const changed = await owner.request('/api/setup/profile', { method: 'PUT', headers, body: JSON.stringify({ profile: buildProfile({ answers: { ...ANSWERS, workType: 'Web Development' as SetupAnswersT['workType'] } }), expectedUpdatedAt: null }) });
  assert.equal(changed.status, 409, 'a changed approved body cannot reuse the approval');

  const applied = await owner.request('/api/setup/profile', { method: 'PUT', headers, body: JSON.stringify(body) });
  assert.equal(applied.status, 200);
  const appliedEnvelope = (await applied.json()) as Envelope<{ profile: SetupProfileT }>;
  assert.equal(appliedEnvelope.data!.profile.appliedAt, appliedEnvelope.data!.profile.updatedAt, 'first apply sets appliedAt = updatedAt');
  assert.ok(appliedEnvelope.data!.profile.updatedAt > 0);
  assert.equal(appliedEnvelope.data!.profile.selectedModelId, 'local:coder-m');

  const replay = await owner.request('/api/setup/profile', { method: 'PUT', headers, body: JSON.stringify(body) });
  assert.equal(replay.status, 409, 'consumed apply approval cannot replay');
});

test('setup: stale expectedUpdatedAt conflicts with the durable critical section (409 CONFLICT, no mutation)', async () => {
  const current = (await (await owner.request('/api/setup/profile', { method: 'GET' })).json()).data.profile as SetupProfileT;
  const staleAnchor = current.updatedAt - 1;
  const body = { profile: buildProfile({ answers: { ...ANSWERS, importantWorkflows: 'stale-anchor-write' } }), expectedUpdatedAt: staleAnchor };
  const headers = await owner.approve('PUT', '/api/setup/profile', body, 'task:setup-stale');
  const applied = await owner.request('/api/setup/profile', { method: 'PUT', headers, body: JSON.stringify(body) });
  assert.equal(applied.status, 409);
  assert.equal(((await applied.json()) as Envelope<unknown>).error?.code, 'CONFLICT');
  const after = (await (await owner.request('/api/setup/profile', { method: 'GET' })).json()).data.profile as SetupProfileT;
  assert.notEqual(after.answers.importantWorkflows, 'stale-anchor-write', 'conflict must leave the durable profile untouched');
});

test('setup: readiness recomputes from durable + probe state (READY ⇄ ACTION_REQUIRED ⇄ DEGRADED)', async () => {
  const pass = (checks: SetupReadinessT['checks'], id: string) => checks.find(c => c.id === id)!.ok;

  // Guarantee a genuinely fresh durable state for the initial verdict: probes
  // run serially, so an earlier apply in this file has already persisted a
  // profile. A governed reset restores the pristine slot, then readiness must
  // report ACTION_REQUIRED with zero fabrication.
  const freshReset = await owner.approve('DELETE', '/api/setup/profile', {}, 'task:setup-ready-fresh');
  const freshResetRes = await owner.request('/api/setup/profile', { method: 'DELETE', headers: freshReset, body: JSON.stringify({}) });
  assert.equal(freshResetRes.status, 200);

  // Before any profile: ACTION_REQUIRED, no fabrication.
  let r = (await (await owner.request('/api/setup/readiness', { method: 'GET' })).json()).data.readiness as SetupReadinessT;
  assert.equal(r.status, 'ACTION_REQUIRED');
  assert.equal(pass(r.checks, 'profile.persisted'), false);

  // Apply the strict local-first profile; every required check passes → READY.
  const apply = async () => {
    const anchor = (await (await owner.request('/api/setup/profile', { method: 'GET' })).json()).data.profile as SetupProfileT | null;
    const body = { profile: buildProfile(), expectedUpdatedAt: anchor?.updatedAt ?? null };
    const headers = await owner.approve('PUT', '/api/setup/profile', body, 'task:setup-ready');
    const res = await owner.request('/api/setup/profile', { method: 'PUT', headers, body: JSON.stringify(body) });
    assert.equal(res.status, 200);
  };
  await apply();
  r = (await (await owner.request('/api/setup/readiness', { method: 'GET' })).json()).data.readiness as SetupReadinessT;
  assert.equal(r.status, 'READY');
  assert.ok(pass(r.checks, 'workspace.resolves'));
  assert.ok(pass(r.checks, 'profile.persisted'));
  assert.ok(pass(r.checks, 'providers.routing'));
  assert.ok(pass(r.checks, 'models.selection'));
  assert.ok(pass(r.checks, 'verification.reachable'));
  assert.ok(pass(r.checks, 'skills.selection'));
  assert.ok(pass(r.checks, 'execution.policy'));

  // A selected artifact/process is not enough: if the live route loses its
  // verified serving endpoint, readiness must fall back to ACTION_REQUIRED.
  modelRoutesValue = [{ id: 'local:coder-m', status: 'down' }, { id: 'local:planner-m', status: 'down' }];
  r = (await (await owner.request('/api/setup/readiness', { method: 'GET' })).json()).data.readiness as SetupReadinessT;
  assert.equal(r.status, 'ACTION_REQUIRED');
  assert.equal(pass(r.checks, 'models.selection'), false);
  modelRoutesValue = [{ id: 'local:coder-m', status: 'ready' }, { id: 'local:planner-m', status: 'down' }];

  // Kill the verification probe → same profile, live state, ACTION_REQUIRED.
  auditValue = false;
  r = (await (await owner.request('/api/setup/readiness', { method: 'GET' })).json()).data.readiness as SetupReadinessT;
  assert.equal(r.status, 'ACTION_REQUIRED');
  assert.equal(pass(r.checks, 'verification.reachable'), false);
  auditValue = true;

  // Remove every connected/routing-available provider → providers.routing fails.
  viewValue = { connections: [{ id: 'subscription:claude', name: 'Claude', kind: 'subscription', status: 'unavailable', detail: 'CLI not detected', routing_available: false }], preference: 'local-first' };
  modelRoutesValue = [{ id: 'local:coder-m', status: 'down' }, { id: 'local:planner-m', status: 'down' }];
  r = (await (await owner.request('/api/setup/readiness', { method: 'GET' })).json()).data.readiness as SetupReadinessT;
  assert.equal(r.status, 'ACTION_REQUIRED');
  assert.equal(pass(r.checks, 'providers.routing'), false);
  viewValue = {
    connections: [
      { id: 'local-runtime', name: 'Local llama.cpp', kind: 'local', status: 'not_configured', detail: 'no engine started', routing_available: true },
      { id: 'api:prov1', name: 'Gateway', kind: 'api-key', status: 'connected', detail: 'key stored', routing_available: true },
      { id: 'subscription:claude', name: 'Claude', kind: 'subscription', status: 'unavailable', detail: 'CLI not detected', routing_available: false }
    ],
    preference: 'local-first'
  };
  modelRoutesValue = [{ id: 'local:coder-m', status: 'ready' }, { id: 'local:planner-m', status: 'down' }];

  // CLOUD mode without any connected provider → config check fails, ACTION_REQUIRED.
  // (routing stays usable so providers.routing alone cannot mask the config gap)
  viewValue = {
    connections: [
      { id: 'local-runtime', name: 'Local llama.cpp', kind: 'local', status: 'not_configured', detail: 'no engine started yet', routing_available: true },
      { id: 'api:prov1', name: 'Gateway', kind: 'api-key', status: 'invalid_key', detail: 'key invalid', routing_available: true }
    ],
    preference: 'local-first'
  };
  const cloudBody = { profile: buildProfile({ answers: { ...ANSWERS, mode: 'CLOUD' as SetupAnswersT['mode'], providers: ['Anthropic / Claude'] } }), expectedUpdatedAt: (await (await owner.request('/api/setup/profile', { method: 'GET' })).json()).data.profile.updatedAt };
  const cloudHeaders = await owner.approve('PUT', '/api/setup/profile', cloudBody, 'task:setup-cloud');
  await owner.request('/api/setup/profile', { method: 'PUT', headers: cloudHeaders, body: JSON.stringify(cloudBody) });
  r = (await (await owner.request('/api/setup/readiness', { method: 'GET' })).json()).data.readiness as SetupReadinessT;
  assert.equal(r.status, 'ACTION_REQUIRED');
  assert.equal(pass(r.checks, 'providers.config'), false);

  // Telegram requested but not connected → advisory check fails → DEGRADED.
  const tgBody = { profile: buildProfile({ answers: { ...ANSWERS, mode: 'LOCAL_FIRST' as SetupAnswersT['mode'], integrations: ['Telegram'] } }), expectedUpdatedAt: (await (await owner.request('/api/setup/profile', { method: 'GET' })).json()).data.profile.updatedAt };
  const tgHeaders = await owner.approve('PUT', '/api/setup/profile', tgBody, 'task:setup-telegram');
  await owner.request('/api/setup/profile', { method: 'PUT', headers: tgHeaders, body: JSON.stringify(tgBody) });
  r = (await (await owner.request('/api/setup/readiness', { method: 'GET' })).json()).data.readiness as SetupReadinessT;
  assert.equal(r.status, 'DEGRADED');
  assert.equal(pass(r.checks, 'telegram.connected'), false);

  // Telegram connects live → advisory flips back → READY.
  telegramValue = { connected: true, running: true, bot_username: 'aide_bot' };
  r = (await (await owner.request('/api/setup/readiness', { method: 'GET' })).json()).data.readiness as SetupReadinessT;
  assert.equal(r.status, 'READY');
  telegramValue = { connected: false, running: true, bot_username: null };
});

test('setup: reset is governed and honestly returns null (empty slot, no fabricated ok)', async () => {
  const unapproved = await owner.request('/api/setup/profile', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({}) });
  assert.equal(unapproved.status, 409);

  const headers = await owner.approve('DELETE', '/api/setup/profile', {}, 'task:setup-reset');
  const applied = await owner.request('/api/setup/profile', { method: 'DELETE', headers, body: JSON.stringify({}) });
  assert.equal(applied.status, 200);
  assert.equal(((await applied.json()) as Envelope<{ profile: null }>).data!.profile, null);
  const replay = await owner.request('/api/setup/profile', { method: 'DELETE', headers, body: JSON.stringify({}) });
  assert.equal(replay.status, 409, 'consumed reset approval cannot replay');

  const view = await get<{ profile: unknown }>('/api/setup/profile');
  assert.equal(view.body.data!.profile, null);
});

test('setup: restart persistence — a NEW service over the same workspace reads the durable profile', async () => {
  // Apply once more so the durable file exists, then reconstruct a fresh
  // service instance exactly like a daemon restart would.
  const current = (await (await owner.request('/api/setup/profile', { method: 'GET' })).json()).data.profile as SetupProfileT | null;
  const body = { profile: buildProfile(), expectedUpdatedAt: current?.updatedAt ?? null };
  const headers = await owner.approve('PUT', '/api/setup/profile', body, 'task:setup-persist');
  await owner.request('/api/setup/profile', { method: 'PUT', headers, body: JSON.stringify(body) });
  const applied = (await (await owner.request('/api/setup/profile', { method: 'GET' })).json()).data.profile as SetupProfileT;

  const restarted = createSetupService({ workspace, probes, skillsRoot });
  const read = await restarted.getProfile();
  assert.ok(read !== null, 'profile survives across service instances via .aide/setup-profile.json');
  assert.deepEqual(read.answers, applied!.answers);
  assert.equal(read.selectedModelId, applied!.selectedModelId);
  assert.deepEqual(read.roles, applied!.roles);
  assert.equal(read.updatedAt, applied!.updatedAt);
});
