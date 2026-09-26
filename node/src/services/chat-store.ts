import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  ChatHistoryConversation,
  ChatHistoryResponse,
  ChatHistorySaveRequest,
  type ChatHistoryConversationT
} from '../../../common/contracts/chat.ts';
import { assertMissingStateLocationIsUsable, atomicWriteJson, AtomicJsonWriteError, StatePersistenceError, withFileMutationLock } from './atomic-json.ts';

export type ChatConversation = ChatHistoryConversationT;

export interface ChatConversationInput {
  id?: string;
  modelId: string;
  title: string;
  messages: Array<{ role: string; content: string }>;
  updatedAt?: number;
}

export class ChatStore {
  private readonly workspace: string;
  private readonly filePath: string;
  private readonly atomicWriter: typeof atomicWriteJson;
  private conversations: ChatConversation[] = [];

  constructor(workspace: string, atomicWriter: typeof atomicWriteJson = atomicWriteJson) {
    this.workspace = workspace;
    this.filePath = path.join(workspace, '.aide', 'chat-history.json');
    this.atomicWriter = atomicWriter;
  }

  async load(): Promise<ChatConversation[]> {
    return withFileMutationLock(this.filePath, async () => {
      const conversations = await this.readCanonical();
      this.conversations = conversations;
      return this.conversations;
    });
  }

  list(): ChatConversation[] {
    return [...this.conversations].sort((a, b) => b.updatedAt - a.updatedAt);
  }

  get(id: string): ChatConversation | undefined {
    return this.conversations.find(conversation => conversation.id === id);
  }

  async save(conversation: ChatConversationInput): Promise<ChatConversation> {
    const { updatedAt, ...request } = conversation;
    const parsedRequest = ChatHistorySaveRequest.safeParse(request);
    if (!parsedRequest.success) throw new Error('invalid conversation');

    return withFileMutationLock(this.filePath, async () => {
      // Re-read under the path transaction lock so independent ChatStore
      // instances in this service process cannot overwrite a stale snapshot.
      const current = await this.readCanonical();
      this.conversations = current;

      const existingIndex = parsedRequest.data.id === undefined
        ? -1
        : current.findIndex(item => item.id === parsedRequest.data.id);
      let saved: ChatConversation;
      let next: ChatConversation[];
      if (existingIndex >= 0) {
        const existing = current[existingIndex];
        if (existing === undefined) throw new Error('chat history index invariant failed');
        saved = ChatHistoryConversation.parse({
          ...existing,
          modelId: parsedRequest.data.modelId,
          title: parsedRequest.data.title,
          messages: parsedRequest.data.messages,
          updatedAt: updatedAt ?? Date.now()
        });
        next = current.map((item, index) => index === existingIndex ? saved : item);
      } else {
        saved = ChatHistoryConversation.parse({
          id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
          modelId: parsedRequest.data.modelId,
          title: parsedRequest.data.title,
          messages: parsedRequest.data.messages,
          updatedAt: updatedAt ?? Date.now()
        });
        next = [...current, saved].slice(-200);
      }

      await this.persist(next);
      this.conversations = next;
      return saved;
    });
  }

  async saveMany(conversations: ChatConversationInput[]): Promise<ChatConversation[]> {
    if (conversations.length === 0) return [];
    const parsedRequests = conversations.map(conversation => {
      const { updatedAt, ...request } = conversation;
      const parsedRequest = ChatHistorySaveRequest.safeParse(request);
      if (!parsedRequest.success) throw new Error('invalid conversation');
      return { request: parsedRequest.data, updatedAt };
    });

    return withFileMutationLock(this.filePath, async () => {
      let next = await this.readCanonical();
      const savedConversations: ChatConversation[] = [];

      for (const { request, updatedAt } of parsedRequests) {
        const existingIndex = request.id === undefined
          ? -1
          : next.findIndex(item => item.id === request.id);
        let saved: ChatConversation;
        if (existingIndex >= 0) {
          const existing = next[existingIndex];
          if (existing === undefined) throw new Error('chat history index invariant failed');
          saved = ChatHistoryConversation.parse({
            ...existing,
            modelId: request.modelId,
            title: request.title,
            messages: request.messages,
            updatedAt: updatedAt ?? Date.now()
          });
          next = next.map((item, index) => index === existingIndex ? saved : item);
        } else {
          saved = ChatHistoryConversation.parse({
            id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
            modelId: request.modelId,
            title: request.title,
            messages: request.messages,
            updatedAt: updatedAt ?? Date.now()
          });
          next = [...next, saved].slice(-200);
        }
        savedConversations.push(saved);
      }

      await this.persist(next);
      this.conversations = next;
      return savedConversations;
    });
  }

  private async readCanonical(): Promise<ChatConversation[]> {
    let raw: string;
    try {
      raw = await fs.readFile(this.filePath, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        await assertMissingStateLocationIsUsable(this.filePath, this.workspace, 'chat-history');
        return [];
      }
      throw new StatePersistenceError('chat-history', 'READ_FAILED', 'read', 'read-canonical', (error as NodeJS.ErrnoException).code);
    }

    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      throw new StatePersistenceError('chat-history', 'CORRUPT_STATE', 'read', 'parse-canonical');
    }
    const parsed = ChatHistoryResponse.safeParse(json);
    if (!parsed.success) {
      const record = typeof json === 'object' && json !== null && !Array.isArray(json)
        ? json as Record<string, unknown>
        : null;
      const reason = record !== null && Object.hasOwn(record, 'version')
        ? 'UNSUPPORTED_SCHEMA'
        : 'CORRUPT_STATE';
      throw new StatePersistenceError('chat-history', reason, 'read', 'validate-canonical');
    }
    return parsed.data.conversations;
  }

  private async persist(conversations: ChatConversation[]): Promise<void> {
    const value = { conversations };
    try {
      await this.atomicWriter(this.filePath, value, {
        validate: candidate => { ChatHistoryResponse.parse(candidate); }
      });
    } catch (error) {
      if (error instanceof AtomicJsonWriteError) {
        throw new StatePersistenceError('chat-history', 'WRITE_FAILED', 'write', error.phase, error.osCode);
      }
      throw error;
    }
  }
}
