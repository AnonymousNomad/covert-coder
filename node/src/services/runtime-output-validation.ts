export interface RuntimeSafeParseSchema<T> {
  safeParse(value: unknown):
    | { success: true; data: T }
    | { success: false; error: unknown };
}

export type StructuredOutputRejectReason = 'INVALID_TEXT' | 'EMPTY_OUTPUT' | 'INVALID_JSON' | 'SCHEMA_MISMATCH';

export type StructuredOutputValidation<T> =
  | { accepted: true; value: T }
  | { accepted: false; reason: StructuredOutputRejectReason };

export function validateStructuredOutput<T>(rawText: unknown, schema: RuntimeSafeParseSchema<T>): StructuredOutputValidation<T> {
  if (typeof rawText !== 'string') return { accepted: false, reason: 'INVALID_TEXT' };
  const text = rawText.trim();
  if (text.length === 0) return { accepted: false, reason: 'EMPTY_OUTPUT' };
  let decoded: unknown;
  try {
    decoded = JSON.parse(text);
  } catch {
    return { accepted: false, reason: 'INVALID_JSON' };
  }
  const parsed = schema.safeParse(decoded);
  if (!parsed.success) return { accepted: false, reason: 'SCHEMA_MISMATCH' };
  return { accepted: true, value: parsed.data };
}

export type StructuredOutputDisposition<T> =
  | { disposition: 'ACCEPTED'; value: T; retry_count: 0; fallback: null }
  | { disposition: 'NEEDS_REVIEW'; reason: StructuredOutputRejectReason; retry_count: 0; fallback: 'NEEDS_REVIEW' };

export function classifyStructuredOutput<T>(rawText: unknown, schema: RuntimeSafeParseSchema<T>): StructuredOutputDisposition<T> {
  const validation = validateStructuredOutput(rawText, schema);
  if (validation.accepted) return { disposition: 'ACCEPTED', value: validation.value, retry_count: 0, fallback: null };
  return { disposition: 'NEEDS_REVIEW', reason: validation.reason, retry_count: 0, fallback: 'NEEDS_REVIEW' };
}

export type RuntimeToolCallValidation<T> =
  | { accepted: true; callId: string | null; name: string; arguments: T }
  | { accepted: false; reason: 'NO_CALL' | 'MULTIPLE_CALLS' | 'INVALID_ENVELOPE' | 'WRONG_NAME' | 'INVALID_ARGUMENT_JSON' | 'SCHEMA_MISMATCH' };

export function validateSingleRuntimeToolCall<T>(
  toolCalls: unknown,
  expectedName: string,
  schema: RuntimeSafeParseSchema<T>
): RuntimeToolCallValidation<T> {
  if (!Array.isArray(toolCalls) || toolCalls.length === 0) return { accepted: false, reason: 'NO_CALL' };
  if (toolCalls.length !== 1) return { accepted: false, reason: 'MULTIPLE_CALLS' };
  const call = toolCalls[0];
  if (call === null || typeof call !== 'object' || Array.isArray(call)) return { accepted: false, reason: 'INVALID_ENVELOPE' };
  const record = call as Record<string, unknown>;
  const fn = record.function;
  if (record.type !== 'function' || fn === null || typeof fn !== 'object' || Array.isArray(fn)) {
    return { accepted: false, reason: 'INVALID_ENVELOPE' };
  }
  const functionRecord = fn as Record<string, unknown>;
  if (functionRecord.name !== expectedName) return { accepted: false, reason: 'WRONG_NAME' };
  if (typeof functionRecord.arguments !== 'string') return { accepted: false, reason: 'INVALID_ENVELOPE' };
  let decoded: unknown;
  try {
    decoded = JSON.parse(functionRecord.arguments);
  } catch {
    return { accepted: false, reason: 'INVALID_ARGUMENT_JSON' };
  }
  const parsed = schema.safeParse(decoded);
  if (!parsed.success) return { accepted: false, reason: 'SCHEMA_MISMATCH' };
  return {
    accepted: true,
    callId: typeof record.id === 'string' ? record.id : null,
    name: expectedName,
    arguments: parsed.data
  };
}
