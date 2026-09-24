// node/src/services/system-advisories.ts
// SYSTEM ADVISORIES — severity-aware system facts. Strictly separate from
// Developer Notes and from qualification evidence.
export const ADVISORY_SEVERITIES = ['INFO', 'CAUTION', 'BLOCKING'] as const;
export type AdvisorySeverity = (typeof ADVISORY_SEVERITIES)[number];

export interface SystemAdvisory {
  kind: 'system-advisory';
  id: string;
  severity: AdvisorySeverity;
  title: string;
  detail: string;
  evidence_refs: string[];
}

export const Advisories = {
  qualificationPending: (model: string, refs: string[] = []): SystemAdvisory => ({
    kind: 'system-advisory', id: `adv-qual-pending-${model}`, severity: 'INFO',
    title: `${model} qualification pending`, detail: 'No qualification evidence is recorded for the selected role yet.', evidence_refs: refs
  }),
  credentialRotationRequired: (provider: string): SystemAdvisory => ({
    kind: 'system-advisory', id: `adv-cred-rotation-${provider}`, severity: 'BLOCKING',
    title: `${provider} credential requires rotation`, detail: 'Cloud access is blocked until rotation is confirmed.', evidence_refs: []
  }),
  artifactHashMismatch: (model: string, expected: string, actual: string): SystemAdvisory => ({
    kind: 'system-advisory', id: `adv-hash-mismatch-${model}`, severity: 'BLOCKING',
    title: `${model} artifact hash mismatch`, detail: `Expected ${expected.slice(0, 12)}…, found ${actual.slice(0, 12)}…`, evidence_refs: []
  }),
  insufficientRam: (model: string, requiredMb: number, availableMb: number): SystemAdvisory => ({
    kind: 'system-advisory', id: `adv-ram-${model}`, severity: 'CAUTION',
    title: `Insufficient RAM for ${model}`, detail: `Requires ~${requiredMb} MB; ${availableMb} MB available.`, evidence_refs: []
  }),
  roleNotQualified: (model: string, role: string, refs: string[] = []): SystemAdvisory => ({
    kind: 'system-advisory', id: `adv-role-${model}-${role}`, severity: 'CAUTION',
    title: `${model} is not qualified for ${role}`, detail: 'Selection is permitted; qualification evidence does not support this role.', evidence_refs: refs
  }),
  evidenceStale: (model: string, reasons: string[]): SystemAdvisory => ({
    kind: 'system-advisory', id: `adv-stale-${model}`, severity: 'CAUTION',
    title: `${model} qualification is stale`, detail: `Reasons: ${reasons.join(', ')}.`, evidence_refs: []
  }),
  runtimeOwnedByAnotherLane: (backend: string, owner: string): SystemAdvisory => ({
    kind: 'system-advisory', id: `adv-runtime-${backend}`, severity: 'INFO',
    title: `Runtime ${backend} currently owned by ${owner}`, detail: 'Model runs may contend for resources.', evidence_refs: []
  })
};
