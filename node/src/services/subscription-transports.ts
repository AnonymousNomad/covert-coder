// Governed subscription-CLI worker transports (Wave 7): official Codex CLI
// (ChatGPT subscription) and official Claude Code CLI (Claude subscription).
//
// HARD BOUNDARIES:
//  - Authentication is owned by the official CLI. We check artifact PRESENCE
//    only; we never read, copy, parse, or store credential material.
//  - No shell, no dangerous permission flags, workspace-contained cwd, bounded
//    env (sensitive names stripped), bounded stdout/JSONL parsing, tree-kill on
//    timeout/cancel.
//  - The CLI is a TRANSPORT. Covert owns task/context/authority/provenance.
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export type SubscriptionProviderId = 'codex-cli' | 'claude-code-cli';
export type SubscriptionStatus = 'UNAVAILABLE' | 'AUTH_REQUIRED' | 'AVAILABLE' | 'DEGRADED';

// SUBSCRIPTION LOGIN != API KEY. Readiness describes the actual executable
// path: what is authenticated, and what the client can actually do.
export type SubscriptionCapabilities = {
  authenticated: boolean;
  // analysis/read execution proven or claimed from authenticated executable
  analysis_executable: boolean;
  // workspace mutation: null = unproven (never guessed); set only from a real
  // recorded invocation outcome (sandbox denial/timeout => false; exit 0 => true)
  mutation_executable: boolean | null;
};

export type SubscriptionDetection = {
  provider: SubscriptionProviderId;
  provider_family: 'openai' | 'anthropic';
  transport: SubscriptionProviderId;
  connection_mode: 'subscription_client';
  auth_class: 'chatgpt_subscription' | 'claude_subscription';
  auth_source: 'chatgpt' | 'claude' | null;
  capabilities: SubscriptionCapabilities;
  status: SubscriptionStatus;
  binary_path: string | null;
  version: string | null;
  detail: string;
};

export type SubscriptionEvent = { type: string; payload: unknown };

export type SubscriptionInvokeResult = {
  provider: SubscriptionProviderId;
  text: string;
  events: SubscriptionEvent[];
  event_count: number;
  unparsed_lines: number;
  stderr_tail: string;
  exit_code: number | null;
  duration_ms: number;
  binary_path: string;
  version: string | null;
  sandbox: string;
};

export type SubscriptionInvokeOptions = {
  prompt: string;
  workspace: string;
  model?: string | undefined;
  timeoutMs?: number | undefined;
  signal?: AbortSignal | undefined;
  sandbox?: 'read-only' | 'workspace-write' | undefined;
};

type Executable = { bin: string; prefix: string[]; version: string | null };

export interface SubscriptionTransportOptions {
  findExecutable?: (name: 'codex' | 'claude') => Promise<string | null>;
  executableOverride?: Partial<Record<SubscriptionProviderId, Executable>> | undefined;
  authArtifactExists?: Partial<Record<SubscriptionProviderId, boolean>> | undefined;
  // Test/probe override for the recorded mutation outcome per provider.
  mutationOutcomeOverride?: Partial<Record<SubscriptionProviderId, boolean | null>> | undefined;
  homeDir?: string | undefined;
  spawnFn?: typeof spawn;
  now?: () => number;
}

const MAX_LINE_BYTES = 262144;
const MAX_TOTAL_BYTES = 8 * 1024 * 1024;
const MAX_STDERR_BYTES = 65536;
const MAX_PROMPT_CHARS = 60000;
const VERSION_PROBE_TIMEOUT_MS = 8000;
const SENSITIVE_ENV = /(_KEY|_TOKEN|_SECRET|PASSWORD|CREDENTIAL|AUTH)/i;
const ENV_KEEP = new Set(['PATH', 'Path', 'PATHEXT', 'SystemRoot', 'windir', 'COMSPEC', 'ComSpec', 'HOME', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'TEMP', 'TMP', 'TZ', 'NUMBER_OF_PROCESSORS', 'PROCESSOR_ARCHITECTURE', 'OS', 'LANG']);

function defaultFindExecutable(name: 'codex' | 'claude'): Promise<string | null> {
  const isWin = process.platform === 'win32';
  const probe = isWin ? 'where.exe' : 'which';
  // Windows: prefer spawnable launcher forms. The extensionless file on PATH is
  // a POSIX shell wrapper and cannot be spawned without a shell — never use it.
  const candidates = isWin ? [`${name}.cmd`, `${name}.exe`, `${name}.ps1`] : [name];
  return new Promise(resolve => {
    const tryNext = (index: number): void => {
      if (index >= candidates.length) return resolve(null);
      const child = spawn(probe, [candidates[index]!], { windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
      let out = '';
      child.stdout.on('data', chunk => { out += chunk; });
      child.once('error', () => resolve(null));
      child.once('close', () => {
        const first = out.split(/\r?\n/).map(line => line.trim()).find(line => line.length > 0);
        if (first && !/\.(cmd|exe|ps1)$/i.test(first) && isWin) {
          // Guard against extensionless shell wrappers slipping through.
          tryNext(index + 1);
          return;
        }
        if (first) resolve(first);
        else tryNext(index + 1);
      });
    };
    tryNext(0);
  });
}

export function createSubscriptionTransports(options: SubscriptionTransportOptions = {}) {
  const findExecutable = options.findExecutable ?? defaultFindExecutable;
  const spawnFn = options.spawnFn ?? spawn;
  const home = options.homeDir ?? os.homedir();
  const clock = options.now ?? (() => Date.now());

  const mutationOutcomes = new Map<SubscriptionProviderId, boolean>();

  const artifactPresence = (provider: SubscriptionProviderId): boolean => {
    if (provider === 'codex-cli') return fs.existsSync(path.join(home, '.codex', 'auth.json'));
    // Claude Code official login artifacts (variants across versions); presence only.
    return fs.existsSync(path.join(home, '.claude', '.credentials.json')) || fs.existsSync(path.join(home, '.claude.json'));
  };

  // Supported login-status probe: the CLI reports its own auth state (e.g.
  // `codex login status` -> "Logged in using ChatGPT"). Credential artifacts
  // are never parsed; when the supported probe is unavailable we fall back to
  // artifact PRESENCE and say so in the detail.
  function probeLoginStatus(provider: SubscriptionProviderId, executable: { bin: string; prefix: string[] }): Promise<{ authenticated: boolean; source: 'chatgpt' | 'claude' | null } | null> {
    if (provider !== 'codex-cli') return Promise.resolve(null);
    return new Promise(resolve => {
      const needsShell = process.platform === 'win32' && /\.(cmd|bat)$/i.test(executable.bin);
      const child = spawnFn(executable.bin, [...executable.prefix, 'login', 'status'], {
        windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], shell: needsShell, env: buildEnv()
      }) as ChildProcess;
      let out = '';
      let settled = false;
      const settle = (value: { authenticated: boolean; source: 'chatgpt' | 'claude' | null } | null): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      };
      const timer = setTimeout(() => { child.kill('SIGKILL'); settle(null); }, VERSION_PROBE_TIMEOUT_MS);
      child.stdout?.on('data', chunk => { out += String(chunk); });
      child.once('error', () => settle(null));
      child.once('close', () => {
        const text = out.toLowerCase();
        // Negative patterns must be checked before the generic positive one:
        // "not logged in" contains "logged in".
        if (/not logged in|not authenticated|no credentials|login required/.test(text)) return settle({ authenticated: false, source: null });
        if (/logged in using chatgpt/.test(text)) return settle({ authenticated: true, source: 'chatgpt' });
        if (/logged in/.test(text)) return settle({ authenticated: true, source: null });
        settle(null); // unrecognized (older CLI) -> presence fallback
      });
    });
  }

  function recordSandboxOutcome(provider: SubscriptionProviderId, sandbox: string, message: string | null): void {
    if (sandbox !== 'workspace-write') return;
    if (message === null) { mutationOutcomes.set(provider, true); return; }
    if (/sandbox|acl|denied|timed out|process failure/i.test(message)) mutationOutcomes.set(provider, false);
  }

  const versionCache = new Map<SubscriptionProviderId, { version: string | null; at: number }>();

  function probeVersion(provider: SubscriptionProviderId, executable: { bin: string; prefix: string[] }): Promise<string | null> {
    const cached = versionCache.get(provider);
    if (cached !== undefined && clock() - cached.at < 60000) return Promise.resolve(cached.version);
    return new Promise(resolve => {
      const needsShell = process.platform === 'win32' && /\.(cmd|bat)$/i.test(executable.bin);
      const child = spawnFn(executable.bin, [...executable.prefix, '--version'], {
        windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'], shell: needsShell,
        env: buildEnv()
      }) as ChildProcess;
      let out = '';
      const timer = setTimeout(() => { child.kill('SIGKILL'); }, VERSION_PROBE_TIMEOUT_MS);
      child.stdout?.on('data', chunk => { out += String(chunk); });
      child.once('error', () => { clearTimeout(timer); versionCache.set(provider, { version: null, at: clock() }); resolve(null); });
      child.once('close', () => {
        clearTimeout(timer);
        const line = out.split(/\r?\n/).map(value => value.trim()).find(value => value.length > 0) ?? null;
        versionCache.set(provider, { version: line, at: clock() });
        resolve(line);
      });
    });
  }

  function buildEnv(): Record<string, string> {
    const env: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (value === undefined) continue;
      if (!ENV_KEEP.has(key) && SENSITIVE_ENV.test(key)) continue;
      if (ENV_KEEP.has(key) || !SENSITIVE_ENV.test(key)) env[key] = value;
    }
    return env;
  }

  async function resolveExecutable(provider: SubscriptionProviderId): Promise<Executable | null> {
    const override = options.executableOverride?.[provider];
    if (override !== undefined) {
      const version = override.version ?? await probeVersion(provider, override);
      return { ...override, version };
    }
    const name = provider === 'codex-cli' ? 'codex' : 'claude';
    const bin = await findExecutable(name);
    if (bin === null) return null;
    const executable: Executable = { bin, prefix: [], version: null };
    executable.version = await probeVersion(provider, executable);
    return executable;
  }

  async function detect(provider: SubscriptionProviderId): Promise<SubscriptionDetection> {
    const family = provider === 'codex-cli' ? 'openai' as const : 'anthropic' as const;
    const authClass = provider === 'codex-cli' ? 'chatgpt_subscription' as const : 'claude_subscription' as const;
    const connectionMode = 'subscription_client' as const;
    const executable = await resolveExecutable(provider);
    if (executable === null) {
      return {
        provider, provider_family: family, transport: provider, connection_mode: connectionMode, auth_class: authClass,
        auth_source: null,
        capabilities: { authenticated: false, analysis_executable: false, mutation_executable: null },
        status: 'UNAVAILABLE', binary_path: null, version: null,
        detail: `${provider === 'codex-cli' ? 'codex' : 'claude'} CLI not detected on PATH`
      };
    }
    let authenticated: boolean;
    let authSource: 'chatgpt' | 'claude' | null = null;
    let authEvidence: string;
    const override = options.authArtifactExists?.[provider];
    if (override !== undefined) {
      authenticated = override;
      authEvidence = 'fixture override';
    } else {
      const probed = await probeLoginStatus(provider, executable);
      if (probed !== null) {
        authenticated = probed.authenticated;
        authSource = probed.source;
        authEvidence = 'supported login status';
      } else {
        authenticated = artifactPresence(provider);
        authEvidence = 'credential artifact presence (supported login status unavailable)';
      }
    }
    const capabilities: SubscriptionCapabilities = {
      authenticated,
      analysis_executable: authenticated && executable.version !== null,
      mutation_executable: options.mutationOutcomeOverride?.[provider] ?? mutationOutcomes.get(provider) ?? null
    };
    if (!authenticated) {
      return {
        provider, provider_family: family, transport: provider, connection_mode: connectionMode, auth_class: authClass,
        auth_source: authSource, capabilities,
        status: 'AUTH_REQUIRED', binary_path: executable.bin, version: executable.version,
        detail: `${provider === 'codex-cli' ? 'codex' : 'claude'} CLI present; official sign-in required (${authEvidence})`
      };
    }
    const status: SubscriptionStatus = executable.version === null ? 'DEGRADED' : 'AVAILABLE';
    const mutationNote = capabilities.mutation_executable === null ? 'mutation capability unproven'
      : capabilities.mutation_executable ? 'workspace mutation proven' : 'workspace mutation blocked (environment)';
    return {
      provider, provider_family: family, transport: provider, connection_mode: connectionMode, auth_class: authClass,
      auth_source: authSource, capabilities,
      status, binary_path: executable.bin, version: executable.version,
      detail: status === 'AVAILABLE'
        ? `${provider} ready (${authEvidence}; version ${executable.version}; ${mutationNote})`
        : `${provider} authenticated but its version probe failed`
    };
  }

  function killTree(child: ChildProcess): void {
    if (child.pid === undefined) return;
    if (process.platform === 'win32') {
      spawn('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
    } else {
      try { process.kill(-child.pid, 'SIGTERM'); } catch { child.kill('SIGTERM'); }
    }
  }

  function parseJsonl(stdout: string): { events: SubscriptionEvent[]; unparsed: number } {
    const events: SubscriptionEvent[] = [];
    let unparsed = 0;
    for (const rawLine of stdout.split(/\r?\n/)) {
      const line = rawLine.length > MAX_LINE_BYTES ? rawLine.slice(0, MAX_LINE_BYTES) : rawLine;
      if (line.trim().length === 0) continue;
      try {
        const parsed = JSON.parse(line) as { type?: unknown };
        if (parsed !== null && typeof parsed === 'object') {
          events.push({ type: typeof parsed.type === 'string' ? parsed.type : 'unknown', payload: parsed });
        } else {
          unparsed += 1;
        }
      } catch {
        unparsed += 1;
      }
    }
    return { events, unparsed };
  }

  function extractText(provider: SubscriptionProviderId, events: SubscriptionEvent[], stdout: string): string {
    // Defensive extraction across documented/observed event shapes; provider
    // output is untrusted transport data, never authority.
    for (let index = events.length - 1; index >= 0; index -= 1) {
      const payload = events[index]!.payload as Record<string, unknown>;
      const item = payload.item as Record<string, unknown> | undefined;
      if (item && typeof item.text === 'string' && item.type === 'agent_message') return item.text;
      if (typeof payload.message === 'string' && /agent_message|assistant|result/i.test(String(payload.type))) return payload.message;
      if (typeof payload.result === 'string') return payload.result;
      if (typeof payload.text === 'string' && /message|result|response|complete/i.test(String(payload.type))) return payload.text;
    }
    if (provider === 'claude-code-cli') {
      const trimmed = stdout.trim();
      if (trimmed.startsWith('{')) {
        try {
          const whole = JSON.parse(trimmed) as { result?: unknown };
          if (typeof whole.result === 'string') return whole.result;
        } catch { /* handled below */ }
      }
    }
    return '';
  }

  async function invoke(provider: SubscriptionProviderId, invokeOptions: SubscriptionInvokeOptions): Promise<SubscriptionInvokeResult> {
    const detection = await detect(provider);
    if (detection.status === 'UNAVAILABLE') {
      throw Object.assign(new Error(`provider ${provider} is not connected: CLI not found on PATH`), { code: 'NOT_READY' });
    }
    if (detection.status === 'AUTH_REQUIRED') {
      throw Object.assign(new Error(`provider ${provider} is not connected: official sign-in required`), { code: 'NOT_READY' });
    }
    const executable = await resolveExecutable(provider);
    if (executable === null) {
      throw Object.assign(new Error(`provider ${provider} is not connected: CLI disappeared`), { code: 'NOT_READY' });
    }
    const sandbox = invokeOptions.sandbox ?? 'workspace-write';
    const workspace = path.resolve(invokeOptions.workspace);
    const timeoutMs = Math.max(5000, Math.min(invokeOptions.timeoutMs ?? 300000, 900000));
    const boundedPrompt = invokeOptions.prompt.slice(0, MAX_PROMPT_CHARS);
    // Codex reads the prompt from stdin when the argument is '-' — the prompt
    // never transits argv (smaller quoting/leak surface). Claude Code takes it
    // via -p (its documented non-interactive form).
    const promptViaStdin = provider === 'codex-cli';
    const args = provider === 'codex-cli'
      ? [
        ...executable.prefix, 'exec', '--json', '--sandbox', sandbox, '--cd', workspace,
        '--skip-git-repo-check', '--color', 'never',
        ...(invokeOptions.model !== undefined ? ['-m', invokeOptions.model] : []),
        '-'
      ]
      : [
        ...executable.prefix, '-p', boundedPrompt,
        '--output-format', 'json'
      ];
    // Windows launcher shims (.cmd/.bat) require a shell; the binary path is
    // resolved and fixed, args are passed as an array (Node escaping), never as
    // a constructed command string. Direct executables stay shell-less.
    const needsShell = process.platform === 'win32' && /\.(cmd|bat)$/i.test(executable.bin);
    const startedAt = clock();
    return await new Promise<SubscriptionInvokeResult>((resolve, reject) => {
      const child = spawnFn(executable.bin, args, {
        cwd: workspace,
        windowsHide: true,
        shell: needsShell,
        env: buildEnv(),
        stdio: [promptViaStdin ? 'pipe' : 'ignore', 'pipe', 'pipe'],
        detached: process.platform !== 'win32'
      }) as ChildProcess;
      if (promptViaStdin) {
        child.stdin?.on('error', () => undefined);
        child.stdin?.end(boundedPrompt, 'utf8');
      }
      let stdout = '';
      let stderr = '';
      let settled = false;
      const finish = (fn: () => void): void => { if (!settled) { settled = true; clearTimeout(timer); fn(); } };
      const timer = setTimeout(() => {
        killTree(child);
        recordSandboxOutcome(provider, sandbox, `timed out after ${timeoutMs}ms`);
        finish(() => reject(Object.assign(new Error(`provider ${provider} timed out after ${timeoutMs}ms`), { code: 'CHILD_FAILED' })));
      }, timeoutMs);
      const onAbort = (): void => {
        killTree(child);
        finish(() => reject(Object.assign(new Error(`provider ${provider} invocation cancelled by operator`), { code: 'CHILD_FAILED' })));
      };
      if (invokeOptions.signal !== undefined) {
        if (invokeOptions.signal.aborted) { onAbort(); return; }
        invokeOptions.signal.addEventListener('abort', onAbort, { once: true });
      }
      child.stdout?.on('data', chunk => {
        if (stdout.length < MAX_TOTAL_BYTES) stdout += String(chunk);
      });
      child.stderr?.on('data', chunk => {
        if (stderr.length < MAX_STDERR_BYTES) stderr += String(chunk);
      });
      child.once('error', error => {
        recordSandboxOutcome(provider, sandbox, `process failure: ${error.message}`);
        finish(() => reject(Object.assign(new Error(`provider ${provider} process failure: ${error.message}`), { code: 'CHILD_FAILED' })));
      });
      child.once('close', code => {
        finish(() => {
          if (code !== 0) {
            recordSandboxOutcome(provider, sandbox, `exited with code ${String(code)}${stderr.trim().length > 0 ? `: ${stderr.trim().slice(0, 200)}` : ''}`);
            reject(Object.assign(new Error(`provider ${provider} exited with code ${String(code)}${stderr.trim().length > 0 ? `: ${stderr.trim().slice(0, 200)}` : ''}`), { code: 'CHILD_FAILED' }));
            return;
          }
          const { events, unparsed } = parseJsonl(stdout);
          const text = extractText(provider, events, stdout);
          if (text.length === 0) {
            reject(Object.assign(new Error(`provider ${provider} returned an empty response (no structured result)`), { code: 'CHILD_FAILED' }));
            return;
          }
          recordSandboxOutcome(provider, sandbox, null);
          resolve({
            provider,
            text,
            events,
            event_count: events.length,
            unparsed_lines: unparsed,
            stderr_tail: stderr.trim().slice(0, 400),
            exit_code: code,
            duration_ms: clock() - startedAt,
            binary_path: executable.bin,
            version: detection.version,
            sandbox
          });
        });
      });
    });
  }

  return Object.freeze({ detect, invoke, providers: ['codex-cli', 'claude-code-cli'] as const });
}
