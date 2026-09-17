---
name: failure-playwright-managed-browser-absent
description: Recover Playwright acceptance when its managed Chromium executable is absent but a local Edge or Chrome channel is installed. Use on browserType.launch executable-does-not-exist errors without downloading software.
---

# Playwright Managed Browser Absent

## Procedure

1. Stop after the first launch failure; classify unrun tests separately from failed tests.
2. Verify Playwright-owned web servers and ports exited.
3. Locate an already-installed browser using `Get-Command` and standard installation paths.
4. If the project exposes a channel selector, rerun with that explicit channel (for example `AIDE_PLAYWRIGHT_CHANNEL=msedge`).
5. Do not run `playwright install` when offline or no-download policy applies.
6. Report the original run as browser-unavailable and the channel run as the actual browser evidence.
7. Verify test-owned ports and browser processes are cleaned after the rerun.

## Evidence Rule

An absent browser means acceptance was not executed. It is never a product pass or product failure until a supported local browser actually runs the tests.
