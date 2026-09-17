---
name: failure-vite-entry-relative-url-assertion
description: Prevent false Vite launch-test failures caused by comparing relative and root-relative HTML entry URLs as raw strings. Use when a dev index serves ./src/main.ts but the test expects /src/main.ts.
---

# Vite Entry Relative URL Assertion

## Root Cause

HTML entry URLs such as `./src/main.ts` and `/src/main.ts` may resolve to the same path at the application root while differing textually.

## Repair

1. Capture the actual `src` attribute.
2. Resolve it with `new URL(src, pageUrl)`.
3. Assert the resolved pathname and the module-script contract.
4. Do not broaden the assertion to any script or suppress the mismatch.
5. Re-run the real Vite launch and verify all test-owned ports close.
