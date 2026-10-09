import { z } from 'zod';

// Canonical Resident binding state. Cipher is the persistent Resident and
// Liquid is the canonical Resident model; worker models are delegated
// resources and never silently become the Resident. This projection is
// derived from canonical Model Manager inventory + runtime status on every
// read (no parallel registry, no persisted UI state), so it survives UI
// reloads by construction.

export const RESIDENT_BINDING_SCHEMA = 'covert.resident-binding.v1';
export const CANONICAL_RESIDENT_ID = 'cipher';
export const CANONICAL_RESIDENT_FAMILY = 'liquid';

export const ResidentBindingState = z.enum(['BOUND', 'UNBOUND', 'DEGRADED']);
export const ResidentAvailabilityState = z.enum(['AVAILABLE', 'UNAVAILABLE', 'UNKNOWN']);
export const ResidentRuntimeState = z.enum(['RUNNING', 'LOADABLE', 'NOT_LOADABLE', 'UNKNOWN']);
export const ResidentDegradedReason = z.enum([
  'resident_model_not_registered',
  'resident_model_artifact_unavailable',
  'resident_runtime_unavailable',
  'resident_runtime_unverified',
  'resident_model_not_qualified',
  'resident_role_qualification_unverified',
  'multiple_resident_candidates',
  'binding_unverified'
]);

const IsoTime = z.string().refine(value => Number.isFinite(Date.parse(value)), 'timestamp required');

export const ResidentBinding = z.strictObject({
  schema: z.literal(RESIDENT_BINDING_SCHEMA),
  resident_id: z.literal(CANONICAL_RESIDENT_ID),
  resident_model_id: z.string().min(1).max(240).nullable(),
  resident_model_family: z.string().min(1).max(120).nullable(),
  binding_state: ResidentBindingState,
  availability_state: ResidentAvailabilityState,
  runtime_state: ResidentRuntimeState,
  execution_node: z.string().min(1).max(80),
  degraded_reason: ResidentDegradedReason.nullable(),
  last_verified_at: IsoTime.nullable()
});

export type ResidentBindingT = z.infer<typeof ResidentBinding>;
export type ResidentDegradedReasonT = z.infer<typeof ResidentDegradedReason>;
