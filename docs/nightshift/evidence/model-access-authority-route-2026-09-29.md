# Model Access Authority route checkpoint — 2026-09-29

## Identity

- Repository: `E:\covert-nightshift-integration`
- Branch: `nightshift/production-convergence-20260926`
- Source slice: `8b41d8c1913e50c2741bdae72f808a51b2d8c641` — `feat(model-access): route OpenCode Go through Authority`
- Checkpoint: `54b3e74d8708eb3821d1003fc572c8e7bbe70e1b` — `fix(git): isolate scratch repos in pre-push`
- Local and `origin` HEAD matched at `54b3e74`; worktree and index were clean after push.
- Scope: exact OpenCode model route eligibility and Authority-bound streamed dispatch, plus isolation of scratch Git repositories spawned by the full pre-push suite.

## Verification

- Full local pre-push architecture battery, run on Windows with `AIDE_FULL_BATTERY=1` and `AIDE_FIXTURE_TIMEOUT_MS=20000`: **823 tests; 812 passed, 0 failed, 11 skipped**. Runner duration: 912,381.8478 ms. Skips remain explicit, including missing bundled GGUF artifacts and existing migration waivers.
- Hook result: `pre-push: arch battery passed`; `pre-push: checks passed`.
- Push: `c1902b3581d0a388fa4f7ffa577b95c94e244c04` → `54b3e74d8708eb3821d1003fc572c8e7bbe70e1b` on the authorized convergence branch.
- Exact-SHA GitHub AIDE CI: run [36528510949](https://github.com/AnonymousNomad/covert-coder/actions/runs/36528510949), `54b3e74d8708eb3821d1003fc572c8e7bbe70e1b`, **success, 22/22 steps**.
- Issue #38 was checked after the push and after CI. Its latest owner directive was unchanged.
- `git diff --check`, post-run HEAD/remote parity, and clean status passed.

## Hook regression and repair

The prior full battery ran as a Git pre-push hook. Git exports repository-local variables to child processes; scratch-repository Git commands inherited that environment and changed the calling checkout's refs/index. Before this push, `pre-push` was changed to clear `git rev-parse --local-env-vars` after changing to the repository root. The corrected full battery completed with no branch/index movement, and the push invoked this checkout's versioned hook through its absolute path.

## Acceptance layer and limits

This checkpoint proves deterministic source and integration behavior under the local architecture suite and exact-SHA CI. It does **not** prove a live OpenCode Go request, live provider streaming, or release acceptance.

The exact OpenCode Go / DeepSeek V4.1 Flash live route remains `UNKNOWN`: the installed OpenCode 1.18.20 catalog does not list the requested model, and the owner-supplied managed-auth path and spend cap required for a live task are not available in current project evidence. No OpenCode Go inference request, provider credential read, or live task was performed. Do not infer live route support from adapter tests or an offline model catalog.

### Catalog revalidation — 2026-09-29

- The current [OpenCode Go documentation](https://dev.opencode.ai/docs/go/) lists the exact model ID `deepseek-v4.1-flash`, the `opencode-go/deepseek-v4.1-flash` config identity, and the `/zen/go/v1/chat/completions` endpoint. The upstream [model-ID correction](https://github.com/anomalyco/opencode/commit/b7ca4f9) changed the prior `deepseek-flash` alias to this exact ID.
- The installed default CLI is OpenCode `1.18.20`. The official OpenCode `v1.18.33` Windows x64 release asset (62,127,126 bytes) was verified against GitHub's published SHA-256 digest `cc827fda2e32502373c5de25a4b78471766b99881d12a441ae5b9fcff39c5780`.
- Isolation correction: the first CLI listing and bridge API probes redirected APPDATA/LOCALAPPDATA/XDG paths and used a reduced environment, but omitted OpenCode's `OPENCODE_TEST_HOME` override. Upstream [Global path source](https://github.com/anomalyco/opencode/blob/v1.18.33/packages/core/src/global.ts) shows that without the override, `os.homedir()` remains the home-config search root. The first bridge probe printed provider IDs, not token values; however, those probes cannot establish that home `.opencode` configuration was never consulted and are excluded as proof of profile isolation. No inference request was sent.
- Repeated the bridge catalog probes with a fresh workspace, `OPENCODE_TEST_HOME`, APPDATA/LOCALAPPDATA, and all XDG config/data/cache/state paths pointed into unique temporary directories; the child environment was reduced to required OS paths plus those temporary paths. With the bridge's normal executable resolver and PATH scoped to `v1.18.33`, `/global/health` and `/provider` both returned 200, the server reported `1.18.33`, and the OpenCode Go catalog had 42 entries including `deepseek-v4.1-flash`. Repeating against the installed `1.18.20` binary with the same isolation returned 200, 26 entries, and no exact model. The isolated reruns inspected only server version and provider model IDs; they did not inspect connection/auth fields or credential content, and they sent no inference request.
- This establishes that the newer CLI's local OpenCode Go catalog contains the exact model and the installed `1.18.20` catalog does not. It does not establish an authenticated/available connection, Authority/Admission for a live route, or successful provider execution. Live route support remains `UNKNOWN` until the runtime is reconciled, owner-managed auth path and spend cap are present, and the governed execution is observed end to end.

## Next dependency-ordered action

Continue P2 Model Access / Provider Adapter Lifecycle: run Covert's bridge in an explicitly scoped environment using a catalog-capable CLI, without changing the user's global install; then use the owner-managed auth path and spend cap to prove the complete Authority/Admission → provider adapter → response → cancellation/error cleanup → receipt path and restart/re-verification for the same identity. Preserve `UNKNOWN` until those gates are observed. Capability package implementation remains downstream of these release-spine gates.
