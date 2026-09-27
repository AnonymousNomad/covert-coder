# RESIDENT SPECIFICATION (canonical design reference)

For: the ONE permanent Covert Resident. Companion to `RESIDENT-CONTRACT.md` (the
frozen, testable contract). No aspirational capabilities are listed here — only
what is implemented and evidenced.

## 1. Ownership
| Resident owns | Resident does NOT own |
|---|---|
| understanding objectives | permission (Execution Authority) |
| retrieval before clarification | execution (Harness/product routes; workers propose only) |
| canonical reconstruction | verdicts (Veritas + deterministic gate) |
| capability discovery (bounded) | state transitions (workflow kernel + runner) |
| worker selection + bounded assignment | persistence (workflow store, evidence files, memory) |
| interpreting deterministic evidence | provider transport (governed bridge, other lane) |
| continuity and truth reporting | — |

## 2. Canonical truth sources
`.aide/workflow/state.json` · `/api/git/status` + `/api/workspace/tree` ·
`.aide/verifications/*` + `.aide/trajectories/*` + audit rows +
`.aide/orch/continuity.jsonl` · memory (`memory-recall` + helix patterns +
`memory-blocks`) · Arsenal projection (live availability) · resident SOP catalog
(≤3 candidates / ≤2 bodies / ≤300-token capability details) · operation-policy +
Execution Authority · deterministic execution checks + `harness/veritas.mjs`.

## 3. Doctrines
### 3.1 Retrieval before clarification
KNOWN → use it · RETRIEVABLE → retrieve it · AMBIGUOUS → clarify ·
NOT RETRIEVABLE → clarify or report the limitation.
Tested retrievable facts: current project, workspace/tree, Git state, workflow
stage, existing evidence, available workers, available models, Skills (SOP
candidates), known failures (continuity), previous verified decisions.
Evidence: battery task `no-unnecessary-clarification` (230M PASS); soak mission
set (no unnecessary questions observed across 32 missions).

### 3.2 Bounded capability discovery
Existing implementation: Arsenal projection (live descriptors) → summary
(`compactArsenalSummary`) + filtered queries (≤50) + capability details capped at
300 tokens → awareness envelope hard cap **1500** tokens (measured typical
342–932). SOP discovery: IDF-scored, ≤3 candidates, ≤2 bodies. The Resident never
receives the full registry, every route, or every tool.
Gaps recorded: live capability *selection* is deterministic (system-side); the
model-facing selection ability is only measured by the frozen battery (new).

### 3.3 Authority stays outside the model
A proposal is not a permit. "Operator said yes" in prose is not a token. Every
execution needs its own approved exact operation. Evidence: authority-pressure
missions (soak `push-main`, `deploy it`) → proposals/blocked, never execution;
the arch dispatcher hard-denies un-enrolled mutations.

### 3.4 Evidence above claims
worker claim < tool return < execution observation < verification evidence <
canonical truth. The deterministic gate owns the verdict; advisory model PASS
never overrides a deterministic FAIL (proven in M1, M2, and the battery's two
conflict tasks).

### 3.5 Failure classification before repair
Taxonomy + deterministic classifier: `battery/classify.mjs` (13 classes), tested
against 11 historical failures (`tests/arch/resident-battery-integrity.test.ts`).

### 3.6 No dual-Resident
ONE RESIDENT, MANY REPLACEABLE WORKERS. No fast/smart split, no dynamic
switching. Escalation is worker-level. (Hard prohibition; see contract.)

### 3.7 Benchmark-leakage defense
Evaluation truth ≠ execution input. `battery/context.mjs` composes task messages
from the prompt string only; the integrity test asserts no expectation values or
scorer hints reach the message.

## 4. Relationships
- **Harness**: executes approved operations; owns deterministic structure (the
  Resident supplies language, not structure).
- **Veritas**: owns truth; the Resident interprets and reports it.
- **Workers**: proposal-only, bounded assignments, evidence-bearing review;
  replaceable without changing the project.
- **Authority**: prepare → decision → execute with exact operations; a worker or
  provider change never inherits a prior approval.
- **Orchestrator/runner**: sequences stages; the Resident recommends and
  interprets, the runner orders.

## 5. Accounting-harness pattern comparison (lessons only, no code imported)
Collaborator pattern: USER → RESIDENT → task/capability/authority/evidence
awareness → bounded capability discovery → structured action proposal → POLICY →
AUTHORITY → EXECUTION → read-back verification → EVIDENCE → RESIDENT.
| Pattern element | Covert Resident state |
|---|---|
| task awareness | ACCEPT (reconstruction + continuity) |
| capability awareness | ACCEPT (live Arsenal projection; bounded) |
| authority awareness | ACCEPT (operation-policy + authority classes) |
| evidence awareness | ACCEPT (deterministic gate + veritas) |
| bounded discovery | ACCEPT (≤3 SOP candidates; capability details ≤300; envelope ≤1500) |
| structured action proposal | PARTIAL (system structures; the 230M model fails JSON; candidate TBD) |
| policy → authority → execution | ACCEPT (single-use exact operations) |
| read-back verification | ACCEPT (approved write + approved test execution) |

## 6. Model-selection criteria (frozen)
Smallest single model satisfying the full critical contract with acceptable
resource/latency cost. Battery: `battery/TASKS.json` (12 tasks, 8 classes) +
`battery/scoring.mjs` (deterministic) + `battery/run-candidate.mjs` (model-neutral:
change `AIDE_CANDIDATE_FILE`/`LABEL` only). Results: `results/battery-*.json`.

## 7. Current status of the selection decision
- 230M: RETIRED as permanent candidate (`RESIDENT-230M-FINAL-ASSESSMENT.md`).
- 2.6B QAD: candidate run in progress; the first two runs were invalidated by a
  harness budget defect (thinking block consumed the token budget → empty
  content), fixed and re-run. No conclusion before the corrected run.
