# Windows aggregate E2E resource incident — 2026-10-03

**Status:** A later canonical Veritas rerun passed after approved host-process cleanup. The earlier aggregate red remains preserved. Host resource pressure is strongly correlated with the moving E2E latency, but its exact Windows scheduling or I/O mechanism is not proven; the root cause is narrowed, not conclusively closed. The full root pre-push gate and exact-SHA CI remain outstanding.

## Ground truth

- Repository: `E:\covert-nightshift-integration`
- Branch / HEAD: `nightshift/production-convergence-20260926` / `c76f409fe8a468cc1c685851ffb23eee94263d62`
- No product source, Authority policy, test deadline, assertion, admission floor, or pagefile configuration was changed for these runs.
- The existing fixture edits were present in both full-suite runs. Temporary runtime tracing had been removed before either run. No local model was started.
- PR #31 remains frozen.

## Preserved uninstrumented red

Log: `E:\covert-tooling\functional-release-20261001\npm-test-clean-20261003-135938.log`

`npm test` exited 1 in the final serial E2E. Requests completed unusually slowly before the timeout:

| Request | Result / elapsed |
|---|---:|
| `GET /api/health` | 200 / 12,301 ms |
| `POST /api/authority/pair` | 200 / 16,836 ms |
| `GET /api/models/status` | 200 / 11,780 ms |
| `GET /api/workspace/tree` | 200 / 6,739 ms |
| `GET /api/academy` | 502 at 30,005 ms; client raised `TimeoutError` |

The model-ready call was not reached in this run. The 502 is the facade’s response after the existing client abort; it does not prove that the Academy handler returned HTTP 502. Source inspection shows the catalog handler returns `tutor.catalog()` synchronously, while the normal route dispatch still passes through Authority. No timeout or route behavior was changed.

A host snapshot during the final test segment, before the Academy timeout, reported 6.07 GiB free physical RAM and 5.38 GiB free commit. The visible Edge window was active. Its largest listed renderer was about 698 MiB; the main process and other listed renderers brought the visible process group to roughly 1.3 GiB. OpenCode had already been stopped; no Unity process was present when checked. The resource sample was not taken at the exact failing request boundary.

The supervised E2E stack exited through its cleanup path. Follow-up process/listener probes found no surviving Covert E2E Node process or default runtime listener.

## Same-code rerun after host cleanup

The visible Edge window was closed gracefully under the owner’s authorization. Six Edge background processes remained at about 0.28 GiB combined. WMI then reported 8.30 GiB free physical RAM and 8.60 GiB free commit. No repository source, fixture, timeout, assertion, or model setting changed between the red run and this rerun.

Log: `E:\covert-tooling\functional-release-20261001\npm-test-resource-cleared-20261003-141923.log`

`npm test` exited 0. The final E2E completed:

| Request | Result / elapsed |
|---|---:|
| `GET /api/health` | 200 / 1,279 ms |
| `POST /api/authority/pair` | 200 / 32 ms |
| `GET /api/models/status` | 200 / 101 ms |
| `GET /api/workspace/tree` | 200 / 1,455 ms |
| `GET /api/academy` | 200 / 53 ms |
| `GET /api/model/ready` | 200 / 1,348 ms |

The daemon E2E smoke passed. The test suite did not start a model; readiness remained observational.

## Earlier Veritas result after the first cleanup attempt

Log: `E:\covert-tooling\functional-release-20261001\veritas-clean-resource-20261003-142753.log`

At start, WMI reported 7.76 GiB free physical RAM and 8.30 GiB free commit. TypeScript and repository-wide ESLint completed; the serialized architecture runner then continued past the Veritas compile command’s existing 900,000 ms boundary. The Veritas report returned:

- path boundary: PASS
- secret scan: PASS
- manifest validation: PASS
- tests: PASS, exit code 0; final `/api/model/ready` returned in 1,965 ms and the daemon E2E smoke passed
- git diff: PASS
- compile/check: **FAIL / incomplete** (`passed:false`, reported `exit_code:0`); no signal or timeout classification is included in the result payload
- overall Veritas: **FAIL**

The runner process chain was absent after the result returned. The exact reason for the compile classification is still unknown; do not report this Veritas run as green.

## Classification after the earlier Veritas red

**Observed at this stage:** With the Edge window active, the uninstrumented aggregate run showed multi-second latency across health, Authority pairing, Model Access, and workspace reads, then timed out on Academy. With that workload closed and no product changes, the same full `npm test` sequence passed with sub-two-second reads. The subsequent Veritas `tests` phase also passed on the same source. These passes do not erase the preserved red. The first enclosing Veritas compile/check result was still red at this point.

**Inference:** External host load, particularly physical-memory pressure with the active Edge process group, is the leading explanation for the moving endpoint timeout. The endpoint shift from earlier workspace/model-ready failures to Academy, plus the broad latency before the red, argues against an Academy- or model-ready-specific defect. This is a strong correlation, not proof of a particular Windows scheduler, disk, Defender, or Authority persistence mechanism.

**Still open at this stage:** Obtain an interpretable green canonical compile/check result without raising the existing 15-minute limit; preserve the earlier aggregate reds; rerun the bounded Planner/Coder/Reviewer fixture check after the canonical gates are green; then complete the root pre-push gate and exact-SHA CI. The later canonical Veritas result is recorded below.

## Later canonical Veritas after approved host-process cleanup

The owner authorized closing resource-consuming applications needed to restore test headroom. During the active Veritas run, the visible Edge window was closed gracefully; the remaining Edge background process group was then closed, recovering **1.32 GiB** free physical RAM. The exact OpenCode user process was stopped afterward, recovering a further **0.88 GiB**. Codex, Windows services, and the active verifier were left running. No pagefile setting changed.

The verifier then completed the same existing gates without changing source, fixtures, assertions, test deadlines, or resource floors:

- Command: `npm run veritas`
- Result: **exit 0**, overall Veritas **PASS**
- Path boundary, secret scan, manifest validation, compile/check, full tests, and git-diff checks: **6/6 PASS**
- Architecture tests in compile/check: **983 total / 972 pass / 0 fail / 11 skipped**
- The full `npm test` phase and contained batteries returned success; this is the Veritas test result, not a release or installed-product claim.
- The full `npm test` output includes `P0 AIDE ACCEPTANCE PASSED`; the separately invoked `node scripts/resident-ownership-ui.mjs` controlled API/UI fixture passed **21/21** cases (`ACTUAL_COMPONENT_CONTROLLED_API`). No live model/provider or whole-app restart is claimed by that focused browser fixture.
- Final daemon E2E: health 1,242 ms; Authority pairing 12 ms; models/status 54 ms; workspace/tree 2,378 ms; Academy 470 ms; model/ready 1,749 ms; daemon smoke passed.
- Full serialized log: `E:\covert-tooling\functional-release-20261001\veritas-resource-cleared-rerun-20261003-145838.log`

**Updated classification:** The preserved red occurred with Edge active, free physical RAM at 6.07 GiB, and free commit at 5.38 GiB. The same-code full `npm test` and this canonical Veritas passed after closing the Edge process group and OpenCode, with free physical RAM restored above 8 GiB and free commit above 18 GiB. This is a strong host-load correlation and makes an application-code regression less likely. The evidence does not isolate physical-memory pressure from CPU scheduling, disk/Defender contention, or another concurrent host effect, and no resource sample was taken at the exact original failing request. Keep the red and cause classification open until the full pre-push gate has also completed and the intermittent behavior is either causally attributed or bounded as a verified host-capacity interaction.

**Next:** Run the canonical root pre-push hook under the recovered headroom; keep any new red. Then review the entire bounded fixture/evidence diff and exact counts before considering a coherent commit/push. PR #31 remains frozen.

## Pre-push scratch-Git isolation incident and recovery

The first attempted `AIDE_FULL_BATTERY=1 git push` was aborted before publication. It ran the shared configured hook path `E:\aide-sovern-workbench\pre-push`, not the Covert repository's tracked `pre-push`. Inspection showed that the shared hook version omitted the local-environment cleanup already present in the Covert-tracked hook.

Git's official hook documentation says hook processes inherit repository variables such as `GIT_DIR` and `GIT_WORK_TREE`, and recommends clearing Git's local variables before running commands in a foreign repository or worktree ([Git hooks documentation](https://git-scm.com/docs/githooks)). The affected architecture fixtures create temporary repositories, then run Git commands in their temporary workspaces. The hook environment redirected those nested commands into this linked canonical worktree.

The causal evidence is the local reflog and linked-worktree state during the active hook:

- The local canonical branch moved from checkpoint `0958484f94b8b334b95e663d36a43e4e28fbbb3e` through test commits `ea74896` (`base`), `2f7aedf` (`add gamma`), `347cb79` (`partial alpha`), and `c0d89b0` (`telemetry alpha`).
- The linked-worktree index temporarily contained four entries. The untracked Covert source files themselves remained on disk.
- The test output showed three failed `closed-loop-mission.test.ts` cases and five failed `git-routes.test.ts` cases while nested scratch Git operations were pointed at the caller repository.
- The full pre-push battery did not complete. Its exact hook/push process tree was captured at `E:\covert-tooling\functional-release-20261001\prepush-abort-process-tree-20261003.json`. The Git push was stopped before updating GitHub; `git ls-remote` confirmed remote branch HEAD remained `c76f409fe8a468cc1c685851ffb23eee94263d62`.

Recovery preserved test commit tip `c0d89b000bf4cf62a7cdf4f2c8c512aae528b0bb` at `refs/codex/rescue/prepush-git-route-side-effects-20261003` and copied the temporary index to `E:\covert-tooling\functional-release-20261001\index-before-git-route-recovery-20261003.bin` (SHA-256 `6A781FEF39FE8AA31169ECC85A9BE905FBE775952B0BBE6395452974F27A1C39`). A compare-and-swap ref update restored the local convergence branch to `0958484f94b8b334b95e663d36a43e4e28fbbb3e`; `git read-tree` restored only the index, without checking out or overwriting worktree files. The pre-existing dirty desktop battery and untracked Design Lab remain intact.

Before re-enabling the full push battery, I ran the exact tracked-hook sanitation in a simulated hook environment with `GIT_DIR`, `GIT_WORK_TREE`, and `GIT_INDEX_FILE` set. Focused `closed-loop-mission.test.ts` plus `git-routes.test.ts` then passed **14/14** in 27.5 seconds. Canonical HEAD stayed `0958484f94b8b334b95e663d36a43e4e28fbbb3e`, and the index SHA-256 stayed `27CBE08FBC2957FC269D86BEFEB4C3BF4A9DFD652EB298F2B806393278FF8F52`. The full gate has not yet been rerun.

The tracked Covert `pre-push` already runs `unset $(git rev-parse --local-env-vars)` before starting the architecture battery. The shared common-repository `core.hooksPath` setting bypassed that safer file. For the next full gate and push, invoke Git with `-c core.hooksPath=.` so it uses the Covert-tracked hook without changing shared Git configuration. The local branch remains one commit ahead of the unchanged remote until that gate passes.

## Follow-up full Windows test after Unity closure

- **Branch / tested SHA:** `nightshift/production-convergence-20260926` / `690c29dd930c1e1d62b1c4f92dac5ef0ed096854`; no source or fixture changes were present during this run.
- **Command:** `npm test`; **exit 0**. Full output: `E:\covert-tooling\functional-release-20261001\npm-test-resource-ready-20261003-1719.log` (33,895 bytes). The command reached the final supervised daemon E2E smoke and cleaned up its test stack.
- **Final E2E observations:** health 1,200 ms; Authority pairing 90 ms; models/status 30 ms; workspace/tree 2,055 ms; Academy 31 ms; model/ready 2,296 ms; plugins 134 ms; remaining read routes 35–55 ms. The readiness response was HTTP 200; this test logs status and duration, not the `ready` boolean value. No model start was requested.
- **Resource measurements:** before the suite at 17:19 local, 7.97 GiB free physical RAM and 9.69 GiB free commit; after teardown at 17:41, 8.02 GiB free physical RAM, 19.08 GiB committed of a 28.68 GiB limit (9.60 GiB free), and 5,430 MiB free VRAM at 9% GPU use. Unity was absent. No pagefile setting was changed. A post-test CIM snapshot reported automatic pagefile management disabled, C: setting 0/0 MiB, C: allocated/current/peak usage 10,115/7,623/9,598 MiB, and E: 2,944/2,223/2,812 MiB; these are observations only, not evidence that pagefile policy caused the earlier timeout.
- **Cleanup:** after the suite, no listener remained on 4777 or 18888, and no Covert test Node or llama/Unsloth process remained.

**Updated classification:** This is a further full-suite pass on the exact published SHA with resource headroom above the configured floors. The coarse pre/post commit snapshots differ by about 0.09 GiB and cannot establish or exclude a transient leak; no Covert test/runtime process remained after teardown. Together with the prior resource-cleared pass, this strengthens the host-contention correlation. It does not identify the exact Windows scheduling, paging, I/O, or service mechanism in the preserved failure; that red remains open. The successful run does not erase or waive it.

**Current gate status:** The canonical pre-push gate and exact-SHA AIDE CI passed on this SHA (CI `37154295982`); this follow-up adds runtime evidence only and does not revise the gate counts or qualify a local model. PR #31 remains frozen.
