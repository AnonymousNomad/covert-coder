# Candidate model notes — 2026-09-29

These are research candidates only. Covert must benchmark exact revisions/quantizations on target hardware before recommendations or bundling.

## Resident/control-plane candidates

### Qwen3 1.7B

- Official Hugging Face model currently declares Apache-2.0.
- Small enough to investigate as a low-latency Resident candidate and has a base variant available for post-training experiments.
- Source: https://huggingface.co/Qwen/Qwen3-1.7B

### IBM Granite 4.0 Micro

- Official model card describes a 3B instruct model, Apache-2.0, with instruction following, tool calling, RAG/code/function-calling use cases and explicit fine-tuning suitability.
- Particularly relevant to Resident because tool/schema behavior matters more than raw coding rank.
- Source: https://huggingface.co/ibm-granite/granite-4.0-micro

### SmolLM3 3B

- Official Hugging Face model declares Apache-2.0 and is positioned as a compact instruct/reasoning model.
- Candidate for a balanced local assistant tier; benchmark latency and tool behavior directly.
- Source: https://huggingface.co/HuggingFaceTB/SmolLM3-3B

### Liquid LFM2 / LFM2.5 2.6B family

- Edge-oriented hybrid family with a 2.6B checkpoint and 32K context in the referenced model card; the 2.6B variant supports hybrid reasoning.
- Uses the custom LFM Open License v1.0 rather than Apache/MIT. Do not mirror/bundle until the exact intended redistribution/fine-tune terms are reviewed and recorded.
- This family is already relevant to Covert's local evaluation history, so retain it as a benchmark/candidate rather than assuming it is the public default.
- Source: https://huggingface.co/LiquidAI/LFM2-2.6B

### Phi-4 Mini Instruct

- Microsoft repository declares MIT and ships a sample fine-tune script; full precision repository is materially larger than the 1–3B candidates.
- Useful as a quality/feature benchmark and possible higher hardware tier after exact quant/runtime evaluation.
- Source: https://huggingface.co/microsoft/Phi-4-mini-instruct

## Coding pack direction

The repository's current public pack list still centers on Qwen2.5-Coder 0.5B/1.5B. Do not remove those merely because newer models exist. Rebenchmark against current Apache-licensed Qwen3 family and other compact coding-capable candidates under the actual Covert patch/test harness, then promote only measured improvements.

Qwen3-Coder-Next is not a small download despite 3B active parameters: the official model is 80B total. Treat active parameter count and stored weight size as separate hardware/download constraints.

## Context migration note

OpenAI currently documents ChatGPT data export, and explicitly states that transferring exported conversations does not transfer memories/settings as such. Therefore Covert should ingest authorized export files as source material and derive reviewable candidate memories rather than promising direct ChatGPT-memory replication.

Sources:
- https://help.openai.com/en/articles/7260999-how-do-i-export-my-chatgpt-history-and-data
- https://help.openai.com/en/articles/9106926-transfer-exported-conversations-between-chatgpt-accounts
- https://help.openai.com/en/articles/8590148-memory-in-chatgpt
