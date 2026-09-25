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
    const target = { binding: { execution_class: 'LOCAL' } } as unknown as import('../../node/src/services/model-router.ts').ResolvedChatAuthorityTarget;
    const router = {
      resolveAuthorityTarget: () => ({ status: 'RESOLVED', target }),
      chatResolvedTarget: async (_target: unknown, messages: ChatMessageT[]) => {
        seen.push(messages);
        return { text: 'ok', modelId: 'local:test', timingMs: 1 };
      },
      chatStreamResolvedTarget: async (_target: unknown, messages: ChatMessageT[], onDelta: (delta: string) => void) => {
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

    const nonStream = routeForChat(router, runtime, workspace);
    const nonStreamContext = { query: {}, body: request, execution: {} as never };
    await nonStream.describeOperation!(nonStreamContext, 'fixture-chat');
    await nonStream.handler(nonStreamContext);
    const response = new EventEmitter() as EventEmitter & {
      writeHead: (...args: unknown[]) => void;
      write: (chunk: string) => void;
      end: () => void;
    };
    response.writeHead = () => {};
    response.write = () => {};
    response.end = () => {};
    const stream = routeForChatStream(router, runtime, workspace);
    const streamContext = { query: {}, body: request, execution: {} as never };
    await stream.describeOperation!(streamContext, 'fixture-chat');
    await stream.stream!(streamContext, response as never);

    assert.equal(seen.length, 2);
    assert.deepEqual(seen[1], seen[0]);
    assert.ok(seen[0]!.some(message => message.content.includes('[AIDE harness')));
  } finally {
    await fs.rm(workspace, { recursive: true, force: true });
  }
});

test('Context Control retrieves bounded workspace memory for the later model call', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'aide-chat-memory-'));
  const otherWorkspace = await fs.mkdtemp(path.join(os.tmpdir(), 'aide-chat-memory-other-'));
  try {
    await fs.mkdir(path.join(workspace, '.aide', 'memory'), { recursive: true });
    const entries = Array.from({ length: 12 }, (_, index) => JSON.stringify({
      session_id: `memory-${index}`,
      ts: `2026-09-17T10:${String(index).padStart(2, '0')}:00Z`,
      scope: 'workspace',
      intent: 'editor preference continuity',
      summary: `Use the dark editor layout for the project workspace ${index}.`,
      outcome: 'validated'
    })).join('\n') + '\n';
    await fs.writeFile(path.join(workspace, '.aide', 'memory', 'sessions.jsonl'), entries, 'utf8');
    const runtime = { refreshServedContext: async () => {}, getEffectiveContext: () => 4096 };
    const request: ChatRequestT = { modelId: 'local:test', messages: [{ role: 'user', content: 'What editor preference should I use?' }] };
    const composed = await createChatContextComposer({ workspace, runtime }).compose(request);
    const isolated = await createChatContextComposer({ workspace: otherWorkspace, runtime }).compose(request);

    assert.equal(composed.harness.memory_recall_degraded, false);
    assert.ok(Number(composed.harness.memory_recall_hits) >= 1);
    assert.ok(Number(composed.harness.memory_recall_tokens) <= 409);
    assert.ok(composed.messages.some(message => message.content.includes('[recent context - recalled from prior session memory')));
    assert.equal(isolated.harness.memory_recall_hits, 0);
    assert.equal(isolated.harness.memory_recall_degraded, true);
    assert.ok(!isolated.messages.some(message => message.content.includes('dark editor layout')));
  } finally {
    await fs.rm(workspace, { recursive: true, force: true });
    await fs.rm(otherWorkspace, { recursive: true, force: true });
  }
});
