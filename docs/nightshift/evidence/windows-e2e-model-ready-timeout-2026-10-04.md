# Windows aggregate E2E model-ready timeout — 2026-10-04

Date: 2026-10-04
Worktree: `E:\covert-nightshift-integration`
Branch: `nightshift/production-convergence-20260926`
Last published parent SHA: `ca8527e565b62326fd940f574d9964413e3c6751`
Status: **BLOCKED — prior aggregate `/api/model/ready` red remains unexplained; latest aggregate attempt stopped earlier at Academy response validation**

## Preserved Veritas result

The captured `npm run veritas -- --json` invocation exited **1**. Full output:

- `E:\pip_temp\covert-w5-credential-replacement-veritas-20261004.log`
- SHA-256: `4F2F00195D70CA532DD66DE3CAEB093A8EA376370E5C86487D2FB506538CF8D7`

The `tests` check failed in the final canonical daemon E2E sequence:

- `/api/workspace/tree` returned HTTP 200 in **11,543 ms**.
- The next `/api/model/ready?id=qwen-coder-1.5b-q4` request returned HTTP **502** at **30,004 ms**; Node reported `DOMException [TimeoutError]`.
- No assertion, request deadline, runtime start, or resource floor was changed.

The `compile` check is also reported as failed, although its serialized `exit_code` is **0**. Its captured output is only the last 12,000 characters and stops during the architecture output before the final summary. The current Veritas command runner allows 900,000 ms and 512 KiB of child output but does not serialize the underlying `execFile` error or signal. Therefore the compile-check cause is **UNKNOWN**; it is not classified as a TypeScript/compiler defect from this output.

## Read-only runtime and host observations

The failed E2E stack had completed cleanup before these post-run observations. No Covert model or runtime was started.

At `2026-10-04T11:22:18Z`:

- Free physical RAM: **2.67 GiB / 15.92 GiB**.
- Free commit: **2.91 GiB**; commit limit: **31.71 GiB**.
- Pagefile usage: `C:\pagefile.sys` allocated 13,220 MiB, current 9,581 MiB, peak 9,598 MiB; `E:\pagefile.sys` allocated 2,944 MiB, current 2,568 MiB, peak 2,812 MiB.
- The host remained below the local-runtime admission floors of **6.5 GiB physical RAM** and **5.0 GiB free commit**. No model-start attempt was made.
- An `opencode.exe` process (PID 4844) used about **919 MiB**; its command line did not identify the canonical Covert worktree. It and unrelated/unknown-owner Node processes were left untouched.
- Of the sampled long-lived Node processes, six had Codex in their process ancestry and three had unresolved ancestry. All predated this day's E2E run, and none had the canonical Covert worktree in its command path. None was terminated.
- No `llama-server`, `unsloth`, Python model process, or Edge process was present in the filtered process sample. No listener was found on 18888 or the checked production-stack ports 4777–4779.
- No listening TCP socket was owned by any sampled Node or OpenCode PID.

Exact default Unsloth discovery probes, measured after the failed run:

- `where.exe unsloth`: **136 ms**, exit 1, not found.
- Adapter-equivalent `Get-NetTCPConnection` check on port **18888**: **1,329 ms**, `FREE`.

The E2E stack launch/cleanup was then exercised through `tests/helpers/supervised-stack.mjs` after the two-second Model Manager status-cache expiry:

- stack startup/pairing: **10,243 ms**;
- `GET /api/models/status`: **90 ms**, HTTP 200;
- `GET /api/model/ready`: **3,602 ms**, HTTP 200, `ready: false`, `status: not-ready`;
- supervised child/facade cleanup: **120 ms**, confirmed;
- `modelStarted: false`.

Probe log: `E:\pip_temp\covert-w5-model-ready-isolated-20261004.log`; SHA-256 `4D3BE95337BEC250EC4A8BE25C1FC61AEB41AEA8DFA1F3AFD029FAB461CB2BE8`.

## Classification and next proof

The isolated read completes under the same low-headroom host condition, which does **not** clear the aggregate E2E red. The post-run headroom deficit is measured, but it is not proven as the cause of the 30-second stall. The exact nested probe duration, event-loop delay, and resource sample at the failing request remain unavailable. No stale E2E stack child or checked-port listener remained after cleanup.

## Later instrumented full-suite attempt

After the PID-reuse cleanup repair described in [the Windows process ancestry evidence](windows-test-process-pid-reuse-2026-10-04.md), the full repository `npm test` progressed past canonical launch but stopped at `scripts/acceptance-real.mjs` before the final E2E script:

- `POST /api/academy/check` returned HTTP **500** after **108 ms** with `response violates the contract`.
- Full output: `E:\pip_temp\covert-w5-npm-test-instrumented-after-pid-fix-20261004.log`; SHA-256 `0D5F1D6D75F6B9E6CD51AACF5549897AFC32E14B2F6FF338F23936874FA87B0F`.
- Diagnostic trace: `E:\pip_temp\covert-w5-npm-test-instrumented-after-pid-fix-20261004.jsonl`; SHA-256 `B1EEAF96EA14518D711AEA9E6679EECEAC092BC359F7AA0E84D5BDB90752CB99`.
- The run produced runtime-probe timings from earlier supervised stacks, but it recorded **no `/api/model/ready` request**. It therefore provides no nested timing evidence for the original model-ready failure.
- A focused `node scripts/acceptance-real.mjs` rerun passed Academy check (HTTP 200, **333 ms**) and the remaining acceptance steps. Output: `E:\pip_temp\covert-acceptance-real-academy-repro-20261004.log`; SHA-256 `29D136E40DDE61655AC00769A811EA33032CB06C7D05A416484D7BFB3C011FC8`.
- The 500's validation issue detail was not retained because the acceptance script removed its temporary workspace in `finally`. The focused success does not erase the full-suite red; its cause remains **UNKNOWN**.

Next: preserve the ArchServer validation issue before the acceptance fixture removes its workspace, then rerun the canonical full suite with unchanged checks so it can reach the final E2E. Only then can the preloader's route timing, event-loop delay, and nested `where.exe` / PowerShell measurements answer the original `/api/model/ready` question. Do not start a local model or close foreign processes. The model-ready release gate remains **RED/OPEN**.
