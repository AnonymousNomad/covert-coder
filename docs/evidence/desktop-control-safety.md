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
- Live Outlook/Excel integration behavior, GUI input, UI Automation, file-picker selection, drag/drop, and browser chrome interaction remain unqualified by this battery.
