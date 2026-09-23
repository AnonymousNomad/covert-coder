import { z } from 'zod';

// Canonical component states. PID existence alone is NOT health: states must be
// derived from readiness/liveness/ownership/port truth where available, and
// UNKNOWN is the honest state when a probe is not wired.
export const HealthComponentState = z.enum(['STARTING', 'HEALTHY', 'DEGRADED', 'UNHEALTHY', 'STOPPED', 'UNKNOWN']);
export type HealthComponentStateT = z.infer<typeof HealthComponentState>;

export const HealthComponentName = z.enum(['backend', 'facade', 'resident', 'model_engines', 'workers', 'remote_bridge']);
export type HealthComponentNameT = z.infer<typeof HealthComponentName>;

export const HealthEvidenceValue = z.union([z.string(), z.number(), z.boolean(), z.null()]);

export const HealthComponent = z.strictObject({
  component: HealthComponentName,
  state: HealthComponentState,
  detail: z.string().max(600),
  evidence: z.record(z.string(), HealthEvidenceValue),
  checked_at: z.string()
});
export type HealthComponentT = z.infer<typeof HealthComponent>;

export const HealthResponse = z
  .object({
    version: z.string(),
    uptimeMs: z.number(),
    workspace: z.string(),
    freeMemoryMB: z.number(),
    state: HealthComponentState,
    components: z.array(HealthComponent).max(16),
    checked_at: z.string()
  })
  .strict();

export type HealthResponseT = z.infer<typeof HealthResponse>;
