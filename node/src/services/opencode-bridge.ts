// OpenCode bridge (Phase 3 of the subscription bridge).
//
// OpenCode is an officially supported external agent/client bridge — NOT an
// OpenAI-compatible endpoint and NOT a credential store to scrape. We use the
// documented headless server API only (`opencode serve` + /doc OpenAPI):
//   GET  /global/health          server health + version
//   GET  /provider               providers + connected[] (authoritative)
//   GET  /provider/auth          supported authentication methods per provider
//   POST /session                create a session
//   POST /session/:id/message    send a message, wait for the response
//   DELETE /session/:id          cleanup
// OAuth authorization stays inside OpenCode's own auth mechanism
// (/provider/{id}/oauth/authorize + callback); Covert never reads or copies
// ~/.local/share/opencode/auth.json, never persists returned tokens, and only
// records the delegated provider/model identity that OpenCode itself returns
// authoritatively in the message/session payload.
import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';

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

export interface OpenCodeBridgeOptions {
  findExecutable?: (name: 'opencode') => Promise<string | null>;
  executableOverride?: { bin: string; prefix: string[]; version: string | null } | undefined;
  spawnFn?: typeof spawn;
  fetchFn?: typeof fetch;
  now?: () => number;
  serverStartTimeoutMs?: number;
}

const PROBE_TIMEOUT_MS = 8000;
const MAX_TOTAL_BYTES = 8 * 1024 * 1024;
const SENSITIVE_ENV = /(_KEY|_TOKEN|_SECRET|PASSWORD|CREDENTIAL|AUTH)/i;
const ENV_KEEP = new Set(['PATH', 'Path', 'PATHEXT', 'SystemRoot', 'windir', 'COMSPEC', 'ComSpec', 'HOME', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'TEMP', 'TMP', 'TZ', 'NUMBER_OF_PROCESSORS', 'PROCESSOR_ARCHITECTURE', 'OS', 'LANG']);

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

  async function ensureServer(workspace: string): Promise<{ child: ChildProcess; url: string; workspace: string }> {
    const resolved = path.resolve(workspace);
    if (server !== null && server.child.exitCode === null && server.child.signalCode === null && server.workspace === resolved) return server;
    if (server !== null) await stop();
    const executable = await resolveExecutable();
    if (executable === null) throw Object.assign(new Error('opencode CLI not detected on PATH'), { code: 'NOT_READY' });
    const needsShell = process.platform === 'win32' && /\.(cmd|bat)$/i.test(executable.bin);
    const child = spawnFn(executable.bin, [...executable.prefix, 'serve', '--port', '0', '--hostname', '127.0.0.1'], {
      cwd: resolved, windowsHide: true, shell: needsShell, env: buildEnv(),
      stdio: ['ignore', 'pipe', 'pipe'], detached: process.platform !== 'win32'
    }) as ChildProcess;
    let output = '';
    const url = await new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => { killTree(child); reject(Object.assign(new Error('opencode serve did not announce a port in time'), { code: 'CHILD_FAILED' })); }, startTimeout);
      const onData = (chunk: Buffer): void => {
        output = (output + String(chunk)).slice(-MAX_TOTAL_BYTES);
        const match = output.match(/listening on (http:\/\/127\.0\.0\.1:\d+)/);
        if (match !== null) { clearTimeout(timer); resolve(match[1]!); }
      };
      child.stdout?.on('data', onData);
      child.stderr?.on('data', onData);
      child.once('error', error => { clearTimeout(timer); reject(Object.assign(new Error(`opencode serve process failure: ${error.message}`), { code: 'CHILD_FAILED' })); });
      child.once('close', code => { clearTimeout(timer); reject(Object.assign(new Error(`opencode serve exited early with code ${String(code)}`), { code: 'CHILD_FAILED' })); });
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

  async function runTask(runOptions: { workspace: string; prompt: string; providerID?: string | undefined; modelID?: string | undefined; timeoutMs?: number }): Promise<OpenCodeTaskResult> {
    const startedAt = clock();
    const running = await ensureServer(runOptions.workspace);
    const executable = await resolveExecutable();
    const timeoutMs = Math.max(5000, Math.min(runOptions.timeoutMs ?? 300000, 900000));
    const created = await fetchJson(`${running.url}/session`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'covert-task' })
    }, 30000);
    const sessionId = (created.body as { id?: unknown } | null)?.id;
    if (created.status !== 200 || typeof sessionId !== 'string') {
      throw Object.assign(new Error(`opencode session creation failed (HTTP ${created.status})`), { code: 'CHILD_FAILED' });
    }
    const payload: Record<string, unknown> = { parts: [{ type: 'text', text: runOptions.prompt }] };
    if (typeof runOptions.providerID === 'string' && typeof runOptions.modelID === 'string' && runOptions.providerID.length > 0 && runOptions.modelID.length > 0) {
      payload.model = { providerID: runOptions.providerID, modelID: runOptions.modelID };
    }
    const message = await fetchJson(`${running.url}/session/${encodeURIComponent(sessionId)}/message`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload)
    }, timeoutMs);
    if (message.status !== 200) {
      const detail = JSON.stringify(message.body ?? {}).slice(0, 220);
      throw Object.assign(new Error(`opencode task failed (HTTP ${message.status}): ${detail}`), { code: message.status === 401 || message.status === 403 ? 'NOT_READY' : 'CHILD_FAILED' });
    }
    const body = message.body as { info?: Record<string, unknown>; parts?: Array<Record<string, unknown>> } | null;
    const parts = Array.isArray(body?.parts) ? body.parts : [];
    const text = parts.filter(part => part?.type === 'text' && typeof part.text === 'string').map(part => String(part.text)).join('\n').trim();
    const info = body?.info ?? {};
    const delegatedProvider = typeof info.providerID === 'string' ? info.providerID : null;
    const delegatedModel = typeof info.modelID === 'string' ? info.modelID : null;
    if (text.length === 0) {
      // Truthful failure: surface the provider error OpenCode returned instead
      // of an opaque empty response.
      const error = info.error as { name?: unknown; data?: { message?: unknown; statusCode?: unknown } } | undefined;
      const errorMessage = typeof error?.data?.message === 'string' ? error.data.message : null;
      if (errorMessage !== null) {
        const statusCode = typeof error?.data?.statusCode === 'number' ? error.data.statusCode : null;
        const code = statusCode === 401 || statusCode === 403 ? 'NOT_READY' : 'CHILD_FAILED';
        throw Object.assign(new Error(`opencode delegated provider error (${String(error?.name ?? 'error')}${statusCode !== null ? ` HTTP ${statusCode}` : ''}): ${errorMessage.slice(0, 200)}`), { code });
      }
      throw Object.assign(new Error('opencode returned an empty response'), { code: 'CHILD_FAILED' });
    }
    await fetchJson(`${running.url}/session/${encodeURIComponent(sessionId)}`, { method: 'DELETE' }, 15000).catch(() => undefined);
    return {
      provider: 'opencode',
      text,
      session_id: sessionId,
      delegated_provider: delegatedProvider,
      delegated_model: delegatedModel,
      server_url: running.url,
      duration_ms: clock() - startedAt,
      version: executable?.version ?? null
    };
  }

  return Object.freeze({ detect: resolveExecutable, status, runTask, stop, ensureServer });
}
