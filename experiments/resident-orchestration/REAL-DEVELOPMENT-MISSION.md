# REAL-DEVELOPMENT-MISSION

A bounded real repository task was run through the complete chain on a disposable
project (`E:\pip_temp\opencode\resident-orch-project`: a real git repo with a real
failing test suite for `src/version.mjs`).

## Chain executed (M1 — `results/M1-plan-coder-review.json`)
```
OPERATOR GOAL  "The version parser is failing its tests. Fix it so all tests pass."
→ RESIDENT     governed /api/chat: objective + what state it needs
→ RECONSTRUCT  canonical: workflow state (IMPLEMENTATION), git branch/changes, tree, brief
→ METHODOLOGY  deterministic SOP selection: resident.handle-verification-failure (strong)
→ WORKER SELECT Arsenal projection (MODELS by availability+roles)
→ PLANNER      qwen2.5-coder-1.5b → bounded plan artifact (1,831 chars)
→ CODER        qwen2.5-coder-1.5b, received the ACCEPTED PLAN (not the conversation)
→ APPLY        approved exact operation (POST /api/file/write) to src/version.mjs
→ HARNESS      approved terminal: node --test test/ → exit 1 (real execution evidence)
→ VERITAS      deterministic gate: FAIL (artifact sha b145de7b…)
→ REVIEWER     qwen2.5-coder-0.5b, evidence-bearing assignment → advisory PASS
→ RESIDENT     "The verdict is FAIL, not PASS." (no optimistic summarization)
→ CONTINUITY   .aide/orch/continuity.jsonl + PROJECT_STATE.md
```
Outcome: **honest FAIL** — the coder produced a placeholder artifact
(`implementation logic here`) which the deterministic gate caught. The architecture
did not manufacture a success.

## Continuation (M2 — `results/M2M3-restart-continuity-failure-recovery.json`)
Fresh stack, same project, no transcript: reconstruction from canonical state →
Resident chose **REPLAN** (recorded reason) → revised plan (1,865 chars) →
coder attempt 1 (qwen1.5b, new artifact sha 06a9c9f5…) → still exit 1 →
attempt 2 (model switch to SmolLM2-360M) → no new artifact extracted → exit 1 →
deterministic FAIL (advisory PASS again overridden) → continuity entry with
failures + blockers + operator decision required.

## Honest disposition
- **Real development mission: PARTIAL.** The complete governed chain runs on a real
  repository task with real workers, real execution evidence, real deterministic
  verdicts, and real continuity. The final verified PASS was not achieved because
  the available local coders (0.5B–1.5B) could not implement the contract —
  a worker-capability finding, not an orchestration defect. The system's correct
  behavior (refuse false success, record the failure, require an operator decision
  or a stronger worker) is exactly what the evidence shows.
- Escalation path recorded: the operator can supply a stronger local coder
  (e.g. the on-disk Qwen3-4B coder) or a governed cloud provider; the Resident
  lane will consume it without changes to the contract.
