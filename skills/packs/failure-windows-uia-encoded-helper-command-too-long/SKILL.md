---
name: failure-windows-uia-encoded-helper-command-too-long
description: Diagnose Windows UI Automation helper launches rejected with ENAMETOOLONG because an embedded PowerShell helper and identity payload exceed the CreateProcess command-line limit.
---

# Windows UIA Encoded Helper Command Too Long

## Failure signature

Launching the Windows UIA helper fails with `spawn ENAMETOOLONG` before
PowerShell starts. Measuring the `-EncodedCommand` argument shows it exceeds
the Windows process command-line limit, often because static helper source and
serialized process identity are both embedded in one encoded argument.

## Procedure

1. Stop retrying the same encoded launch. Preserve the error and measure the
   argument length without printing request secrets or unrelated environment.
2. Keep the helper source in a unique, file-backed script under the current
   authorized workspace. Verify the helper directory is workspace-contained
   and is not a symlink.
3. Pass bounded request and process/window identity as a JSON stdin envelope;
   never move those values onto the process command line.
4. Launch PowerShell with `-File` and the unique script path. Retain the exact
   child-process handle and normal timeout/termination ownership.
5. Remove only the exact helper file created for this invocation in a `finally`
   block. Do not recursively remove its parent or touch unrelated files.
6. Test command argument bounds, stdin envelope shape, exact helper cleanup,
   PowerShell syntax, the owned-window integration, and owned-process cleanup.

## Safety rule

Do not work around the Windows limit by splitting untrusted source across
arguments, weakening process ownership, or placing identity/request data in
logs. The file is executable test-owned material; the stdin envelope carries
the per-request data.
