# Remote Operator Control Plane — Architecture

- **Status:** DESIGN / ARCHITECTURE ONLY. No runtime code is defined, authorized, or changed by this document.
- **Lane:** `design/remote-operator-control-plane` (worktree `E:\aide-remote-operator-architecture`).
- **Base:** `8b2a300ce6b4881bab2ee4b2f6a60fb8538027b5` (`audit/v1-release-closure-matrix`, 2026-09-25).
- **Frozen references:** `docs/v1/COVERT-V1-RELEASE-CLOSURE-MATRIX.md` (176 rows), `docs/v1/COVERT-V1-RELEASE-MATRIX-ADDENDUM-001.md` (ADD-001 ADD-002), `docs/v1/COVERT-V1-RELEASE-CRITICAL-PATH.md`.
- **Machine-readable requirements:** `docs/v1/REMOTE-OPERATOR-RELEASE-ADDENDUM.json`.
- **Companion contracts:** `docs/architecture/REMOTE-INGRESS-CONTRACT.md`, `docs/architecture/DEVICE-AGENT-CONTRACT.md`, `docs/architecture/CAPABILITY-ROUTING-CONTRACT.md`, `docs/architecture/MULTI-MODEL-WORKFLOW-SYNCHRONIZATION.md`, `docs/v1/REMOTE-OPERATOR-V1-BOUNDARY.md`.

Every claim labeled **FACT** is from code read on the base commit; claims labeled **RECOMMENDATION** are engineering decisions of this lane; claims labeled **EXTERNAL** cite documented behavior of named external systems. Status vocabulary: `IMPLEMENTED+VERIFIED` / `IMPLEMENTED+UNVERIFIED` / `PARTIAL` / `DESIGNED ONLY` / `MISSING` / `OWNED BY ANOTHER LANE`.

---

## 1. Product intent and required shape

The operator wants Covert to become the primary control layer over their computer and, eventually, other devices. Remote interfaces (Telegram, mobile, web, CLI, TUI) must submit authenticated intent into the **same** canonical control plane as the local desktop UI. There must be no Telegram authority, desktop authority, mobile authority, or CLI authority — only one Authority.

Required pipeline:

```
interface adapters → ingress contract → Resident/mission creation →
orchestrator/workflow → trust + admission + authority → capability router →
executor (device agent / service connector / development tools) →
harness → veritas → project truth → Resident → operator
```

Non-goals for this lane: no Telegram bot implementation, no mobile app, no device agent, no remote shell, no new authority engine, no Local-Only change, no Workspace Trust change, no Desktop Control change, no cybersecurity tooling. This lane defines contracts, gap analysis, and the release boundary only.

## 2. Current architecture mapping (FACT)

### 2.1 Reusable components

| Layer | Implementation (base) | Status | Key evidence |
|---|---|---|---|
| Authority (prepare/decide/execute) | `node/src/services/execution-authority.mjs` | IMPLEMENTED+VERIFIED | Digest-bound operation descriptors; single-use execution; operator-only decisions; fail-closed audit (`node/src/services/execution-authority.mjs:99-108,221-225,226-316`); `tests/arch/execution-authority.test.ts` |
| Operation policy (risk classes, route enrollment) | `common/security/operation-policy.mjs` | IMPLEMENTED+VERIFIED | `OPERATION_POLICY` kinds `read/write/execute/external/permission/revoke` (`:4-21`); exact `HTTP_POLICY` map (`:25-153`); unknown route denied at `node/src/server.ts:223-224` |
| Route authority coverage accounting | `tests/arch/route-authority-coverage.test.ts` | IMPLEMENTED+VERIFIED | 233 routes: 1 public / 4 authority-control / 134 central / 74 descriptor / 20 waived / 0 conflicting (`artifacts/integration-certification/BATTERY-p1-integration.json:61`) |
| Resource Admission (decision service) | `node/src/services/resource-admission.ts` + `common/contracts/admission.ts` | IMPLEMENTED+VERIFIED (service) / PARTIAL (gate) | Decision `START/QUEUE/REFUSE_RESOURCE`; only callers are readiness probe (`node/src/openapi.ts:710-713`) and the route; model start uses a separate RAM guard (`node/src/services/model-runtime.ts:408-411`); C5-19 |
| Harness bind/execute/record | `node/src/services/agent-loop.mjs`, `node/src/services/hook-executor.mjs`, `node/src/services/audit-trail.mjs` | IMPLEMENTED+VERIFIED | Bind `agent-loop.mjs:751-759`; tool operations `:470-488`; audit bus `.aide/cipher-state.jsonl` (`audit-trail.mjs:90-102`); provenance ledger `.aide/provenance/ledger.jsonl` |
| Veritas | `harness/veritas.mjs`, `harness/run-veritas.mjs`, workflow release gate | IMPLEMENTED+VERIFIED (gate) / PARTIAL (in-product acceptance) | `harness/veritas.mjs:33-54`; agent loop forces `passed:false` (`agent-loop.mjs:661`); affirmative release gate `workflow-service.ts:275-282`; C1-12 |
| Helix memory | `harness/memory-spine.mjs`, `harness/helix-join.mjs`, `harness/helix-retention.mjs`, `node/src/routes/memory.ts` | IMPLEMENTED+VERIFIED | Refresh-on-read cascade `routes/memory.ts:40-80`; `.aide/memory/patterns.jsonl` |
| Context Control | `node/src/services/chat-context.ts` + `harness/scaffold.mjs` | IMPLEMENTED+VERIFIED | Deterministic budgeted composer `chat-context.ts:105-207`; conditional on served context ≥1024 (`:117-119`) |
| Workflow engine | `node/src/services/workflow-service.ts` + `common/contracts/workflow.ts` | IMPLEMENTED+VERIFIED | One durable `state.json` per workspace (`workflow-service.ts:4-6,103`); 6 stages; write-ahead audit; release evidence gate (`:275-282`) |
| Tasks / terminal / PTY / hooks | `node/src/services/task-service.mjs`, `terminal-sessions.ts`, `hook-executor.mjs` | IMPLEMENTED+VERIFIED | Authority-gated, cancelable tasks (`task-service.mjs:1016-1038`); PTY owner checks (`terminal-sessions.ts:217-241`) |
| Desktop Control (native 7 ops) | `node/src/services/desktop-control.mjs` + `owned-process.mjs` | IMPLEMENTED+VERIFIED | Grants/TTL/panic; assertions; exact owned-process discipline (`owned-process.mjs:4-5,45-73`); `tests/arch/desktop-policy.test.ts`, `tests/integration/test-desktop-panic-ownership.mjs` |
| Desktop UIA executor (input/capture/picker/modals) | `node/src/services/windows-uia.mjs` | OWNED BY ANOTHER LANE (branch `feat/covert-desktop-control-v1`, commits `0169ade..3e4cf1a`) | Verified on that lane; not reconciled into this base (C4-20/RELS-03 scope) |
| Telegram transport + authority adapter | `node/src/services/telegram.mjs`, `telegram-brain.mjs`, `node/src/routes/telegram.ts` | PARTIAL overall / adapter IMPLEMENTED+VERIFIED | Outbound long-poll only (`telegram.mjs:180-194`); adapter actor scoped to `['desktop.action']` (`execution-authority.mjs:117-141`); replay guard in-memory; C4-06, C5-09 |
| Provider/BYOK connectors + egress consent | `node/src/services/provider-connections.mjs`, `byok-service.mjs`, `secret-store.mjs` | IMPLEMENTED+VERIFIED | Consent default false (`byok-service.mjs:69-71`); DPAPI secrets (`secret-store.mjs`); `tests/arch/byok-routes.test.ts` |
| Plugin trust + Node-permission sandbox | `plugins/manager.mjs`, `node/src/routes/plugins.ts` | IMPLEMENTED+VERIFIED | Capability enum, trust required before execute, `--permission` flags (`plugins/manager.mjs:5,8-12,65-93`) |
| MCP trust/policy | `workbenches/manager.mjs`, `common/contracts/workbench.ts` | PARTIAL (metadata only) | Install disabled/untrusted; online trust requires egress consent (`workbenches/manager.mjs:332-379`); **no MCP client/runtime exists** |
| Notifications (task-scoped) | `node/src/services/notification-service.mjs`, `node/src/events.ts`, `node/src/routes/notifications.ts` | IMPLEMENTED+VERIFIED | Hook events `task.*` only (`notification-service.mjs:7`); WS channel requires authenticated actor (`events.ts:147-189`) |
| Settings/policy persistence | `node/src/services/settings-service.mjs`, `.aide/` stores | IMPLEMENTED+VERIFIED | `.aide/settings.json`; desktop grants `.aide/desktop/grants.json`; BYOK consent; Telegram chat allowlist |
| Provenance/receipts | `node/src/services/provenance-ledger.ts`, `.aide/provenance/ledger.jsonl`, `/api/mission/receipt` | IMPLEMENTED+VERIFIED / facade-unreachable (C1-02) | Strict run rows; receipt projection |

### 2.2 Missing contracts (the architectural gaps this lane exists for)

| Gap | Frozen row | Status |
|---|---|---|
| Mission entity / state machine / identity / persistence | C2-11 (MISSING — V1.1), C5-23, ADD-001 | MISSING |
| Mission cancellation from any surface | C5-15 (MISSING — V1 REQUIRED) | MISSING |
| Canonical remote ingress envelope and adapter boundary | not in frozen matrix | MISSING |
| Authentication vs authorization separation for remote channels | not in frozen matrix | MISSING |
| Per-capability operator permission model | not in frozen matrix (only risk classes + global desktop grants) | MISSING |
| Device identity / registry / device agent contract | not in frozen matrix (`remote_bridge` health component is always `UNKNOWN`, `health-supervisor.ts:133-139`) | MISSING |
| Capability manifest + routing (executor hierarchy) | C3-12 (MISSING — V1.1; directive: no parallel taxonomy before Capability Fabric) | MISSING |
| Multi-model synchronized workflow (mission DAG, candidates, stale review) | ADD-001 (MATERIAL GAP, P1, V1-required, release-blocking for the multi-model workflow) | MISSING |
| Mission-lifecycle notifications | not in frozen matrix | MISSING |
| Inbound webhook/replay/TLS remote transport | not in frozen matrix | MISSING |
| Remote status aggregation | C3-11 PARTIAL, C1-13 PARTIAL | PARTIAL/MISSING |

### 2.3 Blocking conflicts (must be resolved by design, not patched)

1. **Origin-bound credentials and supervisor-only pairing.** `authenticate` requires `entry.origin === origin` (`execution-authority.mjs:191`); pairings are minted only over private IPC from the interactive supervisor (`scripts/start.mjs:315-324`); the control object is explicitly not an HTTP service (`execution-authority.mjs:13-14`). A remote channel cannot obtain an operator token through the local pairing path. Resolution direction: remote channels are **adapters over private control ports** (like `telegramAdapter`), never HTTP emitters of authority.
2. **Loopback-only listeners, no TLS.** `node/src/server.ts:99,373`, `scripts/facade.mjs:133,300`, `daemon/server.mjs:45,679` all bind `127.0.0.1`. Resolution direction: device-initiated outbound channel (Section 17) rather than opening an inbound listener.
3. **In-memory authority and missions.** `execution-authority.mjs:19-28,169-173`; agent sessions `agent-loop.mjs:250`; pending approvals in-memory; Telegram `lastUpdate` in-memory (C5-09). Resolution direction: durable mission identity/lifecycle is a prerequisite for remote async missions (C2-11) and is scoped V1.1 in the frozen matrix; the contracts in this lane are designed so C2-11 can land without rework.
4. **Hard-scoped Telegram adapter.** The existing adapter is scoped to `['desktop.action']` (`execution-authority.mjs:123`). Resolution direction: a generalized adapter-scope descriptor owned by the ingress contract; never widen the existing binding ad hoc.
5. **Admission is not a gate.** C5-19; `createResourceAdmission` has no start-path callers. Remote starts must be admission-gated; otherwise a remote request can OOM the machine. Resolution direction: V1.1 implementation obligation on every remote-triggered start.
6. **No mission cancellation.** C5-15. A remote "stop that mission" has no canonical target. Resolution direction: Section 12 defines the control operation; the C5-15 implementation is V1-required independent of remote.
7. **Capability taxonomy freeze.** C3-12 directive: "Do not create parallel states before the Fabric decision." Resolution direction: adopt `CAPABILITY-FABRIC-DISPOSITION.md` taxonomy as the single taxonomy; the router consumes it.
8. **Receipt reachability.** `/api/mission/receipt`, `/api/provenance/*`, `/api/resource/admission`, `/api/readiness` are facade-unmapped (C1-02). Remote status/receipt answering must not depend on unreachable routes; mapping them is a C1-02 obligation, not a new subsystem.

## 3. Ownership doctrine validation (FACT)

| Doctrine | Code verdict | Evidence |
|---|---|---|
| Context Control → COMPILES | SUPPORTED | Deterministic budgeted composer; `chat-context.ts:105-207`, `harness/scaffold.mjs:1-3,65-136`; conditional gating `:117-119` |
| Orchestrator → ASSIGNS | PARTIAL | `harness/orchestrator.mjs:36-108` assigns provider roles but is orphaned from the server (C1-11); no profile/benchmark input; trace is in-memory |
| Resource Admission → ADMITS | PARTIAL | Decision service verified; not a gate on model/training/agent start (C5-19) |
| Authority → PERMITS | SUPPORTED | `execution-authority.mjs` full contract |
| Harness → BINDS + EXECUTES + RECORDS | SUPPORTED | Bind `agent-loop.mjs:751-759`; records audit/trajectory/verification/provenance |
| Veritas → ACCEPTS | PARTIAL | Acceptance real only via CLI + workflow release gate; agent loop never self-accepts (`agent-loop.mjs:661`; C1-12) |
| Helix → PRESERVES VERIFIED TRUTH | PARTIAL | Preserves deterministic work aggregates; verified/asserted ranking lives in `memory-recall.mjs:138-167`; no truth class on Helix artifacts |

**Conclusion:** the control plane can be built on these layers without replacing them. Three layers need intentional strengthening before remote operation is truthful: Orchestrator assignment (C1-11 + ADD-001), Admission-as-gate (C5-19), and Veritas in-product acceptance (C1-12). None of them may be replaced by the remote lane.

## 4. Target pipeline (RECOMMENDATION)

```
operator
  ├── local desktop UI ──┐
  ├── CLI / TUI ─────────┤
  ├── Telegram adapter ──┤ (outbound poll / outbound channel)
  └── mobile / web ──────┘
                         ↓  authenticated ingress envelope (request_id, channel, actor, device)
                  ingress normalizer (per-adapter, no authority logic)
                         ↓  resume-or-create mission (Resident/mission layer)
                  mission record (durable identity, obligations, state)
                         ↓
                  orchestrator/workflow engine (owns transitions; C1-11 + ADD-001)
                         ↓
                  trust + admission + authority (prepare → decide → execute)
                         ↓
                  capability router (manifest + policy + device + health)
        ┌──────────────┼───────────────────┬───────────────┐
        ↓              ↓                   ↓               ↓
   native Covert   typed connector      MCP (future)   CLI/terminal
   capability      (email/provider)                    browser (future)
        ↓                                               ↓
        └───────────────────────────────────→ Desktop Control (GUI fallback)
                         ↓
                  harness bind + execute + record
                         ↓
                  veritas accept (release gate / CLI)
                         ↓
                  project truth (workflow state, provenance, verifications, audit)
                         ↓
                  Resident reports canonical state only
                         ↓
                  notification contract → channel adapters
```

Rules:
- No interface talks to an executor directly. Desktop Control is reached only through the canonical router after Authority (Section 15).
- A message arriving through Telegram becomes `authenticated ingress → normalized operator request → mission/Rresident → Authority → workflow → execution`. It never becomes `Telegram message → shell command`.
- Channel adapters own transport concerns only: authentication of the channel account, normalization, dedupe, rate limits, sanitized logging, delivery of canonical notifications. They own no mission logic, no authority logic, no model selection, no desktop logic.

## 5. Remote ingress (summary)

Defined in `docs/architecture/REMOTE-INGRESS-CONTRACT.md`. Core positions:
- One generic `RemoteIngressEnvelope`; adapters fill it; the normalizer maps it onto existing canonical identities (`workspace`, `task_id`, operation descriptor) — no second identity system.
- `request_id` is a dedupe identity, never authority. Deterministic derived `task_id` namespaces remote intents (`remote:<channel>:<account>:<message>`), matching the existing `telegram:<actor>:<updateId>` precedent (`execution-authority.mjs:200-206`).
- The envelope's intent kinds are bounded: `status_query`, `mission_start`, `mission_control`, `capability_invoke`, `approval_response`. Free text is normalized by the existing model/agent path, not parsed into shell.
- Ingress never executes. It only creates or advances canonical operations.

## 6. Authentication vs authorization (FACT + RECOMMENDATION)

Separation is real in code today and must be preserved:
- **Authenticated** means a paired actor proof exists (`authenticate`, `execution-authority.mjs:188-194`) or an adapter binding is live (`telegramAdapter`, `:117-141`).
- **Authorized** means `prepare → decide → execute` produced an exact, digest-bound operation (`:226-316`). `.read` risk auto-approves; `write/execute/external` require an operator decision; `permission/revoke` are privileged classes.
- A known chat account is **channel authentication only**. It does not create an actor. The Telegram adapter requires an operator-approved `authority.grant` before an adapter actor exists (`:118-124`), and that actor's scope is a fixed list.
- RECOMMENDATION: introduce an `auth_level` dimension on the envelope (`channel_allowlisted < operator_paired < device_attested < strong`) and a policy rule that consequential capability classes require `strong` (device-attested or second-factor) or an explicit per-operation decision. A compromised chat account must never equal unrestricted workstation control.
- RECOMMENDATION: Step-up authentication for high-consequence classes (Section 20) is local confirmation (desktop approval long-poll already exists: `node/src/routes/desktop.ts:105-145`), or device-attested proof from the device agent.

## 7. Permission model (RECOMMENDATION; no code in this lane)

A capability-scoped policy profile per operator, consulted before preparation, not instead of Authority. Reuse `OPERATION_POLICY` risk classes as the backbone.

Autonomy modes (illustrative names; map to policy verbs):

| Mode | Meaning |
|---|---|
| DENY | capability never available, locally or remotely |
| ASK_EVERY_TIME | always require an operator decision (default for write/execute/external) |
| ALLOW_LOCALLY | allowed only from local channels; remote channels are refused |
| ALLOW_REMOTELY | allowed from authorized remote channels |
| ALLOW_WITH_BOUNDS | allowed within declared bounds: device, workspace, target allowlist, time window, rate, budget |
| OWNER_PREAUTHORIZED | standing approval for a named capability/class within a recorded policy version and expiry |

Rules:
- Per-capability, not global: `email.read` ≠ `email.send` ≠ `email.delete`; `filesystem.read` ≠ `filesystem.write`; `terminal.execute` ≠ `terminal.elevated`; `mission.cancel` is its own permission; `device.inspect` ≠ `device.control`.
- Broad permission ≠ Authority bypass. Even OWNER_PREAUTHORIZED operations must produce: request identity, Authority decision row, attempt identity, execution record, verification, receipt.
- The policy engine may only narrow or pre-approve within Authority; it can never mint operations, widen scopes, or skip audit. `permission` and `revoke` classes (`desktop.grants`, `authority.grant`, `desktop.panic`, `telegram.disconnect`) are never delegable (`execution-authority.mjs:153`).
- Policy changes are themselves governed writes (`capability.write`) with digest binding, like today's `PUT /api/settings` and desktop grants.
- Persistence location is a V1.1 implementation decision (candidate `.aide/remote/policy.json`); this lane does not create a parallel store. Until it exists, remote adapters stay scoped to explicit operator-approved capability grants (today's Telegram model).

## 8. Capability routing (summary)

Defined in `docs/architecture/CAPABILITY-ROUTING-CONTRACT.md`. Core positions:
- Preferred executor hierarchy: native Covert capability → typed service/API connector → MCP → CLI/terminal → browser automation → Desktop Control GUI automation.
- Routing is a decision, not an accident: the router records a `routing_decision` with the candidate set, filters (capability state, policy, device, trust, health, qualification), the selected executor, and the reason. Fail-closed when no authorized candidate exists.
- Desktop Control is the universal fallback, never the default. Example: "check my email" prefers a typed email connector; GUI automation of a mail client is chosen only when no qualified connector exists and policy permits GUI fallback.
- The router does not exist today; C3-12 forbids a parallel taxonomy. The router is scoped V1.1 and must consume the Capability Fabric manifest (`artifacts/integration-certification/CAPABILITY-FABRIC-DISPOSITION.md`).

## 9. Device agent (summary)

Defined in `docs/architecture/DEVICE-AGENT-CONTRACT.md`. Core positions:
- A device has a stable identity (`device_id`), enrollment approved by an operator operation, a keypair protected by OS facilities (DPAPI/TPM on Windows), and a manifest of capabilities and state it can truthfully report.
- The agent is an executor/state provider under the control plane. It is never a second orchestrator, never mints authority, never judges completion, and never stores canonical project truth.
- Devices are typed for authorization: OWNER (full), BOUNDED, INGRESS/NOTIFICATIONS, DEVELOPMENT.
- Remote authorization must not trust a workspace. Workspace Trust and operator identity remain separate; remote requests cannot promote an untrusted workspace (Section 19).

## 10. Asynchronous missions and persistence (FACT + RECOMMENDATION)

FACT: no mission entity exists (C2-11; strongest fact: agent sessions are an in-memory `Map`, `agent-loop.mjs:250`, trajectory written only at terminal state `:613-621`). Workflow state is durable (`.aide/workflow/state.json`), handoffs/continuations are durable, but live mission state is not.

RECOMMENDATION: define the mission as the durable, addressable unit:
- `mission_id` stable; created by an ingress-issued operation; bound to workspace, owner, policy version, objective digest.
- State machine: `CREATED → RUNNING → {AWAITING_APPROVAL | BLOCKED} → {COMPLETED | PARTIAL | FAILED | CANCELLED}`; transitions owned by the workflow/orchestrator engine (ADD-001 invariant).
- Durability requirement: mission record, obligations, and pending approval references survive restart. Current accepted limitation C5-08 ("in-memory authority does not survive restart; short TTLs") is not sufficient for remote async missions; that is why C2-11 is a remote prerequisite (V1.1).
- Remote status questions must be answerable from durable state, not from Resident chat context or a live WebSocket.

## 11. Remote status (RECOMMENDATION)

Canonical answer sources:
- mission/attempt state: mission store (to be created, C2-11) + provenance runs + continuations/handoffs
- workflow stage: `.aide/workflow/state.json`
- tasks/training/downloads: their services' status surfaces (in-memory today; must be either quoted as live-only or persisted for remote)
- model identity/runtime: model runtime status + engine PID map (`.aide/model-engines.json`)
- resource state: resource admission evidence (must be admitted as a probe result, not a claim)
- blockers: mission obligations + pending approvals + admission refusals + failed verifications
- verification: `.aide/verifications/*.verification.json`

Rule: an answer is a projection over canonical state with a `as_of` timestamp and explicit `unknown` where truth is absent. Resident must not infer activity from chat history.

## 12. Remote cancellation (C5-15, RECOMMENDATION)

"Stop that mission" is a canonical control operation, never a text sent to the running model.

Semantics:
```
cancel requested (operation: mission.cancel, digest-bound)
→ stop new dispatch (orchestrator refuses new attempts for the mission)
→ cancel safely interruptible owned attempts (cooperative cancel token; process kills only via retained owned handles, owned-process discipline)
→ allow atomic/non-interruptible action to settle (bounded grace, e.g. in-flight file write/commit)
→ capture current state (obligations, attempts, artifacts, verification state)
→ preserve completed work (never delete; artifacts remain referenced)
→ mark remaining obligations
→ final state CANCELLED / PARTIAL / FAILED as applicable, with receipt
```

Today: tasks have a real cancel (`task-service.mjs:1016-1038`), handoffs/downloads have cancel, training stop exists but is unverified, and an agent mission cannot be canceled at all (C5-15). The mission cancellation implementation is V1-required by the frozen matrix and is a prerequisite for remote cancellation; the remote lane consumes it.

## 13. Notifications (RECOMMENDATION)

One canonical outbound event contract; channel adapters deliver. Current notification service is task/hook-scoped (`notification-service.mjs:7,209-254`); mission lifecycle events do not exist.

Event set (minimum): `mission.created`, `mission.approval_required`, `mission.blocked`, `mission.progress_summary` (rate-limited), `mission.completed`, `mission.failed`, `mission.cancelled`, `verification.failed`, `device.offline`, `device.online`, `runtime.unavailable`, `security.event` (auth failure, replay rejection, scope escalation refusal).

Rules: events carry ids and digests only (no secret content); delivery is adapter concern; a missed delivery never changes mission truth; duplicate deliveries are idempotent for the adapter (dedupe by `event_id`).

## 14. Email / account operations (RECOMMENDATION, reference integration)

Capability distinctions (not one binary `email` permission): `email.search`, `email.read`, `email.draft`, `email.send`, `email.delete`, plus `email.attachments.read` if ever needed. `send`/`delete` are consequential (per-operation decision or device-attested confirmation); `search`/`read` may be `ALLOW_WITH_BOUNDS`.

Today: no email/calendar connector exists; the only mail surface is the Outlook COM draft op (`desktop-control.mjs:131-156`, drafts only, never sends; requires classic Outlook). Classification: MISSING connector; PARTIAL desktop fallback.

No real account is connected, and no message is sent in this lane.

## 15. Desktop Control relationship (FACT + RULE)

FACT: Desktop Control is a bounded, authority-gated native service with grants, TTL, panic, assertions, and exact owned-process discipline (`desktop-control.mjs`, `owned-process.mjs`). The UIA executor (input/capture/picker/modals) is verified on the Desktop Control lane and is not in this base.

RULE: `Remote Operator ≠ Desktop Control`. Remote Operator chooses and governs capabilities; Desktop Control performs semantic local GUI operations when selected by the router. Required chain:

```
remote request → canonical mission → Authority → capability selection →
Desktop Control → exact owned window/process → UI action → verification → receipt
```

No remote interface may talk to the Desktop Control adapter directly, and no remote channel may be granted a desktop adapter scope wider than the policy allows. The existing Telegram adapter scope (`desktop.action`) is the narrow precedent, not the target scope model.

## 16. Telegram reference adapter (DESIGNED ONLY in this lane; no implementation)

The existing Telegram transport is the substrate: outbound long-poll, durable spool before handling, chat allowlist, DPAPI token, authority-bound adapter, exact `YES/NO <operation_id>` confirmation (`telegram.mjs:180-194`; `execution-authority.mjs:117-141,200-220`).

The future adapter boundary must:
- associate the operator (existing operator-approved binding), never infer identity from the chat alone
- normalize each accepted message into the `RemoteIngressEnvelope`
- reference attachments (bot file ids resolved by the transport), never inline secrets
- submit the envelope to the canonical ingress normalizer; receive `request_id`/mission id
- deliver canonical notifications (outbound) and support approval prompts where policy allows
- expire/reject stale requests (envelope expiry + monotonic update id)
- prevent replay (persistent `update_id` dedupe — fixes C5-09; the in-memory guard is insufficient)
- rate limit per chat and per operator
- log sanitized metadata (ids, lengths, decisions; never message bodies or tokens)
- **not** store Authority logic, mission scheduler logic, desktop-control logic, or model-selection truth

Implementation is NOT authorized by this lane.

## 17. Connection / host model (RECOMMENDATION)

Options evaluated:

| Class | NAT/firewall | Security | Offline behavior | Operator privacy | Self-host | Verdict |
|---|---|---|---|---|---|---|
| Direct inbound listener | Requires port-forward/public bind | Highest exposure; needs TLS + auth + rate limiting; violates loopback-only posture | Works on LAN only | Poor if exposed | Yes | Rejected for V1.1 |
| Outbound persistent channel (device → relay or device → operator endpoint) | Traverses NAT; no open port | Device-authenticated, TLS; relay sees ciphertext only if E2E designed | Device queues locally while offline | Good with self-hosted relay | Yes | RECOMMENDED |
| Telegram polling (existing) | No inbound; Telegram is the relay | Depends on Telegram account security + adapter binding | Machine offline → no processing; messages queue at Telegram | Telegram sees message content | No (external provider) | RECOMMENDED for the first remote ingress (V1.1), explicitly consent-gated |
| Provider webhook | Needs public endpoint or provider tunnel | Signature verification required; replay protection required | Missed webhooks must be reconciled | Provider sees content | No | Future option for account connectors |
| VPN/private network | Operator-managed | Strong if properly configured | LAN/VPN only | Good | Yes | Supported deployment option, not a product feature |

RECOMMENDATION: device-initiated outbound connections only; the canonical source of truth remains the local workspace (`.aide/` stores) and the local Authority. If a cloud relay is ever added, it must be replaceable/self-hostable, must not hold project truth, must not hold operator credentials, and must be disabled entirely under Local-Only.

## 18. Local-Only relationship (RECOMMENDATION)

Local-Only doctrine is owned by the P0 lane (`fix/v1-p0-egress-local-only`); this lane does not modify it.

Expected semantics:
- Local-Only ON → remote ingress and remote egress are unavailable. The machine may still accept explicitly local/private-network channels (localhost, optionally operator-declared LAN) if policy defines them; cloud relays and Telegram are disabled.
- The gate belongs at the adapter boundary and the egress layer, not inside Authority. Authority continues to permit or deny operations; Local-Only prevents the channel/connector from existing or transmitting at all, and must be reported truthfully (`remote_bridge: OFF — local-only`).
- Remote requests already accepted but not yet executed when Local-Only is enabled must settle truthfully: pending operations expire/reject; no silent execution after the mode change.

## 19. Workspace trust relationship (RECOMMENDATION)

Workspace Trust is owned elsewhere; this lane defines the interaction only:
- Remote authorization must not automatically trust a workspace. A remote "run this repository" for an untrusted workspace results in a truthful `BLOCKED — workspace untrusted` state with a local approval path.
- Trust is a property of the workspace (local fact), not of the channel or operator. Operator identity, device identity, and channel identity never elevate workspace trust.
- The remote status answer must expose workspace trust state alongside mission state.

## 20. High-consequence actions (RECOMMENDATION)

Policy classes (not blanket prohibitions):
- **CLASS A (privileged control):** admin/elevation, security-setting changes, credential export/deletion, remote software installation, device wipe/shutdown (future), Authority policy changes. Require `strong` auth + per-operation decision; never OWNER_PREAUTHORIZED-only; never remotely reachable without device attestation.
- **CLASS B (irreversible external):** email send, external publication, financial/commerce operation, mass file deletion, force push. Require per-operation decision unless OWNER_PREAUTHORIZED with explicit bounds; receipts mandatory.
- **CLASS C (bounded write):** filesystem write, git commit, desktop control actions within grants, mission start. ASK_EVERY_TIME default; ALLOW_WITH_BOUNDS acceptable.
- **CLASS D (read/observe):** status, file read, device inspect, email search. ALLOW_REMOTELY acceptable.

Authority remains the canonical owner of permission; these classes feed the policy model, not a second enforcement engine.

## 21. Idempotency / duplicate messages (RECOMMENDATION)

Remote systems retry; duplicates are normal. Requirements:
- Every ingress request carries a channel-unique `request_id` (Telegram: `update_id`; webhook: provider event id; mobile: client-generated UUID + device id).
- The ingress normalizer maintains a durable dedupe ledger keyed by `request_id` → `{task_id, operation_id, state}`. First delivery wins; duplicates return the recorded state without re-execution.
- Authority already provides last-line defense: digest-bound, single-use operations (`execution-authority.mjs:221-225,286-316`). Dedupe at ingress prevents duplicate *missions*; Authority prevents duplicate *executions*.
- Reconciliation-before-retry: after a transport error, the adapter queries mission/operation state before resending.
- Concrete guarantees: a duplicated Telegram message must not send two emails, make two commits, start two missions, or delete twice.

## 22. Offline / reconnect (RECOMMENDATION)

- Laptop offline: missions do not run; ingress queues at the channel if supported (Telegram retains updates); upon reconnect the adapter drains with per-message dedupe.
- Phone offline: notifications queue at the channel adapter; mission truth unaffected.
- Remote channel offline: missions continue locally; status is discovered on reconnect.
- Covert restart: durable mission store is the recovery source; in-flight attempts are reconciled (`RUNNING` with no live worker → `INTERRUPTED`/`BLOCKED` with recovery options); pending approvals expire by TTL and are re-proposed, never silently executed.
- Network change/sleep/wake: device agent reconnects with its device identity; duplicate deliveries are deduped; ordering is not assumed, only monotonic per-channel ids.
- Duplicate delivery after reconnect: reconciled by the dedupe ledger, never by re-execution.

## 23. Audit / receipts (RECOMMENDATION)

Required chain for every remote operation:

```
operator identity → ingress channel + request_id → normalized request →
Authority decision (operation_id, digest, approver) → capability chosen (routing_decision) →
target device → mission_id → attempt_id → model identity → tool/capability →
external side effect (or explicit "none") → verification ref → receipt → notification ref
```

Reuse: Authority audit rows (identities/digests only, `audit-trail.mjs:105-112`), provenance ledger, workflow transitions, egress journal. Additions needed: routing decision rows, mission/attempt identity (C1-14/C5-23), device id dimension. Secret content is never logged; bodies are referenced by digest.

## 24. Model / workflow synchronization (summary)

Defined in `docs/architecture/MULTI-MODEL-WORKFLOW-SYNCHRONIZATION.md`. It answers ADD-001 directly: mission DAG, transition ownership, immutable candidate identity, stale review invalidation, bounded repair loop, worker death/reassignment, parallel worker barriers, Authority and Admission per transition, human approval boundary, and Resident completion reporting. The release addendum rows `REMOTE-REQ-*` cross-reference ADD-001 and the frozen matrix; a formal release addendum (machine-readable) is produced by this lane.

## 25. V1 / V1.1 / future summary

Defined in `docs/v1/REMOTE-OPERATOR-V1-BOUNDARY.md`. Headline: remote operation is **V1.1+**, architecture-only in V1; the V1 obligations this lane attaches to the frozen matrix are the mission cancellation semantics (C5-15), long-horizon contract remote clauses (C7-30), and workflow synchronization (ADD-001), plus the non-blocking guarantee that the contracts above are the ones V1.1 implements.

## 26. Threat / failure analysis (bounded)

| Threat/failure | Required behavior | Anchor |
|---|---|---|
| Stolen Telegram session | Channel is allowlisted config, not authority; adapter binding is operator-approved and scoped; consequential classes need step-up/per-op confirmation; attacker cannot mint actors or widen scope | `execution-authority.mjs:117-141`; Section 6 |
| Stolen phone | Device-attested level unavailable → consequential actions require local confirmation; notifications may still flow | Section 6/20 |
| Replayed remote command | Monotonic per-channel ids + durable dedupe ledger + Authority single-use | Sections 21; `:131-133,221-225` |
| Duplicate webhook/message | Execute once; duplicates return recorded state | Section 21 |
| Wrong device target | Device identity in envelope must match target; mismatch denied before preparation | Section 9/ingress |
| Device offline | Truthful `BLOCKED — device offline`; no substitution of another device, no silent queue-forever | Sections 11/22 |
| Device sleeps mid-mission | Mission state `INTERRUPTED` on reconnect; no false completion; attempts reconciled | Section 22 |
| Agent/worker crashes | Attempt marked failed; bounded continuation/reassignment owns recovery (existing continuation manager) | Sections 10/24; C7-16 |
| Resident crashes | Mission state must not depend on Resident process memory | Section 10 |
| Model crashes | Attempt failure is a state, not a mission loss; no silent model substitution without recorded routing decision | Sections 8/24 |
| Network drops | Queue/dedupe/reconcile; truth local | Section 22 |
| Stale capability manifest | Router refuses to select unqualified/stale capabilities for consequential classes; health must be honest (`UNKNOWN` stays `UNKNOWN`) | Section 8; `CAPABILITY-FABRIC-DISPOSITION.md:7` |
| Stale Authority decision | Operations expire (TTL); changed args rejected; expired approval cannot execute | `execution-authority.mjs:290-292` |
| Credential unavailable | Typed refusal; no fallback to plaintext; no partial execution | `secret-store.mjs:28` |
| Workspace untrusted | `BLOCKED — workspace untrusted`; remote cannot promote trust | Section 19 |
| Local-Only enabled | Remote adapters unavailable; truthfully reported; pending work settles | Section 18 |
| Malicious email/web content | All remote/ingested content is DATA, never instructions; capability invocation requires Authority; prompt-injection boundary already established by the harness | Existing harness doctrine + Section 6 |
| Exceeding approval scope | Digest mismatch / scope denial; scope can never include permission/revoke classes | `execution-authority.mjs:290,153` |
| Two devices, conflicting requests | Canonical mission store serializes state transitions; Authority binds each operation; conflict surfaces as state rejection, not last-writer-wins | Sections 10/24 |
| Cancel during consequential action | Cooperative cancel; non-interruptible action settles within bounds; final state CANCELLED/PARTIAL with receipt | Section 12 |

## 27. Proof requirements for future implementation

No implementation is authorized now. These are the acceptance tests required when each capability is implemented (ids are stable for the release addendum):

| ID | Acceptance condition |
|---|---|
| REMOTE-001 | Authenticated remote status query returns canonical mission/device state with `as_of` and explicit unknowns |
| REMOTE-002 | Unauthenticated/unknown-channel request is denied before any preparation, with a sanitized receipt |
| REMOTE-003 | Authorized read-only remote mission runs end-to-end through Authority and returns verified results |
| REMOTE-004 | Consequential action requires the correct policy class; denial is typed and auditable |
| REMOTE-005 | Duplicate request (same `request_id`) executes once; the duplicate returns recorded state |
| REMOTE-006 | Stale/expired/replayed request is denied; no side effect; evidence row written |
| REMOTE-007 | Wrong-device substitution is denied; target device identity is bound in the envelope and operation |
| REMOTE-008 | Device offline yields truthful `BLOCKED` state; no substitution, no false success |
| REMOTE-009 | Mission continues after the remote client disconnects; status is recoverable on reconnect |
| REMOTE-010 | Remote cancellation produces canonical CANCELLED/PARTIAL state with preserved completed work |
| REMOTE-011 | Desktop Control is invoked only through the canonical router + Authority; no direct adapter path exists |
| REMOTE-012 | Local-Only ON blocks prohibited ingress/egress and reports the state truthfully |
| REMOTE-013 | An untrusted workspace does not gain trust from a remote request |
| REMOTE-014 | Worker crash mid-attempt is detected, the attempt is failed, and reassignment/continuation is bounded and recorded |
| REMOTE-015 | Verified completion emits a canonical notification; delivery failure does not change truth |
| REMOTE-016 | Receipt chain reconstructs operator → channel → request → mission → attempt → capability → device → verification |

## 28. External reference points (EXTERNAL)

- Telegram Bot API: long polling via `getUpdates` with `offset` acknowledgement; updates carry monotonic `update_id`; webhook mode requires a public HTTPS endpoint and supports a secret token header. (core.telegram.org/bots/api)
- Replay/idempotency practice for webhooks: verify provider signatures, dedupe on provider event id, reconcile before retry, and never assume ordering. (OWASP Web Security Testing Guide / general webhook hardening guidance)
- Windows credential protection: DPAPI `CurrentUser` scope is the existing mechanism for at-rest secrets in this repository (`secret-store.mjs:5-22`); future device keys should prefer TPM-backed keys where available.

These are cited as documented external behavior; they are not repository facts.

## 29. Open decisions (require operator/owner input)

1. Remote capability class taxonomy: adopt `CAPABILITY-FABRIC-DISPOSITION.md` verbatim (recommended) or define a mapping from the brief's seven suggested state words. C3-12 forbids a second taxonomy.
2. Mission persistence scope in V1.1: minimal lifecycle durable vs full transcript durability (C2-11). Recommendation: lifecycle + obligations durable; transcripts remain session-level artifacts referenced by digest.
3. Channel choice for first remote ingress: Telegram (existing substrate) vs new outbound relay. Recommendation: Telegram first, explicitly consent-gated and Local-Only aware.
4. Device identity root: DPAPI-protected key vs TPM-backed key vs both with capability detection.
5. Email connector target: provider API (OAuth) vs IMAP/SMTP vs desktop COM. Recommendation: provider API behind a typed connector, with desktop COM remaining a fallback.
