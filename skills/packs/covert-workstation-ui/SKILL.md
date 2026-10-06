---
name: covert-workstation-ui
description: Build and verify bounded Covert retro workstation shell slices, internal windows, scoped restoration and truthful projections. Use when rehosting tools or changing desktop geometry, focus, telemetry or view lifecycle.
---

# Covert workstation UI

## Scope and authority
Follow operator references and docs/design/workstation/WORKSTATION_DESIGN_CONTRACT.md. Read WORKSTATION_SOURCE_TRUTH.md before replacement, WORKSTATION_WINDOW_CONTRACT.md for frames and WORKSTATION_ACCEPTANCE_MATRIX.md for proof. Keep vanilla TS/DOM, typed API client and canonical service owners. This skill cannot grant privileges or certify release.

## Execution
1. Pin branch/worktree/HEAD/dirty state, old controls, backend owners and nearest tests. Read developer-way/covert-context-control.
2. Reconcile dirty/untracked Luna/packaging UI first. If unavailable, prepare independent contracts; do not build a competing shell.
3. Define one journey, negative cases and rollback; rehost proven internals with lifecycle hooks.
4. Separate WindowID/AppInstanceID from ProjectID/SessionID/task IDs; presentation owns geometry/focus/visibility only.
5. Coalesce drag/resize, observe content size, fit Monaco/Xterm and send correct approved PTY dimensions.
6. Restore child focus; background events never steal it. Nonmodal app windows, properly inert/focused decisions.
7. Explicitly suspend hidden optional rendering; retain underlying owned work.
8. Preserve buffers/processes; close view is not confirmed task termination.
9. Persist scoped intent, not runtime truth/grants/commands; reject stale project generations.

## Invariants
Near-black/green opaque rectangles, sparse icons/compact chrome/static identity. No cards/glass/permanent chat rail. Installed/qualified/selected/authorized/running/verified stay distinct. Unknown is not zero. Show unavailable unsupported owner facts rather than fabricate telemetry/model selection/multimodal support.

Human/Cipher/worker reach canonical operations with separate principals. No frontend writable authority/event journal. Independent operator stop remains accessible.

## Verification/examples

Read WORKSTATION_SECURITY_CONTRACT.md, WORKSTATION_SECURITY_CLOSURE_MATRIX.csv and WORKSTATION_SECURITY_HANDOFFS.md in the same contract directory. Preserve authenticated decisions outside model content, project/generation bindings and independently reachable panic. Project containment requests and observations separately; disabled/quarantined does not prove exited. Confirm actual owner effects with Cipher unavailable. Do not close a foreign security gap merely by naming its owner.
Minimized Terminal A keeps its explicit owned session and bounded output handling; B remains bound to B. Restore validates A before active-state claims. Saved RUNNING cannot recreate a process/grant.

Focused negative tests plus required type/lint/build/relevant regressions in complete checkout. Real editor/two PTYs, resize/interrupt/cleanup/restart. Actual reference screenshots and Windows full UI process-tree measurements. Record source/command/exit/count/failure/skip. Syntax/screenshots are not runtime acceptance.

## Failure/recovery
Stop on source conflict, bypass/data loss/unbounded resource use. Diagnose before retry. Resolve tool schemas from current metadata, not guessed args. In a newly created no-checkout sparse tree verify materialization; restore a known missing tracked file only from its pinned index, never reset unknown owner work.

Rollback presentation activation to retained old entry point; preserve buffers/sessions/evidence. Do not weaken tests.
