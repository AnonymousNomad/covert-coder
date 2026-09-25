import { createHash } from 'node:crypto';

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function summarizeChatResponse({ status, requestBody, responseBody, parseError = false }) {
  const first = responseBody?.choices?.[0] ?? null;
  const message = first?.message ?? null;
  const content = typeof message?.content === 'string' ? message.content : null;
  const reasoning = typeof message?.reasoning_content === 'string' ? message.reasoning_content : null;
  const calls = Array.isArray(message?.tool_calls) ? message.tool_calls : [];
  const request = requestBody && typeof requestBody === 'object' ? requestBody : {};

  return {
    status,
    parse_error: parseError,
    request: {
      streaming: request.stream === true,
      max_tokens: Number.isFinite(request.max_tokens) ? request.max_tokens : null,
      temperature: Number.isFinite(request.temperature) ? request.temperature : null,
      response_format_type: typeof request.response_format?.type === 'string' ? request.response_format.type : null,
      strict_schema: request.response_format?.json_schema?.strict === true
    },
    response: responseBody && typeof responseBody === 'object' ? {
      top_level_keys: Object.keys(responseBody).sort(),
      choice_count: Array.isArray(responseBody.choices) ? responseBody.choices.length : 0,
      message_keys: message && typeof message === 'object' ? Object.keys(message).sort() : [],
      content_present: content !== null,
      content_chars: content?.length ?? 0,
      content_sha256: content === null ? null : sha256(content),
      reasoning_content_present: reasoning !== null,
      reasoning_content_chars: reasoning?.length ?? 0,
      tool_call_count: calls.length,
      tool_calls: calls.map(call => {
        const name = typeof call?.function?.name === 'string' ? call.function.name : null;
        const args = typeof call?.function?.arguments === 'string' ? call.function.arguments : null;
        return {
          function_name: name,
          arguments_chars: args?.length ?? 0,
          arguments_sha256: args === null ? null : sha256(args)
        };
      }),
      finish_reason: typeof first?.finish_reason === 'string' ? first.finish_reason : null,
      usage: responseBody.usage && typeof responseBody.usage === 'object' ? {
        prompt_tokens: Number.isFinite(responseBody.usage.prompt_tokens) ? responseBody.usage.prompt_tokens : null,
        completion_tokens: Number.isFinite(responseBody.usage.completion_tokens) ? responseBody.usage.completion_tokens : null,
        total_tokens: Number.isFinite(responseBody.usage.total_tokens) ? responseBody.usage.total_tokens : null
      } : null
    } : null
  };
}
