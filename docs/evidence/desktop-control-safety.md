# Desktop Control pre-qualification safety review

Date: 2026-09-25
Classification: **DISCOVERED AND CORRECTED PRE-QUALIFICATION SAFETY DEFECT** — not a Desktop Control runtime failure.

## Finding

At starting checkpoint `a05ad8484b7d5451f8797a8d09e99a08836320ca`, `scripts/desktop-battery.mjs` used `taskkill /IM notepad.exe /F` in both the real-task and trajectory probes. That selected every matching Notepad process, including operator-owned instances, rather than the process launched by the test.

## Correction

- The battery now launches a bounded, disposable Node fixture through the canonical Desktop Control service and Authority path; it no longer opens Notepad, Outlook, Excel, or a default OS file handler.
- Immediately after launch it captures PID, parent PID, executable path, and Windows process creation time. Before cleanup it re-queries and compares the complete identity; any mismatch or unavailable identity blocks cleanup.
- Cleanup uses the service's retained owned `ChildProcess` handle through the approved panic operation. The fixture is a leaf process and starts no descendants. The battery verifies the original process identity is absent afterward.
- A Windows regression test starts two processes with the same executable. It verifies an altered start-time identity is rejected without termination, the owned child is cleaned up, and the foreign same-executable process remains alive until its own retained handle is cleaned up.
- The battery's result wrapper now records thrown test failures, preventing an incomplete custom `N/N` line from masking a Node test failure.
- `scripts/desktop-staged-smoke.mjs` now cleans only its retained launcher process handle after executable-identity revalidation on Windows. `desktop/stack-launcher.mjs` now shuts down only its explicitly retained direct child handles; it does not recursively sweep descendants.
- The P6 Desktop Control procedure was corrected to require PID/parent/path/creation-time capture and exact retained-handle cleanup.

## Verification

- Process identity regression: 2/2 PASS (same-executable ownership and source safety checks).
- Canonical Desktop Control ownership/panic integration: 5/5 PASS.
- DC-a battery: 10/10 PASS; the run records exact fixture identity and confirms exact-owned cleanup.
- `node --check`: changed JavaScript modules PASS.
- `git diff --check`: PASS.
- No Notepad image-wide selector or process-name termination remains in the Desktop Control battery/staged smoke/stack launcher files.

## Scope and exclusions

- Desktop lifecycle smoke cleanup uses specific `System.Diagnostics.Process` objects returned by its own `Start-Process` calls; that install/uninstall script was not run because it mutates the host installation.
- The shared, non-Desktop-Control test stack supervisor and other application/runtime launchers contain exact-root-PID recursive `/T` fallbacks. They are not image-wide selectors and were not changed in this Desktop Control safety patch; recursive descendant ownership deserves a separate owner review before relying on those paths.
- That initial battery did not qualify Live Outlook/Excel integration behavior, GUI input, UI Automation, file-picker selection, drag/drop, or browser chrome interaction. Later UIA pilot and Wave 2 evidence are recorded below; the original battery result remains unchanged.

## Follow-up: bounded Windows UI Automation pilot

Date: 2026-09-25. This follow-up added a narrow Windows UIA adapter and disposable WPF fixture; it does not change the classification of the earlier Notepad cleanup finding.

- The UIA adapter only targets a live process directly launched and retained by the current Desktop Control session. It revalidates PID, parent PID, executable name/path, and creation time before dispatch and again in its PowerShell helper; window handles are filtered by owner PID.
- The helper re-enumerates the HWND and verifies its owner PID immediately before and after focus, invoke, and scroll. UIA helper stdin delivery and wait are both under the retained-child timeout/cleanup guard.
- Successful UIA receipts preserve only bounded action/window/control IDs, expected/verifier state metadata, and assertion status; they do not serialize accessible names, control values, or the fake password fixture value.
- The real fixture integration verified approval refusal, non-owned PID refusal, fabricated HWND and missing-control refusal, semantic discovery/inspection, foreground focus, bounded scroll, `InvokePattern` with a toggle-state postcondition, exclusion of a fake password control/value from inspect output, and panic cleanup.
- The UIA WPF fixture integration passed `1/1`; UIA unit tests passed `3/3`; the Desktop Battery passed `10/10`; the process-identity foreign same-executable regression passed `2/2`; Desktop panic/ownership integration passed `5/5`; desktop policy/agent integration passed `22/22`.
- No fixture process remained after the interactive integration test. No operator file or foreign process was modified.
- This is a **partial semantic UIA pilot**, not Desktop Control V1 qualification. Raw mouse, text/keyboard entry, screenshot capture, file-picker selection, drag/drop, clipboard, Terminal/Edge/Covert interaction, unexpected dialogs, and broader recovery are not qualified. See `DESKTOP-CONTROL-QUALIFICATION-V1.md` and `DESKTOP-CONTROL-PASSPORT.json`.

## Cleanup pattern classification

The current Desktop Control battery/staged smoke/stack launcher have no active image-wide or wildcard process termination. The test selector's forbidden strings are static test data only. Historical `/IM notepad.exe` references remain in earlier evidence by design.

General test/application launchers that use `/PID <root-pid> /T` are exact-root-PID recursive tree termination, not image-wide selectors; their descendant ownership is outside this Desktop Control patch and remains a separate review item. Desktop Control qualification does not rely on those paths.

## Wave 2 closure evidence

Date: 2026-09-25. The bounded UIA adapter additionally qualified plain fixture text/key input with pre/post focus checks, a revalidated element-center pointer click, and leased-window screenshot capture. A deterministic focus-steal test verified zero characters reached either fixture field after focus changed. Screenshot capture refused a fixture window containing a UIA password descendant; a safe fixture capture and receipt are preserved under `docs/evidence/desktop-control-wave2/`.

The actual Windows file picker was discovered, but its filename-entry UIA surface contained ambiguous panes and no uniquely proven writable filename field. The adapter refused `UIA_FILE_PICKER_CONTROL_UNAVAILABLE`; no selection was made. Out-of-root selection was refused. Terminal GUI, browser GUI, Covert GUI, clipboard, drag/drop, modal/recreation recovery, and full resource measurement remain unqualified. Therefore the Desktop Control Passport remains **BLOCKED**, not V1-qualified. See `desktop-control-wave2/DESKTOP-CONTROL-PASSPORT-WAVE2.json` and `desktop-control-wave2/DESKTOP-CONTROL-QUALIFICATION-V1-WAVE2.md`.
