---
name: failure-apply-patch-windows-path-separators
description: Avoid patch target and context failures in Windows multi-worktree sessions.
---

# Windows Patch Targeting

## Trigger

`apply_patch` reports a missing hunk even though the exact lines are present in the intended worktree, or a relative path resolves to the primary checkout instead of the task worktree.

## Recovery

1. Stop and inspect the named worktree's exact file and diff with an explicit `workdir`.
2. Confirm `git rev-parse --show-toplevel`, branch, SHA, and status before another write.
3. Use the verified absolute worktree path in the patch header, with forward slashes (`E:/worktree/path/file`). Do not use a relative path when the task worktree differs from the shell's default checkout.
4. Apply one bounded hunk, then immediately inspect the target diff and protected worktree status.
5. If the patch still fails, do not retry unchanged; inspect current lines and select another controlled edit method.

## Verification

Run the narrow syntax or type check for the changed file and `git diff --check` before continuing.
