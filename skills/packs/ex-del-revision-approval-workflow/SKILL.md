---
name: ex-del-revision-approval-workflow
description: Client delivery workflow for immersive web experiences. Controls client revision cycles, approval gates, scope boundaries, and design integrity throughout the delivery process. Use when managing client feedback and revision cycles, defining approval gates and sign-off requirements, controlling scope creep during delivery, maintaining design integrity under client pressure, structuring delivery milestones and checkpoints, or managing the human relationship between design intent and client preferences.
---

# Client Delivery Workflow — Revision and Approval Control

## PURPOSE

Manage the iterative relationship between design intent and client preferences through structured revision cycles, explicit approval gates, scope boundaries, and design integrity preservation. The workflow ensures that client feedback improves the experience without compromising the architectural and visual decisions that make it work.

## WHEN TO ACTIVATE

- Managing client feedback and revision cycles on an immersive web project
- Defining approval gates and sign-off requirements at each delivery milestone
- Controlling scope creep when client requests expand beyond the approved brief
- Maintaining design integrity when client preferences conflict with architecture
- Structuring delivery milestones with clear acceptance criteria
- Managing the relationship between professional expertise and client authority

## WHEN NOT TO ACTIVATE

- No approved EXPERIENCE_BRIEF exists (use ex-strat-client-brief-extraction first)
- Internal projects without client stakeholders
- Model training or pipeline tasks (use web-builder-* skills)
- Quality control or production readiness (use ex-qc-production-readiness-checklist)
- Deployment and hosting (use ex-dply-static-hosting-deploy)

## REQUIRED INPUTS

- Approved EXPERIENCE_BRIEF (scope, constraints, exclusions)
- Delivery timeline and milestones
- Client communication preferences and authority level
- Stakeholder map (who approves, who advises, who influences)
- Platform constraints that limit post-architecture changes

## WORKFLOW

1. **Define approval gates.** At each milestone (brief approval, architecture approval, visual design approval, implementation review, final QA), define: what is being approved, who has approval authority, what constitutes acceptance, and what happens if approval is denied.
2. **Structure revision cycles.** For each milestone: maximum revision rounds (typically 2), what types of changes are in-scope (adjustments within the architecture) vs out-of-scope (architecture changes), and how out-of-scope requests are handled (change order, re-scoping, deferral).
3. **Define scope boundary rules.** Explicitly state: what is IN SCOPE (per the brief), what is OUT OF SCOPE (per the brief exclusions), and how requests that cross the boundary are handled. Every scope-crossing request triggers a scope review, not an immediate implementation.
4. **Design integrity preservation.** Define which architectural and visual decisions are foundational (cannot change without re-architecture) vs flexible (can be adjusted within the system). Foundational decisions are documented and communicated to the client at architecture approval — they are not negotiable during implementation.
5. **Create milestone deliverables.** For each milestone: what the client receives, what format it is in (preview, interactive prototype, staging deployment), what feedback is expected, and what the feedback window is.
6. **Plan escalation paths.** When client feedback conflicts with professional expertise: document the conflict, present the evidence-based recommendation, explain the consequences of both options, and let the client decide with full information. Escalation is not confrontation — it is informed decision-making.
7. **Produce DELIVERY_WORKFLOW artifact.**

## DECISION RULES

1. **Scope changes require scope review.** Every client request that crosses the brief boundary triggers a formal scope review: impact on timeline, impact on budget, impact on architecture, and recommendation. Scope changes are never silently absorbed.
2. **Revision rounds are capped.** Each milestone has a maximum of 2 revision rounds. Additional rounds trigger a scope review. Unlimited revision is a scope management failure, not a client service feature.
3. **Foundational decisions are documented at approval.** When the client approves the architecture, they also approve the foundational decisions within it. These are not re-litigated during implementation. If the client wants to change a foundational decision, that is a scope change with timeline and budget impact.
4. **Professional expertise is presented, not imposed.** When the designer's expertise conflicts with the client's preference: present the evidence, explain the consequences, recommend the professional approach, and let the client decide. The client has authority over their business; the designer has authority over their expertise.
5. **Feedback must be specific.** Vague feedback ("I don't like it", "make it pop more") is not actionable. The workflow requires specific, actionable feedback. If the client cannot articulate what they want changed, a discovery session (not another revision round) is the appropriate response.
6. **Approval is explicit, not assumed.** Silence is not approval. The client must explicitly approve or request changes at each milestone. If no response is received within the feedback window, follow up once, then document the delay and its impact on the timeline.
7. **Design integrity is non-negotiable on accessibility and security.** Client requests that compromise WCAG accessibility or security requirements are declined with evidence. These are professional obligations, not preference decisions.

## VALIDATION CHECKS

1. DELIVERY_WORKFLOW contains all 4 required sections: approval_gates, revision_cycles, scope_boundaries, integrity_preservation.
2. Every milestone has defined approval authority and acceptance criteria.
3. Revision rounds are capped at 2 per milestone with scope-review escalation.
4. Foundational decisions are documented and communicated at architecture approval.
5. Scope boundary rules reference the EXPERIENCE_BRIEF exclusions explicitly.

## FAILURE CONDITIONS

- Client refuses to approve foundational architecture decisions → ESCALATE with evidence of downstream impact, recommend architecture revision session (not implementation changes).
- Scope creep exceeds 20% of original brief → TRIGGER formal re-scoping with updated timeline and budget.
- Client requests compromise accessibility or security → DOCUMENT the professional obligation, present alternatives, decline the compromising request.

## OUTPUT CONTRACT

### DELIVERY_WORKFLOW

```json
{
  "workflow_id": "del-{timestamp}",
  "brief_ref": "brief-{id}",
  "approval_gates": [
    {
      "milestone": "string — brief | architecture | visual | implementation | qa | final",
      "deliverable": "string — what the client receives",
      "format": "string — preview | prototype | staging | review",
      "approval_authority": "string — who has sign-off power",
      "acceptance_criteria": "string — what constitutes approval",
      "feedback_window": "string — how long the client has to respond"
    }
  ],
  "revision_cycles": {
    "max_rounds_per_milestone": "number",
    "in_scope_changes": "string — types of changes within the architecture",
    "out_of_scope_changes": "string — types of changes that trigger scope review",
    "scope_review_process": "string — how scope changes are evaluated and approved"
  },
  "scope_boundaries": {
    "in_scope": ["string — explicitly included capabilities"],
    "out_of_scope": ["string — explicitly excluded capabilities from brief"],
    "scope_change_impact_template": "string — how scope changes affect timeline and budget"
  },
  "integrity_preservation": {
    "foundational_decisions": ["string — decisions that cannot change without re-architecture"],
    "flexible_decisions": ["string — decisions that can be adjusted within the system"],
    "accessibility_non_negotiable": "boolean — accessibility requirements cannot be compromised",
    "security_non_negotiable": "boolean — security requirements cannot be compromised"
  }
}
```

## RELATED SKILLS

- `ex-strat-client-brief-extraction` — produces the brief that defines scope boundaries
- `ex-qc-production-readiness-checklist` — validates delivery against production gates
- `ex-arch-immersive-landing-architecture` — produces foundational decisions documented at approval
- `ex-vis-premium-aesthetic-language` — produces visual decisions documented at approval
- `web-builder-production-canary` — canary testing for production claims (model training domain)
- `web-builder-full-stack-synthesis` — escalation patterns for unsupported capabilities (model training domain)
