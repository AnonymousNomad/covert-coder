# Covert Coder Runtime / Backend Portability Gap Audit

**Audit date:** 2026-10-04
**Covert baseline:** `nightshift/production-convergence-20260926` at `7391b98e1e0972dd3fe4365420fe15366b77b24c` (remote ref was checked before this audit)
**Research lane:** `research/runtime-backend-gap-audit-20261004`, based directly on that SHA
**Scope:** read-only production architecture audit plus research documents. No runtime implementation changed. The separate `feat/runtime-gfx900-compat` ref at `afe6f1f4d8f2a20be1317f79926d6ac8f8a14396` was checked and not modified.

## Executive summary

**CURRENT COVERAGE:** Covert has a mature adapter-shaped contract and a narrow, frozen Unsloth profile. The only saved qualified local runtime passport is native Windows 11, administrator elevation, Unsloth 2026.9.11, Vulkan, GTX 1060 Mobile 6 GB, and one exact Liquid GGUF hash. The production broker composes Unsloth only; direct llama.cpp exists as an explicit recovery adapter but is not composed. No other hardware/OS/runtime combination is qualified by this source snapshot.

**CRITICAL GAPS:** production composition is two-slot and actually one-slot; runtime and Model Access contracts encode Unsloth/llama.cpp identities; hardware discovery only invokes `nvidia-smi` on Windows and loses non-NVIDIA hardware; recommendations infer Vulkan from VRAM size instead of accelerator discovery; admission probes are tied to a frozen Windows/NVIDIA profile; artifact ingestion is GGUF-only; and the runtime passport key in code does not bind runtime build, accelerator, OS, device architecture, driver, or execution profile. The written Unsloth passport is more precise than the runtime contract that consumes it.

**BEST NEXT ARCHITECTURE CHANGE:** add an explicit runtime/profile registry and make adapter, backend/accelerator, artifact, host, and qualification identities separate contract objects. Preserve the current frozen admission floors as the Unsloth profile. Require explicit operator selection and a matching passport before `QUALIFIED`; do not auto-fallback.

**BEST NEXT RUNTIME AFTER LLAMA.CPP:** first finish the Covert-owned llama.cpp adapter and qualify backend profiles. Then pilot **ONNX Runtime GenAI (ORT GenAI)** as one additional runtime family, beginning with a single QNN Windows ARM64 model package. Its VitisAI execution-provider path also gives AMD Ryzen AI NPU a credible, separate Windows profile; DirectML and OpenVINO remain separate provider profiles. It is not a universal model/provider layer.

**RUNTIMES TO DEFER:** MLX-LM (Apple-optimized profile after a measured need), vLLM (Linux server/high-throughput profile), MLC-LLM and LiteRT-LM (mobile/edge/WebGPU or cross-platform package use case), ExecuTorch and MNN-LLM (mobile/NPU/embedded use case), TensorRT-LLM (specialized NVIDIA server profile), OpenVINO GenAI as a separate adapter (evaluate ORT GenAI’s OpenVINO EP first), and SGLang (specialized serving/agentic throughput). KTransformers/KT-Kernel remains a specialized MoE experiment.

**RUNTIMES TO REJECT AS V1 DEFAULTS:** SGLang, TensorRT-LLM, and LocalAI as Covert’s runtime dependency. They add complexity or duplicate orchestration without closing a higher-priority workstation gap. This rejects default adoption, not future isolated qualification.

**HARDWARE CLASSES CURRENTLY STRANDED:** all Linux/macOS machines at Covert’s current detector/admission boundary; AMD and Intel GPUs on Windows; AMD Ryzen AI and Intel NPUs; Snapdragon NPU; Apple Silicon acceleration; non-NVIDIA Linux GPUs; CPU-only execution through the current broker; and mobile/edge devices. These may run upstream engines, but Covert does not thereby support or qualify them.

**V1 IMPACT:** do not widen the current V1 passport. Make current single-profile truth explicit, keep unsupported local inference unavailable, and avoid presenting generic model-fit estimates as runtime-qualified recommendations.

**POST-V1 ROADMAP:** registry + portable passports → truthful cross-platform hardware discovery and admission → llama.cpp CPU/CUDA/HIP/Vulkan/Metal/SYCL profiles → ORT GenAI QNN/VitisAI and selected DirectML/OpenVINO profiles → MLX-LM and vLLM only when measured use cases justify them.

## Decision in one sentence

The smallest credible desktop-focused broad-coverage design is **two adapter families**—llama.cpp for portable GGUF inference and ONNX Runtime GenAI for explicitly converted/provider-specific packages—plus a hardware/profile registry; add MLX-LM only as a measured Apple optimization. LiteRT-LM, ExecuTorch, and MNN-LLM are credible edge/mobile candidates, but their separate package formats and integration surfaces do not improve the minimum desktop adapter set. A single adapter registry does not mean automatic selection or a promise that every engine/backend/model combination works.

## Method and evidence boundary

The Covert source was inspected at the exact baseline above. Upstream material was read from official repositories and pinned to commit IDs in [RUNTIME_RESEARCH_EVIDENCE.md](RUNTIME_RESEARCH_EVIDENCE.md). Status labels in the CSV describe upstream evidence, not Covert support. `SUPPORTED` in a source project’s matrix means only that the source project documents that capability; it does not mean Covert has built, integrated, or qualified it.

The direct vLLM documentation host was blocked by the research environment, so its official repository documentation was used instead. The LM Studio documentation host was not independently verified; no conclusion about LM Studio internals depends on it. No external runtime was installed or executed. This is research, not runtime proof.

## Current Covert architecture and exact gaps

### 1. The adapter abstraction is broader than production composition

`RuntimeAdapter` already defines discover, health, capabilities, model list/load/unload, inference/stream/cancel, metrics, shutdown, and status. This is a useful seam. But `RuntimeBackend` is exactly `UNSLOTH | LLAMA_CPP`, `RuntimeStatusResponse.canonical_backend` is the literal `UNSLOTH`, and `RuntimeBroker` stores only a canonical adapter and one optional recovery adapter. Its constructor rejects any other adapter identity. The broker’s only recovery operation is specifically `activateLlamaRecovery`.

At [node/src/openapi.ts](../../../node/src/openapi.ts#L247), production construction is `new RuntimeBroker(new UnslothRuntimeAdapter(...), null, workspace)`. The llama.cpp recovery slot is null. Thus the available abstraction is not an active runtime choice in current production composition.

The current strictness is useful for the frozen release lane, but it is an architectural ceiling for a multi-profile product. Replace identities through normal contract/version migration, not by making a permissive string or by weakening current gates.

### 2. Runtime selection and qualification are bound to one profile

The written [Unsloth passport](../../../docs/design/local-runtime-lab/evidence/UNSLOTH-RUNTIME-PASSPORT-V1.json) carefully binds its qualification to native Windows 11 build 26220, administrator mode, Unsloth 2026.9.11, Vulkan, GTX 1060 Mobile 6 GB / compute capability 6.1 / driver 582.28, a specific LFM2.5 GGUF SHA-256, and a frozen request profile. The [support contract](../../../docs/design/local-runtime-lab/UNSLOTH-V1-SUPPORT-CONTRACT.md) explicitly says no generalization outside that tuple and excludes standard-user install, CUDA, CPU, WSL, other OSes, GPUs, models, and runtime versions. This is disciplined evidence, not a portability defect in the passport itself.

The weakness is that the code identity used by `isRuntimeQualificationCurrent` is only backend + backend version + artifact SHA-256. The broker’s `UNSLOTH_V1_QUALIFICATION` and model sidecar check similarly bind Unsloth ID/version and artifact hash, while the passport’s richer host/backend scope is not modeled as a general matching key. A future adapter could therefore look current under the small code identity while running on a different driver, OS, accelerator, engine build, or hardware architecture.

### 3. Hardware truth collapses into NVIDIA/none

`node/src/services/hardware.ts` only attempts `nvidia-smi` when `process.platform === 'win32'`; the result has `vramSource: 'nvidia-smi' | 'none'`. Other platforms, AMD, and Intel wind up with zero VRAM and no source. It records no vendor, device ID, architecture, driver/runtime versions, accelerator enumeration, NPU, memory model, or multiple-device inventory.

`common/contracts/hardware.ts` has `HardwareBackend = vulkan | cuda | cpu | apple`, but this is not a probed execution-provider inventory. `hardware-profile.mjs` infers `vulkan` from a VRAM threshold; this is not evidence that Vulkan is installed, usable, or the backend selected by a runtime. A zero value conflates “no device,” “unsupported probe,” and “probe failed.”

This loss propagates into other product context: `orch-context.mjs` can label a device only as a generic “discrete GPU” when the source is `nvidia-smi`; the current cockpit telemetry explicitly says CPU utilization and disk capacity are not exposed by its hardware contract. The UI should continue to show unavailable for those signals until a real source is added.

### 4. Admission is both profile-specific and presented as general

`resource-admission.ts` has generic free-memory admission plus NVIDIA-only optional VRAM probes, then `LOCAL_RUNTIME_START_FLOORS` that require Windows commit data, NVIDIA VRAM, and low GPU utilization. The comments and constants tie those floors to the frozen Windows profile. Those floors are valuable and must stay intact for that profile. They cannot truthfully be used as a cross-platform policy, and unknown accelerator data must not be made to look like zero available capacity or healthy capacity.

Future admission should ask the selected runtime profile for its required, supported measurements. Each missing or unavailable measurement remains `UNKNOWN`; profile policy decides whether that specific unknown prevents start. This keeps admission strict without requiring NVIDIA-specific probes for Apple/AMD/Intel/CPU systems.

### 5. Model artifacts, compatibility, and model fit conflate different truths

The current manager discovers and imports GGUF; registration validates GGUF and chat template; the current qualified artifact path pins a GGUF by hash. This is a coherent narrow lane. It cannot represent native Hugging Face/safetensors for vLLM, OpenVINO IR, MLX layout, ORT GenAI model packages, TensorRT engine plans, or MLC compiled packages as first-class artifacts.

`ModelQualificationBasis` carries source revision, artifact hash, runtime ID, and runtime version, but not runtime build, accelerator profile, OS/hardware scope, format/package manifest digest, quantization, or tested capabilities. `ModelManagerRuntime` also literals `canonical_runtime_id` and `default_runtime_id` as `unsloth` and limits reported backend to two identities.

Hardware recommendations select fixed model pack IDs and estimate fit using model file size and total RAM; backend is inferred from a VRAM threshold. It does not prove exact artifact acquisition target, format/runtime compatibility, available memory, KV cache/context footprint, accelerator support, or a qualified runtime profile. A recommendation is a recommendation, not evidence of compatible, loadable, qualified, or ready.

### 6. Adapter completeness is not equal across backends

The direct `LlamaCppRuntimeAdapter` is recovery-only and text-chat shaped. It obtains model identity from the requested local artifact, has null runtime version, reports metrics unknown, rejects tool and structured-output requests, and reports streaming cancellation only partial. Its ownership check is a good guard: it requires a retained Covert-owned process. It is not yet a feature-equivalent general backend.

`RuntimeToolEvidence.attribution` includes an Unsloth-specific repair category. This is an example of an adapter-independent contract carrying a provider-specific implementation concept; a future contract should describe the actual transformation/evidence source in a normalized, versioned manner.

### 7. A legacy direct llama.cpp executor remains inside the base runtime class

`ModelRuntime.start()` still contains a separate direct process-launch path: it can launch a resolved `llama-server` binary and, if unavailable, Python `llama_cpp.server` with `--n_gpu_layers 0`. This is a parallel lifecycle owner outside `RuntimeAdapter`. The production `createModelRuntime()` factory constructs `BrokerModelRuntime`, which overrides start/stop/chat/stream and loads inventory with `sweepLegacyEngines: false`; therefore this base-class direct launcher is **not the active canonical production inference path at this SHA**. Tests and `docs/phase0/probe.mjs` instantiate the base class directly.

This is a latent ownership and portability hazard, not evidence that production currently runs two engines. Before expanding the adapter registry, make the base-class executor’s scope explicit: remove/deprecate it, or keep it behind a clearly isolated legacy/test-only owner with no production construction path. Do not let a new backend reuse it as a shortcut around broker lifecycle, profile binding, or admission.

### 8. API and test surface also encode the two-backend contract

The generated [common/openapi.json](../../../common/openapi.json) mirrors the strict runtime enums/literals. Runtime broker architecture tests and BrokerModelRuntime fixtures pin the same identities and frozen Unsloth qualification. Any future registry or passport migration must update source contracts, generated OpenAPI, persisted evidence, API clients, and tests together. The tests are not the root cause; they protect today’s bounded release promise.

## Runtime and artifact positioning

### llama.cpp

llama.cpp is the strongest broad local compatibility engine in this audit. Upstream documents CPU SIMD (AVX/AVX2/AVX-512/AMX/NEON), CUDA, HIP/ROCm, Vulkan, Metal, Intel SYCL, OpenCL Adreno, and a Hexagon backend, plus hybrid CPU/GPU and multi-GPU paths. It is MIT licensed and GGUF-first, with a server, streaming, chat, embeddings, and template-dependent tool support.

It should be the **default broad local adapter family**, not called universal. The executable is built for a backend set, and accelerator, driver, model architecture/operation, quantization, and platform combinations still need qualification. Some backends are experimental or have packaging/driver floors. It does not natively consume all HF/safetensors, ONNX, MLX, TensorRT, or MLC artifacts. Its Windows Snapdragon Hexagon route currently documents test-signing steps that can require weakening Secure Boot; that route is not acceptable as a Covert beta recommendation. CPU or Adreno are separate alternatives there.

### vLLM

vLLM is a high-throughput serving engine with continuous batching and broad Hugging Face model/quantization support. It adds value for Linux datacenter, multi-user, and high-end workstation serving, but not enough to be the next ordinary workstation adapter. Its current upstream install docs require Linux for working GPU builds; native Windows is unsupported and WSL is an indirect route. Prebuilt CUDA requires compute capability 7.5+, excluding GTX 1060/Pascal. ROCm lists specific architectures (MI200 gfx90a, MI300 gfx942, MI350 gfx950, RX 7900 gfx1100/1101, RX 9000 gfx1200/1201, Ryzen AI MAX/AI 300 gfx1150/1151) and tightly matched wheels. Intel XPU is Linux/Arc or Data Center GPU, not NPU. Apple GPU support is a separately maintained vLLM-Metal project using MLX, not the same vLLM platform profile. GGUF is described as experimental/under-optimized through a plugin.

### SGLang

SGLang’s differentiator is specialized high-throughput, long-context/agentic serving and scheduling, with CUDA/ROCm/XPU/Apple-Metal paths and documented API features. Its current loader docs include GGUF, but its own quantization matrix makes that path hardware-dependent (CUDA and Ascend listed; AMD not listed). Its AMD accelerator support is narrower than “all Radeon” (upstream GPU docs center on Instinct MI300/MI350 families), and its Intel/macOS paths have separate constraints. For a single local developer, most near-term functionality overlaps with llama.cpp/vLLM while increasing engine and qualification matrix size. Keep it out of the initial workstation portfolio; revisit only for a measured server workload.

### Apple Silicon: llama.cpp Metal first, MLX-LM as an optimized profile

llama.cpp Metal is the best first Apple support profile because it retains the same GGUF identity and adapter across Windows/Linux/macOS. MLX/MLX-LM is the strongest Apple-native option: Apple Silicon, Metal, quantized MLX community models, streaming generation, and a local server. It brings an MLX-converted artifact identity and Python/runtime lifecycle of its own. Recommendation: qualify llama.cpp Metal as the portable Apple baseline; add MLX-LM only if same-source-model benchmarks or Apple-specific features justify a second adapter/artifact family. Do not represent an MLX-converted package as the same hash/identity as its source safetensors/GGUF artifact.

### Intel: distinguish CPU, Arc, and NPU

There is no one Intel backend choice. For CPU, llama.cpp is the simplest common path; OpenVINO GenAI is also a credible Intel CPU path. For Arc / Data Center GPU, upstream llama.cpp SYCL, Vulkan, vLLM XPU (Linux), and OpenVINO are different build and OS profiles. For Intel NPU, OpenVINO GenAI is the clearest directly documented generative path, but it requires exported/quantized model packages and has restrictions; vLLM XPU is not Intel NPU support. ORT GenAI’s OpenVINO execution-provider route is promising but needs an exact model/provider acceptance pilot before Covert claims it.

### Windows and Qualcomm: no universal accelerator layer

llama.cpp CPU or Adreno OpenCL offers a local Snapdragon route. Upstream also documents experimental Hexagon NPU support; on Windows the build/install instructions require test-signed drivers/ops and platform security changes. Do not ship that as the default. ORT GenAI explicitly documents QNN on Windows ARM64 and Linux ARM64, but the model must be prepared as a QNN-targeted ONNX GenAI package (including compiled QNN graph artifacts). That is a real sovereign path, with a material conversion and package-provenance burden.

DirectML can run some generative model packages through ORT GenAI. It is not a universal “all Windows GPU” layer: model export, operator/provider coverage, performance, telemetry, and provider assignment remain model/device-specific. The ORT GenAI upstream matrix lists AMD GPU as under development. Use distinct profiles for CUDA, DirectML, OpenVINO, and QNN.

AMD Ryzen AI adds a separate Windows NPU path. The AMD Ryzen AI Software repository demonstrates ONNX Runtime GenAI on Ryzen AI NPU, custom model optimization with Olive/Quark, and Windows ML/Foundry Local flows; ORT GenAI’s Python examples enumerate `VitisAIExecutionProvider`. However, the ORT GenAI headline support table does not list AMD GPU as supported (it says under development), and the inspected examples do not establish a general Covert-usable AMD provider contract. Classify this as a promising **VitisAI NPU profile**, not AMD GPU support or universal Ryzen AI coverage. Optimized ONNX packages are derived artifacts; Foundry Local is an external service/control plane and would need explicit endpoint/process ownership and response-identity evidence if Covert attached to it.

Windows ML and Foundry Local are platform/product surfaces over runtime and execution-provider stacks, not evidence of a universal accelerator runtime. ORT GenAI examples can use Windows ML to acquire/register execution providers, while the GenAI support table separately lists CPU, CUDA, DirectML, TensorRT-RTX, OpenVINO, QNN and WebGPU; AMD GPU is still marked under development. VitisAI appears in the ORT GenAI examples and AMD Ryzen AI's own OGA/WinML examples, so it merits a narrowly scoped partial NPU profile. The [general ORT execution-provider catalog](https://github.com/microsoft/onnxruntime/tree/690e73121061595a6fc15f1f4b29afcda1d666dc/onnxruntime/core/providers) includes MIGraphX and is broader than this GenAI matrix; provider presence in base ONNX Runtime does not establish a working generative-model route. Windows ML's provider acquisition from Windows Update may ease install, but Covert must still observe the actual provider binary/version/digest and stale a passport when that identity changes. Covert must identify the actual provider/device, bind the model package and driver profile, prove no silent CPU fallback, and own or explicitly govern the process/service lifecycle. Treat the AMD NPU, Qualcomm QNN, DirectML GPU, OpenVINO, WebGPU, TensorRT-RTX and CUDA routes as separate profiles.

### Additional edge and 2025–2026 candidates

**LiteRT-LM** is a serious cross-platform on-device candidate: its pinned upstream describes stable Python/Kotlin/C++ surfaces, Android/JVM desktop support, a Windows/Linux/macOS CLI, tool use, streaming and multimodal models. Models are `.litertlm` packages; GPU/NPU delegation and per-platform native libraries/builds remain target-specific, and the current NPU onboarding is early-access oriented. The Windows GPU build needs DirectX Shader Compiler, but that is not proof of DirectML execution or generic Windows GPU coverage. It is a **WATCH** option for mobile/edge and a possible later desktop packaging experiment, not a replacement for GGUF-first llama.cpp.

**ExecuTorch** has broad mobile/embedded delegates (including Android QNN) and desktop builds, but its LLM runner/server is explicitly experimental and narrow. Models export to `.pte`; this gives mobile/NPU reach but creates a conversion and derived-package identity burden. **MNN-LLM** has mobile/PC/IoT scope with CPU/CUDA/Vulkan/Metal and selected QNN/Hexagon paths, but its documented LLM workflow converts source weights to MNN/QNN packages and requires vendor SDK/runtime pieces. Keep both **WATCH** until Covert has a concrete Android, iOS, or embedded product target.

**KTransformers/KT-Kernel** is a specialized Linux x86-64 MoE CPU/GPU path: AVX2/AVX-512/AMX CPU kernels and optional NVIDIA SM80+ CUDA, with selected SGLang integration. It can improve large MoE execution on constrained GPU memory, but does not add a broad general-model/OS coverage family. Classify **P3**, not as a Covert default.

## Model format and identity rules

| Format / package | Runtime fit from this research | Identity consequence |
|---|---|---|
| GGUF | Native for llama.cpp. vLLM GGUF is experimental via plugin; SGLang has a GGUF loader with backend-dependent quantization; OpenVINO GGUF is preview/limited. | Hash exact downloaded file. A converted GGUF is a new artifact with source lineage, quantization, converter/version, and its own digest. |
| HF Transformers / safetensors | Native ecosystem for vLLM/SGLang; source input for MLX/OpenVINO/TensorRT/MLC workflows; not llama.cpp’s native runtime artifact. | Treat repo revision + every file digest as source identity; each converted runtime package gets a derived identity. |
| AWQ / GPTQ / FP8 | Runtime- and GPU-specific. vLLM has documented support for selected methods and hardware; it is not a portable format promise. | Quantization method, scales/config, target arch, engine kernels, and package files belong in identity. |
| OpenVINO IR | OpenVINO-native after conversion; selected precision/quantization and model graph are part of package. | New derived artifact ID and manifest digest; record exporter, parameters, source revision, and license. |
| ONNX GenAI | ORT GenAI requires graph(s), `genai_config.json`, tokenizer/pre/post files and often provider-specific graph/plugin assets. QNN package may include compiled graph artifacts. | First-class **package** identity is justified, not a generic `ONNX` boolean. Hash every file + canonical manifest and preserve parent source identity. |
| MLX layout | MLX-LM optimized weights/config, often from HF/MLX community and quantized for Apple. | Derived MLX artifact identity, separate from source HF repo revision and source hashes. |
| TensorRT engine | Hardware/runtime-specialized engine/build products. Build and compatibility tied to TensorRT/CUDA/GPU. | Engine plan/package is a derived artifact with exact source hash, builder/runtime/toolchain and hardware/compute target. |
| MLC package | MLC-converted weights plus target-compiled model library/artifacts. | Separate platform/backend-targeted package identity and compiler/build inputs. |
| ORT GenAI / QNN / VitisAI package | ONNX graph(s), GenAI config/tokenizer assets, provider metadata, and when applicable QNN- or AMD-NPU-optimized/compiled assets. | Package-manifest identity with source lineage, provider-specific outputs, optimizer/compiler version, and hashes for every asset; QNN and VitisAI outputs are not interchangeable. |
| ExecuTorch `.pte` | Exported program plus tokenizer/runtime assets. | Derived artifact identity; bind source model revision, export recipe, delegate/build target and per-file hashes. |
| MNN / QNN package | Converted MNN model or vendor-compiled QNN assets. | Derived package identity; record source lineage, converter/SDK/runtime version, target and manifest digest. |
| LiteRT-LM `.litertlm` | Packaged model and metadata for LiteRT-LM. | Hash the exact package and its contents/manifest; preserve original model source and any conversion/quantization lineage. |

Lossless copying, conversion, quantization, and engine compilation are different operations. A source SHA must never be reused as the identity of a transformed package. Keep derivation edges, license/source revision, converter command/options/version, per-file hashes, and final package manifest hash.

## Installation, packaging and redistribution

The license column in the CSV is the upstream project's declared license, not a complete redistribution decision. Runtime dependencies, GPU/accelerator libraries, vendor SDKs, model weights, tokenizer assets and conversion tools each have their own terms and hashes. Covert should pin and verify the exact binary/library variant it launches; an operator-installed executable found on `PATH` is not a verifiable package source.

| Candidate | Upstream packaging / operator burden | Model and build burden | Redistribution / lifecycle implication |
|---|---|---|---|
| llama.cpp | Source/build and upstream prebuilt variants; CPU is simplest. CUDA/HIP/Vulkan/Metal/SYCL are different builds and driver/developer-package paths. | GGUF is native; HF-to-GGUF conversion is a separate acquisition step. Can run as a Covert-owned process. | MIT project license; audit bundled native dependencies and backend libraries. Pin and hash each backend binary. |
| vLLM | Python/PyTorch distribution, platform-matched wheels or container; Linux GPU path, CUDA/ROCm/XPU coupling. | Direct HF checkpoint ecosystem; supported quantization and kernels are hardware-specific. | Apache-2.0 project; container/Python/driver stack is large. CUDA/ROCm wheels and dependencies need exact SBOM/hash and profile pinning. |
| SGLang | Python/PyTorch server or container; accelerator-specific Linux deployment and dependencies. | Primarily HF layout; GGUF loader and quantization are backend-limited. | Apache-2.0 project; operationally a server, so process ownership, auth, loopback, admission and cancellation need explicit adapter control. |
| MLX-LM | Python package on Apple Silicon; Apple toolchain and MLX version are part of the runtime profile. | Uses MLX model layouts/quantization; source HF weights may need conversion. | MIT project; hash Python environment/wheels and converted package; Apple-only host scope. |
| OpenVINO GenAI | Native/Python packages and OpenVINO Runtime device plugins; Intel-focused installation. | Export/quantize to OpenVINO IR; NPU model/precision constraints. | Apache-2.0 project; vendor plugin/driver and converted package must be pinned. Direct library integration may avoid a separate server. |
| ORT GenAI | Python/C/C++ packages; DirectML, OpenVINO, QNN and VitisAI provider bridges/plugins have distinct install and ABI requirements. Vendor tools/SDKs may be needed. | ONNX GenAI package is required; QNN/VitisAI NPU models commonly need Olive/Quark or provider-targeted compile/optimization. | MIT project; verify provider DLL/SO, runtime and package separately. Windows ML/Foundry Local can manage some provider installs but is a separately owned service/API surface. |
| TensorRT-LLM | Python/CUDA stack, container or source build; Linux and NVIDIA GPU floors. | Build/compile TensorRT engine plans for target GPU/runtime; can be expensive and target-specific. | Apache-2.0 project source does not grant unrestricted rights to CUDA/TensorRT dependencies. Engine and build inputs need separate identity. |
| MLC-LLM | Python/Rust/TVM build tooling or prebuilt APIs; target-specific backend compilation and mobile packaging. | Convert weights and often compile per platform/backend. | Apache-2.0 project; package/build dependencies and target-specific outputs require full hashes and licenses. |
| LiteRT-LM | Python CLI, Maven JVM/Android packages, C++ APIs, and platform source builds; Bazel/toolchains or native delegate libraries may be needed. | Consume `.litertlm` packages; reviewed docs do not establish generic direct safetensors/GGUF loading. | Apache-2.0 project; pin C API prebuilt or runtime package and all delegate libraries. Mobile NPU package distribution is target-specific. |
| ExecuTorch | Python export tools; Android AAR, Apple frameworks, C++/Python runtimes and optional delegate toolchains. | Export to `.pte`; delegate-specific conversion/build and tokenizer assets. | BSD license; audit delegates and vendor SDKs separately. Current LLM server/runner maturity is experimental. |
| MNN-LLM | C++ build, platform SDKs and optional QNN/Hexagon/MediaTek libraries; desktop/mobile app integration. | Convert HF/safetensors/GGUF sources into MNN or vendor-targeted packages. | Apache-2.0 project; vendor SDK/runtime terms and derived artifact identities are separate. No Covert server lifecycle was established. |
| KTransformers / KT-Kernel | Linux x86-64 Python wheels for current KT-Kernel; CPU AVX2 floor and optional NVIDIA SM80+ CUDA wheel. | Specialized MoE quantization/layout and SGLang integration; not a general model import flow. | Apache-2.0 project; wheel/build/toolchain pinning is straightforward relative to source builds, but narrow profile maintenance is high. |
| LocalAI | Container and backend gallery/variant packaging; multiple engines and hardware-specific images. | Backend/model configurations and engine-specific artifacts. | MIT project; dependency/orchestration surface is broad. Use its packaging ideas as comparison, not a Covert dependency. |

“Can download” and “can bundle” are not qualification states. A downloadable upstream package must still have an authenticated source, immutable version/build, verified digest/signature where published, a compatible license/dependency inventory, and an exact Covert-owned or explicitly approved lifecycle.

## Minimum portable hardware truth

Avoid an over-designed hardware schema. The minimum fields with direct use in routing/admission/qualification are:

1. **Host identity:** OS family/version/build, process/container/WSL/native environment, OS architecture, runtime process architecture.
2. **CPU:** vendor/model or stable processor identity when available, architecture, logical/physical cores when available, ISA feature set (e.g. AVX2/AVX-512/NEON), memory totals/free, source/time/confidence.
3. **Accelerators as a list:** stable vendor/device identity, family/architecture (raw device ID retained), device type GPU/NPU/other, memory model (dedicated/unified/host-shared/unknown), total/free memory where queryable, driver version, accelerator API/provider + version, enumerator/source/time/confidence. Preserve each device; do not take only first `nvidia-smi` row.
4. **Execution environments:** independently discovered adapter/runtime, backend/provider, runtime binary or library version/build digest, compatible device IDs, install root provenance, and ownership/endpoint/PID lifecycle.
5. **Measurements:** each numeric value includes unit, source, sample time, and nullable/unknown state. Unsupported, permission denied, stale, not sampled, and genuinely zero must remain distinguishable.

Routing needs runtime/device compatibility. Admission needs current available host/device resources. Model fit needs runtime-specific weights + KV/context/cache and shared-memory effects. Qualification needs exact stable identities and tested capability profile. UI needs provenance and a confidence state. Benchmarking needs clocks/power/thermal only when actually reportable; temperature/power are optional, never synthesized.

## Runtime Broker: why the two-slot design fails

The current broker cannot represent selecting a third runtime, two backend variants of one engine, an Apple MLX runtime, an ORT/QNN profile, or multiple discovered candidates without redefining “canonical” and “recovery.” It also cannot distinguish “adapter present” from “runtime installed,” “hardware-compatible,” “artifact-compatible,” “qualified,” or “operator-selected.” In its actual production construction it has no recovery adapter at all.

A registry is warranted by concrete cases, not aesthetics: `llama.cpp + Metal` and `llama.cpp + SYCL` share engine identity but differ in backend/build/driver passport; `ORT GenAI + QNN` vs `ORT GenAI + DirectML` have different artifacts and platform gates; `MLX-LM` cannot be represented as “recovery” behind Unsloth without misleading state. Preserve explicit selection, existing Authority/Admission, and ownership rules.

Suggested state progression (not a fallback policy):

`DISCOVERED → AVAILABLE → COMPATIBLE → QUALIFIED → SELECTED → RUNNING`

Each is separate evidence. `AVAILABLE` means executable/runtime can be reached. `COMPATIBLE` means this artifact and device/profile pass declared constraints. `QUALIFIED` means a non-stale passport covers exact scope/capabilities. `SELECTED` requires operator choice. `RUNNING` requires live health plus runtime-reported/request-bound identity proof. A failure must not silently advance or substitute a different runtime/model.

## Qualification passport recommendation

Use a versioned qualification profile keyed by a canonical digest over:

- adapter family + runtime version + binary/library build commit/digest;
- engine backend/provider and backend version;
- host OS/version/build, native/WSL/container status, process architecture;
- CPU feature floor where CPU execution is used;
- accelerator vendor/device/architecture and driver/runtime version;
- artifact/package format, full manifest digest, exact artifact digest(s), source revision and quantization;
- context, cache and generation parameters that materially affect resource and feature claims;
- tested capabilities: load/unload, identity, streaming, cancellation, tools/structured output, embeddings/multimodal if claimed, resource metrics, restart rediscovery, shutdown/ownership, Local-Only/egress behavior;
- evidence references, test environment, date, result, limitations, and staleness rules.

Qualification is at least the tuple **runtime build × backend/provider × OS/process architecture × hardware architecture/device family × driver/runtime floor × artifact/package × request profile × capability set**. Wildcards are explicit reviewed policy, never inferred from a nearby profile. A passport for vLLM CUDA on Linux does not qualify XPU; llama.cpp HIP gfx1100 does not qualify gfx900; one RTX model does not automatically qualify every CUDA card. Where identity cannot be observed, record `UNKNOWN` and do not qualify beyond evidence.

## Governance and packaging requirements

The adapter layer must preserve Authority before any tool execution; Resource Admission before load/inference; requested-vs-runtime-reported model identity; hash verification before load; credential isolation for any external server; explicit loopback/endpoint ownership; egress and Local-Only policy; request cancellation that reaches the engine; shutdown only for Covert-owned process; stale PID/port rejection after restart; and audit records for profile selection/fallback. An OpenAI-compatible URL supplies none of these by itself.

Prefer Covert-owned pinned binaries or libraries with verified digest and explicit license inventory. If an operator-installed runtime is allowed, identify exact path/version/build and ownership; never silently use whatever executable appears on `PATH`. Pin download sources, hashes/signatures, dependency/runtime versions, and platform variant. Python/container/vendor SDK/model conversion should be surfaced as install burden and isolated. Runtime license and model license are separate; package license review must include dependencies and redistribution terms. NVIDIA/CUDA/TensorRT components and proprietary vendor SDKs require separate redistribution review.

## Priority scoring

Scores are 0–5; **higher is more favorable**. For `Install burden` and `Maintenance burden`, 5 means low burden/easier. These are architecture scores from upstream evidence, not benchmark results. Product demand/strategic value reflects Covert’s local-first developer workstation goal. `P0` means architecture/coverage needed before broad V1 claims; `P1` is the next valuable profile; `P2` is justified expansion; `P3` niche; `WATCH` requires better maturity/value evidence; `REJECT` means not a Covert default/dependency.

| Candidate | HW | OS | Models | Perf | Offline | Integration | Lifecycle | Identity | Install | Maintain | Demand | Strategy | Total | Priority / decision |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| llama.cpp adapter family | 5 | 4 | 2 | 3 | 5 | 4 | 4 | 4 | 3 | 3 | 5 | 5 | 47 | **P0** broad local baseline; GGUF only and profile-specific |
| ONNX Runtime GenAI | 4 | 4 | 3 | 3 | 5 | 2 | 3 | 4 | 2 | 2 | 4 | 5 | 41 | **P1** QNN/Windows ARM first; separate EP/package profiles |
| OpenVINO GenAI | 2 | 3 | 3 | 3 | 5 | 3 | 3 | 4 | 3 | 3 | 3 | 4 | 39 | **P2** Intel CPU/GPU/NPU if ORT path fails acceptance |
| vLLM | 3 | 2 | 5 | 5 | 5 | 3 | 2 | 4 | 1 | 2 | 4 | 4 | 40 | **P2** Linux serving/high throughput, not default workstation |
| MLX-LM | 1 | 1 | 3 | 4 | 5 | 3 | 3 | 3 | 3 | 3 | 3 | 4 | 36 | **P2** Apple-specific, only after benchmark case |
| MLC-LLM | 4 | 4 | 3 | 3 | 5 | 2 | 3 | 4 | 1 | 1 | 2 | 3 | 35 | **P2/WATCH** mobile/edge/WebGPU, high compile burden |
| LiteRT-LM | 4 | 4 | 2 | 3 | 5 | 2 | 3 | 3 | 2 | 2 | 2 | 3 | 35 | **WATCH** cross-platform edge package; GPU/NPU profile proof needed |
| ExecuTorch | 4 | 3 | 3 | 3 | 5 | 2 | 2 | 3 | 1 | 2 | 2 | 3 | 33 | **WATCH** mobile/embedded; LLM server is experimental |
| MNN-LLM | 4 | 4 | 3 | 3 | 5 | 2 | 2 | 3 | 1 | 2 | 2 | 3 | 34 | **WATCH** mobile/Qualcomm edge; converted package burden |
| KTransformers / KT-Kernel | 2 | 2 | 1 | 5 | 5 | 2 | 2 | 2 | 1 | 1 | 1 | 2 | 26 | **P3** Linux MoE specialization |
| SGLang | 3 | 2 | 4 | 5 | 5 | 2 | 2 | 3 | 1 | 1 | 2 | 2 | 32 | **P3** specialized server research only |
| TensorRT-LLM | 1 | 1 | 4 | 5 | 5 | 2 | 2 | 4 | 1 | 1 | 3 | 2 | 31 | **P3** NVIDIA enterprise performance niche |
| LocalAI | 5 | 4 | 4 | 3 | 5 | 1 | 2 | 2 | 3 | 1 | 3 | 1 | 34 | **REJECT as dependency**; use as architecture comparison |

## Answers to the 18 decision questions

1. **Smallest broad runtime set:** llama.cpp + ORT GenAI, with separate backend/provider profiles and artifact identities. ORT GenAI can cover selected QNN and VitisAI NPU packages as well as DirectML/OpenVINO profiles, each requiring separate qualification. Add MLX-LM only if an Apple-native performance/feature case is measured. This reaches broad CPU/GPU portability and several Windows NPU/provider paths without twenty engines; it still does not promise every device/model combination. LiteRT-LM/ExecuTorch/MNN are for a separately scoped mobile/edge target.
2. **Is llama.cpp universal?** No. It is the best broad compatibility runtime, but it is GGUF-first, accelerator build/profile-specific, and not enough for every NPU/model format/Windows ARM path.
3. **Where does it stop?** Non-GGUF-native ecosystems; unsupported model operations/quantization; provider/driver build mismatch; hardware floors; limited Covert adapter features; Windows Hexagon test-signing/security concern; lack of device/OS-aware qualification. CPU fallback also does not make a device performant or resource-admissible.
4. **Does vLLM merit native adapter now?** Not for V1 workstation coverage. Yes later for Linux server/multi-user throughput, continuous batching and broader HF quantized models. Current Linux, CUDA floor, ROCm architecture matrix, Python/CUDA build burden and GGUF limitations leave gaps in ordinary Windows/legacy hardware.
5. **Does SGLang differ materially?** Yes for optimized high-concurrency, long-context, agentic/server workloads; no compelling unique first-run workstation coverage. Defer as specialized serving.
6. **Apple: Metal or MLX?** llama.cpp Metal first for common GGUF and adapter consistency. MLX-LM is the best Apple-native optimized profile if benchmarks/features justify the extra runtime and MLX artifact family.
7. **Intel path?** CPU: llama.cpp, with OpenVINO GenAI also plausible. Arc/Data Center GPU: qualify llama.cpp SYCL/Vulkan or vLLM XPU on Linux; OpenVINO is the Windows/Intel-specific alternative. Intel NPU: OpenVINO GenAI first; ORT GenAI+OpenVINO EP is a pilot, not yet assumed. Distinguish all three hardware classes.
8. **Windows generic GPU?** Use the Windows-native llama.cpp CPU/Vulkan profile for broad local coverage, then selected DirectML through ORT GenAI for exact supported model packages. LiteRT-LM documents a Windows GPU build requiring DirectX Shader Compiler, but the reviewed docs do not prove DirectML or vendor-neutral model coverage, so it remains a WATCH candidate. Prefer vendor-specific CUDA/ROCm/OpenVINO/QNN/VitisAI profiles when applicable. Do not auto-fallback across them.
9. **Can DirectML support generation?** Yes for selected ORT GenAI/model/provider combinations; it is not universal Windows LLM acceleration. Execution-provider availability alone is not generative model compatibility, good performance, telemetry, or a Covert qualification.
10. **Snapdragon/Qualcomm NPU?** ORT GenAI QNN with an explicitly QNN-prepared ONNX GenAI package is the strongest governed route evidenced for Windows ARM64/Linux ARM64. Keep llama.cpp CPU/Adreno as secondary. Do not beta-promote Windows Hexagon until its current signing/security requirements are acceptable and the exact profile is tested. For AMD Ryzen AI NPU, ORT GenAI + VitisAI is a separate promising Windows profile; AMD's own repo demonstrates the path, but exact model/provider/device support still needs qualification.
11. **First-class ONNX identity?** Yes, as a **GenAI model package**, not arbitrary ONNX. Bind graph(s), tokenizer/pre/post assets, config, provider package/plugin and all file hashes in a manifest; retain parent model lineage.
12. **Which convert?** OpenVINO IR; ORT GenAI ONNX packages and QNN/VitisAI-optimized graphs; MLX weights; TensorRT engine plans; MLC weights/model libraries; ExecuTorch `.pte`; MNN/QNN packages; LiteRT-LM `.litertlm`; GGUF conversion from HF source. Each converted package is a derived identity. vLLM and SGLang consume HF checkpoint layouts directly, and SGLang also documents a backend-limited GGUF loader; offline quantization/conversion may produce another artifact.
13. **Canonical + one recovery enough?** No for multiple discovered/selectable families and same engine with multiple backends. Evidence supports a small explicit adapter/profile registry. Do not generalize beyond this need.
14. **How passports scale?** Key them by runtime build × backend/provider × OS/process architecture × hardware/driver profile × artifact/package digest × request profile × tested capability set. Exact matches only unless an explicit, reviewed scope rule covers a family.
15. **Which contracts block it?** `RuntimeBackend`, canonical literal, two-adapter `RuntimeBroker`, recovery event enum, runtime qualification identity, model-access runtime literals/basis, hardware `vramSource` and backend enums, GGUF-only model runtime/manager, admission probe contract, generated OpenAPI, and adapter-specific tool attribution; see [RUNTIME_ARCHITECTURE_GAP_MAP.md](RUNTIME_ARCHITECTURE_GAP_MAP.md).
16. **Fix before another backend?** Registry/status state; portable host/runtime/device/artifact profile contracts; passport matching and stale rules; truthful hardware probe + provenance; profile-specific admission; package artifact identity/manifest; generated OpenAPI and test fixtures. Keep Authority, admission, local-only and ownership semantics strict.
17. **Next backend after llama.cpp/ROCm?** ORT GenAI, first QNN Windows ARM64 on one supported model package, then selected DirectML/OpenVINO profiles after distinct exact-SHA qualification. This adds device classes llama.cpp does not cleanly cover and can reuse one runtime family without pretending providers are interchangeable.
18. **What not to implement?** Do not add SGLang, TensorRT-LLM, LocalAI, or a new OpenVINO adapter as the next default. Do not add MLX-LM, MLC, LiteRT-LM, ExecuTorch, or MNN-LLM until Apple/mobile/edge acceptance targets exist; keep KTransformers specialized. Do not treat an OpenAI-compatible endpoint as a Covert runtime adapter.

## Qualification boundary

This audit is **RESEARCHED / CLASSIFIED / PRIORITIZED / ARCHITECTURE IMPACT IDENTIFIED**. It does not claim any new runtime, operating system, hardware family, accelerator, artifact format, or candidate profile is Covert `SUPPORTED`, `QUALIFIED`, or `READY`. The only qualification claim referenced here is the exact frozen passport present in the baseline repository.
