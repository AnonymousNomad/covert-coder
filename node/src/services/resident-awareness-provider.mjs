// node/src/services/resident-awareness-provider.mjs
//
// RESIDENT AWARENESS LAYER — SLICE 4: live dogfood awareness provider.
//
// Deterministic, bounded, reversible live integration point: builds the
// Resident Awareness envelope block (constitution, canonical continuity,
// task-scoped authority/evidence, compact Arsenal summary, deterministically
// selected resident.* SOP bodies, optional budgeted capability details) for a
// live chat request. It is injected through the EXISTING Context Control
// composer (one optional provider slot); the composer remains the context owner.
//
// NO second Liquid SOP-selection inference (Slice-3 decision, locked).
// Deterministic selection rule:
//   - up to 2 candidates with score >= STRONG_SOP_SCORE (5.0) -> load their bodies
//   - else, for the no-token status class (discovery fallback), load report-status
//   - else load NOTHING (NO-SOP is a valid outcome; no forced methodology)
//
// Enable gate (Slice-5 promotion): DEFAULT ON for internal dogfood; explicit
// disable via AIDE_RESIDENT_AWARENESS=0. Rollback = set '0' and restart; no
// state migration, no alternate runtime.

import { loadResidentCatalog, loadResidentConstitution, discoverResidentSops, loadResidentSopBodies } from './resident-sops.mjs';
import { compactArsenalSummary, filterArsenalDescriptors } from './resident-arsenal-query.mjs';
import { compileAwarenessEnvelope, FALLBACK_TOP1_MIN_SCORE } from './resident-envelope.mjs';
import { OPERATION_POLICY } from '../../../common/security/operation-policy.mjs';

export const AWARENESS_ENV_FLAG = 'AIDE_RESIDENT_AWARENESS';
export const STRONG_SOP_SCORE = FALLBACK_TOP1_MIN_SCORE;
export const SUMMARY_POLICIES = Object.freeze(['always', 'conditional']);
export const STATUS_SOP_ID = 'resident.report-status';

// ── Slice-5 authority routing: canonical operation/authority classification ──
// Operation classes come from the canonical risk taxonomy
// (common/security/operation-policy.mjs). Resident SOPs carry their class in
// the accepted authority_effect field; the mapping below binds the two. The
// guard fails loudly if the canonical taxonomy ever drops a mapped risk.
// Execution Authority remains the sole permission authority — these classes
// are descriptive routing metadata only.
export const AUTHORITY_OPERATION_RISKS = Object.freeze(['execute', 'external', 'permission', 'revoke']);
export const AUTHORITY_CLASS_BY_EFFECT = Object.freeze({
  'may-request-approval': 'permission',
  'requires-authority-state': 'permission',
  'requires-evidence-state': 'evidence'
});
const CANONICAL_OPERATION_RISKS = new Set(Object.values(OPERATION_POLICY));
for (const [effect, operationClass] of Object.entries(AUTHORITY_CLASS_BY_EFFECT)) {
  if (operationClass !== 'evidence' && !CANONICAL_OPERATION_RISKS.has(operationClass)) {
    throw new Error('resident awareness: authority class mapping for ' + effect + ' must use a canonical operation risk');
  }
}
export function canonicalAuthorityOperationKinds() {
  return Object.entries(OPERATION_POLICY)
    .filter(([, risk]) => AUTHORITY_OPERATION_RISKS.includes(risk))
    .map(([kind]) => kind);
}
export function operationClassFor(sop) {
  return AUTHORITY_CLASS_BY_EFFECT[sop?.authority_effect] ?? null;
}
// Request-side directive surface: no canonical free-text operation classifier
// exists in the repository (operation-policy classifies operations by kind;
// the trained intent experts classify system/business/code and
// question/debug/plan/code and mis-classify this battery). This bounded,
// documented detector is the residual request-side signal for the class rule;
// it is tested against the positive/negative authority battery.
const OPERATION_DIRECTIVE_VERB = /\b(deploy|push|install|publish|release|ship|migrate|execute|cleanup|wipe|purge|drop)\b/i;
const EXPLANATORY_MARKER = /\b(explain|why|how|what|show|summarize|describe|document)\b/i;
export function isOperationDirective(task) {
  const text = String(task ?? '');
  if (text.includes('?')) return false;
  if (EXPLANATORY_MARKER.test(text)) return false;
  if (!OPERATION_DIRECTIVE_VERB.test(text)) return false;
  return text.split(/\s+/).filter(Boolean).length <= 12;
}

const CAPABILITY_TRIGGERS = /(model|worker|coder|local|cloud|provider|tool|plugin|install|package|android|build|device|runtime|capability|workflow|availab|what can you do|what do you do)/i;
const DETAIL_FILTERS = Object.freeze([
  { match: /(model|worker|coder|local|cloud|provider)/i, filter: { kind: 'MODEL', availability: 'READY' } },
  { match: /(tool|plugin|install|package|android|build)/i, filter: { kind: 'TOOL', availability: 'READY' } },
  { match: /(workflow)/i, filter: { kind: 'WORKFLOW', availability: 'READY' } },
  { match: /(device|runtime)/i, filter: { kind: 'DEVICE' } }
]);
const TASK_CLASSES = Object.freeze([
  ['status', /(where are we|status|progress)/i],
  ['resume', /(continue|resume|where we left)/i],
  ['onboarding', /(want to|new project|build a|onboard|get started)/i],
  ['worker-failure', /(worker|engine|coder).*(fail|crash)/i],
  ['evidence', /(did.*(pass|verif)|evidence|proof)/i],
  ['authority', /(deploy|push|approve|authoriz|permission)/i],
  ['capability', CAPABILITY_TRIGGERS]
]);

export function awarenessEnabled(env = process.env) {
  // Slice-5 promotion: DEFAULT ON for internal dogfood. Explicit disable via
  // AIDE_RESIDENT_AWARENESS=0 (rollback: set '0' and restart; no migration,
  // no alternate runtime). Any other value (or unset) keeps Awareness enabled.
  return env[AWARENESS_ENV_FLAG] !== '0';
}

export function needsCapabilityDetails(task) {
  return CAPABILITY_TRIGGERS.test(String(task ?? ''));
}

export function capabilityFilterFor(task) {
  const text = String(task ?? '');
  for (const entry of DETAIL_FILTERS) {
    if (entry.match.test(text)) return { ...entry.filter };
  }
  return null;
}

export function classifyTask(task) {
  const text = String(task ?? '');
  for (const [name, pattern] of TASK_CLASSES) {
    if (pattern.test(text)) return name;
  }
  return 'other';
}

export function selectSopsDeterministically(discovery, { strongScore = STRONG_SOP_SCORE, limit = 2 } = {}) {
  const candidates = Array.isArray(discovery?.candidates) ? discovery.candidates : [];
  const strong = candidates.filter(candidate => (candidate.score ?? 0) >= strongScore).slice(0, limit);
  // Class pass (Slice-5): operation directives may load authority/evidence
  // methodology at the retrieval floor — the SOP's canonical operation class
  // (authority_effect) is the class marker; retrieval already established
  // relevance. Non-directive requests never use this pass (over-routing guard).
  const classEligible = isOperationDirective(discovery?.request) ? candidates : [];
  const classRelevant = classEligible
    .filter(candidate => !strong.includes(candidate) && operationClassFor(candidate) !== null)
    .slice(0, limit - strong.length);
  const selected = [...strong, ...classRelevant];
  if (selected.length > 0) {
    const mode = strong.length > 0 ? (classRelevant.length > 0 ? 'strong+class' : 'strong') : 'class';
    return {
      ids: selected.map(candidate => candidate.id),
      mode,
      operation_class: classRelevant.length > 0 ? operationClassFor(classRelevant[0]) : null
    };
  }
  if (discovery?.fallback === true && !needsCapabilityDetails(discovery?.request)) {
    const status = candidates.find(candidate => candidate.id === STATUS_SOP_ID);
    if (status) return { ids: [status.id], mode: 'status-default', operation_class: null };
  }
  return { ids: [], mode: 'none', operation_class: null };
}

export function createResidentAwarenessProvider({
  workspace,
  repoRoot = workspace,
  enabled = null,
  projection = null,
  projectionLoader = null,
  continuity = null,
  taskAuthority = null,
  taskEvidence = null,
  summaryPolicy = 'conditional',
  journalLimit = 50
} = {}) {
  if (typeof workspace !== 'string' || workspace === '') throw new Error('workspace is required');
  if (!SUMMARY_POLICIES.includes(summaryPolicy)) throw new Error('summaryPolicy must be one of ' + SUMMARY_POLICIES.join(', '));
  const isEnabled = enabled === null ? awarenessEnabled() : enabled === true;
  const journal = [];

  let constitutionPromise = null;
  let catalogPromise = null;
  let projectionPromise = null;
  const loadConstitutionOnce = () => constitutionPromise ?? (constitutionPromise = loadResidentConstitution({ root: repoRoot }));
  const loadCatalogOnce = () => catalogPromise ?? (catalogPromise = loadResidentCatalog({ root: repoRoot }));
  const loadProjectionOnce = () => {
    if (projection !== null) return Promise.resolve(projection);
    if (projectionPromise === null) {
      projectionPromise = (async () => {
        if (typeof projectionLoader === 'function') return projectionLoader();
        const { buildArsenalProjection } = await import('./resident-arsenal.mjs');
        return buildArsenalProjection({ workspace, repoRoot });
      })().catch(error => { projectionPromise = null; throw error; });
    }
    return projectionPromise;
  };

  function record(entry) {
    journal.push(entry);
    if (journal.length > journalLimit) journal.shift();
  }

  async function provider(task) {
    const entry = {
      at: new Date().toISOString(),
      enabled: isEnabled,
      task_class: classifyTask(task),
      task: String(task ?? '').slice(0, 200),
      candidates: [],
      selected: [],
      selection_mode: null,
      operation_class: null,
      sop_body_tokens: 0,
      summary_included: false,
      capability: null,
      discovery_ms: 0,
      selection_ms: 0,
      body_ms: 0,
      arsenal_ms: 0,
      injected_tokens: 0,
      envelope_tokens: 0,
      compile_ms: 0,
      degraded: false,
      reason: null
    };
    if (!isEnabled) {
      entry.reason = 'awareness disabled';
      record(entry);
      return '';
    }
    if (typeof task !== 'string' || task.trim() === '') {
      entry.reason = 'empty task';
      record(entry);
      return '';
    }
    const started = Date.now();
    try {
      const [constitution, catalog] = await Promise.all([loadConstitutionOnce(), loadCatalogOnce()]);
      const discoveryStarted = Date.now();
      const discovery = await discoverResidentSops(task, { root: repoRoot, catalog });
      entry.discovery_ms = Date.now() - discoveryStarted;
      entry.candidates = discovery.candidates.map(candidate => ({ id: candidate.id, score: candidate.score ?? null }));
      const selectionStarted = Date.now();
      const selection = selectSopsDeterministically(discovery);
      entry.selection_ms = Date.now() - selectionStarted;
      entry.selected = selection.ids;
      entry.selection_mode = selection.mode;
      entry.operation_class = selection.operation_class ?? null;
      let sopBodies = [];
      if (selection.ids.length > 0) {
        const bodyStarted = Date.now();
        try {
          sopBodies = await loadResidentSopBodies(selection.ids, { root: repoRoot, catalog });
        } catch {
          entry.degraded = true;
          entry.reason = 'selected SOP body unavailable; methodology omitted';
        }
        entry.body_ms = Date.now() - bodyStarted;
      }
      entry.sop_body_tokens = sopBodies.reduce((sum, body) => sum + body.tokens, 0);

      let summary = null;
      let capability = null;
      const wantsSummary = summaryPolicy === 'always' || needsCapabilityDetails(task);
      if (wantsSummary) {
        const arsenalStarted = Date.now();
        try {
          const projectionData = await loadProjectionOnce();
          summary = compactArsenalSummary(projectionData);
          const filter = capabilityFilterFor(task);
          if (filter !== null) {
            const filtered = filterArsenalDescriptors(projectionData.descriptors, filter);
            if (filtered.returned.length > 0) capability = { descriptors: filtered.returned, filter };
          }
        } catch {
          entry.degraded = true;
          entry.reason = 'arsenal projection unavailable; summary omitted';
        }
        entry.arsenal_ms = Date.now() - arsenalStarted;
      }
      entry.summary_included = summary !== null;

      const continuityText = typeof continuity === 'function' ? await continuity() : continuity;
      const base = {
        operatorRequest: task,
        constitution,
        continuityProjection: continuityText ?? null,
        taskAuthority,
        taskEvidence,
        arsenalSummary: summary,
        sopCandidates: discovery.candidates,
        sopBodies
      };
      let envelope;
      try {
        envelope = await compileAwarenessEnvelope({ ...base, capability });
      } catch (error) {
        if (capability !== null) {
          envelope = await compileAwarenessEnvelope({ ...base, capability: null });
          entry.reason = 'capability details dropped by envelope budget';
        } else {
          throw error;
        }
      }
      entry.capability = envelope.capability === null ? null : { selected: envelope.capability.selected.length, omitted: envelope.capability.omitted, tokens: envelope.capability.tokens };
      entry.injected_tokens = envelope.measurements.system_tokens;
      entry.envelope_tokens = envelope.measurements.total_tokens;
      entry.compile_ms = Date.now() - started;
      record(entry);
      return envelope.systemText;
    } catch (error) {
      entry.degraded = true;
      entry.reason = 'awareness build failed: ' + String(error && error.code ? error.code : error).slice(0, 120);
      entry.compile_ms = Date.now() - started;
      record(entry);
      return '';
    }
  }

  return {
    enabled: isEnabled,
    provider,
    getJournal: () => journal.slice(),
    getProjection: loadProjectionOnce,
    _internal: { loadProjectionOnce }
  };
}
