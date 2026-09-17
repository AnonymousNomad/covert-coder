---
name: ex-strat-client-brief-extraction
description: Discovery and strategy for immersive web experiences and website projects. Starts every build by researching audience needs, defining scope, and producing a bounded discovery brief with explicit constraints and conversion objectives that must achieve the project goals before any design work begins. Use first when creating a discovery brief, conducting audience research, scoping goals and requirements, translating business goals into an experience strategy, extracting strategy from a client conversation, or when any other skill in the experience chain depends on what has been established in the discovery foundation.
---

# Discovery and Strategy — Client Brief Extraction

## PURPOSE

Transform vague, incomplete, or emotionally-charged client intent into a bounded EXPERIENCE_BRIEF artifact that subsequent architecture, visual, and implementation stages can consume without ambiguity. The brief is the single source of truth for what the experience must achieve, who it serves, and what it must never do.

## WHEN TO ACTIVATE

- Client provides a vague or emotional description of what they want ("make it feel premium", "our competitors look better", "we need something modern")
- Project kickoff with incomplete business context
- Scope definition before architecture or design begins
- Brief review when existing deliverables don't match client expectations
- Converting marketing language into actionable experience requirements

## WHEN NOT TO ACTIVATE

- Client provides a fully-specified technical brief with exact requirements
- Architecture or implementation is already underway with an approved brief
- Internal model-training or pipeline tasks (use web-builder-* skills instead)
- Platform-specific Shopify/Liquid development (use shopify-capability-engineering)

## REQUIRED INPUTS

- Client communication (verbal notes, email, chat transcript, video call recording summary)
- Business context (company, market, competitors if known)
- Existing brand assets if available (logo, colors, tone of voice)
- Known constraints (budget, timeline, platform, technical limitations)
- Known audience information if available

## WORKFLOW

1. **Extract stated intent** — Pull every explicit statement from client communication. Separate facts from opinions. Label each as FACT, OPINION, ASSUMPTION, or UNKNOWN.
2. **Identify gaps** — Map what is known against what a complete brief requires. Every UNKNOWN becomes a high-value question.
3. **Formulate high-value questions** — Ask only questions whose answers materially change the experience design. Never ask questions whose answers are guessable from the business context. Maximum 8 questions; prioritize by impact on architecture and conversion.
4. **Classify business objective** — Primary: lead generation, e-commerce conversion, brand awareness, community building, information delivery, or hybrid. State the measurable conversion goal.
5. **Define audience segments** — Primary audience (who converts), secondary audience (who influences), anti-audience (who this is NOT for). Each segment gets: role, context, emotional state, desired outcome.
6. **Set constraints and exclusions** — Platform requirements, technical boundaries, brand do-not-use list, accessibility minimums, performance floors, legal/compliance requirements.
7. **Characterize experience intent** — Describe the intended feeling, atmosphere, and interaction character in concrete terms. Use analogies to known experiences. Avoid abstract adjectives without grounding.
8. **Produce EXPERIENCE_BRIEF artifact** — Serialize into the stage output contract.

## DECISION RULES

1. **No guesswork on conversion goals.** If the client has not stated a primary conversion action, the brief is INCOMPLETE. Propose a default based on business type but require explicit approval before architecture begins.
2. **Anti-audience is mandatory.** Every brief must state who this experience is NOT for. This prevents scope creep and design-by-committee.
3. **Constraints before creativity.** Define all hard constraints (platform, legal, performance, accessibility) before exploring creative direction. Constraints narrow the solution space productively.
4. **Experience character requires grounding.** Abstract descriptors ("modern", "premium", "clean") must be translated into concrete design references or measurable properties. "Modern" becomes "sans-serif typography, generous whitespace, minimal color palette, large photography". Never leave an abstract adjective ungrounded.
5. **Maximum 8 questions per brief cycle.** More than 8 questions signals either a poorly-scoped project or a client who cannot yet articulate their needs. In the latter case, propose a design sprint with 3 directional options rather than asking more questions.
6. **UNKNOWN is a valid state.** Label gaps honestly. A brief with labeled UNKNOWNs is more useful than one with guessed answers that later prove wrong.
7. **Scope boundary is explicit.** The brief must state what is IN SCOPE and what is OUT OF SCOPE. Anything not explicitly included is out of scope.

## VALIDATION CHECKS

1. EXPERIENCE_BRIEF contains all 7 required fields: business_objective, audience_segments, conversion_goal, constraints, exclusions, experience_character, required_capabilities.
2. Every audience segment has at minimum: role, context, desired_outcome.
3. No abstract experience character descriptors remain ungrounded (each must have a concrete design reference or measurable property).
4. Conversion goal is measurable and time-bounded where possible.
5. Constraints section includes platform, performance, accessibility, and legal/compliance entries (even if "none known" with rationale).

## FAILURE CONDITIONS

- Client cannot articulate any business objective even after 8 questions → REJECT BRIEF, recommend a discovery workshop before proceeding.
- Required capabilities exceed platform constraints → ESCALATE with specific capability gaps and platform limitations documented.
- Brief contains contradictions (e.g., "premium luxury feel" with "target Gen Z with TikTok-first approach" and budget under $500) → FLAG contradictions with evidence, request client priority ranking.

## OUTPUT CONTRACT

### EXPERIENCE_BRIEF

```json
{
  "brief_id": "brief-{timestamp}",
  "business_objective": {
    "primary": "lead_generation | e_commerce | brand_awareness | community | information | hybrid",
    "measurable_goal": "string — what success looks like in numbers",
    "time_horizon": "string — expected timeline for measuring success"
  },
  "audience_segments": [
    {
      "role": "string — who this person is",
      "context": "string — what brings them here",
      "emotional_state": "string — how they feel arriving",
      "desired_outcome": "string — what they want to accomplish",
      "conversion_path": "string — the action we want them to take"
    }
  ],
  "anti_audience": "string — who this experience is NOT designed for",
  "constraints": {
    "platform": "string — required platform/tech stack",
    "performance": "string — performance requirements",
    "accessibility": "string — accessibility minimum (WCAG level)",
    "legal_compliance": "string — legal or regulatory requirements",
    "budget": "string — budget constraints if stated",
    "timeline": "string — delivery timeline"
  },
  "exclusions": ["string — explicit out-of-scope items"],
  "experience_character": {
    "feeling": "string — the primary emotional intent",
    "atmosphere": "string — the environmental quality",
    "interaction_character": "string — how the experience feels to interact with",
    "analogies": ["string — references to known experiences that capture the intent"],
    "grounded_descriptors": ["string — concrete, measurable design properties"]
  },
  "required_capabilities": ["string — specific features or content types needed"],
  "open_questions": ["string — high-value questions whose answers change the design"],
  "assumptions": ["string — what we are assuming to be true"]
}
```

## RELATED SKILLS

- `ex-arch-immersive-landing-architecture` — consumes EXPERIENCE_BRIEF to produce architecture
- `ex-com-premium-storefront-architecture` — specialized commerce brief extraction
- `ex-del-revision-approval-workflow` — manages brief revision cycles with client
- `web-builder-full-stack-synthesis` — related brief intake phase in model pipeline (different domain)
- `shopify-capability-engineering` — platform capability constraints for Shopify projects
