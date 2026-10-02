import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { CredentialStore } from './credentials.ts';
import { scrubKey } from './credentials.ts';
import type { ProviderConnectRequestT, ProviderInfoT } from '../../../common/contracts/providers.ts';
import { observeAdapterRequestInput, type AdapterRequestInputOptions } from './model-request-input.ts';

export interface ProviderDefinition {
  id: string;
  name: string;
  kind: 'openai-compatible' | 'anthropic';
  baseUrl: string;
  models: string[];
  contextLength: number;
  egressHost: string;
}

export const BUILTIN_PROVIDERS: ProviderDefinition[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    kind: 'openai-compatible',
    baseUrl: 'https://api.openai.com/v1',
    models: ['gpt-4o-mini', 'gpt-4o'],
    contextLength: 128000,
    egressHost: 'api.openai.com'
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    kind: 'anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    models: ['claude-3-5-haiku-latest', 'claude-3-5-sonnet-latest'],
    contextLength: 200000,
    egressHost: 'api.anthropic.com'
  },
  {
    id: 'google',
    name: 'Google Gemini',
    kind: 'openai-compatible',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    models: ['gemini-2.0-flash'],
    contextLength: 1048576,
    egressHost: 'generativelanguage.googleapis.com'
  },
  {
    id: 'mistral',
    name: 'Mistral',
    kind: 'openai-compatible',
    baseUrl: 'https://api.mistral.ai/v1',
    models: ['mistral-small-latest'],
    contextLength: 32768,
    egressHost: 'api.mistral.ai'
  },
  {
    id: 'groq',
    name: 'Groq',
    kind: 'openai-compatible',
    baseUrl: 'https://api.groq.com/openai/v1',
    models: ['llama-3.3-70b-versatile'],
    contextLength: 128000,
    egressHost: 'api.groq.com'
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    kind: 'openai-compatible',
    baseUrl: 'https://openrouter.ai/api/v1',
    models: ['openrouter/auto'],
    contextLength: 128000,
    egressHost: 'openrouter.ai'
  }
];

export type ProbeResult = 'connected' | 'invalid_key' | 'unreachable';

export interface ProviderServiceOptions {
  credentials: CredentialStore;
  fetchFn?: typeof fetch;
  assertExternalEgressAllowed?: () => void;
  allowlistFile?: string;
  logger?: { info(message: string): void } | undefined;
  requestTimeoutMs?: number;
}

export class ProviderError extends Error {
  readonly code: 'FORBIDDEN' | 'NOT_READY' | 'CHILD_FAILED';

  constructor(code: 'FORBIDDEN' | 'NOT_READY' | 'CHILD_FAILED', message: string) {
    super(message);
    this.code = code;
  }
}

interface AllowlistFile {
  version: number;
  hosts: string[];
}

interface ProbeCacheEntry {
  status: Exclude<ProbeResult, 'connected'> | 'connected';
  at: number;
  model: string;
  endpointIdentity: string | null;
}

const PROBE_TIMEOUT_MS = 5_000;
const PROBE_CACHE_TTL_MS = 60_000;
const PROVIDER_REQUEST_TIMEOUT_MS = 60_000;
const MAX_SSE_DATA_CHARS = 1_048_576;

function hostOf(baseUrl: string): string {
  try {
    return new URL(baseUrl).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function endpointIdentity(baseUrl: string): string | null {
  try {
    const endpoint = new URL(baseUrl);
    if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || endpoint.search || endpoint.hash) return null;
    endpoint.pathname = endpoint.pathname.replace(/\/+$/, '') || '/';
    return endpoint.href;
  } catch {
    return null;
  }
}

function abortReason(signal: AbortSignal): Error {
  return signal.reason instanceof Error ? signal.reason : new DOMException('The operation was aborted', 'AbortError');
}

async function consumeSse(
  body: ReadableStream<Uint8Array> | null,
  signal: AbortSignal,
  onEvent: (eventName: string, data: string) => void
): Promise<void> {
  if (body === null) throw new Error('provider response did not include a stream body');
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let eventName = '';
  let dataLines: string[] = [];
  let dataChars = 0;
  let completed = false;

  const cancelReader = (): void => {
    void reader.cancel(signal.reason).catch(() => {});
  };
  signal.addEventListener('abort', cancelReader, { once: true });

  const dispatch = (): void => {
    if (dataLines.length > 0) onEvent(eventName || 'message', dataLines.join('\n'));
    eventName = '';
    dataLines = [];
    dataChars = 0;
  };
  const processLine = (rawLine: string): void => {
    const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;
    if (line.length === 0) {
      dispatch();
      return;
    }
    if (line.startsWith(':')) return;
    const separator = line.indexOf(':');
    const field = separator < 0 ? line : line.slice(0, separator);
    const value = separator < 0 ? '' : line.slice(separator + 1).replace(/^ /, '');
    if (field === 'event') eventName = value;
    else if (field === 'data') {
      dataLines.push(value);
      dataChars += value.length;
      if (dataChars > MAX_SSE_DATA_CHARS) {
        throw new Error('provider stream event exceeded the size limit');
      }
    }
  };

  try {
    for (;;) {
      if (signal.aborted) throw abortReason(signal);
      const result = await reader.read();
      if (signal.aborted) throw abortReason(signal);
      if (result.done) break;
      buffer += decoder.decode(result.value, { stream: true });
      let newline = buffer.indexOf('\n');
      while (newline >= 0) {
        processLine(buffer.slice(0, newline));
        buffer = buffer.slice(newline + 1);
        newline = buffer.indexOf('\n');
      }
      if (buffer.length > MAX_SSE_DATA_CHARS) throw new Error('provider stream line exceeded the size limit');
    }
    buffer += decoder.decode();
    if (buffer.length > 0) processLine(buffer);
    dispatch();
    completed = true;
  } finally {
    signal.removeEventListener('abort', cancelReader);
    if (!completed) await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export class ProviderService {
  private readonly credentials: CredentialStore;
  private readonly fetchFn: typeof fetch;
  private readonly allowlistPath: string;
  private readonly logger: { info(message: string): void } | undefined;
  private readonly externalEgressGuard: (() => void) | undefined;
  private readonly requestTimeoutMs: number;
  private allowlist: Set<string> | null = null;
  private readonly probeCache = new Map<string, ProbeCacheEntry>();

  constructor(workspace: string, options: ProviderServiceOptions) {
    this.credentials = options.credentials;
    this.fetchFn = options.fetchFn ?? globalThis.fetch.bind(globalThis);
    this.externalEgressGuard = options.assertExternalEgressAllowed;
    this.allowlistPath = options.allowlistFile ?? path.join(workspace, '.aide', 'provider-hosts.json');
    this.logger = options.logger;
    const configuredTimeout = options.requestTimeoutMs;
    this.requestTimeoutMs = configuredTimeout !== undefined && Number.isFinite(configuredTimeout)
      ? Math.min(PROVIDER_REQUEST_TIMEOUT_MS, Math.max(1, Math.floor(configuredTimeout)))
      : PROVIDER_REQUEST_TIMEOUT_MS;
  }

  async list(): Promise<ProviderInfoT[]> {
    const configuredIds = new Set(await this.credentials.ids());
    return BUILTIN_PROVIDERS.map(provider => {
      const configured = configuredIds.has(provider.id);
      let status: ProviderInfoT['status'] = 'not_connected';
      if (configured) {
        const cached = this.probeCache.get(provider.id);
        status = cached !== undefined && Date.now() - cached.at < PROBE_CACHE_TTL_MS ? cached.status : 'checking';
      }
      return {
        id: provider.id,
        name: provider.name,
        kind: provider.kind,
        baseUrl: provider.baseUrl,
        models: provider.models,
        status,
        configured
      };
    });
  }

  modelSupportState(providerId: string, modelId: string): 'verified' | 'unknown' {
    const provider = BUILTIN_PROVIDERS.find(entry => entry.id === providerId);
    const cached = this.probeCache.get(providerId);
    if (provider === undefined || cached === undefined || Date.now() - cached.at >= PROBE_CACHE_TTL_MS ||
        cached.status !== 'connected' || cached.model !== modelId || cached.endpointIdentity !== endpointIdentity(provider.baseUrl)) {
      return 'unknown';
    }
    return 'verified';
  }

  async connect(request: ProviderConnectRequestT): Promise<{ status: ProbeResult; message: string }> {
    this.assertExternalEgressAllowed();
    const provider = BUILTIN_PROVIDERS.find(entry => entry.id === request.providerId);
    if (provider === undefined) throw new ProviderError('NOT_READY', `unknown provider ${request.providerId}`);
    const baseUrl = request.baseUrl ?? provider.baseUrl;
    const host = hostOf(baseUrl);
    if (host.length === 0) throw new ProviderError('FORBIDDEN', 'invalid provider base URL');
    const builtin = host === provider.egressHost;
    if (!builtin && !(await this.isHostApproved(host))) {
      if (request.approveHost !== true) {
        throw new ProviderError('FORBIDDEN', `host ${host} is not approved; approve it explicitly to connect`);
      }
      await this.approveHost(host);
    }
    if (!(await this.credentials.available())) {
      throw new ProviderError('NOT_READY', 'credential store unavailable on this platform');
    }
    this.assertExternalEgressAllowed();
    await this.credentials.set(request.providerId, request.key);
    const model = request.model ?? provider.models[0]!;
    const probe = await this.probe(provider, request.key, baseUrl, model, host);
    this.probeCache.set(request.providerId, { status: probe, at: Date.now(), model, endpointIdentity: endpointIdentity(baseUrl) });
    this.logger?.info(`PROVIDER: ${provider.id} probe -> ${probe} (host=${host}, model=${model})`);
    const message =
      probe === 'connected'
        ? `connected (${model})`
        : probe === 'invalid_key'
          ? 'the key was rejected by the provider'
          : 'the selected provider/model route could not be verified';
    return { status: probe, message };
  }

  async disconnect(providerId: string): Promise<void> {
    this.probeCache.delete(providerId);
    await this.credentials.delete(providerId);
  }

  async chat(
    providerId: string,
    model: string,
    messages: Array<{ role: string; content: string }>,
    options: AdapterRequestInputOptions & { maxTokens?: number; temperature?: number; signal?: AbortSignal } = {}
  ): Promise<{ text: string; modelId: string; tokens?: number; timingMs: number }> {
    this.assertExternalEgressAllowed();
    const provider = BUILTIN_PROVIDERS.find(entry => entry.id === providerId);
    if (provider === undefined) throw new ProviderError('NOT_READY', `unknown provider ${providerId}`);
    const key = await this.credentials.get(providerId);
    if (key === undefined) throw new ProviderError('NOT_READY', `provider ${providerId} is not connected`);
    const baseUrl = provider.baseUrl.replace(/\/$/, '');
    const started = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60_000);
    const signal = options.signal !== undefined ? AbortSignal.any([options.signal, controller.signal]) : controller.signal;
    try {
      let response: Response;
      this.assertExternalEgressAllowed();
      if (provider.kind === 'anthropic') {
        const systemParts = messages.filter(message => message.role === 'system' || message.role === 'developer').map(message => message.content);
        const conversation: Array<{ role: string; content: string }> = [];
        for (const message of messages) {
          if (message.role === 'system' || message.role === 'developer') continue;
          const previous = conversation[conversation.length - 1];
          if (previous !== undefined && previous.role === message.role) previous.content += `\n${message.content}`;
          else conversation.push({ role: message.role, content: message.content });
        }
        const body: Record<string, unknown> = {
          model,
          max_tokens: Math.min(options.maxTokens ?? 512, 8192),
          messages: conversation
        };
        if (systemParts.length > 0) body.system = systemParts.join('\n');
        const serialized = JSON.stringify(body);
        await observeAdapterRequestInput(serialized, { adapter: 'provider-service', protocol: 'anthropic-messages',
          requested_model: model, request_index: 1, stream: false }, options, signal);
        this.assertExternalEgressAllowed();
        response = await this.fetchFn(`${baseUrl}/messages`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-api-key': key,
            'anthropic-version': '2023-06-01'
          },
          body: serialized,
          signal
        });
      } else {
        const serialized = JSON.stringify({ model, messages, temperature: options.temperature ?? 0.2,
          max_tokens: Math.min(options.maxTokens ?? 512, 8192) });
        await observeAdapterRequestInput(serialized, { adapter: 'provider-service', protocol: 'openai-chat-completions',
          requested_model: model, request_index: 1, stream: false }, options, signal);
        this.assertExternalEgressAllowed();
        response = await this.fetchFn(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${key}`
          },
          body: serialized,
          signal
        });
      }
      if (response.status === 429 || response.status === 503) throw new ProviderError('CHILD_FAILED', `provider ${providerId} is busy (HTTP ${response.status})`);
      if (response.status === 401 || response.status === 403) throw new ProviderError('NOT_READY', `provider ${providerId} rejected the stored key (HTTP ${response.status})`);
      if (!response.ok) throw new ProviderError('CHILD_FAILED', `provider ${providerId} returned HTTP ${response.status}`);
      const payload = (await response.json().catch(() => {
        throw new ProviderError('CHILD_FAILED', `provider ${providerId} returned non-JSON`);
      })) as {
        choices?: Array<{ message?: { content?: string } }>;
        usage?: { completion_tokens?: number };
        content?: Array<{ type?: string; text?: string }>;
      };
      const text =
        provider.kind === 'anthropic'
          ? (payload.content ?? []).map(block => block.text ?? '').join('')
          : payload.choices?.[0]?.message?.content ?? '';
      if (text.length === 0) throw new ProviderError('CHILD_FAILED', `provider ${providerId} returned an empty response`);
      const result: { text: string; modelId: string; tokens?: number; timingMs: number } = {
        text,
        modelId: `${providerId}:${model}`,
        timingMs: Date.now() - started
      };
      const tokens = payload.usage?.completion_tokens;
      if (tokens !== undefined) result.tokens = tokens;
      return result;
    } catch (error) {
      if ((error as { code?: string })?.code === 'FORBIDDEN' || (error as { code?: string })?.code === 'NOT_READY') throw error;
      if (error instanceof ProviderError) throw error;
      if (error instanceof Error && error.name === 'AbortError' && options.signal?.aborted) throw error;
      if (error instanceof Error && error.name === 'AbortError') throw new ProviderError('CHILD_FAILED', `provider ${providerId} timed out after 60s`);
      const message = error instanceof Error ? error.message : String(error);
      throw new ProviderError('CHILD_FAILED', scrubKey(message, key));
    } finally {
      clearTimeout(timer);
    }
  }

  async chatStream(
    providerId: string,
    model: string,
    messages: Array<{ role: string; content: string }>,
    onDelta: (delta: string) => void,
    options: AdapterRequestInputOptions & { maxTokens?: number; temperature?: number; signal?: AbortSignal } = {}
  ): Promise<{ text: string; modelId: string; tokens?: number; timingMs: number }> {
    this.assertExternalEgressAllowed();
    const provider = BUILTIN_PROVIDERS.find(entry => entry.id === providerId);
    if (provider === undefined) throw new ProviderError('NOT_READY', `unknown provider ${providerId}`);
    const key = await this.credentials.get(providerId);
    if (key === undefined) throw new ProviderError('NOT_READY', `provider ${providerId} is not connected`);
    const started = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new DOMException('provider request timed out', 'TimeoutError')), this.requestTimeoutMs);
    const signal = options.signal !== undefined ? AbortSignal.any([options.signal, controller.signal]) : controller.signal;
    let readerBody: ReadableStream<Uint8Array> | null = null;
    try {
      if (signal.aborted) throw abortReason(signal);
      this.assertExternalEgressAllowed();
      const baseUrl = provider.baseUrl.replace(/\/$/, '');
      let response: Response;
      if (provider.kind === 'anthropic') {
        const systemParts = messages.filter(message => message.role === 'system' || message.role === 'developer').map(message => message.content);
        const conversation: Array<{ role: string; content: string }> = [];
        for (const message of messages) {
          if (message.role === 'system' || message.role === 'developer') continue;
          const previous = conversation[conversation.length - 1];
          if (previous !== undefined && previous.role === message.role) previous.content += `\n${message.content}`;
          else conversation.push({ role: message.role, content: message.content });
        }
        const body: Record<string, unknown> = {
          model,
          max_tokens: Math.min(options.maxTokens ?? 512, 8192),
          messages: conversation,
          stream: true
        };
        if (systemParts.length > 0) body.system = systemParts.join('\n');
        const serialized = JSON.stringify(body);
        await observeAdapterRequestInput(serialized, { adapter: 'provider-service', protocol: 'anthropic-messages',
          requested_model: model, request_index: 1, stream: true }, options, signal);
        this.assertExternalEgressAllowed();
        response = await this.fetchFn(`${baseUrl}/messages`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-api-key': key,
            'anthropic-version': '2023-06-01'
          },
          body: serialized,
          signal
        });
      } else {
        const serialized = JSON.stringify({ model, messages, temperature: options.temperature ?? 0.2,
          max_tokens: Math.min(options.maxTokens ?? 512, 8192), stream: true });
        await observeAdapterRequestInput(serialized, { adapter: 'provider-service', protocol: 'openai-chat-completions',
          requested_model: model, request_index: 1, stream: true }, options, signal);
        this.assertExternalEgressAllowed();
        response = await this.fetchFn(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${key}`
          },
          body: serialized,
          signal
        });
      }
      readerBody = response.body;
      if (response.status === 429 || response.status === 503) throw new ProviderError('CHILD_FAILED', `provider ${providerId} is busy (HTTP ${response.status})`);
      if (response.status === 401 || response.status === 403) throw new ProviderError('NOT_READY', `provider ${providerId} rejected the stored key (HTTP ${response.status})`);
      if (!response.ok) throw new ProviderError('CHILD_FAILED', `provider ${providerId} returned HTTP ${response.status}`);

      let text = '';
      let tokens: number | undefined;
      let protocolComplete = false;
      await consumeSse(readerBody, signal, (eventName, data) => {
        if (data === '[DONE]') {
          protocolComplete = true;
          return;
        }
        let payload: {
          type?: string;
          error?: unknown;
          choices?: Array<{ delta?: { content?: unknown }; finish_reason?: string | null }>;
          usage?: { completion_tokens?: number; output_tokens?: number };
          delta?: { type?: string; text?: unknown };
        };
        try {
          payload = JSON.parse(data) as typeof payload;
        } catch {
          throw new ProviderError('CHILD_FAILED', `provider ${providerId} returned malformed stream data`);
        }
        if (eventName === 'error' || payload.error !== undefined || payload.type === 'error') {
          throw new ProviderError('CHILD_FAILED', `provider ${providerId} reported a stream error`);
        }
        if (provider.kind === 'anthropic') {
          if (eventName === 'message_stop' || payload.type === 'message_stop') protocolComplete = true;
          const delta = payload.type === 'content_block_delta' ? payload.delta?.text : undefined;
          if (typeof delta === 'string' && delta.length > 0) {
            text += delta;
            onDelta(delta);
          }
          const outputTokens = payload.usage?.output_tokens;
          if (typeof outputTokens === 'number') tokens = outputTokens;
        } else {
          const delta = payload.choices?.[0]?.delta?.content;
          if (typeof delta === 'string' && delta.length > 0) {
            text += delta;
            onDelta(delta);
          }
          const completionTokens = payload.usage?.completion_tokens;
          if (typeof completionTokens === 'number') tokens = completionTokens;
        }
      });
      if (!protocolComplete) throw new ProviderError('CHILD_FAILED', `provider ${providerId} ended the stream before completion`);
      if (text.length === 0) throw new ProviderError('CHILD_FAILED', `provider ${providerId} returned an empty response`);
      const result: { text: string; modelId: string; tokens?: number; timingMs: number } = {
        text,
        modelId: `${providerId}:${model}`,
        timingMs: Date.now() - started
      };
      if (tokens !== undefined) result.tokens = tokens;
      return result;
    } catch (error) {
      if ((error as { code?: string })?.code === 'FORBIDDEN' || (error as { code?: string })?.code === 'NOT_READY') throw error;
      if (error instanceof ProviderError) throw error;
      if (options.signal?.aborted) throw abortReason(options.signal);
      if (controller.signal.aborted) throw new ProviderError('CHILD_FAILED', `provider ${providerId} timed out after ${this.requestTimeoutMs}ms`);
      const message = error instanceof Error ? error.message : String(error);
      throw new ProviderError('CHILD_FAILED', scrubKey(message, key));
    } finally {
      clearTimeout(timer);
      if (readerBody !== null) await readerBody.cancel().catch(() => {});
    }
  }

  private async probe(
    provider: ProviderDefinition,
    key: string,
    baseUrl: string,
    model: string,
    host: string
  ): Promise<ProbeResult> {
    if (!(await this.isHostApproved(host)) && host !== provider.egressHost) return 'unreachable';
    this.assertExternalEgressAllowed();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
    try {
      let response: Response;
      this.assertExternalEgressAllowed();
      if (provider.kind === 'anthropic') {
        response = await this.fetchFn(`${baseUrl.replace(/\/$/, '')}/messages`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-api-key': key,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({ model, max_tokens: 1, messages: [{ role: 'user', content: 'ping' }] }),
          signal: controller.signal
        });
      } else {
        response = await this.fetchFn(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${key}`
          },
          body: JSON.stringify({ model, messages: [{ role: 'user', content: 'ping' }], max_tokens: 1 }),
          signal: controller.signal
        });
      }
      if (response.status >= 200 && response.status < 300) {
        const payload = await response.json().catch(() => null) as {
          choices?: Array<{ message?: { content?: unknown } }>;
          content?: Array<{ type?: string; text?: unknown }>;
        } | null;
        const output = provider.kind === 'anthropic'
          ? payload?.content?.map(block => block.type === 'text' && typeof block.text === 'string' ? block.text : '').join('')
          : payload?.choices?.[0]?.message?.content;
        return typeof output === 'string' && output.length > 0 ? 'connected' : 'unreachable';
      }
      if (response.status === 401 || response.status === 403) return 'invalid_key';
      return 'unreachable';
    } catch (error) {
      if ((error as { code?: string })?.code === 'FORBIDDEN' || (error as { code?: string })?.code === 'NOT_READY') throw error;
      if (error instanceof Error && error.name === 'AbortError') return 'unreachable';
      const message = error instanceof Error ? error.message : String(error);
      this.logger?.info(`PROVIDER: ${provider.id} probe error: ${scrubKey(message, key)}`);
      return 'unreachable';
    } finally {
      clearTimeout(timer);
    }
  }

  private async isHostApproved(host: string): Promise<boolean> {
    if (this.allowlist === null) await this.loadAllowlist();
    return this.allowlist!.has(host);
  }

  private assertExternalEgressAllowed(): void {
    if (!this.externalEgressGuard) throw new ProviderError('NOT_READY', 'external-egress Authority guard unavailable');
    this.externalEgressGuard();
  }

  private async approveHost(host: string): Promise<void> {
    if (this.allowlist === null) await this.loadAllowlist();
    this.allowlist!.add(host);
    await fs.mkdir(path.dirname(this.allowlistPath), { recursive: true }).catch(() => {});
    const file: AllowlistFile = { version: 1, hosts: [...this.allowlist!] };
    await fs.writeFile(this.allowlistPath, JSON.stringify(file, null, 2), 'utf8');
    this.logger?.info(`PROVIDER: host approved for egress: ${host}`);
  }

  private async loadAllowlist(): Promise<void> {
    this.allowlist = new Set();
    try {
      const file = JSON.parse(await fs.readFile(this.allowlistPath, 'utf8')) as AllowlistFile;
      for (const host of file.hosts ?? []) this.allowlist.add(host);
    } catch {
      this.allowlist = new Set();
    }
  }
}
