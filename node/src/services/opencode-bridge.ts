// OpenCode bridge (Phase 3 of the subscription bridge).
//
// OpenCode is an officially supported external agent/client bridge — NOT an
// OpenAI-compatible endpoint and NOT a credential store to scrape. We use the
// documented headless server API only (`opencode serve` + /doc OpenAPI):
//   GET  /global/health          server health + version
//   GET  /provider               providers + connected[] (authoritative)
//   GET  /provider/auth          supported authentication methods per provider
//   POST /session                create a session
//   GET  /event                  receive session/message deltas and terminal state
//   POST /session/:id/prompt_async  start a prompt without blocking the event stream
//   POST /session/:id/abort       cancel an active prompt
//   GET  /session/:id/message    read the authoritative final message identity
//   DELETE /session/:id          cleanup
// OAuth authorization stays inside OpenCode's own auth mechanism
// (/provider/{id}/oauth/authorize + callback); Covert never reads or copies
// ~/.local/share/opencode/auth.json, never persists returned tokens, and only
// records the delegated provider/model identity that OpenCode itself returns
// authoritatively in the message/session payload.
import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import { observeAdapterRequestInput, type AdapterRequestInputOptions } from './model-request-input.ts';

export type OpenCodeDetection = {
  provider: 'opencode';
  connection_mode: 'subscription_client';
  kind: 'bridge';
  status: 'UNAVAILABLE' | 'NOT_AUTHENTICATED' | 'READY' | 'DEGRADED' | 'ENVIRONMENT_BLOCKED';
  binary_path: string | null;
  version: string | null;
  connected_providers: string[];
  auth_methods: Record<string, string[]>;
  detail: string;
};

export type OpenCodeTaskResult = {
  provider: 'opencode';
  text: string;
  session_id: string;
  delegated_provider: string | null;
  delegated_model: string | null;
  server_url: string;
  duration_ms: number;
  version: string | null;
};

export type OpenCodeGoCatalog = {
  connected: boolean;
  model_ids: string[];
};

export interface OpenCodeBridgeOptions {
  findExecutable?: (name: 'opencode') => Promise<string | null>;
  executableOverride?: { bin: string; prefix: string[]; version: string | null } | undefined;
  spawnFn?: typeof spawn;
  fetchFn?: typeof fetch;
  now?: () => number;
  serverStartTimeoutMs?: number;
  assertExternalEgressAllowed?: (() => void) | undefined;
}

const PROBE_TIMEOUT_MS = 8000;
const MAX_TOTAL_BYTES = 8 * 1024 * 1024;
const SENSITIVE_ENV = /(_KEY|_TOKEN|_SECRET|PASSWORD|CREDENTIAL|AUTH)/i;
const ENV_KEEP = new Set(['PATH', 'Path', 'PATHEXT', 'SystemRoot', 'windir', 'COMSPEC', 'ComSpec', 'HOME', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'TEMP', 'TMP', 'TZ', 'NUMBER_OF_PROCESSORS', 'PROCESSOR_ARCHITECTURE', 'OS', 'LANG']);

function operationAbortError(signal: AbortSignal): Error {
  const timedOut = signal.reason === 'timeout';
  return Object.assign(new Error(timedOut ? 'OpenCode task timed out' : 'OpenCode task cancelled'), {
    code: timedOut ? 'TIMEOUT' : 'CANCELLED'
  });
}

function waitForChildClose(child: ChildProcess, timeoutMs: number): Promise<boolean> {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve(true);
  return new Promise(resolve => {
    const finish = (closed: boolean): void => {
      clearTimeout(timer);
      child.off('close', onClose);
      resolve(closed);
    };
    const onClose = (): void => finish(true);
    const timer = setTimeout(() => finish(false), timeoutMs);
    child.once('close', onClose);
    if (child.exitCode !== null || child.signalCode !== null) finish(true);
  });
}

function defaultFindExecutable(name: 'opencode'): Promise<string | null> {
  const isWin = process.platform === 'win32';
  const probe = isWin ? 'where.exe' : 'which';
  const candidates = isWin ? [`${name}.exe`, `${name}.cmd`, `${name}.ps1`] : [name];
  return new Promise(resolve => {
    const tryNext = (index: number): void => {
      if (index >= candidates.length) return resolve(null);
      const child = spawn(probe, [candidates[index]!], { windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
      let out = '';
      child.stdout.on('data', chunk => { out += chunk; });
      child.once('error', () => resolve(null));
      child.once('close', () => {
        const first = out.split(/\r?\n/).map(line => line.trim()).find(line => line.length > 0);
        if (first && !/\.(exe|cmd|ps1)$/i.test(first) && isWin) { tryNext(index + 1); return; }
        if (first) resolve(first);
        else tryNext(index + 1);
      });
    };
    tryNext(0);
  });
}

// Routing model_id convention for the OpenCode bridge: "<providerID>/<modelID>"
// selects the delegated provider/model explicitly; a bare model id leaves
// provider selection to OpenCode. Never infer identity from the model name.
export function parseOpenCodeModelRef(modelId: string): { providerID: string | undefined; modelID: string | undefined } {
  const slash = modelId.indexOf('/');
  if (slash > 0) return { providerID: modelId.slice(0, slash), modelID: modelId.slice(slash + 1) };
  return { providerID: undefined, modelID: modelId.length > 0 ? modelId : undefined };
}

export function createOpenCodeBridge(options: OpenCodeBridgeOptions = {}) {
  const findExecutable = options.findExecutable ?? defaultFindExecutable;
  const spawnFn = options.spawnFn ?? spawn;
  const fetchFn = options.fetchFn ?? globalThis.fetch;
  const clock = options.now ?? (() => Date.now());
  const startTimeout = options.serverStartTimeoutMs ?? 60000;
  let server: { child: ChildProcess; url: string; workspace: string } | null = null;

  function buildEnv(): Record<string, string> {
    const env: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (value === undefined) continue;
      if (ENV_KEEP.has(key) || !SENSITIVE_ENV.test(key)) env[key] = value;
    }
    return env;
  }

  function killTree(child: ChildProcess): void {
    if (child.pid === undefined) return;
    if (process.platform === 'win32') {
      spawn('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
    } else {
      try { process.kill(-child.pid, 'SIGTERM'); } catch { child.kill('SIGTERM'); }
    }
  }

  async function resolveExecutable(): Promise<{ bin: string; prefix: string[]; version: string | null } | null> {
    if (options.executableOverride !== undefined) {
      const override = options.executableOverride;
      const version = override.version ?? await probeVersion(override);
      return { ...override, version };
    }
    const bin = await findExecutable('opencode');
    if (bin === null) return null;
    const executable = { bin, prefix: [] as string[], version: null as string | null };
    executable.version = await probeVersion(executable);
    return executable;
  }

  function probeVersion(executable: { bin: string; prefix: string[] }): Promise<string | null> {
    return new Promise(resolve => {
      const needsShell = process.platform === 'win32' && /\.(cmd|bat)$/i.test(executable.bin);
      const child = spawnFn(executable.bin, [...executable.prefix, '--version'], {
        windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'], shell: needsShell, env: buildEnv()
      }) as ChildProcess;
      let out = '';
      const timer = setTimeout(() => { child.kill('SIGKILL'); resolve(null); }, PROBE_TIMEOUT_MS);
      child.stdout?.on('data', chunk => { out += String(chunk); });
      child.once('error', () => { clearTimeout(timer); resolve(null); });
      child.once('close', () => {
        clearTimeout(timer);
        const line = out.split(/\r?\n/).map(value => value.trim()).find(value => value.length > 0) ?? null;
        resolve(line);
      });
    });
  }

  async function ensureServer(workspace: string, signal?: AbortSignal): Promise<{ child: ChildProcess; url: string; workspace: string }> {
    const throwIfAborted = (): void => {
      if (signal?.aborted) throw operationAbortError(signal);
    };
    throwIfAborted();
    const resolved = path.resolve(workspace);
    if (server !== null && server.child.exitCode === null && server.child.signalCode === null && server.workspace === resolved) return server;
    if (server !== null) await stop();
    throwIfAborted();
    const executable = await resolveExecutable();
    throwIfAborted();
    if (executable === null) throw Object.assign(new Error('opencode CLI not detected on PATH'), { code: 'NOT_READY' });
    const needsShell = process.platform === 'win32' && /\.(cmd|bat)$/i.test(executable.bin);
    const child = spawnFn(executable.bin, [...executable.prefix, 'serve', '--port', '0', '--hostname', '127.0.0.1'], {
      cwd: resolved, windowsHide: true, shell: needsShell, env: buildEnv(),
      stdio: ['ignore', 'pipe', 'pipe'], detached: process.platform !== 'win32'
    }) as ChildProcess;
    let output = '';
    const url = await new Promise<string>((resolve, reject) => {
      let settled = false;
      let timer: ReturnType<typeof setTimeout>;
      const cleanupListeners = (): void => {
        clearTimeout(timer);
        child.stdout?.off('data', onData);
        child.stderr?.off('data', onData);
        child.off('error', onError);
        child.off('close', onClose);
        signal?.removeEventListener('abort', onAbort);
      };
      const fail = (error: Error): void => {
        if (settled) return;
        settled = true;
        cleanupListeners();
        reject(error);
      };
      const onAbort = (): void => {
        if (settled) return;
        settled = true;
        cleanupListeners();
        killTree(child);
        void waitForChildClose(child, 5000).then(closed => {
          reject(closed
            ? operationAbortError(signal!)
            : Object.assign(new Error('opencode startup child cleanup could not be confirmed'), { code: 'CLEANUP_FAILED' }));
        });
      };
      const onData = (chunk: Buffer): void => {
        output = (output + String(chunk)).slice(-MAX_TOTAL_BYTES);
        const match = output.match(/listening on (http:\/\/127\.0\.0\.1:\d+)/);
        if (match !== null) {
          if (signal?.aborted) { onAbort(); return; }
          if (settled) return;
          settled = true;
          cleanupListeners();
          resolve(match[1]!);
        }
      };
      const onError = (error: Error): void => fail(Object.assign(new Error(`opencode serve process failure: ${error.message}`), { code: 'CHILD_FAILED' }));
      const onClose = (code: number | null): void => fail(Object.assign(new Error(`opencode serve exited early with code ${String(code)}`), { code: 'CHILD_FAILED' }));
      const onStartTimeout = (): void => {
        if (settled) return;
        settled = true;
        cleanupListeners();
        killTree(child);
        void waitForChildClose(child, 5000).then(closed => {
          reject(closed
            ? Object.assign(new Error('opencode serve did not announce a port in time'), { code: 'CHILD_FAILED' })
            : Object.assign(new Error('opencode startup child cleanup could not be confirmed'), { code: 'CLEANUP_FAILED' }));
        });
      };
      timer = setTimeout(onStartTimeout, startTimeout);
      child.stdout?.on('data', onData);
      child.stderr?.on('data', onData);
      child.on('error', onError);
      child.on('close', onClose);
      if (signal !== undefined) {
        if (signal.aborted) onAbort();
        else signal.addEventListener('abort', onAbort, { once: true });
      }
    });
    server = { child, url, workspace: resolved };
    return server;
  }

  async function stop(): Promise<void> {
    if (server === null) return;
    const ref = server;
    server = null;
    killTree(ref.child);
    await new Promise<void>(resolve => {
      const timer = setTimeout(() => resolve(), 5000);
      ref.child.once('close', () => { clearTimeout(timer); resolve(); });
    });
    // The real opencode server can outlive the launcher (it self-detaches), so
    // tree-kill on the tracked child is not sufficient. Sweep the exact port we
    // announced: any listener on it is our server and must die (R7).
    try {
      const port = new URL(ref.url).port;
      if (port.length > 0 && process.platform === 'win32') {
        const sweep = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
          `$p = (Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty OwningProcess); if ($p) { Stop-Process -Id $p -Force -ErrorAction SilentlyContinue }`
        ], { windowsHide: true, stdio: 'ignore' });
        await new Promise<void>(resolve => {
          const timer = setTimeout(() => resolve(), 8000);
          sweep.once('close', () => { clearTimeout(timer); resolve(); });
          sweep.once('error', () => { clearTimeout(timer); resolve(); });
        });
      }
    } catch { /* best-effort sweep; the tracked kill already ran */ }
  }

  async function fetchJson(url: string, init: RequestInit = {}, timeoutMs = 60000): Promise<{ status: number; body: unknown }> {
    const response = await fetchFn(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
    let body: unknown = null;
    try { body = await response.json(); } catch { body = null; }
    return { status: response.status, body };
  }

  async function status(): Promise<OpenCodeDetection> {
    const executable = await resolveExecutable();
    const base = {
      provider: 'opencode' as const,
      connection_mode: 'subscription_client' as const,
      kind: 'bridge' as const,
      binary_path: executable?.bin ?? null,
      version: executable?.version ?? null,
      connected_providers: [] as string[],
      auth_methods: {} as Record<string, string[]>
    };
    if (executable === null) {
      return { ...base, status: 'UNAVAILABLE', detail: 'opencode CLI not detected on PATH' };
    }
    try {
      const running = await ensureServer(process.cwd());
      const health = await fetchJson(`${running.url}/global/health`, {}, 15000);
      const providers = await fetchJson(`${running.url}/provider`, {}, 30000);
      const auth = await fetchJson(`${running.url}/provider/auth`, {}, 30000);
      const connected = (providers.body as { connected?: unknown } | null)?.connected;
      const connectedList = Array.isArray(connected) ? connected.filter((value): value is string => typeof value === 'string') : [];
      const methods: Record<string, string[]> = {};
      const authBody = auth.body as Record<string, Array<{ type?: unknown }>> | null;
      if (authBody !== null && typeof authBody === 'object') {
        for (const [providerId, list] of Object.entries(authBody)) {
          methods[providerId] = (Array.isArray(list) ? list : []).map(entry => String((entry as { type?: unknown })?.type ?? 'unknown'));
        }
      }
      const version = (health.body as { version?: unknown } | null)?.version;
      return {
        ...base,
        version: typeof version === 'string' ? version : base.version,
        connected_providers: connectedList.slice(0, 32),
        auth_methods: methods,
        status: connectedList.length > 0 ? 'READY' : 'NOT_AUTHENTICATED',
        detail: connectedList.length > 0
          ? `opencode server ready (${connectedList.length} provider credential(s) connected)`
          : 'opencode server ready; no provider credentials connected (use OpenCode auth or the documented OAuth endpoints)'
      };
    } catch (error) {
      return { ...base, status: 'ENVIRONMENT_BLOCKED', detail: `opencode server unavailable: ${String((error as Error)?.message ?? error).slice(0, 200)}` };
    }
  }

  // Explicit operator action. This reads only the managed local server catalog;
  // it never creates a session or dispatches a provider prompt. Reuse an active
  // server even if its task workspace differs, so discovery cannot stop a task.
  async function discoverGoModels(workspace: string): Promise<OpenCodeGoCatalog> {
    const running = server !== null && server.child.exitCode === null && server.child.signalCode === null
      ? server
      : await ensureServer(workspace);
    const response = await fetchJson(`${running.url}/provider`, { method: 'GET' }, 15000);
    if (response.status !== 200 || response.body === null || typeof response.body !== 'object') {
      throw Object.assign(new Error('OpenCode provider catalog unavailable'), { code: 'NOT_READY' });
    }
    const catalog = response.body as { all?: unknown; connected?: unknown };
    if (!Array.isArray(catalog.all) || !Array.isArray(catalog.connected)) {
      throw Object.assign(new Error('OpenCode provider catalog malformed'), { code: 'NOT_READY' });
    }
    const provider = catalog.all.find((entry: unknown) =>
      entry !== null && typeof entry === 'object' && (entry as { id?: unknown }).id === 'opencode-go'
    ) as { models?: unknown } | undefined;
    const models = provider?.models;
    if (models === null || typeof models !== 'object' || Array.isArray(models)) {
      return { connected: catalog.connected.includes('opencode-go'), model_ids: [] };
    }
    const modelIds = Object.keys(models)
      .filter(id => /^[A-Za-z0-9._:-]{1,200}$/.test(id) &&
        !/^(?:sk-[A-Za-z0-9_-]{12,}|hf_[A-Za-z0-9]{12,})$/i.test(id))
      .slice(0, 256)
      .sort();
    return { connected: catalog.connected.includes('opencode-go'), model_ids: modelIds };
  }

  async function runTaskStream(input: AdapterRequestInputOptions & {
    workspace: string;
    prompt: string;
    providerID: string;
    modelID: string;
    timeoutMs?: number;
    signal?: AbortSignal;
    onDelta: (delta: string) => void;
  }): Promise<OpenCodeTaskResult> {
    const runOptions = { ...input };
    if (runOptions.providerID.length === 0 || runOptions.modelID.length === 0) {
      throw Object.assign(new Error('OpenCode execution requires an exact provider and model identity'), { code: 'TARGET_MISMATCH' });
    }
    if (runOptions.signal?.aborted) throw Object.assign(new Error('OpenCode task cancelled'), { code: 'CANCELLED' });
    options.assertExternalEgressAllowed?.();

    const startedAt = clock();
    const timeoutMs = Math.max(5000, Math.min(runOptions.timeoutMs ?? 300000, 900000));
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort('timeout'), timeoutMs);
    const abortFromCaller = (): void => controller.abort('caller');
    runOptions.signal?.addEventListener('abort', abortFromCaller, { once: true });
    if (runOptions.signal?.aborted) abortFromCaller();

    const cancellationError = (): Error => {
      const callerCancelled = runOptions.signal?.aborted || controller.signal.reason === 'caller';
      return Object.assign(new Error(callerCancelled ? 'OpenCode task cancelled' : 'OpenCode task timed out'), {
        code: callerCancelled ? 'CANCELLED' : 'TIMEOUT'
      });
    };
    let running: { child: ChildProcess; url: string; workspace: string };
    let executable: Awaited<ReturnType<typeof resolveExecutable>>;
    try {
      running = await ensureServer(runOptions.workspace, controller.signal);
      if (controller.signal.aborted) throw cancellationError();
      executable = await resolveExecutable();
      if (controller.signal.aborted) throw cancellationError();
    } catch (error) {
      clearTimeout(timeout);
      runOptions.signal?.removeEventListener('abort', abortFromCaller);
      const code = (error as { code?: unknown } | null)?.code;
      throw code === 'CLEANUP_FAILED' ? error : controller.signal.aborted ? cancellationError() : error;
    }
    let sessionId: string | null = null;
    let eventReader: ReadableStreamDefaultReader<Uint8Array> | null = null;
    let eventReaderTask: Promise<void> | null = null;
    let eventReaderCancelTask: Promise<void> | null = null;
    const cancelEventReader = (): Promise<void> => {
      if (eventReader === null) return Promise.resolve();
      eventReaderCancelTask ??= eventReader.cancel().catch(() => undefined);
      return eventReaderCancelTask;
    };

    const request = async (url: string, init: RequestInit, requestTimeoutMs: number): Promise<Response> => {
      if (controller.signal.aborted) throw cancellationError();
      try {
        return await fetchFn(url, { ...init, signal: AbortSignal.any([controller.signal, AbortSignal.timeout(requestTimeoutMs)]) });
      } catch (error) {
        if (controller.signal.aborted) throw cancellationError();
        throw error;
      }
    };
    const exactModelAvailable = async (): Promise<boolean> => {
      const response = await request(`${running.url}/provider`, { method: 'GET' }, 15000);
      let body: unknown = null;
      try { body = await response.json(); } catch { body = null; }
      if (response.status !== 200 || body === null || typeof body !== 'object') return false;
      const catalog = body as { all?: unknown; connected?: unknown };
      const connected = Array.isArray(catalog.connected) && catalog.connected.includes(runOptions.providerID);
      const providers = Array.isArray(catalog.all) ? catalog.all as Array<Record<string, unknown>> : [];
      const provider = providers.find(candidate => candidate.id === runOptions.providerID);
      const models = provider?.models;
      return connected && models !== null && typeof models === 'object' && Object.hasOwn(models, runOptions.modelID);
    };
    const cleanup = async (abort: boolean): Promise<void> => {
      if (sessionId === null) return;
      const encoded = encodeURIComponent(sessionId);
      if (abort) {
        await fetchFn(`${running.url}/session/${encoded}/abort`, {
          method: 'POST', signal: AbortSignal.timeout(5000)
        }).catch(() => undefined);
      }
      const deleted = await fetchFn(`${running.url}/session/${encoded}`, {
        method: 'DELETE', signal: AbortSignal.timeout(5000)
      }).catch(() => null);
      if (deleted === null || !deleted.ok) {
        throw Object.assign(new Error('opencode session cleanup could not be confirmed'), { code: 'CLEANUP_FAILED' });
      }
      sessionId = null;
    };

    try {
      if (!(await exactModelAvailable())) {
        throw Object.assign(new Error('OpenCode provider is disconnected or the exact model is absent from its local catalog'), { code: 'NOT_READY' });
      }
      const createdResponse = await request(`${running.url}/session`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'covert-task' })
      }, 30000);
      let created: { id?: unknown } | null = null;
      try { created = await createdResponse.json() as { id?: unknown }; } catch { created = null; }
      if (createdResponse.status !== 200 || typeof created?.id !== 'string' || created.id.length === 0) {
        throw Object.assign(new Error(`opencode session creation failed (HTTP ${createdResponse.status})`), { code: 'CHILD_FAILED' });
      }
      sessionId = created.id;

      const eventResponse = await request(`${running.url}/event`, { method: 'GET', headers: { accept: 'text/event-stream' } }, 15000);
      if (eventResponse.status !== 200 || eventResponse.body === null) {
        throw Object.assign(new Error(`opencode event stream unavailable (HTTP ${eventResponse.status})`), { code: 'CHILD_FAILED' });
      }

      let resolveTerminal!: (event: { kind: 'idle' } | { kind: 'error' }) => void;
      let rejectTerminal!: (error: unknown) => void;
      const terminal = new Promise<{ kind: 'idle' } | { kind: 'error' }>((resolve, reject) => {
        resolveTerminal = resolve;
        rejectTerminal = reject;
      });
      // Attach a rejection handler before starting the reader so a fast stream
      // failure cannot become an unhandled rejection while prompt_async returns.
      const terminalOutcome = terminal.then(value => ({ value }), error => ({ error }));
      const assistantMessages = new Set<string>();
      const textParts = new Set<string>();
      let receivedBytes = 0;
      let settled = false;
      const settle = (value: { kind: 'idle' } | { kind: 'error' }): void => {
        if (settled) return;
        settled = true;
        resolveTerminal(value);
      };
      const settleError = (error: unknown): void => {
        if (settled) return;
        settled = true;
        rejectTerminal(error);
      };
      const unwrapEvent = (value: unknown): { type?: unknown; properties?: unknown } | null => {
        if (value === null || typeof value !== 'object') return null;
        const outer = value as Record<string, unknown>;
        const candidate = outer.payload !== null && typeof outer.payload === 'object'
          ? outer.payload as Record<string, unknown>
          : outer;
        return candidate;
      };
      const handleEvent = (raw: string): void => {
        if (raw.length === 0 || raw.length > 1024 * 1024) return;
        let decoded: unknown;
        try { decoded = JSON.parse(raw); } catch { return; }
        const event = unwrapEvent(decoded);
        if (event === null || typeof event.type !== 'string' || event.properties === null || typeof event.properties !== 'object') return;
        const properties = event.properties as Record<string, unknown>;
        const info = properties.info as Record<string, unknown> | undefined;
        const part = properties.part as Record<string, unknown> | undefined;
        const eventSession = properties.sessionID ?? info?.sessionID ?? part?.sessionID;
        if (eventSession !== sessionId) return;

        if (event.type === 'session.error') {
          settle({ kind: 'error' });
          return;
        }
        if (event.type === 'session.idle') {
          settle({ kind: 'idle' });
          return;
        }
        if (event.type === 'message.updated') {
          if (info?.sessionID === sessionId && info.role === 'assistant' && typeof info.id === 'string') {
            if (info.providerID !== runOptions.providerID || info.modelID !== runOptions.modelID) {
              throw Object.assign(new Error('opencode assistant stream identity did not match the authorized target'), { code: 'TARGET_MISMATCH' });
            }
            assistantMessages.add(info.id);
          }
          return;
        }
        if (event.type === 'message.part.updated') {
          if (part?.sessionID === sessionId && part.type === 'text' && typeof part.id === 'string' && typeof part.messageID === 'string' && assistantMessages.has(part.messageID)) {
            textParts.add(part.id);
          }
          return;
        }
        if (event.type === 'message.part.delta' && properties.field === 'text' && typeof properties.delta === 'string' && typeof properties.partID === 'string' && textParts.has(properties.partID)) {
          try { runOptions.onDelta(properties.delta); } catch { throw Object.assign(new Error('OpenCode delta consumer failed'), { code: 'CHILD_FAILED' }); }
          if (controller.signal.aborted) throw cancellationError();
        }
      };
      const readEvents = async (): Promise<void> => {
        const reader = eventResponse.body!.getReader();
        eventReader = reader;
        const decoder = new TextDecoder();
        let buffer = '';
        try {
          while (!settled) {
            const next = await reader.read();
            if (next.done) break;
            receivedBytes += next.value.byteLength;
            if (receivedBytes > MAX_TOTAL_BYTES) throw Object.assign(new Error('opencode event stream exceeded its size limit'), { code: 'CHILD_FAILED' });
            buffer += decoder.decode(next.value, { stream: true });
            if (buffer.length > 2 * 1024 * 1024) throw Object.assign(new Error('opencode event frame exceeded its size limit'), { code: 'CHILD_FAILED' });
            let boundary = buffer.indexOf('\n\n');
            while (boundary >= 0) {
              const frame = buffer.slice(0, boundary).replace(/\r/g, '');
              buffer = buffer.slice(boundary + 2);
              const data = frame.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
              if (data.length > 0) handleEvent(data);
              if (settled) break;
              boundary = buffer.indexOf('\n\n');
            }
          }
          if (!settled) settleError(Object.assign(new Error('opencode event stream ended before the task completed'), { code: 'CHILD_FAILED' }));
        } catch (error) {
          settleError(controller.signal.aborted ? cancellationError() : error);
        } finally {
          await cancelEventReader();
          reader.releaseLock();
          eventReader = null;
        }
      };
      const readerTask = readEvents();
      eventReaderTask = readerTask;

      const serialized = JSON.stringify({ model: { providerID: runOptions.providerID, modelID: runOptions.modelID }, parts: [{ type: 'text', text: runOptions.prompt }] });
      await observeAdapterRequestInput(serialized, { adapter: 'opencode-bridge', protocol: 'opencode-prompt-async',
        requested_model: `${runOptions.providerID}/${runOptions.modelID}`, request_index: 1, stream: true }, runOptions, controller.signal);
      options.assertExternalEgressAllowed?.();
      const promptResponse = await request(`${running.url}/session/${encodeURIComponent(sessionId)}/prompt_async`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: serialized
      }, 30000);
      if (promptResponse.status !== 204 && promptResponse.status !== 200) {
        throw Object.assign(new Error(`opencode prompt submission failed (HTTP ${promptResponse.status})`), { code: promptResponse.status === 401 || promptResponse.status === 403 ? 'NOT_READY' : 'CHILD_FAILED' });
      }
      const outcome = await terminalOutcome;
      if ('error' in outcome) throw outcome.error;
      if (outcome.value.kind === 'error') throw Object.assign(new Error('opencode delegated provider task failed'), { code: 'CHILD_FAILED' });
      await readerTask;

      const messagesResponse = await request(`${running.url}/session/${encodeURIComponent(sessionId)}/message`, { method: 'GET' }, 15000);
      let messages: unknown = null;
      try { messages = await messagesResponse.json(); } catch { messages = null; }
      const rows = Array.isArray(messages) ? messages as Array<{ info?: Record<string, unknown>; parts?: Array<Record<string, unknown>> }> : [];
      const target = [...rows].reverse().find(row => row.info?.role === 'assistant' && row.info.sessionID === sessionId);
      if (messagesResponse.status !== 200 || target === undefined) throw Object.assign(new Error('opencode returned no authoritative assistant message'), { code: 'CHILD_FAILED' });
      const delegatedProvider = typeof target.info?.providerID === 'string' ? target.info.providerID : null;
      const delegatedModel = typeof target.info?.modelID === 'string' ? target.info.modelID : null;
      if (delegatedProvider !== runOptions.providerID || delegatedModel !== runOptions.modelID) {
        throw Object.assign(new Error('opencode delegated provider/model identity did not match the authorized target'), { code: 'TARGET_MISMATCH' });
      }
      const parts = Array.isArray(target.parts) ? target.parts : [];
      const text = parts.filter(part => part.type === 'text' && typeof part.text === 'string').map(part => String(part.text)).join('\n').trim();
      if (text.length === 0) throw Object.assign(new Error('opencode returned an empty response'), { code: 'CHILD_FAILED' });
      const completedSessionId = sessionId;
      await cleanup(false);
      return {
        provider: 'opencode', text, session_id: completedSessionId, delegated_provider: delegatedProvider,
        delegated_model: delegatedModel, server_url: running.url,
        duration_ms: clock() - startedAt, version: executable?.version ?? null
      };
    } catch (error) {
      const code = (error as { code?: unknown } | null)?.code;
      const mapped = code === 'CLEANUP_FAILED' ? error : controller.signal.aborted ? cancellationError() : error;
      try {
        await cleanup(sessionId !== null);
      } catch {
        throw Object.assign(new Error('opencode task failed and session cleanup could not be confirmed'), { code: 'CLEANUP_FAILED', cause: mapped });
      }
      throw mapped;
    } finally {
      await cancelEventReader();
      await eventReaderTask?.catch(() => undefined);
      clearTimeout(timeout);
      runOptions.signal?.removeEventListener('abort', abortFromCaller);
    }
  }

  async function runTask(runOptions: AdapterRequestInputOptions & {
    workspace: string;
    prompt: string;
    providerID?: string;
    modelID?: string;
    timeoutMs?: number;
    signal?: AbortSignal;
  }): Promise<OpenCodeTaskResult> {
    if (!runOptions.providerID || !runOptions.modelID) {
      throw Object.assign(new Error('OpenCode task requires an exact provider and model identity'), { code: 'TARGET_MISMATCH' });
    }
    return runTaskStream({
      workspace: runOptions.workspace,
      prompt: runOptions.prompt,
      providerID: runOptions.providerID,
      modelID: runOptions.modelID,
      ...(runOptions.timeoutMs !== undefined ? { timeoutMs: runOptions.timeoutMs } : {}),
      ...(runOptions.signal !== undefined ? { signal: runOptions.signal } : {}),
      ...(runOptions.adapterInput !== undefined ? { adapterInput: runOptions.adapterInput } : {}),
      onDelta: () => undefined
    });
  }

  return Object.freeze({ detect: resolveExecutable, status, discoverGoModels, runTask, runTaskStream, stop, ensureServer });
}
