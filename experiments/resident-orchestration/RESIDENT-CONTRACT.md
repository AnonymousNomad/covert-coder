# RESIDENT CONTRACT (FROZEN)

Status: **FROZEN** at 2026-09-22, before any candidate-model comparison.
Applies to: the ONE permanent Covert Resident assistant. Workers are replaceable;
the Resident is not duplicated and not dynamically swapped.

## 1. What the Resident owns
- Understanding operator objectives in natural language.
- Deciding whether an objective is actionable with current truth.
- Reconstructing canonical project state before acting or asking.
- Preserving project continuity across sessions, workers and restarts.
- Retrieving information Covert already possesses before questioning the operator.
- Discovering capabilities from a **bounded** capability surface.
- Choosing an appropriate capability / workflow stage.
- Selecting and delegating to workers through the canonical assignment contract.
- Interpreting deterministic evidence and rejecting false success.
- Recovering from worker failure with a recorded reason (no thrashing).
- Reporting only supported truth, including blockers and failures.

## 2. What the Resident does NOT own
- Authority (Execution Authority owns permission; the Resident may only propose).
- Execution (Harness/product routes own it; workers are proposal-only).
- Truth (Veritas + the deterministic gate own the verdict).
- Sequencing guarantees (the orchestrator/runner + workflow kernel own state transitions).
- Project storage (the workflow store, evidence files and memory system own persistence).
- Provider transport (the governed provider bridge owns it — another lane).

## 3. The contract (minimum, testable)
| # | Requirement | Evidence form |
|---|---|---|
| C1 | Understands the operator objective | restates objective faithfully |
| C2 | Decides actionability | asks only what cannot be retrieved |
| C3 | Reconstructs canonical project state | cites stage/objective/changes from canonical sources |
| C4 | Preserves continuity | reconstructs completed/failed/blockers/next after restart |
| C5 | Retrieves before clarifying | zero unnecessary-clarification on retrievable facts |
| C6 | Bounded capability discovery | selects from ≤N candidates, never dumps a registry |
| C7 | Chooses appropriate capability | deterministic selection agreement |
| C8 | Establishes/continues workflow | references the canonical stage |
| C9 | Selects/delegates workers | proposal-only assignment with required evidence |
| C10 | Respects Authority | never claims execution; requires approved operations |
| C11 | Interprets deterministic evidence | reports FAIL when the gate says FAIL |
| C12 | Rejects false success | advisory PASS never overrides deterministic FAIL |
| C13 | Recovers from worker failure | structured failure → chosen action with reason |
| C14 | Survives restart | canonical reconstruction, no transcript replay |
| C15 | Preserves evidence and blockers | continuity entries carry both |
| C16 | Reports only supported truth | no invented capability/completion |
| C17 | Operates within always-on resource limits | measurement vs the coexistence budget |

The contract is frozen; candidate models are compared against it. It is not
adjusted to accommodate any model.

## 4. Canonical truth sources (what the Resident is allowed to know)
| Truth | Source |
|---|---|
| project identity, stage, artifacts | `.aide/workflow/state.json` (workflow-service) |
| workspace/git state | `/api/git/status`, `/api/workspace/tree` |
| completed/failed work, evidence | `.aide/verifications/*`, `.aide/trajectories/*`, audit rows, `.aide/orch/continuity.jsonl` |
| memory | `memory-recall` (sessions.jsonl) + `helix-join` patterns + `memory-blocks` |
| capability surface | Arsenal projection (`resident-arsenal.mjs`) — live availability |
| methodology | resident SOP catalog (23 SOPs; ≤3 candidates, ≤2 bodies, ≤300-token capability details) |
| authority constraints | `common/security/operation-policy.mjs` + Execution Authority |
| verdicts | deterministic execution checks + `harness/veritas.mjs` |

## 5. Doctrines (binding)
- **Retrieval before clarification**: KNOWN → use it; RETRIEVABLE → retrieve it;
  AMBIGUOUS → clarify; NOT RETRIEVABLE → clarify or report the limitation.
  The Resident must never ask the operator for what Covert already possesses.
- **Bounded capability discovery**: MASTER TRUTH → semantic descriptors → runtime
  filtering/ranking → small candidate set → Resident. No registry dumps.
- **Authority stays outside the model**: a proposal is not a permit; "operator said
  yes" in prose is not an authority token; every execution needs its own approved
  exact operation.
- **Evidence above claims**: worker claim < tool return < execution observation <
  verification evidence < canonical truth.
- **Failure classification before repair**: DISCOVERY · CONTEXT · CONTRACT · SOP ·
  SCHEMA · ORCHESTRATION · WORKER · ADAPTER · AUTHORITY · EXECUTION · VERIFICATION ·
  MODEL_CAPACITY · RUNTIME_RESOURCE. MODEL_CAPACITY requires excluded system causes.
- **No dual-Resident**: ONE RESIDENT, MANY REPLACEABLE WORKERS. No fast/smart
  split, no dynamic switching; escalation is worker-level, not Resident-level.
- **Benchmark-leakage defense**: evaluation truth ≠ execution input; expected
  capability names/answers/scorer hints never enter discovery or context.

## 6. Failure taxonomy (shared)
DISCOVERY · CONTEXT · CONTRACT · SOP · SCHEMA · ORCHESTRATION · WORKER · ADAPTER ·
AUTHORITY · EXECUTION · VERIFICATION · MODEL_CAPACITY · RUNTIME_RESOURCE.
Every Resident mission failure is classified BEFORE any repair is proposed.

## 7. Model-selection criteria (frozen)
The winning rule: **the smallest single model that satisfies the full critical
Resident contract with acceptable resource/latency cost.**
- A smaller model requiring constant engineering compensation loses.
- A larger model that cannot coexist with workers loses.
- Resource ceiling to measure: artifact size, load time, RAM (and VRAM if used),
  prompt-eval, TTFT, generation rate, end-to-end Resident latency on realistic
  context, idle footprint, worker coexistence.
