# Desktop Control V1 — Closure Wave 2

Date: 2026-09-25

Starting checkpoint: `0169ade31814e9b25ff233724328a79a10c2798c`

Branch: `feat/covert-desktop-control-v1`

## Verdict

**DESKTOP CONTROL V1 BLOCKED.** The safe UI Automation foundation has fixture evidence for bounded text/key input, revalidated coordinate click, leased-window screenshot, and wrong-window refusal. It does not yet complete the canonical GUI mission. The production adapter still returns `UIA_FILE_PICKER_CONTROL_UNAVAILABLE` because it requires a unique writable `ValuePattern`. A fixture-only investigation has since identified and exercised a deterministic focused-Edit path in two Windows common-dialog callers; production behavior is unchanged. Out-of-root selection remains refused before UIA dispatch.

Additional required surfaces remain not qualified: Terminal GUI, browser GUI, Covert UI, successful file-picker selection, modal handling, clipboard, Save As, broad recovery, and resource impact. This is a qualification gap, not evidence that those capabilities work. Desktop Commander, if available in Codex, is a separate development-machine tool and is not Covert Desktop Control evidence.

## Development tool exposure context

- Railway, Vercel, and GitHub: **EXPOSED + CALLABLE**, **LIVE_READ_VERIFIED**.
- Floot: **EXPOSED**, **CONFIGURED**, **NOT CONNECTED**.
- PostHog, Canva, Metricool, and Base44: **NOT EXPOSED IN THIS CODEX TASK**. ChatGPT-side plugin availability is not Codex-task exposure evidence.
- **CODEX OPTIONAL MCP ISSUE: DESKTOP COMMANDER SESSION EXPOSURE UNRESOLVED.** The MCP server is configured and its dependency cache was repaired, but the current task exposes no callable Desktop Commander tool. This is development tooling only, not a Covert product dependency or qualification result; it is not being reinstalled during this wave.

## Qualified fixture evidence

- The existing desktop battery remains **10/10 PASS**.
- UIA unit and process-identity tests: **7/7 PASS**. Same-executable foreign process survived; only the retained owned process was cleaned up.
- Owned-window integration: **1/1 PASS**, including plain non-secret input, Enter/Escape/Tab/Backspace/Delete, Ctrl+A replacement, postcondition hashes, and fake-password control refusal.
- Wrong-window integration: **1/1 PASS**. Focus was stolen after target focus; the input was blocked as `UIA_FOCUS_LOST`, and both target and distractor fields were verified empty.
- Screenshot/picker integration: **1/1 PASS**. A 520×560 password-free fixture window was captured through the leased HWND; PNG signature, dimensions, hash, action/attempt/process/window provenance were verified. A second capture against a window containing a password descendant was refused. The production picker action remains fail-closed; a separate fixture-only probe below exercises the newly identified native input path.
- Panic/ownership integration: **5/5 PASS**. Desktop policy/agent integration: **22/22 PASS**.
- The canonical safe screenshot and receipt are preserved in this directory. The screenshot contains only the disposable fixture window; it is not proof of a file selection or an end-to-end mission.

## Boundaries and limitations

- Window leases bind session, process identity, HWND, UIA runtime ID, and class; identity and focus are revalidated. Unexpected window recreation and the complete moved/resized-window recovery matrix remain untested.
- Click is a bounded center-point click derived from the unique UIA element bounds, after foreground, occlusion, and ownership checks. General pointer movement, double-click, right-click, and arbitrary visual targeting are not qualified.
- Screenshot is leased-window-only. UIA password descendants are excluded, but general sensitive-content recognition/redaction and full-desktop/region capture are not qualified.
- Plain text is fixture-only. Resolved secret input through an opaque credential reference is not implemented; no Authority semantics were changed.
- Clipboard, drag/drop, Save As, modal recovery, external application authorization, and the canonical multi-app mission are not qualified.
- CPU/RAM/process overhead was not measured for a canonical mission.

## Verification environment

- `npm ci --offline --ignore-scripts --no-audit --no-fund`: completed from the existing lockfile; no lockfile change.
- `npm run check:arch`: **648 tests total; 640 passed, 0 failed, 8 skipped** because GGUF fixtures were absent. TypeScript checks passed; ESLint reported 0 errors and 60 existing warnings.
- `npm run build:frontend`: PASS; existing bundle-size warning only.
- Targeted suites: desktop battery 10/10; UIA + process identity 7/7; owned window 1/1; capture/picker fail-closed 1/1; wrong window 1/1; panic/ownership 5/5; policy/agent 22/22.
- Final sequential regression rerun: **15/15 PASS** across UIA/process-identity units and owned-window, capture/picker, wrong-window, and panic/ownership integrations. The Desktop Battery rerun: **10/10 PASS**.
- Final `git diff --check`, public-artifact JSON parsing, Passport sidecar hash comparison, and secret/absolute-path scan: PASS. No Desktop UIA fixture or battery worker process remained.

## UI handoff

`DESKTOP-CONTROL-UI-HANDOFF-V1.schema.json` defines a read-only projection for the future Settings/Signature Workstation. `DESKTOP-CONTROL-UI-HANDOFF-V1.example.json` shows the current truthful state: inactive, qualification blocked, no approved target. This contract does not implement UI, grant permissions, infer activity, or own qualification.

## Next acceptance work

1. Implement a provider-supported, unambiguous filename control binding for the native picker; retest exact in-root selection and out-of-root refusal.
2. Qualify Terminal GUI, a local browser GUI-only surface, and Covert UI in separate owned windows.
3. Complete modal, target-loss/recreation, timeout, panic-during-action, and no-replay recovery cases.
4. Measure CPU/RAM and orphan process count during a canonical mission.
5. Reissue the Passport only after those gates pass; drag/drop may remain explicitly not qualified if not required by the canonical mission.

## Follow-up provider probe — 2026-09-25

- At checkpoint `6818db6d7530045eb352fb3378fe7d0fc30818ff`, the capture/picker integration exercised both the default WPF `Microsoft.Win32.OpenFileDialog` and a WinForms `OpenFileDialog` with `AutoUpgradeEnabled = false`.
- Both providers exposed three `AutomationId=1148` candidates as enabled `ControlType.Pane` elements without `ValuePattern`. The other writable edits were two `System.ItemNameDisplay` children of list items and the `SearchEditBox`; none was a uniquely identified filename field. No candidate was used for filename input, no Open action was dispatched, and no file was selected.
- The bounded out-of-root request remained refused as `PATH_NOT_GRANTED` before UIA dispatch. The fixture process cleanup assertion passed.
- `tests/integration/test-desktop-uia-capture-picker.mjs`: **1/1 PASS**. Its safe structural diagnostics omit labels, paths, and field values. Structured result: `file-picker-provider-probe.json`.
- At that point no candidate was used for filename input, no Open action was dispatched, and no file was selected. The provider binding remained unqualified and the Passport was not reissued.

## Native picker tree and fixture-only entry probe — 2026-09-25

- Deep RawView and ControlView captures now include the full descendant and parent chains, sibling context, pattern availability, focused element, dialog ownership, native class/handle, bounds, and focus flags. The isolated snapshots are `file-picker-accessibility-wpf-isolated.json` and `file-picker-accessibility-winforms-isolated.json`; the earlier unsuffixed captures remain historical runs in which another fixture window was foreground.
- In both the default WPF `Microsoft.Win32.OpenFileDialog` and WinForms `OpenFileDialog` with `AutoUpgradeEnabled = false`, the exact `File name:` label (`AutomationId=1090`) is a dialog sibling of a unique `AutomationId=1148` `ComboBoxEx32`, whose descendants are `ComboBox` then `Edit`. The `Edit` has no ValuePattern, TextPattern, or usable LegacyIAccessible pattern, and reports `IsKeyboardFocusable=false`; with the exact owned dialog isolated, UIA reports that exact nested Edit as focused and the dialog as foreground.
- A fixture-only probe then verified the process and dialog lease, exact nested Edit runtime ID/HWND, focused element, empty starting value, and non-reparse canonical target under the granted root. It sent the full path only after those checks, read the exact path back through a bounded cross-process `WM_GETTEXT` call, revalidated focus and the dialog, resolved the unique owned Open button, dispatched bounded `BM_CLICK`, and observed dialog closure plus the caller's exact path and SHA-256. WPF: **PASS**. WinForms legacy dialog: **PASS**.
- The production adapter was not changed during this exploration. Its existing WPF and WinForms requests still refuse before input with `UIA_FILE_PICKER_CONTROL_UNAVAILABLE`; the fixture-only probe proves an interaction method, not production qualification. The picker result is provider-specific to these two tested variants and is not a claim of universal Windows picker support.
- The bounded out-of-root request remained refused as `PATH_NOT_GRANTED` before UIA dispatch. The caller fixture and helper processes were cleaned up by exact owned PID assertions.
