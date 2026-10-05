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
| 3–5. Shared Workbench Session, non-authority, separate layout | `browser/src/store/state.ts` holds in-memory workspace/session/panel and a Resident task projection. `SessionService` reads/writes the canonical editor `SessionFile` route. `DesktopLayoutState` is separately persisted by `WindowManager`. | **PARTIAL.** Editor session and layout have distinct owners already. There is no complete shared WorkbenchSession containing conversation, terminal/task/debug references, Model Access, Git, diagnostics, and verification. Do not persist duplicated backend facts or place Authority credentials/approval in this projection. |
| 6. Window lifetime vs service lifetime | `WindowManagerView` hides/minimizes a window without calling service stops. Removing a window element detaches its hosted root; reopening reattaches the registered root. Terminal stop is an explicit `POST /api/terminal/sessions/stop`. | **PARTIAL / NEEDS LIFECYCLE E2E.** Closing a view does not intentionally stop its process. Hidden/detached app controllers can still poll or render; add visibility suspension only through existing controller lifecycle seams and prove reactivation. |
| 7–13. Cipher ASK/PLAN/ACT, conversation binding, exact model identity | `browser/src/chat/chat.ts` owns direct streamed chat and conversation model binding. `ResidentCore.ts` separately owns governed task selection/start/status through `/api/agent/*`. Backend `chat.ts`, `agent.ts`, Model Access, Context Control, and Authority remain distinct. | **PARTIAL.** Existing difference between direct chat and governed execution is real and must remain. The user-facing Cipher surface currently presents chat and governed composer separately; there is no single typed InteractionService/timeline joining them. Do not make model choice mutate workspace or collapse conversation binding into role routing. |
| 14–16. Tool and Command Registries | `node/src/services/agent-tools.mjs`, `node/src/services/command-registry.mjs`, and `node/src/routes/commands.ts` exist. The desktop palette currently contains shell-owned open-app/layout actions. | **PARTIAL.** Existing registries must be inspected and reused. The shell palette is not yet the shared registry, and an available tool is not authority. No shell action may imply authorization. |
| 17–19, 22. Document Service, unsaved buffers, model/view separation, edit events | `browser/src/editor/models.ts` owns Monaco text models; `EditorHost` owns document operations and groups; `editor/lsp-bridge.ts` observes Monaco changes. Canonical file read/write uses typed facade routes. | **PARTIAL.** Governed AgentLoop `write_file` / `replace_in_file` now emits a content-free file-mutation event over the existing `agent` channel. The browser re-reads via `/api/file`, reloads a clean model, and preserves dirty buffers with a visible conflict flag and explicit overwrite confirmation. Shell/task command edits, patch/search routes, and the actual browser dirty-buffer journey remain open. This is a bounded reconciliation seam, not a complete DocumentService. |
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
| 38–43. Required E2Es | No end-to-end run in this lane has yet completed project → selection/context → Cipher ASK/ACT → authority → open-buffer-safe edit → LSP/Git/verification, process persistence, multi-layout, restart, or extension lifecycle. | **OPEN.** These remain acceptance gates. The current screenshot is only a UI review artifact. |
| 44–47. Performance and no window-owned backends | Lazy panel registration, shared event bus, daemon APIs, and single editor host exist. | **PARTIAL.** Some hosted panels retain controller polling while hidden/detached. No model/runtime/router or backend should be instantiated per window. |
| 48–49. Interaction modes and real activity | `api.chatStream` and `/api/agent/start` are distinct paths; task/tool/audit/terminal events have typed sources. | **OPEN.** There is no shared request contract that routes ASK/PLAN/ACT intentionally, nor one event-backed Cipher transcript. Never animate work without real events. |
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

The browser E2E did not pair an operator, open a file, make an unsaved Monaco change, and deliver a real backend mutation event to that same page. The pure policy test and backend WebSocket producer test cover separate halves only. Shell `run_command`, task/patch/search writes, and mutations from external processes do not emit this event. The required unsaved-edit journey remains **OPEN** until an integrated receiver/conflict test and all canonical write paths are covered or explicitly bounded by the owner.

## Sequencing decision

1. Finish and verify this isolated shell foundation without claiming a complete workstation integration.
2. Use the canonical backend/Authority owners; do not add `WorkbenchSession`, `InteractionService`, `DocumentService`, universal `ToolRegistry`, or another event bus until each existing equivalent is mapped to a concrete gap and an owner-approved contract.
3. Extend the file-mutation seam to other canonical write paths and add the integrated unsaved-buffer browser acceptance before calling document editing safe.
4. Then implement Cipher ASK/PLAN/ACT presentation by composing the current direct-chat and governed AgentLoop paths, preserving conversation binding, exact Model Access identity, Context Control, and the same Execution Authority. No direct mutation route from a window or speech adapter.
5. Prove the prescribed journeys in dependency order: editor/context; ACT/Authority; document/model/LSP/Git; test/verification; process and model lifetime; layout restore; provider failure/offline; extension only after its ecosystem lane is integrated.

**Release / product claim:** UNKNOWN. A movable UI shell with live surfaces is not the integrated workstation acceptance defined by this addendum.
