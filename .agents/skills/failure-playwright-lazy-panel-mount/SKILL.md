---
name: failure-playwright-lazy-panel-mount
description: Avoid false browser failures when Covert cockpit surfaces mount only after navigating to their owning panel.
---

# Lazy-mounted cockpit panels

Before asserting a panel-specific DOM node, navigate to that panel through the cockpit rail and wait for the active-panel state. A sibling surface may not exist in the DOM while another panel is active.

When a panel is absent, inspect the active panel and registry mapping before treating it as a product failure. Qualify the panel after navigation, then return to the intended screen before capturing screenshots.
