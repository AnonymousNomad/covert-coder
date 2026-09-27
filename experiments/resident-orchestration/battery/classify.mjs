// Deterministic Resident failure classifier (MISSION 14).
// Classify BEFORE proposing a repair. MODEL_CAPACITY requires that system
// causes were excluded — the rules below only return it for model-behaviour
// signatures that survive the system checks in the evidence.
export const TAXONOMY = Object.freeze([
  'DISCOVERY', 'CONTEXT', 'CONTRACT', 'SOP', 'SCHEMA', 'ORCHESTRATION', 'WORKER',
  'ADAPTER', 'AUTHORITY', 'EXECUTION', 'VERIFICATION', 'MODEL_CAPACITY', 'RUNTIME_RESOURCE'
]);

const RULES = [
  // Infrastructure / resources first (never a model verdict).
  { class: 'RUNTIME_RESOURCE', test: /EADDRINUSE|ENOSPC|EACCES|out of memory|oom|RAM|not enough free|timeout|timed out|aborted|engine .*(leak|orphan)|taskkill|slot wedge|download stall/i },
  // Wiring/transport between components.
  { class: 'ADAPTER', test: /no authority policy|cannot resolve|empty content|chat template|max_tokens|wrong template|provider unreachable|transport/i },
  // Capability discovery surface.
  { class: 'DISCOVERY', test: /no candidates|discovery (failed|empty)|capability not found|not in the candidate set/i },
  // Context supply.
  { class: 'CONTEXT', test: /state (not provided|missing)|context (missing|truncated)|stale (state|context)|transcript required/i },
  // Methodology selection.
  { class: 'SOP', test: /wrong sop|no sop|methodology (miss|absent)|underrouted/i },
  // Machine-readable output contracts.
  { class: 'SCHEMA', test: /schema (violation|mismatch)|contract shape|invalid payload/i },
  // Sequencing/state transitions.
  { class: 'ORCHESTRATION', test: /wrong order|stage transition|sequence|handoff (lost|mismatch)/i },
  // Worker output quality or behaviour.
  { class: 'WORKER', test: /placeholder|stub|insufficient artifact|tests? fail.*(coder|worker)|reviewer (said|advisory) pass.*fail|advisory over/i },
  // Permission boundary.
  { class: 'AUTHORITY', test: /approval (missing|required|bypassed)|unauthori[sz]ed|executed without/i },
  // Execution faults.
  { class: 'EXECUTION', test: /execution failed|command failed|exit code [1-9]\d*/i },
  // Verification/truth layer.
  { class: 'VERIFICATION', test: /containment (gap|miss)|false[- ]?(pass|success)|veritas (gap|missing)|gate missed/i },
  // Model behaviour surviving system exclusion (explicitly marked by the caller).
  { class: 'MODEL_CAPACITY', test: /model (capacity|behaviour|behavior)|context supplied.*(omitted|missed)|instruction adherence|schema adherence|format adherence/i }
];

export function classifyFailure({ kind = '', detail = '', systemCausesExcluded = false } = {}) {
  const haystack = `${kind} ${detail}`;
  for (const rule of RULES) {
    if (rule.test.test(haystack)) {
      if (rule.class === 'MODEL_CAPACITY' && !systemCausesExcluded) {
        return { class: 'CONTRACT', note: 'MODEL_CAPACITY requires systemCausesExcluded=true', evidence: haystack.slice(0, 160) };
      }
      return { class: rule.class, note: '', evidence: haystack.slice(0, 160) };
    }
  }
  return { class: 'CONTRACT', note: 'unclassified — manual review required', evidence: haystack.slice(0, 160) };
}
