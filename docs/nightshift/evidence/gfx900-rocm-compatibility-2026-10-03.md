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
