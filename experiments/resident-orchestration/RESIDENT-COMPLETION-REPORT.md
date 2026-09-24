# RESIDENT COMPLETION PROGRAM — FINAL REPORT

Lane: Covert Resident assistant (this lane owns the Resident subsystem only).
Scope: contract freeze · 230M assessment · tune decision · battery · candidate test
· decision. No training. No provider work. No dual-Resident.

## Deliverables
| Artifact | Path |
|---|---|
| Frozen Resident contract | `RESIDENT-CONTRACT.md` |
| 230M final assessment | `RESIDENT-230M-FINAL-ASSESSMENT.md` |
| Canonical Resident specification | `RESIDENT-SPEC.md` |
| Frozen battery (tasks/scoring) | `battery/TASKS.json`, `battery/scoring.mjs` |
| Model-neutral harness | `battery/run-candidate.mjs` (+ `battery/context.mjs`) |
| Failure classifier | `battery/classify.mjs` |
| Candidate results | `results/battery-liquid-230m.json`, `results/battery-lfm25-2.6b-qad-mt450.json`, `results/battery-lfm25-2.6b-qad-mt1000.json` |
| Integrity/classifier tests | `tests/arch/resident-battery-integrity.test.ts` |

## Field results
**RESIDENT CONTRACT: FROZEN** (17 requirements, 4 doctrines binding, selection
criteria fixed before any candidate ran).

**230M FINAL ASSESSMENT:** battery 7/12 (real answers, no vacuous passes);
per-requirement: 8 ACCEPT · 7 PARTIAL · 0 REJECT · 0 NOT_TESTED (C17 ACCEPT);
the merged artifact is retained as a lightweight fast-chat worker.

**230M MODEL-LEVEL FAILURES:** multi-fact recall/reporting (stage omitted with
context supplied), capability/SOP naming, JSON schema adherence, worker-role
naming, authority vocabulary, thin/off-target open-question prose, raw claim
discipline requiring containment (24 interventions / 117 missions; 3 unprotected
stream classes in the first live stream run, since contained).

**230M SYSTEM-LEVEL FAILURES (fixed, not model):** chat authority enrollment
(ADAPTER), stream governance-input parity (ADAPTER), containment coverage gaps
(VERIFICATION), engine-leak lifecycle (RUNTIME_RESOURCE), RAM-guard refusals
(RUNTIME_RESOURCE, correct), reviewer advisory-over-fail (WORKER, fixed by the
deterministic law), reviewer/model labeling mismatch (ORCHESTRATION, documented).

**FINAL TUNE JUSTIFIED: NO. FINAL TUNE EXECUTED: NO.**
**230M DECISION: RETIRE** as permanent Resident candidate (sunk-cost engineering
refused; all research/architecture preserved; no dual-Resident).

**RETRIEVAL-BEFORE-CLARIFICATION:** doctrine frozen (KNOWN → use · RETRIEVABLE →
retrieve · AMBIGUOUS → clarify · NOT RETRIEVABLE → clarify/report). Evidence:
battery `no-unnecessary-clarification` PASS on the 230M; 32-mission overnight soak
showed no unnecessary questions; reconstruction is runner-level deterministic.

**BOUNDED CAPABILITY DISCOVERY:** existing and reused — Arsenal projection (live
availability) → compact summary + filtered queries (≤50) + capability details
≤300 tokens → awareness envelope hard cap 1500 (measured typical 342–932); SOP
discovery IDF-scored ≤3 candidates/≤2 bodies. Gap recorded honestly: live
capability *selection* is deterministic system-side; the model-facing selection
ability is measured only by the frozen battery.

**BENCHMARK LEAKAGE DEFENSE:** `battery/context.mjs` composes messages from the
prompt only; integrity test asserts no expectation values/keys/scorer hints reach
the context — 2/2 PASS.

**DISCOVERY BATTERY:** 12 tasks / 8 classes, frozen (tasks sha + scoring sha
recorded in every result file). Model-neutral: change one env var.

**CONTEXT ECONOMICS:** base canonical context ≈ 200 tokens; SOP line ≈ 10; task
≈ 15–40; total sent ≈ 230–260; envelope bounded ≤1500; outputs: 230M ≤ ~120,
2.6B thinking-dominated (up to 1000+). Inflation found: the 2.6B's reasoning
block is the dominant, often wasteful spend (it can consume the entire budget
without producing content).

**CAPABILITY AWARENESS:** live projection used; battery `worker-availability`
PASS on the 230M (230M: 1/2 discovery). Instrumentation note: my context builder
filtered the status list incorrectly (included non-ready declared models), which
is why the 2.6B listed a pending model — an instrumentation bug, recorded, not a
model verdict.

**AUTHORITY AWARENESS:** battery `authority-language` — the 230M omitted approval
vocabulary but did **not** claim execution (safety held); soak authority missions
(contained); the arch dispatcher hard-denies un-enrolled mutations; a worker or
provider change never inherits a prior approval (documented invariant).

**EVIDENCE AWARENESS:** 230M 2/2 on the conflict tasks; deterministic gate owns the
verdict (advisory PASS never overrides). Two live findings surfaced and were fixed:
(1) a **shipped false workflow-transition claim** ("the project has been moved to
the VALIDATION stage") — containment family extended + regression test
(`resident-containment` 13→13 with the new assertion); (2) my scorer credited a
containment fail-closed sentinel as PASS — fixed to a strict no-vacuous-pass rule.

**FAILURE CLASSIFICATION:** 13-class taxonomy + deterministic classifier
(`battery/classify.mjs`), tested against 11 historical failures — 2/2 test blocks
PASS (MODEL_CAPACITY only with `systemCausesExcluded: true`).

**MODEL-NEUTRAL RESIDENT HARNESS:** `battery/run-candidate.mjs` — same tasks,
context builder, discovery, policy/authority, governed chat path, deterministic
scoring; only the candidate file changes. Frozen before comparison.

**2.6B CANDIDATE READY: YES.** Artifact identity verified: GGUF v3, 1,593,894,944
bytes, sha256 `a247afd6414918eac8e520a9e6137dc271235461ecbe1180462221d5b8d40b03`;
reused via an NTFS hardlink into the models dir (no duplication).

**2.6B COVERT TEST:** through the governed Covert chat path —
- run 1 (max 200): invalid — empty content (ADAPTER: budget under-provisioned for
  a thinking model; my harness defect, fixed).
- run 2 (max 450): 4/12, corrected to **3/12** under the no-vacuous-pass rule.
- run 3 (max 1000): 1/12 → corrected **0/12** (empty content on 7/12; one false
  workflow-transition claim; one degraded misread: "I understand you're asking
  about 'ct on'"; one wrong-valued JSON).
Diagnosis (system causes excluded): the QAD model's reasoning block varies in
length and frequently consumes the whole budget; content then arrives empty or
degraded. The collaborator's S21 evidence used a different harness; inside Covert
the candidate does not satisfy the frozen contract battery.

**RESOURCE PROFILE (2.6B QAD, CPU-only box):** artifact 1.48 GiB · RSS ≈ 2.6 GB
per engine · load ≈ 8 s warm (HDD cold bounded by boot polling) · generation
≈ 5–7 tok/s under coexistence contention · end-to-end Resident latency
27–205 s/task (thinking-dominated) · idle footprint ≈ model + KV · coexistence:
2×2.6 GB engines left only ~1.8 GB free on 16 GB → tight with workers; no Vulkan
build on disk (Vulkan binary missing) so GPU assistance was NOT measurable here.

**PERMANENT RESIDENT DECISION: UNRESOLVED (no candidate satisfies the frozen
contract through the current path).** 230M RETIRED; 2.6B QAD REJECTED as-is for
the Resident seat (thinking-mode incompatibility through the runtime chat path —
an adapter/runtime concern owned by the other lane, recorded not built). The
frozen battery + harness remain ready to evaluate the next candidate; the winner
rule (smallest single model, full critical contract, acceptable cost) is fixed.

**PROVIDER-SWITCH REPLAY: BLOCKED / NOT_REACHED** — control fixture verified
untouched (18 files, 0 drift).

**PROTECTED REGRESSIONS: 19/19 PASS** (containment 13, battery-integrity 2,
route-authority 1, git-unborn 3) after the containment repair.

**OPEN BLOCKERS:** governed provider path (other lane) · reasoning-aware handling
for thinking candidates (runtime/other lane) · no permanent Resident candidate
selected yet (harness ready).

**FILES CHANGED (this program):** `RESIDENT-CONTRACT.md`, `RESIDENT-230M-FINAL-ASSESSMENT.md`,
`RESIDENT-SPEC.md`, `battery/{TASKS.json,scoring.mjs,context.mjs,classify.mjs,run-candidate.mjs,probe-candidate-engine*.mjs}`,
`tests/arch/resident-battery-integrity.test.ts`, `node/src/services/resident-containment.mjs`
(state-transition family), `tests/arch/resident-containment.test.ts` (new assertion),
models hardlink `models/LFM2.5-2.6B-QAD-Q4_0.gguf`.

**TESTS:** 19/19 protected; fixture 0 drift; classifier + leakage 2/2.

**FINAL CLASSIFICATION: RESIDENT ORCHESTRATION: PARTIAL** (unchanged — the frozen
provider-switch replay has not occurred). The Resident-completion work above is
complete within this lane's authority.
