---
name: ex-arch-immersive-landing-architecture
description: Experience architecture for immersive web pages. Converts a discovery brief into information hierarchy, narrative sequence, section and scene design, attention flow, and mobile-first page architecture before implementation. Use when designing landing page structure, planning section ordering and narrative flow, architecting immersive single-page experiences, designing information hierarchy for cinematic pages, planning attention-driven section sequences, or structuring mobile-first page layouts with narrative purpose.
---

# Experience Architecture — Immersive Landing Architecture

## PURPOSE

Convert an approved EXPERIENCE_BRIEF into a structured EXPERIENCE_BLUEPRINT that defines information hierarchy, narrative sequence, section and scene design, attention flow, CTA placement, and mobile-first architecture. The blueprint is the architectural plan that visual design, interaction, and implementation stages consume.

## WHEN TO ACTIVATE

- A discovery brief (EXPERIENCE_BRIEF) is approved and architecture must begin
- Designing landing page structure and section ordering
- Planning immersive single-page experiences with narrative flow
- Architecting cinematic pages where attention flow matters
- Structuring mobile-first layouts where hierarchy changes across breakpoints
- Planning section sequences that guide user attention toward conversion

## WHEN NOT TO ACTIVATE

- No approved EXPERIENCE_BRIEF exists yet (use ex-strat-client-brief-extraction first)
- Multi-page site architecture (sitemap and navigation structure — different scope)
- Component-level implementation (use ex-fnt-component-composition)
- Visual design system or aesthetic direction (use ex-vis-premium-aesthetic-language)
- E-commerce product catalog architecture (use ex-com-premium-storefront-architecture)
- Model training or spec format design (use web-builder-* skills)

## REQUIRED INPUTS

- Approved EXPERIENCE_BRIEF (from ex-strat-client-brief-extraction)
- Brand guidelines if available
- Content inventory (copy, images, video, testimonials, data)
- Technical constraints (platform, performance budget, animation support)

## WORKFLOW

1. **Map conversion path to sections.** Start from the conversion goal and work backward. Every section must earn its place by advancing the user toward conversion or removing a barrier to conversion.
2. **Design information hierarchy.** Define what the user learns at each scroll depth. The hierarchy must be self-sufficient — a user who reads only the first screen gets the complete core message.
3. **Sequence narrative beats.** Order sections as narrative progression: context → tension → resolution → action. Each section creates the emotional state that makes the next section effective.
4. **Place attention anchors.** Identify where attention peaks and valleys occur. Place high-impact content (hero, social proof, CTA) at peaks. Use valleys for supporting detail that rewards close reading.
5. **Design CTA architecture.** Primary CTA placement is determined by the conversion path, not visual symmetry. Secondary CTAs support the primary without competing. Every CTA has a clear preceding context that motivates the click.
6. **Plan mobile hierarchy.** Mobile-first is not desktop-shrunk. Redesign the information hierarchy for thumb-scrolling: what appears first on mobile may differ from desktop based on conversion priority.
7. **Define section contracts.** Each section gets: purpose, content requirements, interaction opportunity, mobile behavior, and attention role.
8. **Produce EXPERIENCE_BLUEPRINT artifact.**

## DECISION RULES

1. **Every section must have a conversion purpose.** Sections that exist only for "visual variety" or "because websites usually have this" are REMOVED. If a section cannot state its conversion contribution, it does not ship.
2. **Narrative sequence beats visual symmetry.** The best section order for conversion is not always the most aesthetically pleasing order. Conversion-optimal ordering takes priority; visual coherence is achieved through design, not section reordering.
3. **Mobile hierarchy is designed, not derived.** The mobile layout is a separate architectural decision. Content that is secondary on desktop may be primary on mobile if it serves the conversion path better in a vertical scroll context.
4. **Attention budget is finite.** A page with 8+ sections must have 2-3 attention peaks maximum. Everything else is supporting context. Overloading attention peaks dilutes conversion.
5. **CTA placement follows motivation, not convention.** "CTA at the bottom" is a convention, not a rule. Place the primary CTA where motivation is highest, which may be mid-page after a compelling section, not at the bottom.
6. **Section stacking must be defensible.** For each section, state: (a) what the user knows before this section, (b) what this section adds, (c) what emotional state it creates, (d) why the NEXT section follows this one.
7. **Reduced-motion architecture.** Plan the experience without scroll-triggered animations first. If the architecture works without motion, adding motion enhances it. If the architecture depends on motion to be coherent, it is fragile.

## VALIDATION CHECKS

1. Every section in the blueprint has: purpose, content_requirements, mobile_behavior, attention_role, and preceding_context.
2. The section sequence is defensible: each section's "why_this_follows" field is populated and logically sound.
3. Primary CTA is reachable within 3 scroll depths on mobile.
4. No section exists without a stated conversion contribution.
5. Mobile hierarchy is explicitly defined and differs from desktop where architecturally necessary.

## FAILURE CONDITIONS

- No approved EXPERIENCE_BRIEF exists → BLOCK, require brief extraction first.
- Brief specifies conversion goal but architecture cannot identify a viable section sequence to reach it → ESCALATE with specific gaps between brief requirements and architectural feasibility.
- More than 8 sections required → FLAG as potential scope creep, propose section consolidation with conversion rationale for each.

## OUTPUT CONTRACT

### EXPERIENCE_BLUEPRINT

```json
{
  "blueprint_id": "arch-{timestamp}",
  "brief_ref": "brief-{id}",
  "page_character": "string — the one-sentence architectural intent",
  "conversion_path": "string — the primary path from entry to conversion action",
  "sections": [
    {
      "id": "string — unique section identifier",
      "type": "hero | narrative | evidence | feature | testimonial | cta | footer | nav | custom",
      "purpose": "string — what this section accomplishes for conversion",
      "content_requirements": {
        "headline": "string or null",
        "body": "string or null",
        "media": "string or null — type and purpose of visual content",
        "cta": "string or null — CTA text and destination",
        "social_proof": "string or null — type and placement of proof elements"
      },
      "attention_role": "peak | valley | transition | anchor",
      "preceding_context": "string — what the user knows/feels before this section",
      "creates_emotional_state": "string — the emotional state this section produces",
      "why_this_follows": "string — why this section follows the previous one",
      "interaction_opportunity": "string or null — interaction that enhances this section",
      "mobile_behavior": {
        "order": "number — mobile display order (may differ from desktop)",
        "visibility": "full | condensed | collapsed | hidden",
        "mobile_notes": "string — any mobile-specific architectural decisions"
      }
    }
  ],
  "attention_flow": {
    "peaks": ["string — section IDs where attention peaks"],
    "valleys": ["string — section IDs where attention rests"],
    "primary_cta_position": "string — section ID where primary CTA appears"
  },
  "cta_architecture": {
    "primary": {
      "text": "string",
      "section": "string — section ID",
      "motivation_context": "string — what makes the user want to click here"
    },
    "secondary": [
      {
        "text": "string",
        "section": "string",
        "purpose": "string — how this supports the primary CTA"
      }
    ]
  },
  "mobile_hierarchy_notes": "string — key differences between mobile and desktop architecture",
  "section_count": "number",
  "architecture_confidence": "high | medium | low — confidence in conversion path viability"
}
```

## RELATED SKILLS

- `ex-strat-client-brief-extraction` — produces the EXPERIENCE_BRIEF this skill consumes
- `ex-vis-premium-aesthetic-language` — consumes this blueprint to design visual systems
- `ex-int-motion-choreography` — consumes section definitions to plan motion
- `ex-fnt-component-composition` — consumes blueprint to design component architecture
- `ex-com-premium-storefront-architecture` — specialized commerce architecture (parallel, not sequential)
- `web-builder-spec-renderer` — model output format (different domain, composes conceptually)
