# Legacy AMD gfx900 Compatibility Lane

**Status:** EXPERIMENTAL / EXTERNAL HARDWARE QUALIFICATION REQUIRED
**Default V1 runtime:** Unsloth remains unchanged.
**Compatibility runtime:** explicit direct llama.cpp only; no silent fallback.

## Why this lane exists

A prospective beta tester reported AMD `gfx900` hardware where Vulkan works but is materially slower for their workload, while the qualified Covert Unsloth path does not provide the ROCm route they need.

Covert already retains direct llama.cpp as a sovereign reference/recovery implementation. This lane exposes that existing path as an explicit operator-selected compatibility mode so unsupported hardware is not forced through Unsloth or Vulkan.

This is not a claim that `gfx900` is qualified. It creates a testable route so real `gfx900` evidence can be collected.

## Operator selection

The default remains:

```text
AIDE_LOCAL_RUNTIME_BACKEND=unsloth
```

To opt into the compatibility lane:

```bash
export AIDE_LOCAL_RUNTIME_BACKEND=llama-cpp
export AIDE_LLAMA_SERVER=/absolute/path/to/llama-server
export AIDE_LLAMA_ACCELERATOR=rocm
```

PowerShell equivalent:

```powershell
$env:AIDE_LOCAL_RUNTIME_BACKEND = 'llama-cpp'
$env:AIDE_LLAMA_SERVER = 'C:\path\to\llama-server.exe'
$env:AIDE_LLAMA_ACCELERATOR = 'rocm'
```

`AIDE_LLAMA_SERVER` must point to an operator-supplied llama.cpp server binary. Covert does not download ROCm, build llama.cpp, or silently replace the runtime.

Accepted accelerator labels are `cpu`, `vulkan`, and `rocm`. Unknown labels remain `unknown`; they are not guessed.

When the explicit runtime is identified as Vulkan or ROCm and no model profile supplies `ngl`, Covert adds `-ngl 999` so the GPU route is not silently reduced to CPU execution.

## gfx900 / ROCm build candidate

Current upstream llama.cpp exposes the HIP backend through `GGML_HIP` and accepts GPU targets. A Linux build candidate for this test lane is:

```bash
HIPCXX="$(hipconfig -l)/clang" HIP_PATH="$(hipconfig -p)" \
cmake -S . -B build \
  -DGGML_HIP=ON \
  -DGPU_TARGETS=gfx900 \
  -DCMAKE_BUILD_TYPE=Release \
  -DLLAMA_BUILD_SERVER=ON

cmake --build build --config Release -j"$(nproc)"
```

Use upstream build instructions appropriate to the installed ROCm release. Do not copy this command blindly across ROCm versions.

Relevant upstream evidence:

- llama.cpp supported backends includes HIP for AMD GPUs: https://github.com/ggml-org/llama.cpp
- llama.cpp HIP CMake accepts `GPU_TARGETS` / `AMDGPU_TARGETS`: https://github.com/ggml-org/llama.cpp/blob/master/ggml/src/ggml-hip/CMakeLists.txt
- ROCm TheRock development matrix currently produces `gfx900` builds, but does **not** mark `gfx900` sanity-tested or release-ready: https://github.com/ROCm/TheRock/blob/main/SUPPORTED_GPUS.md

That last distinction is important: build availability is not runtime qualification.

## Beta tester acceptance procedure

Collect evidence from the actual `gfx900` host:

1. Record OS, kernel/Windows build, GPU model, exact `gfx900` identity, RAM/VRAM, driver, ROCm release, llama.cpp commit/build, and model artifact hash.
2. Run `llama-server --version` and preserve output.
3. Run `llama-bench` or equivalent with the same GGUF under ROCm and Vulkan where possible.
4. Confirm the ROCm run identifies the HIP/ROCm backend and actually offloads layers to the GPU.
5. Start Covert with the three explicit environment variables above.
6. Register/import the exact GGUF artifact.
7. Start the model and confirm Covert launched the configured llama-server, retained ownership, and used GPU offload.
8. Exercise normal inference, streaming, cancellation, invalid-request recovery, stop/restart, and clean shutdown.
9. Record prompt-processing and generation throughput for ROCm and Vulkan using the same model, context, prompt, and settings.
10. Verify Covert does **not** label this runtime with the frozen Unsloth qualification or silently switch backends.

## Promotion rule

Do not promote `gfx900` to supported/qualified from compilation alone.

Promotion requires exact-machine evidence for:

```text
identity
→ runtime launch
→ GPU backend observation
→ model load
→ inference
→ streaming
→ cancellation/recovery
→ restart
→ clean shutdown
→ repeatable benchmark
```

Until those checks pass, product status remains experimental / unqualified.

## Non-goals

This lane does not:

- change Unsloth as the default V1 runtime;
- claim ROCm support across all AMD GPUs;
- bundle or install ROCm;
- bundle a custom llama.cpp build;
- use a silent AUTO fallback;
- claim a performance advantage over Vulkan without same-host measurements;
- convert `AVAILABLE` into `RUNTIME_QUALIFIED` or `READY`.

The purpose is to give legacy AMD users a real compatibility path and give Covert a disciplined way to turn their hardware results into future Runtime Passport evidence.
