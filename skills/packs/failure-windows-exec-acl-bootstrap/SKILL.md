---
name: failure-windows-exec-acl-bootstrap
description: Recover safely when the Windows command launcher fails before process start while applying deny-read ACLs.
---

# Windows exec ACL bootstrap failure

## Observed signature

The tool returns Failed to create unified exec process with
helper_unknown_error: apply deny-read ACLs before a command starts.

## Diagnosis

Treat this as a command-launcher or sandbox setup failure. It does not establish
that the requested shell command ran, that the repository caused the problem,
or that its output is empty. The underlying launcher cause may remain unknown.

## Procedure

1. Stop after the first failure. Preserve the complete tool error and the exact
   attempted command.
2. Do not retry the same command blindly or start multiple shell processes in
   parallel while the launcher state is uncertain.
3. Confirm the active permission profile and whether an earlier process is
   still running. Do not bypass sandbox controls with another tool.
4. Once the environment or permission state changes, run one harmless,
   read-only command. If that starts, retry the original read-only operation.
5. If the ACL bootstrap error persists, stop and request the documented
   permission or environment change. Keep repository mutations deferred.
6. Verify the retried command actual output and check that no helper process
   remains.

## Evidence boundary

In the 2026-09-24 runtime-lab session, the error occurred before PowerShell
started; after the user approved inspection and the environment changed to
unrestricted access, a read-only Git history command succeeded. This sequence
does not prove which launcher state caused the ACL failure.
