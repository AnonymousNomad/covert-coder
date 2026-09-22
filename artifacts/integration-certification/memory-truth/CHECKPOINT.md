# STOP-POINT CHECKPOINT — Memory truth + split-brain AFTER

Date: 2026-09-22 · Lane: `audit/wiring-ledger` · Target: `covert-production` @ `8ea6c8b`
Evidence: `memory-truth/BEFORE.json`, `memory-truth/AFTER.json`, `split-brain/BEFORE.json` (frozen, untouched), `split-brain/AFTER.json`

## 1. POISONING — BEFORE / AFTER
Fixture (production service paths; `remember()` is what `POST /api/chat/history` calls, `recall()` is what the chat composer injects):
- Production ingestion shape: 3× asserted "Deployment succeeded" + 1 verified "Deployment FAILED (verification)".
- fact_key shape: verified "Tests FAILED" then a worker claim "Tests passed" appended later.

BEFORE:
- No truth classes on any hit (`truth_classes_present: false`); repeated assertions and the verified contradiction were indistinguishable.
- `late_claim_owns_current: true` — the post-verification asserted claim owned current truth; the verified row was excluded.

AFTER:
- Hits carry `validity` (`verified` / `asserted`); `truth_classes_present: true`.
- `late_claim_owns_current: false` — the verified entry owns current truth; asserted claims remain retrievable as labeled history.
- Invariant: **REPETITION != VERIFICATION** (extra asserted rows never change the class).

## 2. TEMPORAL ORDERING — BEFORE / AFTER
Fixture: A (T1) → B (T2, supersedes A) → A2-late (older T0.5, written last).

BEFORE: `late_older_owns_current: true`, newer valid fact absent (append order decided current truth).
AFTER: `late_older_owns_current: false`, `newer_valid_present: true` — current truth owner chosen by (truth class, event time), never append order; the older late event remains file history.

## 3. REPAIR (bounded, single canonical owner)
- `node/src/services/memory-recall.mjs`:
  - `normalizeEntry`: accepts optional `validity` + `evidence_ref` (additive; `validated` mechanism preserved).
  - `activeMemories`: excludes `rejected`/`superseded`; current-truth owner for a `fact_key` = highest class (`verified` > `asserted`/default) then max event `ts`; asserted repetition cannot promote.
  - `recall` hits: carry `validity` + `evidence_ref` (provenance/class metadata for the compiler).
- `node/src/routes/chat.ts`: conversational turns are ingested as `validity: 'asserted'` (explicit, never verification).
- Type shims updated (`memory-recall.d.mts`, `agent-loop.d.mts`, chat inline type).
- No new store, no Helix 2, no second memory engine.

## 4. PROTECTED MEMORY REGRESSIONS
`tests/arch/memory-recall.test.ts` (workspace scoping, restart survival, secret exclusion, supersession, degraded reads) + `agent-routes` + `route-authority-coverage`: **15/15 PASS**. No stop condition triggered. Bounded recall preserved (recall remains topN≤5, budget-bounded).

## 5. SPLIT-BRAIN AFTER (same frozen fixture, worker constant)
- Repair: memory recall wired into the agent loop through the existing provider mechanism (`memoryProvider` → `[PROJECT MEMORY]` block with truth-class labels; `agent-loop.mjs` + `openapi.ts`). No Resident prompt copied; no transcript replay; no new context engine.
- Result: **worker 0/4 → 2/4 required facts** (objective + constraint arrive via the general production Context path; verified in `split-brain/AFTER.json`). Worker system prompt 10,104 → 10,539 chars (+435 for the memory block). Relevant-fact density improved; no stale/unsupported facts delivered.
- **Remaining 2 facts** (failed approach, evidence requirement): both live only in workspace docs (`docs/FAILED-APPROACH.md`) and were retrieved by NEITHER path (`context_hits: 0` — no index built in the probe stack). Owner routing per directive item 8: workspace docs → RAG/index service (production boot wires `watchIndex`); routing those from their proper owner is the next bounded step. Resident itself was 2/4 — confirming Resident context is NOT the canonical source to copy into workers.

## 6. STATUS
Stop point reached. NOT yet started (per directive): Skills/workflow/handoff wiring, role projection beyond the memory block, RAG owner routing for doc facts.
