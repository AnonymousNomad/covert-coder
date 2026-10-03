# Supervised test startup rollback

Executor label: **Saul 6.1 Ultra**. Starting source:
`ce01ba9494ab5aefdd0c4a3b62586a649bb6f437`, canonical convergence branch.

## Failure and demonstrated cause

An interrupted temporary diagnostic reached real health but failed pairing.
Its injected observer referenced a helper outside the transformed module's scope.
This was a diagnostic defect, not proof of the historical storage/audit cause.
The supervised test launcher had already created two children and a facade;
startup rejection left those resources running before callers received close().
The exact diagnostic-owned tree was stopped and captured descendants confirmed
absent. Other processes were untouched.

The controlled pre-repair regression reproduced the leak: **1 test, 0 pass,
1 fail**, 6523.53 ms. Its report precedes emergency fixture cleanup, so cleanup
cannot hide the startup defect. The original red and hashes remain preserved.

## Bounded correction

Startup now owns rollback before its first spawn. It attempts supervisor, facade
and every child cleanup, preserves the original error after successful rollback,
and retains cleanup failures alongside that error. Concurrent close calls share
one promise. Child cleanup uses retained native references, awaits close, clears
timers and refuses to claim success on an unconfirmed exit or stream cleanup.

The regression runs inside Node's existing test-file isolation and keeps native
child close promises from spawn time. Removing an extra fixture process avoids
an additional leader-death ownership gap. Assertions observe resources before
emergency cleanup, which attempts every captured resource. Temporary workspace
removal is conditional on confirmed cleanup and checked absolute boundaries.

## Verification

- Final focused regression: **2/2**, natural worker exit, 7897.4504 ms.
- Final affected signal/Authority/canonical-launch checks: **8/8**, no failures,
  skips or cancellations, 35518.1703 ms.
- Initial TypeScript checks pass; ESLint has zero errors and 62 existing warnings.
- Final whole Veritas: **6/6 true**; full npm test exits zero. Its compile gate
  passes both TypeScript projects, ESLint and Windows architecture **981 total /
  970 pass / 0 fail / 11 skip / 0 cancelled**, 674585.9295 ms.
- Full publication gate and exact-SHA CI remain pending before publication.

### Cumulative architecture rerun after the preserved full-suite red (2026-10-03)

On source SHA `b82ace3922fbe5f519562c1168438bb5aad59cc0`, the ordered cumulative
architecture suite completed naturally with **981 tests / 970 pass / 0 fail /
11 skip / 0 cancelled**, exit code 0, in 785079.0917 ms. This includes all 12
test cases named in the earlier interrupted/red run; none reproduced. This is a
non-reproduction result only: the earlier failures and hang remain preserved,
and their initiating cause is still **UNKNOWN**. No root-cause closure is
claimed. The run used the detailed Node reporter, single-file concurrency,
`AIDE_FULL_BATTERY=1`, and invocation-local clearing of Git hook environment
variables. It is the architecture suite result, not a new whole-Veritas,
`npm test`, publication-hook, or exact-SHA CI result.

Raw log: `E:/covert-tooling/functional-release-20261001/b82-full-arch-diagnostics-20261003.log`
SHA-256: `64669E627AE2118C8016C4DD234C6E260207E914D9EB6D464468B5FFB970FF6D`.
The canonical publication hook and exact-SHA CI remain pending.

The inherited hook path targets an older checkout without the accepted Git
environment-isolation repair. The publication invocation selects this canonical
worktree's tracked pre-push hook explicitly; shared configuration is preserved.

Machine and provider acceptance are outside this test-infrastructure claim.
No resource floor, Authority rule, request deadline or assertion was weakened.
These tests do not qualify a model or close the historical storage timeout.

## Remaining work

Historical storage/audit timeout remains **OPEN / CAUSE_UNKNOWN**. The GLib
advisory stays open. Visual work and PR #31 remain preserved. After the green
publication checkpoint, continue the owner-directed Planner/Coder/Reviewer
onboarding-trio completion through existing Model Manager, model acquisition,
role assignment and qualification owners. Preserve the separate response
identity and context/skill survival gates; OpenCode-reported selection must
remain distinct from upstream response proof.

The companion JSON records comparison details, repair loops, raw log hashes,
known tooling mistakes and evidence limits. Total executor wall time is UNKNOWN.
