---
name: ex-com-premium-storefront-architecture
description: Commerce experience architecture for premium and narrative-driven storefronts. Designs commerce experiences around product narrative, trust architecture, exploration patterns, and conversion flow rather than generic product grids. Use when architecting premium ecommerce experiences, designing product narrative flows, planning trust-building commerce patterns, structuring catalog exploration for discovery, designing checkout and cart experiences with narrative continuity, or building storefronts where browsing feels like an interactive story.
---

# Commerce Experiences — Premium Storefront Architecture

## PURPOSE

Design commerce experiences where product discovery, evaluation, and conversion feel like a coherent narrative rather than a transactional sequence. The storefront architecture must serve three masters: product narrative (telling the story of what is being sold), trust architecture (building confidence to purchase), exploration patterns (making browsing rewarding), and conversion flow (making purchase effortless).

## WHEN TO ACTIVATE

- Designing premium ecommerce or storefront experiences
- Architecting product narrative flows (story → product → trust → purchase)
- Planning trust-building patterns (social proof, guarantees, transparency)
- Structuring catalog exploration for discovery and delight
- Designing checkout and cart experiences with narrative continuity
- Building storefronts where browsing is an experience, not a search

## WHEN NOT TO ACTIVATE

- No approved EXPERIENCE_BRIEF exists (use ex-strat-client-brief-extraction first)
- Non-commerce experiences (use ex-arch-immersive-landing-architecture)
- Platform-specific Shopify theme development (use shopify-capability-engineering)
- Visual design system (use ex-vis-premium-aesthetic-language for visual direction)
- Model training for web generation (use web-builder-* skills)
- Generic product catalog with no narrative intent (use standard ecommerce patterns)

## REQUIRED INPUTS

- Approved EXPERIENCE_BRIEF with commerce conversion goal
- Product inventory (types, price ranges, key differentiators)
- Brand positioning (premium, accessible luxury, mass market, artisanal)
- Trust requirements (payment methods, guarantees, return policies)
- Platform constraints (Shopify, headless, custom, static)

## WORKFLOW

1. **Map product narrative.** For the primary product category: what story does the product tell? What is the emotional journey from first sight to purchase? Define the narrative arc: discovery → intrigue → evaluation → trust → purchase → delight.
2. **Design trust architecture.** Identify every friction point where a buyer might hesitate. For each: what trust signal eliminates the hesitation? Map trust signals to the conversion path: certifications, guarantees, social proof, transparency, returns policy, secure payment indicators.
3. **Plan exploration patterns.** Design how users discover products: curated collections, narrative groupings, sensory browsing (visual-first, story-first), comparison flows, and recommendation paths. Exploration must feel rewarding, not overwhelming.
4. **Structure conversion flow.** Design the path from "I want this" to "I own this" with minimal friction and maximal confidence. Cart → checkout → payment → confirmation must feel like a continuation of the browsing experience, not a jarring context switch.
5. **Define commerce section architecture.** Each storefront section gets: purpose, content strategy, trust integration, mobile behavior, and conversion role. Sections include: hero/featured, collection browsing, product detail, social proof, guarantee/trust, cart, checkout.
6. **Set commerce performance requirements.** Commerce-specific performance: product image loading (critical for purchase confidence), search/filter responsiveness, cart state persistence, and checkout reliability.
7. **Produce COMMERCE_ARCHITECTURE artifact.**

## DECISION RULES

1. **Product narrative precedes product grid.** The storefront opens with narrative (story, context, mood), not a product grid. Grid browsing is a fallback for users who prefer it, not the primary experience. Premium commerce tells a story before showing a catalog.
2. **Trust signals are woven, not bolted.** Trust elements (reviews, guarantees, security badges) appear in context where doubt naturally arises, not in a separate "trust" section. A guarantee appears near the add-to-cart button. Reviews appear on the product detail section. Trust is environmental, not compartmentalized.
3. **Cart is part of the narrative.** The cart is not a dead-end summary. It continues the product story: what you chose, why it matters, what comes next. Cart abandonment recovery starts with narrative re-engagement, not just discount codes.
4. **Checkout preserves atmosphere.** The checkout flow maintains the visual and tonal language of the storefront. A jarring transition to a generic payment form breaks trust. Checkout is the final act of the purchase narrative, not an administrative appendage.
5. **Mobile commerce is thumb-native.** Product images fill the screen. Add-to-cart is thumb-reachable. Navigation is swipe-friendly. Checkout uses native input types. Mobile commerce is designed for one-handed use, not desktop-shaped缩小.
6. **Search is a discovery tool, not just a lookup tool.** Search results include curated context, not just product matches. "Search for blue dress" shows a curated collection with narrative context, not a raw product grid sorted by relevance.
7. **Commerce capabilities are honest.** If a commerce feature (wishlists, recommendations, reviews) is not implemented, it is not shown. Fake social proof, fabricated reviews, or placeholder trust signals destroy credibility permanently.

## VALIDATION CHECKS

1. COMMERCE_ARCHITECTURE contains all 5 required sections: product_narrative, trust_architecture, exploration_patterns, conversion_flow, commerce_sections.
2. Every trust signal has a specific placement tied to a doubt point in the conversion path.
3. The conversion flow has fewer than 5 steps from product interest to purchase confirmation.
4. Mobile commerce design specifies thumb-reach zones for primary actions.
5. Every commerce section has a stated role in the conversion path.

## FAILURE CONDITIONS

- No product narrative can be articulated (commodity product with no story) → FLAG, recommend standard ecommerce patterns with minimal narrative overlay rather than forcing premium narrative on a non-narrative product.
- Trust requirements exceed platform capabilities (e.g., custom payment flows on a platform that does not support them) → ESCALATE with specific capability gaps.
- Conversion flow exceeds 5 steps → SIMPLIFY, identify steps that can be eliminated or combined.

## OUTPUT CONTRACT

### COMMERCE_ARCHITECTURE

```json
{
  "commerce_id": "com-{timestamp}",
  "brief_ref": "brief-{id}",
  "product_narrative": {
    "story_arc": "string — the emotional journey from discovery to purchase",
    "primary_emotion": "string — the dominant emotional driver",
    "narrative_sections": ["string — section IDs that carry narrative"],
    "product_story": "string — what story the product tells"
  },
  "trust_architecture": {
    "doubt_points": [
      {
        "moment": "string — where doubt arises in the conversion path",
        "trust_signal": "string — what eliminates the doubt",
        "placement": "string — where in the experience this signal appears"
      }
    ],
    "social_proof_strategy": "string — how reviews, ratings, and testimonials are integrated",
    "guarantee_presence": "string — how guarantees and returns policies are communicated"
  },
  "exploration_patterns": {
    "primary_discovery": "string — how users find products (curated, search, browse)",
    "collection_strategy": "string — how products are grouped (narrative, category, mood)",
    "comparison_flow": "string — how users evaluate options",
    "recommendation_strategy": "string — how related products are surfaced"
  },
  "conversion_flow": {
    "steps": [
      {
        "action": "string — user action",
        "interface": "string — what the user sees",
        "narrative_continuity": "string — how this step continues the story",
        "friction_reduction": "string — what makes this step effortless"
      }
    ],
    "total_steps": "number",
    "mobile_optimization": "string — mobile-specific conversion optimizations"
  },
  "commerce_sections": [
    {
      "type": "hero | collection | product_detail | social_proof | guarantee | cart | checkout | custom",
      "purpose": "string — what this section accomplishes",
      "content_strategy": "string — what content appears and why",
      "trust_integration": "string — how trust signals appear in context",
      "conversion_role": "string — how this section advances the purchase"
    }
  ]
}
```

## RELATED SKILLS

- `ex-strat-client-brief-extraction` — produces the brief this skill consumes
- `ex-arch-immersive-landing-architecture` — parallel architecture for non-commerce immersive pages
- `ex-vis-premium-aesthetic-language` — visual system for the storefront
- `ex-fnt-component-composition` — implementation architecture for commerce components
- `shopify-capability-engineering` — platform capabilities for Shopify commerce
- `web-builder-full-stack-synthesis` — governance for full-stack Shopify builder (model training domain)
