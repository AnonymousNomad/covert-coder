import assert from 'node:assert/strict';
import test from 'node:test';
import { summarizeChatResponse } from '../../scripts/qualification/runtime-response-evidence.mjs';

test('response evidence records empty content and reasoning metadata without reasoning text', () => {
  const privateReasoning = 'PRIVATE REASONING TEXT';
  const result = summarizeChatResponse({
    status: 200,
    requestBody: { stream: false, max_tokens: 512, temperature: 0 },
    responseBody: {
      id: 'response-1',
      choices: [{ message: { role: 'assistant', content: '', reasoning_content: privateReasoning }, finish_reason: 'length' }],
      usage: { prompt_tokens: 24, completion_tokens: 96, total_tokens: 120 }
    }
  });

  assert.equal(result.status, 200);
  assert.equal(result.request.max_tokens, 512);
  assert.equal(result.response.content_chars, 0);
  assert.equal(result.response.reasoning_content_present, true);
  assert.equal(result.response.reasoning_content_chars, privateReasoning.length);
  assert.equal(result.response.finish_reason, 'length');
  assert.equal(result.response.usage.completion_tokens, 96);
  assert.equal(JSON.stringify(result).includes(privateReasoning), false);
});

test('response evidence records a backend tool-call signature without argument contents', () => {
  const privateArgs = '{"path":"runtime-v1-harmless-fixture.txt"}';
  const result = summarizeChatResponse({
    status: 200,
    requestBody: { stream: false, max_tokens: 512, temperature: 0 },
    responseBody: {
      choices: [{ message: { role: 'assistant', content: null, tool_calls: [{ function: { name: 'workspace.read', arguments: privateArgs } }] }, finish_reason: 'tool_calls' }]
    }
  });

  assert.equal(result.response.tool_call_count, 1);
  assert.equal(result.response.tool_calls[0].function_name, 'workspace.read');
  assert.equal(result.response.tool_calls[0].arguments_chars, privateArgs.length);
  assert.equal(JSON.stringify(result).includes(privateArgs), false);
});

test('response evidence preserves stream and parser failure state without request content', () => {
  const secretPrompt = 'DO NOT LOG THIS PROMPT';
  const result = summarizeChatResponse({
    status: 200,
    requestBody: { stream: true, max_tokens: 512, temperature: 0, messages: [{ role: 'user', content: secretPrompt }] },
    responseBody: null,
    parseError: true
  });

  assert.equal(result.request.streaming, true);
  assert.equal(result.parse_error, true);
  assert.equal(result.response, null);
  assert.equal(JSON.stringify(result).includes(secretPrompt), false);
});
