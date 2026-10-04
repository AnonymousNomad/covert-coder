# Windows aggregate E2E model-ready timeout — 2026-10-04

Date: 2026-10-04
Worktree: `E:\covert-nightshift-integration`
Branch: `nightshift/production-convergence-20260926`
Last published parent SHA: `ca8527e565b62326fd940f574d9964413e3c6751`
Status: **BLOCKED — aggregate E2E red preserved; nested cause not yet isolated**

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

Next: capture timestamped ArchServer event-loop delay and nested `where.exe` / PowerShell runtime-probe durations during the full test sequence, preserving all existing deadlines and assertions. Do not start a local model or close foreign processes for this diagnosis. Keep this aggregate gate **RED/OPEN** until its failing run is explained and the canonical full sequence passes.
