---
name: failure-uia-pointer-target-pattern-mismatch
description: Fix UIA pointer actions that incorrectly demand a state pattern from the clicked control instead of verifying a separate postcondition control.
---

# UIA Pointer Target and Postcondition Patterns

## Failure signature

A bounded pointer click is refused before dispatch because the clicked Button
does not expose `TogglePattern`, even though the operation has a separately
identified state control whose postcondition can prove the result.

## Procedure

1. Preserve the refusal and confirm no pointer event was sent.
2. Keep the click target uniquely identified, enabled, visible, inside the
   leased window, and re-resolved immediately before coordinate calculation.
3. Do not require the clicked target to expose `TogglePattern` unless the
   operation specifically targets a stateful control.
4. Verify the distinct postcondition element through its appropriate pattern
   after the click. A missing or mismatched postcondition remains failure.
5. Revalidate window identity, foreground ownership, and hit-test bounds before
   pointer dispatch; never fall back to stale coordinates.

## Safety rule

UI Automation control patterns describe the capability of each individual
element. A command button may expose `InvokePattern`, while the observable
state change belongs to a separate checkbox/toggle element. Do not conflate
the target's action pattern with the postcondition's state pattern.
