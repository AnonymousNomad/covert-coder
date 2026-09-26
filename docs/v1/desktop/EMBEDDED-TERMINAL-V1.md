# Embedded Terminal V1 — Investigation Record

- Date: 2026-09-26
- Lane: `feat/covert-desktop-control-v1` (worktree `E:\aide-desktop-control-v1`)
- Status: **INVESTIGATION CHECKPOINT — root-cause boundary isolated; fix pending dev-console capture**
- Operator observation: `Terminal → Start Session → no visible result`.

## 1. Surface mapping (repository truth)

| Boundary | Implementation | State |
|---|---|---|
| UI panel | `browser/src/panels/terminal.ts` (button label `OPEN SESSION`; the string `Start Session` does not exist anywhere in the repository) | IMPLEMENTED |
| Panel mount | `browser/src/cockpit/CockpitShell.ts:298` `lazyPanel(terminalStage, () => createTerminalPanel(...))`, stage `#cockpit-terminal-stage` (`CockpitShell.ts:156`) | IMPLEMENTED |
| Panel switching | `CockpitShell.ts:345-354` `applyCenterPanel()` sets `root.hidden` per store `panel` | IMPLEMENTED |
| Client | `browser/src/services/api.ts:551-568` `terminalProviders/terminalSessions/terminalSessionOpen/terminalSessionStop` | IMPLEMENTED |
| Approval choreography | `browser/src/services/api.ts:217-231` (409 `NOT_READY/APPROVAL_REQUIRED` → `approveRequest()` prepare/confirm/decide → exact-operation retry, `browser/src/services/authority.ts:78-93`) | IMPLEMENTED |
| Backend route owner | `node/src/routes/terminal-sessions.ts` + `node/src/services/terminal-sessions.ts` (canonical PTY owner; Remote Operator audit verified substrate) | IMPLEMENTED |
| Authority kinds | `common/security/operation-policy.mjs:52-55` `terminal.read`, `terminal.session.start`, `terminal.session.stop` | IMPLEMENTED |
| Product-edge map | `common/facade-route-map.json:45` `"/api/terminal": "ts"` | IMPLEMENTED |

No second terminal implementation was created.

## 2. Live reproduction (current built shell, `desktop/target/release/aide-sovereign-workbench.exe`)

Method: launch the built shell; invoke the left-nav control `TERMINAL: Governed sessions` through the qualified UIA `activate` action (InvokePattern), then observe the window tree.

Observed:

| Probe | Result |
|---|---|
| `TERMINAL: Governed sessions` found and invoked | YES (product probe `activate` returned SUCCESS; raw UIA probe confirmed) |
| App process alive after the click | YES (10s observation) |
| `#cockpit-terminal-stage` present in the UIA tree after the click | **NO — never present across 10s poll** |
| Controls named `OPEN SESSION` / `START SESSION` anywhere in the window | **NO — zero candidates** |
| Control: invoking `SETTINGS: Operator config` under identical conditions | **YES — settings content surfaces** (stage/categories visible) |

Conclusion: the operator-visible no-op reproduces as **the terminal panel stage never surfacing** while the app stays alive and while the same invocation mechanism successfully surfaces the Settings panel. The failing boundary is the mount/display of `panel === 'terminal'`, not the provider probe, not the approval choreography, and not the backend.

## 3. Ruled out

- CSS hiding: `.cockpit-panel-stage[hidden] { display: none !important; }` (`browser/src/cockpit/cockpit.css:449`) — correct; a surfaced stage appears in the UIA tree (Settings proves the mechanism).
- Missing code in the build: `OPEN SESSION`, `Probing runtime providers`, `No runtime provider is available` are present in `browser/dist/assets/index-*.js`.
- Route/facade/auth enrollment: present per Section 1; the backend PTY substrate is independently qualified (`tests/arch/terminal-session-routes.test.ts`, and the Desktop Control terminal GUI gate in this lane exercises a real console host end-to-end).
- `getSharedEvents()` null-safety: returns `null` until set; the panel guards with optional chaining (`browser/src/services/ws.ts:129-131`).

## 4. Not yet captured (exact next executable action)

Release WebView2 does not forward the page console, so the mount-time exception (if any) has not been read. Next executable action:

1. `node scripts/start.mjs --frontend=vite` (dev stack + pairing code), open the Vite URL in Edge, pair, open DevTools console, click `TERMINAL`.
2. Capture the mount-time exception and fix either the factory (`createTerminalPanel`) or the panel-switch path.
3. Re-run this record's acceptance battery through the product UI (session create, `echo COVERT_TERMINAL_OK`, cwd, input, streaming, resize, exit, restart, stop, cleanup=0, foreign shell survival) and record evidence.

## 5. Environment note (applies to all GUI verification)

While this investigation ran, the operator was actively using the machine. Focus-gated GUI actions observed system IME focus contention (`focused_process_id` of an external process while the target window was foreground), which makes GUI gates fail closed. GUI batteries must run on an idle desktop; the gates are designed to refuse rather than steal focus, and that refusal is correct behavior.

## 6. Classification

- Owner: **CURRENT LANE** (frontend + panel mount are in this repository and lane scope).
- V1 severity: **release blocker** (embedded terminal acceptance is part of V1 closure).
- Related contract: Desktop Control V1 remains safe semantic Windows GUI execution; this defect is the separate embedded-terminal acceptance contract.
