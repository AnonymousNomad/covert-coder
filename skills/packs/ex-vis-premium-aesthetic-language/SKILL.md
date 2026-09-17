---
name: ex-vis-premium-aesthetic-language
description: Visual design systems for immersive web experiences. Translates brand intent, audience context, and experience architecture into a deliberate visual system including aesthetic thesis, typography direction, palette logic, spacing and rhythm, material and lighting language, and component tone. Use when defining visual identity for a web experience, designing typography systems and scale, creating color palettes with mood logic, establishing spacing rhythm and proportional systems, designing material and lighting language for atmosphere, or translating brand personality into visual design tokens.
---

# Visual Design Systems — Premium Aesthetic Language

## PURPOSE

Translate the approved EXPERIENCE_BLUEPRINT and brand intent into a coherent VISUAL_SYSTEM artifact that defines the aesthetic thesis, typography direction, palette logic, spacing rhythm, material/lighting language, and component tone. The visual system is the design language that implementation stages apply consistently across every section.

## WHEN TO ACTIVATE

- An EXPERIENCE_BLUEPRINT is approved and visual design must begin
- Defining visual identity, aesthetic direction, or design language for a web experience
- Translating brand personality or business intent into concrete visual properties
- Designing typography systems, scale, and pairing logic
- Creating color palettes with mood and accessibility logic
- Establishing spacing, rhythm, and proportional systems
- Defining material, lighting, and atmospheric language for immersive experiences

## WHEN NOT TO ACTIVATE

- No approved EXPERIENCE_BLUEPRINT exists (use ex-strat-client-brief-extraction or ex-arch-immersive-landing-architecture first)
- Component-level CSS implementation (use ex-fnt-component-composition)
- Motion and animation design (use ex-int-motion-choreography)
- Model training data or spec format (use web-builder-* skills)
- Platform-specific theming (use shopify-capability-engineering for Shopify)

## REQUIRED INPUTS

- Approved EXPERIENCE_BLUEPRINT (from ex-arch-immersive-landing-architecture)
- Brand guidelines, logo, existing color/type if available
- Audience context from EXPERIENCE_BRIEF
- Experience character from EXPERIENCE_BRIEF (feeling, atmosphere, analogies)
- Content inventory (photography style, illustration needs, icon requirements)

## WORKFLOW

1. **Define aesthetic thesis.** One paragraph that captures the visual intent in concrete terms. The thesis must reference measurable properties (warm vs cool, dense vs spacious, grounded vs elevated, intimate vs expansive). This becomes the decision filter for every subsequent visual choice.
2. **Design typography direction.** Select typeface personality (humanist, geometric, neo-grotesque, transitional, display), define the scale system (modular scale ratio, min/max sizes, line-height progression), establish hierarchy rules (display > heading > subheading > body > caption with exact sizes). Typography must serve readability first, personality second.
3. **Construct palette logic.** Derive palette from the aesthetic thesis and audience context. Define: primary (brand identity), secondary (supporting tone), accent (conversion/attention), neutral (content background), surface (elevation). Every color must pass WCAG AA contrast against its intended background. Palette must be harmonious under the aesthetic thesis — not just technically valid.
4. **Establish spacing rhythm.** Define the base unit, scale multiples, and rhythm rules. Spacing must create visual consistency: the same relationship between elements always uses the same spatial proportion. Define section padding, component gaps, and inline spacing as multiples of the base unit.
5. **Design material and lighting language.** For immersive experiences: define the material quality (matte, glass, metallic, organic, paper) and lighting character (directional, ambient, dramatic, soft, natural). This creates atmosphere without relying on motion. Define how elevation, depth, and layering are expressed.
6. **Set component tone.** Define how buttons, cards, inputs, and navigation elements express the visual system. Component tone is the bridge between the visual system and implementation — it specifies the visual personality without specifying the CSS.
7. **Produce VISUAL_SYSTEM artifact.**

## DECISION RULES

1. **Contrast is non-negotiable.** Every text-on-background pair must pass WCAG AA (4.5:1 for body, 3:1 for large text). If the aesthetic thesis conflicts with contrast requirements, contrast wins. Find a way to achieve both; if impossible, adjust the palette.
2. **Typography serves readability.** Decorative or display typefaces may be used for headlines and hero text only. Body text must use a typeface optimized for screen readability at the target sizes. Never sacrifice legibility for aesthetic personality.
3. **Spacing is systematic, not arbitrary.** Every spatial value must derive from the base unit scale. "It looks right" is not sufficient — if the value is not a scale multiple, justify the deviation explicitly.
4. **Palette must be harmonious, not just valid.** A palette where every color is technically accessible but aesthetically dissonant fails. The palette must serve the aesthetic thesis — colors that create the intended mood while maintaining accessibility.
5. **Material language must be achievable.** Define material properties (opacity, blur, shadow, texture) that can be implemented with the available platform capabilities. If the platform does not support backdrop-filter, glass material is not achievable — use a solid alternative.
6. **The visual system must survive section variation.** A visual system that works for the hero section but breaks down for dense content sections is incomplete. Every section type in the blueprint must be expressible within the system.
7. **Consistency over novelty.** The visual system must be applied consistently across all sections. Novelty comes from the combination and composition of system elements, not from inventing new visual properties per section.

## VALIDATION CHECKS

1. VISUAL_SYSTEM contains all 6 required sections: aesthetic_thesis, typography, palette, spacing, material_lighting, component_tone.
2. Every palette color has a documented WCAG contrast ratio against its intended background.
3. Typography scale follows a consistent modular ratio with documented sizes from caption to display.
4. Spacing values are all multiples of the defined base unit (or deviations are explicitly justified).
5. Material and lighting properties are achievable with the target platform capabilities.
6. Every section type from the EXPERIENCE_BLUEPRINT can be expressed within the visual system.

## FAILURE CONDITIONS

- Aesthetic thesis is abstract without measurable properties → REJECT, require concrete grounding (warm = specific hue range, dense = specific spacing ratio, etc.).
- Palette cannot achieve WCAG AA contrast while maintaining aesthetic thesis → FLAG with specific contrast failures, propose palette adjustments.
- Platform limitations prevent achieving material language → DOCUMENT limitations, propose achievable alternatives.

## OUTPUT CONTRACT

### VISUAL_SYSTEM

```json
{
  "system_id": "vis-{timestamp}",
  "blueprint_ref": "arch-{id}",
  "aesthetic_thesis": {
    "intent": "string — one paragraph capturing the visual intent",
    "temperature": "warm | cool | neutral",
    "density": "dense | moderate | spacious",
    "grounding": "grounded | balanced | elevated",
    "intimacy": "intimate | moderate | expansive",
    "references": ["string — visual references that capture the intent"]
  },
  "typography": {
    "typeface_personality": "humanist | geometric | neo-grotesque | transitional | display",
    "primary_family": "string — primary typeface",
    "secondary_family": "string — secondary typeface (if pairing)",
    "scale_ratio": "number — modular scale ratio (e.g. 1.25, 1.333, 1.5)",
    "sizes": {
      "display": "string — e.g. '3.5rem'",
      "h1": "string",
      "h2": "string",
      "h3": "string",
      "body": "string",
      "caption": "string"
    },
    "line_heights": {
      "display": "number",
      "heading": "number",
      "body": "number"
    },
    "hierarchy_rules": "string — how size, weight, and color create hierarchy"
  },
  "palette": {
    "primary": {"value": "#hex | oklch(...)", "purpose": "string", "on_background": "#hex", "contrast_ratio": "number"},
    "secondary": {"value": "#hex | oklch(...)", "purpose": "string", "on_background": "#hex", "contrast_ratio": "number"},
    "accent": {"value": "#hex | oklch(...)", "purpose": "string", "on_background": "#hex", "contrast_ratio": "number"},
    "neutral": {"value": "#hex | oklch(...)", "purpose": "string", "on_background": "#hex", "contrast_ratio": "number"},
    "surface": {"value": "#hex | oklch(...)", "purpose": "string", "on_background": "#hex", "contrast_ratio": "number"},
    "harmony_logic": "string — why these colors work together under the aesthetic thesis"
  },
  "spacing": {
    "base_unit": "string — e.g. '4px' or '8px'",
    "scale": ["string — scale multiples, e.g. '4px', '8px', '16px', '24px', '32px', '48px', '64px', '96px'"],
    "section_padding": "string — standard section padding",
    "component_gap": "string — standard gap between components",
    "inline_spacing": "string — standard inline spacing",
    "rhythm_rules": "string — how spacing creates visual rhythm"
  },
  "material_lighting": {
    "material_quality": "matte | glass | metallic | organic | paper | custom",
    "elevation_expression": "string — how depth is expressed (shadow, blur, opacity)",
    "lighting_character": "directional | ambient | dramatic | soft | natural",
    "layering_rules": "string — how overlapping elements are handled"
  },
  "component_tone": {
    "button_personality": "string — how buttons express the visual system",
    "card_personality": "string — how cards/containers express the visual system",
    "input_personality": "string — how form elements express the visual system",
    "navigation_personality": "string — how navigation expresses the visual system"
  }
}
```

## RELATED SKILLS

- `ex-arch-immersive-landing-architecture` — produces the blueprint this skill consumes
- `ex-int-motion-choreography` — consumes visual system to design motion language
- `ex-fnt-component-composition` — consumes visual system to implement components
- `ex-com-premium-storefront-architecture` — specialized commerce visual system
- `web-builder-spec-renderer` — model output format with design tokens (different domain)
- `aide-responsive-a11y` — cockpit accessibility (different surface)
