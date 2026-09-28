# Covert Coder — Post-Overnight Convergence Addendum

Owner instruction recorded 2026-09-28. This addendum narrows the next execution phase
and remains subject to current owner direction and accepted architecture.

## Effective checkpoint

- Canonical worktree: E:/covert-nightshift-integration
- Branch: nightshift/production-convergence-20260926
- Intake HEAD: b0f0a729e7b1bc72f4e7dfa4f18d8d13b8873798
- PR #31 protected head: b79d2480498e446cff36b26dd4b4faef7745726b
- PR #31 stays frozen and receives no unrelated local work.

The objective is converge → certify → ship. Keep the convergence worktree stable before
branch integration. Inventory tracked and untracked work, classify each item as harness
comparison, production-closure directive/evidence, current release implementation,
stale/duplicate, or unrelated. Preserve valid work, commit or explicitly park bounded
coherent units, and do not merge while the canonical worktree is dirty. Do not discard
unknown changes, force-reset, or force-push.

## Publication path

The convergence branch currently tracks the old route-drift upstream. After the current
state passes required local gates, publish the actual nightshift/production-convergence-20260926
branch to origin, establish the matching remote upstream without force, and obtain GitHub CI
on that exact SHA. A local architecture pass is not repository CI.

## Mission Receipt contract

Preserve the accepted MISSION_RECEIPT_READY improvement: readiness follows terminal attempt
finalization and provenance persistence; mixed-run missions cannot claim mission-wide
verified success. Finish canonical joins without introducing a parallel truth store.
Resolve or explicitly report UNKNOWN for:

- operator objective and stable mission identity;
- worker identity, model, provider and role;
- Skills/SOP identifiers and versions;
- Authority permits and scopes;
- operation terminal states;
- changed-file set, diff digest and commit identity where applicable;
- deterministic verification verdict and evidence references;
- final classification: SUPPORTED, PARTIAL or REJECTED;
- known limitations.

Never infer absent data from timestamps, transcripts, nearby events or model prose.
Reference canonical existing records instead of copying them into a second truth store.

## Mission Receipt acceptance

Contract and unit tests do not close product acceptance. Prove this real journey on the
candidate:

fresh governed project → Resident objective → selected worker/model → Authority permit →
real mutation → deterministic verification → persisted provenance → Mission Receipt →
application restart → receipt recovery with canonical fields unchanged.

Also prove that worker prose cannot create SUPPORTED; Veritas failure yields REJECTED;
mixed verified/failed runs do not yield mission success; another project cannot resolve
this project's receipt; restart does not need transcript replay; mutation/diff/commit
fields are evidence-backed.

## Model Manager and Model Access Fabric

Do read-only diff/reconciliation before integration for feat/model-manager,
feat/covert-universal-intelligence-v1 and release/subscription-provider-certification.
Do not whole-merge stale branches. Identify the smallest dependency-ordered slices for
Model Manager contracts, provider connections, credential-source metadata, subscription
transports, OpenCode bridge, onboarding, discovery, project/role model selection,
Authority/Admission boundaries, streaming/cancellation and provider/account health.

Preserve separate concepts: model, provider route, credential source and execution adapter.
Do not hard-code a model to one provider.

## Immediate OpenCode acceptance target

Prove Covert → Model Manager / Model Access Fabric → OpenCode adapter → OpenCode Go →
DeepSeek V4.1 Flash → real bounded coding task → streamed result → Authority → Veritas →
Mission Receipt. This is a real task, not a fixture-only response.

Evidence includes exact Covert SHA, OpenCode version, provider/account type without secrets,
model identity, execution adapter, workspace, task, context/scaffold hashes where applicable,
Authority permit, stream, cancellation behavior, Veritas result, receipt ID and process cleanup.

Credential rules: owner supplies a filesystem path only; never print, commit or capture
credential contents in screenshots, logs or evidence. Validate missing/invalid credential
behavior. Do not exceed an existing recorded spend budget.

## First-user acceptance on the candidate

Re-run this journey against the integrated candidate; historical SHA evidence does not transfer:
clean user state → install/launch → adaptive setup → connect subscription/API/local source →
recommendation → model READY → create/open project → natural-language Resident objective →
plan → approval → execution → changed files → tests → Veritas → Mission Receipt → restart →
recovery.

## CP01–CP18 candidate matrix

Independently resolve these on the candidate; do not inherit PASS from another SHA:

- CP01 shell/navigation/security/approvals
- CP02 projects/workspaces
- CP03 editor/files
- CP04 terminal
- CP05 Resident/chat/context
- CP06 intelligence/Model Manager/local models
- CP07 providers/routing
- CP08 tools/integrations
- CP09 workflows/missions/evidence
- CP10 Authority state transitions
- CP11 onboarding/settings/persistence
- CP12 themes/accessibility
- CP13 system health
- CP14 telemetry/resources
- CP15 Git/development operations
- CP16 Desktop Control
- CP17 failure/offline/recovery UX
- CP18 shutdown/restart/persistence/recovery

## Browser/pairing E2E

Close the authenticated Playwright path: supervised launch, pairing, authenticated cockpit,
real navigation, project open, Resident interaction, editor, terminal, settings, model/provider
surface, approval, reload, restart, credential-leak check and false-ready UI check. Add it to
candidate regression testing.

## Live Resident streamed acceptance

Use the real-engine streamed path. Verify dirty text never escapes before containment,
stream output is not duplicated, cancellation works, failed/rejected output remains
contained, accepted output equals the persisted record, and worker/model failure cannot
create false success. Stub-only proof is insufficient.

## Local-model acquisition

Complete catalog/recommendation → license/source/revision visibility → download →
resume/cancel → SHA verification → GGUF validation → registration → compatibility →
qualification → READY → inference → restart → inference. Resolve or explicitly classify
duplicate registry entries, stalled/in-app downloads, incomplete .part files, final model
storage location, and upgrade/uninstall preservation. Do not resume the 60-completion
harness pilot until its resource gate passes and grader isolation is safe.

## Packaging and release engineering

After core convergence stabilizes, close canonical identity and version ownership,
upgrade identity, approved icons, reproducible desktop build, Node/runtime staging,
model/runtime policy, SBOM, license inventory, third-party notices, hashes, signing,
update authenticity, installer, normal-user install, launch, upgrade, restart, uninstall,
state-retention verification and fresh-machine validation. Source configuration is not
installer certification.

## Themes and public surfaces

Themes remain behind release blockers unless a functional defect exists; existing theme
work is preserved. Public site, Discord, marketing, analytics and broader digital presence
remain secondary. Planning and documentation may continue without delaying release work.

## Evidence discipline

For each gate, separate source implemented, unit tested, architecture tested, local runtime
tested, GitHub CI tested, packaged tested, clean-user tested, clean-machine tested and
release accepted. Do not collapse these into a generic PASS. Do not make public release
claims until the exact candidate proves the full user path.
## Next checkpoint

Report:

- canonical branch/worktree, exact HEAD, upstream, dirty state, pushed status and GitHub CI;
- branches reconciled, commits integrated, superseded branches, conflicts and dispositions;
- canonical Mission Receipt fields, remaining UNKNOWN fields, restart and isolation status;
- Model Manager, provider/source, OpenCode Go and DeepSeek live-proof status;
- CP01–CP18, first-user, browser E2E, Resident stream and local-model acquisition status;
- installer, signing, SBOM, license inventory, clean-user and clean-machine status;
- only actual blockers, with owner and next executable action.

Keep release blockers ahead of feature count. Do not integrate accepted branches until the
canonical worktree inventory is classified and clean. Preserve exact source/evidence
provenance and continue from the one trustworthy candidate objective.
