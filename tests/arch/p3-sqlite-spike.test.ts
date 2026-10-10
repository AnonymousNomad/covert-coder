import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { DatabaseSync } from 'node:sqlite';

// P3 storage spike — node:sqlite under private Covert state. Bounded
// architectural spike (NOT a migration of any subsystem, NOT a production
// qualification). Proves durability primitives the P3 owners require:
// schema identity, exact retrieve after close/reopen (incl. cross-process),
// revision semantics, duplicate refusal, malformed refusal at the app edge,
// transaction rollback, revocation persistence, private-path containment,
// bounded payloads, and secret-free diagnostics.

const execFileAsync = promisify(execFile);
const CANARY = 'CANARY_SPIKE_9f3a_not_a_secret';

interface EnvelopeInput {
  envelope_id: string;
  resident_id: string;
  project_id: string | null;
  payload: unknown;
}
interface EnvelopeRecord {
  envelope_id: string;
  resident_id: string;
  project_id: string | null;
  payload: unknown;
  revision: number;
  state: string;
}
type ReadEnvelopeResult =
  | { ok: true; record: EnvelopeRecord }
  | { ok: false; reason: 'ABSENT' | 'MALFORMED' };

async function privateDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'covert-p3-spike-'));
}
async function cleanup(dir: string): Promise<void> {
  // Windows may briefly hold the sqlite file handle after close; bounded
  // retry is the documented Windows temp-tree cleanup pattern.
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try { await fs.rm(dir, { recursive: true, force: true }); return; }
    catch (error) {
      if (attempt === 7) throw error;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
}
function openPrivateDb(dir: string, name: string): { dbPath: string; db: DatabaseSync } {
  if (!/^[a-z0-9-]+\.db$/.test(name)) throw new Error('unsafe database name');
  const dbPath = path.resolve(dir, name);
  if (!dbPath.startsWith(path.resolve(dir) + path.sep)) throw new Error('database path escaped private state');
  return { dbPath, db: new DatabaseSync(dbPath) };
}
function migrate(db: DatabaseSync): void {
  db.exec('PRAGMA journal_mode=DELETE;');
  db.exec('CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL);');
  const row = db.prepare('SELECT version FROM schema_version LIMIT 1').get();
  if (row === undefined) db.exec('INSERT INTO schema_version (version) VALUES (1);');
  db.exec(`CREATE TABLE IF NOT EXISTS envelopes (
    envelope_id TEXT PRIMARY KEY,
    resident_id TEXT NOT NULL,
    project_id TEXT,
    payload TEXT NOT NULL,
    revision INTEGER NOT NULL DEFAULT 1,
    state TEXT NOT NULL,
    created_utc TEXT NOT NULL
  );`);
}
const MAX_PAYLOAD = 64 * 1024;
function insertEnvelope(db: DatabaseSync, envelope: EnvelopeInput): void {
  const serialized = JSON.stringify(envelope.payload);
  if (Buffer.byteLength(serialized) > MAX_PAYLOAD) throw new Error('payload exceeds bounded size');
  db.prepare('INSERT INTO envelopes (envelope_id, resident_id, project_id, payload, revision, state, created_utc) VALUES (?, ?, ?, ?, 1, ?, ?)')
    .run(envelope.envelope_id, envelope.resident_id, envelope.project_id ?? null, serialized, 'RECEIVED', new Date().toISOString());
}
function readEnvelope(db: DatabaseSync, envelopeId: string): ReadEnvelopeResult {
  const row = db.prepare('SELECT envelope_id, resident_id, project_id, payload, revision, state FROM envelopes WHERE envelope_id = ?').get(envelopeId);
  if (row === undefined) return { ok: false, reason: 'ABSENT' };
  try {
    const payload = JSON.parse(String(row.payload));
    return { ok: true, record: { envelope_id: String(row.envelope_id), resident_id: String(row.resident_id), project_id: row.project_id === null ? null : String(row.project_id), payload, revision: Number(row.revision), state: String(row.state) } };
  } catch {
    return { ok: false, reason: 'MALFORMED' };
  }
}

test('spike: create/open with explicit schema version identity', async () => {
  const dir = await privateDir();
  try {
    const { db } = openPrivateDb(dir, 'covert-p3-spike.db');
    migrate(db);
    assert.equal(Number(db.prepare('SELECT version FROM schema_version').get()?.version), 1);
    db.close();
  } finally {
    try { await cleanup(dir); } catch { /* temp-dir cleanup is best-effort in the spike */ }
  }
});

test('spike: insert, close, reopen, retrieve exact record (same process)', async () => {
  const dir = await privateDir();
  try {
    const first = openPrivateDb(dir, 'covert-p3-spike.db');
    migrate(first.db);
    insertEnvelope(first.db, { envelope_id: 'env-1', resident_id: 'cipher', project_id: null, payload: { kind: 'objective', text: 'build site' } });
    first.db.close();
    const second = openPrivateDb(dir, 'covert-p3-spike.db');
    try {
      const read = readEnvelope(second.db, 'env-1');
      assert.ok(read.ok);
      assert.deepEqual(read.record.payload, { kind: 'objective', text: 'build site' });
      assert.equal(read.record.state, 'RECEIVED');
    } finally { second.db.close(); }
  } finally {
    try { await cleanup(dir); } catch { /* temp-dir cleanup is best-effort in the spike */ }
  }
});

test('spike: cross-process reopen retrieves the exact record', async () => {
  const dir = await privateDir();
  try {
    const { db } = openPrivateDb(dir, 'covert-p3-spike.db');
    migrate(db);
    insertEnvelope(db, { envelope_id: 'env-x', resident_id: 'cipher', project_id: null, payload: { n: 7 } });
    db.close();
    const child = await execFileAsync(process.execPath, ['-e',
      `const { DatabaseSync } = require('node:sqlite'); const db = new DatabaseSync(${JSON.stringify(path.join(dir, 'covert-p3-spike.db'))}); const row = db.prepare('SELECT envelope_id, payload FROM envelopes').get(); console.log(JSON.stringify(row)); db.close();`
    ]);
    const parsed = JSON.parse(child.stdout.trim());
    assert.equal(parsed.envelope_id, 'env-x');
    assert.deepEqual(JSON.parse(parsed.payload), { n: 7 });
  } finally {
    try { await cleanup(dir); } catch { /* temp-dir cleanup is best-effort in the spike */ }
  }
});

test('spike: revision update semantics persist', async () => {
  const dir = await privateDir();
  try {
    const { db } = openPrivateDb(dir, 'covert-p3-spike.db');
    migrate(db);
    insertEnvelope(db, { envelope_id: 'env-r', resident_id: 'cipher', project_id: null, payload: {} });
    db.prepare('UPDATE envelopes SET revision = revision + 1, state = ? WHERE envelope_id = ?').run('CLAIMED', 'env-r');
    db.close();
    const { db: reopened } = openPrivateDb(dir, 'covert-p3-spike.db');
    try {
      const read = readEnvelope(reopened, 'env-r');
      assert.ok(read.ok);
      assert.equal(read.record.revision, 2);
      assert.equal(read.record.state, 'CLAIMED');
    } finally { reopened.close(); }
  } finally {
    try { await cleanup(dir); } catch { /* temp-dir cleanup is best-effort in the spike */ }
  }
});

test('spike: duplicate identity is refused and diagnostics never leak payload secrets', async () => {
  const dir = await privateDir();
  try {
    const { db } = openPrivateDb(dir, 'covert-p3-spike.db');
    migrate(db);
    insertEnvelope(db, { envelope_id: 'env-d', resident_id: 'cipher', project_id: null, payload: { note: CANARY } });
    let caught: Error | null = null;
    try {
      insertEnvelope(db, { envelope_id: 'env-d', resident_id: 'cipher', project_id: null, payload: { note: 'second' } });
    } catch (error) { caught = error as Error; }
    assert.ok(caught !== null, 'duplicate insert must throw');
    assert.match(String(caught.message), /UNIQUE/);
    assert.ok(!String(caught.message).includes(CANARY), 'diagnostics must not include payload secrets');
    assert.ok(!JSON.stringify(caught).includes(CANARY), 'serialized diagnostics must not include payload secrets');
    db.close();
  } finally {
    try { await cleanup(dir); } catch { /* temp-dir cleanup is best-effort in the spike */ }
  }
});

test('spike: malformed persisted payload is refused at the app edge, never thrown raw', async () => {
  const dir = await privateDir();
  try {
    const { db } = openPrivateDb(dir, 'covert-p3-spike.db');
    migrate(db);
    db.prepare('INSERT INTO envelopes (envelope_id, resident_id, project_id, payload, revision, state, created_utc) VALUES (?, ?, ?, ?, 1, ?, ?)')
      .run('env-bad', 'cipher', null, '{not-json', 'RECEIVED', new Date().toISOString());
    const read = readEnvelope(db, 'env-bad');
    assert.deepEqual(read, { ok: false, reason: 'MALFORMED' });
    db.close();
  } finally {
    try { await cleanup(dir); } catch { /* temp-dir cleanup is best-effort in the spike */ }
  }
});

test('spike: transaction rollback leaves no partial rows', async () => {
  const dir = await privateDir();
  try {
    const { db } = openPrivateDb(dir, 'covert-p3-spike.db');
    migrate(db);
    db.exec('BEGIN');
    insertEnvelope(db, { envelope_id: 'env-t1', resident_id: 'cipher', project_id: null, payload: {} });
    insertEnvelope(db, { envelope_id: 'env-t2', resident_id: 'cipher', project_id: null, payload: {} });
    db.exec('ROLLBACK');
    const count = Number(db.prepare('SELECT COUNT(*) AS c FROM envelopes').get()?.c);
    assert.equal(count, 0);
    db.close();
  } finally {
    try { await cleanup(dir); } catch { /* temp-dir cleanup is best-effort in the spike */ }
  }
});

test('spike: cancellation/revocation state persists across reopen', async () => {
  const dir = await privateDir();
  try {
    const { db } = openPrivateDb(dir, 'covert-p3-spike.db');
    migrate(db);
    insertEnvelope(db, { envelope_id: 'env-c', resident_id: 'cipher', project_id: null, payload: {} });
    db.prepare('UPDATE envelopes SET state = ? WHERE envelope_id = ?').run('CANCELLED', 'env-c');
    db.close();
    const { db: reopened } = openPrivateDb(dir, 'covert-p3-spike.db');
    try {
      const read = readEnvelope(reopened, 'env-c');
      assert.ok(read.ok);
      assert.equal(read.record.state, 'CANCELLED');
    } finally { reopened.close(); }
  } finally {
    try { await cleanup(dir); } catch { /* temp-dir cleanup is best-effort in the spike */ }
  }
});

test('spike: private-path containment and bounded payloads are enforced', async () => {
  const dir = await privateDir();
  try {
    assert.throws(() => openPrivateDb(dir, '../escape.db'), /unsafe database name/);
    assert.throws(() => openPrivateDb(dir, 'sub/dir.db'), /unsafe database name/);
    const { db } = openPrivateDb(dir, 'covert-p3-spike.db');
    migrate(db);
    assert.throws(() => insertEnvelope(db, { envelope_id: 'env-big', resident_id: 'cipher', project_id: null, payload: { blob: 'x'.repeat(70 * 1024) } }), /bounded size/);
    db.close();
  } finally {
    try { await cleanup(dir); } catch { /* temp-dir cleanup is best-effort in the spike */ }
  }
});
