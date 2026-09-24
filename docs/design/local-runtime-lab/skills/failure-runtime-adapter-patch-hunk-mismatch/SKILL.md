---
name: failure-runtime-adapter-patch-hunk-mismatch
description: Recover safely from adapter patch context mismatches and missing failure-note directories.
---

# Runtime Adapter Patch Hunk Mismatch

## Findings

A large multi-range patch against `unsloth-runtime-adapter.ts` was rejected because one expected parent-PID line did not match the patch tool context. Inspection confirmed that no hunk had applied and the live source uses separate callback blocks.

A later retry used a worktree-relative path, but this session's `apply_patch` rooted paths at the canonical checkout (`E:\aide-sovereign-workbench`), not the runtime worktree. That attempt also made no changes. When editing this lane, use the absolute target under `E:\aide-sovereign-workbench-runtime-lab`.

A methodology-doc patch also failed because its planned heading (`## Backend bake-off contract`) did not exist; the live heading is `## Historical cross-backend isomorphism gate`. The exact current headings were re-read and the failed multi-hunk patch applied no changes.

The first attempt to save this note failed because the new nested skill directory did not exist. The existing `skills` parent was present; the requested child directory needed explicit creation.

## Recovery

1. Stop and inspect the exact current source and `git diff` before retrying.
2. Split edits into one logical hunk per patch, using absolute paths under the active runtime worktree because `apply_patch` resolves from the canonical checkout here.
3. After each accepted hunk, inspect changed lines before applying dependent hunks.
4. Create a new nested directory before writing a new local failure skill.
5. Run TypeScript syntax checks and `git diff --check`; do not claim tests pass when dependencies are unavailable.
