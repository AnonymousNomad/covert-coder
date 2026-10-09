import {
  ConformanceVerdict,
  CLIENT_MATRIX,
  type ConformanceVerdictT,
  type ManagedClientDiscoveryT,
  type ManagedClientIdT
} from '../../../common/contracts/managed-client.ts';

// P2 — Client conformance. Produces honest governance truth classes.
// FULLY_GOVERNED requires, for the EXACT discovered version: at least one
// passed negative bypass test (native effect path attempt is mediated or
// refused) AND all mediation checks passed. Anything less degrades to
// MANAGED_OBSERVED or UNQUALIFIED with explicit reasons. No blanket claims,
// no cross-version extrapolation, no fallback to another model.

export interface ConformanceEvidence {
  client_id: ManagedClientIdT;
  version_evaluated: string | null;
  checks: Array<{ name: string; passed: boolean; evidence_ref: string }>;
  negative_bypass_tests: Array<{ name: string; passed: boolean; evidence_ref: string }>;
}

export function createClientConformance(options: { discovery: () => Promise<ManagedClientDiscoveryT[]> }) {
  async function evaluate(clientId: ManagedClientIdT, evidence: ConformanceEvidence): Promise<ConformanceVerdictT> {
    const reasons: ConformanceVerdictT['reasons'][number][] = [];
    const evidenceRefs: string[] = [];
    const tier = CLIENT_MATRIX[clientId].tier;
    if (tier === 'RESEARCH') {
      return ConformanceVerdict.parse({ client_id: clientId, verdict: 'UNQUALIFIED', reasons: ['RESEARCH_ONLY_CLIENT'], evidence_refs: [] });
    }
    const discovered = (await options.discovery()).find(entry => entry.client_id === clientId) ?? null;
    if (discovered === null || !discovered.detected) {
      return ConformanceVerdict.parse({ client_id: clientId, verdict: 'UNQUALIFIED', reasons: ['NOT_DETECTED'], evidence_refs: [] });
    }
    if (evidence.version_evaluated === null || discovered.exact_version === null || evidence.version_evaluated !== discovered.exact_version) {
      const versionReasons = evidence.version_evaluated === null
        ? ['EXACT_VERSION_EVIDENCE_MISSING', 'VERSION_MISMATCH']
        : ['VERSION_MISMATCH'];
      return ConformanceVerdict.parse({ client_id: clientId, verdict: 'UNQUALIFIED', reasons: versionReasons.sort(), evidence_refs: [] });
    }
    for (const check of evidence.checks) evidenceRefs.push(check.evidence_ref);
    for (const test of evidence.negative_bypass_tests) evidenceRefs.push(test.evidence_ref);
    const failedChecks = evidence.checks.filter(check => !check.passed);
    const failedNegative = evidence.negative_bypass_tests.filter(test => !test.passed);
    if (failedNegative.length > 0) reasons.push('NEGATIVE_BYPASS_TESTS_FAILED');
    if (evidence.negative_bypass_tests.length === 0) reasons.push('NEGATIVE_BYPASS_TESTS_MISSING');
    if (failedChecks.length > 0) reasons.push('MEDIATION_CHECKS_FAILED');
    const fullyGoverned = reasons.length === 0 &&
      evidence.negative_bypass_tests.length > 0 && evidence.negative_bypass_tests.every(test => test.passed) &&
      evidence.checks.every(check => check.passed);
    const verdict: ConformanceVerdictT['verdict'] = fullyGoverned ? 'FULLY_GOVERNED' : 'MANAGED_OBSERVED';
    return ConformanceVerdict.parse({ client_id: clientId, verdict, reasons: reasons.sort(), evidence_refs: [...new Set(evidenceRefs)].sort() });
  }
  return Object.freeze({ evaluate });
}
export type ClientConformance = ReturnType<typeof createClientConformance>;
