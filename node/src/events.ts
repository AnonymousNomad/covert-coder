import { WebSocket, WebSocketServer, type RawData } from 'ws';
import type { Server } from 'node:http';
import type { ZodType } from 'zod';
import { LogEvent, ModelStatusEvent, DiagnosticsEvent, TrainingProgressEvent, CommandEvent } from '../../common/contracts/events.ts';
import { TaskEvent } from '../../common/contracts/tasks.ts';
import { NotificationEvent } from '../../common/contracts/notifications.ts';
import { HubStreamEvent } from '../../common/contracts/modelhub.ts';
import { AgentStreamEvent } from '../../common/contracts/agent.ts';
import { IndexStreamEvent } from '../../common/contracts/index.ts';
import { DapEvent } from '../../common/contracts/dap.ts';
import { LspStatusEvent } from '../../common/contracts/lsp.ts';
import { TerminalEvent } from '../../common/contracts/terminal.ts';
import type { Logger } from './services/logger.ts';

export type ChannelName = 'log' | 'model' | 'diagnostics' | 'training' | 'debug' | 'lsp-status' | 'command' | 'tasks' | 'notifications' | 'modelhub' | 'agent' | 'index' | 'terminal';

const SCHEMAS: Record<ChannelName, ZodType> = {
  log: LogEvent,
  model: ModelStatusEvent,
  diagnostics: DiagnosticsEvent,
  training: TrainingProgressEvent,
  debug: DapEvent,
  'lsp-status': LspStatusEvent,
  command: CommandEvent,
  tasks: TaskEvent,
  notifications: NotificationEvent,
  modelhub: HubStreamEvent,
  agent: AgentStreamEvent,
  index: IndexStreamEvent,
  terminal: TerminalEvent
};

// Server-derived identity bound to an authenticated socket. Never supplied by
// the client; the daemon obtains it from the same credential that authorizes
// the socket, so control messages cannot import their own actor.
export interface WsActorIdentity {
  id: string;
  kind: string;
}

// The authenticate callback historically returned a bare assert function.
// It may now also return { assert, identity } so inbound control handlers can
// verify ownership against the authenticated actor. Bare-function callers keep
// working; sockets authenticated that way simply have no identity and can
// never control a terminal session (fail closed).
export type WsAuthentication = { assert: () => void; identity?: WsActorIdentity } | (() => void);
export type WsAuthenticate = (token: string, origin: string) => WsAuthentication;
export type WsControlHandler = (message: unknown, context: { identity?: WsActorIdentity }) => void;

export const CHANNELS = Object.keys(SCHEMAS) as ChannelName[];

// Acceptance is schema validation, NOT subscriber delivery or persistence.
export type PublishResult = { accepted: true } | { accepted: false; error: string };

interface WsClient {
  socket: WebSocket;
  channels: Set<ChannelName>;
  identity?: WsActorIdentity;
  assertAuthorized?: () => void;
  authenticate?: (token: string) => WsAuthentication;
  authDeadline: ReturnType<typeof setTimeout>;
}

export interface WsSubscribeMessage {
  type?: string;
  channels?: unknown;
  token?: unknown;
}

export class EventHub {
  private wss: WebSocketServer | null = null;
  private readonly clients = new Set<WsClient>();
  private readonly logger: Logger;
  private control: WsControlHandler | undefined;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  attach(server: Server, authenticate?: WsAuthenticate, onControl?: WsControlHandler): void {
    this.control = onControl;
    this.wss = new WebSocketServer({ server, path: '/ws', maxPayload: 8192 });
    this.wss.on('connection', (socket, request) => {
      // No URL credentials, no subscription or event before real actor proof.
      // Missing authority fails closed, including standalone EventHub callers.
      const origin = typeof request.headers.origin === 'string' ? request.headers.origin : '';
      const authDeadline = setTimeout(() => socket.terminate(), 5000);
      authDeadline.unref();
      const client: WsClient = { socket, channels: new Set(), authDeadline,
        ...(authenticate ? { authenticate: (token: string) => authenticate(token, origin) } : {}) };
      this.clients.add(client);
      socket.on('message', (raw: RawData) => this.onMessage(client, raw));
      socket.on('close', () => {
        clearTimeout(client.authDeadline);
        this.clients.delete(client);
      });
      socket.on('error', () => {
        clearTimeout(client.authDeadline);
        this.clients.delete(client);
      });
    });
  }

  publish(channel: ChannelName, data: unknown, audience?: (identity?: WsActorIdentity) => boolean): PublishResult {
    const schema = SCHEMAS[channel];
    const parsed = schema.safeParse(data);
    if (!parsed.success) {
      this.logger.error('event payload violates the contract; event not sent', { channel, issues: parsed.error.issues });
      return { accepted: false, error: 'event payload violates the contract' };
    }
    const payload = JSON.stringify({ channel, ts: Date.now(), data: parsed.data });
    for (const client of this.clients) {
      if (!client.assertAuthorized) continue;
      try { client.assertAuthorized(); }
      catch { client.channels.clear(); client.socket.close(1008, 'actor expired or revoked'); continue; }
      // Ownership-scoped events (e.g. terminal output) must never reach a
      // socket whose server-derived identity is not the session owner. Sockets
      // without an identity (legacy bare-function auth) are excluded too.
      if (audience && !audience(client.identity)) continue;
      if (client.channels.has(channel) && client.socket.readyState === WebSocket.OPEN) {
        try {
          client.socket.send(payload, error => {
            if (error) this.logger.error('event subscriber send failed', { channel, error: error.message });
          });
        } catch (error) {
          this.logger.error('event subscriber send failed', { channel, error: String(error) });
        }
      }
    }
    return { accepted: true };
  }

  clientCount(): number {
    return this.clients.size;
  }

  close(): void {
    for (const client of this.clients) {
      clearTimeout(client.authDeadline);
      client.socket.terminate();
    }
    this.clients.clear();
    this.wss?.close();
    this.wss = null;
  }

  private onMessage(client: WsClient, raw: RawData): void {
    const text = Array.isArray(raw) ? Buffer.concat(raw).toString('utf8') : raw.toString('utf8');
    let message: WsSubscribeMessage;
    try {
      message = JSON.parse(text) as WsSubscribeMessage;
    } catch {
      client.socket.close(1008, 'invalid event protocol');
      return;
    }
    if (!message || typeof message !== 'object') { client.socket.close(1008, 'invalid event protocol'); return; }
    if (!client.assertAuthorized) {
      if (message.type !== 'authenticate' || typeof message.token !== 'string' || !client.authenticate) {
        client.socket.close(1008, 'authenticated actor required'); return;
      }
      try {
        const auth = client.authenticate(message.token);
        if (typeof auth === 'function') {
          client.assertAuthorized = auth;
        } else {
          client.assertAuthorized = auth.assert;
          if (auth.identity) client.identity = auth.identity;
        }
        client.assertAuthorized();
        delete client.authenticate;
        clearTimeout(client.authDeadline);
        client.socket.send(JSON.stringify({ type: 'authenticated' }));
      } catch { client.socket.close(1008, 'invalid actor credential'); }
      return;
    }
    try { client.assertAuthorized(); }
    catch { client.socket.close(1008, 'actor expired or revoked'); return; }
    if (message.type === 'subscribe' && Array.isArray(message.channels)) {
      const channels = message.channels.filter((name: unknown): name is ChannelName => typeof name === 'string' && name in SCHEMAS);
      client.channels = new Set(channels);
      return;
    }
    if (message.type === 'terminal' && this.control) {
      // Ownership is verified by the control handler against the identity the
      // daemon derived from the authenticated socket. Malformed or unauthorized
      // control messages never close the event socket; the handler fails closed.
      this.control(message, client.identity ? { identity: client.identity } : {});
    }
  }
}
