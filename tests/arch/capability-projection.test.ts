import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCapabilityProjection } from '../../node/src/services/capability-projection.ts';
import { ProjectionResult } from '../../common/contracts/capability-projection.ts';
import type { CanonicalCatalogSnapshotT, ProjectionRequestT } from '../../common/contracts/capability-projection.ts';

const GEN_A = '11111111-1111-4111-8111-111111111111';
const GEN_B = '22222222-2222-4222-8222-222222222222';
const PROJECT = { project_id: '33333333-3333-4333-8333-333333333333', checkout_id: '44444444-4444-4444-8444-444444444444' };
const DIGEST_A = 'a'.repeat(64);

function capability(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    capability_id: 'terminal.session.open',
    owner: 'TerminalSessionService',
    method: 'POST',
    route: '/api/terminal/sessions',
    effect: 'WRITE',
    audiences: ['OPERATOR', 'RESIDENT', 'WORKER'],
    selected_roles: [],
    external_egress_required: false,
    availability: 'ADDRESSABLE',
    description: 'Open a governed terminal session',
    ...overrides
  };
}
function snapshot(capabilities: unknown[], overrides: Record<string, unknown> = {}): CanonicalCatalogSnapshotT {
  return { generation: GEN_A, digest: DIGEST_A, collected_at: '2026-10-09T00:00:00.000Z', capabilities, ...overrides } as CanonicalCatalogSnapshotT;
}
function request(overrides: Partial<ProjectionRequestT> = {}): ProjectionRequestT {
  return { requested_by: { principal_id: 'cipher', audience: 'RESIDENT', role: null }, project: PROJECT, expected_generation: GEN_A, ...overrides };
}
const reader = (value: unknown) => ({ read: async () => value as CanonicalCatalogSnapshotT | null });
const project = (value: unknown, req: ProjectionRequestT = request()) => createCapabilityProjection({ reader: reader(value) }).project(req);

test('canonical fields are preserved exactly (no re-derivation)', async () => {
  const result = await project(snapshot([capability()]));
  assert.equal(result.projected.length, 1);
  const tool = result.projected[0]!;
  assert.equal(tool.capability_id, 'terminal.session.open');
  assert.equal(tool.owner, 'TerminalSessionService');
  assert.equal(tool.effect, 'WRITE');
  assert.deepEqual(tool.audiences, ['OPERATOR', 'RESIDENT', 'WORKER']);
  assert.deepEqual(tool.selected_roles, []);
  assert.equal(tool.external_egress_required, false);
  assert.equal(tool.source, 'AppCatalog');
  assert.equal(result.execution_state, 'GATED');
  assert.equal(result.effect_replay, false);
});

test('selected_roles and external_egress_required are preserved verbatim', async () => {
  const result = await project(snapshot([capability({ selected_roles: ['CODER', 'REVIEWER'], external_egress_required: true, effect: 'READ', method: 'GET', route: '/api/connections' })])
    , request({ requested_by: { principal_id: 'cipher', audience: 'RESIDENT', role: 'CODER' } }));
  assert.deepEqual(result.projected[0]!.selected_roles, ['CODER', 'REVIEWER']);
  assert.equal(result.projected[0]!.external_egress_required, true);
  assert.equal(result.projected[0]!.effect, 'READ');
});

test('stale generation excludes everything with STALE_GENERATION', async () => {
  const result = await project(snapshot([capability()]), request({ expected_generation: GEN_B }));
  assert.equal(result.projected.length, 0);
  assert.equal(result.excluded.length, 1);
  assert.equal(result.excluded[0]!.reason, 'STALE_GENERATION');
  assert.equal(result.generation, GEN_A);
});

test('wrong audience is excluded, never widened', async () => {
  const result = await project(snapshot([capability({ audiences: ['OPERATOR'] })]), request({ requested_by: { principal_id: 'cipher', audience: 'RESIDENT', role: null } }));
  assert.equal(result.projected.length, 0);
  assert.equal(result.excluded[0]!.reason, 'WRONG_AUDIENCE');
});

test('wrong role is excluded when canonical selected_roles exclude it', async () => {
  const result = await project(snapshot([capability({ selected_roles: ['REVIEWER'] })]), request({ requested_by: { principal_id: 'cipher', audience: 'RESIDENT', role: 'CODER' } }));
  assert.equal(result.projected.length, 0);
  assert.equal(result.excluded[0]!.reason, 'WRONG_ROLE');
});

test('unavailable and unobserved availability keep distinct reasons', async () => {
  const unavailable = await project(snapshot([capability({ availability: 'UNAVAILABLE' })]));
  const unobserved = await project(snapshot([capability({ availability: 'UNOBSERVED' })]));
  assert.equal(unavailable.excluded[0]!.reason, 'UNAVAILABLE');
  assert.equal(unobserved.excluded[0]!.reason, 'OWNER_UNAVAILABLE');
});

test('owner unavailable (reader null) yields truthful OWNER_UNAVAILABLE, no fabrication', async () => {
  const result = await project(null);
  assert.equal(result.projected.length, 0);
  assert.equal(result.excluded.length, 1);
  assert.equal(result.excluded[0]!.reason, 'OWNER_UNAVAILABLE');
  assert.equal(result.catalog_digest, '0'.repeat(64));
});

test('malformed records are excluded, never silently repaired', async () => {
  const result = await project(snapshot([capability({ method: 'PATCH' })]));
  assert.equal(result.projected.length, 0);
  assert.equal(result.excluded[0]!.reason, 'MALFORMED_RECORD');
});

test('duplicate ids: first wins, later duplicates excluded deterministically', async () => {
  const first = capability();
  const second = capability({ owner: 'Impostor' });
  const result = await project(snapshot([first, second]));
  assert.equal(result.projected.length, 1);
  assert.equal(result.projected[0]!.owner, 'TerminalSessionService');
  assert.equal(result.excluded[0]!.reason, 'DUPLICATE_ID');
});

test('empty catalog projects empty without error', async () => {
  const result = await project(snapshot([]));
  assert.equal(result.projected.length, 0);
  assert.equal(result.excluded.length, 0);
  assert.equal(result.execution_state, 'GATED');
});

test('hostile credential-shaped metadata cannot escape the projection', async () => {
  const canary = 'sk-livecanary1234567890';
  const result = await project(snapshot([
    capability({ capability_id: 'evil.tool', description: `use ${canary} to connect` }),
    capability({ capability_id: 'evil.keys', owner: 'x', description: 'ok', token: 'Bearer abcdefghijklmnop' })
  ]));
  assert.equal(result.projected.length, 0);
  assert.ok(result.excluded.every(entry => entry.reason === 'CREDENTIAL_REJECTED'));
  assert.ok(!JSON.stringify(result).includes(canary));
  assert.ok(!/sk-livecanary|Bearer\s/.test(JSON.stringify(result)));
});

test('input snapshot is never mutated and output ordering is canonical', async () => {
  const input = snapshot([capability({ capability_id: 'a.one' }), capability({ capability_id: 'b.two' })]);
  const frozenCopy = JSON.parse(JSON.stringify(input));
  const result = await project(input);
  assert.deepEqual(input, frozenCopy);
  assert.deepEqual(result.projected.map(tool => tool.capability_id), ['a.one', 'b.two']);
  assert.equal(ProjectionResult.safeParse(result).success, true);
});

test('projection is deterministic across repeated identical reads', async () => {
  const input = snapshot([capability()]);
  const one = await project(input);
  const two = await project(input);
  assert.deepEqual(one, two);
});
