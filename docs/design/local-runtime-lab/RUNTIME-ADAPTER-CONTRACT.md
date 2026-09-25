# Covert Runtime Adapter Contract

**Contract version:** 1
**Product backend:** Unsloth
**Status:** Frozen handoff for Luna #1; UI/worktree not modified in this lane.

This contract defines Covert's ownership boundary around the canonical Unsloth runtime. Covert standardizes on Unsloth for local inference while keeping inference behind a clean runtime boundary. Covert owns qualification, resource admission, routing, context, authority, verification, evidence, and project state; Unsloth owns model execution and engine internals.

**V1 qualification overlay:** use [UNSLOTH-V1-SUPPORT-CONTRACT.md](UNSLOTH-V1-SUPPORT-CONTRACT.md) and the V1 Runtime Passport for the tested Windows Administrator + Vulkan + Liquid profile. Earlier RT23 capability notes below remain historical evidence; they do not override the final V1 classification.

## Product hierarchy

```text
Covert
  └─ Runtime Broker
       ├─ canonical: Unsloth
       └─ explicit internal recovery/reference: direct llama.cpp
```

The ordinary path is Covert → Unsloth. There is no backend picker or AUTO benchmark policy. Ollama, LM Studio, MLX, and other runtimes are developer extension points only; no adapters for them are shipped in this slice.

## Luna #1 status payload

`common/contracts/runtime.ts` exports the strict Zod schema `RuntimeStatusResponse`, which is the frozen handoff contract for Luna #1. Luna may bind this payload through its Model Manager. This runtime lane does not add an API route or modify Model Manager implementation.

```ts
type RuntimeStatusResponse = {
  contract_version: 1;
  canonical_backend: 'UNSLOTH';
  backend: 'UNSLOTH' | 'LLAMA_CPP';
  version: string | null;
  engine: string | null;
  endpoint: string | null;
  port: number | null;
  pid: number | null;
  started_at: string | null;
  health: 'HEALTHY' | 'UNHEALTHY' | 'STOPPED' | 'NOT_INSTALLED' | 'UNKNOWN';
  ownership: 'COVERT_OWNED' | 'USER_OWNED' | 'FOREIGN' | 'UNKNOWN';
  loaded_model: {
    model_id: string;
    display_name: string | null;
    artifact_name: string | null;
    artifact_sha256: string | null;
    identity_evidence: 'RUNTIME_REPORTED' | 'REQUESTED_ARTIFACT' | 'UNKNOWN';
  } | null;
  capabilities: RuntimeCapabilityDescriptor;
  metrics: {
    ram_bytes: number | null;
    vram_bytes: number | null;
    windows_commit_bytes: number | null;
    loaded_model_bytes: number | null;
    context_tokens: number | null;
    source: 'RUNTIME' | 'HOST' | 'UNKNOWN';
  };
  last_error: { code: string; message: string; at: string } | null;
  fallback_event_id: string | null;
  updated_at: string;
};
```

`version` is the discovered Unsloth CLI/Studio release when parseable. `engine` remains null until the loaded model's engine is verified. The current adapter computes SHA-256 for a locally requested artifact; an API-only model listing has `artifact_sha256: null` and cannot be treated as artifact-qualified.

## Adapter methods

The TypeScript `RuntimeAdapter` interface requires:

```text
discover()       health()       capabilities()  models()
load()           unload()       infer()         stream()
cancel()         metrics()      shutdown()
status()
```

An adapter may reject an operation when ownership or capability evidence is missing. The Broker never switches to recovery because an operation failed.

## Unsloth capability values at RT22 implementation checkpoint (historical)

Values describe the API surface currently wired in the adapter, not model quality. Loaded-model qualification remains separate.

The table below preserves the pre-installation adapter snapshot. Its live-unverified statements are historical; RT23 results follow.

| Capability | Adapter value | Boundary |
|---|---|---|
| OpenAI Chat Completions | PARTIAL | Local `/v1/chat/completions` transport is wired; Bearer credentials come from the `unsloth-local-runtime` slot in Covert's DPAPI-backed `CredentialStore`; live protocol behavior is unverified |
| Responses API | UNKNOWN | Not advertised to Covert clients |
| Anthropic Messages | UNKNOWN | Not advertised to Covert clients |
| Embeddings | UNKNOWN | No endpoint adapter or local qualification |
| Model discovery | PARTIAL | `/v1/models` reports runtime-visible identities; no online catalog scan |
| Load / unload | PARTIAL | Documented Studio API; Bearer authentication, padded responses, and deferred-error validation are wired; live endpoint behavior remains unverified |
| Model switching | PARTIAL | Load request updates identity only after successful completion; hot-switch semantics are unknown |
| Streaming | PARTIAL | OpenAI Chat Completions SSE parser exists; authenticated live stream behavior is not qualified |
| Cancellation | PARTIAL | Covert aborts the request; backend work cancellation is not yet independently measured |
| Tool calling | PARTIAL | Final API tool calls are returned; model/parser behavior varies |
| Tool repair | UNKNOWN | Vendor self-repair claim is not independently measured; raw pre-repair output is not exposed by this adapter |
| Structured output | UNKNOWN | Schema requests fail closed until this API version is qualified |
| Vision | UNKNOWN | Depends on model and engine; not wired in this adapter |
| Speculative decoding / parallel requests | UNKNOWN | Not qualified or exposed as common controls |
| Context controls | PARTIAL | `max_seq_length` is passed on load; effective context has not been measured |
| KV-cache controls | UNKNOWN | Not exposed by this adapter |
| Metrics | UNKNOWN | RAM, VRAM, Windows commit, and loaded model size remain null |
| Headless / local inference | SUPPORTED | Covert-owned launch binds to `127.0.0.1`; no tunnel or cloud path is enabled |

Unknown is retained as `UNKNOWN`; the adapter does not infer support from an endpoint existing.

## RT23 live capability results

The exact tested profile was native Windows 11 Administrator execution, Unsloth 2026.9.11, Vulkan, GTX 1060 Mobile, and the official Liquid GGUF artifact. Non-stream and streaming chat, authenticated API use, model load/unload/reload, cancellation, invalid-request recovery, server restart, and Covert-owned shutdown passed. Five sequential normal requests returned visible content and ended with stop.

### Historical RT23 live observations (superseded by V1 closeout)

The runtime accepted one strict JSON Schema request with HTTP 200 but returned no schema-valid JSON at the frozen 512-token budget. That RT23 profile result was PARTIAL. The adapter rejected `responseFormat`; tool calling produced schema-valid arguments for one frozen case but the tool was not executed. Raw pre-repair output was unavailable, so repair attribution was UNKNOWN. The V1 tool-loop result and final structured-output product decision are recorded in the V1 support contract and Passport.

Host monitoring captured minimum free RAM of 5.67 GiB, minimum free Windows commit of 3.04 GiB, and peak total system VRAM use of 2,517 MiB. Adapter-native metric fields remain null. Long-run soak, AUTO, CUDA inference, CPU inference, and switching to a different model were not tested. Exact settings and evidence are in the [Runtime Passport](evidence/UNSLOTH-RUNTIME-PASSPORT.json).

## Ownership and lifecycle

- `COVERT_OWNED`: Covert launched the CLI and confirms the listening PID is either the retained CLI PID or a verified descendant in its process tree. Shutdown targets only that retained process tree.
- `USER_OWNED`: the operator explicitly configured a loopback endpoint with `AIDE_UNSLOTH_ENDPOINT`. Model load/unload requires an explicit model operation. Covert does not stop the external process.
- `FOREIGN`: a process already owns Covert's managed port. The adapter does not query, attach to, stop, or reuse it.
- `UNKNOWN`: listener/process identity could not be proved. No lifecycle action or API request is allowed.

Without `AIDE_UNSLOTH_ENDPOINT`, the managed endpoint is `http://127.0.0.1:18888`. Covert discovers a runnable `unsloth` executable on `PATH`, or an explicit `AIDE_UNSLOTH_CLI` path. A Covert-owned launch uses the documented loopback CLI form with `--api-only`, forces API-only mode, removes inherited tunnel settings, and sets Unsloth's current private Cloudflare-intent flag to `disabled`. It starts only after the port is verified free. An existing port is never treated as an Unsloth server by probing it. On Windows the adapter stops the verified retained process tree; on non-Windows it starts a detached process group and stops that group. It confirms the port is free afterward and never repeats termination if a listener remains.

Health uses `GET /api/health` and requires the Unsloth service marker. Model enumeration uses only `GET /v1/models`; it does not call the model catalog route that can retrieve remote recommendations. Requests do not follow redirects. Lifecycle calls reject missing/truncated responses and the `_deferred_error` body used to report late load/unload failures.

Protected Studio/API calls use the documented `Authorization: Bearer <API key>` mechanism. The adapter reads the dedicated `unsloth-local-runtime` slot from Covert's existing DPAPI-backed `CredentialStore` by default; tests and alternate compositions can inject a credential reader or token provider. The token is held only in memory for the request and is excluded from status, errors, and logs. HTTP 401 and 403 are classified as `AUTH_REQUIRED` and `AUTH_FORBIDDEN`. Health checks remain unauthenticated. The operator creates the key through Unsloth Studio's Settings → API keys and stores it in Covert's secure credential store; this lane adds no credential UI or public route. On WSL/Linux, the default Windows DPAPI store is unavailable; that surface needs an injected platform-secure credential reader.

RT23 authentication checks passed twice: the health endpoint responded, `/v1/models` returned 401 without a Bearer token and 200 with the DPAPI-backed token, and the owned process shut down cleanly. No token value was recorded.

## Artifact and qualification identity

The loaded identity is based on the registered local model path and its streamed SHA-256, not Unsloth's display name. `/v1/models` identities alone have unknown artifact hashes. The `isRuntimeQualificationCurrent` helper requires exact backend, non-empty backend version, and current loaded-artifact hash; any mismatch or unknown value invalidates qualification.

Capability and Runtime Performance Passport integrations must carry that same artifact hash. This adapter does not modify Resident semantics or create qualification records. Runtime repair evidence records:

```text
raw_model_output: null when the API does not expose pre-repair tokens
runtime_adjusted_output: final tool-call structure returned by the runtime
executed_tool_call: null until Covert's tool executor reports it
attribution: UNKNOWN unless source provenance is available
```

Covert must not credit an API-repaired result as raw model capability.

## Explicit recovery behavior

Direct `LlamaCppRuntimeAdapter` is an internal reference/recovery adapter wrapping the existing Covert-owned llama lifecycle. `RuntimeBroker.activateLlamaRecovery(reason, true)` requires an explicit operator action, confirms a local recovery installation, and appends an event to `.aide/runtime-events.jsonl` before changing the selected adapter. Journal failure leaves Unsloth selected. The HTTP/model flow does not silently fall back. Returning to Unsloth also requires an explicit call and healthy Unsloth status.

The direct adapter refuses foreign endpoint adoption in Broker mode. It only chats or shuts down through retained process handles started by Covert. This is a resilience path, not the ordinary user default.

## Installation and licensing boundary

The current distribution path is **external user installation** of Unsloth Studio/CLI, followed by Covert discovery or loopback configuration. Covert performs no internet install, bootstrap script, or auto-update. Covert does not bundle, redistribute, copy, or vendor Unsloth Studio/AGPL source. Unsloth Core is Apache-2.0; Studio/UI components are AGPL-3.0. A bundled or installer-managed distribution requires a separate component/license and compliance review.

The adapter currently targets the documented `unsloth studio` CLI/API path. Detection of a separately installed Desktop GUI without that CLI is not implemented or qualified.

## GTX 1060 / Pascal gate — pre-installation research state (superseded)

The GTX 1060 Mobile is compute capability 6.1. Unsloth Core's published CUDA minimum is 7.0; that statement alone does not prove whether Studio's separate GGUF/llama.cpp CUDA path supports Pascal. Unsloth documents CPU GGUF chat and has an official `cpu` llama.cpp backend selection; CPU is the conservative Covert profile candidate. Vulkan is an alternative install selection but remains unqualified on this Pascal machine. The adapter does not change Unsloth's installed backend selection. No runtime or Liquid artifact was loaded in this slice because foreign llama-server ownership and memory pressure were present, so GTX 1060 remains BLOCKED pending an isolated CPU-profile load and runtime measurement. See [Unsloth requirements](https://unsloth.ai/docs/get-started/fine-tuning-for-beginners/unsloth-requirements), the [Windows setup script](https://github.com/unslothai/unsloth/blob/main/studio/setup.ps1), and the [official README](https://github.com/unslothai/unsloth/blob/main/README.md).

The following pre-installation GTX 1060 paragraph is historical and superseded by the measured Vulkan result.

## RT23 GTX 1060 result

Vulkan is qualified for the exact installed Unsloth build and Liquid artifact. The verified llama-server device report identified the NVIDIA GTX 1060 with 6,245 MiB visible to Vulkan. AUTO, CUDA inference, and CPU inference were not run; no conclusion about those paths is inferred from the Vulkan result.

## RT23 operational qualification

The qualified configuration is native Windows 11 Administrator execution, Unsloth 2026.9.11, Vulkan, and the official Liquid artifact SHA-256 02a8b7e17487d326e46d68ce0ba24211e1b80a14c4cd0597fa73c1cd697f52ed. See the [qualification report](UNSLOTH-RUNTIME-QUALIFICATION-2026-09-24.md) and [sanitized Model Manager fixture](evidence/LUNA-RUNTIME-STATUS-FIXTURE.json).

## Public-safe copy for later review

> **Local inference included in the architecture.** Covert standardizes on Unsloth as its local inference backend, giving the system a consistent model-management and serving layer while retaining an open runtime boundary for developers who require custom infrastructure.

> You should not need to choose and assemble an inference server just to start using local intelligence with Covert.

Draft only; website and README were not changed in this lane. This wording is not a speed claim or a claim that other products cannot use Unsloth.

## Related research

- [LOCAL-RUNTIME-BACKEND-EVALUATION.md](LOCAL-RUNTIME-BACKEND-EVALUATION.md) — source research and historical decision record.
- [BACKEND-CAPABILITY-MATRIX.md](BACKEND-CAPABILITY-MATRIX.md) — historical factual comparison; not product ranking.
- [RUNTIME-BROKER-CANDIDATE.md](RUNTIME-BROKER-CANDIDATE.md) — architecture rationale and Passport design.
- [RUNTIME-BENCHMARK-METHODOLOGY.md](RUNTIME-BENCHMARK-METHODOLOGY.md) — frozen measurement protocol and current qualification gate.
