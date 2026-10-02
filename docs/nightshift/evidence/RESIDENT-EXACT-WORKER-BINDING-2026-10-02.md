# Resident exact worker binding — local verified checkpoint

Canonical branch: `nightshift/production-convergence-20260926`.
Source parent: `6ade0bc9b323255c26b8a68098c3f4e2ab3827f8`.
This checkpoint's full publication gate and exact-SHA CI are pending at receipt time.

## Failure and bounded repair

The retained controlled route reproduction requested model A but invoked the
configured provider role's model B. Worker metadata did not bind execution.
Resident also forced task starts to local despite a configured external ACT role.

Resident now reads canonical Model Access, projects the exact project ACT target,
and visibly labels it REQUESTED WORKER. A local project role uses the observed
healthy loaded runtime identity; an absent/unknown identity sends no task.
Local-Only never silently replaces an explicitly selected external worker.
Pending selection is owned, abortable and fenced across component disposal.

Production task description reuses Model Router's side-effect-free target
resolution. Authority binds request, worker and target revision with local
execute or external risk. The start route has one descriptor owner; the old
static policy row is removed. AgentLoop checks the approved target and worker,
includes the target in correlation, and retains serialized ownership/cleanup.
Each model call uses existing exact-target dispatch and cancellation; changed
targets and different returned model identities fail without role fallback.

Diff review also reproduced an existing handoff defect: failed consumption was
swallowed, leaving a done session with one model call. Consumption must now
succeed before invocation; failure leaves error with zero model calls. The
wrapper preserves cancellation and checks abort before/after consumption.

## Observed local verification

| Gate | Result |
| --- | --- |
| Affected agent/router/Authority/handoff tests | 105/105; zero failures/skips/cancellations |
| New worker-binding scenarios within that suite | 11/11 |
| Actual Edge Resident component, controlled APIs | 21/21 |
| Actual Edge setup/provider regression | 18/18 |
| Scoped lint, both TypeScript projects, frontend build | PASS; existing large-chunk build warning retained |
| Canonical route/facade/Authority gates | 6/6; 239 routes, 135 central, 79 descriptors, zero conflicts/unclassified, unchanged 20 waivers |
| Local Veritas | Six checks true |
| Observed Resident browser root and 14 children | Exited; remaining owned count zero |

Original contract baseline, mistaken new-fixture HTTP403 assertions, the first
handoff timeout and the refined done/one-call reproduction are retained.
The first whole Veritas run is retained red: architecture908/896/1/11 and P0
failed because those fixtures omitted an exact worker. The transcript-only
fixture now explicitly injects the existing deterministic callback seam; all
secret-scan and Authority assertions remain. P0 separately proves missing-worker
refusal and the original APPROVAL_REQUIRED edge for an exact catalog target,
plus zero sessions. Focused handoff7/7 and supervised P0 including restart pass.
This receipt binds the subsequent complete Veritas rerun, not that original red.
Canonical missing-approval HTTP409 NOT_READY and changed-digest HTTP409 CONFLICT
envelopes are asserted exactly. No test deadline or Authority behavior was
weakened. Raw artifact and source hashes are in the companion JSON.
Frozen C1-02 reproduction hashes are unchanged; canonical generator check passes.

## Proven scope and remaining gates

This is controlled integration/component evidence. It is not a live provider or
local-model qualification, full-app restart, fresh-user install, dogfood or RC
acceptance. The existing internally injected scripted callback seam remains for
controlled fixtures; production uses the exact router. Production starts without
an exact worker are refused. Unsupported or unverified adapters remain refused.
Recovery after target/config changes stays fail-closed; no new uncorrelated task
or substitute model is invented. Full Resident served-context/skills/model
provenance and the broader acceptance battery remain open.
The retained next-gap controlled Router/Journal probe observes different
assembled/dispatched system hashes after fitting, with no served-context digest
in current model events. It does not exercise a real provider/model or Authority
integration and makes no live acceptance claim. Address that receipt gap next
without rewriting the immutable admission envelope or adding another owner.

Published parent ownership checkpoint passed unchanged Windows full gate
897/886/0/11 and exact-SHA AIDE CI 36958735614, all 23 steps, Linux architecture
897/881/0/16 and Veritas6/6. Its separate published companion receipt preserves
those facts and historical e74 red; it is not this new source's CI result.

Visual implementation remains paused. The Design Lab and locked reference
package remain intact; PR31 is frozen. Admission floors, existing models and OS
configuration are unchanged. No local model or real provider was started.
Continue the exact-SHA gate and then the next dependency-ordered functional
acceptance gap, claiming only observed scope.
