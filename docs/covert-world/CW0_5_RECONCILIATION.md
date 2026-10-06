# Covert World CW-0.5 Live Reconciliation

**Disposition: `PARTIAL — NOT READY FOR CW-1`**
**Date:** 2026-10-05
**Scope:** reconcile the V3 research/builder pack and the Workbench Integration Spine against the isolated shell lane. This is an evidence note, not an implementation approval.

## Authority and package integrity

- The V3 pack was treated as additive research guidance. Its mandated start, reconciliation, world supervisor, execution-domain, graph/URI, remote-node, model-resource, policy/egress, addendum, builder-convergence, coverage, and research-gap documents were read in the prescribed order before this note.
- Focused workflow: `skills/covert-workbench-integration/SKILL.md` from the pack. The workflow requires one backend truth with multiple projections, separate desktop-window and service lifetimes, and reuse of Model Access, AgentLoop, Authority, and the existing event transport.
- Pack archive: `E:\COVERT_WORLD_RESEARCH_BUILDER_PACK_V3_2026-10-05.zip`
  SHA-256: `80da6c50c54996bcd729f1c83f9187a5e47a08ae415de2fc0f20b34c3072388f`
  Embedded `MANIFEST_V3.sha256`: **75/75 files verified**, zero missing, zero mismatches (76 ZIP entries including directory entries).
- Issue #38 was checked before this reconciliation. Latest comment read: [5976321663](https://github.com/AnonymousNomad/covert-coder/issues/38#issuecomment-5976321663), 2026-10-04. It keeps PR #41 draft/unqualified, Unsloth default, llama.cpp operator-selected, and PR #31 frozen. It does not change this shell lane’s ownership.

## Live lane grounding

| Field | Observed value |
|---|---|
| Worktree | `E:\covert-sovereign-workstation-shell` |
| Branch / HEAD | `feat/covert-sovereign-workstation-shell` / `12b999d329b59fd7dd480504ce84670b0de521f5` |
| Base | `cfaad716a01af06dfe61dcfb3d1acd7dea9b4b2c` |
| Ahead / behind base | `7 / 0` |
| Tracking upstream | None configured; `git rev-parse --abbrev-ref --symbolic-full-name @{u}` reports no upstream |
| Remote | `origin` points to `https://github.com/AnonymousNomad/covert-coder.git`; no push was performed for this reconciliation |
| Pre-existing local changes at start | Six paths listed below; preserved and not overwritten |
| Publication | No commit, push, merge, PR update, or canonical-worktree mutation in this slice |

The preserved uncommitted Workbench interaction WIP is:

- Modified: `browser/src/chat/chat.ts`, `browser/src/cockpit/ResidentCore.ts`, `browser/src/main.css`, `tests/e2e/workstation-real-mutation.spec.ts`.
- Untracked: `browser/src/cockpit/interaction-mode.ts`, `tests/arch/workbench-interaction-spine.test.ts`.
- Intent: one Cipher composer with ASK/PLAN/ACT dispatch; ASK remains the direct chat path, PLAN/ACT use the existing AgentLoop with role selection from Model Access, and typed activity is read from the shared `agent` channel.
- State: **WIP / uncommitted / not accepted**. It predates this V3 reconciliation and is not part of the evidence that closes CW-0.5. The current architecture test has four cases and has not been run after its last addition. The added browser E2E assertions have not been run. A browser TypeScript check was recorded as passing after the implementation’s nullable-closure repair, but it was not rerun during this reconciliation. No exact-SHA CI exists for this dirty state.

Host constraints observed during this read-only pass: free physical memory changed from 2.16 GiB to 1.40 GiB; listeners on ports 4174 and 4878 were absent. No heavy suite was started. This is only a resource snapshot; process ownership or absence is not inferred from a name-filtered process query.

## Reconciliation matrix

| V3 area | Existing canonical owner / evidence | Status | Reconciliation and boundary |
|---|---|---|---|
| Desktop composition and app catalog | `browser/src/cockpit/CockpitShell.ts`; `browser/src/desktop/{app-registry,window-manager,window-manager-view,layout}.ts` | **PARTIAL — reuse** | The isolated shell owns placement, focus, layout, and launcher state. `APP_REGISTRY` currently exposes 11 `AVAILABLE` surfaces (Workspace, Terminal, Cipher Console, Projects, Command Center, Model Lab, Verification/Harness, Skills, Memory/Context, Security, Settings) and one `DISABLED` Extensions surface. Icons are presentation glyphs. There is no accepted World App Library/normalized capability catalog; do not fork the existing panel owners. |
| World Supervisor and Cipher Host | `browser/src/cockpit/ResidentCore.ts`; `node/src/services/agent-loop.mjs`; existing route, Authority, and AgentStreamEvent contracts | **PARTIAL — reuse** | Resident/AgentLoop and the daemon’s existing owners are the available substrate. No separate World Supervisor or Cipher Host contract is proven. Reconcile roles and references through those owners; do not add another orchestrator, task owner, Authority store, or event bus. |
| ASK / PLAN / ACT | `browser/src/chat/chat.ts`; `common/contracts/agent.ts`; `browser/src/cockpit/ResidentCore.ts`; Model Access worker selection | **PARTIAL — WIP** | ASK streams through the conversation’s pinned model ID. AgentLoop already supports `plan` and `act`; PLAN is read-only in the existing service and ACT remains Authority-governed. The local WIP maps Planner/Coder roles and subscribes to validated events on the shared bus, but its changed paths are unverified and uncommitted. Mode selection itself grants no authority. |
| Workbench session references and persistence | `common/contracts/session.ts`; `node/src/services/session-store.ts`; `node/src/services/chat-store.ts`; `browser/src/store/state.ts`; terminal-session routes | **PARTIAL — no unified session contract** | Editor tabs/splits, chat history/model binding, desktop layout, terminal sessions, and Resident task projection have distinct owners. The UI task projection is volatile. No common durable WorkbenchSession reference object or durable combined ASK/AgentLoop transcript was found. Keep credentials and Authority decisions out of any future reference projection. |
| Window lifetime vs service/process lifetime | `WindowManager.close/minimize`; `WindowManagerView.renderWindows`; `CockpitShell` `onAttach`; terminal session service/routes | **SOURCE SEPARATION PRESENT; LIFECYCLE ACCEPTANCE UNKNOWN** | Minimize changes presentation state. Closing removes the window element and its drag/resize listeners; it does not call a terminal stop or model stop route. `onAttach` mounts/activates the registered surface root in a window. This source shape does not prove that all app controllers, event subscriptions, polls, child processes, model leases, or sessions survive close/reopen and full application restart correctly. No complete cross-app identity-preservation E2E exists. |
| Execution domains and process ownership | `node/src/services/owned-process.mjs`; terminal runtime providers including `node/src/services/runtime-providers.ts` | **PARTIAL — domain ledger absent** | `OwnedProcess` retains exact child handles and avoids adoption by caller PID/image search. A WSL PTY provider exists with host/distribution checks. No shared `ExecutionDomain` enum, world Process Ledger, or proven Job Object tree-ownership contract was found. Do not claim all processes are sandboxed, grouped, or attributable to a window. |
| World Graph and internal URI | `node/src/services/system-map.mjs`; `common/contracts/system-map.ts` | **PARTIAL — different scope** | System Map is a subsystem-health snapshot with named probes. It is not evidence of a graph of every project/app/session/model/process/resource. No `covert://` URI contract was found in `common`, `node/src`, or `browser/src`. Keep the existing health projection and do not relabel it as the V3 graph. |
| Remote nodes, WSL, containers, future server | `node/src/services/runtime-providers.ts` | **PARTIAL / FUTURE** | WSL terminal discovery is present. This pass found no general remote-node/server execution-domain adapter or world-level remote-node registry. Container text elsewhere is not proof of a managed container runtime. Preserve UNKNOWN for unsupported hosts and do not claim remote execution coverage. |
| Model Lab, Model Access, acquisition, and resources | `common/contracts/model-access.ts`; `node/src/services/model-manager-view.ts`; model routes; `node/src/services/modelhub.mjs`; resource-admission/readiness services; `browser/src/panels/models.ts` | **PARTIAL — reuse** | Existing Model Access/Manager, modelhub source/download flow, and resource admission remain authoritative. Desktop app `models` is Model Lab; modelhub is not a general multi-source Model Catalog. No World Resource Catalog/Portal is accepted. Model identity, artifact, qualification, runtime, and admission facts must be projected from the current owners. |
| Policy Center and egress ledger | Execution Authority, operation policy, provider/model routing, and existing egress audit paths | **PARTIAL — owner consolidation absent** | Security/Authority/egress owners exist separately. This lane has not demonstrated one world-level policy center or complete append-only egress ledger projection. Do not create competing policy or approval state and do not treat UI presence as permission. |
| Command and tool registry | `node/src/services/command-registry.mjs`, command routes, AgentLoop tool owners, and shell-local launcher/palette | **PARTIAL — preserve both scopes** | A canonical command registry exists for governed commands; the desktop palette also contains presentation/layout actions. They are not one unified app-contributed capability registry. Any convergence must retain Authority at invocation and distinguish open/focus actions from privileged commands. |
| Extensions and builder ownership | Current app registry marks Extensions `DISABLED`; ecosystem work is isolated in its own lane | **NOT IN THIS LANE** | Keep Extensions disabled here. Main Luna owns desktop/app-catalog/Cipher/session projection/resource integration; Ecosystem owns extension/package internals; DeepSeek owns Atlas/Harness/model evidence. No branch or worktree was merged into this lane. |
| Real telemetry and health | Command Center/SystemTelemetry/Readiness/Resource Admission and hardware/profile APIs | **PARTIAL** | Existing telemetry/readiness owners are the only permitted source. This reconciliation did not exercise live telemetry end to end. Never fill missing CPU/GPU/VRAM/runtime/context values with shell-local fixtures or window state. |

## Reuse and convergence map

```text
DesktopLayout / WindowManager / AppRegistry     presentation and placement only
EditorHost / SessionService                     editor documents and editor-session persistence
ChatPanel / ChatStore / chat routes              direct conversation and its pinned model
ResidentCore / AgentLoop / AttemptJournal         governed task execution and task evidence
EventHub / AgentStreamEvent                       existing typed activity transport
TerminalSessionService / runtime providers       PTY/session ownership, including WSL provider
Model Access / Model Manager / Model Hub          provider/model/artifact selection and acquisition
Runtime Broker / Resource Admission              runtime lifecycle and admission truth
Authority / operation policy / egress owners      decision and network-boundary truth
System Map                                       existing subsystem-health projection
```

Future work should store stable references to these facts only where a specific restore/reopen journey requires it. It must not copy service state into a second world database or move process, model, document, or approval authority into the desktop shell.

## Lifetime and model catalog findings

- **Window move/resize/focus/minimize:** presentation state in `WindowManager` and validated desktop-layout persistence. This is not a service restart/stop API.
- **Window close/reopen:** close removes the window root and interaction bindings. Source indicates app surfaces are attached through `CockpitShell.onAttach`; live continuity of each surface controller and each backend identity remains unproven.
- **Application restart:** desktop layout and editor session have separate persistence. Chat history has its own persisted conversation/model binding. No end-to-end evidence reconnects the same AgentLoop task, complete Cipher activity transcript, terminal session, runtime lease, and project/editor selection across restart.
- **Model discovery:** Model Manager/Model Access supplies supported source/selection state; modelhub supplies a Hugging Face search/download path. Neither constitutes an accepted cross-source World Model Catalog. Installed, selected, startable, active, qualified, and responding remain distinct states.
- **App/icon inventory:** the current registry’s 12 entries are listed in the matrix. No separate Browser, Debugger, Source Control, Connections, Model Catalog, or Resource Portal app manifest was observed in `APP_REGISTRY`; related backend/panel surfaces must be checked before any app-level claim.

## Existing browser proof and its limits

The existing reconciliation record reports `npm run test:workstation` passed **1/1** at `0a439528d5835cec00f6cb405acba5b0f50d5d97`. It exercised one real local paired Edge page, canonical AgentLoop mutation/event delivery, dirty Monaco conflict preservation, and an Authority refusal for session save. The AgentLoop model response was scripted. It does **not** prove the present interaction-mode WIP, live provider/model execution, active-editor context entering ASK, PLAN/ACT UI flow, LSP/Git/test/verification convergence, window close/reopen, or restart continuity.

No test, build, Veritas, full Windows gate, or exact-SHA CI was run for this CW-0.5 record. The current live lane is dirty and below the earlier observed free-memory baseline, so this note deliberately makes no verification claim about its in-flight ASK/PLAN/ACT changes.

## Blockers and smallest safe next slice

1. **Blocker to CW-0.5 exit:** no observed browser/runtime test preserves exact identities across open → move/minimize → close/reopen → application restart for the same project/editor state, Cipher conversation and AgentLoop task, terminal session, and selected/active model runtime. Existing sources separate layout from services, but source structure is not lifecycle proof.
2. **Context gap:** the full user journey requiring active editor/selection context in ASK and governed ACT is not proven. The current WIP does not yet add canonical Context Control evidence or durable activity restoration.
3. **WIP hygiene:** the six dirty ASK/PLAN/ACT paths remain uncommitted and unaccepted. Before any new shell feature, run their focused architecture/type/E2E checks under a measured safe resource state; preserve any red, then either finish this bounded slice coherently or record it as a blocker. Do not fold it into CW-0.5 evidence.
4. **Smallest next action:** complete a source-level identity/lifecycle table for the selected real app roots and their canonical session IDs, then define one bounded browser journey that asserts those exact IDs through window move/minimize/close/reopen. Do not create a World Supervisor/session service to make the test pass. If existing owners cannot restore a required ID, document that specific gap before proposing a new reference contract.

## Exit decision

**CW-0.5 is `PARTIAL`, not `READY`.** Desktop presentation, canonical service owners, event transport, Authority, Model Access, model acquisition, WSL terminal discovery, resource admission, and subsystem health can be reconciled to existing owners. The required integrated session references, broad execution-domain/process ledger, general model/resource catalog, world graph/URI, and exact identity-preserving lifecycle proof remain absent or unproven. No CW-1 implementation is authorized by this record. The isolated interaction-mode WIP remains preserved as dirty, unaccepted work; PR #31 and all other worktrees remain untouched.

## CW-0.5B follow-on — identity and lifecycle evidence

### A. Baseline

The required pre-mutation commands were run after reading CW-0.5B. The current root remains `E:\covert-sovereign-workstation-shell`, branch `feat/covert-sovereign-workstation-shell`, HEAD `12b999d329b59fd7dd480504ce84670b0de521f5`, with no configured upstream. The `git worktree list --porcelain` check still shows separate shell, convergence, DOGFOOD, gfx900, model-intelligence, and ecosystem lanes; none were changed. The prior reconciliation file exists at `docs/covert-world/CW0_5_RECONCILIATION.md` and was inventoried before this addendum.

At baseline, the four tracked WIP files had `284 insertions / 40 deletions`; two additional WIP files and the existing reconciliation note were untracked. `git diff --check` returned exit 0. The ASK/PLAN/ACT WIP was not overwritten, staged, committed, stashed, or reset.

### B. Identity owner map

| Object | Actual identity / owner | Creation and persistence | Destroy / current UI relationship |
|---|---|---|---|
| Workbench / workspace | `WorkspaceService.root` (resolved filesystem root); `/api/workspace` returns the `workspace` path. There is no opaque workspace ID in `WorkspaceListResponse`. | Set by daemon configuration; not minted per window. | Desktop layout is separate. No browser lifecycle observation captured a root value in this pass. |
| Project | The workspace is the current Projects surface's root. `project_id` appears in Workflow/Attempt contracts when a governed project workflow/task exists; it is not supplied by the base workspace-list contract. | Workflow owner binds a supplied `project_id` to its generated `workflow_id`; no active workflow identity was sampled. | No standalone project-switch identity is proven in this shell journey. Do not invent one from the display name/path. |
| Open document / editor session | `SessionFile.activeTab`, `tabs[].uri`, and `splitId`; the document identity is a workspace-relative URI/path. The session file has no opaque session UUID. | `EditorHost.captureSession()` produces tab URI/split references; `SessionService` persists and restores this shape. | EditorHost owns the live Monaco models. No identity was sampled from a running browser during this pass. |
| Cipher conversation | `ChatHistoryConversation.id` plus its pinned `modelId`; `ChatStore` persists conversations at the workspace's `.aide/chat-history.json`. | ID is assigned on first successful conversation save; an empty unsaved chat has no persisted conversation ID. `ChatPanel.initialize()` restores the latest stored conversation and its route ID. | Within one frontend, the Resident registration retains the same `ResidentCore`/`ChatPanel` object through visual-window close/reopen. A fresh frontend currently loads the latest stored conversation, not an explicitly persisted active-conversation pointer. |
| AgentLoop session / attempt | `session_id` is a generated UUID held by the AgentLoop service's in-memory session collection. `attempt_id` belongs to the durable AttemptJournal; the journal also records the run/session reference. | Created only by a governed AgentLoop start after Authority/admission. Resident's `residentTask` projection is browser AppState, not a durable session index. | AgentLoop status lookup uses `session_id`; ResidentCore has no startup discovery/re-attach path from the journal. No task was started for this lifecycle slice. |
| Terminal session / PTY | `TerminalSessionInfo.sessionId` is generated by `TerminalSessionService`; service state holds owner, provider, shell, cwd, PTY, and cleanup status. | Created only through the approved terminal-session open route. The service owns a live session map. | Explicit Stop invokes the stop route; server shutdown calls `terminalSessions.stopAll()`. The terminal panel's `activeSessionId` is closure state and is not restored on frontend creation. No PTY was opened here. |
| Model binding / runtime observation | Direct chat persists route `modelId`; AgentLoop receives the exact selected `worker` from Model Access. `ModelManagerRuntime` exposes configured runtime ID and `selected_model_id`; observed loaded identity can include artifact SHA/runtime version. No runtime-instance UUID is exposed in this view. | Chat route is saved with a non-empty conversation. Agent worker is resolved for each governed start. Runtime state is owned by the daemon. | `restoreConversationRouteId()` preserves the stored ID if the route is missing and the chat UI displays an unavailable saved target; source does not silently choose another route. No live Model Access/runtime snapshot was taken for this journey. |
| Workflow / task | If created: `workflow_id` (UUID) and `project_id`; AgentLoop also has `session_id`, `attempt_id`, and request `client_request_id`. | Existing workflow/AgentLoop/AttemptJournal owners create their respective identifiers. | No workflow or AgentLoop session was created in the CW-0.5B pass; IDs are **NOT OBSERVED**, not PASS. |

### C. Bounded lifecycle journey definition

The narrow journey for the existing `npm run test:workstation` harness is one run-ID-scoped temporary workspace with a real test-owned file, actual Covert frontend preview, local `ArchServer`, and one paired browser actor. Record the canonical workspace path, editor URI/split snapshot, saved chat ID/model route, optional AgentLoop session/attempt IDs from the existing governed test path, terminal session ID/provider/state, and Model Access model/runtime/artifact observation before changing any windows.

Then move and resize the Workspace and Cipher/Resident windows, minimize/restore them, close/reopen them, and compare the canonical API/service identities after each step. A frontend reload with the daemon kept alive must be a separate operation from a daemon/application restart: the former can preserve daemon sessions; the latter intentionally runs terminal/model shutdown hooks. Do not create a fake project/workspace UUID, start a local model, or claim a runtime instance where no ID exists. The current test harness exercises a real test workspace and real routes but uses a scripted AgentLoop model response; it does not qualify a provider or model.

This journey was **defined but not launched** in CW-0.5B because current resource pressure makes browser evidence unreliable. No before/after runtime IDs were fabricated.

### D. Identity before/after table

| Object | ID before | Move / resize | Minimize / restore | Close / reopen visual window | Frontend restart with daemon alive | Daemon/app restart | Result |
|---|---|---|---|---|---|---|---|
| Workspace / project | Not observed; source exposes workspace root, not a dedicated workspace UUID. Workflow project ID is conditional. | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN |
| Editor document/session | Not observed; canonical references are URI, active tab, split ID. | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN |
| Cipher conversation/model route | Not observed; persisted pair is conversation ID + `modelId` after a save. | UNKNOWN | UNKNOWN | UNKNOWN (source reuses the same Resident registration in one frontend) | UNKNOWN (source reloads latest stored chat; not browser-proven) | UNKNOWN | UNKNOWN |
| AgentLoop session/attempt | Not observed; no task started. | UNKNOWN | UNKNOWN | UNKNOWN | NOT IMPLEMENTED (Resident has no journal-based reattach/discovery path) | NOT IMPLEMENTED for an in-memory AgentLoop session; durable attempt evidence remains a separate owner | UNKNOWN for no-duplicate runtime proof |
| Terminal session/PTy | Not observed; no session opened. | UNKNOWN | UNKNOWN | UNKNOWN (source does not call Stop on visual close) | NOT IMPLEMENTED (new terminal panel starts with null `activeSessionId` and does not enumerate/adopt a session) | NOT IMPLEMENTED as continuity: daemon shutdown intentionally calls `stopAll()` | UNKNOWN for runtime proof |
| Model/runtime | Not observed; no live Model Access/runtime snapshot was read. | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | NOT IMPLEMENTED for same runtime instance; daemon shutdown stops model runtimes | UNKNOWN |
| Authority | No before snapshot taken. | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | Source window/layout operations do not call Authority routes; runtime ledger invariance is not proven. |

### E. Cipher Host classification

**B. EXISTING OWNERS NEED A THIN ADAPTER.** Resident/`ResidentCore` owns Cipher presentation; AgentLoop owns governed task sessions; ChatStore owns direct conversation history; EventHub owns typed activity transport; WorkflowService owns workflow state; TerminalSessionService owns PTYs; Runtime Broker/Model Access own model/runtime truth; Authority owns decisions. These are real owners but no current projection reconnects all of their IDs after a frontend restart. This is a coordination/read-projection gap, not evidence that a second supervisor or execution service is needed.

### F. Workbench Session classification

Prefer a **read-only reference projection/adapter over existing IDs**, not a new authority-bearing WorkbenchSession contract. It may expose the workspace root, editor URI/split, persisted conversation ID/model route, existing workflow ID/project ID when present, AgentLoop session/attempt reference, terminal session ID/state, and Model Access model/runtime/artifact identity. Missing references must remain null/UNKNOWN. A durable task-recovery contract is not solved by a frontend-only projection; first reconcile AttemptJournal lookup with the existing task/status owner and prove it is needed.

### G. Terminal and process lifetime

- **Move/minimize/visual close:** `WindowManagerView` disposes window interaction bindings and detaches the window root, but does not call `PanelRegistration.dispose()` or the terminal Stop route. `CockpitShell` keeps the terminal registration/root and `TerminalSessionService` remains the PTY owner. Source therefore predicts the same in-memory panel closure and PTY across visual close/reopen, but no browser identity proof was run.
- **Frontend reload while daemon remains up:** a new terminal panel initializes `activeSessionId` to `null`; its refresh path returns when that value is null, so it does not automatically reattach to an existing session. This reattachment is **NOT IMPLEMENTED** in the inspected path. The daemon may still own the old PTY; do not confuse a missing terminal view with a stopped process.
- **Daemon shutdown:** `server.ts` registers `terminalSessions.stopAll()`; `TerminalSessionService.stopAll()` kills active PTYs and finalizes cleanup truthfully. The terminal session map is in-memory, so same-session continuity across daemon restart is not implemented or promised.
- **Process ownership:** terminal and model services own their handles. The unrelated host `llama-server` observed below was not adopted, probed, or terminated.

### H. Model binding lifetime

Direct-chat conversations persist the selected route ID as `modelId`. On restoration, an absent route remains that same saved ID and is rendered as “Unavailable saved target”; no fallback route is selected by `restoreConversationRouteId()`. The same `ResidentCore` object is reused after a visual Cipher-window reopen. Across frontend restart, the current code loads the first conversation returned by chat history (the client treats it as latest), not a separately stored active-chat reference. Runtime loaded identity is available from the Model Manager view as model ID plus observed artifact hash/runtime details, but the lifecycle journey did not read or compare those values. **Live model-binding stability remains UNKNOWN.**

### I. Authority check

The inspected window/layout handlers mutate desktop presentation state and do not dispatch terminal stop, AgentLoop start, model start/stop, or Authority operations. Terminal creation remains behind its approved start route; AgentLoop start/decision/cancel remain governed. No browser lifecycle operation was executed and no Authority ledger snapshot was captured, so “Authority unchanged” is a source-level expectation, not a runtime PASS.

### J. ASK / PLAN / ACT tests

- `node --experimental-strip-types --no-warnings --test tests/arch/workbench-interaction-spine.test.ts`: **4 passed, 0 failed, 0 skipped**, duration 1.46 seconds. This is a static/contract regression for the existing dirty WIP only; it does not prove browser behavior or model execution.
- `git diff --check`: **exit 0** at baseline.
- The latest changes to the architecture test passed. The test file remains uncommitted.
- Browser assertions, browser TypeScript/build, and broader tests were **not run** in this pass because of the resource blocker below. The earlier recorded browser TypeScript pass predates this CW-0.5B verification pass and is not substituted for a current check.

### K. Browser evidence

**No CW-0.5B browser lifecycle evidence.** The existing Workstation harness config uses one worker and a real local `ArchServer`/frontend preview, but starts an Edge browser and builds the frontend. The current dirty E2E assertions for ASK/PLAN/ACT remain unrun. No real terminal session, live model binding, same-ID move/minimize/close/reopen, frontend reattachment, or daemon-restart comparison was observed. All corresponding before/after fields remain UNKNOWN.

### L. Failures and limitations

- The first composed baseline PowerShell command failed to parse before executing any query because one calculated-property hashtable was missing a closing brace. The corrected baseline then ran; no state changed from the parse failure.
- A first exploratory file search assumed a nonexistent `browser/src/api.ts`; repository file discovery located the actual owner at `browser/src/services/api.ts`. This was a search-path error, not a product failure.
- No dynamic evidence resolves the lifecycle identities in the table. Do not reinterpret source-code predictions or the 4/4 architecture test as browser PASS.

### M. Resource state

The first fresh snapshot measured **0.89 GiB free physical RAM** on a 15.92 GiB machine. Windows performance counters then reported approximately **18.76 GiB committed / 24.30 GiB commit limit**, leaving about 5.54 GiB commit headroom. Named process observations at that snapshot included `llama-server` PID 22988 at about 2,115 MiB working set, and three `opencode` processes (PIDs 9788, 18860, 19008) at about 964–1,039 MiB working set each. Ownership/worker association was not proven; none were terminated. No listeners were returned for ports 4173, 4174, 4175, or 4878. At final read-only recheck, free physical RAM had risen to **1.63 GiB**; the subsequent commit-counter query returned no samples, so no newer commit value is claimed. This remained insufficient for a reliable frontend build + browser run alongside processes of unconfirmed ownership. No local model was started by this slice.

### N. Git state

At the post-test read-only check, HEAD remained `12b999d329b59fd7dd480504ce84670b0de521f5`, branch remained `feat/covert-sovereign-workstation-shell`, and the lane remained seven commits ahead of its base with no upstream. The six ASK/PLAN/ACT paths and this reconciliation directory remain dirty/untracked. No commit, push, merge, or reset was performed. PR #31 and other worktrees remain untouched.

### O. Next slice

After a fresh safe-resource measurement and without terminating any process of unconfirmed ownership, run one serial, test-owned Workstation browser journey. Extend the existing harness only as needed to read canonical IDs through current APIs/services before and after each window operation, including a real approved PTY and exact saved model-route identity; use the existing scripted AgentLoop response only to test UI/session identity, not to claim live model qualification. Separate browser reload with daemon alive from daemon shutdown/restart. Record observed IDs and cleanup, then run the affected typecheck/build and preserve any first red. Keep the existing ASK/PLAN/ACT WIP uncommitted until its separate acceptance is proven. Do not start CW-1 during this blocked slice.

### P. CW-0.5B verdict

**CW-0.5 BLOCKED.** Source owners and likely in-process visual-window behavior are now mapped, and the focused ASK/PLAN/ACT architecture test is green. The required browser identity journey, affected typecheck/build, terminal/model live identity, and authority before/after proof could not be run safely at 0.89 GiB free physical RAM while large processes of unconfirmed ownership were active. No identity rows are promoted to PASS. Resume the browser proof only after a fresh resource check makes it reliable; do not broaden scope or begin CW-1.

### Q. 2026-10-06 continuation — owner amendment and startup readiness root cause

The October 6 owner amendment is additive and now governs this lane:

- **Cipher is the persistent Resident.** The selected Liquid model is the Resident's current intended model identity; worker models remain resources delegated through Cipher. Model/task state, Authority and evidence belong to existing services and must survive presentation-window close/reopen.
- **Do not create another orchestrator, model registry, Authority store, or event bus.** Main Luna owns presentation/integration; the backend Model Access/model-resource contract remains with its existing owner. When a required backend contract is missing, record the gap and stop that UI subpath.

Current implementation comparison:

- `browser/src/chat/chat.ts` still sends ASK directly through the conversation-pinned route; a new conversation currently derives that route from the Coder role. PLAN/ACT are separate existing AgentLoop paths. The display label “Cipher” does not make the direct ASK route a Resident-owned interaction.
- Direct chat does expose a route fallback: the stream completion returns the actual selected `modelId`, and the browser displays a banner if that differs from the conversation's pinned ID. This is truthful fallback disclosure, but it does not establish a permanent Resident-to-Liquid binding.
- `common/contracts/model-access.ts` has no `RESIDENT` selection role. Its selection policy explicitly says `persistence_state: NOT_PERSISTED` and `execution_routing_effect: false`. `models/manifest.json` says `liquid_models_included: false`.
- No live runtime is running, so this pass cannot verify that Liquid is selected, loaded, or bound as the current Resident model. The owner’s Liquid instruction is retained as intended architecture; runtime identity remains **UNKNOWN**. Do not present a worker route as Cipher or silently substitute one.
- **Disposition:** Resident-to-Liquid identity and worker delegation are a backend-contract integration gap for this shell lane. No parallel contract or UI-only fallback was introduced.

Startup failure classification and bounded repair:

- The first launcher failure remains preserved in the external recovery note. Its exact error was: `TypeScript backend did not become ready at http://127.0.0.1:4778/api/health: fetch failed`. No pairing proof was generated.
- `scripts/start.mjs` was polling `/api/health` with a 1,000 ms per-fetch abort under the existing 30,000 ms overall start budget. That route calls `BrokerModelRuntime.status()`; on a cold observation, the Unsloth adapter's `health()` calls the Windows `Get-NetTCPConnection` listener probe even when the default endpoint is unconfigured and the port is free.
- Fresh same-host measurement on 2026-10-06: the exact port probe returned `FREE` in **1,670 ms**, longer than the launcher's per-fetch abort. The preserved second-start server log records `/api/health` completing in **1,267 ms**. The Arch listener appeared close to the 30-second deadline in that attempt. These measurements and the call path establish the **readiness-contract defect**; they do not prove every detail of the original first attempt's final probe timing.
- The existing private supervisor IPC already reports readiness only after `ArchServer.listen()` binds, and the canonical test harness uses this signal. `scripts/start.mjs` now uses that IPC signal for Arch and legacy readiness under the **same existing 30-second timeout**. Facade and frontend HTTP probes remain. This is a local, uncommitted repair candidate; it has not yet passed live startup integration.
- Static checks after this edit: `node --check scripts/start.mjs` **exit 0**; `git diff --check` **exit 0**. No integration test, browser test, pairing, commit, or push was performed.

Resource and Git update for this continuation:

- After the explicitly authorized OpenCode close, PID 17640 was confirmed exited. Edge was left open. Fresh memory was **1.68 GiB free physical / 6.14 GiB free commit**, below the 3 GiB workstation-browser/startup proof floor; no browser or full startup run was started.
- The earlier six-path/dirty-state count in sections A/N describes the original reconciliation snapshot. This continuation now observes **21 dirty paths**: the previous uncommitted workstation/terminal lifecycle and ASK/PLAN/ACT WIP, plus this `scripts/start.mjs` repair. Preserve that WIP; do not treat this lane as clean or accepted.
- Branch/HEAD remain `feat/covert-sovereign-workstation-shell` / `12b999d329b59fd7dd480504ce84670b0de521f5`. Nothing was committed or pushed. Latest visible Issue #38 handoff remains comment `5976321663`; PR #31 remains frozen.

**Next:** after free physical RAM is at least 3 GiB, run the focused canonical launch integration, preserve its first result, and verify real frontend URL → pairing → reload/reattach behavior. Then continue the separately blocked Resident/Liquid binding only through its existing Model Access owner and contract.

### R. CW-DOGFOOD-1R continuation — fresh resource/process and startup-gate re-ground

Read-only host snapshot at **2026-10-06 09:34:35 -05:00**:

- Free physical RAM: **1.58 GiB**; free commit: **6.46 GiB**; commit limit: **24.99 GiB**; committed: **18.53 GiB**. Physical admission remains below the 3 GiB shell/browser proof floor; commit headroom remains above the 5 GiB floor.
- `C:\pagefile.sys` is present; WMI reports `AllocatedBaseSize=9278 MiB`, `CurrentUsage=2368 MiB`, `PeakUsage=2584 MiB`. The registry reports `AutomaticManagedPagefile=0` and `PagingFiles="c:\pagefile.sys 0 0"`. This is recorded as observed configuration only; no pagefile change was made.
- The largest observed processes are `llama-server.exe` PIDs **13116** and **24024** at **2125 MiB** and **2107 MiB** working set (**2197 MiB** and **2199 MiB** private bytes), respectively. Their executable paths associate them with the separate `E:\aide-sovereign-workbench\aes-ledgerpro` tree. They listen on `127.0.0.1:54007` and `127.0.0.1:65347`; their recorded parent PIDs **24732** and **17816** no longer exist. The lane cannot prove whether these persistent listeners are idle or serving an active run. Classification: **UNKNOWN — path-associated with another Covert worktree; orphan parent, active listener**. The operator is unsure whether they are serving an active run, so neither process was terminated and there is no stop authorization.
- OpenCode PID **9548** is an operator app (about **1023 MiB** working set / **1694 MiB** private); it remains untouched. Edge remains open per the operator's prior instruction. Codex/ChatGPT and Windows TextInputHost/Defender/Explorer processes are also observed, classified as operator apps or SYSTEM, and untouched. Four additional Node processes each use 106–117 MiB; their task ownership is **UNKNOWN**, so they were not terminated. No process was attributable to this shell lane; the only command-line match was the current inspection shell itself. Expected launch ports **4173, 4174, 4175, 4777, 4778, 4779, and 4878** were free on the later read-only port check; no matching WSL/VM process was observed.

Startup repair source re-ground:

- The dirty candidate changes only the readiness signal for Arch and legacy from HTTP health polling to the existing `superviseAuthority(...).ready()` IPC. `authority-channel.mjs` confirms `close()` clears pending IPC timers and rejects requests; launcher shutdown closes the supervisor before terminating its exact owned children. The existing startup timeout values are unchanged.
- `scripts/start.mjs` defaults `AIDE_START_TIMEOUT_MS` to **30,000 ms**. The existing canonical launch integration sets **10,000 ms** for its child launch. Source applies the configured deadline to the Arch+legacy readiness group, facade readiness, and Vite readiness separately; this is **not one global end-to-end 30-second deadline**. No deadline was increased or changed. The requested launch run must measure its total elapsed time and preserve this distinction.
- A related risk remains open: the facade's `/api/health` route is mapped to Arch `/api/health`, whose health supervisor awaits `modelRuntime.status()` while observing model engines. That is the same cold runtime-status path implicated in the original delay. Arch+legacy IPC readiness removes the slow health call from the initial backend bind gate, but facade `waitForHttp()` still uses a 1,000 ms per-request abort and retries within its existing phase deadline. Whether the first slow observation populates the existing status cache soon enough for facade readiness to pass is **UNKNOWN until the canonical launch integration runs**. Do not mark the repair proven from the IPC change alone.
- `tests/integration/test-canonical-launch.mjs` has two real success cases (typed UI/facade and Vite/facade) and one required-backend failure/cleanup case. The integration has not been run on this candidate because the measured free physical RAM is below the established floor. Therefore readiness, total latency, absence of false timeout, and cleanup remain **UNVERIFIED**.
- No Covert shell was launched; no pairing code was generated; no browser/native shell acceptance, terminal lifecycle, Cipher lifecycle, or Authority before/after proof occurred in this continuation.

External review re-ground on 2026-10-06:

- Latest Issue #38 comment remains **5976321663** (Oct 4): keep PR #41 draft/not merge-ready; Unsloth remains default; no silent fallback; PR #31 stays frozen.
- PR #41 is OPEN and DRAFT at exact head **3e50cb4ce6ee800145b8152a7ec7c3e267349972**, base `nightshift/production-convergence-20260926`; the two AIDE CI runs for this exact SHA are **37186485558** and **37186483344**, both SUCCESS. This does not qualify gfx900 on this host.
- Shell lane remains branch `feat/covert-sovereign-workstation-shell`, HEAD `12b999d329b59fd7dd480504ce84670b0de521f5`, **21 pre-existing dirty paths**, no upstream configured. No commit, push, merge, reset, stash, or branch switch occurred.

**CW-DOGFOOD-1R verdict: PARTIAL — ACTIVE REPAIR REMAINS.** The resource cause for the current proof block is localized to host-wide pressure with two large, separately-worktree model listeners whose owner/activity is unresolved; local Covert leakage has not been observed. The process decision and safe RAM recovery remain open. Do not run startup/browser acceptance below the floor. After recovery, execute the focused launch integration, then the approved real-browser/native pairing and lifecycle sequence; retain its first failure and cleanup evidence. Resident-to-Liquid binding remains a backend-contract gap, not a UI fallback task.

### S. CW-DOGFOOD-1R2 continuation — exact runtime trace and lightweight facade readiness

#### Model-server trace and disposition

The two model servers were traced to a separate nested repository, `E:\aide-sovereign-workbench\aes-ledgerpro`, on the local Windows execution node:

| PID | Executable | Model artifact path | Start / parent | Listener | Child | Disposition |
| --- | --- | --- | --- | --- | --- | --- |
| 13116 | `E:\aide-sovereign-workbench\aes-ledgerpro\runtime\ollama_bundle\lib\ollama\llama-server.exe` | `E:\aide-sovereign-workbench\aes-ledgerpro\runtime\ai_assistant_models\blobs\sha256-5ee4f07cdb9beadbbb293e85803c569b01bd37ed059d2715faa7bb405f31caa6` | 2026-10-06 09:02:35; parent PID 24732 absent | `127.0.0.1:54007` | `conhost.exe` PID 25552, started 09:02:40 | **ACTIVE_FOREIGN_RUNTIME** for this Covert lane; do not terminate |
| 24024 | `E:\aide-sovereign-workbench\aes-ledgerpro\runtime\ollama_bundle\lib\ollama\llama-server.exe` | same blob path/hash above | 2026-10-06 09:09:31; parent PID 17816 absent | `127.0.0.1:65347` | `conhost.exe` PID 8908, started 09:09:31 | **ACTIVE_FOREIGN_RUNTIME** for this Covert lane; do not terminate |

Both server command lines use the same runtime profile and differ by listener port:

```text
llama-server.exe --model E:\aide-sovereign-workbench\aes-ledgerpro\runtime\ai_assistant_models\blobs\sha256-5ee4f07cdb9beadbbb293e85803c569b01bd37ed059d2715faa7bb405f31caa6 --port <54007|65347> --host 127.0.0.1 --no-webui --offline -c 4096 -np 1 --log-verbosity 4 --no-log-prefix --no-log-timestamps --no-jinja --chat-template chatml --load-mode none --flash-attn auto -b 512 -ub 512 --context-shift --keep 4
```

Evidence and limits:

- The associated AES LedgerPro repository is at branch `m2/product-integration`, HEAD `b21d9fede63dddece94b196ea7839e44b24bc110`; it has existing untracked `handoff/`, `incoming/source_code_v6.1_2026-10-05/`, and `review_bundles/` content. Its private `AGENTS.md` and `runtime/README.md` identify it as a separate local project with a bundled standalone inference runtime. No file in that repository was changed.
- Both server processes run as `NEURO-MIRROR\Grey_`. Each has one direct child, its Windows `conhost.exe`; no other process was in either server's child tree. Parentless status is proven; parent launch identity is not. Security Event 4688 had no matching process-creation records in the queried window.
- At 09:54–09:55, TCP state showed both listeners and one `TIME_WAIT` connection to each (`57061 → 54007`, `57062 → 65347`); the closed clients' owning PID was `0`, so their process identities are unavailable. A later check found **no ESTABLISHED connection**. This proves no client was connected at that later instant, while also preserving evidence of recent local connections.
- Runtime server logs exist only from October 1; no server log was updated for the October 6 process starts. There is no `.aide/model-engines.json` in the current shell, the parent `.aide`, or the nested AES project. Exact PID/port/hash searches found no process/session record outside index chunks. Codex's current agent list contains only this root agent; the operator's OpenCode process remains active, so absence of a current external worker claim cannot be established from this host snapshot alone.
- The repository path, process command line, separate project's current branch and WIP, active listeners, recent `TIME_WAIT` connections, absent ledgers, and operator uncertainty do **not** jointly prove a stale Covert orphan. Classification is **ACTIVE_FOREIGN_RUNTIME** relative to this Covert lane; whether the foreign project currently needs the listeners is **UNKNOWN**. Neither process was terminated. RAM recovered by this task: **0 GiB**.

#### Facade readiness dependency and bounded repair

The facade startup dependency was confirmed from source:

```text
start.mjs → Arch + legacy supervisor IPC ready → facade spawn
  → old GET /api/health → facade route map target `ts`
  → Node /api/health → HealthSupervisor.snapshot()
  → modelRuntime.status() → cold runtime discovery / port observation
```

`createFacade()` already implements `GET /api/health/ts` directly in the facade process. `facade.main()` loads/validates the route map before `createFacade()` binds the listener; the local readiness response itself does not call the Arch backend, model runtime, provider, Hugging Face, GPU, or PowerShell probes. Operational `GET /api/health` remains separate and retains its model/runtime diagnostics.

Bounded local change:

- `scripts/start.mjs` now waits for `GET /api/health/ts` for facade startup readiness, retaining the existing retry/request/deadline behavior.
- `tests/unit/test-facade.mjs` adds a focused contract test: the local route returns HTTP 200 with `{ok:true,target:"ts"}`, makes zero requests to the fake backend, and closes its owned facade listener.

Verification on 2026-10-06:

- `node --check scripts/start.mjs`: **exit 0**.
- `node --check tests/unit/test-facade.mjs`: **exit 0**.
- `node --test --test-name-pattern='facade-local startup readiness' tests/unit/test-facade.mjs`: **1 passed, 0 failed, 0 skipped, 0 cancelled**, 1.50 seconds; route completed in 0 ms and the owned listener was closed.
- Free RAM/commit before this focused unit test: **1.47 / 5.51 GiB**; after: **1.45 / 5.45 GiB**. This test did not launch Covert, llama-server, or a browser. Later snapshots have fluctuated as low as **0.33 / 4.56 GiB**.
- `git diff --check`: **exit 0**. The full `tests/integration/test-canonical-launch.mjs` remains unrun because physical RAM is below the 3 GiB proof floor. Startup timing, end-to-end readiness, listener cleanup for this code candidate, and browser/native lifecycle remain **UNVERIFIED**.

The local readiness repair is **TESTED at the facade-route unit boundary**, not accepted as a startup fix. The exact canonical launch integration, pairing/reload journey, terminal/Cipher lifecycle, worker duplication check, and Authority persistence proof remain open. Current process evidence does not justify stopping the AES LedgerPro servers; an operator with knowledge of that separate project's current run must identify a safe shutdown path or leave them running while host resources are recovered elsewhere.

**CW-DOGFOOD-1R2 verdict: PARTIAL — ACTIVE ENGINEERING REPAIR REMAINS.** The facade's slow health dependency has a tested local readiness alternative. The complete launcher path is unverified, and the two live foreign model servers remain untouched; free physical RAM has not reached the launch-test floor. Cipher/Liquid runtime binding remains **UNKNOWN** behind the canonical Model Access contract gap.

#### T. 10:06 resource recheck — servers remain live

A later serial process/socket snapshot corrected an earlier empty result from a parallel probe. That empty result was not a process exit: both original PIDs were still present and listening when independently rechecked at **2026-10-06 10:06:31 -05:00**.

- Windows Memory counters: **1.13 GiB available physical**, **19.99 GiB committed**, **24.99 GiB commit limit**; free commit is **5.00 GiB rounded to 0.01 GiB**. Physical admission is below the 3.0 GiB floor by about 1.87 GiB. Commit is at the 5.0 GiB boundary after rounding and is not counted as a pass.
- PID **13116** and PID **24024** remain `llama-server.exe` processes from the AES LedgerPro runtime path, each with **2.15 GiB private bytes**. Their parent PIDs **24732** and **17816** remain absent; direct children are their respective `conhost.exe` processes.
- Their listeners are still bound to `127.0.0.1:54007` and `127.0.0.1:65347`. The serial socket snapshot showed LISTEN only, no established client connection. Earlier TIME_WAIT client connections remain relevant historical evidence; current inactivity does not establish that either foreign project session is disposable.
- The same host snapshot showed two OpenCode processes (PIDs 21384 and 9548; approximately 0.97/0.87 GiB working set) and active ChatGPT/Codex/Edge processes. The operator has said OpenCode is in use and was unsure whether the model servers are safe to stop. No unrelated application or runtime was terminated.
- The servers' executable path establishes that they belong to a separate local AES LedgerPro project, not this Covert worktree. No evidence proves a Covert origin, stale Covert ownership, a valid cleanup authority, or an idle foreign-project session. **Do not terminate them.** Their current client/worker purpose remains UNKNOWN.

The exact canonical launch integration remains **NOT RUN**: physical RAM is below its admission floor, and commit headroom is only at the rounded boundary. No Covert launcher/browser/native process was started. This snapshot attributes the immediate test block to insufficient host physical headroom with large foreign runtime and active operator workloads present; it does not prove the servers alone caused the entire deficit or establish a Covert leak. Pagefile settings were not changed.

**CW-DOGFOOD-1R2 remains PARTIAL / OPERATOR GATE.** Continue only after the foreign-project owner identifies a safe server shutdown path or host resources recover through another safe route; then remeasure exact counters and run the preserved canonical launch integration before pairing/lifecycle acceptance.

### U. CW-DOGFOOD-1R2 resource-gate directive — freeze, inventory, process trace

Read the owner directive and PC-management skill before this review. This section is additive; earlier parallel-probe and rounded-counter evidence remains preserved. No source file was edited during classification. The inventory was taken on branch `feat/covert-sovereign-workstation-shell`, HEAD `12b999d329b59fd7dd480504ce84670b0de521f5`, with no upstream and 22 status entries. “KEEP” means preserve existing uncommitted work; it does not mean reviewed, tested, accepted, or ready to commit.

#### U.1 Frozen dirty-tree inventory

| Path | Git status | Classification | Likely purpose | Keep/drop/unknown | Intended commit slice |
| --- | --- | --- | --- | --- | --- |
| `browser/src/chat/chat.ts` | M | workstation-shell implementation | One Cipher composer with ASK/PLAN/ACT mode display and governed event timeline | KEEP | Workbench/Cipher interaction |
| `browser/src/cockpit/ResidentCore.ts` | M | workstation-shell implementation | Connect Cipher governed submit/events to existing Resident AgentLoop and shared EventHub | KEEP | Workbench/Cipher interaction |
| `browser/src/main.css` | M | workstation-shell implementation | Styling for workstation/Cipher interaction surfaces | KEEP | Workbench/Cipher interaction |
| `browser/src/main.ts` | M | workstation-shell implementation | Initialize and publish shared EventHub before cockpit mount | KEEP | Workbench/Cipher interaction |
| `browser/src/panels/terminal.ts` | M | workstation-shell implementation | Terminal session discovery, reattachment, scrollback and ownership UI | KEEP | Governed terminal resume |
| `browser/src/services/api.ts` | M | workstation-shell implementation | Typed client call for terminal session resume | KEEP | Governed terminal resume |
| `common/contracts/terminal.ts` | M | workstation-shell implementation | Strict resume request/response schemas | KEEP | Governed terminal resume |
| `common/security/operation-policy.mjs` | M | workstation-shell implementation | Authority operation and HTTP policy for terminal resume | KEEP | Governed terminal resume |
| `docs/v1/routes/C1-02-ROUTE-OWNERSHIP-DECISIONS.json` | M | generated/runtime artifact | Generated route evidence line references shifted by API edits | KEEP | Regenerate/verify route ownership artifacts with terminal API slice |
| `docs/v1/routes/C1-02-ROUTE-OWNERSHIP-DECISIONS.md` | M | documentation/evidence | Route evidence line reference synchronization | KEEP | Regenerate/verify route ownership artifacts with terminal API slice |
| `node/src/routes/terminal-sessions.ts` | M | workstation-shell implementation | Governed terminal resume endpoint and explicit error mapping | KEEP | Governed terminal resume |
| `node/src/services/terminal-sessions.ts` | M | workstation-shell implementation | Bounded scrollback and same-PTY ownership transfer on resume | KEEP | Governed terminal resume |
| `playwright.workstation.config.ts` | M | test/evidence output | Include terminal-authority-refresh E2E and rely on runner's explicit build | KEEP | Workstation E2E harness |
| `scripts/run-workstation-e2e.mjs` | M | test/evidence output | Build frontend, run Playwright, and clean the owned pairing fixture | KEEP | Workstation E2E harness |
| `scripts/start.mjs` | M | workstation-shell implementation | Startup readiness via supervisor IPC and facade-local `/api/health/ts` | KEEP | Startup readiness repair |
| `tests/arch/terminal-session-routes.test.ts` | M | test/evidence output | Terminal resume ownership, bounded output, and refusal coverage | KEEP | Governed terminal resume |
| `tests/e2e/workstation-real-mutation.spec.ts` | M | test/evidence output | Add ASK/PLAN/ACT controls to the real paired workstation mutation journey | KEEP | Workbench/Cipher interaction |
| `tests/unit/test-facade.mjs` | M | test/evidence output | Ensure local startup readiness does not query downstream model health and closes listener | KEEP | Startup readiness repair |
| `browser/src/cockpit/interaction-mode.ts` | ?? | workstation-shell implementation | Presentation-only ASK/PLAN/ACT to existing chat/AgentLoop role mapping | KEEP | Workbench/Cipher interaction |
| `docs/covert-world/CW0_5_RECONCILIATION.md` | ?? | documentation/evidence | CW-0.5C and resource-gate investigation/evidence ledger | KEEP | Evidence only; preserve append-only history |
| `tests/arch/workbench-interaction-spine.test.ts` | ?? | test/evidence output | Verify one composer, exact role dispatch, safe shared agent-event subscription | KEEP | Workbench/Cipher interaction |
| `tests/e2e/terminal-authority-refresh.spec.ts` | ?? | test/evidence output | Paired browser test for terminal discovery, reattachment, owner transition, and stop | KEEP | Governed terminal resume |

All 22 entries correspond to the active workstation-shell branch’s implementation, verification harness, route evidence, or this task’s evidence ledger. No entry was classified stale/duplicate or unrelated/unknown from the available diff. Nothing was deleted, staged, or committed. These candidate slices remain mixed and unverified; this inventory does not authorize a commit.

#### U.2 Per-process trace and ownership decision

Serial, read-only process inspection on **2026-10-06** found the following for the two requested servers:

| PID | Identity and launch | User/session | Children | Current sockets | Classification |
| --- | --- | --- | --- | --- | --- |
| 13116 | `E:\aide-sovereign-workbench\aes-ledgerpro\runtime\ollama_bundle\lib\ollama\llama-server.exe`; blob `sha256-5ee4f07cdb9beadbbb293e85803c569b01bd37ed059d2715faa7bb405f31caa6`; `--port 54007 --host 127.0.0.1 --offline -c 4096 -np 1`; created 09:02:35; parent PID 24732 absent | `NEURO-MIRROR\Grey_`, session 1 | conhost PID 25552 | `127.0.0.1:54007` LISTEN; no established client in the current snapshot | **UNKNOWN** |
| 24024 | Same AES LedgerPro executable and model blob; `--port 65347 --host 127.0.0.1 --offline -c 4096 -np 1`; created 09:09:31; parent PID 17816 absent | `NEURO-MIRROR\Grey_`, session 1 | conhost PID 8908 | `127.0.0.1:65347` LISTEN; no established client in the current snapshot | **UNKNOWN** |

A separate AES-associated process is present: `ollama.exe serve` PID 22176, created 10:06:17, owned by the same user/session, listening on `127.0.0.1:11434`, with conhost PID 23840. Its parent is Python PID 21216 (`E:\Python310\python.exe`), whose script path is `E:\pip_temp\opencode\m2_operator_launch.py`; that Python process has parent PID 15988 (`E:\felon_workspace\venv_py310\Scripts\python.exe`). This proves an AES-path runtime and an OpenCode-path launch helper are active, but does not link either helper to the two older llama-server sessions. The Ollama process working set was about 0.073 GiB; it is not a parent of either target server.

The two llama-server processes have about 2.15 GiB private bytes each. At the latest memory snapshot their working sets were 0.86 GiB (PID 13116) and 2.06 GiB (PID 24024). Their parent process identities, working directories, and environment were not recoverable through the safe existing interfaces used. No `handle.exe`/`handle64.exe`/Process Explorer handle tool was available; no process memory or PEB inspection was attempted. All three `.aide/model-engines.json` locations previously checked (Covert shell, AES parent, AES project) remain absent. OpenCode PIDs 9548 and 21384 had no target port or AES project strings in their command lines, and no current TCP connections to target ports were observed. This does not rule out application-held configuration or prior/recent clients: earlier TIME_WAIT connections to both ports remain recorded in section S. Current connection inactivity is not proof of dispensability.

AES LedgerPro runtime activity is present, but these two specific sessions’ owner, task, client, and valid session-ledger owner remain unproven. Each server is therefore classified exactly **UNKNOWN**, not `ACTIVE / OWNED` and not `SAFE-TO-STOP`. Leave both running. OpenCode is actively in use per operator report and its two processes (PIDs 21384 and 9548) remain untouched.

#### U.3 Serial resource snapshot and recovery route

Serial Windows counter samples began at **2026-10-06 10:20:06 -05:00**:

| Measure | Exact observation | Floor | Verdict |
| --- | --- | --- | --- |
| Physical RAM available | 1,250,340,864 bytes = **1.164471 GiB** at 10:20:08.431 | >= 3 GiB | **FAIL** |
| Total physical RAM | 17,099,075,584 bytes = **15.924755 GiB** | informational | observed |
| Committed bytes | 21,519,634,432 bytes = **20.041721 GiB** at 10:20:09.438 | informational | observed |
| Commit limit | 26,827,939,840 bytes = **24.985466 GiB** at 10:20:10.438 | informational | observed |
| Free commit (limit minus committed) | 5,308,305,408 bytes = **4.943744659 GiB** | > 5 GiB | **FAIL** |

This exact serial reading supersedes the rounded 5.00 GiB value in section T without erasing it. Both gates currently fail; available physical RAM is short by approximately 1.835529 GiB and free commit by approximately 0.056255341 GiB.

Pagefile observations: `C:\pagefile.sys`, allocated 9,278 MiB, current usage 3,362 MiB, peak 3,366 MiB; `AutomaticManagedPagefile=False`; `Win32_PageFileSetting` reports initial and maximum values of 0 MiB. No pagefile or system setting was changed.

Top consumers by working set at the same capture: PID 24024 llama-server 2.06 GiB; OpenCode PID 21384 1.03 GiB and PID 9548 0.93 GiB; PID 13116 llama-server 0.86 GiB; Edge PID 17164 0.63 GiB; ChatGPT PID 10156 0.62 GiB; TextInputHost PID 4320 0.56 GiB; Defender PID 4576 0.45 GiB; additional ChatGPT/Codex and Edge processes followed. These are descriptive measurements, not authorization to terminate.

No Covert launcher process referencing this worktree was found, and ports 4173/4174/4175/4777/4778/4779/4878/5173 had no listeners. Thus no disposable Covert-owned runtime residue was identified. No process was terminated. OpenCode/Codex, Edge/ChatGPT, both llama-server PIDs, the separate Ollama process, and OS processes were intentionally left untouched.

To obtain the missing headroom, the operator-facing groups requiring an owner decision are:

- AES LedgerPro runtime sessions: llama-server PIDs **13116** and **24024** (separate parentless process trees, each with its conhost); also separately running AES-path Ollama PID **22176**. Stop only through the owning AES workflow after confirming no active task needs those sessions. Their working sets indicate possible headroom but do not guarantee how much memory stopping them would recover.
- OpenCode process group: PIDs **21384** and **9548**, currently in use. Closing the app might release about **1.96 GiB working set combined**, but they remain operator-owned and must not be closed while in use.

Edge/ChatGPT and other operator or OS processes were not selected as cleanup targets. No one-process recovery estimate is treated as proof; remeasure both floors after any owner-directed shutdown.

#### U.4 Admission, execution, and final state

Prelaunch verdict: **FAIL — resource admission not satisfied** (`available physical < 3 GiB`; `free commit < 5 GiB`). Therefore the canonical launch command and `tests/integration/test-canonical-launch.mjs` were not run. No browser load, pairing, workstation shell, Resident/Cipher, terminal, model-state, or shutdown/recovery acceptance was attempted. No new Covert process or listener was created; shutdown verification is not applicable. Do not classify this environmental gate as a product failure.

No commit, push, clean, reset, stash, discard, or branch switch occurred. Final branch remains `feat/covert-sovereign-workstation-shell`, HEAD `12b999d329b59fd7dd480504ce84670b0de521f5`; the same 22 dirty entries remain. Section U is appended evidence; no implementation mutation was made during the inventory or process/resource investigation.

**CW-DOGFOOD-1R2 — PARTIAL / OPERATOR GATE.** Resume only after a safe owner-directed resource recovery and a fresh serial measurement clearly passes both floors; then run the canonical launch integration and preserve its first result.
