---
name: failure-typescript-compiler-unavailable
description: Recover when a repository typecheck cannot start because TypeScript is not installed in the active worktree.
---

# TypeScript compiler unavailable

1. Stop after the missing-compiler diagnostic; do not let `npx` fetch an implicit package.
2. Confirm the active worktree, package scripts, lockfile, and whether a local or global compiler exists.
3. Do not install or mutate dependency state unless the task explicitly authorizes installation.
4. Use only a compiler already available in the approved environment; otherwise report type verification as blocked.
5. Run the narrowest typecheck after the compiler is available and retain its exact result.
