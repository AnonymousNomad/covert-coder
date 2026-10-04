# Runtime Integration Queue

**Order is dependency order, not a promise that every candidate will ship.** Each wave must preserve the current qualified Unsloth profile and exact-hash evidence. No wave may proceed past a substantive red under the Developer’s Way. Do not add runtime implementation in this audit lane.

## Wave R0 — Preserve current truth (release lane remains frozen)

**Objective:** retain the exact current Unsloth passport and support exclusions as a closed profile.
**Why now:** it is the only observed qualification at baseline and must remain independently reviewable while contracts evolve.
**Dependencies:** none.
**Risk:** contract refactor can accidentally widen frozen scope or stale evidence without surfacing it.
**Tests/evidence required:** passport schema validation; exact artifact/runtime/host binding; restart rediscovery; supported and excluded profile contract checks.
**Hardware acceptance:** exact GTX 1060 Mobile/Windows build/Vulkan/Unsloth/driver/artifact profile remains unchanged.
**Gate:** no new support claim from this wave.

## Wave R1 — Runtime registry and profile contracts

**Objective:** replace the canonical+single-recovery shape with a strict explicit registry of adapter family + runtime profile, while preserving operator consent and durable selection/fallback events. Add distinct lifecycle states for `DISCOVERED`, `AVAILABLE`, `COMPATIBLE`, `QUALIFIED`, `SELECTED`, and `RUNNING`.

**Why now:** the existing architecture cannot represent more than two identities or different accelerator builds of the same engine. A new backend before this change would require another special case and keep qualification weak.

**Dependencies:** reviewed API/version migration; persisted state and OpenAPI schema owners identified.
**Risk:** changing `RuntimeBackend` and `ModelManagerRuntime` can stale clients/evidence and accidentally recast “default” as “qualified.”
**Tests/evidence required:** strict unknown-ID rejection; duplicate profile rejection; explicit selection audit event; no implicit fallback; stale passport causes unqualified state; ownership and current Unsloth admission invariants still apply; generated OpenAPI matches source contracts.
**Hardware acceptance:** contract tests include at least two device profiles and two backend profiles for the same engine, using synthetic contract fixtures only (not production qualification).
**Exit condition:** registry is only a control plane; no new device is claimed supported.

## Wave R2 — Passport and artifact identity v2

**Objective:** make qualification bind runtime version/build digest, provider/backend, host OS/build and execution environment, process architecture, device/driver/runtime, artifact package manifest/digests, quantization, context/request profile, capability claims, evidence set and staleness policy.

**Why now:** current code qualification key is backend + version + artifact hash, while the actual saved passport contains far more specific scope.
**Dependencies:** R1 IDs and versioned state.
**Risk:** over-wide or ambiguous wildcard matching creates false qualification; package transformations can collapse parent/derived identities.
**Tests/evidence required:** exact-match tests; each identity change stales the right passport; derived artifact lineage verifies every source and output digest; unknown fields never qualify; no source SHA reused as converted package SHA.
**Hardware acceptance:** exact host/device/driver facts observed from sources with provenance.
**Exit condition:** one frozen Unsloth passport migrates without widening, and malformed/incomplete profiles fail closed.

## Wave R3 — Hardware truth and admission providers

**Objective:** enumerate CPU, GPU, NPU and accelerator APIs by device, with source, confidence, timestamps, nullable values, memory model, driver/runtime and OS/process environment. Add admission-probe interfaces selected by runtime profile.

**Why now:** hardware recommendations and start admission currently assume NVIDIA-on-Windows; adding adapters without this would make routing arbitrary.
**Dependencies:** R1/R2 schemas.
**Risk:** probes may misattribute shared memory, report stale data, or fail on unprivileged hosts.
**Tests/evidence required:** fixture matrix for absent/permission-denied/stale/zero/multiple GPUs; probe source verification; unknown values remain unknown; no unsupported probe mapped to zero; no cross-device aggregation that hides a constrained device.
**Hardware acceptance:** machines or sealed hardware evidence for NVIDIA, AMD, Intel, Apple, CPU-only and ARM/QNN targets.
**Exit condition:** current NVIDIA/Windows floors remain scoped to their passport; no other runtime starts until its profile admission is reviewed.

## Wave R4 — Covert llama.cpp adapter family (first broad local runtime)

**Objective:** production-compose a Covert-owned/pinned llama.cpp adapter using the existing adapter contract, with one profile per tested backend build. Start with CPU and the actively maintained modern backend qualification work; add CUDA, HIP/ROCm, Vulkan, Metal, SYCL as independent profiles when hardware acceptance exists.

**Why now:** llama.cpp gives the broadest GGUF local route with fewer inference-engine abstractions than introducing several specialized serving engines. The current recovery adapter is not enough: it is uncomposed, version null, text-only, partial cancellation, and has unknown metrics/tool behavior.
**Dependencies:** R1–R3; GGUF acquisition/hash/import contract; verified binary source/license/dependency inventory; existing ROCm candidate reviewed separately before integration; isolate/deprecate the base `ModelRuntime.start()` direct llama/Python launcher so there is one production lifecycle owner.
**Risk:** build variants and GPU driver behavior multiply qualification; unknown capability could be mistaken for parity with Unsloth.
**Tests/evidence required:** exact binary hash/build; discover/health/load/unload/identity; real governed Resident task; stream/cancel/error; no foreign-process kill; local-only/egress; resource admission; restart re-discovery; clean shutdown; per-profile tests for every advertised capability.
**Hardware acceptance:** CPU x64/ARM64 as target, NVIDIA profile, modern ROCm Radeon/Instinct profile, Windows/Linux Vulkan, Apple Metal, Intel SYCL only when there is a target; each profile gets actual device evidence.
**Exit condition:** llama.cpp itself can become a Covert adapter only for profiles with passports. `GGUF compatible` is not a global ready state.

## Wave R5 — ORT GenAI QNN package pilot (next distinct runtime family)

**Objective:** implement one ORT GenAI adapter profile for QNN on Windows ARM64, initially for one explicitly supported compiled ONNX GenAI package and one physical Snapdragon target. Preserve source model and derived QNN package lineage.

**Why now:** it adds a hardware class not safely or cleanly covered by llama.cpp today: Qualcomm NPU on Windows ARM64. QNN GenAI has a direct upstream contract, unlike treating a generic OpenAI HTTP endpoint or any arbitrary ONNX file as sufficient.
**Dependencies:** R1–R3; R2 package manifest; supported model/conversion pipeline and its license/provenance; QNN EP/plugin/runtime install channel; ARM64 native build and restart/ownership design.
**Risk:** model conversion/compiler outputs, vendor driver and provider binaries create a costly package/build matrix.
**Tests/evidence required:** source revision and output package manifest/hashes; QNN provider actually selected; supported request behavior; streaming/cancellation/error; measured resource usage; no CPU silent fallback; restart/package rediscovery; Local-Only and process ownership evidence.
**Hardware acceptance:** physical Windows ARM64 Snapdragon QNN/NPU machine and named driver/runtime; emulation or x64 build is not acceptance.
**Exit condition:** show one exact `QUALIFIED` model/profile; do not say universal Snapdragon/Windows ML support.

## Wave R6 — Selected ORT GenAI providers: VitisAI, DirectML and OpenVINO

**Objective:** evaluate separate profiles for AMD Ryzen AI NPU through VitisAI, DirectML on selected Windows x64 GPU/model packages, and OpenVINO on selected Intel CPU/Arc/NPU packages. The AMD source project demonstrates Ryzen AI + ORT GenAI + VitisAI examples; it does not establish support across every NPU generation or model. Start with a physical AMD NPU device only if beta user evidence supports that priority.

**Why now:** these can extend one GenAI runtime family across Windows GPU and Intel hardware without adding separate server frameworks. They are distinct provider routes, not one compatibility guarantee.
**Dependencies:** R5 package manifest; provider package pinning; exact graph/model architecture support.
**Risk:** provider partial operator execution or CPU fallback can appear healthy while GPU/NPU was not used; model conversion can alter capability.
**Tests/evidence required:** provider execution evidence from runtime/device logs; actual accelerator counters/telemetry where available; no hidden fallback; exact package identity; generation, cancellation and restart; provider unsupported cases return truthful unavailable.
**Hardware acceptance:** physical AMD Ryzen AI NPU + VitisAI model package/runtime/driver; selected Windows GPU vendor/device/driver + DirectML package; Intel CPU/Arc/NPU hardware + OpenVINO device/driver; separate passport per target.
**Exit condition:** support only profile/model pairs with verified execution-provider attribution.

## Wave R7 — Apple Silicon optimization decision

**Objective:** benchmark qualified llama.cpp Metal against MLX-LM for matched source model/task and resource scenarios. If MLX materially improves product outcomes or uniquely enables supported models, add one MLX-LM profile/adapter.

**Why now:** Apple support is reachable through llama.cpp without another adapter; MLX should justify its format/lifecycle cost.
**Dependencies:** R4 Metal passport; exact reproducible MLX conversion or upstream package; Apple-specific resource telemetry and unified-memory admission.
**Risk:** comparing different model quantizations/artifacts or runtime versions yields false performance claims.
**Tests/evidence required:** same source lineage; exact package hashes; quality/performance/resource/cancel/restart comparisons; CPU/GPU use confirmed.
**Hardware acceptance:** at least one physical Apple Silicon generation; expand claims only as profiles support them.
**Exit condition:** either evidence-backed MLX adapter or documented defer decision.

## Wave R8 — High-throughput Linux serving backend review (vLLM first)

**Objective:** decide whether a native vLLM adapter is justified for Linux workstation/server users. Use one NVIDIA or AMD workload with actual concurrency requirement; avoid implementing merely for API compatibility.

**Why now:** vLLM materially improves continuous batching, model/quant breadth and throughput for serving, but does not close native Windows/legacy GPU portability.
**Dependencies:** R1–R3, R4 broker/process control, server request cancellation/auth/egress/admission model, pinned Python/runtime/container package.
**Risk:** large Python/native build and CUDA/ROCm dependency surface; process and multi-request resource ownership differ from single-user local engine.
**Tests/evidence required:** launch/stop ownership; model and quant identity; concurrency/resource admission; request isolation/cancel/error; server auth/loopback; provider execution; restart; license/dependency audit.
**Hardware acceptance:** high-end Linux workstation/datacenter profile and documented workload.
**Exit condition:** adopt only if actual product demand and benchmark evidence beat llama.cpp/ORT path enough to justify the maintenance matrix.

## Wave R9 — Specialized / edge runtime candidates: SGLang, TensorRT-LLM, MLC, LiteRT-LM, ExecuTorch, MNN-LLM, KTransformers, OpenVINO standalone

**Objective:** keep each as a separately scoped proposal; do not implement as a bundle.
**Why now:** these technologies may have targeted value but add overlapping engines, converted packages and maintenance. LiteRT-LM, ExecuTorch, and MNN-LLM are credible mobile/edge paths, but Covert does not yet have that product target.
**Dependencies:** a measured customer/workload or device gap that existing adapter families cannot meet.
**Risk:** runtime proliferation; expensive qualification; dependency/licensing obligations; duplicate server lifecycle.
**Tests/evidence required:** feature gap, benchmark, current official support scope, conversion/package provenance, operation/security/cancellation evidence.
**Hardware acceptance:** the exact target use case only—e.g. SGLang concurrency workload, TensorRT NVIDIA engine target, MLC WebGPU/mobile device, LiteRT-LM Android/iOS/Windows GPU profile, ExecuTorch QNN mobile device, MNN QNN/Hexagon target, KTransformers Linux MoE server, or OpenVINO NPU profile.
**Exit condition:** reject when existing adapter reaches the same goal at materially lower lifecycle and identity complexity.

## Candidate-specific implementation decision

| Candidate | Queue result | Reason |
|---|---|---|
| llama.cpp | Implement/qualify first after registry, passport and discovery foundation | Broad GGUF CPU/GPU/OS coverage; existing code is incomplete and uncomposed. |
| ONNX Runtime GenAI | Next distinct adapter; start QNN Windows ARM64 | Clearest exact documented Qualcomm NPU route and multiple provider families; package-specific governance required. |
| OpenVINO GenAI | Prefer evaluate as ORT GenAI provider first; separate adapter only if needed | Intel value is real; avoid duplicate runtime unless direct GenAI API/feature proof wins. |
| MLX-LM | Defer until Metal vs MLX benchmark | Apple-specific benefit may justify its format and adapter. |
| vLLM | Defer until Linux server workload | High throughput is valuable but not broad desktop portability. |
| SGLang | Defer/reject as default | Specialized serving overlap, higher matrix burden. |
| TensorRT-LLM | Defer specialized NVIDIA deployment | Performance target only, CUDA/engine/packaging constraints. |
| MLC-LLM | Watch mobile/edge/WebGPU demand | Unique portability reach, but conversion/compiler burden and separate package identity. |
| LiteRT-LM | Watch cross-platform edge packaging | Stable Python/Kotlin/C++ surfaces and mobile/desktop reach, but `.litertlm` packages and delegate/device behavior need target-specific qualification. |
| ExecuTorch | Watch mobile/embedded demand | Broad delegates and `.pte` packages; upstream LLM server remains experimental/narrow. |
| MNN-LLM | Watch mobile/Qualcomm edge demand | QNN/Hexagon options but converted MNN/QNN artifacts and vendor SDK requirements. |
| KTransformers / KT-Kernel | P3 specialized | Linux x86-64 MoE optimization; does not add general workstation coverage. |
| LocalAI | Use as reference only | Backend orchestration lessons are valuable; its gallery/orchestration dependency surface is unnecessary for Covert. |

## Required stop boundaries

At every wave preserve first meaningful failure with exact commit/profile/command/logs/request boundary/exit code and cleanup result; reproduce; determine root cause; repair the owning layer; add regression proof; run focused and affected gates; verify actual runtime and restart; record evidence; commit only the accepted slice; leave no unexplained tree changes. If physical hardware, license/MFA, or external provider access is unavailable, record the exact blocker and continue only independent work that does not cross it.
