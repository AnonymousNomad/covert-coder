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
import { containmentEnabled, governAnswer, logContainment } from '../services/resident-containment.mjs';

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

type ChatRouteOptions = {
  indexService?: ChatIndexService;
  providers?: ChatContextProviders;
  // Canonical live containment governance (Slice 6 wiring): the Arsenal
  // projection loader supplies capability truth; containment itself is
  // provider-owned and default-ON with explicit disable (AIDE_RESIDENT_CONTAINMENT=0).
  governance?: { getProjection?: () => Promise<unknown> };
};

function toRouteError(error: unknown): RouteError {
  if (error instanceof RouteError) return error;
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
        if (!containmentEnabled()) throw new RouteError('NOT_READY', 'chat is unavailable because Resident containment is disabled');
        const composed = await composer.compose(request);
        const result = await gatedChat(router, request, composed.messages);
        let text = result.text;
        const lastUser = [...request.messages].reverse().find(message => message.role === 'user');
        if (!lastUser) throw new RouteError('BAD_REQUEST', 'chat requires a user message for containment');
        if (lastUser) {
          let projection: unknown = null;
          try {
            projection = options?.governance?.getProjection ? await options.governance.getProjection() : null;
          } catch { projection = null; }
          const governed = await governAnswer({
            requestText: lastUser.content,
            rawText: result.text,
            projection,
            canonical: { commit_hash: 'UNKNOWN', timestamp: 'UNKNOWN' },
            generate: async note => {
              const retryMessages = composed.messages.map((message, index) =>
                index === composed.messages.length - 1 && message.role === 'user'
                  ? { ...message, content: `${message.content}\n\n(Note: ${note})` }
                  : message);
              const retry = await router.chat(request.modelId, retryMessages, {
                maxTokens: request.options?.maxTokens,
                temperature: request.options?.temperature ?? 0.2,
                timeoutMs: request.options?.timeoutMs
              });
              return retry.text;
            }
          });
          logContainment(workspace, governed);
          text = governed.final;
        }
        return {
          text,
          modelId: result.modelId,
          tokens: result.tokens,
          timingMs: result.timingMs,
          answer: text,
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
        if (!containmentEnabled()) {
          throw new RouteError('NOT_READY', 'chat is unavailable because Resident containment is disabled');
        } else {
          // Governed path (stream containment parity): generate into a buffer
          // (no user-visible deltas), run the SAME canonical containment as the
          // non-stream route, then release only the approved text in chunks.
          // Safety outranks animation: no protected claim becomes user-visible
          // before governance, and no partial unsafe fragment is ever emitted.
          let buffered = '';
          const lastUser = [...request.messages].reverse().find(message => message.role === 'user');
          if (!lastUser) throw new RouteError('BAD_REQUEST', 'chat requires a user message for containment');
          const result = await router.chatStream(request.modelId, composed.messages, delta => {
            buffered += delta;
          }, controller.signal);
          let projection: unknown = null;
          try {
            projection = options?.governance?.getProjection ? await options.governance.getProjection() : null;
          } catch { projection = null; }
          const governed = await governAnswer({
            requestText: lastUser.content,
            rawText: buffered,
            projection,
            canonical: { commit_hash: 'UNKNOWN', timestamp: 'UNKNOWN' },
            generate: async note => {
              const retryMessages = composed.messages.map((message, index) =>
                index === composed.messages.length - 1 && message.role === 'user'
                  ? { ...message, content: `${message.content}\n\n(Note: ${note})` }
                  : message);
              const retry = await router.chat(request.modelId, retryMessages, {});
              return retry.text;
            }
          });
          logContainment(workspace, governed);
          const approved = governed.final;
          for (let offset = 0; offset < approved.length; offset += 120) {
            if (aborted) break;
            const parsed = ChatStreamDelta.safeParse({ delta: approved.slice(offset, offset + 120) });
            if (parsed.success) write(parsed.data);
          }
          if (!aborted) {
            const done = ChatStreamDone.safeParse({
              done: true,
              modelId: result.modelId,
              usedApprox: result.usedApprox,
              dropped: result.dropped,
              truncatedSystem: result.truncatedSystem
            });
            if (done.success) write(done.data);
          }
        }
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
      let memory: { persisted: boolean; degraded: boolean; reason?: string } = {
        persisted: false,
        degraded: true,
        reason: 'memory journal unavailable'
      };
      try {
        const memoryService = require('../services/memory-recall.mjs').createMemoryRecall({ workspace }) as MemoryRecallService;
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
        memory = { persisted: true, degraded: false };
      } catch {
        // The conversation save remains authoritative, but the response must
        // expose that continuity is degraded instead of claiming success.
        memory = { persisted: false, degraded: true, reason: 'memory journal persistence failed' };
      }
      return { id: saved.id, updatedAt: saved.updatedAt, memory };
    }
  };
}
