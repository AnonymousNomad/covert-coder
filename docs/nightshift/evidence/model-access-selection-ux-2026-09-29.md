# Model Access selection UX and route-readiness evidence — 2026-09-30

## Canonical source state

- Worktree: `E:\covert-nightshift-integration`
- Branch: `nightshift/production-convergence-20260926`
- HEAD during this capture: `d8cbc9331a46212557d16a6e7b98726cdbc24abf` (the already-pushed documentation-pack checkpoint).
- The existing local Model Access edits remain uncommitted WIP based on source parent `420171c1df181ce0e2d9261cd311426eacdb2eef`. No reset, clone, or reconstruction was performed.
- The documentation checkpoint's exact-SHA AIDE CI run `36649886925` succeeded. That run did not contain the current dirty Model Access or route-readiness source changes.

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
| Full local `npm run check` after both repairs (`AIDE_FIXTURE_TIMEOUT_MS=15000`) | **Exit 0.** Node and browser TypeScript checks and repository ESLint passed; architecture battery: **838 tests, 827 passed, 0 failed, 11 skipped**. ESLint reported 0 errors and 62 warnings. |
| Exact-SHA GitHub CI for current HEAD `d8cbc933...` | **Success**, run `36649886925`; documentation-only checkpoint, so it is not evidence for the current dirty source. |

## Evidence limits and next dependency

- No real OpenCode account/provider egress, exact-model inference, Covert dogfood mission, or successful live worker path is proven here.
- No local GGUF inventory/hash, hardware qualification, runtime start, inference, or model qualification artifact was produced by this work.
- At evidence capture, this source slice and evidence file were local WIP. They are being included in the next coherent convergence checkpoint; its exact-SHA CI and post-push Issue #38 review must be recorded separately from the documentation-only CI listed above.
- Next: review and push this verified Model Access plus route-readiness checkpoint, then continue to the next dependency-ordered production-closure gate.
