// Resident Awareness Layer — Slice 2 acceptance tests.
// Namespace validity, constitution measurement, candidate cap, routing matrix,
// negative routing, lazy body loading + cap, resident/worker firewall,
// bounded Arsenal filtering, empty/degraded honesty, security, and the
// no-live-wiring gate.
//
// Hermetic: fixture roots live in os.tmpdir(); the only shared in-box inputs are
// the canonical resident namespace (skills/resident-sops/) and the accepted
// Slice-1 projection module (read-only).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  loadResidentCatalog,
  loadResidentConstitution,
  discoverResidentSops,
  loadResidentSopBody,
  loadResidentSopBodies,
  DEFAULT_CANDIDATE_LIMIT,
  MAX_SELECTED_BODIES
} from '../../node/src/services/resident-sops.mjs';
import {
  filterArsenalDescriptors,
  compactArsenalSummary,
  DEFAULT_FILTER_LIMIT,
  MAX_FILTER_LIMIT
} from '../../node/src/services/resident-arsenal-query.mjs';
import type { ResidentSopError } from '../../node/src/services/resident-sops.mjs';
import type { ArsenalDescriptor } from '../../node/src/services/resident-arsenal.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function errorCode(error: unknown): string | undefined {
  return (error as Partial<ResidentSopError> | undefined)?.code;
}

async function writeJson(file: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(value, null, 2), 'utf8');
}

function fixtureCatalog(entries: Array<Record<string, unknown>>) {
  return { schema_version: '1', namespace: 'resident', sops: entries };
}

function baseEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: 'resident.fixture-sop',
    role: 'resident',
    purpose: 'fixture purpose',
    use_when: ['fixture trigger'],
    requires: ['fixture input'],
    produces: 'fixture output',
    authority_effect: 'none',
    body_ref: 'skills/resident-sops/resident.fixture-sop.md',
    ...overrides
  };
}

test('namespace — catalog is canonical, semantic and resident-only', async () => {
  const catalog = await loadResidentCatalog({ root: REPO });
  assert.ok(catalog.sops.length >= 20, 'expected a bounded core set of resident SOPs');
  const ids = new Set<string>();
  for (const sop of catalog.sops) {
    assert.match(sop.id, /^resident\.[a-z][a-z-]+$/);
    assert.equal(sop.role, 'resident');
    assert.ok(!ids.has(sop.id), 'duplicate id ' + sop.id);
    ids.add(sop.id);
    assert.ok(sop.body_ref.startsWith('skills/resident-sops/'));
    assert.ok(!sop.body_ref.includes('..'));
    await fs.access(path.join(REPO, sop.body_ref));
    assert.equal(typeof sop.authority_effect, 'string');
    assert.ok(sop.use_when.length >= 2, 'routing metadata must carry use_when triggers: ' + sop.id);
  }
});

test('constitution — measured, bounded, invariant-bearing', async () => {
  const constitution = await loadResidentConstitution({ root: REPO });
  assert.ok(constitution.tokens >= 50 && constitution.tokens <= 140, 'constitution tokens out of the tiny-artifact range: ' + constitution.tokens);
  assert.ok(constitution.text.includes('Canonical truth outranks recollection'));
  assert.ok(constitution.text.includes('Recommendation is not authority'));
  assert.ok(constitution.text.includes('Never claim execution until it is observed'));
  assert.ok(constitution.text.includes('Unknown stays UNKNOWN'));
  assert.ok(!/worker methodology|planner|coder/i.test(constitution.text), 'constitution must not carry worker methodology');
});

test('candidate cap — never more than three, request limit cannot raise it', async () => {
  const noisy = 'worker failed stuck escalate handoff status evidence approval workflow select tools cloud';
  const result = await discoverResidentSops(noisy, { root: REPO });
  assert.ok(result.count <= DEFAULT_CANDIDATE_LIMIT);
  assert.ok(result.capped === true);
  const raised = await discoverResidentSops(noisy, { root: REPO, limit: 10 });
  assert.ok(raised.count <= DEFAULT_CANDIDATE_LIMIT, 'limit must clamp to the hard cap');
});

test('routing matrix — expected resident families', async () => {
  const cases: Array<{ request: string; expectAny: string[]; requireAnyOf?: string[] }> = [
    { request: 'I want to build an Android app.', expectAny: ['resident.onboard-user', 'resident.clarify-intent', 'resident.create-project'] },
    { request: 'Continue the project from where we left off.', expectAny: ['resident.resume-project'] },
    { request: 'The coding worker failed.', expectAny: ['resident.handle-worker-failure'], requireAnyOf: ['resident.prepare-handoff', 'resident.escalate-task'] },
    { request: 'Did the implementation actually pass verification?', expectAny: ['resident.interpret-evidence'] },
    { request: 'Deploy it now.', expectAny: ['resident.request-approval'] },
    { request: 'Where are we?', expectAny: ['resident.report-status', 'resident.recommend-next-step'] },
    { request: 'Fix this function.', expectAny: ['resident.select-worker', 'resident.select-methodology', 'resident.escalate-task'] }
  ];
  for (const entry of cases) {
    const result = await discoverResidentSops(entry.request, { root: REPO });
    const ids = result.candidates.map(candidate => candidate.id);
    for (const id of ids) assert.match(id, /^resident\./);
    assert.ok(ids.some(id => entry.expectAny.includes(id)), entry.request + ' -> expected one of ' + entry.expectAny.join(', ') + '; got ' + JSON.stringify(ids));
    if (entry.requireAnyOf) {
      assert.ok(ids.some(id => entry.requireAnyOf!.includes(id)), entry.request + ' -> expected one of ' + entry.requireAnyOf.join(', ') + '; got ' + JSON.stringify(ids));
    }
  }
});

test('negative routing — no false candidates, no implied permissions', async () => {
  const status = await discoverResidentSops('Where are we?', { root: REPO });
  const statusIds = status.candidates.map(candidate => candidate.id);
  assert.ok(!statusIds.includes('resident.onboard-user'));
  assert.ok(!statusIds.includes('resident.create-project'));

  const evidence = await discoverResidentSops('Did the implementation actually pass verification?', { root: REPO });
  const evidenceIds = evidence.candidates.map(candidate => candidate.id);
  assert.ok(!evidenceIds.includes('resident.create-project'));
  assert.ok(!evidenceIds.includes('resident.onboard-user'));

  const tool = await discoverResidentSops('The tool failed.', { root: REPO });
  const toolIds = tool.candidates.map(candidate => candidate.id);
  assert.ok(toolIds.includes('resident.handle-tool-failure'));
  assert.ok(!toolIds.includes('resident.handle-provider-failure'), 'tool failure must not load provider failure: ' + JSON.stringify(toolIds));

  const worker = await discoverResidentSops('The coding worker failed.', { root: REPO });
  for (const candidate of worker.candidates) {
    assert.match(candidate.id, /^resident\./);
    assert.ok(!/^(coder|planner|reviewer|worker)\./.test(candidate.id));
  }

  const approval = await discoverResidentSops('Deploy it now.', { root: REPO });
  const request = approval.candidates.find(candidate => candidate.id === 'resident.request-approval');
  assert.ok(request, 'expected resident.request-approval');
  assert.equal(request!.authority_effect, 'may-request-approval');
  for (const candidate of approval.candidates) {
    assert.equal(Object.prototype.hasOwnProperty.call(candidate, 'approved'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(candidate, 'granted'), false);
    assert.ok(!['granted', 'approved'].includes(candidate.authority_effect));
  }

  const cloud = await discoverResidentSops('Run this on a cloud worker.', { root: REPO });
  const cloudIds = cloud.candidates.map(candidate => candidate.id);
  assert.ok(cloudIds.includes('resident.local-vs-cloud') || cloudIds.includes('resident.select-worker'));
  assert.ok(!/(openai|anthropic|groq|mistral|openrouter|gemini)/i.test(JSON.stringify(cloud.candidates)), 'cloud routing must not hard-code a provider');
});

test('body loading — lazy, by id, bounded, fail-safe', async () => {
  const body = await loadResidentSopBody('resident.prepare-handoff', { root: REPO });
  assert.equal(body.id, 'resident.prepare-handoff');
  assert.ok(body.tokens > 0);
  assert.ok(body.body.includes('# resident.prepare-handoff'));

  await assert.rejects(() => loadResidentSopBody('resident.nonexistent', { root: REPO }), (error: unknown) => errorCode(error) === 'NOT_FOUND');
  await assert.rejects(() => loadResidentSopBody('coder.typescript-debugging', { root: REPO }), (error: unknown) => errorCode(error) === 'INVALID_ID');
  await assert.rejects(() => loadResidentSopBody('aide-cipher-house-model', { root: REPO }), (error: unknown) => errorCode(error) === 'INVALID_ID');
  await assert.rejects(() => loadResidentSopBody('../skills/packs/agent-notes/SKILL.md', { root: REPO }), (error: unknown) => errorCode(error) === 'INVALID_ID');
});

test('body cap — at most two bodies per decision', async () => {
  const two = await loadResidentSopBodies(['resident.report-status', 'resident.recommend-next-step'], { root: REPO });
  assert.equal(two.length, 2);
  await assert.rejects(
    () => loadResidentSopBodies(['resident.report-status', 'resident.recommend-next-step', 'resident.explain-blocker'], { root: REPO }),
    (error: unknown) => errorCode(error) === 'BODY_CAP_EXCEEDED'
  );
  assert.equal(MAX_SELECTED_BODIES, 2);
});

test('resident/worker firewall — structural separation', async () => {
  const catalog = await loadResidentCatalog({ root: REPO });
  for (const sop of catalog.sops) {
    assert.ok(!/^(coder|planner|reviewer|worker|veritas|aide|pipeline|post-training)\./.test(sop.id), 'worker methodology leaked into the resident namespace: ' + sop.id);
  }
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'aide-resident-firewall-'));
  try {
    await writeJson(path.join(root, 'skills', 'resident-sops', 'catalog.json'), fixtureCatalog([baseEntry({ role: 'coder' })]));
    await assert.rejects(() => loadResidentCatalog({ root }), (error: unknown) => errorCode(error) === 'CATALOG_INVALID');
    await writeJson(path.join(root, 'skills', 'resident-sops', 'catalog.json'), fixtureCatalog([baseEntry({ id: 'coder.debug' })]));
    await assert.rejects(() => loadResidentCatalog({ root }), (error: unknown) => errorCode(error) === 'CATALOG_INVALID');
    await writeJson(path.join(root, 'skills', 'resident-sops', 'catalog.json'), fixtureCatalog([baseEntry({ body_ref: 'skills/resident-sops/../packs/agent-notes/SKILL.md' })]));
    await assert.rejects(() => loadResidentCatalog({ root }), (error: unknown) => errorCode(error) === 'CATALOG_INVALID');
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('degraded fixture — missing body and empty catalog fail safely', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'aide-resident-degraded-'));
  try {
    await writeJson(path.join(root, 'skills', 'resident-sops', 'catalog.json'), fixtureCatalog([baseEntry()]));
    await assert.rejects(() => loadResidentSopBody('resident.fixture-sop', { root }), (error: unknown) => errorCode(error) === 'BODY_UNAVAILABLE');
    await fs.rm(path.join(root, 'skills', 'resident-sops', 'catalog.json'));
    await assert.rejects(() => loadResidentCatalog({ root }), (error: unknown) => errorCode(error) === 'CATALOG_UNAVAILABLE');
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('arsenal filter — bounded, correct, never a full dump', () => {
  const descriptors: ArsenalDescriptor[] = [
    { id: 'model-a', kind: 'MODEL', availability: 'READY', roles: ['coder'], context_limit: 4096, location: 'local' },
    { id: 'model-b', kind: 'MODEL', availability: 'NOT_INSTALLED', roles: ['chat'], location: 'local' },
    { id: 'plugin-a', kind: 'PLUGIN', availability: 'READY', capabilities: ['workspace.read'], location: 'local' },
    { id: 'device', kind: 'DEVICE', availability: 'UNKNOWN' },
    { id: 'provider-a', kind: 'PROVIDER', availability: 'DISCONNECTED', location: 'cloud', capabilities: ['api:openai-compatible'] }
  ];
  const coding = filterArsenalDescriptors(descriptors, { kind: 'MODEL', availability: 'READY', role: 'coder' });
  assert.deepEqual(coding.returned.map(d => d.id), ['model-a']);
  assert.equal(coding.matched, 1);
  assert.equal(coding.truncated, false);

  const caps = filterArsenalDescriptors(descriptors, { capability: 'workspace' });
  assert.deepEqual(caps.returned.map(d => d.id), ['plugin-a']);

  const cloud = filterArsenalDescriptors(descriptors, { location: 'cloud' });
  assert.deepEqual(cloud.returned.map(d => d.id), ['provider-a']);

  const unknown = filterArsenalDescriptors(descriptors, { availability: 'UNKNOWN' });
  assert.deepEqual(unknown.returned.map(d => d.id), ['device']);

  const many: ArsenalDescriptor[] = Array.from({ length: 120 }, (_, index) => ({ id: 'skill-' + index, kind: 'SKILL', availability: 'READY', location: 'local' }));
  const capped = filterArsenalDescriptors(many, { kind: 'SKILL' }, { limit: 1000 });
  assert.equal(capped.limit, MAX_FILTER_LIMIT);
  assert.equal(capped.returned.length, MAX_FILTER_LIMIT);
  assert.equal(capped.matched, 120);
  assert.equal(capped.truncated, true);
  assert.ok(capped.returned.length < many.length, 'must never dump the full set');

  const summary = compactArsenalSummary({ summary: { total: 348, by_kind: { SKILL: 292 }, by_availability: { READY: 318 } } } as never);
  assert.deepEqual(summary, { total: 348, by_kind: { SKILL: 292 }, by_availability: { READY: 318 } });
  assert.equal(DEFAULT_FILTER_LIMIT, 20);
});

test('empty/degraded — no fabrication, honest fallback', async () => {
  const noMatch = await discoverResidentSops('xyzzy plugh quux', { root: REPO });
  assert.equal(noMatch.count, 0);
  assert.equal(noMatch.fallback, false);
  assert.ok(noMatch.reason);

  const stopwordsOnly = await discoverResidentSops('where are we?', { root: REPO });
  assert.equal(stopwordsOnly.fallback, true);
  const ids = stopwordsOnly.candidates.map(candidate => candidate.id);
  assert.deepEqual(ids, ['resident.report-status', 'resident.recommend-next-step']);

  const impossible = filterArsenalDescriptors([], { kind: 'MODEL' });
  assert.equal(impossible.matched, 0);
  assert.deepEqual(impossible.returned, []);
});

test('security — no secrets, no provider hard-coding in the namespace', async () => {
  const catalog = await loadResidentCatalog({ root: REPO });
  const constitution = await loadResidentConstitution({ root: REPO });
  const texts = [JSON.stringify(catalog), constitution.text];
  for (const sop of catalog.sops) texts.push((await loadResidentSopBody(sop.id, { root: REPO })).body);
  const joined = texts.join('\n');
  assert.ok(!/sk-[A-Za-z0-9-]{8,}/.test(joined), 'key-like material in the resident namespace');
  assert.ok(!/password\s*[:=]|secret\s*[:=]|token\s*[:=]/i.test(joined), 'credential-shaped assignment in the resident namespace');
  assert.ok(!/(openai|anthropic|groq|mistral|openrouter|gemini)/i.test(JSON.stringify(catalog)), 'provider hard-coding in resident routing metadata');
});

test('no live wiring — production paths do not import the slice-2 facilities', async () => {
  const productionFiles = [
    'node/src/services/chat-context.ts',
    'node/src/openapi.ts',
    'node/src/routes/resident.ts',
    'node/src/services/agent-loop.mjs',
    'node/src/server.ts',
    'harness/scaffold.mjs'
  ];
  for (const relative of productionFiles) {
    let text = '';
    try {
      text = await fs.readFile(path.join(REPO, relative), 'utf8');
    } catch {
      continue;
    }
    assert.ok(!text.includes('resident-sops'), relative + ' must not import the resident SOP facilities');
    assert.ok(!text.includes('resident-arsenal-query'), relative + ' must not import the arsenal query facility');
  }
});
