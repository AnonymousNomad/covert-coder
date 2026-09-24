---
name: failure-rg-windows-wildcard-argument
description: Recover when ripgrep treats a PowerShell wildcard path as a literal invalid path.
---

# ripgrep wildcard path on Windows

1. Stop after the invalid-path diagnostic; do not repeat the same argument.
2. Confirm the target directory exists with a read-only directory listing.
3. Pass the directory to `rg` and use `-g` for the filename filter instead of a shell-expanded wildcard path.
4. Inspect the complete matching output before editing documentation.
