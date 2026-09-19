import { promises as fs, readFileSync } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createReadStream } from 'node:fs';
import { ModelRuntime } from './model-runtime.ts';
import {
  QualificationRecord,
  QUALIFICATION_SCHEMA_VERSION,
  type QualificationRecordT,
  type QualificationIdentityT
} from '../../../common/contracts/performance.ts';

// Model Qualification — orthogonal to runtime state.
//
// READY means the runtime is serving. QUALIFIED means THIS exact artifact +
// quantization + runtime + configuration passed a bounded FUNCTIONAL
// compatibility probe (instruction echo, structured transport, trivial
// arithmetic, degeneracy analysis). It is not an intelligence benchmark: a
// mediocre answer passes, a decode-corrupt or empty generator does not. Failed
// configurations stay persisted and inspectable; artifacts are never deleted.
export const QUALIFICATIONS_FILE_NAME = 'qualifications.json';
export const QUALIFICATION_PROBE_VERSION = '1.1';

export class QualificationError extends Error {
  readonly code: 'NOT_FOUND' | 'BAD_REQUEST';
  constructor(code: 'NOT_FOUND' | 'BAD_REQUEST', message: string) {
    super(message);
    this.name = 'QualificationError';
    this.code = code;
  }
}

export function qualificationIdentityString(identity: QualificationIdentityT): string {
  return `${identity.model_id}@${identity.artifact_hash}:${identity.configured_context}:${identity.runtime}|${identity.quantization}|${identity.profile_digest}`;
}

export function createQualificationStore({ root }: { root: string }) {
  const file = path.join(root, QUALIFICATIONS_FILE_NAME);

  async function read(): Promise<QualificationRecordT[]> {
    try {
      const raw = JSON.parse(await fs.readFile(file, 'utf8')) as { records?: unknown };
      if (!Array.isArray(raw.records)) return [];
      const records: QualificationRecordT[] = [];
      for (const candidate of raw.records) {
        const parsed = QualificationRecord.safeParse(candidate);
        if (parsed.success) records.push(parsed.data);
      }
      return records;
    } catch {
      return [];
    }
  }

  async function append(record: QualificationRecordT): Promise<void> {
    const parsed = QualificationRecord.safeParse(record);
    if (!parsed.success) throw new TypeError(`qualification record rejected: ${parsed.error.issues[0]?.message ?? 'schema'}`);
    const records = await read();
    records.push(parsed.data);
    await fs.mkdir(root, { recursive: true });
    const temporary = `${file}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(temporary, JSON.stringify({ schema_version: QUALIFICATION_SCHEMA_VERSION, records }, null, 2), 'utf8');
    await fs.rename(temporary, file);
  }

  async function latest(): Promise<Map<string, QualificationRecordT>> {
    const map = new Map<string, QualificationRecordT>();
    for (const record of await read()) map.set(record.qualification_identity, record);
    return map;
  }

  return Object.freeze({ file, read, append, latest });
}

// Mechanical degeneracy detection. Deliberately conservative: it flags only
// strong structural corruption (period repetition, near-empty token variety),
// never merely low-quality prose.
export function isDegenerateOutput(text: string): { degenerate: boolean; reason: string | null } {
  const trimmed = text.trim();
  if (trimmed.length === 0) return { degenerate: false, reason: null };
  if (!/[A-Za-z0-9]/.test(trimmed)) return { degenerate: true, reason: 'no alphanumeric content' };
  if (trimmed.length >= 40) {
    for (let period = 1; period <= 4; period++) {
      let matches = 0;
      for (let index = 0; index < trimmed.length; index++) if (trimmed[index] === trimmed[index % period]) matches++;
      if (matches / trimmed.length >= 0.7) return { degenerate: true, reason: `character period repetition (p=${period})` };
    }
  }
  const tokens = trimmed.split(/\s+/);
  if (tokens.length >= 24) {
    const unique = new Set(tokens.map(token => token.toLowerCase())).size;
    if (unique / tokens.length < 0.2) return { degenerate: true, reason: `repetitive token stream (${unique}/${tokens.length} unique)` };
  }
  return { degenerate: false, reason: null };
}

interface ProbeDefinition {
  name: string;
  prompt: string;
  max_tokens: number;
  check: (text: string) => boolean;
}

export const QUALIFICATION_PROBES: ProbeDefinition[] = [
  {
    name: 'echo-instruction',
    prompt: 'Reply with exactly: QUALIFY-OK',
    // 256 tokens: thinking models spend their budget reasoning before the
    // answer (verified 2026-09-19: LFM2.5 answers at token 174). The probe is
    // functional, not a quality test, so the budget must not manufacture a
    // false negative for a coherent model.
    max_tokens: 256,
    check: text => /qualify-ok/i.test(text)
  },
  {
    name: 'structured-json',
    prompt: 'Reply with only this JSON object and nothing else: {"ok":true}',
    max_tokens: 256,
    check: text => {
      const match = text.match(/\{[\s\S]*?\}/);
      if (match === null) return false;
      try {
        return (JSON.parse(match[0]) as { ok?: unknown }).ok === true;
      } catch {
        return false;
      }
    }
  },
  {
    name: 'arithmetic',
    prompt: 'What is 2+3? Reply with only the number.',
    max_tokens: 128,
    check: text => /\b5\b/.test(text)
  }
];

async function sha256File(file: string): Promise<string> {
  const hash = crypto.createHash('sha256');
  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(file);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', resolve);
    stream.on('error', reject);
  });
  return hash.digest('hex');
}

function profileDigestFor(file: string): string {
  try {
    const sidecar = readFileSync(`${file}.profile.json`, 'utf8');
    return crypto.createHash('sha256').update(sidecar).digest('hex').slice(0, 16);
  } catch {
    return 'none';
  }
}

export interface QualificationRunOptions {
  runtime: ModelRuntime;
  modelId: string;
  root: string;
  artifactHash?: string;
  now?: () => string;
}

export async function runQualificationProbe(options: QualificationRunOptions): Promise<QualificationRecordT> {
  const { runtime, modelId, root } = options;
  const now = options.now ?? (() => new Date().toISOString());
  const entry = runtime.get(modelId);
  if (entry === undefined) throw new QualificationError('NOT_FOUND', `model is not allowlisted: ${modelId}`);

  const artifactHash = options.artifactHash ?? (await sha256File(entry.file));
  const identity: QualificationIdentityT = {
    model_id: entry.id,
    artifact_hash: artifactHash,
    quantization: entry.quant_label ?? 'unknown',
    runtime: 'llama-server',
    configured_context: entry.context_tokens,
    profile_digest: profileDigestFor(entry.file)
  };
  const qualificationIdentity = qualificationIdentityString(identity);
  const notes: string[] = [];
  const evidenceRefs: string[] = [];
  const probes: QualificationRecordT['probes'] = [];

  const ready = await runtime.isReady(modelId, 5000).catch(() => ({ ready: false }));
  if (ready.ready !== true) {
    const record: QualificationRecordT = {
      schema_version: QUALIFICATION_SCHEMA_VERSION,
      qualification_identity: qualificationIdentity,
      identity,
      state: 'QUALIFICATION_UNKNOWN',
      failure_class: 'engine_not_ready',
      checked_at: now(),
      probe_version: QUALIFICATION_PROBE_VERSION,
      probes: [],
      evidence_refs: [],
      notes: ['the runtime endpoint did not verify as ready; qualification could not run']
    };
    return record;
  }

  const runDir = path.join(root, 'qualification-runs', `${entry.id}-${now().replace(/[:.]/g, '-')}`);
  await fs.mkdir(runDir, { recursive: true });

  let errorCount = 0;
  let passCount = 0;
  let emptyCount = 0;
  let degenerateReason: string | null = null;
  let structuredTransportFailed = false;

  for (const probe of QUALIFICATION_PROBES) {
    let output = '';
    let error: string | null = null;
    try {
      const result = await runtime.chat(modelId, [{ role: 'user', content: probe.prompt }], { maxTokens: probe.max_tokens, temperature: 0 });
      output = result.text;
    } catch (caught) {
      error = caught instanceof Error ? caught.message : String(caught);
    }
    if (error !== null) {
      errorCount += 1;
      probes.push({ name: probe.name, passed: false, detail: `runtime error: ${error.slice(0, 160)}` });
    } else {
      const trimmed = output.trim();
      if (trimmed.length === 0) {
        emptyCount += 1;
        probes.push({ name: probe.name, passed: false, detail: 'empty generation' });
      } else {
        const degeneracy = isDegenerateOutput(output);
        if (degeneracy.degenerate) degenerateReason = degenerateReason ?? degeneracy.reason;
        const passed = probe.check(output);
        if (passed) passCount += 1;
        if (probe.name === 'structured-json' && !passed && !degeneracy.degenerate) structuredTransportFailed = true;
        probes.push({ name: probe.name, passed, detail: degeneracy.degenerate ? `degenerate output: ${degeneracy.reason}` : trimmed.slice(0, 120) });
      }
    }
    const evidenceFile = path.join(runDir, `${probe.name}.txt`);
    await fs.writeFile(evidenceFile, `PROBE: ${probe.name}\nPROMPT: ${probe.prompt}\nERROR: ${error ?? 'none'}\nOUTPUT:\n${output.slice(0, 2000)}\n`, 'utf8');
    evidenceRefs.push(evidenceFile);
  }

  let state: QualificationRecordT['state'];
  let failureClass: QualificationRecordT['failure_class'];
  if (passCount >= 2) {
    state = 'QUALIFIED';
    failureClass = null;
    notes.push('functional compatibility verified: at least two independent probes passed');
    if (degenerateReason !== null) notes.push(`note: one probe showed degenerate output (${degenerateReason})`);
  } else if (errorCount > 0) {
    state = 'QUALIFICATION_UNKNOWN';
    failureClass = 'runtime_error';
    notes.push('the runtime errored during the probe; qualification could not be determined');
  } else if (emptyCount === QUALIFICATION_PROBES.length) {
    state = 'QUALIFICATION_FAILED';
    failureClass = 'empty_output';
    notes.push('every probe returned an empty generation; this configuration cannot perform minimally coherent inference');
  } else if (degenerateReason !== null) {
    state = 'QUALIFICATION_FAILED';
    failureClass = 'degenerate_output';
    notes.push(`decode-corrupt / degenerate output detected: ${degenerateReason}`);
  } else if (structuredTransportFailed) {
    state = 'QUALIFICATION_FAILED';
    failureClass = 'transport_invalid';
    notes.push('the model could not produce a parseable structured response');
  } else {
    state = 'QUALIFICATION_FAILED';
    failureClass = 'probe_mismatch';
    notes.push('fewer than two functional probes passed; the configuration is not usable for governed work');
  }

  const record: QualificationRecordT = {
    schema_version: QUALIFICATION_SCHEMA_VERSION,
    qualification_identity: qualificationIdentity,
    identity,
    state,
    failure_class: failureClass,
    checked_at: now(),
    probe_version: QUALIFICATION_PROBE_VERSION,
    probes,
    evidence_refs: evidenceRefs,
    notes
  };
  return record;
}
