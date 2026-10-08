# Governed Worker Execution Spine — Wave 1 Evidence Report

**Disposition: `BLOCKED_EXTERNAL_DEPENDENCY`**

This lane implements the governed local execution path, direct Projects entry, scoped Context Aperture, durable attempt binding, invocation-time Authority and Resource Admission, lifecycle observation, stop/cancel, and handoff construction. It does **not** satisfy real-worker acceptance: no exact qualified local route was available, and no model invocation was performed. Fixture results are not represented as a live execution.

## Repository and revision

- Worktree: `E:\covert-governed-execution-spine-luna-20261008-impl`
- Branch: `feat/governed-execution-spine-luna-20261008-impl`
- Reviewed P2 base: `682a42114450c4f7caf84e45ccdc601481dfb374`
- Implementation checkpoint: `967065fd174ad0174502499f12e61da50b653a60`
- Implementation commits: `2ba28f3` (execution spine), `967065f` (direct Projects surface)
- Saul's active P2 lane and other worktrees were not modified.
- No R9 edits were made.
- The implementation checkout was clean before adding this evidence record.

## Owner map

| Fact/effect | Canonical owner / existing contract | Wave 1 binding or gap |
|---|---|---|
| Project and checkout identity | ProjectSeat / Project Address | Execution request, Authority operation, attempt and aperture bind the exact Project ID and checkout ID; stale/mismatched address is refused. |
| Source revision and working-tree observation | Git source observation used by Agent route | Captured at preparation and stored in worker binding/aperture; Git revision must be present and working-tree state known. |
| Capability discovery | Resident capability discovery and App Catalog | `project.worker.execute.local` is discoverable as `ADDRESSABLE`; this remains descriptive and does not grant invocation. |
| Model, artifact, provider/runtime and route | ModelRouter and Model Manager / Model Access | Resolve the exact selected local route; require qualified model, verified artifact digest, configured adapter, healthy runtime, matching model/artifact/runtime version. No implicit alternate route. |
| Process/session lifecycle | AgentLoop and its existing session ownership | AgentLoop remains process/runtime caller and lifecycle owner. `AttemptJournal` correlates the worker session; no WorkerDatabase was added. |
| Authority | Existing deterministic Execution Authority | The exact prepared `agent.start` operation binds principal, project, checkout, task, session, capability, route, aperture digest, and effect. Approval is consumed for that operation. |
| Resource decision | Resource Admission | Decision binds the actual attempt/session workload. Existing floors stay unchanged: at least 3072 MiB free physical RAM and strictly more than 5120 MiB free commit. |
| Context continuity | New Context Aperture contract/service, referencing canonical owners | Bounded aperture binds project, checkout, source observation, task, criteria, included file references, destination, handoff, exclusions, size estimate and digest. It is not a database or shared chat history. |
| Durable attempt/evidence | Existing AttemptJournal / AttemptDetail | Extended to record worker binding, aperture, admission reference, Authority operation and lifecycle/effect events. |
| Handoff | Existing WorkerHandoff | Extended with ProjectSeat address; receiving request validates task/project/checkout/destination and gets a fresh aperture. |
| Human inspectability | Existing Projects surface | Added a direct operator form, route qualification readout, one-time Authority preview, aperture display, session observation, cancellation and handoff controls. Cipher is not a prerequisite. |

## Contracts and behavior introduced or extended

- Added `ContextAperture` (`covert.context-aperture.v1`) and the Context Aperture service. Creation redacts secret-like text, constrains file references to checkout-relative references, constructs bounded context, and derives a stable SHA-256 identity. Credentials, provider secrets, browser data, unrelated history and tools are excluded.
- Extended Agent request/response and Attempt contracts with governed execution metadata, worker lifecycle/binding and aperture evidence.
- Extended Resource Admission decision metadata and WorkerHandoff project binding.
- Added the discovered native capability `project.worker.execute.local`; catalog discovery does not authorize it.
- Agent start now resolves and checks the exact Model Access route and qualification basis, rechecks project/checkout/source, prepares a scoped aperture and exact Authority operation, admits the actual attempt, and dispatches only the selected local route.
- The local worker receives the bounded aperture. This path does not expose AgentLoop tools, editor mutations, or broad chat/memory context to the worker.
- Lifecycle `RUNNING` is recorded only after observed model output, rather than after sending a start request. Cancellation addresses the exact owned AgentLoop session and uses its cancellation signal; it does not kill by process name.
- Startup recovery marks dangling execution uncertain and does not replay approval, command, or model request.
- Added a direct Projects-surface path through existing owners. The Authority operation preview contains the prepared aperture binding; the UI then displays the aperture and attempt detail. The UI does not store a second copy of project, model, authority, or evidence state.
- Regenerated `common/openapi.json` with the canonical contract generator.

## Execution sequence implemented

1. Authenticate the operator and resolve the selected worker against ModelRouter.
2. Require a local planner route and reject unqualified, unavailable, external, or changed routes.
3. Resolve current ProjectSeat, checkout, source revision and working-tree observation.
4. Recheck Model Manager qualification, verified artifact digest, local adapter, and matching healthy runtime process/model/version.
5. For a handoff, validate the existing handoff's project, checkout, task and exact receiving worker, then retrieve its bounded handoff context.
6. Construct the destination-specific Context Aperture and bind its ID/digest into the prepared Authority operation.
7. Require the operator's exact Authority approval. Discovery and aperture content grant no permission.
8. Create the durable attempt and evaluate Resource Admission against actual observations and the selected workload. A denial emits the attempt/activity evidence and launches no worker.
9. Dispatch one local model request using the selected route and aperture only; persist lifecycle observations and result evidence.
10. Stop/cancel only the exact AgentLoop session and observe terminal status.
11. Create a canonical WorkerHandoff, then use a new worker session ID and new aperture for the receiver. The handoff contains continuity records, not the first worker's conversation.

## Context Aperture evidence

The contract binds: aperture ID; Project ID and checkout; observed source revision, branch and working-tree state; task ID and objective; acceptance criteria; included checkout-relative references; decision/evidence/SOP references where supplied; handoff reference/context; destination route and session; allowed capabilities; explicit exclusions; bounded content; approximate token estimate; creation time; SHA-256 digest.

The first aperture is constructed by the canonical route preparation used for the actual Authority request. The operator approval preview includes this exact prepared aperture. On successful preparation the Projects surface shows the returned aperture contents and digest; an admission refusal can still expose the durable attempt and prepared aperture when the route returns its attempt reference. The generated aperture is not independently editable by a caller after preparation.

No live aperture was created for an actual local model invocation in this lane because the required exact route was unavailable. The contract and digest behavior were tested with controlled fixtures. This report therefore does not claim a real worker received an aperture.

## Authority evidence

Authority is checked on invocation, not at capability discovery. The operation includes the exact caller, session/task identity, Project/checkout, route, capability and aperture binding. The regression suite covers refusal/replay/change cases, including project, checkout, route, capability, worker/session, missing principal and stale/replayed approval. The Projects surface submits through the existing `apiFetch` approval flow, which prepares and presents the immutable operation, requests a single operator decision, and attaches the resulting operation identity to that same request.

These are contract/controlled-test results. No live operator-approved worker operation reached an actual model runtime in this lane.

## Resource Admission evidence

The existing admission floors were preserved: free physical memory `>= 3072 MiB`; free commit `> 5120 MiB`. A live machine observation during reconnaissance measured 7421 MiB free physical memory and 7110 MiB free commit, so those two floors passed at that observation time. Controlled tests exercise permit/deny decisions and confirm denial prevents dispatch while preserving the reason and attempt evidence.

No actual workload admission was granted to a real model invocation. Incremental per-model memory demand is not available from the current owner contract; this implementation deliberately does not report `memory_mb: 0` as if zero were measured. VRAM/model-specific demand is not claimed as measured or reserved.

## Model/runtime availability and exact external dependency

Live reconnaissance found:

- None of the configured local-route ports 8082–8088 or 8090–8092 was listening.
- `llama-server.exe` was not running. A binary exists at `E:\llama-cpp\llama-server.exe`, but its presence is not a qualified route.
- The only observed `ollama.exe` belonged to a foreign checkout (`E:\aide-sovereign-workbench\aes-ledgerpro\runtime\ollama_bundle\ollama.exe`, PID 17352); it was not used or disturbed.
- Unauthenticated `GET http://127.0.0.1:4777/api/models/manager` returned HTTP 403. No Authority credentials were read, copied, or bypassed.
- A candidate artifact `E:\models\north-mini-code\North-Mini-Code-1.0-UD-Q2_K_XL.gguf` exists at 10,480,001,120 bytes, while its manifest qualification fields were `runtime_health=pending` and `coding_smoke=pending`; it exceeds the observed free physical RAM. It was not launched.
- `E:\models\house-model\lfm25_gguf\LFM2.5-2.6B-Q4_K_M.gguf` exists at 1,674,455,040 bytes but is not a registered, qualified local route in the observed route inventory. No route or adapter was fabricated for it.
- Static manifest labels such as `ready` do not establish Model Manager qualification.

The exact dependency is access to canonical Model Manager state through the already paired operator session and an already registered, exact `QUALIFIED` local route whose verified artifact and live runtime match its basis. There is no safe current route to invoke. Acquiring a model, inventing a route, using a foreign process, or silently substituting another runtime would exceed this bounded lane or violate its locks. No cloud route or fallback was attempted.

## Lifecycle, cancellation and handoff proof

Controlled tests exercise the declared sequence `REQUESTED → ADMITTED → STARTING → RUNNING → terminal`, refusal before dispatch, startup/runtime failure, cancellation, unexpected failure, and durable uncertain recovery. `RUNNING` requires observed output. Exact-session cancellation is wired to the owning AgentLoop session; the UI waits for a terminal status rather than treating cancel acknowledgement as termination.

Controlled WorkerHandoff tests prove the project binding and a distinct receiving aperture/session identity over the same task continuity. The receive path re-resolves the selected route and prepares fresh authority, admission and aperture bindings. No second live worker ran, so the real second-worker continuity acceptance step is unproven.

`AttemptJournal.recover()` reconciles dangling durable attempts to an uncertain state without replay. The recovery test does not prove liveness of a shared runtime PID after restart; runtime/session reconciliation remains a limitation.

## Receipt shape

No actual live receipt exists, so no real IDs, hashes, process identity, or result are invented here. The receipt is the canonical `AttemptDetail.envelope` plus ordered `AttemptDetail.events`, with this identity chain:

| Receipt field | Required binding |
|---|---|
| Actor and attempt | Authenticated principal, attempt ID, request/task correlation |
| Project state | Project ID, checkout ID, source SHA, working-tree observation |
| Worker and route | Worker/session ID, role, model, provider/runtime/client, adapter, artifact SHA, runtime version/process identity |
| Context | Aperture ID and digest, destination, declared exclusions |
| Permission and resources | Exact Authority operation reference and Resource Admission decision/reference/reason |
| Effect and lifecycle | Observed dispatch/result, lifecycle sequence, terminal/cancel/exit outcome |
| Verification | Evidence references and claim state; completion is not itself correctness verification |

Unit/architecture tests use controlled fixture identities to validate the envelope binding. They are not a substitute for a live receipt.

## Test and verification matrix

| Check | Result | Qualification |
|---|---:|---|
| `tests/arch/governed-execution-spine.test.ts` | 6/6 pass | Focused contracts, Authority binding/refusal, Admission, aperture, lifecycle/recovery/handoff seams. Final rerun: 5.90 s. |
| `tests/arch/worker-handoff.test.ts` | 7/7 pass | Existing handoff regressions plus project binding. |
| `tests/arch/worker-handoff-live.test.ts` | 8/8 pass | Controlled live-route handoff lifecycle; no local model inference. |
| `tests/arch/resource-admission.test.ts` | 11/11 pass | Admission floors and denial behavior. |
| `tests/arch/harness-attempt.test.ts` | 20/20 pass | Attempt journal/receipt behavior. |
| `tests/arch/agent-worker-binding.test.ts` | 11/11 pass | Exact worker binding. |
| `tests/arch/agent-routes.test.ts` | 8/8 pass | Agent route behavior. |
| `tests/arch/platform-app-catalog.test.ts` | 22/22 pass | Capability discovery/catalog regressions. |
| `tests/arch/resident-capability-discovery.test.ts` | 26/26 pass | P2 discovery regression. |
| `tests/arch/resident-routes.test.ts` | 11/11 pass | Resident route regression. |
| `tests/arch/project-addressing.test.ts` | 8/8 pass | Project/checkout identity. |
| `tests/arch/project-private-state.test.ts` | 1/1 pass | Project private state. |
| `tests/arch/capability-authority.test.ts` | 12/12 pass | Authority boundary regression. |
| `tests/arch/openapi-drift.test.ts` | 2/2 pass | Generated contract drift. |
| `tsc -p tsconfig.node.json --noEmit` | pass | Node TypeScript. |
| `tsc -p browser/tsconfig.browser.json --noEmit` | pass | Browser TypeScript. |
| `scripts/contracts.mjs` generation + drift test | pass | Regenerated OpenAPI; 1,196,075 bytes and 247 documented operations at generation. |
| Focused ESLint on changed TS/UI files | 0 errors, 1 warning | Warning at unchanged `tests/arch/platform-app-catalog.test.ts:179` (`_digest` assigned but unused). |
| AgentLoop MJS syntax check | pass | `node --check node/src/services/agent-loop.mjs`. |
| Explicit MJS unused-var/useless-escape rules | pass | Focused check only. |
| Configured ESLint for AgentLoop MJS | incomplete | Project ESLint configuration run stalled; owned process was stopped after more than 60 seconds. No configured-lint pass claimed. |
| `vite build --config browser/vite.config.ts` | pass | 1445 modules; 26.16 seconds; existing large-chunk warning (main JS about 4.75 MB) and plugin timing output. Build is not browser-rendered acceptance. |
| `git diff --check` | pass | Whitespace check. |
| Full architecture suite, `npm test`, full Veritas, RC, clean-machine/install proof | not run | No claim of full-suite or release acceptance. |
| Real qualified local-worker execution | blocked | No exact qualified route/runtime available; see dependency evidence above. |

Two first-run test failures were preserved rather than erased:

- `agent-task-ownership.test.ts`: first broader run reported 3 pass / 6 fail at existing hard-coded 5-second `eventually` timeouts (about 65 seconds). The unchanged full test later passed 9/9 in about 8.3 seconds. The cause is unknown; no timeout/assertion was weakened.
- `project-registry.test.ts`: first broader run reported 15/16, with a child process terminated/SIGTERM after about 29 seconds and empty streams (fixture timeout 5 seconds). The isolated child passed in 482 ms and the unchanged full test later passed 16/16 in about 5.4 seconds. The cause is unknown; the first red remains evidence.

The browser was built but not launched for rendered interaction acceptance. The real model, Authority-approved execution, actual RUNNING observation, model result/effect, confirmed live stop, and real second-worker aperture were not proven.

The final focused rerun command was:

```powershell
node --experimental-strip-types --no-warnings --import ./scripts/http-close-shim.mjs --test --test-concurrency=1 --test-timeout=240000 tests/arch/governed-execution-spine.test.ts
```

It exited 0 with 6 passed, 0 failed, 0 cancelled, 0 skipped; duration 5903.3979 ms.

## Changed files

26 files changed from the reviewed P2 base:

```text
browser/src/chat/chat.ts
browser/src/cockpit/ProjectsSurface.ts
browser/src/cockpit/WorkerExecutionPanel.ts
browser/src/cockpit/cockpit.css
common/contracts/admission.ts
common/contracts/agent.ts
common/contracts/attempt.ts
common/contracts/context-aperture.ts
common/contracts/worker-handoff.ts
common/openapi.json
node/src/openapi.ts
node/src/routes/agent.ts
node/src/routes/git.ts
node/src/services/agent-loop.d.mts
node/src/services/agent-loop.mjs
node/src/services/app-catalog.ts
node/src/services/attempt-journal.ts
node/src/services/context-aperture.ts
node/src/services/resource-admission.ts
node/src/services/worker-handoff.ts
tests/arch/agent-routes.test.ts
tests/arch/agent-task-ownership.test.ts
tests/arch/governed-execution-spine.test.ts
tests/arch/platform-app-catalog.test.ts
tests/arch/worker-handoff-live.test.ts
tests/arch/worker-handoff.test.ts
```

## Security review and known limits

- No plaintext credentials were put in prompts, receipts, or logs. No provider credentials were copied or inspected.
- No cloud execution, automatic route substitution, or external model acquisition occurred.
- Discovery remains separate from grant, Authority, Resource Admission, execution, and verification.
- Context is data, not permission; aperture contents cannot grant capabilities.
- Route and artifact qualification are rechecked at invocation; UI selection is not trusted as qualification.
- Stop targets the exact AgentLoop session and does not kill a broad process name.
- No sandbox/containment claim is made for the runtime.
- Existing AgentLoop holds a single active root task slot. This wave adds no static worker ceiling, but concurrent root execution across distinct worktrees is not supported or proven by the current owner.
- Resource Admission does not yet know exact incremental memory/VRAM requirements for the selected model; floors alone are not a workload resource reservation.
- Restart recovery records uncertainty but does not yet verify shared runtime PID liveness.
- Handoff continuity is bounded and fresh, but first-to-second-worker execution was fixture-only.
- The new panel has typecheck/lint/build evidence but no rendered browser usability or end-to-end API demonstration.

## Claims explicitly not proven

- A qualified local model/runtime route exists or is available on this machine.
- A real local model accepted the aperture, generated output, or performed a task.
- Any production Authority approval, Resource Admission grant, worker lifecycle, cancellation/termination, or evidence receipt occurred.
- The local worker is sandboxed or network-contained.
- Concurrent multi-worker execution, exact model memory forecasting, full restart/process reconciliation, or complete project-wide Continuity is ready.
- Full test-suite, Veritas, release-candidate, clean-machine, packaged-product, or operator UI acceptance.

**`BLOCKED_EXTERNAL_DEPENDENCY`**
