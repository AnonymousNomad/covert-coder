---
name: failure-powershell-join-path-childpath-argument
description: Prevent evidence and recovery commands from failing when Join-Path is called without a child path. Use when PowerShell reports a missing mandatory ChildPath during path construction, copying, or hash reporting.
---

# PowerShell Join-Path ChildPath Argument

## Failure observed

A recovery command successfully wrote its patch, status snapshot, and copied source, then failed in the final hash-reporting expression because it invoked `Join-Path` with only the already-computed destination path. The failure occurred after the preservation actions; it did not roll them back.

## Recovery

1. Stop and inspect which earlier operations completed before rerunning anything.
2. Use `Get-Item -LiteralPath` on the exact expected files to verify the recovery artifacts exist.
3. Calculate a new destination with both arguments, for example `Join-Path $backup 'worktree.patch'`; if the destination variable is already complete, pass it directly to `-LiteralPath`.
4. Recompute hashes only after confirming the exact paths, then record the output.

## Prevention

- `Join-Path` requires a parent `Path` and a `ChildPath`; do not wrap a completed path in another one-argument call.
- Keep path construction separate from `Get-FileHash` arguments so PowerShell parameter binding is easy to inspect.
- After a multi-action command fails, verify side effects individually instead of assuming all or none completed.
