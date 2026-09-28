# Model Access foundation checkpoint — 2026-09-28

## Scope

Recovered the local interrupted Model Access slice in `E:/covert-nightshift-integration` on `nightshift/production-convergence-20260926`. The pre-change base and upstream were both `1dca0c51703ef800a6c2733ded9a2b1045d8bda6`. The recovery copy at `E:/covert-model-access-wip-20260928` remains preserved.

This closes the local implementation and verification portion of P0/P1. It is not yet the phase exit: the coherent checkpoint still needs a commit, push and exact-SHA GitHub CI.

## Implemented

- Strict Model Access contracts and a passive, secret-free `GET /api/models/manager` projection.
- Separate identities for logical models, artifact/source, provider routes, credential sources, execution adapters, runtime state and qualification.
- Bounded local artifact discovery and freshness checks. Artifact presence, provider health and stored credentials do not independently imply verified model support or readiness.
- Read-only selection policy that does not mutate preferences or alter execution routing.
- Connection test-request bounds that accept the 68-character `api:` plus maximum-length BYOK provider ID.
- Regenerated OpenAPI, facade route map and C1-02 ownership decisions; added and registered the focused failure skills.

## Verification

| Check | Result |
|---|---|
| Focused Model Access + Connections tests | 13/13 passed |
| `npm run contracts` | Passed; 238 documented operations |
| Facade map generation | Passed |
| C1-02 route decision generation | Passed |
| `npm run check:arch` | Passed: 795 total, 784 passed, 0 failed, 11 documented skips |
| Supervised paired facade `GET /api/models/manager` | HTTP 200; valid envelope; `public_safe: true`; canonical runtime `unsloth`; 18 inventory entries |
| `git diff --check` | Passed |

## Follow-up verification — 2026-09-28 15:38 -05:00

The prior Veritas run stopped at the staged desktop smoke because its test launcher omitted the native parent's required bootstrap arguments. After tracing the Tauri pairing flow, the smoke was updated to use an approved packaged origin, perform the one-time pairing exchange, assert the unpaired model route returns 403 and the paired route returns a valid 200 response, and exercise both TS and legacy routes through the facade. Pairing proof and session credentials stay in memory and are not logged or written. The smoke now chooses temporary ports, captures bounded child logs on failure, and verifies process/listener cleanup before removing its workspace.

| Check | Result |
|---|---|
| `npm run desktop:prepare` | Passed; staged from current source. Optional legacy bootstrap GGUF was absent and not claimed. |
| `node scripts/desktop-staged-smoke.mjs` | Passed 10/10 checks on the freshly rebuilt staged tree; pairing, protected model read, TS and legacy routes, fail-closed unknown route, and cleanup all observed. |
| `npm run check` | Passed; TypeScript and ESLint had 0 errors (62 existing warnings); architecture battery 795 total, 784 passed, 0 failed, 11 documented skips. |
| `npm test` | Passed, including REAL AIDE and P0 acceptance, Desktop battery 9/9, staged smoke 10/10, grammar battery 5/5, and final end-to-end smoke. |
| `npm run veritas -- --json --output artifacts/veritas-model-access-2026-09-28.json` | Passed all six checks; Veritas `verified`, score 1.0/1.0, no failed checks. |
| Issue #38 | Checked after the verification change; open, no comments. |

Veritas output is recorded in `artifacts/veritas-model-access-2026-09-28.json`. A post-run scan found no pairing-proof, bearer-token, or GitHub-token pattern in that report. No staged-stack process or listener remained after the smoke. This remains local source/runtime verification; the checkpoint commit, push, exact-SHA GitHub CI, live OpenCode Go/DeepSeek execution, user acceptance, and release gates are still open.

The architecture command includes Node TypeScript, browser TypeScript, ESLint and the full architecture battery. The 11 skips are existing explicit skips, including absent bundled GGUF artifacts and migration-waived assertions.

## Limits and next phase

The supervised facade probe proves only the endpoint and its safe projection. It does not prove a runtime/model is live or ready. Provider lifecycle ownership, cancellation and cleanup remain open for P2. Live OpenCode Go → DeepSeek V4.1 Flash execution, Mission Receipt acceptance, first-user/browser acceptance, CP01–CP18 and package/release gates also remain open.

Next: publish the locally verified shutdown repair, require green GitHub CI on its exact SHA, then proceed to P2 Provider adapter lifecycle correctness. Machine-readable details are in [model-access-foundation-2026-09-28.json](model-access-foundation-2026-09-28.json); the Veritas check output is in `artifacts/veritas-model-access-2026-09-28.json`.

## Exact-SHA CI regression and shutdown repair — 2026-09-28 16:52 -05:00

Checkpoint `981c6a804c056ce21d62dbd6014e6905c670dbf4` was pushed to the authorized convergence branch. GitHub Actions run [36481897389](https://github.com/AnonymousNomad/covert-coder/actions/runs/36481897389) ran on that exact SHA and **failed**. Frontend build, type checks/lint, architecture tests, Veritas, generated-file/worktree checks and cleanup passed. Backend/integration tests passed 52 of 53 commands; `tests/integration/test-canonical-launch.mjs` timed out at the runner's 20-minute limit. Its Vite-development case failed after 31.5 seconds; cleanup reported launcher PID 2742 did not exit, while the test ports were already closed. Linux did not capture a Windows process inventory, so an empty inventory was not treated as proof that the launcher exited.

The previous POSIX shutdown path signaled direct child processes and returned without waiting for the owned tree. `scripts/start.mjs` now starts owned POSIX children in dedicated process groups and retains each child handle through shutdown, including after its leader exits, so cleanup can still inspect and terminate descendants in that group. Shutdown waits for the launcher and group to exit after SIGTERM, escalates the same group to SIGKILL after five seconds, verifies again, and reports cleanup failure as a nonzero shutdown. Windows continues to use `taskkill /T /F` for the exact owned child tree. Unknown POSIX process-group probe errors do not count as proof that the group is absent.

| Repair verification | Result |
|---|---|
| `node --test tests/integration/test-canonical-launch.mjs` on final local repair | Passed 3/3, including the Vite development launch and required-backend-failure cleanup. |
| `npm test` | Passed after the initial shutdown repair and before the final fail-closed POSIX probe/timeout refinements; full sequence included REAL AIDE/P0 acceptance, Desktop battery, staged smoke, grammar battery and end-to-end smoke. The final source passed `npm run check` and the focused launcher integration test afterward. |
| `npm run check` on final local repair | Passed: architecture 795 total, 784 passed, 0 failed, 11 documented skips; TypeScript and ESLint passed with 0 errors and 62 existing warnings. The initial default-cache invocation could not write its npm log because C: was full; rerunning with `npm_config_cache=E:\pip_temp\covert-nightshift-npm-cache` completed successfully. No C: files were removed. |
| `node --check scripts/start.mjs` and `git diff --check` | Passed. |
| Local WSL Vite launch | Not verified: the Vite URL did not become reachable within 30 seconds in that environment. This is not counted as a pass or as reproducing the CI failure. |
| GitHub CI for repaired source | Pending; Linux process-group behavior remains unproven until the next exact-SHA run. |
| Issue #38 | Open with no comments at the post-regression check. |

The separate open Dependabot alert #1 for `glib` in `desktop/Cargo.lock` remains a packaging/security-phase item; it was not involved in this CI failure. P2 must wait until the repaired P0/P1 checkpoint is pushed and its exact-SHA GitHub CI is green.
