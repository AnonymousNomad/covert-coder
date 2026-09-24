---
name: failure-apply-patch-context-drift
description: Recover when apply_patch rejects an expected source hunk because the supplied context does not match the current file.
---

# apply_patch context drift

## Observed signature

apply_patch reports verification failed and prints an expected context block. The requested patch was not applied.

## Diagnosis

At least one hunk context does not exactly match the current file. The tool can reject a multi-file or multi-hunk patch as a whole, so do not assume earlier hunks were partially applied.

## Procedure

1. Stop after the first rejected patch; do not resend it unchanged.
2. Read-only check worktree status and inspect the named source lines around each failed hunk.
3. Identify whether the mismatch is stale context, a typo in the hunk, or an incorrect target path. Do not guess from the first hunk alone.
4. Apply one minimal hunk at a time using exact current context. Keep independent files in separate patch calls when possible.
5. Read back every changed region and verify the resulting diff.

## Evidence boundary

In the 2026-09-24 runtime-lab session, a multi-file patch intended to add a loaded-model lease field and metrics/resource fields was rejected by context verification. A following status check showed no partial application. The exact mismatched hunk was not uniquely identified from the tool error, so smaller patches are required.
