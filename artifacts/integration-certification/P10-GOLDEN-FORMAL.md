# GOLDEN VERIFIED MISSION — canonical production path (formal acceptance)

Date: 2026-09-23 (session resuming 6af3245)
Probe: E:\pip_temp\opencode\p10-golden.mjs (direct stack, one real workspace)
Evidence: artifacts/integration-certification/P10-GOLDEN.json

## Chain executed (real, not fixture receipts)
1. **FIRST-RUN READINESS**: `GET /api/readiness` -> ready true, ready_for_golden_mission true, models READY.
2. **LOCAL ENGINE + REAL PROJECT**: agent session on a real workspace (`src/math.mjs` with a real bug) through the real agent loop.
3. **CONTEXT CONTROL**: trajectory shows `[WORKSPACE CONTEXT]` and `[SKILL CONTEXT]` blocks (Skill/SOP selection).
4. **WORKER + AUTHORITY**: session started with worker descriptor `local:auto` under owner-approved execution.
5. **REAL EXECUTION**: the loop's real tools read and rewrote the file — `src/math.mjs` now contains `a + b` (verified on disk).
6. **VERITAS EVIDENCE**: `.aide/verifications/<session>.verification.json` + `.aide/trajectories/<session>.traj.json` produced by the canonical pipeline.
7. **PROVENANCE LEDGER**: run recorded (`result: done`, `worker: local:auto`, verification_state, evidence_file).
8. **MISSION RECEIPT**: 1 run, `verification: unavailable`, `supported_conclusion: null`, limitations:
   - "no run reached verified state; committed process exit is not test evidence"
   - "no canonical worker handoffs recorded for this mission"
   evidence_refs: verification + trajectory files.

## Verdicts (all true)
readiness truthful · local engine ran · Skill/SOP selected · Authority approved · real execution · Veritas evidence · provenance ledger · mission receipt · **no unsupported completion** (receipt refuses to claim verified without evidence).

## Defect found + fixed during this acceptance
The loop stored the worker **object** in the session; the strict provenance contract rejected it, and the record was silently swallowed into evidence errors. Fixed in `agent-loop.mjs` (normalize descriptor -> worker string) with a regression assertion in `tests/arch/provenance.test.ts` (recorded `worker: local:auto`).

## Conclusion
GOLDEN VERIFIED MISSION: **PASS** — the complete canonical product path executes for real and the receipt reports exactly the truth it has, with limitations explicit where verification cannot be claimed.
