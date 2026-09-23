# Model Connection Implementation Handoff

Status: **READY FOR DEEPSEEK #1 DESIGN/IMPLEMENTATION PLANNING**

This is an implementation handoff, not an authorization to change the
certified candidate or to alter Harness, Authority, Veritas, Resident,
Workflow, model lifecycle, or provider execution semantics in this review.

## Required first slice

Implement a bounded Connection Center vertical slice:

```text
connection registry projection
→ provider status
→ OpenCode-backed provider access
→ local-runtime access
→ safe credential-reference semantics
→ model discovery projection
→ user-facing Connections surface
→ Standard vs optional Harness Sync choice
→ hardware/resource-aware availability
```

Direct providers and catalog sources may be incremental. The first slice must
not require a cloud account and must preserve the local path.

## Existing contracts and boundaries to reuse

### Reuse unchanged where possible

```text
common/contracts/connections.ts
node/src/services/provider-connections.mjs
node/src/services/providers.ts
node/src/services/credentials.ts
node/src/services/opencode-bridge.ts
node/src/services/model-router.ts
node/src/services/model-runtime.ts
node/src/services/egress-journal.mjs
ExecutionAuthority route wrapper
Resource Admission readiness/probe contract
Provenance Ledger contract
Harness Sync architecture contract
```

The current `ProviderConnection` contract is a compatibility base. DeepSeek
#1 must decide whether to version/extend it after an explicit diff; do not create
`ConnectionRegistryV2` beside it.

## New contract capabilities required

The implementation must add or formally extend canonical contracts for:

```text
connection class
credential owner and opaque reference
connection status with auth/rate-limit/unavailable distinction
pending browser/device authorization state
provider/model discovery identity and revision
capability declarations with UNKNOWN values
placement: local/direct remote/delegated remote
egress classification and timestamp
pricing/resource metadata with NOT_DIRECTLY_RECORDED
disconnect/revocation result
model acquisition source/license/hash/revision
Harness Sync eligibility and profile reference
```

Each field must identify its owner. A field with no canonical owner remains
`UNKNOWN` or `NOT_RECORDED` in the UI.

## Provider bridge boundary

The canonical request path is:

```text
Connections UI
→ connection service
→ direct adapter OR OpenCode bridge
→ resolved provider/model identity
→ Model Router / Orchestrator
→ Resource Admission
→ Execution Authority
→ Harness
→ Veritas
→ Provenance / Mission Receipt
```

OpenCode is an initial broker, not a permanent semantic dependency. The
provider-neutral resolved worker contract must allow:

```text
OpenCode delegated provider today
direct provider adapter later
local runtime
custom approved endpoint
```

The Harness receives the resolved fingerprint and records what executed. It
does not discover credentials, select providers, or become a gateway-specific
execution engine.

## Credential boundary

```text
delegated provider → delegated owner stores/authenticates
direct provider    → existing OS-secure credential store
local runtime      → no provider credential
catalog download   → optional catalog token in secure store
```

Never read OpenCode/Codex/Claude credential files. Never persist raw secrets in
workspace, logs, egress, Harness evidence, Passport, Provenance, Helix,
Mission Receipts, support bundles, screenshots, or Git.

Provider-specific auth flows must be explicit. Anthropic subscription reuse via
unofficial plugins is not an implementation path.

## UI/backend boundary

The backend returns typed projections and safe error classes. The UI renders:

```text
NOT_CONFIGURED / CONNECTING / CONNECTED / AUTH_EXPIRED / RATE_LIMITED
UNAVAILABLE / MISCONFIGURED / UNKNOWN
```

The UI may explain what a provider offers, but it may not infer:

```text
connection = model readiness
catalog = runnable runtime
credential stored = healthy
provider access = execution authority
model claim = verified outcome
```

## Health integration

Connection health is a provider/runtime observation. It must feed the canonical
Health Supervisor when that contract lands, rather than creating a second
health state machine. Until then, expose bounded `last_verified` and safe
status/error fields; do not claim `HEALTHY` from a file or process alone.

## Resource Admission integration

Resource Admission decides whether a selected local/remote configuration can
run now. It receives actual model/runtime/resource requirements and returns its
canonical decision. Connections only supply candidate metadata. A remote model
can still be refused by policy, quota, or network state; a connected local
model can still be refused by RAM/VRAM.

## Harness Sync integration

Connection discovery offers:

```text
Use Standard Harness
Run optional Harness Sync
```

Sync must fingerprint the exact provider/model/revision/runtime/template/config.
The resulting Capability Passport is observations; the Synchronized Harness
Profile is a derived projection with evidence references. Neither changes
Authority, Veritas, acceptance, isolation, or secret policy.

The first connection slice does not need automatic recommendation or model
swapping. It must provide a stable hook and truthful `NOT_SYNCED` state.

## Provenance integration

For each governed attempt, canonical provenance should eventually bind:

```text
connection_id
provider/model ID and revision
credential owner (not credential)
local/direct/delegated placement
egress occurred and safe provider reference
runtime/configuration fingerprint
Harness/Profile/Context/Skill versions
```

These facts join the sealed attempt/envelope proposed in the Crown-Jewel review.
Do not make a separate connection history or Passport ledger.

## Egress integration

Every remote request must pass the existing egress/consent/host policy and emit
the existing bounded egress observation. Provider error bodies and headers are
redacted before logs. A local model acquisition is a distinct egress event from
remote inference; the UI must distinguish them.

## Tests

### Contract and state

```text
fresh local-only install
unknown provider
direct key accepted/rejected
OAuth/device pending/complete/expired/replayed
delegated OpenCode ready/not-authenticated/unavailable
provider rate limit and outage
disconnect/revoke
model discovery revision/capability unknowns
local runtime ready/not-ready/resource-refused
custom endpoint unapproved/approved/rebound
```

### Security

```text
secret scanner over logs/evidence/support bundle
no credential file reads for delegated owners
no secret in child environment
no raw provider error body persistence
wrong-session callback rejection
credential reference only in durable projections
```

### Integration

```text
same resolved worker contract for local/direct/delegated paths
Authority still gates every mutation
Veritas still separates model claim/execution/evidence
disconnect cannot alter historical attempt identity
offline mode remains usable
Standard vs Sync remains same acceptance criteria
resource refusal is visible and truthful
```

## Migration and rollout

1. Add projection fields/contract version without changing current local-first
   defaults.
2. Wire OpenCode status/model discovery through the existing bridge.
3. Preserve direct API-key providers and secure storage.
4. Add local/Ollama/custom endpoint discovery only behind explicit capability
   and host checks.
5. Add catalog acquisition after license/hash/revision contract tests.
6. Add Passport/Sync references after sealed attempt provenance exists.
7. Certify each connection class independently; do not certify the matrix from
   a single provider success.

## Acceptance boundary

The slice is complete only when an outside user can:

```text
start local
or connect one official provider
or inspect a current free offer
→ see exact access/model/resource truth
→ choose Standard or optional Sync
→ run through the same governed worker path
→ disconnect without secret leakage or historical corruption
```

The slice does not include automatic downloads, marketplace behavior,
autonomous provider switching, subscription credential extraction, or any
change to canonical execution semantics.
