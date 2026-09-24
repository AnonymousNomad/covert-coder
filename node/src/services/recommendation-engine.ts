// node/src/services/recommendation-engine.ts
// Deterministic Recommendation Engine V0. No LLM in the loop. Contextual
// (never a global model ranking): same inputs -> same output, stable order.
import type { IntelligenceEntry } from './intelligence-registry.ts';

export const REASON_CODES = [
  'ROLE_QUALIFIED',
  'ROLE_NOT_QUALIFIED',
  'LOCAL_AVAILABLE',
  'OFFLINE_CAPABLE',
  'LOW_RESOURCE_FIT',
  'RESOURCE_INCOMPATIBLE',
  'LOWER_COST',
  'PAST_PROJECT_SUCCESS',
  'LOW_OPERATOR_INTERVENTION',
  'KNOWN_TOOL_RELIABILITY',
  'KNOWN_REVIEW_STRENGTH',
  'INSUFFICIENT_EVIDENCE'
] as const;
export type ReasonCode = (typeof REASON_CODES)[number];

export const CONFIDENCE_LEVELS = ['QUALIFIED', 'SUPPORTED_BY_LIMITED_EVIDENCE', 'EXPERIMENTAL', 'NO_QUALIFICATION_DATA'] as const;
export type Confidence = (typeof CONFIDENCE_LEVELS)[number];

export interface RecommendationInput {
  role: string;                        // RESIDENT | PLANNER | IMPLEMENTER | REVIEWER | RECON | REPAIR | TOOL_AGENT | SPECIALIST
  localOnly?: boolean;
  offline?: boolean;
  availableRamMb?: number;
  resourceHeadroom?: number;          // fraction of RAM a model may claim (default 0.8)
  costByProvider?: Record<string, number>; // relative cost tier; missing = unknown
  history?: Record<string, { accepted: number; failed: number }>;
  taskClass?: string;
}

export interface CandidateRecommendation {
  id: string;
  display_name: string;
  reasons: ReasonCode[];
  evidence_refs: string[];
  confidence: Confidence;
}

export interface RecommendationResult {
  recommended: CandidateRecommendation[];
  alternatives: CandidateRecommendation[];
  excluded: Array<{ id: string; reasons: ReasonCode[] }>;
}

function roleScore(entry: IntelligenceEntry, role: string): { score: number; reasons: ReasonCode[] } {
  const qualified = entry.qualification.qualified_roles.includes(role);
  const unqualified = entry.qualification.unqualified_roles.includes(role);
  if (qualified) return { score: 3, reasons: ['ROLE_QUALIFIED'] };
  if (unqualified || entry.qualification.state === 'NOT_QUALIFIED') return { score: 0, reasons: ['ROLE_NOT_QUALIFIED'] };
  if (entry.qualification.state === 'TESTED') return { score: 2, reasons: ['INSUFFICIENT_EVIDENCE'] };
  return { score: 1, reasons: ['INSUFFICIENT_EVIDENCE'] };
}

function confidenceFor(entry: IntelligenceEntry): Confidence {
  if (entry.qualification.state === 'QUALIFIED') return 'QUALIFIED';
  if (entry.qualification.state === 'TESTED') return 'SUPPORTED_BY_LIMITED_EVIDENCE';
  if (entry.qualification.state === 'UNTESTED') return 'NO_QUALIFICATION_DATA';
  return 'EXPERIMENTAL';
}

export function recommend(entries: IntelligenceEntry[], input: RecommendationInput): RecommendationResult {
  const headroom = input.resourceHeadroom ?? 0.8;
  const scored: Array<{ entry: IntelligenceEntry; score: number; reasons: ReasonCode[]; cost: number }> = [];
  const excluded: Array<{ id: string; reasons: ReasonCode[] }> = [];

  for (const entry of entries) {
    const reasons: ReasonCode[] = [];
    if (entry.availability === 'UNAVAILABLE') { excluded.push({ id: entry.id, reasons: ['INSUFFICIENT_EVIDENCE'] }); continue; }
    if ((input.localOnly || input.offline) && entry.locality === 'CLOUD') { excluded.push({ id: entry.id, reasons: ['RESOURCE_INCOMPATIBLE'] }); continue; }
    const role = roleScore(entry, input.role);
    if (role.score === 0) { excluded.push({ id: entry.id, reasons: role.reasons }); continue; }
    reasons.push(...role.reasons);
    if (entry.locality === 'LOCAL') reasons.push('LOCAL_AVAILABLE');
    if (input.offline && entry.locality === 'LOCAL') reasons.push('OFFLINE_CAPABLE');
    const requiredRam = entry.resource_requirements?.ram_mb;
    if (requiredRam !== undefined && input.availableRamMb !== undefined) {
      if (requiredRam > input.availableRamMb * headroom) { excluded.push({ id: entry.id, reasons: ['RESOURCE_INCOMPATIBLE'] }); continue; }
      reasons.push('LOW_RESOURCE_FIT');
    }
    const history = input.history?.[entry.id];
    if (history && history.accepted > 0 && history.accepted >= history.failed) reasons.push('PAST_PROJECT_SUCCESS');
    if (entry.known_strengths.includes('tool-use')) reasons.push('KNOWN_TOOL_RELIABILITY');
    if (entry.known_strengths.includes('review')) reasons.push('KNOWN_REVIEW_STRENGTH');
    const cost = input.costByProvider?.[entry.provider] ?? Number.POSITIVE_INFINITY;
    scored.push({ entry, score: role.score, reasons, cost });
  }

  // Deterministic ordering: qualification score desc, local-first when offline
  // requested, cost asc (finite before infinite), then id asc.
  scored.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    if (a.cost !== b.cost) return a.cost - b.cost;
    return a.entry.id < b.entry.id ? -1 : a.entry.id > b.entry.id ? 1 : 0;
  });
  if (scored.length >= 2 && scored[0].cost === scored[1].cost) {
    // equal cost across the top pair: no evidence-backed cost preference
  } else if (scored.length >= 2 && Number.isFinite(scored[1].cost) && scored[1].cost > scored[0].cost) {
    scored[0].reasons.push('LOWER_COST');
  }

  const toCandidate = (row: (typeof scored)[number]): CandidateRecommendation => ({
    id: row.entry.id,
    display_name: row.entry.display_name,
    reasons: [...new Set(row.reasons)],
    evidence_refs: [...new Set([...row.entry.evidence_refs, ...row.entry.qualification.evidence_refs])],
    confidence: confidenceFor(row.entry)
  });

  return {
    recommended: scored.filter(row => row.score >= 2).slice(0, 3).map(toCandidate),
    alternatives: scored.filter(row => row.score < 2).map(toCandidate),
    excluded
  };
}
