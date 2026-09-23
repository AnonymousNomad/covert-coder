// node/src/services/resident-containment.mjs
//
// CANONICAL LIVE CONTAINMENT — the one governed answer gate for the Resident
// chat path (and the experiment lane). Pipeline:
//
//   RAW MODEL OUTPUT
//     → SAFE TEXT NORMALIZATION (representation-equivalent only)
//     → STRUCTURAL CHECKS (echo / malformed / degeneration / contradiction)
//     → PROTECTED FACT CHECKS (verification recital / execution recital /
//        false success / false allow)
//     → CANONICAL AUTHORITY/EVIDENCE + CAPABILITY CHECK (Arsenal projection)
//     → BOUNDED REGENERATION ONCE (defect-only note, no answer leakage)
//     → REVALIDATE
//     → FINAL OUTPUT or RESIDENT_OUTPUT_UNUSABLE
//
// Evidence: the RAW text is preserved verbatim; detection runs on the
// normalized view; every intervention is journaled with raw + normalized +
// triggered rules + support state + retry + disposition. Canonical owners are
// never replaced (see CANONICAL_SUPPORT_OWNERS).

import { appendFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

export const CONTAINMENT_ENV_FLAG = 'AIDE_RESIDENT_CONTAINMENT';
export function containmentEnabled(env = process.env) {
  return env[CONTAINMENT_ENV_FLAG] !== '0';
}

export const UNUSABLE_TEXT = 'RESIDENT_OUTPUT_UNUSABLE — the previous response did not pass protected-claim containment; no unsafe text was returned.';

export const CANONICAL_SUPPORT_OWNERS = Object.freeze({
  verification: 'Veritas / workflow validators',
  authority: 'Execution Authority / operation policy',
  execution: 'harness / runtime record',
  'source-control': 'observed Git state / execution evidence',
  capability: 'Resident Arsenal canonical projection',
  provider: 'runtime / provider registries',
  artifact: 'filesystem / artifact state where authoritative'
});

export const NOTES = Object.freeze({
  structural: 'previous response was structurally malformed; answer normally',
  fact: 'previous answer asserted unverified state; do not claim verification, execution, or results that are not in the canonical state; answer from canonical state only',
  capability: 'The previous response referenced a capability not present in current canonical Arsenal state. Use only currently available capabilities. Unknown or unavailable capabilities must remain unavailable.',
  tool_call: 'Do not emit tool-call structures in a chat answer; reply in plain text. Tool proposals must go through the Orchestrator and Execution Authority.'
});

// ── Phase 2: safe normalization (representation-equivalent only) ──
export function normalizeText(value) {
  return String(value ?? '')
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2212]/g, '-')
    .replace(/[\u2018\u2019\u201B\u2032]/g, "'")
    .replace(/[\u201C\u201D\u201F\u2033]/g, '"')
    .replace(/[\u00A0\u2007\u202F]/g, ' ');
}

// ── Phase 4a: structural checks (faithful to the frozen Phase-12 logic) ──
const LABELS = ['PASS', 'FAIL', 'PARTIAL', 'INCONCLUSIVE', 'STALE', 'ABSENT', 'WRONG-CANDIDATE', 'CONTRADICTORY'];
function echoDetect(question, text) {
  const q = (question.toLowerCase().match(/[a-z]{4,}/g) ?? []);
  const a = (text.toLowerCase().match(/[a-z]{4,}/g) ?? []);
  if (q.length === 0 || a.length === 0) return { echo: false, reason: null };
  const qSet = new Set(q); const aSet = new Set(a);
  // Live-path guard: the literal-containment rule only applies to real
  // questions (≥3 words). A one-word message ("status") must not make every
  // answer that contains the word look like an echo.
  const literal = question.trim().split(/\s+/).length >= 3 && text.toLowerCase().includes(question.toLowerCase().replace(/[.?!]+$/, ''));
  if (literal) return { echo: true, reason: 'literal-copy' };
  const inter = [...aSet].filter(w => qSet.has(w)).length;
  const aOverlap = inter / aSet.size; const qOverlap = inter / qSet.size;
  const lengthRatio = a.length / Math.max(1, q.length);
  const extraWords = [...aSet].filter(w => !qSet.has(w));
  const newContent = (text.match(/\b(CHG-\d+|\d{2,})\b/g) ?? []).filter(x => !question.includes(x));
  if (aOverlap >= 0.9 && aSet.size >= 4 && extraWords.length === 0 && newContent.length === 0 && lengthRatio <= 1.6) return { echo: true, reason: 'subset-copy-no-answer' };
  if (qOverlap >= 0.85 && lengthRatio <= 1.6 && extraWords.length === 0) return { echo: true, reason: 'question-word-copy' };
  return { echo: false, reason: null };
}
function malformedDetect(text) {
  const t = (text ?? '').trim();
  if (/^\s*[=<>+*/:-]\s*\d+[.,]?\s*$/.test(t)) return true;
  if (/(^|\.\s*)[a-z ]{0,20}[=:]\s*\d+[.,]?\s*$/i.test(t)) return true;
  if (/^\s*[=<>+*/:-]+\s*\d*\s*$/.test(t)) return true;
  const words = (t.match(/[a-z]{3,}/gi) ?? []).length;
  if (words === 0 && /[=<>+*/:-]/.test(t)) return true;
  return false;
}
export function structuralFlags(question, text) {
  const t = (text ?? '').trim();
  const tokens = t.toLowerCase().match(/[a-z0-9-]+/g) ?? [];
  const degenerateFlags = [];
  for (let n = 1; n <= 3; n += 1) {
    for (let i = 0; i + n * 4 <= tokens.length; i += 1) {
      const seq = tokens.slice(i, i + n).join(' '); let c = 1; let j = i + n;
      while (j + n <= tokens.length && tokens.slice(j, j + n).join(' ') === seq) { c += 1; j += n; }
      if (c >= 4) degenerateFlags.push(`repeat-${n}x${c}`);
    }
  }
  for (const l of LABELS) { const c = (t.match(new RegExp(`\\b${l}\\b`, 'gi')) ?? []).length; if (c >= 3) degenerateFlags.push(`label-repeat-${l}x${c}`); }
  const uniq = new Set(tokens);
  if (tokens.length > 20 && uniq.size / tokens.length < 0.3) degenerateFlags.push('low-entropy');
  const echo = echoDetect(question, t);
  return { degenerate: degenerateFlags.length > 0, degenerate_flags: degenerateFlags, echo: echo.echo, echo_reason: echo.reason, malformed: malformedDetect(t), contradiction: false, contradiction_trailing: [] };
}
export const structuralHit = flags => flags.degenerate || flags.echo || flags.malformed || flags.contradiction;

// ── Phase 4b: protected fact checks ──
const FABRICATION = /\b(has been deployed|deployed successfully|shipped successfully|completed successfully|installed successfully|built successfully|all tests passed|package built|install(ed)? succeeded|the install succeeded|(deploy|push|install|migration|cleanup) (succeeded|completed|done)|(change|code|release|build|branch|deployment) (is|are) (live|deployed|shipped|complete|completed)|no further action is required)\b/i;
const FALSE_ALLOW = /(permission granted|you are authorized|approved to deploy|approval granted|you may deploy|you may push|yes,? (i|we) can (deploy|push|install|publish|ship)|yes,? (deploy|push|install|publish|ship|proceed)|(i|we) can (deploy|push|install|publish|ship) (it|this|that|now)(?![^.]*(after approval|once approved|pending approval|after the operator))|proceeding with (deployment|publication|release|migration|the deploy|the push|the install)|can go live)/i;
export function factCheck(text, canonical = {}) {
  const claims = [];
  for (const h of text.match(/\b[0-9a-f]{7,40}\b/gi) ?? []) claims.push({ claim: h, type: 'hash', owner: 'source-control', status: canonical.commit_hash === 'UNKNOWN' || canonical.commit_hash === undefined ? 'UNVERIFIED' : 'SUPPORTED' });
  for (const ts of text.match(/\b\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2})?/g) ?? []) claims.push({ claim: ts, type: 'timestamp', owner: 'source-control', status: canonical.timestamp === 'UNKNOWN' || canonical.timestamp === undefined ? 'UNVERIFIED' : 'SUPPORTED' });
  for (const [re, key] of [[/\bverified\b/i, 'verified'], [/\bpassed\b/i, 'passed'], [/\bcommitted\b/i, 'committed'], [/\bpushed\b/i, 'pushed']]) {
    if (re.test(text) && !new RegExp(`no\\s+${key}|not\\s+${key}|no commits|no pushes`, 'i').test(text)) claims.push({ claim: key, type: 'state-claim', owner: key === 'verified' || key === 'passed' ? 'verification' : 'source-control', status: canonical.verification === 'SUPPORTED' || canonical.execution === 'SUPPORTED' ? 'SUPPORTED' : 'CONTRADICTED' });
  }
  // Evidence-completeness claims (standing-dogfood Run 2 finding): "the
  // evidence chain is complete" is a verification assertion, not a neutral
  // statement — it must map to canonical verification support.
  if (/(evidence|verification) (chain |record )?(is|was|has been) (complete|present|available|recorded)/i.test(text) && canonical.verification !== 'SUPPORTED') {
    claims.push({ claim: 'evidence-complete', type: 'state-claim', owner: 'verification', status: 'CONTRADICTED' });
  }
  return { claims, fail_closed: claims.some(c => c.status !== 'SUPPORTED') };
}

// ── Phase 7: bounded capability assertion check (canonical Arsenal truth) ──
const ASSERT_VERB = /(is available|are available|can handle|can be used|supports|is installed|is registered|exists|use |using |select |choose |delegate to )/i;
// Live-stream acceptance repair (2026-09-21): the stream path exposed three
// containment gaps — an invented NAMED capability ("Sandbox 2"), the
// "migration-specific capability" phrasing (noun missing; "recommended" wrongly
// skipped the sentence as hypothetical), and "the release is ready for
// production". The families below close those exact classes.
const STATE_CLAIM_FAMILY = /\b(change|code|release|build|branch|deployment|feature|fix) (is|are) (live|deployed|shipped|complete|completed|ready|safe|stable)\b|\bready for (production|release|deployment|shipping)\b|\b(project|workflow|stage|state) (has been|was|is) (moved|promoted|advanced|transitioned|updated) to\b/i;
const INVENTED_NAMED_CAPABILITY = /\b(the|an?) [a-z-]* ?(sandbox|service|daemon|server|cli|tool|plugin|skill|capability)\b[^.]{0,30}\b(is|are|exists|available)\b/i;
const HYPOTHETICAL = /\b(would|could|if|need|needs|required?|should|consider|when|plan|propose|suggest|expect|might|may)\b/i;
const NEGATIVE = /\b(no|not|isn't|doesn't|does not|unavailable|absent|missing|without|never|none|cannot|can't)\b/i;
const CAPABILITY_NOUN = /\b(plugin|tool|model|workflow|provider|runtime|endpoint|adapter|mcp|skill|sandbox|service|daemon|server|binary|cli|package|library|capability)\b/i;
const CAPABILITY_PHRASE = /\bthe ((?:[a-z][\w-]* ){0,3})(plugin|tool|model|workflow|provider|runtime|endpoint|adapter|mcp|skill|sandbox|service|daemon|server|binary|cli|package|library|capability)\b/gi;
// Heads that describe generic product functions rather than a specific
// (possibly invented) named capability; these do not by themselves indicate an
// unsupported claim.
const CANONICAL_CAPABILITY_HEADS = new Set(['verification', 'evidence', 'memory', 'workflow', 'orchestration', 'planning', 'coding', 'testing', 'search', 'chat', 'context', 'continuity', 'status', 'review', 'local', 'cloud', 'model']);
export function capabilityClaims(text, projection) {
  const unsupported = [];
  const contradicted = [];
  const supported = [];
  if (!projection || !Array.isArray(projection.descriptors)) return { unsupported, contradicted, supported, checked: false };
  const descriptors = projection.descriptors;
  const idSet = new Set(descriptors.map(d => d.id.toLowerCase()));
  const tokenSet = new Set();
  for (const d of descriptors) for (const token of d.id.toLowerCase().split(/[.\-_/]+/)) if (token.length >= 3) tokenSet.add(token);
  const notReady = new Set(descriptors.filter(d => d.availability !== 'READY').map(d => d.id.toLowerCase()));
  const sentences = String(text ?? '').split(/(?<=[.!?])\s+/);
  for (const sentence of sentences) {
    const hypothetical = HYPOTHETICAL.test(sentence) || NEGATIVE.test(sentence);
    const asserts = ASSERT_VERB.test(sentence) && CAPABILITY_NOUN.test(sentence);
    if (asserts) {
      for (const match of sentence.matchAll(/\b(model-\d+)\b/gi)) {
        const id = match[1].toLowerCase();
        if (!idSet.has(id)) { unsupported.push({ claim: match[1], kind: 'fabricated-id', sentence: sentence.slice(0, 160) }); continue; }
        if (notReady.has(id)) contradicted.push({ claim: match[1], kind: 'not-ready', sentence: sentence.slice(0, 160) });
        else supported.push({ claim: match[1], kind: 'ready' });
      }
    }
    // Phrase rule (a claim detector in itself): "the <modifiers> <capability-noun>".
    for (const match of sentence.matchAll(CAPABILITY_PHRASE)) {
      if (hypothetical) continue;
      const phrase = (match[1] + match[2]).trim().toLowerCase();
      const words = phrase.split(/[\s-]+/).filter(word => word.length >= 3);
      if ([...idSet].some(id => phrase.includes(id))) continue;
      const head = words.length >= 2 ? words[words.length - 2] : words[words.length - 1];
      if (idSet.has(head) || tokenSet.has(head) || CANONICAL_CAPABILITY_HEADS.has(head)) continue;
      unsupported.push({ claim: match[0].trim(), kind: 'unknown-capability', sentence: sentence.slice(0, 160) });
    }
    // Invented NAMED capability: "The AIDE sandbox is Sandbox 2 …" — an
    // existence/identity assertion about a named non-canonical capability.
    if (!hypothetical && INVENTED_NAMED_CAPABILITY.test(sentence)) {
      const match = INVENTED_NAMED_CAPABILITY.exec(sentence);
      const near = match[0].toLowerCase();
      const canonicalNear = [...idSet].some(id => near.includes(id)) || [...CANONICAL_CAPABILITY_HEADS].some(head => near.includes(head));
      if (!canonicalNear) unsupported.push({ claim: match[0].trim().slice(0, 80), kind: 'invented-named-capability', sentence: sentence.slice(0, 160) });
    }
    // State-claim family on the STREAM path: "the release is ready for production".
    if (!hypothetical && STATE_CLAIM_FAMILY.test(sentence)) {
      const match = STATE_CLAIM_FAMILY.exec(sentence);
      unsupported.push({ claim: match[0].trim().slice(0, 80), kind: 'state-claim', sentence: sentence.slice(0, 160) });
    }
    if (asserts) {
      for (const descriptor of descriptors) {
        if (!sentence.toLowerCase().includes(descriptor.id.toLowerCase())) continue;
        if (notReady.has(descriptor.id.toLowerCase()) && /(is available|are available|is installed|is registered|supports|can handle)/i.test(sentence)) {
          contradicted.push({ claim: descriptor.id, kind: 'not-ready-asserted', sentence: sentence.slice(0, 160) });
        }
      }
    }
  }
  return { unsupported, contradicted, supported, checked: true };
}

// ── Phase 4c: decision + bounded regeneration ──
export function gateDecision({ requestText = '', text = '', projection = null, canonical = {} } = {}) {
  const normalized = normalizeText(text);
  const structural = structuralFlags(requestText, normalized);
  const fact = factCheck(normalized, canonical);
  // Protected phrasing is only a violation when canonical state does NOT
  // support it (Phase 6: protected assertions map to canonical owners).
  const fabrication = FABRICATION.test(normalized) && canonical.execution !== 'SUPPORTED';
  const falseAllow = FALSE_ALLOW.test(normalized) && canonical.authority !== 'APPROVED';
  const capability = capabilityClaims(normalized, projection);
  // Native tool-call emission in a chat answer (standing-dogfood Run 2
  // finding): the model must propose through text; tool structures belong to
  // the Orchestrator/Execution Authority path.
  const toolCall = /<\|tool_call_(start|end)\|>/.test(normalized);
  const triggers = [];
  if (structuralHit(structural)) triggers.push('structural');
  if (toolCall) triggers.push('tool-call');
  if (fact.fail_closed) triggers.push('fact-check');
  if (fabrication) triggers.push('fabrication');
  if (falseAllow) triggers.push('false-allow');
  if (capability.unsupported.length > 0) triggers.push('capability-unsupported');
  if (capability.contradicted.length > 0) triggers.push('capability-contradicted');
  const reason = structuralHit(structural) ? NOTES.structural : toolCall ? NOTES.tool_call : (capability.unsupported.length > 0 || capability.contradicted.length > 0) ? NOTES.capability : (fact.fail_closed || fabrication || falseAllow) ? NOTES.fact : null;
  return {
    normalized,
    structural,
    fact,
    fabrication,
    false_allow: falseAllow,
    tool_call: toolCall,
    capability,
    triggers,
    support: { owners: CANONICAL_SUPPORT_OWNERS, claims: fact.claims },
    regenerate: triggers.length > 0,
    reason
  };
}

export async function governAnswer({ requestText = '', rawText = '', generate = null, projection = null, canonical = {} } = {}) {
  const first = gateDecision({ requestText, text: rawText, projection, canonical });
  const record = {
    at: new Date().toISOString(),
    request: String(requestText).slice(0, 200),
    raw: String(rawText),
    normalized: first.normalized,
    triggers: first.triggers,
    support: first.support,
    capability: { unsupported: first.capability.unsupported, contradicted: first.capability.contradicted },
    retry: null,
    disposition: 'OK'
  };
  if (!first.regenerate) return { ...record, final: rawText };
  if (typeof generate !== 'function') {
    record.disposition = 'RESIDENT_OUTPUT_UNUSABLE';
    return { ...record, final: UNUSABLE_TEXT };
  }
  const retryText = await generate(first.reason);
  const second = gateDecision({ requestText, text: retryText, projection, canonical });
  record.retry = { note: first.reason, raw: String(retryText), normalized: second.normalized, triggers: second.triggers };
  if (second.regenerate) {
    record.disposition = 'RESIDENT_OUTPUT_UNUSABLE';
    return { ...record, final: UNUSABLE_TEXT };
  }
  record.disposition = 'REGENERATED';
  return { ...record, final: retryText };
}

// ── Phase 5: live evidence journal (.aide/logs/containment.jsonl) ──
export function logContainment(workspace, record) {
  if (!workspace || !record) return;
  try {
    const dir = path.join(workspace, '.aide', 'logs');
    mkdirSync(dir, { recursive: true });
    appendFileSync(path.join(dir, 'containment.jsonl'), JSON.stringify({
      at: record.at,
      request: record.request,
      disposition: record.disposition,
      triggers: record.triggers,
      raw: String(record.raw).slice(0, 1200),
      normalized: String(record.normalized).slice(0, 1200),
      retry: record.retry ? { note: record.retry.note, raw: String(record.retry.raw).slice(0, 1200), triggers: record.retry.triggers } : null,
      capability: record.capability,
      support_owners: CANONICAL_SUPPORT_OWNERS
    }) + '\n', 'utf8');
  } catch {
    // Evidence journaling must never break the answer path.
  }
}
