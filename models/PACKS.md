# AIDE Model Packs

AIDE has a full offline model-bundle release path. Source checkouts remain small,
while the signed release bundle contains the verified public weights.

| Pack | Role | Approx. file | License |
| --- | --- | ---: | --- |
| SmolLM2 360M Q8_0 | Fast chat/planning candidate | 386 MB | Apache-2.0 |
| Qwen2.5-Coder 0.5B Q4_K_M | Autocomplete/light-edit candidate | 491 MB | Apache-2.0 |
| Qwen2.5-Coder 1.5B Q4_K_M | Coding/build candidate | 1.12 GB | Apache-2.0 |

These roles describe catalog intent, not Covert qualification. See the [SmolLM2 360M model card](../docs/nightshift/evidence/MODEL-CARD-SMOLLM2-360M-Q8_0.md), [Qwen2.5-Coder 0.5B card](../docs/nightshift/evidence/MODEL-CARD-QWEN2.5-CODER-0.5B-Q4_K_M.md), and [Qwen2.5-Coder 1.5B card](../docs/nightshift/evidence/MODEL-CARD-QWEN2.5-CODER-1.5B-Q4_K_M.md) for artifact identity, template/runtime gaps, and qualification evidence.

The registry records a pinned source revision and expected file hash. These
three local candidates are not currently runtime-qualified on this device. The
full offline release bundle is intended to include all three files. Before a
pack becomes `ready`,
AIDE must verify the checksum, load it through the selected runtime, query
`/v1/models`, run a short generation smoke test, and record the result. A model
that is bundled but fails the smoke test remains `pending`.

The full bundle is approximately 1.9 GB and is published as a separate release
asset so source users are not forced to download model weights. See `models/BUNDLE.md`.
