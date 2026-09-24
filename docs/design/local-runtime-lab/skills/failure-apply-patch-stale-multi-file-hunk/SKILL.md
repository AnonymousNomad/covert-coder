---
name: failure-apply-patch-stale-multi-file-hunk
description: Recover from an apply_patch rejection when one hunk uses context from a different file or section.
---

# Stale multi-file patch hunk

1. Stop after the rejected patch; do not replay the same patch.
2. Inspect the status and diff to confirm whether any hunk applied.
3. Read exact current lines from every target file independently.
4. Rebuild only missing hunks with file-local context.
5. Inspect the resulting diff and run a narrow syntax or type check.
