---
name: covert-resident-specialization
description: Select and, only when justified, fine-tune a compact Resident model for low-latency control-plane assistance while keeping heavy coding/reasoning work routable to other models.
---

# Covert Resident specialization

## Resident job

Resident should excel at intent understanding, project/context navigation, workflow selection, concise planning, tool schema adherence, structured output, memory/context use, authority awareness, truthful UNKNOWN handling, handoff and status explanation. It does not need to be the strongest patch generator.

## Battery before tuning

Measure: conversational usefulness; instruction following; JSON/schema compliance; tool selection/arguments; refusal to invent unavailable state; exact model/project references; memory retrieval fidelity; ambiguity handling; authority/approval discipline; context compression/handoff; latency, RAM/VRAM and sustained stability.

## Decision rule

1. Test multiple eligible bases with the same harness and runtime.
2. Try system contract, examples, retrieval/context and decoding changes first.
3. List persistent failure clusters.
4. Fine-tune only if a stable cluster is learnable and important.
5. Prefer parameter-efficient adapter training when supported; retain untouched base identity and adapter provenance.
6. Train a generic shipped Resident only on Covert-authored or training-compatible licensed material. No secrets, private repos or imported user histories.
7. Keep personalization in memory/context by default.
8. Re-run base-vs-adapter battery and regression suite. Reject adapter if it improves persona but harms tool correctness, truthfulness or general capability.
9. Quantize only after post-training evaluation; verify quantized behavior separately.

## Candidate characteristics

Prioritize permissive licensing, 1–4B scale for common local hardware, strong instruction/tool behavior, supported local runtime/quantization and stable chat templates. Candidate names are research inputs, not locked product choices.
