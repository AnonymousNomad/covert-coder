// Resident Awareness Layer — Slice 3 acceptance tests.
// Awareness envelope compiler: canonical ordering, section accounting, hard
// budget fail-closed, bulk-injection guards, capability-detail budget,
// selection prompt protocol, untrusted-selection validation, fallback rule,
// duplication analysis, descriptor sanitization, and the no-live-wiring gate.
//
// Hermetic: no engine, no inference. Fixtures live in os.tmpdir(); the resident
// namespace and Slice-1/2 modules are read-only inputs.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadResidentCatalog, loadResidentConstitution, loadResidentSopBodies, loadResidentSopBody } from '../../node/src/services/resident-sops.mjs';
import {
  compileAwarenessEnvelope,
  selectCapabilityDetails,
  buildSopSelectionPrompt,
  parseAndValidateSopSelection,
  resolveSopFallback,
  analyzeEnvelopeDuplication,
  ENVELOPE_HARD_MAX_TOKENS,
  CAPABILITY_DETAIL_BUDGET_TOKENS
} from '../../node/src/services/resident-envelope.mjs';
import type { ResidentSopCatalog, ResidentSopCandidate } from '../../node/src/services/resident-sops.mjs';
import type { ArsenalDescriptor } from '../../node/src/services/resident-arsenal.mjs';
import type { ResidentEnvelopeError } from '../../node/src/services/resident-envelope.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function errorCode(error: unknown): string | undefined {
  return (error as Partial<ResidentEnvelopeError> | undefined)?.code;
}

function candidate(catalog: ResidentSopCatalog, id: string, score = 5): ResidentSopCandidate {
  const sop = catalog.sops.find(entry => entry.id === id);
  assert.ok(sop, 'fixture candidate must exist: ' + id);
  return { ...sop, score };
}

async function realistic() {
  const catalog = await loadResidentCatalog({ root: REPO });
  const constitution = await loadResidentConstitution({ root: REPO });
  const candidates = [candidate(catalog, 'resident.handle-worker-failure', 5.151), candidate(catalog, 'resident.prepare-handoff', 5.151)];
  const sopBodies = await loadResidentSopBodies(candidates.map(entry => entry.id), { root: REPO, catalog });
  return {
    catalog,
    constitution,
    candidates,
    sopBodies,
    base: {
      operatorRequest: 'The coding worker failed.',
      constitution,
      continuityProjection: 'project: covert-production\nobjective: review the 23 uncommitted changes\nstage: REVIEW',
      taskAuthority: 'authority: no approval recorded for push operations',
      taskEvidence: 'evidence: ABSENT (no verification record)',
      arsenalSummary: { total: 348, by_kind: { SKILL: 292, MODEL: 10 }, by_availability: { READY: 318 } },
      sopCandidates: candidates,
      sopBodies
    }
  };
}

test('compiler — canonical order, section accounting, system/request split', async () => {
  const { base } = await realistic();
  const envelope = await compileAwarenessEnvelope(base);
  assert.deepEqual(envelope.sections.map(section => section.id), [
    'CONSTITUTION', 'CONTINUITY', 'TASK_AUTHORITY', 'TASK_EVIDENCE', 'ARSENAL_SUMMARY', 'SOP_BODIES', 'OPERATOR_REQUEST'
  ]);
  assert.ok(envelope.text.endsWith('The coding worker failed.'));
  assert.ok(!envelope.systemText.includes('The coding worker failed.'));
  assert.ok(envelope.measurements.total_tokens <= ENVELOPE_HARD_MAX_TOKENS);
  assert.ok(envelope.measurements.system_tokens > 0);
  assert.ok(envelope.measurements.system_tokens < envelope.measurements.total_tokens);
  const sectionSum = envelope.measurements.sections.reduce((sum, section) => sum + section.tokens, 0);
  assert.ok(envelope.measurements.total_tokens <= sectionSum + 40, 'join overhead must stay bounded');
  for (const section of envelope.sections) assert.ok(section.tokens > 0);
});

test('compiler — candidate metadata variant is measurable and optional', async () => {
  const { base } = await realistic();
  const without = await compileAwarenessEnvelope(base);
  const withMeta = await compileAwarenessEnvelope({ ...base, includeCandidateMetadata: true });
  assert.ok(!without.sections.some(section => section.id === 'CANDIDATE_METADATA'));
  assert.ok(withMeta.sections.some(section => section.id === 'CANDIDATE_METADATA'));
  assert.ok(withMeta.measurements.total_tokens > without.measurements.total_tokens);
});

test('guards — bulk injection and oversized inputs fail closed', async () => {
  const { constitution, catalog, candidates } = await realistic();
  const four = [...candidates, candidate(catalog, 'resident.escalate-task'), candidate(catalog, 'resident.report-status')];
  await assert.rejects(() => compileAwarenessEnvelope({ operatorRequest: 'x', constitution, sopCandidates: four }), (error: unknown) => errorCode(error) === 'CANDIDATE_BULK');
  const third = await loadResidentSopBody('resident.escalate-task', { root: REPO, catalog });
  await assert.rejects(() => compileAwarenessEnvelope({ operatorRequest: 'x', constitution, sopCandidates: four.slice(0, 3), sopBodies: [third, third, third] }), (error: unknown) => errorCode(error) === 'BODY_BULK');
  await assert.rejects(() => compileAwarenessEnvelope({ operatorRequest: 'x', constitution, sopCandidates: candidates, sopBodies: [third] }), (error: unknown) => errorCode(error) === 'BODY_NOT_IN_CANDIDATES');
  await assert.rejects(() => compileAwarenessEnvelope({ operatorRequest: 'x', constitution, capability: { descriptors: [], budgetTokens: CAPABILITY_DETAIL_BUDGET_TOKENS + 1 } }), (error: unknown) => errorCode(error) === 'CAPABILITY_BUDGET');
  const many: ArsenalDescriptor[] = Array.from({ length: 501 }, (_, index) => ({ id: 'm-' + index, kind: 'MODEL', availability: 'READY' }));
  await assert.rejects(() => compileAwarenessEnvelope({ operatorRequest: 'x', constitution, capability: { descriptors: many } }), (error: unknown) => errorCode(error) === 'ARSENAL_BULK');
  await assert.rejects(() => compileAwarenessEnvelope({ operatorRequest: 'x'.repeat(4001), constitution }), (error: unknown) => errorCode(error) === 'REQUEST_TOO_LARGE');
  await assert.rejects(() => compileAwarenessEnvelope({ operatorRequest: '', constitution }), (error: unknown) => errorCode(error) === 'REQUEST_REQUIRED');
});

test('hard envelope budget — fail closed with measurement detail', async () => {
  const { constitution } = await realistic();
  const huge = ('continuity line with many tokens repeated for pressure '.repeat(3) + '\n').repeat(120);
  await assert.rejects(
    () => compileAwarenessEnvelope({ operatorRequest: 'x', constitution, continuityProjection: huge }),
    (error: unknown) => {
      if (errorCode(error) !== 'ENVELOPE_BUDGET') return false;
      const detail = (error as { detail?: { measurements?: { total_tokens?: number } } }).detail;
      return typeof detail?.measurements?.total_tokens === 'number' && detail.measurements.total_tokens > ENVELOPE_HARD_MAX_TOKENS;
    }
  );
});

test('capability budget — complete descriptors, deterministic order, omitted recorded, taint dropped', async () => {
  const descriptors: ArsenalDescriptor[] = Array.from({ length: 10 }, (_, index) => ({
    id: 'model-' + String(index).padStart(2, '0'),
    kind: 'MODEL',
    availability: index < 3 ? 'READY' : 'NOT_INSTALLED',
    roles: ['coder'],
    context_limit: 4096,
    location: 'local'
  }));
  const big = await selectCapabilityDetails(descriptors, { budgetTokens: CAPABILITY_DETAIL_BUDGET_TOKENS });
  assert.ok(big.selected.length >= 3);
  assert.equal(big.selected[0]!.availability, 'READY');
  for (const descriptor of big.selected) assert.equal(descriptor.kind, 'MODEL');
  const again = await selectCapabilityDetails(descriptors, { budgetTokens: CAPABILITY_DETAIL_BUDGET_TOKENS });
  assert.deepEqual(big, again);
  const small = await selectCapabilityDetails(descriptors, { budgetTokens: 80 });
  assert.ok(small.tokens <= 80);
  assert.ok(small.omitted >= big.omitted);
  const tainted = [{ ...descriptors[0]!, secret: 'sk-SENTINEL-0000-DO-NOT-LEAK' }] as unknown as ArsenalDescriptor[];
  const clean = await selectCapabilityDetails(tainted, { budgetTokens: CAPABILITY_DETAIL_BUDGET_TOKENS });
  assert.ok(!JSON.stringify(clean.selected).includes('SENTINEL'), 'non-canonical fields must be dropped');
  await assert.rejects(() => selectCapabilityDetails(descriptors, { budgetTokens: CAPABILITY_DETAIL_BUDGET_TOKENS + 1 }), (error: unknown) => errorCode(error) === 'CAPABILITY_BUDGET');
});

test('capability details — conditional section, bounded, omitted note', async () => {
  const { base } = await realistic();
  const descriptors: ArsenalDescriptor[] = Array.from({ length: 12 }, (_, index) => ({
    id: 'model-' + String(index).padStart(2, '0'), kind: 'MODEL', availability: 'READY', roles: ['coder'], location: 'local'
  }));
  const without = await compileAwarenessEnvelope(base);
  assert.ok(!without.sections.some(section => section.id === 'CAPABILITY_DETAILS'));
  const withDetails = await compileAwarenessEnvelope({ ...base, capability: { descriptors, filter: { kind: 'MODEL', availability: 'READY' } } });
  assert.ok(withDetails.sections.some(section => section.id === 'CAPABILITY_DETAILS'));
  assert.ok(withDetails.capability !== null);
  assert.ok(withDetails.capability!.tokens <= CAPABILITY_DETAIL_BUDGET_TOKENS);
  assert.ok(withDetails.capability!.selected.length <= 25);
  assert.ok(withDetails.measurements.total_tokens <= ENVELOPE_HARD_MAX_TOKENS);
});

test('selection prompt — protocol, caps, empty handling', async () => {
  const { catalog, candidates } = await realistic();
  const prompt = buildSopSelectionPrompt({ request: 'The coding worker failed.', candidates, continuity: 'stage: REVIEW' });
  assert.ok(prompt !== null);
  assert.ok(prompt!.includes('[TASK]'));
  assert.ok(prompt!.includes('[CANONICAL STATE]'));
  assert.ok(prompt!.includes('[RESIDENT METHODOLOGY CANDIDATES]'));
  assert.ok(prompt!.includes('resident.handle-worker-failure'));
  assert.ok(prompt!.includes('SELECT: resident.<id>'));
  assert.equal(buildSopSelectionPrompt({ request: 'x', candidates: [] }), null);
  const four = [...candidates, candidate(catalog, 'resident.escalate-task'), candidate(catalog, 'resident.report-status')];
  assert.throws(() => buildSopSelectionPrompt({ request: 'x', candidates: four }), (error: unknown) => errorCode(error) === 'CANDIDATE_BULK');
});

test('selection validation — accepts exact, rejects everything else', async () => {
  const { catalog } = await realistic();
  const three = [candidate(catalog, 'resident.handle-worker-failure'), candidate(catalog, 'resident.prepare-handoff'), candidate(catalog, 'resident.escalate-task')];
  const options = { catalog, root: REPO };

  const one = await parseAndValidateSopSelection('SELECT: resident.handle-worker-failure', three, options);
  assert.deepEqual(one.selected, ['resident.handle-worker-failure']);
  assert.equal(one.status, 'OK');

  const two = await parseAndValidateSopSelection('SELECT: resident.handle-worker-failure\nSELECT: resident.prepare-handoff', three, options);
  assert.equal(two.selected.length, 2);
  assert.equal(two.status, 'OK');

  const overCap = await parseAndValidateSopSelection('SELECT: resident.handle-worker-failure\nSELECT: resident.prepare-handoff\nSELECT: resident.escalate-task', three, options);
  assert.equal(overCap.selected.length, 2);
  assert.equal(overCap.status, 'PARTIAL');
  assert.ok(overCap.rejected.some(entry => entry.reason === 'OVER_CAP'));

  const duplicate = await parseAndValidateSopSelection('SELECT: resident.handle-worker-failure\nSELECT: resident.handle-worker-failure', three, options);
  assert.equal(duplicate.selected.length, 1);
  assert.ok(duplicate.rejected.some(entry => entry.reason === 'DUPLICATE'));

  const invented = await parseAndValidateSopSelection('SELECT: resident.ghost-sop', three, options);
  assert.equal(invented.selected.length, 0);
  assert.equal(invented.status, 'ALL_REJECTED');
  assert.ok(invented.rejected.some(entry => entry.reason === 'UNKNOWN_ID'));

  const worker = await parseAndValidateSopSelection('SELECT: coder.typescript-debugging', three, options);
  assert.ok(worker.rejected.some(entry => entry.reason === 'NOT_RESIDENT_NAMESPACE'));

  const pathMaterial = await parseAndValidateSopSelection('SELECT: ../skills/packs/agent-notes/SKILL.md', three, options);
  assert.ok(pathMaterial.rejected.some(entry => entry.reason === 'PATH_MATERIAL'));
  assert.equal(pathMaterial.selected.length, 0);

  const prose = await parseAndValidateSopSelection('I think resident.handle-worker-failure applies here.', three, options);
  assert.equal(prose.status, 'NO_SELECTION');
  assert.equal(prose.selected.length, 0);

  const notInSet = await parseAndValidateSopSelection('SELECT: resident.report-status', three, options);
  assert.ok(notInSet.rejected.some(entry => entry.reason === 'NOT_IN_CANDIDATE_SET'));
});

test('selection validation — unavailable body is rejected without loading', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'aide-envelope-'));
  try {
    const entry = {
      id: 'resident.fixture-sop', role: 'resident', purpose: 'fixture', use_when: ['fixture'], requires: [],
      produces: 'x', authority_effect: 'none', body_ref: 'skills/resident-sops/resident.fixture-sop.md'
    };
    const catalog = { schema_version: '1', namespace: 'resident', sops: [entry] };
    const result = await parseAndValidateSopSelection('SELECT: resident.fixture-sop', [{ ...entry, score: 5 }], { catalog, root });
    assert.equal(result.selected.length, 0);
    assert.ok(result.rejected.some(rejection => rejection.reason === 'BODY_UNAVAILABLE'));
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('fallback — documented rule (strong top1, weak escalate, status default, none)', async () => {
  const { catalog, candidates } = await realistic();
  const strong = resolveSopFallback({ candidates, discovery: { request: 'x', candidates, count: 2, fallback: false, reason: null, capped: true } });
  assert.equal(strong.mode, 'TOP1');
  assert.deepEqual(strong.ids, ['resident.handle-worker-failure']);
  const weak = resolveSopFallback({ candidates: [candidate(catalog, 'resident.request-approval', 2.5)] });
  assert.equal(weak.mode, 'ESCALATE');
  assert.deepEqual(weak.ids, []);
  const statusDefault = resolveSopFallback({ candidates: [candidate(catalog, 'resident.report-status', 0)], discovery: { request: 'Where are we?', candidates: [], count: 0, fallback: true, reason: 'no usable request tokens', capped: true } });
  assert.equal(statusDefault.mode, 'TOP1');
  assert.deepEqual(statusDefault.ids, ['resident.report-status']);
  assert.equal(resolveSopFallback({ candidates: [] }).mode, 'ESCALATE');
});

test('duplication — no repeated lines across compiled sections', async () => {
  const { base } = await realistic();
  const envelope = await compileAwarenessEnvelope(base);
  const report = analyzeEnvelopeDuplication(envelope.sections);
  assert.deepEqual(report.duplicate_lines, []);
});

test('no live wiring — production paths do not import the envelope compiler', async () => {
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
    assert.ok(!text.includes('resident-envelope'), relative + ' must not import the awareness envelope compiler');
  }
});
