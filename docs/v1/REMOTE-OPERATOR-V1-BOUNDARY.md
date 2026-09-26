# Remote Operator V1 Boundary

- **Status:** RELEASE BOUNDARY (design). No implementation is authorized by this document.
- **Parent:** `docs/architecture/REMOTE-OPERATOR-CONTROL-PLANE.md`.
- **Frozen baseline:** `8b2a300ce6b4881bab2ee4b2f6a60fb8538027b5` with `docs/v1/COVERT-V1-RELEASE-CLOSURE-MATRIX.md` (176 rows) and `docs/v1/COVERT-V1-RELEASE-MATRIX-ADDENDUM-001.md`.
- **Machine-readable rows:** `docs/v1/REMOTE-OPERATOR-RELEASE-ADDENDUM.json`.

## 1. Decision principle

The boundary below is the smallest truthful split that does not architecturally block the product vision. It does not adopt the illustrative V1/V1.1/future split from the product brief blindly. Two repository facts drive it:

1. Remote operation requires a durable mission entity (C2-11) and remote mission cancellation requires a canonical target (C5-15). C2-11 is classified **V1.1** in the frozen matrix; C5-15 is **V1 REQUIRED**. Therefore V1 cannot truthfully claim remote missions, and V1.1 cannot land remote missions before C2-11 and C5-15 are implemented.
2. The multi-model workflow synchronization gap (ADD-001) is already recorded as **P1, V1-required, release blocking for the multi-model workflow**. Remote operation must consume that contract, not invent a parallel one.

Consequence: **remote operation is V1.1+; V1 is architecture-only for this capability.** V1 ships the contracts and the non-blocking guarantees; V1.1 implements the runtime in the order below.

## 2. V1 REQUIRED (release-blocking obligations attached by this lane)

| ID | Obligation | Owner | Frozen row / reference |
|---|---|---|---|
| REMOTE-V1-01 | No V1 artifact claims remote operation, remote ingress, device agents, or mobile support. Release wording and claim guards reflect V1.1 scoping. | RELEASE | C4-19 claim-guard discipline |
| REMOTE-V1-02 | Canonical mission identity and cancellation semantics are defined and implemented for in-process missions (the existing V1-required C5-15), with a contract that remote clients can bind to without redesign. | RELIABILITY / CORE | C5-15 (MISSING — V1 REQUIRED) |
| REMOTE-V1-03 | Long-horizon contract (C7-30) includes the remote interruption/resume/reconnect clauses from the control-plane doc (Sections 22-23). | RELEASE | C7-30 (MISSING — V1 REQUIRED) |
| REMOTE-V1-04 | Multi-model workflow synchronization contract (`docs/architecture/MULTI-MODEL-WORKFLOW-SYNCHRONIZATION.md`) is adopted as the typed interface for ADD-001; implementation remains CORE/WORKFLOW-ORCHESTRATOR. | CORE / WORKFLOW-ORCHESTRATOR | ADD-001 |
| REMOTE-V1-05 | Remote, ingress, device, and capability contracts are frozen in `docs/architecture/` and referenced by the V1.1 plan, so V1.1 does not rework V1. | CORE | this lane |
| REMOTE-V1-06 | Desktop Control remains executor-only and safely callable through the canonical Authority path; no remote interface receives direct adapter access. | DESKTOP-CONTROL-LANE / CORE | C4-16; C4-20/RELS-03 handoff |
| REMOTE-V1-07 | Local-Only semantics include remote ingress/egress unavailability, owned by the P0 lane; this lane supplies the requirement only. | P0 (owner), CORE (consumer) | C4-02/C4-04; `fix/v1-p0-egress-local-only` |
| REMOTE-V1-08 | No second authority, second mission identity, second capability taxonomy, or channel-specific permission engine is created anywhere. | CORE | C3-12 directive; `CAPABILITY-FABRIC-DISPOSITION.md` |

V1 does **not** require: any listener beyond loopback, any remote credential, any device agent, any Telegram change, any mission store beyond the C5-15 cancellation target, any capability router runtime.

## 3. V1.1 / NEAR TERM (implementation order)

Ordered by dependency; each item lists its precondition.

| ID | Item | Preconditions | Frozen rows |
|---|---|---|---|
| REMOTE-V11-01 | Mission entity + durable lifecycle (identity, state, obligations, transition journal) | REMOTE-V1-02 semantics; CORE owner | C2-11 (MISSING — V1.1), C5-23, C7-30 |
| REMOTE-V11-02 | Mission cancellation full semantics for agent missions (cooperative cancel, settle, receipts) | REMOTE-V11-01 | C5-15, C5-11/C5-12 (hung-call aborts) |
| REMOTE-V11-03 | Resource Admission as a gate on model/training/agent/worker starts | none beyond decision service | C5-19 |
| REMOTE-V11-04 | Durable ingress dedupe ledger + persistent Telegram `update_id` offset | mission store (for reconciliation) | C5-09 |
| REMOTE-V11-05 | Telegram remote ingress adapter over the frozen envelope (consent-gated, Local-Only aware; no scope wider than policy) | REMOTE-V11-04; REMOTE-V1-07 semantics | C4-06 journaling |
| REMOTE-V11-06 | Remote status projection (canonical state with `as_of` and explicit unknowns) | REMOTE-V11-01; C1-02 route reachability | C1-02, C1-13, C3-11 |
| REMOTE-V11-07 | Remote mission start/cancel control operations | REMOTE-V11-02; REMOTE-V11-06 | C5-15 |
| REMOTE-V11-08 | Canonical mission-lifecycle notifications + one adapter delivery path | REMOTE-V11-01; notification service extension | new (no frozen row) |
| REMOTE-V11-09 | Windows device agent per `docs/architecture/DEVICE-AGENT-CONTRACT.md` (outbound channel, device identity, capability manifest) | REMOTE-V11-01; key protection decision | new |
| REMOTE-V11-10 | Capability router runtime consuming the Capability Fabric taxonomy | Fabric v0.1 (registered next bounded v1 extension); REMOTE-V11-09 for device scope | C3-12 |
| REMOTE-V11-11 | Bounded email/service connector (typed capability, CLASS B policy for send/delete) | REMOTE-V11-10; operator consent | new; C4-05/C4-06 |

V1.1 must not expose a non-loopback listener for its own sake; the Telegram path remains outbound polling, and the device agent uses a device-initiated outbound channel.

## 4. FUTURE (architecture must not block)

- Covert mobile application (owner/ingress device class); Android/iOS device agents; multi-machine fleet.
- Dedicated Covert operating environment / OS direction: the control-plane contracts are OS-agnostic; device identity, capability manifest, and executor boundary carry over.
- Specialized editions and capability packs (e.g. Covert Cybersecurity, bug bounty, authorized penetration-testing workflows). This lane defines extension boundaries only and designs no offensive tooling. Extension surfaces: capability packs, workflow packs, skill packs, policy profiles, tool adapters, device adapters. No edition may fork Authority, Resident, the orchestrator, or project truth.
- MCP runtime, browser-automation executor, provider webhook mode, E2E relay.

## 5. What V1 must never do (anti-claims)

- Ship a non-loopback bind without TLS, device identity, replay defense, and rate limits.
- Let a chat account (Telegram or otherwise) imply workstation control, even with OWNER-preauthorized policy.
- Derive a remote command from free text without the proposal → Authority path.
- Add a second permission engine, taxonomy, mission identity, or audit chain.
- Grant any remote channel an adapter scope wider than policy; `desktop.action` remains the narrow precedent.
- Persist remote adapter bindings to workspace files (base rule: bindings are in-memory and operator-minted, `node/src/services/telegram.mjs:220-222`).
- Claim that Local-Only permits remote operation, or that remote operation bypasses Workspace Trust.

## 6. Exit conditions

The boundary is satisfied when:
1. every `REMOTE-V1-*` obligation above has an owner, a row in `REMOTE-OPERATOR-RELEASE-ADDENDUM.json`, and no implementation claim beyond its state;
2. the contracts referenced in REMOTE-V1-05 are committed and validated;
3. C5-15, C7-30, and ADD-001 remain visible as release-blocking at their recorded priorities, with the remote clauses attached;
4. a V1.1 plan exists that sequences REMOTE-V11-01..11 with the preconditions stated here.

## 7. Open decisions

1. Whether REMOTE-V11-01 (mission store) lands before or together with REMOTE-V11-09 (device agent). Recommendation: mission first; the agent reports mission observation only.
2. Whether remote status is served from the local facade port only (recommended) or through the device channel as well.
3. Whether the first device agent covers Windows only (recommended) with the Linux development device defined but not implemented.
