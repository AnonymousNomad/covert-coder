# Main Luna — Resident Binding Consumer Contract

Cipher is the persistent Resident. Liquid is the canonical Resident model. Worker models are delegated
resources and never silently become the Resident. This is a read-only projection over canonical Model
Manager inventory + runtime status; it holds no state of its own, so it survives UI reloads by construction.

## Import

```ts
import { createResidentBinding } from '../../node/src/services/resident-binding.ts';
import { ResidentBinding, RESIDENT_BINDING_SCHEMA } from '../../common/contracts/resident-binding.ts';
```

Backend owner composes the service with canonical providers (Model Manager inventory + runtime observation):

```ts
const binding = createResidentBinding({
  listCandidates: () => managerModels(),          // canonical inventory entries
  observeRuntime: id => runtimeObservation(id),   // optional; UNKNOWN when absent
  executionNode: 'local-windows'
});
const view = await binding.read();                // ResidentBindingT
```

## Response (smallest contract)

| Field | Type | Meaning |
| --- | --- | --- |
| `schema` | `'covert.resident-binding.v1'` | contract version |
| `resident_id` | `'cipher'` | canonical Resident identity |
| `resident_model_id` | string \| null | canonical Model Manager id of the Liquid resident model |
| `resident_model_family` | string \| null | e.g. `liquid` |
| `binding_state` | `BOUND \| UNBOUND \| DEGRADED` | binding health |
| `availability_state` | `AVAILABLE \| UNAVAILABLE \| UNKNOWN` | artifact availability |
| `runtime_state` | `RUNNING \| LOADABLE \| NOT_LOADABLE \| UNKNOWN` | observed runtime |
| `execution_node` | string | node that would execute the Resident (e.g. `local-windows`) |
| `degraded_reason` | stable code \| null | never prose; render a friendly message per code |
| `last_verified_at` | ISO time \| null | when the backend last derived the projection from canonical inputs; null only when no observation time is available |

Degraded reason codes: `resident_model_not_registered`, `resident_model_artifact_unavailable`,
`resident_runtime_unavailable`, `resident_runtime_unverified`, `multiple_resident_candidates`,
`binding_unverified`.

## Failure / degraded semantics

- Liquid absent from canonical inventory → `UNBOUND` + `resident_model_not_registered`.
- Liquid present but artifact missing → `DEGRADED` + `resident_model_artifact_unavailable`.
- Runtime probe unavailable/unverified → `DEGRADED` + `resident_runtime_unavailable` / `resident_runtime_unverified`.
- More than one Liquid candidate → `DEGRADED` + `multiple_resident_candidates` (never guess).

## Laws for the UI

1. Never derive Resident identity from coder/planner role defaults or a conversation-pinned model.
2. Worker model selection (Model Catalog / worker roster) is a separate surface and never changes this view.
3. A UI reload re-reads the same canonical state; the view has no client cache to lose.
4. Render `resident_model_id`/`degraded_reason` from the payload only; never recompute binding in the UI.

## Canonical consumer route

The Main Luna/Cipher UI must consume the projection from `GET /api/resident/binding`, owned by the backend
process that composes Model Manager and Runtime Broker. The route returns only `covert.resident-binding.v1`;
it does not expose raw Model Manager inventory. The backend derives the projection on every read from
canonical inventory and runtime observations. The UI must not infer Cipher from Model Manager data,
the active worker model, or its own persisted model ID. It must display stable `degraded_reason` codes
as user-facing state without parsing backend prose.

## Example payloads

### Bound Resident

```json
{
  "schema": "covert.resident-binding.v1",
  "resident_id": "cipher",
  "resident_model_id": "local:liquid-2.6b",
  "resident_model_family": "liquid",
  "binding_state": "BOUND",
  "availability_state": "AVAILABLE",
  "runtime_state": "RUNNING",
  "execution_node": "local-windows",
  "degraded_reason": null,
  "last_verified_at": "2026-10-06T09:00:00.000Z"
}
```

### Resident absent

```json
{
  "schema": "covert.resident-binding.v1",
  "resident_id": "cipher",
  "resident_model_id": null,
  "resident_model_family": null,
  "binding_state": "UNBOUND",
  "availability_state": "UNAVAILABLE",
  "runtime_state": "UNKNOWN",
  "execution_node": "local-windows",
  "degraded_reason": "resident_model_not_registered",
  "last_verified_at": "2026-10-06T09:00:00.000Z"
}
```

### Resident identity present, artifact unavailable

```json
{
  "schema": "covert.resident-binding.v1",
  "resident_id": "cipher",
  "resident_model_id": "local:liquid-2.6b",
  "resident_model_family": "liquid",
  "binding_state": "DEGRADED",
  "availability_state": "UNAVAILABLE",
  "runtime_state": "UNKNOWN",
  "execution_node": "local-windows",
  "degraded_reason": "resident_model_artifact_unavailable",
  "last_verified_at": "2026-10-06T09:00:00.000Z"
}
```

### Runtime unavailable or unverified

```json
{
  "schema": "covert.resident-binding.v1",
  "resident_id": "cipher",
  "resident_model_id": "local:liquid-2.6b",
  "resident_model_family": "liquid",
  "binding_state": "DEGRADED",
  "availability_state": "AVAILABLE",
  "runtime_state": "UNKNOWN",
  "execution_node": "local-windows",
  "degraded_reason": "resident_runtime_unverified",
  "last_verified_at": "2026-10-06T09:00:00.000Z"
}
```

An observed `NOT_LOADABLE` runtime uses `resident_runtime_unavailable`. Runtime readiness is not
inferred from the existence of a model selection or a worker assignment.

## Canonical transport

```text
GET /api/resident/binding        (capability.read — auto-approved read; no approval dialog)
→ covert.resident-binding.v1     (the frozen projection; derived on every read)
```

Transport law: the route returns the projection only — never Model Manager inventory; it holds no cache
and no UI truth, so a reload or backend restart re-derives the same verdict from canonical sources.
There is no event bus for this slice; consumers re-read on demand.
