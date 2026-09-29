# Authority-bound stream finalization — 2026-09-29

## Failure and diagnosis

- **Branch / base SHA:** `nightshift/production-convergence-20260926` / `019bb638950f77f98dc03d2df7cff00db76373f2`.
- **Exact-SHA CI failure:** AIDE CI [36581337408](https://github.com/AnonymousNomad/covert-coder/actions/runs/36581337408) passed install, frontend build, backend/integration, type/lint, bounded architecture, worktree, and cleanup gates. Veritas compile failed at `tests/arch/provider-route-lifecycle.test.ts:635`, where an immediate audit read could not find the cleanup-failure Authority event.
- **Root cause:** `routeForChatStream` wrote the success `done` frame and ended the response from inside the Authority executor. On failure it likewise ended the response before the executor returned. `ExecutionAuthority.execute` persists the terminal Authority event only after the stream callback resolves or rejects. The client could therefore observe response completion before the durable outcome was written.

## Correction

- The chat stream now returns its schema-validated terminal success payload to the server after streaming deltas. The server validates that payload inside the Authority executor, waits for Authority's durable terminal outcome, and only then writes the final success frame and closes the response.
- Error frames can still be written while handling a failure, but the server closes the response only after the Authority failure path has completed its persistence attempt. A disconnected response is not ended again.
- The provider lifecycle regression now checks that the successful terminal frame and cleanup-failure response are followed by their matching durable Authority rows immediately, before querying the in-memory operation projection. Assertions and gate requirements are unchanged.

## Local verification

- **Focused provider lifecycle suite:** `node --experimental-strip-types --no-warnings --import ./scripts/http-close-shim.mjs --test --test-concurrency=1 --test-timeout=240000 tests/arch/provider-route-lifecycle.test.ts` — **2/2 passed**, including success and OpenCode cleanup-failure durability checks. Windows temp paths were directed to `C:\aide-tmp`; the initial run using `E:\pip_temp` encountered a separate `EBUSY` during temporary-workspace removal.
- `npx tsc -p tsconfig.node.json --noEmit` — exit 0.
- `npx eslint node/src/server.ts node/src/routes/chat.ts tests/arch/provider-route-lifecycle.test.ts` — exit 0.
- `git diff --check` — passed.
- **Repair SHA CI:** AIDE CI [36585898303](https://github.com/AnonymousNomad/covert-coder/actions/runs/36585898303) completed successfully on exact source SHA `a3a1c6417f57e2ed2623c7aa8a1abd0ec32d8fc7` in 10m34s. Frontend build, backend/integration, type/lint, bounded architecture, all Veritas gates, generated-file/worktree, fixture cleanup, and required summary passed.

## Evidence boundary and next action

These checks exercise the production route composition with deterministic provider/OpenCode fixtures. They do not prove live OpenCode Go / DeepSeek execution, credentials, spend behavior, or release acceptance. Live execution remains UNKNOWN pending the owner-managed auth path and spend ceiling. The bounded repair is pushed and exact-SHA CI is green; Issue #38 records the source checkpoint and CI result at https://github.com/AnonymousNomad/covert-coder/issues/38#issuecomment-5892968800. Continue the release spine. PR #31 remains frozen.
