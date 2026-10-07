# Covert Windows workstation runtime checkpoint — 2026-10-07

## Source and scope
Canonical worktree: E:\covert-workstation-integration-saul-20261006
Branch: feat/workstation-integration-saul-20261006
Starting observed HEAD: a746986e9ab7de133b0db0edffc7484a5ca25af3; two owned WSL prototype files were dirty.
Verified production HEAD: 318f2b19faa127b902132f5114637f5b35ee8e32.
Clean after production commits; 41 ahead / 0 behind 14b9ad9 and configured upstream.
Luna shell at last read: 12b999d329b59fd7dd480504ce84670b0de521f5, 61 modified tracked / 40 untracked. Preserved; not claimed integrated.
Evidence commit is separate; it does not alter tested production source.

## Production commits and exact files
- 7b9be38614aab669cba5aaeee8320ad4a5501a10: node/src/services/runtime-providers.ts; tests/unit/test-runtime-readiness-stdin.mjs.
  WSL readiness uses NUL stdin, explicit bounded deadline, one-shot refusal and bounded output capture. Exact distro /bin/true and 15000 ms remain; ordinary execution probes remain 5000 ms. Refusal does not create a PTY.
- e444ce88037c068749ac62be0bdd9f83ba29d3c8: browser/src/services/ws.ts; browser/src/panels/terminal.ts; tests/unit/test-event-subscription-readiness.mjs; tests/unit/test-terminal-panel-isolation.test.mjs; tests/e2e/workstation-dual-terminals.spec.ts.
  Terminal input and visible INPUT READY/PAUSED share one predicate: authorized matching active session, connected/acknowledged event channel, no replay/resume/recovery. Subscription acknowledgements are deduplicated; retired sockets cannot change successor connection truth; disposed buses do not reconnect. Legacy port reconnect fallback preserved.
- f10f0b731718f127d8aa646e96ce797e9f8a767b: browser/src/desktop/layout.ts.
  Default terminal windows sit alongside each other with both title bars visible; saved custom geometry unchanged.
- 318f2b19faa127b902132f5114637f5b35ee8e32: tests/e2e/workstation-real-mutation.spec.ts.
  Each actual Monaco keypress must be observed before advancing, including normal automatic quote pairing. Exact final draft, dirty conflict, Authority and governed mutation assertions remain.

## Verification
51/51 focused tests; 12/12 adjacent terminal architecture routes.
Node semantic types, browser types, scoped lint, diff checks and production Vite build passed.
Final isolated Windows Edge run: 6/6, one worker, zero retries, stop on first failure.
Final run used HEAD 7b9be38 plus seven fingerprinted dirty files; hashes were rechecked unchanged when committed into 318f2b1. run-closure-2310.ps1 retains the exact checks.
This is actual production frontend/service code under an isolated Windows runtime fixture, not packaged installed-app acceptance.

## Observed operator behavior
Real Monaco editor; two distinct owned PowerShell PTYs, marker isolation, resize, minimize/close/reopen and browser-restart explicit Authority reattachment without duplicate spawn.
Project-addressed Cipher Notebook/Activity/Integrity owner reads, scoped CRUD and lifecycle.
Resource Monitor projects real HardwareService RAM/VRAM samples. CPU is explicitly unavailable.
Models, Connections, Evidence and Settings launch as owner-backed internal windows.
Top bar, sparse launcher, rectangular movable overlapping windows, bottom running-app strip and summonable Cipher presence are visible.
Real governed file mutation reaches the same Monaco editor with dirty draft retained. Worker/model is a deterministic test stub; this does not qualify a live model.
Authority refresh journey is a controlled route fixture; native PTY proof comes from the separate dual-terminal journey.

## Exact WSL proof
Ubuntu-24.04 was naturally observed STOPPED. No artificial distro or global shutdown.
Authority required exact operation approval before opening each session.
Cold /bin/true readiness: 12613 ms, exit 0; bundled PTY spawn 97 ms, PID 7620.
Warm readiness: 239 ms, exit 0; independent PTY spawn 77 ms, PID 22076.
Distinct session IDs; exact distro markers, isolation, resize, cancellation and exit passed.
The lower-level ConPTY/WSL synchronization mechanism remains NOT ROOT-CAUSED.

## Resource gate and reclamation
Unchanged floors: physical >=3072 MiB; free commit >5120 MiB.
Earlier free commit 4951 MiB was closed. Recoverable Edge session information was preserved before graceful closure; resource readback became 7395 physical / 7023 free commit MiB.
An exactly identified foreign-lane architecture test subtree was serialized under explicit crunch authority after preserving its dirty-source diff; cancellation was recorded CANCELLED_NOT_PASS, not success.
Protected control access retained; no Windows-critical/security processes or guessed process ownership termination.
Final phases (physical/free commit MiB): Node 6060/6268; browser 6023/6258; build 6048/6289; Edge 6003/6258.
Post-production readback 2026-10-07T23:13:51.8553993Z: 5879/6106 MiB, both floors pass.
These are host headroom readings, not a standalone UI footprint benchmark.

## Failures found and repaired
Cold WSL preflight previously reached its budget without a functioning PTY; noninteractive stdin handling was repaired and real cold/warm path passed. Do not infer the lower-level ConPTY root cause.
Terminal post-restart input readiness races were reproduced. Duplicate subscription acknowledgement, snapshot-fetch readiness, retired-socket callback and legacy reconnect regressions were repaired with negative tests.
Monaco harness could advance before an edit was observable; exact per-key observations replaced blind advancement. No claim of a general Monaco production input root cause.
A portable inherited-output-pipe deadline gap was demonstrated by independent Linux review; Windows counterexample already passed. Explicit deadline is portable hardening, not a reproduced Windows defect.
Earlier failed logs are retained; no timeout, Authority rule, resource floor or assertion was weakened.

## Visual comparison and remaining defects
Screenshot is captured from the final passing runtime, not generated concept art.
Black/phosphor identity, compact rectangular chrome, editor and two real terminals, Cipher Laptop, Resource Monitor, launcher/top bar/taskbar are present. Legacy blue/purple cockpit is superseded.
Remaining: Laptop UUID/timestamp wrapping is too dense; unsaved-workbench notice overlaps terminal content; launcher icon readability/top-menu detail need polish; Buddy chassis artwork and original background remain unmounted.
CPU/commit/disk/GPU utilization must remain unavailable until canonical observations exist.
Genuine channel gaps can still pause/refuse attempted input; no universal command-preservation or input replay guarantee.
Gated Laptop sections remain truthful: Missions, Inbox, Watches, Security, Evidence and Permissions gated; Comms not configured.
No fake WORKING/LISTENING/model/permission/evidence state.

## Security and remaining acceptance
Bounded stdin/channel/authority/lifecycle negatives passed; source review found no remaining actionable issue in this bounded slice. Independent reviewer did not independently run heavy Windows verification.
No global containment, packaged security, live AI/provider qualification or release acceptance claim.
Open global gates: wider regression, packaged security, integration/convergence, clean-user, clean-machine, CI and single RC SHA.
Existing Vite chunk-size warning remains; main bundle approximately 4.72 MB / 1.22 MB gzip, not yet performance-closed.
Next executable slice: Laptop provenance readability and notice placement, repeat runtime visual capture; packaged/runtime security and clean-user acceptance thereafter. Part B remains behind Part A operator visual acceptance.
