# Covert V1 — Operator Acceptance Battery Ledger

Taxonomy: **AUTHORITATIVE V1 ACCEPTANCE TAXONOMY** (operator, 2026-09-26) — checkpoints are not redefined or renumbered.
Accepted product checkpoint: `8173693`. Embedded Terminal V1 is independently CLOSED.
Procedure per checkpoint: INVENTORY → EXERCISE → VERIFY REAL EFFECT → RECORD → FIX OR HANDOFF → REVERIFY → COMMIT → REPORT.

Machine-readable ledger: `docs/v1/acceptance/COVERT-V1-OPERATOR-ACCEPTANCE.json`

| CP | Scope | Status |
| --- | --- | --- |
| CP01 | Shell / Navigation / Security / Approvals | **PASS 20/20** (`checkpoint-01.json`) |
| CP02 | Projects / Workspaces | **IN PROGRESS — blocked by operator activity (fail-closed); driver hardened, one idle-window run remains** (`checkpoint-02.json`) |
| CP03 | Editor / Files | PENDING |
| CP04 | Embedded Terminal | **CLOSED** (`embedded-terminal-battery.json`, `embedded-terminal-battery-built.json`) |
| CP05 | Resident / Chat / Context | PENDING |
| CP06 | Intelligence / Model Manager / Local Models | PENDING |
| CP07 | Providers / Chat Picker / Routing | PENDING |
| CP08 | Tools / Integrations / Deployments | PENDING |
| CP09 | Workflows / Missions / Evidence | PENDING |
| CP10 | Permission / Authority State Transitions | PENDING |
| CP11 | Settings / Onboarding / Discoverability / Persistence | PENDING (candidate dependency `934f306ac0138cb92fdead769502d7acf880d7d8` not yet confirmed integrated) |
| CP12 | Themes / Appearance / Accessibility | PENDING |
| CP13 | System Health / Status Truth | PENDING |
| CP14 | Resource Telemetry | PENDING |
| CP15 | Git / Development Operations | PENDING |
| CP16 | Desktop Control Integration | PENDING (reuses accepted Desktop Control evidence) |
| CP17 | Failure / Offline / Recovery UX | PENDING |
| CP18 | Shutdown / Restart / Persistence / Clean Recovery | PENDING |

## CP02 — Projects / Workspaces (current state)

Driver: `scripts/acceptance-checkpoint2-uia.mjs`. Last full driver run: **11/14** (`docs/evidence/acceptance-cp02/driver-run-11of14.log`).

Proven through the real product + real filesystem (staged workspace `desktop/target/release/resources`):
workspace root/meta identity vs live `readdir` counts; marker files created on disk listed by the surface,
opened into the EDITOR, surfaced by the surface REFRESH with a truthful count, removed truthfully after
deletion; REFRESH on a reopened surface lists a new marker exactly once; bundle cards canonical
(catalog ids from `workbenches/registry.json`, states from `<workspace>/.aide/workbenches`); no implicit
trust; single fixed workspace inventory (no open/switch/recent/close controls — launch-bound anchor by design);
panic frees the ports; foreign processes survive (exact-PID attribution).

Remaining 3 failures from the last full run are apparatus gaps already fixed in the driver (UIA provider
stall read recovery, registry.json vs state-file confusion, count-drift → PID attribution). One
idle-window run concludes CP02.

Runs 4–7 of the driver are classified **ENVIRONMENTAL — operator active** (measured idle 8.8 s; the
battery-launched window was closed externally; the app exited cleanly, no WER crash records; the boot
trace shows a fully successful setup). GUI acceptance fails closed under operator activity by design.

## Defects recorded

| ID | Defect | Owner | Status |
| --- | --- | --- | --- |
| DC-EPIPE-001 | `desktop/stack-launcher.mjs:130` — unhandled **EPIPE** when the native parent closes the bootstrap pipe before the pairing write; the launcher crashes instead of taking the parent-death path (watchdog covers only the periodic ppid check). Evidence: `docs/evidence/acceptance-cp02/launcher-epipe-crash.log`. Impact: transient stack restart churn/zombie writers when the app exits between stack readiness and the pairing write. | DEEPSEEK (desktop shell — this lane) | RECORDED — fix requires operator approval + rebuild (product frozen at `1a7f80e`) |

## Known handoffs

- **UI-ID-001** — Start Session build-identity discrepancy, `UNRESOLVED_PACKAGING_HANDOFF` (`docs/v1/desktop/EMBEDDED-TERMINAL-V1.md` section 7).

## Environmental characteristics tracked

- **ENV-WEBVIEW2-SETTLE** — the WebView2 UIA provider intermittently returns an empty subtree after first paint or a heavy-panel switch (boot 17→0 names; command center recovered at 8.8 s; settings stable at 249). Settle-retries are bounded test apparatus; failures remain truthful. Promote to the defect ledger if frequency or severity grows.

## Cross-checkpoint observations (for CP03)

- `PUT /api/session` → 409 `NOT_READY exact operation approval required` on every cockpit autosave cycle (`arch-daemon.log`).
- `POST /api/lsp/open` → 403 `FORBIDDEN capability has no authority policy` on every editor load (`arch-daemon.log`).
