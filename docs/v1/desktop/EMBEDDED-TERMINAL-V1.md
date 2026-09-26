# Embedded Terminal V1 — Root Cause, Fix, and Acceptance

- Date: 2026-09-26
- Lane: `feat/covert-desktop-control-v1`
- Status: **CODE-SIDE CANDIDATE — root cause fixed; 12/12 acceptance battery green headless through the real UI; built-app rerun pending**
- Operator observation: `Terminal → Start Session → no visible result`.

## 1. Root cause (proven)

The first-run walkthrough (`browser/src/cockpit/Walkthrough.ts`) unconditionally drove the cockpit panel on every render:

```ts
function render(): void { ... store.set(prev => ({ ...prev, panel: step.id })); }
void api.onboardingState().then(state => { if (state.walkthrough_complete === false) show(); });
```

`show()` → `render()` sets `panel` to the current tour step (`command-center`). Because the onboarding check resolves **asynchronously after page load**, the auto-open could land *after* the operator clicked a destination. The click did switch the panel (the terminal panel mounted — verified: `#cockpit-terminal-stage` childCount 0→1), and milliseconds later the walkthrough forced `panel: command-center` and hid the stage again. Operator-visible result: "nothing happened". Race captured live (dev stack, headless browser):

- failing path: click at t0 → `panel: terminal`; walkthrough opens at t≈2s → `panel` reverts to `command-center`, stage `hidden: true`;
- non-racing path (walkthrough already open): click sticks.

This also explains the intermittency: clicking after the walkthrough auto-open worked; clicking during the load window did not.

## 2. Fix (root cause only)

`browser/src/cockpit/Walkthrough.ts`:

- `render(navigate: boolean)` navigates only when explicitly asked.
- Auto-open (first-run) navigates **only if the operator has not navigated** while the onboarding check was in flight and the panel is still the app default; otherwise the tour **aligns to the operator's current panel** without overriding it.
- Manual open (SETTINGS) and BACK/NEXT keep their intended real panel switching.
- A store subscription tracks operator navigation while the tour is closed.

Companion margin fix: `browser/src/services/api.ts` `terminalProviders()` now allows 45s for the cold provider discovery probe (measured 4.6s warm; one cold run exceeded the previous 15s read timeout and failed the first probe closed).

## 3. Acceptance battery (headless, real UI, committed script)

`scripts/terminal-acceptance.mjs` runs the intended dev stack under a pty, pairs a real Edge (Playwright, headless — no operator desktop interaction), opens TERMINAL during the first-run window, and executes the 10-point contract with backend effects observed over the facade. Evidence: `docs/evidence/embedded-terminal-battery.json`.

Result: **12/12 PASS, two consecutive runs.**

| Point | Result |
|---|---|
| TERM-001 panel opens and stays active (race path) | PASS |
| TERM-002 provider probe resolves, provider AVAILABLE | PASS |
| TERM-003 OPEN SESSION offered | PASS |
| TERM-004 approval-gated real session (409 → operator approval → 200) | PASS |
| TERM-005 real shell identified (PowerShell 7.6.6) | PASS |
| TERM-006 workspace cwd (`E:\aide-desktop-control-v1`) | PASS |
| TERM-007 input reaches the owned session + output streams back (`echo COVERT_TERMINAL_OK`) | PASS |
| TERM-008 session survives resize | PASS |
| TERM-009 exit returns the panel to closed state | PASS |
| TERM-010 fresh session starts after exit | PASS |
| TERM-011 canonical STOP SESSION closes the session | PASS |
| TERM-012 no uncaught page errors | PASS |

Cleanup: each run tears the stack down; ports 4777-4779/5173 free, no stack or shell processes remain (verified after both runs).

## 4. Surface mapping and discrepancy reconciliation

| Boundary | Implementation | State |
|---|---|---|
| UI panel | `browser/src/panels/terminal.ts` (button `OPEN SESSION`) | IMPLEMENTED, verified |
| Panel mount | `CockpitShell.ts:298` lazy panel, stage `#cockpit-terminal-stage` | IMPLEMENTED, verified |
| Client + approval choreography | `browser/src/services/api.ts:217-231`, `browser/src/services/authority.ts:78-93` | IMPLEMENTED, verified live (409 → prepare → operator confirm → exact-operation retry) |
| Backend PTY owner | `node/src/routes/terminal-sessions.ts` + `node/src/services/terminal-sessions.ts` | canonical owner unchanged, exercised live |
| Authority kinds | `operation-policy.mjs:52-55` | `terminal.session.start` bound the exact session request |

Discrepancy: the exact string `Start Session` does not exist anywhere in this repository (source, built bundle, dev server). The operator-visible surface with that label was therefore not produced by this worktree's current UI. Reconciliation requires build-identity evidence for whatever the operator had open: current candidate UI (this branch, built `browser/dist` bundle), a stale browser cache/dev server, or the separately-owned installed legacy package. Recorded as a V1 acceptance-ledger item (`UI-ID-001`) for the Packaging lane to verify against the installed package; this lane's dev and built UIs use `OPEN SESSION`.

## 5. Defects recorded (not fixed here)

- `UI-TERM-013` WSL provider card shows distro names with interleaved NUL characters (`P\u0000o\u0000w\u0000e\u0000r...`) — a decoding defect in the provider projection (likely UTF-16 output decoded as UTF-8). Cosmetic; provider still functions. Owner: current lane, follow-up.
- `UI-ID-001` operator-visible build identity ambiguity (Section 4). Owner: packaging/operator verification.
- Note: the 409 responses visible in the browser console during session start are the enrolled approval choreography, not failures.

## 6. Remaining to close

1. Rebuild the desktop bundle (frontend is already rebuilt; Tauri exe embeds it at build time) and rerun the terminal battery against the built shell when the desktop is idle, together with the affected Desktop UIA gates.
2. Verify exact OS-level cleanup counts during the built-app terminal battery (owned shell processes = 0 after stop/exit).
3. Convert the WSL provider decoding defect into a fix plus regression.
