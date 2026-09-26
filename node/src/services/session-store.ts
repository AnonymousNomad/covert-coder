import path from 'node:path';
import { promises as fs } from 'node:fs';
import { SessionFile, SessionPutRequest, type SessionFileT, type SessionPutRequestT } from '../../../common/contracts/session.ts';
import { assertMissingStateLocationIsUsable, atomicWriteJson, AtomicJsonWriteError, StatePersistenceError, withFileMutationLock } from './atomic-json.ts';

const SESSION_FILE = 'session.json';

const BUFFER_MAX = 524288;

function toUri(relative: string): string {
  return `file:///${relative.replace(/\\/g, '/')}`;
}

// Preserves the legacy key set the original editor wrote (active_file,
// open_files, buffers, panel, selected_engine_id) so nothing a first-AIDE
// user saved is dropped on migration. Legacy-only extras (mode, updated_at)
// are intentionally discarded.
function migrateLegacy(raw: unknown): SessionFileT | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const legacy = raw as Record<string, unknown>;
  const open = legacy.open_files;
  if (!Array.isArray(open)) return null;
  const tabs = open
    .filter((entry): entry is string => typeof entry === 'string' && entry.length > 0)
    .map(uri => ({ uri: toUri(uri) }));
  const active = typeof legacy.active_file === 'string' && legacy.active_file.length > 0 ? legacy.active_file : undefined;
  const migrated: SessionFileT = {
    version: 1,
    tabs,
    ...(active !== undefined ? { activeTab: toUri(active) } : {})
  };
  if (active !== undefined) migrated.active_file = active;
  if (open.every((entry): entry is string => typeof entry === 'string' && entry.length > 0)) migrated.open_files = open;
  if (typeof legacy.panel === 'string' && legacy.panel.length <= 100) migrated.panel = legacy.panel;
  if (typeof legacy.selected_engine_id === 'string' && legacy.selected_engine_id.length > 0 && legacy.selected_engine_id.length <= 200) migrated.selected_engine_id = legacy.selected_engine_id;
  if (legacy.buffers !== null && typeof legacy.buffers === 'object' && !Array.isArray(legacy.buffers)) {
    const buffers: Record<string, string> = {};
    for (const [key, value] of Object.entries(legacy.buffers as Record<string, unknown>)) {
      if (key.length > 0 && key.length <= 1024 && typeof value === 'string' && value.length <= BUFFER_MAX) buffers[key] = value;
    }
    migrated.buffers = buffers;
  }
  const parsed = SessionFile.safeParse(migrated);
  return parsed.success ? parsed.data : null;
}

function withoutUndefined<T extends object>(input: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) out[key] = value;
  }
  return out;
}

export class SessionStore {
  private readonly workspace: string;
  readonly file: string;
  private readonly atomicWriter: typeof atomicWriteJson;

  constructor(workspace: string, dataDir = '.aide', atomicWriter: typeof atomicWriteJson = atomicWriteJson) {
    this.workspace = workspace;
    this.file = path.join(workspace, dataDir, SESSION_FILE);
    this.atomicWriter = atomicWriter;
  }

  async load(): Promise<SessionFileT> {
    return withFileMutationLock(this.file, () => this.loadUnlocked());
  }

  private async loadUnlocked(): Promise<SessionFileT> {
    let raw: string;
    try {
      raw = await fs.readFile(this.file, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        await assertMissingStateLocationIsUsable(this.file, this.workspace, 'session');
        return { version: 1, tabs: [] };
      }
      throw new StatePersistenceError('session', 'READ_FAILED', 'read', 'read-canonical', (error as NodeJS.ErrnoException).code);
    }
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      throw new StatePersistenceError('session', 'CORRUPT_STATE', 'read', 'parse-canonical');
    }
    const parsed = SessionFile.safeParse(json);
    if (parsed.success) return parsed.data;

    const record = typeof json === 'object' && json !== null && !Array.isArray(json)
      ? json as Record<string, unknown>
      : null;
    if (record !== null && Object.hasOwn(record, 'version') && record.version !== 1) {
      throw new StatePersistenceError('session', 'UNSUPPORTED_SCHEMA', 'read', 'validate-canonical');
    }
    if (record !== null && !Object.hasOwn(record, 'version')) {
      const migrated = migrateLegacy(json);
      if (migrated !== null) {
        await this.persist(migrated);
        return migrated;
      }
    }
    throw new StatePersistenceError('session', 'CORRUPT_STATE', 'read', 'validate-canonical');
  }

  async save(input: SessionPutRequestT): Promise<SessionFileT> {
    const parsedRequest = SessionPutRequest.safeParse(input);
    if (!parsedRequest.success) throw new Error('invalid session');
    return withFileMutationLock(this.file, async () => {
      const current = await this.loadUnlocked();
      const merged = { ...current, ...withoutUndefined(parsedRequest.data) };
      const parsed = SessionFile.safeParse(merged);
      if (!parsed.success) throw new Error('invalid session');
      await this.persist(parsed.data);
      return parsed.data;
    });
  }

  private async persist(session: SessionFileT): Promise<void> {
    try {
      await this.atomicWriter(this.file, session, {
        validate: value => { SessionFile.parse(value); }
      });
    } catch (error) {
      if (error instanceof AtomicJsonWriteError) {
        throw new StatePersistenceError('session', 'WRITE_FAILED', 'write', error.phase, error.osCode);
      }
      throw error;
    }
  }
}
