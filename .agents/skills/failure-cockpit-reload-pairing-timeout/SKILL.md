---
name: failure-cockpit-reload-pairing-timeout
description: Diagnose a cockpit acceptance timeout waiting for the local pairing form after a full page reload without weakening pairing or readiness checks.
---

# Cockpit Pairing UI After Reload

## Instructions

1. Preserve the failing assertion and the configured timeout. `waitUntil: 'commit'` means the navigation response committed; it does not mean the TypeScript module mounted its DOM.
2. Confirm `initializeAuthority()` is still the startup gate and inspect its memory-only credential contract. Do not persist, bypass, or synthesize authority to make browser automation pass.
3. Add sanitized `#app` state diagnostics only on failure: pairing-input presence, editor-ready state, and a short non-secret status-text excerpt. Do not log entered pairing proof or returned tokens.
4. Inspect page errors and failed requests before changing product startup code. A single timeout followed by a pass is a transient observation, not proof of a product defect; record both outcomes and keep the original assertions.
5. Verify the final run without timing instrumentation on the success path, then confirm all test-owned browser/server processes are gone.

## Guard

Never weaken pairing, Authority, or startup-readiness semantics to satisfy the browser test.
