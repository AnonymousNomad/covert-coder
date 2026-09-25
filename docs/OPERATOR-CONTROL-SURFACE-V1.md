# Operator Control Surface V1 — implementation and ownership ledger

Status: **PARTIAL**. This document describes the isolated UI candidate based on `a28aac8cc37ab64d3d1bcf253e14361214d256ab`. It is an implementation ledger, not a release certificate. Browser build, browser interaction, and visual/accessibility audits remain unverified in this worktree because its locked dependencies are not installed and network/package installation is outside this lane's local-only rules.

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

## Required owner handoffs

| Owner | Missing contract/data | Why the operator surface needs it | Acceptance check |
|---|---|---|---|
| Workspace Trust + existing Authority/execution owner | Workspace identity, trust posture, restricted-mode effects, policy source; no second Authority | Explain what inspection/execution is permitted in an unfamiliar workspace | Untrusted workspace shows the owning restrictions; changing trust cannot bypass Authority; no duplicated policy state |
| Existing Authority/Security owner | Effective permission view and pending exact-operation approvals, with target, requester, reason, evidence, and supported approval scope | Explain allow/ask/deny and approval-bearing actions | UI displays source/effective state; approve/deny dispatches only through the existing Authority contract |
| Model Manager / qualification owner | Passport reference, qualification freshness, qualified roles, artifact identity, resource compatibility | Keep availability separate from qualification and support role selection | Installed-but-unqualified remains visibly unqualified; stale passport remains stale |
| RuntimeAdapter / Unsloth owner | Runtime identity/version/health/ownership/loaded artifact/metrics/capabilities/Passport validity | Diagnose local inference without manipulating the runtime from Settings | Fixture and live adapter state render distinctly; UI performs no direct process/port mutation |
| Hardware/resource owner | CPU utilization, GPU identity/utilization, VRAM snapshot timestamp, disk capacity/free, Windows commit where supported | Replace current explicit unavailable values with measured values | Missing values remain UNKNOWN/UNAVAILABLE; resource admission remains separately owned |
| Tool registry + Authority + sandbox/scratch owners | Effective tool permissions; sandbox/scratch identities and lifetimes; safe cleanup/promotion actions | Configure and recover the worker workstation | Sandbox reset is isolated; scratch promotion is explicit; foreign processes/paths remain protected |
| Network/privacy policy owner | Canonical local-only mode and egress policy status | Answer what can leave the device and enforce local-only behavior | Provider/web/MCP/publication egress reflects one policy owner; a display-only label cannot be mistaken for enforcement |
| Evidence-store owner | Accepted/invalid evidence, receipts, export, retention and health contract | Protect accepted project truth from cache/scratch cleanup | Temporary cleanup cannot remove accepted evidence; evidence status remains canonical |
| Git owner | Repository identity/health and remote mutation policy | Show local Git state while preserving separate approval for push/release | Read-only state cannot perform remote mutation; remote write remains Authority-gated |
| Setup-readiness owner | Cross-surface first-mission readiness projection if Settings later needs a readiness badge | Avoid conflicting onboarding/System Health claims | Onboarding and Settings render the same canonical readiness result and source timestamp |

## Verification record for this candidate

- Focused preference-store tests cover global/workspace inheritance, persistence across a new store instance, unknown/invalid/future schema preservation, unavailable storage, theme registry, appearance token application, and bounded Appearance reset.
- Token-level foreground/background contrast was calculated from the CSS values: default Covert text/muted/dim are 15.70/9.13/7.74:1 on the primary background and 14.50/8.43/7.15:1 on the panel; Matrix values are 18.82/11.93/8.35:1 on the primary background and 17.04/10.80/7.56:1 on the panel. This is not a complete rendered-component contrast audit.
- Browser build, browser E2E, responsive screenshots, keyboard walkthrough, and measured contrast audit are pending because `node_modules` and browser-test dependencies are absent in this worktree. No dependency installation or provider/network access was performed.
- `UNKNOWN` and `UNAVAILABLE` are status values, not errors or measured zeros. No theme/settings surface promotes runtime, permission, model qualification, or evidence truth.
