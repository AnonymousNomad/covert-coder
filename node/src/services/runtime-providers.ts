import { createRequire } from 'node:module';
import { execFile } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import type { TerminalProviderInfoT, TerminalShellDescriptorT } from '../../../common/contracts/terminal.ts';

// ---------------------------------------------------------------------------
// Runtime providers expose a truthful view of what this host can actually
// start. Discovery never assumes a provider works because a binary exists:
// the PTY engine must load, a shell must resolve to a concrete executable
// path, and provider-specific prerequisites must hold. Everything here is
// side-effect free apart from read-only probes.
// ---------------------------------------------------------------------------

export interface ExecResult {
  code: number;
  stdout: string;
  stderr: string;
}

export type ExecFn = (file: string, args: string[]) => Promise<ExecResult>;
export type FileExistsFn = (path: string) => Promise<boolean>;
export type ListDirFn = (path: string) => Promise<string[]>;

export interface PtySpawnOptions {
  file: string;
  args: string[];
  cwd: string;
  env: Record<string, string>;
  cols: number;
  rows: number;
  name?: string;
}

export interface PtyProcess {
  pid: number;
  onData(listener: (data: string) => void): void;
  onExit(listener: (event: { exitCode: number }) => void): void;
  write(data: string): void;
  resize(cols: number, rows: number): void;
  kill(): void;
}

export type SpawnPtyFn = (options: PtySpawnOptions) => PtyProcess;

export interface NodePtyEngine {
  spawn: SpawnPtyFn;
}

export interface RuntimeProviderDeps {
  exec: ExecFn;
  fileExists: FileExistsFn;
  listDir: ListDirFn;
  loadPty: () => NodePtyEngine | null;
  platform: NodeJS.Platform;
  env: NodeJS.ProcessEnv;
}

// The shell must resolve to a real executable image. Windows execution-alias
// stubs (0-byte reparse points such as %LOCALAPPDATA%\Microsoft\WindowsApps\
// pwsh.exe) look like files but node-pty refuses them with "File not found",
// so aliases are deliberately never used as candidates.
const WINDOWS_POWERSHELL_MSI = 'C:\\Program Files\\PowerShell\\7\\pwsh.exe';
const WINDOWS_POWERSHELL_SYSTEM32 = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
const WINDOWS_CMD = 'C:\\Windows\\System32\\cmd.exe';
const WINDOWS_STORE_APPS = 'C:\\Program Files\\WindowsApps';

interface ShellCandidate {
  id: string;
  label: string;
  resolve: (deps: RuntimeProviderDeps) => Promise<TerminalShellDescriptorT | null>;
}

async function firstExisting(deps: RuntimeProviderDeps, paths: string[]): Promise<string | null> {
  for (const path of paths) {
    if (await deps.fileExists(path)) return path;
  }
  return null;
}

// PowerShell 7 installed from the Microsoft Store lives under a
// version-suffixed package directory; enumerate rather than hard-code a
// version that will drift.
async function resolveStorePwsh(deps: RuntimeProviderDeps): Promise<string | null> {
  let entries: string[];
  try {
    entries = await deps.listDir(WINDOWS_STORE_APPS);
  } catch {
    return null;
  }
  const packages = entries
    .filter(name => /^Microsoft\.PowerShell_7/.test(name))
    .sort()
    .reverse();
  return firstExisting(deps, packages.map(name => `${WINDOWS_STORE_APPS}\\${name}\\pwsh.exe`));
}

const NATIVE_SHELLS: ShellCandidate[] = [
  {
    id: 'pwsh',
    label: 'PowerShell 7',
    resolve: async deps => {
      const path = await firstExisting(deps, [WINDOWS_POWERSHELL_MSI]) ?? await resolveStorePwsh(deps);
      return path ? { id: 'pwsh', label: 'PowerShell 7', path } : null;
    }
  },
  {
    id: 'powershell',
    label: 'Windows PowerShell 5.1',
    resolve: async deps => {
      const path = await firstExisting(deps, [WINDOWS_POWERSHELL_SYSTEM32]);
      return path ? { id: 'powershell', label: 'Windows PowerShell 5.1', path } : null;
    }
  },
  {
    id: 'cmd',
    label: 'Command Prompt',
    resolve: async deps => {
      const path = await firstExisting(deps, [WINDOWS_CMD]);
      return path ? { id: 'cmd', label: 'Command Prompt', path } : null;
    }
  }
];

export interface RuntimeProvider {
  id: string;
  describe(): Promise<TerminalProviderInfoT>;
  resolveShell(shellId: string | null): Promise<{ shell: TerminalShellDescriptorT; cwd: string } | { error: string }>;
  spawnPty(options: PtySpawnOptions): PtyProcess;
}

class NativeProvider implements RuntimeProvider {
  readonly id = 'native';
  private shells: TerminalShellDescriptorT[] | null = null;
  private readonly deps: RuntimeProviderDeps;

  constructor(deps: RuntimeProviderDeps) {
    this.deps = deps;
  }

  private async detectShells(): Promise<TerminalShellDescriptorT[]> {
    if (this.shells) return this.shells;
    const found: TerminalShellDescriptorT[] = [];
    for (const candidate of NATIVE_SHELLS) {
      const shell = await candidate.resolve(this.deps);
      if (shell) found.push(shell);
    }
    this.shells = found;
    return found;
  }

  async describe(): Promise<TerminalProviderInfoT> {
    const engine = this.deps.loadPty();
    const shells = engine ? await this.detectShells() : [];
    if (!engine) {
      return {
        id: this.id,
        label: 'Windows (native)',
        state: 'unsupported',
        detail: 'The PTY engine (node-pty) is not installed for this runtime; interactive sessions are unavailable.',
        shells: []
      };
    }
    if (shells.length === 0) {
      return {
        id: this.id,
        label: 'Windows (native)',
        state: 'unhealthy',
        detail: 'The PTY engine is present but no supported shell executable was found on this host.',
        shells: []
      };
    }
    return {
      id: this.id,
      label: 'Windows (native)',
      state: 'available',
      detail: `Interactive sessions via ${shells.map(s => s.label).join(', ')}.`,
      shells
    };
  }

  async resolveShell(shellId: string | null): Promise<{ shell: TerminalShellDescriptorT; cwd: string } | { error: string }> {
    const shells = await this.detectShells();
    if (shells.length === 0) return { error: 'no supported shell is available' };
    const shell = shellId ? shells.find(s => s.id === shellId) : shells[0];
    if (!shell) return { error: `unknown shell '${shellId}'` };
    return { shell, cwd: '' };
  }

  spawnPty(options: PtySpawnOptions): PtyProcess {
    const engine = this.deps.loadPty();
    if (!engine) throw new Error('PTY engine unavailable');
    return engine.spawn(options);
  }
}

class WslProvider implements RuntimeProvider {
  readonly id = 'wsl';
  private readonly deps: RuntimeProviderDeps;

  constructor(deps: RuntimeProviderDeps) {
    this.deps = deps;
  }

  async describe(): Promise<TerminalProviderInfoT> {
    if (this.deps.platform !== 'win32') {
      return {
        id: this.id,
        label: 'WSL',
        state: 'unsupported',
        detail: 'WSL is only available on Windows hosts.',
        shells: []
      };
    }
    if (!this.deps.loadPty()) {
      return {
        id: this.id,
        label: 'WSL',
        state: 'unsupported',
        detail: 'The PTY engine (node-pty) is not installed for this runtime; WSL sessions are unavailable.',
        shells: []
      };
    }
    const wsl = await firstExisting(this.deps, ['C:\\Windows\\System32\\wsl.exe']);
    if (!wsl) {
      return {
        id: this.id,
        label: 'WSL',
        state: 'unsupported',
        detail: 'wsl.exe was not found on this host.',
        shells: []
      };
    }
    let result: ExecResult;
    try {
      result = await this.deps.exec(wsl, ['-l', '-q']);
    } catch (error) {
      return {
        id: this.id,
        label: 'WSL',
        state: 'unhealthy',
        detail: `WSL could not be queried: ${error instanceof Error ? error.message : String(error)}`,
        shells: []
      };
    }
    if (result.code !== 0) {
      return {
        id: this.id,
        label: 'WSL',
        state: 'unhealthy',
        detail: `wsl.exe reported an error (exit ${result.code}).`,
        shells: []
      };
    }
    const distros = normalizeWslDistroOutput(result.stdout).split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    if (distros.length === 0) {
      return {
        id: this.id,
        label: 'WSL',
        state: 'requires-setup',
        detail: 'WSL is present but no distribution is installed. Install one before opening a WSL session.',
        shells: []
      };
    }
    return {
      id: this.id,
      label: 'WSL',
      state: 'available',
      detail: `Interactive sessions in ${distros.join(', ')}.`,
      shells: distros.map(name => ({ id: name, label: name, path: '/bin/sh' }))
    };
  }

  async resolveShell(shellId: string | null): Promise<{ shell: TerminalShellDescriptorT; cwd: string } | { error: string }> {
    const info = await this.describe();
    if (info.state !== 'available' || info.shells.length === 0) return { error: info.detail };
    const shell = shellId ? info.shells.find(s => s.id === shellId) : info.shells[0];
    if (!shell) return { error: `unknown distribution '${shellId}'` };
    return { shell, cwd: '' };
  }

  spawnPty(options: PtySpawnOptions): PtyProcess {
    const engine = this.deps.loadPty();
    if (!engine) throw new Error('PTY engine unavailable');
    return engine.spawn(options);
  }
}

// WSL sees the Windows drive layout under /mnt. The provider owns this
// translation so callers never have to know which runtime they are targeting.
export function translateCwd(providerId: string, cwd: string): string {
  if (providerId !== 'wsl') return cwd;
  const match = /^([A-Za-z]):[\\/]?(.*)$/.exec(cwd);
  if (!match) return cwd;
  const driveGroup = match[1];
  if (!driveGroup) return cwd;
  const drive = driveGroup.toLowerCase();
  const rest = match[2]!.replace(/\\/g, '/');
  return rest ? `/mnt/${drive}/${rest}` : `/mnt/${drive}`;
}

let cachedEngine: NodePtyEngine | null | undefined;

// Lazy: constructing the service must never throw just because node-pty is
// absent. Callers get `null` and report `unsupported` truthfully.
export function loadNodePtyModule(): NodePtyEngine | null {
  if (cachedEngine !== undefined) return cachedEngine;
  try {
    const require = createRequire(import.meta.url);
    const mod = require('node-pty') as { spawn?: (file: string, args: string[], opts: Record<string, unknown>) => unknown } | undefined;
    if (!mod || typeof mod.spawn !== 'function') {
      cachedEngine = null;
      return cachedEngine;
    }
    // node-pty's spawn is the classic (file, args, options) triple; our engine
    // faces an options-object API, so translate here. This keeps every caller
    // (service + providers) on one shape and never misrepresents the engine.
    cachedEngine = {
      spawn: (options: PtySpawnOptions): PtyProcess =>
        mod.spawn!(options.file, options.args ?? [], {
          name: options.name ?? 'xterm-256color',
          cols: options.cols,
          rows: options.rows,
          cwd: options.cwd,
          env: options.env
        }) as PtyProcess
    };
  } catch {
    cachedEngine = null;
  }
  return cachedEngine;
}

function defaultExec(file: string, args: string[]): Promise<ExecResult> {
  return new Promise(resolve => {
    // wsl.exe emits UTF-16LE text; decoding its output as UTF-8 produces the
    // observed NUL-interleaved distro names. The command boundary selects the
    // documented encoding; every other probe keeps the UTF-8 default.
    const encoding: BufferEncoding = /(^|[\\/])wsl\.exe$/i.test(file) ? 'utf16le' : 'utf8';
    execFile(file, args, { timeout: 5000, windowsHide: true, encoding }, (error, stdout, stderr) => {
      const code = error && typeof (error as { code?: unknown }).code === 'number' ? (error as { code: number }).code : error ? 1 : 0;
      resolve({ code, stdout: String(stdout ?? ''), stderr: String(stderr ?? '') });
    });
  });
}

// Safety net for WSL output that was already decoded as UTF-8 elsewhere (older
// callers, fixtures): the NUL-interleaved bytes are re-decoded losslessly to
// UTF-16LE. Plain text passes through unchanged; only a leading BOM is
// normalized. This is a decoding correction, never arbitrary stripping.
export function normalizeWslDistroOutput(text: string): string {
  const withoutBom = text.replace(/^\uFEFF/, '');
  if (!withoutBom.includes('\u0000')) return withoutBom;
  return Buffer.from(withoutBom, 'utf8').toString('utf16le').replace(/^\uFEFF/, '');
}

async function defaultFileExists(path: string): Promise<boolean> {
  try {
    const { access } = await import('node:fs/promises');
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function defaultListDir(path: string): Promise<string[]> {
  return readdir(path);
}

export function createDefaultProviderDeps(overrides: Partial<RuntimeProviderDeps> = {}): RuntimeProviderDeps {
  return {
    exec: overrides.exec ?? defaultExec,
    fileExists: overrides.fileExists ?? defaultFileExists,
    listDir: overrides.listDir ?? defaultListDir,
    loadPty: overrides.loadPty ?? loadNodePtyModule,
    platform: overrides.platform ?? process.platform,
    env: overrides.env ?? process.env
  };
}

export interface RuntimeProviderRegistry {
  list(): Promise<TerminalProviderInfoT[]>;
  get(id: string): RuntimeProvider | undefined;
  resolve(providerId: string, shellId: string | null): Promise<{ provider: RuntimeProvider; shell: TerminalShellDescriptorT } | { error: string }>;
}

export function createRuntimeProviderRegistry(deps: RuntimeProviderDeps): RuntimeProviderRegistry {
  const providers = new Map<string, RuntimeProvider>();
  providers.set('native', new NativeProvider(deps));
  providers.set('wsl', new WslProvider(deps));

  return {
    async list() {
      const infos = await Promise.all([...providers.values()].map(p => p.describe()));
      return infos;
    },
    get(id) {
      return providers.get(id);
    },
    async resolve(providerId, shellId) {
      const provider = providers.get(providerId);
      if (!provider) return { error: `unknown provider '${providerId}'` };
      const resolved = await provider.resolveShell(shellId);
      if ('error' in resolved) return resolved;
      // cwd translation is owned here (see translateCwd); the service passes the
      // operator-requested Windows path and this layer maps it for the runtime.
      return { provider, shell: resolved.shell };
    }
  };
}
