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
