# Remote Ingress Contract

- **Status:** DESIGN / CONTRACT ONLY. No runtime code is authorized by this document.
- **Parent:** `docs/architecture/REMOTE-OPERATOR-CONTROL-PLANE.md`.
- **Canonical owner:** the canonical Authority (`node/src/services/execution-authority.mjs`) for all permission decisions; the ingress layer owns normalization and dedupe only.
- **Frozen references:** `docs/v1/COVERT-V1-RELEASE-CLOSURE-MATRIX.md` (C1-14 request/attempt identity, C4-06 egress journal, C5-08/C5-09 idempotency, C7-30 long-horizon contract); `docs/v1/REMOTE-OPERATOR-RELEASE-ADDENDUM.json`.

## 1. Purpose

Define the one generic envelope through which every non-local interface (Telegram, mobile, web, CLI, TUI, future) submits intent, and the exact transformation from that envelope into canonical Covert identities and operations. Remote interfaces must not execute capabilities, hold mission state, or own security decisions.

## 2. Non-goals

- No second authority, mission, or permission engine.
- No shell-command ingress. Free text is intent data, normalized by the existing model/agent path.
- No attachment payloads in the envelope; attachments are references.
- No channel-specific mission logic; adapters deliver and normalize only.

## 3. Envelope

```ts
type RemoteIngressEnvelope = {
  schema_version: 1;
  request_id: string;              // channel-unique, stable across retries
  received_at: string;             // ISO-8601 UTC
  channel: 'telegram' | 'mobile' | 'web' | 'cli' | 'tui' | 'local-ui';
  channel_identity: {
    adapter_id: string;            // e.g. 'telegram.bot.<bot_id>'
    account_id: string;            // channel account (chat id, device user)
    message_id: string;            // native message/event id
    thread_id?: string;
  };
  operator_identity: {
    actor_id: string | null;       // canonical authority actor when an adapter binding exists
    claimed: string | null;        // channel-declared identity (never trusted alone)
  };
  device_identity: {
    device_id: string | null;      // origin or target device (Section 8)
    attestation: string | null;    // device proof reference, not a secret
  };
  session_identity: {
    origin: string;                // authority origin string bound to the credential
    token_ref: string | null;      // opaque reference; the raw credential never enters the envelope
  };
  intent: {
    kind: 'status_query' | 'mission_start' | 'mission_control' | 'capability_invoke' | 'approval_response';
    text?: string;                 // bounded (<= 4096 chars), DATA only
    capability?: string;           // capability id when the adapter can map deterministically
    mission_ref?: string;          // mission_id when continuing/controlling
    operation_ref?: string;        // operation_id when responding to an approval
    args_digest?: string;          // sha256 of normalized args when invoking deterministically
  };
  target: {
    device_id?: string;            // device the intent is for (default: owner device)
    workspace_id?: string;         // canonical workspace identity
  };
  auth: {
    level: 'channel_allowlisted' | 'operator_paired' | 'device_attested' | 'strong';
    proof_ref?: string;            // adapter binding id, device signature ref, or step-up ref
  };
  approval_scope: {
    requested: 'none' | 'per_operation' | 'preauthorized';
    policy_ref?: string;           // permission profile id + version when preauthorized
  };
  expiry: string;                  // ISO-8601; stale envelopes are refused
  nonce: string;                   // per-request uniqueness for replay defense
  payload_ref: {
    kind: 'inline' | 'artifact';
    ref?: string;                  // attachment reference resolved by the adapter
    digest?: string;               // sha256 of the referenced content
  };
  correlation: {
    task_id: string;               // canonical derived task id (Section 5)
    mission_id?: string;
    operation_id?: string;
  };
};
```

Field rules:
- `request_id` is a **dedupe identity**, not authority. It never appears in an operation descriptor as a privilege.
- `auth.proof_ref` is an opaque reference; tokens, bot tokens, and keys never enter the envelope.
- `intent.text` is bounded and treated as DATA. No downstream component may interpret it as a command without the normal proposal→authority path.
- `expiry` is mandatory; the normalizer refuses expired envelopes (`EXPIRED`) without side effects.
- `payload_ref.digest` is mandatory when `kind === 'artifact'`; unresolvable references fail closed.

## 4. Canonical processing pipeline

```
1. adapter receives channel message
2. adapter authenticates the channel account (allowlist or provider verification)
3. adapter builds envelope (request_id = native id; nonce; expiry; bounded text)
4. adapter submits envelope to the ingress normalizer (private, in-process)
5. normalizer validates schema + expiry + nonce + request_id uniqueness (durable dedupe ledger)
   ├─ duplicate → return recorded mission/operation state; no execution
   └─ new → continue
6. normalizer resolves operator identity (adapter binding → actor_id) and auth level
7. normalizer maps intent → canonical request:
   - status_query      → read projection over mission/device/workflow state (no operation)
   - mission_start     → mission create/resume proposal
   - mission_control   → mission.cancel/pause/resume control operation
   - capability_invoke → capability descriptor + args digest
   - approval_response → exact operation decision (YES/NO <operation_id> precedent)
8. authority.prepare(actor, { workspace, task_id, kind, args })
9. policy + permission profile consulted (narrowing only; may force ASK/deny)
10. decision path: read → auto-approved; write/execute/external/permission/revoke → operator decision
    (remote approval, local approval long-poll, or step-up when required)
11. authority.execute → capability router → executor
12. receipts recorded (operation, routing decision, mission/attempt, evidence, notification)
```

Fail-closed points: 2 (unknown channel), 5 (duplicate is not failure — it is a replay of recorded state), 6 (no binding for a non-read intent), 8 (unknown kind), 9 (denied), 11 (no authorized candidate).

## 5. Identity reuse (no duplicates)

| Envelope field | Canonical identity | Source |
|---|---|---|
| `correlation.task_id` | `task_id` used by Authority descriptors | Derived, e.g. `remote:<channel>:<account_id>:<message_id>` (matches `telegram:<actor>:<updateId>`, `execution-authority.mjs:200-206`) |
| `correlation.operation_id` | `operation_id` (UUID) from `authority.prepare` | `execution-authority.mjs:88-92` |
| `operator_identity.actor_id` | Authority `actor.id` | `:53-63` |
| `session_identity.origin` | Authority credential origin string | `:188-194` |
| `target.workspace_id` | Server-owned workspace path | `node/src/server.ts:68`; `execution-authority.mjs:64-70` |
| `device_identity.device_id` | New device identity (Section 8 of the parent doc; `docs/architecture/DEVICE-AGENT-CONTRACT.md`) | To be implemented (V1.1) |

C1-14 decision required: introduce an `attempt_id` at the mission layer (see the workflow synchronization contract) rather than overloading `request_id`/`task_id`. The ingress contract deliberately does not mint it.

## 6. Adapter responsibilities and prohibitions

Required:
- authenticate the channel account and maintain allowlists as configuration, not authority;
- normalize to the envelope, including bounded text and attachment references;
- persist a durable dedupe/offset ledger (fixes C5-09 for Telegram);
- enforce per-channel rate limits (messages/minute and concurrent requests);
- deliver canonical notifications for missions it originated;
- emit sanitized logs: ids, lengths, decisions, latencies; never bodies, never secrets (aligns with C4-06 journaling scope).

Forbidden:
- parsing intent into commands, shell strings, or capability invocations without the normalizer;
- holding mission state, authority logic, desktop-control logic, or model-selection truth;
- constructing authority control handles or adapter bindings (those exist only on the private composition-root ports, `execution-authority.mjs:117-141`);
- widening an adapter scope implicitly. Scope is set at binding creation and may not include `*.grants`, `*.decision`, or `authority.grant` (`:153`).

## 7. Authentication and authorization separation

- `channel_allowlisted` proves the channel account is known. It grants nothing.
- `operator_paired` means a canonical actor exists for this operator session; it still grants nothing by itself.
- `device_attested` adds a device proof. It is required for CLASS A high-consequence actions (parent doc Section 20) from remote channels.
- `strong` means step-up occurred (local confirmation or second factor) for this request. Strong auth expires with the request.
- Authorization is always a separate `prepare → decide → execute` sequence with exact argument binding. A compromised chat account cannot mint actors, widen scopes, or bypass decisions.

## 8. Approval semantics

- Approval responses must name the exact `operation_id` (the existing Telegram exact-match rule, `execution-authority.mjs:207-220`).
- Approvals are single-use; expired operations cannot execute (`:290-292`).
- Remote approval is allowed only for operation classes the policy marks remotely approvable. CLASS A requires `device_attested` or local confirmation.
- Rejected/expired approvals settle the mission truthfully (no silent retry with mutated args).

## 9. Idempotency, replay, and duplicates

- Dedupe key: `request_id`. Durable ledger row: `{request_id, channel, received_at, task_id, mission_id, operation_id, state}`.
- Replay defense: `nonce` + monotonic native ids (Telegram `update_id`; webhook event id) + `expiry`.
- Reconciliation-before-retry for adapters: query recorded state before resending.
- Authority is the last line of defense: digest-bound, single-use execution (`execution-authority.mjs:221-225,286-316`).
- Guarantee: duplicates never cause double email send, double commit, duplicate missions, or double deletion.

## 10. Enrollment of a future ingress route

When a remote adapter route is implemented, it must follow the existing enrollment mechanics (base audit, verified):
1. route factory in `node/src/openapi.ts`, discovered by `tests/arch/route-authority-coverage.test.ts`;
2. exactly one disposition per route: `describeOperation` (descriptor), central `HTTP_POLICY` row, or `authorityMode` (control) — never both;
3. facade map entry in `common/facade-route-map.json` or the product edge falls to legacy 404 (C1-02);
4. `npm run contracts` regeneration with no drift (`tests/arch/openapi-drift.test.ts`);
5. migration waivers are not acceptable for remote ingress: it must be fully enrolled before it can ship.

## 11. Verification requirements

- REMOTE-001/002/003/005/006/007/008/009 (parent doc Section 27) are the acceptance battery for this contract.
- Contract tests must include: schema strictness; expiry refusal; duplicate returns recorded state with zero side effects; replay denial; wrong-device denial; approval exact-id binding; adapter-scope denial on escalation attempts; sanitized audit rows contain no message bodies or tokens.

## 12. Threat notes (bounded)

| Threat | Control |
|---|---|
| Replay of a signed/valid message | Monotonic ids + durable dedupe + expiry + Authority single-use |
| Adapter process compromise | Adapter holds no authority; binding lives in the composition root; scope is fixed at creation |
| Forged `operator_identity.claimed` | `claimed` is never consulted for authorization; only canonical `actor_id` |
| Envelope smuggling (extra fields) | Strict schema; unknown fields rejected (matches existing strict contracts) |
| Prompt injection via `intent.text` | Text is DATA; capability invocation requires Authority; existing harness injection doctrine applies |
| Attachment as exfiltration/injection carrier | Referenced by digest; content classified as DATA; no auto-execution |
| Stale approval replay against a new mission | Approval binds `operation_id` + digest; mission state transitions reject stale references |

## 13. Open decisions

1. `request_id` namespace collisions across channels (recommend prefixing with `channel`).
2. Whether `status_query` requires an actor at all (recommend yes; even status is operator-private).
3. Durable dedupe ledger location (recommend `.aide/remote/requests.jsonl`, append-only, compacted by retention policy; owned by V1.1 implementation).
