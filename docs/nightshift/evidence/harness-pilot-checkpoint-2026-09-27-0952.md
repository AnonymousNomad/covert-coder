# First real-model harness pilot checkpoint — BLOCKED

Created: 2026-09-27 09:52 America/Chicago
Purpose: preserve the first controlled scaffold-on versus scaffold-off pilot state.

## Decision

- No real model inference or model completion was started.
- The static RAM and commit floors passed, but with only 0.601 GiB RAM margin and 0.246 GiB commit margin.
- Runtime-plus-context VRAM fit at the imported 32,768-token context remains unverified.
- Treat the pilot as BLOCKED until there is adequate measured headroom for the full 60-completion run.
- No Edge, Godot, ChatGPT, project, or system process was terminated.

## Repository state

- Canonical worktree: E:\covert-nightshift-integration
- Branch: nightshift/production-convergence-20260926
- HEAD: c2b8a70ac4e7a69a9865aae97a66a74e05e5f8a3
- Upstream: origin/fix/v1-p0-route-drift; 11 commits ahead, 0 behind.
- Origin: https://github.com/AnonymousNomad/covert-coder.git
- 42 worktrees; 24 dirty entries in this worktree. Preserve all existing changes.
- No commit, push, merge, cleanup, or branch change was made.

## Runner validation

- `npm run test:harness-battery`: 6 grader tests passed; local fixture passed 10 tasks and 20 fake calls.
- ESLint passed for runner, task battery, fixture, and unit test files.
- `git diff --check` passed; only existing CRLF normalization notices were printed.
- The local fixture is synthetic test evidence, not model evidence.
- Prior broker runtime fixture: 2/2 passed; it did not load a model or prove packaged behavior.

## Experimental source fingerprints

- package.json: 731dc9787bb145ddfc2db317994ea1a858617ecf9d0eaf193276e31dea4c1579
- package-lock.json: 0c11388e7f114d5bceece57bf78af3c11b3ccbaa42bfffd166d6e58f267e9a8d
- scripts/run-harness-battery.mjs: 85878a4ae68b081150e968cd1e4e461525b24f16cea2b68ba1b0182e097af388
- benchmarks/context-ablation-v1.mjs: 7a86166f91a163587878ef11de938d25d3a225394f3ecbf239099fc79d0518c4
- scripts/verify-harness-battery-task-count.mjs: d5056c9dccce5b589231634d60be765aabe39610b1edf962b10ab63788bc6309
- tests/unit/test-harness-battery-core.mjs: 9a2d699fa8fcf21ef1e811959e5b11b41ab98c3f06c7143a0f2b29a94a4f9bff
- harness/scaffold.mjs: ccd6e8687a5823fc63ca3b138cd1c61e0158b4370d44f696fa1b40804e65607a
- common/harness/credocore.md: 3e544e2bbd3ab8658027c7edc99a04958f34d38f59a6746a2e4fc745b6c0ecd7
- Tested source revision: c2b8a70ac4e7a69a9865aae97a66a74e05e5f8a3; worktree is dirty.

## Model and resource preflight

- Candidate: lfm2.5-2.6b-q4_k_m-02a8b7e1, Q4_K_M, Unsloth Studio 2026.9.11 / Vulkan.
- Model SHA-256: 02a8b7e17487d326e46d68ce0ba24211e1b80a14c4cd0597fa73c1cd697f52ed.
- Verified file: E:\models\house-model\lfm25_gguf\LFM2.5-2.6B-Q4_K_M.gguf; 1,674,455,040 bytes (1,596.9 MiB).
- Imported context: 32,768 tokens. No model runtime or inference process was active.
- Snapshot time: 2026-09-27 09:52:01 CDT.
- Free RAM: 8,430,161,920 bytes (7.850 GiB of 15.925 GiB); floor 7.25 GiB, margin 0.601 GiB.
- Free commit: 6,974,599,168 bytes (6.496 GiB); floor 6.25 GiB, margin 0.246 GiB.
- GTX 1060: 5,000 MiB free / 6,144 MiB; 24% utilization, 44 C, 8.14 W.
- Weight file fits in free VRAM; runtime and 32,768-token KV/context allocation have not been measured.
- A prior supervised app start fell from 5.10 GiB free commit to 4.34 GiB. The current commit margin is smaller than that observed startup change.
- No safe disposable process was identified. Edge, Godot, ChatGPT, project Node, and system processes remain untouched.
- Raw snapshot: docs/nightshift/evidence/harness-pilot-resource-preflight-2026-09-27T095201-0500.json
- Snapshot SHA-256: 45d4926deef6cbc87b398974be2b901c3ba0846c84ee0d86a26abf91eff48287
## Evidence-schema repair

- Runner now requires a full 40-character source commit, model context, quantization, and a timestamped resource snapshot.
- Each request records temperature, top-p, top-k, repeat penalty, fixed generation seed, task token cap, raw messages, raw response, output hashes, timestamps, latency, usage, and per-request RAM.
- Each trial uses seeded shuffled task order and randomized 5/5 control-first/treatment-first order.
- Output includes grader version, baseline/treatment pass rates, absolute and relative delta, paired wins/losses/ties, per-task outcomes, trial variance, failure categories, malformed-output and timeout/error rates.
- Evidence files remain unique and refuse overwrite. Commit/VRAM telemetry is the timestamped preflight snapshot; only RAM is sampled per request.

## Endpoint and continuation

- Imported .aide/ingested-models.json records endpoint port 58697; current adapter default and runtime fixture use 18888. Neither port had a listener at preflight.
- Before a real request, obtain the live runtime's actual endpoint/model identity after a safely admitted load. Do not infer the endpoint from stale inventory alone.
- Exact next pilot action: refresh resource/port state; proceed only with adequate margin for a complete 60-completion run and verified runtime-plus-context VRAM fit; hash the frozen sources; then execute 10 tasks × 3 trials × 2 conditions.
- If that resource gate remains unsafe, do not load or infer. Continue the independent packaged first-run CLI configuration/status closure unit.
- No model comparison result exists. Do not use fixture metrics as pilot scores or make general harness-effectiveness claims.
- No commit, push, or merge has been made.
## Resume update — 2026-09-27 11:19 CDT

- Pilot disposition remains BLOCKED, not a scored failure: 0/60 completions, 0 inference requests, no model artifact load confirmed, and no task prompt sent.
- Candidate remains `lfm2.5-2.6b-q4_k_m-02a8b7e1`, Q4_K_M, SHA-256 `02a8b7e17487d326e46d68ce0ba24211e1b80a14c4cd0597fa73c1cd697f52ed`, requested context 32,768.
- Unsloth Studio 2026.9.11 / Vulkan was launched by the verified adapter-owned path at port 18888. The lifecycle load returned HTTP 401 / `AUTH_REQUIRED`; CredentialStore presence check was false. No credential value was read into evidence.
- The earlier graceful shutdown returned HTTP 401. After verifying full ancestry and ownership, the exact owned tree (PIDs 4212, 9336, 17064, 15608) was stopped. Port 18888 and Unsloth runtime process count both verified zero; the Node REPL exited; Desktop Commander reports no active sessions. Edge, Godot, ChatGPT, and unrelated processes were not stopped.
- Resource timeline: 10:24 pre-start snapshot was 7.674 GiB free RAM / 6.675 GiB free commit / 4,990 MiB free VRAM. At 10:33 during runtime start/load request it was 7.382 / 5.968 GiB / 4,996 MiB VRAM. At 10:41 with runtime still active and no model loaded it was 6.900 / 5.381 GiB. These are host observations, not a deterministic runtime-cost guarantee.
- At 11:19 the fresh sample was 7.454 GiB free RAM, 6.357 GiB free commit, and 5,016 MiB free VRAM (GTX 1060, 34%, 43 C, 8.45 W). Basic floors barely pass now, but the observed start interval projected below both floors; no retry is admitted. Context/VRAM fit remains unverified.
- Machine-readable records: `harness-pilot-runtime-attempt-2026-09-27T102549-0500.json` (SHA-256 `09e47240ecc659351a67b11c71b9cfc9abc2c7dfda24cbc5627fbcbca73e65ca`); post-cleanup snapshot `harness-pilot-resource-preflight-2026-09-27T104328-0500.json` (SHA-256 `cfd765c8706e1f2d3978a103d0962d58d95e913c3929ddadca8222f9cb68ffd6`); current snapshot `harness-pilot-resource-preflight-2026-09-27T111931-0500.json` (SHA-256 `3c0b62d1b916918eeccc8e2f0ff828a9c51985150243841efc1105c84fae6c30`).
- All eight frozen harness source fingerprints were re-hashed at 10:43 and still match the values above. The real-inference source fingerprint has not changed; no inference was sent.
- Existing harness validation remains the latest runner evidence: `npm run test:harness-battery` passed 6 grader tests and the 10-task/20-call synthetic paired fixture; affected-file ESLint passed. They were not rerun because those exact source hashes are unchanged and the pilot experiment, not another runner demonstration, is the objective.
- Focused first-run status check: `node --experimental-strip-types --test tests/arch/broker-model-runtime.test.ts` — 2 passed, 0 failed, 0 skipped. The model panel renders the `AIDE_UNSLOTH_CLI` setup guidance. Packaged fresh-user proof remains open.
- Imported collaborator bundle into `docs/production-closure/`; all seven copied files match the source archive contents. Source ZIP SHA-256: `7b237164d8ced542270e6a492058a48ffc52923b11891007fb67d5ff6445d5e7`. This is subordinate design doctrine; no visual redesign or architecture change was made.
- Added and registered `skills/packs/covert-real-model-harness-pilot/SKILL.md` to encode auth-before-launch, retained resource floors, and immutable evidence handling. Registry JSON parses with exactly one entry. `git diff --check` passed; only existing CRLF normalization notices appeared.
- Repo remains `E:\covert-nightshift-integration`, branch `nightshift/production-convergence-20260926`, HEAD `c2b8a70ac4e7a69a9865aae97a66a74e05e5f8a3`, upstream `origin/fix/v1-p0-route-drift`, 11 ahead / 0 behind, 42 worktrees, 26 dirty status entries. All prior changes preserved; no commit, push, or merge.
- Next pilot action: operator configures the local `unsloth-local-runtime` credential through the approved local store/UI (do not send the token in chat); then re-measure and require the RAM/commit floors to remain satisfied after runtime startup, verify context fit, freeze hashes, and only then run 10 tasks × 3 trials × 2 conditions.
- While credential/resource gates are unresolved, continue the independent production queue. Do not claim a harness delta, model improvement, cross-harness result, or release readiness from this blocked attempt.

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


## Resume checkpoint — 2026-09-27 17:33 CDT

- Current canonical production lane: `E:\covert-nightshift-integration`, branch `nightshift/production-convergence-20260926`, HEAD `c2b8a70ac4e7a69a9865aae97a66a74e05e5f8a3`; upstream `origin/fix/v1-p0-route-drift` at `a9628b8861fbcfc31fb05741ffbcfd551945a054`, 11 ahead / 0 behind. Dirty state: 0 staged, 12 tracked unstaged, 14 untracked (26 status entries). Main PR31 worktree remains `resident/marathon-h1` / `b79d248` with 246 dirty entries; no branch or worktree changes were made.
- Fresh preflight sample at 17:31:22 CDT: 15.92 GiB RAM total / 4.23 GiB free (4,330 MiB available); commit 26,282,729,472 / 31,864,762,368 bytes, 5.20 GiB free. Both miss admission floors (7.25 GiB RAM / 6.25 GiB commit). GTX 1060 had 4,886 MiB free VRAM, 80 C, 69% utilization, 74.38 W; ACPI thermal zone 54.1 C. 32K context fit is unverified.
- Existing unrelated-to-pilot Qwen llama-server PID 3152 was present at 1,900.6 MiB working set; its process ancestry is under the main workbench Node service. Stopping it alone cannot reach the RAM floor, so no process was stopped. Edge and all active applications/worktrees remain intact.
- Pilot remains `BLOCKED_PRE_INFERENCE`: candidate LFM2.5 2.6B Q4_K_M weights hash is unchanged; 0/60 completions, 0 inference requests, 0 prompts. Auth status remains last known absent at 13:49 CDT and was not rechecked. No candidate load or inference was attempted.
- Captured the exact eight-file source fingerprint at 17:31:22 CDT. All hashes match the previously validated runner checkpoint; `npm run test:harness-battery` remains PASS (6 grader tests plus synthetic 10-prompt / 20-fake-call paired fixture), and affected-file lint remains PASS. No rerun was needed because the frozen source hashes are unchanged.
- Appended machine-readable evidence: `harness-pilot-resource-preflight-2026-09-27T173122-0500.json`; JSON parse check passed, 8 fingerprints, SHA-256 `0ddc6a92f33cad3471391618da785d6d6ebe7c8e1c8cde67258f328f43e046f1`.
- Independent first-run source/fixture check passed: `node --experimental-strip-types --test tests/arch/broker-model-runtime.test.ts` — 2 passed, 0 failed, 0 skipped. Static inspection confirms the model panel renders `setup_message` when setup is required. This does not close packaged fresh-user acceptance; it still requires an isolated clean Windows profile or VM.
- No commits, pushes, merges, branch switches, cleanup, or user-process termination. Existing dirty edits and active work were preserved.
- Next executable action: continue safe production closure from this lane. For the real-model pilot, configure the runtime credential only through the approved local store, then repeat retained-resource and 32K context-fit admission before sending any prompt. For packaging, run first-use/status/restart/uninstall/network-boundary checks in an isolated fresh profile or VM; do not treat the source fixture as package proof.
