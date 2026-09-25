# Covert Runtime Broker Design and Implementation

**Status:** Unsloth selected; bounded Runtime Broker and adapter foundation implemented in this lane.

The older comparison and multi-backend sketches in this document are historical design inputs. The active Luna-facing schema is [RUNTIME-ADAPTER-CONTRACT.md](RUNTIME-ADAPTER-CONTRACT.md).

## Operational status

The canonical backend decision is closed: Covert uses Unsloth. The Runtime Broker is the stable ownership and adapter boundary, not an AUTO selector across vendors. Direct llama.cpp remains explicit reference/recovery only. RT23 accepted the exact native Windows Administrator + Unsloth Vulkan + Liquid GGUF profile with capability limitations recorded in the [Runtime Passport](evidence/UNSLOTH-RUNTIME-PASSPORT.json). Ollama and LM Studio remain historical research, not shipped product priorities.

## Boundary

Covert standardizes on Unsloth for local inference and owns resource admission, model qualification, routing, evidence capture, and lease policy. Unsloth owns kernels, tokenization, quantization, inference, and hardware-specific execution. The Broker is Covert's stable ownership and integration boundary, not a backend competition layer.

The Broker should not translate each runtime into a fictitious identical engine. It should normalize only request transport and common lifecycle, while preserving native options behind capability-gated settings.

              Covert
                 |
       Local Intelligence API
                 |
          Runtime Broker
                 |
             Unsloth
                 |
        local model execution

Direct llama.cpp remains an internal reference/recovery adapter. Other adapters may be implemented by developers without changing Covert's higher-level architecture; they are not shipped co-equal defaults.

## Small adapter contract

Required calls:

| Operation | Purpose |
|---|---|
| discover() | Find only local, loopback backends or explicitly approved local addresses; return identity and endpoint. |
| capabilities() | Return a versioned descriptor for this backend/engine/API and the loaded model where applicable. |
| health() | Report process/service reachability and loaded-model state as separate fields. |
| models() | Enumerate locally available or loaded model identities without downloading. |
| infer(request) | Send text/chat/tool/schema requests with streaming; select an API surface only when that backend advertises it. |
| load(model, profile) | Optional: supported for user- or Covert-managed runtimes that expose lifecycle control. |
| unload(model) | Optional: release the selected model; must not stop a user-owned server. |
| cancel(request_id) | Optional/best-effort; advertise cancellation semantics and verify actual server work stops. |
| metrics(window) | Optional: return source-tagged counters, timings, and resource measurements. |
| shutdown() | Optional and owner-gated: stop only a process that this Broker launched and still owns. |

The implementation exposes discover, health, capabilities, models, load, unload, infer, stream, tools through infer results, cancel, metrics, and shutdown. Unsupported or unknown operations fail closed. Tool calls are inference output, not a separate lifecycle operation.

### Request envelope

    {
      "mode": "chat",
      "model": "local-model-id",
      "messages": [{"role": "user", "content": "frozen input"}],
      "sampling": {"temperature": 0, "top_p": 1, "seed": 42},
      "max_output_tokens": 128,
      "stream": true,
      "tools": [],
      "json_schema": null,
      "backend_options": {}
    }

The backend_options field must be namespaced, recorded in the Passport, and rejected if the capability descriptor does not advertise the option. Do not silently drop context, KV-cache, offload, speculative-decoding, or batching controls.

## Capability descriptor draft

Support values are `supported`, `unsupported`, `conditional`, or `unknown`, each with an evidence reference. API support and loaded-model support are distinct.

    {
      "descriptor_version": 1,
      "backend_id": "llama.cpp",
      "backend_version": "unmeasured",
      "runtime_engine": "llama.cpp",
      "engine_version": "unmeasured",
      "api_protocols": {
        "openai_chat": "supported",
        "openai_responses": "supported",
        "openai_embeddings": "supported",
        "anthropic_messages": "supported"
      },
      "model_formats": ["GGUF"],
      "hardware_backends": ["CPU", "CUDA", "HIP", "Vulkan", "Metal", "SYCL"],
      "features": {
        "tool_calling": "conditional",
        "structured_output_json_schema": "supported",
        "vision": "conditional",
        "embeddings": "supported",
        "streaming": "supported",
        "speculative_decoding": "supported",
        "parallel_requests": "supported",
        "model_switching": "conditional",
        "model_hot_swap": "conditional",
        "context_controls": "supported",
        "kv_cache_controls": "supported",
        "cancellation": "conditional"
      },
      "observability": {
        "health_endpoint": "/health",
        "metrics_available": "optional",
        "pid_visibility": "process owner",
        "artifact_hash_visibility": "caller supplied"
      },
      "operation_modes": {
        "headless": "supported",
        "offline_capable": "supported",
        "lifecycle_control": "owner-gated"
      },
      "evidence": []
    }

The example is a schema sketch, not a claim that a specific local binary has those features. Real descriptors bind to the exact backend and engine versions, platform, model, and API surface.

## Lease record

The lease is the authority boundary between Covert and an already-running local process. A new process is covert_owned only after Covert launches it and records the PID tree. An endpoint discovered without proof is foreign and read-only.

    {
      "lease_id": "uuid",
      "owner": "COVERT_OWNED | USER_OWNED | FOREIGN | UNKNOWN",
      "backend_id": "llama.cpp",
      "backend_version": "pinned-version",
      "runtime_engine": "llama.cpp",
      "engine_version": "pinned-version",
      "host": "127.0.0.1",
      "port": 18097,
      "pid": 0,
      "child_pids": [],
      "model_id": "local-model-id",
      "artifact_path": "qualified-local-path",
      "artifact_sha256": "sha256",
      "backend_model_digest": null,
      "load_state": "loaded",
      "health_state": "healthy",
      "loaded_at": "UTC timestamp",
      "last_verified_at": "UTC timestamp"
    }

For any extension adapter, keep a backend content digest separate from the input artifact SHA-256. For Unsloth, capture the selected source path and listener PID when observable. If process topology cannot be mapped, set ownership to UNKNOWN and disallow Broker shutdown.

### Ownership transitions

- foreign → user-managed: only an explicit user selection; Broker remains connect-only.
- unowned → covert-owned: Broker starts the executable with an isolated loopback port and records process identity before loading a model.
- covert-owned → unloaded: model unload is confirmed while service PID and lease remain.
- covert-owned → stopped: Broker sends graceful shutdown only to its own PID tree and confirms those PIDs exited.
- Unexpected PID, port, model, or digest change invalidates the lease and blocks inference until rediscovery and requalification.

## Historical adapter-specific research (not a shipping plan)

| Adapter | Common operations | Native-only controls / caveats |
|---|---|---|
| llama.cpp | discover, health, models, infer, load/unload in router mode, metrics, owner-gated shutdown | context, batch, threads, GPU layers, KV cache, mmap, speculative modes, slots, templates |
| Unsloth | local discovery, health, models, infer via compatible API, Studio model load/unload | GGUF process uses llama-server; non-GGUF uses orchestrator; Studio auth and separate worker PIDs |
| Ollama | local discovery, health, models, infer, load/unload, metrics where exposed | Modelfile/import digest, keep_alive, scheduler and server options; cloud features must be disabled |
| LM Studio | local discovery, health, models, infer, load/unload | published APIs and lms/llmster controls; desktop app license prevents Covert redistribution |

## Runtime Performance Passport

Write append-only experimental records keyed by:

    model_sha256
    backend + backend_version
    engine + engine_version
    machine_fingerprint
    OS + driver + hardware
    context + rendered_prompt_tokens
    GPU offload + CPU threads + KV profile
    sampling + output budget
    TTFT + prompt-processing tok/s + generation tok/s + total latency
    working set + private bytes + Windows commit + VRAM
    tool/API validity + structured-output validity
    load/unload/switch timing + recovery/stability outcomes
    isomorphic flag + deviations
    timestamp + evidence source

The Passport records the selected Unsloth configuration per artifact and machine. Runtime qualification keys must include backend release and artifact hash; unknown identity is unqualified. No AUTO policy selects among vendors.

## Developer Notes connection

Future recommendation text can be generated from a Runtime Performance Passport and capability facts, then surfaced through the existing Developer Notes system after separate product authorization. Candidate copy:

> Developer Note — James Ferrell
>
> Covert standardizes on Unsloth for local inference while keeping inference behind a clean runtime boundary. Covert can qualify the selected Unsloth configuration for this machine and model.

Public-safe website copy is draft-only and has not been published:

> **Local inference included in the architecture.** Covert standardizes on Unsloth as its local inference backend, giving the system a consistent model-management and serving layer while retaining an open runtime boundary for developers who require custom infrastructure.

> You should not need to choose and assemble an inference server just to start using local intelligence with Covert.

No production UI or Developer Note was added here.

## Primary references

- [llama.cpp server API](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md)
- [Unsloth API and inference source](https://github.com/unslothai/unsloth/blob/main/unsloth_cli/_inference.py)
- [Ollama local API](https://docs.ollama.com/api/chat), [running models](https://docs.ollama.com/api/ps)
- [LM Studio REST and CLI](https://lmstudio.ai/docs/developer/rest), [headless service](https://lmstudio.ai/docs/developer/core/headless)
