---
name: failure-skill-root-relative-lookup
description: Prevents reading globally installed skills through a repository-relative path.
---

# Skill Root Lookup

## Trigger

A skill read fails because its global `r0`/`r1` path was treated as relative to a project worktree.

## Recovery

1. Stop after the failed read; do not retry the same relative path.
2. Resolve the skill's declared root from the session skill-root mapping.
3. Read the skill from its absolute mapped path.
4. Use worktree-relative paths only for skills that were explicitly created in that worktree.
5. Confirm the active worktree before any later repository edit.

## Guardrails

- A failed read is non-mutating unless tool output proves otherwise.
- Do not copy global skills into a worktree merely to make their paths appear local.
