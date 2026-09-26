---
name: failure-worktree-dependencies-not-installed
description: Recover a locked Node worktree whose verification commands cannot resolve declared packages.
---

# Isolated Worktree Dependencies Missing

## Trigger

A repository script fails before source execution with `ERR_MODULE_NOT_FOUND`, and the named worktree has a committed lockfile but no local `node_modules`.

## Recovery

1. Stop the failed gate; record the exact error, worktree root, branch, SHA, Node version, and npm version.
2. Confirm `package.json` declares the missing dependency and `package-lock.json` is present and tracked. Check that no other package manager lockfile owns the install.
3. Do not use global packages or a neighboring worktree's `node_modules` as proof.
4. If dependency installation is authorized, run `npm ci` in the exact worktree. Do not edit `package.json` or the lockfile to solve a missing installation.
5. Verify the required package resolves, the lockfile hash is unchanged, and install processes have exited.
6. Rerun the original gate, then the narrow tests that depend on the installed tree.

## Guardrails

- Do not run `npm install` for a locked repository; it may rewrite dependency resolution.
- Do not repeat the original gate before installing the declared lockfile dependencies.
- Do not report package installation as source or product qualification.
