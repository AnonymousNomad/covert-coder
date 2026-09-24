# Local Runtime Benchmark Methodology

- **Status:** harness source and frozen probes prepared; no inference runs performed
- **Date:** 2026-09-24
- **Machine target:** Windows 11, Intel i7-8750H, 16 GB RAM, GTX 1060 6 GB

## Safety and stop condition

A final non-destructive pre-commit check found one active, unqualified llama-server process. System commit was 25,379,328,000 / 31,443,066,880 bytes (80.7%), available physical RAM was 3,225,481,216 bytes, and the GTX 1060 had 933 MiB in use. Runtime installs, model loads, and benchmarks remain deferred. The local runner refuses to execute without a same-run lease file declaring exclusive resource clearance, an owner, runtime PID set, local endpoint, artifact path, and expected SHA-256. It checks well-known runtime processes and listeners before sending any inference request; resource clearance and ownership remain operator-attested, not inferred by the runner. The runner refuses adjacent-lane ports 8097 and 8104 and requires the endpoint to be a literal loopback IP.

Do not include the Resident process or model in the lease. Do not attach to or query a foreign endpoint. Do not use a remembered port until an updated listener check establishes that it is free and assigned to this experiment.

## RT4 apparatus

Research-only files:

- research/runtime-lab/runtime_bakeoff.py — loopback-only OpenAI Chat Completions probe runner, hash guard, exclusive-lease preflight, streaming timing, tool/schema validation, optional backend-native metric collection and resource sampling.
- research/runtime-lab/lease.example.json — fields required for an operator-owned future run; contains no real model path or credential.

The runner does not install, start, stop, unload, or configure a backend. It will not follow redirects, honor HTTP proxy environment variables, call a hosted provider, or send a request to a non-loopback host. The lease must attest that the model is already loaded before the idle sample and warm-up. If an optional metrics endpoint is supplied, its listener must also be loopback-bound and owned by the leased PID set. Lifecycle and backend-native startup/load/unload measurements remain a separate controlled procedure.

## Isomorphism gate

Before any cross-backend comparison:

1. Select one already-owned, modest GGUF only after confirming that Resident does not own or use it.
2. Hash the source artifact once with SHA-256. Every run uses that same file and records the hash. If import or packing makes a new byte sequence, record both hashes and label that backend comparison NON-ISOMORPHIC unless identity is demonstrated.
3. Pin backend version, engine version/build, model alias, prompt and schema bytes, generation settings, context, CPU thread target, GPU offload target, template, and KV-cache profile in each lease.
4. Freeze one request-level prompt and settings across backends. Capture actual prompt-token count and chat-template identity where exposed. A different rendered template/token count is a documented asymmetry.
5. Use a loopback-only endpoint and a newly verified port. Run backends sequentially, one model loaded at a time.
6. Warm once, collect five measured sequential repetitions, and report median, mean, standard deviation, minimum, maximum, failures, and all raw rows. Run separate prompt-processing and generation profiles when the backend exposes exact token counters.

If format, model hash, tokenization/template, context, GPU offload, thread count, or output budget differs and cannot be normalized, report NON-ISOMORPHIC. Do not infer one runtime is faster from a non-isomorphic result.

## Frozen initial settings

| Setting | Initial protocol |
|---|---|
| Model artifact | One modest already-owned GGUF; exact path/hash not selected while ownership is unclear |
| Prompt | Identical bytes from the runner's frozen battery |
| Prompt-processing profile | Fixed 128-record prompt; record actual prompt tokens from usage/native metrics. Call it a pp512 profile only if tokenizer/template inspection confirms the target; otherwise report the actual count. |
| Target context | 4096 tokens, subject to model compatibility and one-time profile freeze |
| Temperature | 0 |
| Top-p | 1 |
| Seed | 42 where backend accepts the common field |
| Output budget | 128 tokens for throughput; 128 for tool/schema checks |
| Repetitions | One warm-up plus five measured requests per case |
| GPU offload | Freeze a common target only after model is selected; record actual applied setting |
| CPU threads | 6 physical-core target where exposed; otherwise record effective/unknown value |
| Parallelism | Single request for the initial sequential profile |
| Network | Local loopback only; no provider API or cloud model |

Fields that a backend hides or ignores are recorded as unknown, not assumed equal. The target-context profile may be reduced before the first run only if the chosen artifact's memory requirements demand it; after that change, freeze the same value for every backend.

## Measurements

For every request, capture:

- wall-clock total latency and monotonic TTFT at first streamed content/tool delta;
- server-reported prompt and completion token counts;
- generation tokens/sec from server timings or completion-token count over post-first-token elapsed time;
- prompt-processing tokens/sec only from backend-native prompt counters/timings; do not use TTFT as a substitute;
- HTTP status, stream completion, finish reason, timeout, exception, retry, and request success;
- system available RAM, process working set/private bytes if available, Windows commit bytes/limit, GPU utilization and used/total VRAM;
- request settings, runtime version, model identity, artifact SHA, and any unavailable metric reason.

Load/startup, unload, switch, idle memory, and server recovery require a separate lifecycle run. Record elapsed time from command/API request start to a backend health+model-ready condition. After unload, verify both backend load state and process/VRAM behavior. Never treat an API acknowledgement by itself as proof of memory release.

## Frozen tool-call battery

The runner sends a single local-only function definition with required fields and an exact harmless task:

- Tool: schedule_rehearsal
- Required values: title, ISO date, remote boolean
- Expected arguments: title Runtime Lab, date 2026-10-02, remote false
- No external tool is executed.
- Validate tool selection, exact function name, JSON arguments, required keys/types, no undeclared keys, no wrapper prose masquerading as JSON, and finish reason.

Result fields separate:

- api_tool_call_valid: normalized API result passes the frozen schema.
- raw_output_class: one of MODEL OUTPUT VALID, BACKEND REPAIRED, BACKEND FAILED, APPARATUS INVALID.

Only classify MODEL OUTPUT VALID when a raw pre-parser model trace is available and independently validates. Classify BACKEND REPAIRED only when the backend provides an explicit repair event/raw-before and normalized-after pair. If the API hides that provenance, mark APPARATUS INVALID for the attribution subtest while keeping the end-to-end API validity result. Do not count a repaired call as raw model capability.

## Frozen structured-output battery

Schema:

    {
      "type": "object",
      "properties": {
        "minimum": {"type": "integer"},
        "maximum": {"type": "integer"},
        "status": {"type": "string", "enum": ["ok", "needs_review"]}
      },
      "required": ["minimum", "maximum", "status"],
      "additionalProperties": false
    }

Prompt: Given the integers 7, 2, and 9, return minimum 2, maximum 9, and status ok. Return only the schema object.

Validate JSON parse, required/missing fields, types, enum, extra keys, trailing prose, value correctness, retries, and response completion. The current runner is one-shot and records zero client retries plus whether a retry would be needed; backend-internal retries are unobservable through the common API. Do not accept a second repair/retry as first-attempt compliance; retain both outcomes when a future backend-specific trace probe is added.

## Stability and lifecycle follow-up

Run only after exclusive process, VRAM, RAM, and model ownership is clear:

1. Five sequential throughput requests, then repeated context growth at fixed increments.
2. Cancel one streamed request mid-generation; verify client and backend processing actually stop.
3. Inject an invalid request, then verify the next valid request succeeds.
4. Load/unload five cycles; switch to a second small artifact only if already owned and useful.
5. Restart the owned server and verify PID/port/health/model identity are updated in the lease.
6. Observe loaded-idle resource use at 30 seconds and 5 minutes, and post-unload memory release.
7. Attempt a port collision only in a disposable local slot and verify the runner refuses it without contacting the existing listener.
8. Verify tool and schema batteries again after model switch/restart.

Track startup success, request success, crash count, recovery duration, and context overflow handling. Stop on unexpected foreign PID, port ownership, GPU use, commit growth, crash, or uncertain model ownership.

## Backend-specific notes

- **llama.cpp:** capture exact source SHA/build backend, binary hash, command line, context/batch, GPU layers, threads, KV types, mmap, metrics, slots/parallel setting, template, and speculative config. Optional metrics provide prompt/generation counters and speculative counters. [Server metrics](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md#L1434-L1456)
- **Unsloth:** pin Desktop/Studio release and underlying engine. GGUF goes through llama-server; non-GGUF is not an isomorphic comparison. Record Studio root, installed packages, auth/config files without printing credential values, model selection, child PID tree, and whether discovery made outbound requests. Do not install during current foreign ownership.
- **Ollama:** use the local GGUF import path and record source SHA, resulting Ollama digest, Modelfile/template/options, OLLAMA_NO_CLOUD=1, model keep-alive, /api/ps state, and native timings. [GGUF Modelfile](https://docs.ollama.com/modelfile), [cloud disable](https://github.com/ollama/ollama/blob/main/docs/faq.mdx)
- **LM Studio:** record app and llama.cpp runtime versions, selected model path, load profile, GUI/headless mode, lms ps/load/unload outputs, server endpoint, and exact model SHA after import. Use the documented CLI/API only. Do not package the desktop app. [Runtime CLI](https://lmstudio.ai/docs/cli), [headless](https://lmstudio.ai/docs/developer/core/headless)

## Current run record

| Checkpoint | Status | Evidence |
|---|---|---|
| RT0 isolated branch/worktree | Complete | Starting SHA and clean worktree recorded in evaluation doc |
| RT1 Unsloth reconnaissance | Complete, source-only | Official README and source observations; no install |
| RT2 backend matrix | Complete, source-only | Capability matrix with unknowns retained |
| RT3 Broker candidate | Complete, design-only | Minimal contract and lease draft |
| RT4 apparatus | Implemented; static checks pass | Runner AST parse, example lease JSON parse, CLI help, and diff checks pass; no inference request was sent |
| RT5 direct llama.cpp baseline | Deferred | Foreign llama-server present; exact build/config not qualified |
| RT6 Unsloth | Deferred | No install/run |
| RT7 Ollama | Deferred | No install/run |
| RT8 LM Studio | Deferred | No install/run |
| RT9 cross-backend analysis | Deferred | No controlled results |
| RT10 final empirical recommendation | Deferred | Only evidence-based preliminary recommendation available |

## Primary references

- [llama.cpp server API and metrics](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md)
- [Unsloth inference routing](https://github.com/unslothai/unsloth/blob/main/unsloth_cli/_inference.py), [offline model catalog behavior](https://github.com/unslothai/unsloth/blob/main/studio/backend/core/inference/orchestrator.py)
- [Ollama API](https://docs.ollama.com/api/openai-compatibility), [Modelfile](https://docs.ollama.com/modelfile)
- [LM Studio local APIs](https://lmstudio.ai/docs/developer/rest), [CLI](https://lmstudio.ai/docs/cli)
