# RESIDENT THRESHOLD EXPERIMENT — RESULTS

Date: 2026-09-23 · Lane: Resident qualification (DeepSeek) · Evidence frozen: Liquid at
`1675b36`; pool screens at `648ab75`/`017ca41`; gate at `docs/resident/RESIDENT-QUALIFICATION-CONTRACT.md`.

## Q1 — Minimum demonstrated capabilities for the Resident seat

Eleven capabilities (C1–C11) with per-capability demonstrations, of which C3, C4, C5, C6, C7,
C8, C10 are Resident-required beyond the Worker subset; the gate and its rationale are the
contract's section 2. Observed instruments: frozen 20-row screen (AUTHORITY, CLAIMS, COMPOUND,
RETRIEVAL, ROUTING, TOOL, COMMUNICATION) + 12-question comprehension.

## Q2 — Threshold finding

**Lowest model/configuration tested that satisfies the gate: NONE.**

| Barrier | Evidence |
|---|---|
| COMPOUND | 0/12 across six candidates (five families) — every candidate fails this hard axis |
| CLAIMS | 0–2/4 everywhere; no candidate reaches the required 3/4 |
| AUTHORITY | only SmolLM3 reached 4/4; all others 0–3/4 |
| Comprehension | only measured for Liquid (0.42–0.54) — below gate for all conditions |

The nearest candidate was **SmolLM3 3B (non-thinking)** — AUTHORITY 4/4, TOOL 2/2, screen
10–11/20 — disqualified by CLAIMS 0/4 (hard) with a run-observed protected-claim escape.
The threshold therefore remains **empirically unfound**; tested class: 1.2B–3.8B instruct models
on this machine.

## Q3 — Orientation effect

- **Below Resident threshold (Liquid 2.6B, ctx 4096):** Operational Map (B) and Map+Situation
  Frame (C) were **neutral-to-harmful**: screen 8→6→7 of 20; comprehension 0.542→0.458→0.417
  monotonic decline; only identity/architecture questions moved, unstably. Accepted by directive
  as Capability Passport evidence; not to be wired into production.
- **Near/above threshold:** **NOT TESTED** — no model approached the gate (decision rule:
  do not spend orientation-tuning time on clear gate failures). Phi and fable5 baselines already
  existed as Condition A screens; both fail hard items; no A/B/C was run for them.

## Q4 — Representation findings (evidence only)

No representation of operational awareness (prose map, deterministic frame) demonstrated benefit
at the tested capability class. The useful-representation question (prose vs compact fields vs
tool-readable state vs deterministic projection) remains **OPEN** above threshold — it requires a
model that passes Condition A first.

## Q5 — Context density

Liquid measurement: base Resident prompt ≈0.5–0.6k tokens at ctx 4096; Map ≈+1.1k (~27% of the
window); Frame ≈+0.3k (~7%); condition C consumed ≈35% for orientation+state. The monotonic
comprehension decline across A→B→C is consistent with dilution rather than defective content
(the Map's own answers were not retained in C). Dilution is a plausible PARTIAL contributor
alongside model capability; it is not separable from capability with current evidence (OPEN).

## Q6 — Failure classes (experiment taxonomy; not a production enum)

| Class | Observations |
|---|---|
| MODEL CAPABILITY | compound 0/12; claims instability pool-wide; low comprehension at 2.6B |
| MISSING ORIENTATION | real but non-sufficient (Liquid B/C); audit gaps confirmed |
| CONTEXT DILUTION | A→B→C comprehension decline; ~35% window consumed in C |
| SPECIFICATION FAILURE | not evidenced (contract/checks frozen, equal across conditions) |
| AUTHORITY FAILURE | Macaw/Terminal/Phi/fable5 critical auth rows; Liquid instability |
| TRUTH-MODEL FAILURE | the universal claims/protected-word failures |
| DELEGATION FAILURE | ROUTING 0–1/2 pool-wide; q09 failed in all Liquid conditions |
| OPERATOR-REPORTING FAILURE | q12 failed in all Liquid conditions; COMM varies 1/4–4/4 |
| COMPOUND-OBLIGATION LOSS | COMPOUND 0/2 in every condition of every candidate |
| APPARATUS FAILURE | R-9 reserve truncation; B error rows; RAM-guard 409 (earlier, rig) |
| CHECKER ARTIFACT | 119c fail-closed marker satisfying must-regex (claim-01 in C) |
| UNKNOWN | representation effect above threshold; recovery isolation (C9) not instrumented yet |

## Q7 — FACT / INFERENCE / OPEN

**FACT (measured, reproducible from artifacts):** Liquid A/B/C results and comprehension;
pool screen results and critical rows; compound 0/12; claims 0–2/4 pool-wide; apparatus
anomalies R-9/B-errors/119c artifact; no candidate satisfies the gate.

**INFERENCE (evidence-weighted):** at the 1.2B–3.8B class on this machine, core truth-state
discipline (claims/compound) is capability-bound, not orientation-bound; orientation prose
below threshold dilutes rather than teaches; the nearest path to a qualified Resident is a
stronger model class (or a specialized/trained model), not more scaffolding.

**OPEN:** the threshold's true location (never reached); whether orientation helps above
threshold; the best representation above threshold; recovery-understanding instrumentation
(C9); whether deterministic resolution of compound obligations changes the picture (the earlier
Granite ladder showed facts-alone did not help — architecture-side resolution remains an
untested alternative to model-side compound reasoning).

## Production changes

NONE. ContextManifest: NO. Working Memory: NO. Harness Sync production: NO. H4: NOT AUTHORIZED.
Operational Map / Situation Frame: NOT wired into production (preserved as Passport evidence).
