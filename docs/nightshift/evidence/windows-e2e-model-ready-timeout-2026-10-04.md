# Windows aggregate E2E model-ready timeout — 2026-10-04

Date: 2026-10-04
Worktree: `E:\covert-nightshift-integration`
Branch: `nightshift/production-convergence-20260926`
Last published parent SHA: `ca8527e565b62326fd940f574d9964413e3c6751`
Status: **BLOCKED/OPEN — full serial `npm test` and Veritas now pass after host resource recovery; the earlier low-headroom timeouts remain preserved and their exact Windows-level cause is not proven**

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

## Later instrumented full-suite attempt — diagnostic preload defect

After the PID-reuse cleanup repair described in [the Windows process ancestry evidence](windows-test-process-pid-reuse-2026-10-04.md), an instrumented repository `npm test` progressed past canonical launch but stopped at `scripts/acceptance-real.mjs` before the final E2E script. The Academy failure was produced by the temporary diagnostic preload, so this run is **not valid product-regression evidence**:

- `POST /api/academy/check` returned HTTP **500** after **108 ms** with `response violates the contract`.
- Full output: `E:\pip_temp\covert-w5-npm-test-instrumented-after-pid-fix-20261004.log`; SHA-256 `0D5F1D6D75F6B9E6CD51AACF5549897AFC32E14B2F6FF338F23936874FA87B0F`.
- Diagnostic trace: `E:\pip_temp\covert-w5-npm-test-instrumented-after-pid-fix-20261004.jsonl`; SHA-256 `B1EEAF96EA14518D711AEA9E6679EECEAC092BC359F7AA0E84D5BDB90752CB99`.
- The run produced runtime-probe timings from earlier supervised stacks, but it recorded **no `/api/model/ready` request**. It therefore provides no nested timing evidence for the original model-ready failure.
- A focused `node scripts/acceptance-real.mjs` rerun passed Academy check (HTTP 200, **333 ms**) and the remaining acceptance steps. Output: `E:\pip_temp\covert-acceptance-real-academy-repro-20261004.log`; SHA-256 `29D136E40DDE61655AC00769A811EA33032CB06C7D05A416484D7BFB3C011FC8`.
- The preload wrapped `child_process.execFile` without preserving Node's `util.promisify.custom`. A direct probe showed that normal `promisify(execFile)` returns an object with string `stdout` and `stderr`, while the flawed preload changed it to a stdout string with undefined `.stdout` and `.stderr`. The Academy runner reads those object fields, which explains the response-contract 500 in that instrumented run.
- Baseline `promisify(execFile)` probe output: `E:\pip_temp\covert-promisify-baseline-20261004.log`; SHA-256 `C96D0F48798CD0AE0DDD3D23850C97E2D6C0A7479D27D70ACD5AEAB641E84AA3`.
- After correcting the temporary preload to preserve `util.promisify.custom`, the identical probe produced the same object/string-field result: `E:\pip_temp\covert-promisify-fixed-20261004.log`; SHA-256 `C96D0F48798CD0AE0DDD3D23850C97E2D6C0A7479D27D70ACD5AEAB641E84AA3`.
- Corrected temporary preloader SHA-256: `51DF48CB975422463B7E2F90BEABB874193604D9E1CC976AD30CDE62881C30B0`.
- A focused uninstrumented `node scripts/acceptance-real.mjs` also passed Academy check (HTTP 200, **333 ms**) and the remaining acceptance steps. Its output is retained at `E:\pip_temp\covert-acceptance-real-academy-repro-20261004.log`, SHA-256 `29D136E40DDE61655AC00769A811EA33032CB06C7D05A416484D7BFB3C011FC8`.
- The flawed-preload run recorded **no `/api/model/ready` request**. The previous response-contract failure is classified as a diagnostic-harness defect, not a product red. The earlier uninstrumented Veritas model-ready timeout remains preserved and unresolved.

## Corrected-preload full-suite outcome

The same full `npm test` chain was rerun with the corrected preload (`util.promisify.custom` preserved) and the original deadlines and assertions. Academy passed; the final E2E reached model readiness and then failed while deciding the prepared terminal operation:

- `/api/model/ready?id=qwen-coder-1.5b-q4`: HTTP **200**, **1,491 ms** at the ArchServer route and **1,495 ms** at the facade.
- During that request, `where.exe unsloth` completed in **133.32 ms** with exit 1 (not found), and the port-18888 PowerShell listener probe completed in **1,155.35 ms** with exit 0 (`FREE`). These durations account for most of the endpoint's measured time; neither child probe reached its 3,000 ms deadline.
- `/api/authority/prepare` then completed HTTP 200 in **2,276 ms**.
- The subsequent `POST /api/authority/decision` returned facade **502** at **30,005 ms**. The run ended before `/api/terminal/run`.
- Full output: `E:\pip_temp\covert-w5-npm-test-corrected-preload-20261004.log`; SHA-256 `70876161E15DB28B8FE44B2D4B589AF477467A1129A46659862E5DB8B816EEA0`.
- Probe trace: `E:\pip_temp\covert-w5-npm-test-corrected-preload-20261004.jsonl`; SHA-256 `CA9E4BA907750B53CE747D3BE2238B9462BD3088DFBAA53076DCD95C59EA0D9F`.
- The ArchServer logger recorded successful prepare but no completion log for the decision. The preload at this run did not yet capture route-start/route-close for the decision, so whether the request reached ArchServer and where it stalled remain **UNKNOWN**.
- The full-run response confirms the earlier Academy 500 was diagnostic-preload-induced; Academy returned HTTP 200 in **100 ms** with the corrected preload.

## Isolated final E2E comparison

The same `node scripts/e2e.mjs` sequence passed on an immediate isolated run with expanded route instrumentation:

- `/api/model/ready`: HTTP 200 in **1,280 ms** at ArchServer / **1,283 ms** at the facade.
- Both `/api/authority/prepare` calls, both `/api/authority/decision` calls, and both `/api/terminal/run` calls completed HTTP 200. Authority decisions took **17.72 ms** and **21.20 ms** at ArchServer.
- One event-loop interval before model readiness recorded **6,190.79 ms** maximum delay, ending several seconds before `/api/model/ready` began. This shows a host scheduling stall occurred in the isolated run, but it does not explain the full-suite authority timeout or the earlier model-ready timeout.
- Output: `E:\pip_temp\covert-e2e-authority-decision-instrumented-20261004.log`; SHA-256 `D129DEABC44B9B68BC9CC465F1905CB4D8E153D425C033A045E35F3FBC328228`.
- Trace: `E:\pip_temp\covert-e2e-authority-decision-instrumented-20261004.jsonl`; SHA-256 `9600527697E48C47D7D53A219EEB08D838E4CD3F433312FAC9A4C704DF09D232`.
- Expanded temporary preloader SHA-256 `CDD348E748A002CF9122193BB053B1A6BE9E6C01A39B4ACCE794DB73319F007A`.

These successful route checks do not erase either aggregate red. The intermittent 30-second `/api/model/ready` Veritas failure and the full-suite authority-decision timeout have distinct observed boundaries; neither has a proven root cause. No local model was started and no foreign process was terminated.

Next: rerun canonical `npm run veritas -- --json` at the recovered host baseline and compare its final Windows E2E with the preserved original red. Keep the prior timeout in the record; do not treat this full `npm test` pass as proving its low-level cause.

## Expanded-instrumentation full serial `npm test`

After the earlier aggregate failures, the owner-authorized Unity close was performed gracefully through the editor's main window. The target was Unity PID **8888**, `FoundingVisualFoundation` in the separate Nomadic Creed worktree; its two asset-import workers and owned Unity helpers exited with the editor. No process was force-terminated. This recovered host capacity but is not a product-code repair.

Resource observations:

- Before close, at `2026-10-04T12:28:42Z`: **3.22 GiB free physical RAM**; Windows commit **29.12/32.74 GiB**, about **3.62 GiB free commit**.
- After close, before the full suite, at `2026-10-04T12:31:28Z`: **6.24 GiB free physical RAM**; commit **23.85/31.65 GiB**, about **7.80 GiB free commit**.
- During the suite, at `2026-10-04T12:35:56Z`: **6.03 GiB free RAM** and about **7.57 GiB free commit** (24.08 GiB committed of 31.65 GiB).
- Immediately after the final E2E, at `2026-10-04T12:36:55Z`: **6.10 GiB free RAM** and **7.72 GiB free commit**.
- The Windows-reported C: pagefile allocation changed from 14,275 MiB to 13,162 MiB during this interval; E: reported 2,944 MiB. No manual pagefile change was made. No local model was started; the local-model admission floors remained controlling.

The full package `npm test` chain then completed with **exit code 0**, including the final E2E. The expanded diagnostic preload was outside the repository, SHA-256 `CDD348E748A002CF9122193BB053B1A6BE9E6C01A39B4ACCE794DB73319F007A`; product deadlines and assertions were unchanged.

- Full output: `E:\pip_temp\covert-w5-npm-test-expanded-route-20261004.log`; SHA-256 `15CB0487FB680D46081C447898A21EB7C08E04F1C2B189FF1CE614769E1EC632`.
- Trace: `E:\pip_temp\covert-w5-npm-test-expanded-route-20261004.jsonl`; SHA-256 `4A722B97D79990E7B66EE328A890F0C83F3435CCED17B49D66A0708C66E25909`.
- The final `/api/model/ready?id=qwen-coder-1.5b-q4` returned HTTP 200 in **1,621 ms** at ArchServer / **1,623 ms** at the E2E client. This is a read-only readiness result, not a model start or model qualification.
- Instrumented ArchServer events show all **29** Authority decision responses in the full test trace were HTTP 200 (maximum observed route time **157.39 ms**); all **27** prepare responses and all **4** terminal runs were also HTTP 200. The final E2E decision reached ArchServer and returned in **69.95 ms**, followed by terminal execution in **92.50 ms**.
- Event-loop samples near model readiness showed maximum delays between **29.69 and 49.97 ms**. The trace's overall maximum was **6,190.79 ms** in an earlier interval, not during the final readiness/Authority requests.

The contrast between the preserved low-headroom reds and this pass after Unity exited supports host resource pressure as a contributing condition. It does **not** prove which Windows scheduling, paging, or I/O operation caused either prior timeout, and it does not erase the earlier Veritas failure. Keep the prior red in the record and do not start a model.

## Canonical Veritas rerun at recovered baseline

The canonical `npm run veritas -- --json` ran without the diagnostic preload on local HEAD `4c8854b6c6e8b6b7f87964c29b19c4d0cf240a8b` and exited **0**. The only tracked worktree change was `docs/evidence/desktop-battery.md`, updated by the full-test runs; the owner directive stayed untracked and excluded. Veritas's `git-diff --check` also passed.

- Veritas output: `E:\pip_temp\covert-w5-veritas-recovery-baseline-20261004.log`; SHA-256 `0D2137D2B4DE6BE9136B42CEB95570A99F369FB05C6B6B2C697FA19A84F52E29`.
- Report: **6/6 checks passed** — path boundary, secret scan, manifest validation, compile (`npm run check`, exit 0), tests (`npm test`, exit 0), and git diff. Veritas status `verified`, score **1.0 / 0.9 threshold**, no failed checks or oaths.
- Run window: `2026-10-04T12:43:46Z` to `2026-10-04T12:59:49Z`. Compile/check completed in **717,868 ms**; the full test command also exited 0.
- During the run, observed free RAM ranged from **4.65 to 5.80 GiB**, and free commit from **5.78 to 7.31 GiB**. No local model/runtime start was requested.
- A read-only Windows System log query for Resource-Exhaustion-Detector event 2004 between `10:30Z` and `11:20Z`, covering the original failing Veritas run, found **no matching event**.

This successful canonical rerun strengthens the host-pressure correlation, but it cannot reconstruct the uninstrumented inner operation from the earlier 30-second timeout. Keep that red preserved and its low-level cause **UNKNOWN**. The current local gates are green at the tested source SHA; the full pre-push gate and exact-SHA CI are still required before publication.
