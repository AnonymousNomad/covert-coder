---
name: failure-windows-uia-malformed-action-output
description: Diagnose Windows UIA helper actions that return output the Node adapter cannot parse as one JSON result, without logging potentially sensitive stdout.
---

# Windows UIA Malformed Action Output

## Failure signature

An owned-window integration reaches a UIA action, but the adapter returns
`UIA_RESULT_INVALID` because PowerShell stdout is not exactly one parseable
JSON result. The failure may be action-specific even when discovery or inspect
operations succeed.

## Procedure

1. Stop repeating the action. Preserve the task/action and exact adapter error.
2. Inspect the generated helper's output-producing commands and PowerShell
   pipelines for incidental success-stream output before the final JSON.
3. Diagnose with non-content metadata only (byte count, line count, safe prefix
   classification, and a digest). Do not log raw UIA stdout or screenshot,
   credential, or control values.
4. Ensure every action returns one explicit result object and that helper
   diagnostics use stderr or a separate sanitized field.
5. Keep malformed output a hard failure; never coerce it to success or scrape a
   guessed JSON fragment from mixed output.
6. Validate the affected real Windows action, existing UIA paths, malformed
   output handling, and exact owned-helper cleanup.

## Safety rule

UIA output can contain visible application data. Preserve only what is needed
to classify and repair the protocol defect; do not make raw output a receipt.
