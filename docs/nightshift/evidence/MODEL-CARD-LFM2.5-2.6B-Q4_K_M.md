# Model Card — LFM2.5 2.6B Q4_K_M

**State:** exact artifact identity matched; prior exact-profile runtime evidence exists; current Model Access start remains blocked by host admission. This card does not establish a new runtime run or a coding/Resident role qualification.

## Identity and provenance

| Field | Verified value |
|---|---|
| Local artifact | `E:\models\house-model\lfm25_gguf\LFM2.5-2.6B-Q4_K_M.gguf` |
| Size | 1,674,455,040 bytes |
| SHA-256 | `02a8b7e17487d326e46d68ce0ba24211e1b80a14c4cd0597fa73c1cd697f52ed` |
| GGUF | v3; architecture `lfm2`; `general.file_type=15`, which llama.cpp maps to Q4_K_M |
| Model size | Upstream reports 2.69B parameters; 30 blocks; hybrid LFM2 architecture; 131,072-token model context limit |
| MoE count | No expert/router metadata or active-vs-total MoE parameter split was identified; do not describe this candidate as an MoE |
| Upstream | [`LiquidAI/LFM2.5-2.6B-GGUF`](https://huggingface.co/LiquidAI/LFM2.5-2.6B-GGUF/tree/e7caca5d835a3901a8e0d63e94009429bafafdfc), revision `e7caca5d835a3901a8e0d63e94009429bafafdfc`, file `LFM2.5-2.6B-Q4_K_M.gguf` |
| Upstream integrity | The revision's file size and LFS SHA-256 match the local file exactly. The original download revision/date is not recoverable from local state. |
| License | Repository metadata says `other`; supplied license is **LFM Open License v1.0**. The license has commercial-use restrictions. Redistribution clearance is not established by this card. |

The local checksum and GGUF header were read without loading model weights. The upstream model card describes this as a 2.69B hybrid model and documents its chat and tool formats. See the [base model card](https://huggingface.co/LiquidAI/LFM2.5-2.6B/blob/main/README.md), [GGUF model card](https://huggingface.co/LiquidAI/LFM2.5-2.6B-GGUF/blob/main/README.md), and [license text](https://huggingface.co/LiquidAI/LFM2.5-2.6B-GGUF/blob/main/LICENSE). llama.cpp's [quantization enum](https://github.com/ggml-org/llama.cpp/blob/master/include/llama.h) assigns value 15 to Q4_K_M.

## Template, tokens, and generation behavior

- The GGUF embeds `tokenizer.chat_template`. Its local SHA-256 is `ea663864491de7ade391839479860ca95541f892f72665c73251fbd4643b1bef` (5,443 bytes). The embedded template includes system, user, and assistant roles; the `bos_token` placeholder; the LFM message markers; the `<think>` section; and `<|tool_call_start|>` / `<|tool_call_end|>` handling.
- The embedded assistant generation prefix includes `<|im_start|>assistant\n<think>`. Use the embedded template through the runtime. Do not replace it with a generic Covert or ChatML template.
- GGUF tokenizer metadata reports BOS ID `124894`, EOS ID `124900`, and no explicit `add_bos_token` value. The upstream card documents the corresponding LFM message and thinking format. Explicit runtime stop-string configuration was not captured independently; keep that field `UNKNOWN` instead of inferring it from a one-time response.
- Upstream documents tool formatting, but Covert's prior Runtime Passport classifies tool calling **PARTIAL**: one frozen harmless workspace-read call passed; malformed arguments were rejected; this does not qualify general agentic tool use.
- The model card's generation sample uses temperature `0.1`, top-k `50`, and repeat penalty `1.1`. The prior Covert Runtime Passport tested a distinct request profile of temperature `0` and maximum output `512`; those values must not be conflated with upstream defaults.
- The upstream model card cautions against agentic coding and knowledge-heavy workloads. No coding, Resident, planning, review, autocomplete, or fine-tuning role is qualified here.

## Model-specific runtime profile

| Profile item | Recorded value and limitation |
|---|---|
| Canonical backend | Unsloth `2026.9.11`; Runtime Broker selects `UNSLOTH` |
| Serving backend | Vulkan through Unsloth-managed llama-server |
| Qualified host scope | Native Windows 11 Administrator; GTX 1060 Mobile, 6 GiB VRAM; this does not generalize to another OS, account type, GPU, backend, or runtime version |
| Runtime endpoint | Loopback `127.0.0.1:18888`; authentication is handled through the protected local credential slot; no credential value is stored in this card |
| Context request | The imported Model Access record declares 32,768 tokens and `BrokerModelRuntime` forwards that as the load request. The Passport reports **effective served context UNKNOWN**; do not claim 32,768 or 131,072 as measured served context. |
| GPU layer allocation | Unsloth-managed; exact layer count is not exposed in the qualified profile |
| Threads / batch | Not exposed in the Passport; `UNKNOWN` |
| mmap / mlock | Not exposed in the Passport; `UNKNOWN` |
| Chat template source | Embedded GGUF template above; no override |
| Separate stop strings | `UNKNOWN`; EOS token ID is recorded, but no independent stop-sequence profile is persisted |
| Measured Covert request profile | Temperature `0`, max output `512`; this is prior Passport evidence, not a new run |
| Prior host start sample | 7.116 GiB free physical RAM, 16.615 GiB free commit, 5.296 GiB free VRAM, 26% GPU utilization |
| Prior cold load | 48.35 seconds to healthy loaded model |
| Prior bounded soak | 30 minutes; 19 requests, 0 failures, no monotonic memory growth observed. The prior in-run stop floor is not permission to lower the current start floor. |

The model context request is stored in the existing imported Model Access record; the frozen backend/artifact binding and measured request profile are in the prior [Runtime Passport](../../design/local-runtime-lab/evidence/UNSLOTH-RUNTIME-PASSPORT-V1.json). There is no adjacent `.profile.json` for this artifact. The generic legacy sidecar profile does not configure the canonical Unsloth adapter; this card therefore records unavailable backend parameters as `UNKNOWN` instead of writing an ineffective sidecar or changing the qualified profile.

## Qualification and limitations

- **Prior runtime-profile qualification:** the exact artifact/runtime/host scope in the Passport passed load, health, exact identity, generation, streaming, cancellation, unload/reload, restart/reload, and the bounded soak. This is historical evidence for that frozen scope.
- **Current Model Access status:** start requires a fresh Resource Admission decision and runtime preflight. The current resource check refuses because physical RAM is below the 6.5 GiB floor. No runtime was started during this closure run.
- **Not qualified:** broad model compatibility, effective served context, switching to another model, native strict structured output, general tool execution, coding, Resident, redistribution, or other hardware/runtime configurations.
- Keep this artifact opt-in. Do not silently substitute a different model if it is unavailable, and do not treat artifact presence or the prior Passport as proof that the current host is ready now.
