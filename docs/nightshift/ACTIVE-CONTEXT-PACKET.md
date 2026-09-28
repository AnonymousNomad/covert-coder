# Active execution context — canonical Unsloth product wiring

> Historical operational context. For current priorities, see `POST-OVERNIGHT-CONVERGENCE-ADDENDUM-2026-09-28.md` and the latest stabilization checkpoint. The dated runtime evidence below remains historical; re-verify current state before acting on it.

Date: 2026-09-26 America/Chicago. Branch/worktree: `nightshift/production-convergence-20260926`, `E:\covert-nightshift-integration`; entry `30d19a6`, current HEAD `32d539d` (local WIP commits preserved). Other uncommitted ledger/skills/registry/verifier drafts predate this slice and must be preserved. Workspace trust has its own clean lane at the same entry SHA.

## Truth classes

- ACCEPTED: `docs/design/local-runtime-lab/UNSLOTH-V1-SUPPORT-CONTRACT.md` and Runtime Passport qualify the exact Windows Administrator + Unsloth 2026.9.11 + Vulkan + official Liquid GGUF profile. Direct llama.cpp requires explicit recovery event.
- REPOSITORY: local WIP commits `a06c062` and `32d539d` wire `node/src/openapi.ts` through `BrokerModelRuntime` and add a two-second cache for read-only broker status probes. Live product dispatch remains unproven.
- RUNTIME: the full `npm run check:arch` gate at `32d539d` completed with exit 0 in 572.97 seconds. Node/browser TypeScript checks passed; ESLint reported 62 warnings and 0 errors; the 120-file serial architecture suite reported 773 pass, 11 skipped, 0 fail (544,539 ms). The handoff route that previously timed out passed in 2.40 seconds. No live model or packaged product proof.
- HYPOTHESIS: the bridge can pass live governed start/chat/stream/stop and application shutdown without touching foreign processes; fixture tests and artifact import cannot establish that claim. Runtime CLI discovery on first run still needs product setup or a documented scoped configuration.

## Current slice

Objective: production local model status/start/chat/stream/stop must use canonical Unsloth, preserve honest availability and refuse foreign/unknown ownership. Do not modify the accepted runtime adapter. The bridge at WIP commits `a06c062` and `32d539d` is wired in `openapi.ts`, with focused fixture proof and a real artifact import. Live start/chat/stream/stop through the app and packaged runtime remain unverified.

Skills: `covert-context-control`, `covert-unsloth-product-wiring`, `covert-dogfood-evaluation`, developer-way; consult failure skill on failure. Dependencies: product route constructor, legacy inventory, broker/adapter, model/router contract, process/resource preflight. Stop on unexpected cleanup, false ready, unknown port ownership, test regression or secret exposure.

Acceptance: focused bridge tests for canonical dispatch and refusal; TypeScript/lint/route tests; app edge start/chat/stream/stop with correct runtime and hash; owned process cleanup; release status still blocked until clean installer and fresh-user proof. Architecture gate is green at `32d539d`. Next: sample memory/commit/VRAM and endpoint ownership before a live app edge. No load below the accepted resource margins; do not free memory by killing browser or Godot.

## Checkpoint — 2026-09-26 22:02:15 America/Chicago

- Integration source advanced from `30d19a6` to focused WIP commit `a06c062` (`openapi.ts`, `model-runtime.ts`, new `broker-model-runtime.ts` and its test). This is not release acceptance. Other pre-existing dirty drafts remain uncommitted and were preserved. Recheck HEAD/status on resume.
- Regression: before repair, bridge inventory load cleared a legacy engine ledger; afterward the fixture ledger remains byte-identical. The bridge now binds inventory, ingest and register projection to the adapter's validated loopback endpoint; a red test first observed the legacy `8083` endpoint.
- Focused fixture test: 1 pass, 0 fail; model-route test combined: 2 pass, 4 migration/environment skips, 0 fail. Provider-route tests: 5 pass, 0 fail. ModelRuntime/ModelRouter regression: 20 pass, 6 environmental skips, 0 fail. TypeScript `tsc -p tsconfig.node.json --noEmit` and focused ESLint exited 0 after repair. These are fixture/source gates, not live model or packaged app proof.
- Read-only CLI check found the qualified external wrapper at `E:\Unsloth-Studio-runtime-lab-RT27\bin\unsloth.cmd`, version `2026.9.11`. It is absent from the ambient PATH; a scoped `AIDE_UNSLOTH_CLI` setting made the adapter report available. Without that setting the adapter accurately reported `NOT_INSTALLED`.
- Actual GGUF import recorded model `lfm2.5-2.6b-q4_k_m-02a8b7e1` with SHA-256 `02a8b7e17487d326e46d68ce0ba24211e1b80a14c4cd0597fa73c1cd697f52ed`; the final status endpoint was `http://127.0.0.1:18888/v1`, ready but `qualification=requires_start_preflight`. Imported inventory in `.aide/ingested-models.json` is an operator-side effect; model was not loaded.
- Host observations during this slice: free physical RAM ranged about 6.4–6.5 GiB, free VRAM 5,038 MiB, GPU utilization 22%; browser and Godot are in active use. No unrelated process was terminated. The conservative load preflight requires at least 6.5 GiB free RAM and further in-run margins; sample again immediately before a live load. No app E2E or package test was run.
- New project bundle uploaded in ChatGPT has structural validation and release-gate templates; it has not been imported into this Git worktree or used as product acceptance. Existing equivalent project skills remain the current phase procedures.

## Checkpoint — 2026-09-26 22:31:16 America/Chicago

- Full `npm run check:arch` on HEAD `32d539d` completed successfully; Desktop Commander recorded exit code 0 and runtime 572.97 seconds. Node and browser TypeScript passed. ESLint had 62 warnings, 0 errors. The serial architecture runner covered 120 test files: 773 pass, 11 skipped, 0 fail; runner duration 544,539 ms. Skips are documented migration waivers and absent bundled GGUF fixtures. The former `secret-bearing transcript...` handoff timeout passed in 2.40 seconds.
- The status-probe cache regression is now verified in focused and full suite: read-only broker status queries reuse a 2-second snapshot; load/inference/shutdown still use fresh status paths. The repair did not modify the accepted Unsloth adapter.
- Worktree remains on `nightshift/production-convergence-20260926`, ahead 8 of `origin/fix/v1-p0-route-drift` at `32d539d`. Existing modified skills/registry and untracked directive, addendum, nightshift docs, scripts and Covert skill drafts are preserved. No push, merge, or cleanup of those drafts occurred.
- Model `lfm2.5-2.6b-q4_k_m-02a8b7e1` remains imported with SHA-256 `02a8b7e17487d326e46d68ce0ba24211e1b80a14c4cd0597fa73c1cd697f52ed`, but not loaded. CLI wrapper is installed at `E:\Unsloth-Studio-runtime-lab-RT27\bin\unsloth.cmd` and absent from ambient PATH; live use requires scoped discovery config. The `.aide/ingested-models.json` change is an acknowledged operator-side effect.
- Browser/game-editor processes were left untouched. No live model/app start-chat-stream-stop or packaged-app run occurred. Next action is a fresh resource and port-ownership preflight before any live edge; release remains blocked pending live and fresh-user evidence.


## Checkpoint — 2026-09-26 23:11:22 America/Chicago

- Fixed the strict `/api/models/status` response contract: `ModelStatusEntry` now accepts the bounded qualification enum `accepted_hash_verified | requires_start_preflight`. Before the fix, the broker's extra `qualification` field made the real route return 500. The regression test first reproduced that failure, then passed with HTTP 200. `npm run contracts` regenerated `common/openapi.json` (237 operations).
- Committed the focused fix as `5300abd` (`Fix model status qualification contract`): only `common/contracts/models.ts`, `common/openapi.json`, and `tests/arch/model-routes.test.ts` are included. Branch `nightshift/production-convergence-20260926` is ahead 9; no push or merge. Pre-existing dirty skill, registry, directive, script, and context drafts remain preserved.
- Fresh `npm run check:arch` passed with exit code 0 in 583.18 seconds. Node/browser TypeScript passed; ESLint reported 62 warnings and 0 errors. `run-arch` ran 120 serial files: 785 tests, 774 pass, 11 skipped, 0 fail (556,696.57 ms). Skips are existing missing bundled-GGUF cases and migration-waived assertions. The new qualification contract regression passed in this full run.
- `npm run build:frontend` passed (Vite built 1,415 modules in 23.69 seconds); only the existing large-chunk advisory appeared. `git diff --check` found no whitespace errors; Git printed existing CRLF normalization notices for dirty skill drafts.
- Actual paired app-edge check via the typed facade: `GET /api/models/status` returned HTTP 200, `runtime=true`, and 11 entries. Model `lfm2.5-2.6b-q4_k_m-02a8b7e1` was reported ready with runtime/artifact available, `setup_required=false`, ingested, and `qualification=requires_start_preflight`. No model was loaded; no inference, chat, stream, start, or stop was attempted.
- Browser and game-editor processes were left untouched. A pre-gate resource sample after app cleanup showed 7,215,251,456 bytes free RAM, 6,558,236,672 bytes free commit, and about 5,152 MiB free VRAM at 20% GPU use. Re-sample immediately before any future load; the accepted in-run floors still apply. No packaged-app or live inference proof was produced; release remains blocked pending that evidence.


## Checkpoint — 2026-09-27 06:37:26 America/Chicago

- Resume verified NEURO-MIRROR and `E:\covert-nightshift-integration`; branch `nightshift/production-convergence-20260926`, current HEAD `f38bece`, ahead 10. The pre-existing modified skills/registry and untracked directives, scripts, skills, and nightshift packet remain preserved. No push or merge.
- Fresh 06:25:59 resource/port preflight: free RAM 6,568,833,024 bytes (~6.12 GiB); free Windows commit 5,107,068,928 bytes (~4.76 GiB); GPU 6,144 MiB total, 992 MiB used, 28% utilization. No listeners on 4173, 4777–4779, or 18888. The accepted interactive-load entry margins require at least 6.5 GiB RAM and 5 GiB commit, so no model load was attempted. Browser/game processes were not touched.
- The qualified `E:\Unsloth-Studio-runtime-lab-RT27\bin\unsloth.cmd` exists. `unsloth` is absent from PATH and the current shell has no `AIDE_UNSLOTH_CLI`, so a default product launch would report `NOT_INSTALLED` even though the runtime files exist. This is a discovery/configuration gap, not evidence for reinstall.
- Focused local commit `f38bece` changes only `node/src/services/broker-model-runtime.ts` and `tests/arch/broker-model-runtime.test.ts`: when CLI discovery is `NOT_INSTALLED`, model status now gives the operator the scoped `AIDE_UNSLOTH_CLI` absolute-path and restart instruction, with install as the alternative. The new status test failed with the old misleading message, then passed; focused results 2 pass, 0 fail. Node TypeScript passed; focused ESLint ran from the repository root with exit 0; `git diff --check` was clean. The earlier broad architecture pass was on `5300abd`; it was not rerun for this message-only change.
- Next live gate: re-sample memory/commit/VRAM and verify endpoint/process ownership. Once the entry floors hold, launch Covert with the CLI path scoped to that process, run governed start → status → chat → stream → cancellation → stop and application shutdown, and verify exact owned cleanup. If resources remain below floor, continue the independent packaged first-run CLI configuration and status journey. The accepted runtime adapter remains unchanged.
- Execution status at this checkpoint: ended; live inference and packaged-app acceptance remain unverified. Desktop Commander reported no active sessions after the focused checks.

## Checkpoint — 2026-09-27 morning, release-audit continuation

- Operator explicitly authorized stopping identifiable laptop processes to advance Covert, while protecting the Microsoft Edge browser session used for the Nomadic strategy game. The process inventory identified the existing Node tree as Desktop Commander; it was left running. No Edge, game, ChatGPT, system, or unknown process was stopped.
- At HEAD `f38bece`, resource preflight was 6.77 GiB free RAM, 5.1 GiB free commit and approximately 5,061 MiB free VRAM, with the Covert and Unsloth ports free. Started the supervised typed stack with `AIDE_UNSLOTH_CLI` scoped to the qualified external CLI. Stack owned UI 4173, facade 4777, typed backend 4778 and legacy 4779 (launcher PID 1976, children 268/20328/24452). After launch, free RAM was 6.54 GiB and commit 4.34 GiB, below the accepted 5 GiB load-entry floor. No model load/inference was attempted. Unauthenticated status returned FORBIDDEN as designed; this is not a paired status check.
- Stopped only launcher PID 1976 and its three children; verified the inspected Covert/Unsloth ports had no listeners and those exact PIDs were gone. The shell process ended after tree stop. Browser and game were untouched.
- Desktop staging (`node desktop/prepare.mjs`) and `node desktop/verify-prepare.mjs` exited 0, but the prior message called a staged legacy llama binary a staged model runtime despite the missing optional SmolLM bootstrap and externally managed canonical Unsloth. Commit `c2b8a70` changes only those two desktop messages to distinguish optional recovery binary from external, unverified canonical runtime. `node --check` for both, staged verification, and `git diff --check` exited 0. No installer build or fresh-user test occurred.
- The broader release audit also found that the earlier certified source SHA and frozen 176-row matrix are historical; C4-02 system-wide Local-Only remains explicitly blocked, Workspace Trust and fresh-user installer remain open. Current branch is ahead of origin; pre-existing dirty skills/registry and untracked directive/ledger drafts are preserved. Next: solve model-load headroom without disrupting Edge; then run paired governed start/status/chat/stream/cancel/stop, or advance the independent packaged first-run runtime-configuration gate.


## Checkpoint — 2026-09-27 11:19 CDT, harness admission and addendum intake

- Pilot is BLOCKED at 0/60: Unsloth rejected model load with HTTP 401 AUTH_REQUIRED; the local credential store has no key. No model loaded, prompt sent, or inference completed.
- Current 11:19 sample: 7.454 GiB free RAM, 6.357 GiB free commit, 5,016 MiB free VRAM. Basic floors barely pass; the observed runtime-start interval would put retained RAM/commit below floor. Runtime processes and port 18888 are clear.
- Evidence: runtime attempt JSON and resource snapshots at 10:43 and 11:19 are immutable under `docs/nightshift/evidence/`; hashes and source fingerprints are recorded in the pilot checkpoint.
- Focused harness validation remains 6 grader tests plus 10 tasks/20 synthetic calls; no real-model result. Source hashes match the verified runner state.
- Source-level first-run runtime guidance is present in model status and visible in the model panel; focused broker fixture passed 2/2. Packaged/fresh-user acceptance remains open.
- Collaborator experience-design bundle is copied, hash-verified, under `docs/production-closure/`. It extends standing directives and remains subordinate to release closure.
- Project-local pilot-preflight skill was added and registered; it requires credential-presence and post-start resource checks before loading a model.
- Repo: `nightshift/production-convergence-20260926`, HEAD `c2b8a70ac4e7a69a9865aae97a66a74e05e5f8a3`, 42 worktrees, 26 dirty entries. No commit/push/merge; Edge/Godot and unrelated work untouched.
- Next executable pilot step: configure the approved local credential store without disclosing a token, re-preflight, confirm retained resource and 32K context fit, then freeze source and execute the controlled 60-completion battery. If blocked, continue the next independent P1/P3 closure item.

## Competitive-parity bundle intake — 2026-09-27 CDT

- Source ZIP SHA-256: `31a62f068789ec16d14c6a692d87844e43f0a457937623014b659652c2e24b92`.
- Added under `docs/production-closure/`: `LUNA_COMPETITIVE_HANDOFF.md`, `COMPETITIVE_PARITY_DIRECTIVE.md`, and `COMPETITIVE_BASELINE_MATRIX.md`; hashes exactly match the ZIP entries: handoff `50023f05ac0f699cc1946247b3e81bfd05873545d6cf10dd2882b43aaabe5623`, directive `4d87982792b1460c0060c2bb8cdf289d78ddf9ed8d7e738cbd7a0393a1702e01`, matrix `83073ef22b89a4a94b7df091966de7874ed4772b3a1038154d326b4da5dea451`.
- Existing `README.md` now indexes both experience-design and competitive-parity addenda.
- The matrix is initial reference material, not a verified competitor comparison or Covert capability audit. No statuses, competitor claims, or release claims were adopted from it.
- Current `AGENTS.md` sovereign/local-only policy remains authoritative; hosted-provider and remote-work rows require classification against that boundary before work is scheduled.
- Competitive bundle is subordinate to production closure and the controlled model pilot. No application or harness source was changed.
- Live repo recheck: `nightshift/production-convergence-20260926`, HEAD `c2b8a70ac4e7a69a9865aae97a66a74e05e5f8a3`, upstream count 0 behind / 11 ahead, 42 worktrees, 26 dirty entries. Existing edits preserved; no commit, push, merge, or branch change.
- All eight frozen harness source fingerprints still match the 09:52 pilot checkpoint. Existing focused runner evidence remains valid for these unchanged sources; this did not rerun tests or create model evidence.
- Pilot remains BLOCKED at 0/60: local runtime returned HTTP 401 `AUTH_REQUIRED`, the credential-presence check was false, and the observed runtime-start resource drop would breach retained RAM/commit floors. No prompt or inference was sent.
- Next pilot action remains local credential setup through the approved local store/UI, followed by fresh post-start RAM/commit/VRAM and 32K context-fit checks. If the gate fails, do not load; continue the independent packaged first-run release gate.

## Intake close — 2026-09-27 11:53:37 CDT

- The three added competitive-parity files retain exact source ZIP SHA-256 matches; README and both checkpoint files include the intake record.
- This continuation changed documentation only. Harness source and the 26 pre-existing dirty entries were preserved; branch/HEAD remain `nightshift/production-convergence-20260926` / `c2b8a70ac4e7a69a9865aae97a66a74e05e5f8a3`.
- All eight frozen harness source fingerprints match the existing record. The latest runner evidence remains 6 grader tests plus the synthetic 10-task/20-call paired fixture; it was not rerun. This continuation produced no inference evidence.
- `git diff --check` exited 0; Git printed only the existing CRLF normalization notices.
- Desktop Commander reports no active sessions; transient shell PIDs 16452, 20360, 12192, 22112, 16344, and 17892 were confirmed gone. No user process was stopped.
- One initial nested PowerShell wrapper hit a parser error; diagnosis was outer-shell variable expansion. Direct PowerShell invocation succeeded, and the failed inspection made no repository changes.
- No commit, push, merge, or branch change. Pilot remains blocked at 0/60 pending local credential setup and a safe retained-resource/context-fit preflight.
- Next executable action: configure the local runtime credential in its approved local store/UI, refresh the resource gate after startup, then run the frozen pilot only if all gates pass; otherwise continue packaged first-run acceptance.
