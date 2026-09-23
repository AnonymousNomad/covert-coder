import { z } from 'zod';

// Canonical resource admission contract. One decision path for every
// model-start / worker / resident admission. The Permanent Resident has
// priority over disposable workers: disposable (worker) admissions must leave
// a Resident reserve, resident admissions do not reserve against themselves.
export const AdmissionDecision = z.enum(['START', 'QUEUE', 'REFUSE_RESOURCE']);
export type AdmissionDecisionT = z.infer<typeof AdmissionDecision>;

export const AdmissionKind = z.enum(['resident', 'model_start', 'worker']);
export type AdmissionKindT = z.infer<typeof AdmissionKind>;

export const AdmissionRequirement = z.strictObject({
  memory_mb: z.number().int().gte(0).optional(),
  vram_mb: z.number().int().gte(0).optional(),
  cpu_share: z.number().gte(0).lte(1).optional()
});
export type AdmissionRequirementT = z.infer<typeof AdmissionRequirement>;

export const AdmissionRequest = z.strictObject({
  kind: AdmissionKind,
  requirement: AdmissionRequirement,
  disposable: z.boolean().optional()
});
export type AdmissionRequestT = z.infer<typeof AdmissionRequest>;

export const AdmissionEvidenceValue = z.union([z.string(), z.number(), z.boolean(), z.null()]);

export const AdmissionResponse = z.strictObject({
  decision: AdmissionDecision,
  kind: AdmissionKind,
  reason: z.string().max(600),
  evidence: z.record(z.string(), AdmissionEvidenceValue),
  checked_at: z.string()
});
export type AdmissionResponseT = z.infer<typeof AdmissionResponse>;
