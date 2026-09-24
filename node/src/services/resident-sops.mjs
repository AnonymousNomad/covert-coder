// node/src/services/resident-sops.mjs
//
// RESIDENT AWARENESS LAYER — SLICE 2: Resident SOP namespace + bounded methodology discovery.
//
// READ-ONLY facilities over the canonical resident namespace (skills/resident-sops/):
// catalog metadata, compact candidate discovery (metadata only, never bodies), lazy
// body loading by id, and the tiny Resident Constitution. No prompt integration, no
// authority, no new skill engine.
//
// Reuse: candidate ranking reuses the shared tokenization + phrase primitives and the
// IDF weighting model from node/src/services/skills-loader.mjs (the one general skill
// router). This module ranks only the resident.* namespace catalog; it is not a second
// general router and it never touches the shared skill registry.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tokenize, bigrams } from './skills-loader.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
// node/src/services -> repo root is THREE levels up (services -> src -> node -> repo).
const REPO_ROOT = path.resolve(HERE, '..', '..', '..');

export const RESIDENT_NAMESPACE = 'resident';
export const RESIDENT_SOPS_DIR = 'skills/resident-sops';
export const DEFAULT_CANDIDATE_LIMIT = 3;
export const MAX_SELECTED_BODIES = 2;
export const DEFAULT_FALLBACK_IDS = Object.freeze(['resident.report-status', 'resident.recommend-next-step']);
// Thresholds recalibrated for the 23-document resident namespace: the loader's
// 2.5/1.8 floors are tuned for the 292-skill corpus, where IDF magnitudes are larger.
// Measured against the routing matrix and negative battery (see Slice-2 report).
export const MIN_SCORE = 2.2;
export const MIN_IDF = 1.6;

const ID_WEIGHT = 3.0;
const DESC_WEIGHT = 1.0;
const PHRASE_WEIGHT = 2.0;

export class ResidentSopError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ResidentSopError';
    this.code = code;
  }
}

function sopsRoot(root) {
  return path.join(root, RESIDENT_SOPS_DIR);
}

export async function loadResidentCatalog({ root = REPO_ROOT } = {}) {
  const catalogPath = path.join(sopsRoot(root), 'catalog.json');
  let parsed;
  try {
    parsed = JSON.parse(await fs.readFile(catalogPath, 'utf8'));
  } catch (error) {
    throw new ResidentSopError('CATALOG_UNAVAILABLE', 'resident SOP catalog unavailable: ' + error.message);
  }
  if (!parsed || !Array.isArray(parsed.sops)) throw new ResidentSopError('CATALOG_INVALID', 'resident SOP catalog is invalid');
  const seen = new Set();
  for (const sop of parsed.sops) {
    if (!sop || typeof sop.id !== 'string' || !sop.id.startsWith(RESIDENT_NAMESPACE + '.')) {
      throw new ResidentSopError('CATALOG_INVALID', 'resident SOP id must use the resident.* namespace');
    }
    if (sop.role !== 'resident') throw new ResidentSopError('CATALOG_INVALID', 'resident SOP role must be resident: ' + sop.id);
    if (seen.has(sop.id)) throw new ResidentSopError('CATALOG_INVALID', 'duplicate resident SOP id: ' + sop.id);
    seen.add(sop.id);
    if (typeof sop.body_ref !== 'string' || !sop.body_ref.startsWith(RESIDENT_SOPS_DIR + '/') || sop.body_ref.includes('..')) {
      throw new ResidentSopError('CATALOG_INVALID', 'resident SOP body_ref must stay inside ' + RESIDENT_SOPS_DIR + ': ' + sop.id);
    }
  }
  return parsed;
}

export async function loadResidentConstitution({ root = REPO_ROOT } = {}) {
  const file = path.join(sopsRoot(root), 'constitution.md');
  let text;
  try {
    text = await fs.readFile(file, 'utf8');
  } catch (error) {
    throw new ResidentSopError('CONSTITUTION_UNAVAILABLE', 'resident constitution unavailable: ' + error.message);
  }
  const { estimateTokens } = await import('./history-fit.ts');
  return { text, tokens: estimateTokens(text), ref: RESIDENT_SOPS_DIR + '/constitution.md' };
}

function scoreSops(sops, request) {
  const requestTokens = tokenize(request);
  if (requestTokens.length === 0) return { scored: [], requestTokens };
  const requestPhrases = bigrams(requestTokens);
  const fields = sops.map(sop => {
    const idTokens = tokenize(String(sop.id).replace(/\./g, ' '));
    const descTokens = tokenize([sop.purpose, ...(Array.isArray(sop.use_when) ? sop.use_when : [])].join(' '));
    return { idTokens, descTokens, phrases: bigrams([...idTokens, ...descTokens]) };
  });
  const docFreq = new Map();
  for (const field of fields) {
    for (const token of new Set([...field.idTokens, ...field.descTokens])) docFreq.set(token, (docFreq.get(token) ?? 0) + 1);
  }
  const idf = token => Math.log(1 + (sops.length || 1) / (1 + (docFreq.get(token) ?? 0)));
  const scored = sops.map((sop, index) => {
    const { idTokens, descTokens, phrases } = fields[index];
    let score = 0;
    let peakIdf = 0;
    let phraseHits = 0;
    for (const token of requestTokens) {
      const weight = idTokens.includes(token) ? ID_WEIGHT : descTokens.includes(token) ? DESC_WEIGHT : 0;
      if (weight === 0) continue;
      const w = idf(token);
      if (w > peakIdf) peakIdf = w;
      score += weight * w;
    }
    for (const phrase of requestPhrases) {
      if (phrases.has(phrase)) { phraseHits += 1; score += PHRASE_WEIGHT; }
    }
    const distinctive = peakIdf >= MIN_IDF || phraseHits > 0;
    return { sop, score, distinctive };
  });
  return { scored, requestTokens };
}

export async function discoverResidentSops(request, { root = REPO_ROOT, limit = DEFAULT_CANDIDATE_LIMIT, catalog } = {}) {
  if (typeof request !== 'string' || request.trim() === '') throw new ResidentSopError('INVALID_REQUEST', 'request must be a non-empty string');
  const cap = Math.max(1, Math.min(Number.isInteger(limit) ? limit : DEFAULT_CANDIDATE_LIMIT, DEFAULT_CANDIDATE_LIMIT));
  const source = catalog ?? await loadResidentCatalog({ root });
  const { scored, requestTokens } = scoreSops(source.sops, request);
  if (requestTokens.length === 0) {
    const fallback = source.sops.filter(sop => DEFAULT_FALLBACK_IDS.includes(sop.id)).slice(0, cap);
    return {
      request,
      candidates: fallback,
      count: fallback.length,
      fallback: true,
      reason: 'no usable request tokens; deterministic status/reporting default',
      capped: true
    };
  }
  const picked = scored
    .filter(entry => entry.score >= MIN_SCORE && entry.distinctive)
    .sort((a, b) => (b.score - a.score) || (a.sop.id < b.sop.id ? -1 : 1))
    .slice(0, cap)
    .map(entry => ({ ...entry.sop, score: Math.round(entry.score * 1000) / 1000 }));
  return {
    request,
    candidates: picked,
    count: picked.length,
    fallback: false,
    reason: picked.length === 0 ? 'no resident methodology matched this request' : null,
    capped: true
  };
}

export async function loadResidentSopBody(id, { root = REPO_ROOT, catalog } = {}) {
  if (typeof id !== 'string' || !id.startsWith(RESIDENT_NAMESPACE + '.')) {
    throw new ResidentSopError('INVALID_ID', 'resident SOP id must use the resident.* namespace');
  }
  const source = catalog ?? await loadResidentCatalog({ root });
  const sop = source.sops.find(entry => entry.id === id);
  if (!sop) throw new ResidentSopError('NOT_FOUND', 'unknown resident SOP: ' + id);
  const base = path.resolve(sopsRoot(root));
  const file = path.resolve(root, sop.body_ref);
  if (file !== base && !file.startsWith(base + path.sep)) {
    throw new ResidentSopError('CONTAINMENT', 'resident SOP body escapes its namespace: ' + id);
  }
  let body;
  try {
    body = await fs.readFile(file, 'utf8');
  } catch {
    throw new ResidentSopError('BODY_UNAVAILABLE', 'resident SOP body unavailable: ' + id);
  }
  if (!body.trim()) throw new ResidentSopError('BODY_UNAVAILABLE', 'resident SOP body is empty: ' + id);
  const { estimateTokens } = await import('./history-fit.ts');
  return { id, body, characters: body.length, tokens: estimateTokens(body), body_ref: sop.body_ref };
}

export async function loadResidentSopBodies(ids, { root = REPO_ROOT, catalog, max = MAX_SELECTED_BODIES } = {}) {
  if (!Array.isArray(ids)) throw new ResidentSopError('INVALID_ID', 'ids must be an array');
  if (ids.length > max) {
    throw new ResidentSopError('BODY_CAP_EXCEEDED', 'at most ' + max + ' resident SOP bodies may be loaded per decision (requested ' + ids.length + ')');
  }
  const source = catalog ?? await loadResidentCatalog({ root });
  const bodies = [];
  for (const id of ids) bodies.push(await loadResidentSopBody(id, { root, catalog: source }));
  return bodies;
}
