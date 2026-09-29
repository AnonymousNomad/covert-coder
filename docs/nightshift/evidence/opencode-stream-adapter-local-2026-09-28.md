# OpenCode stream adapter — local checkpoint

**State:** deterministic adapter fixture verified; live OpenCode Go execution blocked. This checkpoint does not establish an eligible Model Manager route or release acceptance.

## Identity

- Repository: `E:\covert-nightshift-integration`
- Branch: `nightshift/production-convergence-20260926`
- Source checkpoint: `ca37d660da26a59662db3de9f07e2637ce44b132`
- Environment: Windows PowerShell, Node `v26.4.0`
- Exact-SHA GitHub AIDE CI: run `36516364036`, completed successfully on `ca37d660da26a59662db3de9f07e2637ce44b132`: [run details](https://github.com/AnonymousNomad/covert-coder/actions/runs/36516364036).

## Bounded change

- Replaced the OpenCode bridge's blocking message request with the pinned server API flow: exact connected-provider/catalog preflight, session creation, `/event` SSE, `prompt_async`, authoritative final-message readback, and session deletion.
- The adapter forwards only text deltas correlated to the current session's assistant text parts. It supports the pinned direct event envelope and the wrapped envelope used by the fixture.
- Agent cancellation reaches the adapter. Cancellation, provider error, bad final identity, empty result, stream failure, timeout, and cleanup failure do not become successful results. A success requires a confirmed 2xx session deletion; failed cleanup is retried after abort and is reported as `CLEANUP_FAILED` if still unconfirmed.
- OpenCode Go tasks require an explicit provider/model pair, and the pinned provider catalog must report that provider connected and the exact model present before session creation.

## Verification

- `node --test tests/arch/opencode-bridge.test.ts` — **7 passed, 0 failed, 0 skipped**. Fixtures cover exact identity, wrapped SSE deltas, cancellation/abort/delete, sanitized provider errors, identity mismatch, missing-model fail-closed before session creation, exact-target legacy entrypoint, and failed cleanup.
- `node --test --test-concurrency=1 tests/arch/agent-routes.test.ts` on the pushed SHA — **8 passed, 0 failed, 0 skipped**, including Agent cancellation and provider denial before egress without consent.
- `node node_modules/typescript/bin/tsc -p tsconfig.node.json` — pass.
- Focused ESLint on `node/src/openapi.ts`, `node/src/services/opencode-bridge.ts`, and `tests/arch/opencode-bridge.test.ts` — pass individually. A combined/project-wide local ESLint invocation had previously spun; exact-SHA GitHub CI is the authoritative project-wide check.
- `git diff --check` and the repository lightweight pre-push gate — pass. `AIDE_FULL_BATTERY` was unset.
- No real provider request or credential contents were used.
- Exact-SHA GitHub CI on Ubuntu, Node `26.4.0`, Python `3.12.14`: all 18 workflow steps passed; `scripts/ci-run-all.mjs` reported **53/53** commands; bounded architecture reported **816 total / 800 passed / 0 failed / 16 skipped**; frontend build, backend/integration, TypeScript, ESLint, six Veritas checks, generated-file/worktree, and fixture-cleanup gates all passed. The run completed at `2026-09-29T03:26:27Z`.

## Pinned-runtime observation and blockers

- Installed OpenCode CLI is `1.18.20`. In a temporary isolated profile with no credential state, local `GET /provider` returned HTTP 200 and the bundled `opencode-go` catalog contained 26 models, including `deepseek-v4-flash` and `deepseek-v4-pro`, but **not** `deepseek-v4.1-flash`. The connected list contained only `opencode`; the exact OpenCode Go route was therefore not connected in this isolated probe. The server was stopped and the temporary profile removed.
- The current OpenCode Go documentation lists `opencode-go/deepseek-v4.1-flash`, so the requested model identity is clear, but the installed CLI catalog does not expose it: [OpenCode Go documentation](https://dev.opencode.ai/docs/go/).
- Pinned `/doc` confirms the required `/event`, `/prompt_async`, `/abort`, and session message paths; the pinned `/event` endpoint returned HTTP 200 and `server.connected`. No real provider delta or completion was observed.
- `node/src/openapi.ts` still enters OpenCode from the existing Agent BYOK route. `ModelRouter` and Model Manager still do not resolve an exact OpenCode adapter route. This checkpoint does **not** claim the Sol-required exact Model Manager route → Authority/Admission → OpenCode acceptance path.
- A managed-auth path and owner spend cap remain pending. Do not inspect auth contents or attempt live execution until those are supplied and the pinned model catalog can resolve the exact target.
- Prior Windows full architecture result remains **807 total / 786 passed / 9 failed / 12 skipped**. The separate Ubuntu bounded CI result remains distinct; neither is overwritten by these focused tests.

## Next

Reconcile the exact OpenCode route through Model Access and Authority without treating connection state or catalog presence as `model_support_state=VERIFIED`. Resolve the installed CLI/model-catalog mismatch, then prove the authorized live coding task, receipt, recovery, and release gates when the required owner-managed auth path and spend cap are available.
