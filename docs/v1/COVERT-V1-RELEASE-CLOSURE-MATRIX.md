# COVERT V1 RELEASE CLOSURE MATRIX

Snapshot: 2026-09-25 · Branch: `audit/v1-release-closure-matrix` · Starting SHA: `e23aec80cd05ab0c237eba793421bb5e7c5a57e7`

This file is a rendering of the canonical machine matrix `docs/v1/COVERT-V1-RELEASE-CLOSURE-MATRIX.json` (schema `covert.v1-release-closure-matrix.v2`). The JSON is authoritative; this rendering is generated from it.

> **Lane recovery.** This audit continues Luna #2's truncated artifact. Her file was recovered byte-exact at `docs/v1/recovery/COVERT-V1-RELEASE-CLOSURE-MATRIX.luna-partial.json` (sha256 `ec38d064b6490f7665b7a76d35685cd796fc926bb7c9af85cb8d4377b8a2642e`, 3231 bytes, invalid JSON cut mid-entry). Her lane snapshot and known release decisions were carried forward; the dogfood head was corrected (see JSON `known_release_decisions`).

> **Evidence policy.** Rows map existing source and committed evidence at the starting SHA. Tests were not re-executed in this audit lane; in-repo tests are cited as evidence locations, not current-SHA green proof. Dirty/untracked artifacts are not accepted evidence.

> **Scope.** This freezes the closure board only. It is not product release acceptance. The certified scope remains the source core (`docs/release/SOURCE-CERTIFICATION-RECORD.md`, candidate `dc0d30ee`).

## Status vocabulary

`CLOSED` · `QUALIFIED` · `IMPLEMENTED + VERIFIED` · `IMPLEMENTED + UNVERIFIED` · `PARTIAL` · `BLOCKED` · `MISSING — V1 REQUIRED` · `MISSING — V1.1` · `OWNER HANDOFF` · `INTENTIONALLY UNSUPPORTED` · `NOT APPLICABLE`

## Counts

| Metric | Value |
| --- | --- |
| Total rows | 176 |
| Closed / Qualified | 20 (7 closed + 13 qualified) |
| Implemented + Verified | 30 |
| Implemented + Unverified | 7 |
| Partial | 79 |
| Blocked | 2 |
| Missing — V1 Required | 8 |
| Missing — V1.1 | 19 |
| Owner handoff | 8 |
| Intentionally unsupported | 1 |
| Not applicable | 2 |
| P0 priority | 6 |
| Release blockers (flag incl. scope/distribution) | 10 |
| P1 | 62 |
| P2 | 82 |
| Observations | 5 |
| Verification-only closures | 7 (C3-07, C6-06, C6-07, C6-08, C7-07, C7-08, C7-21) |
| Implementation-required (status-based, upper bound) | 103 |
| External lane dependencies | 14 |
| Active lane dependencies | 11 |
| Parked lane dependencies | 3 |

## P0 release blockers

| ID | Requirement | Status | Owner | Gap |
| --- | --- | --- | --- | --- |
| C1-02 | Every documented typed route is reachable through the product edge (facade route map in sync with OpenAPI) | PARTIAL | CORE | 27 documented routes fall to legacy 404: /api/egress/manifest, /api/mission/receipt, /api/provenance/{run,runs}, /api/readiness, /api/resource/admission, /api/system-map/snapshot, /api/training/{checkpoints,datasets,datasets/append,datasets/delete,datasets/read,export,export-eval,exports,presets}, … |
| C2-02 | Atomic durable writes for canonical session and chat state | PARTIAL | PLATFORM-STATE | Crash mid-write can truncate the canonical session file and chat-history file; chat has no backup and is silently reset on parse failure. Data-integrity defect on shared Desktop/TUI/CLI truth. |
| C4-01 | Workspace Trust: three-state model (UNTRUSTED/RESTRICTED/TRUSTED) with canonical enforcement | MISSING — V1 REQUIRED | SECURITY | Untrusted workspace content (task manifests, configs, plugin manifests) reaches approval cards/execution with no trust gate; no canonical owner enforces a trust state. |
| C4-02 | Local-Only preference universally enforced across all egress surfaces | PARTIAL | SECURITY | local-only pins role routing only; non-chat egress paths bypass the preference. Claim 'Local by default PROVEN' is scoped to one path and outruns universal enforcement. |
| C4-04 | GET /api/modelhub/files must not egress with a stored token without approval/consent | MISSING — V1 REQUIRED | SECURITY | A paired local request causes authenticated external transmission to huggingface.co with no operator decision and no consent, under an auto-permitted .read kind. |
| C5-15 | User cancellation of a running agent mission | MISSING — V1 REQUIRED | RELIABILITY | A running mission cannot be stopped from the cockpit; with C5-11/C5-12 a hung provider call cannot be aborted at all. |
| C6-03 | TUI surface exists (Desktop + TUI + CLI over shared truth) | MISSING — V1 REQUIRED | DISTRIBUTION | No TUI client exists. Scope dependency: V1 scope owner must confirm TUI is V1 or move it to V1.1; if V1 it is a release blocker. |
| C6-09 | glib advisory GHSA-wrw7-89jp-8q8g resolved or explicitly mitigated for the desktop path | BLOCKED | DISTRIBUTION | Affected Linux desktop build path; reachability of VariantStrIter not established; resolution needs an upstream-compatible graph at glib >=0.20.0 (Tauri/GTK4 migration) and a clean build/install test. Not a source-core blocker; accepted as a desktop-installer blocker. |
| C6-10 | Installer/application code signing | MISSING — V1 REQUIRED | DISTRIBUTION | No code signing, manifest signing, or notarization; required if a packaged installer ships in V1 (the source release is exempt by scope). |
| C7-30 | V1 long-horizon regression contract defined and executable | MISSING — V1 REQUIRED | RELEASE | No long mission / many tool calls / project switch / model switch / interruption-resume / stale-information contract exists. Invariants required: no project bleed, no lost obligations, no stale capability/model identity, no false completion, no lost verification state. Required clauses defined in d… |

## C1 core contract & wiring

| ID | Requirement | Status | Pri | Owner | Gap / evidence anchor |
| --- | --- | --- | --- | --- | --- |
| C1-01 | Production start topology: launcher starts typed server + legacy daemon behind facade on 4777 | CLOSED |  | CORE | evidence: tests/integration/test-canonical-launch.mjs:86-171; tests/integration/test-npm-start-shutdown.mjs; tests/smoke.mjs:38-51 |
| C1-02 | Every documented typed route is reachable through the product edge (facade route map in sync with OpenAPI) | PARTIAL | P0 | CORE | 27 documented routes fall to legacy 404: /api/egress/manifest, /api/mission/receipt, /api/provenance/{run,runs}, /api/readiness, /api/resource/admission, /api/system-map/snapshot, /api/training/{checkpoints,datasets,datasets/append,datasets/delete,datasets/read,export,export-eval,exports,presets}, /api/workbench/worktree/{create,discard,list,merge}, /api/worker-handoff/{accept… |
| C1-03 | Frontend/backend contract: zod validation both directions, shared fixtures, fixed envelope | CLOSED |  | CORE | evidence: tests/arch/contracts.test.ts:8-59; tests/arch/api-client.test.ts; tests/arch/browser-facade.test.ts |
| C1-04 | Malformed JSON request bodies classified as 400, not 500 | PARTIAL | P2 | CORE | Invalid JSON raises unclassified error -> HTTP 500 INTERNAL. |
| C1-05 | OpenAPI document equals the production route set | PARTIAL | P1 | CORE | 4 terminal-session routes undocumented and drift-invisible; no facade-vs-openapi coverage assertion. |
| C1-06 | Route families defined in source are either registered or removed | PARTIAL | P1 | CORE | /api/agent/subagent* cannot exist at runtime; PR-A contract only. |
| C1-07 | Authority: digest-bound single-use approval on every mutating/external operation (fail-closed) | IMPLEMENTED + VERIFIED | P1 | SECURITY | 20 routes remain under the Phase-2A migration waiver (DAP/LSP mutations, training start/stop/delete); PHASE2A_ACCEPTANCE_REQUESTED=false at route-authority-coverage.test.ts:26-53. Fail-closed but coverage not fully closed. |
| C1-08 | Resource admission service reachable and consumes one decision path | PARTIAL | P1 | CORE | /api/resource/admission unmapped in facade (C1-02) -> production 404; enforcement gap tracked C5-19. |
| C1-09 | RuntimeAdapter abstraction decision (vs ModelRuntime as canonical) | OWNER HANDOFF | P1 | RUNTIME-LANE | No adapter abstraction exists. Decision outstanding: V1 requires it, or ModelRuntime is accepted canonical runtime owner. |
| C1-10 | Model Manager integration: one canonical manager over models/manifest.json | PARTIAL | P1 | MODEL-MANAGER-LANE | Two managers (typed ModelRuntime + legacy ModelManager) over the same manifest; lane head d80d184 outside this SHA; broad architecture acceptance pending. |
| C1-11 | Harness is wired into the production agent loop | PARTIAL | P1 | HARNESS-CONTEXT | harness contract/orchestrator is not the production loop; production loop has no passing verifier by design so `verified` is unreachable. |
| C1-12 | Veritas can be satisfied from in-product evidence | PARTIAL | P1 | HARNESS-CONTEXT | Every agent-loop verification persists passed:false (unavailable\|incomplete) at agent-loop.mjs:651-677; no V1 component writes a passing .verification.json, so RELEASE_EVIDENCE can never pass from product output. |
| C1-13 | Provenance ledger + mission receipt truthful, complete, reachable | PARTIAL | P1 | CORE | /api/provenance* and /api/mission/receipt unmapped in facade (C1-02); run records carry worker descriptor but no model id/hash. |
| C1-14 | Request identity and attempt identity across transports | PARTIAL | P2 | CORE | No transport request id (task id defaults to http:<actor>), no attempt_id anywhere; semantics decision required. |
| C1-15 | Fixed error envelope and taxonomy across typed and legacy paths | IMPLEMENTED + VERIFIED |  | CORE | Malformed-body 500 tracked C1-04. |
| C1-16 | Stream/non-stream chat parity (same canonical composer and routing) | IMPLEMENTED + VERIFIED | P2 | CORE | Stream contract lacks temperature/n so Best-of-N exists only non-stream (chat.ts:155-191); stream always forces harness:true (chat.ts:130). |
| C1-17 | Local-by-default execution routing with explicit opt-in for external/cloud | IMPLEMENTED + VERIFIED | P2 | SECURITY | Egress bypass paths tracked C4-02 and C4-04. |
| C1-18 | Agent loop consumes typed services (no island routes upstream/downstream) | PARTIAL | P1 | CORE | Core loop wired, but island families have no product-edge exposure (provenance/receipt, admission, readiness, egress manifest, system-map, workbench worktree, worker-handoff management) per C1-02; subagent dispatch dead per C1-06. |

## C2 state/concurrency/recovery

| ID | Requirement | Status | Pri | Owner | Gap / evidence anchor |
| --- | --- | --- | --- | --- | --- |
| C2-01 | Documented canonical state owner and single-writer discipline per persisted artifact | PARTIAL | P1 | PLATFORM-STATE | No single state owner exists (per-file modules only); 8 files (session, community, replays, plugins, learner, academy-progress, logs, metrics) can be written by two processes sharing .aide with no arbitration. |
| C2-02 | Atomic durable writes for canonical session and chat state | PARTIAL | P0 | PLATFORM-STATE | Crash mid-write can truncate the canonical session file and chat-history file; chat has no backup and is silently reset on parse failure. Data-integrity defect on shared Desktop/TUI/CLI truth. |
| C2-03 | Schema validation and versioning on read for every persisted store | PARTIAL | P1 | PLATFORM-STATE | Validation is per-store; continuation files are trusted for policy decisions with bare JSON.parse; most newer stores have no schema_version. |
| C2-04 | Schema migration and downgrade policy (older/newer app reading state) | PARTIAL | P1 | PLATFORM-STATE | No migration for other stores; no forward-compatible read; most stores silently reset on version mismatch; downgrade policy undocumented/untested. |
| C2-05 | Uniform corruption handling with backup/recovery (no silent destructive reset) | PARTIAL | P1 | PLATFORM-STATE | No uniform policy or restore command; corrupt community/plugins/replays/chat data destroyed on next write with no .bak. |
| C2-06 | Cross-process locking/leases and read-modify-write conflict control | MISSING — V1.1 | P1 | PLATFORM-STATE | Two OS processes can interleave read-modify-write on shared files with lost updates; session/chat have no CAS/etag (last-writer-wins). P0 if multi-instance on one workspace is a supported V1 scenario. |
| C2-07 | Stale-state detection for engines/health/workflow bookkeeping | IMPLEMENTED + VERIFIED |  | PLATFORM-STATE | Staleness is domain-specific; no general persisted-state epoch check. |
| C2-08 | Client to daemon version handshake | MISSING — V1.1 | P2 | PLATFORM-STATE | Mixed-version clients can talk to a daemon with no negotiation or refusal; state compatibility left to per-store literals. |
| C2-09 | Crash mid-operation consistency (process/daemon crash) | PARTIAL | P1 | PLATFORM-STATE | No crash-mid-write recovery test/journal for non-atomic stores; daemon crash does not resume in-flight agent sessions (C2-11). |
| C2-10 | Client crash hot-exit recovery | PARTIAL | P2 | PLATFORM-STATE | Client crash between debounce and flush loses up to 500ms of edits; no kill-restart acceptance test for the canonical cockpit. |
| C2-11 | In-flight agent mission/transcript durability across backend crash | MISSING — V1.1 | P1 | PLATFORM-STATE | Crash mid-mission loses live transcript and pending approvals; GET /api/agent/sessions empty after restart; no resume path. |
| C2-12 | Power-loss durability guarantees | MISSING — V1.1 | P1 | PLATFORM-STATE | Durability under power loss unverifiable; record as explicit limit until tested. |
| C2-13 | Disk-full (ENOSPC) handling for state writes | PARTIAL | P2 | PLATFORM-STATE | No capacity precheck or rollback for .aide writes; non-atomic writers can leave partial files. |
| C2-14 | External file modification conflict detection for state files | PARTIAL | P1 | PLATFORM-STATE | No watcher/mtime/epoch check; external edits to cached stores silently overwritten or ignored. |
| C2-15 | Git lock and concurrent git mutation handling | PARTIAL | P2 | CORE | No stale-lock detection/removal; no workspace-level git mutex; concurrent approved git ops can collide. |
| C2-16 | Sleep/suspend/resume behavior | MISSING — V1.1 | P2 | PLATFORM-STATE | Wall-clock TTLs and health probes assume continuous run; after sleep, timers fire late and probes may misreport. |
| C2-17 | Egress journal durability (audit of record for sovereignty) | PARTIAL | P1 | SECURITY | The journal evidencing no-data-leaves-the-machine is neither fsynced nor failure-surfaced; large-line cross-process append atomicity untested. |
| C2-18 | Shared-truth boundary is explicit (workspace root) | PARTIAL | P2 | PLATFORM-STATE | Shared truth is per-workspace-root; clients with different AIDE_WORKSPACE share nothing. Boundary must be documented for the Desktop/TUI/CLI model. |
| C2-19 | State backup/restore/rebuild tooling for .aide | PARTIAL | P2 | PLATFORM-STATE | No documented operator restore for .aide as a whole; doctor cannot repair corrupt stores. |

## C3 context/capability/skills/handoffs

| ID | Requirement | Status | Pri | Owner | Gap / evidence anchor |
| --- | --- | --- | --- | --- | --- |
| C3-01 | Chat context control composer (bounded, data-not-instructions, telemetry) | IMPLEMENTED + VERIFIED | P2 | HARNESS-CONTEXT | Harness/skills/memory injection is skipped when served context is unknown or <1024 (chat-context.ts:117-119); telemetry records it but capability is conditional. |
| C3-02 | Agent-loop advisory context (per-source status, fail-closed before first model call) | IMPLEMENTED + VERIFIED | P2 | HARNESS-CONTEXT | One failed provider aborts all loaded context (agent-loop.mjs:315-328); per-source status matrix untested. |
| C3-03 | Single canonical context owner (no divergent composers) | PARTIAL | P2 | HARNESS-CONTEXT | Chat and agent paths can drift; neither composer is a shared service. |
| C3-04 | Situation Object (/api/orch/context) real, tested, consumed | PARTIAL | P1 | HARNESS-CONTEXT | Situation engine incomplete against design (no task/risk/recommendation) and unverified; any V1 awareness claim resting on it is unsupported. |
| C3-05 | Situation Frames / Context Apertures / working memory as named canonical concepts | MISSING — V1.1 | OBSERVATION | HARNESS-CONTEXT | No named aperture/frame/working-memory abstraction. Do not add a parallel concept; extend memory blocks + recall if needed. |
| C3-06 | Skill projection: deterministic selection and bounded injection | IMPLEMENTED + VERIFIED | P2 | HARNESS-CONTEXT | No unit test for loader bounds/scoring; 76/292 registry entries have empty descriptions, weakening selection. |
| C3-07 | Stage-aware skill selection claim is evidenced | IMPLEMENTED + UNVERIFIED | P1 | HARNESS-CONTEXT | Claim outruns evidence: no test/artifact shows different skill picks per stage; mechanism is keyword emphasis only. |
| C3-08 | Tool awareness in the agent prompt | IMPLEMENTED + VERIFIED |  | HARNESS-CONTEXT | Static tool docs only; no dynamic availability/authority metadata. |
| C3-09 | Model awareness: routing that knows model capability/measurements | PARTIAL | P2 | HARNESS-CONTEXT | Router is role-only (no task/content awareness); capability metadata empty; hardware profile not imported; tok/s always null in situation context. |
| C3-10 | Workspace awareness (retrieval + resident context) | IMPLEMENTED + VERIFIED |  | HARNESS-CONTEXT | Retrieval failure silent; degraded semantics untested for chat path. |
| C3-11 | Mission awareness in the model prompt | PARTIAL | P2 | HARNESS-CONTEXT | Model-facing mission awareness is a single stage/revision line; mission objective/id and receipts are not injected. |
| C3-12 | Capability state taxonomy (INSTALLED/EXPOSED/CALLABLE/AUTHENTICATED/AUTHORIZED/QUALIFIED/ACTIVE) | MISSING — V1.1 | P2 | CORE | No unified taxonomy; release-deferred with Capability Fabric. Do not create parallel states before the Fabric decision. |
| C3-13 | Capability Manifest / Situation Manifest (canonical, versioned) | MISSING — V1.1 | P2 | CORE | No versioned capability manifest with typed descriptors/permission diff/conformance states. Avoid duplicating existing manifests. |
| C3-14 | Skill/SOP/workflow metadata completeness (version/owner/io/authority/trust/network/platform/side-effects/idempotency/model-reqs/qualification/depreca… | PARTIAL | P2 | HARNESS-CONTEXT | All requested governance fields absent from skills; sops.json role must/must_not has zero consumers. |
| C3-15 | Worker handoff envelope carries full transfer context | PARTIAL | P1 | HARNESS-CONTEXT | Missing fields: worktree, branch, HEAD, baseline, clean/dirty, protected boundaries, owned processes; tests summary is verification_refs only; blocker is open_questions. |
| C3-16 | Branch/worktree preflight bound to agent start and handoffs | PARTIAL | P1 | HARNESS-CONTEXT | Agent start requires no clean/dirty declaration or branch/HEAD binding; worktree identity not linked to session or handoff identity. |
| C3-17 | Resident contaminated-worktree incident record (cause/impact/prevention) committed | MISSING — V1 REQUIRED | P1 | RESIDENT-LANE | No committed incident record; cannot serve as immutable evidence for branch/worktree preflight (C3-16). |
| C3-18 | Workflow continuity: creation route + stage-to-context + receipt lineage | IMPLEMENTED + VERIFIED |  | HARNESS-CONTEXT | Stage context is one status line; skill stage-awareness unverified (C3-07); receipt lineage depends on C1-02. |
| C3-19 | Restart continuity + receiving context (cold restart, consume-once) | IMPLEMENTED + VERIFIED | P2 | HARNESS-CONTEXT | P07 artifact records transcript_not_replayed:false / no_transcript_replay:false while CORE-CLOSURE-RUNSTATE.md:24 records P0.7 PASS; polarity or silent failure; owner clarification required. |
| C3-20 | Session handoff bundles are consumable (not write-only) | PARTIAL | P2 | HARNESS-CONTEXT | Bundles never read into any prompt (orphaned); code_refs/workspace_digest declared but never populated. |
| C3-21 | Handoff evidence coverage | IMPLEMENTED + VERIFIED |  | HARNESS-CONTEXT | No branch/worktree preflight test (fields absent per C3-15/C3-16). |

## C4 trust/security/egress

| ID | Requirement | Status | Pri | Owner | Gap / evidence anchor |
| --- | --- | --- | --- | --- | --- |
| C4-01 | Workspace Trust: three-state model (UNTRUSTED/RESTRICTED/TRUSTED) with canonical enforcement | MISSING — V1 REQUIRED | P0 | SECURITY | Untrusted workspace content (task manifests, configs, plugin manifests) reaches approval cards/execution with no trust gate; no canonical owner enforces a trust state. |
| C4-02 | Local-Only preference universally enforced across all egress surfaces | PARTIAL | P0 | SECURITY | local-only pins role routing only; non-chat egress paths bypass the preference. Claim 'Local by default PROVEN' is scoped to one path and outruns universal enforcement. |
| C4-03 | Consent-off provider egress denied (403) with journal-before-fetch | IMPLEMENTED + VERIFIED | P1 | SECURITY | Applies to BYOK/provider-chat surface only; bypasses tracked C4-02/C4-04. |
| C4-04 | GET /api/modelhub/files must not egress with a stored token without approval/consent | MISSING — V1 REQUIRED | P0 | SECURITY | A paired local request causes authenticated external transmission to huggingface.co with no operator decision and no consent, under an auto-permitted .read kind. |
| C4-05 | Egress manifest reports classified capabilities and consent truth | IMPLEMENTED + VERIFIED | P1 | SECURITY | Manifest is descriptive only (enforces nothing); route unreachable at product edge (C1-02); journal projection reads last 200 rows only. |
| C4-06 | Egress journal coverage on every external transmission | PARTIAL | P1 | SECURITY | Telegram, builtin provider probes, and the embeddings URL egress without journal entries; sovereignty audit trail incomplete. |
| C4-07 | Egress journal secret redaction and bounded growth | PARTIAL | P1 | SECURITY | A curl/Invoke-WebRequest with an inline credential lands unredacted in .aide/egress/journal.jsonl; journal has no retention/rotation. |
| C4-08 | BYOK enrollment and per-operation authorization (digest-bound, no secret echo) | IMPLEMENTED + VERIFIED | P1 | SECURITY | No per-provider host authorization for custom base_url (C4-09). |
| C4-09 | Provider host allowlisting applies to every connect path | PARTIAL | P2 | SECURITY | Any base_url approved at enrollment reaches the network regardless of host allowlist; skill doctrine overstates coverage. |
| C4-10 | Credentials at rest protected (DPAPI); plaintext only by explicit opt-in | IMPLEMENTED + VERIFIED | P1 | SECURITY | Windows-only (non-Windows fails closed); test-only plaintext env never set by production scripts. |
| C4-11 | Secret logging/audit redaction is comprehensive | PARTIAL | P1 | SECURITY | A handler exception message containing secret material reaches the daemon log via the stack; defense depends on each handler's boundary. |
| C4-12 | Credential rotation and revocation lifecycle | PARTIAL | P2 | SECURITY | No expiry, rotation schedule, or versioning; revocation is manual deletion only. |
| C4-13 | Plugin trust, deny-by-default sandbox, network opt-in | PARTIAL | P1 | SECURITY | network.localhost maps to Node --allow-net (unrestricted network), not localhost; Node >=26 required so older runtimes fail closed (declared NOT_READY). |
| C4-14 | MCP/workbench trust state machine with egress consent | PARTIAL | P1 | SECURITY | No MCP client/transport exists (trust has no runtime consumer); shipped daemon never passes workbenchEgressAllowlist (server.ts:368-371) so online trust is permanently denied with no operator grant path. |
| C4-15 | Prompt-injection defense: taint/trust propagation or equivalently proven controls | PARTIAL | P1 | SECURITY | No taint tracking; tool output interpolated unescaped into <tool_result> so content with the closing tag can break framing; no injection classifier. |
| C4-16 | Desktop permission boundary: authority-gated, grant-scoped, panic-revocable | IMPLEMENTED + VERIFIED | P1 | DESKTOP-CONTROL-LANE | Bounded service verified; broad GUI mission is a separate lane (C4-20/RELS-03); desktop battery evidence stale (C4-17). |
| C4-17 | Desktop battery evidence is current with the authority-gated service | PARTIAL | P2 | DESKTOP-CONTROL-LANE | Stale battery in test chain and evidence log; current evidence lives in desktop-policy tests + panic probe, not all gated. |
| C4-18 | Untrusted input surfaces are jail-bound or approval-gated | PARTIAL | P1 | SECURITY | read_file/GET /api/file have no protected-prefix denial so .aide stores (egress journal, BYOK provider records, memory/chat) are model-readable without approval; network run_command journaled but not blocked. |
| C4-19 | Publication claim guards: no public claim exceeds qualification evidence | PARTIAL | P1 | RELEASE | Manual review only; mismatches exist: 'Local by default PROVEN' vs C4-02/C4-04; 'receipt/admission/readiness PROVEN' vs reachability (C1-02). |
| C4-20 | Desktop Control lane integration decision | OWNER HANDOFF | P2 | DESKTOP-CONTROL-LANE | No decision to integrate or defer the lane head; matrix records the dependency without modifying lane files. |

## C5 reliability/operations

| ID | Requirement | Status | Pri | Owner | Gap / evidence anchor |
| --- | --- | --- | --- | --- | --- |
| C5-01 | Retry policy classified and bounded; no blind retry of consequential operations | IMPLEMENTED + VERIFIED | P2 | RELIABILITY | Download retries lack backoff/jitter; provider 429 does not honor Retry-After. No blind retry of git push/provider chat/training found. |
| C5-02 | Governed failure continuation with bounded budget and terminal truth | IMPLEMENTED + VERIFIED | P2 | RELIABILITY | side_effects is hard-coded 'unknown' (continuation-manager.ts:210); effect truth gap tracked C5-03. |
| C5-03 | Effect ledger / reconciliation before retry (no duplicated consequential effects) | PARTIAL | P1 | RELIABILITY | No mechanical proof that applied effects are not replayed; side_effects always 'unknown'. |
| C5-04 | Download retry/resume for interrupted external transfers | PARTIAL | P1 | RELIABILITY | No stall/inactivity timeout on download fetch (modelhub.mjs:278); connected-but-silent server hangs the job; ENOSPC path untested. |
| C5-05 | Engine start failure handling (bounded retry, memory drain, stale sweep) | PARTIAL | P2 | RELIABILITY | Early-exit retry branch has no injected-crash test (code-only evidence). |
| C5-06 | Telegram long-poll backoff and durable spool | PARTIAL | P2 | RELIABILITY | disconnect aborts a controller never passed to fetch so in-flight 35s poll is not cancelled; spool has no crash-replay dedupe. |
| C5-07 | Git operations bounded and fail-closed | PARTIAL | P2 | RELIABILITY | Lock-retry branch untested; push auth failure surfaces only raw git stderr mapped to typed codes. |
| C5-08 | Idempotency core: operation digest + single-use execution authority | IMPLEMENTED + VERIFIED |  | SECURITY | In-memory authority state does not survive restart (accepted: short TTLs; mission durability tracked C2-11). |
| C5-09 | Workflow-object idempotency (handoff/continuation/download/telegram) | IMPLEMENTED + VERIFIED | P2 | RELIABILITY | Telegram lastUpdate is in-memory so update_id dedupe does not survive restart. |
| C5-10 | Timeouts on local model, tools, subprocesses | IMPLEMENTED + VERIFIED | P2 | RELIABILITY | No per-mission wall-clock budget; loop bounded only by 25 iterations x up to ~90s calls. |
| C5-11 | Timeouts on BYOK/legacy provider calls | PARTIAL | P1 | RELIABILITY | A non-responding BYOK/legacy provider hangs an agent mission indefinitely; the loop calls it as chatFn. |
| C5-12 | Timeouts on model-hub fetches and server request handling | PARTIAL | P1 | RELIABILITY | A hung HF request holds the route handler open indefinitely; no server-level handler timeout. |
| C5-13 | SSE stream bounded, abortable, backpressured | PARTIAL | P2 | RELIABILITY | No idle timeout on a stalled stream; no backpressure handling. |
| C5-14 | Cancellation of long non-agent operations | IMPLEMENTED + VERIFIED |  | RELIABILITY | Telegram disconnect best-effort (C5-06). |
| C5-15 | User cancellation of a running agent mission | MISSING — V1 REQUIRED | P1 | RELIABILITY | A running mission cannot be stopped from the cockpit; with C5-11/C5-12 a hung provider call cannot be aborted at all. |
| C5-16 | Backpressure and queue bounds on streaming/events | PARTIAL | P2 | RELIABILITY | No SSE/WS backpressure policy; slow subscriber can accumulate outbound buffers. |
| C5-17 | Rate limiting / request concurrency admission | MISSING — V1.1 | P2 | RELIABILITY | A local client can saturate the backend; low impact for single-user local product. |
| C5-18 | Error mapping for 429/5xx/auth expiry/network/provider/runtime/tool loss | PARTIAL | P1 | RELIABILITY | BYOK 429/5xx only surfaces 'provider HTTP n' (byok-service.mjs:115) with no busy/timeout semantics or Retry-After; no in-call provider failover. |
| C5-19 | Resource admission enforced at every start path (model/training/agent/worker) | PARTIAL | P1 | RELIABILITY | Admission is a probe, not a gate; VRAM never passed by callers; no disk-space preflight. Training can start on an occupied machine and OOM. |
| C5-20 | Token/cost controls for external provider usage | MISSING — V1.1 | P2 | RELIABILITY | Cloud/BYOK usage not accounted or capped; usage only echoed per call. |
| C5-21 | Observability/diagnostics truthful and complete | IMPLEMENTED + VERIFIED | P2 | RELIABILITY | emitAgentMessage (audit-trail.mjs:141-150) never called; system-map agent_loop probes .aide/agent-loop-sessions which has no writer (card always offline in production); self-improve runner unsupervised (C5-26). |
| C5-22 | Fault-injection coverage for crash/chaos paths | PARTIAL | P2 | RELIABILITY | No resilience sweep (kill backends mid-session -> recovery); no engine-crash injection for the retry branch (C5-05). |
| C5-23 | Correlation chain workspace-mission-attempt-obligation-model-tool-external-verification-receipt | PARTIAL | P2 | RELIABILITY | No obligation entity anywhere; no per-tool-call id; model invocations are not audit rows; engine PID map never joined to a session. |
| C5-24 | Storage lifecycle: retention, quotas, cleanup | PARTIAL | P2 | RELIABILITY | No quota/retention/prune/compaction for append-only stores; self-improve reads the whole audit bus into memory (selfimprove.mjs:54-59). |
| C5-25 | Accepted performance budgets + candidate-bound measurements | MISSING — V1 REQUIRED | P1 | RELIABILITY | No accepted performance budget exists; no candidate-bound performance artifact at e23. Do not manufacture budgets. |
| C5-26 | Self-improve runner supervised and governed | PARTIAL | P2 | RELIABILITY | No lock/overlap guard, no exit-code capture, writes into workspace outside the approval path; reads whole audit bus. |

## C6 distribution/supply chain

| ID | Requirement | Status | Pri | Owner | Gap / evidence anchor |
| --- | --- | --- | --- | --- | --- |
| C6-01 | Desktop shell source exists (Tauri v2) | CLOSED |  | DISTRIBUTION | No updater/plugins/install-mode config (tracked separately). |
| C6-02 | Shell decision record unambiguous (Tauri vs Electron) | PARTIAL | P2 | DISTRIBUTION | Architecture docs contradict the committed shell. |
| C6-03 | TUI surface exists (Desktop + TUI + CLI over shared truth) | MISSING — V1 REQUIRED | P1 | DISTRIBUTION | No TUI client exists. Scope dependency: V1 scope owner must confirm TUI is V1 or move it to V1.1; if V1 it is a release blocker. |
| C6-04 | CLI surface declared and installed (bin/PATH) | PARTIAL | P2 | DISTRIBUTION | Only a verification CLI is declared; no product CLI with install story. |
| C6-05 | Headless/product CLI (serve/--json) exists | MISSING — V1.1 | P2 | DISTRIBUTION | No headless serve CLI or machine-readable product mode. |
| C6-06 | Desktop runs the same typed server truth as the source stack | IMPLEMENTED + UNVERIFIED | P1 | DISTRIBUTION | Wiring proven by source + prepare-verify, but no recorded run of the staged/packaged stack; staged smoke can vacuously pass. |
| C6-07 | Installer targets configured for each platform | IMPLEMENTED + UNVERIFIED | P1 | DISTRIBUTION | No certified installer; no in-repo artifact; Linux path additionally blocked by glib (C6-09). |
| C6-08 | Windows installer lifecycle (install -> launch -> health -> reinstall -> uninstall) green | IMPLEMENTED + UNVERIFIED | P1 | DISTRIBUTION | No green Windows lifecycle run recorded in-repo; health probe mismatch (/health at desktop-lifecycle-smoke.ps1:99 vs /api/health at desktop/src/main.rs:43) never validated against an installed app. |
| C6-09 | glib advisory GHSA-wrw7-89jp-8q8g resolved or explicitly mitigated for the desktop path | BLOCKED | P0 | DISTRIBUTION | Affected Linux desktop build path; reachability of VariantStrIter not established; resolution needs an upstream-compatible graph at glib >=0.20.0 (Tauri/GTK4 migration) and a clean build/install test. Not a source-core blocker; accepted as a desktop-installer blocker. |
| C6-10 | Installer/application code signing | MISSING — V1 REQUIRED | P1 | DISTRIBUTION | No code signing, manifest signing, or notarization; required if a packaged installer ships in V1 (the source release is exempt by scope). |
| C6-11 | Update/rollback/repair/uninstall lifecycle | MISSING — V1.1 | P1 | DISTRIBUTION | No update mechanism, rollback, or installer repair; uninstall exists only in the lifecycle script. |
| C6-12 | Clean-machine packaged-app install/first launch | BLOCKED | P1 | DISTRIBUTION | No clean-machine installer run, first-launch evidence, model/runtime bundling verification, or per-machine-install write test. |
| C6-13 | Portable package | MISSING — V1.1 | P2 | DISTRIBUTION | No portable target exists. |
| C6-14 | WinGet readiness | MISSING — V1.1 | P2 | DISTRIBUTION | No WinGet manifest or submission automation. |
| C6-15 | PATH integration for CLI tools | NOT APPLICABLE |  | DISTRIBUTION | evidence: no setx/SetEnvironmentVariable/PATH registration anywhere |
| C6-16 | Lockfiles pinned and used | IMPLEMENTED + VERIFIED | P2 | DISTRIBUTION | package.json uses caret ranges with no packageManager field or engine-strict; desktop:build does not pass --locked; no lock-integrity CI check. |
| C6-17 | Dependency scanning configured (Dependabot) | CLOSED | P2 | DISTRIBUTION | No github-actions ecosystem entry; no grouping/security-only config; cargo alerts not gated by CI. |
| C6-18 | Static analysis (CodeQL/SAST) in CI | MISSING — V1.1 | P2 | DISTRIBUTION | No SAST workflow. |
| C6-19 | Dependency-review / dependency audit CI gates | MISSING — V1.1 | P2 | DISTRIBUTION | Audits are manual/point-in-time, not CI gates. |
| C6-20 | Secret scanning is automated and truthful | PARTIAL | P2 | DISTRIBUTION | Scanner is regex-based with known gaps (js/mjs/json/md/html to depth 4); tracked hook does not scan secrets; parity claim is documentation, not code. |
| C6-21 | License compliance for distributed artifacts | PARTIAL | P1 | RELEASE | Manual notices with no generation script; model redistribution licensing unresolved by design at the source-release boundary; no CI license check. |
| C6-22 | SBOM, checksums, provenance generated and verifiable | PARTIAL | P1 | RELEASE | Manual invocation only; artifacts live outside the repo; no CI regeneration/verification; checksums cover source artifacts only (no installer). |
| C6-23 | Signed provenance/attestation (sigstore/SLSA) | MISSING — V1.1 | P2 | RELEASE | No signed attestation. |
| C6-24 | Dependabot alert state is known and internally consistent | PARTIAL | OBSERVATION | SECURITY | Current GitHub alert state is not verifiable from the repo and two internal records disagree; treat Dependabot UI state as UNVERIFIED. |
| C6-25 | Unsloth Runtime V1 Administrator requirement separated from app install privileges | OWNER HANDOFF | P1 | RUNTIME-LANE | Requirement source is the runtime lane, not this repo; app-install privilege model is separately undetermined (C6-26). |
| C6-26 | Packaged app install privilege model declared | PARTIAL | P1 | DISTRIBUTION | Per-machine MSI vs per-user NSIS undetermined; first-run write failure under a per-machine install untested. |
| C6-27 | Source fresh-machine install path is truthful and verified | IMPLEMENTED + VERIFIED | P2 | RELEASE | Assembly machine Windows-only; interactive pairing not repeated; README says npm install while certified path uses npm ci (C7-33). |
| C6-28 | Packaged desktop crash recovery | PARTIAL | OBSERVATION | DISTRIBUTION | Claimed/proven for source stack only; packaged restart behavior not exercised. |

## C7 release acceptance

| ID | Requirement | Status | Pri | Owner | Gap / evidence anchor |
| --- | --- | --- | --- | --- | --- |
| C7-01 | README is truthful against KNOWN-LIMITATIONS and the shipping cockpit | PARTIAL | P2 | DOCS-PUBLIC | README understates shipped surfaces and never links the limitations/status record (only the addendum bridges them). |
| C7-02 | Documented E2E verification command actually works | PARTIAL | P1 | DOCS-PUBLIC | The documented E2E command is stale against the current tree; users following the README get a failing run. |
| C7-03 | Security/disclosure, contribution, license, and quickstart docs exist and are truthful | CLOSED |  | DOCS-PUBLIC | evidence: scripts referenced by CONTRIBUTING all exist (package.json:11-35) |
| C7-04 | User-facing release notes / changelog | MISSING — V1.1 | P2 | DOCS-PUBLIC | No chronological release notes for a public announcement. |
| C7-05 | End-to-end acceptance harnesses are gated and cover the release journeys | PARTIAL | P2 | RELEASE | Three integration suites proving real journeys are not in npm test/CI, so regressions can pass CI while they break. |
| C7-06 | Onboarding backend: state machine, atomic persistence, authority-bound transitions | IMPLEMENTED + VERIFIED |  | CORE | evidence: tests/arch/onboarding-runtime.test.ts:66,131,192,253,290 |
| C7-07 | First-launch Walkthrough UI verified | IMPLEMENTED + UNVERIFIED | P2 | CORE | UI-level first-run unverified; doctrine test asserts skill text listing .tsx files that do not exist (tests/arch/onboarding-walkthrough-doctrine.test.ts:55-72). |
| C7-08 | Adaptive SetupSession (interview -> plan -> approval -> provisioning) verified | IMPLEMENTED + UNVERIFIED | P2 | OPERATOR-CONTROL-LANE | No evidence for SetupSession behavior. |
| C7-09 | Open project journey | IMPLEMENTED + VERIFIED | P2 | CORE | No runtime project switch; workspace fixed at launch (server.ts:318, AIDE_WORKSPACE). |
| C7-10 | Runtime configuration settings: canonical backend with machine-scope protection | IMPLEMENTED + VERIFIED | P2 | CORE | Canonical cockpit SettingsSurface has no /api/settings consumer (grep browser/src = 0); displayed settings vs enforcement not fully audited (C7-34). |
| C7-11 | Provider connection journey (consent, authorization, fail-closed) | QUALIFIED | P2 | SECURITY | Live external proof depends on entitlement/credentials and is not reproducible in-repo; Kimi env-blocked (KNOWN-LIMITATIONS.md:22-23). |
| C7-12 | Model selection journey (role routing to a real local model) | PARTIAL | P2 | MODEL-MANAGER-LANE | Router is role-only; D2 negatives had a probe bug (D2-NEGATIVES.json:14-18); model artifacts live outside the repo (E:/models). |
| C7-13 | Mission execution journey (governed mission with real execution) | QUALIFIED | P2 | CORE | P10 records no model identity/hash (local:auto only); single workspace; probe drivers not in repo. |
| C7-14 | Tool use journey (jailed tools with authority) | QUALIFIED | P2 | CORE | test-a1-agent.mjs is not in npm test/CI; tool timeout branch untested. |
| C7-15 | Verification journey (evidence-gated transitions, honest states) | QUALIFIED | P2 | HARNESS-CONTEXT | No product producer of passing evidence (C1-12); claim scoped to the release gate. |
| C7-16 | Failure recovery journey (fail -> continue -> cold restart -> consume-once) | QUALIFIED | P2 | RELIABILITY | Restart continuity is continuation/handoff from disk, not live session resume (C2-11); P07 polarity anomaly (C3-19). |
| C7-17 | Diagnostics/readiness journey reachable by users | PARTIAL | P2 | RELIABILITY | Readiness backend-only: unmapped route (C1-02) and no UI consumer; first-run readiness not visible in the cockpit. |
| C7-18 | Accessibility of the shipping cockpit | PARTIAL | P2 | CORE | No Escape-to-close and no :focus-visible styles in the canonical cockpit; a11y battery (scripts/a11y-battery.mjs:18-20) targets legacy files only and is not gated; no automated a11y test for browser/src. |
| C7-19 | Privacy/data-handling statements match behavior | QUALIFIED | P2 | DOCS-PUBLIC | Egress journal is observational, not preventive; run_command network tokens journaled but not blocked (C4-18). |
| C7-20 | Offline/consent-gated egress journey | QUALIFIED | P2 | SECURITY | Manifest route unmapped (C1-02); BYOK-scoped only (C4-02/C4-04). |
| C7-21 | Interactive PowerShell / cmd terminal capability is verified on a real host | IMPLEMENTED + UNVERIFIED | P2 | CORE | No in-repo test spawns a real PowerShell/cmd PTY; interactive session unproven by committed evidence. |
| C7-22 | WSL terminal provider actually launches | PARTIAL | P2 | CORE | A provider reporting WSL 'available' would attempt to execute a POSIX path on win32; launch path likely non-functional and untested. |
| C7-23 | stdout/stderr/exit capture, cwd, filesystem ops, search, Git read/diff/log are qualified | QUALIFIED |  | CORE | evidence: acceptance-p0.mjs:96-124; tests/unit/test-a1-agent.mjs:332-365; tests/arch/file-routes.test.ts; tests/arch/search-routes.test.ts; tests/arch/git-routes.test.ts:88-226 |
| C7-24 | Worktrees + isolated stage/commit are reachable and qualified | QUALIFIED | P2 | CORE | /api/workbench/worktree/* has no facade prefix (only /api/workbenches) so the product edge cannot reach it (C1-02); merge/rebase strategies untested (squash only); no UI consumer. |
| C7-25 | Process ownership + port management mechanisms are qualified and gated | QUALIFIED | P2 | CORE | Panic-ownership and owned-process unit suites are not in npm test/CI (C7-05). |
| C7-26 | Build/test task runner is qualified | QUALIFIED |  | CORE | evidence: acceptance-p0.mjs:100-124; acceptance-real.mjs:86-109; tests/arch/task-routes.test.ts |
| C7-27 | Browser tooling as an agent capability | INTENTIONALLY UNSUPPORTED |  | CORE | evidence: grep = 0 in node/src; cockpit acceptance is fixture-mocked and ungated |
| C7-28 | Controlled network capability (allowlist/consent/journal) | QUALIFIED | P2 | SECURITY | Not a preventive egress firewall for approved commands; modelhub/files defect (C4-04) is in this surface. |
| C7-29 | Handoff journey (create/accept/consume, no authority or secret transfer) | QUALIFIED |  | HARNESS-CONTEXT | Management routes /api/worker-handoff/* unmapped (C1-02); only the /api/agent receive path is reachable. |
| C7-30 | V1 long-horizon regression contract defined and executable | MISSING — V1 REQUIRED | P1 | RELEASE | No long mission / many tool calls / project switch / model switch / interruption-resume / stale-information contract exists. Invariants required: no project bleed, no lost obligations, no stale capability/model identity, no false completion, no lost verification state. Required clauses defined in docs/v1/COVERT-V1-RELEASE-CRITICAL-PATH.md. |
| C7-31 | RELEASE-CLAIM-MATRIX classifications match closure evidence | PARTIAL | P1 | RELEASE | Several PROVEN classifications are true for backend components but not for the canonical product edge or universal enforcement. |
| C7-32 | Claimed independent bounded soak has a committed artifact | MISSING — V1.1 | P2 | RELEASE | Certification record asserts an independent bounded soak without an artifact; either produce it or restate the record. |
| C7-33 | README install instructions match the certified path | PARTIAL | OBSERVATION | DOCS-PUBLIC | Instruction drift; npm install can resolve differently from the certified lockfile. |
| C7-34 | Settings display truth: effective value, source, truthful System Health, Why Blocked | PARTIAL | P2 | OPERATOR-CONTROL-LANE | A visible setting is not proven to be canonically enforced or sourced; lane owns the surface. Requires an effective-value/source projection and a why-blocked explanation path, or explicit V1 scoping. |

## RELS lane relationships

| ID | Requirement | Status | Pri | Owner | Gap / evidence anchor |
| --- | --- | --- | --- | --- | --- |
| RELS-01 | Dogfood lane findings ingest into this matrix without duplicating its execution | OWNER HANDOFF | P2 | DOGFOOD-LANE | No P0/P1 findings, self-hosted evidence, comparison evidence, or failure/recovery evidence ingested yet. Matrix rows exist to receive them; execution stays with the Dogfood owner. |
| RELS-02 | Luna artifact lane references are corrected against actual refs | CLOSED |  | RELEASE | evidence: git merge-base checks 2026-09-25 |
| RELS-03 | Resident permanent qualification (F1b) completes with accepted Authority integration | OWNER HANDOFF | P1 | RESIDENT-LANE | Resident is not qualified; it waits for the exact Authority integration then one owner rerun. Do not rerun F1b from this lane. |
| RELS-04 | Authority chat-contract closure integrates into source release and Resident | OWNER HANDOFF | P1 | CORE | Closed contract is not in the source-release line or the Resident lane; integration decision outstanding. |
| RELS-05 | Runtime V1 Passport integration decision (driver for C1-09) | OWNER HANDOFF | P2 | RUNTIME-LANE | Runtime V1 is closed in an external lane; integration/abstraction decision tracked C1-09. |
| RELS-06 | Operator Control lane displayed-settings enforcement audit | OWNER HANDOFF | P2 | OPERATOR-CONTROL-LANE | Lane owns the surface; this audit did not verify displayed-vs-enforced parity to source depth. |
| RELS-07 | Harness vnext / crown-jewel lanes remain protected and unmodified | NOT APPLICABLE |  | HARNESS-CONTEXT | Lane heads are outside this SHA; integration decisions stay with their owners. |
| RELS-08 | Public site claims reconcile with closure evidence | PARTIAL | P2 | DOCS-PUBLIC | Public-site copy must not exceed C7-31 claim matrix after reconciliation. |
| RELS-09 | Source assembly and certification boundary recorded and preserved | CLOSED |  | RELEASE | evidence: docs/release/SOURCE-ASSEMBLY-VALIDATION.md; SOURCE-CERTIFICATION-RECORD.md |
| RELS-10 | Audit checkpoints are committed; upstream ownership is explicit | PARTIAL | OBSERVATION | RELEASE | Push ownership not established for this branch; no upstream was created by this session. |

## Lane snapshot

| Lane | Branch | HEAD | Tree | State |
| --- | --- | --- | --- | --- |
| Resident | resident/marathon-h1-resume | `323fdb3ae8` | CLEAN | F1b APPARATUS_INVALID; waits for exact Authority integration then owner reruns once |
| Authority | fix/authority-chat-contract-v1 | `e41083dab6` | CLEAN | Contract CLOSED; not integrated into source release or Resident |
| Runtime | research/local-runtime-bakeoff | `e41aafa1b7` | CLEAN | Runtime V1 CLOSED for exact Passport profile |
| Desktop Control | feat/covert-desktop-control-v1 | `aed7efd6f3` | CLEAN | Broad GUI mission blocked; source candidate treats Desktop Control as post-candidate |
| Model Manager | feat/model-manager | `d80d18445b` | CLEAN | MM9 focused acceptance passes; broad architecture acceptance pending |
| Dogfood | research/covert-dogfood-v1 | `edcf316d54` | PARKED | Wave1-A2 blocked: no reclaimable process, reboot not provably safe; exact blocker frozen; owner lane |
| Operator Control | feat/covert-operator-control-surface | `a05ad8484b` | CLEAN | Current-scope acceptance gaps closed; displayed-settings truth audit not re-verified here |
| Source Assembly | release/source-assembly | `e23aec80cd` | CLEAN | Assembly validation PASS (docs/release/SOURCE-ASSEMBLY-VALIDATION.md); installer excluded by scope |

## Owner handoffs (open)

- **C1-09** (RUNTIME-LANE, P1): RuntimeAdapter abstraction decision (vs ModelRuntime as canonical) — No adapter abstraction exists. Decision outstanding: V1 requires it, or ModelRuntime is accepted canonical runtime owner.
- **C4-20** (DESKTOP-CONTROL-LANE, P2): Desktop Control lane integration decision — No decision to integrate or defer the lane head; matrix records the dependency without modifying lane files.
- **C6-25** (RUNTIME-LANE, P1): Unsloth Runtime V1 Administrator requirement separated from app install privileges — Requirement source is the runtime lane, not this repo; app-install privilege model is separately undetermined (C6-26).
- **RELS-01** (DOGFOOD-LANE, P2): Dogfood lane findings ingest into this matrix without duplicating its execution — No P0/P1 findings, self-hosted evidence, comparison evidence, or failure/recovery evidence ingested yet. Matrix rows exist to receive them; execution stays with the Dogfood owner.
- **RELS-03** (RESIDENT-LANE, P1): Resident permanent qualification (F1b) completes with accepted Authority integration — Resident is not qualified; it waits for the exact Authority integration then one owner rerun. Do not rerun F1b from this lane.
- **RELS-04** (CORE, P1): Authority chat-contract closure integrates into source release and Resident — Closed contract is not in the source-release line or the Resident lane; integration decision outstanding.
- **RELS-05** (RUNTIME-LANE, P2): Runtime V1 Passport integration decision (driver for C1-09) — Runtime V1 is closed in an external lane; integration/abstraction decision tracked C1-09.
- **RELS-06** (OPERATOR-CONTROL-LANE, P2): Operator Control lane displayed-settings enforcement audit — Lane owns the surface; this audit did not verify displayed-vs-enforced parity to source depth.

## Known release decisions

| Key | Value |
| --- | --- |
| certified_source_candidate | dc0d30ee226e7ff822592e3a800f064b4441b7af |
| source_assembly_head | e23aec80cd05ab0c237eba793421bb5e7c5a57e7 |
| authority_chat_contract | e41083dab6a5a23e625a824527d11a2ba7623303 |
| runtime_checkpoint | e41aafa1b723d14981af8882f44a0de782170076 |
| runtime_passport_sha256 | 921af21011ac194cf84ae11751de0f32018a7646fe857555a6ca167e6bdf8b4c |
| resident_checkpoint | 323fdb3ae800996e19eecc6fd53b3d88bdf4a2bf |
| desktop_control_checkpoint | aed7efd6f3e6794776104b5c19ba86e09bfe2fe1 |
| model_manager_head | d80d18445b475d2ae2f6987b16cbb047224b2c5e |
| operator_control_head | a05ad8484b7d5451f8797a8d09e99a08836320ca |
| dogfood_head | edcf316d54446e8f5fe75835775055a99e978a2a |
| dogfood_head_correction | Luna partial artifact listed d0d4e40 (merge of authority chat contract into dogfood); d0d4e40 is an ancestor of edcf316 and the lane is parked at edcf316. Corrected. |
| harness_vnext_head | b4efac65da4650dd81bd3a85da72d992bc526b8a |
| public_site_head | a70bab580fbbfeaed0182bb70861258fb170e2b4 |
| refs_checked_utc | 2026-09-25 |

## Known uncertainties

- Tests were not re-executed in this audit lane. In-repo suites are cited as evidence locations; current-SHA pass status is UNVERIFIED except where committed artifacts bind runs to the dc0d30ee lineage.
- CI run 35869659152 and its head_sha cannot be verified offline; the in-repo 140/140 battery is timestamped ~12 minutes before the candidate commit and is not cryptographically bound to it.
- P0.x probe drivers are not in the repository (E:/pip_temp/opencode/*.mjs per the formal docs); committed JSONs are the only artifacts, so journeys cannot be re-executed from the source archive alone.
- P10 records no model identity/hash (worker local:auto), so 'local engine ran' is artifact-asserted, not provenance-verifiable.
- The certification record's 'independent bounded soak' has no in-repo artifact (C7-32).
- P07 artifact polarity contradicts the recorded P0.7 PASS (C3-19); owner clarification required.
- Facade reachability conclusions were derived statically (openapi paths vs facade map vs legacy handlers); no live request was executed in this read-only audit.
- RuntimeAdapter, Runtime lane Passport, Model Manager broad acceptance, Desktop Control lane head, Resident qualification, and Dogfood evidence live in external worktrees not provable from this checkout.
- TUI requirement level is external to the repo: absence is proven; V1-vs-V1.1 scope decision pending (C6-03).
- 'Administrator-required Unsloth Runtime V1' cannot be confirmed or denied from this repo; the runtime lane owns that evidence (C6-25).
- Dependabot alert current UI state (open vs dismissed) is not verifiable offline; internal records disagree (C6-24).
- Priority classification is conservative. Some PARTIAL rows could move to P0 under scope decisions (notably C2-06 if two instances on one workspace are supported; C1-09 if a RuntimeAdapter is contractually required).
- The facade runtime override (.aide/facade-routes.json) is absent in this checkout; reachability conclusions assume the committed default map.
- Shared truth is per AIDE_WORKSPACE root; cross-workspace client behavior is untested (C2-18).

## Artifact set

- `docs/v1/COVERT-V1-RELEASE-CLOSURE-MATRIX.json` — canonical machine matrix (this rendering's source).
- `docs/v1/COVERT-V1-RELEASE-CLOSURE-MATRIX.md` — this file.
- `docs/v1/COVERT-V1-RELEASE-CRITICAL-PATH.md` — dependency-ordered closure path.
- `docs/v1/recovery/COVERT-V1-RELEASE-CLOSURE-MATRIX.luna-partial.json` — recovered Luna artifact, byte-exact.

### Statuses that are deliberately not CLOSED

- `IMPLEMENTED + UNVERIFIED` means the code and a test file exist but the current-SHA pass was not re-executed or the evidence is stale.
- `PARTIAL` means a real, evidenced component exists but a defined closure condition is unmet; the gap column states exactly what is missing.
- `BLOCKED` means an external condition (advisory, missing artifact, unreproduced run) prevents closure.
