import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createManagedClientRegistry } from '../../node/src/services/managed-client-registry.ts';
import { createClientConformance } from '../../node/src/services/client-conformance.ts';
import { CLIENT_MATRIX, type ManagedClientIdT, type ManagedClientProbeResultT } from '../../common/contracts/managed-client.ts';
import type { ConformanceEvidence } from '../../node/src/services/client-conformance.ts';

const DETECTED: ManagedClientProbeResultT = {
  executable_path: 'C:\\tools\\client.exe',
  exact_version: '1.2.3',
  executable_sha256: 'a'.repeat(64),
  credential_availability: 'AVAILABLE',
  provider_identity: 'anthropic',
  model_identity: 'claude-3'
};
const FIXTURE = 'FIXTURE' as const;

function probe(clientId: unknown, result: unknown, evidenceState: 'LIVE' | 'FIXTURE' = FIXTURE) {
  return {
    client_id: clientId as ManagedClientIdT,
    evidence_state: evidenceState,
    detect: async () => result as ManagedClientProbeResultT | null
  };
}

const conformanceChecks: ConformanceEvidence['checks'] = [
  { name: 'EXECUTION_BOUNDARY', passed: true, evidence_ref: 'evidence/execution.json' },
  { name: 'CALLER_BOUNDARY', passed: true, evidence_ref: 'evidence/caller.json' },
  { name: 'CREDENTIAL_BOUNDARY', passed: true, evidence_ref: 'evidence/credential.json' },
  { name: 'PROCESS_OWNERSHIP', passed: true, evidence_ref: 'evidence/process.json' },
  { name: 'CANCELLATION_TERMINATION', passed: true, evidence_ref: 'evidence/cancellation.json' },
  { name: 'ROUTE_IDENTITY', passed: true, evidence_ref: 'evidence/route.json' }
];

function evidence(overrides: Partial<ConformanceEvidence> = {}): ConformanceEvidence {
  return {
    client_id: 'claude-code',
    evidence_state: FIXTURE,
    version_evaluated: '1.2.3',
    executable_sha256_evaluated: 'a'.repeat(64),
    provider_identity: 'anthropic',
    model_identity: 'claude-3',
    checks: conformanceChecks,
    negative_bypass_tests: [{ name: 'native-escape-refused', passed: true, evidence_ref: 'evidence/bypass.json' }],
    ...overrides
  };
}

function conformanceFor(input: {
  clientId?: string;
  probeResult?: unknown;
  probeError?: Error;
  evidenceState?: 'LIVE' | 'FIXTURE';
} = {}) {
  const clientId = (input.clientId ?? 'claude-code') as ManagedClientIdT;
  const registry = createManagedClientRegistry({
    probes: [{
      client_id: clientId,
      evidence_state: input.evidenceState ?? FIXTURE,
      detect: async () => {
        if (input.probeError) throw input.probeError;
        const result = Object.prototype.hasOwnProperty.call(input, 'probeResult') ? input.probeResult : DETECTED;
        return result as ManagedClientProbeResultT | null;
      }
    }]
  });
  return createClientConformance({ discovery: () => registry.discover() });
}

test('registry returns one deterministic canonical record with value-free credential availability', async () => {
  const registry = createManagedClientRegistry({ probes: [
    probe('kimi-code', null),
    probe('claude-code', DETECTED)
  ] });
  const results = await registry.discover();
  assert.deepEqual(results.map(entry => entry.client_id), ['claude-code', 'kimi-code']);
  assert.deepEqual(results[0], {
    client_id: 'claude-code',
    detected: true,
    availability: 'AVAILABLE',
    availability_reason: null,
    executable_path: DETECTED.executable_path,
    exact_version: DETECTED.exact_version,
    executable_sha256: DETECTED.executable_sha256,
    credential_availability: 'AVAILABLE',
    credential_owner: 'CLIENT',
    provider_identity: 'anthropic',
    model_identity: 'claude-3',
    governance_state: 'MANAGED_OBSERVED',
    supported_capabilities: ['INTERACTIVE_PTY_DESCRIPTOR'],
    qualification_state: 'NOT_EVALUATED',
    execution_surface: 'TERMINAL_PTY_DESCRIPTOR',
    ownership: 'TERMINAL_SESSION_SERVICE',
    evidence_state: 'FIXTURE'
  });
  assert.equal(results[1]!.availability, 'UNAVAILABLE');
  assert.equal(results[1]!.availability_reason, 'NOT_INSTALLED');
  assert.equal(results[1]!.exact_version, null);
  assert.equal(JSON.stringify(results).includes('secret'), false);
});

test('registry distinguishes missing clients, failed probes, and malformed probe output without echoing errors', async () => {
  const registry = createManagedClientRegistry({ probes: [
    probe('claude-code', null),
    { client_id: 'codex-cli', evidence_state: FIXTURE, detect: async () => { throw new Error('sk-test-secret-marker'); } },
    probe('kimi-code', { ...DETECTED, provider_identity: 'token=private-value' })
  ] });
  const results = await registry.discover();
  assert.equal(results[0]!.availability, 'UNAVAILABLE');
  assert.equal(results[1]!.availability, 'UNKNOWN');
  assert.equal(results[1]!.availability_reason, 'PROBE_FAILED');
  assert.equal(results[2]!.availability, 'UNKNOWN');
  assert.equal(results[2]!.availability_reason, 'INVALID_PROBE_RESULT');
  const serialized = JSON.stringify(results);
  assert.equal(serialized.includes('sk-test-secret-marker'), false);
  assert.equal(serialized.includes('private-value'), false);
});

test('registry refuses duplicate and unknown ids without reflecting untrusted values', () => {
  assert.throws(() => createManagedClientRegistry({ probes: [
    probe('codex-cli', DETECTED),
    probe('codex-cli', DETECTED)
  ] }), /duplicate/);
  assert.throws(() => createManagedClientRegistry({ probes: [
    probe('__proto__-secret-marker', DETECTED)
  ] }), error => {
    assert.equal((error as Error).message, 'unknown managed client id');
    return true;
  });
});

test('client matrix keeps TARGET_1 observed, OpenCode bridged, and Gemini/Qwen unqualified', () => {
  assert.equal(CLIENT_MATRIX['claude-code'].tier, 'TARGET_1');
  assert.equal(CLIENT_MATRIX['codex-cli'].default_truth, 'MANAGED_OBSERVED');
  assert.equal(CLIENT_MATRIX['kimi-code'].execution_surface, 'TERMINAL_PTY_DESCRIPTOR');
  assert.equal(CLIENT_MATRIX.opencode.execution_surface, 'OPENCODE_BRIDGE');
  assert.equal(CLIENT_MATRIX['gemini-cli'].tier, 'RESEARCH');
  assert.equal(CLIENT_MATRIX['gemini-cli'].default_truth, 'UNQUALIFIED');
  assert.equal(CLIENT_MATRIX['qwen-code'].qualification_state, 'UNQUALIFIED');
});

test('registry probes afresh so stale AVAILABLE state is not retained', async () => {
  let current: ManagedClientProbeResultT | null = DETECTED;
  const registry = createManagedClientRegistry({ probes: [{
    client_id: 'claude-code',
    evidence_state: FIXTURE,
    detect: async () => current
  }] });
  assert.equal((await registry.discover())[0]!.availability, 'AVAILABLE');
  current = null;
  const refreshed = (await registry.discover())[0]!;
  assert.equal(refreshed.availability, 'UNAVAILABLE');
  assert.equal(refreshed.executable_path, null);
});

test('fixture evidence cannot promote governance and provider/model identity remains explicit', async () => {
  const verdict = await conformanceFor().evaluate('claude-code', evidence());
  assert.equal(verdict.verdict, 'MANAGED_OBSERVED');
  assert.equal(verdict.qualification_state, 'NOT_EVALUATED');
  assert.equal(verdict.evidence_state, 'FIXTURE');
  assert.ok(verdict.reasons.includes('FIXTURE_EVIDENCE_ONLY'));
  assert.equal(verdict.provider_identity, 'anthropic');
  assert.equal(verdict.model_identity, 'claude-3');
});

test('conformance rejects mismatched client, executable, provider, and model identity without fallback', async () => {
  const runner = conformanceFor();
  const wrongClient = await runner.evaluate('claude-code', evidence({ client_id: 'codex-cli' }));
  assert.equal(wrongClient.verdict, 'UNQUALIFIED');
  assert.deepEqual(wrongClient.reasons, ['CLIENT_ID_MISMATCH']);

  const wrongExecutable = await runner.evaluate('claude-code', evidence({ executable_sha256_evaluated: 'b'.repeat(64) }));
  assert.equal(wrongExecutable.verdict, 'UNQUALIFIED');
  assert.deepEqual(wrongExecutable.reasons, ['EXECUTABLE_MISMATCH']);

  const wrongProvider = await runner.evaluate('claude-code', evidence({ provider_identity: 'openai' }));
  assert.equal(wrongProvider.verdict, 'UNQUALIFIED');
  assert.deepEqual(wrongProvider.reasons, ['PROVIDER_MODEL_MISMATCH']);

  const wrongModel = await runner.evaluate('claude-code', evidence({ model_identity: 'other-model' }));
  assert.equal(wrongModel.verdict, 'UNQUALIFIED');
  assert.deepEqual(wrongModel.reasons, ['PROVIDER_MODEL_MISMATCH']);
});

test('version mismatch or absent version evidence is UNQUALIFIED', async () => {
  const runner = conformanceFor();
  const mismatch = await runner.evaluate('claude-code', evidence({ version_evaluated: '9.9.9' }));
  assert.equal(mismatch.verdict, 'UNQUALIFIED');
  assert.deepEqual(mismatch.reasons, ['VERSION_MISMATCH']);
  const missing = await runner.evaluate('claude-code', evidence({ version_evaluated: null }));
  assert.equal(missing.verdict, 'UNQUALIFIED');
  assert.deepEqual(missing.reasons, ['EXACT_VERSION_EVIDENCE_MISSING']);
});

test('unobserved provider/model identity remains MANAGED_OBSERVED', async () => {
  const runner = conformanceFor({
    probeResult: { ...DETECTED, provider_identity: null, model_identity: null }
  });
  const result = await runner.evaluate('claude-code', evidence({ provider_identity: null, model_identity: null }));
  assert.equal(result.verdict, 'MANAGED_OBSERVED');
  assert.ok(result.reasons.includes('IDENTITY_UNOBSERVED'));
  assert.equal(result.provider_identity, null);
  assert.equal(result.model_identity, null);
});

test('missing or failed negative checks cannot produce FULLY_GOVERNED', async () => {
  const runner = conformanceFor();
  const missingNegative = await runner.evaluate('claude-code', evidence({ negative_bypass_tests: [] }));
  assert.equal(missingNegative.verdict, 'MANAGED_OBSERVED');
  assert.ok(missingNegative.reasons.includes('NEGATIVE_BYPASS_TESTS_MISSING'));

  const failedNegative = await runner.evaluate('claude-code', evidence({
    negative_bypass_tests: [{ name: 'native-escape-refused', passed: false, evidence_ref: 'evidence/bypass.json' }]
  }));
  assert.equal(failedNegative.verdict, 'MANAGED_OBSERVED');
  assert.ok(failedNegative.reasons.includes('NEGATIVE_BYPASS_TESTS_FAILED'));

  const missingCheck = await runner.evaluate('claude-code', evidence({ checks: conformanceChecks.slice(1) }));
  assert.equal(missingCheck.verdict, 'MANAGED_OBSERVED');
  assert.ok(missingCheck.reasons.includes('REQUIRED_CHECKS_MISSING'));
});

test('credential unavailable is explicit and never triggers another client or model', async () => {
  const runner = conformanceFor({
    probeResult: { ...DETECTED, credential_availability: 'UNAVAILABLE' }
  });
  const result = await runner.evaluate('claude-code', evidence());
  assert.equal(result.verdict, 'UNQUALIFIED');
  assert.ok(result.reasons.includes('CREDENTIAL_UNAVAILABLE'));
  assert.equal(result.client_id, 'claude-code');
  assert.equal(result.provider_identity, 'anthropic');
  assert.equal(result.model_identity, 'claude-3');
});

test('unavailable and research-only clients remain UNQUALIFIED', async () => {
  const unavailable = await conformanceFor({ probeResult: null }).evaluate('claude-code', evidence());
  assert.equal(unavailable.verdict, 'UNQUALIFIED');
  assert.deepEqual(unavailable.reasons, ['NOT_DETECTED']);

  const research = await conformanceFor().evaluate('gemini-cli', evidence({ client_id: 'gemini-cli' }));
  assert.equal(research.verdict, 'UNQUALIFIED');
  assert.deepEqual(research.reasons, ['RESEARCH_ONLY_CLIENT']);
});

test('malformed credential-shaped evidence is rejected and omitted from verdicts', async () => {
  const malicious = evidence({
    checks: [{ name: 'ROUTE_IDENTITY', passed: true, evidence_ref: 'token=secret-canary' }]
  });
  const result = await conformanceFor().evaluate('claude-code', malicious);
  assert.equal(result.verdict, 'MANAGED_OBSERVED');
  assert.deepEqual(result.reasons, ['INVALID_EVIDENCE']);
  assert.equal(JSON.stringify(result).includes('secret-canary'), false);
});
