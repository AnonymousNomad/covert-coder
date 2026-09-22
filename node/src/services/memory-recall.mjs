// Memory recall for AIDE — the harness-as-intelligence layer (Gap #4).
//
// Reads .aide/memory/sessions.jsonl (one line per chat turn summary) and
// returns the top-N memories most relevant to the current user message.
// Honest BM25-style scoring on (intent + skills_invoked + files_touched +
// summary + outcome) so the model sees real prior context without a
// heavy embedding dependency.
import { promises as fs } from 'node:fs';
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
const SECRET_PATTERNS = [
  /\b(?:api[_-]?key|access[_-]?token|refresh[_-]?token|auth(?:orization)?|password|passwd|secret|credential)\s*[:=]\s*[^\s,;]+/gi,
  /\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi,
  /\b(?:sk|ghp|github_pat|hf|xoxb)-[A-Za-z0-9._-]{8,}/gi,
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g
];

function scrubText(value) {
  let text = String(value ?? '').slice(0, MAX_TEXT);
  for (const pattern of SECRET_PATTERNS) text = text.replace(pattern, match => {
    const separator = match.search(/[:=]/);
    return separator >= 0 ? `${match.slice(0, separator + 1)} [REDACTED]` : '[REDACTED]';
  });
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
    ...(entry.validity ? { validity: scrubText(entry.validity) } : {}),
    ...(entry.evidence_ref ? { evidence_ref: scrubText(entry.evidence_ref) } : {}),
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
  const MAX_MEMORIES = 500;
  const BUDGET_TOKENS = 800;

  async function loadMemories() {
    let raw;
    try {
      raw = await fs.readFile(memFile, 'utf8');
    } catch (error) {
      if (error?.code === 'ENOENT') return { memories: [], degraded: true, reason: 'no memories yet' };
      return { memories: [], degraded: true, reason: 'memory storage read failed' };
    }
    const out = [];
    for (const line of raw.split('\n')) {
      const t = line.trim();
      if (!t) continue;
      try {
        const obj = JSON.parse(t);
        if (obj && obj.session_id && obj.ts && (obj.scope === undefined || obj.scope === 'workspace')) out.push(normalizeEntry(obj));
      } catch { /* skip malformed */ }
      if (out.length >= MAX_MEMORIES) break;
    }
    return { memories: out, degraded: false };
  }

  function activeMemories(memories) {
    const superseded = new Set();
    const latestByFact = new Map();
    // Truth classes: VERIFIED outranks ASSERTED for current-truth ownership;
    // REJECTED/SUPERSEDED are never active (they remain file history).
    // REPETITION != VERIFICATION: extra asserted rows never change the class.
    const classRank = memory => (memory.validity === 'verified' ? 2 : memory.validity === undefined || memory.validity === 'asserted' || memory.validity === 'unknown' ? 1 : 0);
    for (const memory of memories) {
      if (memory.validated === false) continue;
      if (memory.validity === 'rejected' || memory.validity === 'superseded') continue;
      if (memory.fact_key) {
        const current = latestByFact.get(memory.fact_key);
        // Current-truth owner is chosen by (truth class, event time) — never
        // by append order, so an older event arriving late cannot replace a
        // newer accepted fact.
        const better = current === undefined
          || classRank(memory) > classRank(current)
          || (classRank(memory) === classRank(current) && memory.ts > current.ts);
        if (better) latestByFact.set(memory.fact_key, memory);
      }
      for (const target of memory.supersedes ?? []) superseded.add(target);
    }
    return memories.filter(memory => {
      if (memory.validated === false) return false;
      if (memory.validity === 'rejected' || memory.validity === 'superseded') return false;
      if (superseded.has(memory.session_id) || (memory.fact_key && superseded.has(memory.fact_key))) return false;
      if (memory.fact_key && latestByFact.get(memory.fact_key)?.session_id !== memory.session_id) return false;
      return true;
    });
  }

  async function buildIdf(memories) {
    const df = new Map();
    const N = memories.length;
    // DF over union of all per-field terms
    for (const m of memories) {
      const seen = new Set();
      for (const fieldTf of memoryFieldTfs(m, WEIGHTS).values()) {
        for (const term of fieldTf.keys()) {
          if (seen.has(term)) continue;
          seen.add(term);
          df.set(term, (df.get(term) || 0) + 1);
        }
      }
    }
    const idf = new Map();
    for (const [term, c] of df) {
      idf.set(term, Math.log(1 + (N - c + 0.5) / (c + 0.5)));
    }
    return idf;
  }

  async function recall(query, opts) {
    const topN = Math.min(Math.max(Number(opts?.topN ?? 5), 1), 5);
    const budgetTokens = Math.min(Math.max(Number(opts?.budgetTokens ?? BUDGET_TOKENS), 64), BUDGET_TOKENS);
    const loaded = await loadMemories();
    const memories = activeMemories(loaded.memories);
    if (memories.length === 0) return { hits: [], degraded: loaded.degraded, reason: loaded.reason ?? 'no active memories', approxTokens: 0 };
    const idf = await buildIdf(memories);
    const qTokens = tokenize(query);
    if (qTokens.length === 0) return { hits: [], degraded: true, reason: 'empty query', approxTokens: 0 };
    const qTf = termFreq(qTokens);
    const scored = memories.map(m => {
      const fieldTfs = memoryFieldTfs(m, WEIGHTS);
      return { memory: m, score: scoreMemory(fieldTfs, WEIGHTS, qTf, idf) };
    }).filter(s => s.score > 0);
    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, topN);
    const hits = top.map(s => ({
      session_id: s.memory.session_id,
      ts: s.memory.ts,
      intent: s.memory.intent,
      summary: s.memory.summary,
      skills_invoked: s.memory.skills_invoked || [],
      files_touched: s.memory.files_touched || [],
      outcome: s.memory.outcome,
      ...(s.memory.fact_key ? { fact_key: s.memory.fact_key } : {}),
      ...(s.memory.validity ? { validity: s.memory.validity } : {}),
      ...(s.memory.evidence_ref ? { evidence_ref: s.memory.evidence_ref } : {}),
      score: Math.round(s.score * 100) / 100
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
    const loaded = await loadMemories();
    return { count: loaded.memories.length, file: memFile, lastTs: loaded.memories.length ? loaded.memories[loaded.memories.length - 1].ts : null, degraded: loaded.degraded, reason: loaded.reason };
  }

  return { recall, remember, status };
}
