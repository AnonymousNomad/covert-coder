# C1-02 — Canonical Route Ownership Decisions

**Decision checkpoint:** C1-02 route ownership decision checkpoint
**Status:** IMPLEMENTED; C1-02 acceptance is gated by the accompanying route-drift and live-probe tests.

## Ownership direction

- Typed server registrations own V1 behavior.
- OpenAPI is the public operation description generated from typed registrations.
- Authority policy enrollment remains in the existing canonical policy/route descriptor owners.
- The façade routes by HTTP method plus canonical path. Legacy is a narrow compatibility boundary; unknown routes do not default to legacy.
- `start:legacy` is development-only. Its untyped workflow plan/apply operations are denied by the V1 façade.

## Counts

| Measure | Before | Current |
| --- | ---: | ---: |
| OpenAPI operations | 235 | 236 |
| OpenAPI paths | 223 | 224 |
| Typed registrations | 236 | 236 |
| Typed prefix registrations | — | 0 |
| Typed registrations selected to legacy | 35 | 0 |
| Documented operations without selected-backend handler | 31 | 0 |
| Legacy-only operations formerly routed to typed without typed registration | 8 | 0 |
| Explicit legacy compatibility adapters | — | 1 |
| Explicit out-of-V1 legacy operations | — | 14 |
| Explicit internal OpenAPI exclusions | — | 0 |
| Authority typed routes / conflicts / unclassified / waivers | 236 / 0 / 0 / 20 | 236 / 0 / 0 / 20 |

## Per-operation disposition: typed operations previously routed to legacy

| Operation | OpenAPI before → current | Typed owner | Legacy handler | Current façade | Authority / waiver | Decision |
| --- | --- | --- | --- | --- | --- | --- |
| GET /api/training/datasets | DOCUMENTED → DOCUMENTED | node/src/routes/dataset.ts | none | ts | ENROLLED_CENTRAL | MOVE FACADE TO TYPED |
| POST /api/training/datasets | DOCUMENTED → DOCUMENTED | node/src/routes/dataset.ts | none | ts | ENROLLED_DESCRIPTOR | MOVE FACADE TO TYPED |
| POST /api/training/datasets/append | DOCUMENTED → DOCUMENTED | node/src/routes/dataset.ts | none | ts | ENROLLED_DESCRIPTOR | MOVE FACADE TO TYPED |
| GET /api/training/datasets/read | DOCUMENTED → DOCUMENTED | node/src/routes/dataset.ts | none | ts | ENROLLED_CENTRAL | MOVE FACADE TO TYPED |
| POST /api/training/datasets/delete | DOCUMENTED → DOCUMENTED | node/src/routes/dataset.ts | none | ts | MIGRATION_WAIVED / READY-DESCRIPTOR | MOVE FACADE TO TYPED |
| GET /api/training/presets | DOCUMENTED → DOCUMENTED | node/src/routes/training.ts | none | ts | ENROLLED_CENTRAL | MOVE FACADE TO TYPED |
| GET /api/training/status | DOCUMENTED → DOCUMENTED | node/src/routes/training.ts | daemon/server.mjs:538 | ts | ENROLLED_CENTRAL | MOVE FACADE TO TYPED |
| POST /api/training/start | DOCUMENTED → DOCUMENTED | node/src/routes/training.ts | daemon/server.mjs:544 | ts | MIGRATION_WAIVED / READY-DESCRIPTOR | MOVE FACADE TO TYPED |
| POST /api/training/stop | DOCUMENTED → DOCUMENTED | node/src/routes/training.ts | daemon/server.mjs:548 | ts | MIGRATION_WAIVED / READY-DESCRIPTOR | MOVE FACADE TO TYPED |
| GET /api/training/checkpoints | DOCUMENTED → DOCUMENTED | node/src/routes/training.ts | none | ts | ENROLLED_CENTRAL | MOVE FACADE TO TYPED |
| POST /api/training/export-eval | DOCUMENTED → DOCUMENTED | node/src/routes/eval-export.ts | none | ts | ENROLLED_CENTRAL | MOVE FACADE TO TYPED |
| POST /api/training/export | DOCUMENTED → DOCUMENTED | node/src/routes/eval-export.ts | none | ts | ENROLLED_DESCRIPTOR | MOVE FACADE TO TYPED |
| GET /api/training/exports | DOCUMENTED → DOCUMENTED | node/src/routes/eval-export.ts | none | ts | ENROLLED_CENTRAL | MOVE FACADE TO TYPED |
| POST /api/worker-handoff/create | DOCUMENTED → DOCUMENTED | node/src/routes/worker-handoff.ts | none | ts | ENROLLED_DESCRIPTOR | MOVE FACADE TO TYPED |
| POST /api/worker-handoff/accept | DOCUMENTED → DOCUMENTED | node/src/routes/worker-handoff.ts | none | ts | ENROLLED_DESCRIPTOR | MOVE FACADE TO TYPED |
| POST /api/worker-handoff/consume | DOCUMENTED → DOCUMENTED | node/src/routes/worker-handoff.ts | none | ts | ENROLLED_DESCRIPTOR | MOVE FACADE TO TYPED |
| POST /api/worker-handoff/cancel | DOCUMENTED → DOCUMENTED | node/src/routes/worker-handoff.ts | none | ts | ENROLLED_DESCRIPTOR | MOVE FACADE TO TYPED |
| GET /api/worker-handoff/list | DOCUMENTED → DOCUMENTED | node/src/routes/worker-handoff.ts | none | ts | ENROLLED_CENTRAL | MOVE FACADE TO TYPED |
| GET /api/worker-handoff/get | DOCUMENTED → DOCUMENTED | node/src/routes/worker-handoff.ts | none | ts | ENROLLED_CENTRAL | MOVE FACADE TO TYPED |
| GET /api/worker-handoff/context | DOCUMENTED → DOCUMENTED | node/src/routes/worker-handoff.ts | none | ts | ENROLLED_CENTRAL | MOVE FACADE TO TYPED |
| POST /api/resource/admission | DOCUMENTED → DOCUMENTED | node/src/routes/resource-admission.ts | none | ts | ENROLLED_CENTRAL | MOVE FACADE TO TYPED |
| GET /api/provenance/runs | DOCUMENTED → DOCUMENTED | node/src/routes/provenance.ts | none | ts | ENROLLED_CENTRAL | MOVE FACADE TO TYPED |
| GET /api/provenance/run | DOCUMENTED → DOCUMENTED | node/src/routes/provenance.ts | none | ts | ENROLLED_CENTRAL | MOVE FACADE TO TYPED |
| GET /api/mission/receipt | DOCUMENTED → DOCUMENTED | node/src/routes/provenance.ts | none | ts | ENROLLED_CENTRAL | MOVE FACADE TO TYPED |
| GET /api/harness/attempts | DOCUMENTED → DOCUMENTED | node/src/routes/attempts.ts | none | ts | ENROLLED_CENTRAL | MOVE FACADE TO TYPED |
| GET /api/harness/attempt | DOCUMENTED → DOCUMENTED | node/src/routes/attempts.ts | none | ts | ENROLLED_CENTRAL | MOVE FACADE TO TYPED |
| GET /api/harness/attempt/events | DOCUMENTED → DOCUMENTED | node/src/routes/attempts.ts | none | ts | ENROLLED_CENTRAL | MOVE FACADE TO TYPED |
| GET /api/readiness | DOCUMENTED → DOCUMENTED | node/src/routes/readiness.ts | none | ts | ENROLLED_CENTRAL | MOVE FACADE TO TYPED |
| GET /api/egress/manifest | DOCUMENTED → DOCUMENTED | node/src/routes/egress-manifest.ts | none | ts | ENROLLED_CENTRAL | MOVE FACADE TO TYPED |
| POST /api/workbench/worktree/create | DOCUMENTED → DOCUMENTED | node/src/routes/workbenches.ts | none | ts | ENROLLED_DESCRIPTOR | MOVE FACADE TO TYPED |
| GET /api/workbench/worktree/list | DOCUMENTED → DOCUMENTED | node/src/routes/workbenches.ts | none | ts | ENROLLED_CENTRAL | MOVE FACADE TO TYPED |
| POST /api/workbench/worktree/merge | DOCUMENTED → DOCUMENTED | node/src/routes/workbenches.ts | none | ts | ENROLLED_DESCRIPTOR | MOVE FACADE TO TYPED |
| POST /api/workbench/worktree/discard | DOCUMENTED → DOCUMENTED | node/src/routes/workbenches.ts | none | ts | ENROLLED_DESCRIPTOR | MOVE FACADE TO TYPED |
| GET /api/system-map/snapshot | DOCUMENTED → DOCUMENTED | node/src/routes/system-map.ts | none | ts | ENROLLED_CENTRAL | MOVE FACADE TO TYPED |
| GET /api/openapi.json | NOT_DOCUMENTED_RAW → DOCUMENTED | node/src/openapi.ts | none | ts | ENROLLED_CENTRAL | MOVE FACADE TO TYPED |

All these registrations are public OpenAPI operations after the raw discovery route was documented. Every one now targets the typed server. Detailed request and response summaries, caller references, and reasons are in the machine-readable artifact.

## Legacy-only and development-only operations

| Operation | Live caller assessment | Current façade | Decision |
| --- | --- | --- | --- |
| GET /api/git/diff | No GET caller. app.js:613 uses POST /api/git/diff, the typed V1 operation. | deny | OUT OF V1 — REMOVE FROM RELEASE SURFACE |
| GET /api/git/log | No GET caller. app.js:1342 uses POST /api/git/log, the typed V1 operation. | deny | OUT OF V1 — REMOVE FROM RELEASE SURFACE |
| GET /api/models | No exact-method caller found in app.js or browser/src; V1 uses typed plural model routes. | deny | OUT OF V1 — REMOVE FROM RELEASE SURFACE |
| POST /api/handoff/continue | No current supported caller found; typed worker-handoff operations own V1. | deny | OUT OF V1 — REMOVE FROM RELEASE SURFACE |
| POST /api/handoff/propose | No current supported caller found; typed worker-handoff operations own V1. | deny | OUT OF V1 — REMOVE FROM RELEASE SURFACE |
| POST /api/providers/chat | No supported current caller found; V1 chat uses POST /api/chat with canonical provider resolution. | deny | OUT OF V1 — REMOVE FROM RELEASE SURFACE |
| POST /api/workflow/apply | app.js development-only start:legacy caller; excluded from the default V1 release product and denied at the façade. | deny | OUT OF V1 — REMOVE FROM RELEASE SURFACE |
| POST /api/workflow/plan | app.js development-only start:legacy caller; excluded from the default V1 release product and denied at the façade. | deny | OUT OF V1 — REMOVE FROM RELEASE SURFACE |
| GET /api/blueprint | No current supported frontend/client caller or V1 requirement was found for the legacy-only blueprint endpoint. | deny | OUT OF V1 — REMOVE FROM RELEASE SURFACE |
| GET /api/model/status | The singular legacy model-status operation has no current caller; the V1 model client uses the typed plural /api/models/status contract. | deny | OUT OF V1 — REMOVE FROM RELEASE SURFACE |
| POST /api/model/start | The singular legacy model-start operation has no current caller; the V1 model client uses the typed plural /api/models/start contract. | deny | OUT OF V1 — REMOVE FROM RELEASE SURFACE |
| POST /api/model/stop | The singular legacy model-stop operation has no current caller; the V1 model client uses the typed plural /api/models/stop contract. | deny | OUT OF V1 — REMOVE FROM RELEASE SURFACE |
| POST /api/arena/run | No current supported caller or V1 requirement was found for this legacy-only arena endpoint. | deny | OUT OF V1 — REMOVE FROM RELEASE SURFACE |
| POST /api/operator | No current supported caller or V1 requirement was found for this legacy-only operator endpoint. | deny | OUT OF V1 — REMOVE FROM RELEASE SURFACE |

## Explicit compatibility adapter

The only retained HTTP legacy adapter is `GET /api/diagnostics`, used by the development-only legacy UI. It has an exact `capability.read` Authority policy. The legacy `?clear=` form is rejected by `legacyOperation()` before handler dispatch because it mutates diagnostics; read authority cannot authorize that side effect. This adapter is not a V1 product API.

## Training status contract

`GET /api/training/status` now selects the typed route. The supervised live probe returned `{state:"idle"}` from the façade and direct typed route. The legacy manager response has `{active, logs, jobs}` and is observably a different schema. The V1 API contract is the typed `TrainingStatusResponse`; the default V1 browser has no direct caller requiring the legacy shape. Training start uses typed `{dataset_id,preset?,approved:true}` and typed status response; legacy start uses `{id,approved:true}` and `{id,status}`. Stop likewise has a typed `{stopped,reason?}` result versus legacy `{status}`. Their Authority migration waivers remain in place; this route slice did not execute training.

## Egress manifest

`GET /api/egress/manifest` is a typed public read route with `capability.read`. The façade now selects typed; the live supervised probe returned HTTP 200 with the typed envelope and capabilities. This is route ownership only. C4-02 process-level Local-Only egress remains blocked and is not changed or closed here.

## Raw OpenAPI discovery route

`GET /api/openapi.json` is PUBLIC API, not internal. It is now included in generated `common/openapi.json` with an unconstrained JSON response schema (`z.any()`), dispatched raw by the typed server, and probed through the façade. No unexplained internal exclusion remains.

## Prefix and waiver audit

The frozen source inventory has 9 prefix predicates. Each is listed with concrete source literal and disposition in the JSON. Static source extraction is a review tripwire only: typed ownership derives from buildRoutes(), OpenAPI parity derives from generateOpenApi(), Authority is tested by the accepted route-authority gate, and representative selection is live-probed.

| Method and source prefix | Prefix kind | Canonical typed root | Legacy disposition | Dynamic path/query treatment |
| --- | --- | --- | --- | --- |
| GET /api/academy/certificate? | QUERY_VARIANT_PREFIX | GET /api/academy/certificate | TYPED_CANONICAL_OWNER (typed-server) | The source condition is a query-string prefix for the canonical root operation; the typed registration is exact, so path descendants are not part of this API. |
| GET /api/academy/session | PATH_PREFIX | GET /api/academy/session | TYPED_CANONICAL_OWNER (typed-server) | The legacy source matches descendants, but the V1 facade dispatches only explicitly registered typed routes or reviewed exceptions; unregistered descendants do not inherit legacy ownership. |
| GET /api/dap/state? | QUERY_VARIANT_PREFIX | GET /api/dap/state | TYPED_CANONICAL_OWNER (typed-server) | The source condition is a query-string prefix for the canonical root operation; the typed registration is exact, so path descendants are not part of this API. |
| GET /api/diagnostics?clear= | QUERY_VARIANT_PREFIX | none | LEGACY_COMPATIBILITY (start:legacy developer UI) | This specific legacy clear query is a mutation; the diagnostics compatibility adapter rejects it before handler dispatch. |
| GET /api/file? | QUERY_VARIANT_PREFIX | GET /api/file | TYPED_CANONICAL_OWNER (typed-server) | The source condition is a query-string prefix for the canonical root operation; the typed registration is exact, so path descendants are not part of this API. |
| GET /api/git/diff | PATH_PREFIX | none | OUT_OF_V1 (V1 facade contract) | The legacy source matches descendants, but the V1 facade dispatches only explicitly registered typed routes or reviewed exceptions; unregistered descendants do not inherit legacy ownership. |
| GET /api/git/log | PATH_PREFIX | none | OUT_OF_V1 (V1 facade contract) | The legacy source matches descendants, but the V1 facade dispatches only explicitly registered typed routes or reviewed exceptions; unregistered descendants do not inherit legacy ownership. |
| GET /api/model/ready? | QUERY_VARIANT_PREFIX | GET /api/model/ready | TYPED_CANONICAL_OWNER (typed-server) | The source condition is a query-string prefix for the canonical root operation; the typed registration is exact, so path descendants are not part of this API. |
| GET /api/search? | QUERY_VARIANT_PREFIX | GET /api/search | TYPED_CANONICAL_OWNER (typed-server) | The source condition is a query-string prefix for the canonical root operation; the typed registration is exact, so path descendants are not part of this API. |

The 20 existing Authority migration waivers are retained unchanged: 12 DAP architecture decisions, 5 LSP ready-descriptor items, and 3 training items. Each closes only when the route receives exactly one accepted Authority disposition and the waiver entry/count is removed in the Authority owner’s work.

## Permanent gate and probes

- `tests/arch/route-drift.test.ts`: runtime typed registrations equal OpenAPI operations and public façade entries; unique method/path/matcher identities; no registration-order shadows; legacy source branches have a typed, explicit compatibility, out-of-V1, internal-health, or façade-preflight disposition; frozen reproduced mismatches cannot regress.
- `scripts/build-facade-map.mjs --check`: committed method-aware map must reproduce from runtime registrations, OpenAPI, explicit exceptions, and reviewed legacy source inventory.
- `tests/unit/test-facade.mjs`: method isolation, exact/prefix precedence, unknown and out-of-V1 no-fallthrough, strict v2 map loading.
- Supervised live probes cover health, training status typed-vs-legacy shape, egress manifest, diagnostics compatibility plus clear denial, workflow out-of-V1 denial, and raw OpenAPI.
- Existing `tests/arch/route-authority-coverage.test.ts` now requires each typed method/path to have exactly one method-aware typed façade owner; migration waivers remain pinned at 20.

## C4-02 handoff preserved

**C4-02 remains BLOCKED — V1 BLOCKER.** Process-level and legacy egress is outside canonical Local-Only enforcement. This route slice does not claim global Local-Only closure; the blocker remains fixable after architectural owner assignment.

## Evidence and limits

Frozen reproduction SHA: 61f3201d65987531618c671977fe8c5174377a8c. Implementation base: 61f3201d65987531618c671977fe8c5174377a8c. This decision artifact records source-level caller references; literal-reference absence is not proof that an undiscovered external client does not exist. The supported V1 frontend is the typed `start`/`dev` path; `start:legacy` remains a development-only compatibility surface.

### GET /api/training/datasets

- **Decision:** MOVE FACADE TO TYPED — A typed registered handler and public OpenAPI contract already exist; the legacy-selected backend has no matching handler or is a duplicate compatibility implementation. Typed owns V1 behavior.
- **OpenAPI:** before DOCUMENTED; current DOCUMENTED.
- **Typed handler:** node/src/routes/dataset.ts.
- **Legacy handler evidence:** none for this method/path.
- **Facade:** legacy (implicit-default) → ts (PUBLIC_TYPED).
- **V1 requirement:** YES — public typed operation in the frozen V1 API surface. **Authority:** ENROLLED_CENTRAL; operation capability.read; waiver none.
- **Request shape:** [].
- **Typed response shape:** {"type":"object","required":["datasets"],"properties":{"datasets":{"type":"array","items":{"type":"object","required":["id","name","count","bytes","dup_skipped","created_at","updated_at"],"properties":{"id":{"type":"string","minLength":1},"name":{"type":"string","minLength":1},"count":{"type":"integer","minimum":0,"maximum":9007199254740991},"bytes":{"type":"integer","minimum":0,"maximum":9007199254740991},"dup_skipped":{"type":"integer","minimum":0,"maximum":9007199254740991},"created_at":{"type":"string","minLength":1},"updated_at":{"type":"string","minLength":1}},"additionalProperties":false}}},"additionalProperties":false}.
- **Legacy response shape:** "NO_MATCHING_LEGACY_HANDLER".
- **Frontend path references:** none found by bounded literal scan.
- **Backend/internal path references:** none found outside route/handler source by bounded literal scan.
- **Legacy request shape:** "not applicable".

### POST /api/training/datasets

- **Decision:** MOVE FACADE TO TYPED — A typed registered handler and public OpenAPI contract already exist; the legacy-selected backend has no matching handler or is a duplicate compatibility implementation. Typed owns V1 behavior.
- **OpenAPI:** before DOCUMENTED; current DOCUMENTED.
- **Typed handler:** node/src/routes/dataset.ts.
- **Legacy handler evidence:** none for this method/path.
- **Facade:** legacy (implicit-default) → ts (PUBLIC_TYPED).
- **V1 requirement:** YES — public typed operation in the frozen V1 API surface. **Authority:** ENROLLED_DESCRIPTOR; operation route-owned/no central operation; waiver none.
- **Request shape:** {"type":"object","required":["name"],"properties":{"name":{"type":"string","minLength":3,"maxLength":64}},"additionalProperties":false}.
- **Typed response shape:** {"type":"object","required":["id","name","count","bytes","dup_skipped","created_at","updated_at"],"properties":{"id":{"type":"string","minLength":1},"name":{"type":"string","minLength":1},"count":{"type":"integer","minimum":0,"maximum":9007199254740991},"bytes":{"type":"integer","minimum":0,"maximum":9007199254740991},"dup_skipped":{"type":"integer","minimum":0,"maximum":9007199254740991},"created_at":{"type":"string","minLength":1},"updated_at":{"type":"string","minLength":1}},"additionalProperties":false}.
- **Legacy response shape:** "NO_MATCHING_LEGACY_HANDLER".
- **Frontend path references:** none found by bounded literal scan.
- **Backend/internal path references:** none found outside route/handler source by bounded literal scan.
- **Legacy request shape:** "not applicable".

### POST /api/training/datasets/append

- **Decision:** MOVE FACADE TO TYPED — A typed registered handler and public OpenAPI contract already exist; the legacy-selected backend has no matching handler or is a duplicate compatibility implementation. Typed owns V1 behavior.
- **OpenAPI:** before DOCUMENTED; current DOCUMENTED.
- **Typed handler:** node/src/routes/dataset.ts.
- **Legacy handler evidence:** none for this method/path.
- **Facade:** legacy (implicit-default) → ts (PUBLIC_TYPED).
- **V1 requirement:** YES — public typed operation in the frozen V1 API surface. **Authority:** ENROLLED_DESCRIPTOR; operation route-owned/no central operation; waiver none.
- **Request shape:** {"type":"object","required":["id","samples"],"properties":{"id":{"type":"string","minLength":1,"maxLength":128},"samples":{"type":"array","minItems":1,"maxItems":1000,"items":{"anyOf":[{"type":"object","required":["text"],"properties":{"text":{"type":"string"}},"additionalProperties":false},{"type":"object","required":["input","output"],"properties":{"input":{"type":"string"},"output":{"type":"string"}},"additionalProperties":false}]}}},"additionalProperties":false}.
- **Typed response shape:** {"type":"object","required":["accepted","rejected_dupes","rejected_invalid","errors"],"properties":{"accepted":{"type":"integer","minimum":0,"maximum":9007199254740991},"rejected_dupes":{"type":"integer","minimum":0,"maximum":9007199254740991},"rejected_invalid":{"type":"integer","minimum":0,"maximum":9007199254740991},"errors":{"type":"array","maxItems":10,"items":{"type":"string"}}},"additionalProperties":false}.
- **Legacy response shape:** "NO_MATCHING_LEGACY_HANDLER".
- **Frontend path references:** none found by bounded literal scan.
- **Backend/internal path references:** none found outside route/handler source by bounded literal scan.
- **Legacy request shape:** "not applicable".

### GET /api/training/datasets/read

- **Decision:** MOVE FACADE TO TYPED — A typed registered handler and public OpenAPI contract already exist; the legacy-selected backend has no matching handler or is a duplicate compatibility implementation. Typed owns V1 behavior.
- **OpenAPI:** before DOCUMENTED; current DOCUMENTED.
- **Typed handler:** node/src/routes/dataset.ts.
- **Legacy handler evidence:** none for this method/path.
- **Facade:** legacy (implicit-default) → ts (PUBLIC_TYPED).
- **V1 requirement:** YES — public typed operation in the frozen V1 API surface. **Authority:** ENROLLED_CENTRAL; operation capability.read; waiver none.
- **Request shape:** [{"name":"id","in":"query","required":true,"schema":{"type":"string","minLength":1,"maxLength":128}},{"name":"limit","in":"query","required":false,"schema":{"type":"integer","minimum":1,"maximum":500}},{"name":"offset","in":"query","required":false,"schema":{"type":"integer","minimum":0,"maximum":9007199254740991}}].
- **Typed response shape:** {"type":"object","required":["total","offset","samples"],"properties":{"total":{"type":"integer","minimum":0,"maximum":9007199254740991},"offset":{"type":"integer","minimum":0,"maximum":9007199254740991},"samples":{"type":"array","items":{"type":"object","additionalProperties":{}}}},"additionalProperties":false}.
- **Legacy response shape:** "NO_MATCHING_LEGACY_HANDLER".
- **Frontend path references:** none found by bounded literal scan.
- **Backend/internal path references:** none found outside route/handler source by bounded literal scan.
- **Legacy request shape:** "not applicable".

### POST /api/training/datasets/delete

- **Decision:** MOVE FACADE TO TYPED — A typed registered handler and public OpenAPI contract already exist; the legacy-selected backend has no matching handler or is a duplicate compatibility implementation. Typed owns V1 behavior.
- **OpenAPI:** before DOCUMENTED; current DOCUMENTED.
- **Typed handler:** node/src/routes/dataset.ts.
- **Legacy handler evidence:** none for this method/path.
- **Facade:** legacy (implicit-default) → ts (PUBLIC_TYPED).
- **V1 requirement:** YES — public typed operation in the frozen V1 API surface. **Authority:** MIGRATION_WAIVED; operation route-owned/no central operation; waiver READY-DESCRIPTOR.
- **Request shape:** {"type":"object","required":["id"],"properties":{"id":{"type":"string","minLength":1,"maxLength":128}},"additionalProperties":false}.
- **Typed response shape:** {"type":"object","required":["deleted"],"properties":{"deleted":{"type":"boolean"}},"additionalProperties":false}.
- **Legacy response shape:** "NO_MATCHING_LEGACY_HANDLER".
- **Frontend path references:** none found by bounded literal scan.
- **Backend/internal path references:** none found outside route/handler source by bounded literal scan.
- **Legacy request shape:** "not applicable".

### GET /api/training/presets

- **Decision:** MOVE FACADE TO TYPED — A typed registered handler and public OpenAPI contract already exist; the legacy-selected backend has no matching handler or is a duplicate compatibility implementation. Typed owns V1 behavior.
- **OpenAPI:** before DOCUMENTED; current DOCUMENTED.
- **Typed handler:** node/src/routes/training.ts.
- **Legacy handler evidence:** none for this method/path.
- **Facade:** legacy (implicit-default) → ts (PUBLIC_TYPED).
- **V1 requirement:** YES — public typed operation in the frozen V1 API surface. **Authority:** ENROLLED_CENTRAL; operation capability.read; waiver none.
- **Request shape:** [].
- **Typed response shape:** {"type":"object","required":["presets"],"properties":{"presets":{"type":"array","items":{"type":"object","required":["key","label","r","lora_alpha","learning_rate","epochs","per_device_batch","gradient_accumulation","max_seq_len","fp16","bf16"],"properties":{"key":{"type":"string","minLength":1},"label":{"type":"string","minLength":1},"r":{"type":"integer","minimum":1,"maximum":9007199254740991},"lora_alpha":{"type":"integer","minimum":1,"maximum":9007199254740991},"learning_rate":{"type":"number"},"epochs":{"type":"integer","minimum":1,"maximum":9007199254740991},"per_device_batch":{"type":"integer","minimum":1,"maximum":9007199254740991},"gradient_accumulation":{"type":"integer","minimum":1,"maximum":9007199254740991},"max_seq_len":{"type":"integer","minimum":64,"maximum":9007199254740991},"fp16":{"type":"boolean"},"bf16":{"type":"boolean"}},"additionalProperties":false}}},"additionalProperties":false}.
- **Legacy response shape:** "NO_MATCHING_LEGACY_HANDLER".
- **Frontend path references:** none found by bounded literal scan.
- **Backend/internal path references:** none found outside route/handler source by bounded literal scan.
- **Legacy request shape:** "not applicable".

### GET /api/training/status

- **Decision:** MOVE FACADE TO TYPED — The typed route already exists and defines the V1 TrainingStatusResponse. The legacy manager has a different {active,logs,jobs} contract; no default V1 frontend caller requires that legacy shape.
- **OpenAPI:** before DOCUMENTED; current DOCUMENTED.
- **Typed handler:** node/src/routes/training.ts.
- **Legacy handler evidence:** daemon/server.mjs:538.
- **Facade:** legacy (implicit-default) → ts (PUBLIC_TYPED).
- **V1 requirement:** YES — public typed operation in the frozen V1 API surface. **Authority:** ENROLLED_CENTRAL; operation capability.read; waiver none.
- **Request shape:** [].
- **Typed response shape:** {"type":"object","required":["state"],"properties":{"state":{"type":"string","enum":["idle","preparing","training","done","error"]},"id":{"type":"string","minLength":1},"preset":{"type":"string","minLength":1},"dataset_id":{"type":"string","minLength":1},"sample_count":{"type":"integer","minimum":0,"maximum":9007199254740991},"started_at":{"type":["string","null"]},"ended_at":{"type":["string","null"]},"exit_code":{"anyOf":[{"type":"integer","minimum":-9007199254740991,"maximum":9007199254740991},{"type":"null"}]},"loss_last":{"type":["number","null"]},"loss_history":{"type":"array","maxItems":500,"items":{"type":"object","required":["at","loss"],"properties":{"at":{"type":"number"},"loss":{"type":"number"}},"additionalProperties":false}},"oom":{"type":"boolean"},"oom_advice":{"type":"array","items":{"type":"string"}},"error":{"type":["string","null"]},"output_dir":{"type":"string"}},"additionalProperties":false}.
- **Legacy response shape:** "{active: {id,status}|null, logs: [], jobs: []}".
- **Frontend path references:** none found by bounded literal scan.
- **Backend/internal path references:** none found outside route/handler source by bounded literal scan.
- **Legacy request shape:** "no body".

### POST /api/training/start

- **Decision:** MOVE FACADE TO TYPED — A typed registered handler and public OpenAPI contract already exist; the legacy-selected backend has no matching handler or is a duplicate compatibility implementation. Typed owns V1 behavior.
- **OpenAPI:** before DOCUMENTED; current DOCUMENTED.
- **Typed handler:** node/src/routes/training.ts.
- **Legacy handler evidence:** daemon/server.mjs:544.
- **Facade:** legacy (implicit-default) → ts (PUBLIC_TYPED).
- **V1 requirement:** YES — public typed operation in the frozen V1 API surface. **Authority:** MIGRATION_WAIVED; operation route-owned/no central operation; waiver READY-DESCRIPTOR.
- **Request shape:** {"type":"object","required":["dataset_id","approved"],"properties":{"dataset_id":{"type":"string","minLength":1,"maxLength":128},"preset":{"type":"string","enum":["0.5b","1.5b"]},"approved":{"type":"boolean"}},"additionalProperties":false}.
- **Typed response shape:** {"type":"object","required":["state"],"properties":{"state":{"type":"string","enum":["idle","preparing","training","done","error"]},"id":{"type":"string","minLength":1},"preset":{"type":"string","minLength":1},"dataset_id":{"type":"string","minLength":1},"sample_count":{"type":"integer","minimum":0,"maximum":9007199254740991},"started_at":{"type":["string","null"]},"ended_at":{"type":["string","null"]},"exit_code":{"anyOf":[{"type":"integer","minimum":-9007199254740991,"maximum":9007199254740991},{"type":"null"}]},"loss_last":{"type":["number","null"]},"loss_history":{"type":"array","maxItems":500,"items":{"type":"object","required":["at","loss"],"properties":{"at":{"type":"number"},"loss":{"type":"number"}},"additionalProperties":false}},"oom":{"type":"boolean"},"oom_advice":{"type":"array","items":{"type":"string"}},"error":{"type":["string","null"]},"output_dir":{"type":"string"}},"additionalProperties":false}.
- **Legacy response shape:** "{id, status:\"running\"}".
- **Frontend path references:** none found by bounded literal scan.
- **Backend/internal path references:** none found outside route/handler source by bounded literal scan.
- **Legacy request shape:** "{id, approved:true}".

### POST /api/training/stop

- **Decision:** MOVE FACADE TO TYPED — A typed registered handler and public OpenAPI contract already exist; the legacy-selected backend has no matching handler or is a duplicate compatibility implementation. Typed owns V1 behavior.
- **OpenAPI:** before DOCUMENTED; current DOCUMENTED.
- **Typed handler:** node/src/routes/training.ts.
- **Legacy handler evidence:** daemon/server.mjs:548.
- **Facade:** legacy (implicit-default) → ts (PUBLIC_TYPED).
- **V1 requirement:** YES — public typed operation in the frozen V1 API surface. **Authority:** MIGRATION_WAIVED; operation route-owned/no central operation; waiver READY-DESCRIPTOR.
- **Request shape:** {"type":"object","properties":{},"additionalProperties":false}.
- **Typed response shape:** {"type":"object","required":["stopped"],"properties":{"stopped":{"type":"boolean"},"reason":{"type":"string"}},"additionalProperties":false}.
- **Legacy response shape:** "{status:\"idle\"|\"stopped\"}".
- **Frontend path references:** none found by bounded literal scan.
- **Backend/internal path references:** none found outside route/handler source by bounded literal scan.
- **Legacy request shape:** "no body".

### GET /api/training/checkpoints

- **Decision:** MOVE FACADE TO TYPED — A typed registered handler and public OpenAPI contract already exist; the legacy-selected backend has no matching handler or is a duplicate compatibility implementation. Typed owns V1 behavior.
- **OpenAPI:** before DOCUMENTED; current DOCUMENTED.
- **Typed handler:** node/src/routes/training.ts.
- **Legacy handler evidence:** none for this method/path.
- **Facade:** legacy (implicit-default) → ts (PUBLIC_TYPED).
- **V1 requirement:** YES — public typed operation in the frozen V1 API surface. **Authority:** ENROLLED_CENTRAL; operation capability.read; waiver none.
- **Request shape:** [{"name":"job_id","in":"query","required":false,"schema":{"type":"string","minLength":1,"maxLength":64}}].
- **Typed response shape:** {"type":"object","required":["checkpoints"],"properties":{"checkpoints":{"type":"array","maxItems":3,"items":{"type":"object","required":["name","best_eval_loss"],"properties":{"name":{"type":"string"},"best_eval_loss":{"type":["number","null"]}},"additionalProperties":false}}},"additionalProperties":false}.
- **Legacy response shape:** "NO_MATCHING_LEGACY_HANDLER".
- **Frontend path references:** none found by bounded literal scan.
- **Backend/internal path references:** none found outside route/handler source by bounded literal scan.
- **Legacy request shape:** "not applicable".

### POST /api/training/export-eval

- **Decision:** MOVE FACADE TO TYPED — A typed registered handler and public OpenAPI contract already exist; the legacy-selected backend has no matching handler or is a duplicate compatibility implementation. Typed owns V1 behavior.
- **OpenAPI:** before DOCUMENTED; current DOCUMENTED.
- **Typed handler:** node/src/routes/eval-export.ts.
- **Legacy handler evidence:** none for this method/path.
- **Facade:** legacy (implicit-default) → ts (PUBLIC_TYPED).
- **V1 requirement:** YES — public typed operation in the frozen V1 API surface. **Authority:** ENROLLED_CENTRAL; operation capability.read; waiver none.
- **Request shape:** {"type":"object","required":["job_id"],"properties":{"job_id":{"type":"string","minLength":1,"maxLength":64}},"additionalProperties":false}.
- **Typed response shape:** {"type":"object","required":["passed","reasons","final_loss","evaluated_at"],"properties":{"passed":{"type":"boolean"},"reasons":{"type":"array","items":{"type":"string"}},"final_loss":{"type":["number","null"]},"evaluated_at":{"type":"string","minLength":1}},"additionalProperties":false}.
- **Legacy response shape:** "NO_MATCHING_LEGACY_HANDLER".
- **Frontend path references:** none found by bounded literal scan.
- **Backend/internal path references:** none found outside route/handler source by bounded literal scan.
- **Legacy request shape:** "not applicable".

### POST /api/training/export

- **Decision:** MOVE FACADE TO TYPED — A typed registered handler and public OpenAPI contract already exist; the legacy-selected backend has no matching handler or is a duplicate compatibility implementation. Typed owns V1 behavior.
- **OpenAPI:** before DOCUMENTED; current DOCUMENTED.
- **Typed handler:** node/src/routes/eval-export.ts.
- **Legacy handler evidence:** none for this method/path.
- **Facade:** legacy (implicit-default) → ts (PUBLIC_TYPED).
- **V1 requirement:** YES — public typed operation in the frozen V1 API surface. **Authority:** ENROLLED_DESCRIPTOR; operation route-owned/no central operation; waiver none.
- **Request shape:** {"type":"object","required":["job_id"],"properties":{"job_id":{"type":"string","minLength":1,"maxLength":64},"quant":{"type":"string","enum":["Q4_K_M","Q5_K_M","Q8_0"]}},"additionalProperties":false}.
- **Typed response shape:** {"type":"object","required":["manifest"],"properties":{"manifest":{"type":"object","required":["schema_version","job_id","kind","quant_target","status","source_files","created_at"],"properties":{"schema_version":{"type":"number"},"job_id":{"type":"string","minLength":1},"kind":{"type":"string","minLength":1},"quant_target":{"type":"string","minLength":1},"status":{"type":"string","minLength":1},"source_files":{"type":"array","items":{"type":"object","required":["name","bytes","sha256"],"properties":{"name":{"type":"string"},"bytes":{"type":"integer","minimum":0,"maximum":9007199254740991},"sha256":{"type":"string","minLength":64,"maxLength":64}},"additionalProperties":false}},"created_at":{"type":"string","minLength":1}},"additionalProperties":false}},"additionalProperties":false}.
- **Legacy response shape:** "NO_MATCHING_LEGACY_HANDLER".
- **Frontend path references:** none found by bounded literal scan.
- **Backend/internal path references:** none found outside route/handler source by bounded literal scan.
- **Legacy request shape:** "not applicable".

### GET /api/training/exports

- **Decision:** MOVE FACADE TO TYPED — A typed registered handler and public OpenAPI contract already exist; the legacy-selected backend has no matching handler or is a duplicate compatibility implementation. Typed owns V1 behavior.
- **OpenAPI:** before DOCUMENTED; current DOCUMENTED.
- **Typed handler:** node/src/routes/eval-export.ts.
- **Legacy handler evidence:** none for this method/path.
- **Facade:** legacy (implicit-default) → ts (PUBLIC_TYPED).
- **V1 requirement:** YES — public typed operation in the frozen V1 API surface. **Authority:** ENROLLED_CENTRAL; operation capability.read; waiver none.
- **Request shape:** [].
- **Typed response shape:** {"type":"object","required":["exports"],"properties":{"exports":{"type":"array","items":{"type":"string"}}},"additionalProperties":false}.
- **Legacy response shape:** "NO_MATCHING_LEGACY_HANDLER".
- **Frontend path references:** none found by bounded literal scan.
- **Backend/internal path references:** none found outside route/handler source by bounded literal scan.
- **Legacy request shape:** "not applicable".

### POST /api/worker-handoff/create

- **Decision:** MOVE FACADE TO TYPED — A typed registered handler and public OpenAPI contract already exist; the legacy-selected backend has no matching handler or is a duplicate compatibility implementation. Typed owns V1 behavior.
- **OpenAPI:** before DOCUMENTED; current DOCUMENTED.
- **Typed handler:** node/src/routes/worker-handoff.ts.
- **Legacy handler evidence:** none for this method/path.
- **Facade:** legacy (implicit-default) → ts (PUBLIC_TYPED).
- **V1 requirement:** YES — public typed operation in the frozen V1 API surface. **Authority:** ENROLLED_DESCRIPTOR; operation route-owned/no central operation; waiver none.
- **Request shape:** {"type":"object","required":["task_id","from","to","objective","next_action"],"properties":{"task_id":{"type":"string","minLength":1,"maxLength":200},"from":{"type":"object","required":["worker","provider","model","role"],"properties":{"worker":{"type":"string","minLength":1,"maxLength":200},"provider":{"type":"string","minLength":1,"maxLength":120},"model":{"type":"string","minLength":1,"maxLength":200},"role":{"type":"string","enum":["plan","act","utility","planner","coder","reviewer"]}},"additionalProperties":false},"to":{"type":"object","required":["worker","provider","model","role"],"properties":{"worker":{"type":"string","minLength":1,"maxLength":200},"provider":{"type":"string","minLength":1,"maxLength":120},"model":{"type":"string","minLength":1,"maxLength":200},"role":{"type":"string","enum":["plan","act","utility","planner","coder","reviewer"]}},"additionalProperties":false},"objective":{"type":"string","minLength":1,"maxLength":2000},"next_action":{"type":"string","maxLength":1000},"current_state":{"type":"string","maxLength":2000},"decisions":{"type":"array","maxItems":16,"items":{"type":"string","minLength":1,"maxLength":600}},"assumptions":{"type":"array","maxItems":16,"items":{"type":"string","minLength":1,"maxLength":600}},"constraints":{"type":"array","maxItems":16,"items":{"type":"string","minLength":1,"maxLength":600}},"open_questions":{"type":"array","maxItems":16,"items":{"type":"string","minLength":1,"maxLength":600}},"failure_context":{"type":"object","required":["classification","last_successful_stage","side_effects","retryable","recommended_continuation"],"properties":{"classification":{"type":"string","minLength":1,"maxLength":120},"last_successful_stage":{"anyOf":[{"type":"string","maxLength":200},{"type":"null"}]},"side_effects":{"type":"string","enum":["none","partial","unknown","complete"]},"retryable":{"type":"boolean"},"recommended_continuation":{"anyOf":[{"type":"string","maxLength":500},{"type":"null"}]}},"additionalProperties":false},"supersedes":{"type":"array","maxItems":8,"items":{"type":"string","format":"uuid"}},"related":{"type":"array","maxItems":8,"items":{"type":"string","format":"uuid"}}},"additionalProperties":false}.
- **Typed response shape:** {"type":"object","required":["handoff"],"properties":{"handoff":{"type":"object","required":["handoff_id","state","workspace_id","project_id","task_id","workflow_id","stage_id","from","to","objective","current_state","worker_claims","verified_facts","decisions","assumptions","constraints","open_questions","next_action","artifacts","files_or_components","evidence_refs","verification_refs","memory_refs","failure_context","created_at","accepted_at","consumed_at","supersedes","related"],"properties":{"handoff_id":{"type":"string","format":"uuid"},"state":{"type":"string","enum":["CREATED","ACCEPTED","CONSUMED","FAILED","CANCELLED"]},"workspace_id":{"type":"string","minLength":1,"maxLength":1000},"project_id":{"anyOf":[{"type":"string","maxLength":200},{"type":"null"}]},"task_id":{"type":"string","minLength":1,"maxLength":200},"workflow_id":{"anyOf":[{"type":"string","maxLength":200},{"type":"null"}]},"stage_id":{"anyOf":[{"type":"string","maxLength":200},{"type":"null"}]},"from":{"type":"object","required":["worker","provider","model","role"],"properties":{"worker":{"type":"string","minLength":1,"maxLength":200},"provider":{"type":"string","minLength":1,"maxLength":120},"model":{"type":"string","minLength":1,"maxLength":200},"role":{"type":"string","enum":["plan","act","utility","planner","coder","reviewer"]}},"additionalProperties":false},"to":{"type":"object","required":["worker","provider","model","role"],"properties":{"worker":{"type":"string","minLength":1,"maxLength":200},"provider":{"type":"string","minLength":1,"maxLength":120},"model":{"type":"string","minLength":1,"maxLength":200},"role":{"type":"string","enum":["plan","act","utility","planner","coder","reviewer"]}},"additionalProperties":false},"objective":{"type":"string","minLength":1,"maxLength":2000},"current_state":{"type":"string","maxLength":2000},"worker_claims":{"type":"array","maxItems":16,"items":{"type":"string","maxLength":600}},"verified_facts":{"type":"array","maxItems":32,"items":{"type":"string","maxLength":600}},"decisions":{"type":"array","maxItems":16,"items":{"type":"string","maxLength":600}},"assumptions":{"type":"array","maxItems":16,"items":{"type":"string","maxLength":600}},"constraints":{"type":"array","maxItems":16,"items":{"type":"string","maxLength":600}},"open_questions":{"type":"array","maxItems":16,"items":{"type":"string","maxLength":600}},"next_action":{"type":"string","maxLength":1000},"artifacts":{"type":"array","maxItems":64,"items":{"type":"object","required":["artifact_id","type","path","sha256","stage"],"properties":{"artifact_id":{"type":"string","minLength":1,"maxLength":200},"type":{"type":"string","maxLength":80},"path":{"type":"string","maxLength":500},"sha256":{"type":"string","maxLength":128},"stage":{"type":"string","maxLength":80}},"additionalProperties":false}},"files_or_components":{"type":"array","maxItems":64,"items":{"type":"string","maxLength":300}},"evidence_refs":{"type":"array","maxItems":32,"items":{"type":"string","maxLength":300}},"verification_refs":{"type":"array","maxItems":16,"items":{"type":"string","maxLength":300}},"memory_refs":{"type":"array","maxItems":16,"items":{"type":"string","maxLength":300}},"failure_context":{"anyOf":[{"type":"object","required":["classification","last_successful_stage","side_effects","retryable","recommended_continuation"],"properties":{"classification":{"type":"string","minLength":1,"maxLength":120},"last_successful_stage":{"anyOf":[{"type":"string","maxLength":200},{"type":"null"}]},"side_effects":{"type":"string","enum":["none","partial","unknown","complete"]},"retryable":{"type":"boolean"},"recommended_continuation":{"anyOf":[{"type":"string","maxLength":500},{"type":"null"}]}},"additionalProperties":false},{"type":"null"}]},"created_at":{"type":"string"},"accepted_at":{"type":["string","null"]},"consumed_at":{"type":["string","null"]},"supersedes":{"type":"array","maxItems":8,"items":{"type":"string","format":"uuid"}},"related":{"type":"array","maxItems":8,"items":{"type":"string","format":"uuid"}}},"additionalProperties":false}},"additionalProperties":false}.
- **Legacy response shape:** "NO_MATCHING_LEGACY_HANDLER".
- **Frontend path references:** none found by bounded literal scan.
- **Backend/internal path references:** none found outside route/handler source by bounded literal scan.
- **Legacy request shape:** "not applicable".

### POST /api/worker-handoff/accept

- **Decision:** MOVE FACADE TO TYPED — A typed registered handler and public OpenAPI contract already exist; the legacy-selected backend has no matching handler or is a duplicate compatibility implementation. Typed owns V1 behavior.
- **OpenAPI:** before DOCUMENTED; current DOCUMENTED.
- **Typed handler:** node/src/routes/worker-handoff.ts.
- **Legacy handler evidence:** none for this method/path.
- **Facade:** legacy (implicit-default) → ts (PUBLIC_TYPED).
- **V1 requirement:** YES — public typed operation in the frozen V1 API surface. **Authority:** ENROLLED_DESCRIPTOR; operation route-owned/no central operation; waiver none.
- **Request shape:** {"type":"object","required":["handoff_id","to"],"properties":{"handoff_id":{"type":"string","format":"uuid"},"to":{"type":"object","required":["worker","provider","model","role"],"properties":{"worker":{"type":"string","minLength":1,"maxLength":200},"provider":{"type":"string","minLength":1,"maxLength":120},"model":{"type":"string","minLength":1,"maxLength":200},"role":{"type":"string","enum":["plan","act","utility","planner","coder","reviewer"]}},"additionalProperties":false}},"additionalProperties":false}.
- **Typed response shape:** {"type":"object","required":["handoff"],"properties":{"handoff":{"type":"object","required":["handoff_id","state","workspace_id","project_id","task_id","workflow_id","stage_id","from","to","objective","current_state","worker_claims","verified_facts","decisions","assumptions","constraints","open_questions","next_action","artifacts","files_or_components","evidence_refs","verification_refs","memory_refs","failure_context","created_at","accepted_at","consumed_at","supersedes","related"],"properties":{"handoff_id":{"type":"string","format":"uuid"},"state":{"type":"string","enum":["CREATED","ACCEPTED","CONSUMED","FAILED","CANCELLED"]},"workspace_id":{"type":"string","minLength":1,"maxLength":1000},"project_id":{"anyOf":[{"type":"string","maxLength":200},{"type":"null"}]},"task_id":{"type":"string","minLength":1,"maxLength":200},"workflow_id":{"anyOf":[{"type":"string","maxLength":200},{"type":"null"}]},"stage_id":{"anyOf":[{"type":"string","maxLength":200},{"type":"null"}]},"from":{"type":"object","required":["worker","provider","model","role"],"properties":{"worker":{"type":"string","minLength":1,"maxLength":200},"provider":{"type":"string","minLength":1,"maxLength":120},"model":{"type":"string","minLength":1,"maxLength":200},"role":{"type":"string","enum":["plan","act","utility","planner","coder","reviewer"]}},"additionalProperties":false},"to":{"type":"object","required":["worker","provider","model","role"],"properties":{"worker":{"type":"string","minLength":1,"maxLength":200},"provider":{"type":"string","minLength":1,"maxLength":120},"model":{"type":"string","minLength":1,"maxLength":200},"role":{"type":"string","enum":["plan","act","utility","planner","coder","reviewer"]}},"additionalProperties":false},"objective":{"type":"string","minLength":1,"maxLength":2000},"current_state":{"type":"string","maxLength":2000},"worker_claims":{"type":"array","maxItems":16,"items":{"type":"string","maxLength":600}},"verified_facts":{"type":"array","maxItems":32,"items":{"type":"string","maxLength":600}},"decisions":{"type":"array","maxItems":16,"items":{"type":"string","maxLength":600}},"assumptions":{"type":"array","maxItems":16,"items":{"type":"string","maxLength":600}},"constraints":{"type":"array","maxItems":16,"items":{"type":"string","maxLength":600}},"open_questions":{"type":"array","maxItems":16,"items":{"type":"string","maxLength":600}},"next_action":{"type":"string","maxLength":1000},"artifacts":{"type":"array","maxItems":64,"items":{"type":"object","required":["artifact_id","type","path","sha256","stage"],"properties":{"artifact_id":{"type":"string","minLength":1,"maxLength":200},"type":{"type":"string","maxLength":80},"path":{"type":"string","maxLength":500},"sha256":{"type":"string","maxLength":128},"stage":{"type":"string","maxLength":80}},"additionalProperties":false}},"files_or_components":{"type":"array","maxItems":64,"items":{"type":"string","maxLength":300}},"evidence_refs":{"type":"array","maxItems":32,"items":{"type":"string","maxLength":300}},"verification_refs":{"type":"array","maxItems":16,"items":{"type":"string","maxLength":300}},"memory_refs":{"type":"array","maxItems":16,"items":{"type":"string","maxLength":300}},"failure_context":{"anyOf":[{"type":"object","required":["classification","last_successful_stage","side_effects","retryable","recommended_continuation"],"properties":{"classification":{"type":"string","minLength":1,"maxLength":120},"last_successful_stage":{"anyOf":[{"type":"string","maxLength":200},{"type":"null"}]},"side_effects":{"type":"string","enum":["none","partial","unknown","complete"]},"retryable":{"type":"boolean"},"recommended_continuation":{"anyOf":[{"type":"string","maxLength":500},{"type":"null"}]}},"additionalProperties":false},{"type":"null"}]},"created_at":{"type":"string"},"accepted_at":{"type":["string","null"]},"consumed_at":{"type":["string","null"]},"supersedes":{"type":"array","maxItems":8,"items":{"type":"string","format":"uuid"}},"related":{"type":"array","maxItems":8,"items":{"type":"string","format":"uuid"}}},"additionalProperties":false}},"additionalProperties":false}.
- **Legacy response shape:** "NO_MATCHING_LEGACY_HANDLER".
- **Frontend path references:** none found by bounded literal scan.
- **Backend/internal path references:** none found outside route/handler source by bounded literal scan.
- **Legacy request shape:** "not applicable".

### POST /api/worker-handoff/consume

- **Decision:** MOVE FACADE TO TYPED — A typed registered handler and public OpenAPI contract already exist; the legacy-selected backend has no matching handler or is a duplicate compatibility implementation. Typed owns V1 behavior.
- **OpenAPI:** before DOCUMENTED; current DOCUMENTED.
- **Typed handler:** node/src/routes/worker-handoff.ts.
- **Legacy handler evidence:** none for this method/path.
- **Facade:** legacy (implicit-default) → ts (PUBLIC_TYPED).
- **V1 requirement:** YES — public typed operation in the frozen V1 API surface. **Authority:** ENROLLED_DESCRIPTOR; operation route-owned/no central operation; waiver none.
- **Request shape:** {"type":"object","required":["handoff_id"],"properties":{"handoff_id":{"type":"string","format":"uuid"}},"additionalProperties":false}.
- **Typed response shape:** {"type":"object","required":["handoff"],"properties":{"handoff":{"type":"object","required":["handoff_id","state","workspace_id","project_id","task_id","workflow_id","stage_id","from","to","objective","current_state","worker_claims","verified_facts","decisions","assumptions","constraints","open_questions","next_action","artifacts","files_or_components","evidence_refs","verification_refs","memory_refs","failure_context","created_at","accepted_at","consumed_at","supersedes","related"],"properties":{"handoff_id":{"type":"string","format":"uuid"},"state":{"type":"string","enum":["CREATED","ACCEPTED","CONSUMED","FAILED","CANCELLED"]},"workspace_id":{"type":"string","minLength":1,"maxLength":1000},"project_id":{"anyOf":[{"type":"string","maxLength":200},{"type":"null"}]},"task_id":{"type":"string","minLength":1,"maxLength":200},"workflow_id":{"anyOf":[{"type":"string","maxLength":200},{"type":"null"}]},"stage_id":{"anyOf":[{"type":"string","maxLength":200},{"type":"null"}]},"from":{"type":"object","required":["worker","provider","model","role"],"properties":{"worker":{"type":"string","minLength":1,"maxLength":200},"provider":{"type":"string","minLength":1,"maxLength":120},"model":{"type":"string","minLength":1,"maxLength":200},"role":{"type":"string","enum":["plan","act","utility","planner","coder","reviewer"]}},"additionalProperties":false},"to":{"type":"object","required":["worker","provider","model","role"],"properties":{"worker":{"type":"string","minLength":1,"maxLength":200},"provider":{"type":"string","minLength":1,"maxLength":120},"model":{"type":"string","minLength":1,"maxLength":200},"role":{"type":"string","enum":["plan","act","utility","planner","coder","reviewer"]}},"additionalProperties":false},"objective":{"type":"string","minLength":1,"maxLength":2000},"current_state":{"type":"string","maxLength":2000},"worker_claims":{"type":"array","maxItems":16,"items":{"type":"string","maxLength":600}},"verified_facts":{"type":"array","maxItems":32,"items":{"type":"string","maxLength":600}},"decisions":{"type":"array","maxItems":16,"items":{"type":"string","maxLength":600}},"assumptions":{"type":"array","maxItems":16,"items":{"type":"string","maxLength":600}},"constraints":{"type":"array","maxItems":16,"items":{"type":"string","maxLength":600}},"open_questions":{"type":"array","maxItems":16,"items":{"type":"string","maxLength":600}},"next_action":{"type":"string","maxLength":1000},"artifacts":{"type":"array","maxItems":64,"items":{"type":"object","required":["artifact_id","type","path","sha256","stage"],"properties":{"artifact_id":{"type":"string","minLength":1,"maxLength":200},"type":{"type":"string","maxLength":80},"path":{"type":"string","maxLength":500},"sha256":{"type":"string","maxLength":128},"stage":{"type":"string","maxLength":80}},"additionalProperties":false}},"files_or_components":{"type":"array","maxItems":64,"items":{"type":"string","maxLength":300}},"evidence_refs":{"type":"array","maxItems":32,"items":{"type":"string","maxLength":300}},"verification_refs":{"type":"array","maxItems":16,"items":{"type":"string","maxLength":300}},"memory_refs":{"type":"array","maxItems":16,"items":{"type":"string","maxLength":300}},"failure_context":{"anyOf":[{"type":"object","required":["classification","last_successful_stage","side_effects","retryable","recommended_continuation"],"properties":{"classification":{"type":"string","minLength":1,"maxLength":120},"last_successful_stage":{"anyOf":[{"type":"string","maxLength":200},{"type":"null"}]},"side_effects":{"type":"string","enum":["none","partial","unknown","complete"]},"retryable":{"type":"boolean"},"recommended_continuation":{"anyOf":[{"type":"string","maxLength":500},{"type":"null"}]}},"additionalProperties":false},{"type":"null"}]},"created_at":{"type":"string"},"accepted_at":{"type":["string","null"]},"consumed_at":{"type":["string","null"]},"supersedes":{"type":"array","maxItems":8,"items":{"type":"string","format":"uuid"}},"related":{"type":"array","maxItems":8,"items":{"type":"string","format":"uuid"}}},"additionalProperties":false}},"additionalProperties":false}.
- **Legacy response shape:** "NO_MATCHING_LEGACY_HANDLER".
- **Frontend path references:** none found by bounded literal scan.
- **Backend/internal path references:** none found outside route/handler source by bounded literal scan.
- **Legacy request shape:** "not applicable".

### POST /api/worker-handoff/cancel

- **Decision:** MOVE FACADE TO TYPED — A typed registered handler and public OpenAPI contract already exist; the legacy-selected backend has no matching handler or is a duplicate compatibility implementation. Typed owns V1 behavior.
- **OpenAPI:** before DOCUMENTED; current DOCUMENTED.
- **Typed handler:** node/src/routes/worker-handoff.ts.
- **Legacy handler evidence:** none for this method/path.
- **Facade:** legacy (implicit-default) → ts (PUBLIC_TYPED).
- **V1 requirement:** YES — public typed operation in the frozen V1 API surface. **Authority:** ENROLLED_DESCRIPTOR; operation route-owned/no central operation; waiver none.
- **Request shape:** {"type":"object","required":["handoff_id"],"properties":{"handoff_id":{"type":"string","format":"uuid"}},"additionalProperties":false}.
- **Typed response shape:** {"type":"object","required":["handoff"],"properties":{"handoff":{"type":"object","required":["handoff_id","state","workspace_id","project_id","task_id","workflow_id","stage_id","from","to","objective","current_state","worker_claims","verified_facts","decisions","assumptions","constraints","open_questions","next_action","artifacts","files_or_components","evidence_refs","verification_refs","memory_refs","failure_context","created_at","accepted_at","consumed_at","supersedes","related"],"properties":{"handoff_id":{"type":"string","format":"uuid"},"state":{"type":"string","enum":["CREATED","ACCEPTED","CONSUMED","FAILED","CANCELLED"]},"workspace_id":{"type":"string","minLength":1,"maxLength":1000},"project_id":{"anyOf":[{"type":"string","maxLength":200},{"type":"null"}]},"task_id":{"type":"string","minLength":1,"maxLength":200},"workflow_id":{"anyOf":[{"type":"string","maxLength":200},{"type":"null"}]},"stage_id":{"anyOf":[{"type":"string","maxLength":200},{"type":"null"}]},"from":{"type":"object","required":["worker","provider","model","role"],"properties":{"worker":{"type":"string","minLength":1,"maxLength":200},"provider":{"type":"string","minLength":1,"maxLength":120},"model":{"type":"string","minLength":1,"maxLength":200},"role":{"type":"string","enum":["plan","act","utility","planner","coder","reviewer"]}},"additionalProperties":false},"to":{"type":"object","required":["worker","provider","model","role"],"properties":{"worker":{"type":"string","minLength":1,"maxLength":200},"provider":{"type":"string","minLength":1,"maxLength":120},"model":{"type":"string","minLength":1,"maxLength":200},"role":{"type":"string","enum":["plan","act","utility","planner","coder","reviewer"]}},"additionalProperties":false},"objective":{"type":"string","minLength":1,"maxLength":2000},"current_state":{"type":"string","maxLength":2000},"worker_claims":{"type":"array","maxItems":16,"items":{"type":"string","maxLength":600}},"verified_facts":{"type":"array","maxItems":32,"items":{"type":"string","maxLength":600}},"decisions":{"type":"array","maxItems":16,"items":{"type":"string","maxLength":600}},"assumptions":{"type":"array","maxItems":16,"items":{"type":"string","maxLength":600}},"constraints":{"type":"array","maxItems":16,"items":{"type":"string","maxLength":600}},"open_questions":{"type":"array","maxItems":16,"items":{"type":"string","maxLength":600}},"next_action":{"type":"string","maxLength":1000},"artifacts":{"type":"array","maxItems":64,"items":{"type":"object","required":["artifact_id","type","path","sha256","stage"],"properties":{"artifact_id":{"type":"string","minLength":1,"maxLength":200},"type":{"type":"string","maxLength":80},"path":{"type":"string","maxLength":500},"sha256":{"type":"string","maxLength":128},"stage":{"type":"string","maxLength":80}},"additionalProperties":false}},"files_or_components":{"type":"array","maxItems":64,"items":{"type":"string","maxLength":300}},"evidence_refs":{"type":"array","maxItems":32,"items":{"type":"string","maxLength":300}},"verification_refs":{"type":"array","maxItems":16,"items":{"type":"string","maxLength":300}},"memory_refs":{"type":"array","maxItems":16,"items":{"type":"string","maxLength":300}},"failure_context":{"anyOf":[{"type":"object","required":["classification","last_successful_stage","side_effects","retryable","recommended_continuation"],"properties":{"classification":{"type":"string","minLength":1,"maxLength":120},"last_successful_stage":{"anyOf":[{"type":"string","maxLength":200},{"type":"null"}]},"side_effects":{"type":"string","enum":["none","partial","unknown","complete"]},"retryable":{"type":"boolean"},"recommended_continuation":{"anyOf":[{"type":"string","maxLength":500},{"type":"null"}]}},"additionalProperties":false},{"type":"null"}]},"created_at":{"type":"string"},"accepted_at":{"type":["string","null"]},"consumed_at":{"type":["string","null"]},"supersedes":{"type":"array","maxItems":8,"items":{"type":"string","format":"uuid"}},"related":{"type":"array","maxItems":8,"items":{"type":"string","format":"uuid"}}},"additionalProperties":false}},"additionalProperties":false}.
- **Legacy response shape:** "NO_MATCHING_LEGACY_HANDLER".
- **Frontend path references:** none found by bounded literal scan.
- **Backend/internal path references:** none found outside route/handler source by bounded literal scan.
- **Legacy request shape:** "not applicable".

### GET /api/worker-handoff/list

- **Decision:** MOVE FACADE TO TYPED — A typed registered handler and public OpenAPI contract already exist; the legacy-selected backend has no matching handler or is a duplicate compatibility implementation. Typed owns V1 behavior.
- **OpenAPI:** before DOCUMENTED; current DOCUMENTED.
- **Typed handler:** node/src/routes/worker-handoff.ts.
- **Legacy handler evidence:** none for this method/path.
- **Facade:** legacy (implicit-default) → ts (PUBLIC_TYPED).
- **V1 requirement:** YES — public typed operation in the frozen V1 API surface. **Authority:** ENROLLED_CENTRAL; operation capability.read; waiver none.
- **Request shape:** [{"name":"task_id","in":"query","required":false,"schema":{"type":"string","minLength":1,"maxLength":200}}].
- **Typed response shape:** {"type":"object","required":["handoffs"],"properties":{"handoffs":{"type":"array","items":{"type":"object","required":["handoff_id","state","workspace_id","project_id","task_id","workflow_id","stage_id","from","to","objective","current_state","worker_claims","verified_facts","decisions","assumptions","constraints","open_questions","next_action","artifacts","files_or_components","evidence_refs","verification_refs","memory_refs","failure_context","created_at","accepted_at","consumed_at","supersedes","related"],"properties":{"handoff_id":{"type":"string","format":"uuid"},"state":{"type":"string","enum":["CREATED","ACCEPTED","CONSUMED","FAILED","CANCELLED"]},"workspace_id":{"type":"string","minLength":1,"maxLength":1000},"project_id":{"anyOf":[{"type":"string","maxLength":200},{"type":"null"}]},"task_id":{"type":"string","minLength":1,"maxLength":200},"workflow_id":{"anyOf":[{"type":"string","maxLength":200},{"type":"null"}]},"stage_id":{"anyOf":[{"type":"string","maxLength":200},{"type":"null"}]},"from":{"type":"object","required":["worker","provider","model","role"],"properties":{"worker":{"type":"string","minLength":1,"maxLength":200},"provider":{"type":"string","minLength":1,"maxLength":120},"model":{"type":"string","minLength":1,"maxLength":200},"role":{"type":"string","enum":["plan","act","utility","planner","coder","reviewer"]}},"additionalProperties":false},"to":{"type":"object","required":["worker","provider","model","role"],"properties":{"worker":{"type":"string","minLength":1,"maxLength":200},"provider":{"type":"string","minLength":1,"maxLength":120},"model":{"type":"string","minLength":1,"maxLength":200},"role":{"type":"string","enum":["plan","act","utility","planner","coder","reviewer"]}},"additionalProperties":false},"objective":{"type":"string","minLength":1,"maxLength":2000},"current_state":{"type":"string","maxLength":2000},"worker_claims":{"type":"array","maxItems":16,"items":{"type":"string","maxLength":600}},"verified_facts":{"type":"array","maxItems":32,"items":{"type":"string","maxLength":600}},"decisions":{"type":"array","maxItems":16,"items":{"type":"string","maxLength":600}},"assumptions":{"type":"array","maxItems":16,"items":{"type":"string","maxLength":600}},"constraints":{"type":"array","maxItems":16,"items":{"type":"string","maxLength":600}},"open_questions":{"type":"array","maxItems":16,"items":{"type":"string","maxLength":600}},"next_action":{"type":"string","maxLength":1000},"artifacts":{"type":"array","maxItems":64,"items":{"type":"object","required":["artifact_id","type","path","sha256","stage"],"properties":{"artifact_id":{"type":"string","minLength":1,"maxLength":200},"type":{"type":"string","maxLength":80},"path":{"type":"string","maxLength":500},"sha256":{"type":"string","maxLength":128},"stage":{"type":"string","maxLength":80}},"additionalProperties":false}},"files_or_components":{"type":"array","maxItems":64,"items":{"type":"string","maxLength":300}},"evidence_refs":{"type":"array","maxItems":32,"items":{"type":"string","maxLength":300}},"verification_refs":{"type":"array","maxItems":16,"items":{"type":"string","maxLength":300}},"memory_refs":{"type":"array","maxItems":16,"items":{"type":"string","maxLength":300}},"failure_context":{"anyOf":[{"type":"object","required":["classification","last_successful_stage","side_effects","retryable","recommended_continuation"],"properties":{"classification":{"type":"string","minLength":1,"maxLength":120},"last_successful_stage":{"anyOf":[{"type":"string","maxLength":200},{"type":"null"}]},"side_effects":{"type":"string","enum":["none","partial","unknown","complete"]},"retryable":{"type":"boolean"},"recommended_continuation":{"anyOf":[{"type":"string","maxLength":500},{"type":"null"}]}},"additionalProperties":false},{"type":"null"}]},"created_at":{"type":"string"},"accepted_at":{"type":["string","null"]},"consumed_at":{"type":["string","null"]},"supersedes":{"type":"array","maxItems":8,"items":{"type":"string","format":"uuid"}},"related":{"type":"array","maxItems":8,"items":{"type":"string","format":"uuid"}}},"additionalProperties":false}}},"additionalProperties":false}.
- **Legacy response shape:** "NO_MATCHING_LEGACY_HANDLER".
- **Frontend path references:** none found by bounded literal scan.
- **Backend/internal path references:** none found outside route/handler source by bounded literal scan.
- **Legacy request shape:** "not applicable".

### GET /api/worker-handoff/get

- **Decision:** MOVE FACADE TO TYPED — A typed registered handler and public OpenAPI contract already exist; the legacy-selected backend has no matching handler or is a duplicate compatibility implementation. Typed owns V1 behavior.
- **OpenAPI:** before DOCUMENTED; current DOCUMENTED.
- **Typed handler:** node/src/routes/worker-handoff.ts.
- **Legacy handler evidence:** none for this method/path.
- **Facade:** legacy (implicit-default) → ts (PUBLIC_TYPED).
- **V1 requirement:** YES — public typed operation in the frozen V1 API surface. **Authority:** ENROLLED_CENTRAL; operation capability.read; waiver none.
- **Request shape:** [{"name":"id","in":"query","required":true,"schema":{"type":"string","format":"uuid","pattern":"^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"}}].
- **Typed response shape:** {"type":"object","required":["handoff"],"properties":{"handoff":{"type":"object","required":["handoff_id","state","workspace_id","project_id","task_id","workflow_id","stage_id","from","to","objective","current_state","worker_claims","verified_facts","decisions","assumptions","constraints","open_questions","next_action","artifacts","files_or_components","evidence_refs","verification_refs","memory_refs","failure_context","created_at","accepted_at","consumed_at","supersedes","related"],"properties":{"handoff_id":{"type":"string","format":"uuid"},"state":{"type":"string","enum":["CREATED","ACCEPTED","CONSUMED","FAILED","CANCELLED"]},"workspace_id":{"type":"string","minLength":1,"maxLength":1000},"project_id":{"anyOf":[{"type":"string","maxLength":200},{"type":"null"}]},"task_id":{"type":"string","minLength":1,"maxLength":200},"workflow_id":{"anyOf":[{"type":"string","maxLength":200},{"type":"null"}]},"stage_id":{"anyOf":[{"type":"string","maxLength":200},{"type":"null"}]},"from":{"type":"object","required":["worker","provider","model","role"],"properties":{"worker":{"type":"string","minLength":1,"maxLength":200},"provider":{"type":"string","minLength":1,"maxLength":120},"model":{"type":"string","minLength":1,"maxLength":200},"role":{"type":"string","enum":["plan","act","utility","planner","coder","reviewer"]}},"additionalProperties":false},"to":{"type":"object","required":["worker","provider","model","role"],"properties":{"worker":{"type":"string","minLength":1,"maxLength":200},"provider":{"type":"string","minLength":1,"maxLength":120},"model":{"type":"string","minLength":1,"maxLength":200},"role":{"type":"string","enum":["plan","act","utility","planner","coder","reviewer"]}},"additionalProperties":false},"objective":{"type":"string","minLength":1,"maxLength":2000},"current_state":{"type":"string","maxLength":2000},"worker_claims":{"type":"array","maxItems":16,"items":{"type":"string","maxLength":600}},"verified_facts":{"type":"array","maxItems":32,"items":{"type":"string","maxLength":600}},"decisions":{"type":"array","maxItems":16,"items":{"type":"string","maxLength":600}},"assumptions":{"type":"array","maxItems":16,"items":{"type":"string","maxLength":600}},"constraints":{"type":"array","maxItems":16,"items":{"type":"string","maxLength":600}},"open_questions":{"type":"array","maxItems":16,"items":{"type":"string","maxLength":600}},"next_action":{"type":"string","maxLength":1000},"artifacts":{"type":"array","maxItems":64,"items":{"type":"object","required":["artifact_id","type","path","sha256","stage"],"properties":{"artifact_id":{"type":"string","minLength":1,"maxLength":200},"type":{"type":"string","maxLength":80},"path":{"type":"string","maxLength":500},"sha256":{"type":"string","maxLength":128},"stage":{"type":"string","maxLength":80}},"additionalProperties":false}},"files_or_components":{"type":"array","maxItems":64,"items":{"type":"string","maxLength":300}},"evidence_refs":{"type":"array","maxItems":32,"items":{"type":"string","maxLength":300}},"verification_refs":{"type":"array","maxItems":16,"items":{"type":"string","maxLength":300}},"memory_refs":{"type":"array","maxItems":16,"items":{"type":"string","maxLength":300}},"failure_context":{"anyOf":[{"type":"object","required":["classification","last_successful_stage","side_effects","retryable","recommended_continuation"],"properties":{"classification":{"type":"string","minLength":1,"maxLength":120},"last_successful_stage":{"anyOf":[{"type":"string","maxLength":200},{"type":"null"}]},"side_effects":{"type":"string","enum":["none","partial","unknown","complete"]},"retryable":{"type":"boolean"},"recommended_continuation":{"anyOf":[{"type":"string","maxLength":500},{"type":"null"}]}},"additionalProperties":false},{"type":"null"}]},"created_at":{"type":"string"},"accepted_at":{"type":["string","null"]},"consumed_at":{"type":["string","null"]},"supersedes":{"type":"array","maxItems":8,"items":{"type":"string","format":"uuid"}},"related":{"type":"array","maxItems":8,"items":{"type":"string","format":"uuid"}}},"additionalProperties":false}},"additionalProperties":false}.
- **Legacy response shape:** "NO_MATCHING_LEGACY_HANDLER".
- **Frontend path references:** none found by bounded literal scan.
- **Backend/internal path references:** none found outside route/handler source by bounded literal scan.
- **Legacy request shape:** "not applicable".

### GET /api/worker-handoff/context

- **Decision:** MOVE FACADE TO TYPED — A typed registered handler and public OpenAPI contract already exist; the legacy-selected backend has no matching handler or is a duplicate compatibility implementation. Typed owns V1 behavior.
- **OpenAPI:** before DOCUMENTED; current DOCUMENTED.
- **Typed handler:** node/src/routes/worker-handoff.ts.
- **Legacy handler evidence:** none for this method/path.
- **Facade:** legacy (implicit-default) → ts (PUBLIC_TYPED).
- **V1 requirement:** YES — public typed operation in the frozen V1 API surface. **Authority:** ENROLLED_CENTRAL; operation capability.read; waiver none.
- **Request shape:** [{"name":"id","in":"query","required":true,"schema":{"type":"string","format":"uuid","pattern":"^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"}}].
- **Typed response shape:** {"type":"object","required":["handoff_id","context_block","approx_tokens"],"properties":{"handoff_id":{"type":"string","format":"uuid"},"context_block":{"type":"string","maxLength":12000},"approx_tokens":{"type":"integer","minimum":0,"maximum":9007199254740991}},"additionalProperties":false}.
- **Legacy response shape:** "NO_MATCHING_LEGACY_HANDLER".
- **Frontend path references:** none found by bounded literal scan.
- **Backend/internal path references:** none found outside route/handler source by bounded literal scan.
- **Legacy request shape:** "not applicable".

### POST /api/resource/admission

- **Decision:** MOVE FACADE TO TYPED — A typed registered handler and public OpenAPI contract already exist; the legacy-selected backend has no matching handler or is a duplicate compatibility implementation. Typed owns V1 behavior.
- **OpenAPI:** before DOCUMENTED; current DOCUMENTED.
- **Typed handler:** node/src/routes/resource-admission.ts.
- **Legacy handler evidence:** none for this method/path.
- **Facade:** legacy (implicit-default) → ts (PUBLIC_TYPED).
- **V1 requirement:** YES — public typed operation in the frozen V1 API surface. **Authority:** ENROLLED_CENTRAL; operation capability.read; waiver none.
- **Request shape:** {"type":"object","required":["kind","requirement"],"properties":{"kind":{"type":"string","enum":["resident","model_start","worker"]},"requirement":{"type":"object","properties":{"memory_mb":{"type":"integer","minimum":0,"maximum":9007199254740991},"vram_mb":{"type":"integer","minimum":0,"maximum":9007199254740991},"cpu_share":{"type":"number","minimum":0,"maximum":1}},"additionalProperties":false},"disposable":{"type":"boolean"}},"additionalProperties":false}.
- **Typed response shape:** {"type":"object","required":["decision","kind","reason","evidence","checked_at"],"properties":{"decision":{"type":"string","enum":["START","QUEUE","REFUSE_RESOURCE"]},"kind":{"type":"string","enum":["resident","model_start","worker"]},"reason":{"type":"string","maxLength":600},"evidence":{"type":"object","additionalProperties":{"type":["string","number","boolean","null"]}},"checked_at":{"type":"string"}},"additionalProperties":false}.
- **Legacy response shape:** "NO_MATCHING_LEGACY_HANDLER".
- **Frontend path references:** none found by bounded literal scan.
- **Backend/internal path references:** none found outside route/handler source by bounded literal scan.
- **Legacy request shape:** "not applicable".

### GET /api/provenance/runs

- **Decision:** MOVE FACADE TO TYPED — A typed registered handler and public OpenAPI contract already exist; the legacy-selected backend has no matching handler or is a duplicate compatibility implementation. Typed owns V1 behavior.
- **OpenAPI:** before DOCUMENTED; current DOCUMENTED.
- **Typed handler:** node/src/routes/provenance.ts.
- **Legacy handler evidence:** none for this method/path.
- **Facade:** legacy (implicit-default) → ts (PUBLIC_TYPED).
- **V1 requirement:** YES — public typed operation in the frozen V1 API surface. **Authority:** ENROLLED_CENTRAL; operation capability.read; waiver none.
- **Request shape:** [].
- **Typed response shape:** {"type":"object","required":["runs","total","corrupt_lines"],"properties":{"runs":{"type":"array","maxItems":500,"items":{"type":"object","required":["run_id","task_id","task","mode","worker","handoff_id","chat_source","result","error","verification_state","evidence_file","trajectory_file","iterations","started_at","finished_at"],"properties":{"run_id":{"type":"string","minLength":1,"maxLength":200},"task_id":{"type":"string","minLength":1,"maxLength":200},"task":{"type":"string","maxLength":500},"mode":{"type":"string","maxLength":20},"worker":{"anyOf":[{"type":"string","maxLength":200},{"type":"null"}]},"handoff_id":{"anyOf":[{"type":"string","maxLength":200},{"type":"null"}]},"chat_source":{"anyOf":[{"type":"string","maxLength":40},{"type":"null"}]},"result":{"type":"string","enum":["done","error","aborted"]},"error":{"anyOf":[{"type":"string","maxLength":300},{"type":"null"}]},"verification_state":{"type":"string","maxLength":40},"evidence_file":{"anyOf":[{"type":"string","maxLength":500},{"type":"null"}]},"trajectory_file":{"anyOf":[{"type":"string","maxLength":500},{"type":"null"}]},"iterations":{"type":"integer","minimum":0,"maximum":9007199254740991},"attempt_id":{"anyOf":[{"type":"string","maxLength":200},{"type":"null"}]},"attempt_event_stream_ref":{"anyOf":[{"type":"string","maxLength":500},{"type":"null"}]},"started_at":{"type":"string"},"finished_at":{"type":"string"}},"additionalProperties":false}},"total":{"type":"integer","minimum":0,"maximum":9007199254740991},"corrupt_lines":{"type":"integer","minimum":0,"maximum":9007199254740991}},"additionalProperties":false}.
- **Legacy response shape:** "NO_MATCHING_LEGACY_HANDLER".
- **Frontend path references:** none found by bounded literal scan.
- **Backend/internal path references:** none found outside route/handler source by bounded literal scan.
- **Legacy request shape:** "not applicable".

### GET /api/provenance/run

- **Decision:** MOVE FACADE TO TYPED — A typed registered handler and public OpenAPI contract already exist; the legacy-selected backend has no matching handler or is a duplicate compatibility implementation. Typed owns V1 behavior.
- **OpenAPI:** before DOCUMENTED; current DOCUMENTED.
- **Typed handler:** node/src/routes/provenance.ts.
- **Legacy handler evidence:** none for this method/path.
- **Facade:** legacy (implicit-default) → ts (PUBLIC_TYPED).
- **V1 requirement:** YES — public typed operation in the frozen V1 API surface. **Authority:** ENROLLED_CENTRAL; operation capability.read; waiver none.
- **Request shape:** [{"name":"id","in":"query","required":true,"schema":{"type":"string","minLength":1,"maxLength":200}}].
- **Typed response shape:** {"type":"object","required":["run"],"properties":{"run":{"type":"object","required":["run_id","task_id","task","mode","worker","handoff_id","chat_source","result","error","verification_state","evidence_file","trajectory_file","iterations","started_at","finished_at"],"properties":{"run_id":{"type":"string","minLength":1,"maxLength":200},"task_id":{"type":"string","minLength":1,"maxLength":200},"task":{"type":"string","maxLength":500},"mode":{"type":"string","maxLength":20},"worker":{"anyOf":[{"type":"string","maxLength":200},{"type":"null"}]},"handoff_id":{"anyOf":[{"type":"string","maxLength":200},{"type":"null"}]},"chat_source":{"anyOf":[{"type":"string","maxLength":40},{"type":"null"}]},"result":{"type":"string","enum":["done","error","aborted"]},"error":{"anyOf":[{"type":"string","maxLength":300},{"type":"null"}]},"verification_state":{"type":"string","maxLength":40},"evidence_file":{"anyOf":[{"type":"string","maxLength":500},{"type":"null"}]},"trajectory_file":{"anyOf":[{"type":"string","maxLength":500},{"type":"null"}]},"iterations":{"type":"integer","minimum":0,"maximum":9007199254740991},"attempt_id":{"anyOf":[{"type":"string","maxLength":200},{"type":"null"}]},"attempt_event_stream_ref":{"anyOf":[{"type":"string","maxLength":500},{"type":"null"}]},"started_at":{"type":"string"},"finished_at":{"type":"string"}},"additionalProperties":false}},"additionalProperties":false}.
- **Legacy response shape:** "NO_MATCHING_LEGACY_HANDLER".
- **Frontend path references:** none found by bounded literal scan.
- **Backend/internal path references:** none found outside route/handler source by bounded literal scan.
- **Legacy request shape:** "not applicable".

### GET /api/mission/receipt

- **Decision:** MOVE FACADE TO TYPED — A typed registered handler and public OpenAPI contract already exist; the legacy-selected backend has no matching handler or is a duplicate compatibility implementation. Typed owns V1 behavior.
- **OpenAPI:** before DOCUMENTED; current DOCUMENTED.
- **Typed handler:** node/src/routes/provenance.ts.
- **Legacy handler evidence:** none for this method/path.
- **Facade:** legacy (implicit-default) → ts (PUBLIC_TYPED).
- **V1 requirement:** YES — public typed operation in the frozen V1 API surface. **Authority:** ENROLLED_CENTRAL; operation capability.read; waiver none.
- **Request shape:** [{"name":"id","in":"query","required":true,"schema":{"type":"string","minLength":1,"maxLength":200}}].
- **Typed response shape:** {"type":"object","required":["mission_id","workspace","recorded_at","runs","handoffs","verification","supported_conclusion","limitations","evidence_refs"],"properties":{"mission_id":{"type":"string","maxLength":200},"workspace":{"type":"string","maxLength":1000},"recorded_at":{"type":"string"},"runs":{"type":"array","maxItems":200,"items":{"type":"object","required":["run_id","task_id","task","mode","worker","handoff_id","chat_source","result","error","verification_state","evidence_file","trajectory_file","iterations","started_at","finished_at"],"properties":{"run_id":{"type":"string","minLength":1,"maxLength":200},"task_id":{"type":"string","minLength":1,"maxLength":200},"task":{"type":"string","maxLength":500},"mode":{"type":"string","maxLength":20},"worker":{"anyOf":[{"type":"string","maxLength":200},{"type":"null"}]},"handoff_id":{"anyOf":[{"type":"string","maxLength":200},{"type":"null"}]},"chat_source":{"anyOf":[{"type":"string","maxLength":40},{"type":"null"}]},"result":{"type":"string","enum":["done","error","aborted"]},"error":{"anyOf":[{"type":"string","maxLength":300},{"type":"null"}]},"verification_state":{"type":"string","maxLength":40},"evidence_file":{"anyOf":[{"type":"string","maxLength":500},{"type":"null"}]},"trajectory_file":{"anyOf":[{"type":"string","maxLength":500},{"type":"null"}]},"iterations":{"type":"integer","minimum":0,"maximum":9007199254740991},"attempt_id":{"anyOf":[{"type":"string","maxLength":200},{"type":"null"}]},"attempt_event_stream_ref":{"anyOf":[{"type":"string","maxLength":500},{"type":"null"}]},"started_at":{"type":"string"},"finished_at":{"type":"string"}},"additionalProperties":false}},"handoffs":{"type":"array","maxItems":50,"items":{"type":"object","required":["handoff_id","from","to","state","objective"],"properties":{"handoff_id":{"type":"string","maxLength":200},"from":{"type":"string","maxLength":200},"to":{"type":"string","maxLength":200},"state":{"type":"string","maxLength":40},"objective":{"type":"string","maxLength":2000}},"additionalProperties":false}},"verification":{"type":"string","maxLength":40},"supported_conclusion":{"anyOf":[{"type":"string","maxLength":600},{"type":"null"}]},"limitations":{"type":"array","maxItems":20,"items":{"type":"string","maxLength":300}},"evidence_refs":{"type":"array","maxItems":50,"items":{"type":"string","maxLength":500}}},"additionalProperties":false}.
- **Legacy response shape:** "NO_MATCHING_LEGACY_HANDLER".
- **Frontend path references:** none found by bounded literal scan.
- **Backend/internal path references:** none found outside route/handler source by bounded literal scan.
- **Legacy request shape:** "not applicable".

### GET /api/harness/attempts

- **Decision:** MOVE FACADE TO TYPED — A typed registered handler and public OpenAPI contract already exist; the legacy-selected backend has no matching handler or is a duplicate compatibility implementation. Typed owns V1 behavior.
- **OpenAPI:** before DOCUMENTED; current DOCUMENTED.
- **Typed handler:** node/src/routes/attempts.ts.
- **Legacy handler evidence:** none for this method/path.
- **Facade:** legacy (implicit-default) → ts (PUBLIC_TYPED).
- **V1 requirement:** YES — public typed operation in the frozen V1 API surface. **Authority:** ENROLLED_CENTRAL; operation capability.read; waiver none.
- **Request shape:** [{"name":"task_id","in":"query","required":false,"schema":{"type":"string","maxLength":200}}].
- **Typed response shape:** {"type":"object","required":["attempts","total"],"properties":{"attempts":{"type":"array","maxItems":500,"items":{"type":"object","required":["attempt_id","task_id","state","retry_safety","sealed","created_at"],"properties":{"attempt_id":{"type":"string","format":"uuid"},"task_id":{"type":"string","maxLength":200},"state":{"type":"string","enum":["ADMITTED","RUNNING","COMPLETED","ACCEPTED","REJECTED","FAILED","ABORTED","RECOVERED_NOT_STARTED","RECOVERED_UNCERTAIN","RECOVERED_MUTATED_UNVERIFIED","RECOVERED_INCOMPLETE_ADMISSION"]},"retry_safety":{"type":"string","enum":["SAFE_TO_RETRY","UNCERTAIN_BLOCKED","NEW_ATTEMPT_REQUIRED","NOT_APPLICABLE"]},"sealed":{"type":"boolean"},"created_at":{"type":"string"}},"additionalProperties":false}},"total":{"type":"integer","minimum":0,"maximum":9007199254740991}},"additionalProperties":false}.
- **Legacy response shape:** "NO_MATCHING_LEGACY_HANDLER".
- **Frontend path references:** none found by bounded literal scan.
- **Backend/internal path references:** none found outside route/handler source by bounded literal scan.
- **Legacy request shape:** "not applicable".

### GET /api/harness/attempt

- **Decision:** MOVE FACADE TO TYPED — A typed registered handler and public OpenAPI contract already exist; the legacy-selected backend has no matching handler or is a duplicate compatibility implementation. Typed owns V1 behavior.
- **OpenAPI:** before DOCUMENTED; current DOCUMENTED.
- **Typed handler:** node/src/routes/attempts.ts.
- **Legacy handler evidence:** none for this method/path.
- **Facade:** legacy (implicit-default) → ts (PUBLIC_TYPED).
- **V1 requirement:** YES — public typed operation in the frozen V1 API surface. **Authority:** ENROLLED_CENTRAL; operation capability.read; waiver none.
- **Request shape:** [{"name":"id","in":"query","required":true,"schema":{"type":"string","format":"uuid","pattern":"^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"}}].
- **Typed response shape:** {"type":"object","required":["envelope","state","retry_safety","failure_class","recovery_note","integrity","corrupt_records","events"],"properties":{"envelope":{"type":"object","required":["schema","attempt_id","sealed","created_at","sealed_at","mission_id","project_id","task_id","workflow_id","stage_id","parent_attempt_id","handoff_id","continuation_chain_id","worker_role","worker_identity","worker_provider","worker_model","observed_model","runtime_profile","adapter_identity","context_envelope","skills","capabilities","objective","acceptance_criteria","verification_requirements","resource_admission","authority_scope","mutation_scope","budget","mode","started_by"],"properties":{"schema":{"type":"string"},"attempt_id":{"type":"string","format":"uuid"},"sealed":{"type":"boolean"},"created_at":{"type":"string"},"sealed_at":{"type":["string","null"]},"mission_id":{"type":"string","maxLength":200},"project_id":{"type":"string","maxLength":1000},"task_id":{"type":"string","maxLength":200},"workflow_id":{"anyOf":[{"type":"string","maxLength":500},{"type":"string"},{"type":"string"},{"type":"string"}]},"stage_id":{"anyOf":[{"type":"string","maxLength":500},{"type":"string"},{"type":"string"},{"type":"string"}]},"parent_attempt_id":{"anyOf":[{"type":"string","maxLength":200},{"type":"null"}]},"handoff_id":{"anyOf":[{"type":"string","maxLength":200},{"type":"null"}]},"continuation_chain_id":{"anyOf":[{"type":"string","maxLength":200},{"type":"null"}]},"worker_role":{"type":"string","maxLength":40},"worker_identity":{"type":"string","maxLength":200},"worker_provider":{"type":"string","maxLength":120},"worker_model":{"type":"string","maxLength":200},"observed_model":{"anyOf":[{"type":"string","maxLength":500},{"type":"string"},{"type":"string"},{"type":"string"}]},"runtime_profile":{"anyOf":[{"type":"string","maxLength":500},{"type":"string"},{"type":"string"},{"type":"string"}]},"adapter_identity":{"anyOf":[{"type":"string","maxLength":500},{"type":"string"},{"type":"string"},{"type":"string"}]},"context_envelope":{"type":"object","required":["identity","sha256","blocks","bound_at"],"properties":{"identity":{"anyOf":[{"type":"string","maxLength":500},{"type":"string"},{"type":"string"},{"type":"string"}]},"sha256":{"anyOf":[{"type":"string","maxLength":64},{"type":"null"}]},"blocks":{"type":"array","maxItems":32,"items":{"type":"string","maxLength":80}},"bound_at":{"type":["string","null"]}},"additionalProperties":false},"skills":{"type":"object","required":["identities","status"],"properties":{"identities":{"type":"array","maxItems":32,"items":{"type":"string","maxLength":200}},"status":{"anyOf":[{"type":"string","maxLength":500},{"type":"string"},{"type":"string"},{"type":"string"}]}},"additionalProperties":false},"capabilities":{"type":"array","maxItems":64,"items":{"type":"string","maxLength":120}},"objective":{"type":"string","maxLength":2000},"acceptance_criteria":{"anyOf":[{"type":"string","maxLength":500},{"type":"string"},{"type":"string"},{"type":"string"}]},"verification_requirements":{"anyOf":[{"type":"string","maxLength":500},{"type":"string"},{"type":"string"},{"type":"string"}]},"resource_admission":{"type":"object","required":["decision","reason","checked_at"],"properties":{"decision":{"type":"string","enum":["START","QUEUE","REFUSE_RESOURCE","NOT_RECORDED"]},"reason":{"type":"string","maxLength":600},"checked_at":{"type":["string","null"]}},"additionalProperties":false},"authority_scope":{"type":"object","required":["owner","operation_kind","workspace","permit_identity"],"properties":{"owner":{"anyOf":[{"type":"string","maxLength":500},{"type":"string"},{"type":"string"},{"type":"string"}]},"operation_kind":{"anyOf":[{"type":"string","maxLength":500},{"type":"string"},{"type":"string"},{"type":"string"}]},"workspace":{"type":"string","maxLength":1000},"permit_identity":{"anyOf":[{"type":"string","maxLength":500},{"type":"string"},{"type":"string"},{"type":"string"}]}},"additionalProperties":false},"mutation_scope":{"type":"array","maxItems":64,"items":{"type":"string","maxLength":120}},"budget":{"type":"object","required":["max_iterations","effective_context_tokens","timeout_ms","retry_bounds"],"properties":{"max_iterations":{"anyOf":[{"type":"integer","minimum":0,"maximum":9007199254740991},{"type":"null"}]},"effective_context_tokens":{"anyOf":[{"type":"integer","minimum":0,"maximum":9007199254740991},{"type":"null"}]},"timeout_ms":{"anyOf":[{"type":"integer","minimum":0,"maximum":9007199254740991},{"type":"null"}]},"retry_bounds":{"anyOf":[{"type":"string","maxLength":500},{"type":"string"},{"type":"string"},{"type":"string"}]}},"additionalProperties":false},"mode":{"type":"string","maxLength":20},"started_by":{"anyOf":[{"type":"string","maxLength":500},{"type":"string"},{"type":"string"},{"type":"string"}]}},"additionalProperties":false},"state":{"type":"string","enum":["ADMITTED","RUNNING","COMPLETED","ACCEPTED","REJECTED","FAILED","ABORTED","RECOVERED_NOT_STARTED","RECOVERED_UNCERTAIN","RECOVERED_MUTATED_UNVERIFIED","RECOVERED_INCOMPLETE_ADMISSION"]},"retry_safety":{"type":"string","enum":["SAFE_TO_RETRY","UNCERTAIN_BLOCKED","NEW_ATTEMPT_REQUIRED","NOT_APPLICABLE"]},"failure_class":{"anyOf":[{"type":"string","enum":["ADMISSION_FAILURE","RESOURCE_FAILURE","AUTHORITY_FAILURE","EXECUTION_FAILURE","TOOL_FAILURE","VERIFICATION_FAILURE","RUNTIME_FAILURE","UNKNOWN"]},{"type":"null"}]},"recovery_note":{"anyOf":[{"type":"string","maxLength":600},{"type":"null"}]},"integrity":{"type":"string","enum":["OK","CORRUPT","OUT_OF_ORDER"]},"corrupt_records":{"type":"integer","minimum":0,"maximum":9007199254740991},"events":{"type":"array","maxItems":1000,"items":{"type":"object","required":["event_id","seq","ts","attempt_id","mission_id","project_id","source","event","data","redacted"],"properties":{"event_id":{"type":"string","minLength":1,"maxLength":300},"seq":{"type":"integer","minimum":0,"maximum":9007199254740991},"ts":{"type":"string"},"attempt_id":{"type":"string","format":"uuid"},"mission_id":{"type":"string","maxLength":200},"project_id":{"type":"string","maxLength":1000},"source":{"type":"string","maxLength":80},"event":{"type":"string","maxLength":60},"data":{"type":"object","additionalProperties":{"type":["string","number","boolean","null"]}},"redacted":{"type":"boolean"}},"additionalProperties":false}}},"additionalProperties":false}.
- **Legacy response shape:** "NO_MATCHING_LEGACY_HANDLER".
- **Frontend path references:** none found by bounded literal scan.
- **Backend/internal path references:** none found outside route/handler source by bounded literal scan.
- **Legacy request shape:** "not applicable".

### GET /api/harness/attempt/events

- **Decision:** MOVE FACADE TO TYPED — A typed registered handler and public OpenAPI contract already exist; the legacy-selected backend has no matching handler or is a duplicate compatibility implementation. Typed owns V1 behavior.
- **OpenAPI:** before DOCUMENTED; current DOCUMENTED.
- **Typed handler:** node/src/routes/attempts.ts.
- **Legacy handler evidence:** none for this method/path.
- **Facade:** legacy (implicit-default) → ts (PUBLIC_TYPED).
- **V1 requirement:** YES — public typed operation in the frozen V1 API surface. **Authority:** ENROLLED_CENTRAL; operation capability.read; waiver none.
- **Request shape:** [{"name":"after","in":"query","required":false,"schema":{"type":"string","pattern":"^\\d+$"}},{"name":"id","in":"query","required":true,"schema":{"type":"string","format":"uuid","pattern":"^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"}},{"name":"limit","in":"query","required":false,"schema":{"type":"string","pattern":"^\\d+$"}}].
- **Typed response shape:** {"type":"object","required":["attempt_id","mission_id","project_id","after","next_after","has_more","terminal","integrity","corrupt_records","events"],"properties":{"attempt_id":{"type":"string","format":"uuid"},"mission_id":{"type":"string","maxLength":200},"project_id":{"type":"string","maxLength":1000},"after":{"type":"integer","minimum":-1,"maximum":9007199254740991},"next_after":{"type":"integer","minimum":-1,"maximum":9007199254740991},"has_more":{"type":"boolean"},"terminal":{"type":"boolean"},"integrity":{"type":"string","enum":["OK","CORRUPT","OUT_OF_ORDER"]},"corrupt_records":{"type":"integer","minimum":0,"maximum":9007199254740991},"events":{"type":"array","maxItems":200,"items":{"type":"object","required":["event_id","seq","ts","attempt_id","mission_id","project_id","source","event","data","redacted"],"properties":{"event_id":{"type":"string","minLength":1,"maxLength":300},"seq":{"type":"integer","minimum":0,"maximum":9007199254740991},"ts":{"type":"string"},"attempt_id":{"type":"string","format":"uuid"},"mission_id":{"type":"string","maxLength":200},"project_id":{"type":"string","maxLength":1000},"source":{"type":"string","maxLength":80},"event":{"type":"string","maxLength":60},"data":{"type":"object","additionalProperties":{"type":["string","number","boolean","null"]}},"redacted":{"type":"boolean"}},"additionalProperties":false}}},"additionalProperties":false}.
- **Legacy response shape:** "NO_MATCHING_LEGACY_HANDLER".
- **Frontend path references:** none found by bounded literal scan.
- **Backend/internal path references:** none found outside route/handler source by bounded literal scan.
- **Legacy request shape:** "not applicable".

### GET /api/readiness

- **Decision:** MOVE FACADE TO TYPED — A typed registered handler and public OpenAPI contract already exist; the legacy-selected backend has no matching handler or is a duplicate compatibility implementation. Typed owns V1 behavior.
- **OpenAPI:** before DOCUMENTED; current DOCUMENTED.
- **Typed handler:** node/src/routes/readiness.ts.
- **Legacy handler evidence:** none for this method/path.
- **Facade:** legacy (implicit-default) → ts (PUBLIC_TYPED).
- **V1 requirement:** YES — public typed operation in the frozen V1 API surface. **Authority:** ENROLLED_CENTRAL; operation capability.read; waiver none.
- **Request shape:** [].
- **Typed response shape:** {"type":"object","required":["ready","ready_for_golden_mission","items","generated_at"],"properties":{"ready":{"type":"boolean"},"ready_for_golden_mission":{"type":"boolean"},"items":{"type":"array","maxItems":32,"items":{"type":"object","required":["id","state","code","explanation","repair","blocking"],"properties":{"id":{"type":"string","minLength":1,"maxLength":80},"state":{"type":"string","enum":["READY","DEGRADED","BLOCKED","OPTIONAL","UNKNOWN"]},"code":{"type":"string","minLength":1,"maxLength":80},"explanation":{"type":"string","maxLength":500},"repair":{"anyOf":[{"type":"string","maxLength":500},{"type":"null"}]},"blocking":{"type":"boolean"}},"additionalProperties":false}},"generated_at":{"type":"string"}},"additionalProperties":false}.
- **Legacy response shape:** "NO_MATCHING_LEGACY_HANDLER".
- **Frontend path references:** none found by bounded literal scan.
- **Backend/internal path references:** none found outside route/handler source by bounded literal scan.
- **Legacy request shape:** "not applicable".

### GET /api/egress/manifest

- **Decision:** MOVE FACADE TO TYPED — A typed, Authority-enrolled implementation exists. The route is a local read and has no legacy handler; moving only façade ownership does not change Local-Only policy.
- **OpenAPI:** before DOCUMENTED; current DOCUMENTED.
- **Typed handler:** node/src/routes/egress-manifest.ts.
- **Legacy handler evidence:** none for this method/path.
- **Facade:** legacy (implicit-default) → ts (PUBLIC_TYPED).
- **V1 requirement:** YES — public typed operation in the frozen V1 API surface. **Authority:** ENROLLED_CENTRAL; operation capability.read; waiver none.
- **Request shape:** [].
- **Typed response shape:** {"type":"object","required":["doctrine","capabilities","recent_external_activity","generated_at"],"properties":{"doctrine":{"type":"string","maxLength":200},"capabilities":{"type":"array","maxItems":32,"items":{"type":"object","required":["id","classification","detail","egress_host","consent"],"properties":{"id":{"type":"string","minLength":1,"maxLength":80},"classification":{"type":"string","enum":["PACKAGED_LOCAL","OS_PROVIDED","OPTIONAL_EXTERNAL","CLOUD_ONLY","MISSING_LOCAL_EQUIVALENT"]},"detail":{"type":"string","maxLength":300},"egress_host":{"anyOf":[{"type":"string","maxLength":200},{"type":"null"}]},"consent":{"type":"string","enum":["local_only","opted_in","not_configured"]}},"additionalProperties":false}},"recent_external_activity":{"type":"object","required":["events","last_at","providers"],"properties":{"events":{"type":"integer","minimum":0,"maximum":9007199254740991},"last_at":{"anyOf":[{"type":"string","maxLength":40},{"type":"null"}]},"providers":{"type":"array","maxItems":16,"items":{"type":"string","maxLength":120}}},"additionalProperties":false},"generated_at":{"type":"string"}},"additionalProperties":false}.
- **Legacy response shape:** "NO_MATCHING_LEGACY_HANDLER".
- **Frontend path references:** none found by bounded literal scan.
- **Backend/internal path references:** none found outside route/handler source by bounded literal scan.
- **Legacy request shape:** "not applicable".

### POST /api/workbench/worktree/create

- **Decision:** MOVE FACADE TO TYPED — A typed registered handler and public OpenAPI contract already exist; the legacy-selected backend has no matching handler or is a duplicate compatibility implementation. Typed owns V1 behavior.
- **OpenAPI:** before DOCUMENTED; current DOCUMENTED.
- **Typed handler:** node/src/routes/workbenches.ts.
- **Legacy handler evidence:** none for this method/path.
- **Facade:** legacy (implicit-default) → ts (PUBLIC_TYPED).
- **V1 requirement:** YES — public typed operation in the frozen V1 API surface. **Authority:** ENROLLED_DESCRIPTOR; operation route-owned/no central operation; waiver none.
- **Request shape:** {"type":"object","required":["id"],"properties":{"id":{"type":"string"},"base_ref":{"type":"string","minLength":1,"maxLength":200}},"additionalProperties":false}.
- **Typed response shape:** {"type":"object","required":["worktree"],"properties":{"worktree":{"type":"object","required":["id","branch","base_ref","path","created_at"],"properties":{"id":{"type":"string"},"branch":{"type":"string"},"base_ref":{"type":"string","minLength":1,"maxLength":200},"path":{"type":"string","minLength":1,"maxLength":1000},"created_at":{"type":"integer","minimum":0,"maximum":9007199254740991},"diff_stats":{"type":"object","required":["files_changed","insertions","deletions"],"properties":{"files_changed":{"type":"integer","minimum":0,"maximum":9007199254740991},"insertions":{"type":"integer","minimum":0,"maximum":9007199254740991},"deletions":{"type":"integer","minimum":0,"maximum":9007199254740991}},"additionalProperties":false}},"additionalProperties":false}},"additionalProperties":false}.
- **Legacy response shape:** "NO_MATCHING_LEGACY_HANDLER".
- **Frontend path references:** none found by bounded literal scan.
- **Backend/internal path references:** none found outside route/handler source by bounded literal scan.
- **Legacy request shape:** "not applicable".

### GET /api/workbench/worktree/list

- **Decision:** MOVE FACADE TO TYPED — A typed registered handler and public OpenAPI contract already exist; the legacy-selected backend has no matching handler or is a duplicate compatibility implementation. Typed owns V1 behavior.
- **OpenAPI:** before DOCUMENTED; current DOCUMENTED.
- **Typed handler:** node/src/routes/workbenches.ts.
- **Legacy handler evidence:** none for this method/path.
- **Facade:** legacy (implicit-default) → ts (PUBLIC_TYPED).
- **V1 requirement:** YES — public typed operation in the frozen V1 API surface. **Authority:** ENROLLED_CENTRAL; operation capability.read; waiver none.
- **Request shape:** [].
- **Typed response shape:** {"type":"object","required":["worktrees"],"properties":{"worktrees":{"type":"array","maxItems":100,"items":{"type":"object","required":["id","branch","base_ref","path","created_at"],"properties":{"id":{"type":"string"},"branch":{"type":"string"},"base_ref":{"type":"string","minLength":1,"maxLength":200},"path":{"type":"string","minLength":1,"maxLength":1000},"created_at":{"type":"integer","minimum":0,"maximum":9007199254740991},"diff_stats":{"type":"object","required":["files_changed","insertions","deletions"],"properties":{"files_changed":{"type":"integer","minimum":0,"maximum":9007199254740991},"insertions":{"type":"integer","minimum":0,"maximum":9007199254740991},"deletions":{"type":"integer","minimum":0,"maximum":9007199254740991}},"additionalProperties":false}},"additionalProperties":false}}},"additionalProperties":false}.
- **Legacy response shape:** "NO_MATCHING_LEGACY_HANDLER".
- **Frontend path references:** none found by bounded literal scan.
- **Backend/internal path references:** none found outside route/handler source by bounded literal scan.
- **Legacy request shape:** "not applicable".

### POST /api/workbench/worktree/merge

- **Decision:** MOVE FACADE TO TYPED — A typed registered handler and public OpenAPI contract already exist; the legacy-selected backend has no matching handler or is a duplicate compatibility implementation. Typed owns V1 behavior.
- **OpenAPI:** before DOCUMENTED; current DOCUMENTED.
- **Typed handler:** node/src/routes/workbenches.ts.
- **Legacy handler evidence:** none for this method/path.
- **Facade:** legacy (implicit-default) → ts (PUBLIC_TYPED).
- **V1 requirement:** YES — public typed operation in the frozen V1 API surface. **Authority:** ENROLLED_DESCRIPTOR; operation route-owned/no central operation; waiver none.
- **Request shape:** {"type":"object","required":["id","strategy","commit_message"],"properties":{"id":{"type":"string"},"strategy":{"type":"string","enum":["merge","squash","rebase"]},"commit_message":{"type":"string","minLength":1,"maxLength":2000}},"additionalProperties":false}.
- **Typed response shape:** {"type":"object","required":["id","strategy","commit_sha","message"],"properties":{"id":{"type":"string"},"strategy":{"type":"string","enum":["merge","squash","rebase"]},"commit_sha":{"type":"string","minLength":1,"maxLength":64},"message":{"type":"string","maxLength":2000}},"additionalProperties":false}.
- **Legacy response shape:** "NO_MATCHING_LEGACY_HANDLER".
- **Frontend path references:** none found by bounded literal scan.
- **Backend/internal path references:** none found outside route/handler source by bounded literal scan.
- **Legacy request shape:** "not applicable".

### POST /api/workbench/worktree/discard

- **Decision:** MOVE FACADE TO TYPED — A typed registered handler and public OpenAPI contract already exist; the legacy-selected backend has no matching handler or is a duplicate compatibility implementation. Typed owns V1 behavior.
- **OpenAPI:** before DOCUMENTED; current DOCUMENTED.
- **Typed handler:** node/src/routes/workbenches.ts.
- **Legacy handler evidence:** none for this method/path.
- **Facade:** legacy (implicit-default) → ts (PUBLIC_TYPED).
- **V1 requirement:** YES — public typed operation in the frozen V1 API surface. **Authority:** ENROLLED_DESCRIPTOR; operation route-owned/no central operation; waiver none.
- **Request shape:** {"type":"object","required":["id"],"properties":{"id":{"type":"string"}},"additionalProperties":false}.
- **Typed response shape:** {"type":"object","required":["id","state"],"properties":{"id":{"type":"string"},"state":{"type":"string"}},"additionalProperties":false}.
- **Legacy response shape:** "NO_MATCHING_LEGACY_HANDLER".
- **Frontend path references:** none found by bounded literal scan.
- **Backend/internal path references:** none found outside route/handler source by bounded literal scan.
- **Legacy request shape:** "not applicable".

### GET /api/system-map/snapshot

- **Decision:** MOVE FACADE TO TYPED — A typed registered handler and public OpenAPI contract already exist; the legacy-selected backend has no matching handler or is a duplicate compatibility implementation. Typed owns V1 behavior.
- **OpenAPI:** before DOCUMENTED; current DOCUMENTED.
- **Typed handler:** node/src/routes/system-map.ts.
- **Legacy handler evidence:** none for this method/path.
- **Facade:** legacy (implicit-default) → ts (PUBLIC_TYPED).
- **V1 requirement:** YES — public typed operation in the frozen V1 API surface. **Authority:** ENROLLED_CENTRAL; operation capability.read; waiver none.
- **Request shape:** [].
- **Typed response shape:** {"type":"object","required":["snapshot"],"properties":{"snapshot":{"type":"object","required":["generated_at","subsystems"],"properties":{"generated_at":{"type":"integer","minimum":-9007199254740991,"maximum":9007199254740991},"subsystems":{"type":"array","maxItems":8,"items":{"type":"object","required":["id","state","detail","last_updated","doctrine"],"properties":{"id":{"type":"string","enum":["inhouse_model","workbenches","skills","agent_loop","micro_experts","helix_memory","veritas_selfheal","byok_desktop"]},"state":{"type":"string","enum":["live","offline","degraded","not_wired"]},"detail":{"type":"string","maxLength":500},"last_updated":{"type":"integer","minimum":-9007199254740991,"maximum":9007199254740991},"doctrine":{"type":"string","maxLength":64}},"additionalProperties":false}}},"additionalProperties":false}},"additionalProperties":false}.
- **Legacy response shape:** "NO_MATCHING_LEGACY_HANDLER".
- **Frontend path references:** none found by bounded literal scan.
- **Backend/internal path references:** none found outside route/handler source by bounded literal scan.
- **Legacy request shape:** "not applicable".

### GET /api/openapi.json

- **Decision:** MOVE FACADE TO TYPED — The raw typed discovery route is public API. Document it in OpenAPI and route it to its canonical typed handler.
- **OpenAPI:** before NOT_DOCUMENTED_RAW; current DOCUMENTED.
- **Typed handler:** node/src/openapi.ts.
- **Legacy handler evidence:** none for this method/path.
- **Facade:** legacy (implicit-default) → ts (PUBLIC_TYPED).
- **V1 requirement:** YES — public typed operation in the frozen V1 API surface. **Authority:** ENROLLED_CENTRAL; operation capability.read; waiver none.
- **Request shape:** [].
- **Typed response shape:** {}.
- **Legacy response shape:** "NO_MATCHING_LEGACY_HANDLER".
- **Frontend path references:** none found by bounded literal scan.
- **Backend/internal path references:** none found outside route/handler source by bounded literal scan.
- **Legacy request shape:** "not applicable".
