# Windows canonical-launch process ancestry PID reuse — 2026-10-04

Date: 2026-10-04
Worktree: `E:\covert-nightshift-integration`
Branch: `nightshift/production-convergence-20260926`
Status: **REPAIRED LOCALLY / FOCUSED PROOF PASS; FULL SUITE STILL BLOCKED BY A SEPARATE ACCEPTANCE FAILURE**

## Preserved failure

The instrumented full `npm test` first stopped at `tests/integration/test-canonical-launch.mjs` before reaching E2E:

- Output: `E:\pip_temp\covert-w5-npm-test-instrumented-20261004.log`; SHA-256 `3021153D6434EF63DCCE7B34396DFB191C8FFAAA83E3197F134A50C21779450C`.
- Probe trace: `E:\pip_temp\covert-w5-npm-test-instrumented-20261004.jsonl`; SHA-256 `5C362551A5F3B31E32B8F8CEC4EBF43A9CA1F38103B100CFDD2AE4E3D575293A`.
- The canonical launcher test reported no open app-port listeners, but `cleanupLaunch` classified PID 5028 (`ATKOSD2.exe`) as a surviving owned descendant through PID 17528 (`conhost.exe`).
- Windows inventory recorded PID 17528's creation as `2026-10-04T11:41:04.808Z`; PID 5028's creation was `2026-10-02T13:52:56.955Z`, while its numeric `ParentProcessId` was 17528.
- The supposed child predates the current process using that parent PID by about 45 hours. It cannot be a child of that process generation. The existing `descendantsOf` walk matched numeric PPIDs without checking process creation generations, so PID reuse created a false ownership edge.

No process was terminated manually. The integration test's existing cleanup invoked `taskkill.exe` only for its spawned launcher PID; PID 5028 remained present afterward. The old test workspace was preserved by its failure path.

## Root cause and bounded repair

Root cause: `descendantsOf` treated a reused parent PID as the same process generation. It now rejects an ancestry edge only when both process creation times are available and the alleged child predates the current parent. If either time is unavailable, it retains the edge conservatively; missing identity data cannot make a possible owned process disappear from cleanup verification.

Two regressions were added: a PID-reuse edge is excluded, and an edge with unavailable creation time remains conservatively included.

## Verification

- Test first: `node --test --test-name-pattern='PID reuse does not turn a pre-existing process into a launch descendant' tests/integration/test-canonical-launch.mjs` failed **0 passed / 1 failed**, reproducing the false descendant. Output SHA-256: `B2E103C7A9CFBA66975EC1970566FDE22C540FE9362819E139C1F54C1B179357`.
- Focused regressions after repair: **2/2 passed**, 0 failed, 0 skipped.
- Full affected file: `node --test --test-concurrency=1 tests/integration/test-canonical-launch.mjs` — **5/5 passed**, 0 failed, 0 skipped, 17.47 seconds. Output: `E:\pip_temp\covert-canonical-launch-after-pid-reuse-repair-20261004.log`; SHA-256 `C29BAEE7B786E08F68182E9C971E724014C549E22655EF97DFF36FD7C4D27FC8`.

This local repair does not clear the earlier Veritas `/api/model/ready` timeout and has not been published or exact-SHA CI-verified.
