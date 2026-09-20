// Resident intent-readiness contract (Wave 5). Deterministic, product-level
// gating of governed work: a request is assessed against canonical project
// state BEFORE any execution is committed. Clarification establishes intent;
// it never grants authority.
import { z } from 'zod';

export const ReadinessStatus = z.enum(['READY', 'NEEDS_CLARIFICATION', 'BLOCKED']);
export type ReadinessStatusT = z.infer<typeof ReadinessStatus>;

export const ReadinessTaskClass = z.enum([
  'software-engineering', 'debugging', 'testing', 'review', 'refactoring',
  'documentation', 'research', 'build-app', 'destructive-targeted', 'deployment', 'unknown'
]);
export type ReadinessTaskClassT = z.infer<typeof ReadinessTaskClass>;

export const ClarificationQuestion = z.strictObject({
  id: z.string().min(1).max(80),
  question: z.string().min(1).max(400),
  options: z.array(z.string().min(1).max(60)).max(4)
});
export type ClarificationQuestionT = z.infer<typeof ClarificationQuestion>;

export const ResidentIntentRequest = z.strictObject({
  // The raw user request. Omit when replying to a pending clarification.
  task: z.string().min(1).max(8000).optional(),
  // Reply binding: which pending clarification this reply belongs to.
  pending_id: z.string().uuid().optional(),
  // Small bounded answers keyed by question id.
  answers: z.record(z.string(), z.string().min(1).max(400)).optional()
});
export type ResidentIntentRequestT = z.infer<typeof ResidentIntentRequest>;

export const ResidentIntentResponse = z.strictObject({
  readiness_id: z.string().uuid(),
  status: ReadinessStatus,
  task: z.string().min(1).max(8000),
  task_class: ReadinessTaskClass,
  known_requirements: z.array(z.string().max(300)).max(16),
  missing_requirements: z.array(z.string().max(300)).max(16),
  safe_assumptions: z.array(z.string().max(300)).max(16),
  unsafe_assumptions: z.array(z.string().max(300)).max(16),
  clarification_questions: z.array(ClarificationQuestion).max(3),
  workflow_hint: z.strictObject({
    project_id: z.string().max(200).nullable(),
    stage: z.string().max(80).nullable()
  }),
  risk_class: z.enum(['low', 'medium', 'high']),
  authority_relevance: z.string().max(300),
  autonomy: z.enum(['supervised', 'bounded']),
  resolution: z.enum(['none', 'answered', 'blocked', 'unsupported', 'ambiguous-pending']),
  created_at: z.string(),
  updated_at: z.string()
});
export type ResidentIntentResponseT = z.infer<typeof ResidentIntentResponse>;

export const ResidentIntentGetQuery = z.strictObject({ id: z.string().uuid() });
export const ResidentIntentListResponse = z.strictObject({
  pending: z.array(z.strictObject({
    readiness_id: z.string().uuid(),
    task: z.string().max(8000),
    status: ReadinessStatus,
    created_at: z.string()
  }))
});
