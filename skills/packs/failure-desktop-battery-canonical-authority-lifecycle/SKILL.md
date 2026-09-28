---
name: failure-desktop-battery-canonical-authority-lifecycle
description: Repair the Desktop Control battery when direct-service tests omit canonical Authority execution handles or use unsafe image-wide process and Office probes.
---

# Desktop battery requires canonical Authority and owned-process fixtures

## Failure observed

`scripts/desktop-battery.mjs` constructed `createDesktopControl({ workspace })`, then called `setGrants()` and `act()` with only `approved: true`. The service correctly rejected every privileged call with `FORBIDDEN: canonical authority required`. A later evidence assertion also failed because those rejected setup calls never created the state file. A manual `results` array then reported only its one successful sub-check, hiding the nine failing Node tests in the appended Markdown row.

The same battery used `tasklist` plus `taskkill /IM notepad.exe`, which can inspect or terminate an operator-owned process, and a valid Outlook probe that can create a real user draft.

## Required response

1. Keep the service Authority boundary unchanged. Do not add an unauthenticated compatibility path, test-only bypass, universal credential, or blanket auto-approval.
2. Pair a real in-process operator with `createExecutionAuthority`; prepare, approve, and consume each exact `desktop.grants`, `desktop.action`, and `desktop.panic` descriptor through the canonical Authority service API.
3. Use a harmless disposable child such as the current Node executable with a bounded no-op script. Capture the service-owned handle and prove cleanup through the retained ChildProcess result or exact panic outcome. Never enumerate or terminate by process image name.
4. Test expiry with the service's injectable clock; `setGrants()` intentionally stamps its own start time, so a backdated body field is overwritten.
5. Exercise prompt-looking path text with a contained filesystem operation such as `move_file`. Do not call `open_path` in a test when it could invoke a user OS handler.
6. Keep Outlook/Excel COM acceptance out of generic local test runs. Validate malformed input before COM and report live Office integration as untested unless an isolated disposable Office profile is explicitly available.
7. Derive evidence totals from every Node test case, including failures. Never derive a battery pass count only from assertions that reached a manual `record()` call.
8. Run the focused battery, process-leak check, relevant type/lint checks, then the full verification command. Preserve failed-run evidence and classify every skipped live integration honestly.

## Verification notes

The existing `tests/arch/desktop-policy.test.ts` uses `pairServiceFixture()` and exact `approveAndExecute()` calls as the in-repository direct-service pattern. Reuse that shape in plain JavaScript when the battery cannot import TypeScript fixtures. `node/src/services/owned-process.mjs` retains native ChildProcess handles and exposes lifecycle outcomes; do not replace it with PID or process-name discovery.
