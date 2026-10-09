# Local Model C: Recovery Recheck — 2026-10-09

## Scope and repository truth

This is a bounded continuation of the local-model vertical from the C:-resident recovery copy at `C:\Users\Grey_\prod_checkpoints\storage-recovery-2026-10-08\covert-local-model-demo-proof-20261007`. It is a recovered copy of the former `E:\covert-local-model-demo-proof-20261007` worktree, not a claim that the original E: worktree was used or changed.

- Branch: `feat/local-model-demo-proof-20261007`
- Starting HEAD: `70dd12287383b729a25d01ca26a898d7ad8cdc76` (`docs(evidence): add isolated runner guard`)
- Git status before and after the focused checks: clean before this receipt; no source/test files changed.
- The checkout's `.git` text file still names the historical E: worktree. Git commands for this recheck were explicitly bound to the copied C: Git worktree metadata under `C:\Users\Grey_\prod_checkpoints\storage-recovery-2026-10-08\covert-shared-git`; `rev-parse --git-common-dir` resolved to that C: copy. The local convergence reference is `7f79be9f09afa43283d3548b3b2fd0c98a6dbca7`; it is the merge base. No fetch, push, branch switch, or canonical-worktree operation occurred.
- The local feature branch has no `origin/feat/local-model-demo-proof-20261007` tracking ref in this copied Git snapshot.
- During receipt staging, one later shell omitted the C: Git environment overrides and staged only these two receipt paths in the historical E: linked index: `docs/nightshift/evidence/LOCAL-MODEL-C-RECOVERY-RECHECK-2026-10-09.md` and `.json`.
- A read-only inspection found no other staged paths and confirmed the corresponding E: worktree files were absent. `git restore --staged` was then applied only to those two paths. Final E: status and staged diff were clean; no E: worktree file, source/test/runtime data, recovery snapshot, or manifest was modified.
- Root cause: PowerShell environment variables were scoped to one command invocation and were not set again in the subsequent shell. All remaining Git commands are explicitly bound to the copied C: Git metadata.

## C:-only scratch and verification

`TEMP`, `TMP`, and `TMPDIR` were set to `C:\Users\Grey_\AppData\Local\Temp\covert-local-model-c-20261009`. Git environment overrides also pointed to the copied C: Git metadata and the C: worktree. The test temporary directory was empty after the checks; no Node process whose command line referenced this worktree remained.

| Command | Result |
|---|---|
| `node --experimental-strip-types --test --test-concurrency=1 tests/unit/test-m-hub.mjs tests/unit/test-modelhub-containment.mjs` | exit 0; **30 passed, 0 failed, 0 skipped, 0 cancelled**; 2.480 s |
| `node --experimental-strip-types --test --test-concurrency=1 tests/arch/modelhub-routes.test.ts` | exit 0; **12 passed, 0 failed, 0 skipped, 0 cancelled**; 2.622 s |

These suites use controlled upstream fixtures. They verify the current source-level search/inspection/download binding, digest/size/GGUF checks, containment, Authority-bound route wiring, egress policy, and refusal behavior. They are not live Hugging Face acquisition or runtime evidence.

## Accepted storage disposition carried forward

- Overall recovery state remains `RECOVERY_PARTIAL`.
- C: is the verified physically independent temporary-recovery target for the bounded sets already copied. The accepted recovery record's C: free-space reading was `1,754,648,576` bytes; the fresh task-specific readings below are later and apply only to this acquisition check.
- E: and L: remain non-independent because both reside on Disk 0.
- The WSL VHDX/full recovery set remains specifically `BLOCKED_CAPACITY`, requiring `9,028,239,360` bytes under the accepted margin.
- No completed C: snapshots/manifests were changed, remeasured, or recopied. No CHKDSK, repair, migration, or destructive cleanup was performed.

## Current execution gates

A direct read-only call to the canonical `createResourceAdmission().admitLocalRuntimeStart()` service at `2026-10-09T13:04:05.660Z` returned `REFUSE_RESOURCE`:

| Measurement | Observed | Required |
|---|---:|---:|
| Free physical memory | 5,461 MiB | 6,656 MiB |
| Free Windows commit | 6,373 MiB | 5,120 MiB |
| Free VRAM | 5,234 MiB | 4,608 MiB |
| GPU utilization | 3% | below 50% |

Physical memory is 1,195 MiB below the unchanged start floor. Commit, VRAM, and GPU-use checks pass; the load-average probe remains unknown. No app stack, model process, or inference was started.

For the pinned LFM2.5 GGUF acquisition already described in the prior lane evidence, the minimum artifact is **1,674,455,040 bytes**, before any safety margin. C: free space was measured at **570,191,872 bytes before** and **565,448,704 bytes after** the focused test run. The post-test free space is **1,109,006,336 bytes below the artifact alone**. Therefore the required C:-workspace download cannot safely proceed in this task state. This is a task-specific capacity gate; it does not change the accepted global storage disposition `RECOVERY_PARTIAL`, and it does not reopen the WSL recovery work.

The known exact artifact on E: was not read or copied during this recheck. No E:/L: temporary or scratch path was used. The previously verified C: recovery snapshots and manifests were left untouched.

## Canonical Product-Lock / Implementation Reconciliation input

This section carries the local-model evidence into the product-lock reconciliation. It is based only on files already present in this C: checkout; E: and L: were not read during this handoff.

- The pinned artifact is **the same exact Liquid LFM2.5 artifact already represented by Covert's existing V1 Unsloth qualification**, not a distinct candidate: `LFM2.5-2.6B-Q4_K_M.gguf`, `1,674,455,040` bytes, SHA-256 `02a8b7e17487d326e46d68ce0ba24211e1b80a14c4cd0597fa73c1cd697f52ed`, upstream `LiquidAI/LFM2.5-2.6B-GGUF` revision `e7caca5d835a3901a8e0d63e94009429bafafdfc`. The same exact identity appears in `node/src/services/broker-model-runtime.ts` as `UNSLOTH_V1_QUALIFICATION` and in `docs/design/local-runtime-lab/evidence/UNSLOTH-RUNTIME-PASSPORT-V1.json`.
- `docs/nightshift/evidence/MODEL-CARD-LFM2.5-2.6B-Q4_K_M.md` records two exact-artifact start/stop cycles with successful generation, cancellation, restart and second generation on 2026-10-01. The Passport limits that qualification to Windows Administrator + Unsloth 2026.9.11 + Vulkan + GTX 1060 Mobile and the pinned request profile. It does **not** establish Resident/Cipher role qualification, general tool qualification, redistribution clearance, or present readiness.
- `docs/nightshift/evidence/local-gguf-host-inventory-2026-09-30.md` and the prior 2026-10-08 local-model record document that this exact file was previously observed at `E:\models\house-model\lfm25_gguf\LFM2.5-2.6B-Q4_K_M.gguf` with the same size and hash. That is historical host evidence only. Current file presence and safe accessibility are **UNKNOWN** here because this handoff did not read E: or L:.
- `models/manifest.json` says Liquid models are not included in the optional pack (`liquid_models_included: false`). The `ACTIVE-CONTEXT-PACKET.md` records a prior Model Access import for this exact hash. Therefore a new live Hub download of this pinned revision would reacquire bytes already represented by the established artifact/profile/import history; it is a **duplicate acquisition path**, not evidence that the model identity is missing. The actual weights are absent from this C: checkout, which does not prove they are missing elsewhere.
- Source inspection confirms the existing product owner: `BrokerModelRuntime` composes the canonical `RuntimeBroker`, binds the exact V1 artifact identity, and gates local starts through Resource Admission. The Resident route exposes observed runtime/model availability. The inspected code and prior Passport do not prove the Liquid artifact is currently selected or qualified for a Resident role.

**Reconciliation classification:** `EXISTING_CANONICAL_ARTIFACT_IDENTITY`; proposed new download is `DUPLICATE_ACQUISITION_PATH`; last-known host location is historical and current safe availability is `UNKNOWN`; artifact identity is not genuinely missing, while current Resident-role qualification and live availability remain `UNKNOWN`/unproven.

No download, registration, model start, fresh Admission call, E:/L: access, or convergence mutation occurred. The unchanged capacity and Admission reds above still govern. A bounded search of this isolated checkout found no separate file titled or referenced as the Covert Canonical Product-Lock / Implementation Reconciliation Audit; this section is reconciliation input for that audit and does not claim to replace or complete the canonical audit.

## Disposition

- ModelHub focused source/route checks: **PASS for tested fixture-backed scope**.
- Live Hub search/inspect/download, immutable artifact publication, registration through the live app, fresh `START`, runtime launch, generation, stop/restart, and baseline performance: **NOT PROVEN**.
- Local runtime remains refused by canonical physical-memory Admission.
- Live acquisition also remains unable to fit on C: even before a safety margin; no download was attempted.
- No release readiness, model qualification, or package acceptance is claimed.

## Next executable action

Continue independent C:-resident source and test preparation without using E:/L:. Resume live acquisition only when C: has measured capacity greater than the exact artifact plus an explicit safety margin, and the canonical local-runtime Admission returns `START` before any model launch. Do not retry the download against E: or lower Admission floors.
