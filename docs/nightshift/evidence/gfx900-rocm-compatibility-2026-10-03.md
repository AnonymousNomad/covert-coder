# gfx900 / ROCm Compatibility Candidate — 2026-10-03

**Branch:** `feat/runtime-gfx900-compat`
**Base:** `7391b98e1e0972dd3fe4365420fe15366b77b24c`
**Worktree:** `E:\\covert-gfx900-compat`
**Status:** DRAFT CANDIDATE — NOT MERGE-READY

## Trigger

A prospective beta tester reported an AMD `gfx900` system where Vulkan is functional but materially slower for their workload, while their Unsloth path does not provide the ROCm route they need.

The objective of this lane is not to declare gfx900 supported. It is to establish an explicit, non-silent compatibility route that can be exercised on the tester's hardware and converted into evidence.

## Upstream facts checked

- Current llama.cpp HIP CMake accepts `GPU_TARGETS` / `AMDGPU_TARGETS` and requires ROCm/HIP >= 6.1.
- Current llama.cpp HIP vendor code has an explicit `__gfx900__` branch.
- Current llama.cpp release ROCm artifact matrix does not include gfx900 among its prebuilt release targets.
- ROCm TheRock exposes a `device-gfx900` package target, but its current matrix has no hardware test runner for gfx900; nightly builds are not equivalent to runtime qualification.

No claim of gfx900 performance or full runtime support is made from those source-level facts.

## Candidate changes

1. Preserve Unsloth as the default local runtime.
2. Add explicit `AIDE_LOCAL_RUNTIME_BACKEND=llama-cpp` compatibility selection.
3. Require an operator-supplied `AIDE_LLAMA_SERVER` path for nonstandard llama.cpp builds.
4. Add `AIDE_LLAMA_ACCELERATOR=rocm` as an explicit accelerator label.
5. Detect sibling HIP/Vulkan backend libraries where possible.
6. Apply GPU offload (`-ngl 999`) for explicit ROCm/Vulkan compatibility binaries when the model profile does not already specify `ngl`.
7. Add a gfx900 qualification/runbook that requires same-host evidence and forbids promotion from build success alone.

## Verification

### Compatibility tests

`node --experimental-strip-types --no-warnings --test tests/arch/runtime-compatibility.test.ts`

Result: **4 pass / 0 fail**

Covered:

- default remains Unsloth;
- explicit llama.cpp compatibility selection;
- invalid runtime selector fails closed;
- ROCm accelerator labeling;
- sibling HIP library detection.

### Focused runtime regression — first corrected invocation

`runtime-compatibility.test.ts + model-runtime.test.ts + runtime-broker.test.ts`

Result: **34 pass / 0 fail / 6 skip**.

### Focused runtime regression — expanded with legacy resolver tests

Result: **36 pass / 1 fail / 6 skip**.

The red was the pre-existing Windows port-ownership test:

`Windows port inspection identifies and refuses an occupied foreign listener`

Expected `FOREIGN`; observed `UNKNOWN`. The same test had passed earlier in the session. The failing observation took ~5.88 s while TypeScript compilation was also running; the Windows ownership probe uses a PowerShell `Get-NetTCPConnection` subprocess with a 3 s timeout. This establishes a contention/timing correlation only. **Exact cause is not proven.** The red is preserved and must be investigated/dispositioned before merge.

No assertion or timeout was weakened.

### TypeScript

`npx tsc -p tsconfig.node.json --noEmit`

Result: **PASS**

### ESLint

Focused lint on the modified TypeScript/test files.

Result: **PASS**

## Open merge gates

This branch is intentionally a draft candidate. Before integration:

1. Root-cause or formally disposition the Windows foreign-listener red without weakening the test.
2. Confirm that explicit llama.cpp compatibility mode does not reintroduce false `READY` semantics from the legacy runtime path.
3. Run full architecture + Veritas + exact-SHA CI.
4. Obtain real gfx900 host evidence:
   - exact GPU / gfx target;
   - OS + driver + ROCm version;
   - llama.cpp commit/build;
   - GGUF artifact hash;
   - observed HIP/ROCm backend;
   - GPU layer offload;
   - inference;
   - streaming;
   - cancellation/recovery;
   - restart;
   - clean shutdown;
   - same-host ROCm vs Vulkan measurements.
5. Do not promote gfx900 from EXPERIMENTAL until that evidence exists.

## Release-law status

- No silent fallback added.
- Unsloth default preserved.
- gfx900 remains unqualified.
- Buildability != runtime support.
- UNKNOWN remains UNKNOWN.
- Existing red is preserved.
- PR must remain draft until the gates above are closed.

## Addendum — Windows ownership-probe source-path analysis — 2026-10-06 22:12 UTC

**Disposition:** `RED PRESERVED / CAUSE NOT PROVEN / DYNAMIC RETEST GATED`

The current candidate source explains a plausible mechanism for the recorded `FOREIGN` versus `UNKNOWN` red:

- The fixture at `tests/arch/runtime-broker.test.ts:166` awaits `adapter.discover()` and then calls `adapter.status()`.
- `UnslothRuntimeAdapter.status()` calls `discover()` again (`node/src/services/unsloth-runtime-adapter.ts:987`); `discover()` refreshes `lastHealth` through `health()` (`:424-436`).
- With no owned process handle, each `health()` call invokes `inspectPort()` (`:615-624`). The default Windows inspector starts a fresh `powershell.exe` for `Get-NetTCPConnection` with an unchanged 3,000 ms timeout (`:202-212`). Any exec error is mapped fail-closed to `UNKNOWN`.
- Therefore this single fixture performs two sequential Windows PowerShell ownership probes before asserting status. The recorded 5.88 s red is close to the combined 6 s timeout budget. This makes a repeated-probe timeout a concrete hypothesis; **per-probe timing was not captured**, so timeout causality and the contribution of concurrent TypeScript compilation remain unproven. The red is not reclassified or dismissed.

No source/test assertion, timeout, floor, ownership rule, or process was changed in this analysis. No Covert app or model runtime was started.

The current host sample remains below the explicit product-test admission gate: **3.41 GiB free physical / 4.91 GiB free commit** (24.36 GiB commit limit). The requested dynamic reproduction/instrumentation is therefore deferred until both established floors pass. PR #41 remains OPEN/DRAFT at `9cfb2f65cec702185002a84afa12a2e4048342aa`; its exact-head required checks currently report SUCCESS, which does not close this local red or qualify gfx900. The candidate worktree's pre-existing owner edit in `docs/evidence/desktop-battery.md` remains untouched.

**Next diagnostic:** when resource admission passes, rerun the named test in the previously observed concurrent-TypeScript condition with unchanged 3,000 ms timeouts. Capture elapsed time for each PowerShell child (without command bodies/secrets), then distinguish first-probe timeout, second-probe timeout, and returned listener identity. Keep the original red and any new observation side by side. Do not repair or reclassify until that distinguishes cause.

## Addendum — product status path versus Windows fixture probe count — 2026-10-06 22:27 UTC

**Disposition:** `SOURCE-PATH HYPOTHESIS STRENGTHENED / TEST RED OPEN`

Current source shows the extra ownership probe is specific to the direct adapter test sequence, not the ordinary model-status request path:

- `tests/arch/runtime-broker.test.ts:183-184` explicitly awaits `adapter.discover()` and then awaits `adapter.status()`.
- `UnslothRuntimeAdapter.status()` at `node/src/services/unsloth-runtime-adapter.ts:987-988` performs its own `discover()`; each discovery refreshes the ownership/health observation.
- Product construction at `node/src/openapi.ts:255-295` composes `RuntimeBroker` inside `BrokerModelRuntime`. Its `observedStatus()` at `node/src/services/broker-model-runtime.ts:91-117` uses a two-second response cache and, on a cache miss, calls `activeStatus()` once. That delegates to `RuntimeBroker.status()` (`node/src/services/runtime-adapter.ts:229-231`), which calls the selected adapter's `status()` once. For Unsloth, that status call performs one discovery.
- This source comparison makes a fixture-only duplicate probe a stronger explanation for why the named test is near two 3-second child deadlines. It does not measure either probe, prove that a timeout occurred, or exclude host contention. **Cause remains unproven; the `FOREIGN` versus `UNKNOWN` red remains open.**

No product source, test, timeout, ownership rule, or assertion changed. No test or runtime was started in this continuation.

### Current external and resource truth

- GitHub PR #41 is still **OPEN / DRAFT**, head `9cfb2f65cec702185002a84afa12a2e4048342aa`; the PR remains not merge-ready. Exact-head AIDE CI run **37503972483** reports `SUCCESS`. This does not close the preserved local red or qualify gfx900.
- Fresh host sample at **2026-10-06 22:27:29 UTC**: **3.05 GiB free physical RAM / 3.04 GiB free commit**, commit limit **24.36 GiB**. Product-test admission requires at least **3 GiB physical RAM** and **more than 5 GiB free commit**; the commit floor fails, so dynamic reproduction remains deferred.
- The pre-existing `docs/evidence/desktop-battery.md` edit remains untouched. The worktree remains dirty only in the two already-classified evidence files; no commit/push was made.

**Next:** after a fresh sample clears both resource floors, instrument elapsed time for each PowerShell ownership child in the named Windows test under the preserved concurrent-TypeScript condition, with all deadlines and assertions unchanged. Keep the original and new red evidence together.

## Addendum — exact-SHA CI platform coverage — 2026-10-06 22:33 UTC

The exact-head AIDE CI success does not execute the preserved Windows-specific test:

- The candidate's `.github/workflows/ci.yml:16` defines `runs-on: ubuntu-latest` for AIDE CI.
- GitHub run **37503972483** for `9cfb2f65cec702185002a84afa12a2e4048342aa` completed its single `verify` job successfully, including backend/integration, architecture and Veritas steps.
- `tests/arch/runtime-broker.test.ts:166` skips the foreign-listener ownership case unless `process.platform === 'win32'`. The Linux CI pass therefore does not contradict or disposition the local Windows `FOREIGN` versus `UNKNOWN` red.

The exact-SHA CI remains valid evidence for its Linux job, but **Windows reproduction is still required**. Latest host sample: **3.11 GiB free physical RAM / 3.15 GiB free commit** at **2026-10-06 22:30:26 UTC**; the `>5 GiB` commit admission floor still fails. No Windows test was started and no process was stopped.

## Addendum — instrumented Windows ownership fixture — 2026-10-07 02:26 UTC

**Disposition:** `PASS ON THIS RUN / PRIOR RED PRESERVED / CAUSE UNKNOWN`

- Source remained at exact candidate SHA `9cfb2f65cec702185002a84afa12a2e4048342aa`; no product source, test assertion, timeout, ownership rule, or resource floor changed.
- Pre-run sample at 02:25:58 UTC: **4.77 GiB free physical RAM / 6.51 GiB free commit**, 24.36 GiB commit limit. A follow-up sample at 02:27:59 UTC was **4.73 GiB / 6.54 GiB**.
- Concurrent TypeScript command: `node node_modules/typescript/bin/tsc -p tsconfig.node.json --noEmit`; exit **0**.
- Focused test command: `node --experimental-strip-types --import ./scripts/http-close-shim.mjs --test --test-concurrency=1 --test-name-pattern="Windows port inspection identifies and refuses an occupied foreign listener" tests/arch/runtime-broker.test.ts`. A temporary preload also wrapped `child_process.execFile` and emitted elapsed milliseconds for `powershell.exe` only; its command arguments and bodies were not logged. Result: **1 passed, 0 failed, 0 skipped**.
- A temporary Node preload measured three `powershell.exe` children without recording their arguments or command bodies: **1,242.5 ms**, **1,242.2 ms**, and **1,216.6 ms**. The first two correspond to the fixture's explicit `discover()` and subsequent `status()` discovery; the third occurs during the attempted load refusal. The test observed the listener as `FOREIGN`; its assertions confirmed no runtime HTTP fetch and no process spawn, and the fixture listener remained open until test cleanup.
- No model/runtime was started and no foreign process was terminated. The temporary instrumentation file was outside the repository.

This passing run is not a repair and does not erase the preserved earlier `UNKNOWN` result. The exact cause of the earlier `FOREIGN` versus `UNKNOWN` red remains **unproven**; the measured successful probe timings do not establish why the earlier run approached the two 3-second child deadlines. Exact-SHA CI is still Linux-only and does not cover this Windows-specific case. Keep PR #41 in draft and the gfx900 runtime unqualified.

## Addendum — Windows port-probe deadline repair — 2026-10-08

**Disposition:** `LOCAL WINDOWS RED REPAIRED / FULL LOCAL GATES PASS / GFX900 STILL UNQUALIFIED`

### Preserved expanded-suite red and cause boundary

- Candidate base before this repair: `e76403f37a7adcf7607db3aafffdaa6660092eba` on `feat/runtime-gfx900-compat`.
- On 2026-10-08, the expanded runtime suite first failed before executing any tests because Node received a raw `E:\...` instrumentation path as an ESM URL (`ERR_UNSUPPORTED_ESM_URL_SCHEME`); **0 tests ran**. That invocation failure is retained in `E:\pip_temp\covert-w1-ownership-diag-20261008\runtime-focused.log` (SHA-256 `D221885F245C0E0737C63A412BFD60C1ED4EC8C7AD363C71E3C6EC973CF84735`). The corrected file URL was validated before continuing.
- The corrected expanded run then reported **49 total / 41 pass / 2 fail / 6 skip**. The two failures were the existing Windows no-listener and occupied-foreign-listener tests. In each failing observation, the `powershell.exe` child reached the unchanged 3,000 ms timeout and was killed (`elapsed_ms` 3,039.2 and 3,039.5); adapter error handling correctly mapped the result to `UNKNOWN`, producing the fixture assertion failures. No ownership was inferred and no process was controlled.
- A broad `rg --files E:\pip_temp` command started by the diagnostic shell was still running during that expanded run. It was identified by its exact command line and stopped as our own inspection process. Its contribution to the two PowerShell overruns is **not proven**. The direct failure mechanism is established as the subprocess deadline; the external load source for those specific overruns remains unknown.
- After that search ended, the two unchanged PowerShell fixture tests passed in isolation with child times 1,161–1,265 ms. A temporary same-host diagnostic then observed `netstat.exe` report the fixture listener's exact PID and the released port as free in 62.5 ms and 48.6 ms. No repository file or user process was affected by that diagnostic.

### Bounded repair

`node/src/services/unsloth-runtime-adapter.ts` now uses the Windows system binary `%SystemRoot%\\System32\\netstat.exe` with `-ano -p tcp -a` for listener observation. It retains the existing 3,000 ms timeout, uses no command shell, and does not search `PATH`. Child failure, missing `SystemRoot`, malformed target rows, unknown TCP states, or a listener without a positive PID remain `UNKNOWN`; a proven listener retains its exact PID. The existing no-listener and foreign-listener integration fixtures exercise this path. No runtime ownership, admission, fallback, endpoint-contact, or process-termination rule changed.

### Post-repair verification

| Gate | Result |
|---|---|
| Windows no-listener + foreign-listener fixtures | **2 pass / 0 fail / 0 skip**, 0.657 s total; observed probe tests 116 ms and 135 ms |
| Expanded runtime compatibility/model/broker/resolver suite | **49 total / 43 pass / 0 fail / 6 skip**, 5.162 s; skips are bundled-GGUF-dependent in this checkout |
| Node TypeScript (`tsconfig.node.json --noEmit`) | exit **0** |
| `npm run check:arch` | exit **0**; **997 total / 986 pass / 0 fail / 11 skip**; Node/browser TypeScript, repository ESLint, and architecture battery passed |
| `npm run veritas` | exit **0**; **6/6 checks true**, score `1.0` / threshold `0.9`; compile, full `npm test`, secret scan, manifest validation, path boundary, and diff check passed |

Evidence logs are outside the product repository in `E:\pip_temp\covert-w1-ownership-diag-20261008`. Exact SHA-256 values: runtime red `D221885F245C0E0737C63A412BFD60C1ED4EC8C7AD363C71E3C6EC973CF84735`; expanded post-repair runtime suite `6F95DE01CCA8E709AB38EE78245AEF7673B5DF2473D00A9CC4FE5586DF28240F`; architecture gate `6EF4CFF483216B4C2B24945986B7BBC8C24AAD5A243F611D661F2931F73B79F2`; Veritas `61403978886718C00A43FD79CED28AF9AF50C05A191F527F17D6A3558D37E3B8`.

### Remaining limits and next action

- No local model or runtime was launched. The host is not a gfx900/AMD system; real ROCm inference, streaming, cancellation, restart, and same-host backend comparison remain **unproven**.
- `gfx900 = UNQUALIFIED`; do not promote it from this portability repair.
- The pre-existing owner edit in `docs/evidence/desktop-battery.md` was preserved and excluded from this repair.
- Keep PR #41 draft and do not merge pending same-host hardware evidence and current-base reconciliation.

### Exact-SHA GitHub validation

- Runtime repair/source evidence commit: `4fd1cca75e60500cb36f5afb78e45a44e7881aac`.
- Push-triggered AIDE CI run **37715924324**: `SUCCESS`; all job steps passed.
- PR-triggered AIDE CI run **37715927990**: `SUCCESS`; all job steps passed on the same exact SHA.
- PR #41 remains OPEN / DRAFT, based on `7391b98e1e0972dd3fe4365420fe15366b77b24c`, and was not merged. The candidate remains behind current convergence and awaits base reconciliation after the W1/hardware gates are appropriately dispositioned.

This remote-result addendum is an evidence-only follow-up commit. Require exact-SHA CI for that evidence commit as well; the two runs above attest to source commit `4fd1cca…`.
