---
name: failure-windows-uia-generic-exception-classification
description: Diagnose Windows UIA actions mapped to a generic failure code without exposing raw PowerShell exception text or application content.
---

# Windows UIA Generic Exception Classification

## Failure signature

A real UIA action returns the generic `UIA_OPERATION_FAILED` code because the
helper intentionally discards an unrecognized PowerShell exception. The
operation fails closed, but the owner cannot distinguish a provider defect
from a fixture/environment issue.

## Procedure

1. Do not retry the UI action before collecting a minimal safe diagnosis.
2. Expose only bounded exception type and PowerShell category metadata; never
   serialize exception messages, control values, paths, or raw UIA output.
3. Preserve generic failure as failure. Do not map unknown exceptions to a
   successful or verified result.
4. Locate the failing provider operation from the test/action identity, inspect
   the corresponding API usage, then fix the cause rather than adding a broad
   catch or suppressing the error.
5. Keep diagnostics out of normal success receipts unless the receipt schema
   explicitly owns a safe failure-class field.
6. Re-run the affected owned-window action, verify the safe error boundary,
   and confirm exact helper/process cleanup.

## Safety rule

PowerShell exception messages may contain visible application data. Safe
classification metadata is sufficient for diagnosis; raw messages are not a
debugging shortcut.
