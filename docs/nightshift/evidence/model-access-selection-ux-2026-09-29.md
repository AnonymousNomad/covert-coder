# Model Access selection UX and route-readiness evidence — 2026-09-30

## Canonical source state

- Worktree: `E:\covert-nightshift-integration`
- Branch: `nightshift/production-convergence-20260926`
- The source WIP was committed as `0e8ce5eeb7b5cbedd0339b7c4dd9b1baac700d18` (`fix: preserve exact model selections and runtime readiness`), pushed to the authorized convergence branch, and matched origin with a clean worktree.
- The earlier documentation-pack checkpoint was `d8cbc9331a46212557d16a6e7b98726cdbc24abf`; the preserved Model Access source work had been based on `420171c1df181ce0e2d9261cd311426eacdb2eef`. No reset, clone, or reconstruction was performed.
- The earlier documentation-only checkpoint `d8cbc9331a46212557d16a6e7b98726cdbc24abf` passed AIDE CI run `36649886925`; it did not contain the source repairs recorded here.

## Completed bounded work

- Settings describes plan/act/utility selections as persistent project role defaults. Chat identifies its model as a conversation-level choice and states that it does not change project defaults.
- Role selectors expose discovered `opencode-go/...` model references beneath the single `opencode-managed` connection. A saved target missing from the current catalog remains visible and preserved; ambiguous provider/model identity is disabled.
- Connections presents exact-model verification controls gated by the connected source, exact project role selection, consent, and routing preference. Unsupported references cannot be retried through this control.
- Consent, provider, role-routing, and connection-preference changes refresh the Connections controls and notify Resident Chat to refresh routes. Chat retains its conversation binding during refresh, persists a changed binding, and disables model switching during an active stream.
- `ModelRouter.routes()` now honors the canonical runtime's per-model `pending` status. It marks such routes down, and role selection skips endpoint probes for known-pending artifacts instead of serially spending up to three seconds on each manifest-declared candidate.
- Existing exact-route and no-silent-fallback behavior remains covered by the model-router tests. No live provider transaction or local model qualification is claimed.

## Verification

| Check | Result |
|---|---|
| `node --import ./scripts/http-close-shim.mjs --test --test-concurrency=1 --test-timeout=240000 tests/arch/model-router.test.ts` | **27/27 passed** after the route-readiness repair. |
| `AIDE_FIXTURE_TIMEOUT_MS=15000 node --import ./scripts/http-close-shim.mjs --test --test-concurrency=1 --test-timeout=240000 tests/arch/handoff-routes.test.ts` | **7/7 passed** after the repair. The secret-transcript case completed in 4.18 seconds. Its plan-mode Agent session used an unavailable route; no model was started or invoked. |
| `node --test tests/arch/model-selection-ui.test.ts` | **5/5 passed**. |
| `node scripts/cockpit-acceptance.mjs` | Passed in Microsoft Edge with synthetic API fixtures. Checked Model Access scope and Go model choices, consent-gated verification, serialized conversation saves, exact selection through catalog drift/reload, truth surfaces, and no browser errors. |
| First full local `npm run check` attempt | **Failed before the repair** when the handoff test's fixed 15-second `/api/agent/start` deadline expired. Root cause: role selection probed six manifest-declared chat models serially even though the canonical runtime reported them as pending. The teardown log's later `operation revoked` was a consequence of closing the server after the aborted request. |
| `node scripts/build-c1-02-route-ownership-decisions.mjs --check` plus focused C1-02 reproducibility test | Passed after regenerating `docs/v1/routes/C1-02-ROUTE-OWNERSHIP-DECISIONS.json`; the only generated changes are updated test-source line references for the H3 fixture cleanup. |
| Earlier full-check failures | The first run exposed the 15-second Handoff route-selection timeout described above. After that root cause was repaired, a later full run found stale C1-02 generated line references after H3 fixture cleanup; the architecture result was **826 total, 1 failed, 11 skipped**. The canonical generator refreshed those references, and the focused reproducibility check passed before the final full run. |
| Full local `npm run check` after both repairs (`AIDE_FIXTURE_TIMEOUT_MS=15000`) | **Exit 0.** Node and browser TypeScript checks and repository ESLint passed; architecture battery: **838 tests, 827 passed, 0 failed, 11 skipped**. ESLint reported 0 errors and 62 warnings. |
| Exact-SHA AIDE CI for source checkpoint `0e8ce5eeb7b5cbedd0339b7c4dd9b1baac700d18` | **Success**, run `36655270753`; build, integration, type/lint, architecture, Veritas, generated-file/worktree, cleanup, and required-summary steps passed. |

## Evidence limits and next dependency

- No real OpenCode account/provider egress, exact-model inference, Covert dogfood mission, or successful live worker path is proven here.
- The Model Access source checkpoint did not produce a local GGUF inventory/hash, hardware qualification, runtime start, inference, or model qualification artifact. A later bounded host inventory is being recorded separately and must not be read as model qualification.
- The source-level exact-selection and route-readiness slice is now pushed and exact-SHA CI-green. Synthetic Edge acceptance and deterministic fixtures do not prove live OpenCode/provider execution, local inference, package acceptance, or release readiness.
- At the latest read-only host sample on 2026-09-30, free physical memory was `6,079,884 KiB` (about `5.80 GiB`), below the `6.5 GiB` local runtime start floor. No process matched the bounded local-runtime process-name query. Free commit was not measured in this sample. No model runtime or provider egress was started.
- Issue #38 was checked after the source push and again after its CI result. The latest owner runtime directive remains: preserve exact model identity, require Authority/Admission, prove cleanup/receipts, and do not start local qualification below the documented resource floor. No newer Sol correction was found.
- Next: continue the provider/model lifecycle in dependency order. Live provider execution remains `UNKNOWN` until the owner-managed auth path and spend ceiling in the P2 evidence are available. Local GGUF hashing/metadata inventory is a separate read-only snapshot and does not qualify or enable those models.
