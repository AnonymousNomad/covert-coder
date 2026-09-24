# Covert Local Runtime Backend Evaluation

- **Status:** Historical RT0–RT4 research record; superseded by the Unsloth product decision and Runtime Broker implementation
- **Evidence cut:** 2026-09-24
- **Scope:** local inference only; no cloud providers, credentials, production wiring, or runtime installation

## RT0 — isolated lane record

- Canonical repository: E:/aide-sovereign-workbench
- Worktree: E:/aide-sovereign-workbench-runtime-lab
- Branch: research/local-runtime-bakeoff
- Starting SHA: b4efac65da4650dd81bd3a85da72d992bc526b8a
- Base: clean local feat/harness-vnext-h3 worktree at the H3-compatible architecture-safe state; that base was two documentation-only commits ahead of its remote tracking branch.
- Initial worktree state: clean at the starting SHA.
- Runtime ownership at inspection: the historical PID 23856 was absent. A separate llama-server process, PID 28556, was present. Its working set was 3,213,967,360 bytes and private bytes were 1,603,076,096. No benchmark request was sent to it and its process was not stopped or modified.
- Machine snapshot: 3,803 MiB available physical memory; 26,459,615,232 committed bytes of a 31,443,066,880-byte commit limit (84%); GTX 1060 6 GB reported 880 MiB used and 23% utilization at the sample instant. These are transient system readings, not runtime measurements.
- Final pre-commit snapshot: one active, unqualified llama-server PID 17484 (started 2026-09-24 08:51:34 local), working set 3,113,844,736 bytes and private bytes 1,504,743,424. System commit was 25,379,328,000 / 31,443,066,880 bytes (80.7%) with 3,225,481,216 bytes available physical; the GTX 1060 reported 933 MiB used, 14% utilization, and 49 C. Per-process VRAM was unavailable. The runtime was treated as foreign; no endpoint or model was queried and no process was changed.
- Result: all model runs and backend installs are deferred until runtime ownership and memory headroom are clear.

## Evidence labels

- **FACT** — documented by an authoritative project, platform, or license source.
- **SOURCE OBSERVATION** — behavior visible in the cited project's current source code.
- **VENDOR CLAIM** — a product claim not independently validated here.
- **INFERENCE** — a design conclusion drawn from the stated facts.

## Resulting product decision — 2026-09-24

The source research below remains historical evidence. The engineering decision is now settled:

- **Canonical local backend:** Unsloth Studio/runtime.
- **Normal path:** Covert Runtime Broker → Unsloth → local model execution.
- **Direct llama.cpp:** internal reference and explicit recovery adapter only; not the ordinary user default.
- **Ollama and LM Studio:** no production adapters in this slice; the RuntimeAdapter boundary remains open to developer extensions.
- **Runtime selection research:** closed. No AUTO policy or backend winner comparison is part of the product plan.
- **Distribution:** external user installation in this slice. Covert does not bundle or copy Unsloth Studio source pending licensing/compliance review.
- **Performance:** no backend speed winner is claimed. Unsloth must qualify per model and machine before a configuration is marked qualified.

The original RT0 resource snapshot and RT5–RT8 deferrals describe that research checkpoint only. The active ownership rules and implementation state are in [RUNTIME-ADAPTER-CONTRACT.md](RUNTIME-ADAPTER-CONTRACT.md) and [RUNTIME-BENCHMARK-METHODOLOGY.md](RUNTIME-BENCHMARK-METHODOLOGY.md).
- **UNVERIFIED** — not established by documentation or a safe local experiment in this lane.

## Unsloth Desktop / Studio

### Architecture and formats

- **FACT:** The Unsloth project currently distinguishes Unsloth Desktop, the Studio web UI, and Unsloth Core. Its repository provides desktop installers for Windows, macOS, and Linux variants. [Project README](https://github.com/unslothai/unsloth/blob/main/README.md#L195-L285)
- **SOURCE OBSERVATION:** GGUF inference is delegated to a llama-server backend. Non-GGUF inference is loaded through Unsloth's inference orchestrator, which uses a subprocess for the ML work and can replace that subprocess when a model requires a different Transformers version. [CLI inference routing](https://github.com/unslothai/unsloth/blob/main/unsloth_cli/_inference.py#L3140-L3255), [orchestrator](https://github.com/unslothai/unsloth/blob/main/studio/backend/core/inference/orchestrator.py)
- **SOURCE OBSERVATION:** The GGUF helper defaults to a per-user Unsloth llama.cpp directory, permits UNSLOTH_LLAMA_CPP_PATH, uses upstream ggml-org release binaries for CPU, and uses an Unsloth-maintained llama.cpp fork for published GPU bundles. [GGUF backend helper](https://github.com/unslothai/unsloth-zoo/blob/main/unsloth_zoo/llama_cpp.py)
- **SOURCE OBSERVATION:** GGUF CLI inference accepts llama-server extra arguments and draft-model paths for MTP, DFlash, and DSpark; source also routes speculative modes including n-gram choices. These are engine-level options, not proof that every option has a Desktop control. [CLI inference source](https://github.com/unslothai/unsloth/blob/main/unsloth_cli/_inference.py)
- **SOURCE OBSERVATION:** The installer can select CPU, CUDA, Vulkan, ROCm, or automatic llama.cpp backend selection. A custom llama.cpp path and CPU-thread cap are also exposed. The exact Windows GPU bundle is an Unsloth-maintained fork, so its version/build must be recorded separately from upstream llama.cpp. [README advanced options](https://github.com/unslothai/unsloth/blob/main/README.md#L464-L489), [GGUF helper](https://github.com/unslothai/unsloth-zoo/blob/main/unsloth_zoo/llama_cpp.py)
- **FACT:** README and source enumerate GGUF, Safetensors / Hub model loading, and an Apple MLX inference path. The exact supported architecture, quant, device, and release combination is model-specific. [README](https://github.com/unslothai/unsloth/blob/main/README.md#L231-L245), [inference source](https://github.com/unslothai/unsloth/blob/main/unsloth_cli/_inference.py)
- **SOURCE OBSERVATION / VENDOR CLAIM:** Studio advertises vision and embedding-model support. Its inference backend has a `FastVisionModel` path for vision models; GGUF vision uses the llama.cpp route and requires a compatible model/projector. The sources reviewed do not establish a general OpenAI-compatible embeddings endpoint, so model-level embedding support and API-level embeddings remain separate capabilities. [Studio inference source](https://github.com/unslothai/unsloth/blob/main/studio/backend/core/inference/inference.py), [API announcement](https://github.com/unslothai/unsloth/discussions/5285), [Studio announcement](https://github.com/unslothai/unsloth/discussions/4370)
- **VENDOR CLAIM:** Windows, Linux, WSL, macOS, NVIDIA, AMD, Intel, CPU, Vulkan, and Apple Silicon are advertised. The claims span distinct backends and must not be interpreted as every format/backend combination working on every operating system. [README](https://github.com/unslothai/unsloth/blob/main/README.md#L231-L240)
- **SOURCE OBSERVATION:** The Linux Studio setup script states a CUDA Toolkit 12.4 minimum for building llama.cpp. The Windows setup separately detects compute capability and checks whether the selected NVCC supports the architecture before configuring a source build. Neither observation establishes the architecture support of a published Windows GPU bundle. [Linux setup source](https://github.com/unslothai/unsloth/blob/main/studio/setup.sh#L2586-L2696), [Windows setup source](https://github.com/unslothai/unsloth/blob/main/studio/setup.ps1#L1031-L1063)
- **UNVERIFIED:** This lane did not test AMD, Intel, CPU-only, Apple Silicon, or Linux installations.

### API, control, and operations

- **FACT:** The project documents OpenAI-compatible Chat Completions, OpenAI Responses, and Anthropic Messages endpoints; source and release material also show streaming and tool calls. Compatibility is endpoint-specific, not proof of complete conformance to each vendor specification. [API announcement](https://github.com/unslothai/unsloth/discussions/5285), [release notes](https://github.com/unslothai/unsloth/releases)
- **FACT:** The CLI advertises an Unsloth Start integration for Codex; this is an integration entry point, not an end-to-end Codex qualification result from this lane. [CLI integration overview](https://github.com/unslothai/unsloth/blob/main/README.md#L246-L259)
- **SOURCE OBSERVATION:** The CLI uses /api/health for readiness and invokes /api/inference/load and /api/inference/unload; GGUF requests are routed to llama-server. The Studio API and CLI can therefore manage a loaded model, while the underlying engine and process topology differ by format. [Studio CLI source](https://github.com/unslothai/unsloth/blob/main/unsloth_cli/commands/studio.py), [inference source](https://github.com/unslothai/unsloth/blob/main/unsloth_cli/_inference.py)
- **SOURCE OBSERVATION:** Studio has a headless CLI launch path, configurable host and port, API keys, custom storage roots, and a custom llama.cpp location. UNSLOTH_STUDIO_HOME and the isolated-cache options permit an installation rooted outside the default user directory. [README launch/install options](https://github.com/unslothai/unsloth/blob/main/README.md#L283-L327), [advanced installation](https://github.com/unslothai/unsloth/blob/main/README.md#L390-L489)
- **SOURCE OBSERVATION:** Model recommendations can issue an HTTP request to the Hugging Face Hub. The code checks HF_HUB_OFFLINE / TRANSFORMERS_OFFLINE-compatible settings before that catalog fetch. Local cached inference is possible, but the installer, model download, updates, and optional discovery are network operations. [model discovery source](https://github.com/unslothai/unsloth/blob/main/studio/backend/core/inference/orchestrator.py#L2923-L3070)
- **SOURCE OBSERVATION:** Backend code uses structured logging and writes server lifecycle/request events. The current log destination, rotation, retention, and telemetry behavior were not audited on an installed Desktop build. Do not infer that logging implies telemetry or that telemetry is absent.
- **VENDOR CLAIM:** Unsloth advertises automatic/self-healing tool handling. The external API does not establish whether a valid tool call came directly from model tokens or was repaired by Studio. Raw pre-parser output and repair provenance must be captured before crediting model capability. [Project README](https://github.com/unslothai/unsloth/blob/main/README.md#L231-L240)
- **UNVERIFIED:** Telemetry collection, crash-restart guarantees, clean shutdown under load, exact Windows installer footprint, automatic file-system discovery boundaries, and whether all Responses API features work for every engine.
- **UNVERIFIED:** Whether Desktop exposes the llama.cpp mmap, RAM cache, KV-cache, speculative, and batch controls through its UI/API; GGUF command paths can accept custom llama-server arguments, but the supported option set needs a local feature probe.

### Licensing and Covert fit

- **FACT:** The root Unsloth project uses Apache-2.0 while Studio source carries AGPL-3.0 notices. Unsloth's llama.cpp fork and packaged dependencies require their own license inventory. [Core license](https://github.com/unslothai/unsloth/blob/main/LICENSE), [Studio license](https://github.com/unslothai/unsloth/blob/main/studio/LICENSE.AGPL-3.0)
- **INFERENCE:** User-managed use through published local APIs is the lowest-commitment evaluation path. Managed download-and-launch is technically plausible, but needs a pinned release, install-footprint review, offline audit, and a component-level distribution review. Bundling cannot be approved from the root license alone.
- **INFERENCE:** Covert should treat Unsloth as a possible optional adapter, not as its serving engine. It provides management features, but GGUF requests ultimately run through llama.cpp and non-GGUF requests take a different resource and software path.

## Direct llama.cpp

- **FACT:** llama.cpp is a portable C/C++ inference project with CPU, CUDA, HIP, Vulkan, SYCL, and Apple Metal paths, including CPU/GPU hybrid offload. GGUF is its primary model container. [Project README](https://github.com/ggml-org/llama.cpp/blob/master/README.md), [GGUF specification](https://github.com/ggml-org/ggml/blob/master/docs/gguf.md)
- **FACT:** llama-server exposes OpenAI-style Chat Completions, Responses and embeddings, plus an Anthropic-style Messages endpoint. The project expressly limits its compatibility claim; tool calls depend on the model chat template and Jinja mode. JSON-schema-constrained output, streaming, parallel slots, continuous batching, health, and optional Prometheus metrics are documented. [Server README](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md)
- **FACT:** Current llama.cpp documentation exposes experimental multimodal image, audio, and video input through libmtmd and the chat API for supported models/projectors. [Multimodal documentation](https://github.com/ggml-org/llama.cpp/blob/master/docs/multimodal.md)
- **FACT:** The direct server exposes controls for context, batch, threads, GPU layers, mmap, KV-cache type and RAM caching, speculative decoding, parallel slots, and router-mode model load/unload. [Server README](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md), [speculative decoding guide](https://github.com/ggml-org/llama.cpp/blob/master/docs/speculative.md)
- **FACT:** The project license is MIT; inspect and preserve notices for bundled dependencies. [License](https://github.com/ggml-org/llama.cpp/blob/master/LICENSE)
- **SOURCE OBSERVATION:** In the current upstream CUDA CMake default architecture selection, non-native builds include Pascal 6.1 only when the CUDA Toolkit is below 13. A local driver reporting CUDA 13.0 does not identify the installed Toolkit or the architectures embedded in any existing binary; inspect the exact build before qualifying GTX 1060 CUDA offload. [CUDA build configuration](https://github.com/ggml-org/llama.cpp/blob/master/ggml/src/ggml-cuda/CMakeLists.txt#L717-L764)
- **INFERENCE:** It is the strongest sovereign baseline because Covert can pin and own the executable, model path, command line, loopback port, and shutdown lifecycle. This is a control and auditability recommendation, not a speed result.
- **UNVERIFIED:** The exact local llama.cpp source revision, binary build flags, CUDA capability, and launch configuration were not established. The active llama-server belongs to another lane and was not queried or reused.

## Ollama

- **FACT:** Ollama runs as a Windows background application with a local API at localhost:11434; its Windows documentation also describes a standalone CLI/GPU package for running the daemon as a service. [Windows documentation](https://github.com/ollama/ollama/blob/main/docs/windows.mdx)
- **FACT:** A local GGUF can be imported through a Modelfile using a file path. The Modelfile also carries template and generation settings; retain the source file hash and record Ollama's resulting model digest separately. [Modelfile documentation](https://docs.ollama.com/modelfile)
- **FACT:** Ollama documents OpenAI Chat Completions, stateless Responses support, Anthropic Messages compatibility, function tools, streaming, JSON-schema output, model listing, loaded-model state, and keep-alive/unload controls. [OpenAI API](https://docs.ollama.com/api/openai-compatibility), [Anthropic API](https://docs.ollama.com/api/anthropic-compatibility), [running models](https://docs.ollama.com/api/ps), [chat API](https://docs.ollama.com/api/chat)
- **FACT:** The native chat API accepts image arrays for vision-capable models; embeddings are available through the native `/api/embed` endpoint with embedding models. [Vision documentation](https://docs.ollama.com/capabilities/vision), [embeddings documentation](https://docs.ollama.com/capabilities/embeddings)
- **FACT:** Current source documents OLLAMA_NO_CLOUD=1 and a server.json setting for disabling remote inference and web search. Covert's R9 profile must set this explicitly and verify that only loopback local models are used. [FAQ](https://github.com/ollama/ollama/blob/main/docs/faq.mdx), [environment source](https://github.com/ollama/ollama/blob/main/envconfig/config.go)
- **FACT:** Current GPU documentation lists the GTX 1060 as compute capability 6.1 and requires driver 570 or newer for NVIDIA compute capabilities 5.0–6.2. The observed local driver is 582.28, which meets that documented minimum; actual loading, offload, and memory fit remain untested. [GPU support documentation](https://github.com/ollama/ollama/blob/main/docs/gpu.mdx#L193-L224)
- **FACT:** Ollama's core repository is MIT-licensed. A packaged release also contains llama.cpp and other components whose licenses and notices must be audited. [License](https://github.com/ollama/ollama/blob/main/LICENSE), [packaging license registry](https://github.com/ollama/ollama/blob/main/llama/server/CMakeLists.txt)
- **INFERENCE:** Ollama is a strong low-friction user-managed or Covert-launched external service candidate. Do not equate its model digest with the original GGUF file hash without verifying the imported blob.
- **UNVERIFIED:** This lane did not install Ollama or test its Windows service, memory behavior, GGUF import fidelity, or automatic unload behavior on the target system.

## LM Studio

- **FACT:** LM Studio serves GGUF with llama.cpp on Windows, Linux, and macOS, and has an MLX engine path on Apple Silicon. It documents a headless llmster service as well as GUI, CLI, and local REST control. [Product architecture](https://lmstudio.ai/docs/app), [headless mode](https://lmstudio.ai/docs/developer/core/headless), [CLI](https://lmstudio.ai/docs/cli)
- **FACT:** Its local interfaces include OpenAI-compatible Chat Completions, Responses, embeddings, and an Anthropic-compatible Messages endpoint, plus a native API with model list/load/unload and stateful chats. Feature coverage varies by endpoint. [REST overview](https://lmstudio.ai/docs/developer/rest), [OpenAI API](https://lmstudio.ai/docs/developer/openai-compat), [Anthropic API](https://lmstudio.ai/docs/developer/anthropic-compat)
- **FACT:** LM Studio documents image input for VLMs through its local inference APIs; actual image support depends on the selected model and inference engine. [Image input documentation](https://lmstudio.ai/docs/python/llm-prediction/image-input)
- **FACT:** The lms CLI can start/stop the server, list/load/unload models, set GPU offload and context length, and manage the active inference runtime. GGUF import and a path are available for externally held files. [CLI](https://lmstudio.ai/docs/cli), [load command](https://lmstudio.ai/docs/cli/local-models/load), [import](https://lmstudio.ai/docs/app/advanced/import-model)
- **FACT:** The desktop application is governed by proprietary Terms of Service. The terms grant personal/internal-business use, permit integration through published interfaces, and restrict redistribution, sublicensing, and transfer. The lms CLI itself is MIT-licensed. [App terms](https://lmstudio.ai/app-terms), [CLI license note](https://lmstudio.ai/docs/cli)
- **INFERENCE:** It is technically well-managed through documented APIs and CLI, but Covert should not bundle or redistribute the desktop app. User-managed installation is the prudent initial model; any managed wrapper must stay within published interfaces and the user's license.
- **UNVERIFIED:** This lane did not install or run LM Studio/llmster, enumerate its runtime version, or verify startup/shutdown reliability on this machine.

## Format strategy

| Format / ecosystem | Hardware, runtime, and quantization | Portability and distribution | Tool support and loading complexity | Covert Model Pack policy |
|---|---|---|---|---|
| GGUF | **FACT:** GGML inference container used by llama.cpp and the four primary backends. Quantization variants run through CPU/GPU/hybrid paths where that backend/build supports them. | Often one file for a single-shard text model; sharded and multimodal models can need more files such as a projector. Artifact bytes can be hashed and copied without conversion. Model license still controls distribution. | Direct runtime loading is common, but chat template, tokenizer metadata, tool parser, and multimodal sidecars must match the model. GGUF does not guarantee identical API/tool behavior. | **INFERENCE:** Tier 1 portable default; preserve exact artifact SHA-256, template, quantization, sidecars, license, and qualified backend set. |
| Safetensors | **FACT:** Tensor serialization, not a runtime or quantization format. A framework must implement the model architecture and hardware kernels. It avoids pickle deserialization. [Safetensors docs](https://huggingface.co/docs/safetensors) | Commonly distributed with config, tokenizer, generation config, and sometimes multiple weight shards or custom model code. | Loading depends on matching framework, architecture implementation, tokenizer, and model configuration; chat/tool behavior comes from those components. | **INFERENCE:** Tier 2 source or backend-native pack for runtimes such as Transformers/Unsloth; not a universal local-server artifact. |
| GPTQ / AWQ | **FACT:** Weight-quantization layouts with runtime/kernel/device-specific support. The AutoGPTQ repository is archived/unmaintained and points to GPTQModel; AutoAWQ is deprecated, and its NVIDIA prerequisite is compute capability 7.5+, above this GTX 1060's 6.1. Other runtimes may support these layouts, but target fit is unverified. [AutoGPTQ status](https://github.com/AutoGPTQ/AutoGPTQ), [AutoAWQ status and prerequisites](https://github.com/casper-hansen/AutoAWQ), [Ollama GPU table](https://github.com/ollama/ollama/blob/main/docs/gpu.mdx#L193-L224) | Often tied to particular architecture, bit width, group size, kernel, and runtime conventions; conversions can create different artifacts. | Requires a compatible quantized loader/kernel and its tokenizer/template metadata. Tool support remains an API/model feature, not a property of GPTQ/AWQ. | **INFERENCE:** Optional Tier 2 only after exact backend, device, and tool-path qualification; not the interchange default. |
| MLX | **FACT:** Apple Silicon-oriented framework/runtime and model ecosystem; Unsloth and LM Studio document MLX paths on Apple Silicon. [MLX](https://github.com/ml-explore/mlx), [MLX-LM](https://github.com/ml-explore/mlx-lm), [LM Studio architecture](https://lmstudio.ai/docs/app) | MLX-native model artifacts can be optimized for Apple hardware and are not portable Windows/GTX artifacts. | Requires MLX-compatible model conversion, tokenizer/template data, and runtime; API and tool behavior depend on the serving wrapper. | **INFERENCE:** Optional Apple-native variant; retain a cross-platform source or GGUF artifact when the model license permits. |
| ONNX | **FACT:** ONNX Runtime GenAI publishes CPU, CUDA, and DirectML packages; Windows docs recommend WinML for some scenarios and mark DirectML as sustained engineering. [GenAI install](https://onnxruntime.ai/docs/genai/howto/install.html), [Windows guidance](https://onnxruntime.ai/docs/get-started/with-windows.html) | Exported graph/weights may use companion files and require a compatible execution provider; graph conversion can specialize the artifact. | Chat templates, tokenization, tool routing, and structured-output control may need companion runtime/configuration code; not automatically an OpenAI chat server. | **INFERENCE:** Specialized deployment export after a concrete Windows/provider use case; not the initial general chat/tool pack default. |

## Product integration models

| Backend | A: user installs; Covert discovers/connects | B: Covert installs/configures/launches/stops | C: bundled |
|---|---|---|---|
| llama.cpp | Yes; Covert can discover an executable or endpoint and verify version/hash. | Yes; strongest process ownership because Covert can launch a pinned child with explicit flags. | Technically viable under MIT plus third-party notices; build-specific license inventory required. |
| Unsloth | Yes; documented local API and CLI. | Technically plausible with isolated Studio home, CLI lifecycle, and model load/unload; test footprint and offline behavior first. | Conditional only after AGPL and full dependency/binary notice review. |
| Ollama | Yes; local daemon API and CLI. | Technically plausible with a pinned user-scoped service/process, OLLAMA_NO_CLOUD=1, and explicit model lifecycle. | Technically plausible under MIT plus bundled dependency terms/notices; do not bundle model weights by default. |
| LM Studio | Yes; documented APIs and lms/llmster. | Process control exists, but account for proprietary app terms and rely only on published interfaces. | No for the desktop app under current terms; the separately MIT-licensed CLI is not the whole runtime. |

## Historical preliminary verdict (superseded; no controlled measurements)

**Research result:** multiple local runtimes have viable documented serving paths; this research contains no controlled performance winner.

**Product decision (2026-09-24):** Unsloth is the canonical Covert local backend. Direct llama.cpp is the internal reference/recovery path. Runtime selection is closed; no AUTO policy or co-equal backend picker is planned.

- **DEFAULT SOVEREIGN BASELINE:** direct llama.cpp/llama-server, launched as a Covert-owned loopback process with a pinned binary and explicit settings.
- **BEST MANAGED RUNTIME CANDIDATE:** no empirical winner is established. Ollama and Unsloth are the first managed-service candidates to test: Ollama for headless process/API control and permissive core licensing; Unsloth for model-management features and multi-engine choice. A platform-specific decision requires controlled runs and component-license review.
- **BEST SIMPLE USER-MANAGED OPTION:** Ollama is the first low-friction local API candidate under an explicit cloud-disabled profile. LM Studio is a strong user-operated desktop/headless option when its terms and separate installation are acceptable.
- **RUNTIME BROKER JUSTIFIED:** YES, as a narrow research and future integration boundary. Backend lifecycle, protocol, model identity, settings, and metrics differ materially; the Broker should expose capability flags and retain backend-native controls rather than claim a false common denominator.
- **UNSLOTH WORTH INTEGRATING:** CONDITIONAL. Its source shows actual headless control, multiple engines, and local APIs, but the GGUF route already uses llama-server. Measure its value as a management layer and its resource/license/telemetry costs before adopting it.

## Fact, inference, open questions

### Fact

- Four primary engines have local serving paths and documented lifecycle/API capabilities.
- Unsloth GGUF serving ultimately uses llama-server; its non-GGUF path is separate.
- GGUF has the broadest overlap across the four primary candidates.
- No backend was installed or benchmarked in this lane.

### Historical inference (before the product decision)

- Covert should own a direct llama.cpp baseline and use adapter-level optional capabilities for managed runtimes.
- A Broker is justified for discovery, policy, evidence capture, and resource admission; it should not translate every backend feature into a lowest-common-denominator API.
- Model Pack identity should preserve both original artifact SHA-256 and backend-native import digest.

### Open questions

- Which modest already-owned GGUF is available without Resident ownership, and what is its SHA-256?
- Which llama.cpp binary/revision and CUDA build are installed in a clean test slot?
- Does Unsloth Desktop's current Windows bundle provide clean install isolation, zero unwanted telemetry, and deterministic offline serving?
- How does each backend handle the frozen model's chat template, tool parser, structured output, cancellation, context overflow, repeated loads, and idle model retention?
- Can a lease safely identify LM Studio's model file and engine version, and Unsloth's model-server child process, without depending on unstable internals?

## Production boundary

This table records the earlier RT0–RT4 research boundary. It predates the bounded Broker and Unsloth adapter implementation in this worktree.

- Covert runtime changed: NO
- Harness Sync changed: NO
- Resident changed: NO
- Authority changed: NO
- Veritas changed: NO
- H3 changed: NO

## Primary source index

- Unsloth: [README](https://github.com/unslothai/unsloth/blob/main/README.md), [inference routing](https://github.com/unslothai/unsloth/blob/main/unsloth_cli/_inference.py), [Studio CLI](https://github.com/unslothai/unsloth/blob/main/unsloth_cli/commands/studio.py), [orchestrator](https://github.com/unslothai/unsloth/blob/main/studio/backend/core/inference/orchestrator.py), [licenses](https://github.com/unslothai/unsloth/blob/main/LICENSE).
- llama.cpp: [README](https://github.com/ggml-org/llama.cpp/blob/master/README.md), [server API and flags](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md), [license](https://github.com/ggml-org/llama.cpp/blob/master/LICENSE).
- Ollama: [Windows](https://github.com/ollama/ollama/blob/main/docs/windows.mdx), [Modelfile](https://docs.ollama.com/modelfile), [API compatibility](https://docs.ollama.com/api/openai-compatibility), [offline/cloud control](https://github.com/ollama/ollama/blob/main/docs/faq.mdx), [license](https://github.com/ollama/ollama/blob/main/LICENSE).
- LM Studio: [architecture](https://lmstudio.ai/docs/app), [headless](https://lmstudio.ai/docs/developer/core/headless), [CLI](https://lmstudio.ai/docs/cli), [REST API](https://lmstudio.ai/docs/developer/rest), [terms](https://lmstudio.ai/app-terms).
