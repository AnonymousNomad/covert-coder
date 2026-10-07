# Luna handoff — canonical project addressing / Cipher lineage
Code SHA: `80f0cf116a8df618ad66428bdbaa6714a52cb0e0`; prerequisite `cf6eaf01334bf761a164569e776d9f3e4c315acb`.
Sol owns domain contracts/security/capability behavior; Luna owns final workstation presentation. This is a handoff artifact, not a claim it was sent or integrated.

| Capability | Canonical owner | Route/API | State model | Permission model | Negative test | Evidence / SHA |
|---|---|---|---|---|---|---|
| Current configured project | ProjectRegistry + ProjectSeat at trusted ArchServer composition | GET /api/projects/current; strict empty query | BOUND_CONFIGURED_CHECKOUT; switching GATED_OWNER_REBIND_REQUIRED; Resident LIVE_ENROLLMENT_GATED; CONFIGURED_STORAGE_ROOT continuity | Actual paired/enrolled principal; canonical capability.read; projection grants/enrolls nothing | anonymous/unrecognized principal, unknown query/selector, corrupt/lost owner records, forged address | project-addressing.test.ts; final 17/17 log; 80f0cf1 |
| Immutable project/checkout enrollment | createProjectRegistry, trusted root only | enrollCheckout(root, existingProjectId?); assertBinding; list | UUID project distinct from UUID checkout; real root/device/inode binding; catalog revision | No public registration/switch/grant API | changed ID/root, dangling refs, duplicate binding, unavailable root, incomplete catalog, redirected storage, capacity overflow | project-registry.test.ts; 85/85 log; 80f0cf1 |
| Shared governed invocation | Existing capability-seat + actual Authority, ProjectSeat | CapabilitySeatRequest.project? = {project_id, checkout_id}; existing canonical prepare/invoke | Explicit scope resolves to current foreground owner; one canonical route | Separate pre-enrolled principals and exact permits; no self enrollment/remote authority | foreign/incomplete scope, forged/revoked principal, changed intent/permit replay | project-addressing + shared-capability-seat tests; 80f0cf1 |
| Cipher effect lineage | Cipher ledger/Authority recorder | existing PREPARE/decision/attempt/observation/evidence paths; optional checkout_id | Original project/checkout address retained per action; legacy absent references remain absent | Authority owner effects; Cipher cannot confer permission | supplied effect/decision reference mismatch; live catalog changed before consume | cipher-ledger + cipher-authority-lineage + project-addressing tests; cf6eaf0 and 80f0cf1 |
| Integrity hold / reconciliation | Existing deterministic ledger-integrity/Authority control; Project owner supplies binding truth | existing serious anomaly report and pending-permit revocation | SECURITY_CRITICAL binding mismatch; existing LOCKDOWN/RECONCILING; evidence survives | Root-controlled freeze/revoke; no model cooperation needed | pending approved effect refused after corruption; restart lost catalog does not reconstruct identity | project-addressing restart/HTTP negatives; 80f0cf1 |
| Private project records | Shared private-platform-state + existing canonical file adapters | no generic file read/write to .aide/platform-projects or .aide/platform-projects-enrollment.json | Actual owner state; aliases normalized on Windows | Owner-only state operations; not terminal/OS isolation | case/dot/space/ADS direct file aliases | project-private-state + actual HTTP file negatives; 80f0cf1 |

## Required presentation behavior
Project selector/window label must never become identity. Display owner-supplied names/IDs and explicit unavailable/error reasons; no fake readiness. The current route supports showing the fixed foreground binding, not switching it. Old model/memory/UI values must not grant scope. One persistent Resident identity remains the goal; this slice does not enroll it or issue a context lease.

Luna terminal association handoff: include canonical project_id AND checkout_id in terminal owner state/event/reattachment contracts; enforce exact principal/session owner and checkout binding on lifecycle operations. Preserve governed resume and expectedOwner checks. UI closure does not terminate a foreign process. Switch only after old work is explicitly stopped or retained with truthful background ownership, permit revocation and rebind tests. This is required future implementation, not already delivered.

Task/AttemptJournal, independent evidence/context/model assignments need owner adapters using the same ProjectAddress. Do not silently rewrite UNKNOWN/path-based historical records. A migration requires explicit version/recovery semantics; missing history remains missing.

## Live Luna reconciliation disposition
| Observed change | Disposition | Integration action |
|---|---|---|
| Real terminal resume/ownership transfer, expectedOwner, optional-service readiness, bounded scrollback and surrogate-safe output | KEEP / INTEGRATE | Preserve exact owner semantics; add project association in coordinated owner slice; never replace with presentation state |
| ASK/PLAN/ACT, governed AgentLoop and interaction spine | KEEP | Existing implementation stays; project context lease remains a separate pending boundary |
| Startup-readiness race and IPC/facade diagnostics | KEEP | Preserve truthful errors and owned-child lifecycle |
| Facade paired-origin / safe GET/HEAD Referer logic | KEEP | Preserve exact origin; no widening or silent unsafe fallback |
| PlatformHome / AppsInventory / navigation / current retro presentation | UNRELATED / PRESERVE | Luna owns presentation; no edits from this slice |
| OpenAPI, facade map and C1 ownership decisions modified in both lanes | ADAPT / INTEGRATE | Merge real route/contracts first; regenerate from one final integrated source; rerun drift and terminal/project negatives |
| Foreground switching, live Resident/context lease, installation-wide migration | BLOCKED pending owners/proof | No UI activation or supported claim |

Current Luna enumeration is preserved in the raw source/resource receipt (39 modified + 10 individual untracked, HEAD 12b999d). This lane did not modify Luna's files, send external messages or execute a merge.

## Required integration gates
Full Node/browser types; merged generated-contract reproducibility; both lanes' focused negatives; real terminal/project reassociation and old-grant/context/model isolation; actual workstation screenshot comparison if presentation changes; storage-safe runtime/restart proof; later packaged/CI/clean-user acceptance. Current heavy resource gate is closed. No new visual design direction is requested.

Raw receipts: `docs/workstation-shell/evidence/20261007-project-addressing/`.
