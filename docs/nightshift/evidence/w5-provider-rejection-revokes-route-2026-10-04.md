# W5 provider credential rejection revokes route readiness

Date: 2026-10-04
Worktree: `E:\covert-nightshift-integration`
Branch: `nightshift/production-convergence-20260926`
Base checkpoint: `65f4696e8644f404135f980e5a815f8c1301d582`
Status: **LOCAL VERIFICATION, VERITAS, AND EXACT-SHA GITHUB CI PASS**

## Failure and cause

A new test connected the OpenAI fixture successfully, confirmed exact-model support, then returned HTTP 401 to a later one-shot request. The first run failed because `ProviderService.list()` still reported `connected` where the regression required `invalid_key`. The cached verification result therefore continued to support a Model Access route after a provider rejected its stored credential.

The same stale verification applied to streaming requests. Before repair, `modelSupportState()` continued returning `verified` until the probe cache's 60-second expiry, leaving Model Manager free to project a route as eligible during that interval.

## Repair

- The canonical `ProviderService` now changes its existing in-memory provider probe result to `invalid_key` after an execution request receives HTTP 401 or 403, for both one-shot chat and streaming.
- The existing projection then reports provider health as `UNHEALTHY`, exact-model support as `UNKNOWN`, and route availability as `false`. No second state store or route was added.
- A governed lifecycle regression proves the rejected task has a failed receipt, Model Manager immediately removes the route, and the next Authority prepare is denied before another provider request.
- No credential value or digest is logged, returned, or persisted by this change. No credential was inspected and no live provider request or spend occurred.

## Preserved failures

- Test-first provider regression, before the service repair: `tests/arch/providers.test.ts` reported **19 passed, 1 failed**. The assertion expected `invalid_key`; observed `connected`.
- During production-route test expansion, a first test attempt used the owner handle for a stack that had already been closed for restart. It failed with `ECONNREFUSED 127.0.0.1:61117`. This was isolated to the new fixture's stale owner handle; the test was corrected to use the paired owner from the restarted stack. It was not a product/runtime failure.
- A TypeScript check exposed an inference error in the new regression assertion; the test expression was simplified, and the final node typecheck passed.

## Verification

- Focused suite: provider service, provider routes, BYOK routes, Model Access, and production provider/OpenCode lifecycle — **46 passed, 0 failed, 0 skipped**.
- Production provider route lifecycle — **3 passed, 0 failed, 0 skipped**, including immediate post-401 Model Manager and Authority behavior.
- `npx tsc -p tsconfig.node.json --noEmit` — **exit 0**.
- Focused ESLint on the changed TypeScript source and test files — **exit 0**.
- `npm run veritas -- --json` — **passed / verified**; path-boundary, secret-scan, manifest-validation, compile, tests, and git-diff all true; score **1.0**, threshold **0.9**.
- Veritas compile check ran `npm run check`: architecture battery **985 total, 974 passed, 0 failed, 11 skipped**; TypeScript and ESLint completed successfully.
- Veritas tests check ran the repository `npm test` chain — **exit 0**. The command's emitted desktop evidence recorded a new `DC-a battery` **9/9** row in `docs/evidence/desktop-battery.md`; that generated evidence is preserved.
- Full Veritas output log: `E:\pip_temp\covert-w5-provider-revocation-veritas-20261004.log`, SHA-256 `c471e1c3c643f0983d9a9be3efe153a2ebcac0118137633422fe8312f03ae844`.
- Canonical full pre-push — **PASS**; architecture suite **985 total, 974 passed, 0 failed, 11 skipped**; push succeeded.
- Exact-SHA GitHub AIDE CI [37194469318](https://github.com/AnonymousNomad/covert-coder/actions/runs/37194469318) — **SUCCESS** on source SHA `0eaa7510ad76c21b3f539ee74c82b8b79d7b109f`; backend/integration, browser regressions, type/lint, architecture tests, Veritas gates/report, generated-file/worktree checks, and required gate summary completed successfully (11m 05s).

## Evidence limits and next action

All W5 provider behavior in this checkpoint is fixture-backed. It does not prove authenticated live provider execution, quota behavior at a vendor, subscription-backed Codex execution, clean-user packaging, or release acceptance. Local-model floors and runtime qualification remain unchanged. Live external execution remains **UNKNOWN** until the owner-managed auth path and spend ceiling are supplied and safely verified.

Next: continue to the next dependency-ordered provider-path defect after this exact-SHA checkpoint. Inspect Issue #38 before starting that bounded slice.
