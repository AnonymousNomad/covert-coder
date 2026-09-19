# Covert Coder — frontend and public-surface review

Review date: 2026-09-19. This is an isolated, unmerged release candidate.

[Changed-file inventory](final-cockpit-files.md) · [Machine-readable verification](final-cockpit-verification.json) · [Design contract](final-cockpit-design.md)

## Baseline and authority

- Base: `70bc46ae0a6b71afcb829f6d95a6e706f49fcd75`, `integration/production-closure`.
- Worktree: `E:\aide-sovereign-workbench-astra-ui`.
- Branch: `feat/final-cockpit-production-ui`; target remote is the same feature branch. No production merge is authorized or performed.
- Canonical reference directly inspected repeatedly: `E:\COVERT UI\file_00000000de6c8206b69e2ac45115fab8.jpg`.
- Architecture retained: typed DOM components, Vite, Monaco, xterm, cockpit registry, existing local facade and authority contracts.
- Baseline canonical launch/build, frontend TypeScript, frontend lint and 12-surface browser traversal passed before editing. The owner checkout was dirty and was not edited.
- No changes to `node/` or `common/`. No inference, memory, Context Control, Harness, or Execution Authority backend implementation was taken over.

## Implementation and initial diagnosis

The interrupted redesign had conflicting legacy/global tokens, an unused identity placeholder, inert status buttons, competing center columns, an oversized lower console, and insufficient narrow-screen behavior. Browser execution also exposed an editor restoration race and incorrect Monaco language-worker routing. These were repaired rather than covered by static content.

| Area | Implemented result |
| --- | --- |
| Design system | Reconciled near-black/navy surface levels, cyan navigation/focus, purple Resident, evidence-based status colors, spacing/radius/type/motion tokens; removed decorative continuous motion |
| Shell/navigation | Approved emblem, 12 real destinations, strong selected rail treatment, working status navigation, compact console, responsive intelligence drawer |
| Command Center | Dominant Resident plus real operational observations; compact model/resource/activity column; architecture map explicitly not a live trace |
| Resident | Conversation/governed-task distinction, full-width task composer, pending/empty/error states, retry, context disclosures, truthful session persistence, existing streaming/stop controls; `data-authority="none"` retained |
| Projects/Editor | Wait for session restoration before exposing file actions; correct JSON/CSS/HTML workers; unique split IDs, group targeting/collapse, safe last-group close, separate tab close controls, modified indicators, native cockpit theme |
| Terminal | Actual governed PTY; explicit opening/running/stopping/disconnected states, fit/resize and actionable errors; no simulated terminal |
| Models | Artifact/runtime/readiness distinctions preserved, bounded pending start/stop controls, restart eligibility and missing-prerequisite explanations |
| Skills/Workflow | Existing workflow evidence; registry activation unavailable; one-Harness domain composition documented as planned |
| Memory | Explicit governed digest retrieval; retrieval/persistence boundaries and failures communicated without claiming successful recall |
| Verification | Claim/evidence/verdict separated; unscoped historical pass is neutral, not proof of current work |
| Security | Pairing/expiry presentation without raw capability material; exact-operation boundary; credential fields redacted only in confirmation text, never in request binding |
| Setup | Existing backend sequence retained; dialog focus management, Escape/focus restoration, readable stage/result presentation; no backend semantic rewrite |
| Providers/Extensions | Provider surfaces retained with configured-vs-connected distinctions, accessible labels and truthful errors; Extensions explicitly phase-gated with no installation controls |
| Motion/interactions | Short state/panel transitions, keyboard focus, disabled empty composers, pending controls, reduced-motion override, no perpetual decorative animation |
| Responsive | Real-browser 1920×1080, 1366×768, 1024×768, 640×800; no document horizontal overflow; usable center; intelligence drawer below 1200px with Escape/focus return |

## Control disposition

All 12 destinations were traversed in the real browser and their visible controls inventoried in `.aide/ui-review/functional-review.json`. Classification distinguishes browser execution from source/contract review; external sign-in, destructive workspace actions, model downloads and unavailable inference were not executed just to obtain screenshots.

| Controls | Disposition and evidence |
| --- | --- |
| Primary navigation, status navigation, console tabs/collapse, narrow intelligence drawer | REAL AND WORKING — browser/fixture navigation, geometry and focus checks |
| Resident conversation/task selection and quick actions | REAL AND WORKING — prepares intent, does not submit or grant authority; fixture asserts no premature POST |
| Empty chat/task submission | DISABLED WITH REASON — enter content first; active task/stream prevents duplicate submission |
| Chat streaming/cancellation and governed decisions | REAL BUT DEGRADED in this checkout — UI stream fixture and route/authority tests pass; no installed model, so no live generation certification |
| Project file opening, Monaco splits/tab controls | REAL AND WORKING — real `package.json`, distinct split IDs, collapse and last-group preservation |
| Editor session persistence | REAL BUT DEGRADED in capture run — save approvals intentionally denied; explanatory notification, no unhandled rejection; no persistence claim |
| PTY open/stop | REAL AND WORKING — exact start/stop approval, real shell command; no model-mediated command execution |
| Model start/stop | REAL BUT DEGRADED / DISABLED WITH REASON — runtime/artifact prerequisites absent; contract tests cover authority/lifecycle; no artifact-to-READY promotion |
| Skill activation / dynamic Harness Modes | NOT YET AVAILABLE — no fake execution controls |
| Memory retrieval | REAL BUT GOVERNED — explicit existing route; no automatic write-triggering refresh or invented recall guarantee |
| Verification and aggregate security | PARTIAL — available evidence shown; unavailable current-task correlation/aggregate telemetry explicitly disclosed |
| Setup inspection/dialog | REAL AND WORKING — real dialog and focus path; apply semantics covered by existing setup route tests, not falsely exercised in screenshots |
| Provider sign-in/key/test | Existing real governed handlers, capability-dependent; source/contract reviewed, external actions not invoked in this local-only review |
| Extension installation | NOT YET AVAILABLE in this cockpit — explicitly phase-gated, no invented controls |
| Previously inert status chips, dead shortcut affordances, stale loading label | DEFECTIVE → repaired or removed; editor loading label now removed before search mounts |

## Visual evidence

Direct, unedited real-stack captures (not API fixtures):

- [Command Center](../assets/screenshots/covert-command-center.png)
- [Resident](../assets/screenshots/covert-resident.png)
- [Editor](../assets/screenshots/covert-editor.png)

Exact publication directory: `E:\aide-sovereign-workbench-astra-ui\docs\assets\screenshots\`.
Raw baseline, iterations, setup, terminal, all 12 final surfaces and responsive captures: `E:\aide-sovereign-workbench-astra-ui\.aide\ui-review\` (ignored, not committed).

The final composition was compared directly with the canonical image: left identity/navigation, dominant central Resident/engineering work, compact right operational intelligence and center-aligned lower console. No fictional portrait, live CPU/disk graph, ready model or verified task was substituted for absent evidence. The approved emblem is the existing 64×88 PNG with its dark backing, not a redesigned or claimed vector asset.

## Public repository

README order: centered emblem → identity/positioning → truthful badges → real screenshot → quickstart → differentiation → capability matrix → architecture → governance → models/providers → documentation/security/contribution → limitations/license.

Repaired README, Getting Started, contribution guidance, documentation/asset navigation, architecture introduction, security product wording, issue version label, CI display name, package description/homepage, doctor identity and `llms.txt`. Added unreleased change notes, Harness Modes contract, screenshot provenance, third-party notices and the full bundled Cascadia font license. Historical internal AIDE package/API identifiers and architecture records are intentionally retained.

The included Cascadia license is Microsoft's [upstream OFL license](https://raw.githubusercontent.com/microsoft/cascadia-code/main/LICENSE). No model weights or new font binaries were added.

Quickstart evidence: clean `npm ci --offline` from the local cache installed 127 packages with zero reported vulnerabilities; the newly installed native PTY executed a shell echo and exited. Canonical `npm start`, pairing, doctor and browser entry were executed. Doctor passed its ten checks with runtime/model/debugpy warnings. This is not clean-machine, online-install or cross-platform certification.

Capability claims are explicitly AVAILABLE/PARTIAL/EXPERIMENTAL/PLANNED. Missing models, CPU/disk telemetry, skill activation, dynamic Harness Modes, full task-verdict correlation, aggregate security, durable-memory effectiveness, desktop and cross-platform acceptance remain disclosed. No missing backend capability was manufactured.

Public local-link check: 13 Markdown surfaces, 85 local targets, zero broken paths. External URLs were not bulk-certified. Remote repository naming/description/topics already use Covert; no remote settings changes are required or performed.

## Verification record

Final results and release decision are recorded in the accompanying verification manifest after the freeze checks complete. Earlier evidence is retained rather than rewritten:

- Frontend and backend TypeScript: exit 0.
- Whole-repository ESLint: exit 0, zero errors, 60 existing warnings.
- Production Vite build: exit 0; existing large-bundle warning remains (Monaco and language workers).
- Current cockpit acceptance: exit 0, including streamed fixture response, navigation, truth states, geometry, responsive layout and zero browser exceptions.
- Final real-stack functional review: exit 0, 12 surfaces, four widths, real Monaco and approved PTY; zero page exceptions. Expected HTTP 409 approval challenges/session-save denial retained.
- Affected integration/architecture selection: 65/65 passed; supplemental UI/session selection 17/17 passed; approval/product-text/toast selection 6/6 passed. These overlap and are not summed as unique tests.
- Frontend launcher unit tests: 3/3 passed.
- First full architecture run: 611 passed, 16 timed out, 11 skipped. All six affected files rerun alone: 41/41 passed. A final quiet full run is recorded separately; no timeout thresholds or assertions were weakened.
- Final quiet full architecture run: **627 passed, 1 failed, 11 skipped**, exit 1, 577.1 seconds. Failure: `tests/arch/closed-loop-mission.test.ts:230`, approved-action mission, `agent should finish done (got null)`. The status polling budget ended without observing done/error/aborted. This is a backend mission boundary, not a browser exception; no causal attribution to resource pressure is claimed without further evidence.
- That mission file was then run alone, with the unchanged close shim and test timeout: **2 passed, 1 failed**, exit 1, 65.9 seconds. The approved-action mission failed with `TimeoutError: The operation was aborted due to timeout`; rejection and context-injection checks passed. This unresolved backend integration gate is handed to the AgentLoop/closed-loop owner; frontend source changes do not authorize repairing backend completion semantics.
- Windows review-driver note: node-pty 1.1.0 can emit an intermittent `AttachConsole failed` helper warning while closing its native console. Source inspection identifies asynchronous enumeration racing native close. It is not a browser exception; driver exit and owned process/port cleanup are checked separately. Dependency internals were not patched to conceal it.

Commits, remote CI, final cleanup and ACCEPT/BLOCK decisions must be read from the final handoff and manifest, not inferred from the screenshots.

Final post-build canonical launch and real Edge traversal: **12 surfaces, zero page exceptions, exit 0**. Verified cleanup: `REVIEW_SURVIVORS=0 REVIEW_LISTENERS=0 LAUNCHER_24248=0`. Other lanes' processes were not stopped. Final frontend type/lint, three launcher unit tests, production build and cockpit acceptance (including reduced motion) passed.
