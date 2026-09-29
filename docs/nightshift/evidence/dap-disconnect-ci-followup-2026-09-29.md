# DAP disconnect CI follow-up — 2026-09-29

## State

Repair locally verified; checkpoint commit and exact-SHA CI pending.

- **Branch / starting SHA:** `nightshift/production-convergence-20260926` / `a8ac7933039eda388a49d8d6e6217909c56f6d63`.
- **Failed exact-SHA CI:** [AIDE CI run 36571146449](https://github.com/AnonymousNomad/covert-coder/actions/runs/36571146449) failed on a8. Architecture battery: **827 total, 810 passed, 1 failed, 16 skipped**. The failing case was `tests/arch/dap-contract.test.ts` full debug session: expected adapter state `stopped`, observed `error`. Backend/integration, static type/lint, Veritas 6/6, generated/worktree, fixture cleanup and summary passed.
- **Parent source checkpoint:** `e8dfd1accbc5cca50ed3bc40ce76875d5f1c485b` had green exact-SHA AIDE CI run `36568947676`; a8 changed evidence only. The DAP result is still treated as a real failure and repaired before advancing.

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
- Commit, versioned root pre-push, remote push, and exact-SHA CI for the repair are pending at the time of this record.

## Limits and next action

This repairs the DAP contract failure found on an evidence-only commit; it does not qualify provider execution or product release readiness. Live OpenCode Go / DeepSeek remains UNKNOWN pending the owner-managed authentication filesystem path and existing spend ceiling. No credential contents were accessed and no live inference or spend occurred. PR #31 remains frozen.

Next: run the versioned root pre-push gate, commit only this DAP repair plus its continuity/evidence records, push the convergence branch, then verify AIDE CI on that exact SHA and check Issue #38.
