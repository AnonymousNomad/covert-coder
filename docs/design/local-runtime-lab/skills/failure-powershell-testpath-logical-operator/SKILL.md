---
name: failure-powershell-testpath-logical-operator
description: Avoid combining repeated Test-Path invocations into a single unparenthesized PowerShell condition.
---

# Test-Path logical condition parsing

## Finding

The expression `if (Test-Path -LiteralPath $a -or Test-Path -LiteralPath $b)` can be parsed as one cmdlet invocation with repeated parameter binding and fail before the guarded action runs.

## Recovery

1. Stop after the binding error and verify that no guarded mutation or child process started.
2. Inspect `Test-Path` parameter metadata and the referenced paths independently.
3. Parenthesize each command invocation: `if ((Test-Path -LiteralPath $a) -or (Test-Path -LiteralPath $b))`.
4. Re-run the read-only preflight once before the dependent action.
