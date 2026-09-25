# Desktop Control V1 — Closure Wave 2

Date: 2026-09-25

Starting checkpoint: `0169ade31814e9b25ff233724328a79a10c2798c`

Branch: `feat/covert-desktop-control-v1`

## Verdict

**DESKTOP CONTROL V1 BLOCKED.** The safe UI Automation foundation now has fixture evidence for bounded text/key input, revalidated coordinate click, leased-window screenshot, and wrong-window refusal. It does not yet complete the canonical GUI mission. The actual Windows file picker exposed multiple ambiguous filename panes without a single enabled, writable `ValuePattern` target; the adapter returned `UIA_FILE_PICKER_CONTROL_UNAVAILABLE` before typing or selecting anything. Out-of-root selection was separately refused before UIA dispatch.

Additional required surfaces remain not qualified: Terminal GUI, browser GUI, Covert UI, successful file-picker selection, modal handling, clipboard, Save As, broad recovery, and resource impact. This is a qualification gap, not evidence that those capabilities work. Desktop Commander, if available in Codex, is a separate development-machine tool and is not Covert Desktop Control evidence.

## Qualified fixture evidence

- The existing desktop battery remains **10/10 PASS**.
- UIA unit and process-identity tests: **7/7 PASS**. Same-executable foreign process survived; only the retained owned process was cleaned up.
- Owned-window integration: **1/1 PASS**, including plain non-secret input, Enter/Escape/Tab/Backspace/Delete, Ctrl+A replacement, postcondition hashes, and fake-password control refusal.
- Wrong-window integration: **1/1 PASS**. Focus was stolen after target focus; the input was blocked as `UIA_FOCUS_LOST`, and both target and distractor fields were verified empty.
- Screenshot/picker integration: **1/1 PASS as a fail-closed test**. A 520×560 password-free fixture window was captured through the leased HWND; PNG signature, dimensions, hash, action/attempt/process/window provenance were verified. A second capture against a window containing a password descendant was refused. The actual picker remained unqualified because its candidate filename controls were ambiguous. No fixture file was selected.
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
