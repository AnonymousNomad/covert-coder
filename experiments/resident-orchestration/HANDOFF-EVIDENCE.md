# HANDOFF EVIDENCE — planner→coder, coder→reviewer, failure recovery, switches, restart

All references: `results/M1-plan-coder-review.json`,
`results/M2M3-restart-continuity-failure-recovery.json`,
`results/resident-orchestration-journal.jsonl`.

## PLANNER-CODER-HANDOFF
- The coder assignment contains the **accepted plan text** (truncated to 1,200
  chars) plus the objective, constraints, canonical state, required evidence and
  return contract — never the Resident conversation. Verified in M1: the coder
  received `ACCEPTED PLAN:` (the planner's artifact), and in M2: the revised plan.
- The planner received the **reconstruction** (stage/branch/changes/objective),
  not history. Plan artifacts: M1 1,831 chars; M2 revised plan 1,865 chars.

## CODER-REVIEWER-HANDOFF
- Reviewer assignment carries: objective, acceptance criteria (in the task),
  the change reference (artifact sha256), the execution evidence
  (`execution_evidence.result` = the deterministic check vector + exit code), and
  constraints. Law injected: "the coder's own claim is not evidence; PASS requires
  citing execution_evidence".
- **REVIEW-01 invariant proven twice more**: reviewer advisory PASS over a
  deterministic FAIL (M1 and M2), and the deterministic verdict was authoritative
  in both.

## WORKER-FAILURE-RECOVERY
- Structured failure object recorded: kind VERIFICATION_FAILURE, exit_code,
  `artifact_placeholder_detected: true`, artifact sha256, prior worker, detail.
- The Resident selected an action from the allowed set with a reason
  (M2: REPLAN, reason recorded verbatim). The runner **honored** the action
  (`action_honored` recorded): REPLAN produced a revised plan before retrying.
- Bounded recovery: at most two attempts; each attempt records the reason and the
  expected benefit (`switch_reason`); escalation to a different local worker on the
  second attempt. No model thrashing: one switch, one recorded justification.
- Exhausted recovery ends with the honest state (`operator decision required`),
  never an invented success.

## MODEL-SWITCH-CONTINUITY
- Switch executed: qwen2.5-coder-1.5b → SmolLM2-360M (alternate local worker),
  reason recorded ("previous attempt still failed after the chosen action; bounded
  recovery escalates to a different local worker"). Project objective, stage,
  artifact hashes, failures and next step survived the switch unchanged
  (continuity entry `model_switch` field).

## RESTART-CONTINUITY
- M2 ran on a **fresh stack** (no in-memory state, no transcript). The project
  state was reconstructed from canonical stores only: `.aide/workflow/state.json`,
  git status, `.aide/orch/continuity.jsonl`, `PROJECT_STATE.md`.
- The Resident was asked "Continue." and answered from the provided canonical
  state; the answer was thin (one line) — classified as MODEL_CAPACITY for
  multi-part structured answers at 230M, with the architectural remedy recorded:
  the harness owns the structure (deterministic reconstruction) and the Resident
  owns the language layer. No transcript replay was used or needed.

## OFFLINE-RESIDENT
- Every mission in this program ran **local-only**: local engines served by the
  model runtime, no provider configured, no egress. The supervised stacks were
  booted with no BYOK credentials; the chat/worker paths never attempted remote
  execution. `scripts/egress-audit.mjs` remains the canonical egress check
  (unchanged, previously green).
- Provider switching (local→cloud→local) is **BLOCKED_BY_PRODUCTION_WIRING**:
  the governed provider bridge exists (routes/connections.ts, BYOK) but no
  approved cloud provider is configured in this workspace, and the provider
  transport/routing is DeepSeek-owned. The mission is preserved: the Resident
  lane can consume the canonical bridge when an approved provider exists; the
  contract (assignment + evidence + deterministic verdict) does not change.
