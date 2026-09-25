---
name: failure-uia-forged-window-preflight-classification
description: Diagnose Desktop Control integration assertions that expect a provider-level HWND ownership error even though a session-issued lease rejects the forged handle before provider dispatch.
---

# UIA Forged-Window Preflight Classification

## Failure signature

A test submits a fabricated window handle with a valid lease for another
window. The Desktop Control boundary returns `UIA_LEASE_INVALID`, while the
test expected a later Windows-provider `UIA_WINDOW_OWNER_MISMATCH`.

## Procedure

1. Preserve the actual refusal code and verify the session lease binds the
   exact process identity, HWND, runtime ID, class, and session.
2. Confirm the refusal occurs before launching the UIA helper/provider call.
3. Keep the earlier lease refusal. Do not weaken validation to let a forged
   handle reach the Windows provider.
4. Update the integration assertion to expect `UIA_LEASE_INVALID` and retain
   evidence that the requested action is refused with a failure receipt.
5. Keep a separate provider-level ownership check for an actually leased
   window whose native HWND owner changes or becomes stale.

## Safety rule

The session lease is the first ownership boundary. A provider-specific HWND
error is not required when the caller's lease does not authorize that HWND.
