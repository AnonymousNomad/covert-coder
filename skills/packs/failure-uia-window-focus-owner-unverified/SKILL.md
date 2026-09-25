---
name: failure-uia-window-focus-owner-unverified
description: Diagnose UI Automation window-focus actions where the exact window is foreground but the root focus flag does not establish ownership of the focused UIA element.
---

# UIA Window Focus Owner Unverified

## Failure signature

The leased HWND is still the foreground window after `SetFocus`, but the
window-level `HasKeyboardFocus` flag is false or conflicts with the observed
focused element. This is not evidence that focus is safe, and foreground state
alone is insufficient for keyboard input.

## Procedure

1. Stop input and preserve the failed receipt. Do not retry the focus or send
   keys blindly.
2. Collect only bounded, non-content diagnostics: leased HWND, foreground HWND,
   focused element PID/native HWND, focus flags, and whether the focused UIA
   element's parent chain reaches the leased window runtime identity.
3. Use a bounded UIA tree walk and revalidate the leased process/window after
   traversal because UIA trees can change while being inspected.
4. Keep the input gate strict: keyboard input requires the exact target window
   foreground and the requested semantic control focused immediately before
   dispatch, followed by an independent postcondition.
5. If focused-element ancestry cannot be proven, fail closed as focus lost.
   Never substitute same-process, same-executable, title, or foreground-only
   evidence for the window lease.
6. Keep diagnostics free of control text, prompts, typed values, and secrets.

## Safety rule

`AutomationElement.SetFocus()` is provider-dependent and does not itself prove
that the target is foreground. Treat method return as an action attempt, not
verification. A successful window-focus receipt requires the leased window and
focused UIA element to be tied together by observable identity; a specific
input action must additionally prove focus on its requested control.
