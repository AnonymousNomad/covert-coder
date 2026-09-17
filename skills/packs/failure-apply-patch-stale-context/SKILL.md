---
name: failure-apply-patch-stale-context
description: Diagnose apply_patch expected-line failures caused by already-applied or changed context. Use before retrying a rejected patch hunk.
---

# Apply Patch Stale Context

## Procedure

1. Stop; do not retry the same patch.
2. Inspect `git diff -- <target>` and the current target lines.
3. Classify each rejected hunk as already applied, independently changed, or genuinely missing.
4. Rebuild the patch using only currently missing hunks and current exact context.
5. Inspect the resulting diff and run the narrow syntax or type test.

## Guardrail

Do not force stale context into success. An expected-line failure is evidence that the planned mutation no longer matches current state.
