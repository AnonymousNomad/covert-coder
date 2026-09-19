import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  PerformanceEvent,
  PerformanceRecord,
  type PerformanceEventT,
  type PerformanceEventQueryT,
  type PerformanceRecordT
} from '../../../common/contracts/performance.ts';

// Harness Lab — local performance ledger.
//
// Append-only JSONL with a per-line integrity chain. Local by default (lives
// under <workspace>/.aide/harness-lab, which is gitignored); restart
// persistent; corruption is DETECTED and reported, never silently repaired or
// deleted. The ledger stores IDs, hashes and safe measurements only — event
// objects are strict, and a secret-shape scan rejects anything that looks like
// credential material before it can be written.
export class LedgerSecurityError extends Error {
  constructor(patternName: string) {
    super(`event rejected: content matches secret pattern "${patternName}"`);
    this.name = 'LedgerSecurityError';
  }
}

export class LedgerIntegrityError extends Error {
  readonly issues: Array<{ line: number; kind: string; detail: string }>;
  constructor(issues: Array<{ line: number; kind: string; detail: string }>) {
    super(`ledger integrity failed (${issues.length} issue(s))`);
    this.name = 'LedgerIntegrityError';
    this.issues = issues;
  }
}

export interface LedgerOptions {
  root: string;
  maxFileBytes?: number;
}

export const LEDGER_FILE_NAME = 'performance-events.jsonl';
const GENESIS_HASH = 'genesis';
const DEFAULT_MAX_FILE_BYTES = 128 * 1024 * 1024;

const SECRET_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  { name: 'private-key-block', pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: 'openai-style-key', pattern: /\bsk-[A-Za-z0-9_-]{16,}/ },
  { name: 'github-pat-classic', pattern: /\bghp_[A-Za-z0-9]{20,}/ },
  { name: 'github-pat-fine-grained', pattern: /\bgithub_pat_[A-Za-z0-9_]{20,}/ },
  { name: 'aws-access-key', pattern: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'jwt', pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\./ },
  { name: 'bearer-token', pattern: /\bBearer\s+[A-Za-z0-9._-]{20,}/i },
  { name: 'password-assignment', pattern: /\bpassword\s*[:=]\s*\S{8,}/i }
];

export function assertNoSecrets(text: string): void {
  for (const { name, pattern } of SECRET_PATTERNS) {
    if (pattern.test(text)) throw new LedgerSecurityError(name);
  }
}

// Deterministic serialization: object keys sorted recursively so the chain
// hash is stable across processes and platforms.
export function stableStringify(value: unknown): string {
  if (value === null || typeof value === 'number' || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(item => stableStringify(item)).join(',')}]`;
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    return `{${keys.map(key => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`;
  }
  throw new TypeError('unsupported value in ledger event');
}

export function chainHash(prevHash: string, event: PerformanceEventT): string {
  return crypto.createHash('sha256').update(`${prevHash}\n${stableStringify(event)}`).digest('hex');
}

export interface LedgerIntegrityIssue {
  line: number;
  kind: 'malformed-json' | 'schema-invalid' | 'chain-break' | 'hash-mismatch';
  detail: string;
}

export interface LedgerReadResult {
  events: PerformanceRecordT[];
  issues: LedgerIntegrityIssue[];
}

export interface PerformanceLedger {
  readonly file: string;
  append(event: PerformanceEventT): Promise<PerformanceRecordT>;
  read(): Promise<LedgerReadResult>;
  readStrict(): Promise<PerformanceRecordT[]>;
  query(filter: PerformanceEventQueryT): Promise<{ events: PerformanceRecordT[]; total_matched: number; bounded: boolean; issues: LedgerIntegrityIssue[] }>;
}

export function createPerformanceLedger(options: LedgerOptions): PerformanceLedger {
  if (!options || typeof options.root !== 'string' || options.root.length === 0) throw new TypeError('ledger root is required');
  const file = path.join(options.root, LEDGER_FILE_NAME);
  const maxFileBytes = options.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES;

  async function tailRecords(): Promise<{ last: PerformanceRecordT | null }> {
    let raw: string;
    try {
      raw = await fs.readFile(file, 'utf8');
    } catch {
      return { last: null };
    }
    const lines = raw.split('\n').filter(line => line.trim().length > 0);
    for (let index = lines.length - 1; index >= 0; index--) {
      try {
        const parsed = PerformanceRecord.safeParse(JSON.parse(lines[index]!));
        if (parsed.success) return { last: parsed.data };
      } catch {
        // skip corrupt tail lines; integrity reporting owns them
      }
    }
    return { last: null };
  }

  async function append(event: PerformanceEventT): Promise<PerformanceRecordT> {
    const parsed = PerformanceEvent.safeParse(event);
    if (!parsed.success) throw new TypeError(`performance event rejected: ${parsed.error.issues[0]?.message ?? 'schema'}`);
    assertNoSecrets(stableStringify(parsed.data));
    const { last } = await tailRecords();
    const seq = last === null ? 0 : last.chain.seq + 1;
    const prevHash = last === null ? GENESIS_HASH : last.chain.hash;
    const chain = { seq, prev_hash: prevHash, hash: chainHash(prevHash, parsed.data) };
    const record: PerformanceRecordT = { ...parsed.data, chain };
    await fs.mkdir(path.dirname(file), { recursive: true });
    const handle = await fs.open(file, 'a');
    try {
      await handle.writeFile(`${JSON.stringify(record)}\n`, 'utf8');
      await handle.sync();
    } finally {
      await handle.close();
    }
    return record;
  }

  async function read(): Promise<LedgerReadResult> {
    const stat = await fs.stat(file).catch(() => null);
    if (stat === null) return { events: [], issues: [] };
    if (stat.size > maxFileBytes) throw new LedgerIntegrityError([{ line: 0, kind: 'malformed-json', detail: `ledger exceeds bounded read size (${stat.size} bytes)` }]);
    const raw = await fs.readFile(file, 'utf8');
    const lines = raw.split('\n');
    const events: PerformanceRecordT[] = [];
    const issues: LedgerIntegrityIssue[] = [];
    let expectedSeq = 0;
    let prevHash: string | null = null;
    for (let index = 0; index < lines.length; index++) {
      const line = lines[index]!;
      if (line.trim().length === 0) continue;
      let parsedLine: unknown;
      try {
        parsedLine = JSON.parse(line);
      } catch {
        issues.push({ line: index + 1, kind: 'malformed-json', detail: 'line is not valid JSON' });
        continue;
      }
      const record = PerformanceRecord.safeParse(parsedLine);
      if (!record.success) {
        issues.push({ line: index + 1, kind: 'schema-invalid', detail: record.error.issues[0]?.message ?? 'schema' });
        continue;
      }
      const { chain, ...event } = record.data;
      if (chain.seq !== expectedSeq) issues.push({ line: index + 1, kind: 'chain-break', detail: `expected seq ${expectedSeq}, found ${chain.seq}` });
      if (prevHash !== null && chain.prev_hash !== prevHash) issues.push({ line: index + 1, kind: 'chain-break', detail: 'prev_hash does not match previous record' });
      const expectedHash = chainHash(chain.prev_hash, event as PerformanceEventT);
      if (expectedHash !== chain.hash) issues.push({ line: index + 1, kind: 'hash-mismatch', detail: 'record hash does not match content' });
      events.push(record.data);
      expectedSeq = chain.seq + 1;
      prevHash = chain.hash;
    }
    return { events, issues };
  }

  async function readStrict(): Promise<PerformanceRecordT[]> {
    const { events, issues } = await read();
    if (issues.length > 0) throw new LedgerIntegrityError(issues);
    return events;
  }

  async function query(filter: PerformanceEventQueryT): Promise<{ events: PerformanceRecordT[]; total_matched: number; bounded: boolean; issues: LedgerIntegrityIssue[] }> {
    const { events, issues } = await read();
    const matched = events.filter(record => {
      if (filter.model_id !== undefined && record.model.model_id !== filter.model_id) return false;
      if (filter.performance_identity !== undefined) {
        const identity = `${record.model.model_id}@${record.model.artifact_hash}:${record.model.configured_context}:${record.model.runtime}`;
        if (identity !== filter.performance_identity) return false;
      }
      if (filter.task_class !== undefined && record.task.task_class !== filter.task_class) return false;
      if (filter.benchmark_task_id !== undefined && record.task.benchmark_task_id !== filter.benchmark_task_id) return false;
      if (filter.workflow_id !== undefined && record.methodology.workflow_id !== filter.workflow_id) return false;
      if (filter.skill_id !== undefined && !record.methodology.skill_ids.includes(filter.skill_id)) return false;
      if (filter.mode_id !== undefined && record.operating_mode.mode_id !== filter.mode_id) return false;
      if (filter.since !== undefined && record.run.timestamp < filter.since) return false;
      if (filter.until !== undefined && record.run.timestamp > filter.until) return false;
      return true;
    });
    const limit = filter.limit ?? 200;
    return { events: matched.slice(0, limit), total_matched: matched.length, bounded: matched.length > limit, issues };
  }

  return Object.freeze({ file, append, read, readStrict, query });
}

export function performanceIdentity(model: PerformanceEventT['model']): string {
  return `${model.model_id}@${model.artifact_hash}:${model.configured_context}:${model.runtime}`;
}
