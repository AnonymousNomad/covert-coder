---
name: failure-uia-missing-lease-validation-order
description: Diagnose UIA requests whose missing session lease is reported as a generic field-shape error. Use when strict request validation runs before the dedicated process/window lease guard.
---

# UIA Missing-Lease Validation Order

## Failure signature

A request for a mutating or observing window action omits lease_id, and the
validator reports only a generic required-field mismatch. This obscures which
ownership boundary was missing and can make tests assert an incidental
diagnostic.

## Procedure

1. Preserve the exact request and error code/message; do not retry with a
   fabricated lease.
2. Confirm the action requires a session-bound window lease and that discover
   is the only lease-free action.
3. Validate the lease field and its binding before generic required-field
   equality checks. Keep unknown-field rejection strict.
4. Keep independent checks for process identity, HWND owner, UIA runtime ID,
   window class, and attempt/session identity.
5. Test missing lease, malformed lease, cross-session lease, stale HWND/runtime
   ID, and a valid discovered lease.
6. Run the pure request tests and the Windows-owned-fixture integration before
   considering the failure resolved.

## Safety rule

Never fix this diagnostic by making lease_id optional for an action or by
accepting a caller-supplied PID/HWND without a lease issued by the current
Desktop Control session.
