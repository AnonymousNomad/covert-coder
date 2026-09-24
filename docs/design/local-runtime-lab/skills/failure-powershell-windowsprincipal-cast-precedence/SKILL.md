---
name: failure-powershell-windowsprincipal-cast-precedence
description: Check Windows elevation by constructing WindowsPrincipal explicitly instead of casting WindowsIdentity around a method call.
---

# WindowsPrincipal elevation check

## Finding

`IsInRole` belongs to `WindowsPrincipal`, not `WindowsIdentity`. A cast adjacent to a static `GetCurrent()` call can bind the method invocation to the identity object and fail.

## Recovery

1. Stop after the method-resolution error; the read-only check has made no system changes.
2. Inspect the actual type and members with `Get-Member`.
3. Create a principal explicitly from the identity, then call `IsInRole` on that principal.
4. Compare the result with the target installer’s own documented elevation guard before starting it.
