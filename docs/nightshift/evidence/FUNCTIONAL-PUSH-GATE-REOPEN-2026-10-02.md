# Functional checkpoint publication gate

Source: `e949c18a3f1b349f6212c29db6884e4f88d5c4bc`, canonical convergence
worktree and branch. The functional source and preserved visual specification
are unchanged throughout these runs. Rejected Design Lab remains untracked and
excluded. PR #31 remains frozen.

## Retained failure

The actual original full pre-push hook completed **888 tests / 875 pass / 2 fail
/ 11 skip / 0 cancelled**, 936625.6612 ms. Git refused publication. Remote
readback still showed `3e6c89b7830a992952e543987cd8e3b8b2470e29`.

Both failures were `TimeoutError` under unchanged fixture deadlines:

- exercise-routes: correct submission passes with no reveal and feeds learner state;
- hook-executor: deferred hook execution, pending operation and approval executes once.

Hook fixture audit timestamps show tasks.command consumed at
01:11:47.920Z, tasks.read proposed at 01:11:47.928Z, next command outcome at
01:11:59.592Z, failed status request at 01:11:59.622Z. No hook marker was
present on inspection. These observations establish delay, **not its cause**.
The earlier original 888/877/0 gate remains historical evidence, not an override.

Log SHA-256:
`803b334facb85b4839c8e95caad89c2d4bcc069908370e39b1d6b342bd1c2c4d`.
Fixture retained under C: TEMP `covert-truth-pushgate-b6e933634f4d4d13805f1e8dbec78636`.

## Bounded investigation and current recovery

Outside-product diagnostic preload observes fixture filesystem waits, child
startup/lifecycle and event-loop delay. It stores timings in memory until exit,
without request bodies, credentials, authority material or production changes.
Original deadlines, assertions, flushes, Authority and admission floors remain.

The first diagnostic launch used a raw Windows ESM import path and failed before
any test body (`ERR_UNSUPPORTED_ESM_URL_SCHEME`). Its log/result are retained
separately. A file URL corrected only the launcher; syntax check passed.

The corrected isolated exercise/hook suites passed **16/16**, zero fail/skip/
cancel, 22310.0207 ms. Sampled 100 handle flushes: maximum 18.1146 ms; eight
spawn-return calls: maximum 13.767 ms. This did not reproduce the original stall.

The original ordered full Windows battery, with only the diagnostic preload
added, passed **888 / 877 pass / 0 fail / 11 skip / 0 cancelled**, 523427.7703 ms.
The two formerly failing cases passed in their full-suite context. Sampled
affected-fixture flush maximum: 29.4559 ms. Across the whole battery the preload
also measured unrelated long spawn calls (maximum 2249.6823 ms) and an event-loop
delay of 10359.930879 ms; these are not attributed to the failed requests.

Full diagnostic log SHA-256:
`e4f3c939137411e97572290e3ae7a1e1abb2a5c0cf66b22e7d97c321e7200024`.
Trace SHA-256:
`019927aaabd6a423fd0923257d2a9b84c30d399dc609a4c3deefb6119c2c6a73`.

The original exact cause remains **UNKNOWN / OPEN**. Current recovered behavior
is proven for these runs. No Covert leak, disk fault or antivirus cause is
inferred. No storage warning events were returned for the inspected window.
Later live host counters included 2100 MiB available physical RAM and 3710 pages
input/sec; those are a later sample, not historical failure attribution. No
unrelated process, pagefile, storage setting or model collection was changed.
No local model was started below its 6.5 GiB physical / 5 GiB commit floors.

## Publication and remaining acceptance

This receipt preserves the material verification change before publication.
Require a fresh **unmodified canonical hook** on the reviewed committed state
before pushing. Then verify remote equality and exact-SHA AIDE/browser/Veritas
CI, check Issue #38, and continue the functional spine. This diagnostic pass is
not the unmodified publication gate or installed/live qualification.

Source inspection identifies Resident task submission as local-only despite
separate project provider role defaults. Actual-component reproduction and a
repair through canonical exact-target/Authority/Admission owners remain pending.
Do not replace those owners with the legacy fallback router or a parallel dock.
Memory, Ghost Code, watchdog, fresh-user installed journey, live model/provider
qualification, Resident mission/recovery receipts, GLib and final RC gates remain
open. No release readiness, model support expansion or visual lock is claimed.

Local immutable logs, metadata, fixtures and diagnostic drivers:
`E:\covert-tooling\functional-release-20261001`.

Diagnostic method reference: [Node performance measurement APIs](https://nodejs.org/api/perf_hooks.html).
