import type { Route } from '../server.ts';
import { RouteError } from '../server.ts';
import type { OperationInput } from '../../../common/security/operation-policy.mjs';
import { RouterError, type ModelRouter } from '../services/model-router.ts';
import type { ModelRuntime } from '../services/model-runtime.ts';
import type { ChatStore } from '../services/chat-store.ts';
import type { ChatRequestT, ChatMessageT, ChatStreamRequestT } from '../../../common/contracts/chat.ts';
import {
  ChatRequestCompat,
  ChatResponse,
  ChatStreamRequest,
  ChatStreamDelta,
  ChatStreamDone,
  ChatStreamError,
  ChatHistoryResponse,
  ChatHistorySaveRequest,
  ChatHistorySaveResponse
} from '../../../common/contracts/chat.ts';
import { createRequire } from 'node:module';
import { createChatContextComposer, type ChatContextProviders, type ChatIndexService } from '../services/chat-context.ts';

const require = createRequire(import.meta.url);
const { scoreCandidate } = require('../../../harness/gates.mjs') as {
  scoreCandidate(text: string): { pass: boolean; penalty: number };
};

type MemoryRecallService = {
  recall(q: string, opts?: { topN?: number }): Promise<{
    hits: Array<{ ts: string; intent?: string; summary?: string; files_touched?: string[]; outcome?: string }>;
    degraded: boolean;
    approxTokens?: number;
  }>;
  remember(entry: {
    session_id: string;
    ts: string;
    intent?: string;
    summary?: string;
    outcome?: string;
    skills_invoked?: string[];
    files_touched?: string[];
  }): Promise<void>;
};

let memoryRecall: MemoryRecallService | null = null;

type ChatRouteOptions = {
  indexService?: ChatIndexService;
  providers?: ChatContextProviders;
};

function toRouteError(error: unknown): RouteError {
  if (error instanceof RouterError) return new RouteError(error.code, error.message);
  if (error instanceof Error && error.name === 'AbortError') return new RouteError('TIMEOUT', 'chat stream aborted');
  return new RouteError('CHILD_FAILED', error instanceof Error ? error.message : 'chat failed');
}

function createComposer(runtime: ModelRuntime, workspace: string, options?: ChatRouteOptions) {
  return createChatContextComposer({
    workspace,
    runtime,
    ...(options?.indexService ? { indexService: options.indexService } : {}),
    ...(options?.providers ? { providers: options.providers } : {})
  });
}

export function routeForChat(
  router: ModelRouter,
  runtime: ModelRuntime,
  workspace: string,
  options?: ChatRouteOptions
): Route {
  const composer = createComposer(runtime, workspace, options);
  return {
    method: 'POST',
    path: '/api/chat',
    body: ChatRequestCompat,
    response: ChatResponse,
    handler: async ({ body }) => {
      const request = body as ChatRequestT;
      try {
        const composed = await composer.compose(request);
        const result = await gatedChat(router, request, composed.messages);
        return {
          text: result.text,
          modelId: result.modelId,
          tokens: result.tokens,
          timingMs: result.timingMs,
          answer: result.text,
          gated: result.gated,
          harness: composed.harness
        };
      } catch (error) {
        throw toRouteError(error);
      }
    }
  };
}

export function routeForChatStream(
  router: ModelRouter,
  runtime: ModelRuntime,
  workspace: string,
  options?: ChatRouteOptions
): Route {
  const composer = createComposer(runtime, workspace, options);
  return {
    method: 'POST',
    path: '/api/chat/stream',
    body: ChatStreamRequest,
    response: ChatStreamDone,
    handler: () => ({ done: true as const, modelId: '', usedApprox: 0, dropped: 0, truncatedSystem: false }),
    stream: async ({ body }, res) => {
      const request = body as ChatStreamRequestT;
      res.writeHead(200, {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
        connection: 'keep-alive'
      });
      const controller = new AbortController();
      let aborted = false;
      res.on('close', () => {
        aborted = true;
        controller.abort();
      });
      const write = (payload: unknown): void => {
        if (aborted) return;
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
      };
      try {
        const composed = await composer.compose({ modelId: request.modelId, messages: request.messages, harness: true });
        const result = await router.chatStream(request.modelId, composed.messages, delta => {
          const parsed = ChatStreamDelta.safeParse({ delta });
          if (parsed.success) write(parsed.data);
        }, controller.signal);
        const done = ChatStreamDone.safeParse({
          done: true,
          modelId: result.modelId,
          usedApprox: result.usedApprox,
          dropped: result.dropped,
          truncatedSystem: result.truncatedSystem
        });
        if (done.success) write(done.data);
      } catch (error) {
        if (!aborted) {
          const parsed = ChatStreamError.safeParse({ error: error instanceof Error ? error.message : 'stream failed' });
          if (parsed.success) write(parsed.data);
        }
      } finally {
        if (!aborted) res.end();
      }
    }
  };
}

async function gatedChat(
  router: ModelRouter,
  request: ChatRequestT,
  messages: ChatMessageT[]
): Promise<{ text: string; modelId: string; tokens?: number; timingMs: number; gated?: { n: number; picked: number; all_passed: boolean; log: Array<{ attempt: number; temperature: number; pass: boolean; penalty: number }> } }> {
  const n = Math.min(Math.max(request.options?.n ?? 1, 1), 4);
  const baseTemp = request.options?.temperature ?? 0.2;
  if (n <= 1) {
    return router.chat(request.modelId, messages, {
      maxTokens: request.options?.maxTokens,
      temperature: baseTemp,
      timeoutMs: request.options?.timeoutMs
    });
  }
  let best: { text: string; modelId: string; tokens?: number; timingMs: number } | null = null;
  let bestPenalty = Number.POSITIVE_INFINITY;
  const log: Array<{ attempt: number; temperature: number; pass: boolean; penalty: number }> = [];
  for (let attempt = 0; attempt < n; attempt++) {
    const temperature = attempt === 0 ? baseTemp : Math.min(baseTemp + attempt * 0.25, 1.2);
    const candidate = await router.chat(request.modelId, messages, {
      maxTokens: request.options?.maxTokens,
      temperature,
      timeoutMs: request.options?.timeoutMs
    });
    const verdict = scoreCandidate(candidate.text);
    log.push({ attempt, temperature, pass: verdict.pass, penalty: verdict.penalty });
    if (!best || verdict.penalty < bestPenalty) {
      best = candidate;
      bestPenalty = verdict.penalty;
    }
    if (verdict.pass) break;
  }
  return {
    ...best!,
    gated: { n: log.length, picked: log.findIndex(entry => entry.pass), all_passed: log.every(entry => entry.pass), log }
  };
}

export function routeForChatHistory(store: ChatStore): Route {
  return {
    method: 'GET',
    path: '/api/chat/history',
    response: ChatHistoryResponse,
    handler: async () => ({ conversations: store.list() })
  };
}

function historySaveBody(body: unknown) {
  const request = body as { id?: string; modelId: string; title: string; messages: ChatMessageT[] };
  return {
    ...(request.id !== undefined ? { id: request.id } : {}),
    modelId: request.modelId,
    title: request.title,
    messages: request.messages
  };
}

export function routeForChatHistorySave(store: ChatStore, workspace: string): Route {
  return {
    method: 'POST',
    path: '/api/chat/history',
    body: ChatHistorySaveRequest,
    response: ChatHistorySaveResponse,
    describeOperation: async ({ body }, taskId): Promise<OperationInput> => ({
      workspace,
      taskId,
      kind: 'capability.write',
      args: { body: historySaveBody(body) }
    }),
    handler: async ({ body }) => {
      const request = historySaveBody(body);
      const saved = await store.save(request);
      try {
        memoryRecall = memoryRecall || require('../services/memory-recall.mjs').createMemoryRecall({ workspace });
        const memoryService = memoryRecall;
        if (memoryService === null) throw new Error('memory recall unavailable');
        const lastUser = [...request.messages].reverse().find(message => message.role === 'user');
        const lastAssistant = [...request.messages].reverse().find(message => message.role === 'assistant');
        const files = new Set<string>();
        for (const message of [lastUser, lastAssistant]) {
          const content = message?.content ?? '';
          for (const match of content.matchAll(/[A-Za-z0-9_\-.\\/]+\.(?:ts|mjs|js|cjs|py|md|json|jsonl|tsx|css|html|cmd|ps1|toml|ya?ml)/g)) {
            files.add(match[0]);
            if (files.size >= 8) break;
          }
        }
        await memoryService.remember({
          session_id: saved.id,
          ts: new Date().toISOString(),
          intent: (request.title || '').slice(0, 200),
          summary: (lastUser?.content ?? '').slice(0, 500),
          outcome: (lastAssistant?.content ?? '').slice(0, 300),
          skills_invoked: [],
          files_touched: [...files]
        });
      } catch {
        // Journaling is subordinate to the approved history save.
      }
      return { id: saved.id, updatedAt: saved.updatedAt };
    }
  };
}
