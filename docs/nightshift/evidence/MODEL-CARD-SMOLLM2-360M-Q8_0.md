# Model Card — SmolLM2 360M Instruct Q8_0

**State:** `ARTIFACT_OBSERVED`; upstream GGUF file identity and embedded-template bytes are established. Effective runtime-template selection, canonical configuration, runtime, and Covert role qualification remain **UNVERIFIED / REQUIRED**. This is not a rejection of the model.

## Identity and provenance

| Field | Verified value |
|---|---|
| Local artifact | `E:\models\smollm2-360m-instruct-q8_0.gguf` |
| Size | 386,404,992 bytes |
| SHA-256 | `48ab3034d0dd401fbc721eb1df3217902fee7dab9078992d66431f09b7750201` |
| GGUF metadata | v3; architecture `llama`; file type `7`; quantization version `2`; license metadata `apache-2.0` |
| Quantization | Q8_0, matching the upstream GGUF filename/card and Covert pack record; llama.cpp maps `LLAMA_FTYPE_MOSTLY_Q8_0` to file type `7` |
| Parameters | 360M dense model; no expert/router metadata or MoE active-parameter split was found |
| Upstream GGUF artifact | [`HuggingFaceTB/SmolLM2-360M-Instruct-GGUF`](https://huggingface.co/HuggingFaceTB/SmolLM2-360M-Instruct-GGUF/tree/2633adad3eb0aec759aec7f41db367d974571ecf), file revision `2633adad3eb0aec759aec7f41db367d974571ecf` |
| Upstream file integrity | The file at that revision reports 386,404,992 bytes and LFS SHA-256 `48ab3034d0dd401fbc721eb1df3217902fee7dab9078992d66431f09b7750201`, matching the local artifact and checked-in manifest. The original local acquisition date is not recorded. |
| Base model | [`HuggingFaceTB/SmolLM2-360M-Instruct`](https://huggingface.co/HuggingFaceTB/SmolLM2-360M-Instruct/tree/a10cc1512eabd3dde888204e902eca88bddb4951), base-card/config snapshot `a10cc1512eabd3dde888204e902eca88bddb4951`; this snapshot is not separate proof of the GGUF conversion's exact source-weight revision |
| License | Upstream model and GGUF card identify Apache-2.0; GGUF metadata also says `apache-2.0`. The local pack is optional and opt-in. |

The local SHA and metadata are recorded in the [13-file host inventory](local-gguf-host-inventory-2026-09-30.md). The upstream GGUF file revision, size, and LFS hash were read from Hugging Face metadata without downloading model weights. The GGUF repository card attributes the conversion to the HuggingFaceTB base model. The manifest's earlier `@main` reference is mutable; this card pins the exact upstream GGUF file commit recovered by matching its content hash.

## Template, tokens, and generation behavior

- The local GGUF contains `tokenizer.chat_template` (368 UTF-8 bytes; SHA-256 `872be49dbb638044ad01b60388f48d469ff2980e5f0dccdc22ec907db54d0788`). It renders each message as `<|im_start|>{role}\n{content}<|im_end|>\n` and ends with the assistant prefix `<|im_start|>assistant\n` when a generation prompt is requested.
- If the first message is not `system`, the template inserts a default system message: “You are a helpful AI assistant named SmolLM, trained by Hugging Face”. An explicit first system message suppresses that insertion. The upstream tokenizer configuration maps `<|im_start|>` to BOS and `<|im_end|>` to EOS; the GGUF records BOS ID `1`, EOS ID `2`, and `add_bos_token=false`.
- The pinned base tokenizer configuration also lists special tokens `<|endoftext|>`, `<repo_name>`, `<reponame>`, `<file_sep>`, `<filename>`, `<gh_stars>`, `<issue_start>`, `<issue_comment>`, `<issue_closed>`, `<jupyter_start>`, `<jupyter_text>`, `<jupyter_code>`, `<jupyter_output>`, `<jupyter_script>`, and `<empty_output>`. The GGUF chat template does not use these as a general tool protocol; their task-specific behavior has not been qualified by Covert.
- This template has no `<think>` section or dedicated tool-call markers. The upstream model card describes function calling for the 1.7B model variant; it does not establish function calling for this 360M artifact. No Covert tool behavior is qualified.
- The upstream model-card example uses `max_new_tokens=50`, temperature `0.2`, `top_p=0.9`, and sampling enabled. Those are example settings, not a Covert profile or measured defaults. The upstream card says the family primarily handles English and warns outputs may be inaccurate, inconsistent, or biased. Vendor claims and benchmarks are not Covert role qualification.
- Covert's current local completion adapter sends structured messages and may send tools, temperature, and max tokens; it does not send explicit `stop` or `chat_template` fields. Effective selection of this GGUF template and effective EOS/stop behavior in the installed runtime remain **UNKNOWN** until directly verified.

## Model-specific runtime profile

| Profile item | Recorded value and limitation |
|---|---|
| Covert catalog roles | Manifest/packs describe `fast-chat`, chat/research/fast, planning, summarization, and autocomplete, with a catalog system prompt for its fast research lane. `hardware-profile.mjs` currently selects this pack for the planner preference. These are catalog recommendations, not qualified roles or verified prompt behavior. |
| Canonical backend | Covert selects Unsloth. The accepted Unsloth Passport is bound to the exact Liquid LFM2.5 artifact, not this file; SmolLM2 is outside that profile and cannot currently start through the canonical Broker. |
| Upstream runtime examples | The pinned GGUF card documents llama.cpp commands. The accepted Covert architecture keeps direct llama.cpp as reference/recovery only; an alternate launch is not Covert runtime proof. |
| Context | GGUF model context metadata is 8,192 tokens. Covert's optional-pack manifest requests 2,048 tokens. The latter is a catalog/load request; effective served context is **UNKNOWN**. |
| GPU offload | **UNKNOWN** for this artifact under the canonical runtime. |
| Threads / batch | **UNKNOWN**. |
| mmap / mlock | **UNKNOWN** for the canonical runtime path. |
| Chat template source | Embedded GGUF template is the intended model-specific source. Covert sends no template override, but effective runtime selection remains **UNKNOWN**. |
| Stop behavior | GGUF EOS is `<|im_end|>` / token ID `2`; Covert has no explicit stop list for this artifact. Effective server behavior remains **UNKNOWN**. |
| Sampler/profile persistence | Upstream example settings are above. No Authority-saved sidecar exists for this local file; no SmolLM2 runtime profile is accepted by the current exact-artifact Unsloth qualification. |
| Resource projection | Per-model peak RAM, commit, and VRAM demand is **UNKNOWN**. File size is not a resident-memory estimate. Preserve current admission floors: 6.5 GiB free physical RAM, 5.0 GiB free commit, 4.5 GiB free VRAM, and GPU utilization below 50%. |
| Host scope | No canonical runtime start or model generation has been attempted for this artifact. |

## Covert integration and qualification

- The optional pack's exact bytes are present at `E:\models`, but there is no copy under the canonical checkout's `models/` directory, no adjacent `.profile.json`, and no Model Access import/Authority-saved runtime profile for this file. The canonical Broker's manifest-relative entry therefore does not make this external artifact startable.
- The manifest now declares `status=pending`; current Broker readiness is independently derived from artifact availability, the exact accepted runtime/artifact profile, and runtime status. The static catalog label is not current `RUNNING` or `READY` inference.
- Evidence classification for this artifact is `ARTIFACT_OBSERVED` / `TEMPLATE_PRESENT` / `EFFECTIVE_TEMPLATE_UNVERIFIED` / `CONFIGURATION_REQUIRED` / `RUNTIME_UNVERIFIED` / `ROLE_QUALIFICATION_REQUIRED`. No live runtime API state was queried and no failed model result is recorded.
- Latest post-test canonical Resource Admission at `2026-09-30T09:12:21.008Z` returned `REFUSE_RESOURCE`: Node measured 5,158 MiB free physical RAM vs. the unchanged 6,656 MiB floor; free commit was 8,656 MiB / 5,120 MiB, free VRAM 5,175 MiB / 4,608 MiB, and GPU utilization 7% / below 50%. Physical RAM alone refused. No model start was attempted. Re-run the full ladder only after a new immediate admission passes and a governed canonical profile path exists: exact artifact → correct effective template → admission → Broker start/identity/health → plain and multi-turn generation → cancellation → stop/release → restart/generation → role-specific probes.

## Upstream references

- [GGUF model card at the exact artifact-file commit](https://huggingface.co/HuggingFaceTB/SmolLM2-360M-Instruct-GGUF/blob/2633adad3eb0aec759aec7f41db367d974571ecf/README.md)
- [Base model card at the recorded snapshot](https://huggingface.co/HuggingFaceTB/SmolLM2-360M-Instruct/blob/a10cc1512eabd3dde888204e902eca88bddb4951/README.md), [tokenizer configuration](https://huggingface.co/HuggingFaceTB/SmolLM2-360M-Instruct/blob/a10cc1512eabd3dde888204e902eca88bddb4951/tokenizer_config.json), and [generation configuration](https://huggingface.co/HuggingFaceTB/SmolLM2-360M-Instruct/blob/a10cc1512eabd3dde888204e902eca88bddb4951/generation_config.json)
- llama.cpp's [`llama_ftype` enum](https://github.com/ggml-org/llama.cpp/blob/master/include/llama.h#L2367-L2390) for the GGUF file-type mapping
