# RESIDENT — CONTEXT / HELIX / GENERATION ROOT-CAUSE CLOSURE

Source: operator directive (Discord), 2026-09-22. Lane: DeepSeek #2 — Covert Resident subsystem engineer.
Status: recorded, not yet executed (investigation program queued).

## ROLE

You are:

**DEEPSEEK #2 — COVERT RESIDENT SUBSYSTEM ENGINEER**

This is a root-cause investigation and bounded repair.

Do NOT change Resident models.
Do NOT resume 230M work.
Do NOT train anything.
Do NOT redesign Helix.
Do NOT build another Context Control system.
Do NOT change the frozen Resident contract or its scoring to accommodate Liquid 2.6B.

The selected Resident candidate under investigation remains:

`LiquidAI LFM2.5-2.6B-QAD-Q4_0.gguf`

Known artifact SHA-256:

`a247afd6414918eac8e520a9e6137dc271235461ecbe1180462221d5b8d40b03`

The accounting collaborator experiment demonstrated that this exact model family/artifact can perform the required governed retrieval/tool-selection behavior.

The current question is:

> Why does Liquid 2.6B work through the accounting harness but degrade through the Covert Resident path?

Solve that question before changing models.

---

## 1. STOP USING "CONTEXT" AS ONE FAILURE CLASS

From this point forward classify independently:

```text
HELIX_MEMORY
RETRIEVAL_SELECTION
WORKING_CONTEXT_COMPILATION
INPUT_CONTEXT_ADMISSION
GENERATION_BUDGET
REASONING_EXTRACTION
FINAL_CONTENT_EXTRACTION
TOOL_CALL_PARSING
CHAT_TEMPLATE
STOP_SEQUENCE
TIMEOUT
MODEL_CAPACITY
RUNTIME_RESOURCE
```

Never report: `context problem` without identifying the exact layer.

## 2. WHAT HELIX IS SUPPOSED TO SOLVE

Helix owns:

```text
durable project memory
fact lineage
supersession
negative memory
verified truth
historical decisions
retrieval by relevance
restart continuity
worker/model independence
```

Helix is NOT responsible for:

```text
infinite model context
generation-token limits
reasoning-token limits
tool-call syntax
model-specific chat templates
stop tokens
runtime timeout
parser correctness
```

Do not modify Helix to solve a generation/parser problem.

## 3. PROVE HELIX FIRST

Before touching the Liquid adapter, run a focused Helix/Context Control inspection.

For representative frozen Resident tasks record:

```text
required canonical facts
facts available in Helix
facts retrieved
facts admitted to working context
stale facts excluded
superseded facts excluded
verification-backed truth selected
total retrieved tokens
total working-context tokens
```

Classify:

```text
HELIX MEMORY:     ACCEPT / PARTIAL / REJECT
RETRIEVAL:        ACCEPT / PARTIAL / REJECT
CONTEXT CONTROL:  ACCEPT / PARTIAL / REJECT
```

If the correct bounded facts are present, FREEZE these layers. Do not touch them again during this investigation.

## 4. INPUT ADMISSION ACCOUNTING

Instrument the actual Resident inference. For every diagnostic call capture:

```text
model context capacity
system tokens
Resident doctrine tokens
canonical project tokens
Helix retrieval tokens
workflow tokens
Skills tokens
capability/tool-schema tokens
user-task tokens
other prompt tokens
TOTAL INPUT TOKENS
RESERVED OUTPUT TOKENS
SAFETY MARGIN
```

The required admission invariant is:

```text
INPUT TOKENS + RESERVED GENERATION + SAFETY MARGIN <= MODEL/RUNTIME CONTEXT CAPACITY
```

If this holds, do NOT call the failure an input-context problem.

## 5. ACCOUNTING-HARNESS PARITY EXPERIMENT

Build a small diagnostic comparison. Use:

```text
SAME Liquid 2.6B artifact
SAME simple representative tool/retrieval task
SAME or intentionally documented sampling
SAME machine/runtime where practical
```

Condition A: `known-good accounting harness`
Condition B: `Covert Resident path`

Capture both paths side-by-side.

## 6. PARITY CAPTURE

For each path record:

```text
artifact hash
llama.cpp/server version
n_ctx
sampling
rendered message roles
rendered chat template
tool definitions supplied
capability definitions supplied
prompt token count
max generation
timeout
stop sequences
raw server response metadata
finish_reason
reasoning field
content field
tool_calls field
parser output
canonical Covert proposal
execution result
verification result
```

We need the first meaningful divergence. Do not guess.

## 7. CHAT TEMPLATE

Determine exactly how Covert formats the model's messages. Verify whether it uses:

```text
GGUF/native embedded template
```

or:

```text
custom Covert formatting
```

Compare that against the known-good accounting path. If Covert is overriding a required Liquid template incorrectly: repair the adapter. Do NOT alter the entire Resident architecture.

## 8. REASONING VS FINAL CONTENT

The Liquid 2.6B reasoning phase must not be confused with final output. Determine exactly what the runtime returns as:

```text
reasoning
final content
tool call
```

The adapter must distinguish these.

Target conceptual behavior:

```text
MODEL REASONING   -> parsed/separated
MODEL TOOL PROPOSAL -> canonical structured proposal
MODEL FINAL CONTENT -> Resident response
```

Do not require reasoning text itself to be valid final JSON. Do not store raw reasoning as canonical project truth. Do not feed raw reasoning into Helix as durable memory.

## 9. GENERATION-BUDGET ROOT CAUSE

Previous Covert runs used approximately 450 / 1000 tokens and produced empty/degraded final content while the model consumed its budget reasoning. The accounting experiment independently observed:

```text
finish_reason = length
completion = exact frozen cap
```

on many failures.

Therefore run ONE diagnostic with a deliberately sufficient predeclared generation reserve. Use a value large enough to determine whether the model naturally reaches:

```text
reasoning completion -> tool call / final answer
```

without truncation. For example, where the total context formula safely permits it, a `4096 output-token diagnostic ceiling` is reasonable for diagnosis. This is NOT the eventual production setting. It is apparatus isolation.

## 10. GENERATION RESULT CLASSIFICATION

If the model reaches correct final/tool output with sufficient reserve: classify the previous failure as `GENERATION_BUDGET`, not `MODEL_CAPACITY` and not `HELIX_CONTEXT`. If it still fails despite adequate reserve, continue to protocol/parser analysis.

## 11. TOOL-CALL CONTRACT

Compare Liquid's actual emitted tool call with what Covert expects. Record:

```text
raw tool-call tokens
tool name
arguments
schema
wrapper/tags
parser result
```

Check whether Covert expects generic JSON while Liquid emits its native tool-call representation. Normalize this in the MODEL ADAPTER. Do not contaminate Authority with model-specific syntax.

Correct separation:

```text
Liquid syntax -> Liquid adapter -> canonical Covert action proposal -> Authority
```

Authority should never need to understand Liquid-specific tokens.

## 12. TOOL RESULT RETURN PATH

After governed execution, verify Covert returns tool results to Liquid using the role/format expected by its native chat contract. Test:

```text
Resident proposes lookup -> Authority -> tool executes -> evidence/result
-> result returned to model correctly -> model continues -> final supported answer
```

A malformed tool-result round trip can make an otherwise capable agent appear incompetent.

## 13. STOP SEQUENCES

Inspect exact stopping conditions. Determine whether Covert or llama.cpp is prematurely stopping on:

```text
reasoning terminator
tool delimiter
assistant delimiter
EOS
custom JSON terminator
```

Do not change stop sequences blindly. Capture the exact terminating token/reason first.

## 14. TIMEOUT ANALYSIS

Separate:

```text
PROMPT EVALUATION TIME
REASONING GENERATION TIME
TOOL GENERATION TIME
FINAL ANSWER TIME
```

A 300-second timeout that occurs before execution is: `RUNTIME_RESOURCE / TIMEOUT` — not necessarily `MODEL_CAPACITY`. Record `executed:true/false` before any retry. Never retry a potentially mutating action unless execution truth proves retry safety.

## 15. CONTEXT ECONOMICS

Only after protocol correctness is established, inspect whether Covert is feeding unnecessary material. Target:

```text
HELIX -> relevant retrieval
Context Control -> smallest sufficient working set
Resident -> bounded capability surface
```

Do NOT solve latency by deleting required truth. Do NOT solve model behavior by dumping the entire project into context. Measure relevance first.

## 16. CAPABILITY SURFACE

The accounting experiment succeeded using bounded discovery. Ensure Covert Resident receives only the relevant semantic capability set. Do not expose all Skills / workflows / models / internal routes / Harness actions on every turn. But this must be legitimate runtime filtering. No benchmark-answer leakage.

## 17. RETRIEVAL-BEFORE-CLARIFICATION

Once adapter parity is established, rerun the key doctrine:

```text
KNOWN -> use
RETRIEVABLE -> retrieve
AMBIGUOUS -> clarify
NOT RETRIEVABLE -> clarify/report limitation
```

This is one of the main reasons Liquid 2.6B is being evaluated.

## 18. DO NOT CONFUSE SESSION EXHAUSTION

DeepSeek/OpenCode coding-session context exhaustion is NOT Resident product failure. When your own engineering session approaches context exhaustion: write an exact resume checkpoint and stop safely. Do not alter Covert architecture to solve your coding-agent session length.

## 19. REPAIR LOCATION LAW

If the defect is Liquid template / reasoning parsing / tool parsing / output extraction / stop behavior: repair `MODEL ADAPTER / RUNTIME ADAPTER` — not Helix / Workflow / Authority / Harness / Veritas / Resident architecture. If the defect is Context Control, prove it independently before changing it.

## 20. FALSE WORKFLOW TRANSITION

The previously escaped false transition claim already produced a containment repair. Preserve that repair. Run the protected containment battery after adapter changes. The model may make a bad claim; the system must prevent it from becoming canonical truth.

## 21. PARITY GATE

Before rerunning the full 12-task Resident battery, require a small parity suite to pass. Minimum:

```text
simple read/lookup
one structured tool call
one multi-step retrieve->answer task
one no-tool direct answer
one clarification-required case
one unauthorized/mutation case
```

Require correct: reasoning separation, tool parsing, authority, execution, evidence, final answer, finish reason, no truncation.

## 22. ONLY THEN RERUN FROZEN RESIDENT BATTERY

Once parity is proven: run the existing frozen 12 tasks / 8 classes. No task changes. No scoring changes. No contract changes. The adapter/runtime configuration must be frozen before the run.

## 23. FAILURE ATTRIBUTION AFTER REPAIR

For every failure classify exactly:

```text
HELIX_MEMORY
RETRIEVAL_SELECTION
WORKING_CONTEXT
INPUT_ADMISSION
GENERATION_BUDGET
CHAT_TEMPLATE
REASONING_PARSER
TOOL_PARSER
TOOL_RESULT_ROUNDTRIP
STOP_SEQUENCE
TIMEOUT
AUTHORITY
VERIFICATION
MODEL_CAPACITY
RUNTIME_RESOURCE
```

No generic `context` allowed.

## 24. SUCCESS CRITERIA

The investigation is successful when we can state with evidence:

```text
WHAT HELIX DID
WHAT CONTEXT CONTROL DID
WHAT THE MODEL RECEIVED
WHAT THE MODEL GENERATED
WHAT REASONING CONSUMED
WHY GENERATION STOPPED
HOW TOOL CALLS WERE PARSED
HOW RESULTS RETURNED
WHETHER THE FINAL RESPONSE WAS COMPLETE
```

There should be no mystery layer remaining.

## 25. REQUIRED ARTIFACTS

Produce:

```text
RESIDENT-CONTEXT-ROOT-CAUSE-REPORT.md
HELIX-CONTEXT-ACCOUNTING.json
ACCOUNTING-VS-COVERT-PARITY.json
LIQUID-ADAPTER-CONTRACT.md
LIQUID-PARITY-BATTERY.json
LIQUID-RUNTIME-METRICS.json
```

Do not record secrets. Do not record raw private project content unnecessarily.

## 26. FINAL REPORT

Return:

```text
HELIX MEMORY:                    ACCEPT / PARTIAL / REJECT
RETRIEVAL:                       ACCEPT / PARTIAL / REJECT
CONTEXT CONTROL:                 ACCEPT / PARTIAL / REJECT
INPUT CONTEXT ADMISSION:         ACCEPT / PARTIAL / REJECT
ACCOUNTING HARNESS INPUT TOKENS: ...
COVERT INPUT TOKENS:             ...
ACCOUNTING OUTPUT BUDGET:        ...
COVERT OUTPUT BUDGET:            ...
CHAT TEMPLATE PARITY:            ...
REASONING EXTRACTION:            ...
FINAL CONTENT EXTRACTION:        ...
TOOL CALL PARSING:               ...
TOOL RESULT ROUNDTRIP:           ...
STOP SEQUENCES:                  ...
TIMEOUT:                         ...
ROOT CAUSE(S):                   ...
FILES REPAIRED:                  ...
PARITY BATTERY:                  ...
FROZEN 12-TASK BATTERY:          ...
MODEL CAPACITY FAILURE PROVEN:   YES / NO
HELIX FAILURE PROVEN:            YES / NO
ADAPTER FAILURE PROVEN:          YES / NO
RUNTIME/RESOURCE FAILURE PROVEN: YES / NO
LIQUID 2.6B RESIDENT STATUS:     ACCEPT / PARTIAL / REJECT
PROTECTED REGRESSIONS:           ...
PROCESS HYGIENE:                 ...
```

---

## FINAL LAW

STOP SAYING "CONTEXT PROBLEM."
NAME THE LAYER.

HELIX SOLVES LONG-TERM PROJECT MEMORY.
CONTEXT CONTROL SOLVES WHAT THE MODEL NEEDS NOW.
THE MODEL CONTEXT WINDOW SOLVES HOW MUCH CAN FIT.
THE GENERATION BUDGET SOLVES HOW MUCH THE MODEL CAN SAY.
THE ADAPTER SOLVES HOW THAT MODEL SPEAKS TO COVERT.

THESE ARE NOT THE SAME PROBLEM.
PROVE EACH ONE.

IF HELIX IS WORKING, LEAVE IT ALONE.
IF LIQUID IS THINKING CORRECTLY BUT COVERT CUTS IT OFF, FIX THE BUDGET.
IF LIQUID SPEAKS ITS NATIVE PROTOCOL AND COVERT MISREADS IT, FIX THE ADAPTER.

IF THE MODEL STILL FAILS AFTER THE SYSTEM SPEAKS ITS LANGUAGE CORRECTLY,
THEN — AND ONLY THEN — CALL IT MODEL CAPACITY.

---

# ADDENDUM — LIQUID RUNTIME PROFILE / INFERENCE CONTROLS

Applies to this directive; does not replace it. Recorded 2026-09-22.

## PURPOSE
Do not continue testing Liquid 2.6B through one rigid inference configuration.
Covert owns the model runtime; expose, record and control the model-specific
inference settings needed to determine whether the failure is: input admission /
generation budget / reasoning parsing / tool parsing / stop behavior / timeout /
hardware-runtime configuration / actual model capacity. Do NOT change models.
Candidate remains `LiquidAI/LFM2.5-2.6B-QAD-Q4_0`.

1. **MODEL RUNTIME PROFILE** (not hard-coded Resident settings): MODEL ID ·
   ARTIFACT SHA256 · GGUF CHAT TEMPLATE · CONTEXT SIZE · MAX GENERATION/N_PREDICT ·
   TEMPERATURE · TOP_K · TOP_P · MIN_P if supported · REPEAT PENALTY · SEED ·
   STOP SEQUENCES · TIMEOUT · BATCH · UBATCH · THREAD COUNT · GPU OFFLOAD/LAYERS ·
   REASONING FORMAT · TOOL-CALL PARSER · TOOL-RESULT FORMAT. No silent defaults;
   record the effective configuration for every diagnostic run.
2. **THREE TOKEN BUDGETS**, reported independently: A. MODEL CONTEXT CAPACITY ·
   B. INPUT TOKENS ACTUALLY USED · C. OUTPUT/GENERATION TOKENS RESERVED.
   Never report only `context = N`. Required: INPUT + OUTPUT RESERVE + SAFETY
   MARGIN <= ACTIVE CONTEXT SIZE.
3. **DO NOT SIMPLY MAX CONTEXT**: use the smallest context window that safely fits
   bounded project truth + workflow + relevant Skills + bounded capability
   descriptors + user request + required output reserve. Measure first.
4. **GENERATION-BUDGET SWEEP** (same frozen task; no task/prompt/scoring/sampling
   changes between runs): diagnostic ceilings 1024 / 2048 / 4096 where they fit.
   Record: reasoning tokens · final-content tokens · tool-call emitted? ·
   finish_reason · truncated? · valid proposal? · latency. Goal: minimum safe
   reserve where Liquid reliably reaches its actionable/final output.
5. **CONTEXT-SIZE SWEEP** (only after output-budget behavior is understood):
   8K/12K/16K or nearest supported; same task + reserve; measure prompt admission,
   prompt eval time, RAM, latency, result quality; do not increase context if the
   prompt does not require it.
6. **SAMPLING PROFILE**: start from the known accounting configuration
   (temperature 0.1, top_k 50, repeat_penalty 1.1); record Covert's values; test
   parity first; no broad sampling search yet.
7. **TOP_P / MIN_P**: record whether active; do not assume defaults; reproduce the
   accounting effective settings as closely as possible; avoid stacking changes.
8. **CHAT TEMPLATE MUST BE OBSERVABLE**: template source (GGUF embedded / runtime
   default / custom Covert); rendered roles; reasoning delimiters; tool-call
   delimiters; tool-result formatting; inspectable diagnostic representation.
   Covert must not unknowingly override the model's native protocol.
9. **REASONING HANDLING**: explicitly separate reasoning from final content where
   supported; record reasoning_content / content / tool_calls / finish_reason; do
   not score raw reasoning as the final answer; do not ingest raw reasoning into
   Helix as canonical memory.
10. **TOOL PARSER PROFILE**: Liquid-native output -> model adapter/parser ->
    canonical Covert action schema -> Authority. Authority/Harness never
    understand Liquid-specific syntax.
11. **TOOL-RESULT ROUNDTRIP PROFILE**: capture proposal -> execution result ->
    returned tool message -> subsequent model response; a successful invocation
    followed by malformed reinjection is an adapter defect.
12. **STOP CONDITIONS**: record all active stops; determine whether termination
    came from EOS / max_tokens / timeout / custom stop / tool delimiter /
    reasoning delimiter / server parser; no blind stop-token edits.
13. **TIMEOUT PROFILE**: measure model load, prompt evaluation, reasoning
    generation, tool proposal, final answer separately; do not classify slow CPU
    inference as model incapacity.
14. **CPU/GPU SETTINGS**: record threads, batch, ubatch, GPU layers/offload, VRAM,
    RAM. If no Vulkan/GPU build exists: classify `GPU PATH NOT TESTED`; do not
    pretend CPU measurements are final hardware performance.
15. **AUTO PROFILE VS ADVANCED PROFILE**: structure the runtime profile for a
    later AUTO (derived from model metadata/hardware/working-context/required
    reserve) and ADVANCED (explicit overrides); config-level control suffices now.
16. **PROFILE PERSISTENCE**: persist the demonstrated working Liquid profile in
    canonical model/runtime configuration (model identity, profile version,
    effective settings, hardware assumptions, tested date/result); no secrets.
17. **PROFILE SAFETY**: reject impossible configurations before launch
    (input+reserve > context; unsupported parser/template; invalid sampling;
    unsafe allocation where knowable). Fail truthfully.
18. **ROOT-CAUSE OUTPUT** (yes/no, no ambiguous "context issue"): DID HELIX FAIL? ·
    DID INPUT CONTEXT OVERFLOW? · DID OUTPUT BUDGET TRUNCATE REASONING/FINAL? ·
    WAS CHAT TEMPLATE WRONG? · WAS REASONING EXTRACTION WRONG? · WAS TOOL PARSING
    WRONG? · WAS TOOL-RESULT ROUNDTRIP WRONG? · WERE STOP CONDITIONS WRONG? ·
    WAS TIMEOUT TOO LOW FOR THIS HARDWARE? · IS MODEL CAPACITY STILL A PROVEN
    FAILURE?
19. **LIQUID PROFILE RESULT**: return the smallest demonstrated stable profile
    (context size, max generation, sampling, timeout, threads, batch, GPU offload,
    chat template, reasoning format, tool parser, stop conditions, mean input/output
    tokens, RAM, VRAM, latency, PARITY BATTERY PASS/FAIL, FROZEN RESIDENT BATTERY).

## FINAL LAW (addendum)
DO NOT GUESS AT MODEL SETTINGS. MEASURE THEM.
HELIX DECIDES WHAT KNOWLEDGE MATTERS. CONTEXT CONTROL DECIDES WHAT ENTERS THIS
TURN. THE RUNTIME PROFILE DECIDES HOW THE MODEL IS ALLOWED TO RUN. THE ADAPTER
DECIDES HOW COVERT UNDERSTANDS ITS OUTPUT. MAKE ALL FOUR LAYERS OBSERVABLE.
THEN TUNE THE RUNTIME, NOT THE TRUTH.
