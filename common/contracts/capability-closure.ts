import { z } from 'zod';

export const CapabilityLifecycle = z.enum(['DESIGNED', 'IMPLEMENTED', 'QUALIFIED', 'CONVERGED', 'PRODUCT-EXPOSED', 'DOGFOODED', 'RELEASE-ACCEPTED']);
const Sha = z.string().regex(/^[0-9a-f]{40}$/);
const RepoPath = z.string().min(1).max(300).refine(value => !value.startsWith('/') && !value.includes('\\') && !value.split('/').includes('..') && !value.includes(':'), 'repository-relative path required');
export const CapabilityClosureRecord = z.strictObject({
  id: z.string().min(1).max(100), name: z.string().min(1).max(150), area: z.string().min(1),
  release_required: z.boolean(), requirement: z.string().min(1), lifecycle: CapabilityLifecycle,
  origin: z.strictObject({ branch: z.string().min(1), source_sha: Sha }),
  historical_qualification: z.strictObject({ source_sha: Sha, evidence: RepoPath, scope: z.literal('BOUNDED_ORIGIN_ONLY') }).nullable(),
  qualification_scope: z.enum(['NONE', 'ORIGIN_ONLY', 'CURRENT_CANDIDATE']),
  qualification_evidence: z.array(RepoPath), implementation_paths: z.array(RepoPath),
  candidate_presence: z.enum(['PRESENT', 'PARTIAL', 'ABSENT', 'UNVERIFIED']),
  operator_exposure: z.enum(['EXPOSED', 'NOT_EXPOSED', 'UNVERIFIED']),
  operator_path: z.string().min(1), authority_dependencies: z.array(z.string().min(1)),
  runtime_dependencies: z.array(z.string().min(1)), persistence_required: z.boolean(), restart_required: z.boolean(),
  failure_contract: z.string().min(1), unknown_contract: z.string().min(1),
  tests: z.array(RepoPath), dogfood_evidence: z.array(RepoPath),
  disposition: z.enum(['CONVERGED', 'SUPERSEDED', 'DEFERRED', 'REJECTED']), disposition_reason: z.string().min(1),
  release_evidence: z.strictObject({ source_sha: Sha, artifact_sha256: z.string().regex(/^[0-9a-f]{64}$/), ci_run: z.string().min(1), evidence_paths: z.array(RepoPath).min(1) }).nullable(),
}).superRefine((record, context) => {
  const rank = CapabilityLifecycle.options.indexOf(record.lifecycle);
  if (rank >= 2 && record.qualification_evidence.length === 0) context.addIssue({ code: 'custom', message: 'qualification requires evidence' });
  if (rank >= 3 && (record.candidate_presence !== 'PRESENT' || record.disposition !== 'CONVERGED')) context.addIssue({ code: 'custom', message: 'convergence requires a present canonical implementation and disposition' });
  if (rank >= 4 && record.operator_exposure !== 'EXPOSED') context.addIssue({ code: 'custom', message: 'product exposure must be established' });
  if (rank >= 5 && record.dogfood_evidence.length === 0) context.addIssue({ code: 'custom', message: 'dogfood requires evidence' });
  if (rank >= 6 && (record.release_evidence === null || record.qualification_scope !== 'CURRENT_CANDIDATE')) context.addIssue({ code: 'custom', message: 'release acceptance requires current candidate evidence' });
});

export const CapabilityClosure = z.strictObject({
  schema_version: z.literal(1), assessed_source: z.strictObject({ branch: z.string().min(1), source_sha: Sha }),
  coverage: z.enum(['PARTIAL', 'COMPLETE']), coverage_note: z.string().min(1),
  records: z.array(CapabilityClosureRecord).min(1),
}).superRefine((closure, context) => {
  const ids = closure.records.map(record => record.id);
  if (new Set(ids).size !== ids.length) context.addIssue({ code: 'custom', message: 'duplicate capability ID' });
  if (!closure.records.some(record => record.release_required)) context.addIssue({ code: 'custom', message: 'release-required inventory cannot be empty' });
});

export function evaluateCapabilityClosure(input: unknown, candidate: { branch: string; sha: string; hasFile: (file: string) => boolean }) {
  const closure = CapabilityClosure.parse(input);
  const blockers: Array<{ id: string; reason: string; path?: string }> = [];
  if (candidate.branch !== closure.assessed_source.branch) blockers.push({ id: 'candidate', reason: 'NON_CANONICAL_BRANCH' });
  if (closure.coverage !== 'COMPLETE') blockers.push({ id: 'inventory', reason: 'INCOMPLETE_CAPABILITY_INVENTORY' });
  for (const record of closure.records) {
    if (!record.release_required) continue;
    if (record.historical_qualification && (record.candidate_presence !== 'PRESENT' || record.operator_exposure !== 'EXPOSED')) blockers.push({ id: record.id, reason: 'CAPABILITY_DRIFT' });
    if (record.disposition !== 'CONVERGED') blockers.push({ id: record.id, reason: 'REQUIRED_CAPABILITY_NOT_CONVERGED' });
    if (record.lifecycle !== 'RELEASE-ACCEPTED' || record.release_evidence?.source_sha !== candidate.sha) blockers.push({ id: record.id, reason: 'CURRENT_RELEASE_ACCEPTANCE_MISSING' });
    const currentEvidence = record.qualification_scope === 'CURRENT_CANDIDATE' ? [...record.qualification_evidence, ...record.tests, ...record.dogfood_evidence] : [];
    for (const file of [...record.implementation_paths, ...currentEvidence, ...(record.release_evidence?.evidence_paths ?? [])]) {
      if (!candidate.hasFile(file)) blockers.push({ id: record.id, reason: 'CANDIDATE_FILE_MISSING', path: file });
    }
  }
  return { state: blockers.length ? 'BLOCKED' : 'LEDGER_REQUIREMENTS_SATISFIED', source_sha: candidate.sha, blockers };
}
