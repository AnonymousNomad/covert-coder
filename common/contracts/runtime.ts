import { z } from 'zod';

export const RuntimeBackend = z.enum(['UNSLOTH', 'LLAMA_CPP']);
export const RuntimeOwnership = z.enum(['COVERT_OWNED', 'USER_OWNED', 'FOREIGN', 'UNKNOWN']);
export const RuntimeHealth = z.enum(['HEALTHY', 'UNHEALTHY', 'STOPPED', 'NOT_INSTALLED', 'UNKNOWN']);
export const RuntimeCapabilityState = z.enum(['SUPPORTED', 'PARTIAL', 'UNSUPPORTED', 'UNKNOWN']);

export const RuntimeModelIdentity = z.object({
  model_id: z.string().min(1),
  display_name: z.string().nullable(),
  artifact_name: z.string().nullable(),
  artifact_sha256: z.string().regex(/^[a-f0-9]{64}$/i).nullable(),
  identity_evidence: z.enum(['RUNTIME_REPORTED', 'REQUESTED_ARTIFACT', 'UNKNOWN'])
}).strict();

export const RuntimeCapabilityDescriptor = z.object({
  api_chat_completions: RuntimeCapabilityState,
  api_responses: RuntimeCapabilityState,
  api_anthropic_messages: RuntimeCapabilityState,
  api_embeddings: RuntimeCapabilityState,
  embeddings: RuntimeCapabilityState,
  model_discovery: RuntimeCapabilityState,
  model_load: RuntimeCapabilityState,
  model_unload: RuntimeCapabilityState,
  model_switching: RuntimeCapabilityState,
  hot_swap: RuntimeCapabilityState,
  streaming: RuntimeCapabilityState,
  cancellation: RuntimeCapabilityState,
  tool_calling: RuntimeCapabilityState,
  tool_repair: RuntimeCapabilityState,
  structured_output: RuntimeCapabilityState,
  vision: RuntimeCapabilityState,
  speculative_decoding: RuntimeCapabilityState,
  parallel_requests: RuntimeCapabilityState,
  context_controls: RuntimeCapabilityState,
  kv_cache_controls: RuntimeCapabilityState,
  metrics: RuntimeCapabilityState,
  headless: RuntimeCapabilityState,
  offline_local_inference: RuntimeCapabilityState
}).strict();

export const RuntimeMetrics = z.object({
  ram_bytes: z.number().nonnegative().nullable(),
  vram_bytes: z.number().nonnegative().nullable(),
  windows_commit_bytes: z.number().nonnegative().nullable(),
  loaded_model_bytes: z.number().nonnegative().nullable(),
  context_tokens: z.number().int().nonnegative().nullable(),
  source: z.enum(['RUNTIME', 'HOST', 'UNKNOWN'])
}).strict();

export const RuntimeError = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  at: z.string().datetime()
}).strict();

export const RuntimeStatusResponse = z.object({
  contract_version: z.literal(1),
  canonical_backend: z.literal('UNSLOTH'),
  backend: RuntimeBackend,
  version: z.string().nullable(),
  engine: z.string().nullable(),
  endpoint: z.string().nullable(),
  port: z.number().int().min(1).max(65535).nullable(),
  pid: z.number().int().positive().nullable(),
  started_at: z.string().datetime().nullable(),
  health: RuntimeHealth,
  ownership: RuntimeOwnership,
  loaded_model: RuntimeModelIdentity.nullable(),
  capabilities: RuntimeCapabilityDescriptor,
  metrics: RuntimeMetrics,
  last_error: RuntimeError.nullable(),
  fallback_event_id: z.string().nullable(),
  updated_at: z.string().datetime()
}).strict();

export const RuntimeFallbackEvent = z.object({
  event_id: z.string().min(1),
  from_backend: RuntimeBackend,
  to_backend: RuntimeBackend,
  reason: z.string().min(1).max(1000),
  explicit_operator_action: z.literal(true),
  model_id: z.string().nullable(),
  artifact_sha256: z.string().regex(/^[a-f0-9]{64}$/i).nullable(),
  at: z.string().datetime()
}).strict();

export const RuntimeToolEvidence = z.object({
  raw_model_output: z.unknown().nullable(),
  runtime_adjusted_output: z.unknown().nullable(),
  executed_tool_call: z.unknown().nullable(),
  attribution: z.enum(['MODEL', 'UNSLOTH_RUNTIME_REPAIR', 'UNKNOWN']),
  limitation: z.string().nullable()
}).strict();

export type RuntimeBackendT = z.infer<typeof RuntimeBackend>;
export type RuntimeOwnershipT = z.infer<typeof RuntimeOwnership>;
export type RuntimeHealthT = z.infer<typeof RuntimeHealth>;
export type RuntimeCapabilityStateT = z.infer<typeof RuntimeCapabilityState>;
export type RuntimeModelIdentityT = z.infer<typeof RuntimeModelIdentity>;
export type RuntimeCapabilityDescriptorT = z.infer<typeof RuntimeCapabilityDescriptor>;
export type RuntimeMetricsT = z.infer<typeof RuntimeMetrics>;
export type RuntimeStatusResponseT = z.infer<typeof RuntimeStatusResponse>;
export type RuntimeFallbackEventT = z.infer<typeof RuntimeFallbackEvent>;
export type RuntimeToolEvidenceT = z.infer<typeof RuntimeToolEvidence>;
