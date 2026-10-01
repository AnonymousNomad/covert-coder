import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { CapabilityClosure, evaluateCapabilityClosure } from '../../common/contracts/capability-closure.ts';

const ledger = JSON.parse(readFileSync(new URL('../../artifacts/integration-certification/capability-ledger.json', import.meta.url), 'utf8')) as { closure: unknown };
const closure = CapabilityClosure.parse(ledger.closure);
const sha = 'a'.repeat(40);
const candidate = { branch: closure.assessed_source.branch, sha, hasFile: (_path: string) => true };

test('historical audit retained; closure seed is schema-valid and explicitly partial', () => {
  assert.equal(closure.coverage, 'PARTIAL');
  assert.equal(closure.records.length, 12);
  const result = evaluateCapabilityClosure(closure, candidate);
  assert.equal(result.state, 'BLOCKED');
  assert.ok(result.blockers.some(blocker => blocker.reason === 'INCOMPLETE_CAPABILITY_INVENTORY'));
});
test('historically qualified required capabilities missing from candidate are drift, even when deferred', () => {
  const result = evaluateCapabilityClosure(closure, candidate);
  const drift = result.blockers.filter(blocker => blocker.reason === 'CAPABILITY_DRIFT');
  assert.equal(drift.length, 7);
  assert.ok(drift.some(blocker => blocker.id === 'models.developer-specials'));
  assert.ok(drift.some(blocker => blocker.id === 'themes.matrix'));
});
test('invalid schema, duplicate IDs, empty required set, invalid path and evidence-free qualification fail closed', () => {
  const samples = [ {}, { ...closure, records: [] }, { ...closure, records: [closure.records[0], closure.records[0]] },
    { ...closure, records: closure.records.map(record => ({ ...record, release_required: false })) },
    { ...closure, records: [{ ...closure.records[0], implementation_paths: ['../outside'] }] },
    { ...closure, records: [{ ...closure.records[0], qualification_evidence: [] }] },
    { ...closure, records: [{ ...closure.records[0], lifecycle: 'RELEASE-ACCEPTED' }] } ];
  for (const sample of samples) assert.equal(CapabilityClosure.safeParse(sample).success, false);
});

function syntheticAccepted() {
  return CapabilityClosure.parse({ ...closure, coverage: 'COMPLETE', records: [{ ...closure.records[0],
    lifecycle: 'RELEASE-ACCEPTED', qualification_scope: 'CURRENT_CANDIDATE', candidate_presence: 'PRESENT',
    operator_exposure: 'EXPOSED', disposition: 'CONVERGED', dogfood_evidence: ['docs/fixture-dogfood.json'],
    release_evidence: { source_sha: sha, artifact_sha256: 'b'.repeat(64), ci_run: 'fixture', evidence_paths: ['docs/fixture-acceptance.json'] },
  }] });
}
test('evaluator can satisfy a complete synthetic record; this is no product acceptance', () => {
  assert.equal(evaluateCapabilityClosure(syntheticAccepted(), candidate).state, 'LEDGER_REQUIREMENTS_SATISFIED');
});
test('exact candidate SHA, canonical branch and retained evidence are mandatory', () => {
  const fixture = syntheticAccepted();
  assert.equal(evaluateCapabilityClosure(fixture, { ...candidate, sha: 'c'.repeat(40) }).state, 'BLOCKED');
  assert.equal(evaluateCapabilityClosure(fixture, { ...candidate, branch: 'isolated' }).state, 'BLOCKED');
  assert.equal(evaluateCapabilityClosure(fixture, { ...candidate, hasFile: file => !file.includes('dogfood') }).state, 'BLOCKED');
});
test('optional scope cannot waive another required capability or fabricate a convergence milestone', () => {
  const fixture = syntheticAccepted();
  const record = fixture.records[0]!;
  assert.equal(CapabilityClosure.safeParse({ ...fixture, records: [{ ...record, candidate_presence: 'ABSENT' }] }).success, false);
  assert.equal(CapabilityClosure.safeParse({ ...fixture, records: [{ ...record, dogfood_evidence: [] }] }).success, false);
});
test('release CLI exits blocked for the real partial ledger; validate mode makes no acceptance claim', () => {
  const script = new URL('../../scripts/capability-closure-gate.mjs', import.meta.url);
  const blocked = spawnSync(process.execPath, [fileURLToPath(script)], { encoding: 'utf8' });
  assert.equal(blocked.status, 1, blocked.stderr);
  const result = JSON.parse(blocked.stdout) as { state: string; blockers: Array<{ reason: string }> };
  assert.equal(result.state, 'BLOCKED');
  assert.ok(result.blockers.some(blocker => blocker.reason === 'CAPABILITY_DRIFT'));
  const validated = spawnSync(process.execPath, [fileURLToPath(script), '--validate'], { encoding: 'utf8' });
  assert.equal(validated.status, 0, validated.stderr);
  assert.equal(JSON.parse(validated.stdout).release_acceptance_evaluated, false);
});
