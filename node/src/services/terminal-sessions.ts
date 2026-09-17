import { randomUUID } from 'node:crypto';
import { homedir } from 'node:os';
import { TerminalControlMessage, type TerminalEventT, type TerminalSessionCleanupT, type TerminalSessionInfoT, type TerminalSessionStateT } from '../../../common/contracts/terminal.ts';
import { createRuntimeProviderRegistry, createDefaultProviderDeps, translateCwd, type RuntimeProviderDeps, type RuntimeProviderRegistry, type PtyProcess, type SpawnPtyFn } from './runtime-providers.ts';
import type { WsActorIdentity } from '../events.ts';

// ---------------------------------------------------------------------------
// Interactive terminal sessions.
//
// Authority model: a session is created by an approved `terminal.session.start`
// operation (the route calls open() ONLY from inside authority.execute). The
// session is bound to the operator actor derived on the server; session ids are
// opaque handles, never authority. Every WebSocket control message is verified
// against the server-derived identity of the authenticated socket. Output is
// delivered only to the owner (audience-filtered publish).
// ---------------------------------------------------------------------------

export interface TerminalSessionLogger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

const NOOP_LOGGER: TerminalSessionLogger = { info() {}, warn() {}, error() {} };

// --- Environment scrubbing -------------------------------------------------
// PTY children inherit the daemon's environment, which holds operator secrets.
// The service builds an explicit needle-in-a-haystack allow/deny pass: known
// sensitive names are dropped, a small safe core is always kept. Values are
// never logged — only the count of dropped variables.

const SENSITIVE_NAME = /(token|secret|passw|passwd|passphrase|credential|api[-_]?key|private[-_]?key|access[-_]?key|session[-_]?key|master[-_]?key|connection[-_]?string|bearer|dpapi|_auth$|^auth$|auth[-_]|[-_]auth)/i;
const ALWAYS_DROP = new Set(['AIDE_DPAPI_IN']);
const SAFE_KEEP = new Set([
  'PATH', 'PATHEXT', 'SystemRoot', 'windir', 'SystemDrive', 'TEMP', 'TMP', 'TMPDIR',
  'USERPROFILE', 'HOME', 'HOMEDRIVE', 'HOMEPATH', 'USERNAME', 'USERDOMAIN', 'COMPUTERNAME',
  'COMSPEC', 'OS', 'PROCESSOR_ARCHITECTURE', 'PROCESSOR_IDENTIFIER', 'PROCESSOR_LEVEL',
  'PROCESSOR_REVISION', 'NUMBER_OF_PROCESSORS', 'LOGONSERVER', 'LANG', 'LC_ALL', 'PSModulePath',
  'TERM', 'COLORTERM', 'PROGRAMFILES', 'PROGRAMFILES(X86)', 'PROGRAMDATA', 'APPDATA',
  'LOCALAPPDATA', 'CommonProgramFiles', 'CommonProgramFiles(x86)'
]);

export function buildTerminalEnv(env: NodeJS.ProcessEnv): { env: Record<string, string>; dropped: number } {
  const out: Record<string, string> = {};
  let dropped = 0;
  for (const [name, value] of Object.entries(env)) {
    if (value === undefined) continue;
    if (ALWAYS_DROP.has(name)) { dropped += 1; continue; }
    if (SAFE_KEEP.has(name)) { out[name] = value; continue; }
    if (SENSITIVE_NAME.test(name)) { dropped += 1; continue; }
    out[name] = value;
  }
  if (!out.TERM) out.TERM = 'xterm-256color';
  if (!out.COLORTERM) out.COLORTERM = 'truecolor';
  return { env: out, dropped };
}

// --- Backpressure constants ------------------------------------------------
const CHUNK_CHARS = 4096;          // below the 8 KiB WebSocket frame cap
const MAX_BYTES_PER_TICK = 16_384; // ~320 KiB/s ceiling per session
const DRAIN_INTERVAL_MS = 50;
const DEFAULT_BUFFER_BYTES = 1_048_576;
const STOP_GRACE_MS = 3_000;

interface Session {
  id: string;
  owner: string;
  provider: string;
  shellId: string;
  shellPath: string;
  cwd: string;
  cols: number;
  rows: number;
  state: TerminalSessionStateT;
  createdAt: number;
  exitCode: number | null;
  cleanup: TerminalSessionCleanupT;
  pty: PtyProcess | null;
  queue: string[];
  queuedBytes: number;
  truncated: boolean;
  drainTimer: ReturnType<typeof setInterval> | null;
  stopTimer: ReturnType<typeof setTimeout> | null;
}

export interface OpenSessionInput {
  owner: string;
  provider: string;
  shell: string | null;
  cwd: string | null;
  cols: number;
  rows: number;
}

export interface TerminalSessionsOptions {
  deps?: Partial<RuntimeProviderDeps>;
  logger?: TerminalSessionLogger;
  onEvent: (event: TerminalEventT, owner: string) => void;
  maxBufferBytes?: number;
  drainIntervalMs?: number;
  spawnOverride?: SpawnPtyFn;
  // Bounded default working directory for a session that does not request one.
  // The daemon passes the workspace root so an interactive shell starts inside
  // the workbench rather than the operator home.
  defaultCwd?: string;
}

export class TerminalSessionService {
  private readonly registry: RuntimeProviderRegistry;
  private readonly logger: TerminalSessionLogger;
  private readonly onEvent: (event: TerminalEventT, owner: string) => void;
  private readonly maxBufferBytes: number;
  private readonly drainIntervalMs: number;
  private readonly spawnOverride?: SpawnPtyFn;
  private readonly deps: RuntimeProviderDeps;
  private readonly defaultCwd: string;
  private readonly sessions = new Map<string, Session>();

  constructor(options: TerminalSessionsOptions) {
    this.deps = createDefaultProviderDeps(options.deps ?? {});
    this.registry = createRuntimeProviderRegistry(this.deps);
    this.logger = options.logger ?? NOOP_LOGGER;
    this.onEvent = options.onEvent;
    this.maxBufferBytes = options.maxBufferBytes ?? DEFAULT_BUFFER_BYTES;
    this.drainIntervalMs = options.drainIntervalMs ?? DRAIN_INTERVAL_MS;
    this.defaultCwd = options.defaultCwd ?? homedir();
    if (options.spawnOverride) this.spawnOverride = options.spawnOverride;
  }

  providers() {
    return this.registry.list();
  }

  list(): TerminalSessionInfoT[] {
    return [...this.sessions.values()].map(s => this.info(s));
  }

  private info(s: Session): TerminalSessionInfoT {
    return {
      sessionId: s.id,
      owner: s.owner,
      provider: s.provider,
      shell: s.shellId,
      cwd: s.cwd,
      cols: s.cols,
      rows: s.rows,
      state: s.state,
      createdAt: s.createdAt,
      exitCode: s.exitCode,
      cleanup: s.cleanup
    };
  }

  async open(input: OpenSessionInput): Promise<{ session: TerminalSessionInfoT } | { error: string }> {
    const resolved = await this.registry.resolve(input.provider, input.shell);
    if ('error' in resolved) return resolved;
    const baseCwd = input.cwd && input.cwd.trim() ? input.cwd : this.defaultCwd;
    const cwd = translateCwd(input.provider, baseCwd);
    const { env, dropped } = buildTerminalEnv(this.deps.env);
    if (dropped > 0) this.logger.info('terminal env scrubbed', { dropped });
    const session: Session = {
      id: randomUUID(),
      owner: input.owner,
      provider: input.provider,
      shellId: resolved.shell.id,
      shellPath: resolved.shell.path,
      cwd,
      cols: input.cols,
      rows: input.rows,
      state: 'starting',
      createdAt: Date.now(),
      exitCode: null,
      cleanup: 'pending',
      pty: null,
      queue: [],
      queuedBytes: 0,
      truncated: false,
      drainTimer: null,
      stopTimer: null
    };
    try {
      const spawn = this.spawnOverride ?? ((options: Parameters<SpawnPtyFn>[0]) => resolved.provider.spawnPty(options));
      const pty = spawn({ file: resolved.shell.path, args: [], cwd, env, cols: input.cols, rows: input.rows });
      session.pty = pty;
    } catch (error) {
      this.logger.error('terminal session failed to start', { provider: input.provider, error: error instanceof Error ? error.message : String(error) });
      return { error: 'failed to start terminal session' };
    }
    this.sessions.set(session.id, session);
    this.onEvent({ sessionId: session.id, kind: 'state', state: 'starting', exitCode: null }, session.owner);
    session.pty.onData(data => this.enqueue(session, data));
    session.pty.onExit(event => this.finalize(session, event.exitCode, 'clean'));
    session.state = 'running';
    session.drainTimer = setInterval(() => this.drain(session), this.drainIntervalMs);
    session.drainTimer.unref?.();
    this.onEvent({ sessionId: session.id, kind: 'state', state: 'running', exitCode: null }, session.owner);
    this.logger.info('terminal session started', { sessionId: session.id, provider: session.provider, shell: session.shellId });
    return { session: this.info(session) };
  }

  stop(owner: string, sessionId: string): { sessionId: string; state: TerminalSessionStateT; cleanup: TerminalSessionCleanupT } | { error: string } {
    const session = this.sessions.get(sessionId);
    if (!session) return { error: 'unknown session' };
    if (session.owner !== owner) return { error: 'session is owned by another actor' };
    if (session.state === 'stopped' || session.state === 'disposed') {
      return { sessionId: session.id, state: session.state, cleanup: session.cleanup };
    }
    session.state = 'stopping';
    this.onEvent({ sessionId: session.id, kind: 'state', state: 'stopping', exitCode: null }, session.owner);
    this.killSession(session);
    return { sessionId: session.id, state: session.state, cleanup: session.cleanup };
  }

  // Control is activity inside an already-admitted session, never a new
  // authority operation. Fail closed: no identity, no action; wrong owner, no
  // action (and no oracle — we log a count only, never the payload).
  handleControl(message: unknown, identity?: WsActorIdentity): void {
    const parsed = TerminalControlMessage.safeParse(message);
    if (!parsed.success) {
      this.logger.warn('terminal control message rejected', { reason: 'schema' });
      return;
    }
    const control = parsed.data;
    const session = this.sessions.get(control.sessionId);
    if (!session) {
      this.logger.warn('terminal control message rejected', { reason: 'unknown-session' });
      return;
    }
    if (!identity || identity.id !== session.owner) {
      this.logger.warn('terminal control message rejected', { reason: 'not-owner', sessionId: session.id });
      return;
    }
    if (session.state === 'stopped' || session.state === 'disposed' || session.state === 'stopping') return;
    try {
      if (control.action === 'input') session.pty?.write(control.data);
      else if (control.action === 'resize') { session.cols = control.cols; session.rows = control.rows; session.pty?.resize(control.cols, control.rows); }
      else if (control.action === 'close') this.stop(session.owner, session.id);
    } catch (error) {
      this.logger.error('terminal control failed', { sessionId: session.id, action: control.action, error: error instanceof Error ? error.message : String(error) });
    }
  }

  stopAll(): void {
    for (const session of [...this.sessions.values()]) {
      if (session.state === 'stopped' || session.state === 'disposed') continue;
      this.killSession(session);
    }
  }

  private enqueue(session: Session, data: string): void {
    if (!data) return;
    session.queue.push(data);
    session.queuedBytes += data.length;
    while (session.queuedBytes > this.maxBufferBytes && session.queue.length > 1) {
      const droppedChunk = session.queue.shift()!;
      session.queuedBytes -= droppedChunk.length;
      session.truncated = true;
    }
    if (session.queuedBytes > this.maxBufferBytes && session.queue.length === 1) {
      const only = session.queue[0];
      const excess = session.queuedBytes - this.maxBufferBytes;
      if (only !== undefined && only.length > excess) {
        session.queue[0] = only.slice(excess);
        session.queuedBytes -= excess;
        session.truncated = true;
      }
    }
  }

  private drain(session: Session): void {
    if (session.truncated && session.queuedBytes === 0) {
      session.truncated = false;
      this.onEvent({ sessionId: session.id, kind: 'error', message: 'terminal output was truncated (buffer overflow)' }, session.owner);
      return;
    }
    let budget = MAX_BYTES_PER_TICK;
    while (budget > 0 && session.queue.length > 0) {
      let out = '';
      while (session.queue.length > 0 && out.length < Math.min(CHUNK_CHARS, budget)) {
        const next = session.queue[0];
        if (next === undefined) break;
        const room = Math.min(CHUNK_CHARS, budget) - out.length;
        if (next.length <= room) { out += next; session.queue.shift(); }
        else { out += next.slice(0, room); session.queue[0] = next.slice(room); }
      }
      session.queuedBytes -= out.length;
      budget -= out.length;
      if (out) this.onEvent({ sessionId: session.id, kind: 'output', data: out }, session.owner);
    }
  }

  private killSession(session: Session): void {
    if (session.drainTimer) { clearInterval(session.drainTimer); session.drainTimer = null; }
    try { session.pty?.kill(); }
    catch (error) { this.logger.warn('terminal kill failed', { sessionId: session.id, error: error instanceof Error ? error.message : String(error) }); }
    if (session.state !== 'stopped' && session.state !== 'disposed') {
      // If the PTY does not report exit promptly, finalize with an honest
      // cleanup verdict instead of pretending the process tree is gone.
      session.stopTimer = setTimeout(() => {
        if (session.state !== 'stopped' && session.state !== 'disposed') this.finalize(session, session.exitCode ?? -1, 'uncertain');
      }, STOP_GRACE_MS);
      session.stopTimer.unref?.();
    }
  }

  private finalize(session: Session, exitCode: number, cleanup: TerminalSessionCleanupT): void {
    if (session.state === 'stopped' || session.state === 'disposed') return;
    if (session.stopTimer) { clearTimeout(session.stopTimer); session.stopTimer = null; }
    if (session.drainTimer) { clearInterval(session.drainTimer); session.drainTimer = null; }
    session.exitCode = exitCode;
    session.cleanup = cleanup;
    session.state = 'stopped';
    // Flush anything still buffered before announcing exit.
    this.drain(session);
    this.onEvent({ sessionId: session.id, kind: 'exit', exitCode, cleanup }, session.owner);
    this.onEvent({ sessionId: session.id, kind: 'state', state: 'stopped', exitCode }, session.owner);
    this.logger.info('terminal session stopped', { sessionId: session.id, exitCode, cleanup });
  }
}
