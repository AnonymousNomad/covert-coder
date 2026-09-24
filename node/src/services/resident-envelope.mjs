// node/src/services/resident-envelope.mjs
//
// RESIDENT AWARENESS LAYER — SLICE 3: Awareness Envelope Compiler + shadow SOP selection protocol.
//
// READ-ONLY composition facility. It assembles the minimal bounded Resident
// awareness envelope from already-derived inputs (constitution, continuity,
// task authority/evidence, compact arsenal summary, validated SOP bodies, and an
// optionally budgeted capability-detail projection). It also owns the shadow
// selection protocol: prompt construction, untrusted-selection validation, and
// the bounded fallback rule.
//
// Boundaries: no prompt integration, no route, no authority, no new engine.
// Bulk injection is structurally prohibited (guards + hard envelope budget).
// Model-selected identifiers are never used as filesystem paths.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tokenize, bigrams } from './skills-loader.mjs';
import { DEFAULT_CANDIDATE_LIMIT, MAX_SELECTED_BODIES } from './resident-sops.mjs';
import { filterArsenalDescriptors, DEFAULT_FILTER_LIMIT } from './resident-arsenal-query.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');

export const ENVELOPE_SECTION_ORDER = Object.freeze([
  'CONSTITUTION',
  'CONTINUITY',
  'TASK_AUTHORITY',
  'TASK_EVIDENCE',
  'ARSENAL_SUMMARY',
  'CANDIDATE_METADATA',
  'SOP_BODIES',
  'CAPABILITY_DETAILS',
  'OPERATOR_REQUEST'
]);

export const ENVELOPE_TYPICAL_MAX_TOKENS = 1000;
export const ENVELOPE_HARD_MAX_TOKENS = 1500;
export const CAPABILITY_DETAIL_BUDGET_TOKENS = 300;
export const MAX_DETAIL_DESCRIPTORS = 25;
export const MAX_REQUEST_CHARACTERS = 4000;
export const MAX_CAPABILITY_INPUT_DESCRIPTORS = 500;
export const FALLBACK_TOP1_MIN_SCORE = 5.0;

export class ResidentEnvelopeError extends Error {
  constructor(code, message, detail = null) {
    super(message);
    this.name = 'ResidentEnvelopeError';
    this.code = code;
    if (detail !== null) this.detail = detail;
  }
}

let estimatorPromise = null;
async function tokensOf(text) {
  if (estimatorPromise === null) estimatorPromise = import('./history-fit.ts').then(mod => mod.estimateTokens);
  const estimateTokens = await estimatorPromise;
  return estimateTokens(text);
}

function sectionText(section) {
  return section.title ? section.title + '\n' + section.text : section.text;
}

function renderArsenalSummary(summary) {
  const kinds = Object.entries(summary.by_kind ?? {}).map(([kind, count]) => kind + ' ' + count).join(', ');
  const availability = Object.entries(summary.by_availability ?? {}).map(([state, count]) => state + ' ' + count).join(', ');
  return 'total: ' + summary.total + ' | kinds: ' + (kinds || 'none') + ' | availability: ' + (availability || 'none');
}

function renderCandidateMetadata(candidates) {
  return candidates.map((candidate, index) => {
    const triggers = Array.isArray(candidate.use_when) ? candidate.use_when.slice(0, 3).join('; ') : '';
    return (index + 1) + '. ' + candidate.id + ' — ' + candidate.purpose + (triggers ? ' (use when: ' + triggers + ')' : '');
  }).join('\n');
}

const AVAILABILITY_RANK = Object.freeze({
  READY: 0, RUNNING: 1, STARTING: 2, CONNECTING: 3, DEGRADED: 4, STOPPED: 5
});

// Only canonical descriptor fields may enter the envelope: extra fields supplied
// by a caller are dropped (defense against arbitrary content injection).
const DESCRIPTOR_KEYS = Object.freeze(['id', 'kind', 'availability', 'location', 'category', 'capabilities', 'roles', 'context_limit', 'read_only']);
function sanitizeDescriptor(descriptor) {
  const clean = {};
  for (const key of DESCRIPTOR_KEYS) {
    if (descriptor[key] !== undefined) clean[key] = descriptor[key];
  }
  return clean;
}

export async function selectCapabilityDetails(descriptors, { budgetTokens = CAPABILITY_DETAIL_BUDGET_TOKENS, maxDescriptors = MAX_DETAIL_DESCRIPTORS } = {}) {
  if (!Array.isArray(descriptors)) throw new ResidentEnvelopeError('INVALID_INPUT', 'capability descriptors must be an array');
  if (!Number.isInteger(budgetTokens) || budgetTokens < 1 || budgetTokens > CAPABILITY_DETAIL_BUDGET_TOKENS) {
    throw new ResidentEnvelopeError('CAPABILITY_BUDGET', 'capability detail budget must be 1..' + CAPABILITY_DETAIL_BUDGET_TOKENS + ' tokens (requested ' + budgetTokens + ')');
  }
  const ordered = descriptors.slice().sort((a, b) => {
    const rankA = AVAILABILITY_RANK[a.availability] ?? 6;
    const rankB = AVAILABILITY_RANK[b.availability] ?? 6;
    if (rankA !== rankB) return rankA - rankB;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  const selected = [];
  let omitted = 0;
  for (const descriptor of ordered) {
    if (selected.length >= maxDescriptors) { omitted += 1; continue; }
    const clean = sanitizeDescriptor(descriptor);
    const candidate = [...selected, clean];
    const tokens = await tokensOf(JSON.stringify(candidate));
    if (tokens > budgetTokens) { omitted += 1; continue; }
    selected.push(clean);
  }
  return {
    selected,
    omitted,
    tokens: await tokensOf(JSON.stringify(selected)),
    characters: JSON.stringify(selected).length,
    budget: budgetTokens,
    considered: ordered.length
  };
}

export function buildSopSelectionPrompt({ request, candidates, continuity = null }) {
  if (typeof request !== 'string' || request.trim() === '') throw new ResidentEnvelopeError('REQUEST_REQUIRED', 'operator request is required');
  if (!Array.isArray(candidates)) throw new ResidentEnvelopeError('INVALID_INPUT', 'candidates must be an array');
  if (candidates.length > DEFAULT_CANDIDATE_LIMIT) throw new ResidentEnvelopeError('CANDIDATE_BULK', 'selection prompt accepts at most ' + DEFAULT_CANDIDATE_LIMIT + ' candidates');
  if (candidates.length === 0) return null;
  const state = typeof continuity === 'string' && continuity.trim() !== '' ? continuity.trim() : 'UNKNOWN (not supplied)';
  return [
    '[TASK]',
    request.trim(),
    '',
    '[CANONICAL STATE]',
    state,
    '',
    '[RESIDENT METHODOLOGY CANDIDATES]',
    renderCandidateMetadata(candidates),
    '',
    'Reply with up to ' + Math.min(2, candidates.length) + ' line(s), exactly this form, no other text:',
    'SELECT: resident.<id>'
  ].join('\n');
}

export async function parseAndValidateSopSelection(text, candidates, { catalog, root = REPO_ROOT, maxSelected = 2 } = {}) {
  const rejected = [];
  const selected = [];
  if (typeof text !== 'string' || text.trim() === '') return { selected, rejected, status: 'NO_SELECTION', raw: [] };
  const matches = [...text.matchAll(/SELECT:\s*([A-Za-z0-9._/-]+)/gi)].map(match => match[1]);
  if (matches.length === 0) return { selected, rejected, status: 'NO_SELECTION', raw: [] };
  const source = catalog ?? null;
  const candidateIds = new Set(candidates.map(candidate => candidate.id));
  for (const raw of matches) {
    if (raw.includes('/') || raw.includes('..')) { rejected.push({ id: raw, reason: 'PATH_MATERIAL' }); continue; }
    if (!raw.startsWith('resident.')) { rejected.push({ id: raw, reason: 'NOT_RESIDENT_NAMESPACE' }); continue; }
    const sop = source ? source.sops.find(entry => entry.id === raw) : null;
    if (source && !sop) { rejected.push({ id: raw, reason: 'UNKNOWN_ID' }); continue; }
    if (!candidateIds.has(raw)) { rejected.push({ id: raw, reason: 'NOT_IN_CANDIDATE_SET' }); continue; }
    if (selected.includes(raw)) { rejected.push({ id: raw, reason: 'DUPLICATE' }); continue; }
    if (selected.length >= maxSelected) { rejected.push({ id: raw, reason: 'OVER_CAP' }); continue; }
    if (sop) {
      try {
        await fs.access(path.join(root, sop.body_ref));
      } catch {
        rejected.push({ id: raw, reason: 'BODY_UNAVAILABLE' });
        continue;
      }
    }
    selected.push(raw);
  }
  const status = selected.length === 0 ? 'ALL_REJECTED' : (rejected.length > 0 ? 'PARTIAL' : 'OK');
  return { selected, rejected, status, raw: matches };
}

export function resolveSopFallback({ candidates = [], discovery = null, minScore = FALLBACK_TOP1_MIN_SCORE } = {}) {
  if (candidates.length === 0) return { mode: 'ESCALATE', ids: [], reason: 'no candidates retrieved' };
  if (discovery && discovery.fallback === true) {
    return { mode: 'TOP1', ids: [candidates[0].id], reason: 'deterministic status/reporting default (no-token request class)' };
  }
  const top = typeof candidates[0].score === 'number' ? candidates[0].score : 0;
  if (top >= minScore) return { mode: 'TOP1', ids: [candidates[0].id], reason: 'retrieval evidence strong (top score ' + top + ')' };
  return { mode: 'ESCALATE', ids: [], reason: 'retrieval evidence weak (top score ' + top + '); no SOP loaded' };
}

export async function compileAwarenessEnvelope({
  operatorRequest,
  constitution,
  continuityProjection = null,
  taskAuthority = null,
  taskEvidence = null,
  arsenalSummary = null,
  sopCandidates = [],
  sopBodies = [],
  includeCandidateMetadata = false,
  capability = null
} = {}, { root = REPO_ROOT } = {}) {
  if (typeof operatorRequest !== 'string' || operatorRequest.trim() === '') throw new ResidentEnvelopeError('REQUEST_REQUIRED', 'operator request is required');
  if (operatorRequest.length > MAX_REQUEST_CHARACTERS) throw new ResidentEnvelopeError('REQUEST_TOO_LARGE', 'operator request exceeds ' + MAX_REQUEST_CHARACTERS + ' characters');
  if (!constitution || typeof constitution.text !== 'string' || constitution.text.trim() === '') throw new ResidentEnvelopeError('INVALID_INPUT', 'constitution text is required');
  if (!Array.isArray(sopCandidates) || sopCandidates.length > DEFAULT_CANDIDATE_LIMIT) throw new ResidentEnvelopeError('CANDIDATE_BULK', 'at most ' + DEFAULT_CANDIDATE_LIMIT + ' SOP candidates may enter the envelope');
  if (!Array.isArray(sopBodies) || sopBodies.length > MAX_SELECTED_BODIES) throw new ResidentEnvelopeError('BODY_BULK', 'at most ' + MAX_SELECTED_BODIES + ' SOP bodies may enter the envelope');
  const candidateIds = new Set(sopCandidates.map(candidate => candidate.id));
  for (const body of sopBodies) {
    if (!body || typeof body.id !== 'string' || !candidateIds.has(body.id)) {
      throw new ResidentEnvelopeError('BODY_NOT_IN_CANDIDATES', 'SOP body must belong to the candidate set: ' + (body ? body.id : 'unknown'));
    }
  }

  let capabilitySection = null;
  if (capability !== null) {
    if (!capability || !Array.isArray(capability.descriptors)) throw new ResidentEnvelopeError('INVALID_INPUT', 'capability.descriptors must be an array');
    if (capability.descriptors.length > MAX_CAPABILITY_INPUT_DESCRIPTORS) throw new ResidentEnvelopeError('ARSENAL_BULK', 'capability input exceeds ' + MAX_CAPABILITY_INPUT_DESCRIPTORS + ' descriptors');
    const budget = capability.budgetTokens ?? CAPABILITY_DETAIL_BUDGET_TOKENS;
    if (budget > CAPABILITY_DETAIL_BUDGET_TOKENS) throw new ResidentEnvelopeError('CAPABILITY_BUDGET', 'capability detail budget may not exceed ' + CAPABILITY_DETAIL_BUDGET_TOKENS + ' tokens');
    const filtered = filterArsenalDescriptors(capability.descriptors, capability.filter ?? {}, { limit: DEFAULT_FILTER_LIMIT });
    const details = await selectCapabilityDetails(filtered.returned, { budgetTokens: budget });
    capabilitySection = {
      matched: filtered.matched,
      filtered: filtered.returned.length,
      truncated: filtered.truncated,
      ...details
    };
    capabilitySection.text = details.selected.length > 0
      ? details.selected.map(descriptor => JSON.stringify(descriptor)).join('\n') + (details.omitted > 0 ? '\n(' + details.omitted + ' matching descriptors omitted by budget)' : '')
      : '';
  }

  const rawSections = [];
  rawSections.push({ id: 'CONSTITUTION', title: null, text: constitution.text.trim() });
  if (typeof continuityProjection === 'string' && continuityProjection.trim() !== '') rawSections.push({ id: 'CONTINUITY', title: '[CANONICAL CONTINUITY — system-owned; UNKNOWN means unavailable]', text: continuityProjection.trim() });
  if (typeof taskAuthority === 'string' && taskAuthority.trim() !== '') rawSections.push({ id: 'TASK_AUTHORITY', title: '[TASK-SCOPED AUTHORITY]', text: taskAuthority.trim() });
  if (typeof taskEvidence === 'string' && taskEvidence.trim() !== '') rawSections.push({ id: 'TASK_EVIDENCE', title: '[TASK-SCOPED EVIDENCE]', text: taskEvidence.trim() });
  if (arsenalSummary !== null) rawSections.push({ id: 'ARSENAL_SUMMARY', title: '[ARSENAL — compact summary]', text: renderArsenalSummary(arsenalSummary) });
  if (includeCandidateMetadata && sopCandidates.length > 0) rawSections.push({ id: 'CANDIDATE_METADATA', title: '[RESIDENT METHODOLOGY CANDIDATES — selection stage]', text: renderCandidateMetadata(sopCandidates) });
  if (sopBodies.length > 0) rawSections.push({ id: 'SOP_BODIES', title: '[RESIDENT METHODOLOGY — selected]', text: sopBodies.map(body => String(body.body).trim()).join('\n\n--- SOP BOUNDARY ---\n\n') });
  if (capabilitySection !== null && capabilitySection.text !== '') rawSections.push({ id: 'CAPABILITY_DETAILS', title: '[CAPABILITY DETAILS — bounded]', text: capabilitySection.text });
  rawSections.push({ id: 'OPERATOR_REQUEST', title: '[OPERATOR REQUEST]', text: operatorRequest.trim() });

  const sections = [];
  for (const section of rawSections) {
    const text = sectionText(section);
    sections.push({ id: section.id, title: section.title, text: section.text, tokens: await tokensOf(text), characters: text.length });
  }
  const ordered = ENVELOPE_SECTION_ORDER.filter(id => sections.some(section => section.id === id));
  sections.sort((a, b) => ordered.indexOf(a.id) - ordered.indexOf(b.id));
  const text = sections.map(sectionText).join('\n\n');
  const systemText = sections.filter(section => section.id !== 'OPERATOR_REQUEST').map(sectionText).join('\n\n');
  const measurements = {
    total_tokens: await tokensOf(text),
    system_tokens: await tokensOf(systemText),
    characters: text.length,
    sections: sections.map(section => ({ id: section.id, tokens: section.tokens, characters: section.characters }))
  };
  if (measurements.total_tokens > ENVELOPE_HARD_MAX_TOKENS) {
    throw new ResidentEnvelopeError('ENVELOPE_BUDGET', 'awareness envelope exceeds the hard maximum (' + measurements.total_tokens + ' > ' + ENVELOPE_HARD_MAX_TOKENS + ' tokens)', { measurements });
  }
  return {
    text,
    systemText,
    sections,
    measurements,
    capability: capabilitySection,
    candidate_metadata_included: includeCandidateMetadata,
    note: 'Resident Awareness Slice 3 compiler output — shadow/evaluation use only; not wired into any live prompt.'
  };
}

export function analyzeEnvelopeDuplication(sections) {
  if (!Array.isArray(sections)) throw new ResidentEnvelopeError('INVALID_INPUT', 'sections must be an array');
  const lineOwners = new Map();
  for (const section of sections) {
    for (const line of String(section.text).split('\n')) {
      const trimmed = line.trim();
      if (trimmed.length < 20) continue;
      if (!lineOwners.has(trimmed)) lineOwners.set(trimmed, new Set());
      lineOwners.get(trimmed).add(section.id);
    }
  }
  const duplicateLines = [];
  for (const [line, owners] of lineOwners) {
    if (owners.size > 1) duplicateLines.push({ line, sections: [...owners] });
  }
  const pairs = [];
  for (let i = 0; i < sections.length; i += 1) {
    for (let j = i + 1; j < sections.length; j += 1) {
      const a = bigrams(tokenize(String(sections[i].text)));
      const b = bigrams(tokenize(String(sections[j].text)));
      let shared = 0;
      for (const phrase of a) if (b.has(phrase)) shared += 1;
      if (shared > 0) pairs.push({ a: sections[i].id, b: sections[j].id, shared_bigrams: shared });
    }
  }
  pairs.sort((x, y) => y.shared_bigrams - x.shared_bigrams);
  return { duplicate_lines: duplicateLines, shared_bigrams: pairs.slice(0, 8) };
}
