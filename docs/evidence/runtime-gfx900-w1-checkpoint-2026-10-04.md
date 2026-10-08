# W1 Runtime Compatibility Checkpoint — 2026-10-04

## Checkpoint identity

- Recorded: 2026-10-04 06:54 UTC / 01:54 CDT.
- Worktree: `E:\covert-gfx900-compat`.
- Branch: `feat/runtime-gfx900-compat`.
- Tested source base: `afe6f1f4d8f2a20be1317f79926d6ac8f8a14396`.
- Candidate base: `7391b98e1e0972dd3fe4365420fe15366b77b24c`.
- Upstream before checkpoint: `origin/feat/runtime-gfx900-compat` at `afe6f1f4d8f2a20be1317f79926d6ac8f8a14396`.
- PR: [#41](https://github.com/AnonymousNomad/covert-coder/pull/41), OPEN, DRAFT, base `nightshift/production-convergence-20260926`.
- Canonical convergence worktree was not modified. PR #31 remains frozen.

The source and test changes listed below were present during the recorded checks. The exact checkpoint commit and its CI are determined by the Git commit containing this record; they were pending when this note was written.

## Objective and source changes

Wire explicit llama.cpp selection through the canonical `RuntimeBroker` and `BrokerModelRuntime` composition, retain Unsloth as the default and only qualified local profile, and report AMD/NVIDIA device facts without inferring an unproven inference backend.

The W1 source/test diff covers:

- canonical broker composition, explicit backend selection, compatibility load/status, and no silent fallback;
- retained child ownership, readiness checks, bounded stop/cleanup, restart, cancellation, and artifact hash identity checks before and after startup;
- accelerator selection observation for CPU, Vulkan, ROCm, and UNKNOWN while keeping llama.cpp unqualified;
- AMD SMI and Windows PNP device identity with VRAM/driver/architecture left null when not proven;
- null-safe cockpit/orchestrator telemetry, including measured zero VRAM;
- shared runtime/hardware contracts and generated `common/openapi.json`;
- regressions for explicit external binary selection, selection failures, identity/ownership, artifact mutation, cleanup/restart/cancellation, and AMD/UNKNOWN hardware values.

The unrelated pre-existing edit in `docs/evidence/desktop-battery.md` was classified as owner battery evidence and excluded from W1 staging.

## Verification

| Gate | Result |
|---|---|
| Focused runtime broker suite | 30/30 pass, 0 fail, 0 skip |
| Focused hardware + orchestrator telemetry suites | 6/6 pass, 0 fail, 0 skip |
| `npm run check` | exit 0; 997 architecture tests, 986 pass, 0 fail, 11 skipped |
| TypeScript | Node and browser projects passed through `npm run check` |
| ESLint | 0 errors; repository-wide pre-existing warnings remain |
| `npm run veritas` | exit 0; all 6 checks true, score 1.0 / threshold 0.9; no failed checks or oaths |
| Veritas compile / test sub-gates | both passed (exit 0) |
| `git diff --check` | passed |
| Contracts/OpenAPI drift | canonical contract generation ran; architecture OpenAPI and route-drift checks passed |

The 11 architecture skips remain skips, including absent bundled GGUF fixtures and existing migration-waived cases. They are not counted as passes.

## Host and runtime evidence

- Live hardware probe: NVIDIA GeForce GTX 1060, driver `582.28`, reported VRAM 6 GiB, free VRAM about 4.60 GiB. No AMD device was present or probed on this host.
- Post-verification host sample: free physical RAM about 1.86 GiB; free commit about 3.02 GiB; commit limit about 31.71 GiB.
- The local start floors remain 6.5 GiB physical RAM and 5.0 GiB free commit. Both were below floor, so no local model/runtime start was attempted.
- No `llama`, `llama-server`, Unsloth, or Python model-runtime process was observed after the gates. Pre-existing Node/MCP and OpenCode processes were left untouched.
- No real gfx900/ROCm execution occurred. `gfx900 = UNQUALIFIED`; compatibility code/test status does not qualify the hardware path.

## Preserved red and limitations

An earlier Windows ownership/port-observation test run under concurrent TypeScript/architecture load returned `UNKNOWN` where the fixture expected `FOREIGN`. Subsequent isolated PowerShell probes, the focused runtime suite, and the full serial architecture runs passed. The precise Windows timing/observation trigger is **not proven**; the first red remains preserved and open, not erased by reruns.

The pre-checkpoint PR head `afe6f1f4d8f2a20be1317f79926d6ac8f8a14396` had successful AIDE CI runs `37174581032` and `37174603379`. These are parent-SHA evidence only. Exact-SHA CI for the W1 checkpoint commit was pending at record time.

## Next action

Review and commit only the W1 source, generated contract, tests, and this checkpoint record; keep the desktop-battery edit unstaged. Push `feat/runtime-gfx900-compat`, wait for successful exact-SHA AIDE CI, recheck Issue #38 and PR #41, and keep PR #41 DRAFT / NOT MERGE-READY. No hardware qualification claim is permitted without same-host gfx900 execution.
