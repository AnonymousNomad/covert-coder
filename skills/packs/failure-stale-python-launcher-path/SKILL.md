---
name: failure-stale-python-launcher-path
description: Handle a Python launcher registration whose reported interpreter path is absent from disk.
---

# Stale Python launcher path

## Observed signature

The Python launcher lists an interpreter path, but invoking that absolute path fails because Windows cannot find the executable.

## Diagnosis

The launcher registry can be stale. A launcher listing is not proof that the reported path currently exists.

## Procedure

1. Stop after the first missing-executable error. Do not retry that path unchanged.
2. Test the exact reported path with Test-Path or Get-Item before choosing an interpreter.
3. Check only other paths reported by the launcher or an already-installed local tool; do not trigger installation or download.
4. Invoke one path that exists and use it only for static parsing unless a separate task explicitly authorizes execution.
5. Record that the missing path was stale and verify no child process remains.

## Evidence boundary

In the 2026-09-24 runtime-lab session, py -0p listed C:\\Python311\\python.exe, but Test-Path returned false. The same check found E:\\Python310\\python.exe and two uv-managed interpreter paths present. This demonstrates a stale registration for the queried 3.11 path; it does not identify why it became stale.
