# Runtime Architecture Gap Map

**Observed at:** `7391b98e1e0972dd3fe4365420fe15366b77b24c`
**Purpose:** map concrete source constraints to the future architecture changes they block. This file records evidence only; no source contracts were changed.

| Area / current source | Exact current assumption | What it prevents / risk | Bounded owner-level change |
|---|---|---|---|
| [common/contracts/runtime.ts](../../../common/contracts/runtime.ts#L3) `RuntimeBackend` | Zod enum is only `UNSLOTH`, `LLAMA_CPP`. | New adapter identity cannot pass runtime status, fallback events, API validation, or clients. A free-form string would lose contract control. | Versioned adapter/profile registry contract with stable IDs and schema evolution. Keep a strict allowlist. |
| [common/contracts/runtime.ts](../../../common/contracts/runtime.ts#L57) `RuntimeStatusResponse` | `canonical_backend` is literal `UNSLOTH`; backend set is the two-value enum. | “Canonical” is hard-coded as engine identity. Cannot report a selected alternative without claiming Unsloth is canonical. | Report product policy/default separately from selected adapter/profile; use explicit lifecycle state and versioned contract. |
| [node/src/services/runtime-adapter.ts](../../../node/src/services/runtime-adapter.ts#L56) `RuntimeQualificationIdentity` / `isRuntimeQualificationCurrent` | Current match key is backend + runtime version + artifact SHA. | Does not stale on runtime build, execution provider/backend, OS, architecture, driver, device, quantization/profile, context, or capability change. | Match against a passport digest/scope tuple. Missing evidence remains `UNKNOWN`; no wildcards by default. |
| [node/src/services/runtime-adapter.ts](../../../node/src/services/runtime-adapter.ts#L145) `RuntimeBroker` | Exactly one canonical and one optional recovery slot; only accepts Unsloth then llama.cpp. Recovery action and event are hard-coded. | Cannot expose several discovered runtimes or multiple acceleration profiles per engine; “recovery” confuses a different runtime choice with failure recovery. | Replace with a small explicit registry plus operator-selected adapter/profile. Preserve durable selection/fallback audit and current no-silent-switch rule. |
| [node/src/openapi.ts](../../../node/src/openapi.ts#L247) composition | Production creates Unsloth adapter with `recovery = null`. | The existing llama.cpp adapter is not active in production composition. Adapter code alone is not product support. | Compose only after registry contract and a complete qualified adapter profile; add lifecycle ownership tests. |
| [node/src/services/llama-cpp-runtime-adapter.ts](../../../node/src/services/llama-cpp-runtime-adapter.ts#L24) recovery adapter | Requires Covert-owned process; version is null; tool/structured output rejected; metrics unknown; cancellation partial; requested file is reported as identity. | Insufficient passport provenance and feature parity for a general supported backend. | Resolve pinned binary/build identity, runtime-reported model identity, stream/cancel/process cleanup, tested capabilities; do not overclaim unknown functions. |
| [node/src/services/model-runtime.ts](../../../node/src/services/model-runtime.ts#L462) legacy `ModelRuntime.start` | Base class still launches llama-server directly and falls back to Python `llama_cpp.server --n_gpu_layers 0`, outside `RuntimeAdapter`. | A second process/model lifecycle owner remains available to direct `ModelRuntime` callers. This is not the active canonical production factory path, but it can create divergent admission/identity/shutdown behavior if reused. | Deprecate or isolate this executor before adding adapters. Keep production composition on broker-controlled calls; retain only narrowly scoped tests/probes if needed. |
| [node/src/services/broker-model-runtime.ts](../../../node/src/services/broker-model-runtime.ts#L24) `UNSLOTH_V1_QUALIFICATION` | Frozen model SHA/name/size and Unsloth version gate are compiled into the path. | Model loading is intentionally single-profile; runtime profile selection cannot supply its own independently reviewed qualification. | Move policy into reviewed profile/passport data, retaining exact frozen Unsloth entry as an immutable profile. |
| [node/src/services/broker-model-runtime.ts](../../../node/src/services/broker-model-runtime.ts#L161) `boundRuntimeProfile` | Sidecar binding checks artifact hash, literal `UNSLOTH`, and runtime version. | No build/provider/OS/device passport linkage; binding may remain “current” under changed hardware/runtime build. | Bind loaded artifact to profile/passport digest and scope; re-evaluate after restart and any material identity change. |
| [common/contracts/model-access.ts](../../../common/contracts/model-access.ts#L25) `ModelQualificationBasis` | Source revision, artifact hash, runtime ID/version only. | Cannot establish derived package or machine/runtime scope. | Add package manifest digest/source lineage, quantization, runtime build, backend, host/device profile and evidence-set reference. |
| [common/contracts/model-access.ts](../../../common/contracts/model-access.ts#L116) `ModelManagerRuntime` | Canonical/default literals are `unsloth`; reported backend enum has two values. | Model Manager cannot truthfully represent multiple explicit adapters/profiles. | Runtime list plus selected ID/profile and independently sourced states; no hard-coded “canonical” runtime in display contract. |
| [node/src/services/model-manager-view.ts](../../../node/src/services/model-manager-view.ts#L285) runtime presentation | Reports Unsloth default; only GGUF records are registered for local runtime use. | UI can show one default even when another engine/profile is active; non-GGUF packages cannot be represented correctly. | Render adapter/profile inventory and artifact/package types from canonical APIs. Do not infer READY from import or registration. |
| [browser/src/panels/models.ts](../../../browser/src/panels/models.ts#L94) model UI | Prints `canonical_runtime_id` and the two-value `reported_backend`. | Browser presentation cannot explain runtime-profile availability/selection or render more than current identities. | Use typed registry/status response; show selected profile plus discovery/compatibility/qualification and sourced degraded reasons. |
| [node/src/services/model-runtime.ts](../../../node/src/services/model-runtime.ts#L951) GGUF import/registration | Validates and stores GGUF; other formats are explicitly outside this path. | Cannot install/validate HF safetensors, OpenVINO IR, ONNX GenAI packages, MLX layouts, TensorRT engines, or MLC packages. | Add a format-specific artifact/package interface with per-file manifest/hash and validation, not a generic unchecked format string. |
| [node/src/services/hardware.ts](../../../node/src/services/hardware.ts#L13) `HardwareInfo` | VRAM source only `nvidia-smi | none`; nvidia probe runs only on Windows; first output row drives scalar state. | Linux/macOS, AMD, Intel, NPU, multi-GPU, architecture, driver, provider/version and shared-memory truth are lost. `0` cannot distinguish no device from no probe. | Enumerate devices and probes by source; return per-field `UNKNOWN`, errors, sample time, device IDs, and accelerator API inventory. |
| [node/src/services/orch-context.mjs](../../../node/src/services/orch-context.mjs#L21) hardware-to-agent context | Exposes only `vramFreeMb`; `gpuName` is the literal “discrete GPU” when the NVIDIA source is present. | Resident/agent reasoning cannot distinguish hardware vendor/model/profile and may omit non-NVIDIA accelerators entirely. | Pass through sourced device identity and confidence; never infer device class from VRAM alone. |
| [browser/src/cockpit/SystemTelemetry.ts](../../../browser/src/cockpit/SystemTelemetry.ts#L135) telemetry presentation | Explicitly documents CPU utilization and disk capacity as absent from current hardware contract; VRAM is hidden when source is `none` or zero. | Current UI cannot truthfully display these metrics from this API; `none` also conflates unsupported and absent. | Add real probes with provenance and explicit unavailable reasons before showing these metrics. No simulated values or random sparklines. |
| [common/contracts/hardware.ts](../../../common/contracts/hardware.ts#L11) `HardwareBackend` | Values are `vulkan`, `cuda`, `cpu`, `apple`; response contains scalar VRAM and one guessed backend. | A model of one inferred “backend” cannot represent installed/available CUDA+Vulkan, several devices, Metal, SYCL, DirectML, OpenVINO, QNN, or NPU. | Separate hardware devices from execution-provider availability and runtime profile compatibility. Preserve raw vendor/device identity. |
| [node/src/services/hardware-profile.mjs](../../../node/src/services/hardware-profile.mjs#L45) recommendation / `fitFor` | Fixed role model packs; `fit` uses artifact size against total RAM with a multiplier; VRAM threshold labels Vulkan. | Model recommendation can imply fit/backend without free-memory/KV-cache/context/architecture/provider/driver evidence. | Make recommendation identify exact artifact and candidate runtime profile; fit is a conservative estimate with assumptions, never a compatibility or qualification result. |
| [node/src/services/resource-admission.ts](../../../node/src/services/resource-admission.ts#L26) `LOCAL_RUNTIME_START_FLOORS` | Frozen thresholds depend on Windows commit and NVIDIA VRAM/utilization. | Cross-platform selection either fails all non-NVIDIA machines or encourages weakening the proven profile floor. | Keep this policy scoped to its passport. Add separately qualified per-profile admission probes and thresholds. Unknown measurement is neither zero nor healthy. |
| [common/openapi.json](../../../common/openapi.json) generated API | Generated schema captures enum/literal/narrow response shapes. | Manual source-only edits would leave clients and runtime API contract stale. | Generate from updated contracts; verify schema diff and clients at the exact candidate SHA. |
| `tests/arch/runtime-broker.test.ts`, `tests/arch/broker-model-runtime.test.ts` | Fixtures/assertions explicitly encode two backends and Unsloth qualification. | Contract evolution is blocked until invariant tests are consciously migrated; broad replacement could erase the frozen profile invariants. | Add registry/passport tests while preserving exact Unsloth profile and explicit recovery invariants. |
| [common/contracts/runtime.ts](../../../common/contracts/runtime.ts#L88) tool evidence | Attribution enum contains `UNSLOTH_RUNTIME_REPAIR`. | Generic result evidence embeds one implementation-specific repair label. | Normalize attribution to producer class + adapter/profile + transformation evidence, with explicit unknown. |

## Existing semantics to reuse

Do not create parallel authority or model systems. Existing contracts already distinguish model qualification state, artifact compatibility, artifact hash state, availability (`DISCOVERED`, `AVAILABLE`, `INSTALLED`, `CONNECTED`, `LOADABLE`), and setup state in [common/contracts/model-access.ts](../../../common/contracts/model-access.ts). Reuse these concepts and align them with runtime lifecycle:

| Product state | Minimum evidence | Current equivalent / gap |
|---|---|---|
| `DISCOVERED` | Probe found runtime/device or adapter candidate; source + timestamp. | Model Access has `DISCOVERED`; runtime discovery result is not a registry of candidates. |
| `AVAILABLE` | Pinned binary/library can start or is reachable; version/build observed. | Model Access has `AVAILABLE`; runtime health has `STOPPED`/`NOT_INSTALLED`, but no per-profile availability inventory. |
| `COMPATIBLE` | Declared runtime + backend + OS/device + artifact constraints all match. | `ModelArtifactCompatibility` exists, but fit/recommendation does not bind it to discovered accelerator profile. |
| `QUALIFIED` | Non-stale passport covers exact profile, artifact, request and capabilities. | Qualification enums and one frozen passport exist; code’s portable qualification key is too small. |
| `SELECTED` | Explicit operator action, recorded adapter/profile and reason. | Broker active adapter is implicit canonical or explicit recovery; no general selection record. |
| `RUNNING` | Live runtime health and observed loaded identity match selected artifact/profile; ownership known. | Runtime status has health/loaded model/ownership but not a registry profile/passport binding. |

## Passport fields required before another production adapter

Minimum exact-match identity:

```text
adapter_id
runtime_version + binary_or_library_build_digest
execution_backend_or_provider + version
host_os + version/build + native/container/WSL + process_architecture
hardware_device_vendor/id/family/architecture + driver/runtime version
artifact_format + package_manifest_digest + file digests + quantization + source lineage
context/cache/generation profile
tested_capability_set + evidence_set_digest + issued/expiry/stale rules
```

Selection matches one passport scope, not nearest-neighbor matching. Capability additions invalidate only the claims that depend on the changed profile, but each affected claim requires a new evidence set. If hardware identity cannot be observed with adequate stability, keep qualification scope exact to the observable profile and say so.

## Migration guardrails

1. Do not widen or edit the exact current Unsloth qualification while adding registry support.
2. Do not make `UNKNOWN` a wildcard for a device, metric, capability, or identity.
3. Do not map engine API compatibility to model artifact compatibility.
4. Do not turn import/registered/downloaded/assigned into runtime-qualified or ready.
5. Do not fall back or select automatically; show discovered/available/compatible/qualified candidates and ask for explicit selection.
6. Keep Authority, Resource Admission, endpoint ownership, Local-Only, credential isolation, cancellation, cleanup, restart checks, and shutdown ownership in the adapter path.
7. Update strict Zod contracts, API schema, persisted evidence/version migration, tests, browser surface, and logs as one bounded slice.

## Audit classification

The primary defect class is **abstraction/production composition drift**. Covert has an interface and some backend-specific code, but production wiring, model access, hardware truth, admission and qualification remain centered on one exact runtime. The largest portability risk is not missing engine names: it is inability to express and prove the full runtime × provider × machine × artifact identity.
