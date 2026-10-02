# RESEARCH ANCHORS

These sources support implementation principles. They do not override the owner references.

## VS Code — Custom Layout
https://code.visualstudio.com/docs/configure/custom-layout

Useful principles:
- primary and secondary sidebars;
- bottom/side panel regions;
- drag/drop panel relocation;
- saved layout;
- editor group maximization;
- density options.

Covert should use these principles without copying VS Code's visual identity.

## JetBrains — Arrange Tool Windows
https://www.jetbrains.com/help/idea/manipulating-the-tool-windows.html

Useful principles:
- docked edge tool windows;
- draggable headers;
- persistent custom sizes;
- widescreen side-by-side layouts;
- maximize/restore.

## MDN — prefers-reduced-motion
https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion

Use OS/user preference to reduce or replace non-essential motion.

## W3C — Animation from Interactions
https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions

Non-essential interaction-driven motion should be disableable. Avoid motion patterns that can cause discomfort.

## Microsoft — Windows Performance Counters
https://learn.microsoft.com/en-us/windows/win32/perfctrs/about-performance-counters

Windows performance counters are intended for diagnostic collection and are not designed for >1 Hz collection. Prefer lower-overhead direct APIs where appropriate.

## Research instruction
Before implementing any new library/API:
- verify current documentation;
- record the source;
- preserve Covert's product-truth and performance rules.
