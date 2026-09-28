---
name: covert-experience-design
description: Design and review Covert product/web experiences so they are authored, distinctive, immersive, evidence-led, accessible, performant, and resistant to generic AI/SaaS design patterns.
---

# Covert Experience Design Skill

## Trigger

Use for:
- Covert website design;
- product visual-system work;
- themes;
- public demos;
- Evidence Lab;
- interactive marketing surfaces;
- motion;
- WebGL/Three.js/R3F;
- Figma work;
- visual reviews.

## Mandatory sequence

Research
→ classify category clichés
→ define Covert-specific concept
→ define anti-patterns
→ create composition directions
→ prototype dominant interaction
→ test reduced motion
→ test performance
→ implement
→ browser QA
→ evidence/copy verification

Never skip directly from vague prompt to finished page.

## Generic-AI rejection heuristic

Escalate for redesign if the page combines several of:

- giant centered hero;
- purple/blue glow;
- glass cards;
- bento grid;
- 3-column features;
- generic line icons;
- floating dashboard;
- universal rounded corners;
- repeated fade-up animations;
- generic SaaS copy.

## Product specificity test

Ask:

"Could this exact visual system sell another AI SaaS product after changing the logo?"

If yes, it is not sufficiently authored.

## Motion test

Every motion must answer:
- what state does it communicate?
- what relationship does it show?
- what feedback does it provide?
- why is motion better than static presentation?

If there is no answer, treat it as decoration and budget it accordingly.

## Immersive-tech selection

Use:
- CSS/SVG for lightweight effects;
- Motion/Framer for component transitions;
- GSAP for timeline and scroll choreography;
- Three.js/R3F for justified real-time graphics/shaders/3D.

Do not use WebGL because it looks expensive.

## Theme rule

Themes may change presentation but never semantics.

Every theme requires:
- Minimal fallback;
- reduced-motion behavior;
- performance fallback;
- accessible color state;
- real telemetry binding where telemetry is displayed.

## QA

Verify:
- desktop;
- tablet;
- phone;
- keyboard;
- reduced motion;
- low/medium performance mode;
- no-WebGL fallback;
- loading state;
- error state;
- real copy;
- real links;
- real analytics events;
- no console errors.

## Output expectation

For every design task report:
- communication goal;
- target audience;
- references;
- avoided clichés;
- design concept;
- technology choice;
- accessibility plan;
- performance plan;
- verification performed.
