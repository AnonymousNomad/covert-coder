import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import type { FileHandle } from 'node:fs/promises';

export type AtomicJsonPhase =
  | 'serialize'
  | 'validate'
  | 'create-temp'
  | 'write-temp'
  | 'flush-temp'
  | 'close-temp'
  | 'verify-temp'
  | 'replace';

export class AtomicJsonWriteError extends Error {
  readonly phase: AtomicJsonPhase;
  readonly osCode?: string;

  constructor(phase: AtomicJsonPhase, osCode?: string) {
    super(`atomic JSON write failed during ${phase}`);
    this.name = 'AtomicJsonWriteError';
    this.phase = phase;
    if (osCode !== undefined) this.osCode = osCode;
  }
}

export type PersistedStateKind = 'session' | 'chat-history';
export type PersistedStateFailure = 'CORRUPT_STATE' | 'UNSUPPORTED_SCHEMA' | 'READ_FAILED' | 'WRITE_FAILED';

export class StatePersistenceError extends Error {
  readonly state: PersistedStateKind;
  readonly reason: PersistedStateFailure;
  readonly operation: 'read' | 'write';
  readonly phase: string;
  readonly osCode?: string;

  constructor(
    state: PersistedStateKind,
    reason: PersistedStateFailure,
    operation: 'read' | 'write',
    phase: string,
    osCode?: string
  ) {
    super(`${state} state ${reason.toLowerCase().replaceAll('_', ' ')} during ${operation}`);
    this.name = 'StatePersistenceError';
    this.state = state;
    this.reason = reason;
    this.operation = operation;
    this.phase = phase;
    if (osCode !== undefined) this.osCode = osCode;
  }
}

/**
 * A read of a missing child path can also report ENOENT when an ancestor is a
 * file on Windows. Call this before treating ENOENT as a valid first-run file.
 */
export async function assertMissingStateLocationIsUsable(
  target: string,
  workspace: string,
  state: PersistedStateKind
): Promise<void> {
  const directory = path.dirname(target);
  let parent;
  try {
    parent = await fs.stat(directory);
  } catch (error) {
    const code = errorCode(error);
    if (code !== 'ENOENT') throw new StatePersistenceError(state, 'READ_FAILED', 'read', 'inspect-state-directory', code);
    try {
      const root = await fs.stat(workspace);
      if (!root.isDirectory()) throw new StatePersistenceError(state, 'READ_FAILED', 'read', 'inspect-workspace', 'ENOTDIR');
      return;
    } catch (workspaceError) {
      if (workspaceError instanceof StatePersistenceError) throw workspaceError;
      throw new StatePersistenceError(state, 'READ_FAILED', 'read', 'inspect-workspace', errorCode(workspaceError));
    }
  }
  if (!parent.isDirectory()) throw new StatePersistenceError(state, 'READ_FAILED', 'read', 'inspect-state-directory', 'ENOTDIR');
}

export interface AtomicJsonTestHooks {
  beforePhase?: (phase: AtomicJsonPhase) => void | Promise<void>;
  writeTemp?: (handle: FileHandle, bytes: string) => void | Promise<void>;
  afterReplace?: () => void | Promise<void>;
}

export interface AtomicJsonWriteOptions {
  validate?: (value: unknown) => void;
  /** Deterministic fault/crash injection used only by isolated tests. */
  testHooks?: AtomicJsonTestHooks;
}

const mutationTails = new Map<string, Promise<void>>();
const STALE_TEMP_AGE_MS = 24 * 60 * 60 * 1000;

function pathKey(target: string): string {
  const resolved = path.resolve(target);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

/**
 * Serializes a complete read/modify/write transaction for one canonical path
 * within the single supervised Node service process.
 */
export async function withFileMutationLock<T>(target: string, operation: () => Promise<T>): Promise<T> {
  const key = pathKey(target);
  const previous = mutationTails.get(key) ?? Promise.resolve();
  let release!: () => void;
  const turn = new Promise<void>(resolve => { release = resolve; });
  const tail = previous.then(() => turn);
  mutationTails.set(key, tail);
  await previous;
  try {
    return await operation();
  } finally {
    release();
    if (mutationTails.get(key) === tail) mutationTails.delete(key);
  }
}

function errorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' && /^[A-Z0-9_]{1,32}$/.test(code) ? code : undefined;
}

function tempNamePattern(target: string): RegExp {
  const base = path.basename(target).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^\\.${base}\\.tmp-aide-\\d+-[0-9a-f-]{36}$`, 'i');
}

async function cleanupStaleTemps(target: string): Promise<void> {
  const directory = path.dirname(target);
  let entries;
  try {
    entries = await fs.readdir(directory, { withFileTypes: true });
  } catch {
    return;
  }
  const pattern = tempNamePattern(target);
  const cutoff = Date.now() - STALE_TEMP_AGE_MS;
  for (const entry of entries) {
    if (!entry.isFile() || !pattern.test(entry.name)) continue;
    const candidate = path.join(directory, entry.name);
    try {
      const stat = await fs.stat(candidate);
      if (stat.mtimeMs < cutoff) await fs.unlink(candidate);
    } catch {
      // Cleanup is best-effort after a successful canonical commit.
    }
  }
}

/**
 * Writes a validated JSON representation to a unique same-directory temp,
 * flushes and closes it, re-reads it, then replaces the canonical path.
 * This guarantees application-level old-or-new replacement on the supported
 * same-filesystem rename boundary; it does not promise power-loss durability.
 */
export async function atomicWriteJson(target: string, value: unknown, options: AtomicJsonWriteOptions = {}): Promise<void> {
  let phase: AtomicJsonPhase = 'serialize';
  let temporary: string | undefined;
  let handle: FileHandle | undefined;
  try {
    await options.testHooks?.beforePhase?.(phase);
    const serialized = JSON.stringify(value, null, 2);
    if (serialized === undefined) throw new TypeError('value is not JSON serializable');
    const bytes = `${serialized}\n`;

    phase = 'validate';
    await options.testHooks?.beforePhase?.(phase);
    options.validate?.(JSON.parse(bytes) as unknown);

    const directory = path.dirname(target);
    phase = 'create-temp';
    await options.testHooks?.beforePhase?.(phase);
    await fs.mkdir(directory, { recursive: true });
    temporary = path.join(directory, `.${path.basename(target)}.tmp-aide-${process.pid}-${randomUUID()}`);
    handle = await fs.open(temporary, 'wx', 0o600);

    phase = 'write-temp';
    await options.testHooks?.beforePhase?.(phase);
    if (options.testHooks?.writeTemp !== undefined) await options.testHooks.writeTemp(handle, bytes);
    else await handle.writeFile(bytes, 'utf8');

    phase = 'flush-temp';
    await options.testHooks?.beforePhase?.(phase);
    await handle.sync();
    phase = 'close-temp';
    await options.testHooks?.beforePhase?.(phase);
    await handle.close();
    handle = undefined;

    phase = 'verify-temp';
    await options.testHooks?.beforePhase?.(phase);
    const written = await fs.readFile(temporary, 'utf8');
    if (written !== bytes) throw new Error('temporary representation changed');
    options.validate?.(JSON.parse(written) as unknown);

    phase = 'replace';
    await options.testHooks?.beforePhase?.(phase);
    await fs.rename(temporary, target);
    temporary = undefined;
    await options.testHooks?.afterReplace?.();
    await cleanupStaleTemps(target);
  } catch (error) {
    if (handle !== undefined) await handle.close().catch(() => {});
    if (temporary !== undefined) await fs.rm(temporary, { force: true }).catch(() => {});
    if (error instanceof AtomicJsonWriteError) throw error;
    throw new AtomicJsonWriteError(phase, errorCode(error));
  }
}
