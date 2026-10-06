# Covert platform capability map — second design round

Date: 2026-10-06. Includes the subsequent Resident Experience Addendum. **PROPOSED canonical model for review. No implementation, acceptance or design freeze.**

## Review conclusion and evidence boundary

The five-part model is sound: Desktop, Projects, Applications/Tools, Intelligence Resources and Platform Services. The supplied retro workstation references remain authoritative. This document does not reopen their visual direction.

The desktop is a projection and an interaction environment. Domain services retain their authoritative state. Cipher coordinates work using bounded context and durable records; it is not a privileged substitute for Authority or a second task database.

**Three conclusions:** capability categories need distinct lifecycles; cross-project/background work requires immutable scope; the extensible application platform must remain execution-disabled until principal, grant, context and lifecycle enforcement is proven.

Source reviewed: accessible convergence snapshot ca8527e565b62326fd940f574d9964413e3c6751 and S1 candidate e5307c9e32913ef82e6583c4c92ac9453d7b8015. S2 remains paused at 9baa711cbfc4d431b07f84389bdec4aac0d2865c. The local S1/S2 worktrees were checked clean. This review does not certify current remote tips, a full checkout, Windows runtime behavior or packaging.

Luna's reported separate Windows shell worktree remains unavailable; do not discard or overwrite its unseen changes. Historical intelligence-spine flow audits describe older revisions and are diagnostic leads, not current runtime findings. Current source/contract examples are cited at the end.

Important inspected limits:

- S1 validates manifest, instance, principal, context and lifecycle data. Its private app-principal enrollment, live scoped grants, context enforcement, lifecycle transactions and executable inventory are not integrated.
- The inspected Model Access selection policy explicitly declares NOT_PERSISTED, mutation_enabled false and execution_routing_effect false. A displayed preference must not be described as live route selection.
- The inspected BrokerModelRuntime pins a specific artifact/runtime/profile qualification. Catalog discovery or GGUF import does not establish arbitrary model execution support.
- Current telemetry lacks several requested live metrics. Current source-bound trusted publication/receipt integration remains incomplete.
- Existing workspace-root-bound services and split credential consumers require reconciliation before claiming robust project switching or unified account lifecycle.

**All journey checks below are design walkthroughs. None were executed against the product in this round.** “V1” means a proposed release target with its proof requirements, not an implementation claim.

## 1. Platform capability map

A capability is an action exposed by an authenticated adapter. A resource is something an action reads, changes or uses. A model artifact, account, profile, pending decision and project are not executable capabilities simply because they appear in this map.

The following four tables together supply all seventeen requested attributes for each class. IDs are document cross-references, not new runtime IDs. Existing owners are named where inspected; PROPOSED marks an extension whose owner/integration is not established.

### 1A. Entry, representation, ownership, identity and scope

| Capability / resource type | How it enters Covert | Operator-facing representation | Canonical state owner | Identity | Scope |
|---|---|---|---|---|---|
| C01 Project | Operator opens existing root; explicit create/import. | Project shortcut, title scope and saved-project list. | Existing workspace backend; durable project registry extension PROPOSED. | Persistent project ID + checkout/root binding revision; path is a locator. | Operator/account, workspace, project, approved roots. |
| C02 Editor | Built-in capability opens a permitted project file. | Movable editor; tabs/splits, dirty marker and language status. | Existing EditorHost/document/session and file/LSP service owners. | Document ID + project/source reference + buffer version. | Project/document; independent views may share a buffer. |
| C03 File access | Explicit project/approved additional root registration. | Files window, picker, search and scoped operation preview. | Existing workspace/file/search services and Authority; containment adapter. | Service-owned source handle + root binding + file version/hash. | Resolved project roots and selected paths; host paths explicit. |
| C04 Terminal | Operator chooses supported shell/provider and approved CWD/session. | Independent terminal windows/tabs; actual shell, scope and lifecycle. | Existing terminal session service/provider + owned-process lifecycle. | Backend session ID + process generation/owner; PID alone insufficient. | Project, shell environment and exact session actor. |
| C05 Git/source control | Detected within a project; explicit remote configuration. | Status/diff/history window or editor commands. | Existing GitService/route owner; Authority and publication gate for effects. | Repository/checkout/worktree identity + HEAD/index/worktree revision. | Exact project/worktree and selected remote/ref. |
| C06 Local model | Register/import/discover an artifact through Model Manager. | Models table/detail with compatibility, qualification and role preferences. | Existing Model Manager/Model Access; Broker owns observed runtime. | Canonical logical model ID; separate artifact/runtime bindings. | Inventory may be shared; usage/roles/context project-scoped. |
| C07 Downloaded model artifact | Explicit approved download from inspected source/revision or local import. | Catalog detail, progress, quarantine/integrity and disk usage. | Existing acquisition/import + model artifact inventory; resumable transaction extension PROPOSED. | Source/revision/file-set manifest, observed hashes, format/quant/license. | Shared storage reference; no project authority inherent in bytes. |
| C08 Provider API | Operator adds supported endpoint/account and credential handle. | Connections detail; route capabilities, destination and test freshness. | Existing provider/BYOK services + credential owner + Model Access. | Provider connection/account/endpoint/adapter revision; model route separate. | Account config ownership; project/role usage grants; egress policy. |
| C09 Supported subscription/client connection | Explicit supported login/CLI pairing; installed-client probe is discovery. | Connection record naming account/client/transport and supported actions. | Existing ProviderConnections and supported transport; external auth owner. | Client executable/version + account/session + adapter/model route binding. | Host account identity; project/role delegation explicitly bounded. |
| C10 Cipher | Resident binding resolves designated role/route; operator explicitly enables supported setup. | Compact presence, movable Cipher window and its working-record view. | Existing Resident/Binding owner; Context Control/Orchestrator own their functions. | Stable Resident identity + binding generation; worker identity independent. | Global presence; project-scoped detailed context and bounded platform metadata. |
| C11 Worker model | Operator/task resolves a legitimate project/role route. | Task details identify actual worker and route; Models preference view. | Model Access resolves selection; Orchestrator owns task assignment; Broker/provider owns execution. | Task actor + model/route/artifact/runtime/credential binding revision. | Exact task/project/role; no global agent authority. |
| C12 Workflow | Versioned first-party definition or explicit validated import. | Workflow launch/task window; steps, blockers and artifacts. | Existing Workflow Engine/service; Orchestrator owns executions. | Definition ID/version/digest + workflow run/revision. | Project/workstation; domain-specific workflows retain policy. |
| C13 Skill | Registered versioned SOP; explicit import/update. | Searchable skill/library detail and task's selected-methodology list. | Existing skill registry/loader; trusted composition rules need integration. | Skill ID + source version/digest; excerpt/injected version recorded. | Applicability and context per project/task/role. |
| C14 Verification | Task/project declares required checks; operator can request an independent run. | Results/evidence window and source-scoped task verdict. | Veritas deterministic verdict; domain check adapters; Ghost adversarial evidence separate. | Verifier run + policy/version + exact source/artifact + check-set identity. | Task/project/artifact; publication eligibility is separate composed result. |
| C15 Application (first-party) | Inspected builtin manifest/catalog -> governed registration; no code-on-import. | Launchable app/window with version, capabilities and explicit unavailable state. | Proposed extension of existing WorkbenchManager inventory; Authority owns grants; controller owns effects. | S1 app/instance/version/manifest+artifact digests/installation revision. | Workspace/project/workstation binding; app storage namespace. |
| C16 Tool | Builtin registered adapter action; later trusted contribution. | Context menu/launcher/task action with scope and result. | Existing command/tool registry + owning domain adapter; Authority owns policy. | Tool/adapter version + action schema; invocation/operation digest. | Invocation target/project/task and actor. |
| C17 Plugin/extension contribution | Inspected package/version with declared contribution points; builtin V1 first. | Launcher/view/command contribution plus package-management details. | Existing PluginManager inventory/trust; app/controller and host boundary separately enforced. | Package digest/version/publisher + contribution ID + executing principal if any. | Host/project/workstation contribution; no ambient platform privileges. |
| C18 Development-environment/profile | Operator creates/saves or explicitly imports declarative versioned profile. | Profiles list, apply preview and missing-capabilities checklist. | Proposed versioned profile store beside existing workspace/session/workbench owners. | Profile ID/version/digest; project application revision separate. | Reusable recipe; applied settings project-specific; account handles locally rebound. |
| C19 System telemetry | Existing hardware probe plus explicitly supported live samplers. | Persistent compact strip/edge; full monitor window. | Backend hardware/owned-process sampler; Admission owns refusal decisions. | Sampler/source/version + host/process generation + sample timestamp. | Host readings; detailed process/project information access scoped. |
| C20 Credential reference | Explicit secret entry or supported login under existing credential owner. | Masked account/configured state and manage/revoke action. | Existing CredentialStore/secret-store/auth owner; reconcile competing consumers. | Opaque handle + owner/account/purpose/version; plaintext excluded. | Account/service origin; project usage binding separate from storage. |
| C21 Background task | Explicit governed operation/workflow/download/test admitted as task. | Task strip/journal; project ownership, phase, cancel and decision status. | Existing task/AttemptJournal/Orchestrator plus owning executor/process service. | Task/attempt/operation IDs + project/root/actor/revision. | Immutable originating project; foreground switches do not rebind it. |
| C22 Notification/operator decision | Authenticated owner emits event or immutable pending operation. | Compact attention indicator plus journal/exact decision window. | EventHub delivers; originating service/Authority owns decision and durable truth. | Event ID/correlation/cursor; decision/request ID + operation/subject revision. | Operator plus exact project/app/task; audience enforced. |
| C23 Local runtime | Supported install/configuration or explicitly authorized discovery/adoption. | Models/runtime detail with version, ownership and actual health. | Existing Runtime Broker/adapters + Resource Admission + process ownership. | Runtime/adapter/build/endpoint identity + process generation/ownership. | Host resource may be shared; project/task leases distinct. |
| C24 External installed application | Explicit selected executable/client and supported adapter; bounded discovery. | Launch/reveal command and adapter capability detail; host window stays host-owned. | Host OS/application owns state; Covert adapter owns only integration/owned launch metadata. | Resolved executable/signature/version + adapter/account binding where relevant. | Host app account/environment; Covert project association does not isolate it. |
| C25 Vision observation | Explicit selected image/window capture or admitted capture source. | Attachment/preview and visible capture scope/activity. | Proposed host capture adapter + source owner; vision route via Model Access. | Image/frame digest + source/window/project binding + capture time. | Selected Covert view or independently approved host surface. |
| C26 Audio/voice interaction | Explicit microphone activation/input and configured speech/output adapters. | Listening/transcript/speaking indicators; editable transcript and keyboard parity. | Proposed audio adapter owner; speech/model routes existing adapter boundaries. | Device/session/utterance/transcript revision + adapter/model identity. | Operator session and selected project; speaker output independently scoped. |
| C27 Cipher working records | Existing task/context/memory sources plus deliberate Resident notes and checkpoints. | Cipher's laptop/records view: tasks, plans, notes, sources and evidence. | Existing Context Control/memory/AttemptJournal/Workflow owners; durable record semantics extension PROPOSED. | Typed record ID/version/source/provenance/project; belief status distinct from observed fact. | Project/workstation namespace; global operational summaries bounded. |
| C28 Resident personality/profile | Explicit preset selection or bounded structured preference edit. | Cipher/Buddy style controls; Developer's Special preset. | PROPOSED versioned Resident preference/composition owner; Authority unchanged. | Profile/version/digest + effective task profile revision. | Operator preferences with explicit project overrides. |
| C29 Avatar/appearance pack | Builtin assets; later explicit bounded validated imports. | Optional movable/pinned embodiment inside retro desktop. | PROPOSED passive asset inventory + shell renderer; no executor. | Asset manifest/version/digest, frame mappings and bounds. | Presentation only; not an executing principal. |
| C30 Presence/proactive policy | Operator chooses level and independent audio/animation controls. | Quiet/mute/hide/listening controls and bounded reactions. | PROPOSED event-to-presentation policy; domain owners retain truth. | Policy/version + event/subject revision; projection not authority. | Operator session/project; metadata audience scoped. |
| C31 Speech-to-text resource | Explicit supported speech adapter/model/account configuration. | Transcription capability/version, processing and editable transcript. | Supported speech runtime/provider adapter owner; integration PROPOSED. | Adapter/model/profile + capture session/utterance identity. | Selected captured audio and exact allowed destination. |
| C32 Text-to-speech resource | Operator chooses supported shipped/local/remote voice explicitly. | Speaking/output controls, voice identity and text transcript. | Supported TTS runtime/provider adapter owner; integration PROPOSED. | Voice/adapter/model revision + utterance/output session. | Selected text/output device and allowed destination. |

### 1B. Authority, Cipher visibility, context and execution

| Type | Permissions / grants | Cipher visibility | Context access | Execution path |
|---|---|---|---|---|
| C01 Project | Opening does not confer all-root access; mutations and egress remain governed. | Scoped summary, current work and permitted background metadata. | Separate project aperture; selected files/records only. | Resolve exact root/service context before any project operation. |
| C02 Editor | Read versus save/replace permissions; no blanket execution grant. | Selected document/selection plus explicit attachment. | Unsaved buffer is a versioned source distinct from disk. | Human/agent writes reach existing file operation guards; LSP lifecycle separate. |
| C03 File access | Read/write/delete separate; effective containment enforced at effect time. | Only permitted metadata/content; secrets excluded by policy. | Selected retrieval, classification/redaction and provenance; no whole-disk indexing. | Exact file adapter action through current Authority and containment checks. |
| C04 Terminal | Session launch defines actual reach; input uses admitted actor-bound session. | Permitted selected output/session metadata, not automatic whole transcript. | Explicit output slices with session/time provenance. | Approved session -> provider/PTY -> authenticated input/resize. |
| C05 Git/source control | Read/stage/commit/checkout/push are different operations; hooks execute code. | Scoped status/diff/history, with protected content policy. | Selected diff/log from exact revision; no unbounded history. | Git adapter; mutations governed; push requires source-bound eligibility and authorization. |
| C06 Local model | Register/select/load/infer are distinct; model permission does not grant file/tools. | Capability/fit evidence; no automatic model replacement. | Model gets only role/task aperture at invocation. | Resolve artifact + adapter/profile -> Authority where required + Admission -> Broker. |
| C07 Downloaded model artifact | Network destination + disk write + gated-source credential use explicitly scoped. | Metadata and acquisition state; model content grants no instructions. | Metadata only until selected; no executing remote model code. | Downloader/importer -> staging -> integrity/format validation -> registration. |
| C08 Provider API | Configure/test/infer/egress separately; explicit usage/financial limits where supported. | Safe connection/capability metadata; never plaintext credentials. | Only authorized task aperture permitted for destination. | Supported provider adapter behind route resolution/consent/Authority policies. |
| C09 Supported subscription/client connection | CLI/API operation scope and egress; host login does not grant Covert access automatically. | Safe status/capability metadata; auth-file contents excluded. | Scoped task context only through supported authenticated transport. | Registered client adapter; never scrape sessions or pretend subscription is API access. |
| C10 Cipher | Resident actor/delegation; no selfapproval or inherited worker/app grants. | Itself: reports own bound/degraded/unavailable state, not speculative readiness. | Current governed aperture plus explicitly retrieved durable records. | Resident request -> canonical orchestrated task path -> governed worker/tools. |
| C11 Worker model | Task delegation, tool grants, context and egress; Admission independently applies. | Assignment/status/output; Cipher identity remains unchanged. | Independent task/role aperture; no automatic Cipher memory inheritance. | Resolve at task dispatch -> model adapter -> gated tools -> observations. |
| C12 Workflow | Selecting template grants nothing; each effect needs actual scope/decision. | Definition/run summaries and selected artifacts. | Step-specific aperture; definitions are methodology, not authority. | Workflow transitions -> existing execution adapters; verifier owns evidence outcome. |
| C13 Skill | Instruction text grants no execution; referenced scripts/tools use their own contracts. | Permitted selected methodology and availability reasons. | Bounded excerpts with origin/trust; mandatory rules cannot be accidentally truncated. | Loader/composer selects; executable helpers route through governed tools. |
| C14 Verification | Check execution has actual tool/process/network scope; model cannot self-certify. | Verdict, reasons and scoped evidence; no overriding failed required checks. | Authorized bounded reports; raw logs need classification. | Independent runner -> strict outcomes -> signed/source-bound receipts where required. |
| C15 Application (first-party) | Explicit required/optional scopes, principal binding and exact effects; no Boolean trust inheritance. | Allowed app metadata/events and independently granted context sources. | S1 ContextManifest request intersected with live ownership/role/egress grants. | Trusted builtin controller -> privately enrolled actor -> Authority -> scoped adapter. |
| C16 Tool | Typed arguments, executor-owned risk, exact scope; no caller-approved flag. | Discovery/schema/reasoned availability within allowed actor scope. | Only action-specific input/observation; validate and redact output. | Common governed effect contract, then domain-specific adapter. |
| C17 Plugin/extension contribution | Installation, publisher trust, view contribution and execution grants separate. | Allowed descriptor; contribution cannot create policy or expose forbidden sources. | Explicit contribution context contracts; no global bus/context access. | Passive view mount or admitted controller action; no unrestricted loader. |
| C18 Development-environment/profile | No embedded grants/secrets/scripts; apply prefs distinct from effects. | Permitted profile requirements and unresolved capabilities. | Metadata/preferences; referenced sources remain independently governed. | Validate -> diff -> apply harmless presentation/preferences; actions separately requested. |
| C19 System telemetry | Read-only host observation; process control separate. | Bounded safe readings and pressure events. | Short-lived typed samples; historical record only if deliberately retained. | Sample service -> one read projection; no widget-spawned commands. |
| C20 Credential reference | Controller use for exact connection; neither worker nor app gets vault-reading rights. | Safe handle availability only, never secret material. | Metadata only; credentials forbidden in prompts/events/profiles/evidence. | Trusted adapter resolves handle immediately before authorized use. |
| C21 Background task | Original delegated scope/expiry; new approval when action changes. | Scoped status, outputs and blockers; cross-project detail requires retrieval. | Task aperture; no borrowing foreground context after switch. | Admitted domain executor; resource budgets/backpressure apply. |
| C22 Notification/operator decision | Delivery carries no authority; only authenticated operator resolves current decision. | Scoped metadata; cannot resolve its own approval. | Safe summaries; detailed evidence retrieved separately. | UI intent -> current authoritative decision validation -> exact permitted effect. |
| C23 Local runtime | Install/start/stop/adopt/infer distinct; never kill foreign process. | Safe runtime/ownership/pressure metadata. | Only requested inference input; no automatic files/context access. | Canonical Broker -> qualified adapter/profile -> admission -> owned start/infer. |
| C24 External installed application | Launch versus automation/process/network rights separate. | Allowed adapter observations; no ambient host screen/files access. | Selected results only; host app data requires separate scoped access. | Supported launch/protocol/CLI adapter; no arbitrary privileged WebView embedding. |
| C25 Vision observation | Capture, context retrieval and remote egress distinct; no implied whole-host observation. | Selected evidence interpreted by capable route; Resident identity stable. | Purpose-bounded image/OCR with redaction/trust/provenance; content cannot grant authority. | Capture -> governed source -> capable model route -> observation; tools separately gated. |
| C26 Audio/voice interaction | Mic capture/transcription/egress/output separate; spoken text alone is not trusted approval. | Transcript/task intent; delegate modality to capable route. | Selected utterance; no default continuous recording; ambiguous input reviewed. | Capture -> transcript -> normal intent path; exact approvals use trusted operator flow. |
| C27 Cipher working records | Read/write records scoped; notes cannot grant access or rewrite authoritative outcomes. | Primary continuity aid; small Resident retrieves relevant records. | Budgeted aperture; source freshness, claims versus facts and retention enforced. | Structured read/write through existing owners; no new agent or memory authority. |
| C28 Resident personality/profile | Tone only; no capture, egress, tool or permission changes. | Effective profile visible; no silent self-edit. | Small bounded persona component; trusted policy/context separate. | Validate preferences -> deterministic persona composition -> existing Resident inference. |
| C29 Avatar/appearance pack | No code, network, credentials or ambient filesystem capability. | Structured interaction states; cosmetic actions create no task facts. | None by default; appearance cannot inject instructions. | Passive allowlisted renderer consumes state/events; no tools/hooks. |
| C30 Presence/proactive policy | Policy grants no speaking/capture/egress rights. | Permitted event summaries; no assumed knowledge of user mood. | Bounded events; no constant desktop sampling/prompt loop. | Filter/coalesce/rate-limit events -> utterance request; effects separately governed. |
| C31 Speech-to-text resource | Capture, inference resource admission and egress independent. | Uncertain transcript becomes normalized intent; same Resident. | Selected audio/transcript with trust/retention/provenance. | Admitted capture -> speech adapter -> transcript -> normal task intent. |
| C32 Text-to-speech resource | Output/inference/egress separate; avatar voice choice grants nothing. | Same Resident output; specialist provenance inspectable. | Intended speech text; secret/private content policy enforced. | Safe text -> admitted TTS -> output; host Stop Speaking independent. |

### 1C. Persistence, recovery and evidence

| Type | Persistence | Recovery behavior | Evidence / provenance |
|---|---|---|---|
| C01 Project | Known projects, root references, preferences/layout links; grants separate. | Moved/missing root requires rebind; never adopt same-name folder silently. | Root binding/revision, source state and operation receipts. |
| C02 Editor | Tabs, position, splits, safe unsaved recovery references. | Compare disk/base versions; save/discard/recover without stale overwrite. | Save outcome/source digest; proposal and applied edit remain distinct. |
| C03 File access | Root bindings, source references; caches carry expiry. | Detect symlinks/junctions, replacement, external edits and partial writes. | Before/after identity and exact operation/outcome. |
| C04 Terminal | CWD/shell/window hints; live session ID only for supported reattachment. | Observe/reconcile; show exited/unknown; never replay commands. | Launch approval, session ownership, exit/stop outcome. |
| C05 Git/source control | Repository remains authoritative; persist UI preferences and evidence refs. | Refresh after external changes; locks/partial operations require explicit recovery. | Commit/tree/diff identity, command outcome and required verifier receipts. |
| C06 Local model | Inventory/profile/preferences; no durable RUNNING truth. | Rehash changed artifact; qualification stales on bound changes. | Artifact/profile/runtime/role qualification basis and inference receipts. |
| C07 Downloaded model artifact | Bytes, source manifest, transfer checkpoint, verification state. | Resume only matching source identity; disk-full leaves resumable/quarantined state. | Expected versus observed hashes, origin, license, transfer/validation records. |
| C08 Provider API | Endpoint/account references and validated config; secrets in existing vault. | Invalidate readiness on changed identity/failed test; uncertain request not auto-replayed. | Adapter/version/capability test, destination, egress/request outcome. |
| C09 Supported subscription/client connection | Credential/session refs and client config under actual owners. | Missing client, expired auth, transport change invalidate eligibility. | Actual transport tests, version/account binding and supported capability matrix. |
| C10 Cipher | Binding preference, scoped conversation/records via existing owners. | Rebind/reconcile; interrupted tasks stay explicit; no persona reset on worker switch. | Binding/runtime evidence, context provenance, task and decision receipts. |
| C11 Worker model | Preferences/task assignment receipts, not live actor credentials. | Interrupted assignment reconciles by task ID; no automatic changed-route continuation. | Per-invocation identity/context/routing and output evidence. |
| C12 Workflow | Definition references, reconstructable transitions, run checkpoints. | Resume known safe step; unknown side effect requires reconciliation. | Definition/source revision, transitions, step outputs and verifier refs. |
| C13 Skill | Registry/source and task selection records. | Missing/invalid skill prevents required composition; optional absence explained. | Selection rationale, digest, exact injected excerpt and outcome evidence. |
| C14 Verification | Receipts, required-check policy, logs/retention refs. | Crash/skips/unknown remain incomplete; stale basis requires recheck. | Producer identity, source/check coverage, failures/skips and provenance. |
| C15 Application (first-party) | Installation/lifecycle records, decisions, storage refs and tombstones. | Disabled/unknown until identity, grants, leases and processes reconcile. | Manifest/trust/lifecycle, scope decisions, exact operations and context receipts. |
| C16 Tool | Definitions/config and invocation evidence; no generic running tool enum. | Use action-specific reconcile; retry only idempotent or confirmed nonexecution. | Exact normalized action, actor/decision/outcome/source refs. |
| C17 Plugin/extension contribution | Inventory, accepted contribution mappings and explicit decisions. | Quarantine incompatible/tampered update; stale grants cannot migrate silently. | Package/source/digest, compatibility, trust and lifecycle receipts. |
| C18 Development-environment/profile | Declarative refs/layout/shortcuts/terminal/model/workflow preferences. | Partial application reported; restore previous config; do not undo external effects fictionally. | Profile digest, resolution results, user-approved changes and action refs. |
| C19 System telemetry | Config and optional bounded history; current samples expire. | Sampler failure/staleness shown; zero is never substitute for missing. | Source, units, sample time and estimates labelled. |
| C20 Credential reference | Secret via supported protected store; layout retains no secret copy. | Unavailable/decryption/rotation failures invalidate routes; no plaintext fallback in release. | Handle/version/account binding and use receipts with redacted diagnostics. |
| C21 Background task | Checkpoints, outputs and durable outcomes; running observed. | Reconcile executor/idempotency key; unknown external outcome never blind retry. | Attempt events, source/actor/route refs and verified outcomes. |
| C22 Notification/operator decision | Durable pending decisions/events policy; notification dismissal separate. | Replay/deduplicate and reconcile current state; expired decision cannot approve. | Producer/source/sequence, delivery context and decision receipt. |
| C23 Local runtime | Config and trusted runtime basis; process liveness not persisted as fact. | Probe identity/endpoint/owner; user-owned runtime not adopted implicitly. | Runtime passport/profile, ownership, admission and observed outputs. |
| C24 External installed application | Adapter refs and association; host app state stays external. | Confirm actual version/process; unavailable app never impersonated internally. | Executable/adapter basis and launch/operation ownership outcome. |
| C25 Vision observation | Attachment references under retention policy; no continuous screenshot archive default. | Stale/changed view labelled; unavailable capture/model blocks only this capability. | Capture identity/time/scope + route and derived interpretation refs. |
| C26 Audio/voice interaction | Settings/transcript only under explicit retention; no raw archive default. | Device/ASR outage keeps keyboard usable; do not replay recorded commands. | Capture/session/adapter, transcript confidence and exact submitted intent. |
| C27 Cipher working records | Versioned scoped records and refs; preserve provenance and user corrections. | Rebuild task facts from owners; stale notes retained as stale, not current truth. | Author/source/time/digest, supporting receipts, corrections and derived status. |
| C28 Resident personality/profile | Explicit preferences and approved learned changes; no weight mutation. | Reset to Standard/preset; invalid profile falls back visibly. | Profile/compiler version and persona evaluation results. |
| C29 Avatar/appearance pack | Asset/profile reference, position and animation preferences. | Invalid asset -> static glyph; renderer failure cannot stop tools. | Asset validation/digest and source-state mapping provenance. |
| C30 Presence/proactive policy | Preferences only; active capture/runtime state not restored. | Reconcile events; stale feed clears working indicators. | Event provenance and proactive utterance reason. |
| C31 Speech-to-text resource | Config/model refs; media only under retention policy. | Ambiguous transcript clarified; outage leaves text usable. | Capture/time/adapter/model and submitted transcript revision. |
| C32 Text-to-speech resource | Voice refs/settings; no queued speech replay after restart. | Cancel queue/audio; failed speech leaves readable text. | Original output/voice/adapter and playback/cancel observations. |

### 1D. Revocation, removal, failure and release scope

| Type | Revocation / disable | Uninstall / removal | Offline / failure behavior | V1 / later |
|---|---|---|---|---|
| C01 Project | Close foreground view differs from revoking project access. | Forget entry separately from deleting source/data. | Cached metadata labelled stale; local work usable if dependencies permit. | V1: many saved projects; one foreground workspace. |
| C02 Editor | Remove document/context access; handle unsaved work explicitly. | Close views; never delete source merely by closing editor. | Editing survives AI failure; missing LSP is independently unavailable. | V1: one project editor with tabs/splits. |
| C03 File access | Invalidate leases/caches/pending operations for affected scope. | Remove root access separately from deleting files. | Local access continues; unavailable roots refuse rather than redirect. | V1; real-path/race enforcement is a required gate. |
| C04 Terminal | Stop future input and new admission; stop/contain owned work; uncertainty visible. | Close view differs from stop; clear scrollback separately. | Works without AI if provider available; session/provider failure distinct. | V1 multiple sessions; native/ConPTY proof still required. |
| C05 Git/source control | Remove remote/operation grants; block new effects; external push may be irreversible. | Disconnect UI separately from repository/remote deletion. | Local Git works offline; remote operations fail honestly. | V1; push-gate/entrypoint reconciliation required. |
| C06 Local model | Disable route/role use; unload via owner after shared-use check. | Unregister separately from artifact deletion. | Local inference possible only on a proven compatible path. | V1 limited qualified profiles; arbitrary families later. |
| C07 Downloaded model artifact | Cancel transfer/use eligibility; retain evidence. | Reference-aware removal; do not delete user-owned or still-used artifacts. | Cached catalog stale; incomplete artifact unavailable. | V1 supported artifacts/catalog path; broaden after proof. |
| C08 Provider API | Block future use; credential/server revocation is separately confirmed. | Remove config separately from shared credentials and account deletion. | Configured remains true while unreachable; no silent fallback. | V1 only evidence-backed supported routes. |
| C09 Supported subscription/client connection | Revoke Covert use separately from signing out another application. | Disconnect adapter; do not uninstall client or delete shared login implicitly. | Client discovery/auth presence can persist; reachability/execution independently fail. | V1 verified transports only; broader clients later. |
| C10 Cipher | Revoke task/context/route rights without granting itself recovery authority. | Disable/unbind separately from deleting retained Resident data. | Editor/tools stay usable; explain Resident dependency failure. | V1 bounded working-record access; richer multimodality separately gated. |
| C11 Worker model | Invalidate assignment/admission; cancellation outcome observed separately. | Remove preference/assignment; artifact/account removal handled by owners. | Unavailable selected route blocks or requests explicit alternative. | V1 explicit roles; live selection persistence is a gap. |
| C12 Workflow | Disable definition/new starts; revoke run rights separately. | Delete definition only after dependency/retention checks; keep run audit. | Deterministic steps continue if dependencies exist; AI step blocked. | V1 selected first-party workflows; arbitrary automation later. |
| C13 Skill | Exclude from new composition; invalidate affected context caches. | Remove source/registry after references; preserve necessary audit. | Local skills usable offline; missing required registry is explicit. | V1 trusted first-party SOPs; executable third-party skill bundles later. |
| C14 Verification | Revoke producer trust or invalidate basis; retain historical outcome. | Disable check only through explicit policy change; do not erase failure history. | Local checks remain possible; external dependency blocks affected check. | V1 truthful required scope; trusted publication still incomplete. |
| C15 Application (first-party) | Disable blocks new admission; revoke invalidates grants/actors/leases and contains work. | Drain, clear owned refs, retain/delete data explicitly; incomplete cleanup remains visible. | Local functions work only if own dependencies do; partial availability. | V1 vertical first-party proof before execution; S1 is data foundation. |
| C16 Tool | Disable action/adapter and pending invocation permits. | Unregister definition after active work drains; data stays with domain owner. | Availability reflects dependency; deterministic local tools survive AI outage. | V1 existing proven tools; policy parity across entrypoints required. |
| C17 Plugin/extension contribution | Disable view/controller independently; invalidate actors, subscriptions and leases. | Drain subscriptions/processes; retention decision; host dependencies checked. | Cached view can show unavailable; no replacement downloaded automatically. | V1 governed builtins only; third-party execution deferred. |
| C18 Development-environment/profile | Stop autoapplication/reference use; never revoke unrelated grants implicitly. | Delete recipe separately from installed tools/models/project data. | Missing refs stay unresolved; no automatic install/download/network route. | V1 builtin/custom profiles; broad recipe sharing later. |
| C19 System telemetry | Disable optional sampler; safety admission keeps independent required probes. | Remove history/config separately from hardware/runtime resources. | Local readings continue; unsupported metrics unavailable. | V1 RAM/sourced VRAM plus supported extensions; CPU/GPU/disk gaps remain. |
| C20 Credential reference | Revoke handle/use; provider-side revocation distinct and confirmed. | Delete exact owned secret only; shared/official-client auth untouched by default. | Local store may work offline; auth availability does not prove remote reachability. | V1 supported protected storage and rotation/revocation closure. |
| C21 Background task | Cancel admission/leases; distinguish requested stop from confirmed termination. | Clear view/history separately from outputs/audit under retention policy. | Dependency loss blocks/fails specific task; retain project state. | V1 bounded existing admitted tasks; cross-project concurrency proof required. |
| C22 Notification/operator decision | Revoke/expire request; acknowledgement never grants permission. | Dismiss/retention deletion separate from audit and pending operation. | No event feed means stale projection; decisions re-read, not guessed. | V1 durable decisions and truthful journal; event security integration gap. |
| C23 Local runtime | Deny future use; drain leases; stop only owned permitted runtime. | Remove owned installation after dependencies; external runtime left alone. | Local operation possible; missing backend/resource refusal explicit. | V1 accepted canonical paths; further runtime support incremental. |
| C24 External installed application | Disconnect adapter; stop only Covert-owned admitted process if applicable. | Remove association; do not uninstall external software automatically. | Depends on application; connection/client functionality may be independently offline. | V1 narrow proven launch/integration; general embedding/automation later. |
| C25 Vision observation | End capture/context leases and derived cache access. | Delete media per policy; retain minimal permitted evidence refs. | Local path only if supported; unavailable vision never fabricated. | Design now; V1 optional only after scoped vertical proof. |
| C26 Audio/voice interaction | Stop capture/output; revoke modality/route permissions. | Remove settings/media without deleting unrelated project records. | Depends on supported local adapters; no covert cloud substitution. | Design now; push-to-talk vertical slice conditional; always-listening later. |
| C27 Cipher working records | Remove retrieval scope and invalidate caches; owner fact remains authoritative. | Explicit retention/export/delete policy; no automatic cross-project memory merge. | Local records accessible if store healthy; failures do not erase projects. | V1 minimal checkpoints/records; broad autonomous memory later. |
| C28 Resident personality/profile | Disable overlay independently from Resident. | Delete profile separately from project journals/evidence. | Local profile needs no network; model unavailability stays explicit. | BOUNDED V1 structured configuration; learned proposals/fine-tuning later. |
| C29 Avatar/appearance pack | Stop rendering/reset mapping without disabling Cipher. | Remove pack/cache separately from personality/voice/project data. | Builtin assets offline; missing pack has static fallback. | BOUNDED V1 cheap builtin embodiment; custom packs/richer rigs later. |
| C30 Presence/proactive policy | Quiet stops unsolicited output; Buddy Off ends optional capture/presentation. | Reset preference separately from events/audit/tasks. | Unknown/degraded feed; no fabricated engagement. | BOUNDED V1 Important Only/limited Workflow Assist; Social/Full Buddy later. |
| C31 Speech-to-text resource | Stop capture/processing; cancellation observed separately. | Remove adapter/config; shared artifact owner handles model removal. | Local only if proven; no automatic cloud substitution. | BOUNDED V1 push-to-talk if supported; continuous path later. |
| C32 Text-to-speech resource | Immediate mute/stop; generation cancellation where supported. | Remove voice preference/package without deleting shared resources. | Supported local output or explicit text fallback. | BOUNDED V1 supported voice; custom cloning/training later. |
## 2. Capability/lifecycle model

### Shared contracts worth standardizing

Use versioned, typed references across existing owners: operator/principal, workspace/project/checkout, task/attempt, connection/route, artifact and evidence IDs. A reference carries no authority. A UI-supplied ID must be resolved against authenticated canonical state.

A read-only descriptor can share name, source owner, schema version, revision, observed time, capability-specific availability reasons and related references. It is a discriminated projection over domain records, not a writable universal registry. Freshness and source identity matter as much as labels.

Execution intents can share correlation/task IDs, typed action arguments, target references and the operator's intended purpose. The trusted facade/adapter resolves actual principal, scope, risk and current binding. Requests never supply their own approved flag, grant truth or verifier verdict.

Context requests share recipient, purpose, source references, budgets, retention and egress destination. Context Control intersects requests with live permissions and ownership. Cipher, a worker and an app have separate recipient apertures. Evidence records share exact subject identity, producer identity, policy/check version and observed outcomes.

Events can share correlation and subject IDs, source revision, sequence and audience. EventHub transports them; it does not become the authoritative decision/task database. Consumers must reconcile from the originating owner after gaps/reconnect.

### Semantics that must stay distinct

| Domain | Lifecycle and non-equivalence |
|---|---|
| Application/package | Discover -> inspect -> install/register with no grants -> explicit grant review -> enable -> admitted operations. Disable, revoke, update and uninstall each have separate effects. |
| Artifact | Catalogue -> explicitly acquire/import -> staged bytes -> integrity/format validation -> register. A digest match does not establish publisher trust, compatibility or role qualification. |
| Local execution | Resolve artifact/runtime/profile -> compatibility and scoped qualification -> authorized use -> admission -> observed load/inference -> unload/reconcile. |
| Connection/account | Discover/configure -> authenticate/test supported capability -> bind project/role use -> execute. Presence of an auth file is not authentication proof or API entitlement. |
| Worker | Resolve role preference into immutable task assignment -> compose aperture -> admit invocation -> observe output and governed tools -> verify result. A preference is not a running worker. |
| Workflow/skill | Inspect versioned methodology -> select -> compose bounded instructions or instantiate a run. Instructions and templates carry no authority; effects keep their own permits. |
| Project/profile | Register/open or validate/apply declarative configuration. References do not install dependencies or widen grants. |
| Decision/notification | Pending request -> authenticated current operator decision -> exact operation consumption/outcome. Dismissing a notification changes neither grant nor operation state. |

Applications can be installed but disabled, have a revoked permission and no running task simultaneously. Resource readiness is derived for a specific operation at a time, never persisted as a generic green READY.

### Effect boundary and recovery

Every effect uses current authenticated identity, exact subject/revision, permitted scope, context/egress policy and any needed resource admission. Scope checks must happen immediately before the effect; queued work cannot rely on stale approval. Native operator commands and agent requests reach consistent policy semantics, without forcing a modal for every already-permitted human action.

Permission grants describe eligibility; Authority's exact operation permit/ExecutionHandle governs a particular effect. Session-level terminal permission must honestly describe what subsequent session input can do.

For an effect: persist intent/decision as required -> consume permit through its existing owner -> execute -> observe -> persist outcome/evidence. Crash safety must address each boundary. Local transactional writes and external effects have different guarantees. Network timeouts, interrupted shells and partially applied changes can have UNKNOWN outcomes; global exactly-once execution is not promised. Use idempotency where supported and reconciliation elsewhere.

Disable stops new admission and invalidates pending execution/context leases. Revoke additionally invalidates the affected authority/binding revision and contains owned work. Neither claims to undo effects already completed. Update stages a new identity, drains old execution, revalidates compatibility/context and reviews fresh grants before activation. Data-schema migration needs a tested recovery path; an old binary is not automatically a safe rollback after migration.

## 3. Complete operator journeys

The model passes a journey only if both normal and failure transitions have an explicit owner and visible outcome. These are proposed acceptance scenarios.

### J1. Existing project, governed work and restart

1. Launch host and observe actual service health. Open a saved or existing project; validate its root/checkout identity.
2. Restore project-specific layout/profile references and document buffers. Missing files/dependencies are visible. Editor/files/Git remain usable under their own permissions. Opening a terminal still creates or reattaches a genuine session through its owner.
3. Bind Cipher independently; UNBOUND/DEGRADED does not block deterministic work. Retrieve permitted project checkpoint/context.
4. Inspect and explicitly choose a supported worker route for the project/role. Selection persistence must be implemented before this can be a supported journey.
5. Submit a task; freeze project/checkout/root, role/route, context basis and source identity. Resolve current Authority and Admission; refusal produces reasons and no execution.
6. Execute approved effects, preserving attempt/output records. Run independent required verification against the exact resulting source/artifact. Changed source invalidates current verification.
7. Close views with unsaved/process semantics; shut down only owned work under defined policy. Persist durable state without live actor handles.
8. Restart: restore views, reconcile actual sessions/runtime/tasks, retrieve checkpoint and explain interrupted or stale results. Do not automatically execute history, replay permits or mark an old PASS current.

**Failure probes:** corrupt layout, changed file, missing root, revoked grant, worker unavailable, verification failure and crash after an effect but before its outcome is recorded. No probe may convert unknown into success.

### J2. Local-model onboarding

1. Search catalogue or bounded approved local directories. Results name source/revision, file set, format/quant, license and metadata freshness.
2. Inspect actual runtime compatibility and estimated disk/RAM/VRAM requirements. A recommendation explains its evidence; it does not select or acquire.
3. Operator chooses source/artifact. Preview download destination, required disk and network/credential use; acquire explicitly.
4. Download to staging with bounded storage/headroom and resumable source identity. Interrupted/disk-full acquisition leaves quarantined/incomplete bytes.
5. Validate complete file set, observed digests and format. Mismatch refuses registration/use; source hashes and publisher trust remain separate.
6. Register canonical artifact/model identities. Compatibility and role qualification use the exact artifact/runtime/profile/check basis. If no qualified adapter exists, keep the artifact registered but execution unavailable.
7. Assign a project/role preference explicitly. Admission evaluates current headroom at load/inference, not the earlier recommendation.
8. Broker starts/adopts only under supported ownership rules. Observe actual loaded identity and inference. Removing the artifact later checks active leases/shared references.

**Gap exposed:** current pinned runtime qualification does not support “any discovered model.” V1 must declare supported profiles and leave unsupported imports honestly nonexecuting. Multi-file models, tokenizers/projectors and variants need complete manifests, not one filename.

### J3. Provider/account onboarding and disappearance

1. Add a supported API route or supported client/account transport, with visible endpoint/account identity.
2. Authenticate/configure through the actual credential owner. Client installed/auth-file detected is merely discovery. Test the exact supported transport.
3. Show supported capabilities, evidence freshness, destination/egress and usage policy. A configuration test need not imply every model/tool/vision capability passed.
4. Explicitly bind project/role use and permitted data egress. A test call itself has intentional scope; no silent paid/network probe.
5. Freeze actual route identity at invocation; execute and preserve observed request outcome.
6. Simulate connection loss, expired credential and changed endpoint. Configured can remain true while eligibility/reachability fail. Stop new dispatch; show interrupted or uncertain in-flight outcome.
7. Reconnect the same validated binding or inspect a changed binding. Retry only when safe. Alternative routing is an explicit choice.
8. Revoke Covert use and optionally revoke/delete the exact credential under its owner. Removing an adapter does not silently log out another application or delete shared credentials.

**Failure probes:** unexpected remote model alias change, unsupported modality/tool schema, cancellation unsupported, stale test and cross-project credential use.

### J4. Development-environment profile

1. Create versioned declarative profile with layout, shortcuts, supported tool/application refs, terminal settings, model roles and workflow preferences.
2. Save without commands, secrets, executable hooks, grants or cloud consent.
3. Apply to a project using a diff preview. Resolve every reference and distinguish required from optional components.
4. Apply harmless presentation/preferences; list missing or incompatible capabilities with reasons. A cloud role preference cannot itself enable egress.
5. Operator separately chooses required installation/download/configuration/permissions. Each effect enters its domain's journey; cancelling one does not corrupt project files.
6. Save project-specific application/resolution state. Restore later, rechecking references and availability; missing dependencies remain visible.
7. Export/import recipe without machine credential handles or transferable authority. Rebind account/resource refs locally and treat imported configuration as untrusted.

**Gap exposed:** profile application is not an atomic transaction over installations, accounts and side effects. Report partial resolution explicitly; rollback configuration does not claim to undo external operations.

### J5. First-party application/extension lifecycle

1. Discover trusted builtin application/contribution. Inspect actual publisher/source, manifest/artifact digest, version compatibility and requested capabilities.
2. Register installation with no granted permissions and no executed startup hook. Inspect identity/trust independently.
3. Operator grants declared bounded scopes. Trusted enrollment binds the exact instance principal to its permitted adapter actor. Missing required grants keep affected capabilities unavailable.
4. Enable only after current dependencies/context and integrity validate. Open view without automatically starting models/processes. Execute effects through exact Authority operations.
5. Revoke a capability while work is queued/running. New effects refuse; leases and owned work drain/contain. Report residual uncertainty.
6. Disable; retain configuration and grant history while suspending admitted execution/subscriptions.
7. Stage update with old/new identities separated. Same version with changed manifest/artifact still invalidates old binding; inspect grant changes and migrations. Failed update stays disabled/recoverable.
8. Uninstall after stopping new admission and reconciling owned processes/handles. Retain/delete owned user data explicitly. Cleanup failure remains UNINSTALLING/failed, not success; audit retention is separate.

**Gap exposed:** S1 serialization cannot execute this journey. V1 needs one actual first-party vertical slice before enabling a general application loader. Existing built-in UI surfaces may remain native capabilities meanwhile.

### J6. AI unavailable

1. Remove Cipher binding, provider connectivity or local runtime availability independently.
2. Open project, edit/save permitted files, inspect local Git and use available terminals/deterministic tools.
3. AI actions show the actual dependency reason; no fake response, automatic alternative routing or global broken-workstation verdict.
4. Preserve project buffers, profiles, task checkpoints and account configuration.
5. Restore the dependency and revalidate binding/route/context. Resume a task only from a reconciled safe point; changed actions require current permission.

**Failure probes:** AI failure during a save/test, shared runtime disappearance, required workflow AI step unavailable and user opening deterministic tools while pending AI decisions exist.

### J7. Switch project while work continues

Start an admitted task in A. Open B after saving/restoring the foreground session. A's task retains A's checkout/context/actor/route; task-strip metadata still identifies A. Cipher clears its foreground aperture before loading B. A's pending decision explicitly names A and cannot be approved as a B operation. Revoking A blocks A's future effects without corrupting B.

If project-addressed background execution is unproven, require a safe pause/finish before switching rather than rebinding a global workspace underneath it. Test two worktrees of the same repository and two clones with identical names.

### J8. Cipher's laptop, vision/audio and retained context

Cipher retrieves a scoped checkpoint with references to actual tasks/evidence, distinguishing notes from observed facts. Operator explicitly attaches an image/window capture or activates a microphone. The configured modality adapter supplies provenance and capability state; a capable model receives only the allowed aperture/destination. Transcript/screenshot content cannot issue its own authority.

The resulting intent enters the same task/decision path as keyboard input. Stop capture and test modality failure: keyboard/editor continue. Retention/deletion invalidates media/context caches while preserving only permitted audit references. Full-desktop capture, continuous listening and cloud modality routes need independently proven scopes; no implicit adoption.

## 4. Ecosystem/extensibility and interoperability model

### What “bring your resources” means

| Resource category | Integration meaning |
|---|---|
| Native Covert capability | Existing trusted platform/domain action exposed through its typed adapter. A window is not automatically an installable app. |
| First-party Covert application | Versioned builtin controller with declared principal, scope, storage, context and lifecycle contract. |
| External installed application | Supported launch/CLI/protocol observation or action; application remains host-owned. No general internal embedding promise. |
| Provider API | Supported protocol/endpoint/credential/capability adapter with explicit egress and failure/cancellation behavior. |
| Subscription/client integration | A specifically supported authenticated transport/account path; no assumption of interchangeable subscription/API rights. |
| Local runtime | Broker adapter with resource, ownership, startup/shutdown, identity and profile compatibility proof. |
| Model artifact | Versioned validated data/file set; compatibility and qualification separate from acquisition. |
| Plugin/extension | Declared contribution points; passive UI and executable controller privileges distinct. |
| Workflow | Versioned methodology/run definition whose effects use existing governed tools. |
| Development profile | Declarative configuration referencing capabilities, never portable credentials or grants. |

Add support incrementally through an adapter registration/catalog entry, typed inputs/outputs, canonical domain state projection, identity/compatibility basis, scope enforcement, context/egress controls, cancellation/recovery, evidence and actual packaged tests.

A provider needs authentication/storage integration and a capability matrix; a runtime needs owned-process/profile/resource proof; a tool needs exact effect and retry semantics; a model needs complete artifact/route metadata and task-relevant qualification. Not every model requires a new runtime or credential system.

**Adding ordinary supported integrations should not require changing:** desktop/window logic, project identity, Cipher persona, grant doctrine, Context Control ownership, task/evidence correlation or the independent verifier. New capability families may require explicit versioned contract extension and approval; adapter extensibility does not excuse incompatible semantics.

Dependency references must be versioned and inspected. Cycles in required activation dependencies are rejected. Missing optional capabilities degrade the named operation, not the entire platform. Updating a dependency can stale qualification, context and grants whose basis changed.

### Discovery and presentation

Use projections from authoritative inventories and bounded probes. Do not create a second database containing guessed installed/ready/running facts. Maintain shared correlation/reference conventions and authenticated aggregate read views.

- Applications/launcher: supported builtins and installed contributions; distinct “browse available” view. Discovery never installs or executes.
- Models: separate local inventory, artifacts, route/role preferences and downloadable catalogue. State source and last refresh visible.
- Connections: actual account/client/endpoint records with discovery, configuration, authentication and test states.
- Projects: saved projects and their profiles/layouts, plus explicitly approved root bindings.
- Contributions: package/source identity, contribution point, dependencies and why enabled/blocked.
- Cipher recommendations: inspectable suggestions with evidence and required next actions; no opaque automatic adoption.

Avoid scanning every disk/account on startup. Request bounded directories and supported client probes. A presence probe neither reads secrets nor tests inference. Show “why unavailable” at the item/action and offer a detailed window only when needed.

## 5. Project model

Recommended hierarchy: host/user installation -> Developer workstation -> many Project IDs -> explicit checkout/worktree bindings -> document/session/task/attempt IDs. Root paths, repository URLs and display names are locators, not sufficient identities or grants.

Each project owns separate layout/profile application, context namespace, workflow/model preferences, approval scope references, recovery records and task history. Credentials/resources may be shared under their owners, while usage grants and context remain per project. A clone/import cannot copy authority by copying an ID file; trusted local registration/rebinding determines the installation-specific identity. Root movement changes a binding revision and invalidates affected pending work until reconciled.

V1 target: many known projects; one foreground editor/governed workspace; one foreground Cipher aperture; multiple actual terminals in that workspace; bounded identifiable admitted background work. Heavy model roles may run serially according to Admission. “Resident” need not imply every supporting model remains loaded at all times.

Foreground is a presentation selection, never an execution scope variable. Background tasks capture immutable origin scope and retain project-addressed service handles. Before launching fresh AI work after a project switch, release old aperture/leases and retrieve the new scoped context. Cross-project summaries use safe metadata and deliberate detailed retrieval.

Current root-bound route construction is a migration concern. Either services are isolated per project or each trusted request resolves a project-bound instance. Merely replacing a global workspace path risks writes to the wrong root. If the existing backend cannot retain A safely while B opens, V1 must pause/finish A before switching until that path is proven.

Later multiple foreground windows/workspaces fit this model without redesigning identity. Simultaneously active agents and automatic cross-project context are separate capabilities, not consequences of opening more windows.

## 6. State model and service visibility

States are independently owned dimensions. Preserve existing domain enums through explicit projections; do not silently migrate them into one universal enum.

| State | Precise meaning / limit |
|---|---|
| INSTALLED | A named component/artifact/application is registered/present at a known identity. It may be disabled, incompatible or unusable. |
| CONFIGURED | Required settings exist and pass the declared config validation. Not authentication or liveness. |
| AUTHENTICATED | The supported adapter has evidence for a named identity/session at a stated time/scope. File presence is insufficient. |
| AVAILABLE | A named capability can be offered under declared current dependencies; use domain reasons. Admission/authorization may still be needed. |
| REACHABLE | Endpoint/transport responds to the specified probe. Does not prove account, model capability or trust. |
| QUALIFIED | Evidence supports the specified model/artifact/runtime/profile/role/test basis. Changed basis stales it. |
| SELECTED | An explicit preference or recorded task assignment exists; distinguish those two. Does not start work. |
| RUNNING | Current owner observes a process/task/session at its expected identity/generation. A loaded model and running inference are different observations. |
| AUTHORIZED | Valid current principal/scope/decision or exact permit exists. Permission is not execution or successful completion. |
| VERIFIED | Named independent checks passed for exact subject/policy/producer basis. Historical verification does not certify current changed work. |
| DEGRADED | Derived explanation that some named functions remain usable and others are impaired; affected functions/reasons listed. |
| DISABLED | Admission/activation intentionally stopped. Installed data and historical grants can remain. |
| REVOKED | Particular rights/binding invalidated. Existing external account, files or already-completed effects may remain. |
| UNKNOWN / STALE / BLOCKED | Evidence absent, expired or dependency preventing progress; never collapsed into false/zero/ready. |

No actor can manufacture these states through caller booleans. Include source owner, subject/revision, observed time, reason and evidence where relevant. Authentication/qualification cannot be promised indefinitely from one test. For opaque remote aliases, label the identity/provenance limits rather than claiming exact weight identity.

Backend services normally remain behind application actions. Surface them when they affect a decision, result or availability:

| Event | Operator experience |
|---|---|
| Permission requested | Exact target/action/scope and consequence in a decision window; project/app/task identity remains visible. |
| Authority denial | Operation stays unexecuted; reason and permitted alternatives; no model retry bypass. |
| Resource refusal | Actual Admission reason/sample/estimate and recovery options; editor remains usable. |
| Provider egress required | Destination and selected context/usage intent at the relevant action, not only a buried setting. |
| Untrusted artifact/contribution | Inspection/quarantine detail; no fabricated integrity/qualified badge. |
| Verification failed/incomplete | Source-scoped result, required failed/missing checks and evidence; no generic green completion. |
| Interrupted/uncertain effect | Reconcile/resume options; no false “cancelled and undone.” |

Compact persistent indicators represent exceptions, pending decisions and current resource pressure. Details live in their task/tool/journal windows. The journal is a correlated view, not a new security authority.

## 7. Important gaps exposed by this exercise

| Gap | Why it matters / proposed response | Relative cost and priority |
|---|---|---|
| Live app-principal, scope and context enforcement | S1 records do not authorize controllers. Prove one project-read vertical slice, then mutations/process/network independently. | High; before new app execution |
| Model role-selection persistence/execution adoption | Current Model Access projection declares read-only/no execution effect. Close preferences, precedence and immutable dispatch binding in its owning lane. | Medium–high; V1 journey prerequisite |
| Project addressing and concurrent ownership | Root-bound services/global active context can misdirect background work. Isolate instances or resolve exact project per trusted request. | High; switching/background prerequisite |
| Trusted verifier/publication integration | Strict outcomes alone are not trusted receipts or push eligibility. Bind exact source/check/producer evidence without merging Ghost verdicts. | High; release/publication gate |
| Credential/connection consumer reconciliation | Protected stores and BYOK/client identities have distinct owners; unify lifecycle semantics, not necessarily storage implementations. Prove rotation/revoke propagation. | Medium–high; supported routes |
| App events and context leases | Audience/producer enforcement, durable decisions and invalidation are incomplete; unsafe metadata aggregation leaks state. | High; first-party execution gate |
| Profile store/resolver | Declarative settings, reference rebinding, partial application and migrations need a owner-backed contract. | Medium; V1 customization |
| Acquisition/disk/artifact completeness | Large transfers, staging and shared references require space reservation, cancellation and resumable integrity. | Medium–high; V1 catalogue path |
| Skills and durable Resident records | Bounded excerpt loading is not rich Skill Intelligence; silent truncation can remove mandatory instructions. Notes must remain distinguishable from verified facts. | Medium–high; continuity/composition |
| Telemetry/modality support | Live CPU/GPU/disk and vision/audio adapters require real platform support and measured overhead. | Medium–high; capability-specific proofs |

Documentation or a new launcher cannot close these gaps. Conversely, missing new app contracts need not prevent using existing native deterministic capabilities through their already-supported paths.

## 8. V1 versus later boundary

**V1 target:** faithful retro desktop, conventional internal windows, existing native developer functions preserved, many saved/scoped projects with one foreground workspace, actual multi-terminals, explicit supported role/route selection, evidence-backed supported local/API/client paths, useful declarative profiles, compact Cipher with scoped continuity, true telemetry, durable decisions/recovery and a narrow proven first-party application lifecycle.

Support claims remain evidence-specific. If any required vertical journey is blocked, mark it blocked and resolve release scope explicitly; do not call the whole platform ready because its manifest parses.

**Design now, activate only after proof:** adapter contracts, project identities, contribution points, principal/scope model, dependency identities, context apertures, lifecycle/recovery semantics and modality paths. Vision/audio are part of the requested vision; a scoped selected-image/push-to-talk slice can be V1 only after actual proof and resource measurement. This review does not silently remove them or authorize implementing them.

**Later:** arbitrary third-party executable contributions, unrestricted native app embedding/automation, broader runtimes/models beyond qualified evidence, multi-foreground workspaces/agents, marketplace distribution/trust operations, continuous capture/listening and rich multi-monitor/pop-out behavior. Existing legitimate functionality is not removed by these proposed boundaries.

The V1 ecosystem should be small enough to validate end-to-end, while contracts let supported integrations expand without changing the desktop's basic architecture.

## 9. Things still overlooked

1. **Host power/lifecycle:** laptop sleep, hibernate, lock, forced reboot and update can interrupt sessions/network observations. Reconcile process identity and stale samples; do not silently resume commands or capture on unlock.
2. **Data ownership and portability:** projects remain ordinary accessible files; export profiles, scoped records and evidence. Distinguish uninstalling Covert, deleting a project and deleting account credentials. A recovery/export path reduces lock-in.
3. **Retention versus deletion:** memory, audio/images, logs and audit have different policies. Retained references/hashes may still reveal information. Decide minimal durable audit and permitted deletion explicitly.
4. **Dependency updates:** runtime/adapter/model/source changes can stale qualifications and invalidate permissions even when a friendly label is unchanged. Include migrations and compatibility evidence.
5. **Shell and external-tool isolation:** ordinary developer shells may have broad host-user rights. Scoped model tools and first-party controllers must not inherit that reach automatically. If containment is not proven, do not advertise a sandbox.
6. **Resource/usage fairness:** background jobs, downloads, Resident, workers and UI need bounded admission/backpressure. Account usage/quota information can be stale or unsupported; show limits as such. Never promise a subscription is free/unlimited.
7. **Context quality:** derived summaries can lose constraints or turn model guesses into facts. Preserve provenance, corrections, uncertainty and expiry; verify source when it matters.
8. **Operator handoff:** expose the actual plan/diff/command/result so a user can take over, repeat deterministic work and continue without Cipher. Task records should support handoff without replaying approvals.
9. **Distribution/trust:** first-party namespace, source label and checksum do not authenticate publisher. Prove shipped builtin catalogue identity/compatibility and later define third-party trust/update/revocation.
10. **System surfaces versus apps:** Models, Connections, telemetry and Authority details can be views over services. Assigning app-like chrome does not justify installing duplicate controllers or another registry.

## 10. Recommended changes to the proposed direction

Keep the five-part relationship model, visual references and coherent workstation. Refine “one context” into one coherent foreground work experience backed by separate, explicitly retrieved project/actor apertures. Keep Cipher's laptop as a view and workspace over existing durable sources, not a competing operating kernel, memory truth store or permissions authority.

Replace a universal capability lifecycle with shared references/effect/context/evidence contracts plus distinct domain lifecycles. Give interoperability a finite supported matrix rather than a universal-compatibility claim.

Design project-addressed services before increasing concurrent work. Freeze only the contracts and user behavior that are agreed; unresolved execution proofs remain delivery gates. A complete capability map alone is insufficient to declare the platform/workstation freeze ready: the identified principal, project-addressing, selection and recovery boundaries still need concrete decisions and proof plans.


## 11. Resident Experience Addendum — Standard, Buddy and Developer's Special

This section incorporates the subsequently supplied Resident Experience Addendum. It extends this review without authorizing implementation or changing the retro references. Capability classes C28–C32 add personality, assets, presence policy and distinct speech resources to the map.

### A. Interpretation and critique

**Verdict: BOUNDED V1, with richer capabilities POST-V1.** A configurable embodied Resident is coherent with the workstation. It can make continuity and interaction understandable, and the original Developer's Special persona can differentiate Covert.

The main product risks are interruption, additional scope and confusing presentation with operational authority. A charming assistant that blocks a terminal, consumes model headroom or obscures a denial damages the workstation. Measure usefulness as successful work/handoff/recovery, not conversation volume or animation time.

The strongest initial Buddy is a recognizable, optional companion with concise personality, an unobtrusive avatar, explicit voice activation and scoped working records. Standard Resident must remain fully functional and equally capable under the same permissions.

### B. Architecture: one Resident with optional layers

| Layer | Responsibility | Boundary |
|---|---|---|
| Resident | Stable identity/binding, request understanding and coordination | No second Buddy agent, task store or privileged actor |
| Personality | Versioned structured preferences compiled into a short presentation instruction | Cannot edit policy, grants, verifier outcomes or canonical records |
| Memory/working records | Scoped preferences, project journals/checkpoints and source references | Existing Context Control/memory/task owners; notes are not authoritative task facts |
| Voice | Capture/activation, STT, speech queue/TTS and independent stop controls | Distinct capture, inference, output and egress; no command authority from spoken words |
| Vision | Purposeful selected observation and qualified specialist route | Structured state preferred; captures have explicit source/scope and provenance |
| Avatar | Passive rendering of interaction cues and cosmetic animation | No model calls, tools, credentials, network or grants |
| Presence | Event filtering, interruptibility policy, proactive level and animation scheduling | Does not manufacture operational state or initiate unapproved effects |
| Delegation | Existing orchestrated assignment to speech/vision/coding/reasoning resources | Exact task/context/route identity and resource admission retained |
| Authority | Authenticated operator decisions and exact effect permits | Same enforcement regardless of personality, modality or visibility |

Human speech -> admitted audio capture -> supported STT -> transcript/intended request -> same Resident/task path -> optional qualified specialist -> governed observation/result -> readable response -> supported TTS -> passive avatar cues.

Operational events independently feed the presence projection. An idle cosmetic action feeds only the renderer. The presence layer has no execution adapter and cannot convert an animation into a tool request.

Record specialist identity in the task's advanced details. “Cipher reviewed this through vision route X” is meaningful. Do not claim the Resident's text model personally perceived or executed what a specialist performed.

### C. Standard versus Buddy

| Feature | Standard Resident | Buddy enhancement |
|---|---|---|
| Identity, binding, capabilities, Authority, task/context ownership | Same Resident | Unchanged |
| Project questions, governed work, supported explicit voice/vision | Available where configured | Same paths |
| Presence | Compact status; full Cipher window on request | Optional persistent avatar and conversational presentation |
| Personality | Concise professional default and basic preferences | Rich structured customization and Developer's Special |
| Voice | Explicit activation/session | More conversational availability; continuous mode separately opted into and proven |
| Proactivity | Required decisions and essential status | Configurable workflow/social presence |
| Cosmetic behavior | None required | Optional bounded idle/expression clips |
| Memory | Scoped continuity and explicit preferences | Same sources, richer presentation; no automatic broader retention |

Keep two settings distinct: **operator detail level** (Beginner/Standard/Expert) and **Resident presentation** (Standard/Buddy). “Expert Buddy” and “Beginner Standard Resident” are valid combinations. Voice activation and animation intensity are independent controls, not implicit effects of either setting.

### D. Developer's Special: original behavioral specification

Use a first-party, versioned personality profile, not copied dialogue or a named character imitation.

Proposed defaults: high directness and technical challenge; low flattery; medium dry humor; moderate opt-in abrasive language; low unsolicited chatter; concise explanations; demanding evidence standards; loyalty expressed by protecting the operator's work and agency.

Behavioral rules:

1. State the diagnosis/recommendation first and connect criticism to a specific defect, assumption or missing proof.
2. Challenge consequential engineering decisions; stop arguing once the operator makes an informed permitted choice.
3. Admit uncertainty and correct errors directly. Confidence, sarcasm and persona must not substitute for evidence.
4. Occasional teasing addresses the work or a reversible habit. It must not become repeated personal attacks or manipulation to obtain permissions.
5. Technical instructions remain executable and readable. Put jokes after the useful explanation and omit them entirely from critical decisions.
6. No sarcasm in permission/egress/credential/security dialogs or canonical verifier messages. A separate conversational remark may accompany a clear result, never replace it.
7. If output needs qualification, keep the qualification. Do not claim “finished” for dramatic effect.

Original sample responses:

- “That memory estimate counts the weights and forgets the context cache. Recalculate it before asking the runtime to load.”
- “The build passed. Verification is still incomplete. You have a binary, not a release.”
- “Good, the regression is reproduced. Fix the cause before decorating the error message.”
- “That shortcut is going to cost you three recovery paths. Show me what it actually saves.”

Persona is **configuration first**: bounded enums/levels for directness, verbosity, challenge, humor, profanity, address, expression and unsolicited frequency; compile a small effective profile into the existing composer. Persist preferences explicitly. Show a preview, reset and per-project override. Free-form additions remain bounded user preferences and cannot introduce executable rules.

Learned preferences should initially be suggested changes requiring operator acceptance. “You often choose concise answers; save that preference?” is safer than silently changing personality or interpreting frustration as permission.

Actual fine-tuning is not a V1 prerequisite. Compare baseline versus profile-based behavior on the exact Resident artifact, runtime and context budget. Evaluate technical accuracy, uncertainty, useful criticism, task completion, permission coercion, persona drift, latency and instruction retention. Only pursue a trained variant if measured gains justify training/requalification/storage cost. Any tuned model is a new artifact/qualification basis; personality weights cannot replace backend enforcement. No persona evaluation was run in this review.

### E. Avatar, interaction states and cosmetic idle behavior

Do not model all listed states as one exclusive enum. Cipher can be listening while a project build runs and a decision is pending. Use a small projection with independent dimensions:

- Binding: bound/degraded/unavailable, with generation and freshness.
- Voice: capture off/listening, transcription processing, output speaking.
- Engagement: idle/attentive/processing plus actual turn/invocation reference.
- Work: actual task references/phases; delegation/review require corresponding operation.
- Attention: pending decision/warning references.
- Presentation: style/expression and cosmetic clip, with no operational claims.

WORKING requires actual associated work. WAITING_FOR_OPERATOR requires a live unresolved request. DELEGATING and REVIEWING need actual task events, not guesses from generated prose. A stale feed makes the operational indicator unknown rather than continuing a busy loop.

Cosmetic reading/sitting/TV/laptop clips are explicitly tagged idle presentation. They trigger no model, application, network or filesystem action. The tiny laptop animation is separate from Cipher's real working-record environment; selecting the latter opens its actual records.

V1 should use one small original green/black 2D embodiment, optional static mode and a few bounded clips. Later richer rigs can implement the same renderer contract. Operator-created appearance packages are passive assets and declarative state mappings: no JavaScript, HTML, hooks, remote URLs or arbitrary executable shader/code. Prefer validated raster sprites in the initial import format, with strict encoded/decoded size, frame count and duration bounds. Voice/personality references cannot autoactivate their resources.

Obstruction rules: no avatar/speech bubble over editor/terminal text entry, selection/caret, controls, errors, verifier results or permission dialogs. Reserve safe edge regions; pointer pass-through outside explicit avatar controls; pin/move/hide available through keyboard. If no safe region exists, use a compact glyph. Constrained wandering can wait; full desktop roaming creates unnecessary layout/accessibility complexity.

Screen-reader users receive textual status/controls, not continuous animation announcements. Reduced-motion/static preferences and mute must work without hiding important operational status.

### F. Resource strategy

Keep the Buddy renderer in the existing host WebView; no additional WebView or permanently running 3D engine. Proposed **unmeasured incremental targets**: at most about 50 MiB renderer/decoded assets above the agreed UI baseline, with idle CPU remaining within the total UI target. Count full UI process-tree changes and shared GPU activity, not only a sprite's JavaScript object.

Render only state changes where possible. Candidate ceilings: static or 2–4 FPS cosmetic idle, up to 15 FPS short active clips; suspend rendering when hidden. No model inference is needed to choose a sitting/reading animation. Cap asset caches and clip duration.

Microsoft documents WebView2 instance/process overhead and recommends minimizing redundant controls and profiling actual content. MDN documents visibility events/background throttling; hiding an internal element does not ensure its work stops. Therefore Covert must explicitly suspend Buddy's internal renderer, not rely on CSS hiding or browser tab behavior. See primary sources below.

Voice/vision model memory belongs to the existing resource admission policy, measured separately from embodiment. Load specialists lazily, reuse compatible services under bounded leases and unload/release when safe. If Resident and worker cannot coexist, expose the actual pending resource state; do not fake attentiveness or switch to cloud.

Resource pressure can reduce cosmetic intensity, defer social remarks or stop optional animation automatically. It must not change permissions or substitute an inference route. Measure idle, TTS, STT, selected-image inspection, coding load, long-session leakage and hidden/avatar-off behavior on the target laptop. Proposed budgets are not runtime evidence.

### G. Privacy, controls, proactivity and persistence

Voice modes: DISABLED, PUSH_TO_TALK, ACTIVE_CONVERSATION and CONTINUOUS. Buddy Mode does not itself activate the microphone. Active conversation is a time-bounded session; continuous listening needs explicit setup and capability proof. Display actual capture, processing and output independently, even when the avatar is hidden.

Controls operate outside Resident inference:

| Control | Exact effect |
|---|---|
| Mute speech | Stop audible output/queued speech; does not claim microphone stopped |
| Stop listening | End capture/session and pending optional transcription where cancellable; visible actual state |
| Stop speaking | Stop playback immediately; cancel generation where supported, recording uncertain provider outcomes |
| Quiet | Suppress unsolicited conversation/jokes while preserving visible decisions/warnings |
| Hide avatar | Hide/suspend renderer; capture indicator remains if explicitly active |
| Buddy Off | Stop optional capture/speech/proactivity/embodiment and return to Standard Resident; does not silently cancel legitimate background tasks |
| Stop/revoke task | Separate actual task/Authority operation; state reflects confirmed outcome |

Late callbacks from old utterances, routes or project generations cannot start work in the new foreground project. Keep capture/transcription provenance and request IDs. Audio feedback from Buddy's own speech must not trigger commands. Background speech, false wakeups and ambiguous transcription do not constitute authenticated approval. V1 effect approvals stay in the trusted existing operator decision path.

Wake-word availability can later use a specifically evaluated local detector before activating richer processing. Do not stream ambient audio to a provider by enabling a character. Temporary capture buffers need bounded retention; locking/sleeping/restarting stops capture/output and requires deliberate reactivation. Saving an activation preference is not restoring microphone-active state.

Vision remains selected and purpose-scoped. Avatar “looking at a window” is cosmetic unless an actual capture is visibly active. Use structured platform data instead of OCR for existing task/model/file truth.

Proactive levels:
- SILENT: no unsolicited conversational output; required decisions/warnings remain visible.
- IMPORTANT ONLY: failures, required decisions, meaningful pressure and completed work, coalesced.
- WORKFLOW ASSIST: selected checkpoints and stale verification/task reminders, with cooldowns.
- SOCIAL: opt-in harmless conversation/jokes within configured quiet hours and interruptibility.
- FULL BUDDY: stronger optional presence, still bounded by cooldowns, capture/egress/resource policy and operator control.

Default Buddy to IMPORTANT ONLY. During active typing, meetings/presentation mode or a permission decision, suppress social interruptions. As an initial candidate, at most one nonessential unsolicited spoken remark per ten minutes; critical events use prioritization/coalescing rather than repeated chatter. Preferences should let users reduce that to zero. No inference of emotional state from inactivity.

Persist personality/avatar/voice references, chosen proactive/animation settings, explicitly approved preference changes and scoped journals/checkpoints. Restore unresolved decisions only by rereading their authoritative current state. Do not restore active microphones, queued jokes/speech, live actor handles or stale work indicators.

First start: Standard Resident works first. “Enable Buddy” introduces avatar/style/proactive choices with optional voice setup; voice defaults disabled. Configure one useful choice at a time with live preview and a visible resource/dependency assessment. More tuning can happen later; no forty-question questionnaire or model download before explaining the requirement.

### H. Additional risks and improvements

- Personality settings need testable examples; sliders alone are ambiguous. “Challenging” must not mean argumentative on every action.
- Buddy should follow an interruptibility policy, not compete for attention. Include focus/presentation/quiet schedules.
- Persist useful preferences deliberately; do not silently infer sensitive personal traits or rewrite technical journals to fit the persona.
- Voice/perception error handling needs confirmation and cancellation epochs. A natural interaction must still expose exact intended actions.
- Spoken warnings can leak project details to people nearby. Allow private output modes and concise summaries.
- An avatar import is an asset-decoding/unpacking boundary even without scripts. Third-party imports remain deferred until validated.
- Late speech, duplicate event delivery and stale project context are important race cases.
- Buddy Off must be clear about ongoing tasks; character visibility is not process cancellation.
- Do not call sarcastic presentation a literal emotion. Expressions are designed character cues tied to interaction events, never evidence of consciousness.
- Cosmetic boredom or sleep should not imply failed readiness. Keep operational status legible independently.
- Maintain project/account isolation even if the same friendly personality appears globally.

### I. V1 versus later

| Capability | Verdict | Reason |
|---|---|---|
| Stable Resident, structured state, scoped records, independent stop/control paths | CORE V1 | Required platform continuity and truth |
| Optional Buddy toggle, original Developer's Special, bounded structured personality | BOUNDED V1 | Useful differentiation without new authority or training |
| Small builtin avatar/static alternative, limited idle clips and safe placement | BOUNDED V1 | Controllable presentation; must meet measured overhead |
| Explicit supported voice/PTT and selected-image vision | BOUNDED V1 conditional | Need real adapter/permission/resource/failure proof; keyboard fallback |
| Brief active conversational voice sessions | BOUNDED V1 conditional | Only after PTT/cancellation/echo/project-switch path passes |
| Continuous/wake-word voice, Social/Full Buddy proactive presence | POST-V1 by default | Higher capture, interruption, resource and false-activation complexity |
| Rich avatar rigs, free roaming, custom packs/voices and trained personality variants | POST-V1 | Not necessary to establish dependable workstation behavior |
| Personality changing grants, emotional claims as operational facts, automatic hidden media/commands | RETHINK / reject | Conflicts with the requested same-Resident/truth boundaries |

### J. Final recommendation

**BOUNDED V1.** The addendum changes my earlier blanket deferral of embodiment: a cheap opt-in builtin avatar is reasonable in V1. Rich embodiment and permanent listening remain separate later investments. Buddy can have persistent identity/presentation without continuous inference or microphone capture.

Acceptance requires the same task/evidence/permission outcomes with Standard, Buddy, avatar-off and audio-off configurations. Compare persona accuracy, interruption usefulness and resource footprint; explicitly test mic stop/restart/lock, hidden avatar, late callbacks, two project scopes and stale operational events. These are proposed checks, not tests performed.

### Primary technical references for this addendum

- [Microsoft WebView2 performance guidance](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/performance): supports minimizing redundant controls, inspecting the whole process footprint and measuring real content. It does not certify Covert's budgets.
- [MDN Page Visibility API](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API): supports visibility-aware suspension; CSS hiding alone is insufficient for internal application lifecycle.
- [Liquid model library](https://docs.liquid.ai/lfm/models/complete-library): documents distinct text, vision and audio families and training paths. This supports investigating separate modality resources; it does not prove Covert compatibility or that fine-tuning improves this persona. Vendor context limits are not a Covert memory allocation recommendation.

All personality, avatar, speech and presence components here are proposed integration boundaries. Existing accepted Resident, Context Control and execution owners retain their roles.

### Source anchors

These links identify inspected source/documentation, not live-runtime certification:

- [S1 object taxonomy](sandbox:/workspace/scratch/a9eeb25c9b6a/covert-platform-s1/docs/platform/S1/OBJECT_MODEL.md), [app contract](sandbox:/workspace/scratch/a9eeb25c9b6a/covert-platform-s1/docs/platform/S1/APP_CONTRACT.md), [ContextManifest](sandbox:/workspace/scratch/a9eeb25c9b6a/covert-platform-s1/docs/platform/S1/CONTEXTMANIFEST.md), [implementation limits](sandbox:/workspace/scratch/a9eeb25c9b6a/covert-platform-s1/docs/platform/S1/IMPLEMENTATION_STATUS.md).
- [Model Access contract](sandbox:/workspace/scratch/a9eeb25c9b6a/covert-platform-s1/common/contracts/model-access.ts), [BrokerModelRuntime](sandbox:/workspace/scratch/a9eeb25c9b6a/covert-platform-s1/node/src/services/broker-model-runtime.ts), [ProviderConnections](sandbox:/workspace/scratch/a9eeb25c9b6a/covert-platform-s1/node/src/services/provider-connections.mjs).
- [Git routes](sandbox:/workspace/scratch/a9eeb25c9b6a/covert-platform-s1/node/src/routes/git.ts), [skill loader](sandbox:/workspace/scratch/a9eeb25c9b6a/covert-platform-s1/node/src/services/skills-loader.mjs), [secret-store implementation](sandbox:/workspace/scratch/a9eeb25c9b6a/covert-platform-s1/node/src/services/secret-store.mjs).
- [Workspace bundle owner](sandbox:/workspace/scratch/a9eeb25c9b6a/covert-platform-s1/workbenches/manager.mjs), [terminal UI/session wiring](sandbox:/workspace/scratch/a9eeb25c9b6a/covert-platform-s1/browser/src/panels/terminal.ts), [telemetry limits](sandbox:/workspace/scratch/a9eeb25c9b6a/covert-platform-s1/browser/src/cockpit/SystemTelemetry.ts).
- [Source truth and lane limits](sandbox:/workspace/scratch/a9eeb25c9b6a/covert-platform-s1/docs/platform/S1/SOURCE_TRUTH.md), [dependency-ordered handoff](sandbox:/workspace/scratch/a9eeb25c9b6a/covert-platform-s1/docs/platform/S1/NEXT_SLICE.md).

**Stop record:** review artifact only. No frontend/backend modifications, runtime launches, installs, credential actions, external messages, pushes or merges. S2 stays paused; UI/runtime/packaging lanes remain separate. No design freeze or implementation authorization is inferred.

## 12. Original Covert Buddy chassis families

**Status:** design exploration, not production assets, implemented behavior or a final chassis selection. The companion sheet was inspected directly. Its useful principles are compact silhouettes, serviceable industrial bodies, expressive sensors, plausible joints and visible purpose. Its fantasy-world setting, branding, named machines and specific silhouettes are not Covert's identity.

### Recommendation

Take **Scout, Rook, Mutt and Tinker** forward as four families. These are provisional chassis labels, not four assistants or model roles. Explore all four visually, then implement one low-cost default through the shared Buddy foundation. I recommend **Scout first**, **Rook second**, and Mutt/Tinker once the same engine's state, avoidance and rendering behavior is proven.

Scout uses the least screen area. Rook has the strongest perched silhouette. Mutt adds a grounded animal option. Tinker best expresses the tiny-laptop/workshop idea, but has the greatest risk of expanding into a distracting character performance. Any chassis can carry any approved personality and voice.

### Shared Covert construction

Use blackened metal, graphite panels, restrained gray wear, replaceable rubber feet/wheels, recessed fasteners and a small phosphor-green optical slit. An asymmetric bracket around that slit ties the families to an original Covert Visor identity. Preserve each family's body outline rather than giving four bodies the same oversized head.

At desktop size, one optical feature, one main body mass and a few readable joints should survive. Fine hoses, scratches and rivets are concept-sheet detail; remove them from production sprites when they become visual noise. Avoid constant bloom, transparent/glass bodies, full-screen shadows, weapons, cloaks and heroic proportions.

The machines' mechanical purposes are fictional design rationale, not claims that their depicted lenses, microphones or tools are operating. A green optical slit does not mean recording. Capture and execution status remain explicit, factual host UI.

### Four families

| Family | Original silhouette and believable construction | Idle and movement vocabulary | Expressive features | Cost/risk and V1 decision |
|---|---|---|---|---|
| **Scout — rolling instrument** | A headless oblate sensor core between two narrow wheel bands on a transverse axle; an integrated offset visor and small parking shoe. Avoid the familiar sphere plus separate hemispherical head. | Park with wheel bands braced; small deliberate body tilt; shutter adjustment; short roll, controlled brake and turn in place. No endless bouncing or floating. | Visor angle and mechanical shutter convey attention; whole-body lean supplies expression with few poses. | Low relative animation cost. Best bounded V1 default because it is compact and simple to render. |
| **Rook — perching instrument** | Wedge sensor head, short tapered mechanical beak, folded angular protective/radiator plates, clamp-like feet and a short stabilizer tail. Broad machine forms rather than realistic feathers. | Fold wings, shift one foot, tilt head, settle onto a designated perch; one or two measured hops for relocation. Flight is unnecessary in V1. | Head angle, shutter and tail counterbalance produce a dry, observant visual temperament. | Low-to-medium cost. Excellent second family, but do not make every window edge a dynamic perch before safe placement is proven. |
| **Mutt — quadruped bench rover** | A low rectangular instrument body, four short articulated legs, broad rubber feet, an underslung blunt sensor wedge and short flat counterweight tail. Avoid a recognizable fox/dog head from the sheet. | Fold into a low sit, tuck legs to rest, brief head adjustment; slow alternating steps and a precise pivot. No pacing around active work. | Sensor tilt, body posture and restrained tail movement give a grounded mechanical temperament. | Medium cost: four-leg gait and width need more silhouette/avoidance work. V1 family after the foundation; no new behavior engine. |
| **Tinker — workshop biped** | A squat integrated visor/shoulder block, very short legs, broad stable boots, asymmetric service arms and a hinged service tray. No humanoid heroic torso or oversized face. | Sit, unfold a fictional laptop, inspect a fictional part, close the tray and stand; short weighted steps and a little bracing motion. | Shoulder tilt and unequal tool arms supply character; the laptop is a cosmetic prop. | Medium-to-high content cost. V1 static/basic clips are reasonable; rich prop routines and social performances should follow evidence of user value. |

### State-to-pose rule

Each pack implements the same semantic state labels, but with its own visual vocabulary:

| Fact/presentation state | Scout | Rook | Mutt | Tinker |
|---|---|---|---|---|
| IDLE, no capture or task claim | Parked with slight lean | Wings folded, feet settled | Low sit | Seated, tray closed or cosmetic laptop |
| ATTENTIVE | Visor turns once | Single head tilt | Head lifts | Torso straightens |
| LISTENING, actual capture confirmed | Static receptive pose | Head forward | Sensor forward | Pauses prop action |
| PROCESSING, actual route active | Shutter adjustment | Small still head adjustment | Braced posture | Hands withdrawn from prop |
| WORKING / DELEGATING, actual scoped task | Braced pose | Stable perch | Standing steady | Service posture |
| WAITING_FOR_OPERATOR | Remains still | Looks toward its own attention affordance | Sit and wait | Hands down, tray still |
| WARNING / DEGRADED / OFFLINE | Reduced, static pose | Wings remain folded | Resting, static pose | Seated, static pose |

These poses are supplemental. They do not distinguish all truths reliably without the text/status projection. Do not show a spinning sensor as proof of inference, laptop typing as proof of execution, or a celebratory pose as proof of verification. Multiple dimensions such as capture, task and warning can coexist; the common mapper handles priority while the host retains all relevant indicators.

### Placement and scale

Use a body approximately 56–80 CSS pixels high as an initial exploration range, with a restrained user scaling control and a larger accessible activation target where necessary. Mutt may be wider. These are proposed ranges, not measured acceptance values. Check actual assets at 48, 64 and 96 CSS pixels and Windows scaling at 100%, 125%, 150% and 200%.

Default home is a reserved small area adjoining the task strip. Optional perches come from explicit safe anchors. No avatar appears above a permission decision, modal, editor caret, terminal input/control, verification result or important error. If no safe anchor exists, hide the body and retain the ordinary Cipher status affordance. Pinned placement never outranks that exclusion.

Passive scenery is pointer-transparent. Only visible interactive affordances accept pointer input, with equivalent keyboard access. A hidden, minimized or reduced-motion avatar has no wandering loop; hidden rendering suspends explicitly.

### Architectural effect

Add a declarative chassis/animation-pack reference to the existing Buddy presentation preferences, independent from ResidentID, model binding, personality profile, voice route and grants. One shared fact mapper and placement scheduler drive all families. Loading or changing a body neither invokes a model nor changes context, permissions or task ownership.

Built-in packages may contain bounded raster assets and declared clips. No executable hooks, remote asset URLs or automatic tool access. Cache only the selected pack initially; do not decode all four packs merely to populate settings. Static previews suffice.

### Critical refinements

**KEEP:** compact worn utility-machine construction, expressive sensors, recognizably different silhouettes and an original black/green Covert family identity.

**REFINE:** visual personality means gesture and posture. It must not bind a friendly voice to Mutt or a sarcastic persona to Rook. Depicted mechanical purpose stays fictional unless a separately authorized platform capability is invoked.

**CHANGE:** reject unrestricted wandering and treating every visible window as a perch. User benefit: reliable focus and unobstructed work. Architectural effect: deterministic safe anchors/exclusions. Cost: medium placement testing; belongs in V1.

**ADD:** a shared chassis conformance check covering idle, actual capture, active work, waiting, warning, offline, reduced motion, hidden rendering and personality swaps. User benefit: every body communicates the same truths. Architectural effect: asset packs reuse semantics. Cost: low-to-medium QA; belongs in V1.

**DEFER:** flight physics, continuous locomotion, interactive toys, multi-companion scenes, heavyweight 3D, arbitrary custom asset imports and elaborate social routines. Their animation/content/validation cost does not advance the developer workstation enough for the first release.

### Visual exploration acceptance

Inspect each family as a filled silhouette before evaluating detail. Require recognition on the near-black desktop, readable eyes without glow, a quiet default pose, a useful static fallback and clear separation from the reference's specific machines. Put all four beside the same editor/terminal composition at actual proposed size. A compelling enlarged illustration is insufficient.

Advance Scout and Rook to small-size pose exploration first. Retain Mutt and Tinker as distinct alternatives, not rushed reskins. The generated sheet is a first visual probe and requires simplification before sprite production. No chassis is frozen or production-qualified by this review.
