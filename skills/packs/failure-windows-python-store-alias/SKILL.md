---
name: failure-windows-python-store-alias
description: Recover static Python verification when the Windows python command resolves to a Microsoft Store execution alias.
---

# Windows Python Store alias

## Observed signature

Invoking python exits with the Microsoft Store message that Python was not found. The Python source or lease file was not parsed by that command.

## Diagnosis

The command name resolved to a WindowsApps execution alias rather than an installed interpreter. This does not establish that Python is absent from every isolated environment.

## Procedure

1. Stop after the first failed Python command; do not retry the alias unchanged.
2. Inspect installed launchers with Get-Command and where.exe. Check known project virtual environments without broad system scans.
3. Query the Python launcher for installed runtimes. Do not run a package installer, Store alias, uv-managed download, or network bootstrap to satisfy a static check.
4. If a local interpreter exists, use its absolute path for syntax and JSON parsing only. Do not run the inference harness without a cleared runtime lease.
5. If no interpreter exists, retain the source, mark syntax verification unavailable, and report the exact reason.
6. Confirm the probe process exited and review the worktree diff.

## Evidence boundary

In the 2026-09-24 runtime-lab session, python resolved to a Microsoft Store message. Read-only checks found C:\\Windows\\py.exe, the python3 WindowsApps alias, and uv.exe, but no project-local .venv or venv interpreter. Further verification must first query the launcher and any already-installed local interpreter; no installation is authorized by this procedure.
