// Guided setup progress only. Product configuration remains owned by the
// provider, Model Manager, routing, workspace, and security services.

import { z } from 'zod';

export const OnboardingStep = z.enum([
  'welcome',
  'local_intelligence',
  'providers',
  'workflow',
  'security',
  'workspace',
  'verify',
  'finish'
]);

export const OnboardingRole = z.enum(['developer', 'researcher', 'student', 'other']);
export const OnboardingWorkbench = z.enum(['sovereign-coder', 'sovereign-pipeline', 'sovereign-architect']);
export const OnboardingByokProvider = z.enum([
  'openai',
  'anthropic',
  'cohere',
  'openrouter',
  'mistral',
  'groq',
  'gemini'
]);

export const OnboardingUserChoices = z.object({
  name: z.string().min(1).max(80),
  role: OnboardingRole,
  workbench: OnboardingWorkbench,
  byok_provider: OnboardingByokProvider.optional(),
  byok_key_stored: z.boolean().default(false),
  desktop_enabled: z.boolean().default(false)
}).strict();

export const OnboardingStepStatus = z.object({
  skipped: z.boolean(),
  completed_at: z.number().int().nullable()
}).strict();

export const OnboardingState = z.object({
  current_step: OnboardingStep,
  completed: z.record(OnboardingStep, OnboardingStepStatus),
  user_choices: OnboardingUserChoices.partial(),
  walkthrough_complete: z.boolean(),
  deferred: z.boolean().default(false),
  started_at: z.number().int(),
  updated_at: z.number().int()
}).strict();

export const OnboardingStateResponse = z.object({
  state: OnboardingState
}).strict();

export const OnboardingNextResponse = z.object({
  state: OnboardingState,
  advanced_to: OnboardingStep
}).strict();

export const OnboardingCompleteResponse = z.object({
  state: OnboardingState,
  complete: z.literal(true)
}).strict();

export const OnboardingRestartRequest = z.strictObject({});
export const OnboardingRestartResponse = z.strictObject({ state: OnboardingState });
export const OnboardingDeferRequest = z.strictObject({});
export const OnboardingDeferResponse = z.strictObject({ state: OnboardingState });
export const OnboardingResumeRequest = z.strictObject({});
export const OnboardingResumeResponse = z.strictObject({ state: OnboardingState });

export type OnboardingStepT = z.infer<typeof OnboardingStep>;
export type OnboardingRoleT = z.infer<typeof OnboardingRole>;
export type OnboardingWorkbenchT = z.infer<typeof OnboardingWorkbench>;
export type OnboardingByokProviderT = z.infer<typeof OnboardingByokProvider>;
export type OnboardingUserChoicesT = z.infer<typeof OnboardingUserChoices>;
export type OnboardingStepStatusT = z.infer<typeof OnboardingStepStatus>;
export type OnboardingStateT = z.infer<typeof OnboardingState>;
export type OnboardingStateResponseT = z.infer<typeof OnboardingStateResponse>;
export type OnboardingNextResponseT = z.infer<typeof OnboardingNextResponse>;
export type OnboardingCompleteResponseT = z.infer<typeof OnboardingCompleteResponse>;
export type OnboardingRestartResponseT = z.infer<typeof OnboardingRestartResponse>;
export type OnboardingDeferResponseT = z.infer<typeof OnboardingDeferResponse>;
export type OnboardingResumeResponseT = z.infer<typeof OnboardingResumeResponse>;
