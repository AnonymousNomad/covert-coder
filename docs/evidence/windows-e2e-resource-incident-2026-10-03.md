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
