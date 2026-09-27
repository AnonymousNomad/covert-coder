# RESIDENT-ORCHESTRATION-JOURNAL

Canonical journal: `results/resident-orchestration-journal.jsonl` (append-only,
one row per mission).

| Mission | Result file | Verdict | Notes |
|---|---|---|---|
| M1 operator intent → plan → coder → review | `results/M1-plan-coder-review.json` | deterministic FAIL / advisory PASS | full chain on a real repo task; coder placeholder caught by execution evidence |
| M2/M3 restart continuity + failure recovery + model switch | `results/M2M3-restart-continuity-failure-recovery.json` | deterministic FAIL / advisory PASS | REPLAN honored; bounded recovery; model switch; continuity entry |
| M6 real-engine streamed acceptance | `results/M6-streamed-acceptance.json` | 10/10 PASS, 0 unsafe | two real containment/wiring defects found + repaired + regressions |

## Context economics (per stage, from M1/M2 results)
| Stage | Model calls | Worker/Resident context (approx tokens) | Output (approx tokens) |
|---|---|---|---|
| resident-understanding | 1 | 0 | 36 |
| reconstruction | 0 | 0 | 0 (deterministic reads) |
| methodology | 0 | 0 | 0 (deterministic selection) |
| planner | 1 | 218 | 458 |
| coder | 1 | 512 | 35 (placeholder — the failure) |
| harness | 0 | 0 | 0 (approved execution) |
| reviewer | 1 | 233 | 116 |
| resident-interpretation | 1 | 0 | 9 |
| resident-continue | 1 | 0 | ~20 |
| resident-decision | 1 | 0 | ~25 |
| replan | 1 | ~250 | ~460 |
| coder-attempt-1/2 | 2 | ~520 each | small |
| resident-status | 1 | 0 | contained (UNUSABLE) |

Maximum useful context, not maximum context: the largest assignment was ~520
tokens; no stage received the transcript; SOP bodies were capped at 2.

## Weak-model amplification capture (for Luna's independent experiment)
Every mission row records: MODEL (per stage), RAW TASK, COVERT CONTEXT (assignment
payloads), SKILLS (selected SOP ids), MEMORY (canonical state supplied),
WORKFLOW (stage), HARNESS ACTIONS (approved ops + execution), VERITAS RESULT,
ATTEMPTS (with reasons), FINAL OUTCOME, OVERHEAD (timings + token estimates).
Raw per-stage assignments and outputs are in the mission result JSONs.
