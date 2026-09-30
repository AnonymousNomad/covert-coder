# Model Card — Qwen2.5-Coder 1.5B Instruct Q4_K_M

**State:** `UPSTREAM_ARTIFACT_PINNED`; the exact catalog GGUF source file and upstream base tokenizer/configuration are pinned below. The local GGUF is **absent** from the bounded host inventory and checkout, so its GGUF header, embedded template, local hash match, runtime configuration, execution, and Covert role qualification remain **UNVERIFIED / REQUIRED**. This is not a model failure or rejection.

## Identity and provenance

| Field | Verified value |
|---|---|
| Covert catalog artifact | `qwen2.5-coder-1.5b-instruct-q4_k_m.gguf`; optional pack `qwen-coder-1.5b-q4` |
| Local artifact | **Not found** under `E:\models` or checkout `models/`; no local SHA or local GGUF metadata can be claimed |
| Pinned upstream artifact | [`Qwen/Qwen2.5-Coder-1.5B-Instruct-GGUF`](https://huggingface.co/Qwen/Qwen2.5-Coder-1.5B-Instruct-GGUF/tree/f86cb2c1fa58255f8052cc32aeede1b7482d4361), repo snapshot `f86cb2c1fa58255f8052cc32aeede1b7482d4361`; file `qwen2.5-coder-1.5b-instruct-q4_k_m.gguf` |
| Upstream file size and SHA-256 | 1,117,320,768 bytes; `cc324af070c2ecbfd324a30884d2f951a7ff756aba85cb811a6ec436933bb046` from Hugging Face LFS metadata |
| Format / quantization | Upstream repository identifies a GGUF Q4_K_M file. No local GGUF header/file-type verification has been possible. |
| Base model identity | [`Qwen/Qwen2.5-Coder-1.5B-Instruct`](https://huggingface.co/Qwen/Qwen2.5-Coder-1.5B-Instruct/tree/2e1fd397ee46e1388853d2af2c993145b0f1098a), pinned base/config/tokenizer snapshot `2e1fd397ee46e1388853d2af2c993145b0f1098a` |
| Architecture / parameters | Base config reports architecture `qwen2`, 28 layers, hidden size 1,536, 12 query heads / 2 KV heads, 32,768 configured positions. Upstream model card reports 1.54B total / 1.31B non-embedding parameters. Dense configuration; no MoE expert/router split is declared. GGUF header is still unverified locally. |
| License | Both upstream repositories declare Apache-2.0. Preserve the license and attribution files with any redistributed pack; package-level legal review remains outside this model card. |

The exact source file hash and size were read from upstream repository metadata; model weights were not downloaded. The catalog previously used a mutable `@main` reference. This card pins the source snapshot that reports the catalog's expected hash. That does not prove any absent local file matches it.

## Template, tokens, and generation behavior

- Pinned upstream `tokenizer_config.json` has a 2,507-byte `chat_template`, SHA-256 `cd8e9439f0570856fd70470bf8889ebd8b5d1107207f67a5efb46e342330527f`. This fingerprints the **base tokenizer reference**, not an absent GGUF's embedded `tokenizer.chat_template`; compare the latter before using the local artifact.
- The template accepts an initial system message or inserts Qwen's default assistant system text. It formats user/system/assistant messages with `<|im_start|>{role}\n...<|im_end|>`, then opens `<|im_start|>assistant\n` for generation. Upstream tokenizer config has `add_bos_token=false`, no declared tokenizer `bos_token`, and EOS spelling `<|im_end|>`.
- Pinned generation config lists `bos_token_id=151643`, `eos_token_id=[151645,151643]`, temperature `0.7`, top-p `0.8`, top-k `20`, and repetition penalty `1.1`. Qwen's special-token table identifies `<|im_start|>` as 151644 and `<|im_end|>` as 151645; the tokenizer config uses `<|endoftext|>` as padding. The relationship between generation config BOS ID and prompt rendering must be checked against the actual GGUF/runtime tokenizer before profile acceptance.
- The Coder token set also includes `<|fim_prefix|>` 151659, `<|fim_middle|>` 151660, `<|fim_suffix|>` 151661, `<|fim_pad|>` 151662, `<|repo_name|>` 151663, and `<|file_sep|>` 151664. Their completion semantics are task-specific and not qualified by Covert.
- When a `tools` list is supplied, the upstream template emits a tool-instruction block, serializes calls inside `<tool_call>` markers, wraps results in `<tool_response>`, and resumes with the assistant prefix. This establishes upstream formatting behavior only. Covert's argument serialization, returned-call parsing, authority mediation, and tool-use reliability remain unqualified.
- Covert's load request sends `chat_template_override: null` to prevent stale same-model Unsloth template-file flags from shadowing the artifact default. The local GGUF is absent, so its embedded template and effective BOS insertion cannot be compared with the pinned base tokenizer config. Stop-token behavior and tool protocol at the canonical endpoint remain **UNKNOWN**. Do not diagnose bad output as a model failure until the exact artifact configuration and runtime behavior are checked.

## Model-specific runtime profile

| Profile item | Recorded value and limitation |
|---|---|
| Catalog intent | Manifest labels this optional candidate `builder` / `build` / `verify` and requests an 8,192-token context. These are catalog choices, not demonstrated Covert capability. |
| Canonical backend | Covert currently selects Unsloth. The accepted Unsloth Passport/profile is bound to the Liquid LFM artifact; no exact-SHA profile is present for this Qwen artifact. |
| Upstream examples | Qwen's GGUF repository documents llama.cpp and SGLang examples; the base card documents tokenizer-driven Transformers generation. These are upstream examples, not Covert runtime proof. Do not substitute a hand-launched server for the canonical Broker path. |
| Context | Base config is 32,768 positions. The upstream 1.5B card discusses a longer theoretical window with YaRN and says the current config is set to 32,768; Covert requests 8,192. Effective loaded context and any GGUF conversion-specific value are **UNKNOWN**. Do not enable long-context extensions without a model-specific runtime profile. |
| GPU offload / threads / batch | **UNKNOWN** for the Covert runtime and this exact file. |
| mmap / mlock | **UNKNOWN** for the canonical runtime. |
| Template source | Pinned base tokenizer template is a reference. Prefer the local GGUF's embedded template only after parsing and validating it against this reference. No override is currently sent; effective selection is **UNKNOWN**. |
| Stop sequences | No Covert stop list is recorded. Preserve model EOS and runtime stop behavior as **UNKNOWN** until directly observed. |
| Sampler | Upstream generation config values above are reference defaults only. No Authority-saved Qwen profile is present. |
| Resource estimate | Peak physical RAM, commit, VRAM, and context/KV-cache cost are **UNKNOWN**. File size is not a resource estimate. Measure the exact runtime profile only after admission passes. |
| Host scope | No local artifact, canonical start, health probe, generation, cancellation, stop, or restart has been observed for this exact pack. |

## Covert role and qualification

- `builder`, `build`, and `verify` are candidate catalog roles. The manifest's prior `runtime_health=verified` and `coding_smoke=passed` labels have no exact-SHA evidence linked here and are not accepted as current qualification. No build, coding, test-generation, review, planning, or tool-call role is qualified by this card.
- Evidence state: `UPSTREAM_ARTIFACT_PINNED` / `LOCAL_ARTIFACT_ABSENT` / `GGUF_METADATA_UNVERIFIED` / `TEMPLATE_REFERENCE_PINNED` / `EMBEDDED_TEMPLATE_UNVERIFIED` / `CONFIGURATION_REQUIRED` / `RUNTIME_UNVERIFIED` / `QUALIFICATION_REQUIRED`.
- Continue only after obtaining the exact pinned file with matching SHA, parsing its GGUF architecture/template/tokens, creating the Authority-governed exact-artifact profile, and passing current admission. Keep physical RAM, commit, VRAM, and GPU floors unchanged. Then run the complete qualification ladder through canonical Broker start, exact-model health, plain and multi-turn chat, cancellation, stop/release, restart, and role-specific probes.

## Upstream references

- [Pinned GGUF repository snapshot and Q4_K_M file list](https://huggingface.co/Qwen/Qwen2.5-Coder-1.5B-Instruct-GGUF/tree/f86cb2c1fa58255f8052cc32aeede1b7482d4361)
- [Pinned base model card](https://huggingface.co/Qwen/Qwen2.5-Coder-1.5B-Instruct/blob/2e1fd397ee46e1388853d2af2c993145b0f1098a/README.md), [tokenizer config](https://huggingface.co/Qwen/Qwen2.5-Coder-1.5B-Instruct/blob/2e1fd397ee46e1388853d2af2c993145b0f1098a/tokenizer_config.json), [generation config](https://huggingface.co/Qwen/Qwen2.5-Coder-1.5B-Instruct/blob/2e1fd397ee46e1388853d2af2c993145b0f1098a/generation_config.json)
- [Qwen2.5-Coder official family table and special tokens](https://github.com/QwenLM/Qwen2.5-Coder)
- [Qwen Team family parameter, context, and license table](https://qwenlm.github.io/blog/qwen2.5-coder-family/)
