---
name: ex-aiui-embedded-assistant-design
description: AI-native interface design for embedded intelligence in web experiences. Integrates conversational AI, local intelligence, and agent capabilities as a natural interface layer rather than a bolted-on chatbot. Use when designing embedded AI assistants for websites, planning conversational interfaces that serve the experience, integrating local-first AI capabilities, designing AI-powered discovery or recommendation flows, building intelligence that enhances rather than interrupts the user journey, or planning human-AI interaction patterns for web experiences.
---

# AI-Native Websites — Embedded Assistant Design

## PURPOSE

Integrate intelligence as a natural interface capability that enhances the web experience rather than interrupting it. The embedded assistant is not a chatbot widget — it is a contextual intelligence layer that understands where the user is in their journey and provides relevant, helpful, non-intrusive guidance.

## WHEN TO ACTIVATE

- Designing embedded AI assistants for web experiences
- Planning conversational interfaces that serve the user journey
- Integrating local-first or privacy-preserving AI capabilities
- Designing AI-powered discovery, recommendation, or guidance flows
- Building intelligence that enhances rather than interrupts user experience
- Planning human-AI interaction patterns for websites
- Designing voice or text interfaces as part of an immersive experience

## WHEN NOT TO ACTIVATE

- No approved EXPERIENCE_BRIEF exists (use ex-strat-client-brief-extraction first)
- Building AIDE's own intelligence layer (use aide-cipher or aide-arch-model-runtime)
- Generic chatbot widget placement without experience integration (not this skill's scope)
- Model training or inference optimization (use model-engineering skills)
- Backend AI pipeline architecture (different concern from frontend interface design)

## REQUIRED INPUTS

- Approved EXPERIENCE_BLUEPRINT (journey stages, conversion path, content architecture)
- User journey map (where the user is, what they know, what they need at each stage)
- Intelligence capabilities (what the AI can actually do — be honest about limits)
- Privacy constraints (local-first, cloud, data handling requirements)
- Platform capabilities (WebSocket, SSE, Web Workers, WASM, local model support)

## WORKFLOW

1. **Map intelligence to journey stages.** For each stage in the user journey: what intelligence would be helpful? What would be intrusive? Define the intelligence profile per stage: passive (data collection only), suggestive (non-blocking recommendations), active (proactive guidance), conversational (full dialogue).
2. **Design interaction patterns.** For each intelligence mode: how does the user invoke it? How does it present itself? How does the user dismiss or ignore it? The assistant must be dismissible, ignorable, and non-blocking. The user is never forced to interact with the AI.
3. **Define contextual awareness.** What does the assistant know about the user's current context? Page position, browsing history (within the session), content being viewed, actions taken. Context drives relevance — irrelevant suggestions are worse than no suggestions.
4. **Plan response architecture.** For each type of AI response: format (text, suggestion chips, content cards, navigation hints), placement (inline, overlay, sidebar, floating), timing (immediate, delayed, scroll-triggered), and interaction (read-only, actionable, conversational).
5. **Design trust and transparency.** The user must always know: (a) that they are interacting with AI, (b) what the AI can and cannot do, (c) what data the AI is using, (d) how to opt out. Transparency is not optional — it is a trust requirement.
6. **Set intelligence boundaries.** Define what the AI will NOT do: make decisions for the user, access data beyond the current session, override user choices, or present unverifiable claims. Boundaries are documented and enforced, not aspirational.
7. **Produce AI_INTEGRATION_PLAN artifact.**

## DECISION RULES

1. **AI enhances, never replaces, the core experience.** The website must be fully functional and valuable without the AI. The AI adds a layer of convenience, personalization, or guidance — it is not the experience itself. If removing the AI breaks the experience, the architecture is wrong.
2. **Contextual, not generic.** AI suggestions must be relevant to the user's current context. Generic "Can I help you?" is worse than silence. The assistant speaks when it has something contextually relevant to offer, and stays silent otherwise.
3. **Dismissible by default.** Every AI interface element can be dismissed, hidden, or ignored. The user's choice to ignore the AI is respected permanently for the session. No re-prompting, no guilt-tripping, no persistent overlays that cannot be closed.
4. **Honest about capabilities.** The AI must never claim capabilities it does not have. If the AI cannot answer a question, it says so. If the AI is uncertain, it expresses uncertainty. Fabricated confidence destroys trust permanently.
5. **Privacy is architectural, not policy.** The privacy model is designed into the architecture (local-first processing, session-only data, no cross-session tracking without explicit consent) — not bolted on as a privacy policy page. Data handling is a design constraint, not a legal afterthought.
6. **Performance budget is separate.** The AI layer has its own performance budget that does not degrade the core experience. AI loading, processing, and rendering happen in background threads or deferred blocks. The main thread is never blocked by AI computation.
7. **Progressive intelligence.** Start with the simplest useful intelligence (contextual hints, content suggestions) and add complexity only when the simpler patterns prove valuable. Full conversational AI is the most complex pattern — use it only when simpler patterns are insufficient.

## VALIDATION CHECKS

1. AI_INTEGRATION_PLAN contains all 5 required sections: journey_integration, interaction_patterns, contextual_awareness, trust_transparency, intelligence_boundaries.
2. Every AI touchpoint has a dismiss/ignore mechanism documented.
3. The AI has defined boundaries (will NOT do list) with enforcement rationale.
4. Privacy model specifies data handling (what is stored, for how long, user control).
5. Performance budget for AI layer is defined and does not exceed core experience budget.

## FAILURE CONDITIONS

- AI integration would degrade core experience performance → REDUCE AI scope or defer to background processing.
- Intelligence boundaries cannot be enforced with platform capabilities → DOCUMENT limitation, reduce scope to enforceable boundaries.
- Privacy requirements conflict with intelligence capabilities → PRIVACY WINS, reduce intelligence scope.

## OUTPUT CONTRACT

### AI_INTEGRATION_PLAN

```json
{
  "ai_plan_id": "aiui-{timestamp}",
  "blueprint_ref": "arch-{id}",
  "journey_integration": [
    {
      "stage": "string — user journey stage",
      "intelligence_mode": "passive | suggestive | active | conversational",
      "value_proposition": "string — what intelligence adds at this stage",
      "intrusion_level": "none | ambient | visible | interactive",
      "user_invocation": "string — how the user engages with AI at this stage"
    }
  ],
  "interaction_patterns": [
    {
      "pattern": "string — contextual-hint | suggestion-chip | content-card | dialogue | voice",
      "trigger": "string — what causes this pattern to appear",
      "format": "string — how it presents",
      "placement": "string — where on the page",
      "dismissal": "string — how the user dismisses or ignores it"
    }
  ],
  "contextual_awareness": {
    "data_sources": ["string — what context the AI uses (page, scroll, session history)"],
    "data_boundaries": "string — what context the AI does NOT access",
    "freshness": "string — how current the context must be"
  },
  "trust_transparency": {
    "ai_disclosure": "string — how the user knows they are interacting with AI",
    "capability_disclosure": "string — how the AI communicates its limits",
    "data_disclosure": "string — how the user learns what data is used",
    "opt_out": "string — how the user disables AI features"
  },
  "intelligence_boundaries": {
    "will_not_do": ["string — specific prohibited behaviors"],
    "uncertainty_handling": "string — how the AI expresses uncertainty",
    "escalation": "string — when the AI defers to human judgment"
  },
  "performance_budget": {
    "ai_load_strategy": "string — how AI assets load without blocking core",
    "max_processing_ms": "number — maximum AI processing time per request",
    "background_processing": "boolean — whether AI runs in background thread"
  }
}
```

## RELATED SKILLS

- `ex-arch-immersive-landing-architecture` — produces the blueprint this skill integrates intelligence into
- `ex-strat-client-brief-extraction` — produces the brief with AI capability requirements
- `ex-fnt-component-composition` — component architecture for AI interface elements
- `aide-cipher` — AIDE's own intelligence layer (different product surface)
- `aide-arch-model-runtime` — local model serving (backend concern, not interface design)
- `web-human-systems-security` — human-factor considerations for persuasive AI interfaces
