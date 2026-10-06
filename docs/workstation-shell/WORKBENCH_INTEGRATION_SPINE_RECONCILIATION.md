# Workstation Shell — Workbench Integration Spine Reconciliation

- **Date:** 2026-10-05
- **Authority:** owner addendum supplied 2026-10-05. Additive to the Sovereign Workstation Shell directive.
- **Lane:** `E:\covert-sovereign-workstation-shell`, `feat/covert-sovereign-workstation-shell`
- **Disposition:** architecture reconciled against live source; shell implementation remains isolated and incomplete. No canonical, dogfood, gfx900, model-intelligence, or extension lane was changed.

## Initial grounding before shell mutation — 2026-10-05

| Worktree | Branch / HEAD | State observed | Ownership boundary |
|---|---|---|---|
| Workstation shell | `feat/covert-sovereign-workstation-shell` / `b1002c9aabd5f9ed4ca7ec87b3937030aa3348c5` (parent `cfaad716a01af06dfe61dcfb3d1acd7dea9b4b2c`) | Dirty with this lane's shell, theme, voice, and identity implementation. No upstream is configured; ahead/behind cannot be stated against a tracking branch. | Current lane. No parallel agents are editing it. |
| Canonical convergence | `nightshift/production-convergence-20260926` / `cfaad716a01af06dfe61dcfb3d1acd7dea9b4b2c` | 11 commits ahead of origin; one pre-existing untracked owner directive under `docs/nightshift/`. | Protected; untouched. |
| Dogfood | `codex/dogfood-0-20261004` / `c20e7be9bcab91e4495575dbde2ed3d05484b672` | Clean and tracking origin. | Protected; untouched. |
| gfx900 | `feat/runtime-gfx900-compat` / current worktree head | Existing dirty change to `docs/evidence/desktop-battery.md`. | Protected; untouched. |
| Model intelligence | `feat/model-intelligence-mi1-20261005` / `cfaad716a01af06dfe61dcfb3d1acd7dea9b4b2c` | Clean at initial grounding. | Protected; untouched. |
| Ecosystem expansion | `codex/covert-ecosystem-expansion-luna2` / `875b3dd8edb217bbe82c1b92515168cb8aca8e62` | Existing untracked extension-host files at initial grounding. | Protected; untouched. |

The repository has many historical worktrees. The rows above are the concurrent Covert lanes relevant to this addendum; their changes were not read or modified. The shell branch is isolated from them.

## Protected-lane status refresh before checkpoint — 2026-10-05

Read-only Git status was refreshed after the shell verification. Canonical remains at `cfaad716a01af06dfe61dcfb3d1acd7dea9b4b2c` with its existing untracked owner directive; DOGFOOD remains clean at `c20e7be9bcab91e4495575dbde2ed3d05484b672`; gfx900 remains at `3e50cb4ce6ee800145b8152a7ec7c3e267349972` with its existing modified desktop battery evidence. The model-intelligence worktree at `cfaad716...` now has untracked Model Atlas/Harness Sync source and tests; the ecosystem branch at `875b3dd...` now has broader tracked and untracked extension-host/API work. These remain separately owned and were not inspected or modified.

Issue #38 was checked before this checkpoint. Its latest visible comment is the [2026-10-04 gfx900/ROCm handoff](https://github.com/AnonymousNomad/covert-coder/issues/38#issuecomment-5976321663): PR #41 stays draft and unqualified pending real-host evidence; llama.cpp remains operator-selected; only bounded deltas may be integrated after their gates, with no wholesale branch merge. It has no corrective instruction directed at this shell lane. PR #31 remains frozen.

## Architectural reconciliation

The requested layering matches the repository's existing ownership model:

```text
desktop shell and views
        ↓
existing browser clients / shared session projections
        ↓
typed facade routes and shared event transport
        ↓
canonical daemon services and Execution Authority
```

Do not introduce a second backend, universal event bus, model router, workspace owner, or authority store. The new desktop layer owns placement, focus, appearance, and launcher state only. Its local layout persistence remains separate from daemon-owned workspace/editor session state.

## Requirement map against current source

| Addendum area | Current owner / evidence | Status and boundary |
|---|---|---|
| 1–2. Presentation / integration / canonical service layers | `CockpitShell.ts`, `WindowManager`, `WindowManagerView`, existing typed `api.ts`; daemon route/service ownership remains in `node/src/`. | **PARTIAL.** Window composition is presentation-only. Keep it so. An integration projection must compose existing owners rather than become another backend. |
| 3–5. Shared Workbench Session, non-authority, separate layout | `browser/src/store/state.ts` holds the current editor session projection and a volatile Resident task projection. `SessionFile` persists editor tabs/splits only. `ChatStore` separately persists `{id, modelId, title, messages}`. `DesktopLayoutState` is separately persisted by `WindowManager`. | **PARTIAL.** These owners remain separate and layout cannot grant authority. There is no shared WorkbenchSession with conversation/task/terminal/debug references and live Git/diagnostics/verification projections. Reconcile references only; do not duplicate backend facts or store credentials/approval. |
| 6. Window lifetime vs service lifetime | `WindowManagerView` hides/minimizes a window without calling service stops. Removing a window element detaches its hosted root; reopening reattaches the registered root. Terminal stop is an explicit `POST /api/terminal/sessions/stop`. | **PARTIAL / NEEDS LIFECYCLE E2E.** Closing a view does not intentionally stop its process. Hidden/detached app controllers can still poll or render; add visibility suspension only through existing controller lifecycle seams and prove reactivation. |
| 7–13, 48–49. Cipher ASK/PLAN/ACT, conversation binding, exact model identity, activity | `ChatPanel` streams ASK through `/api/chat/stream` with its conversation-bound model route. `AgentStartRequest` already supports `plan` and `act`; production `/api/agent/start` binds the exact Model Access worker and role. `residentWorkerForSelection(view, role)` can project Planner/Coder identities, but `ResidentCore.startAgent` currently hardcodes ACT/Coder. `AgentStreamEvent` and the shared `EventHub` already carry plan, message, tool, approval, context, verification, and terminal events. `main.ts` currently consumes only `file_mutation` from the `agent` channel. | **PARTIAL.** Keep ASK and governed PLAN/ACT as distinct backend paths. Cipher still has separate chat and task composers, no explicit mode selector, and no single event-backed transcript. Do not add a model router/event bus or let UI mode grant Authority. Show each path's actual resolved route/role. |
| 14–16. Tool and Command Registries | `node/src/services/agent-tools.mjs`, `node/src/services/command-registry.mjs`, and `node/src/routes/commands.ts` exist. The desktop palette currently contains shell-owned open-app/layout actions. | **PARTIAL.** Existing registries must be inspected and reused. The shell palette is not yet the shared registry, and an available tool is not authority. No shell action may imply authorization. |
| 17–19, 22. Document Service, unsaved buffers, model/view separation, edit events | `browser/src/editor/models.ts` owns Monaco text models; `EditorHost` owns document operations and groups; `editor/lsp-bridge.ts` observes Monaco changes. Canonical file-write, patch, search-replace, and AgentLoop paths emit content-free `file_mutation` through the existing `agent` channel. | **PARTIAL / COUPLED JOURNEY PROVEN FOR ONE PATH.** The browser re-reads through `/api/file`, reloads a changed clean model, and preserves dirty buffers with a visible conflict plus explicit overwrite confirmation. `test:workstation` now proves the real local Authority → AgentLoop → EventHub → same Edge page → Monaco conflict path with a scripted AgentLoop response. Other process/task writes and downstream LSP/Git/verification reconciliation remain open. This is a bounded seam, not a complete DocumentService. |
| 20. Event transport | `browser/src/services/ws.ts` creates one shared authenticated event bus; terminal and editor diagnostics subscribe to it. | **REUSED.** Do not create another global bus. REST remains the request/response truth. |
| 21. Context Control | Existing chat composer and model router own prompt context; Resident task requests own their existing context/workflow fields. | **PARTIAL.** Active document/selection/open files are not yet proven to survive into both ASK and ACT through a single visible Context Control projection. Do not inject every workbench datum automatically. |
| 23. Terminal | `createTerminalPanel` uses xterm, canonical terminal session routes, and the shared authenticated event bus. Browser review before pairing showed `authenticated actor required`; no interactive PTY acceptance was performed. | **IMPLEMENTED SURFACE / LIVE ACCEPTANCE UNKNOWN.** It is a real terminal route, not a simulated console. Window move/minimize/restore must preserve the exact session and PTY resize; not yet proven. |
| 24–25. Git and LSP | `/api/git/status` and `git-service.mjs` own Git truth. LSP starts and diagnostics flow through existing browser bridge/event subscriptions. | **PARTIAL.** These services exist but the shell does not yet project their facts through one shared workbench snapshot. Do not add per-window watchers or language-server clients. |
| 26. DAP/debug | `node/src/services/dap.ts`, `node/src/routes/dap.ts`, and `common/contracts/dap.ts` exist. | **BACKEND PRESENT / WORKSTATION INTEGRATION UNKNOWN.** No complete Debug application/session restore flow has been proven in this lane. |
| 27–29. Model lifetime, provider failure, offline behavior | Model Access/Runtime Broker and provider services remain daemon owners; model controls are hosted from the existing Model Lab. | **OWNER PRESERVED / SHELL E2E OPEN.** Closing a window must not start/stop a runtime. Provider degradation must not gate editor/terminal/Git. No model/provider failure test has yet proved the new shell remains operational. |
| 30, 32. Cipher and App Registry | `APP_REGISTRY` maps windows to existing surface roots; Cipher maps to `ResidentCore`. | **PARTIAL.** These are presentation registrations, not a unified capability or extension registry. The Cipher window is movable, but the integration contract is not complete. |
| 31. Voice | `browser/src/desktop/cipher-voice.ts` exposes opt-in browser TTS, unavailable input/wake interfaces, and no automatic mic access. Current Tauri targets MSI/NSIS; Windows.Media custom speech grammar requires MSIX package identity. Microsoft SAPI is an available legacy native candidate but uses the shared Windows recognizer/audio path. | **PARTIAL / INPUT UNAVAILABLE.** Speech output source/locality is not claimed. Wake listening remains off/unavailable. No typed speech input is sent to chat or AgentLoop, and no authority path is added. |
| 33–34. Extensions / one Covert environment | Extension host UI is disabled in this shell registry; an ecosystem branch contains separate untracked work. | **FUTURE / SEPARATE LANE.** Keep disabled until its branch is integrated and qualified. Do not import that dirty worktree or expose a fake contribution surface. |
| 35–37. Persistence, restore, layouts | Desktop layout uses validated local presentation state. `SessionService` restores editor tabs/splits; chat has its own backend conversation history; terminal has a canonical session list. | **PARTIAL.** There is no unified restore coordinator. Layout restoration must not assert live conversation/process/model state; each canonical owner must reconcile its own state. |
| 38–43. Required E2Es | `npm run test:workstation` runs installed Edge against a local `ArchServer`/`EventHub`, pairs through a real one-use Authority proof, starts the canonical AgentLoop route, approves `checkpoint.snapshot` and `write_file`, and observes the resulting file mutation in the same page that holds a dirty Monaco buffer. | **PARTIAL.** This closes the earlier producer/receiver split and proves the unsaved-buffer refusal for this scripted local task. The test's `agentChatFn` is scripted and bypasses production exact Model Access dispatch. It does not prove ASK with active-editor context, live model/provider behavior, LSP/Git/test/verification propagation, task recovery after app restart, layout continuity, or extension lifecycle. |
| 44–47. Performance and no window-owned backends | Lazy panel registration, shared event bus, daemon APIs, and single editor host exist. | **PARTIAL.** Some hosted panels retain controller polling while hidden/detached. No model/runtime/router or backend should be instantiated per window. |
| 48–49. Interaction modes and real activity | `api.chatStream` and `/api/agent/start` are distinct paths; `AgentStreamEvent` has typed task/tool/context/verification events on the shared `agent` channel. | **OPEN.** There is no visible ASK/PLAN/ACT routing or event-backed Cipher transcript yet. The event sources are real; the UI does not project them as a unified conversation. Never animate work without real events. |
| 50–52. Completion and live grounding | Shell branch is isolated at the SHA above; source audit and browser fixture remain incomplete. | **NOT COMPLETE.** No product integration or release/canonical claim is made. This addendum changes the acceptance spine, not the protected worktree ownership. |

## Current bounded implementation in this lane

The existing shell code is being connected to its real presentation owners: desktop layout, editor host, xterm, typed readiness read, and Settings. Cipher voice preferences are opt-in; the default has no microphone or wake listener. The current local Windows browser review showed:

- The shell and Workspace/Terminal windows render in Edge with no page errors.
- The active browser session is unpaired. Protected workspace and terminal reads return `authenticated actor required`; this is not a terminal/runtime acceptance pass.
- The topbar displayed `DAEMON: UNKNOWN` in that review even though the local facade health probe returned HTTP 200 outside the browser. This discrepancy is preserved for diagnosis; it must not be relabeled ONLINE without a browser-side cause/evidence check.
- Existing browser automation previously exposed a real overlap: the newly focused Cipher window intercepted Terminal controls. Reorder/focus before interaction in the test, then verify actual hit targets separately; do not suppress the failure.
- The shell is served from the actual `.covert-desktop-shell` root. A prior probe guessed `.desktop-shell` and timed out before inspecting the page; source inspection found the correct class. That was a browser-probe error, not a product startup failure.
- Cipher now places the existing direct-chat panel before workspace details. The four independent status sources are grouped in a native collapsed `<details>` disclosure with a truthful responding-source count. Direct chat and governed AgentLoop composition remain separate.
- At 1440×960, the browser review shows the conversation model, message area, input, and Send control before the collapsed status disclosure. The unpaired browser reports `0/4 SOURCES RETURNING DATA`; it does not imply those backend capabilities are absent. The current screenshot is `docs/workstation-shell/review/workstation-shell-cipher-priority-1440x960.png`.
- The 3 px difference between the Resident window root's scroll and client widths is caused by `.desktop-resize-handle.desktop-resize-e` extending 2 px beyond the window edge as a resize hit target. The content controls fit within the window; no chat-pane horizontal clipping was observed.

## Verification and preserved failure — 2026-10-05

### Changed-scope evidence

- `node --experimental-strip-types --no-warnings --test tests/unit/test-desktop-window-manager.test.mjs tests/unit/test-desktop-theme-voice.test.mjs` — **10 passed, 0 failed, 0 skipped**.
- `node --test tests/unit/test-desktop-lifecycle-contract.mjs` — **3 passed, 0 failed, 0 skipped**.
- `npx tsc -p browser/tsconfig.browser.json --noEmit` — passed.
- Focused ESLint on changed frontend and unit-test files — passed.
- `npm run build:frontend` after the final Cipher change — passed, 1,431 modules, 51.4 s. Output contained a 4,679 kB main JavaScript chunk (1,208 kB gzip) and the existing >500 kB chunk-size warning. A redundant dynamic import from `cipher-voice.ts` to the already-static `api.ts` import was removed; Vite no longer reports `INEFFECTIVE_DYNAMIC_IMPORT`.
- `npx playwright test tests/e2e/workstation-shell.spec.ts --config playwright.config.ts` with `AIDE_PLAYWRIGHT_CHANNEL=msedge` — **1 passed** on the final built preview, 19.0 s. It verified chat precedes the disclosure, both chat controls fit in the window, the disclosure is closed by default and opens on activation, and there are no page errors.
- `node scripts/egress-audit.mjs` — **PASS**, no remote fetch/WebSocket/EventSource call-sites or `ws`/`wss` literals in 97 built files. Reported non-localhost Monaco documentation/license URL strings are informational only.
- `git diff --check` — passed before the latest evidence-note update.

### Broad gate red; not attributed to this lane

`npm run check` completed both TypeScript projects and ESLint (0 errors, 62 repository warnings), then the serialized architecture suite hit its first red in the unchanged `tests/arch/harness-attempt.test.ts` performance case:

```text
measured: admit_ms=2171, assert_admitted_ms=2
failure bound: admit_ms < 2000
```

The suite was stopped at that red, so the architecture suite and `npm run check` are **PARTIAL/FAILED**, not green. `git diff HEAD -- node/src/services/attempt-journal.ts tests/arch/harness-attempt.test.ts` was empty. The runner was serialized (`concurrency=1`); the temp workspace was on `E:\pip_temp`.

After inspecting the durable path, one isolated execution of the exact named test passed at `admit_ms=1021`, `assert_admitted_ms=2` (1 pass, 0 failures, 0 skips). A separate one-shot diagnostic measured prepare/seal at 377 ms. An instrumented admission then recorded highly variable `FileHandle.sync()` durations (up to 12,311 ms on `journal.jsonl`, 9,609 ms on an envelope temp file; aggregate admission 23,755 ms). This confirms the operation includes multiple durable file syncs and that their observed latency varied substantially across runs. **CAUSE NOT PROVEN**: the evidence does not identify which OS/storage component caused the latency, and the isolated pass does not erase the original red. No timeout, test threshold, journal durability, or assertion was changed.

No model was started. The browser session was unpaired; workspace/terminal API calls remained protected and unavailable. No claim is made for real PTY, provider, model, restart, or Authority acceptance through this browser review.

## Governed AgentLoop edit → Monaco reconciliation slice — 2026-10-05

### Finding and bounded repair

Source tracing established the defect boundary: AgentLoop's governed `write_file` and `replace_in_file` tools update the workspace through the existing Authority-controlled execution path, while Monaco keeps its own URI-keyed in-memory text model. There was no typed notification from the successful backend mutation to the existing editor host. Moving or remounting the editor window did not synchronize the two owners.

The repair extends the existing `AgentStreamEvent` union with `file_mutation { session_id, paths, outcome }`; it publishes no file content and adds no event bus or authorization path. A successful file tool emits `observed` after the tool returns success. If a dispatched file tool errors, it emits `uncertain`, so the browser checks disk without assuming whether the write landed. The browser validates the event, re-reads through the canonical file route, and then:

- leaves a matching saved snapshot alone;
- reloads a changed clean model and lets the existing Monaco change listener notify LSP;
- preserves a changed dirty model, marks the tab for review, and requires explicit operator confirmation before a save can replace the disk version;
- marks state unavailable and blocks an unconfirmed save if the canonical file read cannot establish current contents.

### Evidence

- `node --experimental-strip-types --no-warnings --test tests/unit/test-document-reconcile.test.mjs` — **4 passed, 0 failed, 0 skipped**.
- Browser TypeScript check — passed.
- Focused ESLint across changed browser/backend/contracts/tests — passed.
- `node --check node/src/services/agent-loop.mjs` — passed.
- `node --experimental-strip-types --no-warnings --test --test-concurrency=1 tests/arch/agent-routes.test.ts tests/arch/agent-execution-integrity.test.ts` — **38 passed, 0 failed, 0 skipped**. This includes a real paired AgentLoop write observed through the existing authenticated WebSocket channel; the event contains only the relative path and the test verifies file content is absent.
- `npm run build:frontend` — passed, 1,432 modules. The existing main bundle size warning remains (4,682.03 kB; 1,209.00 kB gzip).
- `npx playwright test tests/e2e/workstation-shell.spec.ts --config playwright.config.ts` — **1 passed** on the built preview; no page error and shell interaction regression observed.
- `git diff --check` — passed.

### Scope still unproven

At this route-slice checkpoint, the backend producer and browser receiver were still separate proofs. The later same-browser Edge run below closes the coupled proof for one scripted AgentLoop `write_file` path. Shell `run_command` and mutations from other task/external process paths still require explicit event coverage or an owner-bounded limitation.

## Browser conflict receiver fixture — 2026-10-05

### Result

`tests/e2e/workstation-shell.spec.ts` now covers the actual browser event subscriber, `EditorHost`, Monaco model, tab conflict indicator, and explicit overwrite confirmation. It opens a session-backed fixture document, pairs the shell UI, marks the Monaco buffer dirty, changes fixture disk contents, publishes a typed `file_mutation` envelope through Playwright's WebSocket route, and verifies:

- the dirty tab gains the external-conflict state;
- the editor draft remains visible;
- declining the overwrite confirmation issues zero `POST /api/file/write` requests;
- no browser page error occurs.

All HTTP responses, pairing exchange, and WebSocket server events in this browser test are fixtures. The fake token and synthetic WebSocket event do not prove production pairing, real Authority, or a real AgentLoop-to-browser round trip. The prior architecture test remains the independent real paired AgentLoop producer proof.

### Verification

- `npx playwright test tests/e2e/workstation-shell.spec.ts --config playwright.config.ts --list` — 2 tests discovered.
- `$env:AIDE_PLAYWRIGHT_CHANNEL='msedge'; npx playwright test tests/e2e/workstation-shell.spec.ts --config playwright.config.ts` — **2 passed, 0 failed, 0 skipped**. The existing Cipher shell smoke passed in 2.0 s; the new conflict receiver fixture passed in 3.8 s; total 9.1 s.
- `npx tsc -p browser/tsconfig.browser.json --noEmit` — passed.
- `npx eslint tests/e2e/workstation-shell.spec.ts` — passed.
- `node --experimental-strip-types --no-warnings --test tests/unit/test-document-reconcile.test.mjs` — **4 passed, 0 failed, 0 skipped**.
- `npm run build:frontend` — passed, 1,432 modules; the existing large-bundle warning remains (main JavaScript chunk 4,682.03 kB, 1,209.07 kB gzip).
- `git diff --check` — passed.

### Preserved test-environment and fixture failures

- The first Playwright invocation used its default Chromium channel and failed before test execution because `chromium_headless_shell-1243` is not installed. The same test file runs in the installed Edge channel; no browser was installed as part of this slice.
- Early browser-test iterations failed to find a tab after the asynchronous pairing/session-restore setup. That fixture-specific cause was **not proven**. The final test deliberately seeds its editor document from the startup session and tests only the event receiver/conflict behavior. Pair-time session restore remains unqualified; these earlier reds are not counted as product passes or erased by the fixture's green result.

## Current acceptance status

The editor's dirty-buffer conflict behavior is **FIXTURE-VERIFIED**, and the later `test:workstation` run **COUPLED-VERIFIES** one real local pairing → Authority → AgentLoop → EventHub → same-browser Monaco mutation with a scripted model callback. This closes addendum 39 for that bounded path. It does not establish production Model Access dispatch, live inference, all mutation origins, or a complete DocumentService; those remain open.

## Canonical workspace-route mutation events — 2026-10-05

### Finding and bounded repair

The first event slice observed only governed AgentLoop `write_file` and `replace_in_file`. Source mapping found three other canonical workspace-writing routes: `/api/file/write`, `/api/search/replace`, and `/api/patch/apply`. These routes already pass through Execution Authority and `WorkspaceService`; the repair adds no write route, authority state, or event transport.

The existing content-free `file_mutation` payload now identifies `origin` (`agent_loop`, `file_write`, `search_replace`, or `patch_apply`). Only AgentLoop events carry `session_id`; route events do not invent one. Each route publishes only after its write owner succeeds, on the existing `agent` EventHub channel, scoped to the authenticated actor's sockets. Search/replace reports paths whose atomic writes completed even if a later file fails. Patch apply obtains its affected paths from `git apply --numstat -z`, validates those paths against the workspace root, and keeps the existing HTTP response contract unchanged. Events are split into batches capped at 20 paths and 6 KiB to bound event fanout and frame size.

### Verification

- `node --experimental-strip-types --no-warnings --test --test-concurrency=1 tests/arch/file-routes.test.ts tests/arch/search-parity.test.ts tests/arch/terminal-patch-routes.test.ts tests/arch/agent-execution-integrity.test.ts tests/arch/agent-routes.test.ts` — **56 passed, 0 failed, 0 skipped**. Covers the three API mutation origins, route actor audience selection, content-free payloads, existing real AgentLoop WebSocket producer, and Authority protections.
- `npx tsc -p tsconfig.node.json --noEmit` — passed.
- `npx tsc -p browser/tsconfig.browser.json --noEmit` — passed.
- Focused ESLint across changed contract, route/service, and test files — passed.
- `npm run build:frontend` — passed, 1,432 modules; the existing main bundle remains 4,682.11 kB (1,209.11 kB gzip) and Vite reports the existing >500 kB warning.
- `$env:AIDE_PLAYWRIGHT_CHANNEL='msedge'; npx playwright test tests/e2e/workstation-shell.spec.ts --config playwright.config.ts` — **2 passed, 0 failed, 0 skipped**, 12.4 s. The conflict test still uses fixture HTTP/pairing/WebSocket responses.
- `node scripts/egress-audit.mjs` — **PASS**, no remote fetch/WebSocket/EventSource call sites or remote socket literals in the 97-file bundle. Non-localhost URL strings remain Monaco documentation/license data.
- `git diff --check` — passed.

The first Node typecheck found that TypeScript could not see the E2E fixture's callback-assigned sender and narrowed it to `null`; the runtime assertion and synchronization were already present. An explicit local function union now communicates the callback mutation to the checker without weakening the runtime assertion. A subsequent typecheck caught `exactOptionalPropertyTypes` and unchecked array-index errors in the new route-event assertion; the capture type now represents present-but-undefined predicates explicitly and the test narrows the indexed event before use. Both follow-up typechecks passed. The callback repair pattern is recorded in `C:\Users\Grey_\.agents\skills\failure-node-typescript-callback-closure-narrowing\SKILL.md`; the strict optional-property correction followed `failure-typescript-exact-optional-and-discriminants`.

A separate temporary-Git diagnostic confirmed rename numstat framing as `0\t0\t\0old-name.txt\0new-name.txt\0`; the parser retains both paths. The automated patch-route case covers a normal modified file, so a real rename-through-route regression case remains future coverage.

### Remaining boundary

This closes notifications for the three canonical HTTP file-mutation routes, not every possible disk writer. Terminal/PTY commands, LSP/DAP tools, task child processes, and external applications can still change files without publishing this event. At this route-slice checkpoint, the same-browser pairing → AgentLoop → Monaco journey remained open; the later coupled Edge proof below covers the AgentLoop `write_file` route only. Do not infer whole-workspace change observation from either bounded test.

## Sequencing decision

1. Finish and verify this isolated shell foundation without claiming a complete workstation integration.
2. Use the canonical backend/Authority owners; do not add `WorkbenchSession`, `InteractionService`, `DocumentService`, universal `ToolRegistry`, or another event bus until each existing equivalent is mapped to a concrete gap and an owner-approved contract.
3. Complete same-browser, real AgentLoop-to-Monaco mutation acceptance. Separately decide how terminal/PTY and external process writes are observed; API route coverage does not close that gap.
4. Then implement Cipher ASK/PLAN/ACT presentation by composing the current direct-chat and governed AgentLoop paths, preserving conversation binding, exact Model Access identity, Context Control, and the same Execution Authority. No direct mutation route from a window or speech adapter.
5. Prove the prescribed journeys in dependency order: editor/context; ACT/Authority; document/model/LSP/Git; test/verification; process and model lifetime; layout restore; provider failure/offline; extension only after its ecosystem lane is integrated.

**Release / product claim:** UNKNOWN. A movable UI shell with live surfaces is not the integrated workstation acceptance defined by this addendum.

## Coupled real-browser mutation attempt — 2026-10-05

### Preserved first failure: fixture identity mismatch

The first run of `npx playwright test --config playwright.workstation.config.ts` failed before browser interaction with `ENOENT` reading the one-use pairing proof. The config generated a new UUID during module evaluation, while the fixture server had created the workspace and proof under a different UUID. The failure report captured expected run ID `131cc4cd-5af9-4aeb-8c44-965dbd8442bb`; the exact test-owned fixture artifacts were under `3c508ecf-85ff-4478-93b7-6446d22e2dc8`. The proof contents were never read into command output or logs.

The launcher now generates one run ID before starting Playwright, passes it through the inherited environment, and the config fails closed if it is missing. Both fixture processes derive their paths from that ID. The focused TypeScript, lint, and JavaScript syntax checks passed after this harness repair. The recovery procedure is captured in `C:\Users\Grey_\.agents\skills\failure-playwright-cross-process-fixture-identity\SKILL.md`.

### Current preserved red: pairing-to-workspace transition

The browser rendered `Authority paired: PAIRED`, but the test failed because `.desktop-workspace-gate` remained visible. The sanitized trace captured four `GET /api/workspace` results with status `403` and code `FORBIDDEN`; the paired read had a bearer header, no `Origin`, no `Sec-Fetch-Site`, and a `Referer` whose origin matched the app. A focused `tests/arch/workspace-routes.test.ts` reproduction then produced **3 passed / 1 failed**: a same-origin read with no `Origin` was rejected, while a cross-site read without `Origin` stayed denied. The server passed only `request.headers.origin` (or the empty string) to `ExecutionAuthority.authenticate`, which requires exact equality with the origin stored at pairing. This is the confirmed root cause of the protected browser GET failure.

The bounded repair keeps that exact actor-origin comparison. An explicit `Origin` remains authoritative; only `GET`/`HEAD` requests with no Origin may derive it from a valid `Referer` origin. Missing, malformed, opaque, credential-bearing, or mismatched referrers remain denied. The recovery skill records why `Sec-Fetch-Site` cannot be a prerequisite on this supported browser path.

The Playwright `afterAll` removed that run's exact workspace and proof artifacts. No process remained on ports 4174/4878, and the test-owned server and preview processes had exited. The saved Playwright failure context and this record preserve the red before the next diagnostic run.

### Next integration boundary and teardown red

After the browser-origin repair, the next Edge run passed pairing, the workspace gate, and the editor-session visibility checks, then started the scripted AgentLoop task. The test expected the first pending approval to be `write_file` but observed `checkpoint.snapshot`; the run is **FAILED**, and the AgentLoop step order is not yet proven by this one observation. The test must account for canonical checkpoint approval before it can assert the subsequent file-write approval.

That run's test-level `afterAll` also received `ENOTEMPTY` while removing the active fixture workspace's `.aide` directory. The test attempted cleanup while its Playwright `webServer` was still serving requests, so cleanup ordering was unsafe; whether pending AgentLoop persistence was the concurrent writer is **CAUSE NOT PROVEN**. The follow-up launcher now owns run-scoped cleanup after Playwright exits and refuses deletion while ports 4174/4878 are open or unknown.

### Same-page browser mutation run — 2026-10-05

`npm run test:workstation` ran with the installed Edge channel. The test's Authority prepare/decision, AgentLoop status, and task execution requests were moved into the same browser page that held the Monaco draft. The browser test reached the final assertions: the real fixture file contained the AgentLoop edit, the Monaco draft remained dirty and showed an external conflict, Ctrl+S did not issue `/api/file/write`, and the disk content remained unchanged after that refusal. Those assertions passed in this run.

The run was **FAILED**: the final `pageErrors` assertion observed two uncaught `Error: Operation denied; no execution authorized.` errors. A diagnostic run then captured two declined `authority-confirm` dialogs during the AgentLoop phase, both correlated with `PUT /api/session`, and matching browser error stacks. The route was reached by `SessionService.flush()`; it was invoked by the debounced `SessionService.set()` timer as an unawaited promise. `api.sessionPut()` received the expected Authority refusal and rejected; the timer had no rejection handler. The cause is **CONFIRMED**: a normal operator denial of a session save surfaced as an unhandled browser error.

The bounded repair adds an explicit save-failure callback to `SessionService`, reports a truthful “not saved; remains in memory” notice through the existing shell notification surface, and consumes fire-and-forget rejections after reporting. It grants no authority and does not persist a denied save. The dirty-draft Ctrl+S confirmation remains a separate, deliberately declined conflict prompt.

After repair, the Edge journey passed **1/1** (13.3 s test / 24.5 s total including build). It proved same-page pairing, AgentLoop execution through the canonical test fixture and Authority decisions, the disk edit, preserved dirty Monaco draft, visible external-conflict state, denied browser `/api/file/write`, truthful session-save denial notice, and zero unhandled page errors. The focused workspace route suite passed **7/7**; Node and browser TypeScript checks, focused ESLint, JavaScript syntax checks, and `git diff --check` passed. The local Vite build completed with the existing >500 kB chunk warning.

After both red and green runs, the runner's post-teardown check found no listeners on ports 4174/4878 and no UUID-scoped `covert-workstation-e2e-*` fixture under the configured temp root. The original failed `error-context.md` was preserved in the ignored `test-results` directory until Playwright's successful run replaced it; the failure, cause, and repair are recorded here and in `C:\Users\Grey_\.agents\skills\failure-workstation-e2e-authority-refusal-unhandled\SKILL.md`. No error was suppressed or permission broadened.

### Verification reconciliation — 2026-10-05

- The first full `npm run check:arch` failed **981 passed / 1 failed / 11 skipped** (993 tests). The sole failure was C1-02 generated decision-artifact drift. Before regeneration, both generated decision files were copied to `E:\pip_temp\c1-02-route-decisions-before-f71626596aa840078dd7fcc7399fb1b2`; the frozen `C1-02-ROUTE-DRIFT` artifacts were untouched.
- Canonical regeneration added the existing typed frontend caller for `GET /api/readiness`, recorded its settings-surface text reference as unresolved, and updated shifted `browser/src/services/api.ts` line references. I reviewed the complete generated delta. Focused `tests/arch/route-drift.test.ts` then passed **5/5**.
- `npm run veritas` subsequently exited **0**. Its six checks all reported true: path boundary, secret scan, manifest validation, full `npm run check`, full `npm test`, and Git diff check. The Veritas decision was `verified`, score **1.0 / 0.9 threshold**, sufficient evidence, no failed checks or oaths. The full test chain appended a truthful Desktop Control generic battery result of **9/9** to `docs/evidence/desktop-battery.md`; Office COM acceptance was not run.
- After that Veritas run, one additional security regression case was added to verify that a matching Referer cannot supply a missing Origin on `POST /api/authority/prepare`. The final focused workspace-route suite passed **8/8**; Node and browser typechecks, focused ESLint, and `git diff --check` passed after this test-only addition. No production source changed after the successful Veritas run.

The local shell integration remains incomplete and unqualified. This lane has no configured upstream; no push or exact-SHA CI claim is made. The browser task used a scripted AgentLoop response and does not qualify a model/provider or close terminal, Git, LSP/DAP, task lifetime, layout restore, or the complete Cipher ASK/PLAN/ACT workflow.

## Workbench addendum reconciliation after coupled browser proof — 2026-10-05

### Current lane grounding

- Worktree: `E:\covert-sovereign-workstation-shell`
- Branch: `feat/covert-sovereign-workstation-shell`
- Current starting HEAD: `0a439528d5835cec00f6cb405acba5b0f50d5d97`
- State before this reconciliation edit: clean; no upstream configured; six commits ahead of local convergence base `cfaad716a01af06dfe61dcfb3d1acd7dea9b4b2c`.
- Canonical convergence, DOGFOOD, gfx900, Model Intelligence, and ecosystem-expansion worktrees remain separate. No other branch was merged or modified.
- Issue #38 was checked before the next integration phase. The latest observed comment remains owner handoff `5976321663` from 2026-10-04; it keeps PR #41 draft/unqualified, requires explicit llama.cpp selection, and prohibits wholesale lane merges. No corrective instruction for this shell lane appeared. PR #31 remains frozen.

### Concrete owner map and gaps

| Concern | Current source of truth | Finding from this addendum |
|---|---|---|
| Desktop layout | `DesktopLayoutState` / `WindowManager`, validated and stored separately in browser local storage | Presentation geometry is separate from editor/workspace data. Closing a window removes its DOM root but does not call the surface registration's `dispose`; this helps preserve service lifetime, though detached Resident polling continues and needs a visibility/lifecycle test. |
| Workbench session | `SessionFile`/`SessionService` persist editor tabs/splits; `ChatStore` persists chat messages and `modelId`; `AppState.residentTask` is volatile UI state; terminal sessions have their own daemon routes | There is no cross-app session reference owner yet. These distinct stores must not be replaced by a second backend or populated with copied runtime truth. A future session projection may contain references, never Authority decisions or credentials. |
| ASK | `ChatPanel` → `/api/chat/stream` → canonical Model Router, Context Control composer, and Authority; chat history binds a conversation `modelId` | ASK has a pinned conversation model and returns observed route identity. The request currently carries chat messages only; active Monaco document/selection context is not proven to enter Context Control. |
| PLAN / ACT | `AgentStartRequest` / `/api/agent/start` → AgentLoop → Model Access exact worker binding → Authority-controlled tool decisions | Backend supports `plan` and `act`; PLAN's read-only tool restriction is enforced in AgentLoop. The current Resident UI starts ACT only and resolves the Coder role. `residentWorkerForSelection` can select Planner/Coder by role without substituting identity, but no UI mode routes to it yet. Plan review is not execution approval. |
| Activity events | `AgentStreamEvent` schema and the existing authenticated `EventHub` `agent` channel | Real events exist for model messages, plans, tools, approvals, context, verification, and completion. `main.ts` currently consumes only `file_mutation`; there is no Cipher activity transcript. Extend this channel; do not add a competing bus. Status polling remains the current task-state read and must not be replaced with inferred event state. |
| Document conflict | `EditorHost`/Monaco model plus canonical content-free file mutation events | Same-browser controlled AgentLoop write now reaches the dirty Monaco buffer and the existing save-conflict guard. This proves one mutation route's observation/retention behavior, not every editor/process write or downstream Git/LSP/verification agreement. |

### Coupled Edge proof and limits

At `0a439528d5835cec00f6cb405acba5b0f50d5d97`, `npm run test:workstation` passed **1/1** after the session-save refusal repair. The test pairs one installed Edge page through the local one-use Authority proof, performs start/decision/status calls from that same page, executes the canonical AgentLoop route and its real authenticated `agent` WebSocket event, and verifies that the disk edit is visible as an external conflict while the operator's dirty Monaco draft remains intact. It also verifies the Authority refusal for the separate session save is reported without an unhandled browser error. The AgentLoop's `agentChatFn` is scripted by the local fixture; the test does not use a production Model Access binding or qualify a model/provider.

The prior full `npm run veritas` passed all six checks before one additional test-only POST-origin assertion was added. After that assertion, the focused workspace-route suite passed **8/8**, Node/browser typechecks, focused ESLint, and `git diff --check` passed. No product source changed after Veritas. No push or exact-SHA CI exists for this isolated lane.

### Next bounded integration slice

Start with a failing browser/contract test for an explicit ASK/PLAN/ACT choice and one visible Cipher conversation surface. Then minimally compose the existing owners:

1. ASK delegates to `ChatPanel` and preserves its exact conversation model binding.
2. PLAN delegates to AgentLoop `mode: plan` with the exact Planner worker from Model Access.
3. ACT delegates to AgentLoop `mode: act` with the exact Coder worker from Model Access.
4. Agent activity is projected from validated `AgentStreamEvent` messages on the existing shared `agent` channel, filtered to the active AgentLoop session; the existing `/api/agent/status` result remains authoritative for task state and approvals.
5. Every approval still uses the canonical Authority routes. Plan acceptance is never treated as permission to execute.
6. Keep ASK chat history, AgentLoop session/status, editor session, and desktop layout persistence owned by their current stores until a concrete, tested reference-reconciliation contract is designed.

This slice does not close active-editor context injection, durable combined transcript/restart restore, live model/provider inference, full task→LSP/Git/verification flow, terminal lifetime, or the complete workstation journey. Those states stay **OPEN/UNKNOWN** until separately proven.
