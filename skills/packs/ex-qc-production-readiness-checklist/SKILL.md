---
name: ex-qc-production-readiness-checklist
description: Independent production readiness verification for immersive web experiences. Provides the no-ship-blind release gate covering accessibility, responsive design, performance, browser compatibility, security, and unresolved blockers. Use when running production readiness checks before launch, auditing accessibility compliance for web experiences, verifying responsive design across breakpoints, validating performance against budgets, checking browser compatibility, assessing security and privacy status, or compiling release evidence for stakeholder sign-off.
---

# Quality Control — Production Readiness Checklist

## PURPOSE

Provide the independent, no-ship-blind release gate that verifies an immersive web experience is ready for production. The QC checklist is the final verification layer that catches issues the implementation and design stages may have missed. Nothing ships without passing this gate.

## WHEN TO ACTIVATE

- Before production launch of any immersive web experience
- At QA milestone in the delivery workflow (ex-del-revision-approval-workflow)
- After implementation is complete and before client final review
- When compiling release evidence for stakeholder sign-off
- When auditing an existing experience for production readiness
- After significant changes to a live experience

## WHEN NOT TO ACTIVATE

- During design or architecture phases (upstream skills handle those stages)
- For model training or pipeline verification (use verification-complete or web-builder-production-canary)
- For AIDE internal testing (use aide-double-check-everything)
- For non-web deployments (model serving, API deployment — different gates)

## REQUIRED INPUTS

- Completed IMPLEMENTATION_BLUEPRINT (from ex-fnt-component-composition)
- INTERACTION_PLAN (from ex-int-motion-choreography)
- VISUAL_SYSTEM (from ex-vis-premium-aesthetic-language)
- Target browsers and devices (from brief or platform requirements)
- Performance budget (from IMPLEMENTATION_BLUEPRINT)
- Accessibility requirements (WCAG level from brief)

## WORKFLOW

1. **Run accessibility audit.** Check: semantic HTML structure, heading hierarchy, alt text on all images, keyboard navigation completeness, focus visible states, color contrast ratios (WCAG AA minimum), aria labels on interactive elements, reduced-motion support, screen reader compatibility, and form label/input associations. Document every violation with location and severity.
2. **Run responsive audit.** Test at defined breakpoints: 1440px, 1200px, 1000px, 820px, 640px, 320px. Check: layout integrity (no overflow, no horizontal scroll), text readability (minimum 16px body), touch target size (minimum 44px), image scaling, navigation usability, and content priority at each breakpoint.
3. **Run performance audit.** Measure against IMPLEMENTATION_BLUEPRINT budgets: Largest Contentful Paint, Cumulative Layout Shift, First Input Delay, total bundle size, total page weight, image optimization, font loading strategy, script loading strategy, and critical rendering path.
4. **Run browser compatibility audit.** Test on target browsers: latest Chrome, Firefox, Safari, Edge. Check: layout rendering, animation performance, interactive elements, form behavior, and API compatibility. Document any browser-specific workarounds or known limitations.
5. **Run security and privacy audit.** Check: HTTPS enforcement, content security policy, no mixed content, no exposed API keys, no sensitive data in client-side code, form input sanitization, external resource integrity (SRI), cookie handling, and privacy compliance (data collection disclosure, consent mechanisms).
6. **Compile unresolved blockers.** List every issue that prevents production launch: critical accessibility violations, performance budget overruns, browser compatibility failures, security vulnerabilities, and content completeness gaps. Each blocker has: severity, location, impact, and recommended fix.
7. **Produce RELEASE_EVIDENCE artifact.**

## DECISION RULES

1. **No critical accessibility violations ship.** WCAG AA violations in categories A and AA are release blockers. No exceptions, no deferrals, no "we'll fix it later." Accessibility is a professional obligation, not a preference.
2. **Performance budget overruns are release blockers.** If the experience exceeds the defined performance budgets, it does not ship. Find and implement the fix. Performance is a user experience requirement, not an optimization.
3. **Security vulnerabilities are release blockers.** Any security finding with severity HIGH or CRITICAL is a release blocker. Medium severity requires documented mitigation or accepted risk with stakeholder approval.
4. **Browser compatibility is binary per target.** Either the experience works on the target browser, or it does not. "Works but looks different" may be acceptable for non-critical visual differences. "Works but is broken" is a release blocker.
5. **Unresolved blockers are listed honestly.** Every blocking issue is documented with its exact location, impact, and recommended fix. No hiding issues, no softening language, no "minor" labels on critical problems. The release evidence is an honest document.
6. **QC is independent of implementation.** The QC checker is not the implementer. If the same person implemented and QC'd, they must apply the checklist as if they were reviewing someone else's work. Blind spots are real — the checklist is the countermeasure.
7. **Release evidence is versioned.** Every QC run produces a versioned artifact with timestamp, scope, and results. Previous QC runs are not overwritten — they are referenced. This creates an audit trail of quality over time.

## VALIDATION CHECKS

1. RELEASE_EVIDENCE contains all 6 required sections: accessibility, responsive, performance, browser, security, blockers.
2. Every section has a pass/fail status with specific findings documented.
3. Blockers section lists every issue with severity, location, and recommended fix.
4. Accessibility audit covers at minimum: semantic HTML, keyboard navigation, color contrast, alt text, reduced motion.
5. Performance audit covers at minimum: LCP, CLS, bundle size, page weight.
6. QC timestamp is recorded and versioned.

## FAILURE CONDITIONS

- Critical accessibility violations found → BLOCK release, document violations with WCAG reference.
- Performance budget exceeded → BLOCK release, identify the specific budget overrun and root cause.
- Security vulnerability HIGH or CRITICAL → BLOCK release, document vulnerability with OWASP reference.
- More than 3 unresolved blockers → BLOCK release, recommend focused remediation sprint.

## OUTPUT CONTRACT

### RELEASE_EVIDENCE

```json
{
  "qc_id": "qc-{timestamp}",
  "implementation_ref": "impl-{id}",
  "scope": "string — what was tested (full | partial — specify sections)",
  "accessibility": {
    "status": "pass | fail",
    "wcag_level": "AA",
    "findings": [
      {"severity": "critical | major | minor", "location": "string", "description": "string", "wcag_ref": "string"}
    ],
    "semantic_html": "pass | fail",
    "keyboard_navigation": "pass | fail",
    "color_contrast": "pass | fail",
    "alt_text": "pass | fail",
    "reduced_motion": "pass | fail"
  },
  "responsive": {
    "status": "pass | fail",
    "breakpoints_tested": ["number — pixel widths tested"],
    "findings": [
      {"severity": "critical | major | minor", "breakpoint": "number", "description": "string"}
    ]
  },
  "performance": {
    "status": "pass | fail",
    "lcp_ms": "number",
    "cls": "number",
    "fid_ms": "number",
    "bundle_size_kb": "number",
    "total_weight_kb": "number",
    "budget_compliance": "pass | fail"
  },
  "browser": {
    "status": "pass | fail",
    "browsers_tested": ["string — browser + version"],
    "findings": [
      {"browser": "string", "severity": "critical | major | minor", "description": "string"}
    ]
  },
  "security": {
    "status": "pass | fail",
    "https": "pass | fail",
    "csp": "pass | fail",
    "mixed_content": "pass | fail",
    "exposed_secrets": "pass | fail",
    "findings": [
      {"severity": "critical | high | medium | low", "description": "string", "owasp_ref": "string"}
    ]
  },
  "blockers": [
    {
      "severity": "critical | high | medium",
      "category": "accessibility | performance | security | browser | content",
      "location": "string",
      "impact": "string",
      "recommended_fix": "string"
    }
  ],
  "overall_status": "ready | blocked | conditional",
  "qc_reviewer": "string — who performed the QC check"
}
```

## RELATED SKILLS

- `ex-fnt-component-composition` — produces the implementation this QC validates
- `ex-int-motion-choreography` — interaction plan this QC validates
- `ex-vis-premium-aesthetic-language` — visual system this QC validates against
- `ex-del-revision-approval-workflow` — delivery workflow that triggers this QC gate
- `ex-dply-static-hosting-deploy` — deployment requires passing QC first
- `aid-double-check-everything` — general verification discipline (composes with this QC)
- `web-builder-production-canary` — canary testing for model outputs (different domain)
