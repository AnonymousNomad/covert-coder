---
name: failure-uia-file-picker-control-identity
description: Diagnose UIA file-picker failures caused by assuming standard dialog AutomationIds uniquely identify the filename field or Open button.
---

# UIA File Picker Control Identity

## Failure signature

A leased native file dialog is visible and inspection finds familiar control
IDs, but the provider action cannot resolve exactly one usable filename field
or confirmation button.

## Procedure

1. Preserve the refusal; do not enter a path or activate a button until the
   exact dialog and controls are verified.
2. Record only bounded structural metadata: dialog lease, candidate count,
   control type, enabled/offscreen/password flags, and supported pattern/read-
   only status. Never record labels, filenames, paths, or field values.
3. Scope all lookup to the leased dialog. Treat AutomationId as a hint, not a
   global or version-stable identity; require one eligible control with the
   needed pattern and revalidate the dialog lease immediately before use.
4. Preserve the approved-root check and independently verify the destination
   application's postcondition after the dialog closes.
5. If uniqueness or provider behavior remains uncertain, fail closed and
   classify the dialog as not qualified rather than selecting by coordinates.

## Safety rule

File selection is a bounded filesystem capability. A familiar dialog control
ID does not authorize a path, and a successful dialog close does not prove the
intended application accepted the approved fixture file.
