# Resident task ownership — bounded functional convergence

Branch: `nightshift/production-convergence-20260926`. Source parent:
`6ca400381ad8a0fdcdece12e0cac4bb62d91b5c8`.

## Failure and repair

Actual ResidentCore with controlled typed APIs allowed a second task while the
first remained running, replaced its session handle, and treated uncertain start
failure as proof of no start. AgentLoop independently allowed overlapping root
tasks and a duplicate correlated start returned another session. Three new
baseline regressions failed before source mutation; their log is retained.

The canonical AgentLoop now reserves its root task synchronously before durable
admission, holds it through runner completion and exact delegated-actor revoke,
and fails closed after cleanup failure. Optional strict UUID correlation binds
the original request and exact paired owner; recovery uses a newly approved
Authority operation and retrieves the same start outcome. Changed bodies or
owners are refused. Failed keys are retained. The cache is bounded to 1024
records and never silently evicts a key into renewed dispatch. This guarantee
is one AgentLoop and one daemon lifetime, not a global worker scheduler.

Resident retains the frozen request/session projection in existing application
RAM across component remounts. Pending, running, approval and unknown outcomes
block fresh tasks. Reads/actions capture identity and generation; late disposed
results cannot replace the current projection. Unavailable reads and failed
decisions/cancellation retain the handle, refresh and Stop. Stop stays usable
during a pending read. Cancellation acknowledgement does not establish terminal
state. Only exact correlated pre-dispatch refusal or observed terminal status
allows another task. The existing five-second cancellation wait is unchanged;
its losing timer is now cleared. No credentials or durable memory owner added.

## Locally observed proof

- 53/53 affected agent tests, zero failures/skips/cancellations, including
  canonical HTTP/Authority write approval, cancellation and owned command-tree
  cleanup fixtures. Final ownership battery: 8/8.
- Actual Edge ResidentCore controlled-API scenarios: 17/17. These cover rapid
  starts, pending approval, status/decision/cancel failure, true terminal status,
  subsequent task, lost response recovery, exact identity mismatch, pending read
  cancellation, disposal and component remount.
- Existing setup/provider actual Edge regressions: 18/18 after the shared API
  signal extension. Both TypeScript projects, scoped lint, JS syntax and frontend
  build passed. Existing large bundle warning remains.
- Browser fixture root and 11 observed child IDs were checked absent after
  normal browser/server close. The first empty-array receipt projection produced
  a null element; a separate direct absence confirmation records zero remaining.
- CI now requires the Resident browser scenarios in the existing product-truth
  browser step. Full original publication gate and new exact-SHA CI are pending
  at receipt time; no past pass is used as this candidate's full gate.

Original browser fixture timeout and strict-TypeScript fixture failures are
preserved. Their causes were repaired in fixtures; no deadline or static rule
was weakened. Hashes, commands' output artifacts and source file hashes are in
the adjacent JSON receipt.

## Published parent gates now proven

Parent `6ca4003`: AIDE CI **36952518136 SUCCESS**, all 23 steps; required browser
18/18, Linux architecture 888 total / 872 passed / 0 failed / 16 skipped;
Veritas 6/6 true. Desktop **36953529727 SUCCESS**, all three matrix jobs.
Windows NSIS/MSI lifecycle covers install, native launch/health, close, relaunch,
forced parent exit, recovery, reinstall, uninstall and owned Node/listener
cleanup. Linux/macOS scope remains build/artifact smoke. These qualify the
parent SHA only. Logs are retained and hashed in the receipt.

## Open release boundaries

Exact project provider/model task binding is the next defect. This ownership
repair retains the existing local task path and does not claim selected cloud
worker execution. No live model/provider qualification, full app/daemon restart,
fresh-user complete journey, dogfood or RC acceptance follows from controlled
fixtures or parent packaging. Historical full push timeouts remain separately
recorded with cause UNKNOWN/OPEN.

Visual implementation remains paused. The three-theme locked specification and
references are preserved; rejected Design Lab remains untracked and unchanged.
PR #31 stays frozen. Continue dependency-ordered functional closure after the
checkpoint's real full hook and exact-SHA CI, without routine review waiting.

## Final local review follow-up — request snapshot

Before commit, review reproduced a race introduced by queuing start admission:
a direct caller could mutate the approved worker request before the microtask
read it. The new controlled baseline observed `changed-after-approval`, retained
in `resident-request-snapshot-baseline.log`. Start now structured-clones the
request before asserting/claiming execution and captures options before queuing.
Fingerprint and admission use that same owned request snapshot. The mutable
variant was never committed or published.

The final affected battery passed **54/54**, zero failures/skips/cancellations,
including **9 ownership cases**. Both strict TypeScript projects, scoped lint and
service syntax passed again. The earlier 53/53 and 8/8 remain historical results.
Frontend source and its 17/17 Resident plus 18/18 setup/provider evidence are
unchanged, with matching hashes. The companion
`RESIDENT-TASK-OWNERSHIP-FINAL-2026-10-02.json` records final source/artifact hashes
and links the original receipt by hash. Full publication hook and exact-SHA CI
remain pending at this local receipt time.
