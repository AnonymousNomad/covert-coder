# Operator Control Surface V1 — implementation and ownership ledger

Status: **PARTIAL — CURRENT-SCOPE UI CHECKS PASS; CHECKPOINT FINALIZATION BLOCKED**. Accessibility remains partial, and the broad unit suite retains one failure reproduced at the unchanged starting checkpoint (Windows DPAPI round-trip; unrelated to this UI slice). The platform rejected cleanup of superseded untracked acceptance outputs before execution, so the worktree could not be made clean or committed. This ledger is not an overall Covert V1 release certificate. Cross-owner contracts remain explicitly handed off; no protected owner contract is implemented here.

## Operator surface

The left navigation rail already exposes **Settings**. The new Settings surface groups backed preferences, existing read-only product state, and explicit owner handoffs. It does not implement a second Authority, model registry, runtime manager, resource-admission system, or evidence store.

The typed preference registry currently contains six functional, presentation-only preferences:

| Preference | Persistence | Supported scope | Backing behavior |
|---|---|---|---|
| Theme (`covert`, `matrix`) | Browser local storage | Global, workspace | Applies shared semantic CSS tokens and editor/terminal palette |
| Editor/terminal text scale | Browser local storage | Global, workspace | Updates editor and terminal font size; scales inherited shell text |
| Ambient effects | Browser local storage | Global, workspace | Standard, reduced, or off background effects |
| Reduced motion | Browser local storage | Global, workspace | Disables UI motion; OS reduced-motion preference is also honored |
| Interface density | Browser local storage | Global, workspace | Standard/compact supported rail and intelligence spacing |
| Telemetry visibility | Browser local storage | Global, workspace | Shows/hides the existing read-only telemetry rail |

Workspace editing uses an override over the global/default value. The UI reports the editable scope value and the effective value/source separately. Clearing an Appearance scope removes only Appearance/Accessibility keys; it does not reset Layout. Unknown, malformed, and newer-schema storage is not silently overwritten, and the surface reports persisted/read-only/session-only state. Browser-local persistence has no cross-device sync or profile export.

Role/agent and mission/temporary scopes are **not implemented**. They require an owner contract for precedence and lifetime; the current UI does not offer those scopes.

Settings search covers categories and their descriptions. Filters exist for Modified, Workspace overrides, Experimental, and Restart required. No current preference is experimental or requires restart, so those filters legitimately return no matching setting today.

## Area status

| Area | State | Current truth / boundary |
|---|---|---|
| Appearance and accessibility | **IMPLEMENTED / PARTIAL** | Default Covert tokens remain in the existing stylesheet. Matrix is an alternate semantic-token set with binary rain; it hides the existing brand-map art. Theme selection applies immediately and persists. Reduced motion and effects controls are real. Browser contrast/layout audit remains pending. |
| Layout | **PARTIAL** | Density and telemetry visibility work. Dock placement, panel resize, sidebar visibility, and layout reset are not backed by this shell. |
| Resource telemetry | **PARTIAL / READ-ONLY** | Hardware snapshot provides logical CPU count, RAM totals/free, backend, and VRAM where available. CPU utilization, GPU identity/utilization, and disk capacity are **UNAVAILABLE** in the consumed contract. Values are not fabricated. Snapshot freshness is not currently surfaced. |
| System Health | **READ-ONLY** | Refresh reads local health, model status, hardware profile, and connection status. Daemon response, model inventory/runtime availability, provider status, hardware snapshot, and existing verification state are shown. Neutral inventory/resource snapshots do not imply qualification or admission. Resident, Git, and evidence-store health remain **UNKNOWN** because no corresponding projection is consumed here. |
| Why Blocked | **PARTIAL** | A reusable component renders owner, reason, current state, next action, and optional evidence for failed/unknown local health requests. It is not yet wired to every denied operation. |
| Permissions | **READ-ONLY** | Shows the existing operator-session pairing state and links to the owning Security panel. It does not expose an aggregate effective-permission matrix. |
| Approval Center | **HANDOFF REQUIRED** | No new approval queue or approval semantics are created here. Security/Authority remains the owner. |
| Workspace Trust | **HANDOFF REQUIRED** | No parallel `UNTRUSTED / RESTRICTED / TRUSTED` switch is present. Trust must be consumed by existing Authority/execution policy. |
| Models | **READ-ONLY / HANDOFF REQUIRED** | Existing Models UI can show registered model, artifact/runtime availability, and routes. The browser model-status contract does not provide Capability Passport qualification/role facts; Settings does not infer them and says so in the UI. |
| Providers and credentials | **PARTIAL** | Existing provider and BYOK panels are embedded. They own credential entry/testing; entered secrets use password controls and saved values are not displayed again. Status is not inferred from configuration alone. |
| Local Runtime / Resident | **READ-ONLY / HANDOFF REQUIRED** | Existing model API reports a runtime-available boolean and model states. It does not provide the full RuntimeAdapter identity/health/version/ownership/metrics/capability/Passport contract. Resident and Unsloth internals are untouched. |
| Integrations / MCP | **PARTIAL** | Existing Connections panel is embedded. Role access, write qualification, and a complete integration-health catalog are not inferred. |
| Tools and terminal | **PARTIAL** | Existing terminal surface remains available and operator-gated. Default/automation shell, working-directory policy, environment inheritance, and worker permission preferences are not exposed here. |
| Sandbox | **HANDOFF REQUIRED** | No new execution-boundary settings. Attempt isolation/reset/retention belongs to the sandbox/workspace owner. |
| Scratch | **HANDOFF REQUIRED** | Documented distinctly from sandbox and canonical project/evidence state; scratch root, retention, quota, and promotion controls are not implemented here. |
| Git | **HANDOFF REQUIRED** | Settings does not create another Git client or remote-write policy. Git health and safe remote-mutation policy need the owning Git/Authority projection. |
| Network and privacy | **PARTIAL / READ-ONLY** | Displays the current shell network-posture label and links to canonical Connections/BYOK controls. It does not claim or enforce local-only mode. |
| Credentials | **PARTIAL** | Existing encrypted credential owner supports provider setup. This surface does not reveal secret values or create an alternate credential store. |
| Evidence and data retention | **READ-ONLY / HANDOFF REQUIRED** | Links to verification and distinguishes accepted evidence from scratch/cache. No destructive evidence cleanup control exists here. Retention/export health requires the evidence-store owner. |
| Git and project instructions | **HANDOFF REQUIRED** | Explicit Settings category; Git remote policy and project/context instructions remain with their canonical owners. No duplicate Git client or instruction editor is created. |
| Notifications | **PARTIAL** | Existing toast/status notifications remain. No notification preference center or configurable event policy is added. |
| Command Palette | **NOT IMPLEMENTED** | The shell's global search is not represented as a command palette and is not relabeled as one. |
| Keybindings | **NOT IMPLEMENTED** | No keybinding editor or preference is added. |
| Project Instructions | **HANDOFF REQUIRED** | Must surface the owning project/context instruction mechanism; Settings does not duplicate Context Control. |
| Diagnostics | **PARTIAL / READ-ONLY** | System Health has a manual local refresh. A full safe self-test and sanitized diagnostic-bundle export are not implemented. |
| Updates | **NOT IMPLEMENTED** | No updater/status/migration UI is claimed. |
| Rollback | **DOCUMENTED — MANUAL CODE-PROMOTION ONLY** | Stop promotion on failed acceptance and use a reviewed revert of the exact isolated repair/release commit. Preserve user data/evidence; never reset a user worktree or downgrade migrated data without compatibility evidence. Desktop updater/migration rollback is not implemented. See [the repository rollback doctrine](phase0/REPORT.md#k-rollback). |
| Profile export/import | **V1.1** | A future portable profile may include non-secret preferences only. No credential/session material is exportable; implementation is deferred. |
| Advanced / Developer | **NOT IMPLEMENTED** | No experimental or verbose logging switches are presented without backed behavior. |
| Reset controls | **PARTIAL** | Appearance/Accessibility has a bounded per-scope reset. No “reset everything” action is exposed. |

## First-run consistency

The current setup wizard requests `/api/setup/readiness`; its source comments and UI identify the verdict as server-computed, and the final “YOUR WORKSPACE IS READY” wording is conditional on that returned status. Settings and System Health do not independently declare first-mission readiness. This is source-level consistency evidence only; browser-level cross-surface behavior has not been exercised in this worktree.

## Frozen owner handoffs and priority

Priority meaning for this ledger:

- **P0 — release blocking:** do not claim the corresponding V1 safety/privacy property or enable the affected worker capability until the canonical owner supplies and enforces the contract.
- **P1 — close before V1:** required for trustworthy operator diagnosis/configuration, but the current read-only UI can remain limited while the owning work is pending.
- **P2 — V1.1 acceptable:** no current destructive control or unsupported production claim depends on the missing preference surface.

| ID / priority | Owner | Current state | Frozen gap |
|---|---|---|---|
| H1 / **P0** | Workspace Trust + Authority/execution policy | Settings shows `HANDOFF REQUIRED`; no trust toggle or policy is implemented here. | Canonical per-workspace trust snapshot and enforceable restricted-mode policy. |
| H2 / **P0** | Network/egress policy owner | Settings displays the shell posture label and links to Connections/BYOK; it does not enforce egress. | Canonical local-only/egress state and policy decision interface. |
| H3 / **P1** | RuntimeAdapter / Unsloth owner | UI only has existing model/runtime availability projections; no Runtime Passport. | Runtime identity, version, health, ownership, loaded artifact, capability and Passport validity. |
| H4 / **P1** | Model Manager / qualification owner | Model inventory can show availability; role qualification and freshness are unavailable. | Capability Passport reference, qualified roles, artifact binding, resource-fit facts and staleness. |
| H5 / **P1** | Hardware/resource telemetry owner | CPU logical count and RAM snapshot are available; CPU/GPU utilization and storage are not in the consumed contract. | Timestamped measured telemetry with explicit unavailable fields. |
| H6 / **P1** | Sandbox / attempt-workspace owner | Settings explains the boundary but does not control sandbox identity, reset or retention. | Attempt-bound baseline, root, lifecycle and safe cleanup/retention projection. |
| H7 / **P1** | Scratch/workspace owner | Scratch is explained as temporary and non-canonical; lifecycle controls are absent. | Scratch identity, retention, quota if supported, artifact class and explicit promotion path. |
| H8 / **P1** | Evidence-store owner | Settings distinguishes accepted evidence from scratch/cache and exposes no destructive cleanup. Store health/retention facts are absent. | Accepted/invalid/receipt state, retention/health, export and cleanup constraints. |
| H9 / **P1** | Authority/Security owner | Settings shows session pairing and links to Security; no aggregate policy or approval queue. | Effective allow/ask/deny policy and exact-operation approval projection/dispatch. |
| H10 / **P1** | Git owner + project/context instruction owner | Git and project-instruction settings are handoff-only. | Repository identity/status, remote-mutation policy, and the canonical project-instruction interface. |
| H11 / **P1** | Setup-readiness owner | Wizard source says readiness is server-computed; cross-surface behavior is not browser-qualified here. | Shared canonical first-mission readiness result and source timestamp for Settings/Health if displayed. |
| H12 / **P2** | Notification/event-delivery owner | Existing toast/status channel works; preference/delivery policy is absent. | Event classes, delivery status and bounded preference contract. |
| H13 / **P2** | Command/keybinding registry owner | Settings search exists; command palette and keybinding registry do not. | Canonical commands, IDs, default shortcuts and conflict reporting. |
| H14 / **P2** | Update/package owner | No updater or migration-status UI exists; manual code-promotion rollback is documented. | Version/channel/migration state and supported rollback contract before an updater is exposed. |

### H1 — Workspace Trust / Authority (**P0**)

- **OWNER:** Workspace Trust and the existing Authority/execution-policy owners; Settings is a consumer only.
- **CURRENT STATE:** The Settings category is marked `HANDOFF REQUIRED`. No second trust or permission engine exists.
- **MISSING CONTRACT:** Canonical workspace identity, trust state (`UNTRUSTED`, `RESTRICTED`, `TRUSTED` or owner-defined equivalent), source/version, restrictions, and an Authority-enforced decision for each affected operation.
- **WHY SETTINGS NEEDS IT:** The operator must know when a new workspace is inspection-only and which execution actions remain unavailable.
- **EXPECTED INPUT/OUTPUT:** Read a workspace-bound trust snapshot with state, source, timestamp and effective restrictions. A trust-change request, if supported, is sent to the owning policy service and returns its canonical decision; a local preference must never grant access.
- **ACCEPTANCE TEST:** An untrusted fixture visibly shows restrictions; a disallowed terminal/filesystem/network action is denied by Authority; changing display preferences cannot bypass the denial; stale or unknown trust fails closed.

### H2 — Local-only / egress policy (**P0**)

- **OWNER:** Canonical network/egress policy owner, not Settings or Connections UI.
- **CURRENT STATE:** Settings reports the current shell posture label and links to provider controls. That label is informational and does not establish or enforce local-only behavior.
- **MISSING CONTRACT:** A versioned effective policy snapshot and decision point covering cloud models, web, external providers/MCP, and public publishing, with policy source and blocked reason.
- **WHY SETTINGS NEEDS IT:** The operator must be able to answer what can leave the machine and distinguish a display label from an enforced boundary.
- **EXPECTED INPUT/OUTPUT:** Read effective mode, allowed egress classes, enforcement health and source. A mode change is a request to the policy owner; the UI reports accepted/rejected state and never sets its own policy truth.
- **ACCEPTANCE TEST:** Under local-only, each covered egress class is blocked before network dispatch while authorized local operation remains usable; UI and enforcement report the same policy version; unavailable policy is not rendered as enforced.

### H3 — Runtime Passport (**P1**)

- **OWNER:** RuntimeAdapter / canonical Unsloth runtime owner.
- **CURRENT STATE:** Existing APIs supply a runtime-available boolean and model states. Settings does not launch, stop, inspect, or mutate runtime processes/ports.
- **MISSING CONTRACT:** Runtime ID/provider/version/backend, health, ownership, loaded model and exact artifact, capabilities, resource metrics, Passport validity/freshness, and safe endpoint information where permitted.
- **WHY SETTINGS NEEDS IT:** Operators need to diagnose a local runtime without confusing process presence with health or qualification.
- **EXPECTED INPUT/OUTPUT:** Consume a read-only Runtime Passport and health snapshot; any lifecycle request is routed to the runtime owner and returns an owned operation receipt.
- **ACCEPTANCE TEST:** Fixture states and later live states render distinctly; stale/unknown is explicit; Settings performs no direct process or port operation.

### H4 — Model qualification truth (**P1**)

- **OWNER:** Model Manager / Capability Passport owner.
- **CURRENT STATE:** Registered/available model facts may be displayed; this UI cannot read qualified roles, passport freshness, or role-specific limits.
- **MISSING CONTRACT:** Exact model/artifact identity bound to qualification state, role set, evidence references, expiration/staleness and resource compatibility.
- **WHY SETTINGS NEEDS IT:** `AVAILABLE` must remain distinct from `QUALIFIED`, and role preference must not imply capability.
- **EXPECTED INPUT/OUTPUT:** Read canonical Passport references and role states; model preference requests carry the selected model/role but do not mutate qualification.
- **ACCEPTANCE TEST:** Installed-but-unqualified and stale-passport fixtures remain visibly unqualified/stale; no UI setting can promote either to qualified.

### H5 — Resource telemetry (**P1**)

- **OWNER:** Hardware/resource telemetry provider; Resource Admission remains separately authoritative.
- **CURRENT STATE:** The current hardware contract exposes logical CPU count, RAM totals/free, backend and VRAM when available. CPU utilization, GPU identity/utilization, disk capacity/free, Windows commit and snapshot freshness are not all available.
- **MISSING CONTRACT:** Timestamped measured values with source, units, validity and per-field unavailable reasons.
- **WHY SETTINGS NEEDS IT:** The operator needs truthful health context; visual summaries must not look like admission decisions.
- **EXPECTED INPUT/OUTPUT:** Read a hardware snapshot with optional measured fields and freshness metadata. No telemetry value from this UI is an `admitted` verdict.
- **ACCEPTANCE TEST:** Known values display with units/source; missing values display `UNKNOWN`/`UNAVAILABLE`; stale snapshots are labeled; Resource Admission decisions are never derived here.

### H6 — Sandbox retention (**P1**)

- **OWNER:** Sandbox / attempt-workspace owner.
- **CURRENT STATE:** Settings describes sandbox as an execution boundary but has no root, reset, retention or cleanup control.
- **MISSING CONTRACT:** Attempt ID, baseline identity, isolated root identity, process ownership, terminal state, retention deadline and an authorized cleanup operation.
- **WHY SETTINGS NEEDS IT:** Operators must understand where worker mutations occur and recover/discard attempts without contaminating canonical project state.
- **EXPECTED INPUT/OUTPUT:** Read the canonical attempt/workspace lifecycle. Cleanup requests name one owned attempt and return a receipt; unknown/foreign ownership is denied.
- **ACCEPTANCE TEST:** Attempt B starts from the frozen baseline after A is discarded; canonical source is unchanged; foreign/unknown processes are not terminated; retention status is auditable.

### H7 — Scratch retention (**P1**)

- **OWNER:** Scratch/workspace owner, coordinated with artifact promotion owner.
- **CURRENT STATE:** Scratch is described as temporary and distinct from sandbox/project/evidence, but its root and lifecycle are not configurable here.
- **MISSING CONTRACT:** Scratch ID/root ownership, retention, quota if supported, artifact classification and explicit promotion destination/receipt.
- **WHY SETTINGS NEEDS IT:** Temporary scripts/logs must not silently become project truth or disappear when needed for investigation.
- **EXPECTED INPUT/OUTPUT:** Read scratch inventory and retention; explicit promotion creates a project/evidence artifact through its owner; cleanup addresses only owned temporary data.
- **ACCEPTANCE TEST:** A scratch artifact remains labeled temporary, is not indexed as accepted evidence, and enters canonical project/evidence state only after explicit promotion.

### H8 — Evidence retention (**P1 for status/preservation; destructive controls remain out of scope**)

- **OWNER:** Evidence-store owner.
- **CURRENT STATE:** Settings links to verification and warns that accepted evidence is not cache/scratch. No evidence-store health, retention or cleanup surface is exposed.
- **MISSING CONTRACT:** Evidence class/state, provenance, durable reference, retention policy, health, export and permitted cleanup semantics.
- **WHY SETTINGS NEEDS IT:** Accepted truth and receipts must not be removed by temporary-state cleanup.
- **EXPECTED INPUT/OUTPUT:** Read evidence inventory/health and export references. Any cleanup operation must be explicitly typed by evidence class and owner-authorized; accepted evidence is protected by default.
- **ACCEPTANCE TEST:** Scratch/cache cleanup leaves accepted evidence and publication receipts intact; invalid evidence remains distinguishable; missing store health renders unknown rather than healthy.

### H9 — Permissions and approvals (**P1**)

- **OWNER:** Existing Authority/Security owner.
- **CURRENT STATE:** Settings exposes operator-session pairing status, explicitly not operation approval, and links to Security. There is no aggregate effective-policy view or approval center.
- **MISSING CONTRACT:** Effective policy by action/resource, source/inheritance, pending exact-operation request with requester/target/reason/evidence, supported scope, and approval/denial result.
- **WHY SETTINGS NEEDS IT:** Operators need to understand permission and approval state without creating a parallel Authority system.
- **EXPECTED INPUT/OUTPUT:** Read canonical policy and pending-request projections; dispatch only supported allow-once/mission decisions through Authority and retain its result reference.
- **ACCEPTANCE TEST:** UI shows source/effective policy; operation approval is scoped to the real request; UI cannot broaden or persist authority beyond the owner contract.

### H10 — Git and project instructions (**P1**)

- **OWNER:** Git owner and canonical project/context-instructions owner.
- **CURRENT STATE:** Existing Git/status surfaces remain elsewhere; Settings has no repository policy editor and does not duplicate Context Control.
- **MISSING CONTRACT:** Read-only repository identity/status plus remote mutation policy; canonical project instruction list/source/version and safe editing interface if supported.
- **WHY SETTINGS NEEDS IT:** The operator needs a front door to project truth while pushes/releases stay separately authorized.
- **EXPECTED INPUT/OUTPUT:** Read repo and instruction references; write requests are sent to their owner with revision/evidence and return a receipt.
- **ACCEPTANCE TEST:** Read-only state cannot push; remote mutation remains Authority-gated; instruction display matches the project/context owner and does not create a competing copy.

### H11 — First-mission readiness (**P1**)

- **OWNER:** Setup-readiness owner.
- **CURRENT STATE:** Setup source uses `/api/setup/readiness` and describes the verdict as server-computed; Settings/System Health do not independently declare first-mission readiness. This remains a source-level observation, not browser-proven cross-surface behavior.
- **MISSING CONTRACT:** Shared readiness state, blocking reasons, source version/timestamp and user-actionable next step for any Settings badge.
- **WHY SETTINGS NEEDS IT:** Onboarding must not say ready while the canonical system says blocked.
- **EXPECTED INPUT/OUTPUT:** Consume the same canonical readiness response as onboarding; Settings never recomputes readiness from clicked setup steps.
- **ACCEPTANCE TEST:** Onboarding and Settings display the same readiness state and source; a missing requirement yields `BLOCKED` with owner/reason/next action.

### H12 — Notifications (**P2**)

- **OWNER:** Canonical event-delivery/notification owner.
- **CURRENT STATE:** Existing toast/status channel remains; no event-class preference center is implemented.
- **MISSING CONTRACT:** Notification class, delivery state, urgency, acknowledgement/lifetime, and supported preference fields.
- **WHY SETTINGS NEEDS IT:** Operators should be able to tune meaningful event delivery without suppressing approvals or verification failures accidentally.
- **EXPECTED INPUT/OUTPUT:** Read canonical notification preferences and delivery state; preference updates return the effective policy/version.
- **ACCEPTANCE TEST:** A preference changes actual delivery behavior; approval-needed and verification-failed events remain visible under documented policy; no cosmetic toggle is shown.

### H13 — Command palette / keybindings (**P2**)

- **OWNER:** Canonical command and keybinding registry owner.
- **CURRENT STATE:** Settings search is present, but it is not a command palette; keybindings are not implemented.
- **MISSING CONTRACT:** Stable command IDs, availability predicates, default bindings, conflict rules and keyboard dispatch ownership.
- **WHY SETTINGS NEEDS IT:** Discoverable operator actions and shortcuts should not be inferred from labels or duplicated in Settings.
- **EXPECTED INPUT/OUTPUT:** Read command and binding metadata; binding changes, when supported, return validated effective bindings and conflicts.
- **ACCEPTANCE TEST:** Disabled/unavailable commands are marked; a binding invokes exactly its registered command; conflicts are rejected or resolved by the owner; no command executes by search-text coincidence.

### H14 — Updates and rollback (**P2**)

- **OWNER:** Package/update/migration owner.
- **CURRENT STATE:** No updater, update channel or migration-status UI exists. Manual rollback doctrine is documented; one-click rollback is not implemented.
- **MISSING CONTRACT:** Current version/channel, available update identity, migration status, last successful update, rollback eligibility and data-compatibility result.
- **WHY SETTINGS NEEDS IT:** An update panel must report package truth and recovery options rather than imply an updater exists.
- **EXPECTED INPUT/OUTPUT:** Read version/update/migration state; update/rollback requests, if later supported, return a verified operation receipt and preserve user data/evidence.
- **ACCEPTANCE TEST:** No update is offered without a verified package; failed migration leaves recovery state explicit; rollback never deletes user data or accepted evidence; absent support renders `NOT IMPLEMENTED`.

## Verification record for this candidate

- **Dependency preflight:** `npm ci --offline --no-audit --no-fund` passed from the committed lockfile using the existing local cache (127 packages); no package manifest/lockfile change. `node-pty` install scripts remain disabled by npm policy; this UI lane did not need native PTY execution.
- **Typecheck:** `npm exec -- tsc -p tsconfig.node.json` and `npm exec -- tsc -p browser/tsconfig.browser.json --noEmit` both pass. The four original diagnostics were corrected without widening contracts: blocked-state rows now use explicit `[string, string]` entries and append optional evidence only when present; setting choices are explicitly typed as string pairs.
- **Lint:** ESLint completed with 0 errors and 60 warnings, including the added browser acceptance script. The 60 warnings are existing no-unused-vars/disable-directive warnings elsewhere in the repository; no lint errors.
- **Production build:** `npm run build:frontend` passed (Vite 8.3; 1428 modules). The main chunk is 4.57 MB (1.18 MB gzip), producing the existing >500 kB chunk warning; build succeeded.
- **Focused preferences:** `npm run test:operator-settings` passed (1 test file). It covers preference persistence/inheritance, unknown/invalid/future data preservation, theme registry and bounded reset.
- **Unit tests:** the isolated `node --test tests/unit/test-secret-store.mjs` and full unit suite reproduce the same Windows DPAPI failure: 196 pass / 1 fail in the full suite, at `tests/unit/test-secret-store.mjs:37`, where unprotect is surfaced as `null`. The test and `node/src/services/secret-store.mjs` are unchanged from the starting commit. Cause remains unresolved; this is recorded as an unrelated baseline failure and secret-store semantics were not changed.
- **Existing browser suite:** `node scripts/cockpit-acceptance.mjs` passes. The reduced-motion assertion now checks that every computed transition is effectively zero (at most `0.01ms`), matching the stylesheet's deliberate reduced-motion clamp rather than requiring literal `0s`. One intermediate reload attempt timed out waiting for the memory-only pairing UI; the next diagnostic run and final run passed without changing the timeout, pairing contract, or product startup behavior.
- **Settings browser acceptance:** `scripts/operator-control-browser-acceptance.mjs` passed 21/21 checks in isolated headless Microsoft Edge against a deterministic local API fixture. It exercised Settings open/close/navigation/search, keyboard reachability/focus, accessible names, default↔Matrix switching, reload persistence, workspace override/global isolation and reload, malformed/unknown/future preference recovery, System Health/Why Blocked, reduced motion/effects, and 1280/1440/1920/1024 widths. No page exception or unexpected console/HTTP errors; one `GET /api/hardware/profile → 503` was an expected negative fixture used for Why Blocked. Fixture-backed telemetry validates presentation only, not this machine's live telemetry.
- **Screenshots:** Seven final captures are stored under [`artifacts/operator-control-acceptance-2026-09-25-13908/`](../artifacts/operator-control-acceptance-2026-09-25-13908/); the [acceptance result](../artifacts/operator-control-acceptance-2026-09-25-13908/acceptance-result.json) records all checks. The images are deterministic fixture screenshots, not production telemetry/media.
- **Checkpoint finalization:** Sixteen older acceptance-output directories were verified as belonging to the named browser harness and superseded by run `13908`. Their cleanup was rejected by the execution policy before any deletion occurred. They remain untracked; the scoped fixes and final evidence are committed locally, but the worktree is not clean. Nothing was pushed.
- **Accessibility:** Automated axe was unavailable in the project-local dependency set. Keyboard tab reachability, visible focus, named Settings search/theme controls and reduced motion/effects were checked in Edge. No screen-reader test or full rendered contrast audit was run; accessibility remains **PARTIAL**.
- **Privacy:** No provider/cloud/model calls were made. Browser used an isolated temporary Edge profile and deterministic API fixtures. Preference test cases include malformed/unknown/future values; no real credentials were used.
- `UNKNOWN` and `UNAVAILABLE` remain distinct from measured zero, failure, qualification, or admission. This UI does not promote runtime, permission, model qualification, or evidence truth.
