# Sovereign Workstation Shell — Live Reconciliation

**Status:** source audit recorded; product files not yet modified.
**Scope:** isolated presentation implementation lane only.
**Authority:** owner directive supplied 2026-10-05. It supersedes earlier visual directions for this lane while preserving the existing Covert release, Authority, runtime, and DOGFOOD boundaries.

## Repository grounding

| Lane | Path | Branch / HEAD | Upstream and worktree state |
|---|---|---|---|
| Canonical convergence | `E:\covert-nightshift-integration` | `nightshift/production-convergence-20260926` / `cfaad716a01af06dfe61dcfb3d1acd7dea9b4b2c` | Upstream `origin/nightshift/production-convergence-20260926`; 11 ahead, 0 behind. No tracked changes. One pre-existing untracked owner directive: `docs/nightshift/MAIN-LUNA-WEEKEND-EXECUTION-DIRECTIVE-2026-10-04.md`; preserved. |
| DOGFOOD | `E:\covert-dogfood-20261004` | `codex/dogfood-0-20261004` / `c20e7be9bcab91e4495575dbde2ed3d05484b672` | Clean; not modified by this work. |
| Shell implementation | `E:\covert-sovereign-workstation-shell` | `feat/covert-sovereign-workstation-shell` / `cfaad716a01af06dfe61dcfb3d1acd7dea9b4b2c` | New isolated linked worktree; clean; no upstream configured. |

The initial linked-worktree creation appeared incomplete: `git status` briefly represented tracked paths as deleted and directories as untracked. The original worktree operation later finished without manual index repair. The shared Git metadata now contains a 217,165-byte worktree index, `git worktree list --porcelain` recognizes the intended path and branch, and a fresh status is clean at the pinned base SHA. No reset, restore, clean, checkout repair, or content reconstruction was performed.

Issue #38 was checked before this phase. Latest comment remains Sol handoff `5976321663`: PR #41 stays draft/not merge-ready; the earlier Windows ownership-probe failure remains open; gfx900 is still experimental pending same-host proof. PR #31 remains frozen. This presentation lane does not alter PR #41, PR #31, canonical convergence, or DOGFOOD.

## Current implementation owners

| Capability | Current owner and observed behavior | Constraint for shell integration |
|---|---|---|
| Boot and shell | `browser/src/main.ts` calls `mountCockpit`, then creates the editor host and session, LSP, event transport, and cloud status readers. `browser/src/cockpit/CockpitShell.ts` mounts the live frontend. | Change only the renderer composition in this lane. Keep existing boot services, typed APIs, and event transport. |
| Panel routing | `CockpitShell.ts` owns an internal `PANEL_IDS` registry. `applyCenterPanel` hides every destination and activates exactly one `store.panel`; `lazyPanel` mounts a destination on first use and reuses it until unload. This is not a launchable window manifest. | Introduce an application registry/window manager as presentation state. Reuse each existing panel root and retain its controller while a window is hidden or minimized. |
| Editor | `browser/src/editor/host.ts` owns Monaco models and tab operations. `main.ts` creates editor groups/search in the cockpit's editor mounts and routes file access through the typed API; `SessionService` persists the editor session. | Keep one editor host/model/session independent of window visibility. Moving or resizing a window must not recreate models, lose unsaved content, or bypass daemon file routes. |
| Terminal | `browser/src/panels/terminal.ts` owns xterm rendering and authenticated event subscription. Session open/stop use canonical API routes; the daemon owns PTYs. Panel disposal removes the renderer subscription, timer, resize listener, xterm instance, and DOM; it does not call the stop route. | Closing/minimizing a desktop window must not imply stopping a daemon PTY or disposing the only live terminal view. Provide explicit stop via the existing control; preserve/recover session identity through the canonical session listing. |
| Resident | `ResidentCore.ts` owns the Resident console, context/push/decision reads, chat, model selection, and governed task entry. It projects real API state and has scoped polling/cancellation. `OperatorIdentity.ts` is presentation identity, not task activity. | Preserve Resident and Authority ownership. Only show GENERATING/WORKING/SPEAKING on trusted execution/tool/audio evidence. Existing states do not provide the full requested lifecycle, voice, or skin manifest. |
| Command Center and telemetry | `command-center.ts`, `SystemTelemetry.ts`, `ActivityTimeline.ts`, and `ModelLineup.ts` provide live surfaces. The telemetry surface reads `/api/hardware/profile`; absent CPU/disk/GPU values remain unavailable. These components own polling intervals. | Do not add duplicate high-rate shell polling. Keep detailed telemetry inside a launchable Command Center. System Bar summaries must use canonical evidence or show UNKNOWN/UNAVAILABLE. |
| Model Lab | `browser/src/panels/models.ts` is the existing Model Access/Manager surface and owns model/provider/runtime/artifact details through canonical API contracts. | Rehost the current surface. Do not simplify identity, READY, qualification, route, or evidence claims. |
| Settings and onboarding | `SettingsSurface.ts`, `Walkthrough.ts`, and `SetupSession.ts` are created by `CockpitShell`; Settings currently covers provider/connections and setup entry points. No appearance/font/theme controls or startup greeting flow exist. | Add appearance and greeting controls only as presentation settings; keep provider credentials and onboarding owners unchanged. |
| Readiness | `/api/readiness` has a canonical service and contract. Browser `api.ts` has no `api.readiness()` wrapper at this base. Existing readiness meanings distinguish general boot readiness from readiness for a golden mission. | Startup greeting text/audio must wait for a typed canonical readiness read and describe partial or unknown state honestly. Never derive READY from a timer or page render. |
| Layout and persistence | `AppState` stores current panel/dock/bottom-strip state in memory; `SessionService` is editor-session persistence. No desktop window manager or layout persistence exists. | Store only validated presentation layout separately from editor state; malformed data must select the known default layout. Never persist credentials or authority state here. |
| Theme and motion | `cockpit.css` and `main.css` contain overlapping token families; the cockpit has its own purple/cyan/green palette and the older styles contain separate graphite/emerald tokens. Existing reduced-motion rules are present but do not implement the required shell-wide controls. | Introduce semantic tokens and one selected theme at the desktop root. Preserve semantic warning/error/unknown colors even when the decorative accent is green. |
| Launcher and accessibility | The current topbar renders Ctrl+K as disabled because the command palette is unavailable; navigation is a fixed rail. | Implement a keyboard-accessible launcher and visible focus/escape behavior. Mobile must use a single-app switcher, not shrunken overlapping windows. |
| Voice/audio | No `speechSynthesis`, voice adapter, Resident greeting, or real audio playback state exists in the frontend at this base. | Treat voice as an optional adapter. Speech failure must not block shell startup, and SPEAKING requires actual audio lifecycle evidence. |

## Conflicts with the approved shell directive

1. **Desktop topology:** current shell is a fixed topbar/navigation/center/intelligence-column/bottom-strip cockpit. It contradicts the approved desktop/window/dock composition.
2. **Application model:** destinations are exclusive panel IDs, not typed manifests with maturity, shortcuts, singleton policy, or default bounds.
3. **Window lifecycle:** there is no focus/z-order, move/resize, minimize/maximize/restore, snapping, or window layout identity. Existing panel disposal is not a safe proxy for user closing a window.
4. **Layout recovery:** desktop layouts, named presets, startup layout, corrupt-state fallback, and presentation-only persistence are absent.
5. **Semantic theme and fonts:** no whole-workstation theme compiler or palette importer exists; imported font handling and provenance are absent.
6. **Resident presence:** no complete evidence-backed presence state machine, skin registry, greeting preferences, voice adapter, or speech lifecycle is wired.
7. **Startup truth:** readiness exists server-side but is not yet exposed by the browser API, so a truthful startup greeting cannot be implemented by UI timers or current boot flags alone.
8. **Progressive disclosure:** current fixed intelligence column permanently allocates space to lineup, telemetry, and activity instead of opening them on demand.
9. **Responsive composition:** existing breakpoints reduce/hide cockpit regions; they do not switch to a one-app-at-a-time narrow layout.

## Implementation boundaries and sequencing

- Shell/window/layout/theme/launcher state remains presentation-only. It never grants execution authority or changes process/runtime ownership.
- Existing real Covert surfaces are hosted inside the new window composition; domain services, route contracts, Authority, Model Access truth, and daemon-owned PTYs remain their current owners.
- Window hide/minimize/focus must not dispose the editor host or terminal session. Explicit stop/close semantics remain separate actions.
- The freeform drag/resize primitive is not yet selected or installed. Official Interact.js documentation confirms draggable, resizable, restriction, and snapping primitives; its repository identifies an MIT license. Before adding it, pin an exact registry version, inspect its package metadata/license, and review the lockfile diff. Do not hand-roll pointer geometry.
- Work order: S1 shell foundation and application/window/layout state; then theme/font; core surface placement; evidence-backed Resident presence; optional voice/greeting; responsive/accessibility/performance. A phase is not complete until the real browser and required verification prove it.
- No screenshots, telemetry, mock values, or Resident animations may be presented as production state. Any fixture data used in design review must be labeled as such.

## First bounded implementation objective

Implement the isolated S1 shell foundation on this branch while keeping real surfaces and their controllers intact:

- semantic application manifests for existing available/phase-gated surfaces;
- focusable desktop windows with move/resize, minimize/restore, maximize, close/hide, and snap actions;
- named initial layouts with validated persistence and safe default fallback;
- dock/launcher and Ctrl+K keyboard path;
- compact status surface with only currently proven values;
- default Coding composition that exposes the existing editor and terminal, with Resident presence accessible without pinning the telemetry dashboard.

This record is the source audit only; implementation and runtime acceptance remain open.
