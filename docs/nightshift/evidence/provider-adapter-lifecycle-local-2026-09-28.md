# P2 Provider Adapter Lifecycle — local checkpoint

**State:** `INTEGRATION_VERIFIED` for the deterministic local fixture path. This is not live-provider, runtime, release-candidate, or release-accepted evidence.

## Identity

- Repository: `E:\covert-nightshift-integration`
- Branch: `nightshift/production-convergence-20260926`
- Tested source commit: `9bf4abb1a135b9f0429c0fda965c2e300f639b85`
- Parent: `fbd2784f9f82f68486615a5006a459c1962f2fb2`
- Environment: Windows, Node `v26.4.0`; free physical memory was 3.12 GB before the focused regression run.
- GitHub push and exact-SHA CI: pending.

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
- ESLint for the new lifecycle file is unverified. The earlier full ESLint result preceded that file; a targeted invocation later spun without output and was stopped under the project failure procedure.
- This does not prove live provider/vendor execution. OpenCode `1.18.20` is installed, but the current OpenCode Go → DeepSeek V4.1 Flash task was not run. The inspected repository evidence contains no current spend limit or owner-supplied credential path. A credential-presence record from 2026-09-22 is historical and was not used. No credential contents were read or recorded.
- P2 remains open pending live OpenCode/model execution, Mission Receipt and Veritas evidence on the candidate SHA, broader release gates, and exact-SHA GitHub CI.
- Capability expansion remains deferred until the release spine reaches its dependency point.

## Next

Push this focused checkpoint and inspect CI on the exact source SHA. Continue Model Access/OpenCode in dependency order; obtain the owner-approved credential path and existing spend limit before any real external model task. Reconcile the capability package only after the active release blockers close.
