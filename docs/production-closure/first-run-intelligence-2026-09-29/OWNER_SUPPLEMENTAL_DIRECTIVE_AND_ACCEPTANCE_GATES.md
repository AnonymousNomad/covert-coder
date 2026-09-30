Luna — add the **Covert First-Run Intelligence Bootstrap Pack** to the existing production and release-closure bundles. Treat it as additive guidance; do not replace current directives, accepted architecture, or active release work.

Its purpose is to close the first-run intelligence experience:

**install Covert → understand the user’s workflow → inspect hardware/privacy preferences → connect chosen providers/accounts → import selected repositories/context → recommend appropriate local/cloud models → optionally download and qualify model packs → assign model roles → configure workflows/skills → validate → persist → restart/recover → ready.**

Important boundaries:

- Do not derail the current production-release spine to implement this prematurely. Finish dependency-ordered release blockers first unless this work is directly required by an active release gate.
- Preserve the existing Model Manager, Model Access, Runtime Broker, Context Control, Authority, onboarding, memory, workflow and credential owners. Do not create parallel systems.
- Model packs are **opt-in** unless a separately approved offline installer explicitly bundles them.
- Recommendations must be hardware- and workflow-aware, explainable and overridable.
- A discovered/downloaded model is not READY until hash, artifact, runtime, exact identity and required qualification evidence pass.
- Never silently replace a missing or unsupported selected model.
- Application updates and model updates remain separate.
- Imports from GitHub, provider exports, chats or other sources are consented and provenance-tracked.
- Do not treat credentials as memory.
- Do not assume every AI subscription exposes memory/history APIs. Use supported connectors or user-provided exports and degrade honestly where direct import is unavailable.
- Imported conversations/preferences become **candidate memory/context**. Let the user review, accept, edit, reject and delete them before they become durable Covert memory.
- Scan imported material for secrets and sensitive data before persistence.
- User repositories, conversations and personal memories do **not** automatically become fine-tuning data.
- Resident personalization should use governed Context Control/memory first.

For the **Resident model**, establish a separate bounded model-engineering lane. Benchmark suitable small local models against a Covert-specific Resident battery before selecting or fine-tuning anything. Resident should optimize for low latency, instruction following, structured/tool behavior, workflow selection, Context Control discipline, authority compliance, handoffs, truthful UNKNOWN behavior and project-state reasoning. Heavy coding may remain routed to stronger worker models.

Only fine-tune/LoRA a Resident candidate if measured deficits remain after prompting/context/orchestration improvements. Any shipped Resident adapter must have a reproducible base revision, license/redistribution review, training-data provenance, training configuration, adapter hash, evaluation results, regression tests and documented limitations.

## CONCRETE FIRST-RUN ACCEPTANCE GATES

Treat every gate as **UNVERIFIED** until exercised through the real packaged product. Do not accept source inspection, mocks or individual API tests as whole-gate proof.

### FR0 — Clean-machine start

PASS only when:

- Covert installs from the actual release artifact on a clean supported Windows profile.
- No source checkout, development environment, pre-existing `.aide` state or manually staged models are required.
- First launch reaches onboarding without manual configuration-file editing.
- Required runtime dependencies are either packaged, installed through an explicit governed step or reported clearly as blocked.
- Installer/source SHA and artifact hashes are recorded.

### FR1 — Privacy and consent

PASS only when:

- The user is shown LOCAL/OFFLINE/HYBRID/CLOUD implications before network-dependent setup.
- No provider, repository, model host or other remote endpoint is contacted before the applicable user authorization.
- Declining cloud/provider setup leaves Covert usable where local functionality permits.
- Network activity is attributable to the initiating subsystem.
- Restart preserves the chosen privacy mode.

### FR2 — Hardware discovery

PASS only when:

- CPU, architecture, system RAM, available RAM/commit, GPU, VRAM where detectable, storage capacity and supported runtime/backend are measured.
- Results survive restart.
- Recommendations use measured hardware rather than machine-name assumptions.
- Insufficient-resource conditions produce a truthful explanation instead of a crash.
- Estimated model fit is visibly distinguished from verified runtime qualification.

### FR3 — Workflow interview and configuration plan

PASS only when:

- The user can specify primary/secondary work types, privacy preference, provider preference, local-model role, project locations, integrations and important workflows.
- Covert generates an inspectable configuration plan before applying mutations.
- The user can change or reject recommendations.
- The approved setup profile persists.
- Restart reconstructs the same intended configuration without re-running the interview unnecessarily.

### FR4 — Provider/account setup

For each supported provider path, PASS only when:

- Add/connect works through the canonical credential owner.
- Credential contents are never persisted in logs/evidence.
- Validation distinguishes valid, invalid, expired/unavailable and unknown.
- Exact provider/account identity persists.
- Model discovery does not imply exact-model support.
- An exact model can be verified before route eligibility.
- Removing/revoking the provider disables dependent routes without corrupting unrelated selections.
- Restart preserves valid configuration and accurately reports invalidated credentials.

At least one real supported provider path must complete the gate before Cloud/Hybrid first-run is called release-ready.

### FR5 — Repository onboarding

PASS only when:

- A local repository can be opened/imported.
- An authorized GitHub repository can be selected through the supported connector/path where GitHub import is offered.
- Existing `.git` history is preserved.
- Covert does not overwrite repository content during onboarding.
- Project identity persists across restart.
- Repository failure, auth denial and unreachable-remote cases remain recoverable.
- Opening one project cannot silently alter another project's model/workflow selections.

### FR6 — Context/memory migration

PASS only when:

- At least one supported import format/path is demonstrated if migration is advertised.
- Imported conversations/data are parsed locally where applicable.
- Candidate memories show source/provenance.
- User can Accept, Edit, Reject and Delete candidates.
- Nothing becomes durable memory merely because it existed in the imported archive.
- Obvious credential/secret material is excluded or explicitly blocked from memory persistence.
- Conflicting candidate facts remain visible rather than silently reconciled.
- Imported memory can be removed later.
- Restart proves accepted memory persists and rejected material does not.

Unsupported subscription-memory migration must be labeled unsupported rather than simulated.

### FR7 — Model recommendation

PASS only when:

- Recommendations incorporate hardware, workflow, requested privacy mode and intended model role.
- Every recommendation exposes model identity, source, approximate download size, quantization/format, license, expected resource demand and reason for recommendation.
- User may reject the recommendation and choose another qualified option.
- A model that does not fit available resources is not presented as a normal safe choice.
- Total model size and active parameter count are not conflated.
- Cloud and local recommendations remain visibly distinct.

### FR8 — Opt-in model acquisition

PASS only when:

- No optional model begins downloading before explicit consent.
- Download shows source, revision/file, expected size and license information.
- Adequate free disk space is checked before transfer.
- Cancellation works.
- Interrupted download is recoverable or safely discarded.
- Partial files never appear as READY models.
- Completed artifact is cryptographically verified where an expected digest is available.
- Promotion to the canonical model location is atomic.
- A checksum mismatch fails closed.
- Absolute private filesystem paths are not leaked into public evidence.

### FR9 — Model ingestion and qualification

PASS only when:

- Model artifact identity and runtime identity remain separate.
- GGUF or supported metadata is parsed rather than trusting filename alone.
- Runtime starts through the canonical adapter/broker path.
- `/health`/equivalent and exact model identity are checked.
- A generation smoke succeeds.
- Required Covert qualification probes run for the claimed role.
- Cancellation/timeout/cleanup behavior is tested.
- Model remains UNAVAILABLE/REQUIRES_PREFLIGHT/UNQUALIFIED when any required condition is missing.
- Restart re-verifies conditions that can become stale.
- Missing/deleted artifacts are detected and do not leave stale READY state.

### FR10 — Role and scope assignment integrity

PASS only when:

- Project-default, conversation-specific and product-default scopes are visible and distinguishable.
- Planner/Coder/Reviewer/Resident or applicable roles may use one model or different models.
- Changing one role does not mutate another.
- Changing one project does not mutate another.
- Persisted exact provider/model target survives restart unchanged.
- If the target becomes unavailable, Covert preserves and labels that exact target instead of silently choosing `local`, first-ready or any substitute.
- Any fallback requires explicit policy/user authorization and remains observable.

### FR11 — Workflow/skill provisioning

PASS only when:

- Recommended workflows/skills derive from the approved setup profile.
- User can inspect what is being enabled and why.
- Existing canonical skills/workflows are reused instead of copied into parallel stores.
- Declining an optional skill does not block unrelated onboarding.
- Active skill/workflow selection survives restart.
- Resident can explain which workflow/skill is applicable to a representative task.

### FR12 — Resident ready-state

PASS only when, from the completed first-run state, Resident can:

1. identify the active project;
2. report current privacy/network mode;
3. identify its assigned model and scope;
4. identify available configured worker model(s);
5. retrieve bounded project context;
6. answer a repository question;
7. formulate a plan for a requested code change;
8. request required approval instead of bypassing Authority;
9. route a task through the canonical execution path;
10. report verification state without fabricating success.

If using a local Resident model, this must be proven through the actual selected local runtime.

### FR13 — Restart and recovery

PASS only when after a full application/process restart:

- onboarding remains complete;
- privacy choice remains intact;
- project identity returns;
- provider connections remain correctly represented;
- model identities and roles remain unchanged;
- accepted memory/context remains;
- workflows/skills remain selected;
- unavailable dependencies remain visibly unavailable;
- no duplicate model/provider/project/memory records appear;
- Resident can resume the configured environment without reconstructing state manually.

Also test restart after an intentionally interrupted model download or setup operation.

### FR14 — Offline first-run path

PASS only when a supported user can:

**install → launch → remain offline → select/import an existing compatible local model or use an approved bundled/offline pack → open local repository → use Resident → request work → review/approve → verify**

without mandatory cloud authentication.

Network-required features must degrade explicitly rather than block the local product.

### FR15 — Cloud/subscription-first path

PASS only when a user choosing no local model can:

**install → connect supported provider → discover → exact-model verify → assign → open repository → use Resident/workflow → restart → resume**

without being forced to download local weights.

A local fallback may be recommended but remains opt-in.

### FR16 — Failure-path battery

Before first-run acceptance, deliberately exercise at minimum:

- no network;
- invalid provider credential;
- provider unavailable;
- model host unavailable;
- insufficient disk;
- insufficient memory;
- download cancellation;
- checksum mismatch;
- corrupted GGUF;
- missing model after restart;
- unavailable previously selected provider model;
- repository permission failure;
- malformed import archive;
- import containing credential-like material;
- denied Authority action;
- application restart during setup.

Each must resolve to a truthful, recoverable state. No silent substitution and no corrupted setup record.

### FR17 — Packaged clean-room E2E

The final first-run gate is PASS only when a completely new test profile executes the representative journey through the **packaged release candidate**, not the developer server:

**install → launch → interview → privacy choice → hardware scan → provider or local path → repository → optional migration → model recommendation → opt-in acquisition/import → qualification → role assignment → workflow setup → Resident interaction → approved task → verification → shutdown → restart → recover configuration**

Evidence must record:

- exact Covert source SHA;
- installer/package SHA;
- model artifact identity/SHA where applicable;
- provider/model identity where applicable;
- machine/resource profile;
- selected workflow/profile;
- tests/actions performed;
- failures encountered;
- final state;
- unsupported/untested paths.

### FIRST-RUN RELEASE RULE

Do not call the first-run experience production-ready because the wizard renders or because its individual APIs pass.

For the declared release scope:

- every applicable FR gate must be PASS;
- unsupported paths must be explicitly excluded and labeled;
- no Critical/High unresolved setup-data-loss, authority, credential, silent-route-substitution or false-ready defects may remain;
- clean-room evidence must correspond to the same release-candidate SHA and packaged artifact being proposed for release.

Primary objective: make a new user able to install Covert and have it configure itself around **their actual workflow** without surrendering privacy, authority, model choice or inspectability.

Continue using the Developer’s Way:

**ground → inspect → research → implement minimally → test → break → repair → retest → exact-SHA evidence → claim only proven scope.**