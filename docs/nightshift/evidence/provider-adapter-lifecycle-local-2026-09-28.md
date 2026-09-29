# P2 Provider Adapter Lifecycle — local checkpoint

**State:** `INTEGRATION_VERIFIED` for the deterministic local fixture path. This is not live-provider, runtime, release-candidate, or release-accepted evidence.

## Latest follow-up — 2026-09-29 07:31

This follow-up supersedes the older source-review and “Next” statements below that said the exact Model Manager → Authority → streamed OpenCode path was not wired. Those statements describe the older source commit listed in the historical identity section.

- **Checkpoint:** branch `nightshift/production-convergence-20260926`, exact source SHA `e8dfd1accbc5cca50ed3bc40ce76875d5f1c485b`, pushed with a clean worktree matching origin. Exact-SHA AIDE CI run [`36568947676`](https://github.com/AnonymousNomad/covert-coder/actions/runs/36568947676) completed successfully in 10m51s; all 22 workflow steps passed, including backend/integration, type/lint, bounded architecture, all six Veritas checks, generated-file/worktree, fixture cleanup, and required summary.
- **Bounded addition:** the production-route lifecycle fixture now exercises OpenCode operation timeout through the exact verified Model Manager target and Authority approval, across the simulated service restart. The real bridge implementation is injected and bounded at its supported 5-second minimum. The request consumer receives a 20-second deadline so its own timer does not race the bridge timeout. The test requires a partial delta followed by the timeout error, no successful `done` frame, a failed operation receipt bound to the exact target, and a durable failed Authority event with the same digest. The fixture also checks timeout abort/session deletion counts.
- **Root cause of the initial test failure:** the fixture’s default HTTP read deadline was also 5 seconds. It collided with the bridge’s 5-second minimum and aborted the SSE consumer before the server’s timeout outcome could be observed. Giving only this request a longer deadline resolved the harness race; no product timeout or acceptance assertion was weakened.
- **Local verification:** `tests/arch/provider-route-lifecycle.test.ts` **2/2**; focused OpenCode Model Access route **1/1**; Node TypeScript passed; ESLint on the two changed test files passed; fixture `node --check`, `git diff --check`, and the versioned root pre-push gate passed. No production source changed. The full Windows `npm run check` result remains **812 passed, 4 request timeouts, 11 skipped of 827** from the earlier run; it is not reported green.
- **Evidence limits:** this proves deterministic local fixture behavior through the production route composition. It does not prove authenticated/live OpenCode Go or DeepSeek execution, provider spend behavior, packaged acceptance, or release readiness. No credential was inspected and no live provider request or spend occurred. PR #31 remains frozen.
- **Next owner gate:** the current owner-managed authentication path and existing spend ceiling are still not present in project evidence. Do not send an inference request until both are supplied and verified without reading or recording credential contents; preserve `UNKNOWN` for live provider execution.

## Identity

- Repository: `E:\covert-nightshift-integration`
- Branch: `nightshift/production-convergence-20260926`
- Tested source commit: `9bf4abb1a135b9f0429c0fda965c2e300f639b85`
- Parent: `fbd2784f9f82f68486615a5006a459c1962f2fb2`
- Pushed checkpoint commit: `1f34c51e2386f045bd98cb7a2f0a689b880c12f6`
- Environment: Windows, Node `v26.4.0`; free physical memory was 3.12 GB before the focused regression run.
- GitHub CI run `36511326993` on exact pushed checkpoint SHA `1f34c51e2386f045bd98cb7a2f0a689b880c12f6`: **success**, [run details](https://github.com/AnonymousNomad/covert-coder/actions/runs/36511326993). CI environment: `ubuntu-latest`, Node `26.4.0`, Python `3.12`; duration 9m6s.

## Implemented behavior covered

- An external route is eligible only for its exact Model Manager route, with `model_support_state=VERIFIED`, availability, configuration, healthy provider state, consent/egress requirements, ready setup, credential-source identity, and the registered `direct-http` adapter.
- Authority binds the canonical model, route, connection, credential-source, adapter, provider/model, egress host, and target revision. Dispatch re-resolves and compares that identity before sending a request. Generic external chat and streaming cannot bypass the Authority-resolved target.
- Provider verification requires a provider-shaped completion for the selected model; a generic 2xx response does not establish model support. Custom endpoints and sibling models do not inherit built-in verification.
- External streaming uses the provider SSE adapter. Caller cancellation, timeout, provider stream errors, and non-2xx responses cancel/close the upstream body and produce failed Authority outcomes while retaining target identity.
- Restart retains the encrypted credential in the fixture but resets provider health and exact-model support to `UNKNOWN`; execution remains denied until the exact route is probed again.

## Verification

- Node TypeScript: `node node_modules/typescript/bin/tsc -p tsconfig.node.json` — exit 0.
- Focused P2 regression set: provider, model access, model router, chat Authority security, provider routes, Doctor truth, model lifecycle Authority, and C1-02 route drift — **66 passed, 0 failed, 0 skipped**.
- `tests/arch/provider-route-lifecycle.test.ts` — **1 passed, 0 failed** (36.17 s). This drives production `buildRoutes`, `ProviderService`, Model Manager, Authority, receipt persistence, and restart using an injected deterministic fake fetch and fixture-only credential encryption.
- `tests/arch/model-lifecycle-authority.test.ts` — **1 passed, 0 failed** (16.39 s) with a deterministic hardware probe injected only in the fake-child test.
- Cached and working diff whitespace checks passed. The checked-in lightweight pre-push script passed with `AIDE_FULL_BATTERY` unset.
- Exact-SHA GitHub CI passed all 18 workflow steps. `node scripts/ci-run-all.mjs` reported **53/53 commands passed**; `npx tsc -p tsconfig.node.json && npx tsc -p browser/tsconfig.browser.json && npx eslint .` passed; `timeout -k 30 900 node scripts/run-arch.mjs` reported **809 total, 793 passed, 0 failed, 16 skipped**; `npm run veritas -- --json` reported `passed=true` across path-boundary, secret-scan, manifest-validation, compile, tests, and git-diff; `node scripts/ci-worktree-check.mjs` and `node scripts/ci-cleanup.mjs` passed. The architecture skips remain explicitly counted; this is the bounded Ubuntu CI gate, not the earlier Windows local full-battery run.

Commands on source commit `9bf4abb1a135b9f0429c0fda965c2e300f639b85`:

```sh
node node_modules/typescript/bin/tsc -p tsconfig.node.json
node --experimental-strip-types --no-warnings --import ./scripts/http-close-shim.mjs --test --test-concurrency=1 --test-timeout=240000 tests/arch/providers.test.ts tests/arch/model-access.test.ts tests/arch/model-router.test.ts tests/arch/chat-authority-security.test.ts tests/arch/provider-routes.test.ts tests/arch/doctor-truth.test.ts tests/arch/model-lifecycle-authority.test.ts tests/arch/route-drift.test.ts
node --experimental-strip-types --no-warnings --import ./scripts/http-close-shim.mjs --test --test-concurrency=1 --test-timeout=240000 tests/arch/provider-route-lifecycle.test.ts
node --experimental-strip-types --no-warnings --import ./scripts/http-close-shim.mjs --test --test-concurrency=1 --test-timeout=240000 tests/arch/model-lifecycle-authority.test.ts
# With AIDE_FULL_BATTERY unset:
bash pre-push
```

The new lifecycle test verifies successful one-shot and streaming calls, exact route identity in receipts, error redaction, provider stream-error cleanup, timeout cleanup, caller cancellation, durable Authority evidence, restart recovery, rejection before re-verification, and success after exact re-verification. No real provider request or real credential was used.

## Open gates and limits

- The earlier full architecture run on the dirty worktree was **807 total: 786 passed, 9 failed, 12 skipped**. Provider fixture and C1-02 drift issues were corrected, and model lifecycle now passes alone after RAM recovered; the full battery was not repeated. The remaining prior full-run failures were not all re-proven green in this checkpoint. Do not report the full architecture gate as green.
- The exact-SHA Ubuntu CI run subsequently passed TypeScript, browser TypeScript, and `npx eslint .`, as well as its bounded architecture suite. This does not erase the distinct earlier Windows local full-battery result; keep the two environments/results separate.
- This does not prove live provider/vendor execution. OpenCode `1.18.20` is installed, but the current OpenCode Go → DeepSeek V4.1 Flash task was not run. The inspected repository evidence contains no current spend limit or owner-supplied credential path. A credential-presence record from 2026-09-22 is historical and was not used. No credential contents were read or recorded.
- Source review found the current OpenCode bridge remains a separate plan/act BYOK route: it waits for a complete JSON response from `POST /session/:id/message`, accepts no caller `AbortSignal`, and deletes the OpenCode session only after a successful nonempty response. The ModelRouter Model Manager path currently accepts only `direct-http` routes. Therefore the required exact Model Manager → Authority → streamed OpenCode execution and failure/cancel cleanup are not yet wired or proven. Current upstream docs expose an SSE `/event` endpoint, asynchronous prompt, and session abort; verify the pinned local OpenCode `1.18.20` `/doc` contract before implementing against those endpoints: [OpenCode server API](https://dev.opencode.ai/docs/server/).
- P2 remains open pending that adapter integration, live OpenCode/model execution, Mission Receipt evidence on the candidate SHA, and remaining release gates. A current owner-supplied managed-auth path and existing spend cap are required before a live provider task; the request for those values is pending. No credential contents were read or recorded.
- Capability expansion remains deferred until the release spine reaches its dependency point.

## Next

Continue Model Access/OpenCode in dependency order: verify the pinned OpenCode server contract, wire exact Model Manager route identity through Authority to real stream/cancel/error cleanup, then run the bounded live task after the owner provides the managed-auth path and spend cap. Reconcile the capability package only after the active release blockers close.
