# Windows cumulative stability — 2026-10-01

## Result

The canonical Windows `npm run check` completed successfully at source SHA `c5f6a4aaf6a5c562d6b35cabe89a1a8fa54f4af4` on `nightshift/production-convergence-20260926`. This is cumulative architecture-suite evidence, not installer, clean-user, model-role, or full release acceptance.

- Command: PowerShell process environment `AIDE_FIXTURE_TIMEOUT_MS=15000`, followed by `npm run check`.
- Exit: `0`.
- The command ran JavaScript syntax checks, Node and browser TypeScript checks, ESLint, and the serialized Windows architecture suite.
- Architecture TAP: 850 total; 839 passed; 0 failed; 11 skipped; 0 cancelled; 0 todo. Test duration: `699009.9661 ms`.
- ESLint: 0 errors and 62 warnings.
- The 15-second value is a local fixture observation setting. No product timeout, test assertion, or admission threshold changed. All skips remain visible in the total; the known missing checked-in GGUF fixture remains skipped.
- No source edits occurred during the run.

Exact-SHA GitHub AIDE CI run [36801593835](https://github.com/AnonymousNomad/covert-coder/actions/runs/36801593835) also completed successfully on this SHA. All 22 workflow steps passed, including frontend build, backend/integration tests, type/lint, bounded architecture, Veritas, generated-file/worktree checks, and CI fixture cleanup.

## Windows resource and process observations

The check began around `2026-10-01T01:49:07Z`. A post-suite sample at `2026-10-01T02:04:52.078Z` recorded 7,749.6 MiB free physical memory, a 26,915.2 MiB commit limit, 10,656 MiB free commit, and 16,259.2 MiB used commit. A follow-up at `2026-10-01T02:13:11.122Z` recorded:

- Free physical memory: 7,393.7 MiB (737.7 MiB above the fixed 6,656 MiB local-start floor).
- Commit limit: 26,915.2 MiB; free commit: 10,527.7 MiB; used commit: 16,387.5 MiB (5,407.7 MiB above the fixed 5,120 MiB floor).
- `C:\pagefile.sys`: 7,664 MiB allocated, 5,638 MiB current usage, 6,177 MiB peak. `E:\pagefile.sys`: 2,944 MiB allocated, 2,289 MiB current usage, 2,759 MiB peak. Both pagefile settings report Windows-managed sizing (`InitialSize=0`, `MaximumSize=0`). No pagefile change was made.
- Free disk: C: 2.40 GiB; E: 132.26 GiB.
- No Covert-associated Node process and no listener on the checked application/model/debug ports (4777, 5120, 8123, 8104, 3000, 5173, 9229). The post-suite census observed 51 total Windows listeners; none was attributed to Covert. WSL reported no running distributions.
- Existing Edge/WebView, Codex and MCP processes were left untouched. No unrelated process was stopped.

These host measurements are observations, not a canonical Resource Admission decision. They do not authorize or prove a model start.

## Temporary fixture census

A bounded top-level census found 67 directories under `E:\pip_temp` with modification times inside the suite window. Most names and direct entries match architecture-test fixture conventions. The populated `E:\pip_temp\opencode` root had 637 direct entries and 1.48 MiB of direct regular-file data; this shared fixture path was preserved because its contents extend beyond the single test run. No directory was recursively swept or deleted.

The repository's `scripts/ci-cleanup.mjs` intentionally exits outside CI; with CI enabled it also deletes generated frontend/Veritas output and every `aide-*` directory under the process temp root. That broad CI cleanup was not run against this shared local temp root. Therefore:

- Test execution: **PASS**.
- Covert process/listener cleanup: **PASS**.
- Local temp-fixture deletion: **PARTIAL / not performed**. No active Covert process or checked listener remained. A comparable numeric pre-run memory/commit sample was not retained, so this evidence makes no before/after leak attribution. The per-run fixture directories remain available for future narrowly owned cleanup.

## Scope and next gate

The cumulative architecture discrepancy is now green on this exact Windows source SHA, and its exact-SHA CI is green. Live OpenCode Go / DeepSeek qualification remains blocked on an owner-managed auth path and spend ceiling. Continue with the dependency-ordered packaging candidate and clean-room gate; retain the temp-fixture cleanup limitation and all 11 skips in the release evidence matrix. PR #31 remains open and frozen.
