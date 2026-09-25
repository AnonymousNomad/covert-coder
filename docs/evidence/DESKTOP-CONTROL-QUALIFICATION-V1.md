# Desktop Control Qualification V1

**Result: DESKTOP CONTROL V1 BLOCKED — broad GUI workflow is not yet qualified.**

This is a bounded Windows UI Automation pilot, not a claim of unrestricted computer control. The available adapter safely launched a disposable WPF fixture and exercised semantic controls in that same retained, identity-checked process. Text entry, screenshots, file pickers, dialogs, browser chrome, and Covert's already-running UI remain outside the verified surface.

## Environment and provider

- Windows 11 Home Insider Preview, version `10.0.26220`, build `26220`.
- The Desktop Control helper actually ran under `powershell.exe` `5.1.26100.8925`; Node `26.4.0`.
- That helper loaded Windows UI Automation `UIAutomationClient` assembly `4.0.0.0`. The outer interactive shell used for noninteractive XAML preflight was PowerShell `7.6.6`; it is not the helper runtime.
- Window discovery uses native `EnumWindows` filtered by process ID, then UIA `AutomationElement` inspection. The target PID, parent PID, executable name/path, and creation time are checked before the operation and again inside the helper. The HWND is re-enumerated and owner PID checked immediately before and after focus, invoke, and scroll.
- Tested application: the disposable PowerShell-hosted WPF fixture only.

## Verified behavior

- The prior battery's Notepad `/IM` cleanup was removed before this qualification. It is recorded as a discovered-and-corrected pre-qualification safety defect, not a runtime failure.
- Desktop Battery: `10/10 PASS`; fixtures are launched through Desktop Control and cleaned through retained owned handles after identity checks.
- UIA unit tests: `3/3 PASS`.
- Windows process-identity regression: `2/2 PASS`, including a same-executable foreign process that remains alive when the test-owned process is terminated.
- Owned-process unit check: `1/1 PASS`.
- Desktop panic/ownership integration: `5/5 PASS`.
- Desktop policy/agent integration: `22/22 PASS`.
- UIA integration: `1/1 PASS`. It verified an unapproved action is refused; a process outside the session-owned set is refused; a fabricated HWND and missing semantic control are refused; the visible fixture is discovered and inspected; focus is confirmed; bounded scroll is verified; a semantic `InvokePattern` action is verified by a toggle-state postcondition; and the fake password control/value is absent from inspection output.
- The successful invoke receipt preserves the operation/window/control IDs, verifier control ID, expected state, and sanitized pass assertion; it excludes visible text and the fake password value.
- The latest fixture integration took `14,180 ms` end-to-end, including helper startup, identity checks, authority operations, and cleanup. This is one observed test wall time, not a performance benchmark; UIA helper startup is a visible latency cost.
- PowerShell syntax, WPF markup, and fixture AutomationId preflight: `PASS`.
- Post-run process check: no `desktop-uia-fixture.ps1` process remained. UIA integration cleanup reported zero tracked service children.

These checks establish only the specific paths above. UI Automation's semantic `InvokePattern` is not a qualification of raw mouse clicking, and focusing a window is not keyboard-input qualification.

## Process-termination search and classification

The active Desktop Control battery, staged smoke, and stack launcher contain no image-wide, wildcard, `killall`, or `pkill` cleanup. The regression test scans those three files and passes.

- Historical battery rows and older audit text still describe the removed `/IM notepad.exe` defect. They are preserved as historical evidence; the current battery source no longer contains that command.
- `tests/unit/test-desktop-process-identity.mjs` contains forbidden selector text only inside a static regression expression; it does not execute it.
- `tests/helpers/supervised-stack.mjs` and several general application/test launchers use `/PID <retained-root-pid> /T` fallbacks. These are exact-root-PID tree operations, not image-wide or wildcard selectors. They are outside this Desktop Control cleanup patch and their descendant-ownership semantics remain a separate owner review; this qualification does not rely on them.
- `scripts/local-inference-gate.mjs` has model-process discovery/filter logic followed by PID-directed cleanup. It is outside the Desktop Control/test fixture surface and was not modified or relied upon.
- `scripts/desktop-lifecycle-smoke.ps1` uses `System.Diagnostics.Process` instances returned by its own `Start-Process` calls. It was not run because its install/uninstall probes mutate host installation state.

## Not qualified / not run

| Capability | State | Boundary |
|---|---|---|
| Window discovery / ownership | Qualified in session-launched process scope | No general operator-approved or pre-existing Covert-window ownership lease |
| Focus | Qualified for owned fixture HWND | Foreground state is verified |
| Click | Partial | Semantic `InvokePattern` only; no pixel-coordinate click |
| Scroll | Qualified for fixture `ScrollPattern` | No broad application battery |
| Text / keyboard entry | Blocked | No secret-safe Authority-bound transient input channel; no synthetic typing |
| Screenshots | Not implemented | No target-window capture, sensitivity policy, or evidence-storage contract |
| File picker | Not implemented | No root-bound selection adapter/postcondition |
| Drag/drop / clipboard | Not qualified | No supported adapter tested |
| Terminal GUI | Not run | No command-entry capability in this adapter |
| Browser GUI / Covert GUI | Not run | Playwright is a distinct browser tool; it does not prove desktop control |
| Dialog / crash / moved-window recovery | Not run | No corresponding recovery contract/test |
| Resource impact | Not measured | No full mission was run |

No operator files were modified; no foreign process was terminated; no public or external write was performed.

## Required handoffs

### Authority — safe text entry

- **Owner:** Authority and desktop action/evidence owners.
- **Current state:** Desktop actions are Authority-bound and their request body is part of durable approval/evidence flow. UIA deliberately rejects arbitrary text and has no input-value parameter.
- **Gap:** A transient, approved input path that can handle sensitive values without serializing them into approval labels, logs, trajectories, or public evidence.
- **Why needed:** Text entry is required for ordinary GUI forms and terminal/browser workflows; raw values can include credentials.
- **Expected interface:** A short-lived opaque input reference bound to an approved target process/window/control, with sensitivity classification and an audit receipt that records metadata/hash rather than the value.
- **Acceptance:** A fake secret can be entered into an approved fixture field; wrong-window/focus change causes zero input; no fixture secret appears in authority records, logs, trajectories, or evidence; the postcondition is independently verified.

### Evidence/UIA owner — screenshots

- **Owner:** Desktop Control and evidence-storage owners.
- **Current state:** UIA returns safe control metadata only; there is no screenshot operation.
- **Gap:** Window-scoped capture, sensitivity handling, approved-root storage, and evidence-reference provenance.
- **Why needed:** Desktop tasks need visual state evidence where semantic UIA state is insufficient.
- **Expected interface:** Capture only an authorized owned/leased HWND, save under an approved evidence root, return a content hash and attempt/window/time metadata, and support redaction or refusal for sensitive surfaces.
- **Acceptance:** A disposable fixture capture is readable and bound to the correct HWND; an unrelated window is absent; secret fixture content is redacted or capture is refused; no image is written outside the approved root.

### Desktop Control / Authority owner — external-window lease

- **Owner:** Desktop Control with Authority ownership input.
- **Current state:** UIA targets only a live process launched and retained by this Desktop Control session.
- **Gap:** Canonical ownership leases for Covert-owned, attempt-owned, and explicitly operator-approved windows; foreign and unknown windows must remain non-destructive.
- **Why needed:** Covert UI, existing Terminal, Edge chrome, and native file dialogs are not generally children launched by this service.
- **Expected interface:** A time-bounded window lease binding HWND to process identity, owner class, allowed operations, and Authority reference.
- **Acceptance:** Leased target is operable within scope; foreign/unknown target is denied; PID reuse, reparenting, HWND reuse, and focus changes fail closed.

### Desktop Control owner — file picker and recovery battery

- **Owner:** Desktop Control.
- **Current state:** No file-picker selection, drag/drop, keyboard-input, or unexpected-dialog action exists.
- **Gap:** A root-constrained dialog adapter and bounded reacquire/timeout/crash behavior.
- **Why needed:** File selection and modal recovery are common GUI-only workflows.
- **Expected interface:** Semantic UIA targeting restricted to the granted fixture root, exact selected-file identity, explicit dialog state, bounded wait, and no blind replay.
- **Acceptance:** Select only an approved fixture file and verify the receiving application; outside-root selection, unexpected dialog, stale HWND, app crash, and timeout all stop without unsafe action.

## Desktop Control Settings handoff

Settings may project the existing grant and qualification state; it must not create another permission engine. Suggested read-only/current contract:

```text
enabled: derived from the current Desktop Control grant/session
permission: existing Authority decision only
allowed applications: current grant manifest
file picker root: grant roots (selection remains unsupported)
screenshots: NOT IMPLEMENTED
clipboard: NOT QUALIFIED
qualification: PARTIAL; not valid as blanket desktop-control qualification
last qualified: 2026-09-25, Windows UIA fixture pilot
```

Acceptance for the UI handoff: configured grants are distinguishable from verified capability; unavailable features say so; no UI setting can bypass Authority; session expiry/panic is reflected from Desktop Control state.

## Verdict

**DESKTOP CONTROL V1 BLOCKED — safe text/keyboard input, screenshots, file-picker selection, approved-window ownership, and broader recovery workflows are not implemented or qualified.** The bounded Windows UIA pilot is usable evidence and may be extended after the listed contracts are supplied. No claim of general desktop control or production qualification is supported.
