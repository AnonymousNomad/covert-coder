import { z } from 'zod';

// Canonical first-run readiness contract. One deterministic source for the
// onboarding gate: every item carries code/explanation/repair/blocking so
// frontends never infer system health themselves.
export const ReadinessItemState = z.enum(['READY', 'DEGRADED', 'BLOCKED', 'OPTIONAL', 'UNKNOWN']);
export type ReadinessItemStateT = z.infer<typeof ReadinessItemState>;

export const ReadinessItem = z.strictObject({
  id: z.string().min(1).max(80),
  state: ReadinessItemState,
  code: z.string().min(1).max(80),
  explanation: z.string().max(500),
  repair: z.string().max(500).nullable(),
  blocking: z.boolean()
});
export type ReadinessItemT = z.infer<typeof ReadinessItem>;

export const ReadinessResponse = z.strictObject({
  ready: z.boolean(),
  ready_for_golden_mission: z.boolean(),
  items: z.array(ReadinessItem).max(32),
  generated_at: z.string()
});
export type ReadinessResponseT = z.infer<typeof ReadinessResponse>;
