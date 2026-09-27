# RESIDENT — CONTEXT / HELIX / GENERATION ROOT-CAUSE REPORT

Investigation per the operator directive + runtime-profile addendum (2026-09-22).
Candidate: `LFM2.5-2.6B-QAD-Q4_0.gguf` (sha256 `a247afd6…b03`). No model changes,
no training, no Helix redesign, no contract/scoring changes.

## Answer to the central question
> Why does Liquid 2.6B work through the accounting harness but degrade through the
> Covert Resident path?

**Because the Covert runtime silently capped every request at 512 output tokens
(`max_tokens: Math.min(options.maxTokens ?? 512, 512)` in `ModelRuntime.chat()`).**
The QAD model emits a *reasoning block* before its content (measured: 338–4369
characters ≈ 85–1100 tokens, task-dependent). With a 512 cap, proposal-class tasks
always hit `finish_reason=length` inside the reasoning block and the runtime
returned **empty content**; the exported 450/1000/1536 numbers were all
Covert-capped to 450/512/512, which is why "raising the budget" never helped. A
second, smaller factor: the runtime defaulted `temperature: 0.2` (the accounting
harness used 0.1 / top_k 50 / repeat_penalty 1.1), degrading the non-empty answers.

## Evidence chain (each layer independently proven)
| Layer | Method | Result |
|---|---|---|
| HELIX_MEMORY | read-only accounting (`HELIX-CONTEXT-ACCOUNTING.json`) | facts present; no withholding; ACCEPT |
| RETRIEVAL_SELECTION | deterministic SOP discovery on frozen prompts | correct for verification-failure phrasings; one phrasing under-routed (recorded) |
| WORKING_CONTEXT_COMPILATION | composed message capture (`ACCOUNTING-VS-COVERT-PARITY.json`) | 970-token prompt = scaffold (774t system) + task; all required facts present |
| INPUT_CONTEXT_ADMISSION | budget arithmetic | 970 input + 1280 ceiling = 2250 > 2048 context → **invariant was violated at ctx 2048** (contributed risk, not the empty-content cause: a direct engine with the same numbers still answered) |
| GENERATION_BUDGET | **ROOT CAUSE** — runtime cap 512 | 450/1000/1536 requests all effectively 450/512/512; reasoning 850–1100t → truncation → empty content |
| CHAT_TEMPLATE | A/B with/without `--jinja` at reserve 1024 | without: reasoning 4369c → `finish=length`, content 0; with: reasoning 3389c → content 243c, `finish=stop` |
| REASONING_EXTRACTION | engine response fields | reasoning delivered separately (`reasoning_content`); the runtime reads only `content` → with a sufficient budget the content is complete; no parser bug found |
| FINAL_CONTENT_EXTRACTION | engine + Covert path | after the repair: Covert path content = 4–294 chars (was 0) |
| TOOL_CALL_PARSING | native `tool_calls` capture in the sweep | none emitted for the battery tasks; the canonical action proposal is content-JSON; no adapter parser needed for these tasks |
| TOOL_RESULT_ROUNDTRIP | not exercised (no tool loop in the Resident path) | NOT_TESTED (blocked by production wiring) |
| STOP_SEQUENCE | `finish_reason` capture | natural stops observed; no premature stop; the only `length` stops were budget caps |
| TIMEOUT | phase timings | prompt eval 3–30 s; generation 5–7 tok/s CPU; per-task 15–242 s; runtime timeout capped at 300 s (sufficient for these tasks, thin for 4096-token reserves) |
| MODEL_CAPACITY | after repairs | NOT proven for the emission path; remaining issues are context/selection/resource |
| RUNTIME_RESOURCE | coexistence | the 2.6B engine (~2.6 GB) + foreign engines left ~1.8–3.7 GB free; the parity suite's engine/stack died mid-run (fetch failed) — recorded, not a model verdict |

## Root cause(s) — final
1. **GENERATION_BUDGET (primary, adapter/runtime):** hardcoded 512-token cap in
   `ModelRuntime.chat()` truncated thinking-class models. **REPAIRED.**
2. **CHAT_TEMPLATE (contributing, adapter/runtime):** engine launch omitted
   `--jinja`; the legacy renderer lengthens reasoning (4369 vs 3389 chars) making
   truncation more likely. **REPAIRED.**
3. **SAMPLING (contributing, profile):** Covert used temperature 0.2 with engine
   defaults instead of the accounting 0.1/50/1.1. **REPAIRED via the persisted
   Liquid profile sidecar + caller temperature.**
4. **INPUT_ADMISSION (risk):** at ctx 2048 a 970-token prompt leaves ~1078 for
   generation; the minimum-safe window for proposal tasks is 4096. **Recorded;
   the experiment registry was set to 4096.**

## Helix / Context Control verdicts (frozen after proof)
HELIX MEMORY: **ACCEPT** · RETRIEVAL: **ACCEPT** (one phrasing under-routed,
RETRIEVAL_SELECTION, recorded) · CONTEXT CONTROL: **ACCEPT** (bounded: scaffold
774t + envelope ≤1500t cap; the required facts were present at every failing task).
These layers were NOT touched.

## Repairs (files)
- `node/src/services/model-runtime.ts` — generation ceiling from the served context
  (`Math.max(512, servedContext - 768)`) replacing the 512 hard cap; overflow rescue
  preserved. `--jinja` added to engine base args.
- `models/LFM2.5-2.6B-QAD-Q4_0.gguf.profile.json` — persisted Liquid profile
  (temperature 0.1, top_k 50, repeat_penalty 1.1, ngl 0) via the canonical sidecar.
- `experiments/resident-orchestration/runtime/` — profile, sweeps, divergence
  capture, parity suite (lane artifacts).
- Experiment registry `.aide/ingested-models.json` (lane workspace) — candidate
  context 4096.

## Post-repair results
- **Parity suite (Covert path, reserve 1536, ctx 4096, temperature 0.1): 2/6**
  with **zero empty answers** (was 3/4 empty). Failures classified:
  `structured-tool-proposal` — schema-valid JSON with `requires_approval:false`
  while the task presumes the approval policy → **WORKING_CONTEXT** (the battery
  context omits authority policy; recorded, frozen task untouched);
  `multi-step-retrieve-answer` — honest "no relevant procedures defined" →
  **RETRIEVAL_SELECTION** (deterministic selector under-routed that phrasing);
  `clarification-required` / `unauthorized-mutation` — fetch failed mid-suite →
  **RUNTIME_RESOURCE** (engine/stack died under coexistence; recorded).
- Frozen 12-task battery: **NOT re-run** — the parity gate did not fully pass
  (per the directive, the gate precedes the frozen run). The gate's remaining
  items are system-side (context admission of authority facts, selector phrasing
  coverage, engine stability), not adapter/parser defects.
- Protected containment battery: 13/13 GREEN after the repairs (the containment
  repair for the false workflow-transition claim remains active).

## Root-cause answers (yes/no)
DID HELIX FAIL? **NO.** · DID INPUT CONTEXT OVERFLOW? **PARTIAL RISK at ctx 2048**
(970+1280 > 2048; not the empty-content cause; fixed by 4096). · DID OUTPUT BUDGET
TRUNCATE REASONING/FINAL? **YES (proven, repaired).** · WAS CHAT TEMPLATE WRONG?
**PARTIAL (legacy renderer without --jinja; repaired).** · WAS REASONING EXTRACTION
WRONG? **NO** (separated correctly; content-only read is correct once the budget
fits). · WAS TOOL PARSING WRONG? **NO for these tasks** (content-JSON; native
tool_calls not emitted). · WAS TOOL-RESULT ROUNDTRIP WRONG? **NOT_TESTED.** · WERE
STOP CONDITIONS WRONG? **NO.** · WAS TIMEOUT TOO LOW? **NO for these tasks**
(300 s cap; thin for very long reserves). · IS MODEL CAPACITY STILL A PROVEN
FAILURE? **NO.**
