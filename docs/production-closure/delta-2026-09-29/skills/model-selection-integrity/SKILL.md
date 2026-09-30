---
name: covert-model-selection-integrity
description: Preserve exact provider/model/role/project/conversation target identity across UI, persistence, restart, routing, and execution. Use when changing model selectors, provider discovery, defaults, role routing, or fallback behavior.
---

# Covert model selection integrity

## Objective

Prove that an operator's exact target selection survives every layer without silent substitution.

Treat these identities as separate unless the accepted contract explicitly binds them: logical model, artifact/source, provider family, provider/account connection, exact `provider_model_id`, credential source, adapter, runtime, qualification state, role target, project target, conversation target, and execution route.

## Invariants

1. A persisted exact target remains the same exact target after reload and restart.
2. An unavailable or unverified target remains visible as unavailable/unverified; it is not rewritten to `local`, first-ready, default, or another provider.
3. Editing one role or scope cannot mutate another role or scope.
4. Dynamic-catalog models and static models use the same canonical target contract after selection.
5. Fallback, when explicitly supported, is a separate operator-visible decision with reason and evidence; it never masquerades as preservation of the original target.
6. Passive reads do not start providers or convert discovery into verification.
7. UI labels distinguish connection availability, catalog presence, exact-model verification, qualification, readiness, and selected scope.

## Procedure

1. Ground the current selection contract and persistence owner. Trace UI -> API -> contract -> persistence -> Model Manager/Router -> execution adapter.
2. Enumerate every scope that can select a model: product default, project, role, conversation/session, operator override, or other implemented scope.
3. Build a table of legal states for each target: missing, discovered, unverified, verified, unavailable, requires preflight, qualified, ready, selected, denied, stale.
4. Reproduce any mutation/fallback defect before repair.
5. Make the smallest correction that preserves canonical identity. Do not add a second selector when one existing control can truthfully represent the same contract.
6. Add negative tests for missing option, provider disconnect, catalog drift, stale verification, deleted artifact, role change, project reload, conversation reload, and restart.
7. Verify serialized state directly. A rendered label alone is insufficient.
8. Verify the execution request contains the same exact target identity and that Authority/Admission can deny it without rewriting it.

## Required acceptance cases

- Select exact OpenCode model A; change unrelated role B; A remains exact A.
- Persist OpenCode model A; restart; A remains selected even if currently unavailable.
- Remove A from live catalog; selection remains A with truthful unavailable/unverified state.
- Discover A; route remains closed until exact-model verification succeeds.
- Verification becomes stale after relevant restart/change; execution is denied until reverified according to contract.
- No selector option maps an unknown target to `local` or another ready model.
- Conversation/project/product-default scope is visible and testable.

## Evidence

Record source SHA, exact serialized target before/after, API request/response identity, restart result, negative cases, Authority/Admission result, and runtime target if execution is reached. Redact credentials; record only references.

Accept only the tested scope. If an existing target cannot be represented without mutation, classify `CHANGES_REQUIRED` rather than inventing a fallback.
