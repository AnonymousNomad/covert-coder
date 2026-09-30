# Covert Production Directive — Research, Skills, and Context Control Addendum

Authority: same as `COVERT_CODER_STANDING_DIRECTIVE.md`, subject to current developer instructions and accepted architecture. Applied 2026-09-26 America/Chicago.

## Research to execution

For each substantial or unfamiliar production phase: **Ground → inspect existing skills → research → build or improve only justified skills → construct working context → execute → verify → record evidence.** Research current authoritative material whenever changing APIs, provider behavior, security, privacy, desktop/OS behavior, packaging, performance, or competitor claims affect correctness. Establish required behavior, normal implementation, rationale, dependencies, boundaries, threats, edge cases, compatibility, performance, forbidden paths, test strategy, rollback, and acceptance. Then execute; research cannot delay a well-grounded repair indefinitely.

## Skill-first discipline

Search the project registry, SOPs, accepted notes and workflows before a major subsystem change. Reuse a correct procedure; amend an incomplete one; create a new project-specific skill only for distinct reusable technical responsibility. Avoid duplicate names and administrative clutter. A production skill should supply the relevant purpose, trigger, prerequisites, boundaries, inputs/outputs, procedure and rationale, forbidden approaches, failure modes, threats/privacy/resources, pause/stop conditions, rollback/recovery, tests, expected evidence, acceptance, compatibility and sources. Determine phase-specific skill count from genuine coverage gaps, never a quota.

## Competitive evidence

Research current serious AI IDEs, coding agents, terminal agents, local/private multi-model tools and orchestration systems using concrete current capability evidence. Compare architecture where documented; BYOK/local support; models; agents; repository context; terminal/Git/debugging; tool calling; planning/workflows; MCP/plugins; privacy/safety; observability; recovery; installation; collaboration; performance; UX; pricing constraints and limitations. Maintain a **Covert Competitive Capability Matrix** with statuses: implemented and verified; implemented but insufficiently verified; partially implemented; planned; intentionally different; unnecessary; missing. No artificial wins or feature-count parity. For a justified gap: establish user need and architectural fit, research, skill, implement, test, compare actual runtime, record evidence.

## Mandatory Context Control

Principle: **Minimum sufficient context. Maximum reliable execution.** A dedicated `covert-context-control` project skill must govern how agents build, reduce, refresh and hand off working context; it must respect Covert's existing Context Control Engine ownership, never duplicate it.

For each work unit:

1. State subsystem, exact problem, outcome and acceptance criterion.
2. Retrieve exact symbols, tests, recent commits, accepted decisions, skills and evidence; expand only on discovered dependency.
3. Compress history into source-linked verified facts; keep unrelated material retrievable.
4. Separate `REPOSITORY` current code, `ACCEPTED` project decision, `RUNTIME` observation, and `HYPOTHESIS` pending verification.
5. Drop superseded branches/implementations/tests from active truth while preserving architecture, Authority, security, data ownership, migrations, release blockers and destructive-operation restrictions.
6. Keep a compact Execution Context Packet for complex phases: mission, SHA/worktree, rules, skills, modules, dependencies, failures, acceptance, verification.
7. Refresh after branch/merge/concurrent change, contradiction, changed dependency or resumed session.
8. Execute as much coherent verified work per context window as safely possible; checkpoint before changing domains.

Handoffs must convey objective, worktree/SHA, completed and pending work, constraints, skills, tests/results, failures, blockers, next action and prohibited actions. Never transfer a raw conversation history when a compact verified handoff suffices. Select models for reasoning/risk/cost and give stronger models cleaner context. Research that recurs belongs in skills, SOPs, matrices, notes, tests or fixtures.

## Working consolidation

Keep the active `docs/nightshift/COVERT-NIGHTSHIFT-EXECUTION-LEDGER.md` concise: current phase, goals, skills, research, repo state, implementation, tests, evidence, blockers, dependencies, competitor gaps, next actions. Use a short packet per complex slice and dated evidence receipts. It is operational memory, not a repository dump or a replacement for the product Context Control Engine.

## Final standard

Research once; encode durable procedure; retrieve narrowly; execute deeply; verify aggressively; checkpoint compactly; reuse what was learned. Close the loop from research to procedural intelligence to implementation to evidence to reusable capability. Maximize correct work from the minimum sufficient context.

## Supplemental first-run intelligence pack — 2026-09-29

Imported additively at `docs/production-closure/first-run-intelligence-2026-09-29/`. This guidance extends the production bundle without replacing this addendum, the standing directive, accepted architecture, or active release work.

The owner-supplied `OWNER_SUPPLEMENTAL_DIRECTIVE_AND_ACCEPTANCE_GATES.md` beside the pack adds concrete FR0–FR17 release gates. Those gates remain `UNVERIFIED` until exercised through the real packaged product.

- Finish dependency-ordered production and release-closure blockers before broad first-run implementation, unless a specific active release gate requires it.
- Reconcile the bootstrap stages against the existing Setup Session, Model Manager/Model Access, Runtime Broker, credential, Context Control, onboarding, memory, workflow, project import, and Authority owners. Do not create parallel systems.
- Keep model packs opt-in; a downloaded or discovered model remains unqualified until exact identity, artifact integrity, runtime and required role evidence pass. Preserve unavailable selected targets for an explicit user decision.
- Treat imported conversations and preferences as provenance-tracked candidate context for user review. Credentials and private user data are not training data by default.
- Treat candidate model notes as research inputs only. Benchmark exact revisions on target hardware and review current license and redistribution terms before recommendation or bundling.
- Benchmark Resident candidates before selecting or tuning; improve prompting, context and orchestration first, and fine-tune only for measured persistent deficits.
