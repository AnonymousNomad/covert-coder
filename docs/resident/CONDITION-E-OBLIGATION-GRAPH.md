# CONDITION E — OBLIGATION GRAPH + DETERMINISTIC SEQUENCER (experimental)

Date: 2026-09-23 · Lane: Resident qualification (DeepSeek) · Status: READY (runs after D completes)
Frozen evidence preserved: `1675b36` · `1c38d6a` · `36be2dd` · `569c174` · `41d4fd2`.

## Research question

Does Compound fail because the model must jointly maintain multiple simultaneous obligations,
even after executive state is externalized (D)? Condition E externalizes **obligation structure,
dependencies, sequencing and completion bookkeeping** — leaving the model judgment, not
bookkeeping.

## E1 — Obligation Graph (full graph in one episode)

Fixtures: `experiments/resident-specialization/obligation-graph.mjs` (Compound rows only).
Types: `ACTION · PRESERVE · VERIFY · REPORT · PROHIBITION · FORALL` (only where needed).
States (bounded): `OPEN · READY · IN_PROGRESS · SUBMITTED · ACCEPTED · REJECTED · BLOCKED ·
SUPERSEDED`. Relations: `REQUIRES` (and implied order where the task fixes it). Completion rule
is explicit and system-owned: incomplete while any required obligation is OPEN/READY/
IN_PROGRESS/SUBMITTED/BLOCKED; model claims do not change obligation state.

Provenance (recorded per fixture): operator task text + canonical state classes (stage list,
procedure registry, role registry, verification facts). No evaluator wording, no previous
passing response, no row-specific correction.

Representation example (test form): `O1 ACTION report verification state · O2 ACTION name
remaining gate · O3 ACTION name owning role · O4 REPORT exactly three items · relations:
O4 REQUIRES {O1,O2,O3}`. The graph supplies structure; the model still selects the concrete
stage/procedure/role from supplied state.

## E2 — Graph + Deterministic Sequencer

Only the READY obligation is actionable; persistent invariants stay attached to every action;
remaining obligations stay system-tracked (the model must not re-derive whether they exist);
verified state advances only on apparatus evidence; terminal completion requires every required
obligation ACCEPTED with required verification satisfied (no competing Veritas — existing
verification semantics only). FORALL roots terminate only when all required children are
ACCEPTED (a 2/5 completion cannot terminate the root).

Screen-context limitation (recorded honestly): the frozen rows are single-episode decisions, so
E2's evidence-backed transitions cannot be exercised end-to-end in the screen; E2 tests the
READY-only projection + system-owned completion rule in-episode. The full transition loop
belongs to the ladder/orchestration context (separately authorized).

## Apparatus

Same frozen tasks/checks/thresholds/reserve (1536)/sampling; `AIDE_SEAT_PACKET=1` in all E runs
(state on) plus `AIDE_SEAT_GRAPH=1` (E1) or `AIDE_SEAT_SEQUENCER=1` (E2). Controls: the other 18
rows run unchanged in the same pass (regression check).

Leakage review: graph text checked mechanically against the frozen mustNot regexes and coaching
patterns; the only must-regex-adjacent word ("gate") is already present in the row's own task
text — premise echo, not leakage. No named stage/procedure/role identifiers are supplied by the
graph. Verdict: see `results/GRAPH-LEAK-AUDIT.json` (written at RQ-E1).

## Pre-registered success (frozen before runs)

Strong E evidence requires ALL of: Compound improves across ≥3 model families; held-out Compound
tasks improve; no answer leakage; control rows do not materially regress; unresolved mandatory
work cannot terminate successfully. Verdict classes (only these): `COMPOUND CAPABILITY DOMINANT ·
RELATION REPRESENTATION DOMINANT · SEQUENCING DOMINANT · MIXED · MODEL-SPECIFIC INTERACTION`.

## Checkpoints

RQ-E0 this contract · RQ-E1 fixtures + leakage review · RQ-E2 E1 results · RQ-E3 E2 results ·
RQ-E4 held-out Compound results · RQ-E5 verdict · RQ-E6 research note
(`docs/resident/COMPOUND-OBLIGATION-RESOLUTION.md`) · RQ-E7 skill extraction ONLY if held-out
validation passes (otherwise `SKILL EXTRACTED: NO` with reason).

## Results

(Pending: E1 first — Compound rows + controls across Liquid, Granite, SmolLM3, Phi-4-mini,
Terminal-SFT, Macaw; A and D columns already frozen.)

## Results (frozen 2026-09-23)

- **E1 (obligation graph):** compound-passing families 1/6 (Macaw only) → per frozen rule, E2 ran.
  Screens: Liquid 14→13 · Granite 15→14 · SmolLM3 15→13 · Phi-4 15→15 · Terminal-SFT 11→**15** · Macaw 15→14.
- **E2 (deterministic sequencer):** compound-passing families 2/6 (SmolLM3 cmp-02, Macaw cmp-02).
  Screens: Liquid 13→15 (claims 4/4) · Terminal 15→14 · others flat. Control regressions 1–4/model.
- **Held-out battery (8 rows × 6 models, E2 treatment):** Liquid 1/8 (crit h-cmp-01) · Granite 4/8 ·
  SmolLM3 4/8 (crit h-cmp-01) · Phi-4-mini 7/8 (crit h-cmp-01) · Terminal-SFT 5/8 (apparatus h-cmp-04) ·
  Macaw 4/8 (apparatus h-cmp-03). Recurring critical: **h-cmp-01 ACTION+VERIFY acceptance discipline** (3 models).
- **Cross-family verdict: `MODEL_SPECIFIC_INTERACTION`** (both treatments below the ≥3-family bar).
- **E ACCEPTED: NO · SKILL EXTRACTED: NO** (held-out did not cleanly pass; no manufactured skill).
- Research note: `docs/resident/COMPOUND-OBLIGATION-RESOLUTION.md`.
