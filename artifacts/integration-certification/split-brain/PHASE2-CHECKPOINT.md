# PHASE 2 CHECKPOINT — Micro-expert ablation + split-brain BEFORE

Date: 2026-09-22 · Lane: `audit/wiring-ledger` · Target: `covert-production` @ `8ea6c8b`
Raw evidence: `split-brain/BEFORE.json` (frozen; do not overwrite) · probe: `E:\pip_temp\opencode\phase2-probe.mjs`

## 1. MICRO-EXPERT RUNTIME TRUTH (trace + ablation)

Fixed fixture: task = "plan the implementation of add() with tests"; worker = stub model (records every message it receives); context/runtime constant.

| Expert | Defined | Registered | Invoked (production) | Output produced | Output consumed | Decision changed | Classification |
|---|---|---|---|---|---|---|---|
| task-router (intent) | YES `harness/micro-experts.mjs:96,347` | YES `routes/experts.ts:201` | Provider sessions only: `agent.ts:107` requires `expertAdvisory && chatFnOverride`; `chatFnOverride` set only for `chat_source='provider'` (`agent.ts:86-99`). The sovereign UI sends `chat_source='local'` (`ResidentCore.ts:217`) → skipped. Legacy shell calls `/api/experts/intent` (`app.js:177`). | YES (phase/confidence; signals `.aide/experts/signals.json`) | ONLY as prompt text `agent.ts:124-139` (provider path) or a UI chip `app.js:180` | **NO** — no production branch consumes expert output (verified: no `if` on advisory outside prompt text) | **CALLED_BUT_NOT_CONSUMED** (provider path) / **UNREACHABLE** (local production path) |
| diff-risk-gate | YES `routes/experts.ts:81` | YES | NO production caller (only `tests/arch/expert-serve-wirein.test.ts:94,101`) | n/a | NONE | NO | **ORPHANED** |
| request-intent-classifier | YES `routes/experts.ts:67` | YES | Legacy shell only (`app.js:177`) | YES | UI chip only | NO | **ORPHANED** (legacy-only) |

Ablation result (enabled vs disabled, worker constant):
- ENABLED (provider path): the compiled system prompt gains the advisory text block (`agent.ts:124-139`).
- DISABLED / local path: no advisory text; session proceeds identically.
- **Downstream behavioral difference: NONE.** The advisory never reaches routing, workflow, methodology, model selection, or escalation — there is no consumer that branches on it. Prompt-text presence is the entire effect.
- Probe note: the local-path `expertAdvisory:true` check used a loose regex (`/advisory/i` matched unrelated scaffold text); the authoritative gate proof is the code path (`agent.ts:107` + `chatFnOverride` only for provider) plus the static consumer audit.

## 2. SPLIT-BRAIN BEFORE (frozen fixture)

Fixture facts placed where the project infrastructure can see them:
- `docs/OBJECTIVE.md` — objective + constraint; `docs/FAILED-APPROACH.md` — failed approach + evidence requirement; `src/math.mjs` buggy; `.aide/verifications/v1.verification.json` (passed, completed work); one real memory turn seeded via `POST /api/chat/history`.

| Fact | Resident path (canonical chat composer) | Worker path (production agent loop) |
|---|---|---|
| objective | **YES** | **NO** |
| constraint | **YES** | **NO** |
| failed approach | NO | NO |
| evidence requirement | NO | NO |
| completed verified work | not delivered | not delivered |
| workflow stage | not delivered | not delivered |

Measured (production routes, stub worker, harness:true):
- Resident: `memory_recall_hits=1`, `memory_recall_tokens=124`, `context_hits=0`, `approx_prompt_tokens=2097`, system prompt **8,300 chars** — objective+constraint arrived via memory recall.
- Worker: system prompt **10,104 chars** (skills/scaffold) — **0 of 4 required facts arrived** (no awareness envelope, no memory recall, no RAG; separate composer `agent-loop.mjs:286-298`).
- Split quantified: **2 facts available to Resident → 0 delivered to the Worker.**
- Task/verification outcome for the worker fixture: not meaningful with the stub worker (constant by design); the measured delta is fact delivery, which is the split-brain defect.

## 3. STATUS
- Micro-expert classification recorded; **no wiring performed** (Part 4/5: do not wire merely because it exists; the advisory substrate stays advisory).
- Split-brain BEFORE frozen as required; **no Context Control repair performed yet** (Part 10: memory truth defects must be resolved first so the worker projection consumes truth-filtered memory).
- Next: memory admission/poisoning + temporal fixtures (BEFORE), then repairs with protected-property regression, then role projection.
