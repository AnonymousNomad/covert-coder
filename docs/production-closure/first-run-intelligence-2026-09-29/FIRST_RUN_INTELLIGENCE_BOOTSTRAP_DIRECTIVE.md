# Covert — First-Run Intelligence Bootstrap Directive

## Mission

Close the first-run experience so a new user can install Covert, describe how they work, optionally connect existing providers/accounts, import selected repositories and user context, receive hardware-aware model recommendations, install an approved local model pack, assign model roles, configure relevant workflows/skills, and reach a verified working project without editing configuration files.

Do not broaden architecture. Extend the existing Setup Session, Model Manager, Model Access, provider/BYOK, secure credential, Context Control, workflow, memory, project import, Git and Authority surfaces.

## Non-negotiable boundaries

1. No mandatory account and no mandatory cloud provider.
2. No silent network use, model download, repository cloning, credential use or data upload.
3. No hidden fallback from a selected model/provider to another route.
4. No credential plaintext in logs, receipts, migration records or model prompts.
5. No user repository/chat/history content used for model training by default.
6. No claim that a model is READY because its file downloaded or loaded. Require integrity, runtime, exact identity and role probes.
7. No universal claim that a subscription exposes chat history or memory APIs. Support only documented connectors; otherwise import user-provided exports.
8. Every imported memory/context item requires source provenance and must be reviewable before durable acceptance.
9. The user can skip nonessential setup and revisit it later.
10. The base installer remains reasonably small. Large weights are optional assets unless a separately published offline/full bundle is deliberately selected.

## Required first-run stages

1. Welcome and privacy/local-vs-cloud posture.
2. Device/resource scan: CPU, architecture, RAM/commit, GPU/VRAM, storage, supported backends and current resource pressure.
3. Workflow interview: primary/secondary work, repositories, languages, tools, testing conventions, approval posture, offline requirements, preferred providers and desired latency/quality tradeoff.
4. Account/provider setup: connect only selected providers using existing secure credential/auth boundaries; discover exact models only through governed provider paths.
5. Repository setup: user chooses local folders, existing Git remotes, or authorized GitHub repositories. Never bulk-clone an account without explicit selection.
6. Context migration: offer provider-specific documented import methods. Parse exports locally where possible; present candidate memories/decisions/preferences/projects before persistence.
7. Model recommendations: rank compatible packs by measured hardware fit, required disk/network size, role suitability, license and verified Covert evaluation evidence. Explain why each recommendation was made.
8. Model install/import: download or import through a resumable, hash-verifying, atomic pipeline. Preserve exact upstream repository/revision/file/license/hash/quantization/runtime metadata.
9. Qualification: load through the chosen runtime, verify exact model identity, run role probes, cancellation/timeout/cleanup checks and record evidence. Only then may the route become eligible.
10. Role assignment: Resident, planner, coder, reviewer, autocomplete and fallback roles may share one physical model. Do not imply that three models must be resident concurrently.
11. Workflow/skills setup: activate only task-relevant packs based on the interview/repository evidence; explain selections and allow user override.
12. Validation: prove one real local or selected-provider conversation, one project/context retrieval, one governed action dry-run or approved action, persistence, restart and honest degraded behavior.
13. Ready screen: show exact active project, privacy mode, selected models/routes, installed packs, provider state, imported context sources, enabled workflows/skills, verification status and remaining setup items.

## Model-pack product profiles

Implement at least these product concepts without hardcoding one model forever:

- **Core / No weights:** smallest installer; user imports/connects later.
- **Quick Local:** one small, broadly useful model selected for the detected machine; fastest path to Resident conversation.
- **Developer Local:** small Resident/general model plus a coding-focused model only when hardware supports both or cold-swap policy is acceptable.
- **Offline Full:** separately distributed asset bundle containing only weights whose redistribution terms, hashes and notices are verified.
- **Bring Your Own Model:** local GGUF/import path using existing Model Manager preflight/qualification.
- **Cloud/Subscription First:** no local model required; setup still offers an offline fallback later.

Profiles are policies, not identities. Exact models remain manifest data and may change after benchmark/license review.

## User-context migration law

Treat "memory import" as a migration pipeline, not account scraping.

For each source record: `source_provider`, `source_type`, `source_export_or_connector`, `source_object_id_or_file_digest`, `imported_at`, `candidate_kind`, `confidence`, `user_review_state`, `retention_scope` and `sensitivity_class`.

Separate:
- conversation archive/reference;
- explicit user preferences/custom instructions;
- project decisions/facts;
- repository-derived context;
- credentials (never memory);
- ephemeral session history.

Imported conversations do not automatically become durable facts. Extract candidates, deduplicate, show conflicts, and let the user approve/edit/reject. Preserve original archive independently if retained.

## Resident specialization law

Resident is a control-plane assistant, not necessarily the heaviest coding model. Optimize for low latency, instruction following, structured output/tool-call correctness, context discipline, truthful uncertainty, project navigation, workflow selection and authority compliance.

Before fine-tuning, prove the best base model + system contract + Context Control + tools against a Resident battery. Fine-tune only measured deficits that prompting/RAG/contracts cannot reliably solve.

Prefer adapter/LoRA-style specialization for a shippable Resident candidate when supported. The generic shipped adapter must use Covert-owned or redistribution/training-compatible data. Do not train it on private user repositories, imported chats or secrets.

## Release acceptance

A first-run claim is accepted only after clean-profile testing proves: installer → setup interview → hardware scan → optional provider → optional model download/import → exact qualification → repo open/import → context migration review → workflow/skills configuration → Resident interaction → governed action → restart → same state recovered.

Test offline, cancelled download, corrupted download, insufficient disk/RAM, unsupported backend, invalid credential, provider unavailable, missing repo permission, malformed export, conflicting imported memories, model removed after setup and interrupted restart.
