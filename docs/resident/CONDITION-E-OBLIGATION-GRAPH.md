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
