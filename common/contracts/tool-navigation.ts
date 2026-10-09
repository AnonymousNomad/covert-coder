import { z } from 'zod';

// P1 — Tool Navigator contract (covert.tool-navigation.v1).
// Bounded on-demand capability discovery for small models (Cipher/Liquid).
// Search returns a small deterministic candidate set; full descriptors load
// only on request. The navigator never invents capabilities, never converts
// unknown into supported, never widens audiences/roles/effects, and is bound
// to the upstream catalog generation. Discovery grants nothing.

const Ref = z.string().min(1).max(160);
const Generation = z.string().uuid();

export const NavigatorAudience = z.enum(['OPERATOR', 'RESIDENT', 'WORKER']);
export const NavigatorReason = z.enum([
  'STALE_GENERATION',
  'EMPTY_OBJECTIVE',
  'UNKNOWN_CAPABILITY',
  'UNAVAILABLE',
  'WRONG_AUDIENCE',
  'WRONG_ROLE',
  'MALFORMED_RECORD'
]);

export const ToolSearchRequest = z.strictObject({
  objective: z.string().min(1).max(400),
  audience: NavigatorAudience,
  role: z.string().max(64).nullable(),
  expected_generation: Generation,
  limit: z.number().int().min(1).max(20)
});

export const ToolSearchHit = z.strictObject({
  capability_id: Ref,
  owner: Ref,
  effect: z.enum(['READ', 'WRITE']),
  external_egress_required: z.boolean(),
  availability: z.enum(['ADDRESSABLE', 'UNAVAILABLE', 'UNOBSERVED']),
  matched_on: z.enum(['ID', 'OWNER', 'KEYWORDS'])
});
export const ToolSearchResult = z.strictObject({
  schema: z.literal('covert.tool-navigation.v1'),
  generation: Generation,
  hits: z.array(ToolSearchHit).max(20),
  total_considered: z.number().int().min(0),
  truncated: z.boolean(),
  execution_state: z.literal('GATED')
});

export const ToolDescribeRequest = z.strictObject({
  capability_id: Ref,
  audience: NavigatorAudience,
  role: z.string().max(64).nullable(),
  expected_generation: Generation
});
export const ToolDescriptor = z.strictObject({
  schema: z.literal('covert.tool-navigation.v1'),
  capability_id: Ref,
  owner: Ref,
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE']),
  route: z.string().regex(/^\/api\/[a-zA-Z0-9/_-]+$/),
  effect: z.enum(['READ', 'WRITE']),
  audiences: z.array(NavigatorAudience).min(1).max(3),
  selected_roles: z.array(z.string().max(64)).max(32),
  external_egress_required: z.boolean(),
  availability: z.enum(['ADDRESSABLE', 'UNAVAILABLE', 'UNOBSERVED']),
  description: z.string().max(400).nullable(),
  generation: Generation,
  execution_state: z.literal('GATED')
});

export const ToolNavigationError = z.strictObject({
  schema: z.literal('covert.tool-navigation.v1'),
  reason: NavigatorReason,
  capability_id: z.string().max(160).nullable(),
  generation: Generation.nullable()
});

export type ToolSearchRequestT = z.infer<typeof ToolSearchRequest>;
export type ToolSearchResultT = z.infer<typeof ToolSearchResult>;
export type ToolDescribeRequestT = z.infer<typeof ToolDescribeRequest>;
export type ToolDescriptorT = z.infer<typeof ToolDescriptor>;
export type ToolNavigationErrorT = z.infer<typeof ToolNavigationError>;
export type NavigatorReasonT = z.infer<typeof NavigatorReason>;
