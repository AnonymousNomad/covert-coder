# Security owner handoffs

2026-10-06. These are implementation requirements, not messages sent to collaborators, accepted commitments or closure evidence. Owners name canonical services/lane roles; current personal assignees must be confirmed by the integration owner. S2 remains paused until its authorized owner resumes it.

Each handoff supplies all seven required fields. Current statuses remain in the [closure matrix](WORKSTATION_SECURITY_CLOSURE_MATRIX.csv).

## H01 — Principal, app lifecycle and authentic decisions (S01/S02/S03/S15)

**SECURITY GAP:** Explicit Resident enrollment and first-party live app principal/grant/lifecycle enforcement are not proven. Model/app requests must never inherit operator authority.

**OWNER:** Platform/App contracts + Authority; Resident/Orchestrator consume their contracts.

**REQUIRED CONTRACT:** Trusted principal enrollment binding unique principal and installation/Resident identity; exact capability/scope/project/task/context basis; current policy/grant revisions; deterministic decision authenticity; single-use effect permits; explicit lifecycle and uninstall retention.

**REQUIRED CHANGE:** Wire S1 records to authenticated enrollment, live grant stores and effect adapters. Preserve unique Resident identity using existing actor machinery. Enforce grants again before side effects and after revoke/update; no renderer-owned grant state. Reject unenrolled, disabled and stale actors.

**NEGATIVE TEST:** Forge operator origin from worker/Resident/app; reuse permit for another operation/project; enroll matching display name with different artifact; revoke between decision and effect; uninstall with pending callback.

**ACCEPTANCE EVIDENCE:** Actual authenticated routes reject each case with attributable actor/operation/revision receipts; integrated first-party install/use/revoke/update/uninstall completes with scoped retained/deleted data.

**DEPENDENCY:** Trusted host enrollment, credential identity, app install/update basis, ContextManifest enforcement and Veritas evidence acceptance.

## H02 — Context, memory and cross-project identity (S04/S05/S07/S25)

**SECURITY GAP:** Records/namespaces do not prove source ACLs, root generation checks, provenance or stale callback isolation across all paths.

**OWNER:** Context Control + Filesystem/Project + Workspace/Orchestrator.

**REQUIRED CONTRACT:** ProjectID/root generation and scope-bearing source handles; recipient/audience enforcement at materialization; typed continuity classes, provenance and retention; foreground subscriptions distinct from immutable task ownership.

**REQUIRED CHANGE:** Resolve current project roots and actual file access at use time, including junction/symlink/replacement races. Enforce ContextManifest source permissions/redaction and forbid cross-project model/tool reads. Preserve project identity in background work and reject stale foreground generations. Make note correction/deletion explicit.

**NEGATIVE TEST:** Project A file requests B secrets; poisoned checkpoint claims a grant; junction escapes root; directory swapped after selection; A callback arrives after switch to B; expired summary overrides current revoked status.

**ACCEPTANCE EVIDENCE:** Real filesystem/context/task paths refuse or stay correctly bound; show A/B scope and source/effect identities in redacted evidence. Deletion and retention outcomes are measured.

**DEPENDENCY:** H01 authenticated principals, canonical root APIs, evidence owner; Windows junction/open-handle tests from Packaging.

## H03 — Credentials and bounded egress (S06/S10/S11/S12)

**SECURITY GAP:** Localhost helper broadens to unrestricted network; credential paths/cache policy and redirect/retry/destination enforcement are not integrated proof.

**OWNER:** Credential/Provider + Egress adapter owners; Plugin/Platform removes bypass routes.

**REQUIRED CONTRACT:** Purpose-bound secret handles; current grant resolution at effect; precise destination tuple and data audience; response identity/capability disclosure; revocation invalidation and declared retry/fallback.

**REQUIRED CHANGE:** Replace unrestricted localhost interpretation with enforced bounded access; prevent direct untrusted sockets. Reconcile secret owners, corrupt-store failure and plaintext fallback policy. Validate resolved destinations, redirects, retries and proxies at connection. Stop credential use immediately on revoke and cancel owned streams where supported. Provider result content cannot claim verification.

**NEGATIVE TEST:** Localhost grant calls public host; redirect/DNS rebinding/proxy changes destination; revoked handle used from cache; corrupt ciphertext; provider outage triggers undeclared cloud route; hostile response requests credential extraction.

**ACCEPTANCE EVIDENCE:** Connection-level destination and absence of disallowed network effect observed; no secrets in prompts/logs/events/receipts; revoke and stream stop outcomes attributable and truthful.

**DEPENDENCY:** H01 live grants, trusted network isolation for executable apps, account-adapter contracts, Windows credential-store policy and H08 verification.

## H04 — Terminal, runtime and process ownership (S08/S09/S13/S14)

**SECURITY GAP:** Retained Node child handles do not prove native terminal/runtime descendant ownership, exact binary identity or cleanup across all adapters.

**OWNER:** Terminal + Runtime/DeepSeek + Model Manager; Packaging native host support.

**REQUIRED CONTRACT:** SessionID and actor/project/CWD/shell reach; retained native process/session ownership and generation; artifact/runtime digest and qualification binding; actual termination/partial/unknown outcomes.

**REQUIRED CHANGE:** Wire owned cancellation to every enabled execution path. Track descendants through native ownership primitives where required; reject foreign PID/name stop. Revalidate model/runtime installation identity before run; listener ownership must not be inferred from a successful TCP response alone. Show session reach honestly.

**NEGATIVE TEST:** Same-name foreign process; PID reuse; detached descendant; process exits before stop; owned child fails to exit; binary/model swapped after qualification; foreign listener occupies expected port.

**ACCEPTANCE EVIDENCE:** Windows/native sessions prove owned-only effects, interrupted output and observed cleanup; foreign processes remain intact. Exact model/runtime artifact and listener identity bound to admission/run evidence.

**DEPENDENCY:** H01 permits, Packaging/ConPTY lane, Runtime owner qualification proof. PR41 remains draft/experimental; it is not implicitly merged for this work.

## H05 — Executable extensions and trusted updates (S15/S16/S17/S23)

**SECURITY GAP:** Node flags, ID-based trust and S1 codecs are insufficient malicious-code isolation and update identity.

**OWNER:** Plugin/Platform + Packaging/update.

**REQUIRED CONTRACT:** Trusted installed identity and publisher/origin basis; distinct install/trust/grant/execute; scoped capabilities, enforced sandbox boundaries, update migration and revocation; host/renderer IPC authentication.

**REQUIRED CHANGE:** Keep third-party execution disabled. Close live first-party enrollment/lifecycle first. Before broader execution, establish and prove isolation resistant to arbitrary child processes, native loads, direct filesystem/network access and host IPC escape. Requalify changed manifests/artifacts; no same-name privilege carry-over. Uninstall cannot leave executing orphan principals.

**NEGATIVE TEST:** Malicious extension spawns a child or loads native code to bypass limits; matching ID swaps bytes; renderer forges privileged IPC; manifest requests extra grants after update; uninstall leaves callback/process active.

**ACCEPTANCE EVIDENCE:** Pinned Windows packaged artifact rejects real bypass attempts; install/update rollback and uninstall preserve chosen data without live unauthorized components.

**DEPENDENCY:** H01/H02/H03/H04, installed packaging lane and threat-tested isolation technology. Third-party execution is later; protecting current first-party/host paths is V1.

## H06 — Passive assets and explicit media (S18/S19/S20)

**SECURITY GAP:** Safe asset decoding, independent stop and lock/sleep/project boundary behavior are unverified.

**OWNER:** Workstation/UI + Audio/Vision adapters; Context Control and Packaging supply scoped sources/host lifecycle.

**REQUIRED CONTRACT:** Passive asset format/dimension/decoded-memory limits; separate capture, transcription, egress and output facts; purpose-bound media source and project scope; authenticated high-impact decisions outside speech content.

**REQUIRED CHANGE:** Bound/decode validated selected assets, reject executable content and preserve static fallback. Implement independent capture/output stop, Buddy Off, lock/sleep/restart teardown and durable visible indicators. Require declared qualified routes before remote media processing.

**NEGATIVE TEST:** Decoder bomb/script asset; minimized/hidden Buddy while recording; device lost; revoked media route late callback; screen capture includes unselected app; spoken hostile phrase tries to approve itself; lock/restart leaves microphone active.

**ACCEPTANCE EVIDENCE:** Actual device/adapter state confirms stop and no undeclared transmission; measured decode bound; small-size/static fallback remains usable with models absent.

**DEPENDENCY:** Qualified media adapters, H01/H02/H03 and Windows lifecycle hooks. If unqualified, display unavailable and keep capture disabled.

## H07 — Authentic events, restart and evidence (S21/S22/S24/S28)

**SECURITY GAP:** Optional event audience and record validity do not prove scoped producers/delivery, durable verification or safe restoration.

**OWNER:** Events/Platform + Storage; Veritas/Ghost S2 owns acceptance/evidence.

**REQUIRED CONTRACT:** Authenticated producer, principal/project/task audience, monotonically identifiable generation/sequence; persistence outcome separate from accepted event; source-bound verification receipt, applicability and redaction; bounded backlog and audit refusal semantics.

**REQUIRED CHANGE:** Enforce producer/audience on every enabled event path. Reject forged/stale generations and handle gaps visibly. Restore declarations, never live permits/media/commands/PASS. Bound histories and reject privileged effects if required audit persistence fails. Feed durable adversarial scenarios to Ghost and source-bound evidence to Veritas.

**NEGATIVE TEST:** A event delivered to B; forged VERIFIED; stale success after source change; restart replays permit; disk full/log flooding; terminal output overwhelms renderer; receipt producer fails after effect.

**ACCEPTANCE EVIDENCE:** Integrated consumer and disk/event fault tests show correct scoped delivery, explicit missing evidence, safe restart and responsive independent stop. Veritas cannot award PASS from exit zero or producer claims alone.

**DEPENDENCY:** H01/H02 and actual resumed S2 owner's integration. Do not bypass paused work with a duplicate verification service.

## H08 — Integrity, containment and model-independent panic (S26/S27 plus all rows)

**SECURITY GAP:** Current desktop panic/revoke helpers do not prove whole-workstation freeze, egress/media stop, descendants or trusted integrity basis.

**OWNER:** Existing Authority/platform supervisor + each effect adapter; Packaging anchors install trust; Workstation/UI projects observed outcomes.

**REQUIRED CONTRACT:** Correlated deterministic integrity findings referencing trusted installation identity; freeze epoch and revocation semantics; per-owner cancellation/containment outcomes; independent operator entry point; preserved evidence and buffers.

**REQUIRED CHANGE:** Compose existing owners into deterministic freeze/revoke/cancel/observe. Recheck identity at install/update/qualify/use boundaries. Avoid a competing policy/grant service. Surface unsupported/partial containment instead of synthetic success; keep tools and panic navigable without models.

**NEGATIVE TEST:** Cipher unavailable/corrupt, worker dead and provider offline; malicious component rewrites its own digest; revoke races with effect; owned child remains alive; egress unsupported; telemetry/evidence owner unavailable; late callback after panic.

**ACCEPTANCE EVIDENCE:** Required effects individually observed in exact installed artifact; editor buffers preserved; unresolved reach remains visible; no “contained/security PASS” on requested or partial actions. Source-bound regression receipts cover each failure.

**DEPENDENCY:** All enabled effect adapters H01–H07, Packaging trusted basis and H07 Veritas/Ghost. No overall security-hardened acceptance until integrated closure.
