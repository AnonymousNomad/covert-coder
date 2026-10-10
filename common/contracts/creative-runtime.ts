import { z } from 'zod';
import { AdmissionDecision } from './admission.ts';

export const CreativeRuntimeCapability = z.literal('VIDEO_I2V');
export type CreativeRuntimeCapabilityT = z.infer<typeof CreativeRuntimeCapability>;

export const CreativeRuntimeExecutionClass = z.literal('LOCAL');
export type CreativeRuntimeExecutionClassT = z.infer<typeof CreativeRuntimeExecutionClass>;

export const CreativeRuntimeAdapter = z.literal('COMFYUI');
export type CreativeRuntimeAdapterT = z.infer<typeof CreativeRuntimeAdapter>;

export const CreativeRuntimeEligibilityState = z.enum([
  'READY',
  'GATED',
  'RUNTIME_NOT_INSTALLED',
  'MODEL_NOT_AVAILABLE',
  'HARDWARE_BLOCKED',
  'LOCAL_RENDER_UNAVAILABLE'
]);
export type CreativeRuntimeEligibilityStateT = z.infer<typeof CreativeRuntimeEligibilityState>;

export const CreativeRuntimeBlocker = z.enum([
  'RUNTIME_NOT_INSTALLED',
  'RUNTIME_NOT_READY',
  'MODEL_NOT_SELECTED',
  'MODEL_ASSIGNMENT_UNAVAILABLE',
  'MODEL_IDENTITY_MISMATCH',
  'MODEL_NOT_AVAILABLE',
  'HARDWARE_ELIGIBILITY_UNKNOWN',
  'HARDWARE_BLOCKED',
  'EXECUTION_NOT_CONNECTED',
  'ADMISSION_NOT_EVALUATED',
  'ADMISSION_QUEUED',
  'RESOURCE_ADMISSION_REFUSED'
]);
export type CreativeRuntimeBlockerT = z.infer<typeof CreativeRuntimeBlocker>;

export const CreativeRuntimeRequirement = z.strictObject({
  schema: z.literal('covert.creation-studio.runtime-requirement.v1'),
  shot_id: z.string().min(1).max(120),
  required_capability: CreativeRuntimeCapability,
  execution_class: CreativeRuntimeExecutionClass,
  adapter: CreativeRuntimeAdapter,
  requested_model_id: z.string().min(1).max(160).nullable(),
  assignment_state: z.enum(['UNASSIGNED', 'ASSIGNED', 'UNAVAILABLE'])
});
export type CreativeRuntimeRequirementT = z.infer<typeof CreativeRuntimeRequirement>;

export const CreativeRuntimeEvidence = z.strictObject({
  runtime: z.strictObject({
    adapter: CreativeRuntimeAdapter,
    installed: z.boolean(),
    ready: z.boolean()
  }),
  model: z.strictObject({
    model_id: z.string().min(1).max(160).nullable(),
    available: z.boolean()
  }),
  hardware: z.strictObject({
    eligible: z.boolean().nullable()
  }),
  execution: z.strictObject({
    connected: z.boolean(),
    admission_decision: AdmissionDecision.nullable()
  })
}).superRefine((value, ctx) => {
  if (!value.runtime.installed && value.runtime.ready) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['runtime', 'ready'],
      message: 'an uninstalled runtime cannot be ready'
    });
  }
});
export type CreativeRuntimeEvidenceT = z.infer<typeof CreativeRuntimeEvidence>;

export const CreativeRuntimeEligibility = z.strictObject({
  schema: z.literal('covert.creation-studio.runtime-eligibility.v1'),
  requirement: CreativeRuntimeRequirement,
  state: CreativeRuntimeEligibilityState,
  blockers: z.array(CreativeRuntimeBlocker),
  execution_attempted: z.literal(false),
  cloud_fallback: z.literal(false)
});
export type CreativeRuntimeEligibilityT = z.infer<typeof CreativeRuntimeEligibility>;
