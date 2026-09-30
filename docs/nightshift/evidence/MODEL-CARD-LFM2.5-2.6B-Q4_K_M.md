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
| Upstream base-card snapshot | [`LiquidAI/LFM2.5-2.6B`](https://huggingface.co/LiquidAI/LFM2.5-2.6B/tree/dca1825886789bd40b94368f53b1d9ada4c94598), commit `dca1825886789bd40b94368f53b1d9ada4c94598`; consulted for model behavior, not independent proof of the GGUF conversion's original weight revision |
| Upstream integrity | The revision's file size and LFS SHA-256 match the local file exactly. The original download revision/date is not recoverable from local state. |
| License | Repository metadata says `other`; supplied license is **LFM Open License v1.0**. The license has commercial-use restrictions. Redistribution clearance is not established by this card. |

The local checksum and GGUF header were read without loading model weights. The pinned upstream base-card snapshot describes this as a 2.69B hybrid model and documents its chat and tool formats. See the [base card at commit `dca1825886789bd40b94368f53b1d9ada4c94598`](https://huggingface.co/LiquidAI/LFM2.5-2.6B/blob/dca1825886789bd40b94368f53b1d9ada4c94598/README.md), the [GGUF model card at the exact artifact revision](https://huggingface.co/LiquidAI/LFM2.5-2.6B-GGUF/blob/e7caca5d835a3901a8e0d63e94009429bafafdfc/README.md), and the [license at that revision](https://huggingface.co/LiquidAI/LFM2.5-2.6B-GGUF/blob/e7caca5d835a3901a8e0d63e94009429bafafdfc/LICENSE). llama.cpp's [quantization enum](https://github.com/ggml-org/llama.cpp/blob/master/include/llama.h) assigns value 15 to Q4_K_M.

## Template, tokens, and generation behavior

- The GGUF embeds `tokenizer.chat_template`. Its local SHA-256 is `ea663864491de7ade391839479860ca95541f892f72665c73251fbd4643b1bef` (5,443 bytes). The embedded template includes system, user, and assistant roles; the `bos_token` placeholder; the LFM message markers; the `<think>` section; and `<|tool_call_start|>` / `<|tool_call_end|>` handling.
- The embedded assistant generation prefix includes `<|im_start|>assistant\n<think>`. This embedded template is the intended source; do not replace it with a generic Covert or ChatML template. Covert's load request now sends explicit JSON `chat_template_override: null`. In the exact installed Unsloth `2026.9.11` route, an omitted field could inherit same-model `llama_extra_args`, including a stale `--chat-template-file`; an explicitly present null strips the inherited template-file flag. The LFM family has no bundled family override, so the pinned resolver then uses the GGUF metadata template, subject to its narrowly scoped numeric-member compatibility repair. This confirms the source-level selection after the adapter repair, not a fresh live load or rendered prompt. See the [runtime closure evidence](LOCAL-RUNTIME-CLOSURE-2026-09-30.md#stale-same-model-template-override-root-cause-and-repair).
- The model-specific upstream docs describe `system` as optional and `user`, `assistant`, and `tool` as supported roles. They define `<|startoftext|>` as conversation start, `<|im_start|>` plus a role/newline as message start, and `<|im_end|>` as message end. The template's generation prefix and `<think>` block are part of the model's reasoning behavior. These are template semantics; they do not prove that the Unsloth endpoint stops generation on any particular token. See the [Liquid chat-template guide](https://docs.liquid.ai/lfm/key-concepts/chat-template) and [pinned LFM2.5 base card](https://huggingface.co/LiquidAI/LFM2.5-2.6B/blob/dca1825886789bd40b94368f53b1d9ada4c94598/README.md).
- GGUF tokenizer metadata reports BOS ID `124894`, EOS ID `124900`, and no explicit `add_bos_token` value. The Covert model-load payload sends `chat_template_override: null`; the chat-completion payload has no explicit `stop` list. Keep effective runtime stop behavior **UNKNOWN**; neither the message-end marker nor EOS metadata alone establishes how the Unsloth server stops generation. The historical `finish_reason=stop` response does not identify which token ended generation. The pinned source confirms the template-selection route only; it does not establish token-level stop behavior for this model.
- Official tool guidance says LFM2.5 emits Pythonic function-call text between `<|tool_call_start|>` / `<|tool_call_end|>` by default; JSON calls require an explicit instruction, and tool results return under the `tool` role before another assistant turn. Covert's one harmless Passport probe remains **PARTIAL** and its strict runtime/tool contract still needs role-specific qualification. See the [Liquid tool-use guide](https://docs.liquid.ai/lfm/key-concepts/tool-use).
- Upstream documents tool formatting, but Covert's prior Runtime Passport classifies tool calling **PARTIAL**: one frozen harmless workspace-read call passed; malformed arguments were rejected; this does not qualify general agentic tool use.
- The model card's generation sample uses temperature `0.1`, top-k `50`, and repeat penalty `1.1`. The prior Covert Runtime Passport tested a distinct request profile of temperature `0` and maximum output `512`; those values must not be conflated with upstream defaults.
- Upstream recommends this candidate for tool use, extraction, RAG, and long-context work, and cautions against agentic coding and knowledge-heavy tasks. Those recommendations are vendor guidance, not Covert role qualifications; no coding or knowledge-heavy role should be assigned based on model size or successful load alone.

## Model-specific runtime profile

| Profile item | Recorded value and limitation |
|---|---|
| Canonical backend | Unsloth `2026.9.11`; Runtime Broker selects `UNSLOTH` |
| Serving backend | Vulkan through Unsloth-managed llama-server |
| Qualified host scope | Native Windows 11 Administrator; GTX 1060 Mobile, 6 GiB VRAM; this does not generalize to another OS, account type, GPU, backend, or runtime version |
| Runtime endpoint | Loopback `127.0.0.1:18888`; authentication is handled through the protected local credential slot; no credential value is stored in this card |
| Context request | The imported Model Access record declares 32,768 tokens and `BrokerModelRuntime` forwards that as the load request. The Passport reports **effective served context UNKNOWN**; do not claim 32,768 or 131,072 as measured served context. |
| GPU layer allocation | Unsloth-managed; exact layer count is not exposed in the qualified profile |
| Resource projection | Per-model peak RAM, commit, and VRAM demand is **UNKNOWN**; GGUF file size is not a resident-memory estimate. The Passport's pre-start host sample below is measured history, not a projected demand model. Current admission floors remain 6.5 GiB free physical RAM, 5.0 GiB free commit, 4.5 GiB free VRAM, and GPU utilization below 50%. |
| Threads / batch | Not exposed in the Passport; `UNKNOWN` |
| mmap / mlock | Not exposed in the Passport; `UNKNOWN` |
| Chat template source | Embedded GGUF template is intended. Covert sends `chat_template_override: null` to suppress inherited same-model template-file flags. The installed `2026.9.11` source then uses model metadata unless a narrow numeric-member compatibility repair is needed. The current loaded-server instance remains unobserved. |
| Stop handling | Covert API sends no explicit `stop` field. Effective EOS/stop-token behavior and any server-side stop list remain **UNKNOWN**; no independent stop-sequence profile is persisted |
| Measured Covert request profile | Temperature `0`, max output `512`; this is prior Passport evidence, not a new run |
| Prior host start sample | 7.116 GiB free physical RAM, 16.615 GiB free commit, 5.296 GiB free VRAM, 26% GPU utilization |
| Prior cold load | 48.35 seconds to healthy loaded model |
| Prior bounded soak | 30 minutes; 19 requests, 0 failures, no monotonic memory growth observed. The prior in-run stop floor is not permission to lower the current start floor. |

The model context request is stored in the existing imported Model Access record; the frozen backend/artifact binding and measured request profile are in the prior [Runtime Passport](../../design/local-runtime-lab/evidence/UNSLOTH-RUNTIME-PASSPORT-V1.json). The canonical Authority-governed `/api/models/profile` route now writes an atomic sidecar bound to the exact artifact SHA, runtime id, and runtime version. For this Unsloth adapter, it accepts the supported context request, temperature, and output-token limit; a start refuses a missing, stale, malformed, or incompatible profile. Single-sample local chat leaves temperature unset when the caller omits it, allowing the saved profile to apply; explicit request options still take precedence. The embedded GGUF template remains the template source with no override.

At the time of this card update, the actual model artifact still has **no adjacent `.profile.json`**. No profile was written directly to the user's model collection. The frozen Passport supports a requested profile of context `32768`, temperature `0`, and maximum output `512`; the context remains a load request, not a measured effective window. That profile must be persisted through the Authority route before another canonical start. Threads, batch settings, mmap/mlock, GPU layer count, separate stop strings, and effective served context remain `UNKNOWN`; unsupported fields cannot be silently persisted by this adapter.

## Qualification and limitations

- **Prior runtime-profile qualification:** the exact artifact/runtime/host scope in the Passport passed load, health, exact identity, generation, streaming, cancellation, unload/reload, restart/reload, and the bounded soak. This is historical evidence for that frozen scope.
- **Current Model Access status:** start requires a fresh Resource Admission decision and runtime preflight. The current resource check refuses because physical RAM is below the 6.5 GiB floor. No runtime was started during this closure run.
- **Not qualified:** broad model compatibility, effective served context, switching to another model, native strict structured output, general tool execution, coding, Resident, redistribution, or other hardware/runtime configurations.
- Keep this artifact opt-in. Do not silently substitute a different model if it is unavailable, and do not treat artifact presence or the prior Passport as proof that the current host is ready now.
