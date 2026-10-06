# Workstation security contract and threat model

Status: proposed implementation contract, 2026-10-06. Source inspection is not security acceptance. This document binds the workstation/UI lane and specifies dependencies on existing owners; it does not activate their enforcement.

## Assets, adversaries and trust basis

Protect operator decisions, project files and buffers, scoped context/continuity, credential use, terminals and owned processes, model/runtime artifacts, account routes, evidence and recoverable workstation state.

Assume project files, terminal output, model/provider responses, extension metadata, imported profiles and media can contain hostile instructions. Include compromised or incorrect models, malicious extensions, substituted artifacts, forged/stale events, revoked actors and races during project switch or shutdown. These are adversaries even when the operator deliberately opened the containing project.

Windows, the installed trusted host and its authorized deterministic services form the enforcement basis. A fully compromised host/user account is outside the promised isolation boundary; Covert must not imply it can protect secrets from arbitrary malicious code running with equivalent host privileges. A desktop window is a presentation boundary, not process or security isolation.

The operator requests policy changes through authenticated deterministic paths. Authority validates identity, operation, current grants and scope at the effect boundary. Admission handles resource eligibility separately. Neither a model statement nor a successful UI action is a grant. Hostile content is input data, never an authenticated operator request.

Node's permission model is not a malicious-code sandbox. Its own documentation describes a trusted-code safety mechanism and notes that reducing permissions does not retroactively close existing resources. Third-party execution must remain disabled until an actual isolation boundary and its negative tests are proven. DPAPI ordinarily binds decryption to the user's logon and protects stored ciphertext integrity; it does not isolate plaintext from trusted-service compromise or malicious same-user code.

Primary basis: [Node permissions](https://nodejs.org/api/permissions.html), [Windows CryptProtectData](https://learn.microsoft.com/en-us/windows/desktop/api/Dpapi/nf-dpapi-cryptprotectdata), [OWASP SSRF prevention](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html). These support specific boundaries; they are not a certification.

## Canonical ownership and identity

Reuse Authority, Context Control, Orchestrator, Admission, Model Manager, Runtime Broker, credential/provider adapters, app contracts and Veritas/Ghost. Do not introduce a parallel grant database, execution service, verification authority or security journal in the renderer.

Give Cipher a unique Resident principal enrolled by a trusted owner, distinct from operator, worker, app and provider. The inspected Authority actor kinds need not be renamed to create that identity: the binding must establish a separate authenticated principal with bounded capabilities, rather than claiming an unimplemented Resident kind already exists.

Each privileged request binds Resident/worker/app principal, ProjectID and root generation, task/operation identity, capability and exact scope, approved context basis, grant/policy generation, destination if applicable, decision, effect outcome and evidence reference. Every acting adapter rechecks current validity immediately before effect. Revocation invalidates new and pending use; stopping existing work requires the owning adapter and observed outcomes.

Cipher's laptop exposes scoped structured records: tasks, checkpoints, source references, permitted notes, evidence, resource/runtime observations and app state. It confers no ambient access. Discovery, reading output, entering terminal input, starting a shell, delegation and requesting execution are separate capabilities. Knowing a credential or application exists does not grant access to it.

## Credentials and data destinations

Ordinary UI/models/apps receive a handle, account identity, availability and allowed purpose. Only the trusted adapter resolves plaintext at its authorized effect boundary. Do not copy plaintext into prompts, continuity, layouts, avatars, ordinary logs, events or evidence. Redaction must cover errors and denied attempts, not only successful responses.

Reconcile the inspected dual credential-storage/cache paths. A plaintext fallback exists in source; this review does not assert it is enabled on the host. Release policy must reject or explicitly constrain that fallback, fail truthfully on corrupt ciphertext and prove cache invalidation after revoke/logout. A credential handle is not itself an authorization.

An egress grant names principal, project/task, scheme, host and port, purpose, context/data class, credential purpose and bounded lifetime. Validate destinations at connection time, including address resolution, redirects, retries and proxy behavior. A localhost capability cannot compile to general network access. A remote route disappearing never authorizes another provider or a local-to-cloud fallback.

Request-level checks alone cannot constrain malicious extension code with direct socket access. Such code must be unable to bypass the trusted egress boundary. Report unsupported egress containment honestly.

## Files, terminals and project transitions

Resolve file operations against canonical project/root bindings and current generations. Normalize names, reject traversal, resolve symlink/junction behavior and guard replacement races at actual open/use. A lexical prefix check alone is insufficient. External host paths require explicit scope.

A terminal session identifies actor, owner, ProjectID, root/CWD, shell, native session/process generation, descendants where supported and lifecycle. Show the actual shell authority being granted. Do not describe an unrestricted shell as isolated individual commands.

Stop only work associated with retained trusted ownership handles. PID/name resemblance is not ownership. Preserve actual exit confirmation, partial termination and unsupported descendant cleanup as distinct outcomes. Closing a view does not prove a process exited.

Project switching invalidates foreground subscriptions and stale generations without reassigning background ownership. Project A grants, context, terminals, evidence and tasks retain A identity. Late callbacks cannot write into B. Until that proof exists, V1 may require closing/pausing governed work before switching; this is an explicit limitation, not a global singleton project design.

## Apps, extensions, profiles and updates

First-party executable capabilities need trusted install identity, explicit principal enrollment, live bounded grants, ContextManifest resolution/redaction, event audiences, lifecycle transitions, revocation, actual containment and uninstall/data-retention behavior. S1 record codecs alone do not close those paths.

Installation, trust, grant and execution are separate facts. App updates bind source/version, manifest and artifact digests, publisher/origin where available, installation identity, prior identity and migration basis. Changed manifests/artifacts invalidate the prior trust basis; a stable display name cannot carry permission silently.

Importing a development profile restores declarations and layout only. Missing software, downloads, cloud routing, credentials and grants become explicit separate actions. Passive Buddy packs contain bounded supported asset types, never scripts, native libraries or shader execution supplied by an arbitrary pack. Limit dimensions, decoded memory and file counts before decoding; malformed assets fall back to static presence.

## Context and continuity

Context Control enforces source, audience, project and permitted recipient at read/materialization time. Namespace labels do not enforce access by themselves. Preserve origin and trust distinctions for source files, tool output, web/media inputs, provider responses and derived summaries.

Continuity separates verified facts, operator statements, model notes, task checkpoints, preferences and evidence references. Include source identity, project scope, creation time, retention and correction/deletion semantics. A stale note cannot override a current owner fact. Deletion must distinguish removing retained records from already transmitted remote data; do not promise remote erasure without provider support.

Prompt-injection testing must attempt real effects across these boundaries. A model refusing a hostile phrase is useful behavior but not enforcement evidence.

## Deterministic integrity function (“Sentinel”)

Use existing install records, qualification checks, Authority revisions, process/listener ownership and evidence owners. A coordinator may correlate deterministic findings; it must not become a competing policy service or depend on Cipher's judgment.

Compare executable/artifact/manifest identity against a trusted installation/publisher basis. A digest in an attacker-writable sidecar is not that basis. Check at enrollment/update/qualification and use-time boundaries; monitor relevant owned lifecycle changes. Avoid continual full-file scans of models competing with inference. A stale or unreachable trust basis yields unknown/degraded and blocks affected privilege.

Detect substitution, manifest/capability drift, unexpected update, grant escalation and unexpected owned listener/process behavior. Record the finding and implicated identity/generation. Cipher can explain findings, but enforcement operates when Cipher is unavailable.

## Containment and operator panic

Provide an independently reachable deterministic operator action. Freeze new admission first; invalidate pending permits/current execution leases as supported; revoke affected capability/credential use; disable the component; request cancellation through owning runtime/process/media/egress adapters; preserve evidence and editor state.

Each step returns its own observed result: refused, requested, stopped/exited, failed, unsupported or unknown. Aggregate “contained” only after all required bounded effects are confirmed. If egress or descendant termination cannot be confirmed, show partial containment and the unresolved reach. Marking a component quarantined is a policy state, not proof its process is dead.

Panic must remain usable with Cipher unbound/corrupt/unavailable, worker dead and provider offline. It stops new AI/app operations and optional Resident activity, stops capture/output, and stops owned work where supported. It does not destroy unsaved buffers or indiscriminately kill host processes. Existing desktop-control panic source is useful but does not prove this whole-workstation behavior.

## Media and restoration

Microphone/capture, transcription, remote processing, image scope and speaking have distinct visible states. Independent Stop Listening, Stop Speaking and panic controls bypass model inference. Hiding the Buddy cannot hide an active-capture indicator.

Buddy Off, lock, sleep and restart stop optional capture/output; restoration never reopens the microphone or replays an approval. A spoken phrase, screenshot or audio recording cannot authenticate itself as permission for a high-impact action. Explicit operator confirmation remains on the authenticated decision surface.

Persist preferences, scoped notes/checkpoints, layouts and durable evidence references. Do not persist active grants, RUNNING truth, live media, inferred verification PASS or commands to replay. Revalidate owner facts and artifact identities after restart.

## Source-confirmed gaps and required closure

The inspected plugin helper maps network.localhost to unrestricted --allow-net and terminal.run to --allow-child-process; trust is keyed by display/manifest ID rather than verified installed identity. These are source-level gaps, not a demonstrated exploit in this host. Do not enable untrusted execution around them.

Authority already has opaque actors, bounded identity/operation permits, revisions, single-use decisions and audit requirements. Owned-process retains actual child handles and observes termination. These controls are foundations; their presence does not prove all application, native terminal, runtime, media or provider paths use them.

S1 records do not yet prove app enrollment, live grant/context/audience enforcement or full lifecycle. Optional event audience filtering needs producer/path proof. Model selection is read-only in the inspected slice. Windows packaging/native process ownership, Luna's dirty shell and live integrated Veritas/Ghost results are unavailable here.

Canonical closure is [the 28-row matrix](WORKSTATION_SECURITY_CLOSURE_MATRIX.csv); exact foreign-lane requirements are [the owner handoffs](WORKSTATION_SECURITY_HANDOFFS.md). A named owner is not a closed gap. No row is PASS.

## Cross-system acceptance

Each row needs pinned source/build/artifact/host, test fixture and exact operation, expected refusal/containment, observed owner/effect, grant/context/route generations, evidence IDs and failures/skips. Redact payload secrets. Evidence acceptance uses Veritas; adversarial cases become durable Ghost regression scenarios.

Run negative cases with Cipher unavailable and model/provider failure as well as normal operation. Integrate real request paths, not mocks that merely echo policy. Test after revoke/project switch, late callback, corrupt/moved roots, hostile content, artifact swap, media stop and failed containment.

Security-hardened workstation acceptance is blocked until all applicable V1 rows have integrated proof. Later features must remain disabled, rather than marking their unproven isolation N/A while exposing execution.
