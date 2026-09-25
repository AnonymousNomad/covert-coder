# Chat Authority Contract V1

Status: implemented and regression-tested on the isolated `fix/authority-chat-contract-v1` branch. This is a shared route contract; it does not qualify a model or change Runtime V1.

## Problem and reproduction

At Resident continuation checkpoint `323fdb3ae800996e19eecc6fd53b3d88bdf4a2bf`, route-authority coverage reported both `POST /api/chat` and `POST /api/chat/stream` as `UNCLASSIFIED`. The F1b manifest records 20 HTTP 403 responses with `capability has no authority policy`, before handler/model dispatch. Those rows are apparatus-invalid and are not model-performance evidence.

The selected shared-architecture base, `e23aec80cd05ab0c237eba793421bb5e7c5a57e7`, contained static `capability.execute` mappings for both routes. That restored route coverage but did not distinguish local inference from provider egress. Static `capability.read` would be broader still and is not used.

## Resolution and dispatch order

For both routes, the server validates the request body, then the route descriptor resolves the requested model against the canonical `ModelRuntime` local registry and built-in provider catalog. Resolution is synchronous and non-executing: it does not probe health, start/load a model, query provider connectivity, contact a provider, or read credentials. The resulting operation is passed to Authority before the handler/composer or inference call runs.

| Resolved target | Authority operation | Result |
| --- | --- | --- |
| Registered local model with `local://` artifact identity, a recorded file path, and numeric-loopback HTTP endpoint | `capability.execute` | Local inference may be attempted after the existing Authority decision. Runtime health, qualification, and resource admission remain owned by their existing subsystems. |
| Exact built-in provider/model route with HTTPS origin matching its catalog egress host | `capability.external` | External egress remains an external operation and follows existing Authority policy/decision handling. A local approval cannot authorize it. |
| Missing, stale, malformed, or ambiguous destination | No operation | Request is rejected `FORBIDDEN` before dispatch. There is no `capability.read` or default-allow fallback. |

Local-Only policy enforcement is not implemented by this change. The distinct operation kinds preserve a future policy boundary: local inference is `execute`; provider inference is `external`. This change does not claim that Workspace Trust or Local-Only is enforced.

## Binding and streaming

The Authority operation arguments bind the HTTP route, normalized request body, resolved execution class, route/model identity, source/runtime class, endpoint origin, provider/model/egress host when external, and a `target_revision` fingerprint. The revision is a SHA-256 fingerprint of configured target metadata; it is not the model artifact SHA-256 and must not be presented as artifact qualification.

After Authority executes the exact operation, the route uses a request-scoped resolved target. Immediately before backend dispatch, `ModelRouter` resolves the target again and compares the complete binding. A changed or missing target raises `ChatTargetChangedError` and is refused; it is not silently rerouted or fallen back. The dispatch method then calls the exact local model ID or exact provider/model selected in the binding.

`POST /api/chat` and `POST /api/chat/stream` use the same local/external operation mapping. The HTTP route is part of the digest, so an approval cannot be replayed across the two routes. Streaming changes response transport only; it does not bypass a denial. For external targets, the existing `ProviderService.chat` returns a completed response which the stream route emits as one SSE delta; this contract proves Authority parity, not incremental provider-token streaming.

Authority receipts include no provider credentials or private local artifact path. They do bind the request body under the existing exact-operation digest. Request task identity, Authority operation identity, route identity, and resolved target identity remain distinguishable.

## Evidence and boundaries

Deterministic tests cover local and external descriptors, unknown-target denial, provider identity overriding a local-looking display/model name, no pre-authorization probes, exact target dispatch, local-to-external substitution, target revision changes, stream parity, cross-route replay refusal, missing-operation-policy fail-closed behavior, and an unrelated accepted provider read. Route-authority coverage and OpenAPI drift tests run against the actual route table.

The external-provider tests use a deterministic fake service; no cloud inference or provider API call is made. The local fixture verifies classification/dispatch routing, not Runtime V1 qualification. Runtime V1, Resident results, Model Manager architecture, Authority policy architecture, and other protected lanes are unchanged.

## Worktree preflight

`scripts/ci-worktree-check.mjs` still rejects dirty trees. It now also accepts optional `AIDE_EXPECTED_BRANCH` and `AIDE_EXPECTED_HEAD` values and rejects mismatches. Qualification owners should run it in the active lane worktree before a run, with both values set, and then launch the experiment from the same worktree. The selected shared-architecture base contains no Resident experiment runner to patch; integration into the Resident-owned F3 entrypoint is a handoff item. Operational rule: one active lane per dedicated worktree; never branch-switch a dirty qualification worktree.

PowerShell preflight form (use the exact post-integration branch and checkpoint for the lane):

```powershell
$env:AIDE_EXPECTED_BRANCH = 'resident/marathon-h1-resume'
$env:AIDE_EXPECTED_HEAD = '<exact accepted continuation SHA>'
node scripts/ci-worktree-check.mjs
```

## Resident integration handoff

The Authority branch starts at `e23aec80cd05ab0c237eba793421bb5e7c5a57e7`; Resident continuation is at `323fdb3ae800996e19eecc6fd53b3d88bdf4a2bf`. Their merge base is `8ea6c8b36857f3136996a4cc149f1fafeb57e7eb`, so the Authority base is not an ancestor of that Resident revision. Do not blindly cherry-pick the implementation commit: Resident lacks the static chat policy rows removed by this change and has divergent `ModelRouter`/server files. Integrate the contract on a clean continuation derived from the accepted Resident checkpoint, reconciling only those files against their current owners. Keep the exact resolution, binding, operation mapping, route digest, and dispatch revalidation invariants; do not import unrelated source-assembly changes. After integration, run route-authority coverage and the focused chat Authority suite, then let the Resident owner rerun F1b once.
