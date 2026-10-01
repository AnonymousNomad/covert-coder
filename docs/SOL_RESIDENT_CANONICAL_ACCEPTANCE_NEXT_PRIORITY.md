# SOL NEXT PRIORITY DIRECTIVE — RESIDENT ASSISTANT CANONICAL ACCEPTANCE

Date: 2026-10-01
Owner: James Ferrell
Target: Covert Coder release convergence
Branch: nightshift/production-convergence-20260926
Priority: NEXT FOCUSED PRODUCT/INTELLIGENCE AUDIT

## Mission

Treat the Resident Assistant as the next critical acceptance target.

Resident is the operator-facing intelligence/control plane that must make the rest of Covert feel like one coherent system:

USER
  -> RESIDENT
  -> CONTEXT CONTROL ENGINE
  -> WORKFLOW ENGINE + SKILL INTELLIGENCE
  -> ORCHESTRATOR
  -> EXECUTION AUTHORITY
  -> HARNESS / VERIFICATION
  -> EVIDENCE / FINAL RESPONSE

Do not make Resident a god object.

Resident must NOT duplicate:
- model routing;
- Context Control;
- memory storage;
- skill selection;
- workflow state authority;
- Execution Authority;
- desktop executor;
- verification;
- audit persistence.

Resident should observe, explain, request, coordinate, render, and maintain conversational continuity over those governed subsystems.

## Current repo truth to preserve

Current code already establishes important boundaries:

- `node/src/routes/resident.ts`
  - Resident v0 is read-mostly/advisory;
  - Slice 8 explicitly defines Resident as OBSERVE / EXPLAIN / REQUEST;
  - workflow probe exposes `load`, `buildTransitionRequest`, `evaluateTransition`;
  - it deliberately excludes `applyTransition`;
  - all workflow transitions require operator authority.

- `common/contracts/resident.ts`
  - strict typed Resident state/contracts exist.

- `tests/arch/resident-routes.test.ts`
  - deterministic health/context/push-summary behavior is already tested.

- `docs/audit/intelligence-spine/RESIDENT_AUDIT.md`
  - historical audit correctly warns that Resident must not absorb router/memory/policy/tools/verifier responsibilities.

- `docs/audit/intelligence-spine/REMEDIATION_ROADMAP.md`
  - 2C defines the required canonical Resident/conversation entry;
  - one workflow ID must trace user input through normalization, context, inference, permission, execution, verification and final response.

Do not regress these laws.

## Why this is next

Covert cannot credibly claim a Resident-first product if ordinary chat, planning, code changes, verification, Telegram, voice, desktop control, and future headless clients can silently enter different intelligence/authority paths.

The next acceptance target is therefore NOT "make Resident prettier."

The target is:

**prove that Resident is the canonical operator-facing entry and continuity layer over one governed request lifecycle.**

## Required Resident acceptance battery

### R1 — Ordinary conversation

From the actual Covert Resident UI:

- send a non-mutating ordinary question;
- receive a streamed answer;
- prove no tool/mutation authority was granted;
- record model identity;
- record request/session/workflow correlation ID;
- preserve cancellation.

Expected:
- conversational answer;
- zero unintended mutation;
- direct-model/read-only mode clearly represented where applicable.

### R2 — Repository question

Ask a repository-specific factual question.

Prove:

- current project/revision identity;
- Context Control selected current evidence;
- relevant file/source provenance is visible;
- stale memory cannot override current repository truth;
- selected context survives final prompt fitting;
- answer can be traced to the request ID.

### R3 — Planning-only request

Ask Resident to plan a change but not execute it.

Prove:

- intent becomes PLAN/read-only workflow behavior;
- tools with mutation capability are unavailable or denied;
- proposed files/steps are visible;
- zero workspace mutation;
- plan state is distinct from executed state.

### R4 — Approved code change

From the normal Resident surface:

1. user requests a bounded code change;
2. Resident enters the canonical governed workflow;
3. Context Control assembles evidence;
4. relevant skills/SOPs are selected;
5. planner/coder path operates under explicit permissions;
6. mutation requires the correct approval;
7. exact approved action executes;
8. verification runs;
9. Resident reports the real outcome.

Acceptance requires one correlation/workflow ID across:

- user request;
- normalized intent;
- context manifest;
- skill selection;
- model invocation(s);
- approval;
- tool calls;
- changed files;
- command/test results;
- verifier result;
- final Resident response.

### R5 — Denied change

Repeat a real mutation request and DENY approval.

Prove:

- no mutation occurs;
- no alternate route bypasses denial;
- Resident reports DENIED/REJECTED, not failed or complete;
- audit/evidence records the denial;
- model cannot mint authority via arguments such as `approved:true`.

### R6 — Verification request

Ask:

"Verify this change."

Prove Resident distinguishes:

- executed;
- tested;
- verification unavailable;
- verification failed;
- verified.

Missing evidence must never become VERIFIED.

### R7 — Failure / repair

Use an isolated fixture that deliberately fails a deterministic check.

Prove:

- Resident does not announce completion;
- failure evidence returns to the governed repair loop;
- bounded repair attempts are visible;
- final state is truthful if repair fails.

### R8 — Cancellation

Cancel:

- during model generation;
- before approval;
- during a cancelable tool/runtime task where supported.

Prove:

- terminal state is consistent;
- no late mutation executes after cancellation;
- Resident UI, backend state, audit and evidence agree.

### R9 — Degraded dependencies

Test Resident with:

- model unavailable;
- model artifact present but runtime stopped;
- LSP unavailable;
- no Git repository;
- dirty Git state;
- Context Control failure;
- skill selection failure;
- memory unavailable;
- verifier unavailable.

Resident must explain what is unavailable without inventing facts or marking the whole system healthy.

### R10 — Model fallback / route change

Force a legitimate model-route failure/fallback.

Prove Resident exposes:

- requested role/model;
- actual model invoked;
- fallback reason;
- runtime/fit state;
- no silent model substitution.

### R11 — Context pressure

Use a deliberately constrained context window.

Prove:

- current user task survives;
- Context Control budget is honored;
- selected context provenance reflects what was ACTUALLY served, not pre-fit intent;
- Resident can explain dropped context/reason;
- stale/low-priority information loses before the active task.

### R12 — Skills / SOP provenance

Use a task that should load a known SOP.

Prove:

- skill name/version/reason selected;
- actual loaded content/hash;
- content survived prompt fitting;
- no-match is distinguishable from loader failure;
- model following the skill is not assumed merely because it was injected.

### R13 — Memory truth hierarchy

Create an isolated stale-memory fixture contradicting current repository truth.

Prove:

current repository evidence > verified recent state > memory summary > old assistant prose.

Resident must not fossilize stale claims.

### R14 — Desktop control convergence

From Resident, request a bounded desktop action using the existing desktop-control path.

At minimum eventually include:
- read-only desktop observation;
- `desktop.lock` once implemented.

Prove:

- Resident does not execute directly;
- request becomes a typed capability proposal;
- Execution Authority owns permission;
- desktop service owns execution;
- audit/evidence owns receipt.

Voice and Telegram must eventually hit this SAME path.

### R15 — Telegram transport convergence

A Telegram request and an equivalent Resident UI request must normalize into the same governed capability/workflow path where semantics are equivalent.

Do not preserve a separate Telegram brain with different powers.

### R16 — Voice transport readiness

Voice V1 may remain pending, but Resident acceptance must leave a clean transport seam:

STT text -> same Resident request contract.

No voice-only authority or memory.

### R17 — Restart / continuity

After a safe restart:

- conversation/session continuity behaves according to declared policy;
- workflow state is not fabricated from UI memory;
- pending approval does not silently become approved;
- current model/runtime state is freshly observed;
- Resident does not replay a stale "ready" state.

### R18 — Startup presence

When voice is later wired:

- greeting is deterministic local presentation state;
- no LLM call required;
- no context pollution;
- no fake readiness claim;
- if Covert is degraded, greeting/status must not say fully ready.

## Resident state vocabulary

Do not reduce everything to READY / ATTENTION once a governed workflow is active.

Resident must be able to represent truthfully, where applicable:

- OBSERVED;
- READY;
- DEGRADED;
- PLANNED;
- AWAITING_APPROVAL;
- APPROVED;
- DENIED;
- EXECUTING;
- EXECUTED;
- VERIFYING;
- VERIFIED;
- UNVERIFIED;
- FAILED;
- CANCELLED;
- BLOCKED;
- UNAVAILABLE.

These labels must be projections of canonical backend state, not UI-invented status.

## Canonical interaction modes

One Resident conversational surface may support modes/intents such as:

- ASK;
- PLAN;
- BUILD;
- DEBUG;
- REVIEW;
- VERIFY.

These are modes of one governed request system.

Do NOT create separate chat implementations for each mode.

Explicit DIRECT MODEL mode may exist, but it must be visibly distinct and must not silently gain tools/workflow authority.

## Resident provenance receipt

Every nontrivial Resident request should be able to expose a compact receipt containing:

- request ID;
- session/workflow ID;
- timestamp;
- workspace/project/revision;
- intent/mode;
- selected model(s) and actual invoked model(s);
- selected context manifest/aperture;
- selected skills/SOPs;
- permission level;
- requested capability/tool;
- approval identity/state;
- changed files;
- commands/tool calls;
- tests/verifier evidence;
- fallback/degradation;
- final status.

The normal UI can summarize this.
Raw evidence remains available for audit.

## Resident must use current product truth

Resident should become the primary explanation surface for:

- model state;
- workflow state;
- Context Control;
- selected skills;
- memory provenance;
- verification;
- Git/project state;
- runtime health;
- current blockers;
- recommendations;
- approvals.

But it should CALL canonical services for those facts.

Never mirror them into an independent Resident truth store.

## Test layers required

Sol should leave evidence at multiple layers:

1. unit/pure contract tests;
2. route/service integration;
3. actual facade/typed browser client;
4. real browser Resident interaction;
5. real local-model transaction;
6. negative authority tests;
7. restart/recovery test;
8. external hidden/verifier acceptance where mutation is involved.

A rendered Resident panel is not acceptance.

A mocked model transaction is not real-model acceptance.

A direct backend call is not proof the product UI uses the path.

## Existing tests are foundation, not completion

Preserve and extend:
- `tests/arch/resident-routes.test.ts`;
- cockpit acceptance;
- workflow/authority tests;
- context/skills/memory tests;
- agent/verification tests.

Do not rewrite old passing tests merely to make a new path green.
Add focused regressions for newly established Resident behavior.

## Stop / fail conditions

Stop and report OPEN if:

- Resident needs to become its own executor;
- a second agent framework is required;
- a mutation route bypasses common Authority;
- normal chat still bypasses required governance;
- context/skill provenance is unavailable after fitting;
- final status disagrees with verifier/evidence;
- real local-model identity cannot be proven;
- cancellation can race into late mutation;
- the change requires broad UI redesign before backend semantics are proven.

## Acceptance statement

The Resident gate passes only when we can truthfully demonstrate:

> A user can begin with the normal Covert Resident, ask a question, plan work, approve or deny a bounded change, execute through canonical Authority, verify the result, inspect what context/skills/models were used, and receive a final response whose status matches durable evidence — all under one correlated request lifecycle.

That is the Resident product contract.

## Relationship to recent directives

This Resident acceptance gate is upstream of the newer product ideas:

- Hugging Face model intelligence feeds Resident-visible model truth.
- Harness Sync feeds Resident-visible evidence.
- Harness effectiveness reports can be explained by Resident.
- PocketPal/ToolNeuron voice becomes another Resident transport.
- Telegram becomes another Resident transport.
- Desktop control remains one Authority-owned capability set.

Do not implement voice, Telegram expansion, or new model UX in a way that creates another intelligence/control path around Resident.

