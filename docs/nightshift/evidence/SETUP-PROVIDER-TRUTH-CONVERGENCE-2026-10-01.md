# Setup and provider truth: canonical convergence

Parent: `3e6c89b7830a992952e543987cd8e3b8b2470e29` on
`nightshift/production-convergence-20260926`. PR #31 remains frozen.

## Reproduction and cause

The actual canonical SetupSession component was exercised in Edge before the
repair. A required daemon read failed, yet the rendered title was WORKSPACE
READY. Empty check arrays passed `.every()` before execution, and a cached
positive flag survived later failure. The retained reproduction JSON reports
`requiredDaemonFailed`, `prematurePass` and `staleReadyAfterFailure` all true.

The selective source repair comes from the existing product-closure audit lane
through `4e1c85f3b1881102ff7e7e1dc37630e232e17f1a`. Fresh reconciliation found
the affected browser files unchanged since audit base `fc263fe`; accepted
runtime, Model Access, native packaging, Authority and Admission code is retained.
No historical branch was merged. The separate capability-ledger tranche is not
included in this bounded repair.

An initial patch failed before mutation: PowerShell added CRLF to Git's LF
diff. Native `git diff --binary --output` repaired that transport. The failed
patch and original red regression are retained; neither is hidden as a pass.

## Stronger invariants

- Readiness requires exactly one successful result for every mandatory check
  in the latest completed run. Pending, failed, missing and abandoned results
  cannot establish or retain a pass.
- Approval choices and preferences use existing onboarding and governed file
  APIs. Failed saves/completion remain unresolved. Reopening restores choices,
  never current readiness from a historical completion timestamp.
- Saved model identity is retained when absent from recommendations; there is
  no silent replacement or claim of qualification/provisioning.
- Late provider results cannot overwrite a reopened setup session. Failed cloud
  status reads report unavailable; LOCAL ONLY requires explicit routing policy.
  Remote route status requires canonical adapter, identity, health and setup
  evidence and does not grant execution authority.
- Fixture server logging drains before removal, with negative assertions for
  queued write failures and recreated directories.
- Browser truth regression is a required CI gate, including the final summary.

## Observed local evidence

- Actual canonical Edge component: **18/18 scenarios passed** after repair.
- Affected architecture: **26/26 passed**, zero failed/cancelled/skipped.
- Both TypeScript projects, scoped ESLint, script syntax and frontend build:
  exit zero. Vite transformed 1,422 modules; its existing bundle-size advisory
  remains a warning. The slow scoped lint completed naturally; no child was
  terminated by the guarded stop check.
- Preserved visual specification: **33/33 supplied manifest hashes match** in
  `docs/production-closure/three-theme-locked-2026-10-01/`. Design Lab remains
  rejected local WIP, preserved separately and excluded from this checkpoint.

The first complete-gate attempt on E: produced two agent integrity observation
failures and was bounded-stopped after a repeated slow request interval; it is
not a completed green battery. Its immutable log SHA-256 is
`f06618a212c045c1521b9eddf0f73896ca2583c2eee1914a69560ad4b24d1864`.
Retained fixture verification records eventually reached `done` with
`passed=false` and `incomplete` evidence, without satisfying the original
observation deadlines. Exact captured runner/child identities were absent on
readback after the bounded tree stop. Already-exited child races are preserved.

After external host headroom changes, the unchanged agent integrity suite on
a fresh guarded C: fixture passed **29/29**, zero failed/cancelled/skipped.
Its log hash is `145bbd27d2d9ebeb790e26dc0f6e6f77fe218a7774f745c6699b49b5a86b940f`.
A six-sample durable-write probe measured C: median flush **5.2252 ms**;
E: median **201.95645 ms**, maximum **2321.1901 ms**. This is direct location
latency evidence; it does not establish every cause of the original red.
The completed full canonical gate on fresh C: fixtures passed **888 tests /
877 passed / 0 failed / 11 identified skips / 0 cancelled**, 991232.8221 ms.
The unchanged 1 GiB disk guard held. No deadline, durability requirement or
product assertion changed. This is one complete ordered run; it does not erase
the failed E: attempt or prove its exact original cause.

Immutable local logs and run metadata are under
`E:\covert-tooling\functional-release-20261001`. The accompanying JSON binds
local observations to hashes and records the broader gate separately.
Full canonical architecture, Veritas and exact pushed-SHA CI must be recorded
from their actual results; audit-lane CI is not canonical acceptance.

## Remaining release gates

This is component/architecture evidence with controlled APIs. It does not prove
live provider/model qualification, an installed first-run journey, Resident
coding, memory/Ghost Code/watchdog integration, or real dogfood acceptance.
Prior installed NSIS/MSI lifecycle evidence remains bound to `a731730` and its
exact Desktop CI run; it is not silently inherited by this new source.

During verification C: reported zero free bytes. Host free physical memory and
commit were below the unchanged 6.5/5.0 GiB runtime start floors. Subsequent free
space/commit-limit changes were external observations; this agent performed no
C: cleanup or pagefile change. No model started, foreign process
stopped, pagefile changed, threshold lowered or release promoted. Historical
untraced hook/LSP/provider causes and the GLib advisory remain UNKNOWN/OPEN.

Next: complete current canonical gates and exact-SHA CI, then continue the
existing installed/provider/Resident/mission/recovery dependency path. Visual
implementation remains paused until the real functional spine is proven.
