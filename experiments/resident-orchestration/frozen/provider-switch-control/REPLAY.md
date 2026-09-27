# Provider-switch control case (frozen)

This bundle freezes the REAL development mission that ended in a verified local
FAIL (weak local coder produced a placeholder; deterministic gate refused it).
When a governed provider path exists (DeepSeek-owned wiring), rerun the SAME
mission with a DIFFERENT worker using `replay.mjs` and compare verdicts.

- Same: Resident, project snapshot, objective, workflow, SOP selection,
  acceptance criteria, authority, harness, veritas.
- Different: the coder worker (provider/model).
- Do not rewrite the task or add hidden truth; context must flow through the
  canonical assignment.

Local control result: {"attempts":[{"attempt":1,"model":"qwen2.5-coder-1.5b-instruct-q4_k_m","switched":false,"switch_reason":"retry with the REVISED plan (action honored)","artifact_sha256":"06a9c9f5d97a264ad34692ba84038e6d2c7a8df50f7135ce2645b3979633f375","exit_code":1,"code_extracted":true},{"attempt":2,"model":"smollm2-360m-instruct-q8_0","switched":true,"switch_reason":"previous attempt still failed after the chosen action; bounded recovery escalates to a different local worker","artifact_sha256":"06a9c9f5d97a264ad34692ba84038e6d2c7a8df50f7135ce2645b3979633f375","exit_code":1,"code_extracted":false}],"deterministic":"FAIL","advisory":"PASS","action":"REPLAN","action_reason":"REPLAN. The failure is a test run; recreate it with the exact same code."}
## Provider availability at freeze (2026-09-21)
- .aide/byok/providers.json exists but is EMPTY ([]), and no connections credentials are configured.
- Governed provider path: NOT AVAILABLE at freeze time -> replay NOT_REACHED (BLOCKED_BY_PRODUCTION_WIRING).
- The bundle is ready to replay unchanged the moment a governed provider is exposed.

## Exact replay commands (prepared; execute only after activation)
`
# 1. Prepare a fresh workspace from the frozen snapshot (the replay runner does this).
# 2. Run the SAME mission against the governed external worker:
AIDE_FROZEN_WORKER_ENDPOINT=<covert-resolved-provider-endpoint> ^
AIDE_FROZEN_WORKER_MODEL=<model-id-selected-from-the-provider-catalog> ^
node experiments/resident-orchestration/frozen/provider-switch-control/replay.mjs
# 3. Compare the replay's deterministic verdict with the frozen local control
#    (MISSION.json -> local_result.m2):
#    control: deterministic FAIL, exit_code 1, artifact sha 8be574ab...
#    treatment PASS only if exit_code 0 with the SAME tests and acceptance criteria.
`

## Pre-replay verification checklist (activation gate)
- provider authenticated: YES
- provider reachable THROUGH Covert: YES
- selected external model: AVAILABLE
- credential exposure: NO (do not inspect the credential)
- authority bypass: NO (the worker remains proposal-only; approval operations unchanged)

## Exam constants (must not change)
SAME Resident · SAME project snapshot · SAME objective · SAME workflow · SAME SOP
selection · SAME acceptance criteria · SAME authority policy · SAME harness
(approved file.write + terminal.run) · SAME tests (node --test test/) · SAME
Veritas (deterministic checks + evaluateExecution) · SAME review structure.
DIFFERENT WORKER ONLY. No prompt improvement, no manually supplied context, no
weakened tests, no changed acceptance criteria.

## Authority invariant (Program 23)
A provider/model switch must NOT transfer authority: a worker change never
inherits a prior execution's approval. Any required authority must be
independently valid for the new execution (fresh approved exact operations).

## Post-switch continuation (Program 24-25)
After PASS or FAIL: one legitimate restart, then "Continue." — reconstruction from
canonical state (project · objective · workflow · stage · completed · failed ·
blockers · evidence · next step) with no transcript dependency.
