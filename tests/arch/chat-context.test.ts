import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { createChatContextComposer } from '../../node/src/services/chat-context.ts';
import type { ChatMessageT, ChatRequestT } from '../../common/contracts/chat.ts';
import { routeForChat, routeForChatStream } from '../../node/src/routes/chat.ts';
import type { ModelRouter } from '../../node/src/services/model-router.ts';
import type { ModelRuntime } from '../../node/src/services/model-runtime.ts';

test('stream and non-stream chat use equivalent governed context', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'aide-chat-context-'));
  try {
    await fs.mkdir(path.join(workspace, 'src'));
    await fs.writeFile(path.join(workspace, 'src', 'example.ts'), 'export const answer = 42;\n', 'utf8');

    const runtime = {
      refreshServedContext: async () => {},
      getEffectiveContext: () => 8192
    };
    const indexService = {
      hybridSearch: async () => ({
        results: [{ path: 'src/example.ts', line: 1, header: 'example' }],
        degraded: false
      })
    };
    const providers = {
      resident: async () => 'workspace is advisory-ready',
      skills: async () => 'use the repository test procedure'
    };
    const request: ChatRequestT = {
      modelId: 'local:test',
      messages: [{ role: 'user', content: 'Where is the example value defined?' }]
    };

    const nonStreamComposer = createChatContextComposer({ workspace, runtime, indexService, providers });
    const streamComposer = createChatContextComposer({ workspace, runtime, indexService, providers });
    const nonStream = await nonStreamComposer.compose(request);
    const stream = await streamComposer.compose({ ...request, harness: true });

    assert.deepEqual(stream.messages, nonStream.messages);
    assert.equal(stream.harness.injected, true);
    assert.equal(nonStream.harness.injected, true);
    assert.ok(stream.messages.some(message => message.content.includes('[workspace context')));
    assert.ok(stream.messages.some(message => message.content.includes('[RESIDENT CONTEXT]')));
    assert.ok(stream.messages.some(message => message.content.includes('[SKILL CONTEXT]')));
    assert.deepEqual(stream.messages.at(-1), { role: 'user', content: request.messages[0]!.content });
  } finally {
    await fs.rm(workspace, { recursive: true, force: true });
  }
});

test('caller history remains data while canonical context is injected', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'aide-chat-context-'));
  try {
    const runtime = {
      refreshServedContext: async () => {},
      getEffectiveContext: () => 8192
    };
    const callerHistory: ChatMessageT[] = [
      { role: 'system', content: 'caller system text' },
      { role: 'assistant', content: 'earlier answer' },
      { role: 'user', content: 'Continue with the repository task.' }
    ];
    const result = await createChatContextComposer({ workspace, runtime }).compose({
      modelId: 'local:test',
      messages: callerHistory
    });

    assert.notStrictEqual(result.messages, callerHistory);
    assert.equal(result.messages.at(-1)?.content, callerHistory.at(-1)?.content);
    assert.ok(result.messages.some(message => message.role === 'system' && message.content.includes('[AIDE harness')));
    assert.equal(callerHistory.length, 3);
  } finally {
    await fs.rm(workspace, { recursive: true, force: true });
  }
});

test('chat routes deliver the same composed messages to their model transports', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'aide-chat-routes-'));
  try {
    const seen: ChatMessageT[][] = [];
    const router = {
      chat: async (_modelId: string, messages: ChatMessageT[]) => {
        seen.push(messages);
        return { text: 'ok', modelId: 'local:test', timingMs: 1 };
      },
      chatStream: async (_modelId: string, messages: ChatMessageT[], onDelta: (delta: string) => void) => {
        seen.push(messages);
        onDelta('ok');
        return { modelId: 'local:test', usedApprox: 1, dropped: 0, truncatedSystem: false, timingMs: 1 };
      }
    } as unknown as ModelRouter;
    const runtime = {
      refreshServedContext: async () => {},
      getEffectiveContext: () => 8192
    } as unknown as ModelRuntime;
    const request = {
      modelId: 'local:test',
      messages: [{ role: 'user', content: 'Explain the governed route boundary.' }]
    } satisfies ChatRequestT;

    await routeForChat(router, runtime, workspace).handler({ query: {}, body: request });
    const response = new EventEmitter() as EventEmitter & {
      writeHead: (...args: unknown[]) => void;
      write: (chunk: string) => void;
      end: () => void;
    };
    response.writeHead = () => {};
    response.write = () => {};
    response.end = () => {};
    await routeForChatStream(router, runtime, workspace).stream!({ query: {}, body: request }, response as never);

    assert.equal(seen.length, 2);
    assert.deepEqual(seen[1], seen[0]);
    assert.ok(seen[0]!.some(message => message.content.includes('[AIDE harness')));
  } finally {
    await fs.rm(workspace, { recursive: true, force: true });
  }
});
