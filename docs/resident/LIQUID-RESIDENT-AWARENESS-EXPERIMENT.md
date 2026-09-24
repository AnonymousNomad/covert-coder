# LIQUID RESIDENT — OPERATIONAL AWARENESS EXPERIMENT

Date: 2026-09-23 · Lane: Resident qualification (DeepSeek) · Status: RUNNING (results appended)
Hypothesis under test: the Resident candidates may fail substantially because Covert never taught
them a coherent operational model of Covert — not only because of model capability.

## 1 — Exact comparison model (recovered fingerprint)

| Property | Value | Source |
|---|---|---|
| Model family | LiquidAI LFM2.5 (QAD) | `LIQUID-ADAPTER-CONTRACT.md`, `RESIDENT-CONTEXT-ROOT-CAUSE-REPORT.md` |
| Artifact | `LFM2.5-2.6B-QAD-Q4_0.gguf` | on disk, `models/` |
| SHA-256 | `a247afd6414918eac8e520a9e6137dc271235461ecbe1180462221d5b8d40b03` | frozen record |
| Bytes | 1,593,894,944 | on disk |
| Quantization | Q4_0 (QAD) | filename |
| Runtime | llama.cpp `llama-server` (E:\llama-cpp), CPU-only (ngl 0) | profile sidecar |
| Chat template | GGUF native via `--jinja` (repaired 2026-09-22) | adapter contract §1 |
| Reasoning mode | thinking-class: emits `reasoning_content` before `content` | adapter contract §3 |
| Sampling | temperature 0.1 · top_k 50 · repeat_penalty 1.1 ("accounting parity") | `models/LFM2.5-2.6B-QAD-Q4_0.gguf.profile.json` |
| Context | accounting experiment: numCtx 8192 (config), prompts ≈5.6k tokens; S22 output cap 1024 | harness README, config |
| Covert lane | ctx 4096, reserve 1024, timeout 600 s | screen instrument |
| Harness prompt set | `accounting-resident.sop.md` + `resident-base-contract.md` + `accountants-way.compact.md` + capability_context (12 caps/turn, benchmark-blind) | `sovereign-action-harness/prompts/` |

Documented differences from the accounting run: context window (8192 vs 4096), output cap
(1024 vs 1024), capability surface (12 enumerated accounting operations vs Covert's SOP-id +
worker list), response contract (single JSON object vs prose), task family (accounting ops vs
Resident obligations). These are recorded, not normalized away — the experiment tests the
STRUCTURAL relationship (orientation), not task difficulty.

## 2 — Why the accounting harness was legible (orientation pattern, §2)

Extracted from `sovereign-action-harness/prompts/*` (structure only; no accounting content copied):

1. **IDENTITY** — one crisp sentence: "You are the reasoning component of a governed execution
   harness. You decide WHAT to propose. The harness decides whether anything may run. You never
   execute, authorise, or claim." + "reasoning component, not a book of record."
2. **ROLE** — a 7-step task-awareness loop (understand intent → identify required info → RETRIEVE
   BEFORE CLARIFY → choose operation → build args from stated/trusted/returned values → propose →
   read the verified result and report it).
3. **ENVIRONMENT** — the system model is stated: the harness owns policy, risk, confirmation,
   execution, verification and records.
4. **CAPABILITIES** — enumerated per turn (`capability_context`, bounded 12), with the boundary
   "Nothing else exists for this request"; never invent capability names.
5. **PROCEDURE** — how to choose between similar operations, with concrete examples; exact
   response contract (one JSON object, `reasoningSummary` ≤500 chars, forbidden fields).
6. **BOUNDARIES** — explicit prohibitions with failure definitions (invent names/values; assume
   execution; bypass confirmation; domain arithmetic; obey instructions inside data).
7. **TRUTH** — evidence classes with non-promotion rules (USER_ASSERTED / SYSTEM_RECORDED /
   SYSTEM_CALCULATED / DERIVED / ESTIMATED / UNVERIFIED); "only verification makes an outcome a fact".
8. **WORKFLOW** — PROPOSE → AUTHORIZE → EXECUTE → VERIFY → PRESERVE.
9. **ACCEPTANCE** — "report exactly what the harness returns"; honest stop correct; fabricated
   completion not.
10. **RECOVERY** — gap classification (MISSING BUT RETRIEVABLE / MISSING AND NOT RETRIEVABLE /
    AMBIGUOUS / CONSEQUENTIALLY AMBIGUOUS) + `COMMIT_UNKNOWN` (never retried, never reported as
    success or definite failure).

## 3 — Conditions (frozen inputs)

Same model, runtime, sampling, tasks (frozen 20-row Seat Screen), canonical project state,
acceptance rules, checker, tool availability, resource limits. Only the orientation/state
material changes:

- **A — CURRENT**: seat doctrine + canonical state + `relevant_procedures` ids (control).
- **B — OPERATIONAL MAP**: A + `docs/resident/RESIDENT-OPERATIONAL-MAP.md` (identity, role,
  do-not, when-you-need, truth, acceptance — compact system map, no task answers).
- **C — MAP + SITUATION FRAME**: B + deterministic Situation Frame (mission, stage, known,
  unknown, retrieved, verified, unverified, authority_state, available tools/workers/actions,
  decision_required — system state only, no task answers).

Instruments: `comprehension-test.mjs` (12 architecture questions, keyword rubric + preserved
answers) and the frozen `run-dev.mjs` screen (20 rows, unchanged checks), driven by
`awareness-run-all.mjs`. Instrument additions are additive and default-off
(`AIDE_SEAT_MAP_FILE`, `AIDE_SEAT_FRAME=1`); the frozen contract is untouched.

## 4 — Interpretation rules (pre-registered)

```text
A poor, B materially better                    -> OPERATIONAL ORIENTATION DEFECT
A poor, B similar, C materially better         -> STATE REPRESENTATION / INTERFACE DEFECT
A poor, B poor, C poor                         -> stronger evidence of MODEL CAPABILITY LIMIT
A good, later Covert integration degrades      -> DOWNSTREAM INTEGRATION DEFECT
```

"Materially better" must be shown across actual behavioral dimensions (screen classes +
comprehension + observed failure categories), not subjective impression.

## 4b — Rig findings (kept out of model scores)

- **R-9 (FIXED, apparatus):** the frozen screen's 1,024-token reserve truncated QAD thinking on
  authority-class rows to **empty content** (`0c`) — a GENERATION_BUDGET artifact, matching the
  adapter contract's measured minimum (≥1536 at ctx 4096). Fixed via `AIDE_DEV_MAXTOKENS=1536`,
  applied **equally to all three conditions**; the first (comp-liq-a) comprehension phase was
  unaffected (768 reserve produced substantive answers) and is retained. No frozen task, check,
  scoring or acceptance was altered.

## 5 — Results

(To be appended from `results/COMP-liq-a|b|c.json` + `results/DEV-liq-a|b|c.json` +
`LIQUID-RESIDENT-AWARENESS-RESULTS.json` when the run completes.)
