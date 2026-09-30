---
name: covert-model-pack-curation
description: Research, benchmark, license-check and publish optional Covert model-pack recommendations matched to device resources and roles without equating download or load success with qualification.
---

# Covert model-pack curation

## Pack admission record

Require exact upstream repository, immutable revision, upstream license/notice, exact artifact/quantization, SHA-256, tokenizer/chat-template identity, approximate bytes, RAM/VRAM/disk estimate, supported runtime/backends, context tested, measured latency/tokens-per-second, role battery, known failures and redistribution decision.

## Procedure

1. Start with product role, not model popularity.
2. Measure the target hardware tiers Covert intends to support.
3. Prefer permissive redistribution terms for downloadable/offline public packs. Custom licenses require explicit review before bundling or mirroring.
4. Download to a temporary partial path, support cancellation/resume if feasible, verify size/hash, validate GGUF/metadata, then atomically promote.
5. Register through Model Manager with exact identity.
6. Run qualification: load, `/v1/models` or equivalent identity, short generation, structured-output/tool probe where role requires it, cancellation, timeout and cleanup.
7. Benchmark against at least one incumbent pack on the same prompts/runtime/settings.
8. Mark `RECOMMENDED` only for a defined hardware/workflow tier. Never create a global "best model" label.
9. Re-check upstream revision/license before each release refresh.

## Recommendation output

Show: "recommended because", download size, estimated memory fit, expected speed band, privacy/network impact, roles, license and limitations. User can override.
