# Covert Web Experience Research Baseline

Version 1.0
Date: 2026-09-27

## Objective

Define a public-web and product-experience language for Covert that is recognizably authored, technically credible, immersive, and distinct from generic AI-generated SaaS websites.

The target is not novelty for novelty's sake.

The target is:

- memorable;
- professional;
- technically expressive;
- product-specific;
- evidence-led;
- performant;
- accessible;
- maintainable.

---

## Current generic AI/SaaS fingerprint to avoid

Recent design commentary consistently identifies a recognizable default pattern in AI-generated and AI-startup websites:

- enormous centered hero headline;
- vague one-line promise;
- purple-to-blue gradient glow;
- dark navy or white background;
- glassmorphism;
- excessive rounded rectangles;
- repeated card components;
- bento-grid feature sections;
- three equal feature columns;
- generic line icons;
- floating dashboard screenshot;
- blurred blobs;
- soft drop shadows;
- generic sans typography;
- "trusted by" logo rows without meaningful context;
- stock AI/neural imagery;
- repeated fade-up scroll reveals;
- generic phrases such as:
  - "supercharge";
  - "reimagine";
  - "transform your workflow";
  - "AI-powered";
  - "the future of...";
- social proof presented as boilerplate instead of evidence.

These patterns are not individually forbidden. The problem is default composition: when several appear together without product-specific reasoning, the page looks generated rather than designed.

---

## Reference directions worth studying

These are mechanism references, not templates to imitate.

### Bruno Simon

Useful lesson:
- the interaction itself communicates the creator's capability;
- navigation becomes an experience;
- the mechanic is immediately understandable;
- technical complexity is hidden behind simple interaction.

Do not copy the toy-car concept.

### Active Theory

Useful lesson:
- atmosphere can be created using real-time particles, fluid motion, depth, shaders, and restrained UI;
- motion can establish identity before text does;
- visual complexity can coexist with sparse interface elements.

Do not copy any specific visual composition.

### Lusion

Useful lesson:
- clean typography and strong grid discipline can coexist with real-time 3D;
- interactive objects can be the hero instead of a screenshot;
- the page can feel experimental without losing legibility.

### Recent award-level WebGL work

Common characteristics:
- WebGL/Three.js/WebGPU is used as narrative infrastructure, not a spinning-object gimmick;
- scroll and pointer input alter the experience meaningfully;
- strong art direction is paired with engineering discipline;
- performance is treated as part of design.

---

## Covert design thesis

The public experience should feel like entering the outer layer of the Covert system.

It should communicate:

- sovereignty;
- operator control;
- model plurality;
- observability;
- execution authority;
- systems engineering;
- evidence;
- controlled power.

It should not communicate:
- generic futurism;
- cryptocurrency aesthetics;
- gaming UI pasted onto a software site;
- anonymous cyberpunk;
- "AI magic";
- fake terminal theater.

---

## Preferred design mechanisms

Possible mechanisms:

- real-time telemetry-derived motion;
- particle fields representing context/model/workflow activity;
- flowing traces representing request routing;
- shader transitions between architecture layers;
- controlled fog/smoke/noise where it supports depth;
- liquid/refraction effects for transitions or subsystem boundaries;
- scanline/CRT elements only where semantically appropriate;
- physical gauges tied to real measurements;
- interactive architecture maps;
- cursor-reactive local fields;
- kinetic typography used sparingly;
- scroll-driven system decomposition;
- 3D objects derived from actual Covert concepts;
- animated graphs based on real execution traces;
- procedural backgrounds rather than stock hero art.

"Smoke", "water", "liquid", "particles", "drips", and similar effects should be treated as rendering materials. They require a semantic purpose.

Example:
- liquid flow can represent context moving through the pipeline;
- particle convergence can represent model/tool routing;
- smoke can reveal/hide Ghost Code candidates;
- gauge pressure can represent resource admission.

---

## Website experience hierarchy

### Layer 1: immediate comprehension

Within seconds:
- Covert is a developer workbench;
- it can work locally;
- it coordinates models/tools/workflows;
- the operator remains in control.

### Layer 2: visual intrigue

The site should contain one immediately memorable interaction or visual mechanism.

Not ten.

### Layer 3: product proof

Show the actual product:
- real UI;
- real execution;
- real benchmark;
- real architecture;
- real projects.

### Layer 4: depth

Allow technical visitors to explore:
- architecture;
- evidence;
- models;
- privacy;
- workflow engine;
- authority;
- Ghost Code;
- Resident.

---

## Motion doctrine

Motion must communicate one of:

- state;
- causality;
- hierarchy;
- spatial relationship;
- progress;
- system activity;
- feedback.

Pure decoration is budgeted separately and should remain restrained.

Every nonessential motion system must support reduced motion.

The implementation should:
- honor `prefers-reduced-motion`;
- provide a site-level motion control if the experience is motion-heavy;
- replace large spatial motion with static/opacity alternatives where appropriate;
- stop unnecessary WebGL render loops in reduced/performance modes;
- preserve all meaningful content outside canvas-only rendering.

---

## Performance doctrine

Immersive does not mean heavy.

Target:
- meaningful HTML first;
- progressive enhancement;
- lazy-loaded 3D;
- static fallback/poster for unsupported or low-power environments;
- adaptive quality tiers;
- no permanent 60fps render loop if the scene is idle;
- compressed assets;
- texture budgets;
- device-pixel-ratio caps;
- measurable Core Web Vitals;
- tested mobile behavior.

A visitor should never need a gaming PC to understand Covert.

---

## Reference stack

Preferred code-first public stack:

- Next.js / React where appropriate;
- Vercel for preview/deployment;
- Three.js or React Three Fiber for real-time 3D;
- GSAP/ScrollTrigger or a deliberate motion library for choreographed timelines;
- CSS/SVG for effects that do not require WebGL;
- Figma for tokens/components/composition/motion planning;
- Canva for launch/social derivatives, not site architecture;
- Runway for video/motion assets, not fake product demonstrations;
- PostHog for public-site behavior;
- browser automation for regression and visual QA.

Do not add an animation/3D dependency where CSS or SVG is the better tool.

---

## Core references researched

- Current commentary on repetitive AI-generated website patterns.
- Current 2026 WebGL/interactive site showcases.
- Active Theory / Lusion / immersive studio approaches.
- Three.js WebGL capability/fallback patterns.
- GSAP ScrollTrigger.
- MDN `prefers-reduced-motion`.
- W3C WCAG animation guidance.

These references define mechanisms and constraints. They are not visual templates to clone.
