# DAP disconnect CI follow-up — 2026-09-29

## State

The DAP repair checkpoint is pushed and its exact-SHA AIDE CI is green. This closes the a8 DAP contract failure; it does not certify live provider execution or release readiness.

- **Branch:** `nightshift/production-convergence-20260926`.
- **Failure SHA:** evidence-only commit `a8ac7933039eda388a49d8d6e6217909c56f6d63`.
- **Repair checkpoint SHA:** `f1bf0f5be896a089879a0f83932016edd7498cb9`; pushed with a clean worktree matching origin. The versioned root pre-push hook passed.
- **Failed exact-SHA CI:** [AIDE CI run 36571146449](https://github.com/AnonymousNomad/covert-coder/actions/runs/36571146449) failed on a8. Architecture battery: **827 total, 810 passed, 1 failed, 16 skipped**. The failing case was `tests/arch/dap-contract.test.ts` full debug session: expected adapter state `stopped`, observed `error`. Backend/integration, static type/lint, Veritas 6/6, generated/worktree, fixture cleanup and summary passed.
- **Parent source checkpoint:** `e8dfd1accbc5cca50ed3bc40ce76875d5f1c485b` had green exact-SHA AIDE CI run `36568947676`; a8 changed evidence only. The DAP result was treated as a real failure and repaired before advancing.
- **Repair exact-SHA CI:** [AIDE CI run 36574078825](https://github.com/AnonymousNomad/covert-coder/actions/runs/36574078825) completed successfully on f1bf0f5 in **10m53s**. All **22 workflow steps** passed: backend/integration, type/lint, bounded architecture including this regression, Veritas, generated-file/worktree, fixture cleanup, diagnostics upload and required summary.

## Root cause

`DapManager`'s child-exit handler unconditionally classified an adapter as `error` unless it had already reached `stopped`. During explicit `disconnect()`, the manager waits for a `terminated` event or child exit using a 25 ms poll. A conforming adapter can send the disconnect response, emit `terminated` shortly afterward, and exit before the next poll observes the event. The exit handler then sets `error`; the subsequent `stop()` sees no child and does not restore `stopped`. Existing retry comments indicated timing sensitivity, while source inspection identified this concrete lifecycle-state race.

## Bounded repair

- `DapManager` now tracks adapters with an explicit disconnect in progress. Child exit during that requested teardown maps to `stopped`; unexpected child exit still maps to `error`. The marker is removed in `finally`.
- The fake adapter has a deterministic delayed-`terminated`, early-exit mode that places child exit before the next manager poll.
- A regression asserts the delayed event is observed, adapter status is `stopped`, and the session is inactive.
- No timeout, assertion, or product success criterion was weakened.

## Local verification

- New delayed-terminated/early-exit regression: **1/1 passed**.
- Full `tests/arch/dap-contract.test.ts`: **10/10 passed**, including the real debugpy adapter round trip.
- `npx tsc -p tsconfig.node.json --noEmit`: passed.
- Scoped ESLint on the three changed source/test files: passed with exit 0.
- Fake adapter `node --check` and `git diff --check`: passed.
- The versioned root pre-push hook passed before the repair commit.

## Limits and next action

This repairs and closes the DAP contract failure found on an evidence-only commit; it does not qualify provider execution or product release readiness. Live OpenCode Go / DeepSeek remains UNKNOWN pending the owner-managed authentication filesystem path and existing spend ceiling. No credential contents were accessed and no live inference or spend occurred. PR #31 remains frozen.

Issue #38 was checked after push and updated with the exact-SHA CI result; no corrective Sol comment appeared. Continue the dependency-ordered release work. Hold any live provider task until the owner supplies and verifies the auth path and existing spend ceiling without exposing credential contents.
