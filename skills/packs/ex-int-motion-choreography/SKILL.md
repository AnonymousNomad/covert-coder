---
name: ex-int-motion-choreography
description: Interaction and motion design for immersive web experiences. Uses motion for hierarchy, spatial continuity, feedback, and narrative purpose rather than decoration. Defines scroll behavior, transitions, micro-interactions, reduced-motion alternatives, and performance constraints. Use when choreographing scroll-triggered animations, designing page transitions, planning micro-interactions with purpose, creating reduced-motion fallbacks, defining motion performance budgets, or using animation to reinforce narrative hierarchy and spatial continuity.
---

# Interaction Engineering — Motion Choreography

## PURPOSE

Define how motion serves the experience: reinforcing narrative hierarchy, creating spatial continuity between sections, providing feedback for user actions, and guiding attention. Every animation must have a purpose that maps to the EXPERIENCE_BLUEPRINT. Motion that exists only for decoration is REMOVED.

## WHEN TO ACTIVATE

- An EXPERIENCE_BLUEPRINT and VISUAL_SYSTEM are approved and interaction design must begin
- Choreographing scroll-triggered animations for immersive pages
- Designing page or section transitions that create spatial continuity
- Planning micro-interactions that provide meaningful feedback
- Creating reduced-motion alternatives that preserve the experience
- Defining motion performance budgets and rendering constraints
- Using animation to reinforce narrative hierarchy or guide attention

## WHEN NOT TO ACTIVATE

- No approved BLUEPRINT or VISUAL_SYSTEM exists yet (use upstream skills first)
- Component architecture or state management (use ex-fnt-component-composition)
- Visual design system or aesthetic direction (use ex-vis-premium-aesthetic-language)
- Quality control or performance auditing (use ex-qc-production-readiness-checklist)
- Static/animation-free experiences (define motion plan as "none" and proceed)
- Model training or spec format (use web-builder-* skills)

## REQUIRED INPUTS

- Approved EXPERIENCE_BLUEPRINT (section definitions, attention flow, narrative sequence)
- Approved VISUAL_SYSTEM (material language, component tone, spacing rhythm)
- IMPLEMENTATION_BLUEPRINT (component tree, platform, performance budget)
- Platform capabilities (CSS animation support, scroll-driven animations, Web Animations API)
- Accessibility requirements (WCAG motion guidelines)

## WORKFLOW

1. **Audit sections for motion opportunities.** Review each blueprint section and identify where motion serves a purpose: entering the viewport (attention), transitioning between sections (continuity), responding to user input (feedback), or revealing content (hierarchy). Sections with no motion purpose get no animation.
2. **Design scroll choreography.** Map scroll position to section behavior. Define: which sections animate on entry, what the animation achieves (reveal, emphasize, transition, rest), timing relative to scroll position (scroll-linked, scroll-triggered, time-based), and spatial direction (motion follows narrative flow, not arbitrary axes).
3. **Define transition language.** Establish the vocabulary of transitions: how sections connect (fade, slide, scale, morph), what transition speed communicates (fast = responsive, slow = dramatic), and what easing communicates (ease-out = natural, ease-in-out = deliberate). Every transition type must be justified by the spatial or narrative relationship between source and target.
4. **Plan micro-interactions.** For each interactive element (buttons, links, form inputs, navigation): define the feedback animation (what happens on hover, focus, active, success, error), the duration (must feel responsive — typically 100-300ms), and the purpose (confirm action, guide eye, provide affordance).
5. **Design reduced-motion experience.** For users who prefer reduced motion (prefers-reduced-motion: reduce), define the alternative. The reduced-motion experience must be complete and coherent — not a broken version of the animated experience. Animations become instant state changes, opacity fades, or are omitted entirely if the content remains clear.
6. **Set performance constraints.** Define: maximum concurrent animations, maximum animation duration, prohibited properties (avoid animating layout-triggering properties like width/height/top/left), required compositing layers (transform, opacity only), and frame rate target (60fps minimum).
7. **Produce INTERACTION_PLAN artifact.**

## DECISION RULES

1. **Every animation must have a purpose statement.** If you cannot state what the animation achieves for the user experience (hierarchy, continuity, feedback, guidance), the animation is REMOVED. "It looks cool" is not a purpose.
2. **Reduced-motion is not optional.** Every animated experience must have a complete reduced-motion alternative. The alternative must be designed, not just "turn everything off." Content hierarchy and spatial relationships must be communicated through layout, typography, and color when motion is absent.
3. **Motion follows narrative.** Animation direction and timing must reinforce the narrative sequence from the blueprint. If the narrative flows top-to-bottom, motion should not enter from the right. Spatial consistency creates intuitive experiences.
4. **Performance is a hard constraint.** If an animation causes jank (dropped frames, layout thrashing), it is REMOVED or SIMPLIFIED. 60fps is not aspirational — it is the minimum for smooth interaction. Animations that cannot maintain 60fps on the target device class do not ship.
5. **Scroll-linked animation has a fallback.** Scroll-linked animations (animations tied to scroll position) must work correctly even if the user jumps to a scroll position (scrollbar click, find-in-page, deep link). The animation state must reflect the current scroll position, not assume sequential scrolling.
6. **Duration communicates intent.** Fast (100-200ms) = responsive feedback. Medium (200-500ms) = deliberate transition. Slow (500-1000ms) = dramatic emphasis. Very slow (1000ms+) = only for hero-level cinematic moments. Duration must match the emotional weight of the content it serves.
7. **No animation on first paint.** The page must be fully readable and functional before any animation begins. Animation enhances a complete experience; it does not complete an incomplete one.

## VALIDATION CHECKS

1. INTERACTION_PLAN contains all 5 required sections: scroll_choreography, transitions, micro_interactions, reduced_motion, performance_constraints.
2. Every animated section in the plan has a purpose statement linking to blueprint narrative or attention flow.
3. Every animation has a reduced-motion alternative explicitly defined.
4. No animation targets layout-triggering CSS properties (width, height, top, left, margin, padding).
5. Performance constraints include maximum concurrent animations and frame rate target.
6. Scroll-linked animations have a scroll-position-independent fallback.

## FAILURE CONDITIONS

- Animation purpose cannot be linked to blueprint narrative or attention flow → REMOVE the animation.
- Reduced-motion alternative is "turn off all animation" without content hierarchy preservation → REDESIGN the reduced-motion experience.
- Animation budget exceeds performance constraints → SIMPLIFY or REMOVE animations until budget is met.

## OUTPUT CONTRACT

### INTERACTION_PLAN

```json
{
  "interaction_id": "int-{timestamp}",
  "blueprint_ref": "arch-{id}",
  "visual_system_ref": "vis-{id}",
  "scroll_choreography": [
    {
      "section_ref": "string — blueprint section ID",
      "animation_type": "reveal | transition | emphasize | rest",
      "trigger": "scroll-linked | scroll-triggered | time-based",
      "direction": "string — spatial direction of motion",
      "duration_ms": "number",
      "easing": "string — CSS easing function",
      "purpose": "string — what this animation achieves"
    }
  ],
  "transitions": {
    "vocabulary": ["string — the transition types used (fade, slide, scale, morph)"],
    "speed_mapping": {
      "fast_ms": "number — responsive feedback",
      "medium_ms": "number — deliberate transition",
      "slow_ms": "number — dramatic emphasis"
    },
    "easing_semantics": "string — what different easing functions communicate"
  },
  "micro_interactions": [
    {
      "element": "string — interactive element type",
      "states": {
        "hover": "string — hover animation description",
        "focus": "string — focus animation description",
        "active": "string — active/click animation description",
        "success": "string — success state animation",
        "error": "string — error state animation"
      },
      "duration_ms": "number",
      "purpose": "string — what feedback this provides"
    }
  ],
  "reduced_motion": {
    "strategy": "instant-state | opacity-only | omitted | custom",
    "fallback_description": "string — what the experience looks like without motion",
    "content_hierarchy_preserved": "boolean — whether content hierarchy is clear without animation",
    "spatial Relationships_preserved": "boolean — whether section relationships are clear without motion"
  },
  "performance_constraints": {
    "max_concurrent_animations": "number",
    "max_duration_ms": "number",
    "prohibited_properties": ["string — CSS properties to avoid animating"],
    "compositing_only": "boolean — restrict to transform/opacity only",
    "target_fps": "number"
  }
}
```

## RELATED SKILLS

- `ex-arch-immersive-landing-architecture` — produces the blueprint with attention flow this skill consumes
- `ex-vis-premium-aesthetic-language` — produces the material language this skill translates into motion
- `ex-fnt-component-composition` — produces the component tree this skill attaches animations to
- `ex-qc-production-readiness-checklist` — validates motion performance and reduced-motion compliance
- `web-builder` — model spec schema has a motion field (different domain: model training vs design methodology)
- `aide-p2-descent-intro` — specific cinematic animation implementation (concrete instance, not methodology)
