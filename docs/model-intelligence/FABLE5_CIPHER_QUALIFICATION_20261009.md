# Cipher Resident Candidate — Fable5 Coding Agent Heretic

Date: 2026-10-09
Status: CANDIDATE_ONLY — NOT DOWNLOADED — NOT QUALIFIED

## Candidate

Hugging Face:
`saidutta69/lfm2.5-2.6b-fable5-coding-agent-heretic`

Lineage:

`LiquidAI/LFM2.5-2.6B`
→ full-parameter coding-agent SFT: `AyoubChLin/lfm2.5-2.6b-fable5-coding-agent`
→ Heretic v1.4 directional ablation / refusal reduction

The publisher describes the SFT lineage as trained on `saidutta69/fable-5-premium` and intended to preserve LFM2.5 tool-use / instruction-following behavior while reducing refusals.

## Published candidate facts

- architecture: LFM2.5 / 2.6B class
- intended behavior: coding agent, tool use, conversation, instruction following
- LFM2.5 lineage: 128K configured context
- publisher refusal test: 96/100 baseline → 7/100 candidate
- reported KL divergence: 0.014
- GGUF ladder includes:
  - IQ4_XS ≈ 1.42 GB
  - Q4_K_M ≈ 1.56 GB
  - Q5_K_M ≈ 1.81 GB
  - Q6_K ≈ 2.07 GB
  - Q8_0 ≈ 2.68 GB

These remain publisher claims until independently verified.

## Current Cipher control

Keep the existing official `LiquidAI/LFM2.5-2.6B` artifact unchanged as the control.

Do not replace, rename, delete, or silently retarget the current Resident artifact.

## Qualification design

The first comparison MUST use matched quantization:

`official LFM2.5-2.6B Q4_K_M`
vs
`Fable5 Coding Agent Heretic Q4_K_M`

This isolates behavioral differences from quantization quality.

Only if Fable survives the matched test should a second quality ladder compare Q5_K_M and optionally Q6_K.

### Required harness categories

1. instruction following
2. claim discipline / unknown handling
3. multi-step planning
4. tool selection
5. tool argument fidelity
6. tool-result interpretation
7. authority / grant boundaries
8. prompt-injection resistance
9. credential non-disclosure
10. project / checkout identity preservation
11. delegated-worker selection
12. code diagnosis
13. bounded code-change planning
14. refusal appropriateness
15. over-compliance / incorrect-premise susceptibility
16. compound tasks
17. long-context continuity
18. recovery after tool failure

### Promotion rule

Fable may become the preferred Cipher candidate only if it:

- materially improves the current Resident score or closes known compound/tool gaps;
- does not regress authority, credential, or truthfulness tests;
- does not widen actions beyond requested scope;
- preserves deterministic tool-call parsing in the Covert harness;
- passes Resource Admission on the target laptop;
- has exact repository revision and artifact SHA-256 recorded.

No model-card claim is acceptance evidence.

## Storage gate

Do NOT download the candidate while workstation storage pressure is active.

When storage is cleared, acquire only the selected first-test GGUF and record:

- repository
- exact revision
- filename
- size
- SHA-256
- tokenizer/chat-template provenance
- llama.cpp/runtime version

Then run the matched Q4_K_M bake-off.

Disposition:

`FABLE5_CIPHER_CANDIDATE_RESEARCHED_TEST_PENDING`
