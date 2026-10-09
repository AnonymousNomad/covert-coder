# Local Model C: Recovery Recheck — 2026-10-09

## Scope and repository truth

This is a bounded continuation of the local-model vertical from the C:-resident recovery copy at `C:\Users\Grey_\prod_checkpoints\storage-recovery-2026-10-08\covert-local-model-demo-proof-20261007`. It is a recovered copy of the former `E:\covert-local-model-demo-proof-20261007` worktree, not a claim that the original E: worktree was used or changed.

- Branch: `feat/local-model-demo-proof-20261007`
- Starting HEAD: `70dd12287383b729a25d01ca26a898d7ad8cdc76` (`docs(evidence): add isolated runner guard`)
- Git status before and after the focused checks: clean before this receipt; no source/test files changed.
- The checkout's `.git` text file still names the historical E: worktree. Git commands for this recheck were explicitly bound to the copied C: Git worktree metadata under `C:\Users\Grey_\prod_checkpoints\storage-recovery-2026-10-08\covert-shared-git`; `rev-parse --git-common-dir` resolved to that C: copy. The local convergence reference is `7f79be9f09afa43283d3548b3b2fd0c98a6dbca7`; it is the merge base. No fetch, push, branch switch, or canonical-worktree operation occurred.
- The local feature branch has no `origin/feat/local-model-demo-proof-20261007` tracking ref in this copied Git snapshot.

## C:-only scratch and verification

`TEMP`, `TMP`, and `TMPDIR` were set to `C:\Users\Grey_\AppData\Local\Temp\covert-local-model-c-20261009`. Git environment overrides also pointed to the copied C: Git metadata and the C: worktree. The test temporary directory was empty after the checks; no Node process whose command line referenced this worktree remained.

| Command | Result |
|---|---|
| `node --experimental-strip-types --test --test-concurrency=1 tests/unit/test-m-hub.mjs tests/unit/test-modelhub-containment.mjs` | exit 0; **30 passed, 0 failed, 0 skipped, 0 cancelled**; 2.480 s |
| `node --experimental-strip-types --test --test-concurrency=1 tests/arch/modelhub-routes.test.ts` | exit 0; **12 passed, 0 failed, 0 skipped, 0 cancelled**; 2.622 s |

These suites use controlled upstream fixtures. They verify the current source-level search/inspection/download binding, digest/size/GGUF checks, containment, Authority-bound route wiring, egress policy, and refusal behavior. They are not live Hugging Face acquisition or runtime evidence.

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

## Disposition

- ModelHub focused source/route checks: **PASS for tested fixture-backed scope**.
- Live Hub search/inspect/download, immutable artifact publication, registration through the live app, fresh `START`, runtime launch, generation, stop/restart, and baseline performance: **NOT PROVEN**.
- Local runtime remains refused by canonical physical-memory Admission.
- Live acquisition also remains unable to fit on C: even before a safety margin; no download was attempted.
- No release readiness, model qualification, or package acceptance is claimed.

## Next executable action

Continue independent C:-resident source and test preparation without using E:/L:. Resume live acquisition only when C: has measured capacity greater than the exact artifact plus an explicit safety margin, and the canonical local-runtime Admission returns `START` before any model launch. Do not retry the download against E: or lower Admission floors.
