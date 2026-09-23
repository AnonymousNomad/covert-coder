# Model Connection Contract

Status: **IMPLEMENTATION HANDOFF — DESIGN ONLY**

Owner: **DeepSeek #1** for canonical backend integration. Luna owns the
architecture, provider research, UX contract, and later independent
certification. This contract must consume existing provider, credential,
egress, model-runtime, Resource Admission, Authority, Provenance, and Harness
contracts rather than create parallel registries.

## Purpose

Make model access understandable and low-friction while preserving:

```text
LOCAL BY DEFAULT
CONNECTED BY CHOICE
NO SECRET LEAKAGE
NO PROVIDER CLAIM WITHOUT PROBE/DISCOVERY
NO MODEL ACCESS WITHOUT A GOVERNED EXECUTION PATH
```

The connection layer answers **what access exists**. It does not decide whether
a mission may mutate a machine, whether a model is good enough, or whether a
result is verified.

## Existing candidate surfaces to reuse

The certified candidate already contains these relevant seams:

| Existing surface | Evidence | Reuse rule |
|---|---|---|
| `common/contracts/connections.ts` | `ProviderConnection`, `ConnectionKind`, `ConnectionStatus`, connection view/preferences | Extend only through an owned compatibility path; do not create a second connection DTO. |
| `node/src/services/provider-connections.mjs` | Aggregates local runtime, API-key, subscription-runtime presence, and Hugging Face catalog token state | Preserve the aggregation boundary; replace heuristic states only with authoritative probes/contracts. |
| `node/src/services/providers.ts` | Built-in API-key providers, host allowlist, probe, chat, secret-backed credentials | Reuse direct provider adapter and egress allowlist; add discovery/version data without logging secrets. |
| `node/src/services/credentials.ts` | Windows DPAPI-backed store and null fallback | Do not add plaintext fallback that presents as secure. |
| `node/src/services/opencode-bridge.ts` | OpenCode health/provider/auth/session bridge; credential ownership remains OpenCode | Use as the first delegated broker; retain direct-adapter compatibility. |
| `node/src/services/egress-journal.mjs` | `.aide/egress/journal.jsonl` | Record bounded egress facts, never credentials or provider bodies. |
| `node/src/services/model-router.ts` / `model-runtime.ts` | route and local runtime selection/fitting | Connection discovery supplies candidates; router resolves a worker; Harness records what actually ran. |
| `ExecutionAuthority` routes | guarded write/external/capability operations | Connection changes, egress, and provider tests remain governed operations. |

## Canonical concepts

### Connection record

A connection record is a projection with this minimum shape:

```text
connection_id
provider_id
connection_class
display_name
status
credential_owner: COVERT_SECURE_STORE | DELEGATED_BRIDGE | LOCAL_NONE
credential_ref: opaque or null
scope: model access / catalog / account / endpoint
capabilities: discovered, not assumed
last_verified_at
source_version / bridge_version
error_class / safe_detail
```

The record must never contain an API key, OAuth code, refresh token, password,
authorization header, browser cookie, or provider error body containing one.

### Connection state

Use the existing statuses as a compatibility base and map richer health to:

```text
NOT_CONFIGURED
CONNECTING
CONNECTED
AUTH_EXPIRED
RATE_LIMITED
UNAVAILABLE
MISCONFIGURED
UNKNOWN
```

If the current public contract cannot yet carry a richer state, expose a
truthful compatibility mapping and document the loss. Do not silently map
`AUTH_EXPIRED`, `RATE_LIMITED`, or `UNKNOWN` to `CONNECTED`.

### Model discovery

Discovery returns an attributable model capability projection:

```text
connection_id
provider_model_id
display_name
provider_revision if supplied
context_limit: number or UNKNOWN
output_limit: number or UNKNOWN
tool_calling: YES | NO | UNKNOWN
structured_output: YES | NO | UNKNOWN
reasoning_controls: declared | UNKNOWN
pricing: declared | NOT_DIRECTLY_RECORDED | UNKNOWN
availability
source_timestamp
source_reference
```

A catalog entry is not a ready runtime. Readiness requires the existing runtime
probe or provider probe plus Resource Admission for the intended execution.

### Placement

Placement must be explicit:

```text
LOCAL
REMOTE_DIRECT
REMOTE_DELEGATED
UNKNOWN
```

Remote placement emits the existing egress observation. Local placement does
not promise that no network is used by a model acquisition or external tool;
the connection/mission boundary must state which phase egressed.

## Operations

### `listConnections`

Read-only aggregate. It must not perform hidden model generation or mutate
credentials. Provider health probes must be explicit, bounded, and labeled as
probes.

### `beginConnect`

Returns a provider-specific next step:

```text
OAUTH_BROWSER
DEVICE_CODE
API_KEY_ENTRY
DELEGATED_BRIDGE_SIGN_IN
LOCAL_DISCOVERY
MANUAL_ENDPOINT
UNSUPPORTED
```

The response contains no secret. Browser/device flows return only safe state,
user code/verification URL where the provider explicitly supplies them, and an
opaque pending connection ID.

### `completeConnect`

Validates the provider result, stores only through the approved owner, performs
a bounded connection probe, and returns the safe connection projection. A
credential may not be considered connected solely because it was entered or
stored.

### `disconnect`

Revokes/removes the Covert-owned credential reference or asks the delegated
bridge to disconnect where supported. It must not delete provider accounts or
alter external subscription state. Existing running missions keep their
immutable attempt facts; new missions cannot use the disconnected connection.

### `discoverModels`

Uses a provider-supported catalog endpoint or delegated bridge. Model IDs are
stored with source and revision/timestamp. Dynamic aliases are not sufficient
for Harness Sync fingerprints.

### `testConnection`

Uses the least-invasive supported probe. A successful health response does not
prove tool support, model readiness, Authority compatibility, or Veritas
acceptance.

## Ownership and security

```text
browser/OAuth credential        provider or delegated bridge
direct API key                   existing OS-secure credential store
local model file                 local filesystem + hash/revision registry
connection status                connection service projection
model capabilities               provider/runtime discovery observation
mission egress                   egress journal + provenance observation
execution permission             Execution Authority
resource feasibility             Resource Admission
attempt execution facts          Harness / canonical provenance integration
acceptance                      Veritas
durable verified truth           Helix after normal promotion
```

Provider responses are untrusted input. Bound response size, redact known
secrets, avoid persisting raw response bodies, and classify malformed or
unexpected responses as `UNKNOWN`/`MISCONFIGURED` rather than healthy.

## Harness relationship

The resolved worker/runtime passed to Harness must include an immutable
connection/model fingerprint. A later connection refresh cannot change a
running attempt. A provider switch creates a new attempt with a new fingerprint
and explicit lineage.

Harness Sync is offered after discovery, but it is optional:

```text
new model → STANDARD HARNESS (default)
          → optional HARNESS SYNC
```

The Sync profile may change context presentation, decomposition, candidate
limits, or reasoning budget. It may not change Authority, required verification,
acceptance, project isolation, or evidence standards.

## Policy constraints

Operator preferences such as `local-only`, `local-first`, `free-only`,
`subscription-only`, provider allow/deny lists, or a maximum cost are routing
constraints. They are not Authority and cannot authorize filesystem, process,
network, or deployment effects.

## Minimum acceptance tests for implementation

1. Fresh install lists local access without requiring a cloud account.
2. Unknown provider remains `UNKNOWN`/unsupported; it is not displayed as
   connected.
3. OpenCode delegated auth never reads or copies its credential file.
4. Direct credentials are absent from logs, traces, egress, Provenance,
   Mission Receipts, Helix, and Harness Passport material.
5. Browser/device flow completion is bound to the pending connection and cannot
   be completed by a different workspace/user/session.
6. Provider/model discovery preserves exact identity, source, timestamp, and
   capability unknowns.
7. A connection can be connected while its model is resource-refused or
   verification-incompatible; UI shows the distinction.
8. Disconnect prevents new use and leaves historical attempt provenance intact.
9. OpenRouter free discovery labels current availability and rate/usage limits;
   it never calibrates a rotating alias as one model.
10. Local, direct, delegated, and custom endpoint paths all enter the same
    provider-neutral resolved worker contract before Harness admission.

## Migration requirement

The current candidate's connection view is a useful compatibility layer, not a
complete contract. DeepSeek #1 should extend it only after mapping each new
field to an existing owner. A migration must preserve existing local-first and
BYOK behavior, preserve the OpenCode bridge, and avoid changing Authority or
Harness semantics in the same patch.
