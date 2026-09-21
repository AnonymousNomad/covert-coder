// Kimi Code CLI transport (Phase 2 of the subscription bridge).
//
// OFFICIAL CLI ONLY: MoonshotAI/kimi-cli, installed via the official
// distribution (uv tool install kimi-cli). Authentication is owned by the CLI
// (`kimi login` OAuth device flow); we never read, copy, parse, or persist its
// credentials. The private Kimi Code desktop app daemon is never touched.
//
// Execution surface v1: the documented non-interactive print mode with plan
// mode (read-only tools only) and stream-json output:
//   kimi --print --plan --output-format stream-json -p <prompt>
// `kimi acp` (Agent Client Protocol server) is the preferred interactive
// transport documented by Moonshot and is the follow-up; this module keeps the
// same governance envelope (bounded spawn, stripped env, bounded output,
// tree-kill) either way.
import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';

export type KimiDetection = {
  provider: 'kimi-code';
  provider_family: 'moonshot';
  transport: 'kimi-code-cli';
  connection_mode: 'subscription_client';
  auth_class: 'kimi_code_subscription';
  status: 'UNAVAILABLE' | 'AUTH_REQUIRED' | 'AVAILABLE' | 'DEGRADED';
  binary_path: string | null;
  version: string | null;
  // null = unproven: readiness is never manufactured from config presence.
  authenticated: boolean | null;
  detail: string;
};

export type KimiInvokeResult = {
  provider: 'kimi-code';
  text: string;
  events: Array<{ type: string; payload: unknown }>;
  event_count: number;
  unparsed_lines: number;
  stderr_tail: string;
  exit_code: number | null;
  duration_ms: number;
  binary_path: string;
  version: string | null;
};

type Executable = { bin: string; prefix: string[]; version: string | null };

export interface KimiTransportOptions {
  findExecutable?: (name: 'kimi') => Promise<string | null>;
  executableOverride?: Executable | undefined;
  spawnFn?: typeof spawn;
  now?: () => number;
  probeTtlMs?: number;
}

const MAX_LINE_BYTES = 262144;
const MAX_TOTAL_BYTES = 8 * 1024 * 1024;
const MAX_STDERR_BYTES = 65536;
const MAX_PROMPT_CHARS = 60000;
const PROBE_TIMEOUT_MS = 8000;
const SENSITIVE_ENV = /(_KEY|_TOKEN|_SECRET|PASSWORD|CREDENTIAL|AUTH)/i;
const ENV_KEEP = new Set(['PATH', 'Path', 'PATHEXT', 'SystemRoot', 'windir', 'COMSPEC', 'ComSpec', 'HOME', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'TEMP', 'TMP', 'TZ', 'NUMBER_OF_PROCESSORS', 'PROCESSOR_ARCHITECTURE', 'OS', 'LANG']);

function defaultFindExecutable(name: 'kimi'): Promise<string | null> {
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

export function createKimiTransport(options: KimiTransportOptions = {}) {
  const findExecutable = options.findExecutable ?? defaultFindExecutable;
  const spawnFn = options.spawnFn ?? spawn;
  const clock = options.now ?? (() => Date.now());
  const probeTtl = options.probeTtlMs ?? 300000;
  let authCache: { authenticated: boolean; detail: string; at: number } | null = null;

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

  async function resolveExecutable(): Promise<Executable | null> {
    if (options.executableOverride !== undefined) {
      const override = options.executableOverride;
      const version = override.version ?? await probeVersion(override);
      return { ...override, version };
    }
    const bin = await findExecutable('kimi');
    if (bin === null) return null;
    const executable: Executable = { bin, prefix: [], version: null };
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

  async function detect(): Promise<KimiDetection> {
    const base = {
      provider: 'kimi-code' as const,
      provider_family: 'moonshot' as const,
      transport: 'kimi-code-cli' as const,
      connection_mode: 'subscription_client' as const,
      auth_class: 'kimi_code_subscription' as const
    };
    const executable = await resolveExecutable();
    if (executable === null) {
      return { ...base, status: 'UNAVAILABLE', binary_path: null, version: null, authenticated: null, detail: 'kimi CLI not detected on PATH (install the official distribution: uv tool install kimi-cli)' };
    }
    const cached = authCache !== null && clock() - authCache.at < probeTtl ? authCache : null;
    if (cached !== null && cached.authenticated === false) {
      return { ...base, status: 'AUTH_REQUIRED', binary_path: executable.bin, version: executable.version, authenticated: false, detail: `kimi CLI present; official login required (${cached.detail})` };
    }
    const status = executable.version === null ? 'DEGRADED' : 'AVAILABLE';
    const authNote = cached === null ? 'authentication unproven (bounded probe not yet run)' : cached.detail;
    return {
      ...base, status, binary_path: executable.bin, version: executable.version,
      authenticated: cached === null ? null : cached.authenticated,
      detail: `kimi CLI present (version ${String(executable.version)}; ${authNote})`
    };
  }

  // Bounded capability probe: a real, tiny plan-mode invocation. This is the
  // only evidence that may mark the client authenticated — never config files.
  async function probe(): Promise<{ authenticated: boolean; detail: string }> {
    const executable = await resolveExecutable();
    if (executable === null) return { authenticated: false, detail: 'kimi CLI not detected' };
    try {
      const result = await invokeInternal(executable, {
        prompt: 'Reply with exactly: KIMI-READY',
        workspace: process.cwd(),
        timeoutMs: 180000
      });
      const authenticated = /KIMI-READY/.test(result.text);
      const detail = authenticated ? 'bounded capability probe succeeded' : `probe returned unexpected output (${result.text.slice(0, 80)})`;
      authCache = { authenticated, detail, at: clock() };
      return { authenticated, detail };
    } catch (error) {
      const message = String((error as Error)?.message ?? error);
      const authRequired = /LLM not set|AUTH_REQUIRED|login|not logged|unauthorized/i.test(message);
      const detail = authRequired ? 'official login required (bounded probe refused)' : `bounded probe failed: ${message.slice(0, 160)}`;
      authCache = { authenticated: false, detail, at: clock() };
      return { authenticated: false, detail };
    }
  }

  function parseJsonl(stdout: string): { events: Array<{ type: string; payload: unknown }>; unparsed: number } {
    const events: Array<{ type: string; payload: unknown }> = [];
    let unparsed = 0;
    for (const rawLine of stdout.split(/\r?\n/)) {
      const line = rawLine.length > MAX_LINE_BYTES ? rawLine.slice(0, MAX_LINE_BYTES) : rawLine;
      if (line.trim().length === 0) continue;
      try {
        const parsed = JSON.parse(line) as { type?: unknown };
        if (parsed !== null && typeof parsed === 'object') events.push({ type: typeof parsed.type === 'string' ? parsed.type : 'unknown', payload: parsed });
        else unparsed += 1;
      } catch {
        unparsed += 1;
      }
    }
    return { events, unparsed };
  }

  function extractText(events: Array<{ type: string; payload: unknown }>, stdout: string): string {
    for (let index = events.length - 1; index >= 0; index -= 1) {
      const payload = events[index]!.payload as Record<string, unknown>;
      for (const key of ['text', 'content', 'message', 'final_message', 'result']) {
        if (typeof payload[key] === 'string' && (payload[key] as string).trim().length > 0) return payload[key] as string;
      }
      const data = payload.data as Record<string, unknown> | undefined;
      if (data !== undefined && typeof data.text === 'string' && data.text.trim().length > 0) return data.text;
    }
    const fallback = stdout.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0 && !line.startsWith('{'));
    return fallback.length > 0 ? fallback[fallback.length - 1]! : '';
  }

  function invokeInternal(executable: Executable, invokeOptions: { prompt: string; workspace: string; timeoutMs?: number; signal?: AbortSignal }): Promise<KimiInvokeResult> {
    const workspace = path.resolve(invokeOptions.workspace);
    const timeoutMs = Math.max(5000, Math.min(invokeOptions.timeoutMs ?? 300000, 900000));
    const boundedPrompt = invokeOptions.prompt.slice(0, MAX_PROMPT_CHARS);
    const args = [...executable.prefix, '--print', '--plan', '--output-format', 'stream-json', '-p', boundedPrompt];
    const needsShell = process.platform === 'win32' && /\.(cmd|bat)$/i.test(executable.bin);
    const startedAt = clock();
    return new Promise<KimiInvokeResult>((resolve, reject) => {
      const child = spawnFn(executable.bin, args, {
        cwd: workspace,
        windowsHide: true,
        shell: needsShell,
        env: buildEnv(),
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: process.platform !== 'win32'
      }) as ChildProcess;
      let stdout = '';
      let stderr = '';
      let settled = false;
      const finish = (fn: () => void): void => { if (!settled) { settled = true; clearTimeout(timer); fn(); } };
      const timer = setTimeout(() => {
        killTree(child);
        finish(() => reject(Object.assign(new Error(`provider kimi-code timed out after ${timeoutMs}ms`), { code: 'CHILD_FAILED' })));
      }, timeoutMs);
      const onAbort = (): void => {
        killTree(child);
        finish(() => reject(Object.assign(new Error('provider kimi-code invocation cancelled by operator'), { code: 'CHILD_FAILED' })));
      };
      if (invokeOptions.signal !== undefined) {
        if (invokeOptions.signal.aborted) { onAbort(); return; }
        invokeOptions.signal.addEventListener('abort', onAbort, { once: true });
      }
      child.stdout?.on('data', chunk => { if (stdout.length < MAX_TOTAL_BYTES) stdout += String(chunk); });
      child.stderr?.on('data', chunk => { if (stderr.length < MAX_STDERR_BYTES) stderr += String(chunk); });
      child.once('error', error => {
        finish(() => reject(Object.assign(new Error(`provider kimi-code process failure: ${error.message}`), { code: 'CHILD_FAILED' })));
      });
      child.once('close', code => {
        finish(() => {
          const combined = `${stdout}\n${stderr}`;
          if (code !== 0) {
            const authRequired = /LLM not set|AUTH_REQUIRED|login|not logged|unauthorized/i.test(combined);
            const message = authRequired
              ? 'provider kimi-code is not connected: official login required (run kimi login)'
              : `provider kimi-code exited with code ${String(code)}${stderr.trim().length > 0 ? `: ${stderr.trim().slice(0, 200)}` : ''}`;
            reject(Object.assign(new Error(message), { code: authRequired ? 'NOT_READY' : 'CHILD_FAILED' }));
            return;
          }
          const { events, unparsed } = parseJsonl(stdout);
          const text = extractText(events, stdout);
          if (text.length === 0) {
            reject(Object.assign(new Error('provider kimi-code returned an empty response (no structured result)'), { code: 'CHILD_FAILED' }));
            return;
          }
          resolve({
            provider: 'kimi-code',
            text,
            events,
            event_count: events.length,
            unparsed_lines: unparsed,
            stderr_tail: stderr.trim().slice(0, 400),
            exit_code: code,
            duration_ms: clock() - startedAt,
            binary_path: executable.bin,
            version: executable.version
          });
        });
      });
    });
  }

  async function invoke(invokeOptions: { prompt: string; workspace: string; timeoutMs?: number; signal?: AbortSignal }): Promise<KimiInvokeResult> {
    const executable = await resolveExecutable();
    if (executable === null) {
      throw Object.assign(new Error('provider kimi-code is not connected: CLI not found on PATH'), { code: 'NOT_READY' });
    }
    return invokeInternal(executable, invokeOptions);
  }

  return Object.freeze({ detect, probe, invoke, providers: ['kimi-code'] as const });
}
