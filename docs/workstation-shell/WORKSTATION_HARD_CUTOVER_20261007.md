# Covert workstation hard cutover — 2026-10-07

Production source cutover is committed. Running-product and visual acceptance are NOT complete; no new runtime screenshot is claimed.

## Source
Worktree: E:\covert-workstation-integration-saul-20261006
Branch: feat/workstation-integration-saul-20261006
Starting HEAD: 0a4f1e53bb014b4b8c3787a98c43862e7df0e67b (15 ahead/0 behind 14b9ad9).
Code SHA: d0d904b79ff29be0ef64bb233afbdffefda5b57b (16 source/test files, 581 insertions/431 deletions).
Local upstream: origin/feat/workstation-integration-saul-20261006; no fetch, push or merge.
The guarded code commit completed with exit0. Its final status output was empty. Command duration 821.22s; this is not a UI performance measurement.
At 15:49:02UTC Luna was 12b999d329b59fd7dd480504ce84670b0de521f5 with 45 tracked modifications/27 untracked files. No foreign cleanup, staging, overwrite or process replacement was performed.

## Production changes
main.ts now mounts workstation/WorkstationShell.ts. cockpit/CockpitShell.ts is a compatibility export, not a second shell.
New first-run/recovered/reset WORKSTATION preset: existing Editor, two distinct terminal views, Resource Monitor and Cipher Laptop with overlapping geometry. Valid CODING/CUSTOM saved layouts remain preserved.
Frame: established near-black/phosphor tokens, top system bar, left launcher, independent rectangular windows, bottom taskbar and small Cipher conversation launcher.
Connections is an independent registered application rehosting the canonical existing panel.
Window/taskbar captions use Terminal01/02 while retaining distinct instance IDs.
Models/Connections receive compact scoped record styling.
Existing editor, terminal/process owners, ASK/PLAN/ACT, AgentLoop, Laptop Notebook/Activity/Integrity, Authority, Admission, model/connection/resource/evidence owners remain. No fake telemetry, mock editor, duplicate credential owner or replay-on-restoration path is introduced.
Legacy dashboard entry is superseded as presentation; its proven component owners and optional Operations utility remain available.

## Exact changed paths
- browser/src/cockpit/CockpitShell.ts
- browser/src/cockpit/SettingsSurface.ts
- browser/src/connections/connections.ts
- browser/src/desktop/app-registry.ts
- browser/src/desktop/desktop.css
- browser/src/desktop/layout.ts
- browser/src/desktop/types.ts
- browser/src/desktop/window-manager-view.ts
- browser/src/desktop/window-manager.ts
- browser/src/main.ts
- browser/src/shell/shell.ts
- browser/src/store/state.ts
- browser/src/workstation/WorkstationShell.ts
- tests/unit/test-desktop-launcher-view.test.mjs
- tests/unit/test-desktop-window-manager.test.mjs
- tests/unit/test-connections-window-recovery.test.mjs

## Verification
Final focused Windows Node/DOM-fixture run: 53 tests/53 pass/0 fail/0 skipped/0 cancelled; 3346.7598ms.
Covers layout/launcher/persistence, project Laptop binding/isolation/stale-write negatives, terminal ownership/replay, voice defaults, Connections recovery and Settings teardown.
Scoped ESLint passed original modified TypeScript, repaired Workstation/Connections, and Settings; git diff --check passed.
Ten original modified TypeScript files passed syntax/relative-import checks. This is not full semantic typing/build.
Independent review: Connections initial failure could remain unavailable after pairing/reopening. RED0/3 then GREEN3/3 repair retains canonical handle, pairing/activation refresh, queued reread, late-render suppression and disposal.
Review found nested Settings owner listener leak. Parent teardown RED3/4; fix calls connectionsPanel.dispose; final full focused run53/53.
Read recovery does not replay sign-in, credential writes, probes or mutation requests. Restored window codec rejects command/permit/session fields; presentation close does not stop a canonical PTY.
Preserved failure receipts: porcelain leading-whitespace guard rejected before writes; trimEnd repaired it without relaxing allowed paths. ESM E: helper import failed; file:///E:/ repair passed.
A delayed owned commit console was inspected via CIM (cmd19168, childPowerShell8220, git18744 with exact authorized commit command); Ctrl-C was sent only to this owned session. The commit subsequently completed exit0. No foreign termination occurred.

## Live build and gates
HTTP4173 index/assets match E:\covert-local-model-demo-proof-20261007, clean HEAD768360fb80a5445cd6350b745f232b134bfc56a0, not this branch.
Index SHA256: 6bfe7d0f8ba235bd89d777f1533a3460cee83c218791a391af6d397df11a9a08.
Assets: index-BoxVQIf2.js and index-DQwt9oIQ.css.
This explains the legacy running appearance; this lane and its running processes were preserved.
Resource sample15:49:02UTC: physical2741MiB/free commit1937MiB (CIM CommitLimit-CommittedBytes).
Existing floors remain physical>=3072MiB/free commit>5120MiB. No floors lowered or models started.
NOT PROVED: full Node/browser types, frontend build, new Windows browser/PTY journey, new screenshot/reference comparison, UI resource measurements, wider regression, packaging/security acceptance, clean-user/clean-machine, CI or a single release SHA.
Later evidence attachment encountered stalled local file operations; Windows-only attachment is used. A live metadata read also timed out; do not infer a new HEAD without Git receipts.

## Remaining visual/product closure
Buddy remains a truthful small conversation launcher, not final chassis art. Laptop unsupported sections remain explicitly gated. Live project switching/Resident leases/installation-wide continuity and global containment are not claimed.
Rehosted utility interiors still require actual runtime density/color/clipping/controls review against the accepted concept. Preserving tokens and source geometry is not visual acceptance.

## Next executable slice
Reconcile demo proof lane's newer model/provider changes into the workstation integration without overwriting either lane. When both resource floors pass, serialize semantic types/build, launch an owned workstation runtime, prove pairing/editor/two real owned PTYs/Laptop/actual telemetry/Connections/window lifecycle, capture the actual screenshot, compare and repair visual drift, measure UI resources, then broaden acceptance.
Source checkpoint only. No READY/SECURE/QUALIFIED/release claim.
