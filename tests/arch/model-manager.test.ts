// tests/arch/model-manager.test.ts
// Model Manager battery: registry schema, availability≠qualification,
// staleness, discovery fixtures, recommendation determinism + reason codes,
// role filtering, resource exclusion, Developer Notes isolation/triggers,
// user override, public-safe serialization, offline/provider-failure behavior.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { IntelligenceRegistry, toPublicSafe, IntelligenceEntrySchema, type IntelligenceEntry } from '../../node/src/services/intelligence-registry.ts';
import { discoverLocalModels, probeCloudProviders, detectQuantization } from '../../node/src/services/intelligence-discovery.ts';
import { recommend } from '../../node/src/services/recommendation-engine.ts';
import { notesForSignals, SEED_NOTES } from '../../node/src/services/developer-notes.ts';
import { Advisories } from '../../node/src/services/system-advisories.ts';

async function tempWorkspace(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'aide-mm-'));
}

function entry(overrides: Partial<IntelligenceEntry> & { id: string }): IntelligenceEntry {
  return IntelligenceEntrySchema.parse({
    display_name: overrides.id, provider: 'local', locality: 'LOCAL', availability: 'INSTALLED',
    qualification: { state: 'UNTESTED', qualified_roles: [], unqualified_roles: [], evidence_refs: [] },
    known_strengths: [], known_failures: [], evidence_refs: [], ...overrides
  });
}

test('registry: load/save round-trip with strict schema', async () => {
  const dir = await tempWorkspace();
  const registry = new IntelligenceRegistry({ workspace: dir });
  await registry.load();
  await registry.upsert(entry({ id: 'fixture-1b', artifact: { file: path.join(dir, 'models', 'fixture-1b.gguf'), quantization: 'Q4_K_M', hash_status: 'not_computed' } }));
  const reread = new IntelligenceRegistry({ workspace: dir });
  await reread.load();
  assert.equal(reread.list().length, 1);
  assert.equal(reread.get('fixture-1b')?.artifact?.quantization, 'Q4_K_M');
  await assert.rejects(() => registry.upsert({ bad: true } as never));
});

test('availability and qualification are independent states', async () => {
  const installed = entry({ id: 'a' });
  const qualifiedOnly = entry({ id: 'b', availability: 'DISCOVERED', qualification: { state: 'QUALIFIED', qualified_roles: ['RESIDENT'], unqualified_roles: [], evidence_refs: ['ev-1'], basis: { artifact_hash: 'h1' } } });
  assert.equal(installed.availability, 'INSTALLED');
  assert.equal(installed.qualification.state, 'UNTESTED');
  assert.notEqual(qualifiedOnly.availability, 'INSTALLED');
  assert.equal(qualifiedOnly.qualification.state, 'QUALIFIED');
});

test('artifact-identity staleness: hash/profile/runtime changes stale a QUALIFIED entry', async () => {
  const dir = await tempWorkspace();
  const registry = new IntelligenceRegistry({ workspace: dir });
  await registry.load();
  await registry.upsert(entry({ id: 'm1', qualification: { state: 'QUALIFIED', qualified_roles: ['RESIDENT'], unqualified_roles: [], evidence_refs: ['ev'], basis: { artifact_hash: 'h1', harness_profile_hash: 'p1' } } }));
  const clean = registry.evaluateStaleness('m1', { artifact_hash: 'h1', harness_profile_hash: 'p1' });
  assert.equal(clean.stale, false);
  const stale = registry.evaluateStaleness('m1', { artifact_hash: 'h2' });
  assert.equal(stale.stale, true);
  assert.deepEqual(stale.reasons, ['artifact_hash_changed']);
  assert.equal(registry.get('m1')?.qualification.state, 'STALE');
});

test('local discovery: bounded GGUF scan with quant detection; no full hashing', async () => {
  const dir = await tempWorkspace();
  await fs.mkdir(path.join(dir, 'models'), { recursive: true });
  await fs.writeFile(path.join(dir, 'models', 'SmolLM3-Q4_K_M.gguf'), 'fixture');
  await fs.writeFile(path.join(dir, 'models', 'notes.txt'), 'ignore me');
  const result = await discoverLocalModels(dir);
  assert.equal(result.entries.length, 1);
  assert.equal(result.entries[0].artifact?.quantization, 'Q4_K_M');
  assert.equal(result.entries[0].artifact?.hash_status, 'not_computed');
  assert.equal(result.entries[0].availability, 'INSTALLED');
  assert.equal(detectQuantization('x-QAD-Q4_0.gguf'), 'Q4_0');
});

test('cloud providers: state from local config only; no credentials printed; offline-safe', async () => {
  const dir = await tempWorkspace();
  const probes = await probeCloudProviders(dir);
  assert.equal(probes.length, 2);
  for (const probe of probes) {
    assert.ok(['CONFIGURED_NOT_VERIFIED', 'UNAVAILABLE'].includes(probe.state));
    assert.equal(JSON.stringify(probe).includes('sk-'), false);
  }
  // offline startup: discovery works with zero providers configured
  const discovery = await discoverLocalModels(dir);
  assert.ok(Array.isArray(discovery.entries));
});

test('recommendation: deterministic, role-filtered, resource-aware, no global ranking', async () => {
  const entries = [
    entry({ id: 'bm', provider: 'local', qualification: { state: 'QUALIFIED', qualified_roles: ['REPAIR'], unqualified_roles: [], evidence_refs: ['ev-repair'], basis: { artifact_hash: 'h1' } }, resource_requirements: { ram_mb: 1800 }, evidence_refs: ['ev-repair'] }),
    entry({ id: 'am', provider: 'local', qualification: { state: 'TESTED', qualified_roles: [], unqualified_roles: [], evidence_refs: [] }, resource_requirements: { ram_mb: 1200 } }),
    entry({ id: 'cm', provider: 'local', qualification: { state: 'NOT_QUALIFIED', qualified_roles: [], unqualified_roles: ['REPAIR'], evidence_refs: [] } }),
    entry({ id: 'cloudz', provider: 'openai', locality: 'CLOUD', availability: 'CONNECTED', qualification: { state: 'QUALIFIED', qualified_roles: ['REPAIR'], unqualified_roles: [], evidence_refs: ['ev-cloud'], basis: { artifact_hash: 'h9' } } })
  ];
  const input = { role: 'REPAIR', availableRamMb: 4096 } as const;
  const one = recommend(entries, input);
  const two = recommend(entries, input);
  assert.deepEqual(one, two, 'same inputs must produce identical recommendations');
  assert.equal(one.recommended[0].id, 'bm'); // qualified beats tested, local fits
  assert.ok(one.recommended[0].reasons.includes('ROLE_QUALIFIED'));
  assert.ok(one.recommended[0].reasons.includes('LOW_RESOURCE_FIT'));
  assert.ok(!one.recommended.some(r => r.id === 'cm'), 'unqualified role excluded');
  assert.ok(one.excluded.some(e => e.id === 'cm' && e.reasons.includes('ROLE_NOT_QUALIFIED')));

  const offline = recommend(entries, { role: 'REPAIR', offline: true, availableRamMb: 4096 });
  assert.ok(!offline.recommended.some(r => r.id === 'cloudz'), 'offline excludes cloud');
  assert.ok(offline.excluded.some(e => e.id === 'cloudz'));
  assert.ok(offline.recommended.some(r => r.reasons.includes('OFFLINE_CAPABLE')));

  const tight = recommend(entries, { role: 'REPAIR', availableRamMb: 1000 });
  assert.ok(tight.excluded.some(e => e.id === 'bm' && e.reasons.includes('RESOURCE_INCOMPATIBLE')), 'insufficient RAM excludes');
});

test('recommendation: cost tie-break and past-success evidence', async () => {
  const entries = [
    entry({ id: 'p1', provider: 'provA', qualification: { state: 'QUALIFIED', qualified_roles: ['REVIEWER'], unqualified_roles: [], evidence_refs: [], basis: { artifact_hash: 'a' } } }),
    entry({ id: 'p2', provider: 'provB', qualification: { state: 'QUALIFIED', qualified_roles: ['REVIEWER'], unqualified_roles: [], evidence_refs: [], basis: { artifact_hash: 'b' } } })
  ];
  const result = recommend(entries, { role: 'REVIEWER', costByProvider: { provA: 3, provB: 1 }, history: { p1: { accepted: 5, failed: 1 } } });
  assert.equal(result.recommended[0].id, 'p2', 'cheaper provider wins the tie at equal qualification');
  const withHistory = recommend(entries, { role: 'REVIEWER', costByProvider: { provA: 3, provB: 1 }, history: { p1: { accepted: 5, failed: 1 } } });
  const p1 = [...withHistory.recommended, ...withHistory.alternatives].find(c => c.id === 'p1');
  assert.ok(p1?.reasons.includes('PAST_PROJECT_SUCCESS'));
  assert.equal('best' in result, false, 'no global ranking semantics');
});

test('developer notes: triggers, dismissal suppression, attribution, isolation from advisories', async () => {
  const active = notesForSignals({ context_pressure: true }, { dismissed: new Set() });
  assert.ok(active.some(n => n.note_id === 'dn-context-checkpoint'));
  assert.ok(active.every(n => n.kind === 'developer-note' && n.source.startsWith('DEVELOPER_NOTES')));
  const suppressed = notesForSignals({ context_pressure: true }, { dismissed: new Set(['dn-context-checkpoint']) });
  assert.equal(suppressed.some(n => n.note_id === 'dn-context-checkpoint'), false);
  // a note must never be constructible as an advisory and vice versa
  assert.ok(SEED_NOTES.every(n => n.kind === 'developer-note'));
  const advisory = Advisories.qualificationPending('m1');
  assert.equal(advisory.kind, 'system-advisory');
});

test('advisories: severities and required system facts exist', async () => {
  assert.equal(Advisories.credentialRotationRequired('openai').severity, 'BLOCKING');
  assert.equal(Advisories.insufficientRam('m', 2000, 900).severity, 'CAUTION');
  assert.ok(Advisories.artifactHashMismatch('m', 'aaaa', 'bbbb').detail.includes('aaaa'));
  assert.ok(Advisories.evidenceStale('m', ['artifact_hash_changed']).detail.includes('artifact_hash_changed'));
});

test('user override: incompatible choices may warn but only resource/authority blocks are hard', async () => {
  const result = recommend([entry({ id: 'x', qualification: { state: 'QUALIFIED', qualified_roles: [], unqualified_roles: ['RESIDENT'], evidence_refs: [], basis: { artifact_hash: 'h' } } })], { role: 'RESIDENT' });
  const advisory = Advisories.roleNotQualified('x', 'RESIDENT');
  assert.equal(advisory.severity, 'CAUTION', 'override allowed: caution, not blocking');
  assert.ok(result.excluded.some(e => e.id === 'x'));
});

test('public-safe serialization: no local paths, endpoints or credential-shaped values', async () => {
  const withPath = entry({ id: 'safe', artifact: { file: 'E:\\aide-sovereign-workbench\\models\\x.gguf', quantization: 'Q4_K_M', format: 'gguf' }, runtime: { backend: 'llama.cpp', endpoint: 'http://127.0.0.1:8081/v1' } });
  const safe = toPublicSafe(withPath);
  const serialized = JSON.stringify(safe);
  assert.equal(serialized.includes('E:\\\\'), false);
  assert.equal(serialized.includes('127.0.0.1'), false);
  assert.equal(serialized.includes('api_key'), false);
  assert.equal(safe.quantization, 'Q4_K_M');
  assert.equal((safe.qualification as { state: string }).state, 'UNTESTED');
});
