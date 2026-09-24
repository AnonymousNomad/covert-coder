---
name: failure-unsloth-installer-elevated-process
description: Prevent Unsloth Studio installs from an elevated Windows token that would leave an inaccessible Administrator-owned runtime root.
---

# Unsloth installer launched elevated

## Finding

The official Windows installer detects an elevated token and warns that the install root becomes Administrator-owned and inaccessible to the normal account. It explicitly directs the operator to stop and restart without elevation. Redirecting the root or changing its ACL does not satisfy that boundary.

## Recovery

1. Stop only the installer process tree that was started for this experiment.
2. Verify the installer and descendants are gone; leave foreign model runtimes untouched.
3. Inspect the new root and global tool state for partial writes; do not delete or overwrite unreviewed contents.
4. Launch a harmless probe through the existing unelevated Explorer session and verify its token before running the installer.
5. If an unelevated launch cannot be established, leave installation blocked and request a normal-user shell.

## Tool boundary

An attempt to launch that probe through `Shell.Application.ShellExecute` was rejected by the execution policy before PowerShell started. Do not try alternate process-launch or token-manipulation routes to bypass that rejection. Resume only from an already non-elevated user shell.
