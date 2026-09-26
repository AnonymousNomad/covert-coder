# C4-02 — Local-Only Egress Enforcement

**Status: BLOCKED — managed egress boundaries are guarded, but Local-Only is not a system-wide egress boundary.**

- **Implementation checkpoint:** `bae1e091410a00b6929bf6c7f3c26bedf65c3399`
- **Regression validation checkpoint:** `848af9c635123e8e72834f9a9d7e18a1feed9c40`
- **Starting implementation base:** `108d4fd599a48c488a69aee3a5741f928b40fd0e`
- **Canonical preference source:** Provider Connections, `.aide/routing-preference.json`
- **Enforcement owner:** `ExecutionAuthority`

## Contract implemented in this checkpoint

The existing Provider Connections routing preference remains the sole persisted Local-Only setting. Authority reads it on each check; no frontend boolean or duplicate policy store was introduced.

- A missing preference continues to mean the existing `local-first` default.
- A valid `local-only` preference blocks operations whose canonical Authority descriptor has `risk: external` at preparation and execution.
- Execution checks again after the durable consumption receipt and immediately before invoking the executor.
- Malformed, unreadable, linked, or out-of-workspace preference state is `UNKNOWN` and fails closed as `NOT_READY`.
- Service adapters that can make external requests call the Authority-owned guard immediately before their transport. A missing guard fails closed.
- Local `capability.execute` work, including explicitly resolved local chat and numeric-loopback model/runtime endpoints, remains available when otherwise authorized.
- The existing chat target binding and stream/non-stream parity remain unchanged: external chat is denied in Local-Only; local chat is permitted; target substitution is refused.

This is a set of guarded application boundaries. It is **not** an OS firewall and does not constrain arbitrary child processes.

## Egress inventory

| Surface | Current classification | Evidence / boundary |
|---|---|---|
| `/api/chat` and `/api/chat/stream`, external target | **BLOCKED BY LOCAL-ONLY** | Both derive external Authority operations from canonical target identity; stream parity and no-provider-dispatch tests pass. |
| `/api/chat` and `/api/chat/stream`, local target | **EXPLICITLY ALLOWED BY POLICY** | Existing chat contract resolves local target truth; local execution remains `capability.execute`. |
| Model Hub search, files, and download | **BLOCKED BY LOCAL-ONLY** | Route approval is `capability.external`; Authority and service guards run before fetch. Denials leave fake-fetch count and completed-egress journal unchanged. |
| Built-in provider connect/probe/chat | **BLOCKED BY LOCAL-ONLY** | Provider service checks before credential mutation/probe and again before transport. Missing guard returns `NOT_READY`. |
| BYOK provider probe/chat | **BLOCKED BY LOCAL-ONLY** | Guard runs before egress journaling and fake transport; missing guard fails closed. |
| Telegram connect, poll, and reply | **BLOCKED BY LOCAL-ONLY** | Every external transport checks Authority; polling does not enter running state when denied. |
| Typed model start/readiness endpoints | **BLOCKED BY LOCAL-ONLY / LOOPBACK POLICY** | These routes reject non-numeric-loopback manifest endpoints before runtime contact and revalidate before start dispatch. |
| Automatic embeddings endpoint | **REMOTE ENDPOINT REJECTED; LOOPBACK ALLOWED** | Remote endpoint is rejected before fetch regardless of Local-Only state; numeric-loopback endpoint remains available. |
| Git push through the Authority-enrolled API route | **BLOCKED BY LOCAL-ONLY** when its descriptor is external | Central Authority denies external-risk preparation/execution. Direct shell Git is not covered by this route guarantee. |
| Provider discovery/catalog | **NOT APPLICABLE** | Current discovery reads the local built-in catalog and local credential/connection state; it does not contact providers. Connect/probe operations are listed separately. |
| Online MCP server trust grant | **BLOCKED BY LOCAL-ONLY** | The trust/egress-consent path checks the canonical Authority guard before changing trust state. |
| Remote MCP transport | **NOT APPLICABLE in the inspected TypeScript service tree** | No remote MCP client/transport implementation was found in the inspected `node/src`, `daemon`, and `plugins` trees. Trust gating is not evidence of a transport guard; any future dial/dispatch path must call the canonical guard. |
| Public Ops publication/provider actions | **OWNER HANDOFF** | Public Ops is a separately owned protected lane. Its egress enforcement was not changed or qualified here. Owner must gate each external dispatch through the same effective policy before C4-02 can close. |
| Desktop/browser control | **OWNER HANDOFF** | Separate protected lane; web navigation and browser-triggered requests were not qualified against Local-Only here. |
| Telemetry/analytics and update checks | **NOT APPLICABLE in the inspected service snapshot** | No outbound telemetry or product-update client was found in the scoped TypeScript backend, legacy daemon, and plugin source scan. This is a bounded source-search result, not a claim about external packaging tools. |
| Arbitrary task commands, agent shell commands, terminal PTYs, notification hooks, OpenCode/CLI bridges, and plugins with child-process/network grants | **UNIMPLEMENTED — BLOCKER** | These launch processes that can create network connections outside Authority. Existing command-string heuristics/consent fields do not provide complete network confinement. Plugin `network.localhost` currently maps to Node `--allow-net`, which is broader than the name implies; `terminal.run` grants child-process access. |
| Legacy daemon model manager | **UNIMPLEMENTED — BLOCKER** | The normal launcher starts the legacy daemon alongside the typed backend. The facade maps current `/api/models` routes to TypeScript, but the legacy daemon still listens on loopback and its model manager directly fetches manifest `model.endpoint` values for readiness/chat/warmup. It does not consume the typed Authority Local-Only guard. |
| Unknown future egress path | **UNKNOWN — BLOCKER** | There is no process-wide egress interception layer. New or unenumerated transports cannot be claimed blocked by the route-level guard. |

## Verification

All tests use injected fakes or local fixtures; no paid/cloud provider request was made.

- A Local-Only change blocks external Authority preparation.
- A previously approved external operation cannot execute after Local-Only turns on.
- A preference change during the durable consumption receipt is rechecked before executor invocation; the executor receives zero calls.
- Malformed preference state blocks as `NOT_READY`.
- Chat and streaming share the same local/external policy and dispatch binding.
- Model Hub is denied before fake network contact, before egress journaling, and after asynchronous credential resolution if Local-Only changes.
- Missing credential source falls back to an anonymous public metadata request; no Authorization header is sent, and neither the fake credential nor error detail appears in logs.
- Provider, BYOK, Telegram, online-MCP-trust, embeddings, and typed model endpoint fixtures verify their stated guards.
- Route-authority coverage: 236 routes, 0 conflicts, 0 unclassified, 20 existing migration waivers.
- Focused regression at `848af9c635123e8e72834f9a9d7e18a1feed9c40`: **144/144 PASS**.
- `npx tsc -p tsconfig.node.json --noEmit`: **PASS**.
- Scoped ESLint on changed applicable source/test files: **PASS**.
- `git diff --check`: **PASS** before the code checkpoint.

## Closure decision

C4-02 is **not closed**. The current work correctly blocks the enumerated managed HTTP/API paths, but arbitrary child-process/PTY egress, the legacy model-manager surface still launched by the normal stack, and protected publication/browser-control owners remain outside the canonical gate. A Local-Only setting must not be represented as globally enforced until those paths are mediated or technically confined and the complete egress inventory is revalidated.

Required next owner action: define a single, enforceable process/network boundary for execution-capable tools and reconcile the legacy daemon and protected egress owners with Authority's effective policy. This work is outside the current bounded patch because it requires a broader execution/egress ownership design; no heuristic-only fix would prove the security invariant.

## Scope boundaries

- Runtime V1 and its Passport were not modified.
- Resident, Model Manager, Public Ops, Desktop Control, Harness Sync, and other protected lanes were not modified.
- No live provider, model-hub, Telegram, MCP, or publication request was sent.
- C4-04 is independently closed in `C4-04-MODELHUB-EGRESS.md` / `.json`.
