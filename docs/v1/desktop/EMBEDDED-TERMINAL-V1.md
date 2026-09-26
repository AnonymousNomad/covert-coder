# Embedded Terminal V1 — Root Cause, Fix, and Acceptance

- Date: 2026-09-26
- Lane: `feat/covert-desktop-control-v1`
- Status: **CODE-SIDE CANDIDATE — root cause fixed; 13/13 acceptance battery green headless through the real UI (four consecutive runs); built-app rerun pending**
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

Result: **13/13 PASS; four consecutive runs green** (three back-to-back stability runs plus one evidence run).

| Point | Result |
|---|---|
| TERM-001 panel opens and stays active (first-run race path; bounded poll waits for the tour to auto-open after the click and requires no revert) | PASS |
| ONB-001 automatic onboarding never overrides explicit operator navigation | PASS |
| TERM-002 provider probe resolves, provider AVAILABLE | PASS |
| TERM-003 OPEN SESSION offered | PASS |
| TERM-004 approval-gated real session (409 → operator approval → 200) | PASS |
| TERM-005 real shell identified (PowerShell 7.6.6) | PASS |
| TERM-006 workspace cwd (`E:\aide-desktop-control-v1`) | PASS |
| TERM-007 input reaches the owned session + output streams back (`echo COVERT_TERMINAL_OK`) | PASS |
| TERM-008 session survives resize | PASS |
| TERM-009 exit returns the panel to the closed state (clears the dead terminal) | PASS |
| TERM-010 fresh session starts after exit | PASS |
| TERM-011 canonical STOP SESSION closes the session | PASS |
| TERM-012 no uncaught page errors | PASS |

Harness hardening (assertions unchanged): fixed-duration waits replaced with bounded polls for session prompt/exit/stop settlement; the script now requires stack ports to be free before start and after teardown, which removed back-to-back-run contamination (one repeat run showed 403s from the previous stack still shutting down).

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

## 5. Defects fixed in this round

- `UI-TERM-013` (fixed): WSL provider distro names arrived NUL-interleaved. Root cause was at the command boundary — `defaultExec` decoded `wsl.exe` output as UTF-8 while the tool emits UTF-16LE. `defaultExec` now selects `utf16le` for `wsl.exe`, and the exported `normalizeWslDistroOutput()` re-decodes already-mis-decoded output losslessly (correct decoding, never arbitrary stripping). Regression: `tests/arch/runtime-providers-wsl.test.ts` (3/3) with the exact observed NUL-interleaved sample, unchanged-text passthrough, BOM handling, and no-distribution/error states; `tests/arch/terminal-session-routes.test.ts` 11/11 unchanged.
- Provider-probe timeout UX (verified + tightened): the panel already shows the truthful bounded checking state (`Probing runtime providers…`); on failure it now maps a timeout to `Provider discovery timed out (bounded probe). Use REFRESH to retry.` and re-attaches the existing REFRESH control (no new provider state machine). Read timeout stays bounded at 45s for this probe only.
- `UI-TERM-014` (found and fixed by this battery): after typing `exit`, the stopped-session branch re-offered `OPEN SESSION` while the exited xterm stayed rendered (occasionally requiring a second poll). The terminal-state branch now clears the dead terminal surface through `renderSessionEnded` before re-rendering the open controls; TERM-009 proves the closed state.

## 6. Onboarding invariant (regression + handoff)

Invariant: **automatic onboarding may never override explicit operator navigation.** The fix and its regression now cover both forms:

- `TERM-001` clicks TERMINAL immediately (before the first-run onboarding check resolves), waits (bounded) for the tour to auto-open *after* the click, and requires the operator-selected panel to remain active throughout.
- `ONB-001` clicks RESIDENT while the tour is open and requires the operator-selected panel to remain active.

Handoff note for the Luna #1 onboarding lane: any future change to `Walkthrough.ts` must preserve `navigate` being explicit-only. The auto-open path aligns to `store.get().panel` and must not write the panel; manual open and BACK/NEXT remain the only panel-driving actions.

## 7. Defects recorded (not fixed here)

- `UI-ID-001` operator-visible build identity ambiguity (Section 4). Owner: packaging/operator verification.
- Note: the 409 responses visible in the browser console during session start are the enrolled approval choreography, not failures.

## 8. Remaining to close

1. Rebuild the desktop bundle (frontend already rebuilt; the Tauri exe embeds it at build time) and rerun this battery against the built shell when the desktop is idle, together with the affected Desktop UIA gates.
2. Verify exact OS-level cleanup counts during the built-app terminal battery (owned shell processes = 0 after stop/exit).

