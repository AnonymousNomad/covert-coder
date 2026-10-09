import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createManagedClientRegistry } from '../../node/src/services/managed-client-registry.ts';
import { createClientConformance } from '../../node/src/services/client-conformance.ts';
import { CLIENT_MATRIX } from '../../common/contracts/managed-client.ts';
import type { ConformanceEvidence } from '../../node/src/services/client-conformance.ts';

function probe(client_id: any, result: any) {
  return { client_id, detect: async () => result };
}
const DETECTED = { executable_path: 'C:\\tools\\client.exe', exact_version: '1.2.3', executable_sha256: 'a'.repeat(64) };

test('registry discovers clients deterministically and truthfully reports absence', async () => {
  const registry = createManagedClientRegistry({ probes: [
    probe('kimi-code', null),
    probe('claude-code', DETECTED)
  ] });
  const results = await registry.discover();
  assert.deepEqual(results.map(entry => entry.client_id), ['claude-code', 'kimi-code']);
  assert.equal(results[0]!.detected, true);
  assert.equal(results[0]!.auth_state, 'DETECTED');
  assert.equal(results[1]!.detected, false);
  assert.equal(results[1]!.auth_state, 'NOT_DETECTED');
  assert.equal(results[1]!.exact_version, null);
});

test('registry refuses duplicate ids and never invents detection on probe failure', async () => {
  assert.throws(() => createManagedClientRegistry({ probes: [probe('codex-cli', DETECTED), probe('codex-cli', DETECTED)] }), /duplicate/);
  const registry = createManagedClientRegistry({ probes: [{ client_id: 'codex-cli', detect: async () => { throw new Error('probe down'); } }] });
  const results = await registry.discover();
  assert.equal(results[0]!.detected, false);
});

test('matrix classification is captured exactly (research-only clients never upgrade implicitly)', () => {
  assert.equal(CLIENT_MATRIX['gemini-cli'].tier, 'RESEARCH');
  assert.equal(CLIENT_MATRIX['qwen-code'].tier, 'RESEARCH');
  assert.equal(CLIENT_MATRIX['gemini-cli'].default_truth, 'UNQUALIFIED');
  assert.equal(CLIENT_MATRIX.opencode.tier, 'BRIDGE');
  assert.equal(CLIENT_MATRIX['claude-code'].tier, 'TARGET_1');
});

function conformanceFor(detectedVersion: string | null) {
  const registry = createManagedClientRegistry({ probes: [probe('claude-code', detectedVersion === null ? null : { ...DETECTED, exact_version: detectedVersion })] });
  return createClientConformance({ discovery: () => registry.discover() });
}
const fullEvidence = (version: string | null, negativePassed = true): ConformanceEvidence => ({
  client_id: 'claude-code',
  version_evaluated: version,
  checks: [{ name: 'mediation', passed: true, evidence_ref: 'evidence/mediation.json' }],
  negative_bypass_tests: [{ name: 'native-escape-blocked', passed: negativePassed, evidence_ref: 'evidence/bypass.json' }]
});

test('FULLY_GOVERNED is granted only with exact-version evidence and passed negative bypass tests', async () => {
  const verdict = await conformanceFor('1.2.3').evaluate('claude-code', fullEvidence('1.2.3'));
  assert.equal(verdict.verdict, 'FULLY_GOVERNED');
  assert.deepEqual(verdict.reasons, []);
  assert.deepEqual(verdict.evidence_refs, ['evidence/bypass.json', 'evidence/mediation.json']);
});

test('missing negative bypass tests degrade to MANAGED_OBSERVED with explicit reason', async () => {
  const evidence = { ...fullEvidence('1.2.3'), negative_bypass_tests: [] };
  const verdict = await conformanceFor('1.2.3').evaluate('claude-code', evidence);
  assert.equal(verdict.verdict, 'MANAGED_OBSERVED');
  assert.deepEqual(verdict.reasons, ['NEGATIVE_BYPASS_TESTS_MISSING']);
});

test('failed negative bypass test keeps the client out of FULLY_GOVERNED', async () => {
  const verdict = await conformanceFor('1.2.3').evaluate('claude-code', fullEvidence('1.2.3', false));
  assert.equal(verdict.verdict, 'MANAGED_OBSERVED');
  assert.ok(verdict.reasons.includes('NEGATIVE_BYPASS_TESTS_FAILED'));
});

test('version mismatch and missing version evidence are UNQUALIFIED with exact reasons', async () => {
  const mismatch = await conformanceFor('9.9.9').evaluate('claude-code', fullEvidence('1.2.3'));
  assert.equal(mismatch.verdict, 'UNQUALIFIED');
  assert.deepEqual(mismatch.reasons, ['VERSION_MISMATCH']);
  const missing = await conformanceFor('1.2.3').evaluate('claude-code', fullEvidence(null));
  assert.equal(missing.verdict, 'UNQUALIFIED');
  assert.deepEqual(missing.reasons, ['EXACT_VERSION_EVIDENCE_MISSING', 'VERSION_MISMATCH']);
});

test('undetected and research-only clients are UNQUALIFIED without extrapolation', async () => {
  const undetected = await conformanceFor(null).evaluate('claude-code', fullEvidence('1.2.3'));
  assert.equal(undetected.verdict, 'UNQUALIFIED');
  assert.deepEqual(undetected.reasons, ['NOT_DETECTED']);
  const research = await conformanceFor('1.2.3').evaluate('gemini-cli', fullEvidence('1.2.3'));
  assert.equal(research.verdict, 'UNQUALIFIED');
  assert.deepEqual(research.reasons, ['RESEARCH_ONLY_CLIENT']);
});

test('mediation check failure downgrades even when negative tests pass', async () => {
  const evidence = { ...fullEvidence('1.2.3'), checks: [{ name: 'mediation', passed: false, evidence_ref: 'evidence/mediation.json' }] };
  const verdict = await conformanceFor('1.2.3').evaluate('claude-code', evidence);
  assert.equal(verdict.verdict, 'MANAGED_OBSERVED');
  assert.deepEqual(verdict.reasons, ['MEDIATION_CHECKS_FAILED']);
});

test('conformance requires no credential-shaped material to reach its output', async () => {
  const verdict = await conformanceFor('1.2.3').evaluate('claude-code', fullEvidence('1.2.3'));
  assert.ok(!/sk-|hf_|ghp_|Bearer|token=|secret/i.test(JSON.stringify(verdict)));
});
