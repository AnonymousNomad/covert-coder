# Resident Binding CI Failure and Generated Contract Repair — 2026-10-09

## Preserved exact-SHA failure

- Branch: `feat/model-intelligence-mi1b-reliability-20261005`
- Failed commit: `aff22d97d8aa8cfb3c253ec422b548d0f95acc1f`
- AIDE CI: [run 37967329298](https://github.com/AnonymousNomad/covert-coder/actions/runs/37967329298), completed `FAILURE` on that exact SHA.
- Architecture artifact: `arch-test-log`, artifact ID `11634148468`, SHA-256 `09955eb50b1386e317eb2d9a64fa1718a048d3429e39c5cc67065d85aefa8d65`.

The full architecture run reported **986 tests: 968 passed, 2 failed, 16 skipped, 0 cancelled**. The two failures were:

1. `tests/arch/openapi-drift.test.ts`: committed `common/openapi.json` was stale.
2. `tests/arch/route-drift.test.ts`: route ownership could not be reproduced because the same OpenAPI contract was stale.

The Veritas `compile` gate then failed on the route-drift assertion. Path boundary, secret scan, manifest validation, tests, and git-diff gates passed. CI install, frontend, backend/integration, provider/Resident browser regressions, type/lint, generated-file/worktree checks, and cleanup passed. The exact run remains red in Actions history.

## Root cause and bounded repair

The Resident Binding contract changed `degraded_reason` from a free-form bounded string to the canonical `ResidentDegradedReason` enum. The TypeScript contract and route were updated, but the generated `common/openapi.json` was not regenerated before the first checkpoint push.

Ran the repository generator `npm run contracts` with `TEMP` and `TMP` routed to `C:\Users\Grey_\AppData\Local\Temp`. It changed only `common/openapi.json` (10 insertions, 2 deletions), replacing the stale string bounds with the eight stable degraded-reason values. No route source or test assertion was changed to suppress the failure.

## Local regression proof after repair

Command:

```powershell
$env:TEMP='C:\Users\Grey_\AppData\Local\Temp'; $env:TMP='C:\Users\Grey_\AppData\Local\Temp'; node --test tests/arch/openapi-drift.test.ts tests/arch/route-drift.test.ts
```

Result: **7 passed / 0 failed / 0 skipped / 0 cancelled**. This includes both previously failing tests, C1-02 reproducibility, and representative facade probes. `git diff --check` passed. At the time of this focused pass, it did not erase the failed exact-SHA CI run or establish CI status for the forthcoming repair commit.

## Repair checkpoint result

- Generated-contract repair commit: `749423ed792cb4132d54282cc4fa189849ae5c63`.
- Local pre-push hook: **passed**.
- Exact-SHA AIDE CI: [run 37968933987](https://github.com/AnonymousNomad/covert-coder/actions/runs/37968933987), **SUCCESS** on the repair commit. Architecture and Veritas gates passed.
- The earlier failed run `37967329298` remains visible and is not deleted or reclassified.

No local-model Admission or runtime start was performed; the artifact-copy capacity gate remains closed.
