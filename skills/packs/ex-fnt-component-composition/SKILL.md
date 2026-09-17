---
name: ex-fnt-component-composition
description: Frontend implementation architecture for immersive web experiences. Translates approved experience blueprints and visual systems into maintainable component trees with explicit state ownership, client and server boundaries, asset strategy, and performance budgets. Use when designing component architecture for a web experience, defining state management boundaries, planning client and server responsibility splits, structuring asset loading strategies, setting performance budgets for rendering, or translating design systems into implementation architecture.
---

# Frontend Implementation — Component Composition

## PURPOSE

Translate the approved EXPERIENCE_BLUEPRINT and VISUAL_SYSTEM into an IMPLEMENTATION_BLUEPRINT that defines the component tree, state ownership, client/server boundaries, asset strategy, and performance budget. The implementation blueprint is the bridge between design intent and production code.

## WHEN TO ACTIVATE

- An EXPERIENCE_BLUEPRINT and VISUAL_SYSTEM are approved and implementation architecture must begin
- Designing component hierarchy and composition patterns for a web experience
- Defining state management boundaries (what state lives where, who owns it)
- Planning client and server responsibility splits
- Structuring asset loading (images, fonts, scripts, styles)
- Setting performance budgets (render time, bundle size, paint metrics)
- Translating design tokens and component tone into implementation structure

## WHEN NOT TO ACTIVATE

- No approved BLUEPRINT or VISUAL_SYSTEM exists yet (use upstream skills first)
- Interaction design or motion choreography (use ex-int-motion-choreography)
- Quality control or production readiness (use ex-qc-production-readiness-checklist)
- Deployment and hosting (use ex-dply-static-hosting-deploy)
- Model training or spec format (use web-builder-* skills)
- Shopify theme development (use shopify-capability-engineering)

## REQUIRED INPUTS

- Approved EXPERIENCE_BLUEPRINT (from ex-arch-immersive-landing-architecture)
- Approved VISUAL_SYSTEM (from ex-vis-premium-aesthetic-language)
- Platform constraints (static HTML, React, Vue, vanilla JS, etc.)
- Performance budget (target LCP, FID, CLS, total bundle size)
- Hosting constraints (static hosting, server-rendered, edge functions)

## WORKFLOW

1. **Map sections to components.** Each blueprint section maps to one or more components. Define the component tree: parent-child relationships, slot composition, and render order. Components must map cleanly to sections — if a component serves no section, question its existence.
2. **Define state ownership.** For each piece of interactive state: who creates it, who reads it, who updates it, and what triggers updates. State that crosses component boundaries needs explicit ownership. Prefer local state; escalate to shared state only when a component tree analysis proves local state insufficient.
3. **Set client/server boundaries.** Define what renders on the server (first paint, SEO-critical content, above-fold) versus what hydrates on the client (interaction, animation, dynamic content). The boundary must minimize time-to-interactive while maximizing first-paint completeness.
4. **Design asset strategy.** For each asset type (images, fonts, scripts, styles): loading priority (critical, deferred, lazy), format (WebP, AVIF, WOFF2, etc.), sizing strategy (responsive, art-directed, fixed), and caching behavior. Above-fold assets load eagerly; below-fold assets lazy-load.
5. **Set performance budgets.** Define measurable limits: maximum bundle size, maximum time-to-first-byte, maximum largest-contentful-paint, maximum cumulative-layout-shift, maximum first-input-delay. Every architectural decision must be justified against these budgets.
6. **Define component contracts.** Each component gets: props interface, state requirements, render contract (what it outputs), and testing requirements. Component contracts are the implementation equivalent of the visual system's component tone.
7. **Produce IMPLEMENTATION_BLUEPRINT artifact.**

## DECISION RULES

1. **Component tree depth is capped at 5 levels.** Deeper nesting signals either over-decomposition or missing abstraction. Flatten the tree or introduce a layout component to reduce depth.
2. **State ownership is explicit, never implicit.** Every piece of state has exactly one owner component. Other components read it via props or context. If two components both "own" the same state, the architecture is broken — consolidate ownership.
3. **Server rendering is the default.** Everything that can render on the server DOES render on the server. Client-side rendering is reserved for genuinely interactive elements that cannot function without JavaScript. Progressive enhancement, not JavaScript dependence.
4. **Asset loading follows visibility.** Above-fold assets load eagerly with preload hints. Below-fold assets lazy-load. Fonts use font-display: swap to prevent invisible text. No asset blocks rendering of visible content.
5. **Performance budgets are hard limits.** If an architectural choice would exceed a budget, the choice is REJECTED. Find an alternative that meets the budget. Budgets are not aspirational — they are constraints.
6. **Component contracts prevent drift.** Every component must have a documented props interface before implementation begins. Interface changes require updating the contract and all consumers. No silent prop additions.
7. **Minimal JavaScript by default.** The default is zero JavaScript. Every script must justify its existence against the interaction it enables. If a CSS-only or HTML-only solution achieves 80% of the effect, ship that and note the 20% as a progressive enhancement.

## VALIDATION CHECKS

1. IMPLEMENTATION_BLUEPRINT contains all 5 required sections: component_tree, state_ownership, client_server_boundary, asset_strategy, performance_budget.
2. Every blueprint section maps to at least one component in the tree.
3. Every piece of interactive state has a documented owner component.
4. Performance budgets include LCP, CLS, and bundle size targets.
5. Asset strategy covers images, fonts, scripts, and styles with loading priorities.

## FAILURE CONDITIONS

- Component tree exceeds 5 levels of depth → RESTRUCTURE, propose flatter composition.
- Performance budget cannot be met with the current architecture → FLAG with specific budget overruns and architectural alternatives.
- Platform limitations prevent server rendering → DOCUMENT limitation, adjust client/server boundary accordingly.

## OUTPUT CONTRACT

### IMPLEMENTATION_BLUEPRINT

```json
{
  "implementation_id": "impl-{timestamp}",
  "blueprint_ref": "arch-{id}",
  "visual_system_ref": "vis-{id}",
  "platform": "string — target platform (static-html, react, vue, vanilla, etc.)",
  "component_tree": {
    "root": "string — root component name",
    "components": [
      {
        "name": "string — component name",
        "section_ref": "string — blueprint section ID this maps to",
        "type": "layout | presentation | interactive | container",
        "children": ["string — child component names"],
        "props_interface": "string — props this component accepts",
        "render_contract": "string — what this component outputs"
      }
    ],
    "depth": "number — maximum tree depth"
  },
  "state_ownership": [
    {
      "state_key": "string — state identifier",
      "owner": "string — component that owns this state",
      "readers": ["string — components that read this state"],
      "update_triggers": ["string — what causes this state to change"],
      "scope": "local | shared | global"
    }
  ],
  "client_server_boundary": {
    "server_rendered": ["string — components that render on the server"],
    "client_hydrated": ["string — components that hydrate on the client"],
    "static_assets": ["string — assets served as static files"],
    "boundary_rationale": "string — why this boundary was chosen"
  },
  "asset_strategy": {
    "images": {"format": "string", "loading": "eager | lazy | preload", "sizing": "responsive | fixed | art-directed"},
    "fonts": {"format": "string", "loading": "string", "display": "swap | block | fallback"},
    "scripts": {"type": "string", "loading": "eager | defer | async", "critical": "boolean"},
    "styles": {"type": "string", "loading": "string", "critical": "boolean"}
  },
  "performance_budget": {
    "lcp_ms": "number — target Largest Contentful Paint",
    "cls": "number — target Cumulative Layout Shift",
    "fid_ms": "number — target First Input Delay",
    "bundle_size_kb": "number — target total JavaScript bundle size",
    "total_weight_kb": "number — target total page weight"
  }
}
```

## RELATED SKILLS

- `ex-arch-immersive-landing-architecture` — produces the blueprint this skill consumes
- `ex-vis-premium-aesthetic-language` — produces the visual system this skill consumes
- `ex-int-motion-choreography` — consumes component tree to plan motion implementation
- `ex-qc-production-readiness-checklist` — validates implementation against production gates
- `ex-dply-static-hosting-deploy` — consumes implementation blueprint for deployment
- `web-builder-spec-renderer` — model output format (different domain)
