# Local Backend Capability Matrix

**Evidence cut:** 2026-09-24. Historical source-backed comparison, not a product-selection matrix or performance ranking. Capabilities are marked documented (D), conditional on model/configuration (C), source-observed (S), unverified here (U), or not established (—). “Not established” is not a claim of impossibility.

## Product hierarchy after research

- **Selected canonical backend:** Unsloth.
- **Direct llama.cpp:** internal diagnostic/reference and explicit recovery path.
- **Ollama / LM Studio:** extension points only; no shipped adapters are planned in this slice.
- The matrix below preserves the research record. Its columns are not co-equal product candidates, and it does not establish a speed winner.
- See [RUNTIME-ADAPTER-CONTRACT.md](RUNTIME-ADAPTER-CONTRACT.md) for the implemented Covert boundary and capability values.

| Capability | Direct llama.cpp | Unsloth Desktop / Studio | Ollama | LM Studio |
|---|---|---|---|---|
| Inference engine | ggml/llama.cpp | GGUF → llama-server; non-GGUF → Unsloth inference orchestrator; MLX path on Apple Silicon | llama.cpp-based runners plus runtime-specific engine paths; version/model-specific | GGUF → llama.cpp; Apple Silicon also MLX |
| API protocols | OpenAI-style chat, Responses, embeddings; Anthropic-style Messages (D/C) | OpenAI Chat Completions, Responses, Anthropic Messages documented; feature compatibility varies | Native Ollama API; OpenAI Chat Completions and stateless Responses; Anthropic Messages | Native REST; OpenAI Chat Completions, Responses, embeddings; Anthropic Messages |
| OpenAI compatibility | D, project makes no strong full-spec claim | D, not full-spec proof | D, endpoint-specific | D, endpoint-specific |
| Responses compatibility | D, bridge/conversion implementation | D | D, stateless only per docs | D, stateful behavior documented |
| Codex / Responses client path | Responses route exists; no Codex qualification claim found | Project documents unsloth start codex; runtime compatibility not independently tested | Responses endpoint exists but stateful features are limited; Codex compatibility U | Official integration documentation covers Codex through Responses |
| Anthropic compatibility | D, Messages subset | D, Messages endpoint | D, documented subset/limitations | D, Messages endpoint |
| Tool calling | C: model chat template and Jinja parsing | D at API/UI level; model/parser dependent; repair provenance is not established by ordinary API output | D at API level; model/parser dependent | D: native parser where available; default prompt/parser path otherwise |
| Structured output | D: JSON-schema grammar | D advertised/API behavior; exact schemas depend on route/engine | D: JSON or JSON schema | D: JSON schema, backend-engine dependent |
| Vision / image input | D/C: multimodal chat via libmtmd and compatible model/projector; documented as experimental | D/C: vision input advertised; non-GGUF vision path and GGUF projector path are model/engine-specific | D/C: chat accepts image arrays with a vision-capable model | D/C: documented image input with a loaded VLM |
| Embeddings | D/C: `/v1/embeddings`; requires an embedding-compatible model/configuration | Studio advertises embedding models and uses embeddings for RAG; a common OpenAI embeddings endpoint is not established | D: native `/api/embed`; embedding model-specific | D: OpenAI-compatible embeddings endpoint; model-specific |
| Streaming | D | D | D | D |
| Model switching | Router-mode load/unload or process restart | Source-observed load/unload; engine changes with model format | API load on request, keep-alive and explicit unload | API and CLI load/unload; JIT-load and TTL options |
| Model discovery | Explicit path / router model list; no universal catalog | Local/cached plus online catalog; source checks offline env for remote ranking | Local registry/API tags and model library | Local model directory and optional online catalog; lms ls |
| GGUF | D, native | D; served through llama-server | D; Modelfile path import | D; native llama.cpp; lms import |
| Other formats | GGUF-centered; model/adapter sidecars | Safetensors/Hub through orchestrator; MLX on Apple Silicon; model-specific | Additional formats depend on current runner and model library; record each qualified format | MLX on Apple Silicon; format/model-specific support |
| GPU offload control | Explicit GPU layer count/device flags | Installer/backend selection, custom llama.cpp args; richer hardware detection; controls vary by engine | Scheduler/runtime selects GPU; partial offload and environment controls vary by version | lms load GPU ratio and load settings; engine-specific |
| CPU/GPU hybrid | D | C, engine-specific | C, scheduler/backend-specific | C, llama.cpp settings |
| Context controls | Explicit context/batch flags and request limits | Studio load settings, CLI and engine controls; model-specific | API num_ctx / context environment/config | load API / CLI context length; native chat request options |
| KV-cache controls | Explicit K/V cache type and RAM options | GGUF custom args / model-engine-specific controls; not one shared switch | KV cache type/server options documented by version | llama.cpp load configuration includes KV offload; MLX differs |
| Speculative decoding | D, multiple modes | D/source-observed for GGUF draft modes and backend-native paths; exact UI/API matrix varies | — / version-specific, not scored here | D for draft-model API on supported paths |
| Batching / parallel requests | D: slots and continuous batching | Engine-specific; not established as one shared setting | Parallel requests/queue controls vary by version | D for llama.cpp engine continuous batching; docs say MLX support differs |
| Model unload | Router API or process exit | Source-observed endpoint/CLI | keep_alive zero / API | native API and lms CLI |
| Idle behavior | Process stays loaded until owner action; no universal daemon policy | Process/model lifecycle managed by Studio; exact idle policy U | documented keep-alive default and override | JIT model TTL and auto-evict options |
| Runtime isolation | Strong if Covert owns process and private port | Separate Studio root/process, but worker/llama-server topology; isolation needs PID audit | Separate daemon and model store | llmster/headless process and model store |
| Crash recovery | External supervisor / Covert responsibility | Worker subprocess lifecycle present; service restart guarantee U | background app/service; restart guarantee depends on host/service manager | daemon/CLI lifecycle; restart guarantee U |
| Health | /health and /v1/health | /api/health source-observed | API reachability and server logs | server/API reachability; CLI status |
| Metrics | Optional Prometheus /metrics includes prompt/generation counters, speculative counters | API/runtime stats vary; raw per-engine metric availability must be tested | native API timings/counters; model ps includes loaded context/VRAM | native/v0 API stats, lms ps; engine-level metrics vary |
| Headless | D | D: CLI/server operation | D: native app background and standalone server | D: llmster plus lms |
| CLI control | Binary command line; router API | unsloth CLI and HTTP lifecycle API | ollama CLI and HTTP API | lms CLI and HTTP API |
| Programmatic lifecycle | Full if Covert owns child process; model router options | Model load/unload and server control observed; exact owned PID topology to qualify | API and CLI lifecycle; process ownership if Covert launches | documented CLI/API lifecycle; app may own daemon |
| Offline operation | D with local model/cache and offline option | Possible with preinstalled/cached models and offline flags; catalog/install/update can access network | Local-only cloud-disable setting available; local models only | D for local inference after model is present; discovery/download are online |
| Windows quality | Supported; NVIDIA needs a CUDA build. Current upstream default CUDA architecture selection may omit Pascal 6.1 with Toolkit 13+; qualify the exact binary | Supported vendor claim and native installer; published bundle's GTX 1060 architecture support not verified | Native Windows; current GPU docs list GTX 1060 / CC 6.1 and require driver >=570 for CC 5.0–6.2; actual offload untested | Windows x64/ARM; AVX2 required on x64; 4GB dedicated VRAM recommended |
| Licensing | MIT main project plus dependencies | Core Apache-2.0; Studio AGPL-3.0; bundle dependency audit required | MIT core plus bundled dependency notices | Proprietary desktop terms; lms CLI MIT |
| Integration complexity | Medium: launch flags, process supervision, API adapter, template control | Medium-high: auth, server control, format-dependent engines, custom paths and tool normalization | Low-medium: local HTTP API/CLI, import/digest mapping, cloud disable | Medium: endpoint and lms are rich; legal/redistribution boundary is restrictive |
| Covert adapter complexity | Low-medium for chat; more for native flags/metrics/lifecycle | Medium-high due distinct GGUF vs non-GGUF engines and API dialects | Low-medium; common API plus Ollama-specific import/lifecycle | Medium; common APIs and strong lifecycle, endpoint differences and proprietary deployment terms |

## Model and lease identity matrix

| Data Covert wants to record | llama.cpp | Unsloth | Ollama | LM Studio |
|---|---|---|---|---|
| PID(s) | OS process tree, directly observable when Covert starts it | Studio process plus inference worker/llama-server child; capture all owned PIDs | daemon plus runner child; capture process tree | GUI/llmster/server process and model worker; CLI does not replace OS PID capture |
| Port | Explicit launch flag | CLI-configured API port plus internal engine port | Default 11434 or OLLAMA_HOST | Default 1234 or configured server port |
| Model identity | Command line/path or router ID | Studio model ID and selected backend | API model name and content digest | model identifier and lms ps path |
| Original artifact hash | Covert hashes path before launch | Hash selected GGUF or source file; bind to Studio model selection | Record source GGUF SHA separately from Ollama digest | Hash imported GGUF before/after import or hash resolved model path |
| Owner | Strong if Covert spawned the process; otherwise foreign | CLI launch ownership plus PID tree; verify server marker | Strong if Covert launches daemon; otherwise user-owned | User/Covert ownership depends on who started daemon |
| Health | /health, /v1/health | /api/health | local API reachability and server state | local API reachability and lms status |
| Load state | server/model router state | load/unload API and selected model | /api/ps includes running model state | lms ps / native model list |

## Interpretation rules

1. API feature presence is not model capability. A tool API may prompt-format, parse, or repair output.
2. GGUF file hash equality does not prove equal rendered token sequence. Record chat template, parser, token count, and engine build.
3. For timing comparisons, report server-native prompt processing when available. TTFT is not a substitute for prompt-processing throughput.
4. Use “non-isomorphic” when the artifact bytes, effective context, template, GPU offload, thread count, or sampling budget cannot be matched.
5. “Unknown” and “not tested” must remain distinct from “unsupported”.

## Primary references

- [llama.cpp server](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md), [llama.cpp license](https://github.com/ggml-org/llama.cpp/blob/master/LICENSE)
- [Unsloth README](https://github.com/unslothai/unsloth/blob/main/README.md), [inference source](https://github.com/unslothai/unsloth/blob/main/unsloth_cli/_inference.py)
- [llama.cpp multimodal docs](https://github.com/ggml-org/llama.cpp/blob/master/docs/multimodal.md), [Unsloth inference API announcement](https://github.com/unslothai/unsloth/discussions/5285), [Unsloth inference source](https://github.com/unslothai/unsloth/blob/main/studio/backend/core/inference/inference.py)
- [Ollama OpenAI API](https://docs.ollama.com/api/openai-compatibility), [Anthropic API](https://docs.ollama.com/api/anthropic-compatibility), [model lifecycle](https://docs.ollama.com/api/ps)
- [Ollama vision](https://docs.ollama.com/capabilities/vision), [Ollama embeddings](https://docs.ollama.com/capabilities/embeddings), [LM Studio image input](https://lmstudio.ai/docs/python/llm-prediction/image-input), [LM Studio API](https://lmstudio.ai/docs/developer/rest)
- [llama.cpp CUDA architecture selection](https://github.com/ggml-org/llama.cpp/blob/master/ggml/src/ggml-cuda/CMakeLists.txt#L717-L764), [Ollama GPU compatibility](https://github.com/ollama/ollama/blob/main/docs/gpu.mdx#L193-L224)
- [LM Studio APIs](https://lmstudio.ai/docs/developer/rest), [CLI](https://lmstudio.ai/docs/cli), [headless service](https://lmstudio.ai/docs/developer/core/headless)
