---
name: failure-windows-uia-focus-lost-between-actions
description: Diagnose UIA keyboard actions whose separately invoked helper observes focus loss after an earlier focus action appeared to succeed.
---

# Windows UIA Focus Lost Between Actions

## Failure signature

A standalone UIA focus operation verifies a target control, but a subsequent
keyboard action reports `UIA_FOCUS_LOST`. Helper processes and intervening
provider calls mean focus must not be assumed to persist across actions.

## Procedure

1. Stop input immediately when the active window/control fails revalidation.
2. Keep the failure classification; do not relax `GetForegroundWindow` or
   `HasKeyboardFocus` checks.
3. For an authorized input operation, revalidate the leased target, focus the
   intended semantic control within that same bounded action, then verify the
   active window and control focus immediately before sending input.
4. Revalidate again after input and verify an independent postcondition.
5. Add a wrong-window/focus-steal test proving zero input reaches the distractor.
6. Confirm a helper launch or return does not leave an owned window/child behind.

## Safety rule

Never infer focus from a previous action, a matching title, or a successful
focus API return. Validate the exact leased window and focused control at the
point of input.
