# Workstation closure checkpoint — 2026-10-07

Production closure repair: `6d2d144b8a1b4943f52cabf4afa1b47640df862f`.
Starting HEAD: `bc547936d85c7c3e9cfa468d0067b490666e650c`.
Worktree: E:\covert-workstation-integration-saul-20261006
Branch: feat/workstation-integration-saul-20261006

## Production changes

- Window manager mounts owners after attaching/sizing visible windows. Restored minimized windows defer mounting until visible.
- Visibility callbacks project presentation only. Resources, Laptop and Connections refresh canonical read owners on visibility. Geometry/focus changes do not activate them repeatedly.
- Terminal, model and workflow effects are not replayed on restore; window close does not substitute for PTY stop.
- Resource Monitor has an 8-second abortable read, coalescing, retry recovery, disposal cleanup, and stale/unsupported labeling. Late timed-out responses cannot overwrite a later observation.
- API hardwareProfile carries the caller AbortSignal through the existing canonical hardware route; no route/schema/OpenAPI change.
- Laptop preserves unsaved Notebook fields within the same verified Project/Checkout. Unknown or changed binding discards them. Corrections preserve their original expected revision; no save occurs on activation.

Changed production files:
browser/src/desktop/window-manager-view.ts
browser/src/workstation/WorkstationShell.ts
browser/src/cockpit/SystemTelemetry.ts
browser/src/services/api.ts
browser/src/panels/cipher-laptop.ts

## Evidence

- Initial window/resource RED: 9 cases, 5 passed / 4 failed.
- Window/resource GREEN: 9 / 9.
- Laptop draft RED: 19 cases, 17 passed / 2 failed.
- Laptop GREEN: 19 / 19.
- Final serialized focused regression: 62 / 62, 11,327.1196 ms.
- Scoped ESLint: exit 0 for all five production files.
- git diff --check: exit 0.
- Syntax and local-import existence: six files, exit 0. This is NOT semantic type checking.
- Independent read-only review found the draft regression; repaired source review found no remaining concrete issue. This is not runtime acceptance.

Raw command outputs are retained byte-for-byte with SHA-256 hashes in the adjacent evidence manifest.
PowerShell RED captures are failures, not passes. An empty lint log alone is not proof; the observed final verification process returned TEST_EXIT 0, LINT_EXIT 0 and DIFF_EXIT 0.

## Next runtime journey prepared, NOT RUN

The existing Windows native-PTY journey now captures production composition after:
- real paired Authority and two distinct native sessions;
- real Monaco editor;
- real Laptop Project/Activity owner snapshots;
- real Resource Monitor snapshot;
- visible top bar, launcher, desktop, taskbar and Cipher presence.

It writes covert-production-workstation-composition.png only during actual browser execution.
It adds no fixture capability, fake sample, fake PTY or generated image.
Syntax validation only has run. No new screenshot exists yet.
Existing Windows terminal/session lifecycle and restart assertions remain.

## Resources and access

2026-10-07T16:54:21.9752513Z:
available physical 1729 MiB; free commit 2369 MiB.
Required heavy floors remain physical >=3072 MiB AND free commit >5120 MiB.
Gate CLOSED. Full semantic types, Vite build, Windows browser/runtime, packaging and full suite were not run.
Desktop Commander temporarily returned HTTP 504; access recovered and final regression output was obtained. No processes were terminated.

## Preserved owners and limitations

Authority, Project, hardware, Notebook, ledger, editor and PTY services remain canonical. No new domain database or grant authority.
Luna/proof lanes were not mutated, reset, cleaned, stashed or stopped.
Unsupported CPU/DISK/COMMIT/GPU utilization remains UNAVAILABLE; RAM/VRAM remain owner-derived where available.
Buddy art/media/remote autonomy and unimplemented Laptop sections remain gated.
No signature, global containment, installation-wide continuity or runtime/visual acceptance claim.

## Global gates and next executable work

1. Fresh resource sample, ownership check and source reconciliation.
2. If floors permit: serialized semantic types/build and isolated Windows workstation journey using Edge.
3. Inspect actual screenshot against accepted black/phosphor retro composition; repair visible failures and repeat.
4. Complete broader regression, packaged security, integration, clean-user/machine, CI and single-RC-SHA acceptance.
5. Native App contract and Luna Model Catalog integration follow operational/visually accepted Part A. No marketplace or ecosystem expansion in this checkpoint.
