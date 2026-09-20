import { Envelope } from '../../common/errors.ts';
import {
  EdgeCommandRequest,
  EdgeCommandResponse,
  EdgePairRequest,
  EdgePairResponse,
  EdgeStatusResponse,
  VoiceCapabilitiesResponse,
  VoiceCommandRequest,
  VoiceCommandResponse
} from '../../common/contracts/mobile.ts';
import type {
  EdgeCommandResponseT,
  EdgeStatusResponseT,
  VoiceCapabilitiesResponseT,
  VoiceCommandResponseT
} from '../../common/contracts/mobile.ts';

export class RemoteBridgeClientError extends Error {
  readonly code: string;
  readonly detail: unknown;

  constructor(code: string, message: string, detail?: unknown) {
    super(message);
    this.name = 'RemoteBridgeClientError';
    this.code = code;
    this.detail = detail;
  }
}

export interface RemoteBridgeClientOptions {
  baseUrl: string;
  fetchImpl?: typeof fetch;
}

function endpoint(baseUrl: string, path: string): string {
  const base = new URL(baseUrl);
  if (!['http:', 'https:'].includes(base.protocol)) throw new RemoteBridgeClientError('BAD_REQUEST', 'Remote Bridge URL must use HTTP(S) transport');
  return new URL(path, base).toString();
}

export class RemoteBridgeClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private token: string | null = null;

  constructor(options: RemoteBridgeClientOptions) {
    this.baseUrl = options.baseUrl;
    this.fetchImpl = options.fetchImpl ?? fetch;
    void endpoint(this.baseUrl, '/api/edge/status');
  }

  get paired(): boolean {
    return this.token !== null;
  }

  clearSession(): void {
    this.token = null;
  }

  async pair(proof: string): Promise<EdgePairResponse> {
    const body = EdgePairRequest.parse({ proof });
    const response = await this.request('/api/edge/pair', { method: 'POST', body, authenticated: false });
    const parsed = EdgePairResponse.safeParse(response);
    if (!parsed.success) throw new RemoteBridgeClientError('BAD_RESPONSE', 'pairing response violated the Edge contract', parsed.error.issues);
    this.token = parsed.data.token;
    return parsed.data;
  }

  async status(): Promise<EdgeStatusResponseT> {
    const response = await this.request('/api/edge/status');
    return EdgeStatusResponse.parse(response);
  }

  async command(input: { command: string; confirmation?: true }): Promise<EdgeCommandResponseT> {
    const body = EdgeCommandRequest.parse(input);
    const response = await this.request('/api/edge/command', { method: 'POST', body });
    return EdgeCommandResponse.parse(response);
  }

  async voiceCapabilities(): Promise<VoiceCapabilitiesResponseT> {
    const response = await this.request('/api/edge/voice/capabilities');
    return VoiceCapabilitiesResponse.parse(response);
  }

  async voice(input: { transcript: string; confirmation?: true }): Promise<VoiceCommandResponseT> {
    const body = VoiceCommandRequest.parse(input);
    const response = await this.request('/api/edge/voice/command', { method: 'POST', body });
    return VoiceCommandResponse.parse(response);
  }

  private async request(path: string, options: { method?: 'GET' | 'POST'; body?: unknown; authenticated?: boolean } = {}): Promise<unknown> {
    if (options.authenticated !== false && this.token === null) throw new RemoteBridgeClientError('FORBIDDEN', 'Edge session is not paired');
    const headers = new Headers({ 'content-type': 'application/json', 'X-AIDE-API-Format': 'envelope-v1' });
    if (this.token !== null && options.authenticated !== false) headers.set('authorization', `Bearer ${this.token}`);
    const response = await this.fetchImpl(endpoint(this.baseUrl, path), {
      method: options.method ?? 'GET',
      headers,
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
      signal: AbortSignal.timeout(15_000)
    });
    const raw: unknown = await response.json().catch(() => null);
    const envelope = Envelope.safeParse(raw);
    if (!envelope.success) throw new RemoteBridgeClientError('BAD_RESPONSE', 'Remote Bridge returned an invalid envelope');
    if (!envelope.data.ok) throw new RemoteBridgeClientError(envelope.data.error.code, envelope.data.error.message, envelope.data.error.detail);
    return envelope.data.data;
  }
}
