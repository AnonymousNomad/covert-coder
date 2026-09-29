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

The exact OpenCode Go / DeepSeek V4.1 Flash live route remains `UNKNOWN`: the pinned OpenCode 1.18.20 catalog does not list the requested model, and the owner-supplied managed-auth path and spend cap required for a live task are not available in current project evidence. No vendor request, provider credential read, or live task was performed. Do not infer model support from the adapter tests.

## Next dependency-ordered action

Continue P2 Model Access / Provider Adapter Lifecycle: first obtain repository-verifiable exact model eligibility and safe owner-managed live execution prerequisites; then prove the complete Authority/Admission → provider adapter → response → cancellation/error cleanup → receipt path and restart/re-verification for the same identity. Preserve `UNKNOWN` until those gates are observed. Capability package implementation remains downstream of these release-spine gates.
