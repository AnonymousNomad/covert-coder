import {
  ClientConformanceEvidence,
  ConformanceVerdict,
  CLIENT_MATRIX,
  type ClientConformanceEvidenceT,
  type ConformanceVerdictT,
  type ManagedClientDiscoveryT,
  type ManagedClientIdT
} from '../../../common/contracts/managed-client.ts';

const REQUIRED_CHECKS = [
  'EXECUTION_BOUNDARY',
  'CALLER_BOUNDARY',
  'CREDENTIAL_BOUNDARY',
  'PROCESS_OWNERSHIP',
  'CANCELLATION_TERMINATION',
  'ROUTE_IDENTITY'
] as const;

// P2 conformance is identity-bound and evidence-state-bound. Fixture evidence
// exercises this evaluator but can never promote a client to FULLY_GOVERNED.
// No result qualifies a provider or model.
export function createClientConformance(options: { discovery: () => Promise<ManagedClientDiscoveryT[]> }) {
  function verdict(input: {
    clientId: ManagedClientIdT;
    state: ConformanceVerdictT['verdict'];
    evidenceState: ConformanceVerdictT['evidence_state'];
    reasons: ConformanceVerdictT['reasons'];
    providerIdentity?: string | null;
    modelIdentity?: string | null;
    evidenceRefs?: string[];
  }): ConformanceVerdictT {
    const matrix = CLIENT_MATRIX[input.clientId];
    return ConformanceVerdict.parse({
      client_id: input.clientId,
      verdict: input.state,
      provider_qualification_state: matrix.provider_qualification_state,
      provider_identity: input.providerIdentity ?? null,
      model_identity: input.modelIdentity ?? null,
      evidence_state: input.evidenceState,
      reasons: [...new Set(input.reasons)].sort(),
      evidence_refs: [...new Set(input.evidenceRefs ?? [])].sort()
    });
  }

  async function evaluate(clientId: ManagedClientIdT, untrustedEvidence: unknown): Promise<ConformanceVerdictT> {
    if (!Object.prototype.hasOwnProperty.call(CLIENT_MATRIX, clientId)) {
      throw new Error('unknown managed client id');
    }
    const matrix = CLIENT_MATRIX[clientId];
    const evidenceResult = ClientConformanceEvidence.safeParse(untrustedEvidence);
    if (!evidenceResult.success) {
      return verdict({
        clientId,
        state: matrix.tier === 'RESEARCH' ? 'UNQUALIFIED' : matrix.default_truth,
        evidenceState: 'NOT_RUN',
        reasons: ['INVALID_EVIDENCE']
      });
    }
    const evidence: ClientConformanceEvidenceT = evidenceResult.data;
    if (matrix.tier === 'RESEARCH') {
      return verdict({
        clientId,
        state: 'UNQUALIFIED',
        evidenceState: evidence.evidence_state,
        reasons: ['RESEARCH_ONLY_CLIENT']
      });
    }

    const discovered = (await options.discovery()).find(entry => entry.client_id === clientId) ?? null;
    if (discovered === null) {
      return verdict({
        clientId,
        state: 'UNQUALIFIED',
        evidenceState: 'NOT_RUN',
        reasons: ['NOT_DETECTED'],
        providerIdentity: null,
        modelIdentity: null
      });
    }
    if (discovered.availability !== 'AVAILABLE') {
      const reason = discovered.availability === 'UNKNOWN'
        ? discovered.availability_reason === 'PROBE_NOT_REGISTERED' ? 'CLIENT_PROBE_NOT_REGISTERED'
          : discovered.availability_reason === 'PROBE_FAILED' ? 'CLIENT_PROBE_FAILED' : 'CLIENT_PROBE_INVALID'
        : 'NOT_DETECTED';
      return verdict({
        clientId,
        state: 'UNQUALIFIED',
        evidenceState: discovered.evidence_state,
        reasons: discovered.availability === 'UNKNOWN' ? ['CLIENT_AVAILABILITY_UNKNOWN', reason] : [reason],
        providerIdentity: discovered.provider_identity,
        modelIdentity: discovered.model_identity
      });
    }

    const evidenceRefs = [
      ...evidence.checks.map(check => check.evidence_ref),
      ...evidence.negative_bypass_tests.map(test => test.evidence_ref)
    ];
    if (evidence.client_id !== clientId) {
      return verdict({
        clientId,
        state: 'UNQUALIFIED',
        evidenceState: evidence.evidence_state,
        reasons: ['CLIENT_ID_MISMATCH'],
        providerIdentity: discovered.provider_identity,
        modelIdentity: discovered.model_identity
      });
    }

    const identityReasons: ConformanceVerdictT['reasons'][number][] = [];
    if (discovered.exact_version === null || evidence.version_evaluated === null) {
      identityReasons.push('EXACT_VERSION_EVIDENCE_MISSING');
    } else if (discovered.exact_version !== evidence.version_evaluated) {
      identityReasons.push('VERSION_MISMATCH');
    }
    if (discovered.executable_sha256 === null || evidence.executable_sha256_evaluated === null ||
        discovered.executable_sha256 !== evidence.executable_sha256_evaluated) {
      identityReasons.push('EXECUTABLE_MISMATCH');
    }
    const providerModelObserved = discovered.provider_identity !== null && discovered.model_identity !== null;
    if (!providerModelObserved) {
      identityReasons.push('IDENTITY_UNOBSERVED');
    } else if (evidence.provider_identity !== discovered.provider_identity ||
        evidence.model_identity !== discovered.model_identity) {
      identityReasons.push('PROVIDER_MODEL_MISMATCH');
    }
    if (identityReasons.some(reason => reason !== 'IDENTITY_UNOBSERVED')) {
      return verdict({
        clientId,
        state: 'UNQUALIFIED',
        evidenceState: evidence.evidence_state,
        reasons: identityReasons,
        providerIdentity: discovered.provider_identity,
        modelIdentity: discovered.model_identity,
        evidenceRefs
      });
    }

    const reasons: ConformanceVerdictT['reasons'][number][] = [...identityReasons];
    const presentChecks = new Set(evidence.checks.map(check => check.name));
    if (REQUIRED_CHECKS.some(name => !presentChecks.has(name))) reasons.push('REQUIRED_CHECKS_MISSING');
    if (evidence.checks.some(check => !check.passed)) reasons.push('MEDIATION_CHECKS_FAILED');
    if (evidence.negative_bypass_tests.length === 0) reasons.push('NEGATIVE_BYPASS_TESTS_MISSING');
    if (evidence.negative_bypass_tests.some(test => !test.passed)) reasons.push('NEGATIVE_BYPASS_TESTS_FAILED');
    if (discovered.credential_availability === 'UNAVAILABLE') reasons.push('CREDENTIAL_UNAVAILABLE');
    if (discovered.credential_availability === 'UNKNOWN') reasons.push('CREDENTIAL_STATE_UNKNOWN');
    const liveEvidenceClaim = evidence.evidence_state === 'LIVE' && discovered.evidence_state === 'LIVE';
    if (!liveEvidenceClaim) {
      reasons.push('FIXTURE_EVIDENCE_ONLY');
    } else {
      // P2 currently has no trusted evidence-reference verifier. Treat a
      // caller-supplied LIVE label and booleans as unverified claims.
      reasons.push('LIVE_EVIDENCE_NOT_VERIFIED');
    }

    const completeEvidence = REQUIRED_CHECKS.every(name =>
      evidence.checks.some(check => check.name === name && check.passed)
    );
    const fullyGoverned = reasons.length === 0 &&
      evidence.negative_bypass_tests.length > 0 &&
      evidence.negative_bypass_tests.every(test => test.passed) &&
      completeEvidence &&
      evidence.provider_identity !== null &&
      evidence.model_identity !== null;
    return verdict({
      clientId,
      state: fullyGoverned ? 'FULLY_GOVERNED'
      : reasons.includes('CREDENTIAL_UNAVAILABLE') ? 'UNQUALIFIED'
          : 'MANAGED_OBSERVED',
      evidenceState: liveEvidenceClaim ? 'NOT_RUN' : 'FIXTURE',
      reasons,
      providerIdentity: discovered.provider_identity,
      modelIdentity: discovered.model_identity,
      evidenceRefs: liveEvidenceClaim ? [] : evidenceRefs
    });
  }
  return Object.freeze({ evaluate });
}
export type ClientConformance = ReturnType<typeof createClientConformance>;
export type ConformanceEvidence = ClientConformanceEvidenceT;
