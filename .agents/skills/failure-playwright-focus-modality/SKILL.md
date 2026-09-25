---
name: failure-playwright-focus-modality
description: Diagnose browser acceptance failures caused by confusing programmatic focus with keyboard-visible focus.
---

# Playwright focus modality

Do not call `element.focus()` and then treat a false `:focus-visible` result as a keyboard-accessibility defect. Programmatic focus does not establish keyboard input modality in browsers.

To qualify keyboard access, drive focus with `page.keyboard.press('Tab')` (or Shift+Tab) through the actual interface, assert the intended control is reached, activate it with Enter or Space, and separately verify the visible focus indicator on that keyboard-focused element. Keep mouse/programmatic focus checks separate.
