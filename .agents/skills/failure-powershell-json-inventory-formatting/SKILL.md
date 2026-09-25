---
name: failure-powershell-json-inventory-formatting
description: Keep per-file JSON check inventories readable and trustworthy in PowerShell by avoiding nested arrays in formatted table columns.
---

# PowerShell JSON Inventory Formatting

## Instructions

1. Parse each named JSON file independently and enumerate its properties explicitly.
2. Compute scalar values such as check count, failed property names, and file count before formatting.
3. Join arrays into a single scalar string before using `Format-Table`; do not place raw arrays in table cells.
4. If formatted output shows blank counts or `{1, 1, ...}`, treat that output as unusable and recheck the underlying object before making cleanup decisions.
5. Keep inventory read-only until exact target paths and ownership are verified.

## Guard

Never delete or classify an artifact based on a flattened or ambiguous table rendering.
