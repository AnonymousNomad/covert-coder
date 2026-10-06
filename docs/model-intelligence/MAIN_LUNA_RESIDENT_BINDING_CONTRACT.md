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
| `last_verified_at` | ISO time \| null | when runtime evidence was observed |

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

## Integration seam

The service is composed in the backend process that owns Model Manager (same process as Model Access).
Route/event exposure for the workstation shell is the next backend integration step (owned by Model
Intelligence); until then Main Luna consumes the service through the backend composition layer, not by
importing inventory internals.
