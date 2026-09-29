# Covert capability system inventory and reconciliation — 2026-09-29

## Scope and authority

This is a read-only architecture inventory and first-pass reconciliation of the supplied Covert Capability Expansion Package against repository truth. It records architecture input; it does not install the package as accepted product state, alter the runtime, certify catalog rows, or change the convergence priority.

Repository identity at inspection: `E:\covert-nightshift-integration`, branch `nightshift/production-convergence-20260926`, exact source/checkpoint SHA `54b3e74d8708eb3821d1003fc572c8e7bbe70e1b`. The checkout was clean, exact-SHA AIDE CI run `36528510949` was green, and Issue #38 still directs the Model Access/provider lifecycle and release spine ahead of capability implementation.

## Package integrity and target

- All 12 entries in the package SHA-256 manifest matched their contents.
- `catalog/skill_catalog_1000.csv` has 1,000 unique IDs in a 25-domain × 40-operation grid. All rows remain `PROPOSED_RECONCILE`.
- Catalog SHA-256: `1b063e6d3339a8961044327bd4a43ad9031a0ce77c7bef88abb50445cbf54ad7`.
- The catalog's descriptions, triggers, negative triggers, outputs, verification, and status use repeated templates. The catalog is a reconciliation target, not evidence those capabilities exist.
- The supplied schema requires `id`, `name`, `version`, `domain`, `description`, positive and negative triggers, prerequisites, outputs, verification, and risk. Optional fields include tools, offline capability, context cost, and governing SOPs.

## Repository inventory

### Skills and registry

- `skills/registry.json` declares **309** entries; `skills/packs` contains **309** tracked `SKILL.md` files. Names and paths are unique, every registry path resolves, and each declared name matches its file frontmatter.
- There are 13 registry categories. The generated registry fields are only `name`, `title`, `description`, `category`, and `path`; 76 entries have an empty description.
- **0/309** registry entries satisfy the supplied structured contract. Every entry lacks `id`, `version`, `domain`, `triggers`, `negative_triggers`, `prerequisites`, `outputs`, `verification`, and `risk`. This is a metadata/certification gap; it does not mean the existing skill bodies contain no useful procedures.
- `scripts/sync-skills.mjs` copies the configured skill source (default `C:\Users\Grey_\.agents\skills`) into `skills/packs`, extracts only `name` and `description`, assigns one of 13 categories, and writes the flat registry. It does not validate the supplied contract, semantic duplicates, license/provenance, dependency references, or versions.
- Existing doctrine includes `skills/packs/developer-way/SKILL.md`, `skills/packs/developer-discipline-engineering/SKILL.md`, `skills/packs/aide-credo-guardrail/SKILL.md`, `skills/packs/aide-skill-curation/SKILL.md`, and `skills/packs/covert-context-control/SKILL.md`. The Developer's Way already exists as operating doctrine; formalization should consolidate and version the canonical procedure instead of adding a duplicate skill.

### Context Control and skill loading

- `node/src/services/skills-loader.mjs` reads registry metadata at service construction, uses token overlap (`MIN_SCORE=3`), selects at most three matches, and injects up to 1,200 JavaScript characters from each selected body. It does not parse positive/negative triggers, use a token-budget cost model, report candidates/rejection reasons, or return why a skill was selected.
- `node/src/openapi.ts` wires the loader into the resident agent and chat context with the current workflow stage appended. `node/src/services/agent-loop.mjs` and `node/src/services/chat-context.ts` label skill content as advisory, not authority. Execution remains bound to existing tool/Authority paths.
- Skill context is lazy at the body level: registry metadata is loaded broadly, selected bodies are read on demand. Selection is not currently inspectable as a capability decision. The attempt journal binds the assembled system-context digest and block names; `SKILL_SELECTED` records status and block count, not canonical skill IDs or selection reasons.
- `browser/src/panels/skills.ts` is an honest degraded placeholder. There is no `/api/skills` route for registry search, body inspection, or a “why loaded?” explanation.
- No direct test for `createSkillsLoader` or positive/negative route decisions was found. `tests/arch/chat-context.test.ts` checks injected skill context using a supplied provider; `tests/arch/closed-loop-mission.test.ts` checks the prompt boundary. These do not certify registry selection. The existing workflow and onboarding suites do test their own contracts, Authority, persistence, and restart behavior.

### Workflows, packs, and orchestration

- `node/src/services/workflow-service.ts` plus `common/contracts/workflow.ts` implement a durable project process: six ordered stages (`DISCOVERY` through `DEPLOYMENT`), seven artifact types, digest-bound references, deterministic validation, audited transitions, and Authority-controlled mutations.
- This is a project/release workflow engine, not a registry of capability packs. No capability-pack registry corresponding to the package's 12 initial packs exists.
- `workbenches/` has three installable workbench manifests (`sovereign-coder`, `sovereign-architect`, `sovereign-pipeline`). Their workflow steps combine skills, tasks, gates, models, plugins, and optional MCP recommendations. They are useful composition precedent, not substitutes for the requested candidate-only capability packs.
- The product has two orchestration boundaries: the live `node/src/services/agent-loop.mjs` and the harness orchestration under `harness/`. Capability selection belongs at the existing Context Control/agent context boundary, not in a duplicate plugin or second authority service.

### Authority, tools, plugins, and Model Manager

- `node/src/services/execution-authority.mjs`, route descriptors, and the Model Manager/Model Router own execution eligibility, consent, Local-Only, and dispatch. Skill text is advisory and cannot grant tool, provider, or file authority.
- Agent tools and existing task/plugin/workbench managers expose repository-owned execution surfaces. The package's capability system must work without ChatGPT/Codex plugins; any external tool/provider remains optional and subject to the existing Authority boundary.
- Model routing and provider setup are separate from skill selection today. The exact Model Access/OpenCode route is the current release work and should remain the gating dependency.

### Operator configuration, onboarding, and persistence

- No canonical persisted behavior-setting `OperatorProfile` contract with field provenance was found. `browser/src/cockpit/OperatorIdentity.ts` does define an `OperatorProfile`, but its file header and types constrain it to Resident appearance/presentation (engineering, security, research, creative); it explicitly owns no model selection, workflow state, execution, authority, permissions, or verification. Existing operator configuration is split across workbench choice, onboarding, provider connections, routing preferences, egress consent, credential storage, and workspace settings.
- `common/contracts/onboarding.ts` and `node/src/services/onboarding.mjs` implement a resumable five-step flow (`welcome`, `privacy`, `byok_optin`, `desktop_optin`, `system_map`). Stored choices are name, role, workbench, optional provider ID, a key-stored boolean, and desktop opt-in. Credentials remain in the separate secure credential path.
- Existing onboarding does not establish the package's full profile set (repo/languages/tools, local/cloud/hybrid preference, hardware/model inventory, autonomy, approval boundaries, testing/CI conventions, and capability-pack preferences), and profile values lack the proposed provenance enum.
- Onboarding and workflow state have durable persistence and restart coverage; provider state uses its own secure/settings owners. The skill registry is generated on disk and read at service construction. There is no persisted project/operator skill profile, pack preference, routing explanation, or durable per-skill selection record.

## First-pass reconciliation

The accompanying [coordinate CSV](capability-coordinate-reconciliation-2026-09-29.csv) assigns one triage class to every catalog ID and records candidate skill IDs plus rationale. Counts:

| Class | Count | Interpretation |
|---|---:|---|
| `PARTIALLY_SATISFIED` | 146 | Related domain skill text was found; the coordinate still lacks the supplied contract and coordinate-level routing certification. |
| `WORKFLOW_COMPOSITION` | 400 | Multi-step coordinates belong in workflow/pack composition. The class is an architectural disposition, not a claim that all target packs exist. |
| `SOP_GOVERNED` | 175 | Cross-cutting review/repair procedure should be governed once by the named SOP family; domain-specific checks still need proof. |
| `NOT_APPROPRIATE_AS_SKILL` | 100 | Unit/integration/e2e verification and evidence capture should be deterministic gates/evidence surfaces, not prompt-only skills. |
| `MISSING_HIGH_VALUE` | 166 | No operation-specific domain match; prioritized because the row is high risk or its domain is on the software-product/release path. |
| `MISSING_LOW_VALUE` | 13 | No operation-specific match in the game-development family; these medium-risk coordinates are lower priority until profile/usage evidence says otherwise. |
| `SATISFIED_EXISTING` | 0 | No row can be accepted against the new contract yet. |
| `SEMANTIC_DUPLICATE` | 0 | No semantic duplicate is asserted without a reviewed equivalence. Unique IDs do not prove semantic uniqueness. |

**Triage limits:** candidate search used a curated domain-to-skill map and operation terms over current skill bodies. It is a review aid, not a runtime router. `PARTIALLY_SATISFIED`, `WORKFLOW_COMPOSITION`, and `SOP_GOVERNED` do not mean certified or release-ready. The class-priority heuristic is explicit in each row; operator usage data may change high/low priority. All 1,000 catalog statuses remain proposed.

## Architecture gaps

1. Skill metadata is under-specified and unversioned; no supplied-schema validator, reference checker, license/provenance fields, or semantic-duplicate review exists.
2. Discovery is a simple token-overlap score with no positive/negative triggers, ambiguity/conflict handling, pack narrowing, context cost model, or explainability.
3. Lazy body loading exists in basic form, but context budgeting is a fixed character cap rather than the active model's context budget. Candidate count, injected token count, chosen skill IDs, and reasons are not exposed together.
4. Selection has no direct positive/negative, multi-domain, unavailable-tool, offline/privacy, budget-pressure, malformed-entry, dependency-cycle, migration, or restart certification.
5. No capability-pack registry or operator profile is integrated into routing. Existing workbenches are larger product distributions with workflows, plugin/MCP recommendations, and model defaults.
6. Adaptive onboarding and the requested profile/provenance fields are not connected to skill selection. Existing secure credential and Authority boundaries must remain separate and non-overridable.
7. The UI exposes the gap honestly but has no inspect/search/explain/edit surface for skills or packs.

## Dependency-ordered implementation plan

### Keep the production spine first

1. Finish the current Model Access / Provider Adapter Lifecycle checkpoint at the exact pushed source SHA. Deterministic local tests and CI are green; live provider use and release acceptance remain open.
2. Keep the OpenCode model route `UNKNOWN` until exact pinned-model support, availability, consent/Local-Only checks, Authority/Admission, stream identity, cancellation/timeout/error cleanup, and a receipt are observed end to end.
3. Verify persistence and restart/recovery for that same verified model/route identity. Live execution requires the authorized managed-auth path and spend cap; do not inspect or expose credential contents.
4. Continue the higher-priority install, terminal/TUI, onboarding, recovery, and release gates called out in Issue #38. Do not begin capability runtime implementation while those release dependencies are still open.

### Capability phase after release dependency gates

5. Freeze the 309-entry inventory and review the 1,000-row triage with exact skill-body evidence. Keep canonical IDs; resolve true semantic duplicates before adding capabilities. Record source/license/provenance and version every accepted registry entry.
6. Formalize the Developer's Way as one versioned governing SOP mapped to current deterministic gates and Authority. Reuse the existing doctrine and do not copy it into each skill.
7. Introduce the supplied strict metadata contract through a versioned, generated registry. Validate unique IDs, schema, dependencies, cycles, migration behavior, and provenance. Keep candidate metadata cheap to inspect and skill bodies lazy.
8. Add curated candidate packs for the 12 requested families as references to canonical IDs. Packs narrow candidates; Context Control still selects only the minimal task-relevant set.
9. Replace keyword-only selection with inspectable task/repository/profile/phase/risk/tool-aware candidate filtering, explicit positive and negative triggers, privacy/offline constraints, and model-context-budget-aware loading. Record why each skill loaded and expose it through a truthful UI/API surface. Preserve the existing Authority and Model Manager seams.
10. Extend onboarding progressively into an Operator Profile with `USER_STATED`, `REPO_OBSERVED`, `TOOL_DISCOVERED`, `DEFAULT`, and `INFERRED_PENDING_CONFIRMATION` provenance. Configure credentials through the secure boundary; preferences cannot weaken Authority, Local-Only, protected paths, or release gates.
11. Certify schema/reference integrity, semantic duplication, positive/negative/ambiguous/multi-domain routing, unavailable tools, conflicts, offline/privacy behavior, context pressure/token accounting, lazy loading, dependencies/cycles, malformed entries, migration, restart persistence, and a representative golden plus adversarial task per capability family.
12. Prove the clean-user install → onboarding/profile → provider/model → project → capability routing → governed mission → verification/receipt → restart/persistence journey on a clean environment before claiming capability coverage or release acceptance.

## Checkpoint evidence for this inventory

- Production checkpoint evidence: `docs/nightshift/evidence/model-access-authority-route-2026-09-29.md`.
- Capability catalog matrix: `docs/nightshift/research/capability-coordinate-reconciliation-2026-09-29.csv`.
- This report is repository-grounded design/reconciliation evidence only. It is not Covert release evidence and it changes no product runtime behavior.
