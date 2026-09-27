---
name: covert-theme-system
description: Covert V1 visual-system skill for Default Covert, Matrix, and Developer themes. Use whenever changing theme tokens, ambient motion, navigation color language, resource instrumentation, or appearance settings. Enforces long-session readability, truthful telemetry, accessibility, reduced-motion control, and one shared semantic token system rather than three forked UIs.
---

# Covert Theme System

## Product contract

Covert ships one shell and one component system with three theme identities:

1. **Default Covert** — tactical dark command center.
2. **Matrix** — unmistakable code-signal environment, not merely a green recolor.
3. **Developer** — restrained graphite/circuit/electrical workstation intended for long coding sessions.

Themes override semantic tokens and presentation only. They do not fork backend state, navigation structure, permissions, model truth, or business logic.

## Accessibility and ergonomics

- Normal text targets WCAG AA contrast (4.5:1); large text targets 3:1.
- Interactive boundaries, focus indicators, status icons, and meaningful graphics target at least 3:1 non-text contrast.
- Keyboard focus must remain visible and must not rely on glow alone.
- Non-essential ambient motion is OFF by default for Matrix.
- Every automatic animation has an operator control and honors `prefers-reduced-motion`.
- Reduced-motion removes motion, not information.
- No flashing, rapid pulses, large-scale zoom/pan, or high-frequency full-screen transitions.
- Ambient graphics remain pointer-inert and `aria-hidden`.

Research basis: W3C WCAG 2.2 non-text contrast/focus guidance, WCAG animation-from-interactions guidance, and MDN reduced-motion implementation guidance.

## Matrix behavior

Matrix is structurally distinct:
- deep black/green surfaces;
- code-rain/signals rather than the Default Covert world-map motif;
- stronger terminal/data-grid character;
- explicit Matrix motion and signal controls.

Matrix motion states:
- **OFF** — default; completely static.
- **ADAPTIVE** — motion responds only to real application state.
- **SLOW** — deliberate low-speed rain.
- **STANDARD** — operator-requested full treatment, still non-flashing.

Adaptive state may use actual panel/verification/runtime state. It must never invent project progress or debugging state that Covert does not own.
Matrix signal palette:
- ADAPTIVE — derived from canonical product state.
- GREEN — canonical Matrix signal.
- CYAN — analysis/inspection.
- AMBER — warning/debug-oriented operator preference.
- MAGENTA — explicit alternate diagnostic accent.

## Developer behavior

Developer is not generic neon cyberpunk. It uses:
- charcoal/graphite surfaces;
- low-saturation cyan for current/active engineering state;
- warm amber for warnings;
- restrained green for verified/success;
- subtle PCB/circuit traces and node points;
- minimal glow, no RGB rainbow treatment;
- stable low-luminance backgrounds for night work.

The motif should suggest instruments, traces, buses, terminals, and electrical signal flow without resembling Matrix rain or a game HUD.

## Navigation color language

Every left-rail destination keeps a distinct accent family. The icon remains visibly illuminated even when inactive; labels stay neutral for readability. Hover, active, and keyboard-focus states strengthen the same destination color instead of changing meaning.
## Resource truth

Resource displays must use canonical hardware data only.

- RAM and VRAM may show percentages only from measured total/free values.
- Storage may show percentages only from measured filesystem total/free values.
- CPU usage must be UNKNOWN/UNAVAILABLE unless a real utilization sample exists; logical-core count is not CPU usage.
- Unsupported data never renders as zero.
- Theme decoration may frame telemetry but may not change its meaning.

## Implementation rules

- Extend the existing preference store; do not create a second appearance store.
- Preserve unknown preference keys during schema evolution.
- Use the existing `covert:appearancechange` event for terminal/editor retheming.
- Keep the renderer browser-only; no Node APIs in browser modules.
- Keep assets local/offline.
- CSS-generated trace patterns are preferred over large raster backgrounds.
- Theme-specific code must remain disposable without affecting runtime capability.

## Verification gate

Before closure:
1. TypeScript and lint pass.
2. Preference persistence and invalid-data recovery tests pass.
3. Each theme switches immediately and survives restart/reload.
4. Matrix defaults static.
5. Matrix OFF/ADAPTIVE/SLOW/STANDARD all behave distinctly.
6. Reduced-motion overrides all optional motion.
7. Navigation icons retain distinct visible colors and keyboard focus.
8. RAM/VRAM/storage values trace to the hardware endpoint.
9. Terminal/editor receive the active theme event.
10. Real rendered screenshots are inspected at desktop and narrow widths.
11. Full frontend production build and affected acceptance tests pass.
