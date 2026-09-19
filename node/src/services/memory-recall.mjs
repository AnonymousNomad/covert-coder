// Memory recall for AIDE — the harness-as-intelligence layer (Gap #4).
//
// Reads .aide/memory/sessions.jsonl (append-only; one line per chat-turn
// summary). Retrieval is STREAMING and BOUNDED: the journal is scanned
// line-by-line — never loaded wholesale — supersession state is tracked
// globally across the whole journal, and only a bounded top-K of scored
// hits and the term index are ever held in memory. As the journal grows,
// the newest entries therefore remain visible, supersession stays
// authoritative, older entries remain retrievable when relevant, and
// memory use stays proportional to the vocabulary/supersession index
// rather than to the journal size.
//
// Secret exclusion is enforced on write AND on read (defense in depth):
// secret-shaped values are redacted before persistence so raw values
// never reach disk, audit, or model context.
//
// Retention is intentionally out of scope here: this journal is an
// append-only continuity log and retention rollups live in the Helix
// layer (harness/helix-retention.mjs); no independent TTL is invented.
import { promises as fs, createReadStream } from 'node:fs';
import readline from 'node:readline';
import path from 'node:path';

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'must', 'shall', 'can', 'to', 'of', 'in',
  'for', 'on', 'with', 'at', 'by', 'from', 'as', 'is', 'it', 'this',
  'that', 'these', 'those', 'i', 'you', 'he', 'she', 'we', 'they',
  'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his', 'its', 'our',
  'their', 'a', 'an', 'and', 'or', 'but', 'if', 'then', 'else', 'when',
  'where', 'why', 'how', 'what', 'which', 'who', 'whom', 'whose',
  'just', 'also', 'very', 'too', 'so', 'than', 'like', 'into', 'out',
  'up', 'down', 'over', 'under', 'again', 'further', 'once', 'here',
  'there', 'some', 'any', 'all', 'each', 'every', 'no', 'not', 'only',
  'own', 'same', 'than', 'too', 'very', 'can', 'will', 'just', 'should'
]);

function tokenize(s) {
  if (!s) return [];
  return String(s).toLowerCase()
    .replace(/[^a-z0-9_\-./]+/g, ' ')
    .split(/\s+/)
    .filter(t => t.length >= 2 && !STOP_WORDS.has(t));
}

function termFreq(tokens) {
  const tf = new Map();
  for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);
  return tf;
}

const MAX_TEXT = 1200;
const MAX_ITEMS = 16;

// Private-key material is redacted wholesale BEFORE separator-preserving
// redaction runs (base64 padding inside a block would otherwise be mistaken
// for a key=value separator and leak the remainder of the block).
const PRIVATE_KEY_BLOCK = /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z0-9 ]*PRIVATE KEY-----|$)/g;

const SECRET_PATTERNS = [
  /\b(?:AKIA|ASIA|ABIA|ACCA)[A-Z0-9]{16}\b/g,
  /\b(?:sk|ghp|gho|ghu|ghs|github_pat|glpat|hf|xoxb|xoxp|xoxa|xoxr)[-_][A-Za-z0-9._-]{8,}\b/g,
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g,
  /\b(?:authorization|auth)\s*[:=]\s*(?:bearer|basic|token)\s+[A-Za-z0-9._~+/=-]{4,}/gi,
  /\b(?:api[_-]?key|access[_-]?token|refresh[_-]?token|auth[_-]?token|token|password|passwd|secret|client[_-]?secret|aws[_-]?secret[_-]?access[_-]?key)\s*[:=]\s*[^\s,;]+/gi,
  /\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi
];

function redact(match) {
  const separator = match.search(/[:=]/);
  return separator >= 0 ? `${match.slice(0, separator + 1)} [REDACTED]` : '[REDACTED]';
}

function scrubText(value) {
  let text = String(value ?? '').slice(0, MAX_TEXT);
  text = text.replace(PRIVATE_KEY_BLOCK, '[REDACTED]');
  for (const pattern of SECRET_PATTERNS) text = text.replace(pattern, redact);
  return text;
}

function scrubItems(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_ITEMS).map(item => scrubText(item)).filter(Boolean);
}

function normalizeEntry(entry) {
  if (!entry || typeof entry !== 'object' || !entry.session_id || !entry.ts) throw new Error('memory entry needs session_id and ts');
  if (entry.scope !== undefined && entry.scope !== 'workspace') throw new Error('memory scope must be workspace');
  return {
    session_id: scrubText(entry.session_id),
    ts: scrubText(entry.ts),
    scope: 'workspace',
    ...(entry.fact_key ? { fact_key: scrubText(entry.fact_key) } : {}),
    ...(Array.isArray(entry.supersedes) ? { supersedes: scrubItems(entry.supersedes) } : {}),
    ...(entry.validated === false ? { validated: false } : {}),
    ...(entry.intent ? { intent: scrubText(entry.intent) } : {}),
    ...(entry.summary ? { summary: scrubText(entry.summary) } : {}),
    ...(Array.isArray(entry.skills_invoked) ? { skills_invoked: scrubItems(entry.skills_invoked) } : {}),
    ...(Array.isArray(entry.files_touched) ? { files_touched: scrubItems(entry.files_touched) } : {}),
    ...(entry.outcome ? { outcome: scrubText(entry.outcome) } : {})
  };
}

// Per-field term frequency. The query is matched against the union of all
// per-field term maps; each field's contribution is scaled by its weight.
function memoryFieldTfs(mem, weights) {
  const out = new Map(); // field -> tf
  for (const field of Object.keys(weights)) {
    const v = mem[field];
    const toks = [];
    if (Array.isArray(v)) for (const item of v) toks.push(...tokenize(String(item)));
    else if (v) toks.push(...tokenize(String(v)));
    if (toks.length) out.set(field, termFreq(toks));
  }
  return out;
}

function scoreMemory(fieldTfs, weights, queryTf, idf) {
  let s = 0;
  for (const [field, weight] of Object.entries(weights)) {
    const mTf = fieldTfs.get(field);
    if (!mTf) continue;
    for (const [term, mtf] of mTf) {
      const qtf = queryTf.get(term);
      if (!qtf) continue;
      s += weight * mtf * (idf.get(term) || 0);
    }
  }
  return s;
}

export function createMemoryRecall({ workspace }) {
  const memFile = path.join(workspace, '.aide', 'memory', 'sessions.jsonl');
  const WEIGHTS = { intent: 2.0, skills_invoked: 3.0, files_touched: 2.5, summary: 1.0, outcome: 1.5 };
  const BUDGET_TOKENS = 800;
  const MAX_TOP_N = 5;
  const KEEP_FACTOR = 2;

  async function* iterateEntries() {
    const stream = createReadStream(memFile, { encoding: 'utf8' });
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
    try {
      for await (const line of rl) {
        const t = line.trim();
        if (!t) continue;
        try {
          const obj = JSON.parse(t);
          if (obj && obj.session_id && obj.ts && (obj.scope === undefined || obj.scope === 'workspace')) yield normalizeEntry(obj);
        } catch { /* skip malformed */ }
      }
    } finally {
      rl.close();
      stream.destroy();
    }
  }

  function storageFailure(error) {
    const reason = error?.code === 'ENOENT' ? 'no memories yet' : 'memory storage read failed';
    return { hits: [], degraded: true, reason, approxTokens: 0 };
  }

  // One streaming pass: global supersession index + honest totals.
  async function buildIndex() {
    const superseded = new Set();
    const latestByFact = new Map();
    let count = 0;
    let lastTs = null;
    for await (const entry of iterateEntries()) {
      count += 1;
      lastTs = entry.ts;
      if (entry.validated !== false && entry.fact_key) latestByFact.set(entry.fact_key, entry.session_id);
      for (const target of entry.supersedes ?? []) superseded.add(target);
    }
    return { superseded, latestByFact, count, lastTs };
  }

  function isActive(memory, index) {
    if (memory.validated === false) return false;
    if (index.superseded.has(memory.session_id)) return false;
    if (memory.fact_key) {
      if (index.superseded.has(memory.fact_key)) return false;
      if (index.latestByFact.get(memory.fact_key) !== memory.session_id) return false;
    }
    return true;
  }

  // Second streaming pass: document frequencies over active entries only.
  async function buildIdf(index) {
    const df = new Map();
    let active = 0;
    for await (const memory of iterateEntries()) {
      if (!isActive(memory, index)) continue;
      active += 1;
      const seen = new Set();
      for (const fieldTf of memoryFieldTfs(memory, WEIGHTS).values()) {
        for (const term of fieldTf.keys()) {
          if (seen.has(term)) continue;
          seen.add(term);
          df.set(term, (df.get(term) || 0) + 1);
        }
      }
    }
    const idf = new Map();
    for (const [term, c] of df) idf.set(term, Math.log(1 + (active - c + 0.5) / (c + 0.5)));
    return { idf, active };
  }

  // Third streaming pass: score, keep only a bounded top-K.
  async function scoreTop(index, idf, queryTf, keep) {
    const best = [];
    for await (const memory of iterateEntries()) {
      if (!isActive(memory, index)) continue;
      const fieldTfs = memoryFieldTfs(memory, WEIGHTS);
      const score = scoreMemory(fieldTfs, WEIGHTS, queryTf, idf);
      if (score <= 0) continue;
      if (best.length >= keep && score <= best[best.length - 1].score) continue;
      let lo = 0;
      let hi = best.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (best[mid].score >= score) lo = mid + 1;
        else hi = mid;
      }
      best.splice(lo, 0, { memory, score });
      if (best.length > keep) best.length = keep;
    }
    return best;
  }

  async function recall(query, opts) {
    const topN = Math.min(Math.max(Number(opts?.topN ?? 5), 1), MAX_TOP_N);
    const budgetTokens = Math.min(Math.max(Number(opts?.budgetTokens ?? BUDGET_TOKENS), 64), BUDGET_TOKENS);
    let index;
    try {
      index = await buildIndex();
    } catch (error) {
      return storageFailure(error);
    }
    if (index.count === 0) return { hits: [], degraded: true, reason: 'no memories yet', approxTokens: 0 };
    const qTokens = tokenize(query);
    if (qTokens.length === 0) return { hits: [], degraded: true, reason: 'empty query', approxTokens: 0 };
    let idf;
    let active;
    try {
      ({ idf, active } = await buildIdf(index));
    } catch (error) {
      return storageFailure(error);
    }
    if (active === 0) return { hits: [], degraded: false, reason: 'no active memories', approxTokens: 0 };
    const qTf = termFreq(qTokens);
    const keep = Math.max(topN * KEEP_FACTOR, 8);
    let best;
    try {
      best = await scoreTop(index, idf, qTf, keep);
    } catch (error) {
      return storageFailure(error);
    }
    const hits = best.slice(0, topN).map(({ memory, score }) => ({
      session_id: memory.session_id,
      ts: memory.ts,
      intent: memory.intent,
      summary: memory.summary,
      skills_invoked: memory.skills_invoked || [],
      files_touched: memory.files_touched || [],
      outcome: memory.outcome,
      ...(memory.fact_key ? { fact_key: memory.fact_key } : {}),
      score: Math.round(score * 100) / 100
    }));
    let chars = 0;
    const trimmed = [];
    for (const h of hits) {
      const est = JSON.stringify(h).length;
      if ((chars + est) / 4 > budgetTokens) break;
      chars += est;
      trimmed.push(h);
    }
    return { hits: trimmed, degraded: false, approxTokens: Math.round(chars / 4) };
  }

  async function remember(entry) {
    const normalized = normalizeEntry(entry);
    await fs.mkdir(path.dirname(memFile), { recursive: true });
    const handle = await fs.open(memFile, 'a');
    try {
      await handle.writeFile(JSON.stringify(normalized) + '\n', 'utf8');
      await handle.sync();
    } finally {
      await handle.close();
    }
  }

  async function status() {
    try {
      const index = await buildIndex();
      return { count: index.count, file: memFile, lastTs: index.lastTs, degraded: false };
    } catch (error) {
      const reason = error?.code === 'ENOENT' ? 'no memories yet' : 'memory storage read failed';
      return { count: 0, file: memFile, lastTs: null, degraded: true, reason };
    }
  }

  return { recall, remember, status };
}
