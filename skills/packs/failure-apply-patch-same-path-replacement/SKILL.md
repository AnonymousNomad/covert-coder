---
name: failure-apply-patch-same-path-replacement
description: Prevent apply_patch transaction failures when replacing an entire file. Use when a patch attempts both Delete File and Add File for the same path.
---

# Apply Patch Same-Path Replacement

## Root Cause

`apply_patch` rejects a single patch that contains both `Delete File` and `Add File` operations for the same path. Patch input also requires the exact final control line `*** End Patch`.

## Safe Repair

1. Confirm the failed patch made no filesystem changes.
2. Prefer one `Update File` hunk when the existing content can be matched safely.
3. For a deliberate full replacement, use two bounded `apply_patch` calls: delete the exact file, then immediately add the same exact path with the replacement content.
4. Do not use shell redirection, `Set-Content`, or a language script to bypass the repository editing rule.
5. End the patch with the exact control line `*** End Patch` and no misspelled heading.
6. After replacement, inspect `git diff -- <path>` and run the relevant syntax check before continuing.
