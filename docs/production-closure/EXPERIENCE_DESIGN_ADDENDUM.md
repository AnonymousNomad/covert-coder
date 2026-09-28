# Covert Experience Design and Anti-Generic-Web Addendum

Version 1.0
Date: 2026-09-27

## Status

This addendum extends the existing Covert production and product-operations directives.

It does not replace:
- architecture authority;
- production closure;
- product operations;
- release gates;
- evidence doctrine.

Visual work remains subordinate to product correctness.

---

# 1. Design objective

Every Covert public surface and major product surface must appear intentionally designed for Covert.

The design must not look as though a model was asked:

"Make me a modern AI SaaS website."

Visual distinctiveness must derive from:
- Covert's architecture;
- operator-control philosophy;
- real workflow;
- actual data/state;
- real product artifacts.

Do not invent decorative futurism unrelated to the product.

---

# 2. Anti-pattern gate

Before accepting a website/page, audit for generic AI/SaaS composition.

Flag combinations of:

- centered giant hero;
- purple/blue gradient glow;
- generic gradient text;
- glass cards;
- excessive border-radius;
- bento-grid-by-default;
- three-column feature grid;
- generic line icons;
- random floating UI cards;
- generic dashboard mockup;
- meaningless particle background;
- generic abstract neural imagery;
- repeated fade-up reveals;
- soft-shadow-on-everything;
- Inter/Roboto plus default component-library styling;
- stock testimonials;
- fake customer logos;
- vague AI copy.

A pattern is allowed only if it is the best solution for the page and has been intentionally selected.

No page may pass review merely because it looks "polished."

---

# 3. Authorship test

A reviewer should be able to answer:

"Why is this page designed this way for Covert specifically?"

Acceptable answers reference:
- execution;
- routing;
- authority;
- models;
- context;
- evidence;
- telemetry;
- local operation;
- workflow;
- developer interaction.

If the design could be relabeled for an unrelated SaaS product without changing its visual logic, redesign it.

---

# 4. One memorable mechanism per surface

Each major surface may have one dominant experiential idea.

Examples:

Homepage:
- interactive Covert system field.

Evidence Lab:
- execution traces resolving into evidence.

Ghost Code:
- code graph dissolving/revealing unreachable or suspect regions.

Architecture:
- interactive layered system map.

Model section:
- model constellation/router responding to user input.

Do not stack every effect on every page.

---

# 5. State-driven interaction

Prefer animations driven by real state.

Examples:
- execution path illuminates from actual trace data;
- resource gauges use actual telemetry;
- benchmark animation uses real recorded runs;
- model routing visualization uses actual model metadata;
- Ghost Code visualization uses real analysis output.

Never fabricate telemetry for presentation.

When using prerecorded data, label it as a recorded demonstration.

---

# 6. Interactive theme architecture

All themes must share one behavioral contract.

Theme may control:
- semantic color tokens;
- materials;
- typography;
- motion profile;
- particles/shaders;
- ambient effects;
- component appearance;
- optional sound;
- Resident appearance;
- terminal decoration.

Theme may not change:
- command meaning;
- authority behavior;
- data truth;
- keyboard behavior;
- accessibility semantics;
- error severity;
- workflow semantics.

Required experience modes:
- Minimal
- Balanced
- Immersive

Required controls:
- reduced motion;
- ambient animation off;
- reactive effects off;
- optional sound off;
- high-information HUD toggle where relevant.

---

# 7. Visual-system construction

Do not design each page independently.

Establish:

## Foundations
- typography;
- semantic color;
- spacing;
- geometry;
- border policy;
- iconography;
- motion;
- materials;
- data visualization.

## Components
- navigation;
- terminal;
- command palette;
- Resident;
- telemetry gauge;
- evidence card;
- benchmark table;
- model card;
- workflow node;
- authority state;
- code viewer;
- architecture node;
- CTA.

## Experience primitives
- flow trace;
- particle field;
- liquid/refraction;
- scan/reveal;
- graph activation;
- system pulse;
- status transition.

All primitives must have:
- purpose;
- full-motion form;
- reduced-motion form;
- mobile behavior;
- performance fallback.

---

# 8. Research-before-design workflow

For every major new public surface:

1. define the communication goal;
2. identify audience;
3. research current category conventions;
4. identify category clichés;
5. collect 3-7 mechanism references;
6. state explicitly what will not be copied;
7. create two or more different composition directions;
8. evaluate against Covert identity;
9. prototype the chosen interaction;
10. performance-test;
11. accessibility-test;
12. browser-test;
13. implement;
14. visual-regression-test;
15. verify copy against product evidence.

Do not jump directly from prompt to production page.

---

# 9. Plugin/tool responsibilities

## Figma
Use for:
- design system;
- variables/tokens;
- component variants;
- layouts;
- motion planning;
- interaction prototypes;
- responsive states;
- handoff.

## Vercel
Use for:
- coded site;
- preview deployments;
- browser verification;
- performance/observability;
- production deployment;
- server/AI support features.

## Three.js / R3F
Use when real-time graphics are justified.

Examples:
- architecture field;
- particles;
- 3D data/state;
- shader materials;
- depth-based storytelling.

Do not use for ordinary card animation.

## GSAP / ScrollTrigger
Use for:
- choreographed scroll storytelling;
- pinned sequences;
- timeline-controlled transitions;
- precise motion synchronization.

Do not animate every section merely because ScrollTrigger exists.

## Canva
Use for:
- downstream social graphics;
- announcement assets;
- decks;
- brand derivatives.

Do not use as source of site layout truth.

## Runway
Use for:
- launch films;
- short feature explainers;
- motion assets;
- recorded demonstration enhancement.

Never use generated video to represent a product capability that did not actually run.

## PostHog
Use to determine:
- whether users engage with immersive sections;
- whether motion hurts conversion;
- where users abandon;
- whether demos lead to GitHub/download;
- whether interactive elements are useful.

## Browser/QA tooling
Use for:
- visual regression;
- console errors;
- interaction checks;
- responsive states;
- reduced-motion verification;
- performance checks.

---

# 10. Accessibility and motion gate

Mandatory:
- keyboard navigation;
- semantic HTML;
- visible focus;
- contrast;
- readable copy;
- reduced motion;
- pause/stop controls where required;
- non-canvas access to meaningful content.

`prefers-reduced-motion` must be honored.

For immersive experiences also provide an explicit motion/performance control where practical.

Reduced-motion mode must remain a complete product experience, not a broken version.

---

# 11. Performance gate

For any WebGL/3D/particle feature record:
- bundle impact;
- asset weight;
- texture sizes;
- initial render cost;
- mobile FPS or representative performance;
- CPU/GPU behavior;
- fallback;
- idle-loop behavior;
- reduced-motion behavior.

Prefer progressive enhancement.

A static/2D fallback must preserve the message.

---

# 12. Professionalism gate

Distinctive does not mean chaotic.

Reject:
- illegible type;
- mystery navigation;
- excessive cursor hijacking;
- scroll locking without purpose;
- intro animations that block content;
- autoplay audio;
- effects obscuring text;
- low-contrast cyberpunk visuals;
- fake terminals;
- random hacker imagery;
- overuse of glitch.

A visitor evaluating the developer should see:
- restraint;
- technical competence;
- hierarchy;
- design reasoning;
- performance discipline;
- evidence.

---

# 13. Covert public identity direction

Desired vocabulary:
- command center;
- instrument;
- trace;
- authority;
- field;
- system;
- routing;
- telemetry;
- signal;
- evidence;
- controlled energy;
- local machine;
- engineered depth.

Avoid default vocabulary:
- magic;
- effortless;
- revolutionary;
- game-changing;
- futuristic AI;
- neural glow;
- generic cyberpunk.

---

# 14. Acceptance questions

A public surface is not accepted until reviewers can answer yes:

1. Is the product understandable quickly?
2. Is there a memorable mechanism?
3. Is that mechanism related to Covert?
4. Does the page avoid generic AI composition?
5. Is real product proof visible?
6. Is the design responsive?
7. Is reduced motion complete?
8. Is performance acceptable?
9. Is all meaningful content accessible without WebGL?
10. Are all claims evidence-backed?
11. Does the page look authored rather than generated?
12. Would a technically literate visitor consider it deliberate and credible?

---

# 15. Immediate implementation rule

Do not redesign Covert's entire website while production closure is still active.

First:
- establish design system;
- establish anti-pattern checklist;
- prototype one hero/experience mechanism;
- prototype one Evidence Lab interaction;
- validate performance/accessibility;
- then expand.

One excellent interactive system is more valuable than ten mediocre visual effects.
