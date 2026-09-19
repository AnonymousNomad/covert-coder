# Covert cockpit production surface

Baseline: `70bc46ae0a6b71afcb829f6d95a6e706f49fcd75`.

## Visual system

The approved reference establishes a cool, dense command center. Near-black
surfaces give the engineering workspace priority; cyan marks navigation and
focus, purple identifies Resident, and green is reserved for supported positive
state. Borders separate surfaces; light is concentrated at active edges.

- Typography: system sans for readable content, locally bundled Cascadia Mono
  for code and technical metadata. Product identity uses letter spacing, not a
  downloaded display font. Body 13px, secondary 12px, metadata 11px, titles 20px.
- Spacing: 4px base; 4/8/12/16/24/32px scale. Dense controls retain practical
  keyboard and pointer targets.
- Materials: opaque near-black foundation, slightly raised navy surfaces,
  one-pixel separators, restrained active-edge shadows. No moving backdrop.
- Navigation: 12 destinations; selected state includes shape, text, and color.
- Resident: one dominant center surface, explicit conversation/task distinction,
  compact context disclosure, governed task composer. No fabricated portrait.
- Intelligence: model state, measured resources, and recorded activity retain
  separate provenance and unavailable states.
- Console: compact lower region with real workspace, task, and diagnostics data;
  collapse restores space for engineering work.
- Motion: brief entry/state transitions, no perpetual decorative animation;
  reduced-motion disables transitions.
- Responsive: full desktop composition, compact laptop rail, narrow-screen
  intelligence drawer and accessible navigation. No off-screen controls.

## Authority and operating modes

Resident retains `data-authority="none"`. A quick action prepares a task for
operator review; it does not grant authority. UI state never substitutes for
runtime evidence, Veritas, or Execution Authority.

Harness Modes mean one canonical Covert Harness with domain-specific workflows,
tools, SOPs, constraints, verification rules, model roles, and UI emphasis.
Appearance selection is not an operating mode. A mode switch may be advertised
as executable only when a backend contract reports and applies that mode.
Absent that contract, documentation describes the intended architecture and
the UI identifies the capability as unavailable.

## Acceptance evidence

Baseline and final browser captures must come from the real local stack.
Fixture-based tests cover controlled states but are not public product captures.
Validation results, control dispositions, screenshot paths and boundaries are
recorded in [the review report](final-cockpit-report.md). This document is a
design contract, not a claim that every product capability is production-ready.
