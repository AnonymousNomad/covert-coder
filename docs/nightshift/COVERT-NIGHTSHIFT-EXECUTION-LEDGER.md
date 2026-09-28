# Covert Night Shift Execution Ledger

> Historical execution queue. Current priorities are governed by `POST-OVERNIGHT-CONVERGENCE-ADDENDUM-2026-09-28.md`; preserve this ledger as history and re-verify any state before relying on it.

Owner: Codex with the operator. Date: 2026-09-26 (America/Chicago).
Working tree: `E:\covert-nightshift-integration`.
Branch: `nightshift/production-convergence-20260926`.
Entry HEAD observed: `30d19a6`; confirm HEAD and clean status at every phase transition.
This is the operational queue, not release acceptance. The frozen closure matrix under
`E:\aide-v1-release-closure\docs\v1\` is a starting inventory and may be stale.

## Operating contract

- Work in this integration lane. Preserve all other worktrees and their evidence.
- Run one resource-intensive battery at a time on NEURO-MIRROR; identify process owner before cleanup.
- Do not copy credentials, tokens, prompts, or private project material into evidence.
- User authorizes direct implementation and verification. Do not stall for plan approval.
- Stop on failure, inspect exact cause, load the matching failure skill, repair, rerun.
- Every status claim names its fresh command, exit status, counts, and committed evidence.
- Never call a source release an installer, a configured model a qualified model, or a UI a wired feature.
- Work phase by phase. Load only the active phase's skills; close and archive notes at the exit gate.
- Prefer small reviewable commits. Do not merge, push to production, or publish unsupported claims.
- If an owner lane is active, inspect and integrate verified outputs; do not edit its files concurrently.

## Researched skill map and scope

Existing project skills cover onboarding (`aide-onboarding-walkthrough`), Hub search and
acquisition (`aide-model-hub-acquisition`), task fit and recommendation
(`aide-model-task-recommender`), measured device speed (`aide-device-benchmark-runner`),
provider connection (`aide-provider-connect`), agent architecture
(`aide-agent-harness-convergence`), packaging (`aide-packaging-offline`,
`aide-distribution-packaging`), trust/security and release engineering.
Their older AIDE paths, IDs and model quantities are hypotheses until checked against
this Covert SHA. Do not create one new skill per phase by default.

| Phase | New project skill count | Reuse / specific gap |
|---|---:|---|
| P0/P2 | 1 | `covert-dogfood-evaluation`: live Resident mission, independent grader, matched ON/OFF protocol. |
| P1 | 0 | Security, route, debugging and failure skills already exist. |
| P3 | 1 | `covert-fresh-user-release-audit`: exact installer through clean-user coding and uninstall. |
| P4/P5/P6 | 0 now | Reuse client, release, frontend and accessibility skills; create only after measured missing procedure. |

Both new skills live in `skills/packs/` and in the authored laptop skill source; the
registry must include them. Research basis: SWE-bench executable patch evaluation,
llama.cpp llama-bench speed methodology, VS Code workspace trust/agent permissions,
Hugging Face Hub/resolve documentation, Tauri Windows installer and GitHub artifact
provenance. These inform the controls, not a claim that Covert already implements them.

## Cross-phase dependency / pause matrix

| Dependency or threat | Gate / pause action |
|---|---|
| No verified model file/runtime or insufficient RAM/disk | Do not run or claim model task; inventory actual bytes, hash and process owner. |
| Untrusted workspace, provider consent absent, unknown port owner | Stop execution or egress, preserve refusal as evidence; never bypass authority. |
| No fixed task baseline or independent verifier | Do not claim a harness delta or model improvement. |
| UI/dev server passes but clean installer fails | Source gate may pass; production release remains blocked. |
| Existing lane changes concurrently or test SHA drifts | Pause integration, inspect provenance and rerun gate at fixed SHA. |
| Secrets or private traces enter evidence | Quarantine and scrub before committing or sharing results. |
| False success, process leaks or destructive uninstall | Stop release; repair and replay same locked journey. |

## Session bootstrap and phase discipline

1. Read repository `AGENTS.md` and `C:\Users\Grey_\.agents\skills\developer-way\SKILL.md`.
2. Check `git status --short --branch`, HEAD, worktrees, relevant remote refs, active processes, RAM/disk.
3. Load the active phase's skills below, verify their current paths, then execute the smallest open item.
4. At every failure: preserve log/output, diagnose, use an existing failure skill or record a new one per AGENTS.md.
5. At phase exit: run its gate, review diff and process hygiene, write a dated evidence receipt, commit only owned paths.
6. Replace the active working set with the next phase; historical receipts stay in Git, not in model context.

**Current active phase:** P0 canonical Unsloth product wiring and dogfood readiness. Working context packet: `ACTIVE-CONTEXT-PACKET.md`. Standing directive: `../COVERT_CODER_STANDING_DIRECTIVE.md`; same-authority research/context addendum: `../COVERT_PRODUCTION_CONTEXT_ADDENDUM.md`.
Baseline `npm run check` at entry `30d19a6` exited 0: 783 tests, 772 passed,
11 skipped, 0 failed (2026-09-27 UTC). It was run before source edits; warnings are
not release failures. Do not extend that result to installer or real-model readiness. P1 security/runtime closure remains next, informed by observed dogfood
failures. No phase is marked complete based on this ledger alone.

## P0 — First controlled Covert-builds-Covert mission (tonight)

Skill: `covert-dogfood-evaluation` plus relevant existing model/Hub/onboarding skills.
- [ ] Close the observed product dispatch gap: default `openapi.ts` construction still used direct llama.cpp `ModelRuntime` despite accepted Unsloth canonical runtime. Bridge is a candidate; qualify its Authority, resource admission, status, model identity, chat/stream/agent, and shutdown through the real product before acceptance.
- [ ] Confirm source and process ownership, adequate resources, pairable local stack,
      actual local model artifact/runtime, and approved provider connection statuses.
- [ ] Walk the first-run wizard as a new user: workspace selection, guided walkthrough,
      automatic workflow creation, Resident context and action availability.
- [ ] Search Hugging Face through Covert, inspect recommendation evidence and fit against
      this laptop, approve download, verify hash/format, start the model, generate tokens,
      and stop the owned engine. Record blocked network/entitlement honestly.
- [ ] Inspect Telegram integration and Discord availability in code/tools; test only
      configured, authorized paths. No outbound messages without a specific operator action.
- [ ] Use a bounded Covert issue in this repository with an exact expected diff and
      executable verifier; run it through Covert's Resident/agent path with explicit approval.
- [ ] Capture model identity, selected skills/context, operations/decisions, file diff,
      verification result, timing/tokens, failures, and cleanup. Do not accept self-reported success.
- [ ] Repeat a matched task with harness enabled/disabled and an external reference only
      when model, task, tools, budget, and timeouts can be made comparable.
- [ ] Turn failures into the next P1 repair, re-run the same task, and preserve both traces.
Exit: one end-to-end real model coding transaction, reviewed resulting code, independently
run verifier, and honest comparison evidence. If model or provider access is blocked,
record the exact blocker and keep local execution path moving.

## P1 — Production/security/runtime closure

Skills: `developer-way`, `aide-route-slice-sop`, `aide-production-cutover`,
`aide-debugging-discipline`, `verify-first-discipline`, `process-hygiene-sop`.
Load from `C:\Users\Grey_\.agents\skills\<name>\SKILL.md`; use matching failure skills on demand.

- [ ] Reconcile C1-02 route reachability, C2-02 durable state, C4-02 local-only, C4-04
      Model Hub egress, and C5-15 cancellation against current integration code and fresh tests.
- [ ] Close C4-01 workspace trust: canonical UNTRUSTED/RESTRICTED/TRUSTED state, explicit
      operator transition and revocation, fail-closed execution/config gates at all consumers.
- [ ] Test trust across task manifests, plugin manifests, hooks, debugger/launch config,
      agent starts, direct typed backend, facade, restart, tampering, and workspace switch.
- [ ] Reconcile remaining release P0s with the current matrix; never treat its 2026-09-25
      status text as current proof. Resolve malformed-body and other confirmed runtime defects.
- [ ] Run focused red/green tests, type/lint/contracts/facade checks, acceptance P0/real,
      full architecture and owned-process checks. Log environmental skips explicitly.
Exit: clean, reviewed diff; new behavior demonstrated through real product edge; fresh
battery receipt; no unsupported release claim. If a gate fails, phase stays open.

## P2 — Model/provider and harness evidence

Skills: `covert-dogfood-evaluation`, `aide-model-configuration`,
`aide-provider-connect`, `aide-model-sop`, `aide-veritas-layer`,
`aide-harness-prompt-scaffolding`, `process-hygiene-sop`.
Preserve Model Manager MM9 and runtime-lab qualification boundaries; inspect those branches
and their evidence before integration. Use the existing connected, operator-approved provider
settings; do not extract or print stored credentials. Offline/local remains the default.

- [ ] Inventory live model artifacts, their hash/format, actual runtime, hardware fit, and
      provider connection state: local GGUF, OpenCode, Codex, OpenRouter, other configured paths.
- [ ] For each admitted pair, run identical held-out tasks with fixed model/version,
      prompt, tools, token budget, temperature/seed where supported, hardware, and timeout.
- [ ] Measure **Covert harness ON**, same model **without Covert harness**, and a comparable
      external tool/harness only when the underlying model and affordances are matchable.
- [ ] Capture task success by executable verifier, false-success rate, approval safety,
      tool-call trace, tokens, wall time, first-token latency, memory, and failure class.
- [ ] Run representative coding, debug, repository navigation, and long-session scenarios;
      repeat enough to show variance. Never infer model quality from a single anecdote.
- [ ] Test real provider paths through Covert end to end, including consent-off, revocation,
      timeout, cancellation, no-leak, wrong-model, offline fallback, and response attribution.
- [ ] Verify the full BYOK lifecycle per standing directive: add/store/test/replace/delete/revoke credentials; wrong/expired/missing keys; discovery/selection/switch/restart; error/timeout/rate-limit/quota behavior; no secret or sensitive-prompt leakage.
- [ ] Publish a Provider × Model Capability Matrix with authentication, text, streaming, tools, structured output, vision, context, cancellation, offline, runtime verdict, limitations and exact evidence; mark unsupported/experimental/unverified honestly.
- [ ] Compare OpenCode/Codex/OpenRouter honestly: OpenRouter is a provider gateway; Codex and
      OpenCode have different harnesses. Mark non-equivalent comparisons as such.
Exit: immutable task set, per-run traces and metrics, reproducible command/config manifest,
model identity, failures and limitations. No qualification or competitive claim without proof.

## P3 — Packaging, installer and release artifacts

Skills: `covert-fresh-user-release-audit`, `aide-distribution-packaging`,
`aide-packaging-offline`, `aide-arch-packaging-release`, `aide-release-engineering`.
- [ ] Build Windows desktop artifact from a clean dependency state and verify hashes/SBOM.
- [ ] In an isolated fresh Windows user profile or equivalent clean VM, install the exact
      built artifact with no developer checkout, node_modules, credentials or prior .aide state.
- [ ] As a new user: install, launch, pair, set up a local model, open a disposable project,
      complete an approved coding task, inspect verification, stop, restart, repair/reinstall,
      and uninstall. Record each screen, error, path, timing and unexpected prerequisite.
- [ ] Verify no stale sidecar, owned processes, state loss, or installation residue; resolve
      signing and advisory gates. A source-checkout smoke cannot substitute for this journey.
- [ ] Test disconnected installation and operation where claims promise offline behavior.
- [ ] Keep source-core and platform installer claims separate; document platform coverage.
Exit: tested artifact and installation transcript bound to the exact source SHA.

## P4 — TUI, terminal, CLI and companion clients

Skills: `aide-arch-terminal`, `aide-cross-terminal-sync`, `aide-android-build`
only if mobile work is entered, plus `aide-route-slice-sop` for new routes.
- [ ] Inventory actual Desktop/TUI/CLI/partner-app code and settle V1 versus V1.1 scope.
- [ ] Implement only against canonical shared truth and Authority; no client-local bypasses.
- [ ] Terminal: keep real PTY, process ownership, resize, reconnect and color legibility;
      adopt Parrot-inspired prompt line structure in Covert neon purple, blue-green and pink.
- [ ] End-to-end project, edit, terminal, agent, model, evidence and recovery journeys in
      each advertised client; include keyboard, accessibility and cold restart behavior.
Exit: each client passes its own real journey and shares the same state/approval semantics.
## P5 — Competitive gaps and final regression

Skills: `aide-vscode-parity-roadmap`, `aide-ux-hardening`, `aide-release-engineering`,
`verification-complete`. Compare capabilities against current product behavior, not a
feature-name checklist. Prioritize editor/recovery, task flow, debugger, models and Resident.
- [ ] Reconcile capability ledger and public claim matrix against live product journeys.
- [ ] Run long-horizon regression: many tool calls, project/model switch, cancellation,
      interruption/restart, stale state, denied operation, no project bleed or false completion.
- [ ] Full type/lint/contracts/architecture/integration/browser/installer batteries at exact SHA.
- [ ] Review CI and GitHub PR/issue status; promote only evidence-backed artifacts.
Exit: release decision states exact supported scope, failed gates, skips and owners.

## P6 — Theme and visual-system finish (last)

Skills: `aide-arch-frontend-core`, `aide-responsive-a11y`, `aide-ux-hardening`;
load the browser/frontend verification skill if applicable. Use existing product images, not
new generated mockups. Reference images on E: and the two user-provided screenshots.
- [ ] Three selectable themes: colorful Covert (reference 2), Matrix (reference 1), and
      original restrained corporate developer theme. Persist preference across restart.
- [ ] Matrix: binary backdrop with off/speed controls and reduced-motion support; bounded
      activity signals for debug/build/verify with semantic color that does not falsify status.
- [ ] Replace decorative top readouts with real CPU, RAM, GPU/VRAM, disk, task and model
      measurements only when source and freshness are known; unknown remains unknown.
- [ ] Distinct neon-colored, readable sidebar icons and product names (e.g. Skillbook);
      never rely on color alone. Keep editor-first layout and dockable Resident.
- [ ] Give the existing Resident character art a functional, accessible entry point rather
      than a decorative panel. Preserve meaningful controls if imagery is hidden.
- [ ] Standard theme direction: original Covert composition in satin beskar-like cool metal,
      brushed stainless/DeLorean material cues, restrained underground-tech atmosphere;
      no copied helmets, logos, car shapes, or franchise trade dress.
- [ ] Research color/material references and UI token/contrast guidance; use CSS tokens for
      surfaces, borders, text, syntax, focus, status and activity. No texture behind source text.
- [ ] Test theme switching, persisted settings, real gauges, reduced motion, keyboard/focus,
      contrast, narrow layouts and browser screenshots at each theme.
Exit: three separately reviewed live themes and real journeys; themes must not mask release
status, resource truth, or broken functionality.

## Current findings / caution

- On entry, NEURO-MIRROR was connected; the integration worktree was clean at `30d19a6`.
- `nightshift/workspace-trust-c4-01` existed separately at that same HEAD and was clean.
  Inspect ownership and diffs before merging; do not make simultaneous edits there.
- Ubuntu-24.04 WSL2 is installed but stopped. Do not start it for Windows-only tests.
- Existing C5-11/12/15 reliability closure includes focused evidence, but an old release
  matrix still calls C5-15 missing. Reconcile by fresh tests; do not rewrite history.
- Desktop panic already uses owned-process revocation in this integration code; the old
  intelligence-spine audit reflects an earlier state.
- Visual research anchors: official DeLorean brushed-stainless reference, Star Wars
  beskar reference for material character, VS Code theme tokens/accessibility guidance,
  Carbon semantic color tokens. Borrow principles, never protected visual identity.

## Receipt template

Date/time · branch/HEAD · active phase · files changed · command and exit code · tests
passed/failed/skipped · artifact/hash · behavior observed through product edge · process
ownership/cleanup · unresolved risk · next exact action. Change checklist boxes only after
that receipt exists. Keep each phase receipt in `docs/nightshift/evidence/`.
